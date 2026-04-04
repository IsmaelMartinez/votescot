# VoteScot Roadmap

Last updated: 3 April 2026

## What's live now

The site is at https://ismaelmartinez.github.io/votescot/ and covers all 73 Scottish Parliament constituencies with 439 candidates for the 7 May 2026 election.

### Core features (complete)

The vote compass quiz matches voters to candidates across 8 policy areas (independence, NHS, housing, climate, tax, economy, education, equality). 371 candidates from 7 major parties have quiz data based on party-level positions. The matching algorithm scores exact matches, partial matches, and disagreements with per-issue breakdown.

All candidate profiles are accessible with policy stances, track record highlights, and source links. The side-by-side comparison view shows all quiz-ready candidates in a constituency grouped by policy area.

The interactive map displays all 73 constituency boundaries on a Leaflet map with postcode search via the MapIt API using 2026 SPCF boundary data. Clicking a constituency navigates to its filtered candidate page.

The postcode lookup on the landing page calls the MapIt API at runtime to identify the voter's constituency from the 2026 boundaries and links directly to their candidates.

The research hub links to Ballot Box Scotland, Fraser of Allander Institute, TheyWorkForYou, WhoCanIVoteFor, Electoral Commission, and other resources.

An optional AI deep dive (BYOK with Anthropic API key) provides per-candidate analysis with constituency context, hidden behind a `<details>` element.

### Data pipeline (configured, not yet active)

Daily GitHub Actions cron jobs are configured for candidate sync (06:00 UTC from Democracy Club API) and manifesto parsing (07:00 UTC via Gemini). The candidate sync auto-commits additions and opens PRs for withdrawn candidates. The manifesto sync discovers PDFs from party websites, parses them through Gemini, and applies structured positions to candidates.

The `GEMINI_API_KEY` GitHub Actions secret needs to be added to activate manifesto sync.

### Infrastructure (complete)

GitHub Pages deployment via GitHub Actions triggers on every push to main. CI runs tests and builds on pull requests. JSON Schema validation catches malformed YAML data. 18 vitest tests cover the matching algorithm, party utilities, candidate transforms, and data validation.

## What needs doing before 7 May

### High priority

Slug consistency between PostcodeLookup and ConstituencyMap needs fixing. Both components derive constituency slugs from MapIt constituency names client-side, but use different logic. A shared utility or lookup table would prevent mismatches that could send voters to wrong pages.

Font sizes throughout the site are too small for accessibility. Multiple components use 9-10px text which is below WCAG recommendations. Particularly important for older voters. Minimum should be 12px.

ARIA roles are missing on quiz radio buttons. The custom button elements in QuizEngine need `role="radio"`, `aria-checked`, and `role="radiogroup"` for screen reader support.

Add `robots.txt` and `sitemap.xml` for SEO. With 518 pages that should be indexed before the election, search engines need to discover them.

The resources page still has Edinburgh-specific links (WhoCanIVoteFor Edinburgh Central, Edinburgh Council election info). These should be generalised or made dynamic per constituency.

### Medium priority

The 1.8MB GeoJSON file for the constituency map could be compressed. TopoJSON would reduce it to roughly 500-600KB. Island constituencies (Na h-Eileanan an Iar, Argyll) dominate the file size.

Retry logic for `fetchBuffer` and `fetchHtml` in the data pipeline. Currently only `fetchJson` has exponential backoff. If a party website is slow during manifesto discovery, the sync fails silently for that party.

The manifesto sync workflow pushes AI-generated positions directly to main. Since these determine quiz match percentages, it should create a PR for review instead.

Build performance: `loadCandidates()` reads and parses all 439 YAML files on every call. With multiple pages calling it, the build parses YAML tens of thousands of times. A module-level cache would speed up builds.

Consider self-hosting Google Fonts (Crimson Pro, Source Sans 3) to eliminate the render-blocking external request and reduce FOIT.

### Low priority

The `textColor` property exists in candidate data but is never used in rendering code. SNP's yellow party dot on white backgrounds has poor contrast.

The matching algorithm's 3-point scale (0, 1, 2) means all candidates from the same party get identical match scores. This is correct but may confuse voters expecting differentiation within parties. The results page could explain this ("Candidates from the same party share their party's manifesto positions").

No tests exist for React components, the `data.ts` loading functions, or the manifesto parsing pipeline. Priority testing targets: slug derivation logic (correctness matters for routing) and edge cases in `calculateMatch`.

## After the election

Multi-election support: extend to Scottish local elections (2027), UK general elections, and Welsh Senedd. The architecture supports this — constituency and candidate data are already per-election.

Historical comparison: how did your MSP actually vote vs what they promised? Cross-reference TheyWorkForYou voting records with manifesto positions.

Community contributions: moderated submissions of candidate policy positions with source links. Decap CMS (Git-backed) could provide a web editor for non-technical contributors.

Custom domain: register `votescot.scot` or `kenyercandidate.scot` and configure GitHub Pages custom domain.

Plausible analytics: privacy-first, cookie-free analytics to understand usage patterns without tracking individuals.
