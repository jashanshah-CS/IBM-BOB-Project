import { describe, expect, it } from 'vitest';
import { estimateComplexity } from '../../src/engine/complexity.js';

describe('estimateComplexity', () => {
  it('recognises a constant-time predicate', () => {
    const result = estimateComplexity(
      'export function valid(n: number) { return n >= 1 && n <= 5; }',
    );
    expect(result.time).toBe('O(1)');
    expect(result.space).toBe('O(1)');
  });

  it('recognises nested loops and collection allocation', () => {
    const result = estimateComplexity(`
      export function pairs(values: number[]) {
        const output = [];
        for (const left of values) {
          for (const right of values) output.push([left, right]);
        }
        return output;
      }
    `);
    expect(result.time).toBe('O(n^2)');
    expect(result.space).toBe('O(n)');
  });

  it('recognises sorting', () => {
    const result = estimateComplexity(
      'export function ordered(values: number[]) { return [...values].sort((a,b) => a-b); }',
    );
    expect(result.time).toBe('O(n log n)');
    expect(result.space).toBe('O(n)');
  });

  it('treats sorting and sequential loops as O(n log n)', () => {
    const result = estimateComplexity(`
      export function stats(values: number[]) {
        const sorted = [...values].sort((a, b) => a - b);
        let total = 0;
        for (const value of sorted) total += value;
        return total;
      }
    `);
    expect(result.time).toBe('O(n log n)');
    expect(result.space).toBe('O(n)');
  });
});
