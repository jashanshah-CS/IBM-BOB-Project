# User Stories — Order Management

These stories describe the expected behaviour of the order-management API
from the perspective of a client application. Each story is traceable to
specific validation rules and API responses.

---

## Epic: Place an order

### US-01 — Submit a valid order

**As a** client application,  
**I want to** submit a list of items with quantities and prices,  
**so that** an order is created and I receive a confirmed order record with computed totals.

**Acceptance criteria:**
- Request body contains a non-empty `items` array with at least one item.
- Each item has a non-empty `productId`, a non-empty `name`, a non-negative `unitPrice`, and an integer `quantity` between 1 and 100.
- Response status is `201 Created`.
- Response body contains a UUID `id`, `subtotal`, `discountAmount`, `total`, `status: "pending"`, and `createdAt`.
- `subtotal` equals the sum of `unitPrice × quantity` across all items, rounded to 2 decimal places.
- `discountAmount` is `0` when no promo code is supplied.
- `total` equals `subtotal` when no discount applies.

---

### US-02 — Apply a valid promotion code

**As a** client application,  
**I want to** include an optional `promoCode` in my order request,  
**so that** an applicable discount is deducted from the order total.

**Acceptance criteria:**
- A recognised, non-expired promo code reduces the total by the code's discount percentage applied to the subtotal.
- `discountAmount` is a positive number reflecting the absolute amount deducted.
- `total = subtotal − discountAmount`.
- All monetary values are rounded to 2 decimal places.
- The submitted `promoCode` string is echoed back in the response.

**Known valid codes and their discounts:**

| Code | Discount |
|---|---|
| `SAVE10` | 10% |
| `HALF50` | 50% |
| `FREESHIP` | 5% |

---

### US-03 — Use a promo code case-insensitively

**As a** client application,  
**I want to** submit a promo code in any letter case (e.g. `save10`, `Save10`, `SAVE10`),  
**so that** the API accepts it without requiring exact capitalisation.

**Acceptance criteria:**
- Code lookup is case-insensitive.
- `save10`, `SAVE10`, `Save10` all resolve to the same 10% discount.

---

### US-04 — Unknown promotion code applies no discount

**As a** client application,  
**I want to** submit an unrecognised promo code without receiving an error,  
**so that** the order is still created, just without a discount.

**Acceptance criteria:**
- Response status is `201 Created`.
- `discountAmount` is `0`.
- `total` equals `subtotal`.
- The unknown code is echoed back in `promoCode`.

---

### US-05 — Expired promotion code applies no discount

**As a** client application,  
**I want to** submit the code `EXPIRED20` (or any expired code),  
**so that** the order is created without a discount, not rejected.

**Acceptance criteria:**
- Response status is `201 Created`.
- `discountAmount` is `0` (not 20%).
- `total` equals `subtotal`.

---

### US-06 — Order total is never negative

**As a** client application,  
**I want to** be guaranteed that the `total` field is always ≥ 0,  
**so that** I never receive a negative charge.

**Acceptance criteria:**
- Even if a promo discount percentage would mathematically exceed the subtotal, `discountAmount` is clamped to the subtotal.
- `total` is always `≥ 0`.

---

### US-07 — Retrieve a created order

**As a** client application,  
**I want to** retrieve a previously created order by its ID,  
**so that** I can verify or display order details after creation.

**Acceptance criteria:**
- `GET /api/orders/:id` with a valid UUID returns `200 OK` and the full order object.
- The returned object is identical to the one returned at creation time.

---

## Epic: Validation errors

### US-08 — Empty order is rejected

**As a** client application,  
**I want to** receive a clear error when I submit an order with no items,  
**so that** I know to fix the request before retrying.

**Acceptance criteria:**
- `items: []` or a missing `items` field returns `400 Bad Request`.
- Response body: `{ "errors": [{ "field": "items", "message": "Order must contain at least one item" }] }`.

---

### US-09 — Negative unit price is rejected

**As a** client application,  
**I want to** receive a validation error when an item has a negative price,  
**so that** I cannot accidentally create an order that credits money.

**Acceptance criteria:**
- Any item with `unitPrice < 0` returns `400 Bad Request`.
- Error field is `items[i].unitPrice`; message is `"unitPrice cannot be negative"`.

---

### US-10 — Quantity out of range is rejected

**As a** client application,  
**I want to** receive a validation error when a quantity is outside 1–100,  
**so that** unreasonably large or zero-quantity line items are prevented.

**Acceptance criteria:**
- `quantity = 0` returns `400` with message `"quantity must be between 1 and 100"`.
- `quantity = 101` returns `400` with the same message.
- `quantity = 1` is accepted (lower boundary).
- `quantity = 100` is accepted (upper boundary).

---

### US-11 — Non-integer quantity is rejected

**As a** client application,  
**I want to** receive a validation error when a quantity is a float,  
**so that** fractional line items are never created.

**Acceptance criteria:**
- `quantity = 1.5` returns `400` with message `"quantity must be an integer"`.

---

### US-12 — Missing required item fields are rejected

**As a** client application,  
**I want to** receive specific field-level errors for each missing or blank field,  
**so that** I know exactly which fields to fix.

**Acceptance criteria:**
- Blank `productId` (empty string or whitespace-only): error on `items[i].productId`.
- Blank `name` (empty string or whitespace-only): error on `items[i].name`.
- Multiple errors for a single item are returned together in the same response.

---

### US-13 — Multiple items with errors are all reported

**As a** client application,  
**I want to** receive errors for all invalid items in a single response,  
**so that** I can fix everything at once without multiple round-trips.

**Acceptance criteria:**
- If items at index 0 and index 2 both have validation failures, errors for both are included in the same `400` response.
- Errors from item 0 appear before errors from item 2 (index order).

---

## Epic: Non-order API surfaces

### US-14 — Health check

**As an** operator,  
**I want to** poll `GET /health` to confirm the service is running,  
**so that** load balancers and monitoring tools can detect outages.

**Acceptance criteria:**
- Returns `200 OK` with `{ "status": "ok", "service": "TestForge", "version": "0.1.0" }`.
- No authentication required.

---

### US-15 — Unknown routes return 404

**As a** client application,  
**I want to** receive a `404 Not Found` for any path that does not exist,  
**so that** typos in URLs are immediately apparent.

**Acceptance criteria:**
- Any route not registered in `src/app.ts` returns `{ "error": "Not found" }` with HTTP 404.
