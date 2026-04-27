import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { matchPartyId } from "../src/lib/party-match";

const PARTIES_DIR = path.resolve("data/parties");
const CANDIDATE_DIRS = ["data/candidates", "data/regional-candidates"].map((d) => path.resolve(d));

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

interface RunResult {
  counts: Record<string, number>;
  skipped: number;
  noMatch: number;
}

function applyToDir(dir: string, parties: Map<string, PartyData>, force: boolean): RunResult {
  const result: RunResult = { counts: {}, skipped: 0, noMatch: 0 };
  if (!fs.existsSync(dir)) return result;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = yaml.parse(raw) as Record<string, unknown>;

    // Skip already-processed candidates unless --force refreshes them
    // (e.g. after a party YAML update from /sync-manifestos).
    if (!force && data.quizCandidate === true) {
      result.skipped++;
      continue;
    }

    const partyId = matchPartyId(String(data.party ?? ""));
    const party = partyId ? parties.get(partyId) : undefined;
    if (!party) {
      result.noMatch++;
      continue;
    }

    data.positions = party.positions;
    data.stances = party.stances;
    data.quizCandidate = true;

    fs.writeFileSync(filePath, yaml.stringify(data, { lineWidth: 0 }));

    result.counts[party.id] = (result.counts[party.id] ?? 0) + 1;
  }
  return result;
}

function applyPartyPositions(): void {
  const force = process.argv.includes("--force");
  const parties = loadParties();

  for (const dir of CANDIDATE_DIRS) {
    const label = path.basename(dir);
    const { counts, skipped, noMatch } = applyToDir(dir, parties, force);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`\n${label}: ${total} updated, ${skipped} skipped (already hand-curated), ${noMatch} no match`);
    for (const [partyId, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${partyId}: ${count}`);
    }
  }
}

applyPartyPositions();
