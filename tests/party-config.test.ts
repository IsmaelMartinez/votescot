import { describe, expect, test } from "vitest";
import {
  PARTY_THEMES,
  PARTY_THEMES_BY_ID,
  PARTY_THEMES_BY_SHORT,
  PARTY_THEMES_BY_LONG,
  PARTY_COLORS_BY_SHORT,
  PARTY_COLORS_BY_LONG,
} from "../src/lib/party-config";

describe("party-config", () => {
  test("each identifier set has unique values", () => {
    const ids = PARTY_THEMES.map((t) => t.id);
    const shorts = PARTY_THEMES.map((t) => t.short);
    const longs = PARTY_THEMES.map((t) => t.long);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(shorts).size).toBe(shorts.length);
    expect(new Set(longs).size).toBe(longs.length);
  });

  test("indexes contain every theme exactly once", () => {
    expect(Object.keys(PARTY_THEMES_BY_ID)).toHaveLength(PARTY_THEMES.length);
    expect(Object.keys(PARTY_THEMES_BY_SHORT)).toHaveLength(PARTY_THEMES.length);
    expect(Object.keys(PARTY_THEMES_BY_LONG)).toHaveLength(PARTY_THEMES.length);
  });

  test("colours are 6-digit hex", () => {
    for (const t of PARTY_THEMES) {
      expect(t.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("short and long color maps stay in sync via party-config", () => {
    for (const t of PARTY_THEMES) {
      expect(PARTY_COLORS_BY_SHORT[t.short]).toBe(t.color);
      expect(PARTY_COLORS_BY_LONG[t.long]).toBe(t.color);
    }
  });
});
