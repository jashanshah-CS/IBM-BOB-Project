# TestForge

TestForge is an intelligent multi-layer TypeScript test generator built for the **IBM Bob 2.0 Hackathon**. It takes developers from raw source code to edge-case tests, executable results, defect suggestions, and complexity estimates with less manual effort.

The application is in [`TestForge/`](TestForge/).

See [`Test-Cases.md`](Test-Cases.md) for the complete automated scenario list, observed results, detected defects, and corrected examples.

This integration branch also includes a Streamlit interface in [`Dashboard/`](Dashboard/). It calls the TypeScript backend over HTTP, so the dashboard and browser playground use the same analysis, generated tests, complexity estimates, and correction logic. See [`DashboardREADME.MD`](DashboardREADME.MD) for startup instructions.

## The problem

Developers spend significant time writing repetitive tests and can miss boundary values, invalid inputs, integration behaviour, and documented constraints. Basic generated tests may also look complete while using placeholder assertions that never exercise the source code.

TestForge analyses submitted code, derives meaningful cases from parameters and conditions, generates real Vitest assertions, executes the checks, and clearly shows which cases pass or fail.

## Features

- **TypeScript analysis** for exported functions, parameters, return types, classes, methods, and source locations.
- **Document understanding** for Markdown API specifications, user stories, and validation rules.
- **Dynamic edge-case discovery** for null, undefined, zero, negative and decimal values, safe-integer limits, infinities, `NaN`, empty values, and boundaries inferred from comparisons.
- **Executable Vitest generation** with derived assertions instead of placeholder tests such as `expect(true).toBe(true)`.
- **In-browser execution** showing each expected value, actual value, and pass/fail result.
- **Syntax diagnostics** that identify invalid TypeScript and highlight the relevant line.
- **Supported defect correction**, including impossible range checks written with `||` instead of `&&`.
- **Complexity analysis** covering estimated time and space complexity, cyclomatic complexity, maintainability risk, confidence, and evidence.
- **Downloadable output** as a portable `source.ts` and `source.test.ts` pair.
- **Unit and integration infrastructure** using Express, Vitest, Supertest, TypeScript, Zod, and v8 coverage.

## Workflow

```text
TypeScript source + project documentation
                  |
                  v
        Source and document analysis
                  |
                  v
          Edge-case inventory
                  |
          +-------+--------+
          |                |
          v                v
   Vitest generation   Complexity analysis
          |
          v
   Dynamic test execution
          |
          v
 Pass/fail results, diagnostics, and supported fixes
```

The project implements the hackathon's multi-agent concept:

1. A **Document Understanding** stage extracts constraints from API specifications, user stories, and validation documentation.
2. An **Edge-Case Finder** examines signatures and conditions for adversarial and boundary inputs.
3. A **Unit Test Creator** produces focused Vitest checks.
4. An **Integration Test Creator** covers HTTP and multi-step behaviour.
5. The runner executes the suite and presents evidence for developers to inspect.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
cd TestForge
npm install
npm run build
npm test
npm run dev
```

Open:

- Playground: <http://localhost:3000/playground>
- Project home: <http://localhost:3000/>
- Health check: <http://localhost:3000/health>

To start the TypeScript backend and integrated Streamlit dashboard together on Windows, run `./start-integrated.ps1` from the repository root, then open <http://127.0.0.1:8501>.

## Playground guide

1. Paste an exported TypeScript function into the editor.
2. Select **Analyse** to extract symbols and build the edge-case inventory. Analysis also starts the derived checks.
3. Open **Test Results** to inspect every expected and actual value.
4. Open **Complexity** to review time, space, cyclomatic, maintainability, confidence, and evidence.
5. If a supported defect is detected, inspect the highlighted line and **Suggested Fix**.
6. Apply the correction and run the tests again.
7. Select **Generate Tests** to produce reusable Vitest code.
8. Download both files into the same directory and run them with Vitest.

Generated tests import `./source.js`. With NodeNext TypeScript configuration, Vitest resolves it to `source.ts`.

## Example

```ts
export function validateQuantity(quantity: number): boolean {
  return quantity >= 1 && quantity <= 100;
}
```

TestForge derives checks around the valid range and special numeric values, executes them, and reports each result. Changing the condition to `quantity >= 1 || quantity <= 100` exposes failing cases and produces a supported correction.

## Complexity reporting

The complexity engine inspects loops, nesting, sorting, collection operations, allocations, branches, logical operators, and apparent recursion. It reports Big O time and space estimates, cyclomatic complexity, maintainability risk, confidence, and supporting evidence.

These are static estimates. Library internals, runtime data distributions, and arbitrary program behaviour cannot always be proven from syntax alone.

## Commands

Run commands inside `TestForge/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the server with hot reload |
| `npm run build` | Compile application code to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the complete Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run coverage` | Write v8 coverage to `reports/coverage/` |
| `npm run typecheck` | Type-check source and tests |
| `npm run lint` | Lint source and test files |
| `npm run lint:fix` | Apply supported ESLint fixes |

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check service health |
| `GET` | `/playground` | Open the browser playground |
| `POST` | `/playground/analyse` | Analyse pasted TypeScript and derive edge cases |
| `POST` | `/playground/generate` | Generate downloadable source and test files |
| `POST` | `/playground/run` | Run derived checks and return complexity and fix information |
| `POST` | `/api/analyse` | Analyse project source and documentation |
| `POST` | `/api/generate` | Generate test files for analysed symbols |
| `GET` | `/api/report/:id` | Retrieve a coverage report |
| `POST` | `/api/orders` | Create a sample order for integration testing |
| `GET` | `/api/orders/:id` | Retrieve a sample order |

## Project structure

```text
IBM-BOB-Project/
|-- README.md
`-- TestForge/
    |-- src/
    |   |-- engine/
    |   |   |-- analyser.ts       # TypeScript symbol extraction
    |   |   |-- docParser.ts      # Markdown constraint extraction
    |   |   |-- edgeCases.ts      # Edge-case discovery
    |   |   |-- generator.ts      # Vitest source generation
    |   |   |-- evaluator.ts      # Dynamic checks and fix suggestions
    |   |   |-- complexity.ts     # Static complexity estimates
    |   |   `-- runner.ts         # Vitest and coverage execution
    |   |-- routes/                # API and playground routes
    |   `-- orders/                # Sample integration-test domain
    |-- tests/
    |   |-- unit/
    |   |-- integration/
    |   `-- generated/
    |-- docs/                      # API, architecture, stories, and rules
    |-- examples/                  # Example TypeScript inputs
    `-- reports/                   # Generated reports and coverage
```

## Validation

The implementation has passed:

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

Manual runtime checks cover a correct validator, a defective range validator, invalid TypeScript diagnostics, and nested-loop complexity detection.

## Current scope

The playground focuses on exported TypeScript functions and common primitive inputs. A passing result is evidence for the derived scenarios, not proof that an arbitrary program is defect-free. Automatic correction is limited to patterns that can be changed with reasonable confidence.

## Team contribution workflow

The current implementation branch is `feat/testforge-workflow`. Contributors should use a separate feature branch:

```bash
git switch main
git pull
git switch -c feat/short-feature-name
# make and test changes
git add .
git commit -m "feat: describe the change"
git push -u origin feat/short-feature-name
```

Open a pull request, ask another team member to review it, and merge after the checks pass.

## Technology

- TypeScript with ESM and NodeNext module resolution
- Node.js and Express
- TypeScript Compiler API
- Vitest and v8 coverage
- Supertest
- Zod
- ESLint

## Hackathon impact

The demo turns one TypeScript file into an edge-case inventory, executable tests, clear failures, a supported correction, and complexity evidence in one workflow. This reduces repetitive test-writing effort and makes missing boundary behaviour visible before it reaches production.
