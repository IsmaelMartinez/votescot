import React, { useState, useMemo } from "react";
import PostcodeInput from "./PostcodeInput";
import ErrorBoundary from "./ErrorBoundary";
import QuizPodium from "./QuizPodium";
import PartyResultCard from "./PartyResultCard";
import type { Candidate, QuizQuestion, RegionalCandidate } from "../lib/data";
import {
  buildPartyBlocks,
  buildConstituencyToRegion,
  resolveInitialSelection,
  computeTopTie,
  type PartyBlock,
} from "../lib/quiz-helpers";
import { scoreColor } from "../lib/score-color";

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
        <p className="font-body text-[12.5px] text-gray-500 leading-snug mb-3">
          Select your constituency to get started. We'll match you on both the constituency and regional ballots.
        </p>

        <div className="mb-4 p-2.5 bg-votescot-paper rounded border border-votescot-border font-body text-[12px] text-gray-500 leading-snug">
          One tool among several. Positions come from published party platforms and don't capture every local candidate factor. Read manifestos and{" "}
          <a href={`${basePath}guide#resources`} className="text-votescot-gold">compare with other guides and quizzes</a>{" "}
          before you decide.
        </div>

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
    const tie = computeTopTie(blocks);
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

        {tie.noClearLeader && (
          <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            No clear leader from your answers. Try answering more questions for a sharper match.
          </p>
        )}

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

        <QuizPodium blocks={blocks} tie={tie} />

        <div className="flex flex-col gap-2">
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
        </div>

        <div className="mt-3.5 p-3 bg-votescot-dark rounded-lg font-body text-xs text-gray-300 leading-relaxed text-center">
          A starting point, not a verdict. Explore the{" "}
          <a href={`${basePath}candidates`} className="text-votescot-gold">candidate profiles</a>, or read{" "}
          <a href={`${basePath}guide#resources`} className="text-votescot-gold">party manifestos and other guides</a>{" "}
          to broaden the picture.
        </div>
      </div>
    );
  }

  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-1.5">
        <h2 className="font-heading text-lg font-black m-0">
          Vote Compass{selectedConstituency ? ` · ${selectedConstituency.name}` : ""}
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
        views on both the constituency and regional ballots. No data is stored. This runs entirely in your browser.
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
