import { useState } from "react";
import { slugifyConstituency } from "./slugify";

interface PostcodeLookupResult {
  found: boolean;
  constituencyId?: string;
  constituencyName?: string;
  regionId?: string;
  regionName?: string;
  covered?: boolean;
}

interface Options {
  constituencyToRegion?: ReadonlyMap<string, string>;
}

export function usePostcodeLookup(knownConstituencies: string[], options: Options = {}) {
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PostcodeLookupResult | null>(null);

  async function lookup() {
    const clean = postcode.replace(/\s/g, "").toUpperCase();
    setResult(null);
    if (clean.length < 5) return;

    setLoading(true);

    try {
      const response = await fetch(
        `https://mapit.mysociety.org/postcode/${encodeURIComponent(clean)}`
      );
      if (!response.ok) throw new Error("Postcode not found");

      const data = await response.json();
      const areas = Object.values(data.areas) as any[];
      const area = areas.find((a) => a.type === "SPCF") || areas.find((a) => a.type === "SPC");

      if (!area) {
        setResult({ found: false });
        return;
      }

      const constituencyId = slugifyConstituency(area.name);
      const covered = knownConstituencies.includes(constituencyId);
      const regionName = options.constituencyToRegion?.get(constituencyId);
      const regionId = regionName ? slugifyConstituency(regionName) : undefined;

      setResult({
        found: true,
        constituencyId,
        constituencyName: area.name,
        regionId,
        regionName,
        covered,
      });
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  }

  return { postcode, setPostcode, lookup, loading, result };
}
