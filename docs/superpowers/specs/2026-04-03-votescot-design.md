# VoteScot Design Spec

An open-source, privacy-first vote compass for the 2026 Scottish Parliament election. Helps voters find their constituency, take a values-based quiz to match with candidates, compare candidate positions side-by-side, and access curated research resources.

## Decisions

- Repo: `votescot` (MIT license)
- Framework: Astro 5 with React islands for interactive components
- Styling: Tailwind CSS with custom theme tokens
- Data: YAML files in the repo, validated by JSON Schema in CI
- Hosting: GitHub Pages via GitHub Actions
- AI deep dive: optional BYOK (Anthropic API key), low-prominence, client-side only
- Scope: Edinburgh Central constituency as MVP, extensible to all constituencies

## Architecture

Static site generated at build time from YAML data files. No backend, no database, no user accounts. Interactive features (quiz, comparison, postcode lookup, deep dive) are React islands hydrated client-side. All state stays in React component state — nothing persisted to localStorage or cookies.

## Project Structure

```
votescot/
├── src/
│   ├── pages/
│   │   ├── index.astro              # Landing with postcode lookup
│   │   ├── quiz.astro               # Vote compass (React island)
│   │   ├── candidates/
│   │   │   ├── index.astro          # All candidates grid
│   │   │   └── [id].astro           # Per-candidate page (generated from data)
│   │   ├── compare.astro            # Side-by-side comparison (React island)
│   │   └── resources.astro          # Research hub (pure static)
│   ├── components/
│   │   ├── QuizEngine.tsx           # Quiz logic, matching, results
│   │   ├── CandidateComparison.tsx  # Side-by-side picker
│   │   ├── DeepDive.tsx             # Optional BYOK Claude analysis
│   │   ├── PostcodeLookup.tsx       # Constituency finder
│   │   └── *.astro                  # Static components (header, footer, cards)
│   ├── layouts/
│   │   └── Base.astro               # Shared layout
│   └── styles/
│       └── global.css               # Tailwind base + custom tokens
├── data/
│   ├── constituencies/
│   │   └── edinburgh-central.yaml   # Constituency metadata
│   ├── candidates/
│   │   ├── angus-robertson.yaml
│   │   ├── lorna-slater.yaml
│   │   ├── james-dalgleish.yaml
│   │   ├── jo-mowat.yaml
│   │   └── charles-dundas.yaml
│   ├── questions.yaml               # Quiz questions and options
│   └── resources.yaml               # Research hub links
├── schemas/
│   ├── candidate.schema.json
│   ├── constituency.schema.json
│   └── questions.schema.json
├── public/
│   └── postcode-lookup.json         # Prebuilt postcode sector -> constituency mapping
├── .github/
│   └── workflows/
│       └── deploy.yml               # Validate data, build, deploy to GitHub Pages
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
└── LICENSE
```

## Data Layer

`data/` is the single source of truth. Astro reads YAML at build time. Each candidate is a separate file following a consistent schema.

### Candidate YAML schema

```yaml
id: "lorna-slater"
name: "Lorna Slater"
party: "Scottish Greens"
partyShort: "Green"
color: "#00A651"
accent: "#007A3D"
constituency: "edinburgh-central"
isIncumbent: false
bio: "Former Green co-leader and Minister..."

positions:
  independence: 2     # 0 = oppose, 1 = neutral/maintain, 2 = support/expand
  nhs: 2
  housing: 2
  climate: 2
  tax: 2
  economy: 2
  education: 1
  equality: 2

stances:
  independence: "Supports independence. Part of former Bute House Agreement..."
  nhs: "Care workers £15/hr. Walk-in mental health centres..."
  housing: "Strengthen rent controls..."
  climate: "Most ambitious platform. Free bus travel for ALL..."
  tax: "Higher taxes on super-rich, big banks..."
  economy: "Four-day week pilot. Universal basic income exploration..."
  education: "Expand funded childcare from 6 months..."
  equality: "Strong advocate for trans rights..."

highlights:
  - "First ever Green government minister in UK history"
  - "Delivered free bus travel for under-22s"
  - "Delivered rent control legislation"

sources:
  - url: "https://greens.scot/..."
    type: "party_website"
  - url: "https://www.theyworkforyou.com/..."
    type: "voting_record"
```

### Constituency YAML schema

```yaml
id: "edinburgh-central"
name: "Edinburgh Central"
region: "Edinburgh and Lothians East"
boundaryYear: 2026
description: "Covers Old/New Towns, Princes Street, Haymarket, Murrayfield, Stockbridge, Dalry..."
context: "Three-way marginal. No candidate has ever won >40%."
postcodeSectors:
  - "EH1"
  - "EH2"
  - "EH3 5"
  - "EH3 6"
  - "EH3 7"
  - "EH3 9"
  - "EH4 1"
  - "EH12 5"
```

### Quiz questions schema

```yaml
questions:
  - id: "independence"
    area: "Scotland's Future"
    question: "What's your view on Scottish independence?"
    options:
      - label: "Scotland should become independent"
        value: 2
      - label: "Scotland should stay in the UK"
        value: 0
      - label: "Not a priority for me either way"
        value: 1
```

## Quiz Engine

`QuizEngine.tsx` is a React island hydrated with `client:load` on the quiz page.

### Matching algorithm

For each answered question, compare the user's selected value (0, 1, or 2) to the candidate's position value for the same policy area:

- Exact match (diff = 0): 100 points
- Partial match (diff = 1): 50 points
- No match (diff = 2): 0 points

Final match percentage = average of points across all answered questions.

### States

1. Answering: 8 questions displayed, each with 3 concrete options. User can answer in any order, change answers, skip questions.
2. Results: requires minimum 3 answered. Shows candidates ranked by match percentage with per-issue agree/partial/disagree tags.
3. Explore: links to candidate profiles and comparison view for deeper investigation.

### Privacy

All state is React component state. No localStorage, no cookies, no analytics events. Refresh clears everything.

## Postcode Lookup

`PostcodeLookup.tsx` is a React island on the landing page.

A prebuilt JSON file (`public/postcode-lookup.json`) maps postcode sectors to constituency IDs. Generated at build time from Boundaries Scotland open data. The component normalises the user's input, extracts the sector, and looks it up.

For the MVP (Edinburgh Central only), unmatched postcodes get a message explaining coverage is expanding, with links to Scotland-wide resources.

The lookup file covers Scottish postcode sectors only — a few hundred KB at most. No external API calls needed at runtime.

## Candidate Pages

Statically generated at build time via Astro's `[id].astro` dynamic route. Each page reads the candidate's YAML and renders: bio, party affiliation, policy stances with human-readable descriptions, track record highlights, and source links.

No JavaScript required for these pages. Pure static HTML.

## Comparison View

`CandidateComparison.tsx` is a React island hydrated with `client:load`. All candidate data is passed as a prop at build time. Displays all five candidates' stances side-by-side grouped by policy area.

## AI Deep Dive

`DeepDive.tsx` is a React island available on individual candidate pages behind a low-prominence link (e.g. small text link in the page footer, not a prominent button).

When activated:

1. Prompts for an Anthropic API key
2. Stores the key in sessionStorage only (cleared when tab closes)
3. Calls the Claude API client-side with a neutral analysis prompt
4. Displays the result in a modal

No key is ever sent to any server we control. No server exists. The prompt template asks for balanced analysis with specific hustings questions.

## Visual Design

Carried from the prototype:

- Header: dark `#1a1a2e` with gold accent `#c4940a`
- Background: warm paper `#f5f2ed`
- Typography: Crimson Pro (headings), Source Sans 3 (body)
- Party colours from candidate YAML for indicators and cards
- Responsive, mobile-first

These values become Tailwind theme tokens in `tailwind.config.mjs`.

## Research Hub

Pure static Astro page. Data from `data/resources.yaml`. Grouped by category:

- Projections (Ballot Box Scotland, DevolvedElections, Wikipedia polls)
- Fiscal analysis (Fraser of Allander, SPICe)
- Candidate research (WhoCanIVoteFor, TheyWorkForYou, Public Whip, Election Leaflets)
- Voter registration (gov.uk, Boundaries Scotland, Edinburgh Council, Electoral Commission)
- Open data and APIs (Scottish Parliament, TheyWorkForYou API)

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`):

- Trigger: push to `main`
- Steps: install deps, validate YAML against JSON schemas, build Astro, deploy to GitHub Pages
- Also runs on PRs (build + validate only, no deploy) so contributors see if their changes break anything

## Extensibility

Adding a new constituency: create a new YAML file in `data/constituencies/`, add candidate YAML files referencing that constituency ID, expand the postcode lookup data. Pages generate automatically.

Adding quiz questions: add entries to `data/questions.yaml` with corresponding position values in candidate files.

Adding resources: edit `data/resources.yaml`.

## Out of Scope for MVP

- Automated data pipelines (polling ingestion, manifesto parsing)
- Multiple election support
- User accounts or saved results
- Server-side rendering or API routes
- CMS interface for contributors
- Custom domain (starts at `ismaelmartinez.github.io/votescot`)
