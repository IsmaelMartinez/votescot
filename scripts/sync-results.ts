/**
 * Pull declared results from Democracy Club's elections API and merge them
 * into data/results/. Mirrors the pattern of sync-polls.ts.
 *
 * Democracy Club exposes Scottish Parliament 2026 ballots under
 *   https://candidates.democracyclub.org.uk/api/next/ballots/?election_date=2026-05-07
 * Each ballot has:
 *   - ballot_paper_id like `sp.c.aberdeen-central.2026-05-07`
 *                    or `sp.r.glasgow.2026-05-07`
 *   - election.election_id `sp.c.2026-05-07` or `sp.r.2026-05-07`
 *   - post.slug like `aberdeen-central` (matches our YAML ids directly)
 *   - candidacies[].result.num_ballots / .elected once declared
 *
 * This is the production scrape path. Until results start landing the script
 * will report 0 updated and exit cleanly. Set SYNC_RESULTS=1 (or pass --live)
 * to actually fetch.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";

const ELECTION_DATE = "2026-05-07";
// Use the parent election_id filter so we fetch only the 73 constituency
// and 8 regional ballots — avoids paginating through ~3k UK-wide ballots
// (which trips Democracy Club's per-IP throttle).
const SP_CONSTITUENCY_API =
  "https://candidates.democracyclub.org.uk/api/next/ballots/" +
  `?election_id=sp.c.${ELECTION_DATE}&page_size=200`;
const SP_REGIONAL_API =
  "https://candidates.democracyclub.org.uk/api/next/ballots/" +
  `?election_id=sp.r.${ELECTION_DATE}&page_size=200`;

interface DcCandidacyResult {
  num_ballots: number | null;
  is_winner?: boolean | null;
}

interface DcBallotResults {
  num_turnout_reported?: number | null;
  turnout_percentage?: number | null;
  num_spoilt_ballots?: number | null;
  total_electorate?: number | null;
  source?: string | null;
}

interface DcBallot {
  ballot_paper_id: string;
  post: { id: string; label: string; slug: string };
  election: { election_id: string; name: string };
  candidacies: Array<{
    person: { id: number; name: string };
    party: { ec_id: string; name: string };
    party_list_position?: number | null;
    elected: boolean | null;
    result: DcCandidacyResult | null;
  }>;
  winner_count: number;
  results: DcBallotResults | null;
  cancelled: boolean;
}

// EC party IDs verified against the live API on 2026-05-08.
// PP63 is Green Party (England), NOT SNP — Scottish parties use different IDs.
const PARTY_EC_TO_KEY: Record<string, string> = {
  PP102: "snp", // Scottish National Party (SNP)
  PP53: "lab", // Labour Party
  PP52: "con", // Conservative and Unionist Party
  PP90: "libdem", // Liberal Democrats
  PP130: "green", // Scottish Green Party
  PP7931: "reform", // Reform UK
  PP7965: "alba", // Alba Party (in case any candidates appear)
};

function partyKey(ecId: string, name: string): string {
  if (PARTY_EC_TO_KEY[ecId]) return PARTY_EC_TO_KEY[ecId];
  if (ecId === "ynmp-party:2" || /^independent$/i.test(name)) return "ind";
  // Fallback: kebab-case the name. Schema accepts any string for `party`.
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchAllPages(startUrl: string): Promise<DcBallot[]> {
  const ballots: DcBallot[] = [];
  let url: string | null = startUrl;
  while (url) {
    const data: { results: DcBallot[]; next: string | null } = await fetchJson(url);
    ballots.push(...data.results);
    url = data.next;
  }
  return ballots;
}

async function fetchAllBallots(): Promise<DcBallot[]> {
  const constituency = await fetchAllPages(SP_CONSTITUENCY_API);
  const regional = await fetchAllPages(SP_REGIONAL_API);
  return [...constituency, ...regional];
}

function ballotIsConstituency(b: DcBallot): boolean {
  return b.ballot_paper_id.startsWith("sp.c.");
}

function ballotIsRegional(b: DcBallot): boolean {
  return b.ballot_paper_id.startsWith("sp.r.");
}

interface AggregatedRow {
  party: string;
  candidate: string;
  votes: number;
  share: number;
}

function aggregate(ballot: DcBallot): {
  total: number;
  results: AggregatedRow[];
  winner: string | null;
  declared: boolean;
} {
  const rowsWithVotes = ballot.candidacies.filter(
    (c) => c.result && c.result.num_ballots != null,
  );
  const total = rowsWithVotes.reduce(
    (s, c) => s + (c.result!.num_ballots as number),
    0,
  );
  const results: AggregatedRow[] = rowsWithVotes
    .map((c) => {
      const votes = c.result!.num_ballots as number;
      return {
        party: partyKey(c.party.ec_id, c.party.name),
        candidate: c.person.name,
        votes,
        share: total === 0 ? 0 : Number(((votes / total) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.votes - a.votes);
  const winnerCandidacy = ballot.candidacies.find(
    (c) => c.elected === true || c.result?.is_winner === true,
  );
  return {
    total,
    results,
    winner: winnerCandidacy
      ? partyKey(winnerCandidacy.party.ec_id, winnerCandidacy.party.name)
      : null,
    declared: rowsWithVotes.length > 0,
  };
}

async function main(): Promise<void> {
  const live = process.env.SYNC_RESULTS === "1" || process.argv.includes("--live");
  if (!live) {
    console.log(
      "[sync-results] Stub mode. Set SYNC_RESULTS=1 or pass --live once " +
        "Democracy Club starts publishing declared results.",
    );
    return;
  }
  console.log("[sync-results] Fetching ballots from Democracy Club…");
  const ballots = await fetchAllBallots();
  const spBallots = ballots.filter(
    (b) => !b.cancelled && (ballotIsConstituency(b) || ballotIsRegional(b)),
  );
  console.log(
    `[sync-results] Got ${ballots.length} ballots total, ${spBallots.length} Scottish Parliament.`,
  );

  let updatedConstituencies = 0;
  let constituencyWithResults = 0;
  for (const b of ballots) {
    if (b.cancelled || !ballotIsConstituency(b)) continue;
    const agg = aggregate(b);
    if (!agg.declared) continue;
    constituencyWithResults++;
    const id = b.post.slug;
    const filePath = path.resolve(`data/results/constituencies/${id}.yaml`);
    if (!fs.existsSync(filePath)) {
      console.warn(
        `[sync-results] Skipping unknown constituency id="${id}" ` +
          `(ballot ${b.ballot_paper_id})`,
      );
      continue;
    }
    const existing = yaml.parse(fs.readFileSync(filePath, "utf-8"));
    const top = agg.results[0];
    const second = agg.results[1];
    const merged = {
      ...existing,
      status: agg.winner ? "declared" : "partial",
      declaredAt: existing.declaredAt ?? new Date().toISOString(),
      winner: agg.winner,
      results: agg.results,
      majority:
        top && second
          ? {
              votes: top.votes - second.votes,
              share: Number((top.share - second.share).toFixed(2)),
              over: second.party,
            }
          : null,
      source: "Democracy Club",
    };
    fs.writeFileSync(filePath, yaml.stringify(merged));
    updatedConstituencies++;
  }

  let updatedRegional = 0;
  let regionalWithResults = 0;
  for (const b of ballots) {
    if (b.cancelled || !ballotIsRegional(b)) continue;

    // Regional ballots don't carry per-candidacy votes — voters pick a party.
    // The signal that the d'Hondt allocation has run is `candidacy.elected`
    // being set on the winning list candidates. DC stores ballot-level turnout
    // (turnout, spoilt, electorate) at b.results once the count is in.
    const elected = b.candidacies.filter((c) => c.elected === true);
    if (elected.length === 0) continue;
    regionalWithResults++;

    const id = b.post.slug;
    const filePath = path.resolve(`data/results/regional/${id}.yaml`);
    if (!fs.existsSync(filePath)) {
      console.warn(
        `[sync-results] Skipping unknown region id="${id}" ` +
          `(ballot ${b.ballot_paper_id})`,
      );
      continue;
    }

    const seatsAwarded = elected
      .filter((c) => (c.party_list_position ?? 0) >= 1)
      .slice()
      .sort(
        (a, c) =>
          (a.party_list_position as number) - (c.party_list_position as number),
      )
      .map((c) => ({
        party: partyKey(c.party.ec_id, c.party.name),
        candidate: c.person.name,
        listPosition: c.party_list_position as number,
      }));
    if (seatsAwarded.length === 0) {
      console.warn(
        `[sync-results] Region ${id} has elected candidates but no list ` +
          `positions; skipping until DC fills them in.`,
      );
      continue;
    }

    const ballotResults = b.results ?? {};
    const turnoutReported = ballotResults.num_turnout_reported ?? null;
    const spoilt = ballotResults.num_spoilt_ballots ?? 0;
    const electorate = ballotResults.total_electorate ?? null;
    const turnoutPct = ballotResults.turnout_percentage ?? null;
    const turnout =
      turnoutReported != null && electorate != null
        ? {
            valid: Math.max(0, turnoutReported - spoilt),
            rejected: spoilt,
            electorate,
            ...(turnoutPct != null ? { percent: turnoutPct } : {}),
          }
        : null;

    const existing = yaml.parse(fs.readFileSync(filePath, "utf-8"));
    if (existing?.manualEntry === true) {
      console.log(
        `[sync-results] Region ${id} marked manualEntry: true — preserving hand-entered data.`,
      );
      continue;
    }
    const merged = {
      ...existing,
      status: "declared",
      declaredAt: existing.declaredAt ?? new Date().toISOString(),
      ...(turnout ? { turnout } : {}),
      seatsAwarded,
      source: "Democracy Club",
    };
    fs.writeFileSync(filePath, yaml.stringify(merged));
    updatedRegional++;
  }

  console.log(
    `[sync-results] Constituencies: ${updatedConstituencies} updated ` +
      `(${constituencyWithResults} ballots had vote data). ` +
      `Regional: ${updatedRegional} updated (${regionalWithResults} ballots had vote data).`,
  );
}

if (process.argv[1]?.endsWith("sync-results.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
