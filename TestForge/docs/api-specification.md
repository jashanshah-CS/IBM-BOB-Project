# API Specification — Order Management

Base URL: `http://localhost:3000`  
Content-Type: `application/json` (all requests and responses)  
Body size limit: 10 MB

---

## Table of contents

1. [Health check](#1-health-check)
2. [Create order — POST /api/orders](#2-create-order)
3. [Get order — GET /api/orders/:id](#3-get-order)
4. [Common error shapes](#4-common-error-shapes)

---

## 1. Health check

### `GET /health`

Returns the running status of the service. No authentication required.

**Response — 200 OK**

```json
{
  "status": "ok",
  "service": "TestForge",
  "version": "0.1.0"
}
```

---

## 2. Create order

### `POST /api/orders`

Validates the supplied items, resolves an optional promotion code, computes
all monetary totals and persists the order in memory.

### Request body

```json
{
  "items": [
    {
      "productId": "string (required, non-empty)",
      "name":      "string (required, non-empty)",
      "unitPrice": "number (required, >= 0)",
      "quantity":  "integer (required, 1 – 100 inclusive)"
    }
  ],
  "promoCode": "string (optional)"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `items` | `OrderItem[]` | ✅ | Non-empty array; at least one element |
| `items[i].productId` | `string` | ✅ | Non-empty after trim |
| `items[i].name` | `string` | ✅ | Non-empty after trim |
| `items[i].unitPrice` | `number` | ✅ | Must be a valid number (not NaN); `>= 0` |
| `items[i].quantity` | `integer` | ✅ | Integer; `1 ≤ quantity ≤ 100` |
| `promoCode` | `string` | ❌ | Case-insensitive; unknown/expired codes silently ignored |

### Successful response — 201 Created

```json
{
  "id":             "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "productId": "prod-1",
      "name":      "Widget",
      "unitPrice": 19.99,
      "quantity":  3
    }
  ],
  "promoCode":      "SAVE10",
  "subtotal":       59.97,
  "discountAmount": 6.00,
  "total":          53.97,
  "status":         "pending",
  "createdAt":      "2024-01-15T10:30:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID v4) | Unique order identifier |
| `items` | `OrderItem[]` | Echo of the submitted items |
| `promoCode` | `string \| undefined` | Echo of the submitted promo code (even if it was invalid) |
| `subtotal` | `number` | Sum of `unitPrice × quantity` for all items, rounded to 2 d.p. |
| `discountAmount` | `number` | Absolute amount deducted; 0 when no valid promo code, rounded to 2 d.p. |
| `total` | `number` | `subtotal − discountAmount`, always ≥ 0, rounded to 2 d.p. |
| `status` | `"pending"` | Initial status; always `"pending"` on creation |
| `createdAt` | ISO 8601 timestamp | Server-assigned creation time |

### Error response — 400 Bad Request

Returned when any validation rule is violated. All errors across all items
are collected and returned together (fail-fast only at the order level for
the empty-items check).

```json
{
  "errors": [
    { "field": "items",            "message": "Order must contain at least one item" },
    { "field": "items[0].quantity","message": "quantity must be between 1 and 100"  }
  ]
}
```

| Trigger | `field` | `message` |
|---|---|---|
| `items` missing or empty array | `"items"` | `"Order must contain at least one item"` |
| `productId` missing or blank | `"items[i].productId"` | `"productId is required"` |
| `name` missing or blank | `"items[i].name"` | `"name is required"` |
| `unitPrice` not a number or NaN | `"items[i].unitPrice"` | `"unitPrice must be a number"` |
| `unitPrice < 0` | `"items[i].unitPrice"` | `"unitPrice cannot be negative"` |
| `quantity` not an integer | `"items[i].quantity"` | `"quantity must be an integer"` |
| `quantity < 1` or `quantity > 100` | `"items[i].quantity"` | `"quantity must be between 1 and 100"` |

### Example requests and responses

**Minimal valid order (no promo code)**

```http
POST /api/orders
Content-Type: application/json

{
  "items": [{ "productId": "p1", "name": "Bolt", "unitPrice": 0.50, "quantity": 4 }]
}
```

```json
HTTP 201
{
  "id": "…",
  "subtotal": 2.00,
  "discountAmount": 0,
  "total": 2.00,
  "status": "pending"
}
```

**Order with SAVE10 promo code**

```http
POST /api/orders
Content-Type: application/json

{
  "items": [{ "productId": "p1", "name": "Widget", "unitPrice": 100, "quantity": 1 }],
  "promoCode": "SAVE10"
}
```

```json
HTTP 201
{ "subtotal": 100, "discountAmount": 10, "total": 90 }
```

**Order with expired promo code**

```http
POST /api/orders
Content-Type: application/json

{
  "items": [{ "productId": "p1", "name": "Widget", "unitPrice": 100, "quantity": 1 }],
  "promoCode": "EXPIRED20"
}
```

```json
HTTP 201
{ "subtotal": 100, "discountAmount": 0, "total": 100 }
```
> The expired code is echoed back as `promoCode: "EXPIRED20"` but applies no discount.

**Empty items array**

```http
POST /api/orders
Content-Type: application/json

{ "items": [] }
```

```json
HTTP 400
{ "errors": [{ "field": "items", "message": "Order must contain at least one item" }] }
```

**Multiple validation failures**

```http
POST /api/orders
Content-Type: application/json

{
  "items": [
    { "productId": "", "name": "X", "unitPrice": -1, "quantity": 0 }
  ]
}
```

```json
HTTP 400
{
  "errors": [
    { "field": "items[0].productId", "message": "productId is required" },
    { "field": "items[0].unitPrice", "message": "unitPrice cannot be negative" },
    { "field": "items[0].quantity",  "message": "quantity must be between 1 and 100" }
  ]
}
```

---

## 3. Get order

### `GET /api/orders/:id`

Retrieves a previously created order by its UUID.

| Parameter | Location | Description |
|---|---|---|
| `id` | Path | UUID v4 returned by `POST /api/orders` |

**Response — 200 OK**: full `Order` object (same shape as the 201 response above).

**Response — 404 Not Found**

```json
{ "error": "Order not found" }
```

---

## 4. Common error shapes

### 400 Bad Request — validation failure
```json
{ "errors": [ { "field": "string", "message": "string" } ] }
```

### 404 Not Found
```json
{ "error": "string" }
```

### 500 Internal Server Error
```json
{ "error": "string" }
```

> Unhandled exceptions are caught by the global Express error handler in
> `src/app.ts` and returned as 500 with `err.message`.

---

## Promotion codes reference

| Code | Discount | Expires |
|---|---|---|
| `SAVE10` | 10% | 2099-12-31 |
| `HALF50` | 50% | 2099-12-31 |
| `FREESHIP` | 5% | 2099-12-31 |
| `EXPIRED20` | ~~20%~~ (expired) | 2000-01-01 |

Matching is **case-insensitive** (`save10` = `SAVE10`).  
Lookup strips leading/trailing whitespace from the submitted code.  
An unrecognised or expired code applies **0% discount** with no error returned.
