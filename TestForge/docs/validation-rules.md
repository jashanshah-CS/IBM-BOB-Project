# Validation Rules — Order Management

This document is the authoritative reference for every input constraint
enforced by the order-management API. All rules are derived directly from
[`src/orders/validation.ts`](../src/orders/validation.ts) and
[`src/orders/promoCodes.ts`](../src/orders/promoCodes.ts).

---

## 1. Order-level rules

| # | Rule | Trigger condition | HTTP status | Error field | Error message |
|---|---|---|---|---|---|
| OR-1 | Orders must not be empty | `items` is missing, `null`, not an array, or an empty array | 400 | `"items"` | `"Order must contain at least one item"` |

> **Short-circuit behaviour**: when OR-1 fires the validator returns immediately
> without inspecting individual items. No item-level errors are produced.

---

## 2. Item-level rules

Item errors are collected for **all** items before returning. A request with
three invalid items yields errors from all three in a single 400 response.

Error fields use the pattern `items[i].<property>` where `i` is the
zero-based index of the item in the submitted array.

### 2.1 productId

| # | Rule | Trigger condition | Error message |
|---|---|---|---|
| IT-1 | `productId` is required | Field is absent, `null`, `undefined`, empty string, or whitespace-only | `"productId is required"` |

### 2.2 name

| # | Rule | Trigger condition | Error message |
|---|---|---|---|
| IT-2 | `name` is required | Field is absent, `null`, `undefined`, empty string, or whitespace-only | `"name is required"` |

### 2.3 unitPrice

| # | Rule | Trigger condition | Error message |
|---|---|---|---|
| IT-3 | `unitPrice` must be a number | Field is not of type `number`, or its value is `NaN` | `"unitPrice must be a number"` |
| IT-4 | `unitPrice` cannot be negative | `unitPrice < 0` | `"unitPrice cannot be negative"` |

> Rules IT-3 and IT-4 are mutually exclusive: IT-4 is only checked when IT-3 passes.

> A value of `0` is **valid** — zero-price items (e.g. free gifts) are permitted.

### 2.4 quantity

| # | Rule | Trigger condition | Error message |
|---|---|---|---|
| IT-5 | `quantity` must be an integer | Field is not of type `number`, or is a floating-point value (e.g. `1.5`) | `"quantity must be an integer"` |
| IT-6 | `quantity` must be in range | `quantity < 1` or `quantity > 100` | `"quantity must be between 1 and 100"` |

> Rules IT-5 and IT-6 are mutually exclusive: IT-6 is only checked when IT-5 passes.

#### Boundary values for quantity

| Value | Valid? | Rule triggered |
|---|---|---|
| `-1` | ❌ | IT-6 |
| `0` | ❌ | IT-6 |
| `1` | ✅ | — (lower boundary) |
| `50` | ✅ | — |
| `100` | ✅ | — (upper boundary) |
| `101` | ❌ | IT-6 |
| `1.5` | ❌ | IT-5 |
| `NaN` | ❌ | IT-5 |

---

## 3. Promotion-code rules

Promotion codes are **optional**. Submitting no `promoCode` field (or an
empty string) simply results in `discountAmount: 0`.

Code resolution is performed by
[`src/orders/promoCodes.ts → findPromoCode()`](../src/orders/promoCodes.ts).

| # | Rule | Behaviour |
|---|---|---|
| PC-1 | Missing or empty code | `discountPercent = 0`; no error |
| PC-2 | Unrecognised code | `discountPercent = 0`; no error; code echoed back in response |
| PC-3 | Expired code | `discountPercent = 0`; no error; code echoed back in response |
| PC-4 | Valid code | `discountPercent` set to the code's configured value; discount applied |
| PC-5 | Case-insensitivity | Lookup normalises both the submitted code and the catalogue entry to uppercase before comparing |
| PC-6 | Whitespace trimming | Leading/trailing whitespace is stripped from the submitted code before lookup |

> **No validation error is ever returned for a promo code**, regardless of
> whether it is unknown, expired, or malformed. This is by design — the caller
> cannot distinguish between "code doesn't exist" and "code has been used up",
> which is a common anti-abuse pattern.

### Active promotion catalogue

Defined in [`src/orders/promoCodes.ts`](../src/orders/promoCodes.ts):

| Code | Discount % | Expires |
|---|---|---|
| `SAVE10` | 10 | 2099-12-31 |
| `HALF50` | 50 | 2099-12-31 |
| `FREESHIP` | 5 | 2099-12-31 |
| `EXPIRED20` | ~~20~~ | 2000-01-01 (expired) |

---

## 4. Calculation rules

Defined in [`src/orders/calculator.ts`](../src/orders/calculator.ts).

### 4.1 Subtotal

```
subtotal = Σ (items[i].unitPrice × items[i].quantity)
```

Rounded to 2 decimal places using `Math.round(n * 100) / 100`.

### 4.2 Discount amount

```
discountAmount = min( subtotal × (discountPercent / 100),  subtotal )
```

- If `discountPercent ≤ 0`, `discountAmount = 0`.
- The `min(…, subtotal)` clamp ensures `discountAmount` never exceeds `subtotal`,
  preventing a negative total.

### 4.3 Order total

```
total = subtotal − discountAmount
```

Because `discountAmount ≤ subtotal`, `total` is always **≥ 0**.

### 4.4 Rounding

All three monetary values (`subtotal`, `discountAmount`, `total`) are rounded
independently to 2 decimal places before being stored and returned.

---

## 5. Error accumulation behaviour

- OR-1 (empty items) short-circuits immediately — no item rules run.
- All item rules run for every item in the array.
- Within a single item, IT-3 and IT-5 block their corresponding range checks
  (IT-4, IT-6) to avoid confusing double errors on the same field.
- All other field rules within an item are independent and may fire together
  (e.g. IT-1 and IT-4 can both appear for the same item).
- Errors are ordered: item 0 errors appear before item 1 errors, etc.

---

## 6. Cross-reference: user stories ↔ rules

| User story | Rules exercised |
|---|---|
| US-01 | OR-1 (absent), IT-1–IT-6 (absent) |
| US-02, US-03 | PC-4, PC-5 |
| US-04 | PC-2 |
| US-05 | PC-3 |
| US-06 | 4.2 clamp |
| US-08 | OR-1 |
| US-09 | IT-4 |
| US-10 | IT-6 (boundaries) |
| US-11 | IT-5 |
| US-12 | IT-1, IT-2 |
| US-13 | IT-1–IT-6 (multiple items) |
