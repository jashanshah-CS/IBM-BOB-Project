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
10/10 Python end-to-end scenarios passed
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

## Interpretation limits

A `verified` result means every generated scenario passed. It does not prove that arbitrary Python code is completely correct. Results depend on discovered type annotations, comparisons, function names, and supported data structures. Complexity values are static estimates and may differ from runtime behaviour for library calls or data-dependent algorithms.
