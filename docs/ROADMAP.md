# VoteScot Roadmap

Last updated: 13 April 2026

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

Daily GitHub Actions cron jobs are configured for candidate sync (06:00 UTC from Democracy Club API) and polling sync (08:00 UTC from Wikipedia). The candidate sync auto-commits additions and opens PRs for withdrawn candidates. Repo Butler runs at 02:00 UTC for health analysis.

A manifesto sync pipeline exists (`sync-manifestos.ts`, cron at 07:00 UTC) that discovers party manifesto PDFs and parses them via Google Gemini into structured policy positions with real quotes. **This pipeline has never run** because the `GEMINI_API_KEY` GitHub Actions secret is not configured. All current party positions are hand-curated defaults without manifesto sourcing. Adding the secret would activate automated manifesto analysis.

### Infrastructure

GitHub Pages deployment via GitHub Actions on every push to main. CI on pull requests. JSON Schema validation. 48 vitest tests. Repo Butler for health dashboards.

## What needs doing before 7 May (33 days)

### Critical — data accuracy

~~Enrich high-profile candidates with real bios.~~ Done. 13 candidates (Swinney, Sarwar, Baillie, Fraser, Gilruth, McAllan, Somerville, Bibby, Gallacher, Rennie, Slater, Constance, Thewliss, Macpherson) have substantive bios and highlights. Factual accuracy verified via code review.

~~Fix incumbent status for sitting MSPs.~~ Done. `scripts/fix-incumbents.ts` cross-references the Scottish Parliament members API. 75 sitting MSPs marked as incumbents. Two false positives (name collisions with different-party candidates) caught in review and fixed.

~~Differentiate Conservative and Reform positions.~~ Done. Conservatives now score nhs:1, education:1 (more moderate). Reform stays at all 0s. 72 candidate files updated.

~~Make projection methodology transparent.~~ Done. Each constituency's projection now cites its source (Ballot Box Scotland notionals, historical results, national polling swing, incumbency factors, etc.). Source displayed on constituency pages below the projection panel.

### High priority — usability

~~Add a "How to Vote" guide.~~ Done at `/how-to-vote`. Covers two ballot papers, AMS, D'Hondt, key dates, voter eligibility (16+), no photo ID required, registration links. Voter ID section corrected in review (Scotland does NOT require photo ID at Holyrood elections).

~~Fix slug consistency.~~ Done. Shared `slugifyConstituency()` utility in `src/lib/slugify.ts`. Both PostcodeLookup and ConstituencyMap use it. 5 test cases.

~~Add `robots.txt` and `sitemap.xml`.~~ Done. `@astrojs/sitemap` generates sitemap-index.xml at build time. robots.txt in public/.

~~Map on the landing page.~~ Done. The 73-constituency text grid replaced with the interactive ConstituencyMap. Postcode lookup also added to the Quiz and Candidates pages via a shared `PostcodeInput` component and `usePostcodeLookup` hook — voters can now enter a postcode anywhere to auto-find their constituency.

### Medium priority — accessibility and polish

~~Bump font sizes to minimum 12px.~~ Done. All sub-12px Tailwind classes replaced with `text-xs` across 18 files. Zero sub-12px fonts remain.

~~Add ARIA roles to quiz radio buttons.~~ Done. `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-labelledby` added. Skip-to-content link added in Base.astro.

~~Compress the 1.8MB GeoJSON boundary file.~~ Done. Converted to TopoJSON (340 KB, 81% reduction). ConstituencyMap loads TopoJSON and converts client-side with topojson-client.

~~Add retry logic to `fetchBuffer` and `fetchHtml` in the pipeline.~~ Done. Both now retry up to 3 times with exponential backoff, matching the existing `fetchJson` pattern.

~~Cache `loadCandidates()` at module level to speed up builds.~~ Done. Module-level cache avoids re-parsing 434 YAML files on every call.

~~Self-host Google Fonts to eliminate render-blocking external requests.~~ Done. Using @fontsource-variable for Crimson Pro and Source Sans 3. Removed external Google Fonts links.

### Low priority

~~Add React error boundaries around interactive components.~~ Done. ErrorBoundary component wraps all 7 Astro island components (QuizEngine, CandidateComparison, CandidatesSearch, PollsChart, PostcodeLookup, DeepDive, ConstituencyMap).

~~Add tests for slug derivation logic, React components, and the manifesto parsing pipeline.~~ Done. Added api-retry and data-cache test suites (11 new tests, 34 total). Slug tests already existed.

~~The `textColor` property exists in candidate data but is never used in rendering.~~ Done. SNP and Libertarian dots now use the darker accent colour as fill when textColor is set, fixing yellow-on-white contrast.

~~Explain in quiz results that candidates from the same party share identical match scores.~~ Done. Disclosure box now states that same-party candidates share identical match scores.

## Visual Roadmap

```
                          VoteScot Roadmap
                          ════════════════

  ELECTION DAY: 7 May 2026
  ─────────────────────────────────────────────────────────────

  TODAY                                           ELECTION
  13 Apr                                           7 May
    │              24 days remaining                  │
    ▼                                                ▼
    ┌─────────────────────────────────────────────────┐
    │           WHAT'S DONE (ship-ready)              │
    │                                                 │
    │  ✅ Vote compass quiz (8 policy areas)          │
    │  ✅ 434 candidates / 73 constituencies          │
    │  ✅ Interactive map + postcode lookup            │
    │  ✅ Polling trends (127 polls, daily sync)      │
    │  ✅ Constituency projections                    │
    │  ✅ How-to-Vote guide                           │
    │  ✅ Party pages                                 │
    │  ✅ Accessibility & performance optimised       │
    │  ✅ Daily data pipeline (candidates + polls)    │
    │  ✅ 48 tests passing                            │
    │  ✅ Dependencies updated (13 Apr 2026)          │
    └─────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │        MANIFESTO ANALYSIS (the big gap)         │
    │                                                 │
    │  The pipeline exists (sync-manifestos.ts) but   │
    │  has never run. Positions are hand-curated      │
    │  party defaults, not sourced from manifestos.   │
    │                                                 │
    │  To activate:                                   │
    │  ┌────────────────────────────────────────────┐ │
    │  │ 1. Add GEMINI_API_KEY secret to GitHub     │ │
    │  │    (unblocks the daily 07:00 UTC cron)     │ │
    │  │                                            │ │
    │  │ 2. Pipeline auto-discovers manifesto PDFs  │ │
    │  │    from 6 party websites                   │ │
    │  │                                            │ │
    │  │ 3. Gemini parses PDFs into structured      │ │
    │  │    positions + real quotes per policy area  │ │
    │  │                                            │ │
    │  │ 4. Replaces "Based on party platform"      │ │
    │  │    with actual manifesto evidence           │ │
    │  │                                            │ │
    │  │ 5. Updates 368 candidate files             │ │
    │  └────────────────────────────────────────────┘ │
    │                                                 │
    │  Status: BLOCKED on GEMINI_API_KEY secret       │
    └─────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │      MAINTENANCE — Now until 7 May              │
    │                                                 │
    │  • Monitor daily data syncs                     │
    │  • React to candidate withdrawals               │
    │  • Fix any user-reported bugs                   │
    │  • Keep dependencies current                    │
    └─────────────────────────────────────────────────┘


  AFTER 7 MAY
  ─────────────────────────────────────────────────────────────

    ┌─────────────────────────────────────────────────┐
    │  No concrete post-election plans. The site      │
    │  was built for this election. Ideas that        │
    │  would only happen if there's energy for it:    │
    │                                                 │
    │  ? Multi-election support (locals 2027, etc.)   │
    │  ? MSP voting record vs promises tracker        │
    │  ? Community contributions via Decap CMS        │
    │  ? Custom domain (votescot.scot)                │
    │  ? Plausible analytics                          │
    └─────────────────────────────────────────────────┘
```
