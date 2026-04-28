import React, { useState } from "react";
import { slugifyConstituency } from "../lib/slugify";
import ErrorBoundary from "./ErrorBoundary";

interface Props {
  knownConstituencies: string[];
  basePath: string;
}

function PostcodeLookupInner({ knownConstituencies, basePath }: Props) {
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    constituencyId?: string;
    constituencyName?: string;
    covered?: boolean;
  } | null>(null);

  async function lookup() {
    const clean = postcode.replace(/\s/g, "").toUpperCase();
    if (clean.length < 5) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`https://mapit.mysociety.org/postcode/${encodeURIComponent(clean)}`);
      if (!response.ok) throw new Error("Postcode not found");

      const data = await response.json();

      // Find the future Scottish Parliament constituency (SPCF)
      // Fall back to current (SPC) if SPCF not available
      let constituency: { name: string; id: string } | null = null;
      for (const area of Object.values(data.areas) as any[]) {
        if (area.type === "SPCF") {
          constituency = { name: area.name, id: area.codes?.gss || "" };
          break;
        }
      }
      if (!constituency) {
        for (const area of Object.values(data.areas) as any[]) {
          if (area.type === "SPC") {
            constituency = { name: area.name, id: area.codes?.gss || "" };
            break;
          }
        }
      }

      if (!constituency) {
        setResult({ found: false });
        return;
      }

      // Convert constituency name to our ID format
      const constituencyId = slugifyConstituency(constituency.name);
      const covered = knownConstituencies.includes(constituencyId);

      setResult({
        found: true,
        constituencyId,
        constituencyName: constituency.name,
        covered,
      });
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-votescot-border">
      <label className="block font-heading font-bold text-base mb-2">
        Enter your postcode
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={postcode}
          onChange={(e) => { setPostcode(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="e.g. EH1 1BB"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-body text-sm focus:outline-none focus:border-votescot-gold"
        />
        <button
          onClick={lookup}
          disabled={loading}
          className="px-4 py-2 bg-votescot-dark text-white rounded-md font-body text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Find"}
        </button>
      </div>
      {result?.found && result.covered && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md font-body text-sm">
          You're in <strong>{result.constituencyName}</strong>!{" "}
          <a href={`${basePath}quiz?constituency=${result.constituencyId}`} className="text-blue-600 underline font-semibold">
            Take the vote compass →
          </a>{" "}
          or{" "}
          <a href={`${basePath}candidates/constituency/${result.constituencyId}`} className="text-blue-600 underline font-semibold">
            see your candidates →
          </a>
        </div>
      )}
      {result?.found && !result.covered && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md font-body text-sm">
          You're in <strong>{result.constituencyName}</strong>. We couldn't match this to our data. The constituency name may differ from our records.
          Try <a href="https://whocanivotefor.co.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">WhoCanIVoteFor</a> for your candidates.
        </div>
      )}
      {result && !result.found && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md font-body text-sm">
          Couldn't find that postcode. Check the format (e.g. EH1 1BB) and try again, or use{" "}
          <a href="https://boundaries.scot" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Boundaries Scotland</a>.
        </div>
      )}
      <div className="mt-2 font-body text-xs text-gray-400">
        Postcode lookup via <a href="https://mapit.mysociety.org/" target="_blank" rel="noopener noreferrer" className="underline">MapIt</a> using 2026 boundary data (SPCF)
      </div>
    </div>
  );
}

export default function PostcodeLookup(props: Props) {
  return <ErrorBoundary><PostcodeLookupInner {...props} /></ErrorBoundary>;
}
