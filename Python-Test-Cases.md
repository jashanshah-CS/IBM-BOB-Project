# TestForge Python Test Cases

This document records the automated Python scenarios used to verify TestForge. It includes correct programs that must be verified, deliberately defective programs that must fail, diagnostics, generated pytest behaviour, and complexity estimates.

## How to run the Python audit

Create the dashboard virtual environment and install its requirements before running the audit:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Dashboard\requirements.txt
cd TestForge
$env:PYTHON_EXE = "..\.venv\Scripts\python.exe"
npm run audit:python
```

Latest result:

```text
20/20 Python end-to-end scenarios passed
```

In this report, `PASS` means TestForge returned the expected answer. Deliberately incorrect programs are expected to receive the status `failing`.

## End-to-end scenarios

| # | Test case | Expected TestForge answer | Latest result | Purpose and interpretation |
|---:|---|---|---|---|
| 1 | Correct bounded integer predicate | `verified`, zero failed checks, `O(1)` | `verified`, 13 passed, 0 failed | Confirms integer typing, chained range detection, boundary generation, and pytest execution. |
| 2 | Incorrect OR range predicate | `failing`, `O(1)` | `failing`, 9 passed, 4 failed | Detects values below and above the valid range that are incorrectly accepted by `or`. Replace `or` with `and`. |
| 3 | Unconstrained Boolean predicate | `verified`, `O(1)` | `verified`, 8 passed, 0 failed | Confirms neutral values only need to return a Boolean when no range requirement exists. |
| 4 | Correct maximum search | `verified`, `O(n)` | `verified`, 6 passed, 0 failed | Covers empty input, one item, a middle maximum, negative values, and invalid input. |
| 5 | Maximum search skipping the second item | `failing`, `O(n)` | `failing`, 4 passed, 2 failed | Detects the skipped middle maximum and the wrong answer for an all-negative collection. |
| 6 | Duplicate removal with non-finite filtering | `verified` | `verified`, 6 passed, 0 failed | Confirms insertion order, duplicate removal, and filtering of `nan` and infinity. |
| 7 | Python syntax error | `analysis-error` with diagnostics | `analysis-error`, 1 diagnostic | Ensures invalid source is reported instead of being presented as a failed behavioural test. |
| 8 | Function using a module constant | `verified`, `O(1)` | `verified`, 8 passed, 0 failed | Confirms imports and constants remain available when pytest imports submitted code. |
| 9 | Async predicate | `verified`, `O(1)` | `verified`, 2 passed, 0 failed | Executes coroutines through `asyncio.run` without requiring the pytest-asyncio plugin. |
| 10 | Nested-loop function | `verified`, `O(n^2)` | `verified`, 4 passed, 0 failed | Confirms Python-specific nested-loop complexity analysis. |
| 11 | String predicate | `verified`, `O(1)` | `verified`, 4 passed, 0 failed | Checks empty and very long Python strings without emitting JavaScript syntax. |
| 12 | Optional string with default | `verified`, `O(1)` | `verified`, 3 passed, 0 failed | Confirms optional union annotations and default values are retained. |
| 13 | Dictionary predicate | `verified`, `O(1)` | `verified`, 2 passed, 0 failed | Confirms dictionary inputs are generated and evaluated safely. |
| 14 | Sorting function | `verified`, `O(n log n)` | `verified`, 4 passed, 0 failed | Detects Python `sorted` as the dominant operation. |
| 15 | Linear built-in sum | `verified`, `O(n)` | `verified`, 4 passed, 0 failed | Detects a linear Python built-in operation. |
| 16 | Three nested loops | `verified`, `O(n^3)` | `verified`, 4 passed, 0 failed | Confirms cubic loop-depth analysis. |
| 17 | Private-only module | `analysis-error` | `analysis-error` | Confirms private helper functions are not presented as public test targets. |
| 18 | Broken duplicate removal | `failing` | `failing`, 5 passed, 1 failed | Detects failure to remove `nan` and infinite values. |
| 19 | Single lower-bound predicate | `verified`, `O(1)` | `verified`, 9 passed, 0 failed | Confirms one-sided numeric constraints do not create a false upper bound. |
| 20 | Typed multiple parameters | `verified`, `O(1)` | `verified`, 15 passed, 0 failed | Exercises float, integer, Boolean, default, `nan`, and infinity handling together. |

## Live API comparison

The same backend was tested through `/playground/analyse`, `/playground/generate`, and `/playground/run` for both supported languages.

| Input | Extracted symbols | Edge cases | Generated test file | Status | Passed | Failed | Complexity |
|---|---:|---:|---|---|---:|---:|---|
| Correct TypeScript validator | 1 | 14 | `source.test.ts` | `verified` | 15 | 0 | `O(1)` |
| Broken TypeScript validator | 1 | 14 | `source.test.ts` | `failing` | 11 | 4 | `O(1)` |
| Correct Python validator | 1 | 13 | `test_source.py` | `verified` | 13 | 0 | `O(1)` |
| Broken Python validator | 1 | 13 | `test_source.py` | `failing` | 9 | 4 | `O(1)` |

## Automated regression coverage

The Python changes are also covered by `TestForge/tests/unit/pythonSupport.test.ts`. These tests verify:

- Python parameter and return-type normalisation.
- Integer requirements derived from `int` annotations.
- Numeric constraints derived from chained comparisons.
- Predicate tests that permit either `False` or an appropriate exception for rejected input.
- Portable async tests using `asyncio.run`.
- Constant, linear, sorting, and nested-loop Python complexity estimates.

The dashboard client retains three automated tests covering successful requests, backend errors, and connection failures.

## Defects found and corrected

| Defect | Previous behaviour | Correction |
|---|---|---|
| Invalid predicate inputs | Generated pytest always expected an exception, causing correct functions returning `False` to fail. | Predicate checks now accept `False` or a clear input exception. |
| Integer inputs | Decimal values could be treated as valid for parameters annotated as `int`. | Python parameter analysis now records the integer requirement. |
| Range conditions | Python comparisons were not converted into boundary constraints. | The analyser extracts lower and upper constraints, including chained comparisons. |
| Optional returns | `Optional[int]` lost its optional meaning during type normalisation. | Optional return types retain an `undefined` marker and accept `None` where appropriate. |
| Pytest result parsing | Failed-test names containing Windows drive paths were not always captured. | Failure parsing now supports Windows paths and failures without a trailing summary message. |
| Submitted imports and constants | Module imports and assignments could be moved behind the main guard and become unavailable. | Dependencies and module constants remain available to imported functions. |
| Async functions | Generated tests relied on an undeclared pytest plugin and did not await calls correctly. | Tests use the standard-library `asyncio.run` function. |
| Complexity estimates | Python source was processed by TypeScript syntax heuristics. | A Python-specific estimator now handles loops, nesting, sorting, recursion, branches, and allocations. |
| Local startup | The backend could launch without knowing which Python executable contained pytest. | The integrated launcher passes `PYTHON_EXE` to the backend. |
| Python long strings | The shared edge case used JavaScript `.repeat`, which raises `AttributeError` in Python. | Python generation converts the value to string multiplication such as `"a" * 10000`. |

## Suggested corrections

Python automatic correction currently covers two defect patterns with strong evidence:

| Defect | Suggested change | Verification |
|---|---|---|
| Bounded predicate uses `or` | Replace the range `or` with `and`. | The corrected source is rerun and returns `verified`. |
| Maximum search begins with `[2:]` | Change the slice to `[1:]` so the second item is inspected. | The corrected source is rerun and returns `verified`. |

The dashboard displays the explanation, corrected Python source, and an **Apply suggested fix** button for these patterns.

## Interpretation limits

A `verified` result means every generated scenario passed. It does not prove that arbitrary Python code is completely correct. Results depend on discovered type annotations, comparisons, function names, and supported data structures. Complexity values are static estimates and may differ from runtime behaviour for library calls or data-dependent algorithms.
