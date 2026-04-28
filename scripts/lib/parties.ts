interface PartyColours {
  color: string;
  accent: string;
  textColor?: string;
}

// Order matters: findPartyKey returns the first substring match, so more
// specific names (e.g. "Independent Green Voice") must come before broader
// ones (e.g. "Green", "Independent") that would otherwise swallow them.
const PARTY_MAP: Record<string, { short: string; colours: PartyColours }> = {
  "Scottish National Party": { short: "SNP", colours: { color: "#FDF38E", accent: "#9B870C", textColor: "#333" } },
  "Labour": { short: "Labour", colours: { color: "#DC241F", accent: "#8B0000" } },
  "Conservative": { short: "Tory", colours: { color: "#0087DC", accent: "#005EA5" } },
  "Liberal Democrat": { short: "Lib Dem", colours: { color: "#FAA61A", accent: "#B8860B" } },
  "Independent Green Voice": { short: "Independent Green Voice", colours: { color: "#666666", accent: "#444444" } },
  "Green": { short: "Green", colours: { color: "#00A651", accent: "#007A3D" } },
  "Reform UK": { short: "Reform", colours: { color: "#12B6CF", accent: "#0a7f91" } },
  "Alba": { short: "Alba", colours: { color: "#005EB8", accent: "#003d7a" } },
  "Workers Party": { short: "Workers", colours: { color: "#c41230", accent: "#8b0d22" } },
  "Libertarian": { short: "Libertarian", colours: { color: "#f5d442", accent: "#b89e30", textColor: "#333" } },
  "Independent": { short: "Ind", colours: { color: "#888888", accent: "#555555" } },
};

const DEFAULT_COLOURS: PartyColours = { color: "#666666", accent: "#444444" };

function findPartyKey(partyName: string): string | undefined {
  const lower = partyName.toLowerCase();
  return Object.keys(PARTY_MAP).find((key) => lower.includes(key.toLowerCase()));
}

export function getPartyColours(partyName: string): PartyColours {
  const key = findPartyKey(partyName);
  return key ? PARTY_MAP[key].colours : DEFAULT_COLOURS;
}

export function getPartyShortName(partyName: string): string {
  const key = findPartyKey(partyName);
  return key ? PARTY_MAP[key].short : partyName;
}

export function getPartyId(partyName: string): string {
  return slugify(partyName);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
