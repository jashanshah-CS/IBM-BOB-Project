import type { OrderItem, ValidationError, ValidationResult } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 100;

// ---------------------------------------------------------------------------
// Item-level validation
// ---------------------------------------------------------------------------

export function validateItem(item: OrderItem, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `items[${index}]`;

  if (!item.productId || item.productId.trim() === '') {
    errors.push({ field: `${prefix}.productId`, message: 'productId is required' });
  }

  if (!item.name || item.name.trim() === '') {
    errors.push({ field: `${prefix}.name`, message: 'name is required' });
  }

  if (typeof item.unitPrice !== 'number' || isNaN(item.unitPrice)) {
    errors.push({ field: `${prefix}.unitPrice`, message: 'unitPrice must be a number' });
  } else if (item.unitPrice < 0) {
    errors.push({ field: `${prefix}.unitPrice`, message: 'unitPrice cannot be negative' });
  }

  if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity)) {
    errors.push({ field: `${prefix}.quantity`, message: 'quantity must be an integer' });
  } else if (item.quantity < MIN_QUANTITY || item.quantity > MAX_QUANTITY) {
    errors.push({
      field: `${prefix}.quantity`,
      message: `quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`,
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Order-level validation
// ---------------------------------------------------------------------------

export function validateOrder(items: OrderItem[]): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ field: 'items', message: 'Order must contain at least one item' });
    return { valid: false, errors };
  }

  for (let i = 0; i < items.length; i++) {
    errors.push(...validateItem(items[i]!, i));
  }

  return { valid: errors.length === 0, errors };
}
