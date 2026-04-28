import { describe, it, expect } from "vitest";
import {
  buildPartyBlocks,
  buildConstituencyToRegion,
  resolveInitialSelection,
  computeTopTie,
  type ConstituencyLite,
  type RegionLite,
} from "../src/lib/quiz-helpers";
import type { Candidate, RegionalCandidate } from "../src/lib/data";

const constituencies: ConstituencyLite[] = [
  { id: "glasgow-cathcart-and-pollok", name: "Glasgow Cathcart and Pollok", region: "Glasgow" },
  { id: "edinburgh-southern", name: "Edinburgh Southern", region: "Edinburgh and Lothians East" },
  // Constituency with stray trailing whitespace in the source — exercises the trim defensive.
  { id: "fife-mid-and-glenrothes", name: "Mid Fife and Glenrothes", region: "Mid Scotland and Fife " },
  { id: "bare", name: "Bare Constituency" },
];

const regions: RegionLite[] = [
  { id: "glasgow", name: "Glasgow" },
  { id: "edinburgh-and-lothians-east", name: "Edinburgh and Lothians East" },
  { id: "mid-scotland-and-fife", name: "Mid Scotland and Fife" },
];

const positions = {
  independence: 2,
  nhs: 2,
  housing: 1,
  climate: 1,
  tax: 1,
  economy: 1,
  education: 1,
  equality: 2,
};

const consA: Candidate = {
  id: "alice-snp",
  name: "Alice SNP",
  party: "Scottish National Party (SNP)",
  partyShort: "SNP",
  color: "#FDF38E",
  accent: "#9B870C",
  constituency: "glasgow-cathcart-and-pollok",
  isIncumbent: false,
  bio: "x",
  highlights: [],
  sources: [],
  positions,
};

const consB: Candidate = {
  ...consA,
  id: "bob-snp",
  name: "Bob SNP",
  isIncumbent: true,
};

const consLab: Candidate = {
  ...consA,
  id: "alex-lab",
  name: "Alex Lab",
  party: "Labour Party",
  partyShort: "Labour",
  color: "#DC241F",
  accent: "#8B0000",
  positions: {
    independence: 0,
    nhs: 2,
    housing: 1,
    climate: 1,
    tax: 1,
    economy: 1,
    education: 1,
    equality: 1,
  },
};

const reg1: RegionalCandidate = {
  id: "reg-snp-1",
  name: "Reg SNP One",
  party: "Scottish National Party (SNP)",
  partyShort: "SNP",
  color: "#FDF38E",
  accent: "#9B870C",
  region: "glasgow",
  regionLabel: "Glasgow",
  listPosition: 2,
  isIncumbent: false,
  bio: "x",
  highlights: [],
  sources: [],
  positions,
};

const reg2: RegionalCandidate = { ...reg1, id: "reg-snp-2", name: "Reg SNP Two", listPosition: 1 };

describe("buildPartyBlocks", () => {
  it("groups constituency candidates by party and sorts within a block alphabetically", () => {
    const blocks = buildPartyBlocks([consB, consA, consLab], "constituency", { independence: 2 });
    expect(blocks).toHaveLength(2);
    const snp = blocks.find((b) => b.party.includes("SNP"))!;
    expect(snp.candidates.map((c) => c.name)).toEqual(["Alice SNP", "Bob SNP"]);
    // listPosition is undefined for constituency blocks
    expect(snp.candidates.every((c) => c.listPosition === undefined)).toBe(true);
  });

  it("sorts regional candidates within a block by listPosition", () => {
    const blocks = buildPartyBlocks([reg1, reg2], "regional", { independence: 2 });
    expect(blocks).toHaveLength(1);
    const snp = blocks[0];
    expect(snp.candidates.map((c) => c.listPosition)).toEqual([1, 2]);
    expect(snp.candidates.map((c) => c.name)).toEqual(["Reg SNP Two", "Reg SNP One"]);
  });

  it("orders party blocks by match percentage descending then alphabetically", () => {
    const allMatchAnswers = { independence: 2, nhs: 2, housing: 1 };
    const blocks = buildPartyBlocks([consA, consLab], "constituency", allMatchAnswers);
    // SNP positions exactly match the answers (independence:2 nhs:2 housing:1 → 100%);
    // Labour has independence:0 not 2 so its score is lower.
    expect(blocks[0].party).toContain("SNP");
    expect(blocks[0].match.percentage).toBeGreaterThan(blocks[1].match.percentage);
  });

  it("ranks parties with no positions below those that have positions on tied 0%", () => {
    const noPositions: Candidate = { ...consA, id: "p-none", party: "Pirate Party", partyShort: "Pir", positions: undefined };
    // independence:0 vs SNP independence:2 = diff 2 = 0 points; SNP score 0%
    // but breakdown has one entry. Pirate has no positions so its breakdown
    // is empty. The block-sort tiebreaker should put SNP first.
    const blocks = buildPartyBlocks([consA, noPositions], "constituency", { independence: 0 });
    expect(blocks[0].match.percentage).toBe(0);
    expect(blocks[1].match.percentage).toBe(0);
    expect(blocks[0].party).toContain("SNP");
    expect(blocks[1].party).toBe("Pirate Party");
  });
});

describe("buildConstituencyToRegion", () => {
  it("maps each constituency id to its region's id slug", () => {
    const map = buildConstituencyToRegion(constituencies, regions);
    expect(map.get("glasgow-cathcart-and-pollok")).toBe("glasgow");
    expect(map.get("edinburgh-southern")).toBe("edinburgh-and-lothians-east");
  });

  it("trims whitespace on the constituency region field before matching", () => {
    const map = buildConstituencyToRegion(constituencies, regions);
    // "Mid Scotland and Fife " in source must still match the canonical region id.
    expect(map.get("fife-mid-and-glenrothes")).toBe("mid-scotland-and-fife");
  });

  it("omits constituencies with no region field", () => {
    const map = buildConstituencyToRegion(constituencies, regions);
    expect(map.has("bare")).toBe(false);
  });

  it("omits constituencies whose region doesn't match any known region", () => {
    const map = buildConstituencyToRegion(
      [{ id: "moon", name: "Moon", region: "Lunar Surface" }],
      regions
    );
    expect(map.size).toBe(0);
  });
});

describe("resolveInitialSelection", () => {
  const c2r = buildConstituencyToRegion(constituencies, regions);

  it("primes both ids and stays on the constituency tab when ?constituency= is given", () => {
    const params = new URLSearchParams("?constituency=glasgow-cathcart-and-pollok");
    const r = resolveInitialSelection(params, constituencies, regions, c2r);
    expect(r.constituencyId).toBe("glasgow-cathcart-and-pollok");
    expect(r.regionId).toBe("glasgow");
    expect(r.inboundRegional).toBe(false);
  });

  it("flips the active tab to regional when ?region= is the only inbound param", () => {
    const params = new URLSearchParams("?region=glasgow");
    const r = resolveInitialSelection(params, constituencies, regions, c2r);
    expect(r.regionId).toBe("glasgow");
    // A constituency in the region is auto-picked so the picker has a value.
    expect(r.constituencyId).toBe("glasgow-cathcart-and-pollok");
    expect(r.inboundRegional).toBe(true);
  });

  it("ignores ?region= when ?constituency= is also present", () => {
    const params = new URLSearchParams("?constituency=edinburgh-southern&region=glasgow");
    const r = resolveInitialSelection(params, constituencies, regions, c2r);
    expect(r.constituencyId).toBe("edinburgh-southern");
    expect(r.regionId).toBe("edinburgh-and-lothians-east");
    expect(r.inboundRegional).toBe(false);
  });

  it("returns empty selection when params point at unknown ids", () => {
    const params = new URLSearchParams("?constituency=nowhere&region=void");
    const r = resolveInitialSelection(params, constituencies, regions, c2r);
    expect(r.constituencyId).toBe("");
    expect(r.regionId).toBe("");
    expect(r.inboundRegional).toBe(false);
  });

  it("returns empty selection when no params are present", () => {
    const r = resolveInitialSelection(new URLSearchParams(""), constituencies, regions, c2r);
    expect(r.constituencyId).toBe("");
    expect(r.inboundRegional).toBe(false);
  });
});

describe("buildPartyBlocks rank assignment", () => {
  it("assigns rank 1 to the leader and increments for distinct percentages", () => {
    const allMatchAnswers = { independence: 2, nhs: 2, housing: 1 };
    const blocks = buildPartyBlocks([consA, consLab], "constituency", allMatchAnswers);
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(2);
  });

  it("shares rank 1 across blocks with identical percentage", () => {
    const consTie: Candidate = {
      ...consA,
      id: "alice-green",
      name: "Alice Green",
      party: "Scottish Greens",
      partyShort: "Greens",
    };
    const blocks = buildPartyBlocks(
      [consA, consTie],
      "constituency",
      { independence: 2, nhs: 2, housing: 1 }
    );
    expect(blocks[0].match.percentage).toBe(blocks[1].match.percentage);
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(1);
  });

  it("uses competition ranking (1, 1, 3) after a tie", () => {
    const consTie: Candidate = {
      ...consA,
      id: "alice-green",
      name: "Alice Green",
      party: "Scottish Greens",
      partyShort: "Greens",
    };
    const blocks = buildPartyBlocks(
      [consA, consTie, consLab],
      "constituency",
      { independence: 2, nhs: 2, housing: 1 }
    );
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(1);
    expect(blocks[2].rank).toBe(3);
  });

  it("does not share rank between positioned and no-position blocks at 0%", () => {
    const noPositions: Candidate = {
      ...consA,
      id: "p-none",
      party: "Pirate Party",
      partyShort: "Pir",
      positions: undefined,
    };
    const blocks = buildPartyBlocks([consA, noPositions], "constituency", { independence: 0 });
    expect(blocks[0].rank).toBe(1);
    expect(blocks[1].rank).toBe(2);
  });
});

describe("computeTopTie", () => {
  it("returns count 1 and the top percentage for a clean win", () => {
    const allMatchAnswers = { independence: 2, nhs: 2, housing: 1 };
    const blocks = buildPartyBlocks([consA, consLab], "constituency", allMatchAnswers);
    const tie = computeTopTie(blocks);
    expect(tie.count).toBe(1);
    expect(tie.topPercentage).toBe(blocks[0].match.percentage);
    expect(tie.noClearLeader).toBe(false);
  });

  it("excludes blocks with no positions from the tie count", () => {
    const noPositions: Candidate = {
      ...consA,
      id: "p-none",
      party: "Pirate Party",
      partyShort: "Pir",
      positions: undefined,
    };
    const blocks = buildPartyBlocks([consA, noPositions], "constituency", { independence: 2 });
    const tie = computeTopTie(blocks);
    expect(tie.count).toBe(1);
  });

  it("flags noClearLeader when 4+ parties tie at rank 1", () => {
    const mk = (id: string, party: string): Candidate => ({
      ...consA,
      id,
      party,
      partyShort: id.toUpperCase(),
    });
    const blocks = buildPartyBlocks(
      [mk("a", "A"), mk("b", "B"), mk("c", "C"), mk("d", "D")],
      "constituency",
      { independence: 2 }
    );
    const tie = computeTopTie(blocks);
    expect(tie.count).toBe(4);
    expect(tie.noClearLeader).toBe(true);
  });

  it("flags noClearLeader when top percentage is zero", () => {
    const sibling: Candidate = {
      ...consA,
      id: "p2",
      party: "P2",
      partyShort: "P2",
    };
    const blocks = buildPartyBlocks([consA, sibling], "constituency", { independence: 0 });
    expect(blocks[0].match.percentage).toBe(0);
    const tie = computeTopTie(blocks);
    expect(tie.topPercentage).toBe(0);
    expect(tie.noClearLeader).toBe(true);
  });
});
