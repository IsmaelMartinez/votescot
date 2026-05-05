import { describe, it, expect } from "vitest";
import { POLLSTER_ALIASES, CLIENT_ALIASES } from "../scripts/sync-polls.ts";

describe("POLLSTER_ALIASES", () => {
  it("maps predecessor brands to current names", () => {
    expect(POLLSTER_ALIASES["Ipsos MORI"]).toBe("Ipsos");
    expect(POLLSTER_ALIASES["Savanta ComRes"]).toBe("Savanta");
  });

  it("does not alias the canonical names back to themselves", () => {
    // Passthrough check: a canonical name lookup misses, so callers fall back
    // to the original via `?? name` in the consumer.
    expect(POLLSTER_ALIASES["Ipsos"]).toBeUndefined();
    expect(POLLSTER_ALIASES["Savanta"]).toBeUndefined();
  });
});

describe("CLIENT_ALIASES", () => {
  it("maps the Wikipedia 'Diffley Parntership' typo to the correct spelling", () => {
    expect(CLIENT_ALIASES["Diffley Parntership"]).toBe("Diffley Partnership");
  });

  it("leaves the corrected client name as a passthrough", () => {
    expect(CLIENT_ALIASES["Diffley Partnership"]).toBeUndefined();
  });
});
