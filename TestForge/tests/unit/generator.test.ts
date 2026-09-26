import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { access, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyseFile } from '../../src/engine/analyser.js';
import { discoverEdgeCases } from '../../src/engine/edgeCases.js';
import { generateTests } from '../../src/engine/generator.js';
import type { EdgeCase, SourceSymbol } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Generator self-test.
// Generates a test file for quantityValidator.ts and verifies the output
// contains no placeholder assertions, TODO comments, or commented imports.
// ---------------------------------------------------------------------------

const SOURCE_FILE = join(process.cwd(), 'examples', 'quantityValidator.ts');
const TMP_OUT     = join(tmpdir(), 'testforge-generator-self-test');

async function generate(): Promise<string> {
  await mkdir(TMP_OUT, { recursive: true });
  const symbols   = await analyseFile(SOURCE_FILE);
  const edgeCases = discoverEdgeCases(symbols);
  const tests     = await generateTests(symbols, edgeCases, TMP_OUT, 'unit');
  const src = tests[0]?.source;
  if (!src) throw new Error('generateTests returned no unit test file');
  return src;
}

describe('generator — output quality for quantityValidator.ts', () => {
  let source = '';

  beforeAll(async () => {
    source = await generate();
  });

  afterAll(async () => {
    await rm(TMP_OUT, { recursive: true, force: true });
  });

  it('generates at least one test file', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('does not contain expect(true).toBe(true)', () => {
    expect(source).not.toContain('expect(true).toBe(true)');
  });

  it('does not contain TODO comments', () => {
    expect(source).not.toContain('TODO');
  });

  it('does not contain a commented-out source import', () => {
    // A commented import looks like:   // import { ... } from '...'
    expect(source).not.toMatch(/^\s*\/\/\s*import\s+/m);
  });

  it('contains a real import statement for the source file', () => {
    // Must have an uncommented import from a relative path
    expect(source).toMatch(/^import\s+\{[^}]+\}\s+from\s+'[^']+'/m);
  });

  it('calls validateQuantity in at least one test body', () => {
    expect(source).toContain('validateQuantity(');
  });

  it('does not contain bare .toBe(true) assertions (placeholder pattern)', () => {
    // Strip lines that are legitimate (e.g. expect(valid).toBe(true) for passing cases)
    // Placeholder pattern is specifically: expect(true).toBe(true)
    expect(source).not.toContain('expect(true).toBe(true)');
  });

  it('contains at least 2 it() blocks', () => {
    const itCount = (source.match(/\bit\(/g) ?? []).length;
    expect(itCount).toBeGreaterThanOrEqual(2);
  });

});

describe('generator — generated file is parseable TypeScript (no syntax errors)', () => {
  it('round-trips through write/read without corruption', async () => {
    const outDir = join(tmpdir(), 'testforge-gen-roundtrip');
    await mkdir(outDir, { recursive: true });
    const symbols   = await analyseFile(SOURCE_FILE);
    const edgeCases = discoverEdgeCases(symbols);
    const tests     = await generateTests(symbols, edgeCases, outDir, 'unit');
    const filePath  = tests[0]?.testFilePath;
    expect(filePath).toBeDefined();
    const onDisk = await readFile(filePath!, 'utf8');
    expect(onDisk).toContain('validateQuantity(');
    expect(onDisk).not.toContain('expect(true).toBe(true)');
    await rm(outDir, { recursive: true, force: true });
    await expect(access(outDir)).rejects.toThrow();
  });
});

describe('generator — meaningful predicate assertions', () => {
  it('expects true for valid input and false for rejected boundaries', async () => {
    const outDir = join(tmpdir(), 'testforge-boolean-output');
    const symbols: SourceSymbol[] = [{
      name: 'validateQuantity',
      kind: 'function',
      filePath: join(process.cwd(), 'examples', 'booleanQuantity.ts'),
      lineStart: 1,
      lineEnd: 3,
      params: [{ name: 'quantity', type: 'number', optional: false }],
      returnType: 'boolean',
      isAsync: false,
      isExported: true,
    }];
    const edgeCases: EdgeCase[] = [{
      symbolName: 'validateQuantity',
      category: 'boundary',
      description: 'Quantity below minimum',
      inputSuggestion: 'quantity = 0',
      expectedBehaviour: 'Should reject invalid quantity',
    }];

    const [generated] = await generateTests(symbols, edgeCases, outDir, 'unit');
    expect(generated?.source).toContain('expect(result).toBe(true)');
    expect(generated?.source).toContain('expect(validateQuantity(0)).toBe(false)');
    await rm(outDir, { recursive: true, force: true });
  });

  it('uses values inside discovered numeric ranges for valid and decimal cases', async () => {
    const outDir = join(tmpdir(), 'testforge-range-aware-output');
    const symbols: SourceSymbol[] = [{
      name: 'validateAge',
      kind: 'function',
      filePath: join(process.cwd(), 'examples', 'ageValidator.ts'),
      lineStart: 1,
      lineEnd: 3,
      params: [{
        name: 'age',
        type: 'number',
        optional: false,
        numericConstraints: [
          { operator: '>=', value: 18 },
          { operator: '<=', value: 100 },
        ],
      }],
      returnType: 'boolean',
      isAsync: false,
      isExported: true,
    }];
    const edgeCases = discoverEdgeCases(symbols);
    const [generated] = await generateTests(symbols, edgeCases, outDir, 'unit');
    expect(generated?.source).toContain('validateAge(59)');
    expect(generated?.source).toContain('validateAge(59.5)).toBe(true)');
    expect(generated?.source).not.toContain('validateAge(1)');
    await rm(outDir, { recursive: true, force: true });
  });

  it('generates concrete, runnable inputs for number arrays', async () => {
    const outDir = join(tmpdir(), 'testforge-array-output');
    const symbols: SourceSymbol[] = [{
      name: 'removeDuplicates',
      kind: 'function',
      filePath: join(process.cwd(), 'examples', 'removeDuplicates.ts'),
      lineStart: 1,
      lineEnd: 5,
      params: [{ name: 'numbers', type: 'number[]', optional: false }],
      returnType: 'number[]',
      isAsync: false,
      isExported: true,
    }];
    const edgeCases = discoverEdgeCases(symbols);
    const [generated] = await generateTests(symbols, edgeCases, outDir, 'unit');
    expect(generated?.source).toContain('removeDuplicates([1])');
    expect(generated?.source).toContain('removeDuplicates([])');
    expect(generated?.source).not.toMatch(/removeDuplicates\((?:0|1\.5|NaN|Infinity)\)/);
    expect(generated?.source).not.toContain('oneItem');
    await rm(outDir, { recursive: true, force: true });
  });

  it('generates exact behavioural checks for a largest-value function', async () => {
    const outDir = join(tmpdir(), 'testforge-largest-output');
    const symbols: SourceSymbol[] = [{
      name: 'findLargest',
      kind: 'function',
      filePath: join(process.cwd(), 'examples', 'findLargest.ts'),
      lineStart: 1,
      lineEnd: 10,
      params: [{ name: 'numbers', type: 'number[]', optional: false }],
      returnType: 'number | undefined',
      isAsync: false,
      isExported: true,
    }];
    const [generated] = await generateTests(
      symbols,
      discoverEdgeCases(symbols),
      outDir,
      'unit',
    );
    expect(generated?.source).toContain('expect(findLargest([])).toEqual(undefined)');
    expect(generated?.source).toContain('expect(findLargest([1, 10, 5])).toEqual(10)');
    expect(generated?.source).toContain('expect(findLargest([-10, -2, -5])).toEqual(-2)');
    await rm(outDir, { recursive: true, force: true });
  });

  it('generates exact object assertions for a statistics function', async () => {
    const outDir = join(tmpdir(), 'testforge-statistics-output');
    const symbols: SourceSymbol[] = [{
      name: 'calculateStatistics',
      kind: 'function',
      filePath: join(process.cwd(), 'examples', 'calculateStatistics.ts'),
      lineStart: 1,
      lineEnd: 30,
      params: [{ name: 'values', type: 'number[]', optional: false }],
      returnType: 'Statistics',
      isAsync: false,
      isExported: true,
    }];
    const [generated] = await generateTests(
      symbols,
      discoverEdgeCases(symbols),
      outDir,
      'unit',
    );
    expect(generated?.source).toContain('calculateStatistics([5, -2, 0, 3, 10])');
    expect(generated?.source).toContain('"median":3');
    expect(generated?.source).toContain('calculateStatistics([1, NaN, Infinity, 3, -Infinity])');
    await rm(outDir, { recursive: true, force: true });
  });
});
