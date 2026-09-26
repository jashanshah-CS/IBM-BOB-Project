import { describe, expect, it } from 'vitest';
import { evaluateTypeScript } from '../../src/engine/evaluator.js';

const CORRECT = `
export function validateQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
}`;

const INCORRECT = `
export function validateQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && (quantity >= 1 || quantity <= 100);
}`;

const CORRECT_AGE = `
export function validateAge(age: number): boolean {
  return Number.isFinite(age) && age >= 18 && age <= 100;
}`;

const REMOVE_DUPLICATES = `
export function removeDuplicates(numbers: number[]): number[] {
  const uniqueNumbers = new Set<number>();
  for (const number of numbers) {
    if (Number.isFinite(number)) uniqueNumbers.add(number);
  }
  return Array.from(uniqueNumbers);
}`;

const BROKEN_FIND_LARGEST = `
export function findLargest(numbers: number[]): number | undefined {
  if (numbers.length === 0) return undefined;
  let largest = numbers[0];
  for (let index = 2; index < numbers.length; index++) {
    if (numbers[index] > largest) largest = numbers[index];
  }
  return largest;
}`;

const CORRECT_FIND_LARGEST = BROKEN_FIND_LARGEST.replace(
  'let index = 2',
  'let index = 1',
);

describe('evaluateTypeScript', () => {
  it('verifies a correct bounded predicate', async () => {
    const result = await evaluateTypeScript(CORRECT);
    expect(result.status).toBe('verified');
    expect(result.failed).toBe(0);
    expect(result.passed).toBeGreaterThan(10);
  });

  it('chooses valid normal and decimal values inside an age range', async () => {
    const result = await evaluateTypeScript(CORRECT_AGE);
    expect(result.status).toBe('verified');
    expect(result.failed).toBe(0);
  });

  it('executes generated collection cases with real array values', async () => {
    const result = await evaluateTypeScript(REMOVE_DUPLICATES);
    expect(result.status).toBe('verified');
    expect(result.failed).toBe(0);
    expect(result.tests.length).toBeGreaterThanOrEqual(5);
  });

  it('detects a largest-value implementation that skips the second item', async () => {
    const result = await evaluateTypeScript(BROKEN_FIND_LARGEST);
    expect(result.status).toBe('failing');
    expect(result.tests.some((test) =>
      test.name.includes('middle') && !test.passed)).toBe(true);
  });

  it('verifies the corrected largest-value implementation', async () => {
    const result = await evaluateTypeScript(CORRECT_FIND_LARGEST);
    expect(result.status).toBe('verified');
    expect(result.failed).toBe(0);
  });

  it('exposes a range OR bug and proposes a correction', async () => {
    const result = await evaluateTypeScript(INCORRECT);
    expect(result.status).toBe('failing');
    expect(result.failed).toBeGreaterThan(0);
    expect(result.suggestion?.correctedCode).toContain(
      'quantity >= 1 && quantity <= 100',
    );
  });

  it('reports syntax errors before attempting tests', async () => {
    const result = await evaluateTypeScript(
      'export function broken(value: number) { return value > ; }',
    );
    expect(result.status).toBe('analysis-error');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.tests).toHaveLength(0);
  });
});
