# TestForge TypeScript Test Cases

This document records the automated scenarios used to verify TestForge, what the tool was expected to answer, what it actually answered, and how each result should be interpreted or corrected.

## How to run the automated audit

From the `TestForge` directory:

```powershell
npm run audit
npm run typecheck
npm run lint
```

Latest result:

```text
20/20 evaluator scenarios passed
Infinite-loop isolation passed
Generated maximum-boundary assertion passed
Generated decimal/integer assertion passed
```

In this audit, `PASS` means TestForge gave the expected answer. Some deliberately incorrect programs are expected to receive the TestForge status `failing`.

## Evaluator scenarios

| # | Test case | Code characteristic | Expected TestForge answer | Actual answer | Solution or interpretation |
|---:|---|---|---|---|---|
| 1 | Bounded number predicate | Finite age from 18 to 100 using `&&` | `verified`, `O(1)` | `verified`, `O(1)` | No correction needed. The implementation checks both boundaries. |
| 2 | Broken OR range predicate | `age >= 18 || age <= 100` | `failing`, with a suggested correction | `failing`, suggestion produced | Replace `||` with `&&` so both limits must be satisfied. |
| 3 | Integer-only bounded predicate | Uses `Number.isInteger` with lower and upper limits | `verified`, `O(1)` | `verified`, `O(1)` | Decimal inputs are correctly rejected. |
| 4 | Integer rule in a source comment | Comment says decimal stock is invalid, but code accepts it | `failing` | `failing` | Add `Number.isInteger(stock)` to the implementation. |
| 5 | String predicate | Checks that a string contains text | `verified`, `O(1)` | `verified`, `O(1)` | Empty and long-string cases return Boolean results safely. |
| 6 | Async predicate | Async function returns `Promise<boolean>` | `verified`, `O(1)` | `verified`, `O(1)` | Promise-wrapped Boolean results are recognised correctly. |
| 7 | Async bounded predicate | Async finite-number check with range 1–5 | `verified`, `O(1)` | `verified`, `O(1)` | Invalid boundary inputs are rejected after awaiting the result. |
| 8 | Generic even-number predicate | Returns `true` for even numbers and `false` for odd numbers | `verified`, `O(1)` | `verified`, `O(1)` | TestForge checks that neutral cases return a Boolean instead of forcing every valid call to return `true`. |
| 9 | Duplicate removal | Filters non-finite numbers and removes duplicates | `verified`, `O(n)` | `verified`, `O(n)` | The implementation satisfies repeated-value and non-finite-value cases. |
| 10 | Broken maximum search | Loop starts at index 2 and skips index 1 | `failing`, `O(n)` | `failing`, `O(n)` | Start the loop at index 1 and inspect every array position. |
| 11 | Generic array sum | Uses `reduce` to total an array | `verified`, `O(n)` | `verified`, `O(n)` | No correction needed for the generated scenarios. |
| 12 | Optional string input | Uses optional chaining and a fallback name | `verified`, `O(1)` | `verified`, `O(1)` | `undefined` is valid because the parameter is optional. |
| 13 | Object input | Checks for a non-null object | `verified`, `O(1)` | `verified`, `O(1)` | Object types are no longer mistaken for primitive fields contained inside the object. |
| 14 | Inline object type with comma | Parameter type is `{ id: number, name: string }` | One parameter; `verified` | One parameter; `verified` | The analyser keeps the inline object type together rather than splitting it at the comma. |
| 15 | Multiple parameters | Number, string and defaulted Boolean parameters | Three parameters; `verified` | Three parameters; `verified` | Parameter names, types and defaults are retained independently. |
| 16 | Exported arrow predicate | Exported arrow function with numeric boundaries | `verified`, `O(1)` | `verified`, `O(1)` | Arrow exports and their function bodies are analysed correctly. |
| 17 | Repeated parameter name | Two functions both use a parameter named `age` with different ranges | `verified` | `verified` | Each function’s constraints remain scoped to that function. |
| 18 | TypeScript syntax error | Missing expression after `>` | `analysis-error` | `analysis-error` | Use the Diagnostics tab to locate and repair the invalid syntax. |
| 19 | Nested-loop complexity | Two nested loops | `O(n^2)` | `O(n^2)` | The estimate correctly identifies quadratic growth. |
| 20 | Sort plus sequential loop | Sort followed by a linear pass | `O(n log n)` | `O(n log n)` | Sorting dominates the later linear work. |

## Safety and generated-source checks

| Test case | Expected answer | Actual answer | Purpose and solution |
|---|---|---|---|
| Infinite loop | Return a failed timeout check within the safety limit while keeping the API responsive | Passed | Submitted code runs in an isolated worker. An endless loop is terminated after 3 seconds and reported as `Execution safety timeout`. |
| Maximum safe integer above an upper boundary | Generate an exact `toBe(false)` assertion | Passed | This replaced the earlier weak check that only confirmed the return type was Boolean. |
| Decimal rejected by documented integer rule | Generate an exact `toBe(false)` assertion | Passed | Comments containing an explicit decimal/integer requirement are used as local documentation. |

## Uploaded example: `source (3).ts`

The uploaded source deliberately contains defects in price validation, stock validation, maximum search, duplicate removal and statistics calculations.

Latest TestForge result:

| Measurement | Result |
|---|---:|
| Status | `failing` |
| Passed checks | 36 |
| Failed checks | 14 |
| Total checks | 50 |
| Time complexity | `O(n log n)` |
| Space complexity | `O(n)` |

### Detected failures and solutions

| Function | Detected problem | Expected | Actual behaviour | Suggested solution |
|---|---|---|---|---|
| `validatePrice` | `null` is accepted | `false` | `true` | Require `Number.isFinite(price)` before checking the range. |
| `validatePrice` | `Number.MAX_SAFE_INTEGER` is accepted | `false` | `true` | Replace the range `||` with `&&` and reject non-finite values. |
| `validatePrice` | `-1` is accepted | `false` | `true` | Require `price >= 0 && price <= 10000`. |
| `validatePrice` | Positive infinity is accepted | `false` | `true` | Add `Number.isFinite(price)`. |
| `validatePrice` | Negative infinity is accepted | `false` | `true` | Add `Number.isFinite(price)`. |
| `validatePrice` | `10001` is accepted | `false` | `true` | Require both the lower and upper limits. |
| `validateStock` | `null` is accepted | `false` | `true` | Add `Number.isFinite(stock)`. |
| `validateStock` | Decimal stock is accepted despite the comment saying it is invalid | `false` | `true` | Add `Number.isInteger(stock)`. |
| `findLargest` | Largest value at index 1 is skipped | `10` | `5` | Start iterating at index 1. |
| `findLargest` | Greatest negative value is skipped | `-2` | `-5` | Inspect every element starting at index 1. |
| `removeDuplicates` | `NaN` and infinities remain in the result | `[1, 2]` | Non-finite values retained | Filter with `Number.isFinite` before creating the `Set`. |
| `calculateStatistics` | Mixed-value result has the wrong maximum | Full expected statistics object | Maximum is second-largest | Use `sorted[sorted.length - 1]`. |
| `calculateStatistics` | Even-sized median is incorrect | `2.5` | `3` | Average `sorted[middle - 1]` and `sorted[middle]`. |
| `calculateStatistics` | Non-finite input produces incorrect maximum, average and median | Statistics from finite values only | Uses the original length and wrong positions | Calculate every field from the filtered `finite` array. |

## Corrected validation examples

```typescript
export function validatePrice(price: number): boolean {
  return Number.isFinite(price) && price >= 0 && price <= 10000;
}

export function validateStock(stock: number): boolean {
  return Number.isFinite(stock) &&
    Number.isInteger(stock) &&
    stock >= 0 &&
    stock <= 500;
}
```

Correct maximum search:

```typescript
export function findLargest(values: number[]): number | undefined {
  if (values.length === 0) return undefined;

  let largest = values[0];
  for (let index = 1; index < values.length; index++) {
    if (values[index] > largest) largest = values[index];
  }
  return largest;
}
```

Correct duplicate removal:

```typescript
export function removeDuplicates(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))];
}
```

## What each dashboard section means

- **Test results:** Shows the generated input, expected result, actual result and any thrown error.
- **Diagnostics:** Shows TypeScript syntax errors with line and column numbers. It does not replace behavioural tests.
- **Suggested fix:** Provides an automatic correction for supported patterns, such as an invalid range using `||`.
- **Complexity:** Gives heuristic time complexity, space complexity, cyclomatic complexity and supporting evidence.

These tests provide strong evidence for the generated scenarios. They do not mathematically prove that arbitrary source code is completely correct, especially when business requirements are missing from code comments or specification documents.
