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
  bio: string;
  positions: CandidatePosition;
  stances: Record<string, string>;
  highlights: string[];
  sources: CandidateSource[];
}

export interface Constituency {
  id: string;
  name: string;
  region: string;
  boundaryYear: number;
  description: string;
  context: string;
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

export function loadCandidates(): Candidate[] {
  const dir = path.resolve(process.cwd(), "data/candidates");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => loadYaml<Candidate>(path.join("data/candidates", f)));
}

export function loadConstituency(id: string): Constituency {
  return loadYaml<Constituency>(`data/constituencies/${id}.yaml`);
}

export function loadQuestions(): QuizQuestion[] {
  const data = loadYaml<{ questions: QuizQuestion[] }>("data/questions.yaml");
  return data.questions;
}

export function loadResources(): ResourceSection[] {
  const data = loadYaml<{ sections: ResourceSection[] }>("data/resources.yaml");
  return data.sections;
}

export function loadPostcodeSectors(): Record<string, string[]> {
  return loadYaml<Record<string, string[]>>("data/postcode-sectors.yaml");
}
