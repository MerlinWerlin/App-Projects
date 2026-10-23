// Step indicator logic (T83, docs/MARKET.md "Design reference 18 Oct" §3): which dots are done / current / to do,
// which connecting segments are filled, and the numbers for the spoken "Step 2 of 3: Outline". No RN imports.

export type StepState = 'done' | 'current' | 'todo';

/** The photo flow, in order: Pick image → Outline → Trace. Ids map to the 'common.steps.<id>' catalogue keys. */
export const PHOTO_FLOW = ['pick', 'outline', 'trace'] as const;
export type PhotoFlowStep = (typeof PHOTO_FLOW)[number];

/** Current step index clamped into 0..count-1 (0 for an empty or invalid flow). */
export function clampStep(current: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (!Number.isFinite(current)) return 0;
  return Math.min(Math.floor(count) - 1, Math.max(0, Math.round(current)));
}

/** State of every step: before the current one is done, the current one is current, the rest are to do. */
export function stepStates(count: number, current: number): StepState[] {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const cur = clampStep(current, n);
  const out: StepState[] = [];
  for (let i = 0; i < n; i++) out.push(i < cur ? 'done' : i === cur ? 'current' : 'todo');
  return out;
}

/** True when the connecting line from step `from` to step `from + 1` is filled (we have moved past `from`). */
export function segmentFilled(from: number, current: number, count: number): boolean {
  if (!Number.isFinite(from) || from < 0 || from >= count - 1) return false;
  return from < clampStep(current, count);
}

/** 1-based numbers for the spoken label ('common.steps.a11y': "Step {current} of {total}: {label}"). */
export function stepLabelParams(count: number, current: number): { current: number; total: number; index: number } {
  const total = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const index = clampStep(current, total);
  return { current: total ? index + 1 : 0, total, index };
}
