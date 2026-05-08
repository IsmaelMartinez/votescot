import { describe, it, expect } from "vitest";
import {
  meanAbsoluteError,
  scorePoll,
  scoreMrp,
  scoreVotescotProjections,
  closestPollForConstituency,
  nationalShareFromResults,
} from "../src/lib/accuracy";
import type { PartyShares, PollEntry } from "../src/lib/poll-average";

const ACTUAL: PartyShares = {
  snp: 40, con: 12, lab: 20, libdem: 10, green: 5, reform: 12, alba: 1,
};

describe("meanAbsoluteError", () => {
  it("returns zero error when prediction matches actual", () => {
    const { mae, rmse } = meanAbsoluteError(ACTUAL, ACTUAL);
    expect(mae).toBe(0);
    expect(rmse).toBe(0);
  });

  it("computes per-party signed errors", () => {
    const predicted = { ...ACTUAL, snp: 45, lab: 18 };
    const { mae, errors } = meanAbsoluteError(predicted, ACTUAL);
    expect(errors.snp).toBe(5);
    expect(errors.lab).toBe(-2);
    expect(mae).toBeCloseTo((5 + 2) / 7, 5);
  });

  it("ignores parties with null prediction", () => {
    const predicted: Partial<PartyShares> = { snp: 41, con: 13 };
    const { mae } = meanAbsoluteError(predicted, ACTUAL);
    expect(mae).toBeCloseTo((1 + 1) / 2, 5);
  });
});

describe("scorePoll", () => {
  it("scores a poll's per-party shares against actual", () => {
    const poll = {
      date: "2026-05-01", endDate: "2026-05-06", pollster: "X", client: "N/A",
      sampleSize: 1000, snp: 41, con: 13, lab: 19, libdem: 11, green: 5, reform: 11, alba: null, others: 0,
    } as PollEntry;
    const score = scorePoll(poll, ACTUAL);
    expect(score).not.toBeNull();
    expect(score!.shares.snp).toBe(41);
    expect(score!.errors.snp).toBe(1);
    expect(score!.errors.alba).toBeUndefined();
  });

  it("returns null if every party share is null", () => {
    const poll = {
      date: "x", endDate: "x", pollster: "X", client: "N/A", sampleSize: null,
      snp: null, con: null, lab: null, libdem: null, green: null, reform: null, alba: null, others: null,
    } as PollEntry;
    expect(scorePoll(poll, ACTUAL)).toBeNull();
  });
});

describe("scoreMrp", () => {
  it("computes total seat error and per-party errors", () => {
    const predicted = { snp: 60, con: 8, lab: 18, libdem: 8, green: 14, reform: 21, alba: 0 };
    const actual = { snp: 58, con: 10, lab: 20, libdem: 7, green: 14, reform: 20, alba: 0 };
    const { seatMae, totalSeatError, errors } = scoreMrp(predicted, actual);
    expect(errors.snp).toBe(2);
    expect(errors.con).toBe(-2);
    expect(totalSeatError).toBe(2 + 2 + 2 + 1 + 0 + 1 + 0);
    expect(seatMae).toBeCloseTo((2 + 2 + 2 + 1 + 0 + 1 + 0) / 7, 5);
  });

  it("treats missing predicted seats as 0", () => {
    const actual = { snp: 58, con: 10, lab: 20, libdem: 7, green: 14, reform: 20, alba: 0 };
    const { totalSeatError } = scoreMrp({}, actual);
    expect(totalSeatError).toBe(58 + 10 + 20 + 7 + 14 + 20);
  });
});

describe("scoreVotescotProjections", () => {
  it("counts correct winners and buckets by competitiveness", () => {
    const predictions = [
      { id: "a", projection: "snp", competitiveness: "safe" },
      { id: "b", projection: "labour", competitiveness: "marginal" },
      { id: "c", projection: "snp", competitiveness: "marginal" },
      { id: "d", projection: "reform", competitiveness: "toss-up" },
    ];
    const results = [
      { id: "a", status: "declared" as const, winner: "snp", results: [] },
      { id: "b", status: "declared" as const, winner: "snp", results: [] },
      { id: "c", status: "declared" as const, winner: "snp", results: [] },
      { id: "d", status: "pending" as const, winner: null, results: [] },
    ];
    const r = scoreVotescotProjections(predictions, results);
    expect(r.totalSeats).toBe(3);
    expect(r.correctWinners).toBe(2);
    expect(r.hitRate).toBeCloseTo(2 / 3, 5);
    expect(r.byCompetitiveness.safe.hitRate).toBe(1);
    expect(r.byCompetitiveness.marginal.hitRate).toBe(0.5);
    expect(r.byCompetitiveness["toss-up"]).toBeUndefined();
  });
});

describe("closestPollForConstituency", () => {
  it("returns the poll whose share for the winning party is nearest local share", () => {
    const result = {
      id: "x", status: "declared" as const, winner: "labour",
      results: [
        { party: "labour", votes: 12000, share: 36 },
        { party: "snp", votes: 11000, share: 33 },
      ],
    };
    const polls = [
      { date: "x", endDate: "x", pollster: "Far", client: "N/A", sampleSize: 1000,
        snp: 40, con: 10, lab: 20, libdem: 10, green: 5, reform: 14, alba: 1, others: 0 } as PollEntry,
      { date: "x", endDate: "x", pollster: "Near", client: "N/A", sampleSize: 1000,
        snp: 35, con: 10, lab: 35, libdem: 8, green: 4, reform: 7, alba: 1, others: 0 } as PollEntry,
    ];
    const r = closestPollForConstituency(result, polls);
    expect(r?.pollster).toBe("Near");
    expect(r?.absError).toBeCloseTo(1, 5);
  });

  it("returns null when result is pending", () => {
    const result = { id: "x", status: "pending" as const, winner: null, results: [] };
    expect(closestPollForConstituency(result, [])).toBeNull();
  });
});

describe("nationalShareFromResults", () => {
  it("aggregates vote totals into national share", () => {
    const results = [
      {
        status: "declared",
        results: [
          { party: "snp", votes: 12000 },
          { party: "labour", votes: 8000 },
        ],
      },
      {
        status: "declared",
        results: [
          { party: "snp", votes: 6000 },
          { party: "labour", votes: 14000 },
        ],
      },
    ];
    const shares = nationalShareFromResults(results)!;
    expect(shares.snp).toBeCloseTo(45, 5);
    expect(shares.lab).toBeCloseTo(55, 5);
  });

  it("ignores pending results and returns null when nothing is declared", () => {
    const results = [
      { status: "pending", results: [{ party: "snp", votes: 1000 }] },
    ];
    expect(nationalShareFromResults(results)).toBeNull();
  });
});
