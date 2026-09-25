# Test Generation Report — orders (validation, calculator, promoCodes, route)

Generated: 2025-05-22T20:14:00Z  
Skill: multi-layer-test-generator  
Target modules: `src/orders/validation.ts`, `src/orders/calculator.ts`, `src/orders/promoCodes.ts`, `src/routes/orders.ts`

---

## Summary

| Metric | Value |
|---|---|
| Target files | `src/orders/validation.ts`, `src/orders/calculator.ts`, `src/orders/promoCodes.ts`, `src/routes/orders.ts` |
| Generated test files | 2 |
| Unit tests generated | 48 (in `tests/unit/orders.validation.generated.test.ts`) |
| Integration tests generated | 25 (in `tests/integration/orders.generated.test.ts`) |
| Total generated tests | 73 |
| Tests passed | 73 |
| Tests failed | 0 |
| Tests skipped / todo | 0 |
| Repairs needed | 0 |
| Complete suite (all files) | 112 passed, 0 failed |
| Typecheck | ✅ 0 errors |
| Lint | ✅ 0 errors, 0 warnings |

---

## Generated test cases

### Normal / happy-path

| Test name | File | Origin | Result |
|---|---|---|---|
| accepts a non-empty productId | unit | [CONFIRMED] IT-1 | ✅ pass |
| accepts unitPrice of exactly 0 (zero-price item) | unit | [CONFIRMED] IT-3 note | ✅ pass |
| accepts quantity=1 (lower boundary) | unit | [CONFIRMED] IT-6 table | ✅ pass |
| accepts quantity=100 (upper boundary) | unit | [CONFIRMED] IT-6 table | ✅ pass |
| returns valid:true for a single well-formed item | unit | [CONFIRMED] validation-rules.md §2 | ✅ pass |
| EC-21 lowercase "save10" resolves to SAVE10 with 10% discount | unit | [INFERRED] promoCodes.ts:39 | ✅ pass |
| EC-22 mixed-case "Save10" resolves to SAVE10 | unit | [INFERRED] promoCodes.ts:39 | ✅ pass |
| EC-23 HALF50 returns 50% discount | unit | [CONFIRMED] api-specification.md | ✅ pass |
| EC-24 FREESHIP returns 5% discount | unit | [CONFIRMED] api-specification.md | ✅ pass |
| SAVE10 returns 10% discount | unit | [CONFIRMED] api-specification.md | ✅ pass |
| EC-26 trims leading/trailing spaces before lookup | unit | [INFERRED] promoCodes.ts:39 | ✅ pass |
| EC-28 returns 0 for zero-price item | unit | [INFERRED] calculator.ts:9 | ✅ pass |
| EC-30 floating-point accumulation is rounded to 2 d.p. | unit | [INFERRED] calculator.ts:9 | ✅ pass |
| EC-35 HALF50 gives 50% discount (calculateOrderTotals) | unit | [CONFIRMED] api-specification.md | ✅ pass |
| EC-36 FREESHIP gives 5% discount (calculateOrderTotals) | unit | [CONFIRMED] api-specification.md | ✅ pass |
| EC-38 empty promoCode string applies no discount | unit | [INFERRED] calculator.ts:31 | ✅ pass |
| accepts quantity=1 (lower boundary) | integration | [CONFIRMED] IT-6 table | ✅ pass |
| accepts quantity=100 (upper boundary) | integration | [CONFIRMED] IT-6 table | ✅ pass |
| accepts unitPrice=0 (zero-price item) | integration | [CONFIRMED] IT-3 note | ✅ pass |
| HALF50 applies 50% discount | integration | [CONFIRMED] api-specification.md | ✅ pass |
| FREESHIP applies 5% discount | integration | [CONFIRMED] api-specification.md | ✅ pass |
| unknown promo code returns 201 with zero discount | integration | [CONFIRMED] PC-2 / US-04 | ✅ pass |
| response contains all required fields with correct types | integration | [CONFIRMED] api-specification.md / US-01 | ✅ pass |
| items array is echoed back in the response | integration | [CONFIRMED] api-specification.md | ✅ pass |
| monetary values are rounded to 2 decimal places | integration | [CONFIRMED] validation-rules.md §4.4 | ✅ pass |
| retrieved order matches the created order exactly | integration | [CONFIRMED] US-07 | ✅ pass |

### Boundary

| Test name | File | Origin | Result |
|---|---|---|---|
| EC-06 accepts unitPrice of exactly 0 | unit | [CONFIRMED] IT-3 note | ✅ pass |
| EC-07 rejects quantity=0 (below minimum) | unit | [CONFIRMED] IT-6 boundary table | ✅ pass |
| EC-08 accepts quantity=1 (lower boundary) | unit | [CONFIRMED] IT-6 boundary table | ✅ pass |
| EC-09 accepts quantity=100 (upper boundary) | unit | [CONFIRMED] IT-6 boundary table | ✅ pass |
| EC-10 rejects quantity=101 (above maximum) | unit | [CONFIRMED] IT-6 boundary table | ✅ pass |
| EC-12 rejects negative quantity -1 | unit | [CONFIRMED] IT-6 | ✅ pass |
| EC-29 handles quantity=100 subtotal correctly | unit | [INFERRED] calculator.ts:9 | ✅ pass |
| EC-31 100% discount equals exactly subtotal (total=0) | unit | [CONFIRMED] validation-rules.md §4.3 | ✅ pass |
| EC-32 150% discount clamped to subtotal (total≥0) | unit | [CONFIRMED] validation-rules.md §4.3 | ✅ pass |
| EC-33 0% discount returns 0 | unit | [INFERRED] calculator.ts:17 | ✅ pass |
| EC-41 returns 400 for quantity=0 | integration | [CONFIRMED] IT-6 / US-10 | ✅ pass |
| EC-42 returns 400 for quantity=101 | integration | [CONFIRMED] IT-6 / US-10 | ✅ pass |

### Invalid input

| Test name | File | Origin | Result |
|---|---|---|---|
| EC-01 rejects whitespace-only productId | unit | [CONFIRMED] IT-1 | ✅ pass |
| rejects empty-string productId | unit | [CONFIRMED] IT-1 | ✅ pass |
| EC-02 rejects whitespace-only name | unit | [CONFIRMED] IT-2 | ✅ pass |
| rejects empty-string name | unit | [CONFIRMED] IT-2 | ✅ pass |
| EC-03 rejects NaN unitPrice | unit | [CONFIRMED] IT-3 | ✅ pass |
| EC-04 rejects string unitPrice | unit | [CONFIRMED] IT-3 | ✅ pass |
| EC-05 rejects negative unitPrice (-0.01) | unit | [CONFIRMED] IT-4 | ✅ pass |
| does not produce IT-4 error when IT-3 fires | unit | [CONFIRMED] IT-3 mutual exclusion | ✅ pass |
| EC-11 rejects float quantity 1.5 | unit | [CONFIRMED] IT-5 / US-11 | ✅ pass |
| does not produce IT-6 error when IT-5 fires | unit | [CONFIRMED] IT-5 mutual exclusion | ✅ pass |
| EC-13 collects both unitPrice and quantity errors | unit | [CONFIRMED] IT-3 + IT-6 | ✅ pass |
| EC-14 all-invalid item produces four errors | unit | [CONFIRMED] IT-1+IT-2+IT-3+IT-6 | ✅ pass |
| uses correct index prefix for item at index 2 | unit | [INFERRED] validation.ts:16 | ✅ pass |
| EC-15 rejects null items (short-circuit) | unit | [CONFIRMED] OR-1 | ✅ pass |
| EC-16 rejects empty array (short-circuit) | unit | [CONFIRMED] OR-1 | ✅ pass |
| does not produce item-level errors when OR-1 fires | unit | [CONFIRMED] OR-1 short-circuit | ✅ pass |
| EC-19 returns null for empty string (findPromoCode) | unit | [CONFIRMED] PC-1 | ✅ pass |
| EC-20 returns null for whitespace-only string | unit | [INFERRED] promoCodes.ts:36 | ✅ pass |
| EC-27 completely unknown code returns null | unit | [CONFIRMED] PC-2 | ✅ pass |
| EC-34 negative discountPercent returns 0 | unit | [INFERRED] calculator.ts:17 | ✅ pass |
| EC-39 returns 400 when body has no items field | integration | [CONFIRMED] OR-1 / api-specification.md | ✅ pass |
| EC-40 returns 400 when items is null | integration | [CONFIRMED] OR-1 | ✅ pass |
| returns 400 for empty items array | integration | [CONFIRMED] api-specification.md | ✅ pass |
| EC-43 returns 400 for float quantity 2.5 | integration | [CONFIRMED] IT-5 / US-11 | ✅ pass |
| EC-44 returns 400 for negative unitPrice | integration | [CONFIRMED] IT-4 / US-09 | ✅ pass |
| EC-47 returns 400 for string unitPrice | integration | [CONFIRMED] IT-3 | ✅ pass |
| EC-45 returns 400 for whitespace-only productId | integration | [CONFIRMED] IT-1 / US-12 | ✅ pass |
| EC-46 returns 400 for whitespace-only name | integration | [CONFIRMED] IT-2 / US-12 | ✅ pass |

### Dependency-failure / integration

| Test name | File | Origin | Result |
|---|---|---|---|
| EC-17 first item valid, second item invalid | unit | [INFERRED] validation.ts:56-58 | ✅ pass |
| EC-18 errors from two items both collected | unit | [INFERRED] validation.ts:56-58 | ✅ pass |
| errors appear in index order | unit | [CONFIRMED] validation-rules.md §5 | ✅ pass |
| EC-25 EXPIRED20 returns null (findPromoCode) | unit | [CONFIRMED] PC-3 | ✅ pass |
| EC-37 EXPIRED20 applies zero discount (calculateOrderTotals) | unit | [CONFIRMED] PC-3 | ✅ pass |
| EC-48 only second item invalid: error references items[1] | integration | [INFERRED] validation.ts:56-58 | ✅ pass |
| errors from two invalid items in same response | integration | [CONFIRMED] validation-rules.md §5 | ✅ pass |
| EC-50 EXPIRED20 returns 201 with zero discount | integration | [CONFIRMED] PC-3 / US-05 | ✅ pass |
| EC-51 lowercase "save10" applies same 10% as "SAVE10" | integration | [CONFIRMED] US-03 | ✅ pass |
| EC-49 returns 404 for unknown order id | integration | [CONFIRMED] api-specification.md §3 | ✅ pass |

---

## Coverage

### Before test generation (baseline)

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered lines |
|---|---|---|---|---|---|
| `src/orders/calculator.ts` | 100 | 100 | 100 | 100 | — |
| `src/orders/promoCodes.ts` | 100 | 71 | 100 | 100 | 36, 43 |
| `src/orders/validation.ts` | 57 | 22 | 100 | 57 | 26–30, 33, 35–39, 52–54 |
| `src/routes/orders.ts` | 83 | 33 | 100 | 83 | 21–23, 53–55 |
| **All files** | **65.85** | **59.82** | **75** | **65.85** | |

### After test generation

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered lines |
|---|---|---|---|---|---|
| `src/orders/calculator.ts` | **100** | **100** | **100** | **100** | — |
| `src/orders/promoCodes.ts` | **100** | **100** | **100** | **100** | — |
| `src/orders/validation.ts` | **100** | **100** | **100** | **100** | — |
| `src/routes/orders.ts` | **100** | **87.5** | **100** | **100** | 51 |
| `src/app.ts` | 90 | 100 | 100 | 90 | 31–32 |
| `src/engine/analyser.ts` | 100 | 30.55 | 100 | 100 | branches 20, 27–31, 53–107 |
| `src/engine/docParser.ts` | 100 | 100 | 100 | 100 | — |
| `src/engine/edgeCases.ts` | 100 | 100 | 100 | 100 | — |
| `src/engine/generator.ts` | 0.64 | 100 | 0 | 0.64 | 10–193 |
| `src/engine/runner.ts` | 0 | 0 | 0 | 0 | 1–59 |
| **All files** | **69** | **74** | **75** | **69** | |

### Coverage deltas for order modules

| File | Stmts before → after | Branch before → after |
|---|---|---|
| `validation.ts` | 57% → **100%** | 22% → **100%** |
| `promoCodes.ts` | 100% → **100%** | 71% → **100%** |
| `calculator.ts` | 100% → **100%** | 100% → **100%** |
| `routes/orders.ts` | 83% → **100%** | 33% → **87.5%** |

---

## Untested risks

| Risk | Category | Reason not tested | Failure mode |
|---|---|---|---|
| `src/routes/orders.ts` line 51: `req.params['id']` fallback to `''` | boundary | In-memory store never has key `''`; path is exercised but the `?? ''` default branch is unreachable via HTTP because Express requires a non-empty `:id` segment | Low risk — Express routing prevents empty segment |
| `src/app.ts` lines 31–32: global error handler | dependency-failure | No test injects a handler that throws to trigger the 500 path | Could mask unhandled errors returning HTML instead of JSON |
| `src/engine/generator.ts` (0.64% stmts) | normal | Entire test-file generation engine untested — only the module header executes | High risk: core TestForge feature has no test coverage |
| `src/engine/runner.ts` (0% stmts) | normal | Stub implementation; no tests exist | Medium risk: stub contract untested |
| `src/engine/analyser.ts` branch coverage 30.55% | boundary | Regex branches for multi-line signatures, re-exports, default exports not exercised | Medium risk: analyser silently misses non-standard exports |
| `src/routes/analyse.ts` lines 22–35 | normal | Happy-path (files that actually exist and parse) not tested; only 400 path is covered | Medium risk: success path for source analysis untested |
| `src/routes/generate.ts` lines 50–56 | normal | Test-generation success path not covered | Medium risk |
| `src/routes/report.ts` lines 28–32, 42, 45–46 | normal | Report directory listing success paths not covered | Low risk |
| Promo code with null `expiresAt` (never-expires path) | boundary | No catalogue entry has `expiresAt: null`; that branch in `findPromoCode` is untested | Low risk: null path never reached in current catalogue |

---

## Known discrepancies

None. All generated tests passed without modification. No test was marked `it.todo`. No production behaviour was found to violate a documented invariant.

---

## Possible production observations (not defects)

| Observation | File | Notes |
|---|---|---|
| `src/routes/orders.ts` line 51: branch for `req.params['id'] ?? ''` | `routes/orders.ts` | The `?? ''` fallback is dead code — Express never routes to `/:id` with an empty segment. Not a defect; harmless defensive code. |
| `src/engine/generator.ts` and `runner.ts` are stubs | engine | Documented in architecture.md. These are intentional extension points, not production bugs. |
