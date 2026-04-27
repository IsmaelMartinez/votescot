import { calculateMatch, type MatchResult } from "./matching";
import type { Candidate, RegionalCandidate } from "./data";

export type BallotKind = "constituency" | "regional";

export interface PartyBlockCandidate {
  id: string;
  name: string;
  isIncumbent: boolean;
  listPosition?: number;
}

export interface PartyBlock {
  party: string;
  partyShort: string;
  color: string;
  accent: string;
  textColor?: string;
  candidates: PartyBlockCandidate[];
  positions: Record<string, number>;
  match: MatchResult;
}

export interface ConstituencyLite {
  id: string;
  name: string;
  region?: string;
}

export interface RegionLite {
  id: string;
  name: string;
}

export interface InitialSelection {
  constituencyId: string;
  regionId: string;
  inboundRegional: boolean;
}

export function buildPartyBlocks(
  list: (Candidate | RegionalCandidate)[],
  kind: BallotKind,
  answers: Record<string, number>
): PartyBlock[] {
  const isRegional = kind === "regional";
  const byParty = new Map<string, (Candidate | RegionalCandidate)[]>();
  for (const c of list) {
    const bucket = byParty.get(c.party) ?? [];
    bucket.push(c);
    byParty.set(c.party, bucket);
  }
  const blocks: PartyBlock[] = Array.from(byParty.entries()).map(([party, items]) => {
    const sample = items.find((c) => c.positions) ?? items[0];
    const positions = (sample.positions ?? {}) as Record<string, number>;
    const sorted = isRegional
      ? [...(items as RegionalCandidate[])].sort((a, b) => a.listPosition - b.listPosition)
      : [...items].sort((a, b) => a.name.localeCompare(b.name));
    const candidates: PartyBlockCandidate[] = sorted.map((c) => ({
      id: c.id,
      name: c.name,
      isIncumbent: c.isIncumbent,
      listPosition: isRegional ? (c as RegionalCandidate).listPosition : undefined,
    }));
    return {
      party,
      partyShort: sample.partyShort,
      color: sample.color,
      accent: sample.accent,
      textColor: sample.textColor,
      candidates,
      positions,
      match: calculateMatch(answers, positions),
    };
  });
  return blocks.sort((a, b) => {
    if (b.match.percentage !== a.match.percentage) return b.match.percentage - a.match.percentage;
    const aHas = a.match.breakdown.length > 0 ? 1 : 0;
    const bHas = b.match.breakdown.length > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return a.party.localeCompare(b.party);
  });
}

// Whitespace in constituency YAML `region:` is trimmed when matching against
// the canonical region name. loadRegions() emits already-trimmed names; without
// the trim here a stray space in source data would silently break the picker.
export function buildConstituencyToRegion(
  constituencies: ConstituencyLite[],
  regions: RegionLite[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of constituencies) {
    if (c.region) {
      const region = regions.find((r) => r.name === c.region?.trim());
      if (region) map.set(c.id, region.id);
    }
  }
  return map;
}

// Resolve which constituency / region the picker should be primed with from
// inbound query params. ?constituency= takes precedence over ?region=. When
// only ?region= is present, pick any constituency in that region so the picker
// has a value, and flag inboundRegional=true so the results screen defaults
// the active tab to "regional".
export function resolveInitialSelection(
  params: URLSearchParams,
  constituencies: ConstituencyLite[],
  regions: RegionLite[],
  constituencyToRegion: Map<string, string>
): InitialSelection {
  const cParam = params.get("constituency") ?? "";
  const rParam = params.get("region") ?? "";

  if (cParam && constituencies.some((c) => c.id === cParam)) {
    const regionId = constituencyToRegion.get(cParam) ?? "";
    return { constituencyId: cParam, regionId, inboundRegional: false };
  }

  if (rParam) {
    const region = regions.find((r) => r.id === rParam);
    if (region) {
      const match = constituencies.find((c) => c.region?.trim() === region.name);
      if (match) {
        return { constituencyId: match.id, regionId: rParam, inboundRegional: true };
      }
    }
  }

  return { constituencyId: "", regionId: "", inboundRegional: false };
}
