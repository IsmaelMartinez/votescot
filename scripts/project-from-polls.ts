import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import {
  loadPolls,
  rollingAverage,
  swingFrom,
  BASELINE_2021_CONSTITUENCY,
  BASELINE_2021_REGIONAL,
  PARTY_KEYS,
  type PartyKey,
  type PartyShares,
} from "./lib/poll-average.ts";

const CONSTITUENCIES_DIR = path.resolve("data/constituencies");
const REPORT_PATH = path.resolve("data/projection-report.json");

const PARTY_ID_TO_POLL_KEY: Record<string, PartyKey> = {
  snp: "snp",
  conservative: "con",
  labour: "lab",
  libdem: "libdem",
  green: "green",
  reform: "reform",
  alba: "alba",
};

interface TopParty {
  party: string;
  share: number;
  status: "will-win" | "could-win" | "might-win";
}

interface Constituency {
  id: string;
  name: string;
  projection: string;
  topParties: TopParty[];
}

function loadConstituencies(): Constituency[] {
  return fs
    .readdirSync(CONSTITUENCIES_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => {
      const raw = yaml.parse(fs.readFileSync(path.join(CONSTITUENCIES_DIR, f), "utf-8"));
      return {
        id: raw.id,
        name: raw.name,
        projection: raw.projection,
        topParties: raw.topParties ?? [],
      } as Constituency;
    });
}

function formatShares(shares: PartyShares): string {
  return PARTY_KEYS.map(
    (k) => `${k.toUpperCase().padEnd(6)} ${shares[k].toFixed(1).padStart(5)}%`,
  ).join("  ");
}

function formatSwing(swing: PartyShares): string {
  return PARTY_KEYS.map((k) => {
    const v = swing[k];
    const sign = v >= 0 ? "+" : "";
    return `${k.toUpperCase().padEnd(6)} ${sign}${v.toFixed(1).padStart(5)}`;
  }).join("  ");
}

/**
 * Compute the implied national vote share from hand-curated topParties,
 * averaged across all 73 seats. Parties absent from a seat's topParties are
 * treated as 0 for that seat (they're outside the top 3), giving a lower-bound
 * share. Useful as a consistency check against polling averages.
 */
function impliedNationalFromYaml(constituencies: Constituency[]): PartyShares {
  const totals: Record<PartyKey, number> = {
    snp: 0, con: 0, lab: 0, libdem: 0, green: 0, reform: 0, alba: 0,
  };
  for (const c of constituencies) {
    for (const tp of c.topParties) {
      const key = PARTY_ID_TO_POLL_KEY[tp.party];
      if (key) totals[key] += tp.share;
    }
  }
  const n = constituencies.length;
  return {
    snp: totals.snp / n,
    con: totals.con / n,
    lab: totals.lab / n,
    libdem: totals.libdem / n,
    green: totals.green / n,
    reform: totals.reform / n,
    alba: totals.alba / n,
  };
}

function topTwo(shares: Record<string, number>): { winner: string; margin: number } {
  const ranked = Object.entries(shares).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { winner: "unknown", margin: 0 };
  const winner = ranked[0][0];
  const margin = ranked.length > 1 ? ranked[0][1] - ranked[1][1] : ranked[0][1];
  return { winner, margin };
}

function main() {
  const polls = loadPolls();
  const windowSize = 5;

  const constAvg = rollingAverage(polls.constituency, windowSize);
  const regAvg = rollingAverage(polls.regional, windowSize);

  const constSwing = swingFrom(BASELINE_2021_CONSTITUENCY, constAvg.shares);
  const regSwing = swingFrom(BASELINE_2021_REGIONAL, regAvg.shares);

  console.log("=".repeat(90));
  console.log("VoteScot polling snapshot & projection sanity check");
  console.log("=".repeat(90));
  console.log(`Polls last updated : ${polls.lastUpdated}`);
  console.log(`Window             : latest ${windowSize} polls (recency-weighted)`);
  console.log("Polls used         :");
  for (const p of constAvg.pollsUsed) {
    console.log(`  - ${p.date} → ${p.endDate}  ${p.pollster.padEnd(18)} n=${p.sampleSize ?? "?"}`);
  }

  console.log("\n-- Constituency vote (national) --");
  console.log(`2021 baseline   : ${formatShares(BASELINE_2021_CONSTITUENCY)}`);
  console.log(`Current average : ${formatShares(constAvg.shares)}`);
  console.log(`Swing vs 2021   : ${formatSwing(constSwing)}`);

  console.log("\n-- Regional list vote (national) --");
  console.log(`2021 baseline   : ${formatShares(BASELINE_2021_REGIONAL)}`);
  console.log(`Current average : ${formatShares(regAvg.shares)}`);
  console.log(`Swing vs 2021   : ${formatSwing(regSwing)}`);

  // YAML consistency: does the hand-curated data still reflect the latest polls?
  const constituencies = loadConstituencies();
  const ymlImplied = impliedNationalFromYaml(constituencies);
  const ymlVsPolls = swingFrom(ymlImplied, constAvg.shares);

  console.log("\n-- YAML consistency check (constituency vote) --");
  console.log("  Implied national share from averaging topParties across all seats.");
  console.log("  Parties outside a seat's top-3 count as 0 for that seat, so YAML-implied");
  console.log("  shares are a lower bound. Large negative deltas = YAML may be behind polls.");
  console.log(`  YAML implied  : ${formatShares(ymlImplied)}`);
  console.log(`  Current polls : ${formatShares(constAvg.shares)}`);
  console.log(`  Delta (polls − YAML):  ${formatSwing(ymlVsPolls)}`);

  // Per-seat rundown: current projected winner, margin, plus national swing context.
  console.log("\n-- Seat rundown (current YAML projections) --");
  const winnerTally: Record<string, number> = {};
  const marginalSeats: Array<{ id: string; name: string; winner: string; margin: number }> = [];
  for (const c of constituencies) {
    const shares = Object.fromEntries(c.topParties.map((tp) => [tp.party, tp.share]));
    const { winner, margin } = topTwo(shares);
    winnerTally[winner] = (winnerTally[winner] ?? 0) + 1;
    if (margin < 5) marginalSeats.push({ id: c.id, name: c.name, winner, margin });
  }

  const parties = Object.keys(winnerTally).sort();
  console.log("  Current winner tally:");
  for (const p of parties) {
    console.log(`    ${p.padEnd(14)} ${String(winnerTally[p]).padStart(3)} seats`);
  }

  console.log(
    `\n  Marginal seats (current winner by <5pp): ${marginalSeats.length} of ${constituencies.length}`,
  );
  marginalSeats.sort((a, b) => a.margin - b.margin);
  for (const s of marginalSeats) {
    console.log(`    ${s.name.padEnd(45)}  ${s.winner} by ${s.margin.toFixed(1)}pp`);
  }

  // Write machine-readable report.
  const report = {
    generatedAt: new Date().toISOString(),
    pollsLastUpdated: polls.lastUpdated,
    windowSize,
    constituencyVote: {
      baseline2021: BASELINE_2021_CONSTITUENCY,
      currentAverage: constAvg.shares,
      swing: constSwing,
      ymlImplied,
      ymlVsPolls,
    },
    regionalVote: {
      baseline2021: BASELINE_2021_REGIONAL,
      currentAverage: regAvg.shares,
      swing: regSwing,
    },
    winnerTally,
    marginalSeats,
    notes: [
      "Swings are national-level; per-seat forecasts would need 2021 boundary-notional shares.",
      "YAML-implied shares are averaged from topParties (top 3 per seat), so are a lower bound.",
      "Regional list seats (D'Hondt) are not projected — constituency-vote analysis only.",
    ],
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${path.relative(process.cwd(), REPORT_PATH)}`);
}

main();
