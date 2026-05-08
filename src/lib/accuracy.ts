/**
 * Pure scoring helpers for grading pre-election predictions against actual
 * results. All functions are deterministic and side-effect free so they can be
 * exercised from unit tests without touching the filesystem.
 *
 * Three things get scored:
 *   1. Each non-MRP poll's national vote-share vs the national actual.
 *   2. Each MRP's seat counts vs the national seat tally.
 *   3. VoteScot's per-seat winner predictions (topParties[].status === 'will-win'
 *      or, failing that, the highest-share entry) vs declared winners.
 */

import type { PartyKey, PartyShares, PollEntry } from "./poll-average";

export const PARTY_KEYS: PartyKey[] = [
  "snp",
  "con",
  "lab",
  "libdem",
  "green",
  "reform",
  "alba",
];

export interface ConstituencyResultLite {
  id: string;
  status: "pending" | "partial" | "declared";
  winner: string | null;
  results: { party: string; votes: number; share?: number }[];
}

export interface RegionalResultLite {
  id: string;
  status: "pending" | "partial" | "declared";
  results: { party: string; votes: number; share?: number; listSeats?: number }[];
}

/**
 * Resolve any party identifier we might see in results YAMLs (long form like
 * "labour", short form like "lab", or with snake_case prefixes) to the
 * canonical short key used in polls.json.
 */
const PARTY_ALIASES: Record<string, PartyKey> = {
  snp: "snp",
  scottish_national_party: "snp",
  lab: "lab",
  labour: "lab",
  scottish_labour: "lab",
  con: "con",
  conservative: "con",
  scottish_conservatives: "con",
  libdem: "libdem",
  liberal_democrats: "libdem",
  green: "green",
  scottish_greens: "green",
  reform: "reform",
  reform_uk: "reform",
  alba: "alba",
  alba_party: "alba",
};

export function partyKey(id: string | null | undefined): PartyKey | null {
  if (!id) return null;
  return PARTY_ALIASES[id.toLowerCase()] ?? null;
}

/**
 * Sum total declared votes per canonical party key across an array of
 * constituency or regional results, then return each party's national share.
 *
 * Only `declared` results contribute. Returns null if nothing is declared yet.
 * Unknown parties get bucketed under "others" via the grand total but don't
 * appear in the returned shares object.
 */
export function nationalShareFromResults(
  results: { status: string; results: { party: string; votes: number }[] }[],
): PartyShares | null {
  const totals: Record<PartyKey, number> = {
    snp: 0, con: 0, lab: 0, libdem: 0, green: 0, reform: 0, alba: 0,
  };
  let grandTotal = 0;
  for (const r of results) {
    if (r.status !== "declared") continue;
    for (const e of r.results) {
      grandTotal += e.votes;
      const key = partyKey(e.party);
      if (key) totals[key] += e.votes;
    }
  }
  if (grandTotal === 0) return null;
  const shares: PartyShares = {
    snp: 0, con: 0, lab: 0, libdem: 0, green: 0, reform: 0, alba: 0,
  };
  for (const key of PARTY_KEYS) {
    shares[key] = (totals[key] / grandTotal) * 100;
  }
  return shares;
}

/** Mean absolute error between two share dictionaries, restricted to keys present in both. */
export function meanAbsoluteError(
  predicted: Partial<PartyShares>,
  actual: PartyShares,
): { mae: number; rmse: number; errors: Partial<PartyShares> } {
  const errors: Partial<PartyShares> = {};
  let sumAbs = 0;
  let sumSquared = 0;
  let n = 0;
  for (const k of PARTY_KEYS) {
    const p = predicted[k];
    const a = actual[k];
    if (p == null || a == null) continue;
    const e = p - a;
    errors[k] = e;
    sumAbs += Math.abs(e);
    sumSquared += e * e;
    n++;
  }
  return {
    mae: n === 0 ? 0 : sumAbs / n,
    rmse: n === 0 ? 0 : Math.sqrt(sumSquared / n),
    errors,
  };
}

/**
 * Score a single poll: extract its share dictionary, then compute MAE / RMSE
 * against the actual national share. Polls with zero non-null fields return
 * null so downstream code can skip them.
 */
export function scorePoll(
  poll: PollEntry,
  actual: PartyShares,
): { mae: number; rmse: number; errors: Partial<PartyShares>; shares: Partial<PartyShares> } | null {
  const shares: Partial<PartyShares> = {};
  let any = false;
  for (const k of PARTY_KEYS) {
    const v = poll[k];
    if (v != null) {
      shares[k] = v;
      any = true;
    }
  }
  if (!any) return null;
  const { mae, rmse, errors } = meanAbsoluteError(shares, actual);
  return { mae, rmse, errors, shares };
}

export interface SeatTotals {
  snp: number;
  con: number;
  lab: number;
  libdem: number;
  green: number;
  reform: number;
  alba: number;
}

/**
 * Score an MRP forecast against actual seat counts. Returns mean absolute
 * error per party plus the unsigned total (sum of |error|), which is what
 * pollsters typically headline as "X seats off".
 */
export function scoreMrp(
  predicted: Partial<SeatTotals>,
  actual: SeatTotals,
): { seatMae: number; totalSeatError: number; errors: Partial<SeatTotals> } {
  const errors: Partial<SeatTotals> = {};
  let sumAbs = 0;
  let n = 0;
  for (const k of Object.keys(actual) as (keyof SeatTotals)[]) {
    const p = predicted[k] ?? 0;
    const a = actual[k];
    const e = p - a;
    errors[k] = e;
    sumAbs += Math.abs(e);
    n++;
  }
  return {
    seatMae: n === 0 ? 0 : sumAbs / n,
    totalSeatError: sumAbs,
    errors,
  };
}

/**
 * Aggregate VoteScot's per-seat YAML projections (`projection` field) against
 * declared winners. Buckets results by `competitiveness` so we can see whether
 * we got the safe seats right but fluffed the marginals (or vice versa).
 *
 * Only seats with a declared winner contribute; pending seats are excluded.
 */
export function scoreVotescotProjections(
  predictions: { id: string; projection?: string; competitiveness?: string }[],
  results: ConstituencyResultLite[],
): {
  totalSeats: number;
  correctWinners: number;
  hitRate: number;
  byCompetitiveness: Record<string, { total: number; correct: number; hitRate: number }>;
  perSeat: Array<{
    id: string;
    predictedWinner: string | null;
    actualWinner: string | null;
    correct: boolean;
    competitiveness: string | null;
  }>;
} {
  const resultById = new Map(results.map((r) => [r.id, r]));
  const perSeat: Array<{
    id: string;
    predictedWinner: string | null;
    actualWinner: string | null;
    correct: boolean;
    competitiveness: string | null;
  }> = [];
  const buckets: Record<string, { total: number; correct: number }> = {};
  let total = 0;
  let correct = 0;
  for (const p of predictions) {
    const result = resultById.get(p.id);
    if (!result || result.status !== "declared" || !result.winner) continue;
    const predicted = p.projection ?? null;
    const actual = result.winner;
    const isCorrect = predicted != null && actual != null && partyKey(predicted) === partyKey(actual);
    perSeat.push({
      id: p.id,
      predictedWinner: predicted,
      actualWinner: actual,
      correct: isCorrect,
      competitiveness: p.competitiveness ?? null,
    });
    total++;
    if (isCorrect) correct++;
    const bucket = p.competitiveness ?? "unknown";
    buckets[bucket] = buckets[bucket] ?? { total: 0, correct: 0 };
    buckets[bucket].total++;
    if (isCorrect) buckets[bucket].correct++;
  }
  const byCompetitiveness: Record<
    string,
    { total: number; correct: number; hitRate: number }
  > = {};
  for (const [k, v] of Object.entries(buckets)) {
    byCompetitiveness[k] = {
      total: v.total,
      correct: v.correct,
      hitRate: v.total === 0 ? 0 : v.correct / v.total,
    };
  }
  return {
    totalSeats: total,
    correctWinners: correct,
    hitRate: total === 0 ? 0 : correct / total,
    byCompetitiveness,
    perSeat,
  };
}

/**
 * Per-constituency: which pollster's national share came closest to the local
 * winning party's share? Useful for the constituency page "closest poll" panel.
 *
 * This is a deliberately rough heuristic — non-MRP polls don't make per-seat
 * predictions, so we compare each pollster's national share for the actual
 * winning party against that party's actual local share.
 */
export function closestPollForConstituency(
  result: ConstituencyResultLite,
  polls: PollEntry[],
): { pollster: string; client: string; absError: number } | null {
  if (!result.winner || result.status !== "declared") return null;
  const winningResult = result.results.find((r) => r.party === result.winner);
  if (!winningResult || winningResult.share == null) return null;
  const key = partyKey(result.winner);
  if (!key) return null;
  let best: { pollster: string; client: string; absError: number } | null = null;
  for (const p of polls) {
    const v = (p as Record<string, unknown>)[key];
    if (typeof v !== "number") continue;
    const err = Math.abs(v - winningResult.share);
    if (!best || err < best.absError) {
      best = { pollster: p.pollster, client: p.client, absError: err };
    }
  }
  return best;
}
