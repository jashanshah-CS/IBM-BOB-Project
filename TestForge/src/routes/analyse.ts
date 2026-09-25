import { Router } from 'express';
import { z } from 'zod';
import { analyseFile } from '../engine/analyser.js';
import { parseDocFile } from '../engine/docParser.js';
import { discoverEdgeCases } from '../engine/edgeCases.js';

export const analyseRouter = Router();

const AnalyseBodySchema = z.object({
  filePaths: z.array(z.string()).min(1, 'At least one file path is required'),
  docPaths: z.array(z.string()).optional().default([]),
});

analyseRouter.post('/', async (req, res, next) => {
  try {
    const parsed = AnalyseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { filePaths, docPaths } = parsed.data;

    const symbolArrays = await Promise.all(filePaths.map(analyseFile));
    const symbols = symbolArrays.flat();

    const docArrays = await Promise.all(docPaths.map(parseDocFile));
    const docSections = docArrays.flat();

    const edgeCases = discoverEdgeCases(symbols, docSections);

    res.json({ symbols, docSections, edgeCases });
  } catch (err) {
    next(err);
  }
});
