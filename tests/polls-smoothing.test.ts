import { describe, it, expect } from "vitest";
import { centredRollingMean, DAY_MS } from "../src/lib/polls-smoothing";

const day = (n: number) => n * DAY_MS;

describe("centredRollingMean", () => {
  it("returns the input value when only one point is in window", () => {
    const out = centredRollingMean([{ date: day(0), value: 40 }], 30 * DAY_MS);
    expect(out).toEqual([{ date: day(0), value: 40 }]);
  });

  it("averages points within a centred window", () => {
    const points = [
      { date: day(0), value: 30 },
      { date: day(10), value: 40 },
      { date: day(20), value: 50 },
    ];
    const out = centredRollingMean(points, 30 * DAY_MS);
    // window ±15 days around each point
    // day 0: only itself + day 10 (within 15) → (30+40)/2 = 35
    // day 10: all three within 15 days → (30+40+50)/3 = 40
    // day 20: itself + day 10 → (40+50)/2 = 45
    expect(out[0].value).toBe(35);
    expect(out[1].value).toBe(40);
    expect(out[2].value).toBe(45);
  });

  it("sorts the input by date before smoothing", () => {
    const points = [
      { date: day(20), value: 50 },
      { date: day(0), value: 30 },
      { date: day(10), value: 40 },
    ];
    const out = centredRollingMean(points, 30 * DAY_MS);
    expect(out.map((p) => p.date)).toEqual([day(0), day(10), day(20)]);
  });

  it("returns empty when input is empty", () => {
    expect(centredRollingMean([], 30 * DAY_MS)).toEqual([]);
  });

  it("uses a tighter window when windowMs is small", () => {
    const points = [
      { date: day(0), value: 30 },
      { date: day(40), value: 50 },
    ];
    const out = centredRollingMean(points, 10 * DAY_MS);
    // window ±5 days, so each point sees only itself
    expect(out[0].value).toBe(30);
    expect(out[1].value).toBe(50);
  });
});
