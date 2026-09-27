import { evaluatePython } from '../dist/engine/pyRunner.js';

const cases = [
  {
    name: 'correct bounded integer predicate',
    expected: 'verified',
    code: `def validate_quantity(quantity: int) -> bool:
    return isinstance(quantity, int) and 1 <= quantity <= 100`,
  },
  {
    name: 'incorrect OR range predicate',
    expected: 'failing',
    suggestion: true,
    code: `def validate_quantity(quantity: int) -> bool:
    return isinstance(quantity, int) and (quantity >= 1 or quantity <= 100)`,
  },
  {
    name: 'unconstrained boolean predicate',
    expected: 'verified',
    code: `def is_even(value: int) -> bool:
    return isinstance(value, int) and value % 2 == 0`,
  },
  {
    name: 'correct maximum search',
    expected: 'verified',
    code: `from typing import Optional

def find_largest(numbers: list[int]) -> Optional[int]:
    if not numbers:
        return None
    largest = numbers[0]
    for number in numbers[1:]:
        if number > largest:
            largest = number
    return largest`,
  },
  {
    name: 'maximum search skipping second item',
    expected: 'failing',
    suggestion: true,
    code: `from typing import Optional

def find_largest(numbers: list[int]) -> Optional[int]:
    if not numbers:
        return None
    largest = numbers[0]
    for number in numbers[2:]:
        if number > largest:
            largest = number
    return largest`,
  },
  {
    name: 'duplicate removal',
    expected: 'verified',
    code: `import math

def remove_duplicates(numbers: list[int]) -> list[int]:
    return list(dict.fromkeys(number for number in numbers if isinstance(number, (int, float)) and math.isfinite(number)))`,
  },
  {
    name: 'syntax error diagnostics',
    expected: 'analysis-error',
    code: `def broken(value: int) -> bool:
    return value >`,
  },
  {
    name: 'module constant remains available',
    expected: 'verified',
    code: `LIMIT = 10

def within_limit(value: int) -> bool:
    return isinstance(value, int) and value <= LIMIT`,
  },
  {
    name: 'async predicate',
    expected: 'verified',
    code: `async def is_ready(flag: bool) -> bool:
    return bool(flag)`,
  },
  {
    name: 'nested-loop complexity',
    expected: 'verified',
    complexity: 'O(n^2)',
    code: `def pair_count(values: list[int]) -> int:
    count = 0
    for first in values:
        for second in values:
            if first == second:
                count += 1
    return count`,
  },
  {
    name: 'string predicate',
    expected: 'verified',
    code: `def contains_text(text: str) -> bool:
    return isinstance(text, str) and len(text) > 0`,
  },
  {
    name: 'optional string with default',
    expected: 'verified',
    code: `def display_name(name: str | None = None) -> str:
    return (name or "Guest").strip()`,
  },
  {
    name: 'dictionary predicate',
    expected: 'verified',
    code: `def has_identifier(data: dict) -> bool:
    return isinstance(data, dict) and "id" in data`,
  },
  {
    name: 'sorting function',
    expected: 'verified',
    complexity: 'O(n log n)',
    code: `def sort_numbers(numbers: list[int]) -> list[int]:
    return sorted(numbers)`,
  },
  {
    name: 'linear built-in sum',
    expected: 'verified',
    complexity: 'O(n)',
    code: `def sum_values(values: list[int]) -> int:
    return sum(values)`,
  },
  {
    name: 'three nested loops',
    expected: 'verified',
    complexity: 'O(n^3)',
    code: `def count_triples(values: list[int]) -> int:
    count = 0
    for first in values:
        for second in values:
            for third in values:
                count += first == second == third
    return count`,
  },
  {
    name: 'private-only module',
    expected: 'analysis-error',
    code: `def _internal(value: int) -> int:
    return value + 1`,
  },
  {
    name: 'broken duplicate removal',
    expected: 'failing',
    code: `def remove_duplicates(numbers: list[int]) -> list[int]:
    return list(set(numbers))`,
  },
  {
    name: 'single lower-bound predicate',
    expected: 'verified',
    code: `def is_non_negative(value: int) -> bool:
    return isinstance(value, int) and value >= 0`,
  },
  {
    name: 'typed multiple parameters',
    expected: 'verified',
    code: `import math

def can_purchase(price: float, quantity: int, active: bool = True) -> bool:
    return isinstance(price, (int, float)) and math.isfinite(price) and isinstance(quantity, int) and active`,
  },
  {
    name: 'binary search with internal blank lines',
    expected: 'verified',
    complexity: 'O(log n)',
    code: `def binary_search(numbers: list[int], target: int) -> int:
    left = 0
    right = len(numbers) - 1

    while left <= right:
        middle = (left + right) // 2
        if numbers[middle] == target:
            return middle
        if numbers[middle] < target:
            left = middle + 1
        else:
            right = middle - 1

    return -1`,
  },
];

let failed = 0;
for (const testCase of cases) {
  const result = await evaluatePython(testCase.code);
  const statusOk = result.status === testCase.expected;
  const complexityOk = !testCase.complexity || result.complexity.time === testCase.complexity;
  const suggestionOk = !testCase.suggestion || Boolean(result.suggestion);
  let correctedStatus;
  let correctionOk = true;
  if (testCase.suggestion && result.suggestion) {
    const corrected = await evaluatePython(result.suggestion.correctedCode);
    correctedStatus = corrected.status;
    correctionOk = corrected.status === 'verified';
  }
  const ok = statusOk && complexityOk && suggestionOk && correctionOk;
  if (!ok) failed += 1;
  console.log(JSON.stringify({
    case: testCase.name,
    ok,
    expectedStatus: testCase.expected,
    status: result.status,
    passed: result.passed,
    failed: result.failed,
    diagnostics: result.diagnostics.length,
    expectedComplexity: testCase.complexity,
    complexity: result.complexity.time,
    suggestion: result.suggestion?.message,
    correctedStatus,
    failedTests: result.tests.filter((test) => !test.passed).map((test) => ({
      name: test.name, actual: test.actual, error: test.error,
    })),
  }));
}

if (failed > 0) {
  console.error(`${failed} Python audit case(s) failed.`);
  process.exit(1);
}

console.log(`All ${cases.length} Python audit cases passed.`);
