import React, { useState, useMemo } from "react";
import PostcodeInput from "./PostcodeInput";
import ErrorBoundary from "./ErrorBoundary";
import type { Candidate, QuizQuestion, RegionalCandidate } from "../lib/data";
import {
  buildPartyBlocks,
  buildConstituencyToRegion,
  resolveInitialSelection,
  type PartyBlock,
} from "../lib/quiz-helpers";

interface Constituency {
  id: string;
  name: string;
  region?: string;
}

interface Region {
  id: string;
  name: string;
}

interface Props {
  questions: QuizQuestion[];
  constituencyCandidates: Candidate[];
  regionalCandidates: RegionalCandidate[];
  constituencies: Constituency[];
  regions: Region[];
  knownConstituencies: string[];
  basePath: string;
}

function scoreColor(percentage: number): string {
  if (percentage >= 70) return "#2d8a4e";
  if (percentage >= 40) return "#c4940a";
  return "#c0392b";
}

function QuizEngineInner(props: Props) {
  const {
    questions,
    constituencyCandidates,
    regionalCandidates,
    constituencies,
    regions,
    knownConstituencies,
    basePath,
  } = props;

  const constituencyToRegion = useMemo(
    () => buildConstituencyToRegion(constituencies, regions),
    [constituencies, regions]
  );

  const constituenciesById = useMemo(() => {
    const map = new Map<string, Constituency>();
    for (const c of constituencies) map.set(c.id, c);
    return map;
  }, [constituencies]);

  const regionsById = useMemo(() => {
    const map = new Map<string, Region>();
    for (const r of regions) map.set(r.id, r);
    return map;
  }, [regions]);

  const initial = useMemo(() => {
    const params = typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
    return resolveInitialSelection(params, constituencies, regions, constituencyToRegion);
  }, [constituencies, regions, constituencyToRegion]);

  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>(initial.constituencyId);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(initial.regionId);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState<"constituency" | "regional">(initial.inboundRegional ? "regional" : "constituency");
  const [filterText, setFilterText] = useState("");

  const selectedConstituency = selectedConstituencyId ? constituenciesById.get(selectedConstituencyId) : undefined;
  const selectedRegion = selectedRegionId ? regionsById.get(selectedRegionId) : undefined;

  const answeredCount = Object.keys(answers).length;

  function pickConstituency(id: string) {
    setSelectedConstituencyId(id);
    const regionId = constituencyToRegion.get(id) ?? "";
    setSelectedRegionId(regionId);
  }

  function reset() {
    setSelectedConstituencyId("");
    setSelectedRegionId("");
    setAnswers({});
    setShowResults(false);
    setActiveTab("constituency");
  }

  const constituencyBlocks = useMemo<PartyBlock[]>(() => {
    if (!selectedConstituencyId) return [];
    const inScope = constituencyCandidates.filter((c) => c.constituency === selectedConstituencyId);
    return buildPartyBlocks(inScope, "constituency", answers);
  }, [selectedConstituencyId, constituencyCandidates, answers]);

  const regionalBlocks = useMemo<PartyBlock[]>(() => {
    if (!selectedRegionId) return [];
    const inScope = regionalCandidates.filter((c) => c.region === selectedRegionId);
    return buildPartyBlocks(inScope, "regional", answers);
  }, [selectedRegionId, regionalCandidates, answers]);

  const filteredConstituencies = useMemo(() => {
    const q = filterText.toLowerCase().trim();
    if (!q) return constituencies;
    return constituencies.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.region ?? "").toLowerCase().includes(q)
    );
  }, [constituencies, filterText]);

  if (!selectedConstituencyId) {
    return (
      <div className="py-3.5">
        <h2 className="font-heading text-lg font-black mb-1">Vote Compass</h2>
        <p className="font-body text-[12.5px] text-gray-500 leading-snug mb-4">
          Select your constituency to get started. We'll match you on both the constituency and regional ballots.
        </p>

        <PostcodeInput
          knownConstituencies={knownConstituencies}
          label="Enter your postcode to find your constituency automatically"
          onResolved={(id) => pickConstituency(id)}
        />

        <p className="font-body text-xs text-gray-500 mb-2">Or browse constituencies:</p>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter constituencies…"
          className="w-full bg-white border border-votescot-border rounded-lg px-3.5 py-2.5 font-body text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-votescot-gold transition-colors mb-3"
        />
        <div className="flex flex-col gap-2">
          {filteredConstituencies.map((c) => (
            <button
              key={c.id}
              onClick={() => pickConstituency(c.id)}
              className="text-left bg-white rounded-lg p-3.5 border border-votescot-border hover:border-votescot-gold transition-colors cursor-pointer font-body"
            >
              <div className="text-sm font-bold text-gray-800">{c.name}</div>
              {c.region && (
                <div className="text-xs text-gray-500 mt-0.5">{c.region} region</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (showResults) {
    const blocks = activeTab === "regional" ? regionalBlocks : constituencyBlocks;
    const profileBase = activeTab === "regional" ? `${basePath}candidates/regional/` : `${basePath}candidates/`;
    const isRegionalTab = activeTab === "regional";
    return (
      <div className="py-3.5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
          <div>
            <h2 className="font-heading text-lg font-black m-0">Your Matches</h2>
            <div className="font-body text-xs text-gray-400">
              {selectedConstituency?.name}
              {selectedRegion ? ` · ${selectedRegion.name} region` : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
            >
              Change constituency
            </button>
            <button
              onClick={() => { setShowResults(false); setAnswers({}); }}
              className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
            >
              Reset quiz
            </button>
          </div>
        </div>

        <div
          className="flex gap-0 border-b-2 border-gray-300 mb-4 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label="Ballot results"
        >
          {(["constituency", "regional"] as const).map((tab) => {
            const label = tab === "constituency" ? "Constituency ballot" : "Regional list";
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={[
                  "shrink-0 px-3.5 py-2 font-body text-xs font-medium uppercase tracking-wider -mb-[2px] cursor-pointer bg-transparent",
                  isActive
                    ? "border-b-[3px] border-votescot-gold text-gray-900 font-bold"
                    : "border-b-[3px] border-transparent text-gray-400 hover:text-gray-600",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className="font-body text-xs text-gray-400 mb-4">
          Based on {answeredCount} of {questions.length} questions answered. The more you answer, the better the match.
        </p>

        {isRegionalTab && selectedRegion && (
          <div className="mb-3 text-center">
            <a
              href={`${basePath}candidates/region/${selectedRegion.id}`}
              className="inline-block px-4 py-2 bg-white border border-votescot-border rounded-lg font-body text-sm font-bold text-gray-700 no-underline hover:border-votescot-gold"
            >
              View all candidates in {selectedRegion.name} →
            </a>
          </div>
        )}

        {isRegionalTab && !selectedRegion && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg font-body text-xs text-amber-700">
            We couldn't map your constituency to a regional list. Constituency results above still apply.
          </div>
        )}

        <div className="flex flex-col gap-2">
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
                  {hasPositions ? (
                    <div className="font-body text-xl font-black" style={{ color: scoreColor(p.match.percentage), background: "#fff", padding: "0 8px", borderRadius: 4 }}>
                      {p.match.percentage}%
                    </div>
                  ) : (
                    <div className="font-body text-xs opacity-80">No quiz positions</div>
                  )}
                </div>

                <div className="px-3 py-2.5">
                  {hasPositions && (
                    <>
                      <div className="w-full h-1.5 bg-votescot-border rounded-full overflow-hidden mb-2.5">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${p.match.percentage}%`,
                            background: scoreColor(p.match.percentage),
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {p.match.breakdown.map(({ questionId, diff }) => {
                          const q = questions.find((q) => q.id === questionId);
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
                    </>
                  )}

                  <ol className="m-0 p-0 list-none">
                    {p.candidates.map((c) => (
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
                </div>
              </div>
            );
          })}
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
      <div className="flex items-center justify-between mb-1 flex-wrap gap-1.5">
        <h2 className="font-heading text-lg font-black m-0">
          Vote Compass{selectedConstituency ? ` — ${selectedConstituency.name}` : ""}
        </h2>
        <button
          onClick={reset}
          className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
        >
          Change constituency
        </button>
      </div>
      <p className="font-body text-[12.5px] text-gray-500 leading-snug mb-3">
        Answer 8 questions about what matters to you. We'll match you to the candidates closest to your
        views on both the constituency and regional ballots. No data is stored — this runs entirely in your browser.
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
            <div className="font-body text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              {qi + 1}/{questions.length} &bull; {q.area}
            </div>
            <div id={`question-${q.id}`} className="font-heading text-[15px] font-bold mb-2.5 leading-tight">{q.question}</div>
            <div
              className="flex flex-col gap-1.5"
              role="radiogroup"
              aria-labelledby={`question-${q.id}`}
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
                e.preventDefault();
                const buttons = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[role=radio]");
                const current = Array.from(buttons).indexOf(e.target as HTMLElement);
                if (current < 0) return;
                const next = e.key === "ArrowDown"
                  ? (current + 1) % buttons.length
                  : (current - 1 + buttons.length) % buttons.length;
                buttons[next].focus();
              }}
            >
              {q.options.map((opt, optIdx) => {
                const isChecked = answers[q.id] === opt.value;
                const checkedIdx = q.options.findIndex((o) => o.value === answers[q.id]);
                const isFocusable = isChecked || (checkedIdx === -1 && optIdx === 0);
                return (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={isChecked}
                  tabIndex={isFocusable ? 0 : -1}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                  className="text-left rounded-md px-3 py-2 cursor-pointer font-body text-[13px] leading-snug transition-all"
                  style={{
                    background: isChecked ? "#1a1a2e" : "#faf8f5",
                    color: isChecked ? "#fff" : "#444",
                    border: isChecked ? "2px solid #1a1a2e" : "1px solid #ddd",
                    fontWeight: isChecked ? 700 : 400,
                  }}
                >
                  {opt.label}
                </button>);
              })}
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

export default function QuizEngine(props: Props) {
  return <ErrorBoundary><QuizEngineInner {...props} /></ErrorBoundary>;
}
