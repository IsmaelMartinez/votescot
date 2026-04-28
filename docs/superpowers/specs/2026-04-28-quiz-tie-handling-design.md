# Quiz Results Tie Handling Design

## Status

Draft, 28 April 2026.

## Overview

When two or more parties produce identical match percentages on the quiz results screen, the current UI picks an alphabetical winner silently and applies "winner" cues (a trophy emoji, a thicker accent border) to that one card. The numbers tell the user the leaders are equal; the visuals tell the user one is ahead. A user reading the screen gets a misleading impression of certainty.

A second, related problem surfaces on the regional ballot tab. Parties stand five to eight candidates each on the regional list, so a six-party result set produces 30 to 50 candidate rows plus chips and bars. The list scrolls past the user's first impression of how the parties rank.

This spec covers three changes. A card-treatment change (shared-rank treatment) makes ties honest by applying the winner cues to every party at rank 1. A new podium component (SVG summary) sits above the card list and gives users a glanceable read of the top three before they scroll. A compact card list defaults non-leader cards to a collapsed state so the full ranking fits on one screen on the regional tab.

Out of scope: an algorithmic tie-breaker that picks a winner from tied scores (genuine ties should look tied; a side-by-side grid layout for the top card tier; merged tied cards.

## Context

`src/lib/matching.ts:11` defines `calculateMatch`. It returns a `percentage` rounded to a whole integer using `Math.round(total / breakdown.length)` where each question contributes 100, 50, or 0 based on absolute distance between the user's answer and the party's position. With 8 questions and three contribution buckets, parties with identical position vectors on the answered questions produce genuine score ties. Working through the arithmetic confirms that two distinct raw means always round to two distinct integer percentages under the current scheme, so apparent ties are real ties, not rounding artefacts.

`src/lib/quiz-helpers.ts:76` sorts the party blocks by percentage descending, then by whether the party has any positions, then alphabetically by party name. The alphabetical fallback is the silent tie-breaker.

`src/components/QuizEngine.tsx:239` renders the sorted blocks. The treatment for index `0` includes a 🏆 emoji at line 257 and a `2px` accent border at line 248. Every other index gets a `1px` neutral border and no emoji. There is no concept of rank in the rendering: position 0 is privileged regardless of whether other blocks share its score.

## Decision

Three changes, layered.

### Change 1, shared-rank treatment

Compute a rank per block from the sorted list: blocks with identical `percentage` and identical has-positions status share a rank.

Apply the existing winner treatment (trophy emoji and 2px accent border) to every block at rank 1, not just index 0. When the rank-1 group has more than one member, also render a small "Tied #1" pill in the card header next to the party name.

The pill uses a translucent dark wash over the existing party header background so it works against any party colour without a per-party override:

```css
background: rgba(0,0,0,0.18);
color: inherit;
font-size: 10px;
font-weight: 800;
text-transform: uppercase;
letter-spacing: 0.06em;
```

Cards within the tied group remain in alphabetical order. The order is stable and deterministic but the visual treatment carries no rank signal between them.

### Change 2, podium summary

Render an SVG podium component (`<QuizPodium>`) above the card list. It shows up to three blocks for the top three ranks among parties with positions. Heights are fixed at three sizes (tall 120px, medium 80px, short 60px) and do not scale with score. The podium reads as ranking, not magnitude; the cards below carry the magnitude detail.

Each block contains a 6px coloured stripe at the top (the party's `accent`), a small rank label ("1ST", "2ND", "3RD", or "TIED #1" for tie groups), the party's `partyShort`, and the rounded percentage. The 1st-place block(s) carry the same trophy emoji as the matching card.

Layout rules. With no tie at #1, blocks render as 2nd-1st-3rd (left-tall-right) in classic podium order. With a 2-way tie at #1, two tall blocks render in the centre with the rank-3 party shifted to the right; there is no 2nd-place slot. With a 3-way tie at #1, three tall blocks render edge-to-edge with no other slots.

The podium is suppressed entirely when the same conditions that suppress the trophy apply: four or more parties tied at #1, or a top score of zero, or fewer than two parties with positions in the result set. In those cases the existing helper text from change 2 takes the podium's slot.

The component is React, lives in `src/components/QuizPodium.tsx`, and renders inline SVG with a `viewBox` of `0 0 360 170`. It accepts the already-sorted blocks array and reads `topTieCount` from props rather than recomputing.

### Change 3, compact card list

Cards below rank 1 collapse by default to header plus score bar. The breakdown chips and candidate list are hidden until the user expands the card. A small chevron in the header (▾ collapsed, ▴ expanded) signals the affordance and the entire header is the click target.

Rank 1 cards (or the full tied-rank-1 group) render expanded by default. The user's most likely focus is the leader, and the leader carries the trophy and accent border that the rest don't. Forcing a click to see the leader's chips and candidates would feel wrong.

The card with no positions (`breakdown.length === 0`) is treated specially: it never had chips or a bar to begin with, only candidate names. It collapses by default the same way and expands to show the candidate list. The "No quiz positions" caption stays visible in the header in either state.

State is per-card local React state (`useState<boolean>` keyed off the card's mount). There is no need to coordinate expansion across cards. Expansion does not persist across navigation away from the results screen, which is consistent with the rest of the quiz state today.

A long candidate list (more than four entries) shows the first four with a "+ N more" affordance at the bottom of the list, where N is the remaining count. This caps the vertical footprint of an expanded card at a predictable height. Clicking "+ N more" reveals the full list. The four-entry threshold is a starting point; if reviewing the live data shows it cuts off too aggressively, raise it.

### Edge cases

A tied group of four or more parties at rank 1 indicates that the quiz could not separate the field, often because the user answered too few questions or chose neutral on every axis. In that case, suppress the trophy and the "Tied #1" pill on every rank-1 card and render a single line of muted helper text above the list: "No clear leader from your answers. Try answering more questions." This is preferable to crowning half the field.

A tied group at rank 1 where every member has zero positions (`breakdown.length === 0`) keeps the existing "no quiz positions" treatment from `QuizEngine.tsx:266` and never shows a trophy. The current `hasPositions` guard at line 248 is preserved.

A tied group at rank 1 where the percentage is zero (the user's answers do not align with any party at all) is treated the same as the four-or-more case: no trophy, no pill, helper text above the list. Crowning a 0% match misrepresents the data the same way the silent winner does.

## Implementation

`src/lib/quiz-helpers.ts`: compute a `rank` field on each `PartyBlock` after the existing sort, sharing a rank across blocks whose `percentage` is equal and whose has-positions status matches. Expose a `computeTopTie(blocks)` helper that returns `{ count, topPercentage, noClearLeader }` for the rank-1 group (excluding no-positions blocks).

`src/components/QuizEngine.tsx`: derive `tie` from `computeTopTie(blocks)`. When `tie.noClearLeader` (4+ parties tied at rank 1, or top percentage is 0), render the helper text above the list and treat all blocks as non-winners; do not render the podium. Otherwise, apply the trophy and 2px border to every rank-1 block, render `<QuizPodium blocks={blocks} tie={tie} />` above the list, and when `tie.count >= 2` also render the "Tied #1" pill on each rank-1 card header.

`src/components/QuizPodium.tsx`: new component. Pure render from props, no state. SVG is inlined for crisp scaling and zero JS overhead. The component returns `null` when its preconditions fail so the caller does not need to gate it.

Card collapse logic is local to the existing block render in `QuizEngine.tsx`. Each rendered card holds its own `expanded` state, initialised to `i === 0 || isTiedRankOne`. The header becomes a button; the body renders conditionally. The "+ N more" inner toggle is a second piece of local state on the same card. No new top-level component is needed for collapse; pulling it into a `<QuizPartyCard>` is reasonable but not required for this change.

## Testing

Add unit tests in `tests/quiz-helpers.test.ts` covering:
- A clean win produces one rank-1 block.
- A genuine 2-way tie produces two rank-1 blocks in alphabetical order.
- A 4-way tie at the top is detected by `computeTopTie`.
- A tie at zero percentage is detected by `computeTopTie`.
- No-positions parties are excluded from the rank-1 tie count.

`QuizEngine` and `QuizPodium` are not unit-tested at the component level today and remain so. The sketch at `/tmp/votescot-tie-sketch.html` is the visual reference for review.

## Alternatives considered

An algorithmic tie-breaker (raw score, exact-match count, weighted distance) to silently order tied parties. An earlier draft of this spec proposed a raw-score tie-breaker. Working through the arithmetic showed it can never fire under the current 0/50/100 contribution scheme: every distinct raw score rounds to a distinct integer percentage. An exact-match-count tie-breaker would fire on real data but has no precedent in comparable vote-compass tools and rests on a value judgement (is "fully aligned on half" closer than "halfway aligned on all"?). Genuine ties should look tied; the visual treatment is the honest answer.

A side-by-side grid for the top card tier. Visually clearer on desktop but collapses to a stack on mobile, where most VoteScot traffic lands. The shared-rank treatment plus the podium summary together achieve the same honesty signal without responsive layout work on the cards.

A merged tied card with both party colours in the header. Strongest tie signal but the most disruptive layout change and gets visually busy beyond two parties.

Scaling podium block heights to the score rather than fixed tall/medium/short. Considered and rejected: it makes the podium read as a bar chart, which doubles up with the existing percentage chip and progress bar. Fixed heights keep the podium as a rank summary distinct from the magnitude detail in the cards.

Doing only the shared-rank treatment without the podium. The original draft. User feedback was that a visual summary at the top is worth the additional component, even though it duplicates information already in the cards: it gives a glanceable read before scrolling, which matters most on mobile.

Collapsing all cards by default, including rank 1. Considered and rejected. The user almost always wants the leader's reasoning visible; making them click to see it adds friction without payoff. Expanding rank 1 by default also reinforces the "this is your match" framing.

A single global "expand all" / "collapse all" affordance instead of per-card. Considered and rejected as overkill at the current density. If the regional tab proves to need it after live use, it is a small follow-up.
