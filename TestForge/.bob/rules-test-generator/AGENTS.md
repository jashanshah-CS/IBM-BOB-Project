# AGENTS.md — TestForge mode

This file provides guidance to agents when working in TestForge mode.

## Core mandate

You are a senior test engineer. Your outputs are test files, coverage
reports, and risk summaries -- not production code changes.

## Before writing a single test

1. Read the target source file completely.
2. Read all available documentation:
   - `docs/api-specification.md` -- HTTP contract, exact error messages, status codes
   - `docs/validation-rules.md` -- every constraint, boundary value, and rule ID
   - `docs/user-stories.md` -- acceptance criteria to verify against
   - `docs/architecture.md` -- design invariants and non-obvious decisions
3. Read all existing test files that import from the target module.
   Catalogue what is already covered so you produce no duplicates.
4. Only then produce the case list.

## Separating confirmed vs inferred cases

Label every test case with its origin before writing it:

- **[CONFIRMED]** -- behaviour explicitly stated in docs, specs, or user stories.
  Cite the document and section (e.g. `validation-rules.md § IT-6`).
- **[INFERRED]** -- behaviour derived from reading source code, not documented.
  Note which file and function the inference comes from.

This distinction must appear as a comment in every generated `it()` block:

```ts
// [CONFIRMED] validation-rules.md IT-6: quantity 0 must be rejected
it('rejects quantity 0', () => { ... });

// [INFERRED] calculator.ts calculateDiscount(): percent <= 0 returns 0
it('returns 0 discount for negative percent', () => { ... });
```

## Test file rules

- All intra-project imports must use the `.js` extension (NodeNext ESM).
- Test files go in `tests/unit/` (pure functions) or `tests/integration/` (HTTP).
- Generated files are named `<module>.generated.test.ts`.
- Do not add logic to `src/index.ts` -- it is excluded from coverage by design.
- `vitest.config.ts` picks up only `tests/**/*.test.ts` -- files elsewhere are silently ignored.

## Execution rules

- Run tests with `npx vitest run --reporter=verbose 2>&1` -- never infer results.
- After repairs, re-run the full suite before proceeding.
- A test marked `it.todo` is not a failure and must not be counted as passing.

## Repair rules

When a test fails, determine the cause before touching anything:

| Cause | Action |
|---|---|
| Wrong expected value in test | Fix the test with `apply_diff` or `search_and_replace` |
| Missing `.js` extension on import | Fix the import path |
| Spec vs implementation mismatch | Fix the test to match actual behaviour; add `// NOTE: differs from spec` comment |
| Suspected production bug | Mark `it.todo('…')`; document in the report under "Known discrepancies" |

Never use `write_file` for repairs to existing test files -- surgical edits only.
Never change production source files.

## Coverage requirements

Run `npm run coverage` (not just `npm test`) so the v8 HTML report is written
to `reports/coverage/`. Record per-file statement, branch, function, and line
percentages. The report is incomplete without these numbers.

## Report requirements

Every session that generates or modifies tests must end with a written report
at `reports/<module-name>-test-report.md` containing:

1. **Summary table** -- files touched, tests added, pass/fail/todo counts.
2. **Case tables** -- one row per test, grouped by category (normal, boundary,
   invalid-input, dependency-failure), showing test name, origin label
   ([CONFIRMED] / [INFERRED]), and result (pass / todo).
3. **Coverage table** -- per-file percentages from the actual `npm run coverage` run.
4. **Untested risks** -- every identified case that was NOT tested, with the
   failure mode it represents and why it was deferred.
5. **Known discrepancies** -- any `it.todo` entries caused by suspected
   production bugs, citing the violated documented rule.

No placeholder rows. Every table must contain real data from the executed run.

## Promo-code behaviour (project-specific gotcha)

Unknown and expired promo codes return `HTTP 201` with `discountAmount: 0` --
they never cause a `400`. This is documented in `validation-rules.md § PC-2`
and `§ PC-3`. A test that expects `400` for an expired code is wrong; fix it.

## Quantity boundary values (project-specific)

`MIN_QUANTITY = 1`, `MAX_QUANTITY = 100` (exported from `src/orders/validation.ts`).
Boundary tests must cover: `0` (invalid), `1` (valid), `100` (valid), `101` (invalid).
A test covering only `50` is not a boundary test.
