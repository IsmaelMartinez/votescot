export const PARTY_MATCH_MAP: Record<string, string[]> = {
  "scottish-national-party": ["scottish national party", "snp"],
  "scottish-labour": ["labour"],
  "scottish-conservatives": ["conservative"],
  "scottish-liberal-democrats": ["liberal democrat"],
  "scottish-green-party": ["scottish green", "green party"],
  "reform-uk": ["reform uk"],
  "alba-party": ["alba"],
};

export function matchPartyId(candidatePartyName: string): string | undefined {
  const lower = candidatePartyName.toLowerCase();
  for (const [partyId, keywords] of Object.entries(PARTY_MATCH_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return partyId;
    }
  }
  return undefined;
}
