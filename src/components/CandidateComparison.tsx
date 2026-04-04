import React, { useState } from "react";
import type { Candidate, QuizQuestion } from "../lib/data";

interface Constituency {
  id: string;
  name: string;
}

interface Props {
  candidates: Candidate[];
  questions: QuizQuestion[];
  constituencies: Constituency[];
}

export default function CandidateComparison({ candidates, questions, constituencies }: Props) {
  const [selectedConstituency, setSelectedConstituency] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("constituency") || "";
    }
    return "";
  });

  const filteredCandidates = selectedConstituency
    ? candidates.filter((c) => c.constituency === selectedConstituency && c.quizCandidate)
    : [];

  const selectedConstituencyName = constituencies.find((c) => c.id === selectedConstituency)?.name;

  if (!selectedConstituency) {
    return (
      <div className="py-3.5">
        <h2 className="font-heading text-base font-black mb-1">Side-by-Side Comparison</h2>
        <p className="font-body text-[11.5px] text-gray-400 mb-3">
          Select your constituency to compare candidates.
        </p>
        <div className="flex flex-col gap-2">
          {constituencies.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedConstituency(c.id)}
              className="text-left bg-white rounded-lg p-3.5 border border-votescot-border hover:border-votescot-gold transition-colors cursor-pointer font-body text-sm font-bold"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-1.5">
        <div>
          <h2 className="font-heading text-base font-black m-0">Side-by-Side Comparison</h2>
          <div className="font-body text-[11px] text-gray-400">{selectedConstituencyName}</div>
        </div>
        <button
          onClick={() => setSelectedConstituency("")}
          className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-[11px] text-gray-400 cursor-pointer"
        >
          Change constituency
        </button>
      </div>
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
              {filteredCandidates.map((cand) => (
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
                      {cand.stances?.[q.id] ?? "No stance recorded"}
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
