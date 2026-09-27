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
];

let failed = 0;
for (const testCase of cases) {
  const result = await evaluatePython(testCase.code);
  const statusOk = result.status === testCase.expected;
  const complexityOk = !testCase.complexity || result.complexity.time === testCase.complexity;
  const ok = statusOk && complexityOk;
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
