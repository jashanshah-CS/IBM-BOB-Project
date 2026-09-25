# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack
TypeScript (`"module": "ESM"`, NodeNext resolution) · Express 4 · Vitest 2 · Supertest · Zod (request validation) · v8 coverage

## Commands

```bash
# Build (uses tsconfig.build.json, NOT tsconfig.json)
npm run build

# Run a single test file
npx vitest run tests/unit/edgeCases.test.ts

# Run tests matching a name pattern
npx vitest run --reporter=verbose -t "edge case"

# Type-check (includes tests; tsconfig.json covers both src/ and tests/)
npm run typecheck

# Lint src/ and tests/ only (dist/ and reports/ are excluded)
npm run lint
```

## Critical ESM / import rules
- **All intra-project imports must use the `.js` extension**, even for `.ts` source files.
  `import { analyseFile } from '../engine/analyser.js'` — omitting `.js` will break at runtime.
- Node built-ins must be imported with the `node:` prefix: `import { readFile } from 'node:fs/promises'`.

## Two tsconfig files — do not confuse them
- `tsconfig.json` — used by `tsc --noEmit` (typecheck); **includes `tests/`**.
- `tsconfig.build.json` — used by `npm run build`; **excludes `tests/`**. Emit goes to `dist/`.

## Vitest config gotchas
- `globals: true` is set — `describe`/`it`/`expect` are available without import, but explicit imports are preferred for clarity.
- Test files **must live under `tests/`** (`include: ['tests/**/*.test.ts']`). Files in `src/` are not picked up.
- Coverage output goes to `reports/coverage/` (not the default `coverage/`).
- `src/index.ts` is excluded from coverage (server entry-point noise).

## Request validation pattern
All routes validate the request body with **Zod** using `.safeParse()`. On failure, respond with `res.status(400).json({ error: parsed.error.flatten() })` and `return` to stop execution — do not call `next()`.

## Express error handling
Async route handlers pass errors to `next(err)`. The global error handler in `src/app.ts` catches them. Do not swallow errors with empty catch blocks.

## Shared types
All domain types live in `src/types.ts`. Do not redeclare types locally in engine modules or routes — import from there.

## Architecture flow
```
POST /api/analyse  →  analyser.ts (regex symbol extraction)
                   →  docParser.ts (Markdown heading sections)
                   →  edgeCases.ts (heuristic discovery)
                   →  JSON response: { symbols, docSections, edgeCases }

POST /api/generate →  generator.ts (writes .test.ts files to outputDir)
                   →  JSON response: { tests } (source field stripped from response)

GET  /api/report/:id → reports/coverage/<id>/ directory listing
```

## Naming conventions
- Route files export a single named `Router` const: `export const analyseRouter = Router()`.
- Zod schemas are `PascalCase` suffixed with `Schema`: `AnalyseBodySchema`.
- Engine functions are `camelCase` named after their action: `analyseFile`, `parseDocFile`, `discoverEdgeCases`, `generateTests`, `runTests`, `collectCoverage`.
- Unused function parameters are prefixed with `_` (enforced by ESLint).

## Code style
- Single quotes for strings.
- No explicit return types on functions (rule is off); types flow from inference or Zod schemas.
- `no-explicit-any` is a **warning**, not an error — avoid it but it won't block CI.
- `@ts-check` comment required at the top of `.js` config files (see `eslint.config.js`).
