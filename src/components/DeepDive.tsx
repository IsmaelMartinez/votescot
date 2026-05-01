import React, { useState, useRef, useEffect } from "react";
import ErrorBoundary from "./ErrorBoundary";

interface Candidate {
  id: string;
  name: string;
  party: string;
  constituency: string;
  color: string;
  accent: string;
}

interface Props {
  candidate: Candidate;
}

function DeepDiveInner({ candidate }: Props) {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      // BYOK: the user-supplied Anthropic key is stored in sessionStorage so
      // it persists for the tab only and is cleared when the tab closes. The
      // UI explicitly tells the user "Your key stays in this tab only" — we
      // never transmit it to a votescot server. sessionStorage is the
      // narrowest browser-only persistence available; encrypting it client
      // side would require a key that itself lives in the same browser, so
      // it offers no real protection.
      return sessionStorage.getItem("votescot-api-key") || "";
    }
    return "";
  });
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function runAnalysis() {
    if (!apiKey.trim()) {
      setError("Please enter your Anthropic API key.");
      return;
    }

    // codeql[js/clear-text-storage-of-sensitive-data]: BYOK pattern — the key
    // is user-supplied at runtime and intentionally persisted to
    // sessionStorage (tab-scoped) so the user does not have to re-paste it
    // for every analysis in the same session. See note above.
    sessionStorage.setItem("votescot-api-key", apiKey);
    setLoading(true);
    setError(null);
    setAnalysis("");
    abortRef.current = new AbortController();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a neutral political analyst for the ${candidate.constituency} constituency in the 2026 Scottish Parliament election. Analyse ${candidate.name} (${candidate.party}), standing in ${candidate.constituency}. Cover: 1) What they actually stand for: key policies and values. 2) Track record: what have they delivered or failed to deliver? 3) Strengths and weaknesses as a candidate. 4) 3 specific questions a voter should ask at a hustings. Be balanced and factual. Avoid em dashes; use periods, commas, or colons instead. ~350 words. Use ** for section headers.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(
        data.content?.map((block: { text?: string }) => block.text || "").join("\n") ||
          "No analysis available.",
      );
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message || "Analysis unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  function formatAnalysis(text: string) {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (/^\*\*.*\*\*$/.test(trimmed)) {
        return (
          <h4 key={i} className="font-body font-black text-[13.5px] text-gray-800 mt-3 mb-1">
            {trimmed.replace(/\*\*/g, "")}
          </h4>
        );
      }
      if (trimmed === "") return <br key={i} />;
      if (line.includes("**")) {
        const parts = line.split("**");
        return (
          <p key={i} className="font-body text-[13px] text-gray-700 leading-snug my-0.5">
            {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
          </p>
        );
      }
      return (
        <p key={i} className="font-body text-[13px] text-gray-700 leading-snug my-0.5">
          {line}
        </p>
      );
    });
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-votescot-border max-w-xl">
      <div className="font-body text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">
        AI analysis via Claude &bull; Not a recommendation &bull; Your key stays in this tab only
      </div>

      {!analysis && !loading && (
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
            placeholder="sk-ant-..."
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded font-body text-xs focus:outline-none focus:border-votescot-gold"
          />
          <button
            onClick={runAnalysis}
            className="px-3 py-1.5 bg-votescot-dark text-white rounded font-body text-xs font-bold hover:bg-gray-800"
          >
            Analyse
          </button>
        </div>
      )}

      {loading && (
        <div className="py-6 text-center font-body text-[13px] text-gray-500">
          Analysing {candidate.name}...
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded font-body text-xs text-red-700">
          {error}
        </div>
      )}

      {analysis && <div className="mt-2">{formatAnalysis(analysis)}</div>}
    </div>
  );
}

export default function DeepDive(props: Props) {
  return <ErrorBoundary><DeepDiveInner {...props} /></ErrorBoundary>;
}
