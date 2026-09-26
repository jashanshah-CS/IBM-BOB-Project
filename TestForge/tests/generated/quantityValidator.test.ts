import { describe, it, expect } from 'vitest';
import { validateQuantity } from '../../examples/quantityValidator.js';

// ---------------------------------------------------------------------------
// Tests derived from docs/quantity-rules.md.
// Every assertion calls validateQuantity() and inspects the real result.
// ---------------------------------------------------------------------------

describe('validateQuantity — valid inputs (QR-1)', () => {
  it('accepts 1 (lower boundary)', () => {
    const result = validateQuantity(1);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts 50 (midpoint)', () => {
    const result = validateQuantity(50);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts 100 (upper boundary)', () => {
    const result = validateQuantity(100);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe('validateQuantity — null / undefined (QR-2)', () => {
  it('rejects undefined', () => {
    const result = validateQuantity(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity is required');
  });

  it('rejects null', () => {
    const result = validateQuantity(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity is required');
  });
});

describe('validateQuantity — NaN (QR-4)', () => {
  it('rejects NaN', () => {
    const result = validateQuantity(NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must be a number');
  });
});

describe('validateQuantity — infinite values (QR-5)', () => {
  it('rejects Infinity', () => {
    const result = validateQuantity(Infinity);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must be a finite number');
  });

  it('rejects -Infinity', () => {
    const result = validateQuantity(-Infinity);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must be a finite number');
  });
});

describe('validateQuantity — non-integer (QR-6)', () => {
  it('rejects 1.5', () => {
    const result = validateQuantity(1.5);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must be an integer');
  });
});

describe('validateQuantity — below minimum (QR-7)', () => {
  it('rejects 0', () => {
    const result = validateQuantity(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must be at least 1');
  });

  it('rejects -1', () => {
    const result = validateQuantity(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must be at least 1');
  });
});

describe('validateQuantity — above maximum (QR-8)', () => {
  it('rejects 101', () => {
    const result = validateQuantity(101);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('quantity must not exceed 100');
  });
});
