# VoteScot Roadmap

Last updated: 16 April 2026

## What's live now

The site is at https://ismaelmartinez.github.io/votescot/ and covers all 73 Scottish Parliament constituencies with 436 candidates for the 7 May 2026 election.

### Core features

The vote compass quiz matches voters to candidates across 8 policy areas (independence, NHS, housing, climate, tax, economy, education, equality). 368 candidates from 7 major parties have quiz data based on party-level positions. The matching algorithm scores exact matches, partial matches, and disagreements with per-issue breakdown. All pages clearly disclose that positions are party defaults unless individually verified.

Every candidate has a profile page with policy stances, track record highlights (where available), and source links to WhoCanIVoteFor, party websites, and TheyWorkForYou. The side-by-side comparison view lets voters compare all quiz-ready candidates in their constituency grouped by policy area.

Search and filter is available on the candidates page (search by candidate name or constituency), the quiz page (filter constituencies), and the comparison page.

### Map and postcode lookup

The interactive map displays all 73 constituency boundaries on a Leaflet map using 2026 SPCF boundary data from MapIt. Postcode search zooms to the voter's constituency and links to their filtered candidate page. The landing page also has a standalone postcode lookup.

### Polling trends

A polling trends page shows national constituency and regional vote polls scraped from the Wikipedia polling tracker (131 polls). SVG line chart with party colours, recent polls table, and constituency/regional toggle. Daily sync via GitHub Actions at 08:00 UTC.

### Constituency projections

Each constituency page shows a projection panel with estimated vote shares and "will win / could win / might win" classifications. 73 constituencies have projection data. Specific overrides exist for well-known competitive seats (Edinburgh Central, Edinburgh North Western, Glasgow seats, Lib Dem strongholds, Conservative-held seats). Others use a default based on national polling.

### Research hub and about page

Curated links to Ballot Box Scotland, Fraser of Allander Institute, TheyWorkForYou, WhoCanIVoteFor, Electoral Commission, voter registration, and polling station finder. An About/Methodology page explains the scoring system, data sources, party-default approach, and privacy policy.

### Data pipeline

A daily GitHub Actions cron job is configured for polling sync (08:00 UTC from Wikipedia). Repo Butler runs at 02:00 UTC for health analysis. The candidate sync workflow has been retired — Democracy Club has locked the 2026 Scottish Parliament ballot (`candidates_locked: true`), so no further automated updates are expected. Any late withdrawals will be handled manually.

A manifesto sync script exists (`scripts/sync-manifestos.ts`) that discovers party manifesto PDFs and parses them via Google Gemini into structured policy positions with real quotes. **This has never produced any data.** Parties have not published 2026 manifestos yet, and the registry URLs in `data/manifestos/registry.yaml` are still speculative (e.g. `/2026-manifesto`). The GitHub Actions cron was removed on 16 April 2026 — see the "Manifesto check" section below for the manual check to run each time the repo is picked up. All current party positions are hand-curated defaults.

### Infrastructure

GitHub Pages deployment via GitHub Actions on every push to main. CI on pull requests. JSON Schema validation. 48 vitest tests. Repo Butler for health dashboards.

## Manifesto check (run each time you pick the repo up)

Parties haven't published 2026 Holyrood manifestos yet. Instead of leaving a daily cron failing silently, check manually:

1. Open each URL list in `data/manifestos/registry.yaml` in a browser and look for a published 2026 manifesto PDF.
2. If one is published, update the `manifestoPdf` field in the registry to the direct PDF URL.
3. Set `GEMINI_API_KEY` locally and run `npm run sync:manifestos`. The script will parse the PDF, write structured positions to `data/parties/<party>.yaml`, and fan out to the 368 quiz-ready candidates.
4. Review the diff, commit, and push.

If no manifesto is out, do nothing — positions stay as hand-curated defaults until the real thing drops.

## What needs doing before 7 May (21 days)

### Critical — data accuracy

~~Enrich high-profile candidates with real bios.~~ Done. 13 candidates (Swinney, Sarwar, Baillie, Fraser, Gilruth, McAllan, Somerville, Bibby, Gallacher, Rennie, Slater, Constance, Thewliss, Macpherson) have substantive bios and highlights. Factual accuracy verified via code review.

**Fix incumbent status for sitting MSPs (regressed).** `scripts/fix-incumbents.ts` cross-references the Scottish Parliament members API and originally marked 75 sitting MSPs as incumbents (two name-collision false positives caught in review). Subsequent "sync: update candidate data from Democracy Club" commits overwrote the `isIncumbent` field, and today every candidate file on disk has `isIncumbent: false`. The sync workflow has since been retired (#25), so re-running `scripts/fix-incumbents.ts` locally and committing the result will fix this for good.

~~Differentiate Conservative and Reform positions.~~ Done. Conservatives now score nhs:1, education:1 (more moderate). Reform stays at all 0s. 72 candidate files updated.

~~Make projection methodology transparent.~~ Done. Each constituency's projection now cites its source (Ballot Box Scotland notionals, historical results, national polling swing, incumbency factors, etc.). Source displayed on constituency pages below the projection panel.

### High priority — usability

~~Add a "How to Vote" guide.~~ Done at `/guide` (with `#how-to-vote` anchor). Covers two ballot papers, AMS, D'Hondt, key dates, voter eligibility (16+), no photo ID required, registration links. Voter ID section corrected in review (Scotland does NOT require photo ID at Holyrood elections).

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
  16 Apr                                           7 May
    │              21 days remaining                  │
    ▼                                                ▼
    ┌─────────────────────────────────────────────────┐
    │           WHAT'S DONE (ship-ready)              │
    │                                                 │
    │  ✅ Vote compass quiz (8 policy areas)          │
    │  ✅ 436 candidates / 73 constituencies          │
    │  ✅ Interactive map + postcode lookup            │
    │  ✅ Polling trends (131 polls, daily sync)      │
    │  ✅ Constituency projections                    │
    │  ✅ How-to-Vote guide                           │
    │  ✅ Party pages                                 │
    │  ✅ Accessibility & performance optimised       │
    │  ✅ Daily polling sync                          │
    │  ✅ 48 tests passing                            │
    │  ✅ Dependencies updated (13 Apr 2026)          │
    └─────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │        MANIFESTO ANALYSIS (the big gap)         │
    │                                                 │
    │  Parties haven't published 2026 Holyrood        │
    │  manifestos yet. Registry URLs are still        │
    │  speculative. Positions remain hand-curated     │
    │  party defaults until a manifesto drops.        │
    │                                                 │
    │  Manual check (run when you pick the repo up):  │
    │  ┌────────────────────────────────────────────┐ │
    │  │ 1. Visit each URL in                        │ │
    │  │    data/manifestos/registry.yaml           │ │
    │  │                                            │ │
    │  │ 2. If a 2026 manifesto PDF is live,        │ │
    │  │    update manifestoPdf in the registry     │ │
    │  │                                            │ │
    │  │ 3. Export GEMINI_API_KEY locally and run   │ │
    │  │    npm run sync:manifestos                 │ │
    │  │                                            │ │
    │  │ 4. Review diff, commit, push               │ │
    │  └────────────────────────────────────────────┘ │
    │                                                 │
    │  Status: waiting on parties to publish          │
    │  (daily cron removed 16 Apr 2026)               │
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
