// Every calculator returns either a result with its worked steps and checks, or a plain-words error.

export type Check = { level: 'ok' | 'warn' | 'fail'; text: string };
export type Step = { label: string; working: string };

export type Calc<T> = { ok: true; value: T; steps: Step[]; checks: Check[] } | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function positive(name: string, v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return `Enter the ${name}.`;
  if (v <= 0) return `The ${name} must be more than zero.`;
  return null;
}
