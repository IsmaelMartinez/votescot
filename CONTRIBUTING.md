# Contributing to VoteScot

Thanks for your interest in contributing to VoteScot, an open-source vote compass for the 2026 Scottish Parliament election.

## How to contribute

### Reporting issues

Open a GitHub issue if you find a bug, notice incorrect candidate data, or have a feature suggestion. Please include enough detail to reproduce any bugs.

### Fixing candidate data

Candidate data lives in `data/candidates/` as YAML files. If you spot an error in a candidate's bio, highlights, or policy positions, open a PR with the correction and include a source URL to back it up.

### Code contributions

1. Fork the repo and create a branch from `main`
2. Run `npm install` to set up dependencies
3. Make your changes
4. Run `npm test` to ensure all tests pass
5. Run `npm run build` to verify the site builds
6. Open a pull request

### Development setup

```bash
npm install
npm run dev      # start dev server
npm test         # run tests
npm run build    # build static site
```

### Code style

The project uses Astro 6 with React islands for interactive components. Follow existing patterns in the codebase. YAML data files are the single source of truth for candidate and constituency information.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
