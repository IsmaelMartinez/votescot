import fs from "node:fs";
import path from "node:path";

export type PartyKey = "snp" | "con" | "lab" | "libdem" | "green" | "reform" | "alba";

export interface PollEntry {
  date: string;
  endDate: string;
  pollster: string;
  client: string;
  sampleSize: number | null;
  snp: number | null;
  con: number | null;
  lab: number | null;
  libdem: number | null;
  green: number | null;
  alba: number | null;
  reform: number | null;
  others: number | null;
}

export interface PollsFile {
  lastUpdated: string;
  constituency: PollEntry[];
  regional: PollEntry[];
}

export type PartyShares = Record<PartyKey, number>;

const PARTY_KEYS: PartyKey[] = ["snp", "con", "lab", "libdem", "green", "reform", "alba"];

export function loadPolls(pollsPath = path.resolve("data/polls.json")): PollsFile {
  return JSON.parse(fs.readFileSync(pollsPath, "utf-8")) as PollsFile;
}

function pollMidDate(p: PollEntry): number {
  const start = new Date(p.date).getTime();
  const end = new Date(p.endDate).getTime();
  return (start + end) / 2;
}

/**
 * Weighted rolling average over the most recent `windowSize` polls.
 * Weights are linear by recency: newest poll weight = windowSize, oldest = 1.
 * Nulls for a party are excluded from that party's average (weight redistributed).
 */
export function rollingAverage(
  polls: PollEntry[],
  windowSize = 5,
): { shares: PartyShares; pollsUsed: PollEntry[] } {
  const sorted = [...polls].sort((a, b) => pollMidDate(b) - pollMidDate(a));
  const window = sorted.slice(0, windowSize);

  const shares = {} as PartyShares;
  for (const party of PARTY_KEYS) {
    let weightedSum = 0;
    let weightTotal = 0;
    window.forEach((poll, idx) => {
      const weight = windowSize - idx;
      const value = poll[party];
      if (value != null) {
        weightedSum += value * weight;
        weightTotal += weight;
      }
    });
    shares[party] = weightTotal > 0 ? weightedSum / weightTotal : 0;
  }
  return { shares, pollsUsed: window };
}

/** 2021 Scottish Parliament election national results (first-past-the-post constituency vote). */
export const BASELINE_2021_CONSTITUENCY: PartyShares = {
  snp: 47.7,
  con: 21.9,
  lab: 21.6,
  libdem: 6.9,
  green: 1.3,
  reform: 0, // did not stand for Holyrood constituencies in 2021
  alba: 0, // list-only in 2021
};

/** 2021 Scottish Parliament election national results (regional list vote). */
export const BASELINE_2021_REGIONAL: PartyShares = {
  snp: 40.3,
  con: 23.5,
  lab: 17.9,
  libdem: 5.1,
  green: 8.1,
  reform: 0,
  alba: 1.7,
};

export function swingFrom(baseline: PartyShares, current: PartyShares): PartyShares {
  const out = {} as PartyShares;
  for (const party of PARTY_KEYS) {
    out[party] = current[party] - baseline[party];
  }
  return out;
}

export { PARTY_KEYS };
