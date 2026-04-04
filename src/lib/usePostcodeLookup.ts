import { useState } from "react";
import { slugifyConstituency } from "./slugify";

interface PostcodeLookupResult {
  found: boolean;
  constituencyId?: string;
  constituencyName?: string;
  covered?: boolean;
}

export function usePostcodeLookup(knownConstituencies: string[]) {
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PostcodeLookupResult | null>(null);

  async function lookup() {
    const clean = postcode.replace(/\s/g, "").toUpperCase();
    if (clean.length < 5) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `https://mapit.mysociety.org/postcode/${encodeURIComponent(clean)}`
      );
      if (!response.ok) throw new Error("Postcode not found");

      const data = await response.json();

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

      const constituencyId = slugifyConstituency(constituency.name);
      const covered = knownConstituencies.includes(constituencyId);

      setResult({ found: true, constituencyId, constituencyName: constituency.name, covered });
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  }

  return { postcode, setPostcode, lookup, loading, result };
}
