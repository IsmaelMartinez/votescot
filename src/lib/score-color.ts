/**
 * Map a match percentage to its display colour, used by the results screen
 * (chip text, progress bar fill, podium percentage text).
 *
 * Thresholds match the visual buckets the rest of the quiz UI uses:
 * - >= 70: green (strong match)
 * - >= 40: gold (partial match)
 * - else:  red  (weak match)
 */
export function scoreColor(percentage: number): string {
  if (percentage >= 70) return "#1f7a3f";
  if (percentage >= 40) return "#8a6708";
  return "#c0392b";
}
