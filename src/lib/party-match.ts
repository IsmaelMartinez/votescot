// Each list is the set of full party-name strings that should map to the
// party-id key. Match is case-insensitive but full-string: a candidate party
// of "Socialist Labour Party" no longer leaks onto "scottish-labour" the way
// the earlier substring-match did, which had let Scottish Labour's positions,
// stances and party_website fan out onto SLP candidate files.
export const PARTY_MATCH_MAP: Record<string, string[]> = {
  "scottish-national-party": ["scottish national party (snp)"],
  "scottish-labour": ["labour party", "labour and co-operative party"],
  "scottish-conservatives": ["conservative and unionist party"],
  "scottish-liberal-democrats": ["liberal democrats", "scottish liberal democrats"],
  "scottish-green-party": ["scottish green party"],
  "reform-uk": ["reform uk"],
};

export function matchPartyId(candidatePartyName: string): string | undefined {
  const lower = candidatePartyName.trim().toLowerCase();
  for (const [partyId, names] of Object.entries(PARTY_MATCH_MAP)) {
    if (names.includes(lower)) return partyId;
  }
  return undefined;
}
