import { describe, it, expect } from "vitest";
import {
  rollingAverage,
  rangeOverWindow,
  swingFrom,
  BASELINE_2021_CONSTITUENCY,
  type PollEntry,
} from "../src/lib/poll-average";

function makePoll(overrides: Partial<PollEntry>): PollEntry {
  return {
    date: "2026-01-01",
    endDate: "2026-01-01",
    pollster: "Test",
    client: "",
    sampleSize: 1000,
    snp: null,
    con: null,
    lab: null,
    libdem: null,
    green: null,
    reform: null,
    alba: null,
    others: null,
    ...overrides,
  };
}

describe("rollingAverage", () => {
  it("returns single-poll shares when only one poll fits the window", () => {
    const polls = [makePoll({ date: "2026-03-01", endDate: "2026-03-05", snp: 40, lab: 20 })];
    const { shares } = rollingAverage(polls, 5);
    expect(shares.snp).toBe(40);
    expect(shares.lab).toBe(20);
    expect(shares.con).toBe(0);
  });

  it("weights newer polls more heavily", () => {
    const polls = [
      makePoll({ date: "2026-03-01", endDate: "2026-03-05", snp: 30 }), // older
      makePoll({ date: "2026-04-01", endDate: "2026-04-05", snp: 40 }), // newer
    ];
    const { shares } = rollingAverage(polls, 2);
    // Newer gets weight 2, older weight 1 → (40*2 + 30*1) / 3 = 36.67
    expect(shares.snp).toBeCloseTo(36.67, 1);
  });

  it("ignores nulls and redistributes weight for that party only", () => {
    const polls = [
      makePoll({ date: "2026-04-01", endDate: "2026-04-05", snp: 40, alba: null }),
      makePoll({ date: "2026-03-01", endDate: "2026-03-05", snp: 30, alba: 10 }),
    ];
    const { shares } = rollingAverage(polls, 2);
    // SNP: (40*2 + 30*1)/3 = 36.67; Alba: only second poll counts → 10
    expect(shares.snp).toBeCloseTo(36.67, 1);
    expect(shares.alba).toBe(10);
  });

  it("truncates to the window size", () => {
    const polls = Array.from({ length: 10 }, (_, i) =>
      makePoll({ date: `2026-0${i + 1}-01`.slice(0, 10), endDate: `2026-0${i + 1}-01`.slice(0, 10), snp: 30 + i }),
    );
    const { pollsUsed } = rollingAverage(polls, 3);
    expect(pollsUsed).toHaveLength(3);
  });
});

describe("rangeOverWindow", () => {
  it("returns min and max across the window per party", () => {
    const polls = [
      makePoll({ date: "2026-04-01", snp: 40 }),
      makePoll({ date: "2026-03-15", snp: 32 }),
      makePoll({ date: "2026-03-01", snp: 36 }),
    ];
    const { ranges } = rangeOverWindow(polls, 3);
    expect(ranges.snp).toEqual({ min: 32, max: 40 });
  });

  it("equates min and max when only one poll has a value for that party", () => {
    const polls = [
      makePoll({ date: "2026-04-01", snp: 40, alba: null }),
      makePoll({ date: "2026-03-15", snp: 35, alba: 5 }),
    ];
    const { ranges } = rangeOverWindow(polls, 5);
    expect(ranges.alba).toEqual({ min: 5, max: 5 });
  });

  it("returns 0,0 when every poll in the window is null for a party", () => {
    const polls = [
      makePoll({ date: "2026-04-01", snp: 40, alba: null }),
      makePoll({ date: "2026-03-15", snp: 35, alba: null }),
    ];
    const { ranges } = rangeOverWindow(polls, 5);
    expect(ranges.alba).toEqual({ min: 0, max: 0 });
  });

  it("uses the most recent windowSize polls (sorted by mid-date)", () => {
    const polls = [
      makePoll({ date: "2026-04-01", endDate: "2026-04-05", snp: 40 }),
      makePoll({ date: "2026-03-01", endDate: "2026-03-05", snp: 32 }),
      makePoll({ date: "2026-02-01", endDate: "2026-02-05", snp: 50 }),
    ];
    const { ranges, pollsUsed } = rangeOverWindow(polls, 2);
    expect(pollsUsed).toHaveLength(2);
    // Oldest 50% should be excluded; range comes from the two most recent.
    expect(ranges.snp).toEqual({ min: 32, max: 40 });
  });
});

describe("swingFrom", () => {
  it("returns current minus baseline per party", () => {
    const current = { ...BASELINE_2021_CONSTITUENCY, snp: 36, reform: 14 };
    const swing = swingFrom(BASELINE_2021_CONSTITUENCY, current);
    expect(swing.snp).toBeCloseTo(36 - 47.7, 1);
    expect(swing.reform).toBeCloseTo(14, 1);
    expect(swing.lab).toBe(0);
  });
});
