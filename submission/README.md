# Queen's Coder - TestForge

## Submission overview

- **Team:** Queen's Coder
- **Project:** TestForge
- **Track:** Testing and developer productivity
- **Completed stage:** Stage 1 - integrated TypeScript test generator

TestForge turns an exported TypeScript function into an edge-case inventory, executable Vitest tests, runtime pass/fail evidence, syntax diagnostics, complexity estimates and supported code corrections. The product combines a TypeScript/Express analysis engine with a Streamlit dashboard.

## Repository map

| Location | Purpose |
|---|---|
| [`../TestForge/`](../TestForge/) | Canonical TypeScript engine, API, automated audit and tests |
| [`../Dashboard/`](../Dashboard/) | Canonical Streamlit dashboard and backend client |
| [`stage-1/`](stage-1/) | Build and run contract for the completed integrated product |
| [`FACTORY.md`](FACTORY.md) | Reusable delivery method, ownership, decisions, costs and failure handling |
| [`mandates/`](mandates/) | Generic seat instructions for building, reviewing and documenting a stage |
| [`room/`](room/) | Exported collaboration evidence or its clearly marked placeholder |
| [`../Test-Cases.md`](../Test-Cases.md) | Test scenarios, observed answers and corrected examples |

## What the judges can verify

1. Follow [`stage-1/RUN.md`](stage-1/RUN.md) to run the product locally or with Docker.
2. Open the dashboard and paste an exported TypeScript function.
3. Analyse it, run the generated checks and inspect Diagnostics and Complexity.
4. Run `npm run audit` inside `TestForge/` to reproduce the automated evidence.

## Current verified result

- 20/20 evaluator scenarios pass their expected outcomes.
- Infinite-loop isolation passes.
- Generated maximum-boundary and integer-rule assertions pass.
- TypeScript build, typecheck and lint pass.
- The dashboard limits pasted code to 500 words.

## Submission assets still supplied separately

The public repository contains the product, factory documentation, mandates and room-evidence location. The presentation deck and demonstration video should be linked here when their final public URLs are available.

