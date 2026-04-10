import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { matchPartyId } from "../src/lib/party-match";

const PARTIES_DIR = path.resolve("data/parties");
const CANDIDATES_DIR = path.resolve("data/candidates");

interface PartyData {
  id: string;
  name: string;
  positions: Record<string, number>;
  stances: Record<string, string>;
}

function loadParties(): Map<string, PartyData> {
  const parties = new Map<string, PartyData>();
  const files = fs.readdirSync(PARTIES_DIR).filter((f) => f.endsWith(".yaml"));
  for (const file of files) {
    const data = yaml.parse(fs.readFileSync(path.join(PARTIES_DIR, file), "utf-8")) as PartyData;
    parties.set(data.id, data);
  }
  return parties;
}

function applyPartyPositions(): void {
  const parties = loadParties();
  const candidateFiles = fs.readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith(".yaml"));

  const counts: Record<string, number> = {};
  let skipped = 0;
  let noMatch = 0;

  for (const file of candidateFiles) {
    const filePath = path.join(CANDIDATES_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = yaml.parse(raw) as Record<string, unknown>;

    // Skip already hand-curated candidates
    if (data.quizCandidate === true) {
      skipped++;
      continue;
    }

    const partyId = matchPartyId(String(data.party ?? ""));
    const party = partyId ? parties.get(partyId) : undefined;
    if (!party) {
      noMatch++;
      continue;
    }

    // Apply party positions and stances
    data.positions = party.positions;
    data.stances = party.stances;
    data.quizCandidate = true;

    fs.writeFileSync(filePath, yaml.stringify(data));

    counts[party.id] = (counts[party.id] ?? 0) + 1;
  }

  console.log("\nParty positions applied:\n");
  const totalUpdated = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [partyId, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${partyId}: ${count} candidates`);
  }
  console.log(`\nTotal updated: ${totalUpdated}`);
  console.log(`Skipped (already hand-curated): ${skipped}`);
  console.log(`No match (independents/small parties): ${noMatch}`);
}

applyPartyPositions();
