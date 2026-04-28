import fs from "node:fs";
import path from "node:path";
import { matchPartyId } from "../src/lib/party-match";

// Authoritative party websites taken from data/manifestos/registry.yaml — these
// are the same hosts /sync-manifestos already fetches from, so they're known
// to resolve. Major-six only; the long-tail parties keep their existing source
// in this pass and are left for a future per-candidate enrichment.
const PARTY_WEBSITES: Record<string, string> = {
  "scottish-national-party": "https://www.snp.org/",
  "scottish-labour": "https://scottishlabour.org.uk/",
  "scottish-conservatives": "https://www.scottishconservatives.com/",
  "scottish-liberal-democrats": "https://www.scotlibdems.org.uk/",
  "scottish-green-party": "https://greens.scot/",
  "reform-uk": "https://www.reformparty.uk/",
};

const DC_API_PREFIX = "http://candidates.democracyclub.org.uk/api/next/parties/";

interface FileResult {
  outcome: "updated" | "skipped-no-mapping" | "no-dc-url";
  party: string;
}

function processFile(filePath: string): FileResult {
  const content = fs.readFileSync(filePath, "utf-8");
  const partyMatch = content.match(/^party:\s*(.+)$/m);
  const party = partyMatch ? partyMatch[1].trim() : "";
  const partyId = party ? matchPartyId(party) : undefined;
  const website = partyId ? PARTY_WEBSITES[partyId] : undefined;

  const lines = content.split("\n");
  let changed = false;
  let hadDcUrl = false;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s+- url:\s*)(.+)$/);
    if (!m) continue;
    const url = m[2].replace(/^["']|["']$/g, "");
    if (!url.startsWith(DC_API_PREFIX)) continue;
    hadDcUrl = true;
    if (website) {
      lines[i] = `${m[1]}${website}`;
      changed = true;
    }
  }

  if (!hadDcUrl) return { outcome: "no-dc-url", party };
  if (!website) return { outcome: "skipped-no-mapping", party };
  if (changed) {
    fs.writeFileSync(filePath, lines.join("\n"));
    return { outcome: "updated", party };
  }
  return { outcome: "no-dc-url", party };
}

function main() {
  const dirs = ["data/candidates", "data/regional-candidates"];
  let updated = 0;
  let skipped = 0;
  let noDcUrl = 0;
  const skippedByParty = new Map<string, number>();

  for (const dir of dirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    for (const f of files) {
      const r = processFile(path.join(dir, f));
      if (r.outcome === "updated") updated++;
      else if (r.outcome === "skipped-no-mapping") {
        skipped++;
        skippedByParty.set(r.party, (skippedByParty.get(r.party) ?? 0) + 1);
      } else noDcUrl++;
    }
  }

  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no party-website mapping): ${skipped}`);
  console.log(`No DC API URL present: ${noDcUrl}`);
  if (skippedByParty.size > 0) {
    console.log("\nSkipped breakdown by party:");
    const rows = [...skippedByParty.entries()].sort((a, b) => b[1] - a[1]);
    for (const [party, n] of rows) console.log(`  ${n.toString().padStart(4)}  ${party}`);
  }
}

main();
