# Stage 1 - Integrated TestForge prototype

## Stage contract

**Input:** Up to 500 words containing exported TypeScript functions or public Python functions.

**Output:** Extracted symbols, edge-case inventory, executable checks, pass/fail results, syntax diagnostics, complexity estimates, generated Vitest or pytest source and a supported correction when available.

**Acceptance criteria:**

- Backend and dashboard start using documented commands.
- Dashboard reports a healthy backend connection.
- Valid supported code can be analysed and tested.
- Deliberately defective code produces failed checks with expected and actual values.
- Invalid syntax produces diagnostics.
- Infinite execution is terminated without freezing the backend.
- Automated audit passes all expected scenarios.

## Product architecture

```text
Browser
  -> Streamlit dashboard (:8501)
      -> Express/TestForge API (:3000)
          -> analyser + edge-case engine
          -> isolated evaluator
          -> Vitest/pytest generator
          -> complexity estimator
```

## Stage contents

- [`Dockerfile`](Dockerfile) packages the existing canonical source into one demonstration container.
- [`start.sh`](start.sh) starts both services inside the container.
- [`RUN.md`](RUN.md) provides local and Docker instructions.
- [`SOURCE.md`](SOURCE.md) maps this stage to the unchanged canonical source.

