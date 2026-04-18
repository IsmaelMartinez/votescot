import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import yaml from "yaml";
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

describe("party schema", () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const partySchema = JSON.parse(
    fs.readFileSync(path.resolve("schemas/party.schema.json"), "utf-8"),
  );
  const validateParty = ajv.compile(partySchema);

  const partyDir = "data/parties";
  const partyFiles = fs
    .readdirSync(partyDir)
    .filter((f) => f.endsWith(".yaml"));

  it("validates all current party files", () => {
    expect(partyFiles.length).toBeGreaterThan(0);
    for (const file of partyFiles) {
      const data = yaml.parse(
        fs.readFileSync(path.join(partyDir, file), "utf-8"),
      );
      const ok = validateParty(data);
      if (!ok) {
        throw new Error(
          `${file} failed validation: ${ajv.errorsText(validateParty.errors)}`,
        );
      }
      expect(ok).toBe(true);
    }
  });

  it("rejects a party with an out-of-range position", () => {
    const base = yaml.parse(
      fs.readFileSync(path.join(partyDir, partyFiles[0]), "utf-8"),
    );
    const broken = {
      ...base,
      positions: { ...base.positions, nhs: 3 },
    };
    expect(validateParty(broken)).toBe(false);
  });

  it("rejects a party with an unknown top-level property", () => {
    const base = yaml.parse(
      fs.readFileSync(path.join(partyDir, partyFiles[0]), "utf-8"),
    );
    const broken = { ...base, extra: "nope" };
    expect(validateParty(broken)).toBe(false);
  });

  it("rejects a party missing a required position key", () => {
    const base = yaml.parse(
      fs.readFileSync(path.join(partyDir, partyFiles[0]), "utf-8"),
    );
    const { nhs: _nhs, ...positionsWithoutNhs } = base.positions;
    const broken = { ...base, positions: positionsWithoutNhs };
    expect(validateParty(broken)).toBe(false);
  });
});

describe("manifesto registry schema", () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const registrySchema = JSON.parse(
    fs.readFileSync(
      path.resolve("schemas/manifesto-registry.schema.json"),
      "utf-8",
    ),
  );
  const validateRegistry = ajv.compile(registrySchema);

  const registryData = yaml.parse(
    fs.readFileSync(path.resolve("data/manifestos/registry.yaml"), "utf-8"),
  );

  it("validates the current manifesto registry", () => {
    const ok = validateRegistry(registryData);
    if (!ok) {
      throw new Error(
        `registry.yaml failed validation: ${ajv.errorsText(validateRegistry.errors)}`,
      );
    }
    expect(ok).toBe(true);
  });

  it("rejects a registry entry with empty manifestoUrls", () => {
    const broken = {
      parties: [
        {
          ...registryData.parties[0],
          manifestoUrls: [],
        },
      ],
    };
    expect(validateRegistry(broken)).toBe(false);
  });

  it("rejects a registry entry with a malformed parsedAt date", () => {
    const broken = {
      parties: [
        {
          ...registryData.parties[0],
          parsedAt: "yesterday",
        },
      ],
    };
    expect(validateRegistry(broken)).toBe(false);
  });
});
