import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020";
import yaml from "yaml";

const ajv = new Ajv({ allErrors: true, strict: false });

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
}

function loadYaml(filePath: string) {
  return yaml.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
}

export function validateData(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const candidateSchema = loadJson("schemas/candidate.schema.json");
  const constituencySchema = loadJson("schemas/constituency.schema.json");
  const questionsSchema = loadJson("schemas/questions.schema.json");

  const validateCandidate = ajv.compile(candidateSchema);
  const validateConstituency = ajv.compile(constituencySchema);
  const validateQuestions = ajv.compile(questionsSchema);

  // Validate candidates
  const candidateDir = "data/candidates";
  const candidateFiles = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  for (const file of candidateFiles) {
    const data = loadYaml(path.join(candidateDir, file));
    if (!validateCandidate(data)) {
      errors.push(`${file}: ${ajv.errorsText(validateCandidate.errors)}`);
    }
  }

  // Validate constituencies
  const constituencyDir = "data/constituencies";
  const constituencyFiles = fs.readdirSync(constituencyDir).filter((f) => f.endsWith(".yaml"));
  for (const file of constituencyFiles) {
    const data = loadYaml(path.join(constituencyDir, file));
    if (!validateConstituency(data)) {
      errors.push(`${file}: ${ajv.errorsText(validateConstituency.errors)}`);
    }
  }

  // Validate questions
  const questionsData = loadYaml("data/questions.yaml");
  if (!validateQuestions(questionsData)) {
    errors.push(`questions.yaml: ${ajv.errorsText(validateQuestions.errors)}`);
  }

  return { valid: errors.length === 0, errors };
}

// Run directly if called as script
if (process.argv[1]?.endsWith("validate-data.ts")) {
  const { valid, errors } = validateData();
  if (valid) {
    console.log("All data files valid.");
    process.exit(0);
  } else {
    console.error("Validation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
