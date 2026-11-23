/**
 * "Show working" lines. Each step keeps raw numbers with a kind, so the screen can print them in the person's
 * units (mm or inches) without the calculators knowing about display.
 */
export type Kind = 'length' | 'angle' | 'factor' | 'percent' | 'litres' | 'flow' | 'velocity' | 'head' | 'pressure' | 'count' | 'text';

export interface Value {
  kind: Kind;
  n: number;
  /** For kind text. */
  s?: string;
}

export interface Step {
  /** What this line works out ("Travel"). */
  label: string;
  /** The formula in words/symbols ("Offset × 1 ÷ sin 45°"). */
  formula: string;
  /** The numbers fed in, in order, for the substituted line. */
  inputs: Value[];
  /** The result of the line. */
  result: Value;
}

export const L = (n: number): Value => ({ kind: 'length', n });
export const A = (n: number): Value => ({ kind: 'angle', n });
export const F = (n: number): Value => ({ kind: 'factor', n });
export const P = (n: number): Value => ({ kind: 'percent', n });

export type CalcResult<T> = { ok: true; value: T; steps: Step[]; warnings: string[] } | { ok: false; error: string; field?: string };

export const fail = <T>(error: string, field?: string): CalcResult<T> => ({ ok: false, error, field });

export const isPos = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
export const isNonNeg = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Removes floating-point dust such as cos 90° = 6.1e-17. */
export const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);
