// Sketch steps: reveal the overlay from coarse to fine so a drawing can be built up the way artists
// block it in (big shapes first, then details). Pure logic only; the trace screen runs the outline
// pipeline per step for photos and reveals template paths progressively for line-art templates.
// Every tracing tool is free: nothing here may depend on Plus.

export type SketchStepId = 'big' | 'main' | 'details' | 'fine';

export type SketchStep = {
  /** Stable id; the UI shows the catalogue name `trace.steps.name.<id>`. */
  id: SketchStepId;
  /** English short name shown after "Step k of n — " (fallback for the catalogue). */
  name: string;
  /** Outline detail 0..1 (see core/outline OutlineOptions.detail). */
  detail: number;
  /** Outline line thickness in px (see core/outline OutlineOptions.thickness). */
  thickness: number;
  /** Extra smoothing 0..1: high values keep only the big shapes. */
  smooth: number;
};

export const SKETCH_STEPS: readonly SketchStep[] = [
  { id: 'big', name: 'big shapes', detail: 0, thickness: 3, smooth: 0.8 },
  { id: 'main', name: 'main shapes', detail: 0.3, thickness: 2, smooth: 0.35 },
  { id: 'details', name: 'details', detail: 0.6, thickness: 1.5, smooth: 0 },
  { id: 'fine', name: 'fine lines', detail: 0.95, thickness: 1, smooth: 0 },
];

export const STEP_COUNT = SKETCH_STEPS.length;

/** Clamp any number to a valid step index 0..count-1 (NaN -> 0). */
export function clampStep(i: number, count: number = STEP_COUNT): number {
  const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  if (!Number.isFinite(i)) return i === Infinity ? n - 1 : 0;
  return Math.min(n - 1, Math.max(0, Math.floor(i)));
}

export function nextStep(i: number, count: number = STEP_COUNT): number {
  return clampStep(clampStep(i, count) + 1, count);
}

export function prevStep(i: number, count: number = STEP_COUNT): number {
  return clampStep(clampStep(i, count) - 1, count);
}

export function isFirstStep(i: number): boolean {
  return clampStep(i) === 0;
}

export function isLastStep(i: number, count: number = STEP_COUNT): boolean {
  return clampStep(i, count) === Math.max(1, Math.floor(count)) - 1;
}

export function getStep(i: number): SketchStep {
  return SKETCH_STEPS[clampStep(i)];
}

/** English "Step 2 of 4 — main shapes" (the UI builds it from `trace.steps.step`). */
export function stepLabel(i: number): string {
  const k = clampStep(i);
  return `Step ${k + 1} of ${STEP_COUNT} — ${SKETCH_STEPS[k].name}`;
}

export type StepBase = {
  /** Keep the user's light-on-dark choice from Prepare. */
  invert?: boolean;
  /** Clockwise quarter turns the overlay was prepared with. */
  rotateTurns?: number;
  /** Photo kind and background mode chosen on Prepare (outline.ts PhotoKind / BackgroundMode). */
  kind?: 'auto' | 'portrait' | 'pet' | 'object' | 'landscape' | 'drawing';
  background?: 'subject' | 'soft' | 'all';
  /** T54: line engine chosen on Prepare (outline.ts OutlineStyle); steps use the same one. */
  style?: 'classic' | 'sketch' | 'lineart' | 'bold';
};

export type StepOutlineOptions = {
  detail: number;
  thickness: number;
  smooth: number;
  invert: boolean;
  rotateTurns: number;
  kind: NonNullable<StepBase['kind']>;
  background: NonNullable<StepBase['background']>;
  style: NonNullable<StepBase['style']>;
};

/** Outline pipeline options for step i (matches native/outlinePipeline OutlineRunOptions). */
export function stepOutlineOptions(i: number, base: StepBase = {}): StepOutlineOptions {
  const s = getStep(i);
  const t = Number.isFinite(base.rotateTurns) ? Math.round(base.rotateTurns as number) : 0;
  const style = base.style ?? 'classic';
  return {
    detail: s.detail,
    // Bold lines stay bold at every step (the engine's minimum stroke is already thick).
    thickness: style === 'bold' ? Math.max(3, s.thickness * 1.75) : s.thickness,
    smooth: s.smooth,
    invert: !!base.invert,
    rotateTurns: ((t % 4) + 4) % 4,
    kind: base.kind ?? 'auto',
    background: base.background ?? 'soft',
    style,
  };
}

/** Cache key for a generated step image: same source + settings -> same PNG. */
export function stepCacheKey(src: string, i: number, base: StepBase = {}): string {
  const o = stepOutlineOptions(i, base);
  return `${src}|${clampStep(i)}|${o.rotateTurns}|${o.invert ? 1 : 0}|${o.kind}|${o.background}|${o.style}`;
}

// ---- Templates: reveal paths from biggest to smallest.

/** Bounding box of an absolute-command SVG path (M L H V C S Q T A Z). Null if no points. */
export function pathBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const tokens = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let cmd = '';
  let nums: number[] = [];
  let curX = 0;
  let curY = 0;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    curX = x;
    curY = y;
  };
  const flush = () => {
    const c = cmd.toUpperCase();
    if (c === 'H') for (const x of nums) add(x, curY);
    else if (c === 'V') for (const y of nums) add(curX, y);
    else if (c === 'A') for (let k = 0; k + 6 < nums.length; k += 7) add(nums[k + 5], nums[k + 6]);
    else if (c && c !== 'Z') for (let k = 0; k + 1 < nums.length; k += 2) add(nums[k], nums[k + 1]);
    nums = [];
  };
  for (const tok of tokens) {
    if (/^[A-Za-z]$/.test(tok)) {
      flush();
      cmd = tok;
    } else {
      nums.push(Number(tok));
    }
  }
  flush();
  return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null;
}

/** Size of a path: the diagonal of its bounding box (0 when it has no points). */
export function pathExtent(d: string): number {
  const b = pathBounds(d);
  return b ? Math.hypot(b.maxX - b.minX, b.maxY - b.minY) : 0;
}

/** How many of `total` items show at step i of `count` (always at least 1, all at the last step). */
export function revealCount(total: number, i: number, count: number = STEP_COUNT): number {
  const t = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  if (t === 0) return 0;
  const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  const k = clampStep(i, n);
  return Math.max(1, Math.min(t, Math.ceil((t * (k + 1)) / n)));
}

/**
 * Paths visible at step i: the largest paths first (outline before details), returned in their
 * original order so drawing order is unchanged. Ties keep original order.
 */
export function revealPaths(paths: readonly string[], i: number, count: number = STEP_COUNT): string[] {
  const shown = revealCount(paths.length, i, count);
  if (shown >= paths.length) return paths.slice();
  const ranked = paths
    .map((d, idx) => ({ idx, size: pathExtent(d) }))
    .sort((a, b) => b.size - a.size || a.idx - b.idx)
    .slice(0, shown)
    .map((r) => r.idx)
    .sort((a, b) => a - b);
  return ranked.map((idx) => paths[idx]);
}
