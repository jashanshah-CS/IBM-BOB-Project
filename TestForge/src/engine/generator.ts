import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname, relative, dirname } from 'node:path';
import type { GeneratedTest, SourceSymbol, EdgeCase, ParameterInfo } from '../types.js';
import { validNumericValue } from './numericInputs.js';

function isPythonSource(filePath: string): boolean {
  return extname(filePath) === '.py';
}

// ---------------------------------------------------------------------------
// Test generator — emits real, executable Vitest test files.
// No placeholder assertions, no TODO comments, no commented-out imports.
// ---------------------------------------------------------------------------

export async function generateTests(
  symbols: SourceSymbol[],
  edgeCases: EdgeCase[],
  outputDir: string,
  kind: 'unit' | 'integration' | 'both' = 'both',
): Promise<GeneratedTest[]> {
  await mkdir(outputDir, { recursive: true });

  const results: GeneratedTest[] = [];

  if (kind === 'unit' || kind === 'both') {
    const unitTests = await generateUnitTests(symbols, edgeCases, outputDir);
    results.push(...unitTests);
  }

  if (kind === 'integration' || kind === 'both') {
    const intTests = await generateIntegrationTests(symbols, outputDir);
    results.push(...intTests);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Unit test generation
// ---------------------------------------------------------------------------

async function generateUnitTests(
  symbols: SourceSymbol[],
  edgeCases: EdgeCase[],
  outputDir: string,
): Promise<GeneratedTest[]> {
  // Group symbols by source file
  const byFile = new Map<string, SourceSymbol[]>();
  for (const sym of symbols) {
    const group = byFile.get(sym.filePath) ?? [];
    group.push(sym);
    byFile.set(sym.filePath, group);
  }

  const tests: GeneratedTest[] = [];

  for (const [filePath, fileSymbols] of byFile) {
    const fileBase = basename(filePath, extname(filePath));
    const isPython = isPythonSource(filePath);
    const testFileName = isPython
      ? `test_${fileBase}.py`
      : `${fileBase}.unit.test.ts`;
    const testFilePath = join(outputDir, testFileName);

    const callableSymbols = fileSymbols.filter(
      (s) => s.kind !== 'class' && s.isExported,
    );

    if (callableSymbols.length === 0) continue;

    const source = isPython
      ? renderPythonTestFile(filePath, callableSymbols, edgeCases)
      : renderUnitTestFile(filePath, callableSymbols, edgeCases, testFilePath);

    await writeFile(testFilePath, source, 'utf8');
    tests.push({
      id: randomUUID(),
      targetFile: filePath,
      testFilePath,
      kind: 'unit',
      source,
      createdAt: new Date(),
    });
  }

  return tests;
}

// ---------------------------------------------------------------------------
// Compute a relative import path from testFilePath → sourceFilePath,
// replacing the extension with .js (NodeNext ESM requirement).
// ---------------------------------------------------------------------------

function relativeImportPath(sourceFilePath: string, testFilePath: string): string {
  const sourceDir  = dirname(sourceFilePath);
  const testDir    = dirname(testFilePath);
  const rel        = relative(testDir, sourceDir);
  const base       = basename(sourceFilePath, extname(sourceFilePath));
  // Ensure forward slashes and a leading ./
  const joined     = join(rel, base).replace(/\\/g, '/');
  const withDot    = joined.startsWith('.') ? joined : './' + joined;
  return withDot + '.js';
}

// ---------------------------------------------------------------------------
// Produce typed literal arguments for a function call based on param types.
// Falls back to a sensible default for each primitive.
// ---------------------------------------------------------------------------

function defaultArgFor(param: ParameterInfo): string {
  const t = param.type.toLowerCase();
  if (t === 'unknown' || t === 'any') return '1';
  if (t.includes('[]') || t.includes('array')) {
    if (t.includes('number')) return '[1]';
    if (t.includes('string')) return "['test']";
    if (t.includes('boolean')) return '[true]';
    return '[{}]';
  }
  if (t.includes('object') || t === 'record' || t.trim().startsWith('{')) return '{}';
  if (t.includes('string'))  return `'test'`;
  if (t.includes('boolean')) return 'true';
  if (t.includes('number'))  return String(validNumericValue(param));
  return 'undefined';
}

function callArgs(params: ParameterInfo[]): string {
  return params.map(defaultArgFor).join(', ');
}

// ---------------------------------------------------------------------------
// Produce a readable call expression string, e.g. "fn(a, b)"
// ---------------------------------------------------------------------------

function callExpr(symName: string, params: ParameterInfo[]): string {
  return `${symName}(${callArgs(params)})`;
}

function returnsBoolean(sym: SourceSymbol): boolean {
  return /^(?:promise\s*<\s*)?boolean\s*>?$/i.test(sym.returnType.trim());
}

function returnsValidationResult(sym: SourceSymbol): boolean {
  return /validationresult/i.test(sym.returnType);
}

function booleanExpectation(behaviour: string): boolean | undefined {
  if (/\baccept|\bvalid|\btrue/i.test(behaviour) &&
      !/invalid|reject|outside|not valid/i.test(behaviour)) return true;
  if (/invalid|reject|outside|not valid|\bfalse\b/i.test(behaviour)) return false;
  return undefined;
}

function suggestedValue(param: ParameterInfo, rawValue: string): string {
  const value = rawValue.trim();
  const type = param.type.trim();
  if ((value === 'undefined' || value === 'null') &&
      type !== 'unknown' && type !== 'any') {
    return `${value} as unknown as ${type}`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Produce the expected-result assertion for an edge case.
// Driven by the category and expectedBehaviour text.
// ---------------------------------------------------------------------------

function renderEdgeCaseBody(
  sym: SourceSymbol,
  ec: EdgeCase,
): string[] {
  const lines: string[] = [];
  const cat = ec.category;
  const behaviour = ec.expectedBehaviour.toLowerCase();

  if (cat === 'async-error') {
    lines.push(`    await expect(async () => {`);
    lines.push(`      await ${callExpr(sym.name, sym.params)};`);
    lines.push(`    }).rejects.toThrow();`);
    return lines;
  }

  // Derive a suitable call with the suggested input substituted.
  // inputSuggestion has the form "paramName = value"
  const suggestion = ec.inputSuggestion.trim();
  const [paramName, rawValue] = suggestion.split('=').map(s => s.trim());
  const args = sym.params.map((p) => {
    if (p.name === paramName && rawValue !== undefined) {
      return suggestedValue(p, rawValue);
    }
    return defaultArgFor(p);
  });
  const call = `${sym.name}(${args.join(', ')})`;
  const expectedBoolean = booleanExpectation(behaviour);

  if (ec.expectedResult !== undefined) {
    lines.push(`    expect(${call}).toEqual(${ec.expectedResult});`);
    return lines;
  }

  // Predicates and validators have an exact, useful contract for rejected
  // inputs. Prefer that over weak "does not throw" assertions.
  if (returnsBoolean(sym)) {
    if (expectedBoolean === undefined) {
      lines.push(`    expect(typeof ${call}).toBe('boolean');`);
    } else {
      lines.push(`    expect(${call}).toBe(${expectedBoolean ? 'true' : 'false'});`);
    }
    return lines;
  }

  if (returnsValidationResult(sym)) {
    lines.push(`    const result = ${call};`);
    if (expectedBoolean === undefined) {
      lines.push(`    expect(typeof result.valid).toBe('boolean');`);
    } else {
      lines.push(`    expect(result.valid).toBe(${expectedBoolean ? 'true' : 'false'});`);
    }
    return lines;
  }

  // Decide what to assert based on the expected behaviour description.
  const throwsOrError = /throw|error|reject|invalid|required/i.test(behaviour);
  const returnsFalse  = /false|fail|invalid|reject|not valid/i.test(behaviour);
  const returnsNull   = /null|undefined/i.test(behaviour) && !throwsOrError;

  if (cat === 'nullish') {
    if (throwsOrError) {
      lines.push(`    expect(() => ${call}).toThrow();`);
    } else {
      lines.push(`    const result = ${call};`);
      lines.push(`    expect(result).toBeDefined();`);
    }
  } else if (returnsNull && !throwsOrError) {
    lines.push(`    expect(${call}).toBeNull();`);
  } else if (cat === 'empty') {
    lines.push(`    const result = ${call};`);
    lines.push(`    expect(result !== null && result !== undefined).toBe(true);`);
  } else if (cat === 'overflow' || cat === 'boundary') {
    // For range-check functions that return a validation object, assert !valid.
    // For pure-computation functions, assert the call doesn't throw.
    if (returnsFalse) {
      lines.push(`    const result = ${call};`);
      lines.push(`    if (typeof result === 'object' && result !== null && 'valid' in result) {`);
      lines.push(`      expect((result as {valid:boolean}).valid).toBe(false);`);
      lines.push(`    } else {`);
      lines.push(`      expect(result).toBeDefined();`);
      lines.push(`    }`);
    } else {
      lines.push(`    expect(() => ${call}).not.toThrow();`);
    }
  } else {
    // default: assert the call doesn't throw and returns something defined
    lines.push(`    expect(${call}).toBeDefined();`);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Render a complete unit test file with real imports and real calls.
// ---------------------------------------------------------------------------

function renderUnitTestFile(
  filePath: string,
  symbols: SourceSymbol[],
  edgeCases: EdgeCase[],
  testFilePath: string,
): string {
  const importPath  = relativeImportPath(filePath, testFilePath);
  const exportNames = symbols.map(s => s.name);

  const lines: string[] = [
    `import { describe, it, expect } from 'vitest';`,
    `import { ${exportNames.join(', ')} } from '${importPath}';`,
    ``,
  ];

  for (const sym of symbols) {
    const symEdgeCases = edgeCases.filter(ec => ec.symbolName === sym.name);
    const awaitPrefix  = sym.isAsync ? 'await ' : '';
    const normalArgs   = callArgs(sym.params);
    const normalCall   = `${awaitPrefix}${sym.name}(${normalArgs})`;
    const itPrefix     = sym.isAsync ? 'async ' : '';

    lines.push(`describe('${sym.name}', () => {`);

    // Normal case
    lines.push(`  it(${itPrefix}'returns a result for valid input', ${itPrefix}() => {`);
    lines.push(`    const result = ${normalCall};`);
    if (returnsBoolean(sym)) {
      lines.push(`    expect(typeof result).toBe('boolean');`);
    } else if (returnsValidationResult(sym)) {
      lines.push(`    expect(result.valid).toBe(true);`);
    } else {
      lines.push(`    expect(result).toBeDefined();`);
    }
    lines.push(`  });`);

    // Edge cases from the edge-case engine
    for (const ec of symEdgeCases) {
      const bodyLines = renderEdgeCaseBody(sym, ec);
      const needsAsync = ec.category === 'async-error' ||
        bodyLines.some(l => l.includes('await '));
      const asyncMod = needsAsync ? 'async ' : '';
      lines.push(``);
      lines.push(`  it(${asyncMod}'${ec.description.replace(/'/g, "\\'")} [${ec.category}]', ${asyncMod}() => {`);
      lines.push(...bodyLines);
      lines.push(`  });`);
    }

    // Boundary cases synthesised from parameter types — only when no edge cases exist
    if (symEdgeCases.length === 0) {
      for (const param of sym.params) {
        const t = param.type.toLowerCase();
        if (t.includes('number')) {
          const zeroArgs = sym.params.map((p) => p.name === param.name ? '0' : defaultArgFor(p)).join(', ');
          lines.push(``);
          lines.push(`  it('handles ${param.name}=0 (boundary)', () => {`);
          lines.push(`    expect(() => ${sym.name}(${zeroArgs})).not.toThrow();`);
          lines.push(`  });`);
        }
        if (t.includes('string')) {
          const emptyArgs = sym.params.map((p) => p.name === param.name ? "''" : defaultArgFor(p)).join(', ');
          lines.push(``);
          lines.push(`  it('handles empty string for ${param.name} (boundary)', () => {`);
          lines.push(`    expect(() => ${sym.name}(${emptyArgs})).not.toThrow();`);
          lines.push(`  });`);
        }
      }
    }

    lines.push(`});`);
    lines.push(``);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Integration test generation (Express route stubs with real assertions)
// ---------------------------------------------------------------------------

async function generateIntegrationTests(
  symbols: SourceSymbol[],
  outputDir: string,
): Promise<GeneratedTest[]> {
  const testFileName = `api.integration.test.ts`;
  const testFilePath = join(outputDir, testFileName);
  const source = renderIntegrationTestFile(symbols);

  await writeFile(testFilePath, source, 'utf8');
  return [
    {
      id: randomUUID(),
      targetFile: '(api)',
      testFilePath,
      kind: 'integration',
      source,
      createdAt: new Date(),
    },
  ];
}

function renderIntegrationTestFile(symbols: SourceSymbol[]): string {
  const lines: string[] = [
    `import { describe, it, expect } from 'vitest';`,
    `import request from 'supertest';`,
    `import { createApp } from '../../src/app.js';`,
    ``,
    `const app = createApp();`,
    ``,
    `describe('TestForge API', () => {`,
    `  it('GET /health returns 200 and ok status', async () => {`,
    `    const res = await request(app).get('/health');`,
    `    expect(res.status).toBe(200);`,
    `    expect(res.body.status).toBe('ok');`,
    `  });`,
    ``,
    `  it('POST /api/analyse returns 400 for empty body', async () => {`,
    `    const res = await request(app).post('/api/analyse').send({});`,
    `    expect(res.status).toBe(400);`,
    `  });`,
    ``,
    `  it('POST /api/generate returns 400 for empty body', async () => {`,
    `    const res = await request(app).post('/api/generate').send({});`,
    `    expect(res.status).toBe(400);`,
    `  });`,
    ``,
    `  it('GET /api/report/unknown-id returns 404', async () => {`,
    `    const res = await request(app).get('/api/report/unknown-id');`,
    `    expect(res.status).toBe(404);`,
    `  });`,
  ];

  if (symbols.length > 0) {
    lines.push(`  // Symbols found in source (${symbols.length}): ${symbols.map(s => s.name).join(', ')}`);
  }

  lines.push(`});`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Python test generation (pytest)
// ---------------------------------------------------------------------------

/**
 * Maps the normalised shared type vocabulary back to a Python literal for use
 * inside a pytest assertion call.
 */
function defaultPyArgFor(param: ParameterInfo): string {
  const t = param.type.toLowerCase();
  if (t === 'unknown' || t === 'any') {
    // Infer a sensible default from the parameter name when there is no type annotation
    const n = param.name.toLowerCase();
    if (/arr|array|list|items|values|nums|numbers|elements|data|seq|sequence/.test(n)) return '[1, 2, 3]';
    if (/target|val|value|key|search|query|num|n$|x$|k$/.test(n)) return '1';
    if (/name|text|str|label|msg|message/.test(n)) return '"test"';
    return '1';
  }
  if (t.includes('[]') || t.includes('list')) {
    if (t.includes('number')) return '[1]';
    if (t.includes('string') || t.includes('str')) return "['test']";
    if (t.includes('boolean') || t.includes('bool')) return '[True]';
    return '[{}]';
  }
  if (t === 'object' || t.startsWith('dict')) return '{}';
  if (t.includes('string')) return '"test"';
  if (t.includes('boolean')) return 'True';
  if (t.includes('number')) return String(validNumericValue(param));
  return 'None';
}

function pyCallArgs(params: ParameterInfo[]): string {
  return params.map(defaultPyArgFor).join(', ');
}

/** Derive a Python import path from the source file path. */
function pythonImportName(filePath: string): string {
  // Use just the module name (no path) — caller is expected to run pytest
  // from the project root so the module is resolvable.
  return basename(filePath, '.py');
}

function pythonLiteral(raw: string): string {
  return raw
    .replace(/(["'][^"']*["'])\.repeat\((\d[\d_]*)\)/g, '$1 * $2')
    .replace(/\bundefined\b/g, 'None')
    .replace(/\bnull\b/g, 'None')
    .replace(/\bNaN\b/g, 'float("nan")')
    .replace(/-\bInfinity\b/g, 'float("-inf")')
    .replace(/\bInfinity\b/g, 'float("inf")')
    .replace(/\bNumber\.MAX_SAFE_INTEGER\b/g, '9007199254740991')
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False');
}

function expectedPyBoolean(behaviour: string): boolean | undefined {
  if (/\bor handle\b/i.test(behaviour)) return undefined;
  if (/\baccept|\bvalid|\btrue/i.test(behaviour) &&
      !/invalid|reject|outside|not valid/i.test(behaviour)) return true;
  if (/invalid|reject|outside|not valid|\bfalse\b/i.test(behaviour)) return false;
  return undefined;
}

function renderPyEdgeCaseBody(sym: SourceSymbol, ec: EdgeCase): string[] {
  const lines: string[] = [];
  const behaviour = ec.expectedBehaviour.toLowerCase();
  const throwsOrError = /throw|error|reject|invalid|required|raises?/i.test(behaviour);

  // Build the call with the suggested input substituted.
  const suggestion = ec.inputSuggestion.trim();
  const [paramName, rawValue] = suggestion.split('=').map((s) => s.trim());
  const args = sym.params.map((p) => {
    if (p.name === paramName && rawValue !== undefined) {
      // Convert JS literals to Python literals
      return pythonLiteral(rawValue);
    }
    return defaultPyArgFor(p);
  });
  const directCall = `${sym.name}(${args.join(', ')})`;
  const call = sym.isAsync ? `asyncio.run(${directCall})` : directCall;

  if (ec.expectedResult !== undefined) {
    lines.push(`    assert ${call} == ${pythonLiteral(ec.expectedResult)}`);
    return lines;
  }

  const returnsBoolean = /\bboolean\b|\bbool\b/.test(sym.returnType.toLowerCase());
  const expectedBoolean = returnsBoolean ? expectedPyBoolean(behaviour) : undefined;

  if (returnsBoolean && expectedBoolean === false) {
    lines.push(`    _assert_false_or_raises(lambda: ${call})`);
    return lines;
  }

  if (returnsBoolean) {
    if (expectedBoolean === true) lines.push(`    assert ${call} is True`);
    else lines.push(`    assert isinstance(${call}, bool)`);
    return lines;
  }

  if (/undefined/i.test(sym.returnType) && throwsOrError) {
    lines.push(`    _assert_none_or_raises(lambda: ${call})`);
    return lines;
  }

  if (ec.category === 'async-error' || throwsOrError) {
    lines.push(`    _assert_defined_or_raises(lambda: ${call})`);
    return lines;
  }

  lines.push(`    assert ${call} is not None`);
  return lines;
}

function renderPythonTestFile(
  filePath: string,
  symbols: SourceSymbol[],
  edgeCases: EdgeCase[],
): string {
  const moduleName = pythonImportName(filePath);
  const exportNames = symbols.map((s) => s.name).join(', ');

  const lines: string[] = [
    `import pytest`,
    ...(symbols.some((symbol) => symbol.isAsync) ? [`import asyncio`] : []),
    `from ${moduleName} import ${exportNames}`,
    ``,
    `def _assert_false_or_raises(call):`,
    `    try:`,
    `        assert call() is False`,
    `    except (TypeError, ValueError, OverflowError):`,
    `        pass`,
    ``,
    `def _assert_none_or_raises(call):`,
    `    try:`,
    `        assert call() is None`,
    `    except (TypeError, ValueError, OverflowError):`,
    `        pass`,
    ``,
    `def _assert_defined_or_raises(call):`,
    `    try:`,
    `        assert call() is not None`,
    `    except (TypeError, ValueError, OverflowError):`,
    `        pass`,
    ``,
  ];

  for (const sym of symbols) {
    const symEdgeCases = edgeCases.filter((ec) => ec.symbolName === sym.name);
    const normalArgs = pyCallArgs(sym.params);
    const directNormalCall = `${sym.name}(${normalArgs})`;
    const normalCall = sym.isAsync ? `asyncio.run(${directNormalCall})` : directNormalCall;
    const asyncDec = '';

    // Happy-path test
    lines.push(`${asyncDec}def test_${sym.name}_returns_result_for_valid_input():`);
    if (/bool(ean)?/i.test(sym.returnType)) {
      lines.push(`    assert isinstance(${normalCall}, bool)`);
    } else {
      lines.push(`    assert ${normalCall} is not None`);
    }
    lines.push(``);

    // Edge-case tests
    for (const [edgeIndex, ec] of symEdgeCases.entries()) {
      const bodyLines = renderPyEdgeCaseBody(sym, ec);
      const safeName = ec.description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 60);
      lines.push(`${asyncDec}def test_${sym.name}_${safeName}_${edgeIndex + 1}():`);
      lines.push(...bodyLines);
      lines.push(``);
    }

    // Synthesised boundary tests when no edge cases exist
    if (symEdgeCases.length === 0) {
      for (const param of sym.params) {
        const t = param.type.toLowerCase();
        if (t.includes('number')) {
          const zeroArgs = sym.params.map((p) => p.name === param.name ? '0' : defaultPyArgFor(p)).join(', ');
          lines.push(`def test_${sym.name}_${param.name}_zero_boundary():`);
          lines.push(`    # Should not raise for zero input`);
          lines.push(`    ${sym.name}(${zeroArgs})`);
          lines.push(``);
        }
        if (t.includes('string')) {
          const emptyArgs = sym.params.map((p) => p.name === param.name ? '""' : defaultPyArgFor(p)).join(', ');
          lines.push(`def test_${sym.name}_${param.name}_empty_string_boundary():`);
          lines.push(`    # Should not raise for empty string`);
          lines.push(`    ${sym.name}(${emptyArgs})`);
          lines.push(``);
        }
      }
    }
  }

  return lines.join('\n');
}
