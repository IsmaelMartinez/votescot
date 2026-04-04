import { describe, it, expect } from "vitest";
import { calculateMatch, type MatchResult } from "../src/lib/matching";

const mockPositions = {
  independence: 2,
  nhs: 2,
  housing: 1,
  climate: 2,
  tax: 0,
  economy: 1,
  education: 1,
  equality: 2,
};

describe("calculateMatch", () => {
  it("returns 100% when all answers match exactly", () => {
    const answers = { independence: 2, nhs: 2, housing: 1 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(100);
  });

  it("returns 0% when all answers are maximum distance", () => {
    const answers = { independence: 0, nhs: 0, equality: 0 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(0);
  });

  it("returns 50% for all partial matches (diff of 1)", () => {
    const answers = { independence: 1, nhs: 1, equality: 1 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(50);
  });

  it("returns 0% with no answers", () => {
    const result = calculateMatch({}, mockPositions);
    expect(result.percentage).toBe(0);
  });

  it("calculates mixed match correctly", () => {
    // exact (100) + partial (50) + none (0) = 150/3 = 50
    const answers = { independence: 2, housing: 2, tax: 2 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(50);
  });

  it("returns per-issue breakdown", () => {
    const answers = { independence: 2, nhs: 0, housing: 1 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.breakdown).toEqual([
      { questionId: "independence", diff: 0 },
      { questionId: "nhs", diff: 2 },
      { questionId: "housing", diff: 0 },
    ]);
  });
});
