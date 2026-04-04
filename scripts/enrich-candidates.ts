import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const CANDIDATES_DIR = path.resolve("data/candidates");

interface Source {
  url: string;
  type: string;
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  constituency: string;
  sources?: Source[];
  [key: string]: unknown;
}

const PARTY_WEBSITES: Record<string, string> = {
  "Scottish National Party": "https://www.snp.org/",
  "Labour": "https://scottishlabour.org.uk/",
  "Conservative": "https://www.scottishconservatives.com/",
  "Liberal Democrat": "https://www.scotlibdems.org.uk/",
  "Green": "https://greens.scot/",
  "Reform UK": "https://www.reformparty.uk/",
  "Alba": "https://www.albaparty.org/",
};

function getPartyWebsite(partyName: string): string | null {
  const lower = partyName.toLowerCase();
  for (const [key, url] of Object.entries(PARTY_WEBSITES)) {
    if (lower.includes(key.toLowerCase())) return url;
  }
  return null;
}

function hasSource(sources: Source[], urlSubstring: string): boolean {
  return sources.some((s) => s.url.includes(urlSubstring));
}

function readYaml(filePath: string): Candidate {
  return yaml.parse(fs.readFileSync(filePath, "utf-8")) as Candidate;
}

function writeYaml(filePath: string, data: Record<string, unknown>) {
  fs.writeFileSync(filePath, yaml.stringify(data, { lineWidth: 0 }));
}

function whoCanIVoteForUrl(constituency: string): string {
  return `https://whocanivotefor.co.uk/elections/sp.c.${constituency}.2026-05-07/${constituency}/`;
}

function main() {
  const files = fs.readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith(".yaml"));
  let updatedCount = 0;

  for (const file of files) {
    const filePath = path.join(CANDIDATES_DIR, file);
    const candidate = readYaml(filePath);

    const sources: Source[] = Array.isArray(candidate.sources) ? [...candidate.sources] : [];
    let changed = false;

    // Add WhoCanIVoteFor constituency link if not present
    if (!hasSource(sources, "whocanivotefor.co.uk")) {
      sources.push({ url: whoCanIVoteForUrl(candidate.constituency), type: "whocanivotefor" });
      changed = true;
    }

    // Add party website if applicable and not already present
    const partyWebsite = getPartyWebsite(candidate.party);
    if (partyWebsite && !hasSource(sources, partyWebsite)) {
      sources.push({ url: partyWebsite, type: "party_website" });
      changed = true;
    }

    if (changed) {
      writeYaml(filePath, { ...candidate, sources });
      updatedCount++;
    }
  }

  console.log(`Enriched ${updatedCount} of ${files.length} candidate files.`);
}

main();
