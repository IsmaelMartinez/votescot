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
      const lower = pdfUrl.toLowerCase();
      if (lower.includes("manifesto") || lower.includes("policy") || lower.includes("programme")) {
        return pdfUrl;
      }
    }
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
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(pdfBuffer);
  return data.text;
}

async function parseWithGemini(text: string): Promise<{ positions: Record<string, number>; stances: Record<string, string>; quotes: Record<string, string> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const truncated = text.length > 500000 ? text.slice(0, 500000) : text;

  const result = await model.generateContent(GEMINI_PROMPT + truncated);
  const response = result.response.text();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");

  const parsed = JSON.parse(jsonMatch[0]);

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

function applyToCandidates(partyName: string, positions: Record<string, number>, stances: Record<string, string>, manifestoUrl: string) {
  const candidateDir = "data/candidates";
  const files = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  let count = 0;

  for (const file of files) {
    const filePath = path.join(candidateDir, file);
    const candidate = yaml.parse(fs.readFileSync(filePath, "utf-8"));

    if (!candidate.party?.toLowerCase().includes(partyName.toLowerCase().split(" ")[0])) continue;
    if (candidate.quizCandidate === true && candidate.positions) continue;

    candidate.positions = positions;
    candidate.stances = stances;
    candidate.quizCandidate = true;

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
    if (party.parsedAt) {
      console.log(`Skipping ${party.name} — already parsed on ${party.parsedAt}`);
      continue;
    }

    console.log(`Checking ${party.name}...`);

    let pdfUrl: string | null = null;
    for (const url of party.manifestoUrls) {
      pdfUrl = await findPdfLink(url);
      if (pdfUrl) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!pdfUrl) {
      console.log(`  No manifesto PDF found for ${party.name}`);
      continue;
    }

    console.log(`  Found PDF: ${pdfUrl}`);

    try {
      const pdfBuffer = await fetchBuffer(pdfUrl);
      const text = await extractPdfText(pdfBuffer);
      console.log(`  Extracted ${text.length} characters from PDF`);

      const { positions, stances, quotes } = await parseWithGemini(text);
      console.log(`  Gemini parsed positions successfully`);

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

      const count = applyToCandidates(party.name, positions, stances, pdfUrl);
      console.log(`  Applied positions to ${count} candidates`);
      totalUpdated += count;

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
