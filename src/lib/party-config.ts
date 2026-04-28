/**
 * Single source of truth for party display configuration: identifiers, labels,
 * and chart colours. Three identifier conventions exist in the codebase:
 *
 * - `id`    - canonical slug used by data/parties/*.yaml (e.g. "scottish-national-party")
 * - `short` - 2-3 char key used by polls.json and the polls UI ("snp", "lab", "con")
 * - `long`  - mid-length key used by constituency projection fields ("snp", "labour", "conservative")
 *
 * Migrating away from the dual short/long convention is out of scope here; this
 * file just lets every consumer agree on the same colour/label table by
 * looking up via whichever key it has on hand.
 */

export interface PartyTheme {
  id: string;
  short: string;
  long: string;
  label: string;
  fullName: string;
  /** Chart and UI primary colour (matches the candidate-card "accent"). */
  color: string;
}

export const PARTY_THEMES: readonly PartyTheme[] = [
  {
    id: "scottish-national-party",
    short: "snp",
    long: "snp",
    label: "SNP",
    fullName: "Scottish National Party (SNP)",
    color: "#9B870C",
  },
  {
    id: "scottish-labour",
    short: "lab",
    long: "labour",
    label: "Labour",
    fullName: "Scottish Labour",
    color: "#DC241F",
  },
  {
    id: "scottish-conservatives",
    short: "con",
    long: "conservative",
    label: "Conservative",
    fullName: "Scottish Conservatives",
    color: "#0087DC",
  },
  {
    id: "scottish-liberal-democrats",
    short: "libdem",
    long: "libdem",
    label: "Lib Dem",
    fullName: "Scottish Liberal Democrats",
    color: "#FAA61A",
  },
  {
    id: "scottish-green-party",
    short: "green",
    long: "green",
    label: "Green",
    fullName: "Scottish Green Party",
    color: "#00A651",
  },
  {
    id: "reform-uk",
    short: "reform",
    long: "reform",
    label: "Reform",
    fullName: "Reform UK",
    color: "#12B6CF",
  },
  {
    id: "alba-party",
    short: "alba",
    long: "alba",
    label: "Alba",
    fullName: "Alba Party",
    color: "#005EB8",
  },
] as const;

function indexBy(key: "id" | "short" | "long"): Record<string, PartyTheme> {
  return Object.fromEntries(PARTY_THEMES.map((t) => [t[key], t]));
}

export const PARTY_THEMES_BY_ID: Record<string, PartyTheme> = indexBy("id");
export const PARTY_THEMES_BY_SHORT: Record<string, PartyTheme> = indexBy("short");
export const PARTY_THEMES_BY_LONG: Record<string, PartyTheme> = indexBy("long");

/** Maps used by chart components keyed by short ("snp" / "lab" / ...). */
export const PARTY_COLORS_BY_SHORT: Record<string, string> = Object.fromEntries(
  PARTY_THEMES.map((t) => [t.short, t.color]),
);
export const PARTY_LABELS_BY_SHORT: Record<string, string> = Object.fromEntries(
  PARTY_THEMES.map((t) => [t.short, t.label]),
);

/** Maps used by projection rendering keyed by long ("snp" / "labour" / ...). */
export const PARTY_COLORS_BY_LONG: Record<string, string> = Object.fromEntries(
  PARTY_THEMES.map((t) => [t.long, t.color]),
);
export const PARTY_LABELS_BY_LONG: Record<string, string> = Object.fromEntries(
  PARTY_THEMES.map((t) => [t.long, t.label]),
);
