# Stage 1 source map

Stage 1 uses the existing repository source directly. No application code is duplicated inside the submission directory.

| Component | Canonical source |
|---|---|
| Express application | [`../../TestForge/src/app.ts`](../../TestForge/src/app.ts) |
| Source analyser | [`../../TestForge/src/engine/analyser.ts`](../../TestForge/src/engine/analyser.ts) |
| Edge-case discovery | [`../../TestForge/src/engine/edgeCases.ts`](../../TestForge/src/engine/edgeCases.ts) |
| Isolated execution | [`../../TestForge/src/engine/isolatedEvaluator.ts`](../../TestForge/src/engine/isolatedEvaluator.ts) |
| Test generation | [`../../TestForge/src/engine/generator.ts`](../../TestForge/src/engine/generator.ts) |
| Complexity analysis | [`../../TestForge/src/engine/complexity.ts`](../../TestForge/src/engine/complexity.ts) |
| Streamlit interface | [`../../Dashboard/app.py`](../../Dashboard/app.py) |
| Dashboard API client | [`../../Dashboard/backend_client.py`](../../Dashboard/backend_client.py) |
| Automated audit | [`../../TestForge/scripts/audit.mjs`](../../TestForge/scripts/audit.mjs) |
| TypeScript cases | [`../../TypeScript-Test-Cases.md`](../../TypeScript-Test-Cases.md) |
| Python cases | [`../../Python-Test-Cases.md`](../../Python-Test-Cases.md) |

This mapping keeps one source of truth while allowing the Stage 1 Dockerfile to build the complete service from the repository root.

