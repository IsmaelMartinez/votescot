import { describe, it, expect } from "vitest";
import { matchPartyId } from "../src/lib/party-match";

describe("matchPartyId", () => {
  it("matches SNP candidate to party id", () => {
    expect(matchPartyId("Scottish National Party (SNP)")).toBe("scottish-national-party");
  });

  it("matches Labour candidate to party id", () => {
    expect(matchPartyId("Labour Party")).toBe("scottish-labour");
  });

  it("matches Conservative candidate to party id", () => {
    expect(matchPartyId("Conservative and Unionist Party")).toBe("scottish-conservatives");
  });

  it("matches Liberal Democrats candidate to party id", () => {
    expect(matchPartyId("Scottish Liberal Democrats")).toBe("scottish-liberal-democrats");
  });

  it("matches Green candidate to party id", () => {
    expect(matchPartyId("Scottish Green Party")).toBe("scottish-green-party");
  });

  it("matches Reform UK candidate to party id", () => {
    expect(matchPartyId("Reform UK")).toBe("reform-uk");
  });

  it("returns undefined for unknown party", () => {
    expect(matchPartyId("Galactic Federation")).toBeUndefined();
  });

  it("returns undefined for Independent", () => {
    expect(matchPartyId("Independent")).toBeUndefined();
  });
});
