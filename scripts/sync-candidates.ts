import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";
import { getPartyColours, getPartyShortName, slugify } from "./lib/parties";

const DEMOCRACY_CLUB_BASE = "https://candidates.democracyclub.org.uk/api/next";
const ELECTION_ID = "sp.c.2026-05-07";

interface Candidacy {
  person: { id: number; name: string };
  party_name: string;
  party: { name: string; url?: string };
  deselected: boolean;
}

interface Ballot {
  ballot_paper_id: string;
  post: { slug: string; label: string };
  candidacies: Candidacy[];
}

interface DemocracyClubResult {
  id: number;
  person: { id: number; name: string; statement_to_voters: string | null };
  party: { name: string; url: string | null };
  post: { slug: string; label: string };
}

interface BallotsResponse {
  count: number;
  results: Ballot[];
  next: string | null;
}

export function transformCandidate(apiCandidate: DemocracyClubResult) {
  const colours = getPartyColours(apiCandidate.party.name);
  const bio =
    apiCandidate.person.statement_to_voters ||
    `${apiCandidate.party.name} candidate for ${apiCandidate.post.label}.`;

  return {
    id: slugify(apiCandidate.person.name),
    name: apiCandidate.person.name,
    party: apiCandidate.party.name,
    partyShort: getPartyShortName(apiCandidate.party.name),
    color: colours.color,
    accent: colours.accent,
    ...(colours.textColor ? { textColor: colours.textColor } : {}),
    constituency: apiCandidate.post.slug,
    isIncumbent: false,
    quizCandidate: false,
    bio,
    highlights: [],
    sources: [
      ...(apiCandidate.party.url
        ? [{ url: apiCandidate.party.url, type: "party_website" }]
        : []),
    ],
  };
}

export function transformConstituency(post: { slug: string; label: string }) {
  return {
    id: post.slug,
    name: post.label,
    region: "",
    boundaryYear: 2026,
    description: `${post.label} constituency for the 2026 Scottish Parliament election.`,
    context: "Data synced from Democracy Club.",
  };
}

function writeYaml(filePath: string, data: Record<string, unknown>) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, yaml.stringify(data, { lineWidth: 0 }));
}

function readYaml(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  return yaml.parse(fs.readFileSync(filePath, "utf-8"));
}

async function fetchAllBallots(): Promise<Ballot[]> {
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

function ballotToResults(ballot: Ballot): DemocracyClubResult[] {
  return ballot.candidacies
    .filter((c) => !c.deselected)
    .map((c) => ({
      id: c.person.id,
      person: { id: c.person.id, name: c.person.name, statement_to_voters: null },
      party: { name: c.party_name || c.party.name, url: c.party.url || null },
      post: ballot.post,
    }));
}

async function main() {
  console.log("Fetching ballots from Democracy Club...");
  const ballots = await fetchAllBallots();
  console.log(`Fetched ${ballots.length} ballots.`);

  const apiCandidates: DemocracyClubResult[] = [];
  for (const ballot of ballots) {
    apiCandidates.push(...ballotToResults(ballot));
  }
  console.log(`Total candidates: ${apiCandidates.length}.`);

  const apiCandidateIds = new Set<string>();
  const constituencies = new Map<string, { slug: string; label: string }>();
  let newCount = 0;
  let updatedCount = 0;

  for (const apiCandidate of apiCandidates) {
    const post = apiCandidate.post;
    if (!constituencies.has(post.slug)) {
      constituencies.set(post.slug, post);
    }

    const candidate = transformCandidate(apiCandidate);
    apiCandidateIds.add(candidate.id);
    const filePath = path.join("data/candidates", `${candidate.id}.yaml`);
    const existing = readYaml(filePath);

    if (!existing) {
      writeYaml(filePath, candidate);
      newCount++;
      console.log(`  NEW: ${candidate.name} (${candidate.partyShort}) — ${post.label}`);
    } else {
      const merged = {
        ...candidate,
        ...(existing.quizCandidate ? { quizCandidate: existing.quizCandidate } : {}),
        ...(existing.positions ? { positions: existing.positions } : {}),
        ...(existing.stances ? { stances: existing.stances } : {}),
        ...(existing.highlights && (existing.highlights as string[]).length > 0
          ? { highlights: existing.highlights }
          : candidate.highlights),
        bio: (existing.bio as string) || candidate.bio,
      };
      const existingYaml = yaml.stringify(existing, { lineWidth: 0 });
      const mergedYaml = yaml.stringify(merged, { lineWidth: 0 });
      if (existingYaml !== mergedYaml) {
        writeYaml(filePath, merged);
        updatedCount++;
      }
    }
  }

  for (const [, post] of constituencies) {
    const filePath = path.join("data/constituencies", `${post.slug}.yaml`);
    const existing = readYaml(filePath);
    if (!existing) {
      writeYaml(filePath, transformConstituency(post));
      console.log(`  NEW CONSTITUENCY: ${post.label}`);
    }
  }

  const candidateDir = "data/candidates";
  const existingFiles = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  const withdrawn: string[] = [];
  for (const file of existingFiles) {
    const id = file.replace(".yaml", "");
    const data = readYaml(path.join(candidateDir, file));
    if (data && !apiCandidateIds.has(id)) {
      withdrawn.push(`${data.name} (${data.partyShort}) — ${data.constituency}`);
    }
  }

  console.log(`\nSync complete: ${newCount} new, ${updatedCount} updated, ${withdrawn.length} potentially withdrawn`);

  if (withdrawn.length > 0) {
    console.log("\nPotentially withdrawn candidates:");
    withdrawn.forEach((w) => console.log(`  - ${w}`));
    fs.writeFileSync("withdrawn.json", JSON.stringify(withdrawn, null, 2));
  }
}

const scriptName = process.argv[1] || "";
if (scriptName.includes("sync-candidates")) {
  main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
