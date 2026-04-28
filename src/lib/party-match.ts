// Map of full party-name strings (lower-cased) to canonical party id.
// Match is case-insensitive but full-string: a candidate party of
// "Socialist Labour Party" no longer leaks onto "scottish-labour" the way
// the earlier substring-match did, which had let Scottish Labour's positions,
// stances and party_website fan out onto SLP candidate files.
const PARTY_NAME_TO_ID: Record<string, string> = {
  "scottish national party (snp)": "scottish-national-party",
  "scottish national party": "scottish-national-party",
  "snp": "scottish-national-party",
  "labour party": "scottish-labour",
  "scottish labour party": "scottish-labour",
  "labour and co-operative party": "scottish-labour",
  "conservative and unionist party": "scottish-conservatives",
  "scottish conservative and unionist party": "scottish-conservatives",
  "liberal democrats": "scottish-liberal-democrats",
  "scottish liberal democrats": "scottish-liberal-democrats",
  "scottish green party": "scottish-green-party",
  "reform uk": "reform-uk",
};

export function matchPartyId(candidatePartyName: string): string | undefined {
  return PARTY_NAME_TO_ID[candidatePartyName.trim().toLowerCase()];
}
