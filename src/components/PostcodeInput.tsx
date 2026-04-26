import React from "react";
import { usePostcodeLookup } from "../lib/usePostcodeLookup";

interface Props {
  knownConstituencies: string[];
  label: string;
  onResolved?: (id: string) => void;
  target?: "constituency" | "region";
  constituencyToRegion?: ReadonlyMap<string, string>;
}

export default function PostcodeInput({
  knownConstituencies,
  label,
  onResolved,
  target = "constituency",
  constituencyToRegion,
}: Props) {
  const pc = usePostcodeLookup(knownConstituencies, { constituencyToRegion });

  React.useEffect(() => {
    if (!pc.result?.found || !pc.result.covered || !onResolved) return;
    const id = target === "region" ? pc.result.regionId : pc.result.constituencyId;
    if (id) onResolved(id);
  }, [pc.result]);

  const targetMissing =
    target === "region" && pc.result?.found && pc.result.covered && !pc.result.regionId;

  return (
    <div className="mb-4">
      <p className="font-body text-xs text-gray-500 mb-2">{label}</p>
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
      {targetMissing && (
        <p className="mt-2 font-body text-xs text-amber-600">
          Found {pc.result!.constituencyName}, but we couldn't map it to a region.
        </p>
      )}
      {pc.result && !pc.result.found && (
        <p className="mt-2 font-body text-xs text-red-600">
          Couldn't find that postcode. Check the format and try again.
        </p>
      )}
    </div>
  );
}
