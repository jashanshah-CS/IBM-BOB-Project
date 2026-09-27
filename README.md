# TestForge

TestForge is an intelligent multi-layer TypeScript and Python test generator built for the **IBM Bob 2.0 Hackathon**. It takes developers from raw source code to edge-case tests, executable results, defect suggestions, and complexity estimates with less manual effort.

**Live application:** [Open the TestForge dashboard](https://testforge-api.streamlit.app)

**Backend service:** [View the deployed TestForge API](https://testforge-6hko.onrender.com)

## IBM Bob usage statement

Our team used IBM Bob as the main AI development tool during the initial design and implementation of TestForge. We began by describing the challenge: developers need more than shallow unit tests, because meaningful testing must include boundary cases, invalid inputs, integration behaviour, and documentation constraints. IBM Bob helped us convert this idea into a practical multi layer workflow consisting of source analysis, document understanding, edge case discovery, unit-test generation, integration test generation, test execution, and reporting.

We used IBM Bob to scaffold and develop the TypeScript and Express backend, organise the project structure, and implement the analysis and testing workflow. It assisted with code that extracts exported TypeScript functions and parameters, derives edge cases, generates Vitest tests, runs checks, and reports results. We also used IBM Bob to develop the user interface and connect the testing workflow to an interactive dashboard where users can paste code, analyse it, generate tests, inspect failures, and review complexity information.

IBM Bob supported our testing and refinement process by generating unit and API integration tests, checking boundary behaviour, and helping us identify problems in generated tests and application logic. We used its output as a starting point, reviewed the generated changes, ran the project, and improved the implementation through repeated testing. The repository includes the project code and exported IBM Bob development evidence so judges can review how the tool contributed.

TestForge does not use IBM watsonx.ai or IBM watsonx Orchestrate. Our IBM technology usage for this project was IBM Bob.

**Hackathon submission:** Queen's Coder judges and reviewers should start with [`submission/README.md`](submission/README.md).

The application is in [`TestForge/`](TestForge/).

See the language-specific verification reports:

- [`TypeScript-Test-Cases.md`](TypeScript-Test-Cases.md) for the TypeScript regression matrix, observed defects, and corrected examples.
- [`Python-Test-Cases.md`](Python-Test-Cases.md) for Python analysis, pytest generation, execution, diagnostics, and complexity scenarios.

The final prototype includes a Streamlit interface in [`Dashboard/`](Dashboard/). It calls the Express backend over HTTP, so TypeScript and Python inputs use the same analysis, generated tests, complexity estimates, and correction workflow. See [`DashboardREADME.MD`](DashboardREADME.MD) for startup instructions.

## Long description - problem and solution

Developers often spend considerable time writing repetitive tests, yet important cases such as null values, invalid types, numeric boundaries, empty collections, and incorrect conditions can still be missed. Basic AI test generators may produce shallow tests or placeholder assertions that look complete without exercising the submitted code. This creates extra debugging work and allows defects to reach later stages of development.

TestForge is an intelligent multi layer testing assistant for TypeScript and Python developers, students, hackathon teams, and small engineering teams. A user pastes an exported TypeScript function or a public Python function into the Streamlit dashboard and selects **Analyse** or **Run generated checks**. TestForge extracts the function and its parameters, builds an edge case inventory, executes derived checks, and presents the expected value, actual value, and pass or fail result for each case. Users can also download a portable Vitest or pytest suite.

The application identifies TypeScript and Python syntax problems and estimates time complexity, space complexity, cyclomatic complexity, maintainability risk, and analysis confidence. When it recognises a supported defect, such as an incorrect `||`/`or` operator in a bounded range check, it explains the issue and proposes corrected code that the user can apply and test again.

TestForge is distinctive because it combines code analysis, edge case discovery, executable test generation, dynamic verification, diagnostics, supported corrections, and complexity evidence in one accessible workflow. Instead of returning test code that users must trust without evidence, it demonstrates which generated checks actually pass and where the implementation may be defective. This reduces manual effort while helping users understand and improve their code.

## Features

- **TypeScript analysis** for exported functions, parameters, return types, classes, methods, and source locations.
- **Python analysis** for public typed functions, optional values, common collections, imports, constants, and asynchronous functions.
- **Document understanding** for Markdown API specifications, user stories, and validation rules.
- **Dynamic edge case discovery** for null, undefined, zero, negative and decimal values, safe-integer limits, infinities, `NaN`, empty values, and boundaries inferred from comparisons.
- **Executable Vitest and pytest generation** with derived assertions instead of placeholder tests.
- **In-browser execution** showing each expected value, actual value, and pass/fail result.
- **Syntax diagnostics** that identify invalid TypeScript or Python and highlight the relevant line.
- **Supported defect correction**, including impossible range checks and skipped values in maximum searches.
- **Complexity analysis** covering estimated time and space complexity, cyclomatic complexity, maintainability risk, confidence, and evidence.
- **Downloadable output** as a portable TypeScript/Vitest or Python/pytest source-and-test pair.
- **Unit and integration infrastructure** using Express, Vitest, Supertest, TypeScript, Zod, and v8 coverage.

## Workflow

```text
TypeScript or Python source + project documentation
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
 Vitest/pytest tests   Complexity analysis
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
3. A **Unit Test Creator** produces focused Vitest or pytest checks.
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
To start the Express backend and integrated Streamlit dashboard together on Windows, run `./start-integrated.ps1` from the repository root. The launcher creates a Python environment, installs pytest and passes its interpreter to the backend.

## Playground guide

1. Paste an exported TypeScript function or public Python function into the editor.
2. Select **Analyse** to extract symbols and build the edge-case inventory. Analysis also starts the derived checks.
3. Open **Test Results** to inspect every expected and actual value.
4. Open **Complexity** to review time, space, cyclomatic, maintainability, confidence, and evidence.
5. If a supported defect is detected, inspect the highlighted line and **Suggested Fix**.
6. Apply the correction and run the tests again.
7. Select **Generate Tests** to produce reusable Vitest or pytest code.
8. Download both files into the same directory and run them with the matching test runner.

TypeScript tests import `./source.js`; with NodeNext configuration, Vitest resolves it to `source.ts`. Python tests import `source.py` and run with pytest.

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
| `npm run audit` | Run the 22-scenario TypeScript regression audit |
| `npm run audit:python` | Run the 20-scenario Python regression audit |

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check service health |
| `GET` | `/playground` | Open the browser playground |
| `POST` | `/playground/analyse` | Detect the language, analyse pasted code and derive edge cases |
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
    |   |   |-- analyser.ts       # TypeScript/Python analysis dispatch
    |   |   |-- pyAnalyser.ts     # Python symbol and constraint extraction
    |   |   |-- docParser.ts      # Markdown constraint extraction
    |   |   |-- edgeCases.ts      # Edge-case discovery
    |   |   |-- generator.ts      # Vitest and pytest source generation
    |   |   |-- evaluator.ts      # Dynamic checks and fix suggestions
    |   |   |-- complexity.ts     # Static complexity estimates
    |   |   |-- pyRunner.ts       # Isolated pytest execution
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
npm run audit
npm run audit:python
```

The documented regression matrices cover 22 TypeScript and 20 Python scenarios, including correct and defective inputs, binary-search semantics, syntax diagnostics, generated assertions, timeout isolation, suggested corrections and complexity estimates.

## Current scope

The playground focuses on exported TypeScript functions, public Python functions and supported primitive or collection inputs. A passing result is evidence for the derived scenarios, not proof that an arbitrary program is defect-free. Automatic correction is limited to patterns that can be changed with reasonable confidence.

## Team contribution workflow

The integrated prototype branch is `TestForge-Final-Prototype`. Contributors should use a separate feature branch:

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
- Python 3 and pytest
- Streamlit
- Node.js and Express
- TypeScript Compiler API
- Vitest and v8 coverage
- Supertest
- Zod
- ESLint
