# Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated daily pipeline that syncs all Scottish Parliament 2026 candidates from Democracy Club, parses party manifestos via Gemini, and keeps the site current.

**Architecture:** Two GitHub Actions cron jobs. `sync-candidates` (06:00 UTC) pulls from Democracy Club API and writes candidate/constituency YAML. `sync-manifestos` (07:00 UTC) discovers manifesto PDFs, parses them with Gemini, and applies party positions to candidates. Both auto-commit additions, PR for deletions.

**Tech Stack:** TypeScript scripts via tsx, Democracy Club API, Google Gemini API, pdf-parse, GitHub Actions, yaml (existing)

---

## File Structure

```
scripts/
├── lib/
│   ├── api.ts                    # HTTP fetch with retries and rate limiting
│   └── parties.ts                # Party name → colour/short name mapping
├── sync-candidates.ts            # Democracy Club → candidate/constituency YAML
├── sync-manifestos.ts            # Manifesto discovery → Gemini → party YAML → candidate update
└── validate-data.ts              # Existing (no changes)

data/
├── parties/                      # NEW: party-level positions from manifestos
├── manifestos/
│   └── registry.yaml             # NEW: manifesto discovery tracking
├── candidates/                   # Existing (updated by sync)
└── constituencies/               # Existing (updated by sync)

.github/workflows/
├── sync-candidates.yml           # NEW: daily candidate sync
├── sync-manifestos.yml           # NEW: daily manifesto sync
├── deploy.yml                    # Existing (no changes)
└── ci.yml                        # Existing (no changes)

tests/
├── matching.test.ts              # Existing
├── validate-data.test.ts         # Existing
├── parties.test.ts               # NEW: party colour map tests
└── sync-candidates.test.ts       # NEW: candidate transform tests
```

---

### Task 1: Install dependencies and shared utilities

**Files:**
- Modify: `package.json`
- Create: `scripts/lib/api.ts`
- Create: `scripts/lib/parties.ts`
- Create: `tests/parties.test.ts`

- [ ] **Step 1: Install new dependencies**

```bash
cd /Users/ismael.martinez/projects/github/votescot
npm install @google/generative-ai pdf-parse
npm install -D tsx @types/pdf-parse
```

- [ ] **Step 2: Write party mapping tests**

Create `tests/parties.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPartyColours, getPartyShortName, slugify } from "../scripts/lib/parties";

describe("getPartyColours", () => {
  it("returns SNP colours", () => {
    const c = getPartyColours("Scottish National Party (SNP)");
    expect(c.color).toBe("#FDF38E");
    expect(c.accent).toBe("#9B870C");
    expect(c.textColor).toBe("#333");
  });

  it("returns Labour colours", () => {
    const c = getPartyColours("Labour Party");
    expect(c.color).toBe("#DC241F");
  });

  it("returns default for unknown party", () => {
    const c = getPartyColours("Galactic Federation");
    expect(c.color).toBe("#666666");
    expect(c.accent).toBe("#444444");
  });

  it("matches partial party names", () => {
    const c = getPartyColours("Scottish Green Party");
    expect(c.color).toBe("#00A651");
  });
});

describe("getPartyShortName", () => {
  it("returns short names for known parties", () => {
    expect(getPartyShortName("Scottish National Party (SNP)")).toBe("SNP");
    expect(getPartyShortName("Scottish Green Party")).toBe("Green");
    expect(getPartyShortName("Labour Party")).toBe("Labour");
    expect(getPartyShortName("Conservative and Unionist Party")).toBe("Tory");
    expect(getPartyShortName("Scottish Liberal Democrats")).toBe("Lib Dem");
    expect(getPartyShortName("Reform UK")).toBe("Reform");
  });

  it("returns party name for unknown parties", () => {
    expect(getPartyShortName("Galactic Federation")).toBe("Galactic Federation");
  });
});

describe("slugify", () => {
  it("converts names to URL-friendly slugs", () => {
    expect(slugify("Angus Robertson")).toBe("angus-robertson");
    expect(slugify("Bonnie Prince Bob")).toBe("bonnie-prince-bob");
    expect(slugify("Alex Cole-Hamilton")).toBe("alex-cole-hamilton");
  });

  it("handles special characters", () => {
    expect(slugify("O'Brien")).toBe("obrien");
    expect(slugify("Mary-Jane Watson")).toBe("mary-jane-watson");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — module `../scripts/lib/parties` not found.

- [ ] **Step 4: Implement party mapping**

Create `scripts/lib/parties.ts`:

```typescript
interface PartyColours {
  color: string;
  accent: string;
  textColor?: string;
}

const PARTY_MAP: Record<string, { short: string; colours: PartyColours }> = {
  "Scottish National Party": { short: "SNP", colours: { color: "#FDF38E", accent: "#9B870C", textColor: "#333" } },
  "Labour": { short: "Labour", colours: { color: "#DC241F", accent: "#8B0000" } },
  "Conservative": { short: "Tory", colours: { color: "#0087DC", accent: "#005EA5" } },
  "Liberal Democrat": { short: "Lib Dem", colours: { color: "#FAA61A", accent: "#B8860B" } },
  "Green": { short: "Green", colours: { color: "#00A651", accent: "#007A3D" } },
  "Reform UK": { short: "Reform", colours: { color: "#12B6CF", accent: "#0a7f91" } },
  "Alba": { short: "Alba", colours: { color: "#005EB8", accent: "#003d7a" } },
  "Workers Party": { short: "Workers", colours: { color: "#c41230", accent: "#8b0d22" } },
  "Libertarian": { short: "Libertarian", colours: { color: "#f5d442", accent: "#b89e30", textColor: "#333" } },
  "Independent": { short: "Ind", colours: { color: "#888888", accent: "#555555" } },
};

const DEFAULT_COLOURS: PartyColours = { color: "#666666", accent: "#444444" };

function findPartyKey(partyName: string): string | undefined {
  const lower = partyName.toLowerCase();
  return Object.keys(PARTY_MAP).find((key) => lower.includes(key.toLowerCase()));
}

export function getPartyColours(partyName: string): PartyColours {
  const key = findPartyKey(partyName);
  return key ? PARTY_MAP[key].colours : DEFAULT_COLOURS;
}

export function getPartyShortName(partyName: string): string {
  const key = findPartyKey(partyName);
  return key ? PARTY_MAP[key].short : partyName;
}

export function getPartyId(partyName: string): string {
  return slugify(partyName);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including new party mapping tests.

- [ ] **Step 6: Create shared HTTP utility**

Create `scripts/lib/api.ts`:

```typescript
export async function fetchJson<T>(url: string, retries = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const wait = delayMs * attempt;
        console.log(`Rate limited, waiting ${wait}ms (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Fetch failed, retrying in ${delayMs * attempt}ms (attempt ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
```

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/ tests/parties.test.ts package.json package-lock.json
git commit -m "add shared utilities: party mapping, http fetch, slugify"
```

---

### Task 2: Candidate sync script

**Files:**
- Create: `scripts/sync-candidates.ts`
- Create: `tests/sync-candidates.test.ts`

- [ ] **Step 1: Write candidate transform tests**

Create `tests/sync-candidates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformCandidate, transformConstituency } from "../scripts/sync-candidates";

describe("transformCandidate", () => {
  const apiCandidate = {
    id: 12345,
    person: {
      id: 67890,
      name: "Jane Smith",
      statement_to_voters: "I will fight for better schools.",
    },
    party: {
      name: "Scottish National Party (SNP)",
      url: "https://snp.org",
    },
    post: {
      slug: "edinburgh-central",
      label: "Edinburgh Central",
    },
  };

  it("transforms API candidate to YAML structure", () => {
    const result = transformCandidate(apiCandidate);
    expect(result.id).toBe("jane-smith");
    expect(result.name).toBe("Jane Smith");
    expect(result.party).toBe("Scottish National Party (SNP)");
    expect(result.partyShort).toBe("SNP");
    expect(result.color).toBe("#FDF38E");
    expect(result.constituency).toBe("edinburgh-central");
    expect(result.quizCandidate).toBe(false);
    expect(result.isIncumbent).toBe(false);
    expect(result.bio).toContain("I will fight for better schools.");
  });

  it("uses party + constituency fallback bio when no statement", () => {
    const noStatement = { ...apiCandidate, person: { ...apiCandidate.person, statement_to_voters: null } };
    const result = transformCandidate(noStatement);
    expect(result.bio).toContain("Scottish National Party (SNP)");
    expect(result.bio).toContain("Edinburgh Central");
  });
});

describe("transformConstituency", () => {
  it("transforms election post to constituency YAML", () => {
    const post = { slug: "edinburgh-central", label: "Edinburgh Central" };
    const result = transformConstituency(post);
    expect(result.id).toBe("edinburgh-central");
    expect(result.name).toBe("Edinburgh Central");
    expect(result.boundaryYear).toBe(2026);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — module `../scripts/sync-candidates` not found.

- [ ] **Step 3: Implement sync-candidates script**

Create `scripts/sync-candidates.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fetchJson } from "./lib/api";
import { getPartyColours, getPartyShortName, slugify } from "./lib/parties";

const DEMOCRACY_CLUB_BASE = "https://candidates.democracyclub.org.uk/api/next";
const ELECTION_PREFIX = "sp.c.";
const ELECTION_DATE = "2026-05-07";

interface DemocracyClubResult {
  id: number;
  person: { id: number; name: string; statement_to_voters: string | null };
  party: { name: string; url: string | null };
  post: { slug: string; label: string };
}

interface DemocracyClubResponse {
  results: DemocracyClubResult[];
  next: string | null;
}

export function transformCandidate(apiCandidate: DemocracyClubResult) {
  const colours = getPartyColours(apiCandidate.party.name);
  const bio =
    apiCandidate.person.statement_to_voters ||
    `${apiCandidate.party.name} candidate for ${apiCandidate.post.label}.`;

  return {
    id: slugify(apiCandidate.person.name),
    name: apiCandidate.person.name,
    party: apiCandidate.party.name,
    partyShort: getPartyShortName(apiCandidate.party.name),
    color: colours.color,
    accent: colours.accent,
    ...(colours.textColor ? { textColor: colours.textColor } : {}),
    constituency: apiCandidate.post.slug,
    isIncumbent: false,
    quizCandidate: false,
    bio,
    highlights: [],
    sources: [
      ...(apiCandidate.party.url
        ? [{ url: apiCandidate.party.url, type: "party_website" }]
        : []),
    ],
  };
}

export function transformConstituency(post: { slug: string; label: string }) {
  return {
    id: post.slug,
    name: post.label,
    region: "",
    boundaryYear: 2026,
    description: `${post.label} constituency for the 2026 Scottish Parliament election.`,
    context: "Data synced from Democracy Club.",
  };
}

function writeYaml(filePath: string, data: Record<string, unknown>) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, yaml.stringify(data, { lineWidth: 0 }));
}

function readYaml(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  return yaml.parse(fs.readFileSync(filePath, "utf-8"));
}

async function fetchAllCandidates(): Promise<DemocracyClubResult[]> {
  const all: DemocracyClubResult[] = [];
  let url: string | null =
    `${DEMOCRACY_CLUB_BASE}/candidacies/?election_date=${ELECTION_DATE}&election_id_regex=^${ELECTION_PREFIX}&page_size=200`;

  while (url) {
    const page = await fetchJson<DemocracyClubResponse>(url);
    all.push(...page.results);
    url = page.next;
    if (url) await new Promise((r) => setTimeout(r, 500)); // rate limit courtesy
  }

  return all;
}

async function main() {
  console.log("Fetching candidates from Democracy Club...");
  const apiCandidates = await fetchAllCandidates();
  console.log(`Fetched ${apiCandidates.length} candidates.`);

  // Track what's in the API for withdrawal detection
  const apiCandidateIds = new Set<string>();
  const constituencies = new Map<string, { slug: string; label: string }>();
  let newCount = 0;
  let updatedCount = 0;

  for (const apiCandidate of apiCandidates) {
    // Collect constituency data
    const post = apiCandidate.post;
    if (!constituencies.has(post.slug)) {
      constituencies.set(post.slug, post);
    }

    // Transform and write candidate
    const candidate = transformCandidate(apiCandidate);
    apiCandidateIds.add(candidate.id);
    const filePath = path.join("data/candidates", `${candidate.id}.yaml`);
    const existing = readYaml(filePath);

    if (!existing) {
      writeYaml(filePath, candidate);
      newCount++;
      console.log(`  NEW: ${candidate.name} (${candidate.partyShort}) — ${post.label}`);
    } else {
      // Preserve manually curated fields
      const merged = {
        ...candidate,
        ...(existing.quizCandidate ? { quizCandidate: existing.quizCandidate } : {}),
        ...(existing.positions ? { positions: existing.positions } : {}),
        ...(existing.stances ? { stances: existing.stances } : {}),
        ...(existing.highlights && (existing.highlights as string[]).length > 0
          ? { highlights: existing.highlights }
          : candidate.highlights),
        bio: (existing.bio as string) || candidate.bio,
      };
      const existingYaml = yaml.stringify(existing, { lineWidth: 0 });
      const mergedYaml = yaml.stringify(merged, { lineWidth: 0 });
      if (existingYaml !== mergedYaml) {
        writeYaml(filePath, merged);
        updatedCount++;
      }
    }
  }

  // Write constituency files
  for (const [, post] of constituencies) {
    const filePath = path.join("data/constituencies", `${post.slug}.yaml`);
    const existing = readYaml(filePath);
    if (!existing) {
      writeYaml(filePath, transformConstituency(post));
      console.log(`  NEW CONSTITUENCY: ${post.label}`);
    }
  }

  // Detect withdrawals (candidates in YAML but not in API)
  const candidateDir = "data/candidates";
  const existingFiles = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  const withdrawn: string[] = [];
  for (const file of existingFiles) {
    const id = file.replace(".yaml", "");
    const data = readYaml(path.join(candidateDir, file));
    if (data && !apiCandidateIds.has(id)) {
      withdrawn.push(`${data.name} (${data.partyShort}) — ${data.constituency}`);
    }
  }

  console.log(`\nSync complete: ${newCount} new, ${updatedCount} updated, ${withdrawn.length} potentially withdrawn`);

  // Output withdrawn list for the GitHub Action to create a PR
  if (withdrawn.length > 0) {
    console.log("\nPotentially withdrawn candidates:");
    withdrawn.forEach((w) => console.log(`  - ${w}`));
    fs.writeFileSync("withdrawn.json", JSON.stringify(withdrawn, null, 2));
  }
}

// Run if called directly
const scriptName = process.argv[1] || "";
if (scriptName.includes("sync-candidates")) {
  main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Add sync script to package.json**

Add to the `scripts` section in `package.json`:

```json
"sync:candidates": "tsx scripts/sync-candidates.ts",
"sync:manifestos": "tsx scripts/sync-manifestos.ts"
```

- [ ] **Step 6: Test the sync script manually**

```bash
npm run sync:candidates
```

Expected: fetches candidates from Democracy Club, writes YAML files for all 73 constituencies and hundreds of candidates. Check `data/candidates/` and `data/constituencies/` for new files.

- [ ] **Step 7: Run validation to ensure generated YAML is valid**

```bash
npm test
```

Expected: all tests pass, including data validation.

- [ ] **Step 8: Commit**

```bash
git add scripts/sync-candidates.ts tests/sync-candidates.test.ts package.json package-lock.json data/
git commit -m "add candidate sync from Democracy Club API"
```

---

### Task 3: Manifesto registry and discovery

**Files:**
- Create: `data/manifestos/registry.yaml`
- Create: `data/parties/` (directory)

- [ ] **Step 1: Create manifesto registry**

Create `data/manifestos/registry.yaml`:

```yaml
parties:
  - id: "scottish-national-party"
    name: "Scottish National Party (SNP)"
    manifestoUrls:
      - "https://www.snp.org/manifesto"
      - "https://www.snp.org/policies"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null

  - id: "scottish-green-party"
    name: "Scottish Green Party"
    manifestoUrls:
      - "https://greens.scot/manifesto"
      - "https://greens.scot/2026-manifesto"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null

  - id: "scottish-labour"
    name: "Scottish Labour"
    manifestoUrls:
      - "https://scottishlabour.org.uk/manifesto"
      - "https://scottishlabour.org.uk/where-we-stand"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null

  - id: "scottish-conservatives"
    name: "Scottish Conservatives"
    manifestoUrls:
      - "https://www.scottishconservatives.com/manifesto"
      - "https://www.scottishconservatives.com/2026-manifesto"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null

  - id: "scottish-liberal-democrats"
    name: "Scottish Liberal Democrats"
    manifestoUrls:
      - "https://www.scotlibdems.org.uk/2026-manifesto"
      - "https://www.scotlibdems.org.uk/manifesto"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null

  - id: "reform-uk"
    name: "Reform UK"
    manifestoUrls:
      - "https://www.reformparty.uk/scotland"
      - "https://www.reformparty.uk/manifesto"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null

  - id: "alba-party"
    name: "Alba Party"
    manifestoUrls:
      - "https://www.albaparty.org/manifesto"
      - "https://www.albaparty.org/policies"
    manifestoPdf: null
    parsedAt: null
    positionsFile: null
```

- [ ] **Step 2: Create parties directory**

```bash
mkdir -p data/parties
```

- [ ] **Step 3: Commit**

```bash
git add data/manifestos/registry.yaml
git commit -m "add manifesto registry for major Scottish parties"
```

---

### Task 4: Manifesto sync script

**Files:**
- Create: `scripts/sync-manifestos.ts`

- [ ] **Step 1: Implement manifesto sync script**

Create `scripts/sync-manifestos.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchHtml, fetchBuffer } from "./lib/api";

interface RegistryParty {
  id: string;
  name: string;
  manifestoUrls: string[];
  manifestoPdf: string | null;
  parsedAt: string | null;
  positionsFile: string | null;
}

interface Registry {
  parties: RegistryParty[];
}

interface PartyPositions {
  id: string;
  name: string;
  manifestoUrl: string;
  parsedAt: string;
  positions: Record<string, number>;
  stances: Record<string, string>;
  quotes: Record<string, string>;
}

const POLICY_AREAS = [
  "independence",
  "nhs",
  "housing",
  "climate",
  "tax",
  "economy",
  "education",
  "equality",
];

const GEMINI_PROMPT = `You are analysing a Scottish political party's manifesto for the 2026 Scottish Parliament election.

For each of the following 8 policy areas, provide:
1. A position score (0, 1, or 2)
2. A stance description (1-2 sentences summarising the party's position)
3. A direct quote from the manifesto as evidence

Scoring convention:
- independence: 0=oppose independence, 1=neutral/not mentioned, 2=support independence
- nhs: 0=reform/cut/privatise, 1=maintain current approach, 2=expand/invest significantly
- housing: 0=market-led/deregulate, 1=build more/moderate, 2=regulate/rent controls
- climate: 0=affordability first/weaken targets, 1=balanced/maintain targets, 2=urgent action/strengthen targets
- tax: 0=cut taxes, 1=maintain current rates, 2=raise taxes on wealthy
- economy: 0=pro-business/deregulate, 1=public investment/moderate, 2=green economy/radical change
- education: 0=vocational/skills focus, 1=attainment gap/school standards, 2=expand childcare/early years
- equality: 0=socially conservative, 1=moderate progressive, 2=strongly progressive

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "positions": {
    "independence": 0,
    "nhs": 0,
    "housing": 0,
    "climate": 0,
    "tax": 0,
    "economy": 0,
    "education": 0,
    "equality": 0
  },
  "stances": {
    "independence": "...",
    "nhs": "...",
    "housing": "...",
    "climate": "...",
    "tax": "...",
    "economy": "...",
    "education": "...",
    "equality": "..."
  },
  "quotes": {
    "independence": "...",
    "nhs": "...",
    "housing": "...",
    "climate": "...",
    "tax": "...",
    "economy": "...",
    "education": "...",
    "equality": "..."
  }
}

Here is the manifesto text:

`;

function readRegistry(): Registry {
  return yaml.parse(fs.readFileSync("data/manifestos/registry.yaml", "utf-8"));
}

function writeRegistry(registry: Registry) {
  fs.writeFileSync("data/manifestos/registry.yaml", yaml.stringify(registry, { lineWidth: 0 }));
}

function writeYaml(filePath: string, data: Record<string, unknown>) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, yaml.stringify(data, { lineWidth: 0 }));
}

async function findPdfLink(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    // Look for PDF links in the page
    const pdfPattern = /href=["']([^"']*\.pdf[^"']*)/gi;
    const matches = [...html.matchAll(pdfPattern)];
    for (const match of matches) {
      let pdfUrl = match[1];
      if (pdfUrl.startsWith("/")) {
        const base = new URL(url);
        pdfUrl = `${base.origin}${pdfUrl}`;
      } else if (!pdfUrl.startsWith("http")) {
        const base = new URL(url);
        pdfUrl = `${base.origin}/${pdfUrl}`;
      }
      // Filter for manifesto-like PDFs
      const lower = pdfUrl.toLowerCase();
      if (lower.includes("manifesto") || lower.includes("policy") || lower.includes("programme")) {
        return pdfUrl;
      }
    }
    // If no manifesto-specific PDF, return first PDF found
    if (matches.length > 0) {
      let pdfUrl = matches[0][1];
      if (pdfUrl.startsWith("/")) {
        const base = new URL(url);
        pdfUrl = `${base.origin}${pdfUrl}`;
      }
      return pdfUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Dynamic import for pdf-parse (CommonJS module)
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(pdfBuffer);
  return data.text;
}

async function parseWithGemini(text: string): Promise<{ positions: Record<string, number>; stances: Record<string, string>; quotes: Record<string, string> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Truncate very long manifestos to fit context
  const truncated = text.length > 500000 ? text.slice(0, 500000) : text;

  const result = await model.generateContent(GEMINI_PROMPT + truncated);
  const response = result.response.text();

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate structure
  for (const area of POLICY_AREAS) {
    if (typeof parsed.positions[area] !== "number" || parsed.positions[area] < 0 || parsed.positions[area] > 2) {
      throw new Error(`Invalid position for ${area}: ${parsed.positions[area]}`);
    }
    if (typeof parsed.stances[area] !== "string") {
      throw new Error(`Missing stance for ${area}`);
    }
  }

  return parsed;
}

function applytoCandidates(partyName: string, positions: Record<string, number>, stances: Record<string, string>, manifestoUrl: string) {
  const candidateDir = "data/candidates";
  const files = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  let count = 0;

  for (const file of files) {
    const filePath = path.join(candidateDir, file);
    const candidate = yaml.parse(fs.readFileSync(filePath, "utf-8"));

    // Skip candidates not from this party
    if (!candidate.party?.toLowerCase().includes(partyName.toLowerCase().split(" ")[0])) continue;

    // Skip candidates with manually curated positions
    if (candidate.quizCandidate === true && candidate.positions) continue;

    // Apply party positions
    candidate.positions = positions;
    candidate.stances = stances;
    candidate.quizCandidate = true;

    // Add manifesto source if not already present
    if (!candidate.sources) candidate.sources = [];
    const hasManifesto = candidate.sources.some((s: { url: string }) => s.url === manifestoUrl);
    if (!hasManifesto) {
      candidate.sources.push({ url: manifestoUrl, type: "manifesto" });
    }

    fs.writeFileSync(filePath, yaml.stringify(candidate, { lineWidth: 0 }));
    count++;
  }

  return count;
}

async function main() {
  const registry = readRegistry();
  let totalUpdated = 0;

  for (const party of registry.parties) {
    // Skip already parsed
    if (party.parsedAt) {
      console.log(`Skipping ${party.name} — already parsed on ${party.parsedAt}`);
      continue;
    }

    console.log(`Checking ${party.name}...`);

    // Search for manifesto PDF
    let pdfUrl: string | null = null;
    for (const url of party.manifestoUrls) {
      pdfUrl = await findPdfLink(url);
      if (pdfUrl) break;
      await new Promise((r) => setTimeout(r, 1000)); // rate limit courtesy
    }

    if (!pdfUrl) {
      console.log(`  No manifesto PDF found for ${party.name}`);
      continue;
    }

    console.log(`  Found PDF: ${pdfUrl}`);

    try {
      // Download and extract text
      const pdfBuffer = await fetchBuffer(pdfUrl);
      const text = await extractPdfText(pdfBuffer);
      console.log(`  Extracted ${text.length} characters from PDF`);

      // Parse with Gemini
      const { positions, stances, quotes } = await parseWithGemini(text);
      console.log(`  Gemini parsed positions successfully`);

      // Write party positions file
      const positionsFile = `data/parties/${party.id}.yaml`;
      const partyData: PartyPositions = {
        id: party.id,
        name: party.name,
        manifestoUrl: pdfUrl,
        parsedAt: new Date().toISOString(),
        positions,
        stances,
        quotes,
      };
      writeYaml(positionsFile, partyData);

      // Apply to candidates
      const count = applytoCandidates(party.name, positions, stances, pdfUrl);
      console.log(`  Applied positions to ${count} candidates`);
      totalUpdated += count;

      // Update registry
      party.manifestoPdf = pdfUrl;
      party.parsedAt = new Date().toISOString();
      party.positionsFile = positionsFile;
      writeRegistry(registry);
    } catch (error) {
      console.error(`  Error processing ${party.name}:`, error);
    }
  }

  console.log(`\nManifesto sync complete: ${totalUpdated} candidates updated`);
}

const scriptName = process.argv[1] || "";
if (scriptName.includes("sync-manifestos")) {
  main().catch((err) => {
    console.error("Manifesto sync failed:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-manifestos.ts
git commit -m "add manifesto discovery and gemini parsing script"
```

---

### Task 5: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/sync-candidates.yml`
- Create: `.github/workflows/sync-manifestos.yml`

- [ ] **Step 1: Create candidate sync workflow**

Create `.github/workflows/sync-candidates.yml`:

```yaml
name: Sync Candidates

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run candidate sync
        run: npx tsx scripts/sync-candidates.ts

      - name: Validate data
        run: npm test

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/candidates/ data/constituencies/
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            COUNTS=$(git diff --cached --stat | tail -1)
            git commit -m "sync: update candidate data from Democracy Club

          $COUNTS"
            git push
          fi

      - name: Create withdrawal PR if needed
        if: hashFiles('withdrawn.json') != ''
        run: |
          WITHDRAWN=$(cat withdrawn.json)
          BRANCH="withdrawals-$(date +%Y%m%d)"
          git checkout -b "$BRANCH"
          echo "$WITHDRAWN" > data/withdrawn-$(date +%Y%m%d).json
          git add data/
          git commit -m "flag potentially withdrawn candidates for review"
          git push -u origin "$BRANCH"
          gh pr create \
            --title "Review: potentially withdrawn candidates $(date +%Y-%m-%d)" \
            --body "The following candidates appeared in our data but are no longer in the Democracy Club API:

          $(echo "$WITHDRAWN" | jq -r '.[]' | sed 's/^/- /')

          Please review and confirm withdrawals before merging." \
            --base main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Create manifesto sync workflow**

Create `.github/workflows/sync-manifestos.yml`:

```yaml
name: Sync Manifestos

on:
  schedule:
    - cron: "0 7 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run manifesto sync
        run: npx tsx scripts/sync-manifestos.ts
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

      - name: Validate data
        run: npm test

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/parties/ data/manifestos/ data/candidates/
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "manifesto: update party positions from manifesto parsing"
            git push
          fi
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sync-candidates.yml .github/workflows/sync-manifestos.yml
git commit -m "add daily sync github actions for candidates and manifestos"
```

---

### Task 6: Run initial full sync and verify

- [ ] **Step 1: Run candidate sync**

```bash
npm run sync:candidates
```

Expected: fetches all candidates from Democracy Club, creates YAML files for all 73 constituencies and all candidates. Output shows counts.

- [ ] **Step 2: Validate all data**

```bash
npm test
```

Expected: all tests pass including data validation of all new YAML files.

- [ ] **Step 3: Build the site**

```bash
npm run build
```

Expected: builds successfully with pages for all constituencies and candidates.

- [ ] **Step 4: Commit all synced data**

```bash
git add data/ 
git commit -m "sync: initial full candidate sync from Democracy Club"
```

- [ ] **Step 5: Push everything**

```bash
git push origin main
```

- [ ] **Step 6: Set up GitHub secrets**

Go to https://github.com/IsmaelMartinez/votescot/settings/secrets/actions and add:
- `GEMINI_API_KEY` — your Google Gemini API key

The `GITHUB_TOKEN` is available automatically in Actions.

- [ ] **Step 7: Trigger manifesto sync manually**

Go to https://github.com/IsmaelMartinez/votescot/actions and manually trigger the "Sync Manifestos" workflow to test it. If any parties have published manifestos, it will discover and parse them.
