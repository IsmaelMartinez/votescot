import { describe, it, expect } from "vitest";
import { slugifyConstituency } from "../src/lib/slugify";

describe("slugifyConstituency", () => {
  it("handles comma-separated parts", () => {
    expect(slugifyConstituency("Midlothian South, Tweeddale and Lauderdale")).toBe(
      "midlothian-south-tweeddale-and-lauderdale"
    );
  });

  it("handles hyphenated Gaelic names", () => {
    expect(slugifyConstituency("Na h-Eileanan an Iar")).toBe(
      "na-h-eileanan-an-iar"
    );
  });

  it("handles simple multi-word names", () => {
    expect(slugifyConstituency("Edinburgh North Western")).toBe(
      "edinburgh-north-western"
    );
  });

  it("handles names with 'and' but no comma", () => {
    expect(slugifyConstituency("Glasgow Cathcart and Pollok")).toBe(
      "glasgow-cathcart-and-pollok"
    );
  });

  it("strips apostrophes", () => {
    expect(slugifyConstituency("King's Park")).toBe("kings-park");
  });
});
