---
name: multi-layer-test-generator
description: Use when the user wants to generate comprehensive Vitest unit tests and Supertest integration tests for a TypeScript source file — analyses the code and docs, identifies edge cases, generates tests, runs them, repairs failures, and produces a coverage report. Trigger phrases include "generate tests for", "run TestForge on", "create test coverage for", "analyse and test".
---

# Multi-Layer Test Generator

Follow every step in order. Never skip a step. Never claim a test passes unless you ran it and saw
a green result. Never modify production code to make a failing test pass — fix the test instead.

---

## Step 1 — Identify the target file

If the user specified a file path, use it.
If not, use `ask_followup_question` to ask which TypeScript source file to target.

Read the file with `read_file`. If it does not exist, stop and tell the user.

---

## Step 2 — Read supporting documentation

Use `glob` to find documentation files:

```
docs/**/*.md
```

Read each of these if they exist (use `read_file`):
- `docs/api-specification.md`
- `docs/validation-rules.md`
- `docs/user-stories.md`
- `docs/architecture.md`

Extract from the docs:
- All named input constraints and boundary values
- All error conditions and expected HTTP status codes
- All business rules and promotion-code behaviours
- All explicit "must / must not" statements

---

## Step 3 — Analyse existing tests

Use `glob` to find all test files:

```
tests/**/*.test.ts
```

For each test file that covers the target module (by import path), read it with `read_file`.

Catalogue what is already tested so you do not generate duplicates. Note which cases are missing.

---

## Step 4 — Identify test cases

Produce a structured list of cases to generate, grouped into four categories:

### 4a. Normal / happy-path cases
- Valid inputs that should succeed
- Representative values from the middle of any range

### 4b. Boundary cases
- Minimum and maximum allowed values (e.g. quantity = 1, quantity = 100)
- Values at and immediately outside each boundary (e.g. quantity = 0, quantity = 101)
- Zero-value inputs where permitted (e.g. unitPrice = 0)
- Empty-string and whitespace-only string inputs
- Floating-point inputs where integers are required

### 4c. Invalid-input / error cases
- Missing required fields
- Wrong types (string where number expected, etc.)
- Values that violate each documented constraint
- Malformed or expired promotion codes
- Empty arrays and null/undefined inputs

### 4d. Dependency-failure / integration cases
- Expired or unknown promo codes that must not return errors
- Multi-item orders where only some items are invalid (all errors returned together)
- Round-trip create → retrieve
- Paths that should return 404 or 500

Do NOT include cases already covered by existing tests.

---

## Step 5 — Delegate to subagents

Spawn three focused subagents in parallel using `spawn_subagent`. Pass `fork_context: true` so each
subagent has the full context gathered in Steps 1–4.

### Subagent A — Edge-Case Finder
**Description:**
> Review the target source file and all supporting documentation gathered by the parent agent.
> Produce a concise JSON array of additional edge cases not already listed in the case catalogue.
> Each entry must have: `{ "category": "boundary|invalid|dependency", "description": "…", "inputSuggestion": "…", "expectedBehaviour": "…" }`.
> Focus on cases the parent may have missed: floating-point rounding in monetary calculations,
> case-insensitivity for promo codes, whitespace trimming, NaN inputs, very large numbers,
> multi-item error accumulation order, and silent promo-code failure paths.
> Return only the JSON array — no prose.

### Subagent B — Unit Test Creator
**Description:**
> Using the case catalogue and edge cases from the parent context, write a complete Vitest test file
> for the target module's pure functions (validation, calculation, promo-code lookup).
> Rules:
> - File path: `tests/unit/<module-name>.generated.test.ts`
> - All intra-project imports must use `.js` extension (e.g. `../../src/orders/calculator.js`)
> - Use `describe`/`it`/`expect` from vitest; explicit imports preferred
> - Cover all four case categories: normal, boundary, invalid-input, dependency-failure
> - Each `it` block must be independent (no shared mutable state between tests)
> - Test only the function's observable output — do not assert implementation details
> - Mark tests that require future implementation with `it.todo('…')`
> - Return the full file content as a fenced TypeScript code block.

### Subagent C — Integration Test Creator
**Description:**
> Using the case catalogue, API specification, and edge cases from the parent context, write a
> complete Supertest integration test file for the HTTP routes.
> Rules:
> - File path: `tests/integration/orders.generated.test.ts`
> - Import `createApp` from `../../src/app.js`
> - All intra-project imports must use `.js` extension
> - Use `describe`/`it`/`expect` from vitest and `request` from supertest
> - Call `createApp()` once at the top of the file; do not start the server
> - Test every HTTP status code documented in the API specification (200, 201, 400, 404)
> - Assert exact `field` and `message` values from 400 error responses
> - Assert `discountAmount`, `subtotal`, and `total` values for monetary cases
> - Mark tests that require future implementation with `it.todo('…')`
> - Return the full file content as a fenced TypeScript code block.

Wait for all three subagents to complete, then merge their outputs:
- Add any new edge cases from Subagent A into the case catalogue.
- Extract the unit test file content from Subagent B's response.
- Extract the integration test file content from Subagent C's response.

---

## Step 6 — Write the generated test files

Write the unit test file using `write_file`:
- Path: `tests/unit/<module-name>.generated.test.ts`

Write the integration test file using `write_file`:
- Path: `tests/integration/orders.generated.test.ts`

---

## Step 7 — Run all tests

Run the full test suite:

```bash
npx vitest run --reporter=verbose 2>&1
```

Parse the output carefully:
- Record pass/fail counts per file.
- Extract the exact failure message and test name for every failing test.

---

## Step 8 — Repair failing tests

For each failing test:

1. Read the failure message carefully.
2. Determine whether the failure is caused by:
   - **Test bug** — wrong expected value, wrong import path, `.js` extension missing, bad async
     handling, wrong HTTP route path. → Fix the test.
   - **Undocumented production behaviour** — the test expected behaviour documented in the spec but
     the implementation differs. → Fix the test to match the actual implementation **and** add a
     comment: `// NOTE: implementation differs from spec — see docs/…`.
   - **Production bug** — the implementation clearly violates a documented invariant (e.g. total
     goes negative, valid input rejected). → Do **not** modify production code. Instead, mark the
     test `it.todo('…')` and document the discrepancy in the final report.

Apply all repairs using `apply_diff` or `search_and_replace`. Never use `write_file` for repairs —
surgical edits only.

After all repairs, run the test suite again:

```bash
npx vitest run --reporter=verbose 2>&1
```

Repeat the repair cycle until no unintended failures remain. A test marked `it.todo` is not a
failure — leave it.

---

## Step 9 — Run coverage, typecheck and lint

Run all three checks:

```bash
npm run coverage 2>&1
npm run typecheck 2>&1
npm run lint 2>&1
```

Record:
- Per-file statement, branch, function, and line coverage percentages.
- Any typecheck errors (there must be none before the report is written).
- Any lint errors (must be resolved; warnings are acceptable).

If typecheck or lint returns errors in the generated test files, fix them and re-run.

---

## Step 10 — Write the Markdown report

Write the report to `reports/<module-name>-test-report.md` using `write_file`.

The report must contain all of these sections:

```markdown
# Test Generation Report — <module-name>
Generated: <ISO timestamp>

## Summary
| Metric | Value |
|---|---|
| Target file | ... |
| Unit tests generated | N |
| Integration tests generated | N |
| Tests passed | N |
| Tests failed | 0 |
| Tests skipped (todo) | N |

## Generated test cases

### Normal / happy-path
| Test name | File | Result |
|---|---|---|
| ... | ... | ✅ pass |

### Boundary
| Test name | File | Result |
|---|---|---|
| ... | ... | ✅ pass |

### Invalid input
| Test name | File | Result |
|---|---|---|
| ... | ... | ✅ pass |

### Dependency failure
| Test name | File | Result |
|---|---|---|
| ... | ... | ✅ pass |

## Coverage

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| src/orders/validation.ts | 97% | 88% | 100% | 97% |
| ... | ... | ... | ... | ... |

## Untested risks

List every case from the original case catalogue that is NOT covered by the generated tests,
plus any edge cases discovered but deferred to `it.todo`. For each, explain why it was not
tested and what failure mode it represents.

| Risk | Category | Reason not tested |
|---|---|---|
| ... | ... | ... |

## Known discrepancies

List any tests marked it.todo due to a suspected production bug, with the documented invariant
that is violated and the observed behaviour.

| Test name | Documented rule | Observed behaviour |
|---|---|---|
| ... | ... | ... |
```

Fill every table with real data from the test run. Do not leave placeholder rows.
If a section (e.g. "Known discrepancies") has no entries, write "None." under the heading.

---

## Completion checklist

Before reporting done, confirm every item:

- [ ] Target file was read and understood
- [ ] All available docs were read
- [ ] Existing tests were catalogued to avoid duplicates
- [ ] All four case categories were identified
- [ ] Three subagents were spawned and their outputs merged
- [ ] Unit test file was written to `tests/unit/`
- [ ] Integration test file was written to `tests/integration/`
- [ ] All tests were executed with `vitest run`
- [ ] All failures were repaired or marked `it.todo` with explanation
- [ ] Tests were re-run after repairs — no unintended failures remain
- [ ] `npm run coverage` was executed and output recorded
- [ ] `npm run typecheck` returned zero errors
- [ ] `npm run lint` returned zero errors (warnings allowed)
- [ ] Report written to `reports/<module-name>-test-report.md`
- [ ] Report tables contain real data, not placeholders
