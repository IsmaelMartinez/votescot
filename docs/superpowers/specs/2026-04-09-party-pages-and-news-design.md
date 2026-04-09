# Party Pages and News Articles Design

## Overview

Add party-level pages to VoteScot as a secondary way to explore the site, accessible via a toggle on the existing Candidates page. Phase 1 delivers party pages with manifesto links, policy positions, and candidate listings. Phase 2 (deferred) adds curated news articles fetched from Scottish news sources.

## Phase 1: Party Pages

### Data Layer

No new YAML files. Existing data is sufficient:

- `data/parties/*.yaml` — id, name, positions (8 policy areas scored 0-2), stances (text descriptions), quotes
- `data/manifestos/registry.yaml` — manifesto URLs per party
- `data/candidates/*.yaml` — each candidate has a `party` field mapping to a party id

Add to `src/lib/data.ts`:

- `Party` interface with fields: id, name, positions (CandidatePosition), stances (Record<string, string>), quotes (Record<string, string>)
- `ManifestoEntry` interface with fields: id, name, manifestoUrls (string[])
- `loadParties(): Party[]` — reads all YAML from `data/parties/`, caches like `loadCandidates()`
- `loadManifestoRegistry(): ManifestoEntry[]` — reads `data/manifestos/registry.yaml`

Candidate-to-party mapping: candidates store the full Democracy Club party name (e.g. "Labour Party", "Conservative and Unionist Party") while party YAML files use id slugs (e.g. `scottish-labour`, `scottish-conservatives`). A mapping already exists in `scripts/apply-party-positions.ts` as `PARTY_MATCH_MAP`. Extract this mapping into a shared location (e.g. `src/lib/party-match.ts`) so the party detail page can look up which candidates belong to a party. The `findPartyKey()` function in `scripts/lib/parties.ts` provides a similar fuzzy match using substring inclusion and can serve as a reference.

### Pages and Routes

#### Candidates index toggle (`/candidates`)

The existing candidates index page gains a toggle above the search bar. Two modes: "By Constituency" (default, current behaviour) and "By Party". The toggle controls which content block is visible.

"By Constituency" mode is the existing page content unchanged.

"By Party" mode shows a grid of `PartyCard` components, one per party, sorted alphabetically. Each card links to the party detail page.

The search bar and comparison tool only appear in "By Constituency" mode since they operate on individual candidates.

#### Party detail page (`/candidates/party/[id].astro`)

Located under the candidates route to keep the "Candidates" tab active in the header. Uses Astro static generation with `getStaticPaths()` over all party ids.

Page content from top to bottom:

1. Party name as heading, with party colour as an accent (left border or underline)
2. Manifesto link — first URL from the registry, opens in new tab
3. Policy positions section — 8 areas, each showing the area label and the stance description text. Same visual pattern as candidate detail pages.
4. Candidates section — heading with count, then a grid of `CandidateCard` components for all candidates belonging to this party, grouped by constituency
5. News section — placeholder for phase 2, shows "Coming soon" note

#### No navigation changes

The Header component is unchanged. "Candidates" tab remains active for all `/candidates/*` routes. No fifth tab added.

### Components

#### New: `ViewToggle.tsx` (React)

A pair of styled buttons toggling between "By Constituency" and "By Party" views. Uses `client:load` for immediate interactivity. Renders as a segmented control with the active option highlighted using the votescot-gold accent. Calls an `onToggle` callback that the candidates index page uses to show/hide content blocks.

#### New: `PartyCard.astro`

Card component following the same pattern as `CandidateCard.astro`:

- Party colour as left border
- Party name as heading
- Candidate count as subtitle
- Manifesto link (small, secondary text)
- Links to `/candidates/party/[id]`
- White background, border, hover effect matching existing cards

#### Unchanged: `CandidateCard.astro`

Reused as-is on party detail pages to list candidates.

#### Unchanged: `Header.astro`

No modifications needed.

## Phase 2: News Articles (Deferred)

### Data

New directory `data/news/` with per-party YAML files (e.g. `data/news/scottish-labour.yaml`). Each file contains an array of articles:

```yaml
articles:
  - title: "Scottish Labour unveils housing plan"
    url: "https://www.bbc.co.uk/news/..."
    source: "BBC Scotland"
    date: "2026-04-08"
  - title: "..."
    ...
```

### Sync script

New `scripts/sync-news.ts` fetching from curated Scottish news RSS feeds:

- BBC Scotland
- The Herald
- The Scotsman
- The National
- STV News

Searches each feed for party name mentions. Deduplicates by URL. Keeps the most recent 10-20 articles per party. Runs daily via a new GitHub Actions workflow (`sync-news.yml`), similar to existing sync patterns.

### Schema

New `schemas/news.schema.json` validating the article structure. Added to `validate-data.ts`.

### UI

The placeholder "News" section on party detail pages gets replaced with an `ArticlesList.astro` component showing article cards with title, source, date, and external link. Articles sorted by date descending.

### Candidate-level news

Not in scope. If added later, would search feeds for individual candidate names, but this risks noise from common names and low coverage for non-leaders.
