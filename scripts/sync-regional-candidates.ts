import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";
import { getPartyColours, getPartyShortName, slugify } from "./lib/parties";

const DEMOCRACY_CLUB_BASE = "https://candidates.democracyclub.org.uk/api/next";
const ELECTION_ID = "sp.r.2026-05-07";
const OUTPUT_DIR = "data/regional-candidates";

interface Candidacy {
  person: { id: number; name: string; url?: string };
  party: { name: string; ec_id?: string; url?: string | null };
  party_name: string;
  party_list_position: number | null;
  deselected: boolean;
}

interface Ballot {
  ballot_paper_id: string;
  post: { slug: string; label: string };
  candidates_locked?: boolean;
  candidacies: Candidacy[];
}

interface BallotsResponse {
  count: number;
  results: Ballot[];
  next: string | null;
}

interface RegionalCandidateYaml {
  id: string;
  name: string;
  party: string;
  partyShort: string;
  color: string;
  accent: string;
  textColor?: string;
  region: string;
  regionLabel: string;
  listPosition: number;
  ballotPaperId: string;
  isIncumbent: boolean;
  bio: string;
  highlights: string[];
  sources: { url: string; type: string }[];
}

async function fetchRegionalBallots(): Promise<Ballot[]> {
  const all: Ballot[] = [];
  let url: string | null =
    `${DEMOCRACY_CLUB_BASE}/ballots/?election_id=${ELECTION_ID}&page_size=200`;
  while (url) {
    const page = await fetchJson<BallotsResponse>(url);
    all.push(...page.results);
    url = page.next;
    if (url) await new Promise((r) => setTimeout(r, 500));
  }
  return all;
}

async function fetchBallotDetail(ballotId: string): Promise<Ballot> {
  return fetchJson<Ballot>(`${DEMOCRACY_CLUB_BASE}/ballots/${ballotId}/`);
}

function uniqueIdFor(slug: string, regionSlug: string, used: Set<string>): string {
  if (!used.has(slug)) return slug;
  const composite = `${slug}-${regionSlug}`;
  if (!used.has(composite)) return composite;
  let n = 2;
  while (used.has(`${composite}-${n}`)) n++;
  return `${composite}-${n}`;
}

function buildYaml(c: Candidacy, ballot: Ballot, id: string): RegionalCandidateYaml {
  const partyName = c.party_name || c.party?.name || "Independent";
  const colours = getPartyColours(partyName);
  const partyShort = getPartyShortName(partyName);
  const regionSlug = ballot.post.slug;
  const out: RegionalCandidateYaml = {
    id,
    name: c.person.name,
    party: partyName,
    partyShort,
    color: colours.color,
    accent: colours.accent,
    region: regionSlug,
    regionLabel: ballot.post.label,
    // 999 is a sentinel for "no list" — used for true independents. Sole-party
    // candidates whose API record omits a list position should default to 1
    // (they are position 1 on a list of one), not the independent sentinel.
    listPosition: c.party_list_position ?? (partyName === "Independent" ? 999 : 1),
    ballotPaperId: ballot.ballot_paper_id,
    isIncumbent: false,
    bio: `${partyName} regional list candidate for ${ballot.post.label}.`,
    highlights: [
      `${partyName} regional list candidate for ${ballot.post.label} in the 2026 Scottish Parliament election`,
    ],
    sources: [
      {
        url: c.party?.url ?? `${DEMOCRACY_CLUB_BASE}/ballots/${ballot.ballot_paper_id}/`,
        type: "party_website",
      },
    ],
  };
  if (colours.textColor) out.textColor = colours.textColor;
  return out;
}

function writeYaml(filePath: string, data: RegionalCandidateYaml): void {
  const content = yaml.stringify(data, { lineWidth: 0 });
  fs.writeFileSync(filePath, content, "utf-8");
}

async function main() {
  console.log(`Fetching regional ballots for ${ELECTION_ID}...`);
  const summaries = await fetchRegionalBallots();
  console.log(`Found ${summaries.length} ballots.`);

  const ballots: Ballot[] = [];
  for (const s of summaries) {
    const detail = await fetchBallotDetail(s.ballot_paper_id);
    ballots.push(detail);
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const usedIds = new Set<string>();
  let written = 0;
  let totalCandidacies = 0;
  for (const ballot of ballots) {
    const sortedCandidacies = [...ballot.candidacies].sort(
      (a, b) => (a.party_list_position ?? 999) - (b.party_list_position ?? 999)
    );
    for (const c of sortedCandidacies) {
      totalCandidacies++;
      if (c.deselected) continue;
      const baseSlug = slugify(c.person.name);
      const id = uniqueIdFor(baseSlug, ballot.post.slug, usedIds);
      usedIds.add(id);
      const data = buildYaml(c, ballot, id);
      writeYaml(path.join(OUTPUT_DIR, `${id}.yaml`), data);
      written++;
    }
  }
  console.log(`Wrote ${written} regional list candidates from ${totalCandidacies} candidacies across ${ballots.length} ballots to ${OUTPUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
