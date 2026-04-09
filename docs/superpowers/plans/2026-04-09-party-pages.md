# Party Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add party detail pages accessible via a toggle on the Candidates page, showing manifesto links, policy positions, and candidate listings.

**Architecture:** Extract the party-to-candidate matching map into a shared module. Add `loadParties()` and `loadManifestoRegistry()` to the data layer. Build a `ViewToggle` React component for the candidates index, a `PartyCard` Astro component for the grid, and a party detail page at `/candidates/party/[id]`.

**Tech Stack:** Astro 6, React 19, TypeScript, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-party-pages-and-news-design.md`

---

### File Map

- Create: `src/lib/party-match.ts` — shared party-name-to-id matching (extracted from scripts)
- Create: `tests/party-match.test.ts` — tests for party matching
- Modify: `scripts/apply-party-positions.ts` — import from shared module instead of inline map
- Modify: `src/lib/data.ts` — add `Party`, `ManifestoEntry` interfaces, `loadParties()`, `loadManifestoRegistry()`
- Create: `tests/data-parties.test.ts` — tests for new data loaders
- Create: `src/components/ViewToggle.tsx` — toggle between "By Constituency" and "By Party"
- Create: `src/components/PartyCard.astro` — party card for the grid view
- Modify: `src/pages/candidates/index.astro` — add toggle and party grid view
- Create: `src/pages/candidates/party/[id].astro` — party detail page

---

### Task 1: Extract party matching into shared module

**Files:**
- Create: `src/lib/party-match.ts`
- Create: `tests/party-match.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/party-match.test.ts
import { describe, it, expect } from "vitest";
import { matchPartyId, PARTY_MATCH_MAP } from "../src/lib/party-match";

describe("matchPartyId", () => {
  it("matches SNP candidate to party id", () => {
    expect(matchPartyId("Scottish National Party (SNP)")).toBe("scottish-national-party");
  });

  it("matches Labour candidate to party id", () => {
    expect(matchPartyId("Labour Party")).toBe("scottish-labour");
  });

  it("matches Conservative candidate to party id", () => {
    expect(matchPartyId("Conservative and Unionist Party")).toBe("scottish-conservatives");
  });

  it("matches Liberal Democrats candidate to party id", () => {
    expect(matchPartyId("Scottish Liberal Democrats")).toBe("scottish-liberal-democrats");
  });

  it("matches Green candidate to party id", () => {
    expect(matchPartyId("Scottish Green Party")).toBe("scottish-green-party");
  });

  it("matches Reform UK candidate to party id", () => {
    expect(matchPartyId("Reform UK")).toBe("reform-uk");
  });

  it("matches Alba candidate to party id", () => {
    expect(matchPartyId("Alba Party")).toBe("alba-party");
  });

  it("returns undefined for unknown party", () => {
    expect(matchPartyId("Galactic Federation")).toBeUndefined();
  });

  it("returns undefined for Independent", () => {
    expect(matchPartyId("Independent")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/party-match.test.ts`
Expected: FAIL — cannot find module `../src/lib/party-match`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/party-match.ts
export const PARTY_MATCH_MAP: Record<string, string[]> = {
  "scottish-national-party": ["scottish national party", "snp"],
  "scottish-labour": ["labour"],
  "scottish-conservatives": ["conservative"],
  "scottish-liberal-democrats": ["liberal democrat"],
  "scottish-green-party": ["scottish green", "green party"],
  "reform-uk": ["reform uk"],
  "alba-party": ["alba"],
};

export function matchPartyId(candidatePartyName: string): string | undefined {
  const lower = candidatePartyName.toLowerCase();
  for (const [partyId, keywords] of Object.entries(PARTY_MATCH_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return partyId;
    }
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/party-match.test.ts`
Expected: PASS — all 9 tests pass

- [ ] **Step 5: Update apply-party-positions.ts to use shared module**

In `scripts/apply-party-positions.ts`, replace the inline `PARTY_MATCH_MAP` and `matchParty` function:

```ts
// Replace lines 1-44 of scripts/apply-party-positions.ts with:
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { matchPartyId } from "../src/lib/party-match";

const PARTIES_DIR = path.resolve("data/parties");
const CANDIDATES_DIR = path.resolve("data/candidates");

interface PartyData {
  id: string;
  name: string;
  positions: Record<string, number>;
  stances: Record<string, string>;
}

function loadParties(): Map<string, PartyData> {
  const parties = new Map<string, PartyData>();
  const files = fs.readdirSync(PARTIES_DIR).filter((f) => f.endsWith(".yaml"));
  for (const file of files) {
    const data = yaml.parse(fs.readFileSync(path.join(PARTIES_DIR, file), "utf-8")) as PartyData;
    parties.set(data.id, data);
  }
  return parties;
}
```

Then update the `applyPartyPositions` function to use `matchPartyId`:

```ts
// Replace the matchParty call inside the for loop (line 65):
// Old: const party = matchParty(String(data.party ?? ""), parties);
// New:
    const partyId = matchPartyId(String(data.party ?? ""));
    const party = partyId ? parties.get(partyId) : undefined;
```

- [ ] **Step 6: Run full test suite to verify nothing broke**

Run: `npm test`
Expected: PASS — all existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/party-match.ts tests/party-match.test.ts scripts/apply-party-positions.ts
git commit -m "Extract party matching into shared module"
```

---

### Task 2: Add loadParties and loadManifestoRegistry to data layer

**Files:**
- Modify: `src/lib/data.ts`
- Create: `tests/data-parties.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/data-parties.test.ts
import { describe, it, expect } from "vitest";
import { loadParties, loadManifestoRegistry } from "../src/lib/data";

describe("loadParties", () => {
  it("returns an array of parties", () => {
    const parties = loadParties();
    expect(Array.isArray(parties)).toBe(true);
    expect(parties.length).toBe(7);
  });

  it("returns equal data on second call (cached internally)", () => {
    const first = loadParties();
    const second = loadParties();
    expect(first).toEqual(second);
  });

  it("each party has required fields", () => {
    const parties = loadParties();
    for (const p of parties) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.positions).toBeDefined();
      expect(p.stances).toBeDefined();
    }
  });

  it("party positions have all 8 policy areas", () => {
    const areas = ["independence", "nhs", "housing", "climate", "tax", "economy", "education", "equality"];
    const parties = loadParties();
    for (const p of parties) {
      for (const area of areas) {
        expect(p.positions[area]).toBeDefined();
      }
    }
  });
});

describe("loadManifestoRegistry", () => {
  it("returns an array of manifesto entries", () => {
    const entries = loadManifestoRegistry();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(7);
  });

  it("each entry has id, name, and manifestoUrls", () => {
    const entries = loadManifestoRegistry();
    for (const e of entries) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(Array.isArray(e.manifestoUrls)).toBe(true);
      expect(e.manifestoUrls.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data-parties.test.ts`
Expected: FAIL — `loadParties` and `loadManifestoRegistry` not exported

- [ ] **Step 3: Add interfaces and functions to data.ts**

Append to `src/lib/data.ts`:

```ts
export interface Party {
  id: string;
  name: string;
  positions: CandidatePosition;
  stances: Record<string, string>;
  quotes: Record<string, string>;
}

export interface ManifestoEntry {
  id: string;
  name: string;
  manifestoUrls: string[];
}

let partiesCache: readonly Party[] | null = null;

export function loadParties(): Party[] {
  if (!partiesCache) {
    const dir = path.resolve(process.cwd(), "data/parties");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    partiesCache = Object.freeze(files.map((f) => loadYaml<Party>(path.join("data/parties", f))));
  }
  return [...partiesCache];
}

export function loadManifestoRegistry(): ManifestoEntry[] {
  const data = loadYaml<{ parties: ManifestoEntry[] }>("data/manifestos/registry.yaml");
  return data.parties;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/data-parties.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS — all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/data.ts tests/data-parties.test.ts
git commit -m "Add loadParties and loadManifestoRegistry to data layer"
```

---

### Task 3: Create ViewToggle component

**Files:**
- Create: `src/components/ViewToggle.tsx`

- [ ] **Step 1: Create the ViewToggle component**

```tsx
// src/components/ViewToggle.tsx
import { useState } from "react";

interface Props {
  onToggle: (view: "constituency" | "party") => void;
}

export default function ViewToggle({ onToggle }: Props) {
  const [active, setActive] = useState<"constituency" | "party">("constituency");

  function handleClick(view: "constituency" | "party") {
    setActive(view);
    onToggle(view);
  }

  const base = "px-3.5 py-1.5 font-body text-xs font-medium uppercase tracking-wider transition-colors";
  const activeStyle = "bg-votescot-gold text-gray-900 font-bold";
  const inactiveStyle = "bg-white text-gray-400 hover:text-gray-600";

  return (
    <div className="flex border border-votescot-border rounded-lg overflow-hidden mb-4">
      <button
        type="button"
        className={`${base} ${active === "constituency" ? activeStyle : inactiveStyle}`}
        onClick={() => handleClick("constituency")}
      >
        By Constituency
      </button>
      <button
        type="button"
        className={`${base} ${active === "party" ? activeStyle : inactiveStyle}`}
        onClick={() => handleClick("party")}
      >
        By Party
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS — no type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ViewToggle.tsx
git commit -m "Add ViewToggle component for candidates page"
```

---

### Task 4: Create PartyCard component

**Files:**
- Create: `src/components/PartyCard.astro`

- [ ] **Step 1: Create the PartyCard component**

```astro
---
import type { Party } from "../lib/data";

interface Props {
  party: Party;
  candidateCount: number;
  manifestoUrl?: string;
  color: string;
  accent: string;
  basePath: string;
}

const { party, candidateCount, manifestoUrl, color, accent, basePath } = Astro.props;
---

<a
  href={`${basePath}candidates/party/${party.id}`}
  class="block bg-white rounded-lg p-3 border border-votescot-border hover:border-votescot-gold transition-colors no-underline text-inherit"
>
  <div class="flex items-center gap-2 mb-1">
    <div
      class="w-2.5 h-2.5 rounded-full shrink-0"
      style={`background: ${color}; border: 2px solid ${accent}`}
    />
    <div>
      <div class="font-heading font-black text-sm">{party.name}</div>
      <div class="font-body text-xs text-gray-400">
        {candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
      </div>
    </div>
  </div>
  {manifestoUrl && (
    <div class="font-body text-xs text-blue-600 mt-1 truncate">
      Manifesto available
    </div>
  )}
</a>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PartyCard.astro
git commit -m "Add PartyCard component"
```

---

### Task 5: Add toggle and party grid to candidates index

**Files:**
- Modify: `src/pages/candidates/index.astro`

- [ ] **Step 1: Update the candidates index page**

Add imports at the top of the frontmatter (after existing imports):

```ts
import PartyCard from "../../components/PartyCard.astro";
import ViewToggle from "../../components/ViewToggle";
import { loadParties, loadManifestoRegistry } from "../../lib/data";
import { matchPartyId } from "../../lib/party-match";
```

Add party data loading after the existing data loading:

```ts
const parties = loadParties();
const manifestoRegistry = loadManifestoRegistry();

const partyCards = parties
  .map((p) => {
    const candidateCount = allCandidates.filter((c) => matchPartyId(c.party) === p.id).length;
    const manifesto = manifestoRegistry.find((m) => m.id === p.id);
    const sampleCandidate = allCandidates.find((c) => matchPartyId(c.party) === p.id);
    return {
      party: p,
      candidateCount,
      manifestoUrl: manifesto?.manifestoUrls[0],
      color: sampleCandidate?.color || "#666666",
      accent: sampleCandidate?.accent || "#444444",
    };
  })
  .sort((a, b) => a.party.name.localeCompare(b.party.name));
```

Replace the page body (everything inside `<div class="py-3.5">`) with:

```astro
<div class="py-3.5">
  <h2 class="font-heading text-lg font-black mb-1">Candidates</h2>
  <p class="font-body text-[12.5px] text-gray-500 leading-snug mb-4">
    Candidates confirmed for the 7 May 2026 election. Click any candidate for their full profile, or use the comparison tool to see stances side by side.
  </p>

  <ViewToggle client:load onToggle={(view) => {
    document.getElementById('view-constituency')!.style.display = view === 'constituency' ? '' : 'none';
    document.getElementById('view-party')!.style.display = view === 'party' ? '' : 'none';
  }} />

  <!-- Party view -->
  <div id="view-party" style="display: none;">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {partyCards.map(({ party, candidateCount, manifestoUrl, color, accent }) => (
        <PartyCard
          party={party}
          candidateCount={candidateCount}
          manifestoUrl={manifestoUrl}
          color={color}
          accent={accent}
          basePath={base}
        />
      ))}
    </div>
  </div>

  <!-- Constituency view (existing content) -->
  <div id="view-constituency">
    <CandidatesSearch client:load items={searchItems} knownConstituencies={constituencies.map((c) => c.id)} basePath={base} />

    <details class="mt-5 mb-6 bg-white border border-votescot-border rounded-lg">
      <summary class="px-4 py-3 cursor-pointer font-heading font-bold text-sm hover:text-votescot-gold transition-colors">
        Compare candidates side by side
      </summary>
      <div class="px-4 pb-4">
        <CandidateComparison client:visible candidates={allCandidates} questions={questions} constituencies={constituencies} />
      </div>
    </details>

    {grouped.map(({ constituency, quizCandidates, otherCandidates }) => (
      <div class="mb-6" id={constituency.id}>
        <h3 class="font-heading text-base font-black mb-0.5">{constituency.name}</h3>
        <p class="font-body text-xs text-gray-400 leading-snug mb-3">{constituency.context}</p>

        {quizCandidates.length > 0 && (
          <div class="mb-3">
            <div class="font-body text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Quiz candidates
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quizCandidates.map((c) => (
                <CandidateCard candidate={c} basePath={base} />
              ))}
            </div>
          </div>
        )}

        {otherCandidates.length > 0 && (
          <div>
            <div class="font-body text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Other candidates
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {otherCandidates.map((c) => (
                <CandidateCard candidate={c} basePath={base} />
              ))}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Test locally**

Run: `npm run dev`
Verify: navigate to `/candidates`, toggle works, party cards render, clicking a party card navigates (will 404 until Task 6)

- [ ] **Step 4: Commit**

```bash
git add src/pages/candidates/index.astro
git commit -m "Add party/constituency toggle to candidates page"
```

---

### Task 6: Create party detail page

**Files:**
- Create: `src/pages/candidates/party/[id].astro`

- [ ] **Step 1: Create the party detail page**

```astro
---
import Base from "../../../layouts/Base.astro";
import Header from "../../../components/Header.astro";
import Footer from "../../../components/Footer.astro";
import CandidateCard from "../../../components/CandidateCard.astro";
import { loadParties, loadCandidates, loadQuestions, loadManifestoRegistry, loadConstituencies } from "../../../lib/data";
import { matchPartyId } from "../../../lib/party-match";

export function getStaticPaths() {
  const parties = loadParties();
  return parties.map((p) => ({ params: { id: p.id }, props: { party: p } }));
}

const { party } = Astro.props;
const allCandidates = loadCandidates();
const questions = loadQuestions();
const constituencies = loadConstituencies();
const manifestoRegistry = loadManifestoRegistry();
const base = import.meta.env.BASE_URL;

const partyCandidates = allCandidates.filter((c) => matchPartyId(c.party) === party.id);
const sampleCandidate = partyCandidates[0];
const color = sampleCandidate?.color || "#666666";
const accent = sampleCandidate?.accent || "#444444";

const manifesto = manifestoRegistry.find((m) => m.id === party.id);

const groupedByConstituency = constituencies
  .map((c) => ({
    constituency: c,
    candidates: partyCandidates.filter((cand) => cand.constituency === c.id),
  }))
  .filter((g) => g.candidates.length > 0)
  .sort((a, b) => a.constituency.name.localeCompare(b.constituency.name));
---

<Base title={party.name} description={`${party.name} — policy positions, manifesto, and candidates for the 2026 Scottish Parliament election`}>
  <Header slot="header" currentTab="candidates" />

  <div class="py-3.5">
    <div class="flex items-center gap-2 mb-2">
      <div
        class="w-3 h-3 rounded-full"
        style={`background: ${color}; border: 2px solid ${accent}`}
      />
      <h2 class="font-heading text-lg font-black m-0">{party.name}</h2>
    </div>

    {manifesto && (
      <a
        href={manifesto.manifestoUrls[0]}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block font-body text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded no-underline hover:bg-blue-100 mb-3.5"
      >
        View manifesto ↗
      </a>
    )}

    {party.stances && (
      <>
        <h3 class="font-body text-[13px] font-black uppercase tracking-wider text-gray-500 mb-2">
          Policy Positions
        </h3>
        <div class="flex flex-col gap-1.5">
          {Object.entries(party.stances).map(([key, stance]) => {
            const q = questions.find((q) => q.id === key);
            return (
              <div class="bg-white rounded-md p-2.5 border border-votescot-border">
                <div
                  class="font-body text-xs font-bold uppercase tracking-widest mb-0.5"
                  style={`color: ${accent}`}
                >
                  {q?.area || key}
                </div>
                <div class="font-body text-[13px] text-gray-700 leading-snug">{stance}</div>
              </div>
            );
          })}
        </div>
      </>
    )}

    <h3 class="font-body text-[13px] font-black uppercase tracking-wider text-gray-500 mt-4 mb-2">
      Candidates ({partyCandidates.length})
    </h3>

    {groupedByConstituency.map(({ constituency, candidates }) => (
      <div class="mb-4">
        <div class="font-body text-xs font-bold text-gray-400 mb-2">{constituency.name}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {candidates.map((c) => (
            <CandidateCard candidate={c} basePath={base} />
          ))}
        </div>
      </div>
    ))}

    <h3 class="font-body text-[13px] font-black uppercase tracking-wider text-gray-500 mt-4 mb-2">
      News
    </h3>
    <div class="bg-white rounded-md p-3 border border-votescot-border">
      <p class="font-body text-xs text-gray-400 m-0">
        News coverage for {party.name} is coming soon.
      </p>
    </div>
  </div>

  <Footer slot="footer" />
</Base>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS — static pages generated for all 7 parties

- [ ] **Step 3: Test locally**

Run: `npm run dev`
Verify: navigate to `/candidates`, toggle to "By Party", click a party card, verify the detail page shows manifesto link, 8 policy positions, and the candidate grid grouped by constituency.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/candidates/party/[id].astro
git commit -m "Add party detail pages"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: PASS — site builds with party pages

- [ ] **Step 3: Preview the built site**

Run: `npm run preview`
Verify manually:
1. `/candidates` loads with toggle visible
2. "By Constituency" is default, shows existing content
3. Toggling to "By Party" shows 7 party cards in a grid
4. Search bar and compare section hide when in party view
5. Clicking a party card goes to `/candidates/party/[id]`
6. Party detail page shows: name with colour dot, manifesto link, 8 policy positions, candidates grouped by constituency, "coming soon" news placeholder
7. Header shows "Candidates" tab as active on party detail pages
8. All candidate card links work from party detail pages

- [ ] **Step 4: Commit any fixes if needed**
