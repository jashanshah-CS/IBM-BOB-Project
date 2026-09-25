# AGENTS.md — Agent (coding) mode

This file provides guidance to agents when working with code in this repository.

## Must-know before editing

### .js extensions on all imports — mandatory
TypeScript is compiled with `module: NodeNext`. Every intra-project import must end in `.js`:
```ts
import { analyseFile } from '../engine/analyser.js'; // correct
import { analyseFile } from '../engine/analyser';     // will fail at runtime
```

### Two tsconfig files — use the right one
- Adding a new source file? It only needs to satisfy `tsconfig.build.json` (excludes `tests/`).
- Adding a test file? It needs to satisfy `tsconfig.json` (includes `tests/`).
- Run `npm run typecheck` (uses `tsconfig.json`) to catch errors in both.

### Route validation: always use `.safeParse()` + `return`
```ts
const parsed = MySchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: parsed.error.flatten() });
  return;          // ← required: Express types complain without explicit return
}
```
Do not use `.parse()` in routes — it throws unchecked errors.

### Tests must be in `tests/`, not `src/`
`vitest.config.ts` only picks up `tests/**/*.test.ts`. Any test file placed in `src/` will be silently ignored.

### Coverage excludes `src/index.ts`
Do not add logic to `src/index.ts` — it is intentionally excluded from coverage. Put all app logic in `src/app.ts` or engine/route modules.

### Run a single test file
```bash
npx vitest run tests/unit/edgeCases.test.ts
npx vitest run tests/integration/api.test.ts
```

### Generated test output
`src/engine/generator.ts` writes files to `outputDir` (default `reports/generated-tests/`). The `source` field is stripped from the API response but remains on the `GeneratedTest` object in memory.

### `analyser.ts` uses regex, not the TS compiler API
The regex-based extractor only detects top-level `export function`, `export const` arrow functions, `export class`, and class methods. It will miss re-exports, default exports, and multi-line signatures. Do not extend it with more regex — replace with a compiler API approach when accuracy matters.
