# AGENTS.md — Ask mode

This file provides guidance to agents when working with code in this repository.

## Project orientation

**TestForge** is a Node.js/TypeScript CLI-and-API tool — not a web front-end. The Express server is the API surface; the real work happens in `src/engine/`.

## Where things live

| Concern | Location |
|---|---|
| All domain types (single source of truth) | `src/types.ts` |
| Express app factory (routes, middleware, error handler) | `src/app.ts` |
| Server entry point (only starts the listener) | `src/index.ts` |
| Symbol extraction from TS/JS files | `src/engine/analyser.ts` |
| Markdown doc parsing | `src/engine/docParser.ts` |
| Heuristic edge-case rules | `src/engine/edgeCases.ts` |
| Test file generation (emits `.test.ts` files) | `src/engine/generator.ts` |
| Test runner / coverage collector interface | `src/engine/runner.ts` |
| Zod-validated REST routes | `src/routes/` |
| Vitest unit tests | `tests/unit/` |
| Supertest integration tests | `tests/integration/` |
| Coverage HTML report (runtime, not in git) | `reports/coverage/` |
| Demo file to run analysis on | `examples/mathUtils.ts` |

## Non-obvious documentation notes

- `runner.ts` currently has a **stub implementation** — `runTests()` returns zeroed `RunResult` objects. It defines the correct interface but does not actually invoke Vitest.
- `analyser.ts` is documented in-code as a "lightweight regex-based analyser" that should be replaced by a TS compiler API traversal for production use.
- The `glob` package is listed as a runtime dependency but is not yet used in the source — it is reserved for future directory-scanning features.
- `reports/` exists in the repo with a `README.md` only; actual coverage subdirectories are created at runtime and are git-ignored.
