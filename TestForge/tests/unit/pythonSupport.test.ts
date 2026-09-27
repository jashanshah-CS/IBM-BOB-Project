import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyseFile } from '../../src/engine/analyser.js';
import { discoverEdgeCases } from '../../src/engine/edgeCases.js';
import { generateTests } from '../../src/engine/generator.js';
import { estimatePythonComplexity } from '../../src/engine/complexity.js';

const dirs: string[] = [];

async function pythonFile(source: string) {
  const dir = await mkdtemp(join(tmpdir(), 'testforge-python-test-'));
  dirs.push(dir);
  const path = join(dir, 'source.py');
  await writeFile(path, source, 'utf8');
  return { dir, path };
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Python support', () => {
  it('extracts Python types, integer requirements, and chained range constraints', async () => {
    const { path } = await pythonFile(`
def validate_quantity(quantity: int) -> bool:
    return 1 <= quantity <= 100
`);
    const [symbol] = await analyseFile(path);
    expect(symbol?.name).toBe('validate_quantity');
    expect(symbol?.returnType).toBe('boolean');
    expect(symbol?.params[0]).toMatchObject({
      name: 'quantity', type: 'number', integerRequired: true,
    });
    expect(symbol?.params[0]?.numericConstraints).toEqual([
      { operator: '<=', value: 100 },
      { operator: '>=', value: 1 },
    ]);
  });

  it('generates predicate tests that accept False or a clear exception for invalid input', async () => {
    const { dir, path } = await pythonFile(`
def validate_quantity(quantity: int) -> bool:
    return isinstance(quantity, int) and 1 <= quantity <= 100
`);
    const symbols = await analyseFile(path);
    const edgeCases = discoverEdgeCases(symbols);
    const [generated] = await generateTests(symbols, edgeCases, join(dir, 'generated'), 'unit');
    const source = await readFile(generated!.testFilePath, 'utf8');
    expect(source).toContain('def _assert_false_or_raises(call):');
    expect(source).toContain('_assert_false_or_raises(lambda: validate_quantity(None))');
    expect(source).toContain('assert validate_quantity(1) is True');
    expect(source).not.toContain('with pytest.raises(Exception):\n        validate_quantity(None)');
  });

  it('generates executable asyncio.run calls without requiring pytest-asyncio', async () => {
    const { dir, path } = await pythonFile(`
async def is_ready(flag: bool) -> bool:
    return flag
`);
    const symbols = await analyseFile(path);
    const [generated] = await generateTests(
      symbols, discoverEdgeCases(symbols), join(dir, 'generated'), 'unit',
    );
    const source = generated!.source;
    expect(source).toContain('import asyncio');
    expect(source).toContain('asyncio.run(is_ready(True))');
    expect(source).not.toContain('pytest.mark.asyncio');
  });

  it('estimates constant, linear, sorting, and nested-loop Python complexity', () => {
    expect(estimatePythonComplexity('def f(x):\n    return x + 1').time).toBe('O(1)');
    expect(estimatePythonComplexity('def f(xs):\n    for x in xs:\n        print(x)').time).toBe('O(n)');
    expect(estimatePythonComplexity('def f(xs):\n    return sorted(xs)').time).toBe('O(n log n)');
    expect(estimatePythonComplexity(
      'def f(xs):\n    for x in xs:\n        for y in xs:\n            print(x, y)',
    ).time).toBe('O(n^2)');
  });
});
