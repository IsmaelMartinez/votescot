export interface MatchBreakdown {
  questionId: string;
  diff: number;
}

export interface MatchResult {
  percentage: number;
  breakdown: MatchBreakdown[];
}

export function calculateMatch(
  answers: Record<string, number>,
  positions: Record<string, number>,
): MatchResult {
  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return { percentage: 0, breakdown: [] };
  }

  const breakdown: MatchBreakdown[] = [];
  let total = 0;

  for (const [questionId, value] of entries) {
    const candidateValue = positions[questionId];
    if (candidateValue === undefined) continue;
    const diff = Math.abs(value - candidateValue);
    breakdown.push({ questionId, diff });
    total += diff === 0 ? 100 : diff === 1 ? 50 : 0;
  }

  const percentage = breakdown.length > 0 ? Math.round(total / breakdown.length) : 0;
  return { percentage, breakdown };
}
