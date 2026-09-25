# AGENTS.md — Plan mode

This file provides guidance to agents when working with code in this repository.

## Architectural constraints

### ESM-only — no CommonJS
`"type": "module"` in `package.json` makes every `.js` file an ES module. Any new dependency or pattern must be ESM-compatible. Dynamic `require()` calls will fail.

### Two-tsconfig separation is intentional
`tsconfig.build.json` excludes `tests/` so test infrastructure types never bleed into the emitted `dist/`. Do not merge them — keep the separation.

### Zod is the validation layer; do not bypass it
All external data enters the system through Zod schemas in `src/routes/`. Engine modules (`src/engine/`) receive already-validated, typed data. Adding validation inside engine modules would duplicate logic and break the layering.

### `src/types.ts` is the single type authority
All shared interfaces live in one file. Do not create per-module type files. This makes type evolution cheap and avoids circular imports.

### Route → Engine coupling is one-directional
Routes call engine functions; engine functions never import from routes or from `app.ts`. The Express layer is a thin shell.

### `runner.ts` is a planned extension point
`runTests()` and `collectCoverage()` have the correct public interface but are stubs. Any plan to add real test execution should implement here without changing callers.

### `reports/` directory layout
```
reports/
├── coverage/<run-id>/    ← v8 HTML report, one folder per run
└── generated-tests/      ← emitted .test.ts files from /api/generate
```
Both subdirectories are created at runtime (`mkdir({ recursive: true })`). Do not assume they exist at startup.

### `glob` dependency is unused
The `glob` package is a runtime dependency but has no call sites yet. It is intended for a future `scanDirectory` feature in the analyser. Do not remove it as "unused" — it is reserved.

### Coverage is configured to exclude entry-point
`src/index.ts` is excluded from v8 coverage (see `vitest.config.ts`). Keep all testable logic out of `src/index.ts` — that file should only instantiate `createApp()` and call `.listen()`.
