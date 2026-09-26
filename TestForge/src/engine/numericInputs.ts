import type { ParameterInfo } from '../types.js';

export function validNumericValue(param: ParameterInfo, decimal = false): number {
  const step = decimal ? 0.5 : 1;
  let minimum = Number.NEGATIVE_INFINITY;
  let maximum = Number.POSITIVE_INFINITY;

  for (const constraint of param.numericConstraints ?? []) {
    if (constraint.operator === '>=') minimum = Math.max(minimum, constraint.value);
    if (constraint.operator === '>') minimum = Math.max(minimum, constraint.value + step);
    if (constraint.operator === '<=') maximum = Math.min(maximum, constraint.value);
    if (constraint.operator === '<') maximum = Math.min(maximum, constraint.value - step);
  }

  let candidate: number;
  if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
    candidate = minimum + (maximum - minimum) / 2;
  } else if (Number.isFinite(minimum)) {
    candidate = minimum + step;
  } else if (Number.isFinite(maximum)) {
    candidate = maximum - step;
  } else {
    candidate = decimal ? 1.5 : 1;
  }

  if (decimal) {
    if (Number.isInteger(candidate)) candidate += 0.5;
    if (candidate > maximum) candidate -= 1;
    return candidate;
  }

  if (param.integerRequired) candidate = Math.ceil(candidate);
  return candidate;
}
