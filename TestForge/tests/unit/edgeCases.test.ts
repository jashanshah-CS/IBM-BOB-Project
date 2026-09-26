import { describe, it, expect } from 'vitest';
import { discoverEdgeCases } from '../../src/engine/edgeCases.js';
import type { SourceSymbol } from '../../src/types.js';

const makeSymbol = (overrides: Partial<SourceSymbol> = {}): SourceSymbol => ({
  name: 'testFn',
  kind: 'function',
  filePath: '/project/src/utils.ts',
  lineStart: 1,
  lineEnd: 5,
  params: [],
  returnType: 'void',
  isAsync: false,
  isExported: true,
  ...overrides,
});

describe('discoverEdgeCases', () => {
  it('returns an empty array when no symbols or docs are provided', () => {
    expect(discoverEdgeCases([], [])).toEqual([]);
  });

  it('generates a nullish edge case for each non-optional param', () => {
    const sym = makeSymbol({
      params: [{ name: 'id', type: 'string', optional: false }],
    });
    const cases = discoverEdgeCases([sym]);
    const nullish = cases.filter((c) => c.category === 'nullish');
    expect(nullish.length).toBeGreaterThanOrEqual(1);
    expect(nullish[0]?.symbolName).toBe('testFn');
  });

  it('does NOT generate a nullish case for optional params', () => {
    const sym = makeSymbol({
      params: [{ name: 'config', type: 'object', optional: true }],
    });
    const cases = discoverEdgeCases([sym]);
    const nullish = cases.filter((c) => c.category === 'nullish');
    expect(nullish).toHaveLength(0);
  });

  it('generates boundary and overflow cases for number params', () => {
    const sym = makeSymbol({
      params: [{ name: 'count', type: 'number', optional: false }],
    });
    const cases = discoverEdgeCases([sym]);
    const categories = cases.map((c) => c.category);
    expect(categories).toContain('boundary');
    expect(categories).toContain('overflow');
  });

  it('does not assume that every TypeScript number must be an integer', () => {
    const sym = makeSymbol({
      params: [{ name: 'amount', type: 'number', optional: false }],
    });
    const decimal = discoverEdgeCases([sym])
      .find((edgeCase) => edgeCase.description.includes('Decimal value'));
    expect(decimal?.expectedBehaviour).toContain('accept valid numeric input');
  });

  it('generates empty and boundary cases for array params', () => {
    const sym = makeSymbol({
      params: [{ name: 'items', type: 'string[]', optional: false }],
    });
    const cases = discoverEdgeCases([sym]);
    const categories = cases.map((c) => c.category);
    expect(categories).toContain('empty');
    expect(categories).toContain('boundary');
    expect(cases.some((edgeCase) => edgeCase.inputSuggestion === 'items = ["test"]')).toBe(true);
    expect(cases.some((edgeCase) => edgeCase.inputSuggestion === 'items = 0')).toBe(false);
  });

  it('adds an async-error edge case for async symbols', () => {
    const sym = makeSymbol({ isAsync: true });
    const cases = discoverEdgeCases([sym]);
    const asyncErr = cases.filter((c) => c.category === 'async-error');
    expect(asyncErr.length).toBeGreaterThanOrEqual(1);
  });

  it('surfaces edge cases from doc sections containing "must"', () => {
    const cases = discoverEdgeCases([], [
      { heading: 'Rules', content: 'The value must be positive', filePath: 'docs/guide.md', lineStart: 1 },
    ]);
    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0]?.category).toBe('documented');
  });

  it('surfaces boundary cases from doc sections mentioning "limit"', () => {
    const cases = discoverEdgeCases([], [
      { heading: 'Limits', content: 'There is a maximum limit of 100 items', filePath: 'docs/guide.md', lineStart: 10 },
    ]);
    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0]?.category).toBe('boundary');
  });
});
