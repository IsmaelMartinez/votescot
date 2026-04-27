import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

interface Cand {
  id: string;
  name: string;
  party: string;
  bio: string;
  highlights?: string[];
  isIncumbent?: boolean;
  quizCandidate?: boolean;
  [k: string]: unknown;
}

const CONS_DIR = "data/candidates";
const REG_DIR = "data/regional-candidates";

const STUB_RX = [
  /^[\w\s&'\-\(\)\.]+ candidate for [\w\s&'\-\(\)\.,]+\.?$/i,
  /^[\w\s&'\-\(\)\.]+ regional list candidate for [\w\s&'\-\(\)\.,]+\.?$/i,
];

function isStub(bio: string | undefined): boolean {
  if (!bio) return true;
  const t = bio.trim();
  if (t.length < 60) return true;
  return STUB_RX.some((p) => p.test(t));
}

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\bdr\.?\s*/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameKey(name: string): { full: string; firstLast: string } {
  const norm = normaliseName(name);
  const tokens = norm.split(" ").filter(Boolean);
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return { full: norm, firstLast: `${first}|${last}` };
}

function readYaml(filePath: string): Cand {
  return yaml.parse(fs.readFileSync(filePath, "utf-8")) as Cand;
}

interface RewritePlan {
  filePath: string;
  newBio: string;
  newHighlights: string[];
  fromConstituencyId: string;
}

function planRewrites(): RewritePlan[] {
  const consFiles = fs.readdirSync(CONS_DIR).filter((f) => f.endsWith(".yaml"));
  const consSubstantive = new Map<string, Cand>(); // key: firstLast → cand (with substantive bio)
  const consSubstantiveFull = new Map<string, Cand>(); // key: full normalised name
  for (const f of consFiles) {
    const c = readYaml(path.join(CONS_DIR, f));
    if (!isStub(c.bio)) {
      const k = nameKey(c.name);
      consSubstantive.set(k.firstLast, c);
      consSubstantiveFull.set(k.full, c);
    }
  }

  const regFiles = fs.readdirSync(REG_DIR).filter((f) => f.endsWith(".yaml"));
  const plans: RewritePlan[] = [];
  for (const f of regFiles) {
    const filePath = path.join(REG_DIR, f);
    const c = readYaml(filePath);
    if (!isStub(c.bio)) continue;
    const k = nameKey(c.name);

    let match = consSubstantiveFull.get(k.full);
    if (!match) match = consSubstantive.get(k.firstLast);
    if (!match) continue;
    if (match.party !== c.party) continue;

    plans.push({
      filePath,
      newBio: match.bio,
      newHighlights: match.highlights ?? [],
      fromConstituencyId: match.id,
    });
  }

  return plans;
}

function applyRewrite(plan: RewritePlan) {
  const data = readYaml(plan.filePath);
  data.bio = plan.newBio;
  if (plan.newHighlights.length > 0) data.highlights = plan.newHighlights;

  const out = yaml.stringify(data, { lineWidth: 0 });
  fs.writeFileSync(plan.filePath, out);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const plans = planRewrites();
  console.log(`Plans: ${plans.length} regional candidates can be enriched from a same-name constituency entry.`);
  for (const p of plans.slice(0, 10)) {
    console.log(`  ${path.basename(p.filePath)}  ←  ${p.fromConstituencyId}`);
  }
  if (plans.length > 10) console.log(`  ... and ${plans.length - 10} more`);
  if (dryRun) {
    console.log("\nDry run; not writing.");
    return;
  }
  for (const p of plans) applyRewrite(p);
  console.log(`\nApplied ${plans.length} rewrites.`);
}

main();
