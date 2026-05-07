import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
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
  const regionalCandidateSchema = loadJson("schemas/regional-candidate.schema.json");
  const constituencySchema = loadJson("schemas/constituency.schema.json");
  const questionsSchema = loadJson("schemas/questions.schema.json");
  const partySchema = loadJson("schemas/party.schema.json");
  const manifestoRegistrySchema = loadJson("schemas/manifesto-registry.schema.json");
  const resultsConstituencySchema = loadJson("schemas/results-constituency.schema.json");
  const resultsRegionalSchema = loadJson("schemas/results-regional.schema.json");
  const electionStateSchema = loadJson("schemas/election-state.schema.json");

  const validateCandidate = ajv.compile(candidateSchema);
  const validateRegionalCandidate = ajv.compile(regionalCandidateSchema);
  const validateConstituency = ajv.compile(constituencySchema);
  const validateQuestions = ajv.compile(questionsSchema);
  const validateParty = ajv.compile(partySchema);
  const validateManifestoRegistry = ajv.compile(manifestoRegistrySchema);
  const validateResultsConstituency = ajv.compile(resultsConstituencySchema);
  const validateResultsRegional = ajv.compile(resultsRegionalSchema);
  const validateElectionState = ajv.compile(electionStateSchema);

  // Validate candidates
  const candidateDir = "data/candidates";
  const candidateFiles = fs.readdirSync(candidateDir).filter((f) => f.endsWith(".yaml"));
  for (const file of candidateFiles) {
    const data = loadYaml(path.join(candidateDir, file));
    if (!validateCandidate(data)) {
      errors.push(`${file}: ${ajv.errorsText(validateCandidate.errors)}`);
    }
  }

  // Validate regional list candidates
  const regionalCandidateDir = "data/regional-candidates";
  if (fs.existsSync(regionalCandidateDir)) {
    const regionalFiles = fs.readdirSync(regionalCandidateDir).filter((f) => f.endsWith(".yaml"));
    for (const file of regionalFiles) {
      const data = loadYaml(path.join(regionalCandidateDir, file));
      if (!validateRegionalCandidate(data)) {
        errors.push(`regional-candidates/${file}: ${ajv.errorsText(validateRegionalCandidate.errors)}`);
      }
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

  // Validate parties
  const partyDir = "data/parties";
  const partyFiles = fs.readdirSync(partyDir).filter((f) => f.endsWith(".yaml"));
  for (const file of partyFiles) {
    const data = loadYaml(path.join(partyDir, file));
    if (!validateParty(data)) {
      errors.push(`${file}: ${ajv.errorsText(validateParty.errors)}`);
    }
  }

  // Validate manifesto registry
  const manifestoRegistryData = loadYaml("data/manifestos/registry.yaml");
  if (!validateManifestoRegistry(manifestoRegistryData)) {
    errors.push(`manifestos/registry.yaml: ${ajv.errorsText(validateManifestoRegistry.errors)}`);
  }

  // Validate election state
  const electionStatePath = "data/election-state.yaml";
  if (fs.existsSync(electionStatePath)) {
    const data = loadYaml(electionStatePath);
    if (!validateElectionState(data)) {
      errors.push(`election-state.yaml: ${ajv.errorsText(validateElectionState.errors)}`);
    }
  }

  // Validate constituency results
  const resultsConstituencyDir = "data/results/constituencies";
  if (fs.existsSync(resultsConstituencyDir)) {
    for (const file of fs.readdirSync(resultsConstituencyDir).filter((f) => f.endsWith(".yaml"))) {
      const data = loadYaml(path.join(resultsConstituencyDir, file));
      if (!validateResultsConstituency(data)) {
        errors.push(`results/constituencies/${file}: ${ajv.errorsText(validateResultsConstituency.errors)}`);
      }
    }
  }

  // Validate regional results
  const resultsRegionalDir = "data/results/regional";
  if (fs.existsSync(resultsRegionalDir)) {
    for (const file of fs.readdirSync(resultsRegionalDir).filter((f) => f.endsWith(".yaml"))) {
      const data = loadYaml(path.join(resultsRegionalDir, file));
      if (!validateResultsRegional(data)) {
        errors.push(`results/regional/${file}: ${ajv.errorsText(validateResultsRegional.errors)}`);
      }
    }
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
