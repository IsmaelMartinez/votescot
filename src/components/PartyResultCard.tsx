import React, { useState } from "react";
import type { PartyBlock } from "../lib/quiz-helpers";
import type { QuizQuestion } from "../lib/data";
import { scoreColor } from "../lib/score-color";

interface Props {
  block: PartyBlock;
  isWinner: boolean;
  showTiedPill: boolean;
  isRegionalTab: boolean;
  profileBase: string;
  questions: QuizQuestion[];
}

const CANDIDATE_PREVIEW = 4;

export default function PartyResultCard({ block: p, isWinner, showTiedPill, isRegionalTab, profileBase, questions }: Props) {
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
              aria-label={`Match score ${p.match.percentage} percent`}
            >
              {p.match.percentage}%
            </div>
          ) : (
            <div className="font-body text-xs opacity-95">No quiz positions</div>
          )}
          <span className="font-body text-sm opacity-90" aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {hasPositions && (
        <div className="px-3 pt-2 pb-1">
          <div className="w-full h-1.5 bg-gray-300 rounded-full overflow-hidden" role="presentation">
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
                const label = diff === 0 ? "Aligned" : diff === 1 ? "Partial match" : "Differs";
                return (
                  <span
                    key={questionId}
                    className="font-body text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{
                      background: diff === 0 ? "#e8f5e9" : diff === 1 ? "#fff8e1" : "#fce4ec",
                      color: diff === 0 ? "#1f7a3f" : diff === 1 ? "#8a6708" : "#a02a1f",
                    }}
                  >
                    <span aria-hidden="true">{diff === 0 ? "✓" : diff === 1 ? "~" : "✗"} </span>
                    <span className="sr-only">{label} on </span>
                    {q?.area}
                  </span>
                );
              })}
            </div>
          )}

          <ol className="m-0 p-0 list-none">
            {visibleCandidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-1 border-b border-gray-200 last:border-0">
                {isRegionalTab && (
                  <span className="font-body text-xs font-bold text-gray-700 w-5 text-right shrink-0">{c.listPosition}</span>
                )}
                <a
                  href={`${profileBase}${c.id}`}
                  className="font-body text-[13px] text-gray-800 underline hover:text-votescot-gold-text flex-1"
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
              className="w-full text-center font-body text-xs text-gray-700 hover:text-gray-900 cursor-pointer pt-1.5 mt-1.5 border-t border-gray-200 bg-transparent min-h-6"
            >
              + {hiddenCount} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
