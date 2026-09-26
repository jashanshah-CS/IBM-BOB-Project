/**
 * Quantity validator.
 * Rules are documented in docs/quantity-rules.md.
 */

export interface QuantityValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a quantity value against the rules in docs/quantity-rules.md.
 *
 * @param quantity - The value to validate.
 * @returns QuantityValidationResult
 */
export function validateQuantity(
  quantity: unknown,
): QuantityValidationResult {
  // QR-2: null / undefined
  if (quantity === null || quantity === undefined) {
    return { valid: false, error: 'quantity is required' };
  }

  // QR-3: type check
  if (typeof quantity !== 'number') {
    return { valid: false, error: 'quantity must be a number' };
  }

  // QR-4: NaN
  if (isNaN(quantity)) {
    return { valid: false, error: 'quantity must be a number' };
  }

  // QR-5: finiteness
  if (!isFinite(quantity)) {
    return { valid: false, error: 'quantity must be a finite number' };
  }

  // QR-6: integer
  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'quantity must be an integer' };
  }

  // QR-7: minimum
  if (quantity < 1) {
    return { valid: false, error: 'quantity must be at least 1' };
  }

  // QR-8: maximum
  if (quantity > 100) {
    return { valid: false, error: 'quantity must not exceed 100' };
  }

  return { valid: true };
}
