import { describe, it, expect } from "vitest";
import { loadCandidates, loadConstituencies, loadRegions, loadCandidatesByRegion } from "../src/lib/data";
import { slugifyConstituency } from "../src/lib/slugify";

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

describe("loadRegions", () => {
  it("derives unique non-empty regions from constituencies", () => {
    const regions = loadRegions();
    const constituencies = loadConstituencies();
    const expectedNames = Array.from(
      new Set(constituencies.map((c) => c.region).filter((r): r is string => !!r && r.trim() !== ""))
    );
    expect(regions.length).toBe(expectedNames.length);
    for (const name of expectedNames) {
      expect(regions.find((r) => r.name === name)).toBeDefined();
    }
  });

  it("sorts regions alphabetically by name", () => {
    const regions = loadRegions();
    const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name));
    expect(regions.map((r) => r.name)).toEqual(sorted.map((r) => r.name));
  });

  it("slugifies region ids", () => {
    const regions = loadRegions();
    for (const r of regions) {
      expect(r.id).toBe(slugifyConstituency(r.name));
    }
  });

  it("returns equal data on second call (cached internally)", () => {
    const first = loadRegions();
    const second = loadRegions();
    expect(first).toEqual(second);
  });
});

describe("loadCandidatesByRegion", () => {
  it("returns only candidates whose constituency belongs to the region", () => {
    const regions = loadRegions();
    if (regions.length === 0) return;
    const constituencies = loadConstituencies();
    for (const region of regions) {
      const constituencyIds = new Set(
        constituencies.filter((c) => c.region === region.name).map((c) => c.id)
      );
      const candidates = loadCandidatesByRegion(region.name);
      for (const cand of candidates) {
        expect(constituencyIds.has(cand.constituency)).toBe(true);
      }
    }
  });
});
