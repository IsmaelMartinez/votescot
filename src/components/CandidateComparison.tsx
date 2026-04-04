import React, { useState, useMemo } from "react";
import ErrorBoundary from "./ErrorBoundary";
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

function CandidateComparisonInner({ candidates, questions, constituencies }: Props) {
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

  const [constituencyFilter, setConstituencyFilter] = useState("");

  const filteredConstituencies = useMemo(() => {
    const q = constituencyFilter.toLowerCase().trim();
    if (!q) return constituencies;
    return constituencies.filter((c) => c.name.toLowerCase().includes(q));
  }, [constituencies, constituencyFilter]);

  if (!selectedConstituency) {
    return (
      <div className="py-3.5">
        <h2 className="font-heading text-base font-black mb-1">Side-by-Side Comparison</h2>
        <p className="font-body text-xs text-gray-400 mb-3">
          Select your constituency to compare candidates.
        </p>
        <input
          type="text"
          value={constituencyFilter}
          onChange={(e) => setConstituencyFilter(e.target.value)}
          placeholder="Filter constituencies…"
          className="w-full bg-white border border-votescot-border rounded-lg px-3.5 py-2.5 font-body text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-votescot-gold transition-colors mb-3"
        />
        <div className="flex flex-col gap-2">
          {filteredConstituencies.map((c) => (
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
          <div className="font-body text-xs text-gray-400">{selectedConstituencyName}</div>
        </div>
        <button
          onClick={() => setSelectedConstituency("")}
          className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
        >
          Change constituency
        </button>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-3 font-body text-xs text-blue-700">
        Policy positions shown are based on party platforms. Individual candidates may hold different views.
      </div>
      <p className="font-body text-xs text-gray-400 mb-3">
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
                    style={{ background: cand.textColor ? cand.accent : cand.color, border: `1.5px solid ${cand.accent}` }}
                  />
                  <div>
                    <span className="font-body text-xs font-bold text-gray-600">
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

export default function CandidateComparison(props: Props) {
  return <ErrorBoundary><CandidateComparisonInner {...props} /></ErrorBoundary>;
}
