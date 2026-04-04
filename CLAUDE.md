# VoteScot

Open-source vote compass for the 2026 Scottish Parliament election.

## Commands

- `npm run dev` — start dev server
- `npm run build` — build static site
- `npm run preview` — preview production build
- `npm test` — run tests
- `node scripts/validate-data.ts` — validate YAML data against schemas

## Architecture

Astro 5 static site with React islands for interactive components. YAML data files in `data/` are the single source of truth. Built and deployed to GitHub Pages via GitHub Actions.

## Key conventions

- Data lives in `data/` as YAML files, one file per candidate
- Interactive components are React `.tsx` files in `src/components/`
- Static components are Astro `.astro` files in `src/components/`
- Quiz matching logic is in `src/lib/matching.ts` (pure functions, no React)
- Tailwind theme tokens use the `votescot-` prefix
- All candidate positions must include source URLs
