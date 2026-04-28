import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";

const REGIONAL_CANDIDATES_DIR = "data/regional-candidates";
const MEMBERS_API = "https://data.parliament.scot/api/members";
const CONSTITUENCY_STATUS_API =
  "https://data.parliament.scot/api/memberelectionconstituencystatuses";
const REGION_STATUS_API =
  "https://data.parliament.scot/api/memberelectionregionstatuses";

// On the regional ballot, "incumbent" means "sitting MSP standing for
// re-election from this party's list" — regardless of whether their current
// seat is a constituency or a regional one. So we take the UNION of session-6
// constituency-status and region-status PersonIDs, ignoring seat-level
// verification entirely.
//
// Same date window as fix-incumbents.ts: any election-status record whose
// ValidFromDate falls inside the 6th session window (2021-05-06 to the 2026
// dissolution on 2026-04-08) counts as a session-6 MSP, including mid-session
// by-election winners. The Parliament API's IsCurrent flag is unreliable
// during dissolution, so we use the date window instead.
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

interface RegionalCandidateData {
  id: string;
  name: string;
  region: string;
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
    .replace(/\bdr\.?\s*/g, "")
    .replace(/\./g, "")
    .trim();
}

function parseMspName(parliamentaryName: string, preferredName: string): { first: string; surname: string } {
  const parts = parliamentaryName.split(",").map((s) => s.trim());
  const surname = normaliseName(parts[0]);
  const firstToken = preferredName.split(/\s+/)[0];
  const first = normaliseName(firstToken);
  return { first, surname };
}

function parseCandidateName(fullName: string): { first: string; surname: string; allTokens: string[] } {
  const tokens = normaliseName(fullName).split(/\s+/).filter(Boolean);
  const first = tokens[0];
  const surname = tokens[tokens.length - 1];
  return { first, surname, allTokens: tokens };
}

function readYaml(filePath: string): RegionalCandidateData | null {
  if (!fs.existsSync(filePath)) return null;
  return yaml.parse(fs.readFileSync(filePath, "utf-8")) as RegionalCandidateData;
}

/** Replace only the isIncumbent field in-place, preserving all other formatting. */
function setIncumbent(filePath: string, value: boolean) {
  const content = fs.readFileSync(filePath, "utf-8");
  const pattern = value ? /^isIncumbent:\s*false\s*$/m : /^isIncumbent:\s*true\s*$/m;
  const newContent = content.replace(pattern, `isIncumbent: ${value}`);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
  }
}

function isSessionSix(from: string | null | undefined): boolean {
  if (!from) return false;
  return from >= SESSION_6_START && from <= SESSION_6_END;
}

async function main() {
  console.log("Fetching current MSPs from Scottish Parliament API...");
  const [allMembers, constituencyStatuses, regionStatuses] = await Promise.all([
    fetchJson<ScotParliamentMember[]>(MEMBERS_API),
    fetchJson<ElectionStatus[]>(CONSTITUENCY_STATUS_API),
    fetchJson<ElectionStatus[]>(REGION_STATUS_API),
  ]);

  const sessionSixPersonIds = new Set<number>();
  for (const status of constituencyStatuses) {
    if (isSessionSix(status.ValidFromDate)) sessionSixPersonIds.add(status.PersonID);
  }
  for (const status of regionStatuses) {
    if (isSessionSix(status.ValidFromDate)) sessionSixPersonIds.add(status.PersonID);
  }

  if (sessionSixPersonIds.size === 0) {
    throw new Error(
      "No session-6 PersonIDs found. The election-status APIs may have changed shape; aborting."
    );
  }

  const currentMsps = allMembers.filter((m) => sessionSixPersonIds.has(m.PersonID));
  console.log(
    `Found ${currentMsps.length} session-6 MSPs (${allMembers.length} total members; ` +
      `${sessionSixPersonIds.size} unique PersonIDs in session-6 election statuses across ` +
      `${constituencyStatuses.length} constituency-status + ${regionStatuses.length} region-status records).`
  );

  const mspByKey = new Map<string, ScotParliamentMember[]>();
  const mspParsed: { member: ScotParliamentMember; first: string; surname: string }[] = [];

  for (const msp of currentMsps) {
    const { first, surname } = parseMspName(msp.ParliamentaryName, msp.PreferredName);
    mspParsed.push({ member: msp, first, surname });

    const key = `${first}|${surname}`;
    if (!mspByKey.has(key)) mspByKey.set(key, []);
    mspByKey.get(key)!.push(msp);
  }

  const candidateFiles = fs.readdirSync(REGIONAL_CANDIDATES_DIR).filter((f) => f.endsWith(".yaml"));
  console.log(`Found ${candidateFiles.length} regional candidate files.\n`);

  let matchCount = 0;
  let clearedCount = 0;
  const matches: string[] = [];
  const cleared: string[] = [];
  const matchedPersonIds = new Set<number>();

  for (const file of candidateFiles) {
    const filePath = path.join(REGIONAL_CANDIDATES_DIR, file);
    const candidate = readYaml(filePath);
    if (!candidate) continue;

    const { first, surname, allTokens } = parseCandidateName(candidate.name);

    let matchedMsp: ScotParliamentMember | undefined;
    const primaryKey = `${first}|${surname}`;
    if (mspByKey.has(primaryKey)) {
      matchedMsp = mspByKey.get(primaryKey)![0];
    }
    let matched = !!matchedMsp;

    if (!matched) {
      for (const msp of mspParsed) {
        // Hyphenated MSP surname
        if (msp.surname.includes("-")) {
          const candidateJoined = allTokens.join("-");
          if (candidateJoined.includes(msp.surname) && first === msp.first) {
            matchedMsp = msp.member;
            matched = true;
            break;
          }
          for (let i = 1; i < allTokens.length; i++) {
            const trySurname = allTokens.slice(i).join("-");
            if (trySurname === msp.surname && first === msp.first) {
              matchedMsp = msp.member;
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        // Candidate has hyphenated surname containing MSP surname
        if (surname.includes("-") && surname === msp.surname && first === msp.first) {
          matchedMsp = msp.member;
          matched = true;
          break;
        }

        // Middle-name strategy: candidate has middle names, match first +
        // any later token as surname
        if (!matched && msp.first === first) {
          for (let i = 1; i < allTokens.length; i++) {
            if (allTokens[i] === msp.surname) {
              matchedMsp = msp.member;
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        // MSP has space-separated multi-word surname
        if (!matched && msp.surname.includes(" ") && msp.first === first) {
          for (let i = 1; i < allTokens.length; i++) {
            const trySurname = allTokens.slice(i).join(" ");
            if (trySurname === msp.surname) {
              matchedMsp = msp.member;
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }
    }

    if (matched && matchedMsp) {
      matchedPersonIds.add(matchedMsp.PersonID);
    }

    if (matched && !candidate.isIncumbent) {
      setIncumbent(filePath, true);
      matchCount++;
      matches.push(`  + ${candidate.name} (${file})`);
    } else if (!matched && candidate.isIncumbent) {
      setIncumbent(filePath, false);
      clearedCount++;
      cleared.push(`  - ${candidate.name} (${file}) — no session-6 MSP match`);
    }
  }

  console.log(`Marked ${matchCount} regional candidates as incumbent:\n`);
  for (const m of matches) {
    console.log(m);
  }

  if (clearedCount > 0) {
    console.log(`\nCleared incumbent flag from ${clearedCount} regional candidates:\n`);
    for (const m of cleared) {
      console.log(m);
    }
  }

  const unmatchedMsps: string[] = [];
  for (const { member } of mspParsed) {
    if (!matchedPersonIds.has(member.PersonID)) {
      unmatchedMsps.push(`  - ${member.ParliamentaryName}`);
    }
  }

  if (unmatchedMsps.length > 0) {
    console.log(
      `\n${unmatchedMsps.length} session-6 MSPs not matched to any regional candidate (not standing on a regional list, or name mismatch):\n`
    );
    for (const u of unmatchedMsps) {
      console.log(u);
    }
  }

  if (matchCount === 0 && clearedCount === 0) {
    throw new Error(
      "Script flagged 0 candidates and cleared 0 — expected dozens. Something is broken; aborting."
    );
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
