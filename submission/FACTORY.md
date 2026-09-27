# TestForge Factory

This document describes a reusable method for turning a developer-workflow problem into a buildable, reviewed and evidenced product stage. It is intentionally generic so another team can apply it to a new specification.

## Factory input

- A clearly stated developer problem
- A small set of representative source files or user journeys
- Written constraints or acceptance criteria
- A repository with an agreed branch and review workflow

## Seats and ownership

| Seat | Owns | Required handoff |
|---|---|---|
| Builder | Product implementation and build instructions | Buildable stage plus change summary |
| Verifier | Test design, negative cases and reproducible results | Evidence table plus unresolved limitations |
| Integrator | Interfaces between components and end-to-end run path | Verified integration and failure behaviour |
| Documenter | Judge orientation, decisions and demonstration narrative | README, RUN guide and evidence index |

With three people, the Integrator seat may be combined with Builder, but verification should still be performed by a different person where possible.

## Stage workflow

1. **Frame the problem.** Describe the current manual cost, target user and measurable improvement.
2. **Write the stage contract.** Define inputs, outputs, acceptance criteria, failure states and what is outside scope.
3. **Assign seats.** Record who builds, verifies and documents the stage.
4. **Build the smallest complete vertical slice.** Prefer an end-to-end path over disconnected features.
5. **Verify positive and negative cases.** Include malformed input, boundary values and resource-safety cases.
6. **Review the evidence.** A verifier checks results against the contract and records remaining limitations.
7. **Package the stage.** Add a Dockerfile, RUN guide, source map and reproducible commands.
8. **Export collaboration evidence.** Save the room log and reference the relevant decisions and handoffs.

## Key decisions in TestForge

- TypeScript is the initial supported language so generated tests can be executable and demonstrable.
- The TypeScript engine remains the single source of analysis logic; Streamlit is an interface over its HTTP API.
- Submitted code runs in an isolated worker with a timeout so infinite loops cannot freeze the API.
- Assertions are exact when a contract can be inferred and deliberately weaker when the intended business rule is unknown.
- The suggested-fix feature handles supported patterns one defect at a time rather than claiming to rewrite an entire program.
- Pasted code is limited to 500 words to keep demonstrations bounded and responsive.

## Cost model

The current prototype uses local, open-source components and requires no paid runtime service:

- Node.js and TypeScript
- Express
- Streamlit and Python
- Vitest and ESLint

Primary costs are developer time, local compute and any optional future hosting. If deployed publicly, set resource limits for worker execution, request size, concurrency and log retention.

## Failure handling

| Failure | Factory response |
|---|---|
| Invalid TypeScript | Return line/column diagnostics without executing code |
| Infinite loop or long execution | Terminate the isolated worker and return a timeout failure |
| Missing backend | Dashboard shows a connection error and startup instruction |
| Unsupported business rule | Report the limitation; use documentation or explicit validation rules |
| Oversized pasted input | Reject above 500 words in both dashboard and API |
| Generated test failure | Show expected and actual values; do not label the source verified |

## Definition of a completed stage

A stage is complete when it has a runnable product slice, reproducible verification, documented limitations, a Dockerfile, a RUN guide, a source map and indexed collaboration evidence.

