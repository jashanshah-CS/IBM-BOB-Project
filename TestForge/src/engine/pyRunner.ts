import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { analyseFile } from './analyser.js';
import { discoverEdgeCases } from './edgeCases.js';
import { generateTests } from './generator.js';
import { estimatePythonComplexity } from './complexity.js';
import type { EvaluationResult } from './evaluator.js';
import type { CodeDiagnostic, DynamicTestResult } from './evaluator.js';

// ---------------------------------------------------------------------------
// Run pytest against user-supplied Python source, returning structured results
// that match EvaluationResult so the frontend needs no changes.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;

/** Resolve the `python` executable — prefer the venv used by the Dashboard. */
function pythonExe(): string {
  // Allow override via env for CI / different setups
  return process.env['PYTHON_EXE'] ?? 'python';
}

function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: stderr + '\n[timeout]', exitCode: -1 });
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

// ---------------------------------------------------------------------------
// Parse pytest -q --tb=short output into DynamicTestResult[]
// ---------------------------------------------------------------------------

function parsePytestOutput(
  stdout: string,
  stderr: string,
): { tests: DynamicTestResult[]; diagnostics: CodeDiagnostic[] } {
  const tests: DynamicTestResult[] = [];
  const diagnostics: CodeDiagnostic[] = [];

  // Normalise line endings so all regex can use \n
  const out = (stdout + stderr).replace(/\r\n/g, '\n');

  // Collection errors (SyntaxError, ImportError, etc.)
  const syntaxMatch = /SyntaxError: (.+)$/m.exec(out);
  const lineMatch = /source\.py.*line (\d+)/m.exec(out);
  if (syntaxMatch) {
    diagnostics.push({
      line: lineMatch ? parseInt(lineMatch[1] ?? '1', 10) : 1,
      column: 1,
      message: syntaxMatch[1] ?? 'Syntax error in source',
    });
    return { tests, diagnostics };
  }

  const importErrMatch = /ImportError: (.+)$/m.exec(out);
  if (importErrMatch) {
    diagnostics.push({ line: 1, column: 1, message: importErrMatch[1] ?? 'Import error' });
    return { tests, diagnostics };
  }

  const collectionError = /(?:NameError|ModuleNotFoundError|TypeError): (.+)$/m.exec(out);
  if (/ERROR collecting|errors? during collection/i.test(out) || collectionError) {
    diagnostics.push({
      line: lineMatch ? parseInt(lineMatch[1] ?? '1', 10) : 1,
      column: 1,
      message: collectionError?.[0] ?? 'Pytest could not collect the generated tests.',
    });
    return { tests, diagnostics };
  }

  // The first line of -q output is the dot/F progress line e.g. "...F..F"
  // then FAILURES section with per-test blocks.
  const failureBlocks = new Map<string, string>();
  const failRe = /_{4,}\s+(test_\S+)\s+_{4,}\n([\s\S]*?)(?=_{4,}|={4,}|$)/g;
  for (const m of out.matchAll(failRe)) {
    failureBlocks.set(m[1] ?? '', m[2] ?? '');
  }

  // Summary line: "X failed, Y passed in Zs"  or  "X passed in Zs"
  const summaryRe = /(\d+) failed.*?(\d+) passed|(\d+) passed/;
  const summaryMatch = summaryRe.exec(out);
  const totalPassed = summaryMatch
    ? parseInt(summaryMatch[2] ?? summaryMatch[3] ?? '0', 10)
    : 0;

  // FAILED lines: "FAILED path::test_name - message"
  const failedLineRe = /^FAILED .*?::(\S+)(?:\s+-\s+(.+))?$/gm;
  const failedNames = new Map<string, string>();
  for (const m of out.matchAll(failedLineRe)) {
    failedNames.set(m[1] ?? '', m[2] ?? 'test failed');
  }

  // Collect passed test names from verbose PASSED lines: "path::test_name PASSED"
  // Simpler: match the test name right before " PASSED"
  const passedNameRe = /::(test_\S+)\s+PASSED/g;
  const passedNames: string[] = [];
  for (const m of out.matchAll(passedNameRe)) passedNames.push(m[1] ?? '');

  for (const [name] of failedNames) {
    const block = failureBlocks.get(name) ?? '';
    // Collect all "E  ..." lines from the failure block for full error detail
    const eLines = [...block.matchAll(/^E\s+(.+)$/gm)].map((m) => (m[1] ?? '').trim());
    const errorMsg = eLines.join(' ') || 'test failed';
    const actualMatch = /where (.+?) =/.exec(block);
    tests.push({
      name,
      passed: false,
      expected: 'test to pass',
      actual: actualMatch ? actualMatch[1].trim() : 'raised an error or assertion failed',
      error: errorMsg,
    });
  }

  for (const name of passedNames) {
    tests.push({ name, passed: true, expected: 'pass', actual: 'pass' });
  }

  // If we have a count but no names (non-verbose), synthesise pass entries
  const knownPassed = passedNames.length;
  for (let i = knownPassed; i < totalPassed; i++) {
    tests.push({ name: `test (${i + 1})`, passed: true, expected: 'pass', actual: 'pass' });
  }

  // Timeout
  if (out.includes('[timeout]')) {
    tests.push({
      name: 'Execution safety timeout',
      passed: false,
      expected: 'tests to complete within the time limit',
      actual: 'timed out',
      error: `Pytest exceeded the ${DEFAULT_TIMEOUT_MS} ms safety limit`,
    });
  }

  return { tests, diagnostics };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Wrap any module-level executable statements so that pytest can import the
 * file without running them.  Function/class definitions are left untouched;
 * everything else that appears at the top indentation level (assignments,
 * print calls, if-blocks that are not `if __name__`) gets moved inside an
 * `if __name__ == '__main__':` guard.
 */
function guardModuleCode(code: string): string {
  const lines = code.split('\n');
  const defStart = /^(async\s+)?def\s+\w|^class\s+\w/;
  const alreadyGuarded = /^if\s+__name__\s*==\s*['"]__main__['"]/;

  // Find the last line that belongs to a definition (or is blank / indented)
  // so we know where top-level executable code begins.
  const execLines: string[] = [];
  const keepLines: string[] = [];
  let inDef = false;

  for (const line of lines) {
    const isBlank = line.trim() === '';
    const isIndented = /^[ \t]/.test(line) && !isBlank;
    const isDef = defStart.test(line);
    const isGuard = alreadyGuarded.test(line);

    const isDependency = /^(?:from\s+\S+\s+import\s+|import\s+|[A-Za-z_]\w*(?::[^=]+)?\s*=|@)/.test(line);
    if (isDef || isGuard || isDependency) {
      inDef = true;
      keepLines.push(line);
      continue;
    }
    if (isIndented && inDef) {
      keepLines.push(line);
      continue;
    }
    // Unindented non-def line resets context
    inDef = false;
    if (isBlank) {
      keepLines.push(line);
      continue;
    }
    // Top-level executable statement
    execLines.push('    ' + line);
  }

  if (execLines.length === 0) return code;

  return keepLines.join('\n').trimEnd() +
    '\n\nif __name__ == \'__main__\':\n' +
    execLines.join('\n') + '\n';
}

export async function evaluatePython(
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EvaluationResult> {
  const runDir = join(tmpdir(), 'testforge-pyrun', randomUUID());
  await mkdir(runDir, { recursive: true });

  const sourceFile = join(runDir, 'source.py');
  await writeFile(sourceFile, guardModuleCode(code), 'utf8');

  try {
    // Analyse the source to get symbols + edge cases
    const symbols = await analyseFile(sourceFile);
    const edgeCases = discoverEdgeCases(symbols);
    const complexity = estimatePythonComplexity(code);

    const callableSymbols = symbols.filter((s) => s.kind !== 'class' && s.isExported);

    if (callableSymbols.length === 0) {
      return {
        status: 'analysis-error',
        symbols,
        edgeCases,
        diagnostics: [],
        tests: [],
        passed: 0,
        failed: 0,
        complexity,
      };
    }

    // Generate a pytest file into the same tmp dir
    const generated = await generateTests(symbols, edgeCases, runDir, 'unit');
    const testFile = generated[0]?.testFilePath;

    if (!testFile) {
      return {
        status: 'analysis-error',
        symbols,
        edgeCases,
        diagnostics: [],
        tests: [],
        passed: 0,
        failed: 0,
        complexity,
      };
    }

    // Run pytest with -v so we get named PASSED/FAILED lines, not just dots
    const { stdout, stderr } = await runProcess(
      pythonExe(),
      [
        '-m', 'pytest', basename(testFile), '--rootdir', runDir,
        '--tb=short', '-v', '--no-header', '-p', 'no:cacheprovider',
      ],
      runDir,
      timeoutMs,
    );

    const { tests, diagnostics } = parsePytestOutput(stdout, stderr);
    const passed = tests.filter((t) => t.passed).length;
    const failed = tests.filter((t) => !t.passed).length;

    return {
      status: diagnostics.length > 0 ? 'analysis-error'
        : failed > 0 ? 'failing'
        : 'verified',
      symbols,
      edgeCases,
      diagnostics,
      tests,
      passed,
      failed,
      complexity,
    };
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}
