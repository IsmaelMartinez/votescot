/**
 * Display constants and helpers shared by candidate / constituency pages.
 * Lifted out of individual `.astro` files so the labels, status colours,
 * and the Democracy Club URL filter live in one place.
 */
import type { CandidateSource, Constituency, PartyProjection } from "./data";

type Competitiveness = NonNullable<Constituency["competitiveness"]>;
type ProjectionStatus = PartyProjection["status"];

export const COMPETITIVENESS_LABELS: Record<Competitiveness, string> = {
  "safe": "Safe seat",
  "competitive": "Competitive",
  "marginal": "Marginal",
  "toss-up": "Toss-up",
};

export const COMPETITIVENESS_BADGE_CLASSES: Record<Competitiveness, string> = {
  "safe": "bg-gray-100 text-gray-600",
  "competitive": "bg-amber-50 text-amber-700",
  "marginal": "bg-orange-50 text-orange-700",
  "toss-up": "bg-red-50 text-red-700",
};

export const PROJECTION_STATUS_LABELS: Record<ProjectionStatus, string> = {
  "will-win": "Will win",
  "could-win": "Could win",
  "might-win": "Might win",
};

export const PROJECTION_STATUS_CLASSES: Record<ProjectionStatus, string> = {
  "will-win": "text-green-700",
  "could-win": "text-amber-700",
  "might-win": "text-gray-500",
};

/** Democracy Club's per-candidate page is the import source, not a useful link to surface. */
const DEMOCRACY_CLUB_CANDIDATE_HOST = "candidates.democracyclub.org.uk";

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function filterExternalSources(sources: CandidateSource[] | undefined): CandidateSource[] {
  return (sources ?? []).filter((s) => {
    if (typeof s?.url !== "string") return false;
    const host = hostnameOf(s.url);
    if (host === null) return false;
    return host !== DEMOCRACY_CLUB_CANDIDATE_HOST;
  });
}
