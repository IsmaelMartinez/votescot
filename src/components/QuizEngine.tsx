import React, { useState } from "react";
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
