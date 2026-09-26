import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { analyseFile } from './analyser.js';
import { discoverEdgeCases } from './edgeCases.js';
import { estimateComplexity, type ComplexityEstimate } from './complexity.js';
import type { EdgeCase, ParameterInfo, SourceSymbol } from '../types.js';
import { validNumericValue } from './numericInputs.js';

export interface DynamicTestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

export interface CodeDiagnostic {
  line: number;
  column: number;
  message: string;
}

export interface CodeSuggestion {
  line: number;
  message: string;
  correctedCode: string;
}

export interface EvaluationResult {
  status: 'verified' | 'failing' | 'analysis-error';
  symbols: SourceSymbol[];
  edgeCases: EdgeCase[];
  diagnostics: CodeDiagnostic[];
  tests: DynamicTestResult[];
  passed: number;
  failed: number;
  complexity: ComplexityEstimate;
  suggestion?: CodeSuggestion;
}

function defaultValue(param: ParameterInfo): unknown {
  const type = param.type.toLowerCase();
  if (type.includes('[]') || type.includes('array')) {
    if (type.includes('number')) return [1];
    if (type.includes('string')) return ['test'];
    if (type.includes('boolean')) return [true];
    return [{}];
  }
  if (type.includes('object') || type === 'record' || type.trim().startsWith('{')) return {};
  if (type.includes('string')) return 'test';
  if (type.includes('boolean')) return true;
  if (type.includes('number')) return validNumericValue(param);
  return 1;
}

function suggestedValue(raw: string): unknown {
  const value = raw.trim();
  if (value === 'undefined') return undefined;
  if (value === 'null') return null;
  if (value === 'NaN') return NaN;
  if (value === 'Infinity') return Infinity;
  if (value === '-Infinity') return -Infinity;
  if (value === 'Number.MAX_SAFE_INTEGER') return Number.MAX_SAFE_INTEGER;
  if (value === 'Number.MIN_SAFE_INTEGER') return Number.MIN_SAFE_INTEGER;
  if (value === '[]') return [];
  if (value === '{}') return {};
  if ((value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      if (value.startsWith('[')) {
        const inner = value.slice(1, -1).trim();
        return inner === '' ? [] : inner.split(',').map((item) => suggestedValue(item));
      }
      return value;
    }
  }
  if (/^".*"$|^'.*'$/.test(value)) return value.slice(1, -1);
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function expectedBoolean(edgeCase: EdgeCase): boolean | undefined {
  const expected = edgeCase.expectedBehaviour.toLowerCase();
  if (/\baccept|\bvalid|\btrue/i.test(expected) &&
      !/invalid|reject|outside|not valid/i.test(expected)) return true;
  if (/invalid|reject|outside|not valid|\bfalse\b/i.test(expected)) return false;
  return undefined;
}

function display(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return 'Infinity';
  if (value === -Infinity) return '-Infinity';
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function equalValues(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  try {
    return JSON.stringify(actual) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

function assertionFor(sym: SourceSymbol, result: unknown, expectedValid?: boolean) {
  if (/^(?:promise\s*<\s*)?boolean\s*>?$/i.test(sym.returnType.trim())) {
    if (expectedValid === undefined) {
      return { passed: typeof result === 'boolean', expected: 'a boolean result' };
    }
    return { passed: result === expectedValid, expected: String(expectedValid) };
  }
  if (/validationresult/i.test(sym.returnType)) {
    const actualValid = typeof result === 'object' && result !== null &&
      'valid' in result ? (result as { valid: unknown }).valid : undefined;
    if (expectedValid === undefined) {
      return { passed: typeof actualValid === 'boolean', expected: '{ valid: boolean }' };
    }
    return { passed: actualValid === expectedValid, expected: `{ valid: ${expectedValid} }` };
  }
  return { passed: result !== undefined, expected: 'a defined result' };
}

async function executeCase(
  fn: (...args: unknown[]) => unknown,
  sym: SourceSymbol,
  name: string,
  args: unknown[],
  expectedValid?: boolean,
  acceptsThrow = false,
  expectedResult?: unknown,
  hasExpectedResult = false,
): Promise<DynamicTestResult> {
  try {
    const result = await fn(...args);
    if (hasExpectedResult) {
      return {
        name,
        passed: equalValues(result, expectedResult),
        expected: display(expectedResult),
        actual: display(result),
      };
    }
    const assertion = assertionFor(sym, result, expectedValid);
    return {
      name,
      passed: assertion.passed,
      expected: assertion.expected,
      actual: display(result),
    };
  } catch (error) {
    return {
      name,
      passed: acceptsThrow,
      expected: acceptsThrow
        ? 'an explicit rejection or thrown error'
        : assertionFor(sym, undefined, expectedValid).expected,
      actual: 'threw an error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function findRangeSuggestion(code: string): CodeSuggestion | undefined {
  const lowerFirst = /(\b[A-Za-z_$][\w$]*)\s*(>=|>)\s*(-?\d+(?:\.\d+)?)\s*\|\|\s*\1\s*(<=|<)\s*(-?\d+(?:\.\d+)?)/;
  const upperFirst = /(\b[A-Za-z_$][\w$]*)\s*(<=|<)\s*(-?\d+(?:\.\d+)?)\s*\|\|\s*\1\s*(>=|>)\s*(-?\d+(?:\.\d+)?)/;
  const match = lowerFirst.exec(code) ?? upperFirst.exec(code);
  if (!match || match.index === undefined) return undefined;
  const correctedCode = code.slice(0, match.index) +
    match[0].replace('||', '&&') +
    code.slice(match.index + match[0].length);
  return {
    line: code.slice(0, match.index).split('\n').length,
    message: 'This range uses ||, so values outside one boundary can still pass the other condition. Use && to require both boundaries.',
    correctedCode,
  };
}

export async function evaluateTypeScript(code: string): Promise<EvaluationResult> {
  const complexity = estimateComplexity(code);
  const runDir = join(tmpdir(), 'testforge-evaluator', randomUUID());
  await mkdir(runDir, { recursive: true });
  const tsFile = join(runDir, 'source.ts');
  const jsFile = join(runDir, 'source.mjs');

  try {
    await writeFile(tsFile, code, 'utf8');
    const transpiled = ts.transpileModule(code, {
      fileName: 'source.ts',
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        strict: true,
      },
    });
    const diagnostics: CodeDiagnostic[] = (transpiled.diagnostics ?? [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => {
        const position = diagnostic.file && diagnostic.start !== undefined
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
          : { line: 0, character: 0 };
        return {
          line: position.line + 1,
          column: position.character + 1,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        };
      });

    const symbols = await analyseFile(tsFile);
    const edgeCases = discoverEdgeCases(symbols);
    if (diagnostics.length > 0) {
      return { status: 'analysis-error', symbols, edgeCases, diagnostics, tests: [], passed: 0, failed: 0, complexity };
    }

    await writeFile(jsFile, transpiled.outputText, 'utf8');
    const moduleExports = await import(`${pathToFileURL(jsFile).href}?run=${randomUUID()}`) as Record<string, unknown>;
    const tests: DynamicTestResult[] = [];

    for (const sym of symbols.filter((candidate) => candidate.isExported && candidate.kind !== 'class')) {
      const exported = moduleExports[sym.name];
      if (typeof exported !== 'function') continue;
      const fn = exported as (...args: unknown[]) => unknown;
      const normalArgs = sym.params.map(defaultValue);
      tests.push(await executeCase(fn, sym, `${sym.name}: valid input`, normalArgs, undefined));

      for (const edgeCase of edgeCases.filter((candidate) => candidate.symbolName === sym.name)) {
        const [paramName, rawValue] = edgeCase.inputSuggestion.split('=').map((part) => part.trim());
        if (!paramName || rawValue === undefined) continue;
        const args = sym.params.map((param) => param.name === paramName
          ? suggestedValue(rawValue)
          : defaultValue(param));
        const acceptsThrow = /throw|error|reject|invalid|required/i
          .test(edgeCase.expectedBehaviour);
        tests.push(await executeCase(
          fn,
          sym,
          edgeCase.description,
          args,
          expectedBoolean(edgeCase),
          acceptsThrow,
          edgeCase.expectedResult === undefined
            ? undefined
            : suggestedValue(edgeCase.expectedResult),
          Object.prototype.hasOwnProperty.call(edgeCase, 'expectedResult') &&
            edgeCase.expectedResult !== undefined,
        ));
      }
    }

    const passed = tests.filter((test) => test.passed).length;
    const failed = tests.length - passed;
    return {
      status: failed === 0 && tests.length > 0 ? 'verified' : 'failing',
      symbols,
      edgeCases,
      diagnostics,
      tests,
      passed,
      failed,
      complexity,
      suggestion: failed > 0 ? findRangeSuggestion(code) : undefined,
    };
  } catch (error) {
    return {
      status: 'analysis-error',
      symbols: [],
      edgeCases: [],
      diagnostics: [{
        line: 1,
        column: 1,
        message: error instanceof Error ? error.message : String(error),
      }],
      tests: [],
      passed: 0,
      failed: 0,
      complexity,
    };
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}
