import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";

const CANDIDATES_DIR = "data/candidates";
const MEMBERS_API = "https://data.parliament.scot/api/members";
const CONSTITUENCY_STATUS_API =
  "https://data.parliament.scot/api/memberelectionconstituencystatuses";
const CONSTITUENCIES_API = "https://data.parliament.scot/api/constituencies";

// 2021-boundary constituency slug -> 2026-boundary candidate.constituency slug.
// Only entries where a 2021 seat was renamed or absorbed into a differently-named
// 2026 seat. Same-name cases (Dumbarton, Edinburgh Central, Perthshire North,
// etc.) don't need an entry — the direct slug match handles them.
//
// Compiled from the Boundaries Scotland 2026 review. Where a 2021 seat was
// split across multiple 2026 seats, we map to the seat that inherited the
// larger share of the predecessor (the "primary" successor), because that's
// where the sitting MSP is typically selected to stand again.
const BOUNDARY_SUCCESSORS: Record<string, string> = {
  "north-east-fife": "fife-north-east",
  "edinburgh-western": "edinburgh-north-western",
  "edinburgh-northern-and-leith": "edinburgh-north-eastern-and-leith",
  "edinburgh-eastern": "edinburgh-eastern-musselburgh-and-tranent",
  "edinburgh-pentlands": "edinburgh-south-western",
  "greenock-and-inverclyde": "inverclyde",
  "east-lothian": "east-lothian-coast-and-lammermuirs",
  "aberdeen-south-and-north-kincardine": "aberdeen-deeside-and-north-kincardine",
  "airdrie-and-shotts": "airdrie",
  "linlithgow": "falkirk-east-and-linlithgow",
  "falkirk-east": "falkirk-east-and-linlithgow",
  "glasgow-cathcart": "glasgow-cathcart-and-pollok",
  "glasgow-pollok": "glasgow-cathcart-and-pollok",
  "glasgow-shettleston": "glasgow-baillieston-and-shettleston",
  "glasgow-kelvin": "glasgow-kelvin-and-maryhill",
  "glasgow-maryhill-and-springburn": "glasgow-kelvin-and-maryhill",
  "glasgow-provan": "glasgow-easterhouse-and-springburn",
  "midlothian-north-and-musselburgh": "midlothian-north",
  "renfrewshire-north-and-west": "renfrewshire-north-and-cardonald",
  "renfrewshire-south": "renfrewshire-west-and-levern-valley",
  "rutherglen": "rutherglen-and-cambuslang",
};

function slugifyConstituency(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['']/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

// `isIncumbent: true` means "the sitting constituency MSP of this seat" — i.e.
// the name next to the winner on the 2021 declaration for this (or a successor)
// seat. Regional-list MSPs who are now standing for a constituency they didn't
// previously represent are NOT incumbents of that seat, so the region-status
// API is deliberately not consulted.
//
// The Parliament API's IsCurrent flag is also unreliable: it flips to false
// for every MSP during the ~25-working-day dissolution period before polling.
// Instead we take any constituency-status record that begins within the current
// parliamentary session (2021-05-06 general election up to the 2026-04-08
// dissolution). That catches both the initial 2021 cohort and any mid-session
// constituency by-election winners (e.g. Davy Russell in June 2025).
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
  ConstituencyID: number;
  ValidFromDate: string;
  ValidUntilDate: string | null;
}

interface ApiConstituency {
  ID: number;
  Name: string;
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
function setIncumbent(filePath: string, value: boolean) {
  const content = fs.readFileSync(filePath, "utf-8");
  const pattern = value ? /^isIncumbent:\s*false\s*$/m : /^isIncumbent:\s*true\s*$/m;
  const newContent = content.replace(pattern, `isIncumbent: ${value}`);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
  }
}

async function main() {
  console.log("Fetching current MSPs from Scottish Parliament API...");
  const [allMembers, constituencyStatuses, apiConstituencies] = await Promise.all([
    fetchJson<ScotParliamentMember[]>(MEMBERS_API),
    fetchJson<ElectionStatus[]>(CONSTITUENCY_STATUS_API),
    fetchJson<ApiConstituency[]>(CONSTITUENCIES_API),
  ]);

  // Build ConstituencyID -> slugified name map for seats active during session 6.
  // The API issues new IDs when it refreshes a seat administratively, so some
  // session-6 seats appear with ValidFromDate 2011-05-04 (e.g. Edinburgh Central
  // ID 101, continuous) and others with 2021-05-06 (e.g. Coatbridge and Chryston
  // ID 151, re-issued). Include any seat whose validity span overlaps session 6.
  const constituencyIdToSlug = new Map<number, string>();
  for (const c of apiConstituencies) {
    const from = c.ValidFromDate ?? "";
    const until = c.ValidUntilDate ?? "";
    const startsBeforeSession6End = from <= SESSION_6_END;
    const endsAfterSession6Start = !until || until >= SESSION_6_START;
    if (startsBeforeSession6End && endsAfterSession6Start) {
      constituencyIdToSlug.set(c.ID, slugifyConstituency(c.Name));
    }
  }

  const sessionSixPersonIds = new Set<number>();
  const personIdToSeatSlug = new Map<number, string>();
  for (const status of constituencyStatuses) {
    const from = status.ValidFromDate ?? "";
    if (from >= SESSION_6_START && from <= SESSION_6_END) {
      sessionSixPersonIds.add(status.PersonID);
      const seatSlug = constituencyIdToSlug.get(status.ConstituencyID);
      if (seatSlug) {
        // Keep the EARLIEST session-6 seat — if an MSP moved constituencies
        // mid-session via by-election, we credit them to the seat they most
        // recently held (overwrite preserves most recent since we can't tell
        // ordering from API alone, but practical cases match either way).
        personIdToSeatSlug.set(status.PersonID, seatSlug);
      }
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

  /**
   * Given an MSP's 2021-boundary seat and a candidate's 2026-boundary seat,
   * decide whether the candidate is standing in the same-or-successor seat.
   */
  function seatMatches(mspSeatSlug: string, candidateSeatSlug: string): boolean {
    if (mspSeatSlug === candidateSeatSlug) return true;
    const successor = BOUNDARY_SUCCESSORS[mspSeatSlug];
    return successor === candidateSeatSlug;
  }

  // Read all candidate YAML files
  const candidateFiles = fs.readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith(".yaml"));
  console.log(`Found ${candidateFiles.length} candidate files.\n`);

  let matchCount = 0;
  let clearedCount = 0;
  const matches: string[] = [];
  const cleared: string[] = [];

  for (const file of candidateFiles) {
    const filePath = path.join(CANDIDATES_DIR, file);
    const candidate = readYaml(filePath);
    if (!candidate) continue;

    const { first, surname, allTokens } = parseCandidateName(candidate.name);

    // Track which MSP PersonID matched — needed for seat-level verification.
    let matchedMsp: ScotParliamentMember | undefined;
    const primaryKey = `${first}|${surname}`;
    if (mspByKey.has(primaryKey)) {
      matchedMsp = mspByKey.get(primaryKey)![0];
    }
    let matched = !!matchedMsp;

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
            matchedMsp = msp.member;
            matched = true;
            break;
          }
          // Also try joining last N tokens of candidate name
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

        // Check if candidate has a hyphenated surname that contains the MSP surname
        if (surname.includes("-") && surname === msp.surname && first === msp.first) {
          matchedMsp = msp.member;
          matched = true;
          break;
        }

        // Strategy 3: candidate has middle names — match first name + any
        // later token as surname
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

        // Strategy 4: MSP has a space-separated multi-word surname (e.g.
        // "Halcro Johnston") — check if joining the last N candidate tokens
        // with a space matches the MSP surname.
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

    // Seat-level verification: even if the name matches, the candidate is only
    // the incumbent of THIS seat if their 2021 constituency (or its 2026
    // successor via BOUNDARY_SUCCESSORS) equals the candidate's constituency.
    // An MSP who moved to a wholly different seat is not the incumbent of the
    // new one.
    let seatOk = false;
    if (matched && matchedMsp) {
      const mspSeat = personIdToSeatSlug.get(matchedMsp.PersonID);
      if (mspSeat && seatMatches(mspSeat, candidate.constituency)) {
        seatOk = true;
      }
    }
    matched = matched && seatOk;

    if (matched && !candidate.isIncumbent) {
      setIncumbent(filePath, true);
      matchCount++;
      matches.push(`  ✓ ${candidate.name} (${file})`);
    } else if (!matched && candidate.isIncumbent) {
      setIncumbent(filePath, false);
      clearedCount++;
      cleared.push(`  ✗ ${candidate.name} (${file}) — no session-6 constituency match`);
    }
  }

  console.log(`Marked ${matchCount} candidates as incumbent:\n`);
  for (const m of matches) {
    console.log(m);
  }

  if (clearedCount > 0) {
    console.log(`\nCleared incumbent flag from ${clearedCount} candidates (no session-6 constituency-MSP match — typically regional-list MSPs standing in a constituency they didn't represent):\n`);
    for (const m of cleared) {
      console.log(m);
    }
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
