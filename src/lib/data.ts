import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { slugifyConstituency } from "./slugify";

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

export interface Region {
  id: string;
  name: string;
}

let regionsCache: readonly Region[] | null = null;

export function loadRegions(): Region[] {
  if (!regionsCache) {
    const names = new Set<string>();
    for (const c of loadConstituencies()) {
      if (c.region && c.region.trim()) names.add(c.region.trim());
    }
    const regions = Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: slugifyConstituency(name), name }));
    regionsCache = Object.freeze(regions);
  }
  return [...regionsCache];
}

let candidatesByRegionCache: ReadonlyMap<string, readonly Candidate[]> | null = null;

function buildCandidatesByRegion(): ReadonlyMap<string, readonly Candidate[]> {
  const constituencyToRegionId = new Map<string, string>();
  for (const c of loadConstituencies()) {
    if (c.region?.trim()) constituencyToRegionId.set(c.id, slugifyConstituency(c.region.trim()));
  }
  const grouped = new Map<string, Candidate[]>();
  for (const cand of loadCandidates()) {
    const regionId = constituencyToRegionId.get(cand.constituency);
    if (!regionId) continue;
    let bucket = grouped.get(regionId);
    if (!bucket) {
      bucket = [];
      grouped.set(regionId, bucket);
    }
    bucket.push(cand);
  }
  return new Map(Array.from(grouped, ([k, v]) => [k, Object.freeze(v) as readonly Candidate[]]));
}

export function loadCandidatesByRegion(regionId: string): Candidate[] {
  if (!candidatesByRegionCache) candidatesByRegionCache = buildCandidatesByRegion();
  return [...(candidatesByRegionCache.get(regionId) ?? [])];
}

export interface RegionalCandidate {
  id: string;
  name: string;
  party: string;
  partyShort: string;
  color: string;
  accent: string;
  textColor?: string;
  region: string;
  regionLabel: string;
  listPosition: number;
  ballotPaperId?: string;
  isIncumbent: boolean;
  quizCandidate?: boolean;
  bio: string;
  positions?: CandidatePosition;
  stances?: Record<string, string>;
  highlights: string[];
  sources: CandidateSource[];
}

let regionalCandidatesCache: readonly RegionalCandidate[] | null = null;

export function loadRegionalCandidates(): RegionalCandidate[] {
  if (!regionalCandidatesCache) {
    const dir = path.resolve(process.cwd(), "data/regional-candidates");
    if (!fs.existsSync(dir)) {
      regionalCandidatesCache = Object.freeze([]);
    } else {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
      regionalCandidatesCache = Object.freeze(
        files.map((f) => loadYaml<RegionalCandidate>(path.join("data/regional-candidates", f)))
      );
    }
  }
  return [...regionalCandidatesCache];
}

let regionalCandidatesByRegionCache: ReadonlyMap<string, readonly RegionalCandidate[]> | null = null;

function buildRegionalCandidatesByRegion(): ReadonlyMap<string, readonly RegionalCandidate[]> {
  const grouped = new Map<string, RegionalCandidate[]>();
  for (const cand of loadRegionalCandidates()) {
    let bucket = grouped.get(cand.region);
    if (!bucket) {
      bucket = [];
      grouped.set(cand.region, bucket);
    }
    bucket.push(cand);
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => a.listPosition - b.listPosition);
  }
  return new Map(Array.from(grouped, ([k, v]) => [k, Object.freeze(v) as readonly RegionalCandidate[]]));
}

export function loadRegionalCandidatesByRegion(regionId: string): RegionalCandidate[] {
  if (!regionalCandidatesByRegionCache) regionalCandidatesByRegionCache = buildRegionalCandidatesByRegion();
  return [...(regionalCandidatesByRegionCache.get(regionId) ?? [])];
}

let questionsCache: readonly QuizQuestion[] | null = null;

export function loadQuestions(): QuizQuestion[] {
  if (!questionsCache) {
    const data = loadYaml<{ questions: QuizQuestion[] }>("data/questions.yaml");
    questionsCache = Object.freeze(data.questions);
  }
  return [...questionsCache];
}

let resourcesCache: readonly ResourceSection[] | null = null;

export function loadResources(): ResourceSection[] {
  if (!resourcesCache) {
    const data = loadYaml<{ sections: ResourceSection[] }>("data/resources.yaml");
    resourcesCache = Object.freeze(data.sections);
  }
  return [...resourcesCache];
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

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

export interface NewsFeed {
  lastUpdated: string;
  sources: { name: string; url: string }[];
  items: NewsItem[];
}

let newsCache: Readonly<NewsFeed> | null = null;

export function loadNews(): NewsFeed {
  if (!newsCache) {
    const newsPath = path.resolve(process.cwd(), "data/news.json");
    if (!fs.existsSync(newsPath)) {
      newsCache = Object.freeze({ lastUpdated: "", sources: [], items: [] });
    } else {
      newsCache = Object.freeze(JSON.parse(fs.readFileSync(newsPath, "utf-8")) as NewsFeed);
    }
  }
  return newsCache;
}

export type ElectionPhase =
  | "forecast"
  | "polls-open"
  | "counting"
  | "partial"
  | "final";

export interface ElectionState {
  phase: ElectionPhase;
  pollDay: string;
  lastUpdated: string | null;
  constituenciesDeclared: number;
  regionsDeclared: number;
  summary: string | null;
}

let electionStateCache: Readonly<ElectionState> | null = null;

export function loadElectionState(): ElectionState {
  if (!electionStateCache) {
    const filePath = path.resolve(process.cwd(), "data/election-state.yaml");
    if (!fs.existsSync(filePath)) {
      electionStateCache = Object.freeze({
        phase: "forecast",
        pollDay: "2026-05-07",
        lastUpdated: null,
        constituenciesDeclared: 0,
        regionsDeclared: 0,
        summary: null,
      });
    } else {
      const data = yaml.parse(fs.readFileSync(filePath, "utf-8")) as ElectionState;
      electionStateCache = Object.freeze({
        constituenciesDeclared: 0,
        regionsDeclared: 0,
        lastUpdated: null,
        summary: null,
        ...data,
      });
    }
  }
  return electionStateCache;
}

/** True once at least one result is in (used to switch UI from forecast to results). */
export function resultsAvailable(): boolean {
  const phase = loadElectionState().phase;
  return phase === "partial" || phase === "final";
}

export type ResultStatus = "pending" | "partial" | "declared";

export interface ResultEntry {
  party: string;
  candidate: string;
  votes: number;
  share?: number;
  isIncumbent?: boolean;
}

export interface ConstituencyResult {
  id: string;
  status: ResultStatus;
  declaredAt: string | null;
  turnout: {
    valid: number;
    rejected?: number;
    electorate: number;
    percent?: number;
  } | null;
  winner: string | null;
  results: ResultEntry[];
  majority: { votes: number; share: number; over?: string } | null;
  source: string | null;
}

export interface RegionalSeatAward {
  party: string;
  candidate: string;
  listPosition: number;
}

export interface RegionalResultEntry {
  party: string;
  votes: number;
  share?: number;
  listSeats?: number;
}

export interface RegionalResult {
  id: string;
  name: string;
  status: ResultStatus;
  declaredAt: string | null;
  turnout: ConstituencyResult["turnout"];
  results: RegionalResultEntry[];
  seatsAwarded: RegionalSeatAward[];
  source: string | null;
  manualEntry?: boolean;
}

let constituencyResultsCache: ReadonlyMap<string, ConstituencyResult> | null = null;

export function loadConstituencyResults(): Map<string, ConstituencyResult> {
  if (!constituencyResultsCache) {
    const dir = path.resolve(process.cwd(), "data/results/constituencies");
    const map = new Map<string, ConstituencyResult>();
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
        const data = loadYaml<ConstituencyResult>(path.join("data/results/constituencies", f));
        map.set(data.id, data);
      }
    }
    constituencyResultsCache = map;
  }
  return new Map(constituencyResultsCache);
}

export function loadConstituencyResult(id: string): ConstituencyResult | null {
  return loadConstituencyResults().get(id) ?? null;
}

let regionalResultsCache: ReadonlyMap<string, RegionalResult> | null = null;

export function loadRegionalResults(): Map<string, RegionalResult> {
  if (!regionalResultsCache) {
    const dir = path.resolve(process.cwd(), "data/results/regional");
    const map = new Map<string, RegionalResult>();
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
        const data = loadYaml<RegionalResult>(path.join("data/results/regional", f));
        map.set(data.id, data);
      }
    }
    regionalResultsCache = map;
  }
  return new Map(regionalResultsCache);
}

export interface AccuracyReport {
  generatedAt: string;
  pollDay: string;
  national: {
    constituency: NationalActual | null;
    regional: NationalActual | null;
  };
  pollsters: PollsterScore[];
  mrps: MrpScore[];
  votescotProjection: VotescotProjectionScore | null;
}

export interface NationalActual {
  snp: number;
  con: number;
  lab: number;
  libdem: number;
  green: number;
  reform: number;
  alba: number;
}

export interface PollsterScore {
  pollster: string;
  client: string;
  ballot: "constituency" | "regional";
  date: string;
  endDate: string;
  shares: Partial<NationalActual>;
  mae: number;
  rmse: number;
  errors: Partial<NationalActual>;
}

export interface MrpScore {
  pollster: string;
  client: string;
  date: string;
  endDate: string;
  predicted: { snp: number; con: number; lab: number; libdem: number; green: number; reform: number; alba?: number };
  actual: { snp: number; con: number; lab: number; libdem: number; green: number; reform: number; alba: number };
  seatMae: number;
  totalSeatError: number;
}

export interface VotescotProjectionScore {
  totalSeats: number;
  correctWinners: number;
  hitRate: number;
  byCompetitiveness: Record<string, { total: number; correct: number; hitRate: number }>;
  shareMae: number;
  perSeat: Array<{
    id: string;
    predictedWinner: string | null;
    actualWinner: string | null;
    correct: boolean;
    competitiveness: string | null;
  }>;
}

let accuracyReportCache: Readonly<AccuracyReport> | null = null;

export function loadAccuracyReport(): AccuracyReport | null {
  if (accuracyReportCache) return accuracyReportCache;
  const reportPath = path.resolve(process.cwd(), "data/accuracy-report.json");
  if (!fs.existsSync(reportPath)) return null;
  accuracyReportCache = Object.freeze(
    JSON.parse(fs.readFileSync(reportPath, "utf-8")) as AccuracyReport,
  );
  return accuracyReportCache;
}
