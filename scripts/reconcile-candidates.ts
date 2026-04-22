import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";
import { slugify } from "./lib/parties";

const DEMOCRACY_CLUB_BASE = "https://candidates.democracyclub.org.uk/api/next";
const ELECTION_ID = "sp.c.2026-05-07";
const CANDIDATE_DIR = "data/candidates";

interface Candidacy {
  person: { id: number; name: string };
  party_name: string;
  party: { name: string; url?: string | null };
  deselected: boolean;
}

interface Ballot {
  ballot_paper_id: string;
  post: { slug: string; label: string };
  candidates_locked?: boolean;
  candidacies: Candidacy[];
}

interface BallotsResponse {
  count: number;
  results: Ballot[];
  next: string | null;
}

interface ApiEntry {
  personId: number;
  name: string;
  partyName: string;
  postSlug: string;
  postLabel: string;
  deselected: boolean;
  slug: string;
  nameKey: string;
}

interface LocalEntry {
  slug: string;
  name: string;
  party: string;
  partyShort: string;
  constituency: string;
  nameKey: string;
  file: string;
}

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchAllBallots(): Promise<Ballot[]> {
  const all: Ballot[] = [];
  let url: string | null =
    `${DEMOCRACY_CLUB_BASE}/ballots/?election_id=${ELECTION_ID}&page_size=200`;
  while (url) {
    const page = await fetchJson<BallotsResponse>(url);
    all.push(...page.results);
    url = page.next;
    if (url) await new Promise((r) => setTimeout(r, 500));
  }
  return all;
}

function loadLocal(): LocalEntry[] {
  const files = fs.readdirSync(CANDIDATE_DIR).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => {
    const data = yaml.parse(fs.readFileSync(path.join(CANDIDATE_DIR, f), "utf-8")) as Record<string, unknown>;
    return {
      slug: String(data.id),
      name: String(data.name),
      party: String(data.party),
      partyShort: String(data.partyShort ?? ""),
      constituency: String(data.constituency),
      nameKey: normaliseName(String(data.name)),
      file: f,
    };
  });
}

function buildApiEntries(ballots: Ballot[]): ApiEntry[] {
  const out: ApiEntry[] = [];
  for (const b of ballots) {
    for (const c of b.candidacies) {
      const partyName = c.party_name || c.party?.name || "";
      out.push({
        personId: c.person.id,
        name: c.person.name,
        partyName,
        postSlug: b.post.slug,
        postLabel: b.post.label,
        deselected: Boolean(c.deselected),
        slug: slugify(c.person.name),
        nameKey: normaliseName(c.person.name),
      });
    }
  }
  return out;
}

function partiesEquivalent(local: string, api: string): boolean {
  const a = local.toLowerCase();
  const b = api.toLowerCase();
  if (a === b) return true;
  const strip = (s: string) =>
    s.replace(/scottish\s+/g, "").replace(/\band\s+unionist\s+party\b/g, "").replace(/\s+/g, " ").trim();
  return strip(a) === strip(b);
}

async function main() {
  console.log(`Fetching ballots for ${ELECTION_ID}…`);
  const ballots = await fetchAllBallots();
  console.log(`Ballots: ${ballots.length}`);
  const lockedCount = ballots.filter((b) => b.candidates_locked).length;
  console.log(`Locked ballots: ${lockedCount} / ${ballots.length}`);

  const api = buildApiEntries(ballots);
  const apiActive = api.filter((a) => !a.deselected);
  const apiDeselected = api.filter((a) => a.deselected);
  console.log(`API candidacies: ${api.length} (${apiActive.length} active, ${apiDeselected.length} deselected)`);

  const local = loadLocal();
  console.log(`Local candidates: ${local.length}`);

  const apiByConstNameKey = new Map<string, ApiEntry>();
  const apiBySlug = new Map<string, ApiEntry>();
  for (const e of apiActive) {
    apiByConstNameKey.set(`${e.postSlug}::${e.nameKey}`, e);
    apiBySlug.set(e.slug, e);
  }
  const deselectedByConstNameKey = new Map<string, ApiEntry>();
  for (const e of apiDeselected) {
    deselectedByConstNameKey.set(`${e.postSlug}::${e.nameKey}`, e);
  }

  const localByConstNameKey = new Map<string, LocalEntry>();
  const localBySlug = new Map<string, LocalEntry>();
  for (const l of local) {
    localByConstNameKey.set(`${l.constituency}::${l.nameKey}`, l);
    localBySlug.set(l.slug, l);
  }

  const missingFromLocal: ApiEntry[] = [];
  for (const e of apiActive) {
    const key = `${e.postSlug}::${e.nameKey}`;
    if (!localByConstNameKey.has(key) && !localBySlug.has(e.slug)) {
      missingFromLocal.push(e);
    }
  }

  const possiblyWithdrawn: LocalEntry[] = [];
  const deselectedStillLocal: { local: LocalEntry; api: ApiEntry }[] = [];
  const slugDrift: { local: LocalEntry; api: ApiEntry }[] = [];
  for (const l of local) {
    const key = `${l.constituency}::${l.nameKey}`;
    const api = apiByConstNameKey.get(key);
    if (api) {
      if (api.slug !== l.slug) slugDrift.push({ local: l, api });
      continue;
    }
    const desel = deselectedByConstNameKey.get(key);
    if (desel) {
      deselectedStillLocal.push({ local: l, api: desel });
      continue;
    }
    if (apiBySlug.has(l.slug)) continue;
    possiblyWithdrawn.push(l);
  }

  const partyChanges: { local: LocalEntry; api: ApiEntry }[] = [];
  const constituencyChanges: { local: LocalEntry; api: ApiEntry }[] = [];
  const apiBySlugName = new Map<string, ApiEntry>();
  for (const e of apiActive) apiBySlugName.set(e.nameKey, e);
  for (const l of local) {
    const apiSame = apiByConstNameKey.get(`${l.constituency}::${l.nameKey}`);
    if (apiSame) {
      if (!partiesEquivalent(l.party, apiSame.partyName)) {
        partyChanges.push({ local: l, api: apiSame });
      }
      continue;
    }
    const apiByNameOnly = apiBySlugName.get(l.nameKey);
    if (apiByNameOnly && apiByNameOnly.postSlug !== l.constituency) {
      constituencyChanges.push({ local: l, api: apiByNameOnly });
    }
  }

  const byPartyCount = (rows: ApiEntry[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.partyName, (m.get(r.partyName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log("\n=== Reconciliation summary ===");
  console.log(`API active candidacies:       ${apiActive.length}`);
  console.log(`Local candidate files:        ${local.length}`);
  console.log(`New in API, missing locally:  ${missingFromLocal.length}`);
  console.log(`Local not in API (withdrawn?):${possiblyWithdrawn.length}`);
  console.log(`Deselected but still local:   ${deselectedStillLocal.length}`);
  console.log(`Slug drift (name edits):      ${slugDrift.length}`);
  console.log(`Party changes:                ${partyChanges.length}`);
  console.log(`Constituency changes:         ${constituencyChanges.length}`);

  const fmt = (e: ApiEntry) => `${e.name} (${e.partyName}) — ${e.postLabel} [${e.postSlug}]`;
  const fmtL = (l: LocalEntry) => `${l.name} (${l.partyShort}) — ${l.constituency} [${l.file}]`;

  if (missingFromLocal.length) {
    console.log("\n-- Missing locally (NEW in API) --");
    for (const e of missingFromLocal) console.log(`  + ${fmt(e)}`);
    console.log("  by party:", byPartyCount(missingFromLocal));
  }
  if (possiblyWithdrawn.length) {
    console.log("\n-- Possibly withdrawn (local, not in API) --");
    for (const l of possiblyWithdrawn) console.log(`  - ${fmtL(l)}`);
  }
  if (deselectedStillLocal.length) {
    console.log("\n-- Deselected in API but still local --");
    for (const { local, api } of deselectedStillLocal)
      console.log(`  ! ${fmtL(local)}  ::  API says deselected (${api.partyName})`);
  }
  if (slugDrift.length) {
    console.log("\n-- Slug drift (same person, slug differs) --");
    for (const { local, api } of slugDrift)
      console.log(`  ~ ${local.slug} -> ${api.slug}  (${local.name})`);
  }
  if (partyChanges.length) {
    console.log("\n-- Party change (same name+constituency) --");
    for (const { local, api } of partyChanges)
      console.log(`  * ${local.name} @ ${local.constituency}: ${local.party}  ->  ${api.partyName}`);
  }
  if (constituencyChanges.length) {
    console.log("\n-- Constituency change (same name) --");
    for (const { local, api } of constituencyChanges)
      console.log(`  * ${local.name}: ${local.constituency}  ->  ${api.postSlug}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    electionId: ELECTION_ID,
    ballots: ballots.length,
    lockedBallots: lockedCount,
    apiActive: apiActive.length,
    apiDeselected: apiDeselected.length,
    local: local.length,
    missingFromLocal,
    possiblyWithdrawn,
    deselectedStillLocal,
    slugDrift: slugDrift.map(({ local, api }) => ({ localSlug: local.slug, apiSlug: api.slug, name: local.name })),
    partyChanges: partyChanges.map(({ local, api }) => ({ name: local.name, constituency: local.constituency, from: local.party, to: api.partyName })),
    constituencyChanges: constituencyChanges.map(({ local, api }) => ({ name: local.name, from: local.constituency, to: api.postSlug })),
  };
  fs.writeFileSync("reconcile-report.json", JSON.stringify(report, null, 2));
  console.log("\nWrote reconcile-report.json");
}

main().catch((err) => {
  console.error("Reconcile failed:", err);
  process.exit(1);
});
