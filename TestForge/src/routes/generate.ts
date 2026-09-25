import { Router } from 'express';
import { z } from 'zod';
import { generateTests } from '../engine/generator.js';
import { join } from 'node:path';

export const generateRouter = Router();

const ParameterInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean(),
  defaultValue: z.string().optional(),
});

const SourceSymbolSchema = z.object({
  name: z.string(),
  kind: z.enum(['function', 'class', 'method', 'arrow']),
  filePath: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  params: z.array(ParameterInfoSchema),
  returnType: z.string(),
  isAsync: z.boolean(),
  isExported: z.boolean(),
});

const EdgeCaseSchema = z.object({
  symbolName: z.string(),
  category: z.enum(['boundary', 'nullish', 'empty', 'overflow', 'type-coercion', 'async-error', 'documented']),
  description: z.string(),
  inputSuggestion: z.string(),
  expectedBehaviour: z.string(),
});

const GenerateBodySchema = z.object({
  symbols: z.array(SourceSymbolSchema).min(1, 'At least one symbol is required'),
  edgeCases: z.array(EdgeCaseSchema).optional().default([]),
  outputDir: z.string().optional().default(join('reports', 'generated-tests')),
  kind: z.enum(['unit', 'integration', 'both']).optional().default('both'),
});

generateRouter.post('/', async (req, res, next) => {
  try {
    const parsed = GenerateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { symbols, edgeCases, outputDir, kind } = parsed.data;
    const tests = await generateTests(symbols, edgeCases, outputDir, kind);

    res.json({ tests: tests.map(({ source: _s, ...rest }) => rest) });
  } catch (err) {
    next(err);
  }
});
