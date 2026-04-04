import React from "react";
import type { Candidate, QuizQuestion } from "../lib/data";

interface Props {
  candidates: Candidate[];
  questions: QuizQuestion[];
}

export default function CandidateComparison({ candidates, questions }: Props) {
  const quizCandidates = candidates.filter((c) => c.quizCandidate);
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
              {quizCandidates.map((cand) => (
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
