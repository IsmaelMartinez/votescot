import { describe, it, expect } from "vitest";
import { loadParties, loadManifestoRegistry } from "../src/lib/data";

describe("loadParties", () => {
  it("returns an array of parties", () => {
    const parties = loadParties();
    expect(Array.isArray(parties)).toBe(true);
    expect(parties.length).toBe(7);
  });

  it("returns equal data on second call (cached internally)", () => {
    const first = loadParties();
    const second = loadParties();
    expect(first).toEqual(second);
  });

  it("each party has required fields", () => {
    const parties = loadParties();
    for (const p of parties) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.positions).toBeDefined();
      expect(p.stances).toBeDefined();
    }
  });

  it("party positions have all 8 policy areas", () => {
    const areas = ["independence", "nhs", "housing", "climate", "tax", "economy", "education", "equality"];
    const parties = loadParties();
    for (const p of parties) {
      for (const area of areas) {
        expect(p.positions[area]).toBeDefined();
      }
    }
  });
});

describe("loadManifestoRegistry", () => {
  it("returns an array of manifesto entries", () => {
    const entries = loadManifestoRegistry();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(7);
  });

  it("each entry has id, name, and manifestoUrls", () => {
    const entries = loadManifestoRegistry();
    for (const e of entries) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(Array.isArray(e.manifestoUrls)).toBe(true);
      expect(e.manifestoUrls.length).toBeGreaterThan(0);
    }
  });
});
