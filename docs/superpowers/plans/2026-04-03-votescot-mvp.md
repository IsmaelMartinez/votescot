# VoteScot MVP Implementation Plan

> **Status (2026-05-01):** The BYOK DeepDive component (Step instructions referencing `src/components/DeepDive.tsx` and `votescot-api-key` sessionStorage) is removed. The component was built but never wired into a candidate page. Kept here for historical context only — do not implement the DeepDive steps.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static vote compass site for the 2026 Scottish Parliament election (Edinburgh Central MVP) from an existing React prototype, using Astro 5 with React islands.

**Architecture:** Astro 5 static site with YAML data files as the single source of truth. Interactive features (quiz, comparison, postcode lookup, deep dive) are React islands hydrated client-side. Deployed to GitHub Pages via GitHub Actions. The existing single-file React prototype is decomposed into focused components.

**Tech Stack:** Astro 5, React 19, TypeScript, Tailwind CSS 4, yaml (npm package), ajv (JSON Schema validation), GitHub Actions, GitHub Pages

---

## File Structure

```
votescot/
├── src/
│   ├── pages/
│   │   ├── index.astro                    # Landing page with postcode lookup + entry points
│   │   ├── quiz.astro                     # Vote compass page hosting QuizEngine island
│   │   ├── candidates/
│   │   │   ├── index.astro                # Candidates grid
│   │   │   └── [id].astro                 # Per-candidate dynamic route
│   │   ├── compare.astro                  # Comparison page hosting CandidateComparison island
│   │   └── resources.astro                # Research hub (static)
│   ├── components/
│   │   ├── Header.astro                   # Site header with nav
│   │   ├── Footer.astro                   # Site footer with disclaimer
│   │   ├── CandidateCard.astro            # Candidate card for grid view
│   │   ├── QuizEngine.tsx                 # React island: quiz + matching + results
│   │   ├── CandidateComparison.tsx        # React island: side-by-side view
│   │   ├── PostcodeLookup.tsx             # React island: postcode -> constituency
│   │   └── DeepDive.tsx                   # React island: BYOK Claude analysis modal
│   ├── layouts/
│   │   └── Base.astro                     # Shared HTML shell, fonts, meta
│   ├── lib/
│   │   ├── data.ts                        # Load and type YAML data at build time
│   │   └── matching.ts                    # Quiz matching algorithm (shared, testable)
│   └── styles/
│       └── global.css                     # Tailwind directives + custom properties
├── data/
│   ├── constituencies/
│   │   └── edinburgh-central.yaml
│   ├── candidates/
│   │   ├── angus-robertson.yaml
│   │   ├── lorna-slater.yaml
│   │   ├── james-dalgleish.yaml
│   │   ├── jo-mowat.yaml
│   │   └── charles-dundas.yaml
│   ├── questions.yaml
│   ├── resources.yaml
│   └── postcode-sectors.yaml              # Postcode sector -> constituency mapping
├── schemas/
│   ├── candidate.schema.json
│   ├── constituency.schema.json
│   └── questions.schema.json
├── scripts/
│   └── validate-data.ts                   # Schema validation script for CI
├── tests/
│   ├── matching.test.ts                   # Quiz matching algorithm tests
│   └── validate-data.test.ts              # Data integrity tests
├── .github/
│   └── workflows/
│       ├── deploy.yml                     # Build + deploy to GitHub Pages
│       └── ci.yml                         # PR checks: validate, build, test
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── CLAUDE.md
└── LICENSE
```

---

### Task 1: Scaffold Astro project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Create: `tsconfig.json`
- Create: `src/styles/global.css`
- Create: `CLAUDE.md`

- [ ] **Step 1: Initialise Astro project**

Run from the repo root (`/Users/ismael.martinez/projects/github/votescot`):

```bash
npm create astro@latest . -- --template minimal --no-install --typescript strict
```

Accept overwriting if prompted (the directory has only LICENSE and docs/).

- [ ] **Step 2: Install dependencies**

```bash
npm install @astrojs/react @astrojs/tailwind react react-dom @tailwindcss/vite
npm install -D typescript @types/react @types/react-dom tailwindcss
```

- [ ] **Step 3: Configure Astro with React and Tailwind**

Update `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ismaelmartinez.github.io",
  base: "/votescot",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 4: Set up Tailwind with VoteScot theme tokens**

Replace `src/styles/global.css`:

```css
@import "tailwindcss";

@theme {
  --color-votescot-dark: #1a1a2e;
  --color-votescot-gold: #c4940a;
  --color-votescot-paper: #f5f2ed;
  --color-votescot-border: #e8e4df;
  --color-match-good: #2d8a4e;
  --color-match-partial: #c4940a;
  --color-match-poor: #c0392b;
  --font-heading: "Crimson Pro", Georgia, serif;
  --font-body: "Source Sans 3", sans-serif;
}
```

- [ ] **Step 5: Create CLAUDE.md**

Create `CLAUDE.md`:

```markdown
# VoteScot

Open-source vote compass for the 2026 Scottish Parliament election.

## Commands

- `npm run dev` — start dev server
- `npm run build` — build static site
- `npm run preview` — preview production build
- `npm test` — run tests
- `node scripts/validate-data.ts` — validate YAML data against schemas

## Architecture

Astro 5 static site with React islands for interactive components. YAML data files in `data/` are the single source of truth. Built and deployed to GitHub Pages via GitHub Actions.

## Key conventions

- Data lives in `data/` as YAML files, one file per candidate
- Interactive components are React `.tsx` files in `src/components/`
- Static components are Astro `.astro` files in `src/components/`
- Quiz matching logic is in `src/lib/matching.ts` (pure functions, no React)
- Tailwind theme tokens use the `votescot-` prefix
- All candidate positions must include source URLs
```

- [ ] **Step 6: Verify the project builds**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "scaffold astro project with react and tailwind"
```

---

### Task 2: Create data layer (YAML files and types)

**Files:**
- Create: `data/candidates/angus-robertson.yaml`
- Create: `data/candidates/lorna-slater.yaml`
- Create: `data/candidates/james-dalgleish.yaml`
- Create: `data/candidates/jo-mowat.yaml`
- Create: `data/candidates/charles-dundas.yaml`
- Create: `data/constituencies/edinburgh-central.yaml`
- Create: `data/questions.yaml`
- Create: `data/resources.yaml`
- Create: `data/postcode-sectors.yaml`
- Create: `src/lib/data.ts`

- [ ] **Step 1: Create constituency data**

Create `data/constituencies/edinburgh-central.yaml`:

```yaml
id: "edinburgh-central"
name: "Edinburgh Central"
region: "Edinburgh and Lothians East"
boundaryYear: 2026
description: "Covers Old/New Towns, Princes Street, Haymarket, Murrayfield, Stockbridge, Dalry, Fountainbridge, Tollcross, and parts of the South Side."
context: "Three-way marginal. No candidate has ever won >40%. Greens projected for first constituency win."
```

- [ ] **Step 2: Create all five candidate YAML files**

Create `data/candidates/angus-robertson.yaml`:

```yaml
id: "robertson"
name: "Angus Robertson"
party: "Scottish National Party"
partyShort: "SNP"
color: "#FDF38E"
accent: "#9B870C"
textColor: "#333"
constituency: "edinburgh-central"
isIncumbent: true
bio: "MSP for Edinburgh Central since 2021. Cabinet Secretary for Culture and External Affairs. Former SNP Westminster leader (2001-2017). Led party through 2014 independence referendum."

positions:
  independence: 2
  nhs: 1
  housing: 1
  climate: 1
  tax: 1
  economy: 1
  education: 1
  equality: 2

stances:
  independence: "Core commitment. Independence referendum if SNP majority. 'Second vote delivers independence.'"
  nhs: "Continue current investment. Deliver National Care Service (delayed since 2021). Mental health focus."
  housing: "Continue rent control framework. Social housing investment. Maintain current approach."
  climate: "Net zero by 2045. Just transition fund. Active travel investment. (2030 interim targets were abandoned in 2024.)"
  tax: "Maintain progressive Scottish income tax. Currently generates ~£1bn more than rest-of-UK equivalent."
  economy: "Just transition from oil/gas. Protect free tuition. Creative industries investment (Robertson's portfolio)."
  education: "Protect free tuition. Maintain current education approach. National standards."
  equality: "Supported Gender Recognition Reform Bill (blocked by UK Gov). Progressive social policy."

highlights:
  - "Won seat from Ruth Davidson (Con) in 2021"
  - "Cabinet Secretary — Culture & External Affairs"
  - "Former SNP Westminster leader"
  - "No candidate has ever won >40% in this constituency"

sources:
  - url: "https://www.snp.org/people/angus-robertson/"
    type: "party_website"
  - url: "https://www.theyworkforyou.com/sp/?m=25625"
    type: "voting_record"
```

Create `data/candidates/lorna-slater.yaml`:

```yaml
id: "slater"
name: "Lorna Slater"
party: "Scottish Greens"
partyShort: "Green"
color: "#00A651"
accent: "#007A3D"
constituency: "edinburgh-central"
isIncumbent: false
bio: "Former Green co-leader and Minister (2021-2024). Delivered free bus travel for under-22s and rent controls. Ballot Box Scotland projects Greens could win here — would be first ever Green constituency MSP."

positions:
  independence: 2
  nhs: 2
  housing: 2
  climate: 2
  tax: 2
  economy: 2
  education: 1
  equality: 2

stances:
  independence: "Supports independence. Part of former Bute House Agreement. Also supports republic long-term."
  nhs: "Care workers £15/hr. Walk-in mental health centres. Scottish Child Payment to £40/wk (up from £28.20)."
  housing: "Strengthen rent controls (already delivered first version). Tackle landlord exploitation. Edinburgh rents a key focus."
  climate: "Most ambitious platform. Free bus travel for ALL. Public bus network. Higher taxes on polluters. End road expansion."
  tax: "Higher taxes on super-rich, big banks, Amazon warehouses, casinos/bookies. Fund public services through wealth."
  economy: "Four-day week pilot. Universal basic income exploration. Green jobs. Circular economy."
  education: "Expand funded childcare from 6 months. 43,000 more children covered. Biggest expansion in a generation."
  equality: "Strong advocate for trans rights. Progressive social policy. Anti-poverty focus."

highlights:
  - "First ever Green government minister in UK history"
  - "Delivered free bus travel for under-22s (930,000+ eligible)"
  - "Delivered rent control legislation"
  - "Deposit Return Scheme faced delays — controversial"
  - "Projected to potentially win Edinburgh Central"

sources:
  - url: "https://greens.scot/people/lorna-slater"
    type: "party_website"
  - url: "https://www.theyworkforyou.com/sp/?m=25808"
    type: "voting_record"
```

Create `data/candidates/james-dalgleish.yaml`:

```yaml
id: "dalgleish"
name: "James Dalgleish"
party: "Scottish Labour"
partyShort: "Labour"
color: "#DC241F"
accent: "#8B0000"
constituency: "edinburgh-central"
isIncumbent: false
bio: "Labour constituency candidate. New boundaries pull in areas from Edinburgh Southern (Labour territory), giving a realistic path to winning. Sarwar called for PM Starmer to resign (Feb 2026) — unusual Scottish-UK Labour tension."

positions:
  independence: 0
  nhs: 2
  housing: 1
  climate: 1
  tax: 0
  economy: 1
  education: 1
  equality: 1

stances:
  independence: "Oppose independence. Focus on making devolution work. MSP recall mechanism. Directly-elected mayors."
  nhs: "Declare national waiting times emergency. GP within 48hrs. 160,000 extra appointments/yr. Digital-first. Reduce health boards."
  housing: "End rough sleeping. Build more social housing. Help first-time buyers."
  climate: "Support net zero. GB Energy (publicly-owned clean power, HQ in Scotland). Green jobs."
  tax: "No increase to Scottish income tax rates. Growth-dependent strategy. Business rates reform."
  economy: "GB Energy. Planning reform. Ban zero-hour contracts. Dept of Government Efficiency."
  education: "Ban phones in classrooms. Close poverty-related attainment gap. Technology in schools."
  equality: "Progressive but more cautious on gender recognition than SNP/Greens. Anti-poverty focus."

highlights:
  - "New boundaries favour Labour in this seat"
  - "No Holyrood voting record — first-time candidate"
  - "Sarwar's split with Starmer creates UK-Scottish Labour tension"
  - "Edinburgh Central was Labour (Sarah Boyack) 1999-2011"

sources:
  - url: "https://scottishlabour.org.uk/"
    type: "party_website"
```

Create `data/candidates/jo-mowat.yaml`:

```yaml
id: "mowat"
name: "Jo Mowat"
party: "Scottish Conservatives"
partyShort: "Tory"
color: "#0087DC"
accent: "#005EA5"
constituency: "edinburgh-central"
isIncumbent: false
bio: "Edinburgh city councillor. Also 5th on Conservative regional list. Edinburgh Central was held by Ruth Davidson (Con) from 2016-2021. Party seeking to rebuild under Russell Findlay's 'common sense' platform."

positions:
  independence: 0
  nhs: 0
  housing: 0
  climate: 0
  tax: 0
  economy: 0
  education: 0
  equality: 0

stances:
  independence: "Strongest opposition to independence. Union first. No referendum under any circumstances."
  nhs: "Faster GP access. Better value for taxpayers. Reduce NHS bureaucracy."
  housing: "Market-led approach. Less regulation. Help homeowners."
  climate: "Scrap 2045 net zero target. 'Affordable Transition Fund' instead. Protect North Sea jobs."
  tax: "Cut income tax below rest-of-UK rates. Business rates overhaul — zero under £20k. Apprenticeship reform."
  economy: "Scottish 'Canary Wharf'. Cut red tape. Pro-business deregulation. Attract investment."
  education: "Raise school standards. Vocational routes with parity of esteem. Skills for work."
  equality: "More socially conservative. Opposed Gender Recognition Reform. Traditional values emphasis."

highlights:
  - "Edinburgh city councillor — local experience"
  - "Edinburgh Central was Conservative 2016-2021 under Ruth Davidson"
  - "Also on regional list (5th) — potential route via list"
  - "Party rebuilding under Russell Findlay"

sources:
  - url: "https://www.scottishconservatives.com/"
    type: "party_website"
```

Create `data/candidates/charles-dundas.yaml`:

```yaml
id: "dundas"
name: "Charles Dundas"
party: "Liberal Democrats"
partyShort: "Lib Dem"
color: "#FAA61A"
accent: "#B8860B"
constituency: "edinburgh-central"
isIncumbent: false
bio: "Lib Dem candidate. Party's Edinburgh focus is mainly on Northern and North Western seats. Edinburgh Central has been competitive for Lib Dems historically — they nearly won in 2007."

positions:
  independence: 0
  nhs: 1
  housing: 1
  climate: 1
  tax: 0
  economy: 1
  education: 1
  equality: 1

stances:
  independence: "Oppose independence. Support federalism — Scotland within a reformed UK structure."
  nhs: "Mental health specialists in every GP surgery. Social care reform. Cancer care prioritisation."
  housing: "Build affordable housing. Protect greenbelt. Balance development with environment."
  climate: "Net zero by 2045. New national parks. Sewage transparency reform. Rail decarbonisation."
  tax: "Personal allowance increases. No Scottish rate rises. Modest, targeted approach."
  economy: "Support SMEs. Budget negotiations track record (secured £178m rates relief). Pragmatic centrism."
  education: "Play-based learning. Mental health support in schools. University funding reform."
  equality: "Liberal approach. Individual rights focus. Moderate progressive position."

highlights:
  - "Lib Dems nearly won Edinburgh Central in 2007"
  - "Party focus is on Edinburgh Northern and North Western"
  - "Likely lower priority for Lib Dem campaign resources in Central"

sources:
  - url: "https://www.scotlibdems.org.uk/"
    type: "party_website"
```

- [ ] **Step 3: Create quiz questions data**

Create `data/questions.yaml`:

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

  - id: "nhs"
    area: "NHS & Health"
    question: "What's the best approach to fix the NHS?"
    options:
      - label: "Invest more, expand public services, raise care worker pay"
        value: 2
      - label: "Maintain current approach, incremental improvements"
        value: 1
      - label: "Reform and streamline — cut bureaucracy, better value for money"
        value: 0

  - id: "housing"
    area: "Housing"
    question: "How should Edinburgh's housing crisis be tackled?"
    options:
      - label: "Stronger rent controls and tenant protections"
        value: 2
      - label: "Build more social housing and help first-time buyers"
        value: 1
      - label: "Let the market work — less regulation, more incentives for developers"
        value: 0

  - id: "climate"
    area: "Climate & Transport"
    question: "How urgently should Scotland act on climate?"
    options:
      - label: "Emergency — free public transport, ban road expansion, tax polluters"
        value: 2
      - label: "Important but balanced — net zero by 2045, pragmatic steps"
        value: 1
      - label: "Affordability first — scrap unachievable targets, protect energy jobs"
        value: 0

  - id: "tax"
    area: "Tax & Public Spending"
    question: "What should Scotland do about tax?"
    options:
      - label: "Tax the wealthy more to fund public services"
        value: 2
      - label: "Keep current rates — they're working well enough"
        value: 1
      - label: "Cut taxes to boost growth and competitiveness"
        value: 0

  - id: "economy"
    area: "Economy & Jobs"
    question: "What economic approach appeals to you most?"
    options:
      - label: "Green economy — four-day week, UBI pilots, circular economy"
        value: 2
      - label: "Public investment — GB Energy, planning reform, infrastructure"
        value: 1
      - label: "Pro-business — cut red tape, lower taxes, attract investment"
        value: 0

  - id: "education"
    area: "Education & Childcare"
    question: "What's the top education priority?"
    options:
      - label: "Massively expand childcare — funded from 6 months"
        value: 2
      - label: "Close the poverty-related attainment gap in schools"
        value: 1
      - label: "Vocational training and skills for work"
        value: 0

  - id: "equality"
    area: "Social Issues"
    question: "Where do you stand on social and equality issues?"
    options:
      - label: "Progressive — strong trans rights, anti-poverty, systemic change"
        value: 2
      - label: "Moderate progressive — rights matter but pragmatic approach"
        value: 1
      - label: "Socially conservative — traditional values, less government intervention"
        value: 0
```

- [ ] **Step 4: Create resources data**

Create `data/resources.yaml`:

```yaml
sections:
  - title: "Who's going to win? — Projections"
    icon: "chart"
    items:
      - name: "Ballot Box Scotland — SP26 Hub"
        url: "https://ballotbox.scot/scottish-parliament/sp26-hub/"
        description: "The gold standard. Allan Faulds used 2022 machine-counted council data to project results on the new boundaries. This is where the 'Greens projected to win Edinburgh Central' analysis comes from."
      - name: "DevolvedElections.co.uk"
        url: "https://devolvedelections.co.uk/scotland/"
        description: "Interactive seat calculator. Input vote shares, see seat counts. Helps you understand how your two votes interact under D'Hondt."
      - name: "Wikipedia — Polling Tracker"
        url: "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Scottish_Parliament_election"
        description: "All polls from British Polling Council members in one place. Updated frequently."

  - title: "Can they pay for it? — Fiscal analysis"
    icon: "money"
    items:
      - name: "Fraser of Allander Institute"
        url: "https://fraserofallander.org/"
        description: "University-based economists who take each manifesto's spending/tax promises and check if the numbers add up. Watch this space as party manifestos drop in April."
      - name: "SPICe — Scottish Parliament Research"
        url: "https://spice-spotlight.scot/"
        description: "Parliament's own impartial analysts. Fact sheets, budget breakdowns, and boundary change explainers."

  - title: "Candidate research"
    icon: "search"
    items:
      - name: "WhoCanIVoteFor — Edinburgh Central"
        url: "https://whocanivotefor.co.uk/elections/sp.c.edinburgh-central.2026-05-07/edinburgh-central/"
        description: "All 5 candidates. Community-editable — policy statements get added during the campaign."
      - name: "TheyWorkForYou"
        url: "https://www.theyworkforyou.com/scotland/"
        description: "Actual voting records and speeches for sitting MSPs. Compare what Robertson and Slater voted for vs what they're promising now."
      - name: "The Public Whip"
        url: "https://www.publicwhip.org.uk/"
        description: "How often do MSPs rebel against their own party? Party alignment analysis."
      - name: "Election Leaflets"
        url: "https://electionleaflets.org/"
        description: "Upload photos of leaflets you receive. Helps everyone see what's being promised locally."

  - title: "Before you vote"
    icon: "check"
    items:
      - name: "Register to Vote"
        url: "https://www.gov.uk/register-to-vote"
        description: "Deadline: Monday 20 April 2026. Takes 5 minutes. You need your National Insurance number."
      - name: "Boundaries Scotland — Check Your Postcode"
        url: "https://boundaries.scot"
        description: "Confirm exactly which constituency you're in. Boundaries have changed — don't assume."
      - name: "Edinburgh Council — Election Info"
        url: "https://www.edinburgh.gov.uk/scottish-parliament-election-3/scottish-parliament-election-2026"
        description: "Your local polling station, postal vote details, and Edinburgh-specific information."
      - name: "Electoral Commission — How Voting Works"
        url: "https://www.electoralcommission.org.uk/news-and-views/media-centre/scottish-parliament-election-2026-media-guide"
        description: "How AMS and D'Hondt work. Two ballot papers explained. Spending rules."

  - title: "Open data & APIs"
    icon: "data"
    items:
      - name: "Scottish Parliament Open Data"
        url: "https://data.parliament.scot/"
        description: "Raw APIs: divisions, motions, members, bills. JSON. Free."
      - name: "TheyWorkForYou API"
        url: "https://www.theyworkforyou.com/api/"
        description: "Programmatic access to parliamentary data."
```

- [ ] **Step 5: Create postcode sectors data**

Create `data/postcode-sectors.yaml`:

```yaml
# Postcode sectors mapping to Edinburgh Central constituency
# Source: Boundaries Scotland 2026 boundary review
# Note: This is an initial mapping based on known boundary areas.
# Full mapping requires cross-referencing NRS postcode index with GIS boundary data.
edinburgh-central:
  - "EH1 1"
  - "EH1 2"
  - "EH1 3"
  - "EH2 1"
  - "EH2 2"
  - "EH2 3"
  - "EH2 4"
  - "EH3 5"
  - "EH3 6"
  - "EH3 7"
  - "EH3 8"
  - "EH3 9"
  - "EH4 1"
  - "EH7 4"
  - "EH7 5"
  - "EH8 8"
  - "EH8 9"
  - "EH11 1"
  - "EH11 2"
  - "EH12 5"
```

- [ ] **Step 6: Create TypeScript data loader and types**

Create `src/lib/data.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

export interface CandidatePosition {
  independence: number;
  nhs: number;
  housing: number;
  climate: number;
  tax: number;
  economy: number;
  education: number;
  equality: number;
}

export interface CandidateSource {
  url: string;
  type: string;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  partyShort: string;
  color: string;
  accent: string;
  textColor?: string;
  constituency: string;
  isIncumbent: boolean;
  bio: string;
  positions: CandidatePosition;
  stances: Record<string, string>;
  highlights: string[];
  sources: CandidateSource[];
}

export interface Constituency {
  id: string;
  name: string;
  region: string;
  boundaryYear: number;
  description: string;
  context: string;
}

export interface QuizOption {
  label: string;
  value: number;
}

export interface QuizQuestion {
  id: string;
  area: string;
  question: string;
  options: QuizOption[];
}

export interface ResourceItem {
  name: string;
  url: string;
  description: string;
}

export interface ResourceSection {
  title: string;
  icon: string;
  items: ResourceItem[];
}

function loadYaml<T>(filePath: string): T {
  const fullPath = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  return yaml.parse(content) as T;
}

export function loadCandidates(): Candidate[] {
  const dir = path.resolve(process.cwd(), "data/candidates");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => loadYaml<Candidate>(path.join("data/candidates", f)));
}

export function loadConstituency(id: string): Constituency {
  return loadYaml<Constituency>(`data/constituencies/${id}.yaml`);
}

export function loadQuestions(): QuizQuestion[] {
  const data = loadYaml<{ questions: QuizQuestion[] }>("data/questions.yaml");
  return data.questions;
}

export function loadResources(): ResourceSection[] {
  const data = loadYaml<{ sections: ResourceSection[] }>("data/resources.yaml");
  return data.sections;
}

export function loadPostcodeSectors(): Record<string, string[]> {
  return loadYaml<Record<string, string[]>>("data/postcode-sectors.yaml");
}
```

- [ ] **Step 7: Install yaml package**

```bash
npm install yaml
```

- [ ] **Step 8: Commit**

```bash
git add data/ src/lib/data.ts
git commit -m "add data layer: candidates, questions, resources, constituency yaml"
```

---

### Task 3: Matching algorithm with tests

**Files:**
- Create: `src/lib/matching.ts`
- Create: `tests/matching.test.ts`

- [ ] **Step 1: Write failing tests for matching algorithm**

Install test runner:

```bash
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

Create `tests/matching.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateMatch, type MatchResult } from "../src/lib/matching";

const mockPositions = {
  independence: 2,
  nhs: 2,
  housing: 1,
  climate: 2,
  tax: 0,
  economy: 1,
  education: 1,
  equality: 2,
};

describe("calculateMatch", () => {
  it("returns 100% when all answers match exactly", () => {
    const answers = { independence: 2, nhs: 2, housing: 1 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(100);
  });

  it("returns 0% when all answers are maximum distance", () => {
    const answers = { independence: 0, nhs: 0, equality: 0 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(0);
  });

  it("returns 50% for all partial matches (diff of 1)", () => {
    const answers = { independence: 1, nhs: 1, equality: 1 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(50);
  });

  it("returns 0% with no answers", () => {
    const result = calculateMatch({}, mockPositions);
    expect(result.percentage).toBe(0);
  });

  it("calculates mixed match correctly", () => {
    // exact (100) + partial (50) + none (0) = 150/3 = 50
    const answers = { independence: 2, housing: 2, tax: 2 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.percentage).toBe(50);
  });

  it("returns per-issue breakdown", () => {
    const answers = { independence: 2, nhs: 0, housing: 1 };
    const result = calculateMatch(answers, mockPositions);
    expect(result.breakdown).toEqual([
      { questionId: "independence", diff: 0 },
      { questionId: "nhs", diff: 2 },
      { questionId: "housing", diff: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — module `../src/lib/matching` not found.

- [ ] **Step 3: Implement matching algorithm**

Create `src/lib/matching.ts`:

```typescript
export interface MatchBreakdown {
  questionId: string;
  diff: number;
}

export interface MatchResult {
  percentage: number;
  breakdown: MatchBreakdown[];
}

export function calculateMatch(
  answers: Record<string, number>,
  positions: Record<string, number>,
): MatchResult {
  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return { percentage: 0, breakdown: [] };
  }

  const breakdown: MatchBreakdown[] = [];
  let total = 0;

  for (const [questionId, value] of entries) {
    const candidateValue = positions[questionId];
    if (candidateValue === undefined) continue;
    const diff = Math.abs(value - candidateValue);
    breakdown.push({ questionId, diff });
    total += diff === 0 ? 100 : diff === 1 ? 50 : 0;
  }

  const percentage = breakdown.length > 0 ? Math.round(total / breakdown.length) : 0;
  return { percentage, breakdown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matching.ts tests/matching.test.ts vitest.config.ts package.json package-lock.json
git commit -m "add quiz matching algorithm with tests"
```

---

### Task 4: Base layout and static components

**Files:**
- Create: `src/layouts/Base.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create Base layout**

Create `src/layouts/Base.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description = "Open-source vote compass for the 2026 Scottish Parliament election" } = Astro.props;
const base = import.meta.env.BASE_URL;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title} | VoteScot</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700;800;900&family=Source+Sans+3:wght@400;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-votescot-paper text-gray-900 font-body min-h-screen flex flex-col">
    <slot name="header" />
    <main class="max-w-[920px] mx-auto w-full px-3 flex-1">
      <slot />
    </main>
    <slot name="footer" />
  </body>
</html>

<style is:global>
  @import "../styles/global.css";
</style>
```

- [ ] **Step 2: Create Header component**

Create `src/components/Header.astro`:

```astro
---
interface Props {
  constituency?: string;
  postcode?: string;
  currentTab?: string;
}

const { constituency = "Edinburgh Central", postcode = "EH12 5NR", currentTab } = Astro.props;
const base = import.meta.env.BASE_URL;

const tabs = [
  { id: "quiz", label: "Quiz", href: `${base}quiz` },
  { id: "candidates", label: "Candidates", href: `${base}candidates` },
  { id: "compare", label: "Compare", href: `${base}compare` },
  { id: "resources", label: "Resources", href: `${base}resources` },
];
---

<header class="bg-votescot-dark text-votescot-paper border-b-[3px] border-votescot-gold px-4 pt-3.5 pb-3">
  <div class="max-w-[920px] mx-auto">
    <div class="flex items-center gap-2">
      <span class="text-lg">🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
      <div>
        <h1 class="text-lg font-heading font-black tracking-tight m-0">Scottish Election Helper</h1>
        <div class="font-body text-[9.5px] text-votescot-gold tracking-widest uppercase font-bold">
          Find your candidate &bull; 7 May 2026
        </div>
      </div>
    </div>
    <div class="bg-white/[0.08] rounded-md px-3 py-1.5 mt-2 font-body text-[11.5px] leading-snug text-gray-300">
      <strong class="text-votescot-gold">{constituency}</strong> — Verified for {postcode} (Roseburn)
      <br />
      <span class="text-gray-500 text-[10.5px]">
        Three-way marginal: SNP (incumbent) vs Green (projected to win) vs Labour &bull; 5 candidates confirmed
      </span>
    </div>
  </div>
</header>

<nav class="max-w-[920px] mx-auto w-full px-3">
  <div class="flex gap-0 border-b-2 border-gray-300 mt-2 overflow-x-auto">
    {tabs.map((tab) => (
      <a
        href={tab.href}
        class:list={[
          "shrink-0 px-3.5 py-2 font-body text-xs font-medium uppercase tracking-wider -mb-[2px] no-underline",
          currentTab === tab.id
            ? "border-b-[3px] border-votescot-gold text-gray-900 font-bold"
            : "border-b-[3px] border-transparent text-gray-400 hover:text-gray-600",
        ]}
      >
        {tab.label}
      </a>
    ))}
  </div>
</nav>
```

- [ ] **Step 3: Create Footer component**

Create `src/components/Footer.astro`:

```astro
<footer class="max-w-[920px] mx-auto w-full px-3 py-3.5 mt-3.5 border-t border-gray-300 text-center font-body text-[9.5px] text-gray-400 leading-snug">
  <div>Edinburgh Central &bull; Data from public sources as of April 2026</div>
  <div>Quiz matches are based on stated policy positions. Open source — contributions welcome.</div>
  <div class="mt-0.5 font-bold">This tool does not endorse any candidate or party</div>
</footer>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/ src/components/Header.astro src/components/Footer.astro
git commit -m "add base layout, header, and footer components"
```

---

### Task 5: Landing page and postcode lookup

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/components/PostcodeLookup.tsx`

- [ ] **Step 1: Create PostcodeLookup React component**

Create `src/components/PostcodeLookup.tsx`:

```tsx
import { useState } from "react";

interface Props {
  postcodeSectors: Record<string, string[]>;
  basePath: string;
}

export default function PostcodeLookup({ postcodeSectors, basePath }: Props) {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<{ found: boolean; constituency?: string } | null>(null);

  function normalise(pc: string): string {
    return pc.toUpperCase().replace(/\s+/g, " ").trim();
  }

  function extractSector(pc: string): string {
    const clean = normalise(pc).replace(/\s/g, "");
    if (clean.length < 5) return clean;
    // UK postcodes: outward code (2-4 chars) + space + inward code (3 chars)
    // Sector = outward + first digit of inward
    const inward = clean.slice(-3);
    const outward = clean.slice(0, -3);
    return `${outward} ${inward[0]}`;
  }

  function lookup() {
    const sector = extractSector(postcode);
    for (const [constituencyId, sectors] of Object.entries(postcodeSectors)) {
      if (sectors.includes(sector)) {
        setResult({ found: true, constituency: constituencyId });
        return;
      }
    }
    setResult({ found: false });
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-votescot-border">
      <label className="block font-heading font-bold text-base mb-2">
        Enter your postcode
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={postcode}
          onChange={(e) => { setPostcode(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="e.g. EH12 5NR"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-body text-sm focus:outline-none focus:border-votescot-gold"
        />
        <button
          onClick={lookup}
          className="px-4 py-2 bg-votescot-dark text-white rounded-md font-body text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          Find
        </button>
      </div>
      {result?.found && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md font-body text-sm">
          You're in <strong>Edinburgh Central</strong>!{" "}
          <a href={`${basePath}quiz`} className="text-blue-600 underline font-semibold">
            Take the vote compass →
          </a>
        </div>
      )}
      {result && !result.found && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md font-body text-sm">
          We don't have data for your constituency yet. We're starting with Edinburgh Central and expanding.
          Check <a href="https://boundaries.scot" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Boundaries Scotland</a> to find your constituency.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create landing page**

Create `src/pages/index.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import PostcodeLookup from "../components/PostcodeLookup.tsx";
import { loadPostcodeSectors, loadConstituency } from "../lib/data";

const postcodeSectors = loadPostcodeSectors();
const constituency = loadConstituency("edinburgh-central");
const base = import.meta.env.BASE_URL;
---

<Base title="Home">
  <Header slot="header" currentTab="home" />

  <div class="py-6">
    <h2 class="font-heading text-2xl font-black mb-2">Navigate the noise</h2>
    <p class="font-body text-sm text-gray-600 leading-relaxed mb-6">
      Scotland votes on 7 May 2026. This tool helps you find your constituency, discover which
      candidates align with your values, and access the research you need to make an informed choice.
      No endorsements. No editorial scores. Just your values matched to their positions.
    </p>

    <PostcodeLookup client:load postcodeSectors={postcodeSectors} basePath={base} />

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
      <a href={`${base}quiz`} class="bg-white rounded-lg p-4 border border-votescot-border hover:border-votescot-gold transition-colors no-underline text-inherit">
        <div class="font-heading font-bold text-base mb-1">Vote Compass</div>
        <div class="font-body text-xs text-gray-500">8 questions. Find your closest candidate match.</div>
      </a>
      <a href={`${base}candidates`} class="bg-white rounded-lg p-4 border border-votescot-border hover:border-votescot-gold transition-colors no-underline text-inherit">
        <div class="font-heading font-bold text-base mb-1">Candidates</div>
        <div class="font-body text-xs text-gray-500">Profiles, policies, and track records.</div>
      </a>
      <a href={`${base}resources`} class="bg-white rounded-lg p-4 border border-votescot-border hover:border-votescot-gold transition-colors no-underline text-inherit">
        <div class="font-heading font-bold text-base mb-1">Research Hub</div>
        <div class="font-body text-xs text-gray-500">Projections, fiscal analysis, and voter info.</div>
      </a>
    </div>

    <div class="mt-6 p-3 bg-votescot-dark rounded-lg font-body text-xs text-gray-300 leading-relaxed text-center">
      <strong class="text-votescot-gold">Privacy-first:</strong> This quiz runs entirely in your browser.
      No data is stored. No cookies. No tracking. No accounts.
    </div>
  </div>

  <Footer slot="footer" />
</Base>
```

- [ ] **Step 3: Verify dev server**

```bash
npm run dev
```

Open `http://localhost:4321/votescot/` in a browser. Expected: landing page with postcode lookup, three navigation cards, privacy notice.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/components/PostcodeLookup.tsx
git commit -m "add landing page with postcode lookup"
```

---

### Task 6: Quiz page with QuizEngine

**Files:**
- Create: `src/pages/quiz.astro`
- Create: `src/components/QuizEngine.tsx`

- [ ] **Step 1: Create QuizEngine React component**

This is the core interactive component, decomposed from the prototype's quiz tab and results tab.

Create `src/components/QuizEngine.tsx`:

```tsx
import { useState } from "react";
import { calculateMatch } from "../lib/matching";
import type { Candidate, QuizQuestion } from "../lib/data";

interface Props {
  questions: QuizQuestion[];
  candidates: Candidate[];
  basePath: string;
}

export default function QuizEngine({ questions, candidates, basePath }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const answeredCount = Object.keys(answers).length;

  const ranked = candidates
    .map((c) => ({
      ...c,
      match: calculateMatch(answers, c.positions),
    }))
    .sort((a, b) => b.match.percentage - a.match.percentage);

  if (showResults) {
    return (
      <div className="py-3.5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
          <h2 className="font-heading text-lg font-black m-0">Your Matches</h2>
          <button
            onClick={() => { setShowResults(false); setAnswers({}); }}
            className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-[11px] text-gray-400 cursor-pointer"
          >
            Reset quiz
          </button>
        </div>
        <p className="font-body text-xs text-gray-400 mb-4">
          Based on {answeredCount} of {questions.length} questions answered. The more you answer, the better the match.
        </p>

        <div className="flex flex-col gap-2">
          {ranked.map((cand, i) => (
            <div
              key={cand.id}
              className="bg-white rounded-lg p-3.5 border"
              style={{
                borderWidth: i === 0 ? 2 : 1,
                borderColor: i === 0 ? (cand.accent || cand.color) : "#e8e4df",
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {i === 0 && <span className="text-base">🏆</span>}
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: cand.color, border: `2px solid ${cand.accent}` }}
                  />
                  <div>
                    <span className="font-heading font-black text-sm">{cand.name}</span>
                    <span className="font-body text-[11px] text-gray-400 ml-1.5">{cand.party}</span>
                  </div>
                </div>
                <div
                  className="font-body text-xl font-black"
                  style={{
                    color:
                      cand.match.percentage >= 70
                        ? "#2d8a4e"
                        : cand.match.percentage >= 40
                          ? "#c4940a"
                          : "#c0392b",
                  }}
                >
                  {cand.match.percentage}%
                </div>
              </div>

              <div className="w-full h-1.5 bg-votescot-border rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${cand.match.percentage}%`,
                    background:
                      cand.match.percentage >= 70
                        ? "#2d8a4e"
                        : cand.match.percentage >= 40
                          ? "#c4940a"
                          : "#c0392b",
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {cand.match.breakdown.map(({ questionId, diff }) => {
                  const q = questions.find((q) => q.id === questionId);
                  return (
                    <span
                      key={questionId}
                      className="font-body text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: diff === 0 ? "#e8f5e9" : diff === 1 ? "#fff8e1" : "#fce4ec",
                        color: diff === 0 ? "#2d8a4e" : diff === 1 ? "#c4940a" : "#c0392b",
                      }}
                    >
                      {diff === 0 ? "✓" : diff === 1 ? "~" : "✗"} {q?.area}
                    </span>
                  );
                })}
              </div>

              <p className="font-body text-xs text-gray-500 leading-snug">{cand.bio}</p>
              <a
                href={`${basePath}candidates/${cand.id}`}
                className="inline-block mt-2 bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-[11px] text-gray-500 no-underline hover:border-gray-400"
              >
                View full profile →
              </a>
            </div>
          ))}
        </div>

        <div className="mt-3.5 p-3 bg-votescot-dark rounded-lg font-body text-xs text-gray-300 leading-relaxed text-center">
          This is a starting point, not a verdict. Explore the{" "}
          <a href={`${basePath}candidates`} className="text-votescot-gold">candidate profiles</a> and{" "}
          <a href={`${basePath}resources`} className="text-votescot-gold">independent resources</a> to dig deeper.
        </div>
      </div>
    );
  }

  return (
    <div className="py-3.5">
      <h2 className="font-heading text-lg font-black mb-1">Vote Compass</h2>
      <p className="font-body text-[12.5px] text-gray-500 leading-snug mb-4">
        Answer 8 questions about what matters to you. We'll match you to the candidate closest to your
        views. No data is stored — this runs entirely in your browser.
      </p>

      <div className="flex flex-col gap-3">
        {questions.map((q, qi) => (
          <div
            key={q.id}
            className="bg-white rounded-lg p-3.5"
            style={{
              border: answers[q.id] !== undefined ? "2px solid #c4940a" : "1px solid #e8e4df",
            }}
          >
            <div className="font-body text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              {qi + 1}/{questions.length} &bull; {q.area}
            </div>
            <div className="font-heading text-[15px] font-bold mb-2.5 leading-tight">{q.question}</div>
            <div className="flex flex-col gap-1.5">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                  className="text-left rounded-md px-3 py-2 cursor-pointer font-body text-[13px] leading-snug transition-all"
                  style={{
                    background: answers[q.id] === opt.value ? "#1a1a2e" : "#faf8f5",
                    color: answers[q.id] === opt.value ? "#fff" : "#444",
                    border: answers[q.id] === opt.value ? "2px solid #1a1a2e" : "1px solid #ddd",
                    fontWeight: answers[q.id] === opt.value ? 700 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowResults(true)}
        disabled={answeredCount < 3}
        className="mt-4 w-full py-3.5 border-none rounded-lg font-body text-sm font-black tracking-wide transition-colors"
        style={{
          background: answeredCount >= 3 ? "#c4940a" : "#ddd",
          color: answeredCount >= 3 ? "#fff" : "#999",
          cursor: answeredCount >= 3 ? "pointer" : "not-allowed",
        }}
      >
        {answeredCount < 3
          ? `Answer at least 3 questions (${answeredCount}/${questions.length})`
          : `See my matches (${answeredCount}/${questions.length} answered)`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create quiz page**

Create `src/pages/quiz.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import QuizEngine from "../components/QuizEngine.tsx";
import { loadCandidates, loadQuestions } from "../lib/data";

const questions = loadQuestions();
const candidates = loadCandidates();
const base = import.meta.env.BASE_URL;
---

<Base title="Vote Compass" description="Answer 8 questions and find which Edinburgh Central candidate aligns with your values">
  <Header slot="header" currentTab="quiz" />
  <QuizEngine client:load questions={questions} candidates={candidates} basePath={base} />
  <Footer slot="footer" />
</Base>
```

- [ ] **Step 3: Verify in dev server**

```bash
npm run dev
```

Navigate to `http://localhost:4321/votescot/quiz`. Expected: quiz with 8 questions, answer 3+, click "See my matches", see ranked candidates with per-issue breakdown.

- [ ] **Step 4: Commit**

```bash
git add src/pages/quiz.astro src/components/QuizEngine.tsx
git commit -m "add vote compass quiz with matching engine"
```

---

### Task 7: Candidate pages

**Files:**
- Create: `src/pages/candidates/index.astro`
- Create: `src/pages/candidates/[id].astro`
- Create: `src/components/CandidateCard.astro`

- [ ] **Step 1: Create CandidateCard component**

Create `src/components/CandidateCard.astro`:

```astro
---
import type { Candidate } from "../lib/data";

interface Props {
  candidate: Candidate;
  basePath: string;
}

const { candidate, basePath } = Astro.props;
---

<a href={`${basePath}candidates/${candidate.id}`} class="block bg-white rounded-lg p-3 border border-votescot-border hover:border-votescot-gold transition-colors no-underline text-inherit relative">
  {candidate.isIncumbent && (
    <span class="absolute -top-1.5 right-2 bg-gray-800 text-white text-[7px] px-1 py-0.5 rounded-md tracking-wider uppercase font-bold">
      Incumbent
    </span>
  )}
  <div class="flex items-center gap-2 mb-1">
    <div class="w-2.5 h-2.5 rounded-full shrink-0" style={`background: ${candidate.color}; border: 2px solid ${candidate.accent}`} />
    <div>
      <div class="font-heading font-black text-sm">{candidate.name}</div>
      <div class="font-body text-[10px] text-gray-400">{candidate.party}</div>
    </div>
  </div>
  <p class="font-body text-[11.5px] text-gray-500 leading-snug line-clamp-2 m-0">{candidate.bio}</p>
</a>
```

- [ ] **Step 2: Create candidates index page**

Create `src/pages/candidates/index.astro`:

```astro
---
import Base from "../../layouts/Base.astro";
import Header from "../../components/Header.astro";
import Footer from "../../components/Footer.astro";
import CandidateCard from "../../components/CandidateCard.astro";
import { loadCandidates } from "../../lib/data";

const candidates = loadCandidates();
const base = import.meta.env.BASE_URL;
---

<Base title="Candidates" description="All candidates standing in Edinburgh Central for the 2026 Scottish Parliament election">
  <Header slot="header" currentTab="candidates" />

  <div class="py-3.5">
    <h2 class="font-heading text-lg font-black mb-1">Edinburgh Central Candidates</h2>
    <p class="font-body text-[12.5px] text-gray-500 leading-snug mb-4">
      5 candidates confirmed for the 7 May 2026 election. Click any candidate for their full profile.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {candidates.map((c) => (
        <CandidateCard candidate={c} basePath={base} />
      ))}
    </div>
  </div>

  <Footer slot="footer" />
</Base>
```

- [ ] **Step 3: Create dynamic candidate page**

Create `src/pages/candidates/[id].astro`:

```astro
---
import Base from "../../layouts/Base.astro";
import Header from "../../components/Header.astro";
import Footer from "../../components/Footer.astro";
import DeepDive from "../../components/DeepDive.tsx";
import { loadCandidates, loadQuestions } from "../../lib/data";

export function getStaticPaths() {
  const candidates = loadCandidates();
  return candidates.map((c) => ({ params: { id: c.id }, props: { candidate: c } }));
}

const { candidate } = Astro.props;
const questions = loadQuestions();
---

<Base title={candidate.name} description={`${candidate.name} (${candidate.party}) — Edinburgh Central candidate profile`}>
  <Header slot="header" currentTab="candidates" />

  <div class="py-3.5">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-3 h-3 rounded-full" style={`background: ${candidate.color}; border: 2px solid ${candidate.accent}`} />
      <h2 class="font-heading text-lg font-black m-0">
        {candidate.name}
        <span class="font-normal text-gray-400 text-[12.5px] ml-1">{candidate.party}</span>
      </h2>
    </div>

    <div
      class="font-body text-[12.5px] text-gray-500 leading-snug mb-3.5 p-2.5 bg-white rounded"
      style={`border-left: 3px solid ${candidate.accent || candidate.color}`}
    >
      {candidate.bio}
    </div>

    <h3 class="font-body text-[13px] font-black uppercase tracking-wider text-gray-500 mb-2">
      Policy Positions
    </h3>
    <div class="flex flex-col gap-1.5">
      {Object.entries(candidate.stances).map(([key, stance]) => {
        const q = questions.find((q) => q.id === key);
        return (
          <div class="bg-white rounded-md p-2.5 border border-votescot-border">
            <div class="font-body text-[10px] font-bold uppercase tracking-widest mb-0.5" style={`color: ${candidate.accent || candidate.color}`}>
              {q?.area || key}
            </div>
            <div class="font-body text-[13px] text-gray-700 leading-snug">{stance}</div>
          </div>
        );
      })}
    </div>

    <h3 class="font-body text-[13px] font-black uppercase tracking-wider text-gray-500 mt-4 mb-2">
      Track Record
    </h3>
    <div class="flex flex-col gap-1">
      {candidate.highlights.map((h) => (
        <div class="bg-white rounded p-2 border border-votescot-border font-body text-[12.5px] leading-snug text-gray-600 flex gap-2 items-center">
          <span class="font-black text-[13px]" style={`color: ${candidate.accent || candidate.color}`}>›</span>
          {h}
        </div>
      ))}
    </div>

    {candidate.sources && candidate.sources.length > 0 && (
      <>
        <h3 class="font-body text-[13px] font-black uppercase tracking-wider text-gray-500 mt-4 mb-2">
          Sources
        </h3>
        <div class="flex flex-wrap gap-1.5">
          {candidate.sources.map((s) => (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              class="font-body text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded no-underline hover:bg-blue-100"
            >
              {s.type.replace("_", " ")}
            </a>
          ))}
        </div>
      </>
    )}

    <div class="mt-6 text-center">
      <details class="inline-block text-left">
        <summary class="font-body text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">
          Advanced: AI analysis (requires API key)
        </summary>
        <div class="mt-2">
          <DeepDive client:only="react" candidate={candidate} />
        </div>
      </details>
    </div>
  </div>

  <Footer slot="footer" />
</Base>
```

- [ ] **Step 4: Verify in dev server**

```bash
npm run dev
```

Navigate to `http://localhost:4321/votescot/candidates` — should show grid of 5 candidates. Click one — should show full profile with stances, highlights, sources. Deep dive link should be tucked in a `<details>` at the bottom.

- [ ] **Step 5: Commit**

```bash
git add src/pages/candidates/ src/components/CandidateCard.astro
git commit -m "add candidate grid and individual candidate pages"
```

---

### Task 8: Deep dive component (BYOK)

**Files:**
- Create: `src/components/DeepDive.tsx`

- [ ] **Step 1: Create DeepDive React component**

Create `src/components/DeepDive.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";

interface Candidate {
  id: string;
  name: string;
  party: string;
  color: string;
  accent: string;
}

interface Props {
  candidate: Candidate;
}

export default function DeepDive({ candidate }: Props) {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("votescot-api-key") || "";
    }
    return "";
  });
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function runAnalysis() {
    if (!apiKey.trim()) {
      setError("Please enter your Anthropic API key.");
      return;
    }

    sessionStorage.setItem("votescot-api-key", apiKey);
    setLoading(true);
    setError(null);
    setAnalysis("");
    abortRef.current = new AbortController();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a neutral political analyst for Edinburgh Central in the 2026 Scottish Parliament election — a historic three-way marginal (SNP vs Green vs Labour). Analyse ${candidate.name} (${candidate.party}). Cover: 1) What they actually stand for — key policies and values. 2) Track record — what have they delivered or failed to deliver? 3) Strengths and weaknesses as a candidate. 4) 3 specific questions a voter should ask at a hustings. Be balanced and factual. ~350 words. Use ** for section headers.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(
        data.content?.map((block: { text?: string }) => block.text || "").join("\n") ||
          "No analysis available.",
      );
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message || "Analysis unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  function formatAnalysis(text: string) {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (/^\*\*.*\*\*$/.test(trimmed)) {
        return (
          <h4 key={i} className="font-body font-black text-[13.5px] text-gray-800 mt-3 mb-1">
            {trimmed.replace(/\*\*/g, "")}
          </h4>
        );
      }
      if (trimmed === "") return <br key={i} />;
      if (line.includes("**")) {
        const parts = line.split("**");
        return (
          <p key={i} className="font-body text-[13px] text-gray-700 leading-snug my-0.5">
            {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
          </p>
        );
      }
      return (
        <p key={i} className="font-body text-[13px] text-gray-700 leading-snug my-0.5">
          {line}
        </p>
      );
    });
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-votescot-border max-w-xl">
      <div className="font-body text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
        AI analysis via Claude &bull; Not a recommendation &bull; Your key stays in this tab only
      </div>

      {!analysis && !loading && (
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
            placeholder="sk-ant-..."
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded font-body text-xs focus:outline-none focus:border-votescot-gold"
          />
          <button
            onClick={runAnalysis}
            className="px-3 py-1.5 bg-votescot-dark text-white rounded font-body text-xs font-bold hover:bg-gray-800"
          >
            Analyse
          </button>
        </div>
      )}

      {loading && (
        <div className="py-6 text-center font-body text-[13px] text-gray-500">
          Analysing {candidate.name}...
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded font-body text-xs text-red-700">
          {error}
        </div>
      )}

      {analysis && <div className="mt-2">{formatAnalysis(analysis)}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verify in dev server**

Navigate to a candidate page, expand the "Advanced: AI analysis" details at the bottom. Expected: API key input field and analyse button. Without a valid key, should show an error. With a valid key, should show analysis.

- [ ] **Step 3: Commit**

```bash
git add src/components/DeepDive.tsx
git commit -m "add optional BYOK deep dive analysis component"
```

---

### Task 9: Comparison page

**Files:**
- Create: `src/components/CandidateComparison.tsx`
- Create: `src/pages/compare.astro`

- [ ] **Step 1: Create CandidateComparison React component**

Create `src/components/CandidateComparison.tsx`:

```tsx
import type { Candidate, QuizQuestion } from "../lib/data";

interface Props {
  candidates: Candidate[];
  questions: QuizQuestion[];
}

export default function CandidateComparison({ candidates, questions }: Props) {
  return (
    <div className="py-3.5">
      <h2 className="font-heading text-base font-black mb-1">Side-by-Side Comparison</h2>
      <p className="font-body text-[11.5px] text-gray-400 mb-3">
        What each candidate actually stands for on each issue
      </p>

      <div className="overflow-x-auto">
        {questions.map((q) => (
          <div key={q.id} className="mb-3">
            <div className="font-body text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5 px-1">
              {q.area}
            </div>
            <div className="flex flex-col gap-1">
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  className="bg-white rounded p-2 border border-votescot-border flex gap-2 items-start"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0 mt-1"
                    style={{ background: cand.color, border: `1.5px solid ${cand.accent}` }}
                  />
                  <div>
                    <span className="font-body text-[11px] font-bold text-gray-600">
                      {cand.partyShort}:{" "}
                    </span>
                    <span className="font-body text-xs text-gray-500 leading-snug">
                      {cand.stances[q.id]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create comparison page**

Create `src/pages/compare.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import CandidateComparison from "../components/CandidateComparison.tsx";
import { loadCandidates, loadQuestions } from "../lib/data";

const candidates = loadCandidates();
const questions = loadQuestions();
---

<Base title="Compare Candidates" description="Compare all Edinburgh Central candidates side-by-side on every issue">
  <Header slot="header" currentTab="compare" />
  <CandidateComparison client:load candidates={candidates} questions={questions} />
  <Footer slot="footer" />
</Base>
```

- [ ] **Step 3: Verify in dev server**

Navigate to `http://localhost:4321/votescot/compare`. Expected: all 8 policy areas with all 5 candidates' stances shown under each.

- [ ] **Step 4: Commit**

```bash
git add src/pages/compare.astro src/components/CandidateComparison.tsx
git commit -m "add side-by-side candidate comparison page"
```

---

### Task 10: Resources page

**Files:**
- Create: `src/pages/resources.astro`

- [ ] **Step 1: Create resources page**

Create `src/pages/resources.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import { loadResources } from "../lib/data";

const sections = loadResources();
---

<Base title="Research Hub" description="Curated resources for the 2026 Scottish Parliament election">
  <Header slot="header" currentTab="resources" />

  <div class="py-3.5">
    <h2 class="font-heading text-base font-black mb-1">Research Hub</h2>
    <p class="font-body text-[12.5px] text-gray-500 leading-snug mb-4">
      Three tools cover the full picture: this quiz tells you <strong>who aligns with your values</strong>,
      Ballot Box Scotland tells you <strong>who's likely to win</strong>, and Fraser of Allander tells you
      <strong>whether the promises are funded</strong>.
    </p>

    {sections.map((section, si) => (
      <div class:list={["mb-3.5", si === 0 ? "" : "mt-1"]}>
        <h3 class="font-body text-[13px] font-black text-gray-700 mb-2">{section.title}</h3>
        <div class="flex flex-col gap-1.5">
          {section.items.map((item) => (
            <a href={item.url} target="_blank" rel="noopener noreferrer" class="block no-underline text-inherit">
              <div class="bg-white rounded-md p-2.5 border border-votescot-border hover:border-votescot-gold transition-colors">
                <div class="flex items-center justify-between mb-0.5">
                  <span class="font-body text-[13px] font-bold text-blue-600">{item.name}</span>
                  <span class="font-body text-[10px] text-gray-300">↗</span>
                </div>
                <div class="font-body text-[11.5px] text-gray-500 leading-snug">{item.description}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    ))}

    <div class="mt-2.5 p-2.5 bg-white rounded border border-votescot-border">
      <div class="font-body text-[9.5px] font-bold uppercase tracking-widest text-gray-400 mb-1">Key dates</div>
      <div class="font-body text-xs text-gray-600 leading-relaxed">
        <strong>2 Apr</strong> Official candidates &bull;
        <strong>9 Apr</strong> Dissolution &bull;
        <strong>20 Apr</strong> Register deadline &bull;
        <strong>21 Apr</strong> Postal vote deadline &bull;
        <strong>7 May</strong> Polling day 7am–10pm &bull;
        <strong>8 May</strong> Count
      </div>
    </div>
  </div>

  <Footer slot="footer" />
</Base>
```

- [ ] **Step 2: Verify in dev server**

Navigate to `http://localhost:4321/votescot/resources`. Expected: all 5 resource sections with clickable links and key dates.

- [ ] **Step 3: Commit**

```bash
git add src/pages/resources.astro
git commit -m "add research hub resources page"
```

---

### Task 11: Data validation and schemas

**Files:**
- Create: `schemas/candidate.schema.json`
- Create: `schemas/constituency.schema.json`
- Create: `schemas/questions.schema.json`
- Create: `scripts/validate-data.ts`
- Create: `tests/validate-data.test.ts`

- [ ] **Step 1: Install validation dependency**

```bash
npm install -D ajv
```

- [ ] **Step 2: Create candidate JSON Schema**

Create `schemas/candidate.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "name", "party", "partyShort", "color", "accent", "constituency", "isIncumbent", "bio", "positions", "stances", "highlights", "sources"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "name": { "type": "string", "minLength": 1 },
    "party": { "type": "string", "minLength": 1 },
    "partyShort": { "type": "string", "minLength": 1 },
    "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
    "accent": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
    "textColor": { "type": "string", "pattern": "^#[0-9A-Fa-f]{3,6}$" },
    "constituency": { "type": "string" },
    "isIncumbent": { "type": "boolean" },
    "bio": { "type": "string", "minLength": 1 },
    "positions": {
      "type": "object",
      "required": ["independence", "nhs", "housing", "climate", "tax", "economy", "education", "equality"],
      "properties": {
        "independence": { "type": "integer", "minimum": 0, "maximum": 2 },
        "nhs": { "type": "integer", "minimum": 0, "maximum": 2 },
        "housing": { "type": "integer", "minimum": 0, "maximum": 2 },
        "climate": { "type": "integer", "minimum": 0, "maximum": 2 },
        "tax": { "type": "integer", "minimum": 0, "maximum": 2 },
        "economy": { "type": "integer", "minimum": 0, "maximum": 2 },
        "education": { "type": "integer", "minimum": 0, "maximum": 2 },
        "equality": { "type": "integer", "minimum": 0, "maximum": 2 }
      },
      "additionalProperties": false
    },
    "stances": {
      "type": "object",
      "required": ["independence", "nhs", "housing", "climate", "tax", "economy", "education", "equality"],
      "additionalProperties": { "type": "string" }
    },
    "highlights": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["url", "type"],
        "properties": {
          "url": { "type": "string", "format": "uri" },
          "type": { "type": "string" }
        }
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 3: Create constituency JSON Schema**

Create `schemas/constituency.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "name", "region", "boundaryYear", "description", "context"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "name": { "type": "string", "minLength": 1 },
    "region": { "type": "string", "minLength": 1 },
    "boundaryYear": { "type": "integer" },
    "description": { "type": "string", "minLength": 1 },
    "context": { "type": "string", "minLength": 1 }
  },
  "additionalProperties": false
}
```

- [ ] **Step 4: Create questions JSON Schema**

Create `schemas/questions.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["questions"],
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "area", "question", "options"],
        "properties": {
          "id": { "type": "string" },
          "area": { "type": "string" },
          "question": { "type": "string" },
          "options": {
            "type": "array",
            "minItems": 2,
            "items": {
              "type": "object",
              "required": ["label", "value"],
              "properties": {
                "label": { "type": "string" },
                "value": { "type": "integer", "minimum": 0, "maximum": 2 }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 5: Create validation script**

Create `scripts/validate-data.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import yaml from "yaml";

const ajv = new Ajv({ allErrors: true });

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
}

function loadYaml(filePath: string) {
  return yaml.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
}

export function validateData(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const candidateSchema = loadJson("schemas/candidate.schema.json");
  const constituencySchema = loadJson("schemas/constituency.schema.json");
  const questionsSchema = loadJson("schemas/questions.schema.json");

  const validateCandidate = ajv.compile(candidateSchema);
  const validateConstituency = ajv.compile(constituencySchema);
  const validateQuestions = ajv.compile(questionsSchema);

  // Validate candidates
  const candidateDir = "data/candidates";
  const candidateFiles = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  for (const file of candidateFiles) {
    const data = loadYaml(path.join(candidateDir, file));
    if (!validateCandidate(data)) {
      errors.push(`${file}: ${ajv.errorsText(validateCandidate.errors)}`);
    }
  }

  // Validate constituencies
  const constituencyDir = "data/constituencies";
  const constituencyFiles = fs.readdirSync(constituencyDir).filter((f) => f.endsWith(".yaml"));
  for (const file of constituencyFiles) {
    const data = loadYaml(path.join(constituencyDir, file));
    if (!validateConstituency(data)) {
      errors.push(`${file}: ${ajv.errorsText(validateConstituency.errors)}`);
    }
  }

  // Validate questions
  const questionsData = loadYaml("data/questions.yaml");
  if (!validateQuestions(questionsData)) {
    errors.push(`questions.yaml: ${ajv.errorsText(validateQuestions.errors)}`);
  }

  return { valid: errors.length === 0, errors };
}

// Run directly if called as script
if (process.argv[1]?.endsWith("validate-data.ts")) {
  const { valid, errors } = validateData();
  if (valid) {
    console.log("All data files valid.");
    process.exit(0);
  } else {
    console.error("Validation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
```

- [ ] **Step 6: Write validation test**

Create `tests/validate-data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateData } from "../scripts/validate-data";

describe("data validation", () => {
  it("all YAML data files pass schema validation", () => {
    const { valid, errors } = validateData();
    if (!valid) {
      throw new Error(`Data validation failed:\n${errors.join("\n")}`);
    }
    expect(valid).toBe(true);
  });
});
```

- [ ] **Step 7: Run validation**

```bash
npm test
```

Expected: all tests pass, including data validation. If any YAML files don't match the schema, fix them.

- [ ] **Step 8: Commit**

```bash
git add schemas/ scripts/validate-data.ts tests/validate-data.test.ts package.json package-lock.json
git commit -m "add json schema validation for data files"
```

---

### Task 12: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create CI workflow for pull requests**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  validate-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Create deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "add github actions ci and deployment workflows"
```

---

### Task 13: Final build verification and push

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: successful build, output in `dist/`.

- [ ] **Step 3: Preview production build**

```bash
npm run preview
```

Open preview URL. Check all pages: landing, quiz (answer questions, see results), candidates grid, individual candidate pages, comparison, resources. Verify navigation between all pages works.

- [ ] **Step 4: Push all commits to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Enable GitHub Pages in repo settings**

Go to https://github.com/IsmaelMartinez/votescot/settings/pages and set source to "GitHub Actions". The deploy workflow will trigger automatically on the next push to main.

- [ ] **Step 6: Verify deployment**

After the workflow completes, check `https://ismaelmartinez.github.io/votescot/`. All pages should work.
