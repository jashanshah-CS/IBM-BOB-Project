import { describe, it, expect } from 'vitest';
import { calculateSubtotal, calculateDiscount, calculateOrderTotals } from '../../src/orders/calculator.js';

describe('calculateSubtotal', () => {
  it('sums price × quantity for a single item', () => {
    const result = calculateSubtotal([{ productId: 'p1', name: 'Widget', unitPrice: 10, quantity: 3 }]);
    expect(result).toBe(30);
  });

  it('sums multiple items', () => {
    const result = calculateSubtotal([
      { productId: 'p1', name: 'Widget', unitPrice: 10, quantity: 2 },
      { productId: 'p2', name: 'Gadget', unitPrice: 5, quantity: 4 },
    ]);
    expect(result).toBe(40);
  });
});

describe('calculateDiscount', () => {
  it('returns 0 for 0% discount', () => {
    expect(calculateDiscount(100, 0)).toBe(0);
  });

  it('calculates 10% of subtotal', () => {
    expect(calculateDiscount(200, 10)).toBe(20);
  });
});

describe('calculateOrderTotals', () => {
  it('applies a valid promo code', () => {
    const items = [{ productId: 'p1', name: 'Widget', unitPrice: 100, quantity: 1 }];
    const totals = calculateOrderTotals(items, 'SAVE10');
    expect(totals.subtotal).toBe(100);
    expect(totals.discountAmount).toBe(10);
    expect(totals.total).toBe(90);
  });

  it('applies no discount for unknown promo code', () => {
    const items = [{ productId: 'p1', name: 'Widget', unitPrice: 50, quantity: 2 }];
    const totals = calculateOrderTotals(items, 'NOTREAL');
    expect(totals.total).toBe(100);
    expect(totals.discountAmount).toBe(0);
  });

  it('applies no discount when no promo code given', () => {
    const items = [{ productId: 'p1', name: 'Widget', unitPrice: 25, quantity: 4 }];
    const totals = calculateOrderTotals(items);
    expect(totals.total).toBe(100);
    expect(totals.discountAmount).toBe(0);
  });
});
