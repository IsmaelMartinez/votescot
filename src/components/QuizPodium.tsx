import React from "react";
import type { PartyBlock, TopTie } from "../lib/quiz-helpers";
import { scoreColor } from "../lib/score-color";

interface Props {
  blocks: PartyBlock[];
  tie: TopTie;
}

interface Slot {
  block: PartyBlock;
  rankLabel: string;
  height: number;
  tier: number;
  x: number;
}

const TALL = 120;
const MEDIUM = 80;
const SHORT = 60;
const HEIGHTS = [TALL, MEDIUM, SHORT];
const ORDINALS = ["1ST", "2ND", "3RD"];
const TIE_LABELS = ["TIED #1", "TIED #2", "TIED #3"];
const MAX_BLOCKS = 5;
const VIEWBOX_W = 360;
const VIEWBOX_H = 170;
const BLOCK_W = 80;
const GAP = 8;
const TOP_PADDING = 35;

function buildSlots(blocks: PartyBlock[], tie: TopTie): Slot[] {
  if (tie.noClearLeader) return [];
  const positioned = blocks.filter((b) => b.match.breakdown.length > 0);
  if (positioned.length < 2) return [];

  // Group consecutive blocks by equal percentage (dense ranking, max 3 tiers).
  const tiers: PartyBlock[][] = [];
  let prevPct = Number.NaN;
  for (const b of positioned) {
    if (b.match.percentage !== prevPct) {
      if (tiers.length >= 3) break;
      tiers.push([b]);
      prevPct = b.match.percentage;
    } else {
      tiers[tiers.length - 1].push(b);
    }
  }

  const collected: Omit<Slot, "x">[] = [];
  for (let t = 0; t < tiers.length; t++) {
    if (collected.length >= MAX_BLOCKS) break;
    const tied = tiers[t].length > 1;
    const label = tied ? TIE_LABELS[t] : ORDINALS[t];
    for (const block of tiers[t]) {
      if (collected.length >= MAX_BLOCKS) break;
      collected.push({ block, rankLabel: label, height: HEIGHTS[t], tier: t });
    }
  }

  const totalWidth = collected.length * BLOCK_W + (collected.length - 1) * GAP;
  const startX = (VIEWBOX_W - totalWidth) / 2;
  return collected.map((slot, i) => ({ ...slot, x: startX + i * (BLOCK_W + GAP) }));
}

export default function QuizPodium({ blocks, tie }: Props) {
  const slots = buildSlots(blocks, tie);
  if (slots.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      role="img"
      aria-label="Top matches podium"
      style={{
        display: "block",
        width: "100%",
        maxWidth: 360,
        height: "auto",
        margin: "0 auto 12px",
        background: "#faf8f5",
        borderRadius: 8,
      }}
    >
      {slots.map((slot) => {
        const top = TOP_PADDING + (TALL - slot.height);
        const isWinner = slot.tier === 0;
        const stroke = isWinner ? "#c4940a" : "#e8e4df";
        const strokeWidth = isWinner ? 2 : 1;
        const pctColor = scoreColor(slot.block.match.percentage);

        // Lay out internal text by proportion of the block's height so SHORT/MEDIUM
        // blocks don't crush content into the bottom edge.
        const trophyY = isWinner ? 30 : 0;
        const labelY = isWinner ? 60 : Math.round(slot.height * 0.32);
        const partyY = isWinner ? 82 : Math.round(slot.height * 0.55);
        const pctY = isWinner ? 104 : Math.round(slot.height * 0.82);

        return (
          <g key={`${slot.block.party}-${slot.x}`} transform={`translate(${slot.x}, ${top})`}>
            <rect
              width={BLOCK_W}
              height={slot.height}
              fill="#fff"
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <rect width={BLOCK_W} height={6} fill={slot.block.accent || slot.block.color} />
            {isWinner && (
              <text x={BLOCK_W / 2} y={trophyY} textAnchor="middle" fontSize={18}>
                🏆
              </text>
            )}
            <text
              x={BLOCK_W / 2}
              y={labelY}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={isWinner ? 10 : 9}
              fill="#888"
              fontWeight={700}
              letterSpacing={0.6}
            >
              {slot.rankLabel}
            </text>
            <text
              x={BLOCK_W / 2}
              y={partyY}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={isWinner ? 14 : 12}
              fill="#1a1a2e"
              fontWeight={900}
            >
              {slot.block.partyShort}
            </text>
            <text
              x={BLOCK_W / 2}
              y={pctY}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={isWinner ? 16 : 12}
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
