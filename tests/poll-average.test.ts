import { describe, it, expect } from "vitest";
import {
  rollingAverage,
  swingFrom,
  BASELINE_2021_CONSTITUENCY,
  type PollEntry,
} from "../scripts/lib/poll-average.ts";

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

describe("swingFrom", () => {
  it("returns current minus baseline per party", () => {
    const current = { ...BASELINE_2021_CONSTITUENCY, snp: 36, reform: 14 };
    const swing = swingFrom(BASELINE_2021_CONSTITUENCY, current);
    expect(swing.snp).toBeCloseTo(36 - 47.7, 1);
    expect(swing.reform).toBeCloseTo(14, 1);
    expect(swing.lab).toBe(0);
  });
});
