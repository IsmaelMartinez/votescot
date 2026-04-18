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

  it("returns silent 0% when candidate has no positions", () => {
    // Silent 0% path: no positions to score, so breakdown is empty
    const answers = { independence: 2 };
    const result = calculateMatch(answers, {});
    expect(result.percentage).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("returns 100% when all answers are zero and match zero positions", () => {
    // All-zero exact match: boundary case for value-0 exact match
    const answers = {
      independence: 0,
      nhs: 0,
      housing: 0,
      climate: 0,
      tax: 0,
      economy: 0,
      education: 0,
      equality: 0,
    };
    const positions = {
      independence: 0,
      nhs: 0,
      housing: 0,
      climate: 0,
      tax: 0,
      economy: 0,
      education: 0,
      equality: 0,
    };
    const result = calculateMatch(answers, positions);
    expect(result.percentage).toBe(100);
  });

  it("returns 100% when partial candidate positions all match exactly", () => {
    // Partial-positions candidate: answers have all 8 IDs, but candidate only has 1
    const answers = {
      independence: 2,
      nhs: 2,
      housing: 1,
      climate: 2,
      tax: 0,
      economy: 1,
      education: 1,
      equality: 2,
    };
    const positions = { independence: 2 }; // only one position
    const result = calculateMatch(answers, positions);
    expect(result.percentage).toBe(100);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]).toEqual({ questionId: "independence", diff: 0 });
  });
});

describe("tie handling", () => {
  it("sorts candidates with tied scores alphabetically by name", () => {
    // Pattern test for call-site tie-breaking behavior
    const candidates = [
      { name: "Bob", score: 50 },
      { name: "Alice", score: 50 },
    ];
    const sorted = candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // desc by score
      return a.name.localeCompare(b.name); // asc by name on tie
    });
    expect(sorted[0].name).toBe("Alice");
    expect(sorted[1].name).toBe("Bob");
  });
});
