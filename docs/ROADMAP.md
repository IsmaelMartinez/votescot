# VoteScot Roadmap

Last updated: 4 April 2026 (evening)

## What's live now

The site is at https://ismaelmartinez.github.io/votescot/ and covers all 73 Scottish Parliament constituencies with 434 candidates for the 7 May 2026 election.

### Core features

The vote compass quiz matches voters to candidates across 8 policy areas (independence, NHS, housing, climate, tax, economy, education, equality). 368 candidates from 7 major parties have quiz data based on party-level positions. The matching algorithm scores exact matches, partial matches, and disagreements with per-issue breakdown. All pages clearly disclose that positions are party defaults unless individually verified.

Every candidate has a profile page with policy stances, track record highlights (where available), and source links to WhoCanIVoteFor, party websites, and TheyWorkForYou. The side-by-side comparison view lets voters compare all quiz-ready candidates in their constituency grouped by policy area.

Search and filter is available on the candidates page (search by candidate name or constituency), the quiz page (filter constituencies), and the comparison page.

### Map and postcode lookup

The interactive map displays all 73 constituency boundaries on a Leaflet map using 2026 SPCF boundary data from MapIt. Postcode search zooms to the voter's constituency and links to their filtered candidate page. The landing page also has a standalone postcode lookup.

### Polling trends

A polling trends page shows national constituency and regional vote polls scraped from the Wikipedia polling tracker (127 polls). SVG line chart with party colours, recent polls table, and constituency/regional toggle. Daily sync via GitHub Actions at 08:00 UTC.

### Constituency projections

Each constituency page shows a projection panel with estimated vote shares and "will win / could win / might win" classifications. 73 constituencies have projection data. Specific overrides exist for well-known competitive seats (Edinburgh Central, Edinburgh North Western, Glasgow seats, Lib Dem strongholds, Conservative-held seats). Others use a default based on national polling.

### Research hub and about page

Curated links to Ballot Box Scotland, Fraser of Allander Institute, TheyWorkForYou, WhoCanIVoteFor, Electoral Commission, voter registration, and polling station finder. An About/Methodology page explains the scoring system, data sources, party-default approach, and privacy policy.

### Data pipeline

Daily GitHub Actions cron jobs are configured for candidate sync (06:00 UTC from Democracy Club API), manifesto parsing (07:00 UTC via Gemini), and polling sync (08:00 UTC from Wikipedia). The candidate sync auto-commits additions and opens PRs for withdrawn candidates. Repo Butler runs at 02:00 UTC for health analysis.

The `GEMINI_API_KEY` GitHub Actions secret needs to be added to activate manifesto sync.

### Infrastructure

GitHub Pages deployment via GitHub Actions on every push to main. CI on pull requests. JSON Schema validation. 18 vitest tests. Repo Butler for health dashboards.

## What needs doing before 7 May (33 days)

### Critical — data accuracy

~~Enrich high-profile candidates with real bios.~~ Done. 13 candidates (Swinney, Sarwar, Baillie, Fraser, Gilruth, McAllan, Somerville, Bibby, Gallacher, Rennie, Slater, Constance, Thewliss, Macpherson) have substantive bios and highlights. Factual accuracy verified via code review.

~~Fix incumbent status for sitting MSPs.~~ Done. `scripts/fix-incumbents.ts` cross-references the Scottish Parliament members API. 75 sitting MSPs marked as incumbents. Two false positives (name collisions with different-party candidates) caught in review and fixed.

~~Differentiate Conservative and Reform positions.~~ Done. Conservatives now score nhs:1, education:1 (more moderate). Reform stays at all 0s. 72 candidate files updated.

Make projection methodology transparent. Currently hardcoded numbers with no source attribution. Each projection should cite its basis (Ballot Box Scotland notionals, national polling swing, or whatever the source is).

### High priority — usability

~~Add a "How to Vote" guide.~~ Done at `/how-to-vote`. Covers two ballot papers, AMS, D'Hondt, key dates, voter eligibility (16+), no photo ID required, registration links. Voter ID section corrected in review (Scotland does NOT require photo ID at Holyrood elections).

~~Fix slug consistency.~~ Done. Shared `slugifyConstituency()` utility in `src/lib/slugify.ts`. Both PostcodeLookup and ConstituencyMap use it. 5 test cases.

~~Add `robots.txt` and `sitemap.xml`.~~ Done. `@astrojs/sitemap` generates sitemap-index.xml at build time. robots.txt in public/.

~~Map on the landing page.~~ Done. The 73-constituency text grid replaced with the interactive ConstituencyMap. Postcode lookup also added to the Quiz and Candidates pages via a shared `PostcodeInput` component and `usePostcodeLookup` hook — voters can now enter a postcode anywhere to auto-find their constituency.

### Medium priority — accessibility and polish

~~Bump font sizes to minimum 12px.~~ Done. All sub-12px Tailwind classes replaced with `text-xs` across 18 files. Zero sub-12px fonts remain.

~~Add ARIA roles to quiz radio buttons.~~ Done. `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-labelledby` added. Skip-to-content link added in Base.astro.

Compress the 1.8MB GeoJSON boundary file. TopoJSON would cut it to ~500KB.

Add retry logic to `fetchBuffer` and `fetchHtml` in the pipeline.

Cache `loadCandidates()` at module level to speed up builds (currently parses 434 YAML files on every call).

Self-host Google Fonts to eliminate render-blocking external requests.

### Low priority

Add React error boundaries around interactive components.

Add tests for slug derivation logic, React components, and the manifesto parsing pipeline.

The `textColor` property exists in candidate data but is never used in rendering — SNP's yellow dots have poor contrast on white.

Explain in quiz results that candidates from the same party share identical match scores (party-level positions).

## After the election

Multi-election support for Scottish local elections (2027), UK general elections, and Welsh Senedd.

Historical comparison: how did your MSP actually vote vs what they promised?

Community contributions via Decap CMS for moderated candidate position submissions.

Custom domain: `votescot.scot` or `kenyercandidate.scot`.

Plausible analytics for privacy-first usage tracking.
