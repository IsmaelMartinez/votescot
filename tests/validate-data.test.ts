import { describe, it, expect } from "vitest";
import { validateData } from "../scripts/validate-data";

describe("data validation", () => {
  it("all YAML data files pass schema validation", () => {
    const { valid, errors } = validateData();
    if (!valid) {
      throw new Error(`Data validation failed:\n${errors.join("\n")}`);
    }
    expect(valid).toBe(true);
  });
});
