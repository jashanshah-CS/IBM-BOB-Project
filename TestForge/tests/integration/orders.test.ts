import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

const validItem = { productId: 'p1', name: 'Widget', unitPrice: 20, quantity: 2 };

describe('POST /api/orders', () => {
  it('creates an order and returns 201 with totals', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [validItem] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.subtotal).toBe(40);
    expect(res.body.total).toBe(40);
    expect(res.body.discountAmount).toBe(0);
    expect(res.body.status).toBe('pending');
  });

  it('applies a promo code and reduces the total', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [validItem], promoCode: 'SAVE10' });

    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(4);
    expect(res.body.total).toBe(36);
  });
});

describe('GET /api/orders/:id', () => {
  it('retrieves an order by id', async () => {
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [validItem] });

    const res = await request(app).get(`/api/orders/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(create.body.id);
  });
});
