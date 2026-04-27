import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// astro.config.mjs holds the redirect that keeps the legacy /quiz/regional URL
// (and any inbound ?region= deeplinks built from old screenshots) landing on
// the consolidated /quiz route. Lock that in so removing it doesn't slip past
// review unnoticed.
describe("astro redirects", () => {
  const config = fs.readFileSync(path.resolve("astro.config.mjs"), "utf-8");

  it("redirects /quiz/regional to /quiz", () => {
    expect(config).toMatch(/"\/quiz\/regional":\s*"[^"]*\/quiz"/);
  });
});
