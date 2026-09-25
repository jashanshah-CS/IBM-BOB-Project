import { findPromoCode } from './promoCodes.js';
import type { OrderItem, OrderTotals } from './types.js';

// ---------------------------------------------------------------------------
// Subtotal: sum of (unitPrice × quantity) for all items
// ---------------------------------------------------------------------------

export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

// ---------------------------------------------------------------------------
// Discount: percentage off the subtotal, clamped so total >= 0
// ---------------------------------------------------------------------------

export function calculateDiscount(subtotal: number, discountPercent: number): number {
  if (discountPercent <= 0) return 0;
  const raw = (subtotal * discountPercent) / 100;
  // Discount cannot exceed the subtotal (total must not go negative)
  return Math.min(raw, subtotal);
}

// ---------------------------------------------------------------------------
// Full order totals, including optional promo-code resolution
// ---------------------------------------------------------------------------

export function calculateOrderTotals(items: OrderItem[], promoCode?: string): OrderTotals {
  const subtotal = calculateSubtotal(items);

  let discountPercent = 0;
  if (promoCode) {
    const promo = findPromoCode(promoCode);
    discountPercent = promo ? promo.discountPercent : 0;
  }

  const discountAmount = calculateDiscount(subtotal, discountPercent);
  const total = subtotal - discountAmount;

  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    total: round2(total),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
