import { Router } from 'express';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const reportRouter = Router();

const REPORTS_BASE = join('reports', 'coverage');

reportRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Basic guard against path traversal
    if (!id || /[./\\]/.test(id)) {
      res.status(400).json({ error: 'Invalid report id' });
      return;
    }

    const reportPath = join(REPORTS_BASE, id);

    try {
      await stat(reportPath);
    } catch {
      res.status(404).json({ error: `Report "${id}" not found` });
      return;
    }

    const files = await readdir(reportPath);
    res.json({ id, reportPath, files });
  } catch (err) {
    next(err);
  }
});

reportRouter.get('/', async (_req, res, next) => {
  try {
    let entries: string[] = [];
    try {
      entries = await readdir(REPORTS_BASE);
    } catch {
      // reports dir may not exist yet
    }
    res.json({ reports: entries });
  } catch (err) {
    next(err);
  }
});
