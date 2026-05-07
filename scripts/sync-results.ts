/**
 * Pull declared results from Democracy Club's elections API and merge them
 * into data/results/. Mirrors the pattern of sync-polls.ts.
 *
 * Democracy Club exposes results as ballot objects under
 *   https://candidates.democracyclub.org.uk/api/next/elections/?identifier_type=parl.2026-05-07
 * (the 2026 Holyrood elections). Each constituency ballot has
 *   .candidacies[].votes_cast
 * and a `winner` flag once the returning officer has declared.
 *
 * This is the production scrape path. Until results start landing it's a stub
 * that warns and exits cleanly so CI doesn't fail. Once results begin, set
 * SYNC_RESULTS=1 in the environment (or pass --live) to actually fetch.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";

const ELECTION_DATE = "2026-05-07";
const SP_API =
  "https://candidates.democracyclub.org.uk/api/next/ballots/" +
  `?election_date=${ELECTION_DATE}&page_size=200`;

interface DcBallot {
  ballot_paper_id: string;
  post: { label: string; slug: string };
  election: { slug: string };
  candidacies: Array<{
    person: { id: number; name: string };
    party: { ec_id: string; name: string };
    votes_cast: number | null;
    elected: boolean | null;
    previous_party_affiliations?: Array<{ ec_id: string }>;
  }>;
  winner_count: number;
  results_url: string | null;
  cancelled: boolean;
}

const PARTY_EC_TO_KEY: Record<string, string> = {
  "PP63": "snp",        // Scottish National Party
  "party:53": "lab",    // Scottish Labour
  "PP52": "con",        // Conservative and Unionist Party
  "PP90": "libdem",     // Liberal Democrats
  "PP130": "green",     // Scottish Greens
  "PP7931": "reform",   // Reform UK
  "PP7965": "alba",     // Alba Party
};

async function fetchAllBallots(): Promise<DcBallot[]> {
  const ballots: DcBallot[] = [];
  let url: string | null = SP_API;
  while (url) {
    const data: { results: DcBallot[]; next: string | null } = await fetchJson(url);
    ballots.push(...data.results);
    url = data.next;
  }
  return ballots;
}

function ballotIsConstituency(b: DcBallot): boolean {
  return b.election.slug.includes("sp.c.");
}

function ballotIsRegional(b: DcBallot): boolean {
  return b.election.slug.includes("sp.r.");
}

function aggregate(ballot: DcBallot) {
  const total = ballot.candidacies.reduce((s, c) => s + (c.votes_cast ?? 0), 0);
  const results = ballot.candidacies
    .filter((c) => c.votes_cast != null)
    .map((c) => ({
      party: PARTY_EC_TO_KEY[c.party.ec_id] ?? c.party.name.toLowerCase(),
      candidate: c.person.name,
      votes: c.votes_cast as number,
      share: total === 0 ? 0 : Number(((c.votes_cast! / total) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.votes - a.votes);
  const winner = ballot.candidacies.find((c) => c.elected);
  return {
    total,
    results,
    winner: winner ? PARTY_EC_TO_KEY[winner.party.ec_id] ?? null : null,
    declared: ballot.candidacies.some((c) => c.votes_cast != null),
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
  let updatedConstituencies = 0;
  for (const b of ballots) {
    if (b.cancelled || !ballotIsConstituency(b)) continue;
    const agg = aggregate(b);
    if (!agg.declared) continue;
    const id = b.post.slug.replace(/^.*?--/, "");
    const filePath = path.resolve(`data/results/constituencies/${id}.yaml`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[sync-results] Skipping unknown constituency ${id}`);
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
      majority: top && second
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
  for (const b of ballots) {
    if (b.cancelled || !ballotIsRegional(b)) continue;
    const agg = aggregate(b);
    if (!agg.declared) continue;
    const id = b.post.slug;
    const filePath = path.resolve(`data/results/regional/${id}.yaml`);
    if (!fs.existsSync(filePath)) continue;
    const existing = yaml.parse(fs.readFileSync(filePath, "utf-8"));
    const merged = {
      ...existing,
      status: "declared",
      declaredAt: existing.declaredAt ?? new Date().toISOString(),
      results: agg.results.map((r) => ({ party: r.party, votes: r.votes, share: r.share })),
      source: "Democracy Club",
    };
    fs.writeFileSync(filePath, yaml.stringify(merged));
    updatedRegional++;
  }
  console.log(
    `[sync-results] Updated ${updatedConstituencies} constituencies and ` +
      `${updatedRegional} regional ballots.`,
  );
}

if (process.argv[1]?.endsWith("sync-results.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
