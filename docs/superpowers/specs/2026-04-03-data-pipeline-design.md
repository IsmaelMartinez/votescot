# VoteScot Data Pipeline Design Spec

Automated pipeline to ingest candidate data, constituency information, and party manifesto positions for all 73 Scottish Parliament constituencies, with daily updates via GitHub Actions.

## Decisions

- Data source: Democracy Club API (candidates), Scottish Parliament Open Data (MSP records), party websites (manifestos)
- Manifesto parsing: fully automated via Google Gemini API (free tier), no manual review gate
- Policy positions: party-level defaults from manifestos, applied to all candidates from that party
- Change management: auto-commit additions/updates, PR for deletions and quiz position changes
- Schedule: daily cron via GitHub Actions
- All scripts in TypeScript, run via tsx

## Architecture

Two GitHub Actions cron jobs run daily. The first (`sync-candidates`) pulls the full candidate list from the Democracy Club API, diffs against existing YAML files, and commits changes. The second (`sync-manifestos`) checks party websites for manifesto PDFs, downloads new ones, parses them through Gemini to extract structured policy positions, and applies those positions to all candidates from that party.

Both pipelines write to the same YAML data files that the Astro site reads at build time. Any push to main triggers the existing deploy workflow, so changes go live automatically.

## Candidate Data Sync

A GitHub Action (`sync-candidates.yml`) runs daily at 06:00 UTC. It executes `scripts/sync-candidates.ts`.

### Data source

Democracy Club API at `https://candidates.democracyclub.org.uk/api/next/` — returns all candidates for `sp.c.*.2026-05-07` elections with name, party, constituency, and links.

### Constituency creation

For each constituency in the API response, create or update `data/constituencies/{id}.yaml` with:
- id (slugified constituency name)
- name
- region (from the corresponding SPE/SPEF area)
- boundaryYear: 2026
- description (generated from area data)
- context (left as "Data synced from Democracy Club" for new constituencies)

### Candidate creation

For each candidate, create or update `data/candidates/{slug}.yaml`. The slug is derived from the candidate name (lowercase, hyphenated). New candidates get:
- id, name, party, partyShort, color, accent (from a party colour map)
- constituency (mapped from election ID)
- isIncumbent (cross-referenced with Scottish Parliament API)
- quizCandidate: false (until manifesto positions are applied)
- bio (from Democracy Club statement if available, or party + constituency description)
- highlights (empty or from sitting MSP record)
- sources (Democracy Club profile URL, party website, TheyWorkForYou link for sitting MSPs)

No positions or stances fields until manifesto data is available.

### Change handling

- New candidates: auto-commit to main
- Updated candidate details (bio, links): auto-commit to main
- Candidate no longer in API (withdrawn): open PR for review, do not auto-delete
- Sitting MSP enrichment: pull from data.parliament.scot for voting record highlights

### Party colour map

Hardcoded mapping of party names to hex colours:
- SNP: #FDF38E / #9B870C (textColor: #333)
- Scottish Greens: #00A651 / #007A3D
- Scottish Labour: #DC241F / #8B0000
- Scottish Conservatives: #0087DC / #005EA5
- Liberal Democrats: #FAA61A / #B8860B
- Reform UK: #12B6CF / #0a7f91
- Alba: #005EB8 / #003d7a
- Workers Party: #c41230 / #8b0d22
- Independent: #888888 / #555555
- Default: #666666 / #444444

## Manifesto Discovery and Parsing

A GitHub Action (`sync-manifestos.yml`) runs daily at 07:00 UTC. It executes `scripts/sync-manifestos.ts`.

### Registry

`data/manifestos/registry.yaml` tracks each party's manifesto status:

```yaml
parties:
  - id: "snp"
    name: "Scottish National Party"
    manifestoUrls:
      - "https://www.snp.org/manifesto"
      - "https://www.snp.org/policies"
    manifestoPdf: null          # set when found
    parsedAt: null              # set when parsed
    positionsFile: null         # path to generated positions file
```

### Discovery

For each party in the registry, fetch the known manifesto URLs and search for PDF links. When a new PDF is found that hasn't been parsed (based on URL not matching `manifestoPdf`):

1. Download the PDF
2. Extract text via pdf-parse
3. Send to Gemini API with structured prompt
4. Write party positions to `data/parties/{party-id}.yaml`
5. Update registry with manifestoPdf, parsedAt, positionsFile
6. Apply positions to all candidates from that party

### Gemini prompt structure

The prompt sends the full manifesto text and asks for:
- Position score (0, 1, or 2) for each of the 8 policy areas
- Human-readable stance description (1-2 sentences)
- Direct quote from the manifesto as evidence
- The scoring convention is defined explicitly:
  - independence: 0=oppose, 1=neutral, 2=support
  - nhs: 0=reform/cut, 1=maintain, 2=expand/invest
  - housing: 0=market, 1=build, 2=regulate
  - climate: 0=affordable-first, 1=balanced, 2=urgent
  - tax: 0=cut, 1=maintain, 2=raise
  - economy: 0=pro-business, 1=public-investment, 2=green/radical
  - education: 0=vocational, 1=attainment, 2=expand-childcare
  - equality: 0=conservative, 1=moderate, 2=progressive

### Party positions file

`data/parties/{party-id}.yaml`:

```yaml
id: "snp"
name: "Scottish National Party"
manifestoUrl: "https://www.snp.org/manifesto/snp-2026-manifesto.pdf"
parsedAt: "2026-04-15T07:00:00Z"

positions:
  independence: 2
  nhs: 1
  housing: 1
  climate: 1
  tax: 1
  economy: 1
  education: 1
  equality: 2

stances:
  independence: "Core commitment. Independence referendum if SNP majority."
  nhs: "Continue investment. Deliver National Care Service."
  # ... etc

quotes:
  independence: "We will hold an independence referendum in the first term..."
  nhs: "We will deliver the National Care Service..."
  # ... etc
```

### Applying positions to candidates

After writing the party file, iterate over all candidates from that party. For each candidate with `quizCandidate: false` and no existing positions:
- Copy positions from party file
- Copy stances from party file
- Set quizCandidate: true
- Add manifesto URL to sources

Candidates that already have `quizCandidate: true` with manually curated positions are not overwritten.

## Change Management

### Auto-commit (no review needed)
- New candidates added
- Candidate bio/links updated
- New constituency files created
- New party positions from manifesto parsing
- Candidates upgraded to quizCandidate: true from party defaults

### PR for review
- Candidate removed from API (withdrawn)
- Existing quiz positions changed (party manifesto update for already-parsed party)

### Commit messages
- `sync: {n} new candidates, {n} updated, {n} withdrawn PRs`
- `manifesto: parsed {party} manifesto, {n} candidates updated`
- No commit if nothing changed

### Validation gate
The existing JSON Schema validation (`scripts/validate-data.ts`) runs before any commit. Invalid YAML blocks the commit and fails the Action.

## Script Architecture

```
scripts/
├── lib/
│   └── api.ts                    # HTTP fetch with retries, rate limiting
├── sync-candidates.ts            # Democracy Club → YAML
├── sync-manifestos.ts            # Manifesto discovery → Gemini parse → YAML
└── validate-data.ts              # Existing schema validation
```

```
data/
├── parties/                      # Party-level positions from manifestos
│   ├── snp.yaml
│   ├── scottish-greens.yaml
│   └── ...
├── manifestos/
│   └── registry.yaml             # Manifesto discovery tracking
├── candidates/                   # One YAML per candidate
└── constituencies/               # One YAML per constituency
```

## GitHub Actions

### sync-candidates.yml
- Trigger: cron `0 6 * * *` (daily 06:00 UTC) + workflow_dispatch
- Steps: checkout, setup node, npm ci, run sync-candidates.ts, run validate-data.ts, commit and push (or open PR for deletions)
- Needs: `contents: write` and `pull-requests: write` permissions
- Uses: `GITHUB_TOKEN` for git operations

### sync-manifestos.yml
- Trigger: cron `0 7 * * *` (daily 07:00 UTC) + workflow_dispatch
- Steps: checkout, setup node, npm ci, run sync-manifestos.ts, run validate-data.ts, commit and push (or open PR for position changes)
- Needs: `contents: write` and `pull-requests: write` permissions
- Secrets: `GEMINI_API_KEY` for Gemini API calls

## New Dependencies

- `@google/generative-ai` — Google Gemini API for manifesto parsing (free tier)
- `pdf-parse` — extract text from PDF files
- `tsx` (dev) — run TypeScript scripts directly

## Out of Scope

- Real-time polling data ingestion
- News/RSS feed monitoring
- Community-submitted candidate positions
- Historical election data
- Constituency map (handled separately)
