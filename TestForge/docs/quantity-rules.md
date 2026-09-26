# Quantity Validation Rules

This document defines every rule enforced by `validateQuantity()` in
`examples/quantityValidator.ts`.

---

## Valid range

| Rule | Condition | Result |
|---|---|---|
| QR-1 | `1 ≤ quantity ≤ 100` and value is a finite integer | **valid** |

---

## Invalid conditions

| Rule | Condition | Error message |
|---|---|---|
| QR-2 | `quantity` is `null` or `undefined` | `"quantity is required"` |
| QR-3 | `typeof quantity !== "number"` | `"quantity must be a number"` |
| QR-4 | `isNaN(quantity)` | `"quantity must be a number"` |
| QR-5 | `!isFinite(quantity)` (Infinity, -Infinity) | `"quantity must be a finite number"` |
| QR-6 | `!Number.isInteger(quantity)` (e.g. 1.5) | `"quantity must be an integer"` |
| QR-7 | `quantity < 1` (includes 0 and negative values) | `"quantity must be at least 1"` |
| QR-8 | `quantity > 100` | `"quantity must not exceed 100"` |

---

## Rule precedence (checked in order)

1. QR-2 null / undefined check
2. QR-3 type check
3. QR-4 NaN check
4. QR-5 finiteness check
5. QR-6 integer check
6. QR-7 minimum check
7. QR-8 maximum check

Only the **first matching rule** produces an error. Rules are mutually
exclusive for any single input.

---

## Return shape

```ts
interface ValidationResult {
  valid: boolean;
  error?: string;   // present only when valid === false
}
```

---

## Boundary values

| Input | Valid? | Rule |
|---|---|---|
| `1` | ✅ | QR-1 (lower boundary) |
| `50` | ✅ | QR-1 (midpoint) |
| `100` | ✅ | QR-1 (upper boundary) |
| `0` | ❌ | QR-7 |
| `101` | ❌ | QR-8 |
| `-1` | ❌ | QR-7 |
| `1.5` | ❌ | QR-6 |
| `NaN` | ❌ | QR-4 |
| `Infinity` | ❌ | QR-5 |
| `-Infinity` | ❌ | QR-5 |
| `undefined` | ❌ | QR-2 |
| `null` | ❌ | QR-2 |
