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
