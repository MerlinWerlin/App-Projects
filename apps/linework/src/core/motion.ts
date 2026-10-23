// Motion tokens and small pure helpers for the premium polish (docs/POLISH.md). No React Native imports.

/** Durations in ms. Nothing in the app animates longer than ~350 ms except the 400 ms outline reveal (L4). */
export const duration = { fast: 120, base: 200, slow: 320, reveal: 400 } as const;

/** The one spring preset (React Native Animated.spring config, also valid for reanimated). */
export const spring = { damping: 18, stiffness: 220, mass: 1 } as const;

/** Ease-out cubic bezier control points (x1, y1, x2, y2). */
export const easeOutBezier = [0.22, 1, 0.36, 1] as const;

/** Press-scale for buttons and cards. */
export const pressScale = 0.97;

/** Design v2 (docs/DESIGN_V2.md §5): press scale for v2 components and the selection pop peak (1 → 1.08 → 1). */
export const pressScaleV2 = 0.96;
export const selectPop = { peak: 1.08 } as const;

/** List stagger: per-item delay and the most items that get a staggered entrance. */
export const stagger = { step: 30, maxItems: 8, rise: 8 } as const;

/** Trace focus mode (L1): controls fade out after this long with no touch. */
export const focusIdleMs = 3000;

/** Opacity slider detents (L2), in percent. */
export const opacityDetents = [25, 50, 75, 100] as const;

/**
 * Entrance delay for list item `index` (0-based). Items past `maxItems` appear with the last
 * staggered item so long lists never wait. Returns null when the item should not animate at all.
 */
export function staggerDelay(index: number, step: number = stagger.step, maxItems: number = stagger.maxItems): number | null {
  if (!Number.isFinite(index) || index < 0) return null;
  if (index >= maxItems) return null;
  return Math.round(index) * step;
}

/**
 * Detent crossed when a slider moves from `prev` to `next` percent (inclusive of landing exactly on it).
 * Returns the detent value, or null. Moving both ways counts; the last detent crossed wins.
 */
export function crossedDetent(prev: number, next: number, detents: readonly number[] = opacityDetents): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(next) || prev === next) return null;
  const lo = Math.min(prev, next);
  const hi = Math.max(prev, next);
  let hit: number | null = null;
  for (const d of detents) {
    // exclude the starting value so sitting on a detent and moving away does not tick again
    const inRange = d >= lo && d <= hi && d !== prev;
    if (!inRange) continue;
    if (hit === null) hit = d;
    else hit = next > prev ? Math.max(hit, d) : Math.min(hit, d);
  }
  return hit;
}

/** Integer percent label for the slider bubble, clamped to 0–100. */
export function percentLabel(value01: number): string {
  const v = Number.isFinite(value01) ? Math.min(1, Math.max(0, value01)) : 0;
  return `${Math.round(v * 100)}%`;
}

/**
 * Focus-mode state: should the trace controls be hidden right now?
 * Hidden only when enabled, nothing is held (slider drag), and the last touch is at least `idleMs` ago.
 */
export function focusHidden(opts: { enabled: boolean; holding: boolean; lastTouchAt: number; now: number; idleMs?: number }): boolean {
  const { enabled, holding, lastTouchAt, now, idleMs = focusIdleMs } = opts;
  if (!enabled || holding) return false;
  return now - lastTouchAt >= idleMs;
}
