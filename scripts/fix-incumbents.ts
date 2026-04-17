import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";

const CANDIDATES_DIR = "data/candidates";
const MEMBERS_API = "https://data.parliament.scot/api/members";
const CONSTITUENCY_STATUS_API =
  "https://data.parliament.scot/api/memberelectionconstituencystatuses";
const REGION_STATUS_API =
  "https://data.parliament.scot/api/memberelectionregionstatuses";

// The Scottish Parliament API flips `IsCurrent` to false for every MSP during
// dissolution (~25 working days before polling day), so we can't rely on it in
// the run-up to an election. Instead, identify sitting MSPs as anyone whose
// election-status record begins within the current session (2021-05-06 general
// election up to the 2026-04-08 dissolution date). This range captures both the
// initial cohort and any mid-session replacements (by-elections, regional list
// replacements).
const SESSION_6_START = "2021-05-06";
const SESSION_6_END = "2026-04-08";

interface ScotParliamentMember {
  PersonID: number;
  ParliamentaryName: string;
  PreferredName: string;
  IsCurrent: boolean;
}

interface ElectionStatus {
  PersonID: number;
  ValidFromDate: string;
  ValidUntilDate: string | null;
}

interface CandidateData {
  id: string;
  name: string;
  constituency: string;
  isIncumbent: boolean;
  [key: string]: unknown;
}

/**
 * Normalise a name for comparison: lowercase, strip accents, remove
 * punctuation except hyphens within words (e.g. "Cole-Hamilton").
 */
function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (e.g. Màiri → Mairi)
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\bdr\.?\s*/g, "") // strip "Dr" or "Dr." prefix
    .replace(/\./g, "")
    .trim();
}

/**
 * From a Parliament API "Surname, First" entry, return { first, surname }.
 */
function parseMspName(parliamentaryName: string, preferredName: string): { first: string; surname: string } {
  const parts = parliamentaryName.split(",").map((s) => s.trim());
  const surname = normaliseName(parts[0]);
  // Use only the first token of PreferredName to handle multi-word entries
  // like "John Farquhar" — we only need the first name for matching
  const firstToken = preferredName.split(/\s+/)[0];
  const first = normaliseName(firstToken);
  return { first, surname };
}

/**
 * From a candidate YAML name like "John Ramsay Swinney", extract first and
 * last name. The last token is the surname unless it contains a hyphen that
 * spans multiple tokens (handled by joining). Middle names are ignored for
 * matching purposes.
 *
 * Special handling: if the YAML name contains a hyphenated surname that matches
 * the MSP surname, we use it. Otherwise first token = first, last token = surname.
 */
function parseCandidateName(fullName: string): { first: string; surname: string; allTokens: string[] } {
  const tokens = normaliseName(fullName).split(/\s+/).filter(Boolean);
  const first = tokens[0];
  const surname = tokens[tokens.length - 1];
  return { first, surname, allTokens: tokens };
}

function readYaml(filePath: string): CandidateData | null {
  if (!fs.existsSync(filePath)) return null;
  return yaml.parse(fs.readFileSync(filePath, "utf-8")) as CandidateData;
}

/** Replace only the isIncumbent field in-place, preserving all other formatting. */
function setIncumbentTrue(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  fs.writeFileSync(filePath, content.replace(/^isIncumbent: false$/m, "isIncumbent: true"));
}

async function main() {
  console.log("Fetching current MSPs from Scottish Parliament API...");
  const [allMembers, constituencyStatuses, regionStatuses] = await Promise.all([
    fetchJson<ScotParliamentMember[]>(MEMBERS_API),
    fetchJson<ElectionStatus[]>(CONSTITUENCY_STATUS_API),
    fetchJson<ElectionStatus[]>(REGION_STATUS_API),
  ]);

  const sessionSixPersonIds = new Set<number>();
  for (const status of [...constituencyStatuses, ...regionStatuses]) {
    const from = status.ValidFromDate ?? "";
    if (from >= SESSION_6_START && from <= SESSION_6_END) {
      sessionSixPersonIds.add(status.PersonID);
    }
  }

  const currentMsps = allMembers.filter((m) => sessionSixPersonIds.has(m.PersonID));
  console.log(
    `Found ${currentMsps.length} session-6 MSPs (${allMembers.length} total members; ${sessionSixPersonIds.size} unique PersonIDs in session-6 election statuses).`
  );

  // Build a lookup structure from MSP data. For each MSP we store the parsed
  // name and original data. We key by "first|surname" for fast lookup, but
  // also keep the full list for fallback matching.
  const mspByKey = new Map<string, ScotParliamentMember[]>();
  const mspParsed: { member: ScotParliamentMember; first: string; surname: string }[] = [];

  for (const msp of currentMsps) {
    const { first, surname } = parseMspName(msp.ParliamentaryName, msp.PreferredName);
    mspParsed.push({ member: msp, first, surname });

    const key = `${first}|${surname}`;
    if (!mspByKey.has(key)) mspByKey.set(key, []);
    mspByKey.get(key)!.push(msp);
  }

  // Read all candidate YAML files
  const candidateFiles = fs.readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith(".yaml"));
  console.log(`Found ${candidateFiles.length} candidate files.\n`);

  let matchCount = 0;
  const matches: string[] = [];

  for (const file of candidateFiles) {
    const filePath = path.join(CANDIDATES_DIR, file);
    const candidate = readYaml(filePath);
    if (!candidate) continue;
    if (candidate.isIncumbent) continue; // already marked

    const { first, surname, allTokens } = parseCandidateName(candidate.name);

    // Strategy 1: direct first+surname match
    let matched = mspByKey.has(`${first}|${surname}`);

    // Strategy 2: for hyphenated MSP surnames (e.g. "Cole-Hamilton"),
    // check if the candidate name contains those tokens joined.
    // Also handles candidate having hyphenated surname that the simple
    // parse missed.
    if (!matched) {
      for (const msp of mspParsed) {
        // Check if MSP surname is hyphenated and candidate tokens contain it
        if (msp.surname.includes("-")) {
          const candidateJoined = allTokens.join("-");
          if (candidateJoined.includes(msp.surname) && first === msp.first) {
            matched = true;
            break;
          }
          // Also try joining last N tokens of candidate name
          for (let i = 1; i < allTokens.length; i++) {
            const trySurname = allTokens.slice(i).join("-");
            if (trySurname === msp.surname && first === msp.first) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        // Check if candidate has a hyphenated surname that contains the MSP surname
        if (surname.includes("-") && surname === msp.surname && first === msp.first) {
          matched = true;
          break;
        }

        // Strategy 3: candidate has middle names — match first name + any
        // later token as surname
        if (!matched && msp.first === first) {
          for (let i = 1; i < allTokens.length; i++) {
            if (allTokens[i] === msp.surname) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        // Strategy 4: MSP has a space-separated multi-word surname (e.g.
        // "Halcro Johnston") — check if joining the last N candidate tokens
        // with a space matches the MSP surname.
        if (!matched && msp.surname.includes(" ") && msp.first === first) {
          for (let i = 1; i < allTokens.length; i++) {
            const trySurname = allTokens.slice(i).join(" ");
            if (trySurname === msp.surname) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }
    }

    if (matched) {
      setIncumbentTrue(filePath);
      matchCount++;
      matches.push(`  ✓ ${candidate.name} (${file})`);
    }
  }

  console.log(`Marked ${matchCount} candidates as incumbent:\n`);
  for (const m of matches) {
    console.log(m);
  }

  // Report current MSPs that were NOT matched to any candidate file, for
  // transparency (these are MSPs not standing again, or name mismatches).
  const matchedMspNames = new Set<string>();
  for (const file of candidateFiles) {
    const filePath = path.join(CANDIDATES_DIR, file);
    const candidate = readYaml(filePath);
    if (!candidate || !candidate.isIncumbent) continue;
    const { first, surname } = parseCandidateName(candidate.name);
    matchedMspNames.add(`${first}|${surname}`);
  }

  const unmatchedMsps: string[] = [];
  for (const { member, first, surname } of mspParsed) {
    // Check if this MSP was matched by checking all strategies
    let wasMatched = matchedMspNames.has(`${first}|${surname}`);
    if (!wasMatched) {
      // Check hyphenated surname matches
      for (const name of matchedMspNames) {
        const [mFirst, mSurname] = name.split("|");
        if (mFirst === first && mSurname === surname) {
          wasMatched = true;
          break;
        }
      }
    }
    if (!wasMatched) {
      unmatchedMsps.push(`  - ${member.ParliamentaryName}`);
    }
  }

  if (unmatchedMsps.length > 0) {
    console.log(`\n${unmatchedMsps.length} current MSPs not matched to any candidate (not standing or name mismatch):\n`);
    for (const u of unmatchedMsps) {
      console.log(u);
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
