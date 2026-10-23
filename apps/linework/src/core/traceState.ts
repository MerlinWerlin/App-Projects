// Trace screen toggles as a pure reducer: opacity, lock, torch, grid, mirror, touch-lock.
// Every tracing tool is free: nothing here (or on the trace screen) may depend on Plus.
import { gridPreset, nextGridPreset, type GridPresetId } from './grid.ts';

export type TraceState = {
  /** overlay opacity, 0.05..1 */
  opacity: number;
  /** overlay position locked (gestures ignored) */
  locked: boolean;
  torch: boolean;
  gridPreset: GridPresetId;
  /** overlay flipped horizontally */
  mirror: boolean;
  /** whole screen ignores taps until a long-press */
  touchLocked: boolean;
};

export type TraceAction =
  | { type: 'setOpacity'; value: number }
  | { type: 'nudgeOpacity'; delta: number }
  | { type: 'toggleLock' }
  | { type: 'setLocked'; value: boolean }
  | { type: 'toggleTorch' }
  | { type: 'setTorch'; value: boolean }
  | { type: 'cycleGrid' }
  | { type: 'setGrid'; value: string }
  | { type: 'toggleMirror' }
  | { type: 'toggleTouchLock' }
  | { type: 'setTouchLock'; value: boolean }
  | { type: 'reset' };

export const MIN_OPACITY = 0.05;
export const MAX_OPACITY = 1;
export const DEFAULT_OPACITY = 0.5;
export const OPACITY_STEP = 0.05;

export function clampOpacity(v: number): number {
  if (!Number.isFinite(v)) return v === Infinity ? MAX_OPACITY : v === -Infinity ? MIN_OPACITY : DEFAULT_OPACITY;
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, v));
}

export function initialTraceState(opts: { opacity?: number; grid?: string } = {}): TraceState {
  return {
    opacity: clampOpacity(opts.opacity ?? DEFAULT_OPACITY),
    locked: false,
    torch: false,
    gridPreset: gridPreset(opts.grid ?? 'off').id,
    mirror: false,
    touchLocked: false,
  };
}

export function traceReducer(state: TraceState, action: TraceAction): TraceState {
  switch (action.type) {
    case 'setOpacity': {
      const opacity = clampOpacity(action.value);
      return opacity === state.opacity ? state : { ...state, opacity };
    }
    case 'nudgeOpacity': {
      if (!Number.isFinite(action.delta)) return state;
      // Round to avoid 0.1 + 0.2 drift when stepping with accessibility actions.
      const opacity = clampOpacity(Math.round((state.opacity + action.delta) * 1000) / 1000);
      return opacity === state.opacity ? state : { ...state, opacity };
    }
    case 'toggleLock':
      return { ...state, locked: !state.locked };
    case 'setLocked':
      return state.locked === action.value ? state : { ...state, locked: action.value };
    case 'toggleTorch':
      return { ...state, torch: !state.torch };
    case 'setTorch':
      return state.torch === action.value ? state : { ...state, torch: action.value };
    case 'cycleGrid':
      return { ...state, gridPreset: nextGridPreset(state.gridPreset).id };
    case 'setGrid':
      return { ...state, gridPreset: gridPreset(action.value).id };
    case 'toggleMirror':
      // Matches core/transform toggleMirror: no flipping while the position is locked.
      return state.locked ? state : { ...state, mirror: !state.mirror };
    case 'toggleTouchLock':
      return { ...state, touchLocked: !state.touchLocked };
    case 'setTouchLock':
      return state.touchLocked === action.value ? state : { ...state, touchLocked: action.value };
    case 'reset':
      // Reset fit: unlock and un-mirror; opacity, torch and grid are viewing aids and stay.
      return { ...state, locked: false, mirror: false };
    default:
      return state;
  }
}

/**
 * T64 steady camera: CameraView `autofocus` value. Focus is held ('off') only while the overlay is locked and the
 * Focus lock setting is on, so a hand moving into view does not make the camera refocus and the paper blur.
 */
export function cameraAutofocus(locked: boolean, focusLock: boolean): 'on' | 'off' {
  return locked === true && focusLock === true ? 'off' : 'on';
}

/** Human label for the grid button, e.g. "Grid off", "Grid 3×3". */
export function gridLabel(id: GridPresetId): string {
  const p = gridPreset(id);
  return p.id === 'off' ? 'Grid off' : `Grid ${p.cols}×${p.rows}`;
}

/** Short caption under the grid button: "Grid" when off, else the preset ("3×3"). */
export function gridCaption(id: GridPresetId): string {
  const p = gridPreset(id);
  return p.id === 'off' ? 'Grid' : `${p.cols}×${p.rows}`;
}

// ---- English reference copy for the trace / lightbox controls. The screens show the catalogue versions
// (src/i18n/en/trace.ts, keys trace.lock.*, trace.touchLock.*, trace.grid.*, trace.hint); keep the two in step.

/** How long a press-and-hold must last to leave touch lock. */
export const TOUCH_LOCK_HOLD_MS = 1000;

export const TRACE_COPY = {
  locked: 'Image locked in place — pinch and drag are off so it won’t move while you draw',
  unlocked: 'Image unlocked — you can move it again',
  touchLockTitle: 'Touch lock',
  touchLockIntro:
    'Touch lock ignores taps so your hand can rest on the screen. To exit, press and hold anywhere for 1 second.',
  touchLockBanner: 'Touch lock on — press and hold anywhere for 1 second to exit',
  touchLockHolding: 'Keep holding to exit touch lock…',
  touchLockOff: 'Touch lock off — the buttons work again',
  hint: 'Pinch to size, two fingers to rotate. When it lines up, tap Lock so it stays put. Touch lock lets your hand rest on the screen.',
} as const;

/** Toast text after the image lock is toggled to `locked`. */
export function lockToast(locked: boolean): string {
  return locked ? TRACE_COPY.locked : TRACE_COPY.unlocked;
}

/** Auto-hide delay for a toast: long enough to read (~45 ms per character), 1.6 s to 6 s. */
export function toastDuration(text: string): number {
  const n = typeof text === 'string' ? text.length : 0;
  return Math.min(6000, Math.max(1600, 1000 + n * 45));
}

/**
 * Size (points) at which an image of natural size imgW×imgH is drawn so it fits inside viewW×viewH × margin,
 * keeping aspect. The overlay is rendered at this base size and transformed from identity().
 * Bad inputs fall back to a square 1000×1000 image and/or a 0×0 view.
 */
export function baseSize(
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number,
  margin = 0.9,
): { width: number; height: number } {
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  const iw = ok(imgW) && ok(imgH) ? imgW : 1000;
  const ih = ok(imgW) && ok(imgH) ? imgH : 1000;
  if (!ok(viewW) || !ok(viewH)) return { width: 0, height: 0 };
  const m = ok(margin) ? margin : 0.9;
  const k = Math.min(viewW / iw, viewH / ih) * m;
  return { width: iw * k, height: ih * k };
}

/** Convert a point relative to the view's top-left into view-centre coordinates (what core/transform expects). */
export function toCentre(x: number, y: number, viewW: number, viewH: number): { x: number; y: number } {
  return { x: x - viewW / 2, y: y - viewH / 2 };
}

/** Parse a positive numeric route param ("1024") or return undefined. */
export function parseDim(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string' || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
