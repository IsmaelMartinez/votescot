---
description: Check Scottish party websites for 2026 Holyrood manifestos and update party positions if any are published
allowed-tools:
  - WebFetch
  - WebSearch
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(npx tsx scripts/apply-party-positions.ts:*)
  - Bash(npm test:*)
  - Bash(git diff:*)
  - Bash(git status:*)
---

You are syncing manifesto positions for the VoteScot vote compass. The 2026 Scottish Parliament election is on 7 May 2026. Most parties have not yet published their manifesto — your first job is to *find out whether they have*.

## Steps

1. **Read the registry.** `data/manifestos/registry.yaml` lists 6 parties and candidate URLs for each. For every party, fetch the URLs (use WebFetch) and look for a published *2026* manifesto. Anything labelled "draft", "we're working on it", or dated for an earlier election does not count. If a manifesto landing page links to a PDF, follow it and read the PDF.

2. **Report what you found.** Before writing anything, give the user a short table: party → "published" / "not published" / "uncertain", with the URL you used. If everything is "not published", stop here — there is nothing to sync.

3. **For each published manifesto**, fill in the 8 policy areas using the rubric below and write the result to `data/parties/<party-id>.yaml`. Match the existing file shape exactly (see `data/parties/scottish-national-party.yaml` as the template):

   ```yaml
   id: <party-id>
   name: <Party Name>
   positions:
     independence: 0|1|2
     nhs: 0|1|2
     housing: 0|1|2
     climate: 0|1|2
     tax: 0|1|2
     economy: 0|1|2
     education: 0|1|2
     equality: 0|1|2
   stances:
     independence: "1-2 sentence summary of their stance"
     # ...one per policy area
   quotes:
     independence: "Direct quote from the manifesto, verbatim"
     # ...one per policy area
   ```

   **Scoring rubric (must be 0, 1, or 2):**
   - independence: 0 = oppose, 1 = neutral / not mentioned, 2 = support
   - nhs: 0 = reform / cut / privatise, 1 = maintain, 2 = expand / invest significantly
   - housing: 0 = market-led / deregulate, 1 = build more / moderate, 2 = regulate / rent controls
   - climate: 0 = affordability first / weaken targets, 1 = balanced / maintain, 2 = urgent action / strengthen
   - tax: 0 = cut taxes, 1 = maintain, 2 = raise taxes on wealthy
   - economy: 0 = pro-business / deregulate, 1 = public investment / moderate, 2 = green economy / radical change
   - education: 0 = vocational / skills focus, 1 = attainment gap / standards, 2 = expand childcare / early years
   - equality: 0 = socially conservative, 1 = moderate progressive, 2 = strongly progressive

   Quotes must be **verbatim** from the manifesto. If you can't find a clean quote for a policy area, leave the quote as `"Not addressed in 2026 manifesto"` and set the position to `1` (neutral).

4. **Update the registry.** For each party you parsed, in `data/manifestos/registry.yaml` set `manifestoPdf` to the PDF URL you used, `parsedAt` to today's ISO date, and `positionsFile` to the path of the file you wrote in step 3 (e.g. `data/parties/<party-id>.yaml`). Leave parties you didn't parse untouched.

5. **Fan out to candidates.** Run `npx tsx scripts/apply-party-positions.ts --force`. The `--force` flag is required because every candidate currently has `quizCandidate: true` from the previous party-defaults run — without it the script is a no-op. It overwrites `positions`, `stances`, and `quizCandidate`, and leaves `bio`, `highlights`, and `sources` alone, so hand-curated biographies are preserved.

6. **Validate.** Run `npm test`. All vitest suites must pass. If `data-parties.test.ts` fails because of a count mismatch, do not edit the test — investigate.

7. **Show the diff and stop.** Do not commit. Print `git diff --stat` and let the user review before committing.

## Hard rules

- Never invent a quote. If the PDF doesn't say it, don't write it.
- Never set positions for a party whose 2026 manifesto isn't published — leave the existing hand-curated default in `data/parties/<party-id>.yaml` alone.
- Don't touch candidate files directly. Always fan out via `apply-party-positions.ts`.
- Don't change the registry's `manifestoUrls` list unless a URL is permanently dead — those are seeds for future runs.
