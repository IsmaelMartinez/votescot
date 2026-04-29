export interface PollPoint {
  date: number; // ms timestamp
  value: number;
}

/**
 * Centred rolling mean over a fixed time window. For each input point, returns
 * the mean of all points whose date falls within ±windowMs/2 of that point's
 * date. Output is sorted by date ascending and skips windows with zero points.
 *
 * Centred (rather than trailing) so the line doesn't lag the dot cloud at the
 * right edge — it tracks where the polls actually are. Edge points have
 * fewer neighbours on one side, which is acceptable for a chart trend line.
 */
export function centredRollingMean(
  points: ReadonlyArray<PollPoint>,
  windowMs: number,
): PollPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date - b.date);
  const half = windowMs / 2;
  const out: PollPoint[] = [];

  for (const p of sorted) {
    const lo = p.date - half;
    const hi = p.date + half;
    let sum = 0;
    let count = 0;
    for (const q of sorted) {
      if (q.date >= lo && q.date <= hi) {
        sum += q.value;
        count++;
      }
    }
    if (count > 0) out.push({ date: p.date, value: sum / count });
  }

  return out;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
