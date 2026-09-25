/**
 * Example: a simple maths utility file.
 * Point TestForge at this file to see symbol extraction and test generation in action.
 *
 *   POST /api/analyse
 *   { "filePaths": ["examples/mathUtils.ts"] }
 */

/** Adds two numbers together. */
export function add(a: number, b: number): number {
  return a + b;
}

/** Subtracts b from a. */
export function subtract(a: number, b: number): number {
  return a - b;
}

/** Multiplies two numbers. Throws when either operand is NaN. */
export function multiply(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new RangeError('Operands must not be NaN');
  }
  return a * b;
}

/** Divides a by b. Throws on division by zero. */
export function divide(a: number, b: number): number {
  if (b === 0) throw new RangeError('Division by zero');
  return a / b;
}

/** Clamps a value within [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Formats a list of strings with an Oxford comma. */
export function oxfordJoin(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
