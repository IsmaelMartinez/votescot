import { describe, it, expect } from "vitest";
import { loadCandidates, loadConstituencies } from "../src/lib/data";

describe("loadCandidates", () => {
  it("returns an array of candidates", () => {
    const candidates = loadCandidates();
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("returns equal data on second call (cached internally)", () => {
    const first = loadCandidates();
    const second = loadCandidates();
    expect(first).toEqual(second);
    expect(first.length).toBe(second.length);
  });

  it("each candidate has required fields", () => {
    const candidates = loadCandidates();
    for (const c of candidates.slice(0, 10)) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.party).toBeTruthy();
      expect(c.constituency).toBeTruthy();
      expect(typeof c.isIncumbent).toBe("boolean");
    }
  });
});

describe("loadConstituencies", () => {
  it("returns 73 constituencies", () => {
    const constituencies = loadConstituencies();
    expect(constituencies.length).toBe(73);
  });

  it("each constituency has projection data", () => {
    const constituencies = loadConstituencies();
    for (const c of constituencies) {
      expect(c.projection).toBeTruthy();
      expect(c.projectionSource).toBeTruthy();
      expect(c.competitiveness).toBeTruthy();
      expect(c.topParties).toBeDefined();
      expect(c.topParties!.length).toBeGreaterThan(0);
    }
  });
});
