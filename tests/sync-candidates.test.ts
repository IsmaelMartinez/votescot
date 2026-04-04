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
