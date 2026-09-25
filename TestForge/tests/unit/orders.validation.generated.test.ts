import { describe, it, expect } from 'vitest';
import {
  validateItem,
  validateOrder,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from '../../src/orders/validation.js';
import { findPromoCode } from '../../src/orders/promoCodes.js';
import {
  calculateSubtotal,
  calculateDiscount,
  calculateOrderTotals,
} from '../../src/orders/calculator.js';
import type { OrderItem } from '../../src/orders/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  productId: 'P1',
  name: 'Widget',
  unitPrice: 10,
  quantity: 1,
  ...overrides,
});

// ===========================================================================
// validation.ts — validateItem
// ===========================================================================

describe('validateItem — productId (IT-1)', () => {
  // [CONFIRMED] validation-rules.md§IT-1
  it('EC-01 rejects whitespace-only productId', () => {
    const errors = validateItem(item({ productId: '   ' }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].productId',
      message: 'productId is required',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-1
  it('rejects empty-string productId', () => {
    const errors = validateItem(item({ productId: '' }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].productId',
      message: 'productId is required',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-1
  it('accepts a non-empty productId', () => {
    const errors = validateItem(item({ productId: 'ABC' }), 0);
    expect(errors.filter(e => e.field === 'items[0].productId')).toHaveLength(0);
  });
});

describe('validateItem — name (IT-2)', () => {
  // [CONFIRMED] validation-rules.md§IT-2
  it('EC-02 rejects whitespace-only name', () => {
    const errors = validateItem(item({ name: '   ' }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].name',
      message: 'name is required',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-2
  it('rejects empty-string name', () => {
    const errors = validateItem(item({ name: '' }), 0);
    expect(errors).toContainEqual({ field: 'items[0].name', message: 'name is required' });
  });
});

describe('validateItem — unitPrice (IT-3 / IT-4)', () => {
  // [CONFIRMED] validation-rules.md§IT-3
  it('EC-03 rejects NaN unitPrice', () => {
    const errors = validateItem(item({ unitPrice: NaN }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].unitPrice',
      message: 'unitPrice must be a number',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-3
  it('EC-04 rejects string unitPrice (runtime type violation)', () => {
    const errors = validateItem(item({ unitPrice: 'ten' as unknown as number }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].unitPrice',
      message: 'unitPrice must be a number',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-4
  it('EC-05 rejects negative unitPrice (-0.01)', () => {
    const errors = validateItem(item({ unitPrice: -0.01 }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].unitPrice',
      message: 'unitPrice cannot be negative',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-3 note: zero is valid
  it('EC-06 accepts unitPrice of exactly 0 (zero-price item)', () => {
    const errors = validateItem(item({ unitPrice: 0 }), 0);
    expect(errors.filter(e => e.field === 'items[0].unitPrice')).toHaveLength(0);
  });

  // [CONFIRMED] validation-rules.md§IT-3: IT-3 and IT-4 are mutually exclusive
  it('does not produce an IT-4 error when IT-3 fires (NaN)', () => {
    const errors = validateItem(item({ unitPrice: NaN }), 0);
    const priceErrors = errors.filter(e => e.field === 'items[0].unitPrice');
    expect(priceErrors).toHaveLength(1);
    expect(priceErrors[0]?.message).toBe('unitPrice must be a number');
  });
});

describe('validateItem — quantity (IT-5 / IT-6)', () => {
  // [CONFIRMED] validation-rules.md§IT-6 boundary table
  it('EC-07 rejects quantity=0 (below minimum)', () => {
    const errors = validateItem(item({ quantity: 0 }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].quantity',
      message: `quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`,
    });
  });

  // [CONFIRMED] validation-rules.md§IT-6 boundary table
  it('EC-08 accepts quantity=1 (lower boundary)', () => {
    const errors = validateItem(item({ quantity: 1 }), 0);
    expect(errors.filter(e => e.field === 'items[0].quantity')).toHaveLength(0);
  });

  // [CONFIRMED] validation-rules.md§IT-6 boundary table
  it('EC-09 accepts quantity=100 (upper boundary)', () => {
    const errors = validateItem(item({ quantity: 100 }), 0);
    expect(errors.filter(e => e.field === 'items[0].quantity')).toHaveLength(0);
  });

  // [CONFIRMED] validation-rules.md§IT-6 boundary table
  it('EC-10 rejects quantity=101 (above maximum)', () => {
    const errors = validateItem(item({ quantity: 101 }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].quantity',
      message: `quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`,
    });
  });

  // [CONFIRMED] validation-rules.md§IT-5 / user-stories.md§US-11
  it('EC-11 rejects float quantity 1.5', () => {
    const errors = validateItem(item({ quantity: 1.5 }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].quantity',
      message: 'quantity must be an integer',
    });
  });

  // [CONFIRMED] validation-rules.md§IT-6
  it('EC-12 rejects negative quantity -1', () => {
    const errors = validateItem(item({ quantity: -1 }), 0);
    expect(errors).toContainEqual({
      field: 'items[0].quantity',
      message: `quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`,
    });
  });

  // [CONFIRMED] validation-rules.md§IT-5: IT-5 and IT-6 are mutually exclusive
  it('does not produce an IT-6 error when IT-5 fires (float)', () => {
    const errors = validateItem(item({ quantity: 1.5 }), 0);
    const qErrors = errors.filter(e => e.field === 'items[0].quantity');
    expect(qErrors).toHaveLength(1);
    expect(qErrors[0]?.message).toBe('quantity must be an integer');
  });
});

describe('validateItem — multi-field accumulation', () => {
  // [CONFIRMED] validation-rules.md§IT-3 + IT-6
  it('EC-13 collects both unitPrice and quantity errors on same item', () => {
    const errors = validateItem(item({ unitPrice: -5, quantity: 0 }), 0);
    const fields = errors.map(e => e.field);
    expect(fields).toContain('items[0].unitPrice');
    expect(fields).toContain('items[0].quantity');
  });

  // [CONFIRMED] validation-rules.md§IT-1 + IT-2 + IT-3 + IT-6
  it('EC-14 item with all invalid fields produces four errors', () => {
    const errors = validateItem(
      { productId: '', name: '', unitPrice: NaN, quantity: 0 },
      0,
    );
    expect(errors).toHaveLength(4);
  });

  // [INFERRED] validation.ts:16 — index prefix is applied per-item
  it('uses correct index prefix for item at index 2', () => {
    const errors = validateItem(item({ productId: '' }), 2);
    expect(errors[0]?.field).toBe('items[2].productId');
  });
});

// ===========================================================================
// validation.ts — validateOrder
// ===========================================================================

describe('validateOrder — order-level (OR-1)', () => {
  // [CONFIRMED] validation-rules.md§OR-1
  it('EC-15 rejects null items (short-circuit)', () => {
    const result = validateOrder(null as unknown as OrderItem[]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: 'items',
      message: 'Order must contain at least one item',
    });
  });

  // [CONFIRMED] validation-rules.md§OR-1
  it('EC-16 rejects empty array (short-circuit)', () => {
    const result = validateOrder([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.field).toBe('items');
    expect(result.errors).toHaveLength(1); // no item-level errors produced
  });

  // [CONFIRMED] validation-rules.md§OR-1 short-circuit note
  it('does not produce item-level errors when items array is empty', () => {
    const result = validateOrder([]);
    expect(result.errors).toHaveLength(1);
  });

  // [CONFIRMED] validation-rules.md§2 items section
  it('returns valid:true for a single well-formed item', () => {
    const result = validateOrder([item()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateOrder — multi-item error accumulation (US-13)', () => {
  // [INFERRED] validation.ts:56-58
  it('EC-17 first item valid, second item invalid — errors reference items[1]', () => {
    const result = validateOrder([
      item(),
      item({ productId: '', name: '', unitPrice: -1, quantity: 0 }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.every(e => e.field.startsWith('items[1]'))).toBe(true);
  });

  // [INFERRED] validation.ts:56-58
  it('EC-18 errors from two items are both collected', () => {
    const result = validateOrder([
      item({ productId: '' }),
      item({ name: '' }),
    ]);
    expect(result.valid).toBe(false);
    const fields = result.errors.map(e => e.field);
    expect(fields).toContain('items[0].productId');
    expect(fields).toContain('items[1].name');
  });

  // [CONFIRMED] validation-rules.md§5 error accumulation: item 0 before item 1
  it('errors appear in index order (item 0 before item 1)', () => {
    const result = validateOrder([
      item({ productId: '' }),
      item({ name: '' }),
    ]);
    const firstField = result.errors[0]?.field ?? '';
    expect(firstField).toMatch(/^items\[0\]/);
  });
});

// ===========================================================================
// promoCodes.ts — findPromoCode
// ===========================================================================

describe('findPromoCode — null / empty inputs (PC-1)', () => {
  // [CONFIRMED] validation-rules.md§PC-1
  it('EC-19 returns null for empty string', () => {
    expect(findPromoCode('')).toBeNull();
  });

  // [INFERRED] promoCodes.ts:36
  it('EC-20 returns null for whitespace-only string', () => {
    expect(findPromoCode('   ')).toBeNull();
  });
});

describe('findPromoCode — case-insensitivity (PC-5)', () => {
  // [INFERRED] promoCodes.ts:39 toUpperCase normalisation
  it('EC-21 lowercase "save10" resolves to SAVE10 with 10% discount', () => {
    const promo = findPromoCode('save10');
    expect(promo).not.toBeNull();
    expect(promo?.discountPercent).toBe(10);
  });

  // [INFERRED] promoCodes.ts:39
  it('EC-22 mixed-case "Save10" resolves to SAVE10', () => {
    const promo = findPromoCode('Save10');
    expect(promo?.discountPercent).toBe(10);
  });
});

describe('findPromoCode — whitespace trimming (PC-6)', () => {
  // [INFERRED] promoCodes.ts:39 (trim before compare)
  it('EC-26 trims leading/trailing spaces before lookup', () => {
    const promo = findPromoCode('  SAVE10  ');
    expect(promo).not.toBeNull();
    expect(promo?.code).toBe('SAVE10');
  });
});

describe('findPromoCode — active codes (PC-4)', () => {
  // [CONFIRMED] api-specification.md promo table
  it('EC-23 HALF50 returns 50% discount', () => {
    const promo = findPromoCode('HALF50');
    expect(promo?.discountPercent).toBe(50);
  });

  // [CONFIRMED] api-specification.md promo table
  it('EC-24 FREESHIP returns 5% discount', () => {
    const promo = findPromoCode('FREESHIP');
    expect(promo?.discountPercent).toBe(5);
  });

  // [CONFIRMED] api-specification.md promo table
  it('SAVE10 returns 10% discount', () => {
    expect(findPromoCode('SAVE10')?.discountPercent).toBe(10);
  });
});

describe('findPromoCode — expired and unknown codes (PC-2, PC-3)', () => {
  // [CONFIRMED] validation-rules.md§PC-3
  it('EC-25 EXPIRED20 returns null (expired)', () => {
    expect(findPromoCode('EXPIRED20')).toBeNull();
  });

  // [CONFIRMED] validation-rules.md§PC-2
  it('EC-27 completely unknown code returns null', () => {
    expect(findPromoCode('DOESNOTEXIST')).toBeNull();
  });
});

// ===========================================================================
// calculator.ts — calculateSubtotal
// ===========================================================================

describe('calculateSubtotal — boundaries and rounding', () => {
  // [INFERRED] calculator.ts:9
  it('EC-28 returns 0 for zero-price item', () => {
    expect(calculateSubtotal([item({ unitPrice: 0, quantity: 5 })])).toBe(0);
  });

  // [INFERRED] calculator.ts:9
  it('EC-29 handles quantity=100 (upper boundary) correctly', () => {
    expect(calculateSubtotal([item({ unitPrice: 9.99, quantity: 100 })])).toBe(999);
  });

  // [INFERRED] calculator.ts:9 — rounding applied at totals level
  it('EC-30 floating-point accumulation is rounded to 2 d.p. at totals stage', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in raw JS; round2 must fix it
    const totals = calculateOrderTotals([
      item({ unitPrice: 0.1, quantity: 1 }),
      item({ unitPrice: 0.2, quantity: 1 }),
    ]);
    expect(totals.subtotal).toBe(0.3);
  });
});

// ===========================================================================
// calculator.ts — calculateDiscount
// ===========================================================================

describe('calculateDiscount — clamp guarantees non-negative total (rule 4.3)', () => {
  // [CONFIRMED] validation-rules.md§4.3
  it('EC-31 100% discount equals exactly the subtotal (total would be 0)', () => {
    expect(calculateDiscount(50, 100)).toBe(50);
  });

  // [CONFIRMED] validation-rules.md§4.3
  it('EC-32 150% discount is clamped to subtotal, not 75', () => {
    expect(calculateDiscount(50, 150)).toBe(50);
  });

  // [INFERRED] calculator.ts:17 — the zero-guard branch
  it('EC-33 0% discount returns 0', () => {
    expect(calculateDiscount(100, 0)).toBe(0);
  });

  // [INFERRED] calculator.ts:17 — negative percent treated same as 0
  it('EC-34 negative discountPercent returns 0', () => {
    expect(calculateDiscount(100, -10)).toBe(0);
  });
});

// ===========================================================================
// calculator.ts — calculateOrderTotals
// ===========================================================================

describe('calculateOrderTotals — all active promo codes', () => {
  const baseItem = [item({ unitPrice: 100, quantity: 1 })];

  // [CONFIRMED] api-specification.md promo table
  it('EC-35 HALF50 gives 50% discount', () => {
    const totals = calculateOrderTotals(baseItem, 'HALF50');
    expect(totals).toEqual({ subtotal: 100, discountAmount: 50, total: 50 });
  });

  // [CONFIRMED] api-specification.md promo table
  it('EC-36 FREESHIP gives 5% discount', () => {
    const totals = calculateOrderTotals([item({ unitPrice: 200, quantity: 1 })], 'FREESHIP');
    expect(totals).toEqual({ subtotal: 200, discountAmount: 10, total: 190 });
  });

  // [CONFIRMED] validation-rules.md§PC-3
  it('EC-37 EXPIRED20 applies zero discount (expired code silently ignored)', () => {
    const totals = calculateOrderTotals(baseItem, 'EXPIRED20');
    expect(totals).toEqual({ subtotal: 100, discountAmount: 0, total: 100 });
  });

  // [INFERRED] calculator.ts:31 — empty string is falsy, skips promo lookup
  it('EC-38 empty promoCode string applies no discount', () => {
    const totals = calculateOrderTotals([item({ unitPrice: 50, quantity: 2 })], '');
    expect(totals).toEqual({ subtotal: 100, discountAmount: 0, total: 100 });
  });
});
