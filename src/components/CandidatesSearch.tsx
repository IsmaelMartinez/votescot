import React from "react";
import SearchFilter, { type SearchItem } from "./SearchFilter";
import { usePostcodeLookup } from "../lib/usePostcodeLookup";

interface Props {
  items: SearchItem[];
  knownConstituencies: string[];
  basePath: string;
}

export default function CandidatesSearch({ items, knownConstituencies, basePath }: Props) {
  const pc = usePostcodeLookup(knownConstituencies);

  const handleSelect = (item: SearchItem) => {
    if (item.id.startsWith("constituency:")) {
      const slug = item.id.replace("constituency:", "");
      window.location.href = `${basePath}candidates/constituency/${slug}`;
    } else {
      const id = item.id.replace("candidate:", "");
      window.location.href = `${basePath}candidates/${id}`;
    }
  };

  React.useEffect(() => {
    if (pc.result?.found && pc.result.covered && pc.result.constituencyId) {
      window.location.href = `${basePath}candidates/constituency/${pc.result.constituencyId}`;
    }
  }, [pc.result, basePath]);

  return (
    <div>
      <div className="mb-4">
        <p className="font-body text-xs text-gray-500 mb-2">
          Enter your postcode to find your constituency's candidates
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pc.postcode}
            onChange={(e) => pc.setPostcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pc.lookup()}
            placeholder="e.g. EH1 1BB"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-body text-sm focus:outline-none focus:border-votescot-gold"
          />
          <button
            onClick={pc.lookup}
            disabled={pc.loading}
            className="px-4 py-2 bg-votescot-dark text-white rounded-md font-body text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {pc.loading ? "..." : "Find"}
          </button>
        </div>
        {pc.result?.found && !pc.result.covered && (
          <p className="mt-2 font-body text-xs text-amber-600">
            Found {pc.result.constituencyName}, but it doesn't match our records.
          </p>
        )}
        {pc.result && !pc.result.found && (
          <p className="mt-2 font-body text-xs text-red-600">
            Couldn't find that postcode. Check the format and try again.
          </p>
        )}
      </div>

      <p className="font-body text-xs text-gray-500 mb-2">Or search by name:</p>
      <SearchFilter
        placeholder="Search by constituency or candidate name…"
        items={items}
        onSelect={handleSelect}
      />
    </div>
  );
}
