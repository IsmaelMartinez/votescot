# VoteScot Roadmap

Last updated: 27 April 2026 (regional list rollout plan + ADR-0001)

## What's live now

The site is at https://ismaelmartinez.github.io/votescot/ and covers all 73 Scottish Parliament constituencies with 434 candidates for the 7 May 2026 election.

### Core features

The vote compass quiz matches voters to candidates across 8 policy areas (independence, NHS, housing, climate, tax, economy, education, equality). It runs in two modes — `/quiz` for the constituency ballot and `/quiz/regional` for the regional list ballot — sharing the same questions and matching algorithm; regional mode filters the candidate pool by region (constituencies now carry a `region` field across all 9 of the 2026 boundary-review regions). 370 candidates from 6 major parties have quiz data based on party-level positions. All six parties (SNP, Scottish Greens, Scottish Lib Dems, Scottish Conservatives, Reform UK, Scottish Labour) now have positions, stances, and verbatim quotes sourced from their published 2026 Holyrood manifestos. The matching algorithm scores exact matches, partial matches, and disagreements with per-issue breakdown. All pages clearly disclose that positions are party defaults unless individually verified.

Every candidate has a profile page with policy stances, track record highlights (where available), and source links to WhoCanIVoteFor, party websites, and TheyWorkForYou. The side-by-side comparison view lets voters compare all quiz-ready candidates in their constituency grouped by policy area.

Search and filter is available on the candidates page (search by candidate name or constituency), the quiz page (filter constituencies), and the comparison page.

### Map and postcode lookup

The interactive map displays all 73 constituency boundaries on a Leaflet map using 2026 SPCF boundary data from MapIt. Postcode search zooms to the voter's constituency and links to their filtered candidate page. The landing page also has a standalone postcode lookup.

### Polling trends

A polling trends page shows national constituency and regional vote polls scraped from the Wikipedia polling tracker (132 polls per section). SVG line chart with party colours, recent polls table, and constituency/regional toggle. Daily sync via GitHub Actions at 08:00 UTC. Parser has an empty-result guard (throws if fewer than 50 rows parse) so a Wikipedia schema change fails CI loudly rather than silently wiping the file.

### Latest news

A small "Latest news" block on the homepage shows up to five recent Scottish politics headlines with absolute dates and source attribution. Sourced from BBC News — Scotland Politics RSS; the parser in `scripts/sync-news.ts` supports any RSS 2.0 feed so additional sources are a one-line config change. Refreshed three times a day via GitHub Actions (`.github/workflows/sync-news.yml`).

### Constituency projections

Each constituency page shows a projection panel with estimated vote shares and "will win / could win / might win" classifications. All 73 constituencies have explicit per-seat overrides (the `defaultProjection` template is effectively dead code). Edinburgh Central, Dumbarton, and Fife North East were re-sourced on 18 April 2026 against Ballot Box Scotland 2026-boundary notionals and April 2026 MRP projections after an audit flagged the original calls as politically implausible.

### Research hub and about page

Curated links to Ballot Box Scotland, Fraser of Allander Institute, TheyWorkForYou, WhoCanIVoteFor, Electoral Commission, voter registration, and polling station finder. An About/Methodology page explains the scoring system, data sources, party-default approach, and privacy policy.

### Data pipeline

A daily GitHub Actions cron job is configured for polling sync (08:00 UTC from Wikipedia). Repo Butler runs at 02:00 UTC for health analysis. The candidate sync workflow has been retired — Democracy Club has locked the 2026 Scottish Parliament ballot (`candidates_locked: true`), so no further automated updates are expected. Any late withdrawals will be handled manually.

Manifesto parsing is handled by a Claude Code slash command (`/sync-manifestos`, defined in `.claude/commands/sync-manifestos.md`). The agent crawls the URLs in `data/manifestos/registry.yaml`, looks for a published 2026 manifesto, and — if found — writes positions/stances/quotes to `data/parties/<party>.yaml` and fans out to candidates via `scripts/apply-party-positions.ts`. The previous Gemini-based script and its daily cron were removed on 16 April 2026. On 17 April 2026, the first `/sync-manifestos` run pulled 2026 manifestos for the SNP, Scottish Greens, Scottish Lib Dems, Scottish Conservatives, and Reform UK into `data/parties/<party>.yaml` with verbatim quotes. Scottish Labour's 2026 manifesto was published separately on 13 April (redirect masked it initially) and parsed on 18 April. All six parties now have manifesto-sourced positions.

### Infrastructure

GitHub Pages deployment via GitHub Actions on every push to main. CI on pull requests. JSON Schema validation. 45 vitest tests. Repo Butler for health dashboards.

## Manifesto check (run each time you pick the repo up)

All 6 parties have published 2026 Holyrood manifestos and are parsed. Run `/sync-manifestos` whenever you pick up the repo to catch any amendments:

1. In Claude Code, run `/sync-manifestos`.
2. The agent visits each URL in `data/manifestos/registry.yaml`, reports which parties have published, parses any 2026 manifesto it finds, and writes positions to `data/parties/<party>.yaml`.
3. The agent then runs `npx tsx scripts/apply-party-positions.ts --force` to fan out to candidates and `npm test` to validate.
4. Review the diff, commit, push.

If no new manifesto is out, the agent reports that and stops without changing anything. Previously-parsed parties keep their manifesto-sourced positions; parties without a published manifesto keep their hand-curated defaults.

### Manifesto extraction notes

Most party manifestos are standard PDFs that `pdftotext -layout` can parse directly. The SNP manifesto is hosted on Issuu, which blocks direct PDF download — the agent can OCR the per-page images at `image.isu.pub/{docid}/jpg/page_N.jpg` with `tesseract`. Both `poppler` (pdftotext) and `tesseract` can be installed via Homebrew.

## Next up

The items below are what's left after the 17–18 April audit and fix sweep. Pick these up in a fresh session. Each is scoped tight enough to handle in a single PR.

### Regional list rollout (planned)

The Scottish Parliament uses an Additional Member System with two ballots — constituency and regional list — so any vote compass that omits the regional list covers only 57% of the seats and renders list-only parties (Greens, Alba, Reform routes into Holyrood) invisible. The decision to model regional list candidates as first-class data is captured in [ADR-0001](adr/0001-regional-list-candidates.md). Authoritative region count is 8 under the 2025 Boundaries Scotland review (Wikipedia "List of Scottish Parliament constituencies and electoral regions (2026–)"; Democracy Club's locked `sp.r.2026-05-07` ballots).

Shipped surfaces feeding into this rollout:

- [x] **Postcode → region resolution.** `usePostcodeLookup` returns `regionId` / `regionName`; `PostcodeInput` accepts `target: "region"`.
- [x] **`/candidates/region/[id]` dynamic page.** Currently sources constituency candidates filtered by region (the stand-in to be replaced by PR B below).
- [x] **Region tag on candidate profiles.** Profile shows "Standing in {constituency} · {region} region".
- [x] **Region picker on the homepage** (PR #41). 9 cards beneath the constituency map; will drop to 8 after PR A.
- [x] **Regional list candidate ingest** (PR #42). 589 candidacies imported from Democracy Club into `data/regional-candidates/`, validated by `schemas/regional-candidate.schema.json`.

The plan below is sequenced so each PR is independently shippable and reviewable. Targeted at landing all four before 7 May 2026.

#### PR A — Reconcile region naming (foundation)

Update the `region:` field on every constituency YAML currently tagged `Central Scotland` or `Edinburgh and Lothians West` to `Central Scotland and Lothians West`. After this PR, `loadRegions()` returns 8 entries matching Democracy Club's ballot post slugs, and the homepage region picker drops to 8 cards aligned with the regional candidate data shipped in #42.

Slug change side-effect: `/candidates/region/central-scotland` and `/candidates/region/edinburgh-and-lothians-west` collapse into `/candidates/region/central-scotland-and-lothians-west`. The site has only been live a few weeks so external bookmarks are unlikely, but Astro's `redirects` config in `astro.config.mjs` is the cheapest way to keep old links working — add both legacy slugs as 301s to the merged region. The constituency `/candidates/[id]` and `/candidates/constituency/[id]` URLs are unaffected.

Touchpoints: ~18 constituency YAMLs (the affected subset), the redirects entry, no schema or loader changes (`loadRegions()` already derives from the constituency data). Verified by `validate-data.ts` and the existing test suite. Mechanical, low risk; ship first.

#### PR B — Regional surfaces source from regional list candidates

Add `loadRegionalCandidates()` and `loadRegionalCandidatesByRegion(regionId)` to `src/lib/data.ts`. Refactor the existing `loadCandidatesByRegion(regionName)` to take `regionId` instead, so both loaders share an id-based API and callers stop passing display names around — this is a small but consistency-improving change that touches `/candidates/region/[id].astro` and the homepage picker. Rewrite `/candidates/region/[id]` to render regional list candidates grouped by party and ordered by `listPosition`, replacing the constituency-filtered view. Drop the "we don't yet model separate regional list candidates" disclaimer banner. Add a "Take the regional vote compass for this region" CTA mirroring the constituency page's flow.

Profile-page coverage: regional list candidates live in a separate tree, so the existing `/candidates/[id]` route won't pick them up and "View full profile" links from the new region page will 404. Either add a sibling `/candidates/regional/[id].astro` route that reads from `data/regional-candidates/`, or aggregate both trees in the existing `getStaticPaths`. Lean towards the aggregating approach so a candidate id is enough to find them — the Profile-page UI itself can branch on whether the record has `constituency` or `region` set.

Extend `scripts/apply-party-positions.ts` to walk `data/regional-candidates/` and fan out party positions (so the regional quiz has real, matchable data). Extend `scripts/fix-incumbents.ts` to flag sitting regional MSPs from the existing `memberelectionregionstatuses` fetch.

#### PR C — Quiz results grouped by party, not individual

Refactor `QuizEngine`'s regional mode to compute one match score per party (positions are party-level) and render party blocks with the party's regional list candidates listed beneath each block in `listPosition` order. The existing "same-party candidates share identical match scores" disclosure on the constituency mode already concedes this is the honest shape; this PR makes the regional UI match. Constituency mode left untouched in this PR; whether to apply the same treatment there is a separate conversation captured below.

#### PR D — Map view toggle (constituency ↔ region)

Add a toggle to `ConstituencyMap.tsx` that recolours and regroups the existing 73 polygons by their parent region — no new GeoJSON needed; region polygons are dissolves of the constituency boundaries already loaded as TopoJSON. Region click navigates to `/candidates/region/[id]`, mirroring the constituency click. Largest of the four because it touches the React map component and adds new interaction state; ship last so it can build on PR A's reconciled naming.

#### Deferred — per-region polling

The polls page already shows national-regional vote intent via the constituency/regional toggle. Per-region polling trends would need a different data source — the Wikipedia tracker has only thin per-region breakdowns. Revisit after the four PRs above land if there is time before 7 May; otherwise post-election.

#### Carried follow-ups

- **Constituency-mode quiz also grouped by party?** PR C only touches regional mode. The same argument applies to `/quiz` constituency results: positions are party-level, so listing same-party candidates with identical scores is misleading. Flagged for discussion; not in the rollout scope above.

### Must-fix if time allows before 7 May

- [ ] **Schema-validate party and manifesto YAMLs.** `scripts/validate-data.ts` currently only validates candidates, constituencies, and questions. A typo like `nhs: 3` in a party file would silently propagate to every candidate of that party. Add `schemas/party.schema.json` and `schemas/manifesto-registry.schema.json` and wire them into `validate-data.ts` alongside the existing loops. Range-check position values 0–2.
- [ ] **Stub-bio enrichment pass.** Many candidates have `bio` fields that are just "Party X candidate for Y" — stubs carried over from the retired Democracy Club sync. Grep for bios under ~80 characters; prioritise candidates with `quizCandidate: true` since they surface on the quiz results page. Pull real bios from party websites, WhoCanIVoteFor, or Wikipedia; the existing bio-fact-check agent pattern works well for this (see the 17 April audit run).
- [ ] **Replace Democracy Club API URLs in candidate `sources`.** Every candidate file cites `candidates.democracyclub.org.uk/api/next/parties/PP*` — that's a party registration API, not a biographical source for the individual. Credibility risk if a claim is challenged. Swap in at least one per-candidate bio source (Wikipedia, TheyWorkForYou, Scottish Parliament member page, or official party bio). Can be done opportunistically alongside the stub-bio enrichment.

### Nice-to-have before 7 May

- [ ] **Additional news sources.** News block currently sources BBC Scotland Politics only. `scripts/sync-news.ts` `SOURCES` array supports any RSS 2.0 feed — candidates worth adding: Ballot Box Scotland (https://ballotbox.scot/feed/), Guardian Scotland politics. Weigh trust vs breadth.
- [ ] **Matching engine edge-case tests.** `tests/matching.test.ts` does not cover: voter answer for a `questionId` not present in candidate `positions` (silent 0% path at `src/lib/matching.ts:25`); all-answers/all-positions at value 0 (only the value-2 case is tested); tie-order stability between same-party candidates. Added tests would prevent regressions in the 20 days before and during election coverage.
- [ ] **Pollster name unification.** `data/polls.json` shows "Ipsos MORI" and "Savanta ComRes" as separate pollsters from "Ipsos" and "Savanta"; both are predecessor brand names. Either normalise at scrape time in `scripts/sync-polls.ts` or map at render time in the polls chart.

### Post-election cleanup (after 7 May)

- [ ] **"How we did" projection retrospective.** Publish a page comparing each constituency's projected top-3 shares against the actual result. Call out the wins, the misses, and the methodology behind the calls. Strongest credibility asset for any 2027+ version of the site.
- [ ] **Retire the dead projection default.** `scripts/populate-projections.ts` still carries a `defaultProjection` template but every constituency has an explicit override. Either delete the default and make missing overrides a hard error, or keep it as a fallback with a loud warning.
- [ ] **`yaml.stringify({ lineWidth: 0 })` in `apply-party-positions.ts`** to match `populate-projections.ts` and stop the YAML line-rewrap churn that makes candidate-file diffs hard to audit on manifesto updates.
- [ ] **Deep-freeze the data caches** (or don't — current shallow freeze matches the existing pattern across all six cached loaders in `src/lib/data.ts`). If deepening, do all six consistently in a single refactor.
- [ ] **Re-parse Scottish Labour positions after manifesto revisions.** The 18 April parse reflects the 13 April manifesto launch version. If Labour publishes amendments before polling day, `/sync-manifestos` will pick them up — but watch for stance drift around tax and equality where the language is under active scrutiny.

## What shipped before 7 May (archived task list)

### Critical — data accuracy

~~Enrich high-profile candidates with real bios.~~ Done. 13 candidates (Swinney, Sarwar, Baillie, Fraser, Gilruth, McAllan, Somerville, Bibby, Gallacher, Rennie, Slater, Constance, Thewliss, Macpherson) have substantive bios and highlights. Factual accuracy verified via code review.

~~Fix incumbent status for sitting MSPs.~~ Done on 18 April 2026. `scripts/fix-incumbents.ts` rewritten to pull the 6th-session cohort from `memberelectionconstituencystatuses` + `memberelectionregionstatuses` (the original `IsCurrent` flag flips to false at dissolution). Added strategy for space-separated multi-word surnames. 78 sitting MSPs correctly flagged.

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
  18 Apr                                           7 May
    │              19 days remaining                  │
    ▼                                                ▼
    ┌─────────────────────────────────────────────────┐
    │           WHAT'S DONE (ship-ready)              │
    │                                                 │
    │  ✅ Vote compass quiz (8 policy areas)          │
    │  ✅ 434 candidates / 73 constituencies          │
    │  ✅ Interactive map + postcode lookup            │
    │  ✅ Polling trends (132 polls, daily sync)      │
    │  ✅ Constituency projections (all 73 overridden)│
    │  ✅ How-to-Vote guide                           │
    │  ✅ Party pages                                 │
    │  ✅ Latest news on homepage (BBC RSS, 3x/day)   │
    │  ✅ 6/6 manifestos parsed with verbatim quotes  │
    │  ✅ 78 sitting MSPs flagged as incumbents       │
    │  ✅ Accessibility & performance optimised       │
    │  ✅ 45 tests passing                            │
    │  ✅ Dependencies updated                        │
    └─────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │        MANIFESTO ANALYSIS                        │
    │                                                 │
    │  All 6 parties have 2026 manifestos parsed:     │
    │    SNP              parsed 17 Apr               │
    │    Scottish Greens  parsed 17 Apr               │
    │    Scottish LibDems parsed 17 Apr               │
    │    Scottish Cons    parsed 17 Apr               │
    │    Reform UK        parsed 17 Apr               │
    │    Scottish Labour  parsed 18 Apr               │
    │                                                 │
    │  Re-run /sync-manifestos if any party publishes │
    │  amendments between now and 7 May.              │
    └─────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │      NEXT UP (see "Next up" section above)      │
    │                                                 │
    │  Must-fix if time allows:                       │
    │  • Schema-validate party + manifesto YAMLs      │
    │  • Enrich ~70 quiz-candidate stub bios          │
    │  • Replace Democracy Club API source URLs       │
    │                                                 │
    │  Nice-to-have:                                  │
    │  • Add Ballot Box Scotland / Guardian news RSS  │
    │  • Matching engine edge-case tests              │
    │  • Pollster name unification                    │
    │                                                 │
    │  Post-election:                                 │
    │  • "How we did" projection retrospective        │
    │  • Retire dead populate-projections default     │
    │  • yaml.stringify lineWidth in fan-out script   │
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
