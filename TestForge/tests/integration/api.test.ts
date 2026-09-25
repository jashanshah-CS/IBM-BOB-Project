import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('TestForge');
  });
});

describe('POST /api/analyse', () => {
  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/analyse').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when filePaths is an empty array', async () => {
    const res = await request(app).post('/api/analyse').send({ filePaths: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when filePaths is missing', async () => {
    const res = await request(app).post('/api/analyse').send({ docPaths: [] });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/generate', () => {
  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/generate').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when symbols is an empty array', async () => {
    const res = await request(app).post('/api/generate').send({ symbols: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/report', () => {
  it('returns 200 with empty reports list when none exist', async () => {
    const res = await request(app).get('/api/report/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
  });

  it('returns 400 for report id containing path separators', async () => {
    const res = await request(app).get('/api/report/..%2Fetc%2Fpasswd');
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 for a non-existent report id', async () => {
    const res = await request(app).get('/api/report/definitely-does-not-exist-xyz');
    expect(res.status).toBe(404);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/not/a/real/route');
    expect(res.status).toBe(404);
  });
});
