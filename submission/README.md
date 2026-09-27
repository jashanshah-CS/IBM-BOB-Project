# Queen's Coder - TestForge

## Submission overview

- **Team:** Queen's Coder
- **Project:** TestForge
- **Track:** Testing and developer productivity
- **Completed stage:** Stage 1 - integrated TypeScript and Python test generator

TestForge turns an exported TypeScript function or public Python function into an edge-case inventory, executable Vitest or pytest tests, runtime pass/fail evidence, syntax diagnostics, complexity estimates and supported code corrections. The product combines an Express analysis API, language-specific runners and a Streamlit dashboard.

## Repository map

| Location | Purpose |
|---|---|
| [`../TestForge/`](../TestForge/) | TypeScript/Python engine, API, automated audits and tests |
| [`../Dashboard/`](../Dashboard/) | Canonical Streamlit dashboard and backend client |
| [`stage-1/`](stage-1/) | Build and run contract for the completed integrated product |
| [`FACTORY.md`](FACTORY.md) | Reusable delivery method, ownership, decisions, costs and failure handling |
| [`mandates/`](mandates/) | Generic seat instructions for building, reviewing and documenting a stage |
| [`room/`](room/) | Exported collaboration evidence or its clearly marked placeholder |
| [`../TypeScript-Test-Cases.md`](../TypeScript-Test-Cases.md) | TypeScript scenarios, observed answers and corrected examples |
| [`../Python-Test-Cases.md`](../Python-Test-Cases.md) | Python scenarios, observed answers and corrected examples |

## What the judges can verify

1. Follow [`stage-1/RUN.md`](stage-1/RUN.md) to run the product locally or with Docker.
2. Open the dashboard and paste an exported TypeScript function or public Python function.
3. Analyse it, run the generated checks and inspect Diagnostics and Complexity.
4. Run `npm run audit` and `npm run audit:python` inside `TestForge/` to reproduce the automated evidence.

## Current verified result

- 20/20 evaluator scenarios pass their expected outcomes.
- 20/20 Python scenarios pass their expected outcomes, including automatic rechecks of supported corrections.
- Infinite-loop isolation passes.
- Generated maximum-boundary and integer-rule assertions pass.
- TypeScript build, typecheck and lint pass.
- The dashboard limits pasted code to 500 words.

## Submission assets still supplied separately

The public repository contains the product, factory documentation, mandates and room-evidence location. The presentation deck and demonstration video should be linked here when their final public URLs are available.

