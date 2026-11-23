/** Shared result shape for every calculator: a value, the working shown to the person, and notes. */
export interface Step {
  /** What this line works out, e.g. "Slab volume". */
  label: string;
  /** The arithmetic with numbers in, e.g. "6.000 m × 4.000 m × 0.100 m". */
  working: string;
  /** The answer of this line, e.g. "2.400 m³". */
  result: string;
}

export type Errors = Record<string, string>;

export type Calc<T> =
  | { ok: true; value: T; steps: Step[]; notes: string[] }
  | { ok: false; errors: Errors };

export function ok<T>(value: T, steps: Step[], notes: string[] = []): Calc<T> {
  return { ok: true, value, steps, notes };
}

export function fail<T>(errors: Errors): Calc<T> {
  return { ok: false, errors };
}

export interface Rule {
  /** Smallest allowed value. */
  min?: number;
  /** True when min itself is not allowed (strictly greater). Default true for min 0. */
  exclusive?: boolean;
  max?: number;
  int?: boolean;
  label?: string;
}

/**
 * Validates one input and records a plain-words error. Returns the number, or NaN when invalid,
 * so calculators can collect every error before giving up.
 */
export function check(errors: Errors, key: string, v: number | null | undefined, rule: Rule = {}): number {
  const name = rule.label ?? 'This';
  if (v == null || !Number.isFinite(v)) {
    errors[key] = `${name} needs a number.`;
    return NaN;
  }
  const min = rule.min ?? 0;
  const exclusive = rule.exclusive ?? min === 0;
  if (exclusive ? v <= min : v < min) {
    errors[key] = min === 0 && exclusive ? `${name} must be more than 0.` : `${name} must be at least ${min}.`;
    return NaN;
  }
  if (rule.max !== undefined && v > rule.max) {
    errors[key] = `${name} must be ${rule.max} or less.`;
    return NaN;
  }
  if (rule.int && !Number.isInteger(v)) {
    errors[key] = `${name} must be a whole number.`;
    return NaN;
  }
  return v;
}

export const hasErrors = (e: Errors) => Object.keys(e).length > 0;
