# Architecture — Order Management

This document describes the structure, data flow, and design decisions of
the order-management subsystem within the TestForge project.

---

## 1. High-level overview

TestForge is an Express-based Node.js API written in TypeScript (ESM,
`NodeNext` module resolution). The order-management feature is one of four
API sub-systems mounted in [`src/app.ts`](../src/app.ts):

```
src/app.ts  (Express application factory)
│
├── GET  /health
├── POST /api/analyse      → src/routes/analyse.ts
├── POST /api/generate     → src/routes/generate.ts
├── GET  /api/report/:id   → src/routes/report.ts
└── POST /api/orders       → src/routes/orders.ts   ← order management
    GET  /api/orders/:id   ↗
```

---

## 2. Module map

```
src/
├── app.ts                   Express app factory; mounts all routers
├── index.ts                 Process entry point; calls createApp(), listens on PORT
├── types.ts                 TestForge engine types (unrelated to orders)
│
├── orders/                  Order-management domain
│   ├── types.ts             All order-domain TypeScript interfaces and types
│   ├── validation.ts        Pure validation logic (no I/O)
│   ├── promoCodes.ts        In-memory promo-code catalogue + lookup function
│   └── calculator.ts        Subtotal, discount, and total calculation
│
└── routes/
    └── orders.ts            Express Router: POST /api/orders, GET /api/orders/:id
```

---

## 3. Request lifecycle — POST /api/orders

```
HTTP POST /api/orders
        │
        ▼
 src/routes/orders.ts
        │
        ├─ 1. VALIDATE ──── src/orders/validation.ts
        │       │               validateOrder(items)
        │       │               └─ validateItem(item, index)  [per item]
        │       │
        │       ├─ INVALID ──→  HTTP 400  { errors: [...] }
        │       │
        │       └─ VALID ──────────────────────────────────────────┐
        │                                                           │
        ├─ 2. CALCULATE ─── src/orders/calculator.ts               │
        │       │               calculateOrderTotals(items, promo) │
        │       │               ├─ calculateSubtotal(items)         │
        │       │               ├─ promoCodes.findPromoCode(promo)  │
        │       │               └─ calculateDiscount(subtotal, %)   │
        │       │                                                   │
        ├─ 3. PERSIST ───── in-memory Map<string, Order>           │
        │                                                           │
        └─ 4. RESPOND ─────────────────────────────────────────────┘
                                HTTP 201  { id, items, subtotal,
                                            discountAmount, total,
                                            status, createdAt }
```

---

## 4. Module responsibilities

### `src/orders/types.ts`
Defines all TypeScript interfaces shared across the domain:

| Interface | Purpose |
|---|---|
| `OrderItem` | A single line item (productId, name, unitPrice, quantity) |
| `Order` | Persisted order record including computed totals and status |
| `CreateOrderRequest` | Shape of the POST body |
| `PromoCode` | Catalogue entry with code, discount %, and expiry |
| `ValidationError` | Single field error `{ field, message }` |
| `ValidationResult` | `{ valid: boolean, errors: ValidationError[] }` |
| `OrderTotals` | `{ subtotal, discountAmount, total }` |
| `OrderStatus` | Union `"pending" | "confirmed" | "cancelled"` |

This file is the **single source of truth for all order types**. Engine
modules and the route do not redeclare types locally.

---

### `src/orders/validation.ts`
**Pure functions; no I/O, no side effects.**

| Export | Description |
|---|---|
| `MIN_QUANTITY = 1` | Exported constant; lower bound for item quantity |
| `MAX_QUANTITY = 100` | Exported constant; upper bound for item quantity |
| `validateItem(item, index)` | Returns `ValidationError[]` for a single item |
| `validateOrder(items)` | Returns `ValidationResult`; calls `validateItem` for each item |

Error accumulation: order-level empty check short-circuits; item-level checks
accumulate across all items. Within one item, `unitPrice` type check blocks
the range check, and `quantity` type check blocks its range check.

---

### `src/orders/promoCodes.ts`
**Pure function + static data; no I/O.**

| Export | Description |
|---|---|
| `PROMO_CODES` | `PromoCode[]` catalogue defined at module load time |
| `findPromoCode(code)` | Returns `PromoCode \| null`; `null` for empty, unknown, or expired codes |

Lookup is case-insensitive and strips whitespace. Expiry is checked against
`new Date()` at call time (clock-dependent; suitable for unit testing with
mocked dates).

---

### `src/orders/calculator.ts`
**Pure functions; no I/O, no side effects.**

| Export | Description |
|---|---|
| `calculateSubtotal(items)` | `Σ (unitPrice × quantity)` |
| `calculateDiscount(subtotal, percent)` | `min(subtotal × percent / 100, subtotal)` |
| `calculateOrderTotals(items, promoCode?)` | Orchestrates subtotal → promo lookup → discount → rounding |

All monetary outputs are rounded to 2 decimal places via
`Math.round(n * 100) / 100`.

---

### `src/routes/orders.ts`
**Thin HTTP adapter; delegates all logic to domain modules.**

| Concern | Handled by |
|---|---|
| Request parsing | `express.json()` middleware in `app.ts` |
| Input validation | `validateOrder()` from `validation.ts` |
| Business logic | `calculateOrderTotals()` from `calculator.ts` |
| Persistence | In-memory `Map<string, Order>` local to the module |
| ID generation | `node:crypto → randomUUID()` |

The route does **not** perform validation itself and does **not** import from
`promoCodes.ts` directly — all promo resolution happens inside the calculator.

---

## 5. Persistence

Orders are stored in a `Map<string, Order>` that is local to `src/routes/orders.ts`.

| Characteristic | Detail |
|---|---|
| Scope | Process lifetime; lost on restart |
| Concurrency | Single-threaded Node.js event loop; no locking required |
| Key | UUID v4 (`node:crypto randomUUID()`) |
| Replacement path | Swap the `store` Map for a database client without changing route or domain logic |

---

## 6. Error handling

| Layer | Mechanism |
|---|---|
| Validation errors | Returned synchronously as `400` inside the route handler |
| Not-found errors | Returned synchronously as `404` inside the route handler |
| Unexpected errors | Re-thrown to Express via `next(err)` (analyse/generate routes) or bubble up naturally; caught by the global error handler in `app.ts` which returns `500` |

The orders route uses synchronous handlers (no `async`/`await`) because all
current operations are in-memory. The `try/next(err)` pattern is reserved for
routes that perform I/O.

---

## 7. Design principles

1. **Pure domain logic** — `validation.ts` and `calculator.ts` are pure functions with no Express or I/O dependencies. They can be unit-tested in isolation and reused in non-HTTP contexts.

2. **Single type authority** — `src/orders/types.ts` is the only file that defines order domain types. No local redeclarations in routes or engine modules.

3. **Silent promo failure** — unknown and expired promo codes produce `discountAmount: 0` rather than a 400 error. This prevents callers from enumerating valid codes and is consistent with common e-commerce anti-abuse practice.

4. **Non-negative total guarantee** — `calculateDiscount` clamps the discount to at most `subtotal`, so `total` is mathematically guaranteed to be `≥ 0` regardless of the discount percentage stored in the catalogue.

5. **Thin route, fat domain** — the route is a pure HTTP adapter. All business rules live in `src/orders/`.

---

## 8. Extension points

| Future capability | Where to add it |
|---|---|
| Persist orders to a database | Replace `store` Map in `src/routes/orders.ts` |
| Order status transitions | Add `PATCH /api/orders/:id/status`; update `OrderStatus` union in `types.ts` |
| Per-user order lists | Add `customerId` to `CreateOrderRequest`; add `GET /api/orders?customerId=…` |
| Promo-code database | Replace `PROMO_CODES` array in `promoCodes.ts` with an async DB query; update `findPromoCode` to be `async` |
| Multi-currency support | Extend `OrderItem` with a `currency` field; add FX conversion step in `calculator.ts` |
| Maximum order value cap | Add a new rule to `validateOrder` after item validation |
