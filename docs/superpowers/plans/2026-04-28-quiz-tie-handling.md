# Quiz Tie Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the misleading silent-winner behaviour on the quiz results screen, add a podium summary above the card list, and compact non-leader cards on the regional ballot.

**Architecture:** Three layered changes. (1) Compute a per-block `rank` in `buildPartyBlocks` and apply the existing winner cues (trophy, thick border, "Tied #1" pill) to every rank-1 block. (2) New `QuizPodium.tsx` SVG component above the card list. (3) Per-card local collapse state in `QuizEngine.tsx`, default-expanded for rank 1.

**Tech Stack:** TypeScript, React 19, Astro 6, Vitest. Existing files: `src/lib/quiz-helpers.ts`, `src/components/QuizEngine.tsx`, `tests/quiz-helpers.test.ts`.

**Spec:** `docs/superpowers/specs/2026-04-28-quiz-tie-handling-design.md`

**Visual reference:** the dev preview page at `src/pages/dev/quiz-podium-preview.astro` (rendered at `/dev/quiz-podium-preview/` after a build) covers every podium state with mock data.

---

## File Structure

Files this plan creates or modifies:

- `src/lib/quiz-helpers.ts` (modify) — add `rank: number` to `PartyBlock`, expose `computeTopTie()` helper.
- `src/components/QuizPodium.tsx` (create) — pure SVG component, renders top three blocks with tie awareness, returns `null` when suppressed.
- `src/components/QuizEngine.tsx` (modify) — apply rank-1 winner treatment to all tied-rank-1 cards, render `<QuizPodium>`, extract a small `PartyResultCard` child component to hold per-card collapse state with a "+ N more" inner toggle.
- `tests/quiz-helpers.test.ts` (modify) — cover rank assignment, the rank-1 tie group, and `computeTopTie` helper.

`src/lib/matching.ts` is not touched. Genuine ties (parties with identical position vectors on the answered questions) remain in alphabetical order; the visual treatment carries the honesty signal.

---

## Task 1: Add `rank` and `computeTopTie` to `quiz-helpers`

**Files:**
- Modify: `src/lib/quiz-helpers.ts:13-22, 41-83`
- Test: `tests/quiz-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/quiz-helpers.test.ts`. The new import line replaces the existing import block at the top of the file (lines 1-9):

```ts
import { describe, it, expect } from "vitest";
import {
  buildPartyBlocks,
  buildConstituencyToRegion,
  resolveInitialSelection,
  computeTopTie,
  type ConstituencyLite,
  type RegionLite,
} from "../src/lib/quiz-helpers";
import type { Candidate, RegionalCandidate } from "../src/lib/data";
```

Then append these test blocks to the file:

```ts
describe("buildPartyBlocks rank assignment", () => {
  it("assigns rank 1 to the leader and increments for distinct percentages", () => {
    const allMatchAnswers = { independence: 2, nhs: 2, housing: 1 };
    const blocks = buildPartyBlocks([consA, consLab], "constituency", allMatchAnswers);
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(2);
  });

  it("shares rank 1 across blocks with identical percentage", () => {
    // Both parties have the same positions, so they tie at the same percentage.
    const consTie: Candidate = {
      ...consA,
      id: "alice-green",
      name: "Alice Green",
      party: "Scottish Greens",
      partyShort: "Greens",
    };
    const blocks = buildPartyBlocks(
      [consA, consTie],
      "constituency",
      { independence: 2, nhs: 2, housing: 1 }
    );
    expect(blocks[0].match.percentage).toBe(blocks[1].match.percentage);
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(1);
  });

  it("uses competition ranking (1, 1, 3) after a tie", () => {
    const consTie: Candidate = {
      ...consA,
      id: "alice-green",
      name: "Alice Green",
      party: "Scottish Greens",
      partyShort: "Greens",
    };
    const blocks = buildPartyBlocks(
      [consA, consTie, consLab],
      "constituency",
      { independence: 2, nhs: 2, housing: 1 }
    );
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(1);
    expect(blocks[2].rank).toBe(3);
  });

  it("does not share rank between positioned and no-position blocks at 0%", () => {
    const noPositions: Candidate = {
      ...consA,
      id: "p-none",
      party: "Pirate Party",
      partyShort: "Pir",
      positions: undefined,
    };
    // SNP scores 0% with positions; Pirate has no positions and shows 0% by default.
    const blocks = buildPartyBlocks([consA, noPositions], "constituency", { independence: 0 });
    expect(blocks[0].rank).toBe(1); // SNP, has positions
    expect(blocks[1].rank).toBe(2); // Pirate, no positions
  });
});

describe("computeTopTie", () => {
  it("returns count 1 and the top percentage for a clean win", () => {
    const allMatchAnswers = { independence: 2, nhs: 2, housing: 1 };
    const blocks = buildPartyBlocks([consA, consLab], "constituency", allMatchAnswers);
    const tie = computeTopTie(blocks);
    expect(tie.count).toBe(1);
    expect(tie.topPercentage).toBe(blocks[0].match.percentage);
    expect(tie.noClearLeader).toBe(false);
  });

  it("excludes blocks with no positions from the tie count", () => {
    const noPositions: Candidate = {
      ...consA,
      id: "p-none",
      party: "Pirate Party",
      partyShort: "Pir",
      positions: undefined,
    };
    const blocks = buildPartyBlocks([consA, noPositions], "constituency", { independence: 2 });
    const tie = computeTopTie(blocks);
    expect(tie.count).toBe(1); // only SNP counted
  });

  it("flags noClearLeader when 4+ parties tie at rank 1", () => {
    const mk = (id: string, party: string): Candidate => ({
      ...consA,
      id,
      party,
      partyShort: id.toUpperCase(),
    });
    const blocks = buildPartyBlocks(
      [mk("a", "A"), mk("b", "B"), mk("c", "C"), mk("d", "D")],
      "constituency",
      { independence: 2 }
    );
    const tie = computeTopTie(blocks);
    expect(tie.count).toBe(4);
    expect(tie.noClearLeader).toBe(true);
  });

  it("flags noClearLeader when top percentage is zero", () => {
    const sibling: Candidate = {
      ...consA,
      id: "p2",
      party: "P2",
      partyShort: "P2",
    };
    // Both parties have independence:2 in their positions. User answers independence:0.
    // Both score diff=2 → 0 points → 0%.
    const blocks = buildPartyBlocks([consA, sibling], "constituency", { independence: 0 });
    expect(blocks[0].match.percentage).toBe(0);
    const tie = computeTopTie(blocks);
    expect(tie.topPercentage).toBe(0);
    expect(tie.noClearLeader).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npx vitest run tests/quiz-helpers.test.ts`
Expected: New tests fail with import error (`computeTopTie` does not exist) and `rank` assertions failing (property does not exist on `PartyBlock`).

- [ ] **Step 3: Add `rank` to `PartyBlock` and compute it after sort**

In `src/lib/quiz-helpers.ts`, change the `PartyBlock` interface (currently lines 13-22) to:

```ts
export interface PartyBlock {
  party: string;
  partyShort: string;
  color: string;
  accent: string;
  textColor?: string;
  candidates: PartyBlockCandidate[];
  positions: Record<string, number>;
  match: MatchResult;
  /** 1 for the leader. Tied blocks share a rank (competition ranking: 1, 1, 3). */
  rank: number;
}
```

In `buildPartyBlocks`, change the block construction (currently lines 53-75) to add a placeholder `rank: 0`:

```ts
  const blocks: PartyBlock[] = Array.from(byParty.entries()).map(([party, items]) => {
    const sample = items.find((c) => c.positions) ?? items[0];
    const positions = (sample.positions ?? {}) as Record<string, number>;
    const sorted = isRegional
      ? [...(items as RegionalCandidate[])].sort((a, b) => a.listPosition - b.listPosition)
      : [...items].sort((a, b) => a.name.localeCompare(b.name));
    const candidates: PartyBlockCandidate[] = sorted.map((c) => ({
      id: c.id,
      name: c.name,
      isIncumbent: c.isIncumbent,
      listPosition: isRegional ? (c as RegionalCandidate).listPosition : undefined,
    }));
    return {
      party,
      partyShort: sample.partyShort,
      color: sample.color,
      accent: sample.accent,
      textColor: sample.textColor,
      candidates,
      positions,
      match: calculateMatch(answers, positions),
      rank: 0,
    };
  });
```

Replace the existing return-and-sort (currently lines 76-82) with a sort-then-rank block:

```ts
  blocks.sort((a, b) => {
    if (b.match.percentage !== a.match.percentage) return b.match.percentage - a.match.percentage;
    const aHas = a.match.breakdown.length > 0 ? 1 : 0;
    const bHas = b.match.breakdown.length > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return a.party.localeCompare(b.party);
  });

  for (let i = 0; i < blocks.length; i++) {
    if (i === 0) {
      blocks[i].rank = 1;
      continue;
    }
    const prev = blocks[i - 1];
    const curr = blocks[i];
    const sameTier =
      prev.match.percentage === curr.match.percentage &&
      (prev.match.breakdown.length > 0) === (curr.match.breakdown.length > 0);
    blocks[i].rank = sameTier ? prev.rank : i + 1;
  }

  return blocks;
}
```

Append `computeTopTie` to the end of the file:

```ts
export interface TopTie {
  /** Number of rank-1 blocks with positions and a non-zero percentage. */
  count: number;
  /** The percentage shared by the rank-1 group, or 0 if none qualify. */
  topPercentage: number;
  /** True when 4+ parties tie at rank 1, or when the top percentage is 0. */
  noClearLeader: boolean;
}

export function computeTopTie(blocks: PartyBlock[]): TopTie {
  const rankOnePositioned = blocks.filter(
    (b) => b.rank === 1 && b.match.breakdown.length > 0
  );
  const topPercentage = rankOnePositioned[0]?.match.percentage ?? 0;
  const count = topPercentage > 0 ? rankOnePositioned.length : 0;
  const noClearLeader = count === 0 || count >= 4;
  return { count, topPercentage, noClearLeader };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npx vitest run tests/quiz-helpers.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All tests pass. `tests/matching.test.ts` is untouched and still passes.

---

## Task 2: Apply shared-rank treatment in `QuizEngine.tsx`

This task is a UI change. Verification is by inspecting the dev server in a browser. The component is not unit-tested today.

**Files:**
- Modify: `src/components/QuizEngine.tsx:5-10, 161, 217-219, 239-260`

- [ ] **Step 1: Update the import to include `computeTopTie`**

In `src/components/QuizEngine.tsx`, change the import block (currently lines 5-10) from:

```ts
import {
  buildPartyBlocks,
  buildConstituencyToRegion,
  resolveInitialSelection,
  type PartyBlock,
} from "../lib/quiz-helpers";
```

to:

```ts
import {
  buildPartyBlocks,
  buildConstituencyToRegion,
  resolveInitialSelection,
  computeTopTie,
  type PartyBlock,
} from "../lib/quiz-helpers";
```

- [ ] **Step 2: Compute `tie` in the results branch**

Inside the `if (showResults)` branch, immediately after the existing `const blocks = activeTab === "regional" ? regionalBlocks : constituencyBlocks;` line (currently `QuizEngine.tsx:161`), add:

```ts
    const tie = computeTopTie(blocks);
```

- [ ] **Step 3: Render the "no clear leader" banner**

Locate the existing helper paragraph (currently `QuizEngine.tsx:217-219`):

```tsx
<p className="font-body text-xs text-gray-400 mb-4">
  Based on {answeredCount} of {questions.length} questions answered. The more you answer, the better the match.
</p>
```

Immediately after that closing `</p>`, insert:

```tsx
{tie.noClearLeader && (
  <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
    No clear leader from your answers. Try answering more questions for a sharper match.
  </p>
)}
```

- [ ] **Step 4: Apply trophy and thick border to all rank-1 cards (when not suppressed)**

Locate the start of the card render block (currently `QuizEngine.tsx:239-260`). Replace this block:

```tsx
{blocks.map((p, i) => {
  const hasPositions = p.match.breakdown.length > 0;
  const headerBg = p.textColor ? p.accent : p.color;
  const headerFg = p.textColor ?? "#fff";
  return (
    <div
      key={p.party}
      className="bg-white rounded-lg overflow-hidden border"
      style={{
        borderWidth: i === 0 && hasPositions ? 2 : 1,
        borderColor: i === 0 && hasPositions ? (p.accent || p.color) : "#e8e4df",
      }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ background: headerBg, color: headerFg }}
      >
        <div className="flex items-center gap-2">
          {i === 0 && hasPositions && <span className="text-base">🏆</span>}
          <div className="font-heading font-black text-sm">{p.party}</div>
          <div className="font-body text-xs opacity-80">· {p.candidates.length} {p.candidates.length === 1 ? "candidate" : "candidates"}</div>
        </div>
```

with:

```tsx
{blocks.map((p) => {
  const hasPositions = p.match.breakdown.length > 0;
  const headerBg = p.textColor ? p.accent : p.color;
  const headerFg = p.textColor ?? "#fff";
  const isWinner = p.rank === 1 && hasPositions && !tie.noClearLeader;
  const showTiedPill = isWinner && tie.count >= 2;
  return (
    <div
      key={p.party}
      className="bg-white rounded-lg overflow-hidden border"
      style={{
        borderWidth: isWinner ? 2 : 1,
        borderColor: isWinner ? (p.accent || p.color) : "#e8e4df",
      }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ background: headerBg, color: headerFg }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isWinner && <span className="text-base">🏆</span>}
          <div className="font-heading font-black text-sm">{p.party}</div>
          {showTiedPill && (
            <span
              className="font-body text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(0,0,0,0.18)", color: "inherit" }}
            >
              Tied #1
            </span>
          )}
          <div className="font-body text-xs opacity-80">· {p.candidates.length} {p.candidates.length === 1 ? "candidate" : "candidates"}</div>
        </div>
```

The rest of the card body (percentage chip, progress bar, chips, candidate list, closing tags) remains unchanged at this stage; Task 4 will rewrite this section.

- [ ] **Step 5: Build and visually verify**

Run: `npm run dev`

Open the dev URL, pick a constituency, and:
- Answer questions to produce a 2-way tie at the top: both leaders show the trophy, both have a 2px accent border, both display the "Tied #1" pill.
- Answer questions to produce a clear winner: only the leader gets the trophy and border (existing behaviour preserved).
- Force a 4+ way tie or 0% top percentage: the amber "No clear leader" banner appears, no card has the trophy or pill.

- [ ] **Step 6: Run the test suite**

Run: `npm test`
Expected: All tests pass.

---

## Task 3: Add `QuizPodium` component and integrate

**Files:**
- Create: `src/components/QuizPodium.tsx`
- Modify: `src/components/QuizEngine.tsx` (one import, one render line)

- [ ] **Step 1: Create the `QuizPodium` component**

Write `src/components/QuizPodium.tsx`:

```tsx
import React from "react";
import type { PartyBlock, TopTie } from "../lib/quiz-helpers";

interface Props {
  blocks: PartyBlock[];
  tie: TopTie;
}

interface Slot {
  block: PartyBlock;
  rankLabel: string;
  height: number;
  x: number;
}

const TALL = 120;
const MEDIUM = 80;
const SHORT = 60;

function buildSlots(blocks: PartyBlock[], tie: TopTie): Slot[] {
  const positioned = blocks.filter((b) => b.match.breakdown.length > 0);
  if (positioned.length < 2 || tie.noClearLeader) return [];

  const rank1 = positioned.filter((b) => b.rank === 1);
  const rank2 = positioned.find((b) => b.rank === 2);
  const rank3 = positioned.find((b) => b.rank === 3);

  // Three-way tie at #1: three tall blocks edge-to-edge, no other slots.
  if (rank1.length === 3) {
    return [
      { block: rank1[0], rankLabel: "TIED #1", height: TALL, x: 20 },
      { block: rank1[1], rankLabel: "TIED #1", height: TALL, x: 130 },
      { block: rank1[2], rankLabel: "TIED #1", height: TALL, x: 240 },
    ];
  }

  // Two-way tie at #1: two tall blocks centre, rank-3 (if any) to the right at short height.
  if (rank1.length === 2) {
    const slots: Slot[] = [
      { block: rank1[0], rankLabel: "TIED #1", height: TALL, x: 40 },
      { block: rank1[1], rankLabel: "TIED #1", height: TALL, x: 150 },
    ];
    if (rank3) slots.push({ block: rank3, rankLabel: "3RD", height: SHORT, x: 270 });
    return slots;
  }

  // Single winner: classic 2-1-3 podium.
  const slots: Slot[] = [];
  if (rank2) slots.push({ block: rank2, rankLabel: "2ND", height: MEDIUM, x: 20 });
  slots.push({ block: rank1[0], rankLabel: "1ST", height: TALL, x: 130 });
  if (rank3) slots.push({ block: rank3, rankLabel: "3RD", height: SHORT, x: 240 });
  return slots;
}

function scoreColor(percentage: number): string {
  if (percentage >= 70) return "#2d8a4e";
  if (percentage >= 40) return "#c4940a";
  return "#c0392b";
}

export default function QuizPodium({ blocks, tie }: Props) {
  const slots = buildSlots(blocks, tie);
  if (slots.length === 0) return null;

  const blockWidth = 100;

  return (
    <svg
      viewBox="0 0 360 170"
      width="100%"
      role="img"
      aria-label="Top matches podium"
      style={{ background: "#faf8f5", borderRadius: 8, marginBottom: 12 }}
    >
      {slots.map((slot) => {
        const top = 35 + (TALL - slot.height);
        const isWinner = slot.rankLabel === "1ST" || slot.rankLabel === "TIED #1";
        const stroke = isWinner ? "#c4940a" : "#e8e4df";
        const strokeWidth = isWinner ? 2 : 1;
        const pctColor = scoreColor(slot.block.match.percentage);
        return (
          <g key={`${slot.block.party}-${slot.x}`} transform={`translate(${slot.x}, ${top})`}>
            <rect
              width={blockWidth}
              height={slot.height}
              fill="#fff"
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <rect width={blockWidth} height={6} fill={slot.block.accent || slot.block.color} />
            {isWinner && (
              <text x={50} y={32} textAnchor="middle" fontSize={18}>
                🏆
              </text>
            )}
            <text
              x={50}
              y={isWinner ? 60 : 30}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={isWinner ? 10 : 11}
              fill="#888"
              fontWeight={700}
              letterSpacing={0.6}
            >
              {slot.rankLabel}
            </text>
            <text
              x={50}
              y={isWinner ? 82 : 46}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={isWinner ? 14 : 13}
              fill="#1a1a2e"
              fontWeight={900}
            >
              {slot.block.partyShort}
            </text>
            <text
              x={50}
              y={isWinner ? 104 : slot.height - 8}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={isWinner ? 16 : 13}
              fill={pctColor}
              fontWeight={900}
            >
              {slot.block.match.percentage}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Render the podium above the card list**

In `src/components/QuizEngine.tsx`, add this import line near the top of the imports (after the existing component imports):

```ts
import QuizPodium from "./QuizPodium";
```

Locate the `{tie.noClearLeader && ...}` banner from Task 2. Immediately after that banner's closing `)}` and before the `<div className="flex flex-col gap-2">` that opens the card list, insert:

```tsx
<QuizPodium blocks={blocks} tie={tie} />
```

- [ ] **Step 3: Build and visually verify**

Run: `npm run dev`

Verify:
- Outright winner: 2-1-3 podium with 2nd left, tallest 1st centre, 3rd right.
- 2-way tie at #1: two tall blocks centre, 3rd block on the right shorter.
- 3-way tie at #1: three equal tall blocks, no other slots.
- 4+ way tie or 0% top: podium does not render (`buildSlots` returns empty), banner is the only top-of-list element.
- Fewer than two parties with positions: podium does not render.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: All tests pass. The new component has no unit tests; visual verification only.

---

## Task 4: Compact card list with collapse/expand

This task extracts a `PartyResultCard` child component that holds two pieces of local state (`expanded` and `showAllCandidates`). Rank-1 cards default to expanded; others collapsed.

**Files:**
- Modify: `src/components/QuizEngine.tsx` (replace the inline `.map(...)` body and add a child component)

- [ ] **Step 1: Replace the inline `.map` callback with a child component invocation**

In `src/components/QuizEngine.tsx`, locate the entire `{blocks.map((p) => { ... })}` block inside the results branch — this includes everything from Task 2's modified opening through the closing `}` of the map callback. Replace the whole map call with:

```tsx
{blocks.map((p) => (
  <PartyResultCard
    key={p.party}
    block={p}
    isWinner={p.rank === 1 && p.match.breakdown.length > 0 && !tie.noClearLeader}
    showTiedPill={p.rank === 1 && p.match.breakdown.length > 0 && !tie.noClearLeader && tie.count >= 2}
    isRegionalTab={isRegionalTab}
    profileBase={profileBase}
    questions={questions}
  />
))}
```

- [ ] **Step 2: Add the `PartyResultCard` child component**

Above the `QuizEngineInner` function definition (or directly above `export default function QuizEngine`), add:

```tsx
interface CardProps {
  block: PartyBlock;
  isWinner: boolean;
  showTiedPill: boolean;
  isRegionalTab: boolean;
  profileBase: string;
  questions: QuizQuestion[];
}

const CANDIDATE_PREVIEW = 4;

function PartyResultCard({ block: p, isWinner, showTiedPill, isRegionalTab, profileBase, questions }: CardProps) {
  const hasPositions = p.match.breakdown.length > 0;
  const [expanded, setExpanded] = useState(isWinner);
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  const headerBg = p.textColor ? p.accent : p.color;
  const headerFg = p.textColor ?? "#fff";
  const visibleCandidates = showAllCandidates ? p.candidates : p.candidates.slice(0, CANDIDATE_PREVIEW);
  const hiddenCount = p.candidates.length - visibleCandidates.length;

  return (
    <div
      className="bg-white rounded-lg overflow-hidden border"
      style={{
        borderWidth: isWinner ? 2 : 1,
        borderColor: isWinner ? (p.accent || p.color) : "#e8e4df",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full px-3 py-2 flex items-center justify-between text-left cursor-pointer border-0"
        style={{ background: headerBg, color: headerFg }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isWinner && <span className="text-base">🏆</span>}
          <div className="font-heading font-black text-sm">{p.party}</div>
          {showTiedPill && (
            <span
              className="font-body text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(0,0,0,0.18)", color: "inherit" }}
            >
              Tied #1
            </span>
          )}
          <div className="font-body text-xs opacity-80">· {p.candidates.length} {p.candidates.length === 1 ? "candidate" : "candidates"}</div>
        </div>
        <div className="flex items-center gap-2">
          {hasPositions ? (
            <div
              className="font-body text-xl font-black"
              style={{ color: scoreColor(p.match.percentage), background: "#fff", padding: "0 8px", borderRadius: 4 }}
            >
              {p.match.percentage}%
            </div>
          ) : (
            <div className="font-body text-xs opacity-80">No quiz positions</div>
          )}
          <span className="font-body text-sm opacity-70" aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {hasPositions && (
        <div className="px-3 pt-2 pb-1">
          <div className="w-full h-1.5 bg-votescot-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${p.match.percentage}%`, background: scoreColor(p.match.percentage) }}
            />
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-2.5 pt-2">
          {hasPositions && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {p.match.breakdown.map(({ questionId, diff }) => {
                const q = questions.find((qq) => qq.id === questionId);
                return (
                  <span
                    key={questionId}
                    className="font-body text-xs px-1.5 py-0.5 rounded-full font-semibold"
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
          )}

          <ol className="m-0 p-0 list-none">
            {visibleCandidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                {isRegionalTab && (
                  <span className="font-body text-xs font-bold text-gray-400 w-5 text-right shrink-0">{c.listPosition}</span>
                )}
                <a
                  href={`${profileBase}${c.id}`}
                  className="font-body text-[13px] text-gray-700 no-underline hover:text-votescot-gold flex-1"
                >
                  {c.name}
                </a>
                {c.isIncumbent && (
                  <span className="bg-gray-800 text-white text-[10px] px-1 py-0.5 rounded uppercase tracking-wider font-bold">Incumbent</span>
                )}
              </li>
            ))}
          </ol>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllCandidates(true)}
              className="w-full text-center font-body text-xs text-gray-500 hover:text-gray-800 cursor-pointer pt-1.5 mt-1.5 border-t border-gray-100 bg-transparent"
            >
              + {hiddenCount} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Verify imports at the top of the file include `useState` from React (the file already imports `useState` for the parent component) and `QuizQuestion` from `../lib/data` (already imported). Move the existing `scoreColor` helper out of the inner function scope if needed so `PartyResultCard` can call it — in the current file `scoreColor` is defined at module scope (`QuizEngine.tsx:33-37`), so no change is needed.

- [ ] **Step 3: Build and visually verify**

Run: `npm run dev`

Verify on the constituency tab:
- Top card (rank 1) is expanded by default with chips and candidate visible.
- Other cards collapsed: header + score bar only, ▾ chevron on the right.
- Click a collapsed card: chevron flips to ▴, chips and candidates appear.
- Click an expanded card: collapses back.

Verify on the regional tab:
- Same collapse behaviour.
- A party with more than 4 candidates shows the first 4 with a "+ N more" button at the bottom of its candidate list.
- Click "+ N more": remaining candidates appear, button disappears.

Verify the no-positions card:
- Header shows "No quiz positions" instead of a percentage chip.
- Collapses by default, expands to show candidates.

Verify keyboard:
- Tab focuses each card header; Enter/Space toggles expansion.

- [ ] **Step 4: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: All tests pass, TypeScript builds without errors.

---

## Task 5: Final verification

- [ ] **Step 1: Smoke test the full flow**

Run: `npm run dev`

Walk through one full quiz:
- Pick a constituency, answer all 8 questions, switch between constituency and regional tabs, verify podium and card behaviour on both.
- Reset and answer fewer than 3 questions: gate is unchanged.
- Force a 4-way tie (e.g. answer one neutral question across many parties) and verify the "no clear leader" banner appears with no podium.

- [ ] **Step 2: Verify nothing else regressed**

Run: `npm test && npm run build`
Expected: All tests pass, build succeeds.

- [ ] **Step 3: Stage and commit (only after explicit user approval)**

Per the project's CLAUDE.md, commits require explicit user authorisation. Pause here and ask the user to confirm before running:

```bash
git add src/lib/quiz-helpers.ts \
        src/components/QuizPodium.tsx src/components/QuizEngine.tsx \
        tests/quiz-helpers.test.ts \
        docs/superpowers/specs/2026-04-28-quiz-tie-handling-design.md \
        docs/superpowers/plans/2026-04-28-quiz-tie-handling.md

git commit -m "$(cat <<'EOF'
quiz: tie handling, podium summary, and compact regional cards

Adds shared-rank visual treatment for tied results, an SVG podium
summary above the card list, and per-card collapse with the leader
expanded by default.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
