import { parentPort, workerData } from 'node:worker_threads';
import { evaluateTypeScript } from './evaluator.js';

interface WorkerInput {
  code: string;
}

const { code } = workerData as WorkerInput;

try {
  const result = await evaluateTypeScript(code);
  parentPort?.postMessage({ ok: true, result });
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
