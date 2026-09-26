import express from 'express';
import { analyseRouter } from './routes/analyse.js';
import { generateRouter } from './routes/generate.js';
import { reportRouter } from './routes/report.js';
import { ordersRouter } from './routes/orders.js';
import { playgroundRouter } from './routes/playground.js';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Browser homepage
  app.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TestForge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; background: #f7f8fa; color: #1f2328; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 48px 16px; }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: #57606a; margin-bottom: 40px; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; width: 100%; max-width: 860px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; }
    .card h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: .05em; color: #57606a; margin-bottom: 12px; }
    .card p { font-size: 0.92rem; line-height: 1.6; margin-bottom: 8px; }
    code { background: #f0f1f3; border-radius: 4px; padding: 2px 6px; font-size: 0.85rem; font-family: monospace; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600; }
    .green { background: #dcfce7; color: #166534; }
    a { color: #3b82d4; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .endpoints { width: 100%; max-width: 860px; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-size: 0.9rem; }
    th { background: #f7f8fa; text-align: left; padding: 10px 16px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: .05em; color: #57606a; border-bottom: 1px solid #e5e7eb; }
    td { padding: 10px 16px; border-bottom: 1px solid #f0f1f3; }
    tr:last-child td { border-bottom: none; }
    .method { font-weight: 700; font-family: monospace; }
    .post { color: #b45309; }
    .get  { color: #166534; }
    footer { margin-top: 48px; font-size: 0.78rem; color: #57606a; }
  </style>
</head>
<body>
  <h1>⚒ TestForge</h1>
  <p class="subtitle">Intelligent multi-layer test generator &amp; order-management API</p>

  <div class="grid">
    <div class="card">
      <h2>Status</h2>
      <p><span class="badge green">● Running</span></p>
      <p style="margin-top:10px">Version <code>0.1.0</code></p>
      <p><a href="/health">View health JSON →</a></p>
    </div>
    <div class="card">
      <h2>Promo codes</h2>
      <p><code>SAVE10</code> — 10% off</p>
      <p><code>HALF50</code> — 50% off</p>
      <p><code>FREESHIP</code> — 5% off</p>
      <p><code>EXPIRED20</code> — expired (0%)</p>
    </div>
    <div class="card">
      <h2>Playground</h2>
      <p>Paste TypeScript code, analyse symbols, discover edge cases and generate tests — all in the browser.</p>
      <p style="margin-top:8px"><a href="/playground">Open Playground →</a></p>
    </div>
  </div>

  <div class="endpoints">
    <table>
      <thead>
        <tr><th>Method</th><th>Path</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td class="method get">GET</td><td><code>/health</code></td><td>Service health check</td></tr>
        <tr><td class="method post">POST</td><td><code>/api/orders</code></td><td>Create an order</td></tr>
        <tr><td class="method get">GET</td><td><code>/api/orders/:id</code></td><td>Retrieve an order by ID</td></tr>
        <tr><td class="method post">POST</td><td><code>/api/analyse</code></td><td>Analyse source files</td></tr>
        <tr><td class="method post">POST</td><td><code>/api/generate</code></td><td>Generate test files</td></tr>
        <tr><td class="method get">GET</td><td><code>/api/report/:id</code></td><td>View a coverage report</td></tr>
      </tbody>
    </table>
  </div>

  <footer>TestForge · IBM Bob Project</footer>
</body>
</html>`);
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'TestForge', version: '0.1.0' });
  });

  // API routes
  app.use('/api/analyse', analyseRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/report', reportRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/playground', playgroundRouter);

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
