import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

export interface CandidatePosition {
  independence: number;
  nhs: number;
  housing: number;
  climate: number;
  tax: number;
  economy: number;
  education: number;
  equality: number;
}

export interface CandidateSource {
  url: string;
  type: string;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  partyShort: string;
  color: string;
  accent: string;
  textColor?: string;
  constituency: string;
  isIncumbent: boolean;
  quizCandidate?: boolean;
  bio: string;
  positions?: CandidatePosition;
  stances?: Record<string, string>;
  highlights: string[];
  sources: CandidateSource[];
}

export interface PartyProjection {
  party: string;
  share: number;
  status: "will-win" | "could-win" | "might-win";
}

export interface Constituency {
  id: string;
  name: string;
  region: string;
  boundaryYear: number;
  description: string;
  context: string;
  projection?: string;
  projectionSource?: string;
  competitiveness?: "safe" | "competitive" | "marginal" | "toss-up";
  topParties?: PartyProjection[];
}

export interface QuizOption {
  label: string;
  value: number;
}

export interface QuizQuestion {
  id: string;
  area: string;
  question: string;
  options: QuizOption[];
}

export interface ResourceItem {
  name: string;
  url: string;
  description: string;
}

export interface ResourceSection {
  title: string;
  icon: string;
  items: ResourceItem[];
}

function loadYaml<T>(filePath: string): T {
  const fullPath = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  return yaml.parse(content) as T;
}

let candidatesCache: readonly Candidate[] | null = null;

export function loadCandidates(): Candidate[] {
  if (!candidatesCache) {
    const dir = path.resolve(process.cwd(), "data/candidates");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    candidatesCache = Object.freeze(files.map((f) => loadYaml<Candidate>(path.join("data/candidates", f))));
  }
  return [...candidatesCache];
}

export function loadConstituency(id: string): Constituency {
  return loadYaml<Constituency>(`data/constituencies/${id}.yaml`);
}

let constituenciesCache: readonly Constituency[] | null = null;

export function loadConstituencies(): Constituency[] {
  if (!constituenciesCache) {
    const dir = path.resolve(process.cwd(), "data/constituencies");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    constituenciesCache = Object.freeze(
      files.map((f) => loadYaml<Constituency>(path.join("data/constituencies", f)))
    );
  }
  return [...constituenciesCache];
}

export function loadCandidatesByConstituency(constituencyId: string): Candidate[] {
  return loadCandidates().filter((c) => c.constituency === constituencyId);
}

let questionsCache: readonly QuizQuestion[] | null = null;

export function loadQuestions(): QuizQuestion[] {
  if (!questionsCache) {
    const data = loadYaml<{ questions: QuizQuestion[] }>("data/questions.yaml");
    questionsCache = Object.freeze(data.questions);
  }
  return [...questionsCache];
}

export function loadResources(): ResourceSection[] {
  const data = loadYaml<{ sections: ResourceSection[] }>("data/resources.yaml");
  return data.sections;
}

export interface Party {
  id: string;
  name: string;
  positions: CandidatePosition;
  stances: Record<string, string>;
  quotes: Record<string, string>;
}

export interface ManifestoEntry {
  id: string;
  name: string;
  manifestoUrls: string[];
  manifestoPdf: string | null;
  parsedAt: string | null;
  positionsFile: string | null;
}

let partiesCache: readonly Party[] | null = null;

export function loadParties(): Party[] {
  if (!partiesCache) {
    const dir = path.resolve(process.cwd(), "data/parties");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    partiesCache = Object.freeze(files.map((f) => loadYaml<Party>(path.join("data/parties", f))));
  }
  return [...partiesCache];
}

let manifestoRegistryCache: readonly ManifestoEntry[] | null = null;

export function loadManifestoRegistry(): ManifestoEntry[] {
  if (!manifestoRegistryCache) {
    const data = loadYaml<{ parties: ManifestoEntry[] }>("data/manifestos/registry.yaml");
    manifestoRegistryCache = Object.freeze(data.parties);
  }
  return [...manifestoRegistryCache];
}
