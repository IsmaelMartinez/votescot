import React, { useState, useMemo } from "react";
import { calculateMatch } from "../lib/matching";
import PostcodeInput from "./PostcodeInput";
import ErrorBoundary from "./ErrorBoundary";
import type { Candidate, QuizQuestion } from "../lib/data";

interface Constituency {
  id: string;
  name: string;
  region?: string;
}

interface Region {
  id: string;
  name: string;
}

type Mode = "constituency" | "regional";

interface BaseProps {
  questions: QuizQuestion[];
  candidates: Candidate[];
  basePath: string;
}

interface ConstituencyProps extends BaseProps {
  mode: "constituency";
  constituencies: Constituency[];
  knownConstituencies: string[];
  regions?: Region[];
}

interface RegionalProps extends BaseProps {
  mode: "regional";
  regions: Region[];
  constituencies: Constituency[];
  knownConstituencies?: string[];
}

type Props = ConstituencyProps | RegionalProps;

function QuizEngineInner(props: Props) {
  const { mode, questions, candidates, basePath } = props;
  const isRegional = mode === "regional";

  const items: { id: string; name: string }[] = isRegional
    ? props.regions
    : props.constituencies;

  const queryParam = isRegional ? "region" : "constituency";

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get(queryParam) || "";
    }
    return "";
  });

  const constituencyToRegion = useMemo(() => {
    const map = new Map<string, string>();
    if (isRegional) {
      for (const c of props.constituencies) {
        if (c.region) map.set(c.id, c.region);
      }
    }
    return map;
  }, [isRegional, props.constituencies]);

  const selectedItem = items.find((i) => i.id === selected);
  const selectedName = selectedItem?.name;

  const filteredCandidates = !selected || (isRegional && !selectedName)
    ? []
    : isRegional
      ? candidates.filter((c) => constituencyToRegion.get(c.constituency) === selectedName)
      : candidates.filter((c) => c.constituency === selected);

  const answeredCount = Object.keys(answers).length;

  const ranked = filteredCandidates
    .map((c) => ({
      ...c,
      match: calculateMatch(answers, c.positions || {}),
    }))
    .sort((a, b) => b.match.percentage - a.match.percentage || a.name.localeCompare(b.name));

  const [filterText, setFilterText] = useState("");

  const filteredItems = useMemo(() => {
    const q = filterText.toLowerCase().trim();
    if (!q) return items;
    return items.filter((c) => c.name.toLowerCase().includes(q));
  }, [items, filterText]);

  const heading = isRegional ? "Vote Compass · Regional List" : "Vote Compass";
  const selectorPrompt = isRegional
    ? "Select your region to get started."
    : "Select your constituency to get started.";
  const browsePrompt = isRegional ? "Browse regions:" : "Or browse constituencies:";
  const filterPlaceholder = isRegional ? "Filter regions…" : "Filter constituencies…";
  const changeLabel = isRegional ? "Change region" : "Change constituency";

  if (!selected) {
    return (
      <div className="py-3.5">
        <h2 className="font-heading text-lg font-black mb-1">{heading}</h2>
        <p className="font-body text-[12.5px] text-gray-500 leading-snug mb-4">
          {selectorPrompt}
        </p>

        {isRegional && (
          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-4 font-body text-xs text-blue-700">
            Scottish Parliament uses two ballots: constituency and regional list. We don't yet model separate regional list candidates, so these matches show all candidates standing in your region based on party platforms.
          </div>
        )}

        {isRegional ? (
          <PostcodeInput
            knownConstituencies={props.knownConstituencies ?? props.constituencies.map((c) => c.id)}
            label="Enter your postcode to find your region automatically"
            target="region"
            constituencyToRegion={constituencyToRegion}
            onResolved={(id) => setSelected(id)}
          />
        ) : (
          <PostcodeInput
            knownConstituencies={props.knownConstituencies}
            label="Enter your postcode to find your constituency automatically"
            onResolved={(id) => setSelected(id)}
          />
        )}

        <p className="font-body text-xs text-gray-500 mb-2">{browsePrompt}</p>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={filterPlaceholder}
          className="w-full bg-white border border-votescot-border rounded-lg px-3.5 py-2.5 font-body text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-votescot-gold transition-colors mb-3"
        />
        <div className="flex flex-col gap-2">
          {filteredItems.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className="text-left bg-white rounded-lg p-3.5 border border-votescot-border hover:border-votescot-gold transition-colors cursor-pointer font-body text-sm font-bold"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="py-3.5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
          <div>
            <h2 className="font-heading text-lg font-black m-0">Your Matches</h2>
            <div className="font-body text-xs text-gray-400">{selectedName}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setSelected(""); setShowResults(false); setAnswers({}); }}
              className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
            >
              {changeLabel}
            </button>
            <button
              onClick={() => { setShowResults(false); setAnswers({}); }}
              className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
            >
              Reset quiz
            </button>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-3 font-body text-xs text-blue-700">
          Policy positions shown are based on party platforms, so candidates from the same party will share identical match scores. Individual candidates may hold different views.
        </div>
        <p className="font-body text-xs text-gray-400 mb-4">
          Based on {answeredCount} of {questions.length} questions answered. The more you answer, the better the match.
        </p>

        {isRegional && selectedItem && (
          <div className="mb-3 text-center">
            <a
              href={`${basePath}candidates/region/${selectedItem.id}`}
              className="inline-block px-4 py-2 bg-white border border-votescot-border rounded-lg font-body text-sm font-bold text-gray-700 no-underline hover:border-votescot-gold"
            >
              View all candidates in {selectedName} →
            </a>
          </div>
        )}

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
                    style={{ background: cand.textColor ? cand.accent : cand.color, border: `2px solid ${cand.accent}` }}
                  />
                  <div>
                    <span className="font-heading font-black text-sm">{cand.name}</span>
                    <span className="font-body text-xs text-gray-400 ml-1.5">{cand.party}</span>
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

              <p className="font-body text-xs text-gray-500 leading-snug">{cand.bio}</p>
              <a
                href={`${basePath}candidates/${cand.id}`}
                className="inline-block mt-2 bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-500 no-underline hover:border-gray-400"
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
      <div className="flex items-center justify-between mb-1 flex-wrap gap-1.5">
        <h2 className="font-heading text-lg font-black m-0">{heading}{selectedName ? ` · ${selectedName}` : ""}</h2>
        <button
          onClick={() => { setSelected(""); setAnswers({}); }}
          className="bg-transparent border border-gray-300 rounded px-3 py-1 font-body text-xs text-gray-400 cursor-pointer"
        >
          {changeLabel}
        </button>
      </div>
      <p className="font-body text-[12.5px] text-gray-500 leading-snug mb-3">
        Answer 8 questions about what matters to you. We'll match you to the candidate closest to your
        views. No data is stored. This runs entirely in your browser.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-4 font-body text-xs text-blue-700">
        Candidate positions are based on party platforms, not individual views. Candidates from the same party will share the same match score.
      </div>

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
