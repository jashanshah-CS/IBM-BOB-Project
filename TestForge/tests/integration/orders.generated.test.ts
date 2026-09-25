import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

const validItem = { productId: 'P1', name: 'Widget', unitPrice: 20, quantity: 2 };

// ===========================================================================
// POST /api/orders — validation errors
// ===========================================================================

describe('POST /api/orders — order-level validation (OR-1)', () => {
  // [CONFIRMED] api-specification.md§POST errors / validation-rules.md§OR-1
  it('EC-39 returns 400 when body has no items field', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].field).toBe('items');
    expect(res.body.errors[0].message).toBe('Order must contain at least one item');
  });

  // [CONFIRMED] api-specification.md§POST errors / validation-rules.md§OR-1
  it('EC-40 returns 400 when items is null', async () => {
    const res = await request(app).post('/api/orders').send({ items: null });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items');
  });

  // [CONFIRMED] api-specification.md§POST errors — empty array
  it('returns 400 for empty items array', async () => {
    const res = await request(app).post('/api/orders').send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toBe('Order must contain at least one item');
  });
});

describe('POST /api/orders — quantity validation (IT-5 / IT-6, US-10, US-11)', () => {
  // [CONFIRMED] api-specification.md§POST errors / validation-rules.md§IT-6
  it('EC-41 returns 400 for quantity=0', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, quantity: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].quantity');
    expect(res.body.errors[0].message).toBe('quantity must be between 1 and 100');
  });

  // [CONFIRMED] api-specification.md§POST errors / validation-rules.md§IT-6
  it('EC-42 returns 400 for quantity=101', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, quantity: 101 }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].quantity');
    expect(res.body.errors[0].message).toBe('quantity must be between 1 and 100');
  });

  // [CONFIRMED] api-specification.md§POST errors / validation-rules.md§IT-5 / user-stories.md§US-11
  it('EC-43 returns 400 for float quantity 2.5', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, quantity: 2.5 }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].quantity');
    expect(res.body.errors[0].message).toBe('quantity must be an integer');
  });

  // [CONFIRMED] validation-rules.md§IT-6 boundary table: quantity=1 is valid
  it('accepts quantity=1 (lower boundary)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, quantity: 1 }] });
    expect(res.status).toBe(201);
  });

  // [CONFIRMED] validation-rules.md§IT-6 boundary table: quantity=100 is valid
  it('accepts quantity=100 (upper boundary)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, quantity: 100 }] });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/orders — unitPrice validation (IT-3 / IT-4, US-09)', () => {
  // [CONFIRMED] api-specification.md§POST errors / user-stories.md§US-09
  it('EC-44 returns 400 for negative unitPrice', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: -5 }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].unitPrice');
    expect(res.body.errors[0].message).toBe('unitPrice cannot be negative');
  });

  // [CONFIRMED] api-specification.md§POST errors / validation-rules.md§IT-3
  it('EC-47 returns 400 for string unitPrice', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: 'ten' }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].unitPrice');
    expect(res.body.errors[0].message).toBe('unitPrice must be a number');
  });

  // [CONFIRMED] validation-rules.md§IT-3 note: zero is valid
  it('accepts unitPrice=0 (zero-price item)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: 0 }] });
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(0);
    expect(res.body.total).toBe(0);
  });
});

describe('POST /api/orders — required string field validation (IT-1 / IT-2, US-12)', () => {
  // [CONFIRMED] api-specification.md§POST errors / user-stories.md§US-12
  it('EC-45 returns 400 for whitespace-only productId', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, productId: '   ' }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].productId');
    expect(res.body.errors[0].message).toBe('productId is required');
  });

  // [CONFIRMED] api-specification.md§POST errors / user-stories.md§US-12
  it('EC-46 returns 400 for whitespace-only name', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, name: '   ' }] });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[0].name');
    expect(res.body.errors[0].message).toBe('name is required');
  });
});

describe('POST /api/orders — multi-item error accumulation (US-13)', () => {
  // [INFERRED] validation.ts:56-58 — errors collected across all items
  it('EC-48 only second item invalid: error field references items[1]', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          validItem,
          { ...validItem, productId: '' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('items[1].productId');
  });

  // [CONFIRMED] validation-rules.md§5 (both items' errors returned together)
  it('errors from two invalid items are both in the response', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { ...validItem, productId: '' },
          { ...validItem, unitPrice: -1 },
        ],
      });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toContain('items[0].productId');
    expect(fields).toContain('items[1].unitPrice');
  });
});

// ===========================================================================
// POST /api/orders — promo code behaviour
// ===========================================================================

describe('POST /api/orders — promo code (PC-2, PC-3, PC-4, PC-5)', () => {
  // [CONFIRMED] validation-rules.md§PC-3 / user-stories.md§US-05
  it('EC-50 EXPIRED20 returns 201 with zero discount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: 100, quantity: 1 }], promoCode: 'EXPIRED20' });
    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(0);
    expect(res.body.total).toBe(res.body.subtotal);
    // [CONFIRMED] api-specification.md: expired code is echoed back
    expect(res.body.promoCode).toBe('EXPIRED20');
  });

  // [CONFIRMED] user-stories.md§US-03 (case-insensitive)
  it('EC-51 lowercase "save10" applies the same 10% as "SAVE10"', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: 100, quantity: 1 }], promoCode: 'save10' });
    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(10);
    expect(res.body.total).toBe(90);
  });

  // [CONFIRMED] api-specification.md promo table — HALF50
  it('HALF50 applies 50% discount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: 100, quantity: 1 }], promoCode: 'HALF50' });
    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(50);
    expect(res.body.total).toBe(50);
  });

  // [CONFIRMED] api-specification.md promo table — FREESHIP
  it('FREESHIP applies 5% discount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ ...validItem, unitPrice: 200, quantity: 1 }], promoCode: 'FREESHIP' });
    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(10);
    expect(res.body.total).toBe(190);
  });

  // [CONFIRMED] validation-rules.md§PC-2 / user-stories.md§US-04
  it('unknown promo code returns 201 with zero discount and echoes the code', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [validItem], promoCode: 'TOTALLYFAKE' });
    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(0);
    expect(res.body.promoCode).toBe('TOTALLYFAKE');
  });
});

// ===========================================================================
// POST /api/orders — response shape (US-01)
// ===========================================================================

describe('POST /api/orders — response shape (US-01)', () => {
  // [CONFIRMED] api-specification.md§POST successful response fields / user-stories.md§US-01
  it('response contains all required fields with correct types', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [validItem] });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID v4
    expect(typeof res.body.subtotal).toBe('number');
    expect(typeof res.body.discountAmount).toBe('number');
    expect(typeof res.body.total).toBe('number');
    expect(res.body.status).toBe('pending');
    expect(res.body.createdAt).toBeDefined();
  });

  // [CONFIRMED] api-specification.md: items echoed back in response
  it('items array is echoed back in the response', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [validItem] });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productId).toBe('P1');
  });

  // [CONFIRMED] validation-rules.md§4.1 + 4.4 rounding
  it('monetary values are rounded to 2 decimal places', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 'P1', name: 'A', unitPrice: 19.99, quantity: 3 }],
        promoCode: 'SAVE10',
      });
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(59.97);
    expect(res.body.discountAmount).toBe(6);
    expect(res.body.total).toBe(53.97);
  });
});

// ===========================================================================
// GET /api/orders/:id
// ===========================================================================

describe('GET /api/orders/:id (US-07)', () => {
  // [CONFIRMED] api-specification.md§GET /api/orders/:id 404 response
  it('EC-49 returns 404 with correct error for unknown id', async () => {
    const res = await request(app).get('/api/orders/nonexistent-id-99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  // [CONFIRMED] user-stories.md§US-07 — response identical to creation
  it('retrieved order matches the created order exactly', async () => {
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [validItem], promoCode: 'SAVE10' });
    const get = await request(app).get(`/api/orders/${create.body.id}`);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(create.body.id);
    expect(get.body.subtotal).toBe(create.body.subtotal);
    expect(get.body.discountAmount).toBe(create.body.discountAmount);
    expect(get.body.total).toBe(create.body.total);
    expect(get.body.promoCode).toBe(create.body.promoCode);
  });
});
