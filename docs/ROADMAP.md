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

Enrich high-profile candidates with real bios. John Swinney (First Minister), Anas Sarwar (Labour leader), and other party leaders currently show generic template bios like "SNP candidate for Perthshire North." These need substantive biographical information — voters deserve to know who these people are.

Fix incumbent status for sitting MSPs. The sync script hardcodes `isIncumbent: false` for everyone. Current MSPs standing again should be marked as incumbents. Cross-reference with the Scottish Parliament members API at `data.parliament.scot/api/members`.

Differentiate Conservative and Reform positions. Both currently score 0 on every issue, making them indistinguishable in the quiz. The Conservatives have specific manifesto positions on NHS, education, and housing that differ from Reform's "scrap everything" approach.

Make projection methodology transparent. Currently hardcoded numbers with no source attribution. Each projection should cite its basis (Ballot Box Scotland notionals, national polling swing, or whatever the source is).

### High priority — usability

Add a "How to Vote" guide. Voters need to know they get TWO ballot papers (constituency and regional list), how AMS works, what the regional list vote means, and where their polling station is. This is essential for first-time voters and 16-17 year olds.

Fix slug consistency between PostcodeLookup and ConstituencyMap. Both derive constituency slugs client-side using different logic. A mismatch sends voters to the wrong page.

Add `robots.txt` and `sitemap.xml`. 515 pages need to be indexed before the election.

Consider making the map the landing page, or at least more prominent. The current landing page is text-heavy. The map is a more intuitive entry point — click your area, see your candidates.

### Medium priority — accessibility and polish

Bump font sizes to minimum 12px. Multiple components still use 9-10px text which is below WCAG recommendations.

Add ARIA roles to quiz radio buttons (`role="radio"`, `aria-checked`, `role="radiogroup"`).

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
