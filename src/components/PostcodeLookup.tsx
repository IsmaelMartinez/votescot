import React, { useState } from "react";

interface Props {
  postcodeSectors: Record<string, string[]>;
  basePath: string;
}

export default function PostcodeLookup({ postcodeSectors, basePath }: Props) {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<{ found: boolean; constituency?: string } | null>(null);

  function normalise(pc: string): string {
    return pc.toUpperCase().replace(/\s+/g, " ").trim();
  }

  function extractSector(pc: string): string {
    const clean = normalise(pc).replace(/\s/g, "");
    if (clean.length < 5) return clean;
    const inward = clean.slice(-3);
    const outward = clean.slice(0, -3);
    return `${outward} ${inward[0]}`;
  }

  function lookup() {
    const sector = extractSector(postcode);
    for (const [constituencyId, sectors] of Object.entries(postcodeSectors)) {
      if (sectors.includes(sector)) {
        setResult({ found: true, constituency: constituencyId });
        return;
      }
    }
    setResult({ found: false });
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
          placeholder="e.g. EH12 5NR"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-body text-sm focus:outline-none focus:border-votescot-gold"
        />
        <button
          onClick={lookup}
          className="px-4 py-2 bg-votescot-dark text-white rounded-md font-body text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          Find
        </button>
      </div>
      {result?.found && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md font-body text-sm">
          You're in <strong>Edinburgh Central</strong>!{" "}
          <a href={`${basePath}quiz`} className="text-blue-600 underline font-semibold">
            Take the vote compass →
          </a>
        </div>
      )}
      {result && !result.found && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md font-body text-sm">
          We don't have data for your constituency yet. We're starting with Edinburgh Central and expanding.
          Check <a href="https://boundaries.scot" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Boundaries Scotland</a> to find your constituency.
        </div>
      )}
    </div>
  );
}
