import { evaluateTypeScript } from '../dist/engine/evaluator.js';
import { evaluateTypeScriptIsolated } from '../dist/engine/isolatedEvaluator.js';
import { analyseFile } from '../dist/engine/analyser.js';
import { discoverEdgeCases } from '../dist/engine/edgeCases.js';
import { generateTests } from '../dist/engine/generator.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cases = [
  {
    name: 'bounded number predicate',
    expected: 'verified',
    code: `export function validateAge(age: number): boolean {
      return Number.isFinite(age) && age >= 18 && age <= 100;
    }`,
  },
  {
    name: 'broken OR range predicate',
    expected: 'failing',
    suggestion: true,
    code: `export function validateAge(age: number): boolean {
      return age >= 18 || age <= 100;
    }`,
  },
  {
    name: 'integer-only bounded predicate',
    expected: 'verified',
    code: `export function validateQuantity(quantity: number): boolean {
      return Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
    }`,
  },
  {
    name: 'integer requirement documented in source comment',
    expected: 'failing',
    code: `export function validateStock(stock: number): boolean {
      // Incorrect: decimal stock values must be rejected.
      return stock >= 0 && stock <= 500;
    }`,
  },
  {
    name: 'string predicate',
    expected: 'verified',
    code: `export function hasText(value: string): boolean {
      return typeof value === 'string' && value.length > 0;
    }`,
  },
  {
    name: 'async predicate',
    expected: 'verified',
    expectedAssertions: ['a boolean result'],
    code: `export async function isPositive(value: number): Promise<boolean> {
      return Number.isFinite(value) && value > 0;
    }`,
  },
  {
    name: 'async predicate with rejected boundary',
    expected: 'verified',
    code: `export async function isAllowed(value: number): Promise<boolean> {
      return Number.isFinite(value) && value >= 1 && value <= 5;
    }`,
  },
  {
    name: 'generic even-number predicate',
    expected: 'verified',
    code: `export function isEven(value: number): boolean {
      return Number.isFinite(value) && Number.isInteger(value) && value % 2 === 0;
    }`,
  },
  {
    name: 'duplicate removal',
    expected: 'verified',
    code: `export function removeDuplicates(values: number[]): number[] {
      return [...new Set(values.filter(Number.isFinite))];
    }`,
  },
  {
    name: 'broken maximum search',
    expected: 'failing',
    code: `export function findLargest(values: number[]): number | undefined {
      if (values.length === 0) return undefined;
      let largest = values[0];
      for (let index = 2; index < values.length; index++) {
        if (values[index] > largest) largest = values[index];
      }
      return largest;
    }`,
  },
  {
    name: 'generic array sum',
    expected: 'verified',
    code: `export function sum(values: number[]): number {
      return values.reduce((total, value) => total + value, 0);
    }`,
  },
  {
    name: 'optional string input',
    expected: 'verified',
    code: `export function displayName(value?: string): string {
      return value?.trim() || 'Anonymous';
    }`,
  },
  {
    name: 'object input',
    expected: 'verified',
    code: `export function readEnabled(config: object): boolean {
      return typeof config === 'object' && config !== null;
    }`,
  },
  {
    name: 'inline object type containing a comma',
    expected: 'verified',
    symbolParams: 1,
    code: `export function hasIdentity(person: { id: number, name: string }): boolean {
      return Number.isFinite(person.id) && typeof person.name === 'string';
    }`,
  },
  {
    name: 'multiple parameters retain independent types',
    expected: 'verified',
    symbolParams: 3,
    code: `export function formatOrder(id: number, label: string, active = true): string {
      return id + ':' + label + ':' + active;
    }`,
  },
  {
    name: 'exported arrow predicate',
    expected: 'verified',
    code: `export const withinLimit = (value: number): boolean =>
      Number.isFinite(value) && value >= 0 && value <= 10;`,
  },
  {
    name: 'separate functions with the same parameter name',
    expected: 'verified',
    code: `export function young(age: number): boolean {
      return age >= 1 && age <= 10;
    }
    export function adult(age: number): boolean {
      return age >= 18 && age <= 100;
    }`,
  },
  {
    name: 'syntax error',
    expected: 'analysis-error',
    code: 'export function broken(value: number) { return value > ; }',
  },
  {
    name: 'nested-loop complexity',
    expected: 'verified',
    time: 'O(n^2)',
    code: `export function countPairs(values: number[]): number {
      let count = 0;
      for (const left of values) for (const right of values) {
        if (left === right) count++;
      }
      return count;
    }`,
  },
  {
    name: 'sort plus sequential loop',
    expected: 'verified',
    time: 'O(n log n)',
    code: `export function orderedTotal(values: number[]): number {
      const sorted = [...values].sort((a, b) => a - b);
      let total = 0;
      for (const value of sorted) total += value;
      return total;
    }`,
  },
];

let failures = 0;
for (const auditCase of cases) {
  const result = await evaluateTypeScript(auditCase.code);
  const problems = [];
  if (result.status !== auditCase.expected) {
    problems.push(`expected status ${auditCase.expected}, received ${result.status}`);
  }
  if (auditCase.time && result.complexity.time !== auditCase.time) {
    problems.push(`expected ${auditCase.time}, received ${result.complexity.time}`);
  }
  if (auditCase.suggestion && !result.suggestion) {
    problems.push('expected an automatic suggestion');
  }
  if (auditCase.symbolParams !== undefined && result.symbols[0]?.params.length !== auditCase.symbolParams) {
    problems.push(`expected ${auditCase.symbolParams} parameters, received ${result.symbols[0]?.params.length ?? 0}`);
  }
  for (const assertion of auditCase.expectedAssertions ?? []) {
    if (!result.tests.some((test) => test.expected === assertion)) {
      problems.push(`expected an assertion described as ${JSON.stringify(assertion)}`);
    }
  }
  const passed = problems.length === 0;
  if (!passed) failures++;
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${auditCase.name} | ${result.status} | ${result.complexity.time}`);
  for (const problem of problems) console.log(`       ${problem}`);
}

console.log(`\nAudit result: ${cases.length - failures}/${cases.length} scenarios passed.`);

const timeoutResult = await evaluateTypeScriptIsolated(
  'export function hangs(): never { while (true) {} }',
  200,
);
const timeoutPassed = timeoutResult.status === 'failing' &&
  timeoutResult.tests.some((test) => test.name === 'Execution safety timeout');
console.log(`${timeoutPassed ? 'PASS' : 'FAIL'} | infinite-loop isolation | ${timeoutResult.status}`);
if (!timeoutPassed) failures++;

const generatorDir = await mkdtemp(join(tmpdir(), 'testforge-generator-audit-'));
try {
  const sourcePath = join(generatorDir, 'source.ts');
  const generatedDir = join(generatorDir, 'generated');
  const generatorSource = `export function validatePrice(price: number): boolean {
    return Number.isFinite(price) && price >= 0 && price <= 10000;
  }
  export function validateStock(stock: number): boolean {
    // Incorrect: decimals, NaN and Infinity may pass.
    return Number.isFinite(stock) && stock >= 0 && stock <= 500;
  }`;
  await writeFile(sourcePath, generatorSource, 'utf8');
  const symbols = await analyseFile(sourcePath);
  const generated = await generateTests(
    symbols,
    discoverEdgeCases(symbols),
    generatedDir,
    'unit',
  );
  const testSource = generated[0]?.source ?? '';
  const generatorChecks = [
    ['out-of-range maximum has an exact rejection assertion',
      'validatePrice(Number.MAX_SAFE_INTEGER)).toBe(false)'],
    ['comment-documented decimal rule has an exact rejection assertion',
      'validateStock(250.5)).toBe(false)'],
  ];
  for (const [name, expectedSource] of generatorChecks) {
    const passed = testSource.includes(expectedSource);
    console.log(`${passed ? 'PASS' : 'FAIL'} | generated source | ${name}`);
    if (!passed) failures++;
  }
} finally {
  await rm(generatorDir, { recursive: true, force: true });
}

if (failures > 0) process.exitCode = 1;
