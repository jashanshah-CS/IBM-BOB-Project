import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CoverageReport, RunResult } from '../types.js';

// ---------------------------------------------------------------------------
// Runner — thin orchestration layer.
// A full implementation would spawn a Vitest child process and parse JSON
// output; this module provides the correct interface and a working stub.
// ---------------------------------------------------------------------------

export interface RunnerOptions {
  testFiles: string[];
  reportsDir?: string;
}

export async function runTests(options: RunnerOptions): Promise<RunResult[]> {
  const { testFiles } = options;
  const results: RunResult[] = [];

  for (const testFile of testFiles) {
    // Stub: in production this invokes Vitest programmatically.
    // The shape returned matches the RunResult contract exactly.
    results.push({
      testFile,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      failures: [],
    });
  }

  return results;
}

export async function collectCoverage(
  runResults: RunResult[],
  reportsDir = 'reports/coverage',
): Promise<CoverageReport> {
  await mkdir(reportsDir, { recursive: true });

  const reportId = randomUUID();
  const reportPath = join(reportsDir, reportId);

  const totalPassed = runResults.reduce((s, r) => s + r.passed, 0);
  const totalTests = runResults.reduce((s, r) => s + r.passed + r.failed + r.skipped, 0);

  return {
    id: reportId,
    generatedAt: new Date(),
    totalFiles: runResults.length,
    linesCovered: totalPassed,
    linesTotal: totalTests,
    lineCoverage: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
    branchCoverage: 0,
    reportPath,
  };
}
