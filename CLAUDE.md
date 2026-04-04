# VoteScot

Open-source vote compass for the 2026 Scottish Parliament election.

## Commands

- `npm run dev` — start dev server
- `npm run build` — build static site
- `npm run preview` — preview production build
- `npm test` — run tests
- `node scripts/validate-data.ts` — validate YAML data against schemas

## Architecture

Astro 6 static site with React islands for interactive components. YAML data files in `data/` are the single source of truth. Built and deployed to GitHub Pages via GitHub Actions. Daily sync from Democracy Club API via GitHub Actions cron.

## Key conventions

- Data lives in `data/` as YAML files, one file per candidate
- Interactive components are React `.tsx` files in `src/components/`
- Static components are Astro `.astro` files in `src/components/`
- Quiz matching logic is in `src/lib/matching.ts` (pure functions, no React)
- Tailwind theme tokens use the `votescot-` prefix
- All candidate positions must include source URLs

## Repo Butler

This repo is monitored by [Repo Butler](https://github.com/IsmaelMartinez/repo-butler), a portfolio health agent that observes repo health daily and generates dashboards, governance proposals, and tier classifications.

**Your report:** https://ismaelmartinez.github.io/repo-butler/votescot.html
**Portfolio dashboard:** https://ismaelmartinez.github.io/repo-butler/
**Consumer guide:** https://github.com/IsmaelMartinez/repo-butler/blob/main/docs/consumer-guide.md

### Querying Reginald (the butler MCP server)

To query your repo's health tier, governance findings, and portfolio data from any Claude Code session, add the MCP server once (adjust the path to your local repo-butler checkout):

```bash
claude mcp add repo-butler node /path/to/repo-butler/src/mcp.js
```

Available tools: `get_health_tier`, `get_campaign_status`, `query_portfolio`, `get_snapshot_diff`, `get_governance_findings`, `trigger_refresh`.

When working on health improvements, check the per-repo report for the current tier checklist and use the consumer guide for fix instructions.
