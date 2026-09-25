import express from 'express';
import { analyseRouter } from './routes/analyse.js';
import { generateRouter } from './routes/generate.js';
import { reportRouter } from './routes/report.js';
import { ordersRouter } from './routes/orders.js';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'TestForge', version: '0.1.0' });
  });

  // API routes
  app.use('/api/analyse', analyseRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/report', reportRouter);
  app.use('/api/orders', ordersRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  });

  return app;
}
