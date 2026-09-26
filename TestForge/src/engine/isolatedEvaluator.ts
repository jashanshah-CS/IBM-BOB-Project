import { Worker } from 'node:worker_threads';
import { estimateComplexity } from './complexity.js';
import type { EvaluationResult } from './evaluator.js';

interface WorkerResponse {
  ok: boolean;
  result?: EvaluationResult;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 3_000;

function failure(code: string, message: string): EvaluationResult {
  return {
    status: 'failing',
    symbols: [],
    edgeCases: [],
    diagnostics: [],
    tests: [{
      name: 'Execution safety timeout',
      passed: false,
      expected: 'all generated checks to finish within the safety limit',
      actual: message,
      error: message,
    }],
    passed: 0,
    failed: 1,
    complexity: estimateComplexity(code),
  };
}

export function evaluateTypeScriptIsolated(
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EvaluationResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./evaluatorWorker.js', import.meta.url), {
      workerData: { code },
    });
    let settled = false;

    const finish = (result: EvaluationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      void worker.terminate();
      finish(failure(code, `Execution exceeded the ${timeoutMs} ms safety limit. The submitted code may contain an infinite loop.`));
    }, timeoutMs);

    worker.once('message', (message: WorkerResponse) => {
      void worker.terminate();
      if (message.ok && message.result) finish(message.result);
      else finish(failure(code, message.error ?? 'The isolated evaluator failed.'));
    });
    worker.once('error', (error) => {
      void worker.terminate();
      finish(failure(code, `The isolated evaluator failed: ${error.message}`));
    });
    worker.once('exit', (exitCode) => {
      if (!settled && exitCode !== 0) {
        finish(failure(code, `The isolated evaluator stopped unexpectedly with exit code ${exitCode}.`));
      }
    });
  });
}
