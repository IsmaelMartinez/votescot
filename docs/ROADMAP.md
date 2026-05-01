# VoteScot Roadmap

Last updated: 30 April 2026 (six pre-election tracks shipped as PRs #74–#79: 4 incumbent overrides + lock flag, 5 projection re-sources, 4 projection calibrations, 4 bio fixes, 356 URL hygiene items, polls-chart race view)

## What's live now

The site is at https://ismaelmartinez.github.io/votescot/ and covers all 73 Scottish Parliament constituencies with 434 candidates for the 7 May 2026 election.

### Core features

The vote compass quiz matches voters to candidates across 8 policy areas (independence, NHS, housing, climate, tax, economy, education, equality). It lives at a single `/quiz` URL: voters answer the 8 questions once and switch between a "Constituency ballot" and "Regional list" tab in the results, both sourced from the same answers. One postcode lookup (or browse pick) resolves both selections via the constituency-to-region map; constituencies carry a `region` field across all 9 of the 2026 boundary-review regions. The legacy `/quiz/regional` URL redirects to `/quiz` and inbound `?region=` links still land on the regional tab. 370 candidates from 6 major parties have quiz data based on party-level positions. All six parties (SNP, Scottish Greens, Scottish Lib Dems, Scottish Conservatives, Reform UK, Scottish Labour) now have positions, stances, and verbatim quotes sourced from their published 2026 Holyrood manifestos. The matching algorithm scores exact matches, partial matches, and disagreements with per-issue breakdown. All pages clearly disclose that positions are party defaults unless individually verified.

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
- [x] **Region picker on the homepage** (PR #41). 8 cards beneath the constituency map after PR A reconciliation.
- [x] **Regional list candidate ingest** (PR #42). 589 candidacies imported from Democracy Club into `data/regional-candidates/`, validated by `schemas/regional-candidate.schema.json`.
- [x] **Region naming reconciled to 8 official regions** (PR A). Constituency `region:` field updated across 16 YAMLs to match the 2025 Boundaries Scotland review and Democracy Club's ballot structure; `loadRegions()` now returns 8 entries with id slugs that match the regional list ballot keys. Astro redirects send legacy `/central-scotland` and `/edinburgh-and-lothians-west` URLs to the merged region.
- [x] **Regional surfaces sourced from list candidates** (PR B). `loadRegionalCandidates()` / `loadRegionalCandidatesByRegion()` added; `loadCandidatesByRegion` refactored to a regionId API. `/candidates/region/[id]` now renders regional list candidates grouped by party and ordered by `listPosition`. Disclaimer banner dropped. Sibling `/candidates/regional/[id]` profile route added (collisions with `/candidates/[id]` made the aggregating approach unviable — 339 shared slugs). `apply-party-positions.ts` extended to fan out to `data/regional-candidates/`; 393 of 589 regional candidates now carry party positions.
- [x] **Quiz results grouped by party** (PR C). `/quiz/regional` now sources from `loadRegionalCandidates()` and `QuizEngine` regional mode renders one match score per party with the party's regional list candidates listed beneath in `listPosition` order, each linking to `/candidates/regional/{id}`. Per-issue breakdown shown once per party; same-party-identical-score disclaimer dropped from regional mode (the new layout makes the same point structurally). Constituency mode untouched.
- [x] **Constituency quiz results grouped by party** (PR E). `/quiz` constituency mode now mirrors the regional refactor: one match score per party, candidates listed alphabetically beneath each party block linked to `/candidates/{id}`, per-issue breakdown shown once per party. Same-party-identical-score disclaimers dropped from constituency mode (the layout makes the point structurally).
- [x] **Constituency↔region map view toggle** (PR D). `ConstituencyMap.tsx` exposes a two-button view selector; region view recolours the 73 polygons by their parent region (8-colour Set2-derived palette, hand-assigned per region id) with reduced internal stroke to imply the dissolve, and routes clicks to `/candidates/region/{id}`. Default remains constituency view; no new GeoJSON, no extra dependencies.

The plan below is sequenced so each PR is independently shippable and reviewable. Targeted at landing all four before 7 May 2026.

#### PR A — Reconcile region naming (foundation) — shipped

Done in this PR. Cross-checking VoteScot's existing constituency `region:` tags against the official Wikipedia / Boundaries Scotland mapping surfaced more drift than the original "merge two regions" assumption: 5 constituencies were also miscategorised independently of the merge (Rutherglen and Cambuslang belonged in Glasgow not Central Scotland; East Kilbride and Hamilton/Larkhall/Stonehouse belonged in South Scotland; Edinburgh South Western and Edinburgh Southern belonged in Edinburgh and Lothians East not Lothians West; Midlothian South/Tweeddale/Lauderdale belonged in South Scotland; Moray belonged in Highlands and Islands not North East Scotland). All 16 relocations applied and the per-region totals now match the official 9/9/8/8/9/10/10/10 = 73 distribution. Astro redirects send the two legacy slugs (`central-scotland`, `edinburgh-and-lothians-west`) to the merged `central-scotland-and-lothians-west` region.

#### PR B — Regional surfaces source from regional list candidates — shipped

Done in this PR. Loader API refactor, `/candidates/region/[id]` rewritten with party-grouped lists ordered by `listPosition`, `/candidates/regional/[id]` profile route added (sibling rather than aggregated — 339 candidate slugs collide between the constituency and regional trees, mostly because the same person stands on both ballots, so a single route was unworkable). Party positions fanned out to 393 of 589 regional candidates via the extended `apply-party-positions.ts`. ~~The `fix-incumbents.ts` extension to flag sitting regional MSPs is split into a small follow-up PR.~~ Done. `scripts/fix-incumbents-regional.ts` cross-references regional candidates against the union of session-6 constituency-status and region-status records (a sitting MSP is "incumbent" on any party list regardless of which seat they hold), flagging 69 sitting MSPs across 589 regional candidate files.

#### PR C — Quiz results grouped by party, not individual — shipped

Done in this PR. `QuizEngine` now branches on mode for both data and rendering: regional mode takes `RegionalCandidate[]` from `loadRegionalCandidates()`, groups them by party, computes one match score per party (positions are party-level), and renders party blocks ordered by score with each block listing that party's regional list candidates in `listPosition` order linked to `/candidates/regional/{id}`. The per-issue breakdown shows once per party. Parties with no captured positions render at the bottom with "No quiz positions" instead of a misleading 0%. Constituency mode left untouched; the analogous refactor for `/quiz` shipped as PR E below.

#### PR E — Quiz constituency results grouped by party — shipped

Done in this PR. `QuizEngine` constituency mode now uses the same party-block layout as regional mode: candidates filtered by `selected` constituency are grouped by party, one match score is computed per party from a representative candidate's positions, and party blocks are rendered ordered by score with each block listing the party's constituency candidates alphabetically by name linked to `/candidates/{id}`. The per-issue breakdown shows once per party; the same-party-identical-score disclaimers (both the results-page banner and the question-answering banner) were dropped from constituency mode since the new layout makes the same point structurally. The previous per-candidate "ranked individuals" view, including bios and individual percentage scores, is gone — the structurally flat list of names with optional incumbent badges matches the regional layout.

#### PR D — Map view toggle (constituency ↔ region) — shipped

Done in this PR. `ConstituencyMap.tsx` gained a two-button segmented control ("Constituency" / "Region", default constituency so the existing flow is unchanged for users who never toggle). In region view the 73 polygons are recoloured by their parent region using a fixed 8-colour palette (Set2-derived, hand-assigned per region id to keep adjacent regions visually distinct), per-polygon stroke is reduced to 0.5 to imply the dissolve, the legend swaps to list region names with their colour swatch, and clicks navigate to `/candidates/region/{id}` with a region-name-only tooltip. No dissolves done in JS — recolouring is sufficient and avoids pulling in Turf. Wiring on `index.astro` threads a `constituencyId → regionId` map and the 8 regions into the component using the existing `loadRegions()` / `slugifyConstituency` plumbing from PR A. The projection toggle is hidden in region view to keep the two visual encodings from competing.

#### Deferred — per-region polling

The polls page already shows national-regional vote intent via the constituency/regional toggle. Per-region polling trends would need a different data source — the Wikipedia tracker has only thin per-region breakdowns. Revisit after the four PRs above land if there is time before 7 May; otherwise post-election.

#### Carried follow-ups

None outstanding. The constituency-mode quiz refactor flagged here previously shipped as PR E above.

### Must-fix if time allows before 7 May

- [x] **Stub-bio enrichment pass.** Three-stage pass closed the must-fix:
  1. `scripts/cross-copy-bios.ts` lifted substantive constituency bios onto 193 same-name regional list entries.
  2. PR #55 wrote bios for the 15 list-only sitting MSPs (Harvie, Greer, Chapman, Ruskell, Burgess, MacKay, plus Lennon, Bibby, Sweeney, O'Kane, McNeill, Findlay, Baker, Regan, Balfour) sourced from Parliament.scot member pages.
  3. PRs #56–#60 ran a research pass on the remaining 317 quiz-surfacing stubs via WhoCanIVoteFor candidate pages, party-specific candidate sites, news, council websites, and Wikipedia. Outcome: 200 confident bios with citation, 116 honest "we have not identified independent biographical sources for this candidate beyond the party listing" templates (the right answer for paper candidates whose only public footprint is a listing-page entry), and 1 already-substantive bio left untouched. Five pre-existing bios were corrected as a side-effect (Herdman councillor mis-claim caught by the pilot, plus Brodie, Stalker, Heggie, Ghani in batch 2).
- [x] **Replace Democracy Club API URLs in candidate `sources`.** 704 major-six candidate files now cite the official party website (PR #53). The 262 long-tail candidates also got per-candidate sources where available via the bio research pass — Parliament.scot, WhoCanIVoteFor, council profiles, party candidate pages, news articles. Where no per-candidate source could be identified, the existing party_website source remains alongside the honest stub.

### Nice-to-have before 7 May

- [x] **Additional news sources.** Added Ballot Box Scotland (https://ballotbox.scot/feed/) and Guardian Scotland politics (https://www.theguardian.com/politics/scotland/rss) to `scripts/sync-news.ts` `SOURCES` alongside BBC Scotland Politics.

### Watch — between now and 7 May

All six manifestos re-checked on 28 April (`/sync-manifestos` returned no amendments since 17–18 April). The SNP page shows a 28 April CMS timestamp but no content changelog (the four regional supplementary docs uploaded 24–27 April are companion documents, not amendments). Conservatives' supplementary "rural manifesto" (22 April) is companion policy detail, not an amendment to the parsed file. No further action unless a party publishes an actual revision in the final week.

A region-by-region audit of all 589 regional list candidates and all 437 constituency candidates against the official Statement of Persons Nominated, WhoCanIVoteFor, party websites, Wikipedia, and parliament.scot was completed on 28 April. Names, party assignments, list ordering, regional assignments, and incumbent flags were all confirmed. Two systemic issues were fixed in PR #70: every Independent Green Voice candidate had been branded as Scottish Greens, and 12 `listPosition` outliers had drifted from the dominant convention. PR #71 fixed a homepage region-card mismatch (cards displayed constituency candidate counts but linked to a regional-list page).

A second cross-reference pass on 29 April compared assigned positions against TheyWorkForYou voting records, audited the 73 constituency projection numbers against the latest MRPs and Ballot Box Scotland, sample-validated source URLs, and spot-checked substantive bios. Findings prioritised below.

### Pre-election fixes (do before 7 May)

All six pre-election tracks shipped 29–30 April 2026 as PRs #74–#79. Detailed entries moved to the "What shipped" archive below.

### Post-election cleanup (after 7 May)

- [ ] **"How we did" projection retrospective.** Publish a page comparing each constituency's projected top-3 shares against the actual result. Call out the wins, the misses, and the methodology behind the calls. Strongest credibility asset for any 2027+ version of the site. Natural day-after-results task.
- [ ] **Sunset the site a few weeks after polling day.** VoteScot is ephemeral by design — built for one election, archived after. The plan is to take the live site offline once the retrospective has had a chance to settle (mid-May to early June), leaving a single static landing page that links to a Wayback Machine snapshot taken a few days before polling day. Open questions: which snapshot date to anchor on (probably 6 May, the eve of poll), whether to keep the GitHub repo public as a frozen reference (yes — it has the methodology and is the citation surface for the retrospective), and whether to redirect inbound traffic from the old `/quiz` and `/candidates/*` routes to the snapshot or to the landing page. Submit URL via [Save Page Now](https://web.archive.org/save/), confirm full crawl coverage (map TopoJSON, party YAMLs, polls JSON, all candidate pages), then replace the site with the landing page. No new infrastructure required — GitHub Pages can serve a one-page `index.html` indefinitely.
- [ ] **Blog post: ephemeral websites with AI.** Short retrospective piece on why the "build for one event, archive after" pattern is more viable now than it used to be — drafting copy, sourcing data, fanning out party positions to candidate files, and shipping accessibility/performance polish were all collapsed into days of solo work because the AI coding assistant absorbed the throwaway labour that previously made ephemeral sites uneconomical. Concrete examples from this build: the manifesto parser that runs once per election cycle, the per-candidate bio research pass that wrote 200 confident bios with citations, the same-day fix-and-ship loop on the projection re-sources after the cross-reference audit. Frame it as "the industry can do this now, and election-information sites are an obvious fit." 800–1,200 words. Publish on a personal blog or as a GitHub repo `POSTMORTEM.md`. Not new ground philosophically (throwaway prototypes have always been a thing) but newly cheap.
- [ ] **Deep-freeze the data caches** (or don't — current shallow freeze matches the existing pattern across all six cached loaders in `src/lib/data.ts`). If deepening, do all six consistently in a single refactor. Lower priority given the planned sunset.

The two cleanup items previously listed here — `yaml.stringify({ lineWidth: 0 })` in `apply-party-positions.ts` and retiring the `populate-projections.ts` default — are already done. `apply-party-positions.ts:60` and `sync-regional-candidates.ts:112` both pass `{ lineWidth: 0 }`; `populate-projections.ts` was replaced by `scripts/project-from-polls.ts` and no `defaultProjection` template references remain anywhere.

## What shipped before 7 May (archived task list)

### Pre-election final pass (shipped 29–30 April 2026)

~~Override 4 incumbents whose party-default position substantively misleads.~~ Done in PR #74. Carlaw and Gulhane (`equality: 0 → 1`) voted *for* the Gender Recognition Reform (Scotland) Bill at Stage 3 in December 2022, breaking with the Conservative line. Gibson (`equality: 2 → 1`) voted *against*, one of nine SNP rebels. McNeill (`housing: 1 → 2`) is a long-standing public champion of statutory rent controls, lodging the Fair Rents (Scotland) Bill as a Member's Bill in 2019 — diverges from Scottish Labour's 2026 "no new rent controls" line. Fairlie kept his SNP-default `equality` but is now flagged as a GRR abstainer in his stance text (later bumped to `equality: 1` for consistency with Gibson). The PR also added a new `quizPositionsLocked: true` schema field that `apply-party-positions.ts` respects even under `--force`, so a future `/sync-manifestos` run after a manifesto amendment cannot silently wipe these overrides.

~~Re-source 5 implausible constituency projections.~~ Done in PR #75. Each had the *winner* wrong against April 2026 MRPs: Glasgow Southside (was Labour 33 / SNP 30 / Reform 12 → SNP 34 / Lab 30 / Green 16 competitive), Strathkelvin and Bearsden (was SNP 33 with LibDems missing top-3 → LibDem 33 / SNP 32 / Lab 14 toss-up per More in Common), Glasgow Kelvin and Maryhill (Greens at 18 → 27, Green-favoured toss-up), Edinburgh North Eastern and Leith (Greens at 16 → 26, three-way toss-up per More in Common), Edinburgh Northern (LibDem 7-pt lead tightened to a Con/SNP/LibDem toss-up). Every `projectionSource` paragraph now cites the specific MRPs that informed the call.

~~Calibrate 4 wobbly projections.~~ Done in PR #76. Direction was defensible on each but shares needed adjusting: Ayr (now Reform 29 / SNP 27 / Con 24 toss-up per More in Common's headline), Banffshire and Buchan Coast (downgraded from `safe` SNP to a Reform 28 / SNP 27 / Con 22 toss-up — Reform's strongest Scottish target per BBS), Eastwood (Tory 30 was too high; three April 2026 MRPs converge on an SNP gain, now SNP 35 / Con 24 / Lab 16), Dumfriesshire (tightened YouGov's 33/24/22 to a 26/25/24 SNP/Con/Reform toss-up reflecting JL Partners and late-April convergence).

~~Fix 1 factually-wrong bio + 3 stale framings.~~ Done in PR #77. Constance: "MSP for Almond Valley since 2007" corrected to "since 2011" (constituency didn't exist before then; she was MSP for Livingston 2007–2011). Burnett: Chief Whip and Vice-Chairman role reframed as former (held 2022–2025; Tim Eagle has it since September 2025). Gethins: highlight "Lecturer in international relations at St Andrews" promoted to "Professor of Practice in International Relations". Somerville: "MSP since 2007" reworded to spell out the 2011–2016 gap (Lothians regional 2007–2011, Dunfermline since 2016). Edits applied to both `data/candidates/` and `data/regional-candidates/` where applicable.

~~Source URL hygiene (mechanical).~~ Done in PR #78. Stripped trailing slashes from 94 `whocanivotefor.co.uk/person/<id>/<slug>/` URLs (the trailing-slash form 404s). Replaced 262 stale `candidates.democracyclub.org.uk/api/next/parties/<id>/` API URLs with the official party homepage where one was known (UKIP, Workers Party, Liberal Party, Animal Welfare Party, Scottish Family Party, Christian Party, Scottish Socialist Party, TUSC, Communist Party, Independence for Scotland Party, Freedom Alliance, Heritage Party, Advance UK, Scottish Libertarian Party). The follow-up review caught that the WhoCanIVoteFor party-page fallback URLs needed `/parties/party:<id>/<slug>` not `/parties/<PP_id>/<slug>` (the latter 404s) and that Workers Party of Britain is mid-migration to `workerspartygb.org`; both fixed before merge.

~~Polls chart "race view" enhancement.~~ Done in PR #79. `/guide#polls` now renders per-poll dots scaled by sample size, a 30-day centred rolling-mean smoothed trend per party (new pure helper in `src/lib/polls-smoothing.ts` with 5 unit tests), dashed 2021 baseline reference lines with a "show 2021 baselines" checkbox, and a 5-year time window from May 2021. Replaced the binary constituency/regional toggle with a three-way **Constituency vote / Regional vote / Seat projection (MRP)** flip. The MRP option renders horizontal stacked bars per recent MRP (newest-first) with a vertical 65-seat majority marker. `scripts/sync-polls.ts` extended to parse the third Wikipedia table (MRP seat projections) into an additive `mrp:` array on `data/polls.json`, with a header-signature lookup so a future Wikipedia table insertion fails loudly instead of silently parsing the wrong table.

### Critical — data accuracy

~~Consolidate the constituency and regional quizzes into one tabbed view.~~ Done. `/quiz` now asks the 8 questions once and renders both ballots in a tabbed result view ("Constituency ballot" / "Regional list"). One postcode lookup (or browse pick) resolves both `selectedConstituencyId` and `selectedRegionId` via the constituency-to-region map. `/quiz/regional` was retired and redirects to `/quiz`, with inbound `?region=` links pre-selecting the regional tab. The duplicate "Regional" header tab was dropped; navigation is now Map / Candidates / Quiz / Guide. `QuizEngine` was refactored from a discriminated-mode component into one component holding both result views, with the party-block computation extracted into a shared `buildPartyBlocks()` helper.

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

~~Add React error boundaries around interactive components.~~ Done. ErrorBoundary component wraps all 6 Astro island components (QuizEngine, CandidateComparison, CandidatesSearch, PollsChart, PostcodeLookup, ConstituencyMap).

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
  30 Apr                                           7 May
    │              7 days remaining                   │
    ▼                                                ▼
    ┌─────────────────────────────────────────────────┐
    │           WHAT'S DONE (ship-ready)              │
    │                                                 │
    │  ✅ Vote compass quiz (8 policy areas)          │
    │  ✅ 434 candidates / 73 constituencies          │
    │  ✅ Interactive map + postcode lookup            │
    │  ✅ Polling trends (race view, MRP seats panel) │
    │  ✅ Constituency projections (all 73 overridden)│
    │  ✅ How-to-Vote guide                           │
    │  ✅ Party pages                                 │
    │  ✅ Latest news on homepage (BBC RSS, 3x/day)   │
    │  ✅ 6/6 manifestos parsed with verbatim quotes  │
    │  ✅ 78 sitting MSPs flagged as incumbents       │
    │  ✅ 5 incumbent position overrides + lock flag  │
    │  ✅ 9 projections re-sourced/calibrated         │
    │  ✅ 4 bio fixes + 356 source URLs cleaned       │
    │  ✅ Accessibility & performance optimised       │
    │  ✅ 107 tests passing                           │
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
    │      NEXT UP                                    │
    │                                                 │
    │  Pre-election: nothing scheduled. All six       │
    │  tracks shipped 29–30 Apr (PRs #74–#79).        │
    │                                                 │
    │  Watch:                                         │
    │  • Re-run /sync-manifestos if any party amends  │
    │                                                 │
    │  Post-election:                                 │
    │  • "How we did" projection retrospective        │
    │  • Sunset the site (Wayback snapshot + landing) │
    │  • Blog post: ephemeral websites with AI        │
    │  • Deep-freeze data caches (lower priority)     │
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
    │  The site is ephemeral by design. Plan:         │
    │                                                 │
    │  Days 1–3: "How we did" retrospective           │
    │  Weeks 2–4: Wayback Machine snapshot + sunset   │
    │             (replace site with landing page     │
    │             linking to the snapshot)            │
    │  Sometime: Blog post on ephemeral sites + AI    │
    │                                                 │
    │  Repo stays public as a frozen reference and    │
    │  citation surface for the retrospective.        │
    └─────────────────────────────────────────────────┘
```
