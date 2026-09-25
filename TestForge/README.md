# TestForge

**Intelligent multi-layer test generator.**

TestForge analyses source code and project documentation, discovers edge cases, generates unit and integration tests, executes them and produces a coverage report.

---

## Features

- 📂 **Source analysis** — scans TypeScript files, extracts functions/classes and infers input/output shapes
- 📄 **Doc parsing** — reads Markdown documentation to surface described behaviours and constraints
- 🔍 **Edge-case discovery** — applies heuristic rules to surface boundary conditions
- ⚗️ **Test generation** — emits ready-to-run Vitest unit and integration test files
- 🚀 **Test runner** — executes generated tests in-process via the Vitest API
- 📊 **Coverage report** — aggregates v8 coverage and writes an HTML report to `reports/coverage/`

---

## Quick start

```bash
npm install
npm run build
npm test
npm run coverage
```

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run with hot-reload via `tsx` |
| `npm start` | Run compiled output |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint `src/` and `tests/` |
| `npm run lint:fix` | Lint and auto-fix |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run coverage` | Run tests with v8 coverage |

---

## Project layout

```
TestForge/
├── src/
│   ├── index.ts            # Express server entry point
│   ├── app.ts              # Express app factory
│   ├── types.ts            # Shared TypeScript types
│   ├── engine/
│   │   ├── analyser.ts     # Source-code analyser
│   │   ├── docParser.ts    # Documentation parser
│   │   ├── edgeCases.ts    # Edge-case discovery
│   │   ├── generator.ts    # Test-code generator
│   │   └── runner.ts       # Test runner / coverage collector
│   └── routes/
│       ├── analyse.ts      # POST /api/analyse
│       ├── generate.ts     # POST /api/generate
│       └── report.ts       # GET  /api/report/:id
├── tests/
│   ├── unit/               # Unit tests for engine modules
│   └── integration/        # Supertest API integration tests
├── docs/                   # Additional project documentation
├── examples/               # Example source files for demo runs
└── reports/                # Generated coverage reports (git-ignored)
```

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/analyse` | Analyse source files; returns extracted symbols |
| `POST` | `/api/generate` | Generate tests for analysed symbols |
| `GET` | `/api/report/:id` | Retrieve a previously generated coverage report |
| `GET` | `/health` | Health-check |
