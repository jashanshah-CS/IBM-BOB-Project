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
npm run audit
npm test
npm run coverage
```

Open `http://localhost:3000/playground` after running `npm run dev` to
analyse pasted TypeScript and generate tests in the browser. Download both
`source.ts` and `source.test.ts` into the same directory; the generated test
uses a portable `./source.js` import that Vitest resolves to the TypeScript
source file.

The current generator supports exported TypeScript functions. It recognises
primitive parameter types, predicate/validator return values, nullish inputs,
numeric special values, and numeric boundaries written as comparisons such as
`quantity >= 1` and `quantity <= 100`.

The playground's **Run Tests** action executes the derived cases and displays
each pass or failure with expected and actual values. **Analyse** also runs this
verification automatically. For a supported range-condition defect, the UI
highlights the affected line, shows corrected code, and lets the user apply the
suggestion before rerunning the tests. A passing result means all derived tests
passed; it is evidence for the analysed scenarios, not proof that arbitrary
programs are defect-free.

The **Complexity** tab reports heuristic time and space complexity, cyclomatic
complexity, maintainability risk, confidence and the syntax patterns supporting
the estimate. These values are estimates rather than formal proofs because
library internals, input distributions and runtime behaviour are not visible
from syntax alone.

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run with hot-reload via `tsx` |
| `npm start` | Run compiled output |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint `src/` and `tests/` |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run audit` | Build and run the deterministic evaluator regression matrix |
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
