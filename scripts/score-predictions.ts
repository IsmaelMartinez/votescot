/**
 * Grade pre-election forecasts against declared results.
 *
 * Reads:
 *   data/polls.json                      — all polls + MRPs
 *   data/constituencies/*.yaml           — VoteScot's hand-curated projections
 *   data/results/constituencies/*.yaml   — declared per-seat results
 *   data/results/regional/*.yaml         — declared regional list results
 *
 * Writes:
 *   data/accuracy-report.json            — pollster MAE/RMSE league table,
 *                                          MRP seat error, VoteScot hit rate.
 *
 * Re-run after every batch of declarations. Safe to run when nothing is yet
 * declared — produces an empty report so consumers (the /results page) can
 * render a "results pending" state.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import {
  PARTY_KEYS,
  scorePoll,
  scoreMrp,
  scoreVotescotProjections,
  nationalShareFromResults,
  partyKey,
} from "../src/lib/accuracy";
import type { PollEntry } from "../src/lib/poll-average";

interface PollsFile {
  lastUpdated: string;
  constituency: PollEntry[];
  regional: PollEntry[];
  mrp: Array<{
    date: string;
    endDate: string;
    pollster: string;
    client: string;
    sampleSize: number | null;
    seats: {
      snp: number | null;
      con: number | null;
      lab: number | null;
      green: number | null;
      libdem: number | null;
      reform: number | null;
    };
    majority: string;
  }>;
}

interface ConstituencyResultFile {
  id: string;
  status: "pending" | "partial" | "declared";
  declaredAt: string | null;
  winner: string | null;
  results: { party: string; candidate: string; votes: number; share?: number }[];
}

interface RegionalResultFile {
  id: string;
  name: string;
  status: "pending" | "partial" | "declared";
  results: { party: string; votes: number; share?: number; listSeats?: number }[];
}

interface ConstituencyProjection {
  id: string;
  projection?: string;
  competitiveness?: string;
  topParties?: { party: string; share: number }[];
}

function readYamlFiles<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => yaml.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as T);
}

function totalSeatsByParty(regional: RegionalResultFile[], constituency: ConstituencyResultFile[]): {
  snp: number; con: number; lab: number; libdem: number; green: number; reform: number; alba: number;
} {
  const totals = { snp: 0, con: 0, lab: 0, libdem: 0, green: 0, reform: 0, alba: 0 };
  for (const r of constituency) {
    if (r.status !== "declared" || !r.winner) continue;
    const k = partyKey(r.winner);
    if (k) totals[k]++;
  }
  for (const r of regional) {
    if (r.status !== "declared") continue;
    for (const e of r.results) {
      const k = partyKey(e.party);
      if (k && e.listSeats) totals[k] += e.listSeats;
    }
  }
  return totals;
}

function main(): void {
  const polls = JSON.parse(
    fs.readFileSync(path.resolve("data/polls.json"), "utf-8"),
  ) as PollsFile;
  const projections = readYamlFiles<ConstituencyProjection>("data/constituencies").map((c) => ({
    id: c.id,
    projection: c.projection,
    competitiveness: c.competitiveness,
    topParties: c.topParties,
  }));
  const constituencyResults = readYamlFiles<ConstituencyResultFile>("data/results/constituencies");
  const regionalResults = readYamlFiles<RegionalResultFile>("data/results/regional");

  const constituencyActual = nationalShareFromResults(constituencyResults);
  const regionalActual = nationalShareFromResults(regionalResults);

  const pollsterScores: Array<Record<string, unknown>> = [];

  if (constituencyActual) {
    for (const poll of polls.constituency) {
      const s = scorePoll(poll, constituencyActual);
      if (!s) continue;
      pollsterScores.push({
        pollster: poll.pollster,
        client: poll.client,
        ballot: "constituency",
        date: poll.date,
        endDate: poll.endDate,
        sampleSize: poll.sampleSize,
        shares: s.shares,
        errors: s.errors,
        mae: round(s.mae),
        rmse: round(s.rmse),
      });
    }
  }
  if (regionalActual) {
    for (const poll of polls.regional) {
      const s = scorePoll(poll, regionalActual);
      if (!s) continue;
      pollsterScores.push({
        pollster: poll.pollster,
        client: poll.client,
        ballot: "regional",
        date: poll.date,
        endDate: poll.endDate,
        sampleSize: poll.sampleSize,
        shares: s.shares,
        errors: s.errors,
        mae: round(s.mae),
        rmse: round(s.rmse),
      });
    }
  }
  pollsterScores.sort((a, b) => (a.mae as number) - (b.mae as number));

  const allDeclared =
    constituencyResults.length > 0 &&
    regionalResults.length > 0 &&
    constituencyResults.every((r) => r.status === "declared") &&
    regionalResults.every((r) => r.status === "declared");

  const seatTotals = totalSeatsByParty(regionalResults, constituencyResults);
  const mrpScores = allDeclared
    ? polls.mrp
        .filter((m) => m.pollster !== "2021 Scottish Parliament election")
        .map((m) => {
          const predicted = {
            snp: m.seats.snp ?? 0,
            con: m.seats.con ?? 0,
            lab: m.seats.lab ?? 0,
            libdem: m.seats.libdem ?? 0,
            green: m.seats.green ?? 0,
            reform: m.seats.reform ?? 0,
            alba: 0,
          };
          const score = scoreMrp(predicted, seatTotals);
          return {
            pollster: m.pollster,
            client: m.client,
            date: m.date,
            endDate: m.endDate,
            predicted,
            actual: seatTotals,
            seatMae: round(score.seatMae),
            totalSeatError: score.totalSeatError,
            errors: score.errors,
          };
        })
        .sort((a, b) => a.totalSeatError - b.totalSeatError)
    : [];

  const projectionScore = scoreVotescotProjections(projections, constituencyResults);
  const projectionShareMae = computeProjectionShareMae(projections, constituencyResults);

  const report = {
    generatedAt: new Date().toISOString(),
    pollDay: "2026-05-07",
    constituenciesDeclared: constituencyResults.filter((r) => r.status === "declared").length,
    regionsDeclared: regionalResults.filter((r) => r.status === "declared").length,
    national: {
      constituency: constituencyActual ? roundShares(constituencyActual) : null,
      regional: regionalActual ? roundShares(regionalActual) : null,
    },
    seatTotals: allDeclared ? seatTotals : null,
    pollsters: pollsterScores,
    mrps: mrpScores,
    votescotProjection: {
      ...projectionScore,
      shareMae: projectionShareMae,
    },
  };

  fs.writeFileSync(
    path.resolve("data/accuracy-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Wrote accuracy-report.json (${pollsterScores.length} polls, ${mrpScores.length} MRPs, ` +
      `${projectionScore.totalSeats} seats scored, hit rate ` +
      `${(projectionScore.hitRate * 100).toFixed(1)}%)`,
  );
}

function round(n: number, dp = 2): number {
  const m = Math.pow(10, dp);
  return Math.round(n * m) / m;
}

function roundShares(s: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(s)) out[k] = round(s[k], 2);
  return out;
}

/**
 * MAE between projected topParties shares and actual local shares, averaged
 * across declared seats. Loose proxy for "how well did our seat-level numbers
 * track on the ground" — only contributes parties present in both forecast
 * and result.
 */
function computeProjectionShareMae(
  projections: ConstituencyProjection[],
  results: ConstituencyResultFile[],
): number {
  const projById = new Map(projections.map((p) => [p.id, p]));
  let totalAbs = 0;
  let n = 0;
  for (const r of results) {
    if (r.status !== "declared") continue;
    const proj = projById.get(r.id);
    if (!proj?.topParties) continue;
    for (const tp of proj.topParties) {
      const k = partyKey(tp.party);
      if (!k) continue;
      const local = r.results.find((e) => partyKey(e.party) === k);
      if (!local || local.share == null) continue;
      totalAbs += Math.abs(tp.share - local.share);
      n++;
    }
  }
  return n === 0 ? 0 : round(totalAbs / n);
}

if (process.argv[1]?.endsWith("score-predictions.ts")) {
  main();
}

// Surface PARTY_KEYS so dependents can iterate over the canonical key set
// without needing a separate import path.
export { PARTY_KEYS };
