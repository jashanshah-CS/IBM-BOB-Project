import type { PromoCode } from './types.js';

// ---------------------------------------------------------------------------
// In-memory promo-code catalogue (replace with DB lookup in production)
// ---------------------------------------------------------------------------

export const PROMO_CODES: PromoCode[] = [
  {
    code: 'SAVE10',
    discountPercent: 10,
    expiresAt: new Date('2099-12-31'),
  },
  {
    code: 'HALF50',
    discountPercent: 50,
    expiresAt: new Date('2099-12-31'),
  },
  {
    code: 'FREESHIP',
    discountPercent: 5,
    expiresAt: new Date('2099-12-31'),
  },
  {
    // Expired — should apply no discount
    code: 'EXPIRED20',
    discountPercent: 20,
    expiresAt: new Date('2000-01-01'),
  },
];

// ---------------------------------------------------------------------------
// Look up a promo code.  Returns null when unknown or expired.
// ---------------------------------------------------------------------------

export function findPromoCode(code: string): PromoCode | null {
  if (!code || code.trim() === '') return null;

  const entry = PROMO_CODES.find(
    (p) => p.code.toUpperCase() === code.trim().toUpperCase(),
  );

  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt < new Date()) return null;

  return entry;
}
