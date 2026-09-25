import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { validateOrder } from '../orders/validation.js';
import { calculateOrderTotals } from '../orders/calculator.js';
import type { CreateOrderRequest, Order } from '../orders/types.js';

export const ordersRouter = Router();

// In-memory store (replace with a database in production)
const store = new Map<string, Order>();

// ---------------------------------------------------------------------------
// POST /api/orders — create a new order
// ---------------------------------------------------------------------------

ordersRouter.post('/', (req, res) => {
  const body = req.body as CreateOrderRequest;

  const validation = validateOrder(body?.items ?? []);
  if (!validation.valid) {
    res.status(400).json({ errors: validation.errors });
    return;
  }

  const { subtotal, discountAmount, total } = calculateOrderTotals(
    body.items,
    body.promoCode,
  );

  const order: Order = {
    id: randomUUID(),
    items: body.items,
    promoCode: body.promoCode,
    subtotal,
    discountAmount,
    total,
    status: 'pending',
    createdAt: new Date(),
  };

  store.set(order.id, order);

  res.status(201).json(order);
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id — retrieve an order (handy for verifying create)
// ---------------------------------------------------------------------------

ordersRouter.get('/:id', (req, res) => {
  const order = store.get(req.params['id'] ?? '');
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json(order);
});
