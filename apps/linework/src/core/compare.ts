// Photo-to-paper check: fade between a snapshot of the paper ("your drawing") and the reference
// overlay drawn with the same transform as on the trace screen. Pure logic only.
// The snapshot lives in the cache folder and is deleted when the compare view closes.

export type CompareMode = 'overlay' | 'side';

export const MIX_MIN = 0;
export const MIX_MAX = 1;
export const MIX_STEP = 0.1;
export const DEFAULT_MIX = 0.5;

/** How far the paper photo fades when only the reference is shown (keeps a faint hint of the paper). */
const PHOTO_FLOOR = 0.15;

/** Mix 0 = only your drawing, 1 = only the reference. NaN -> default. */
export function clampMix(v: number): number {
  if (!Number.isFinite(v)) return v === Infinity ? MIX_MAX : v === -Infinity ? MIX_MIN : DEFAULT_MIX;
  return Math.min(MIX_MAX, Math.max(MIX_MIN, v));
}

/** Step the mix (screen-reader increment / decrement), rounded to avoid float drift. */
export function nudgeMix(v: number, delta: number): number {
  if (!Number.isFinite(delta)) return clampMix(v);
  return clampMix(Math.round((clampMix(v) + delta) * 1000) / 1000);
}

/** Layer opacities for a mix value: the photo dims as the reference fades in. */
export function compareLayers(mix: number): { photo: number; overlay: number } {
  const m = clampMix(mix);
  const photo = Math.round((1 - (1 - PHOTO_FLOOR) * m) * 1000) / 1000;
  return { photo, overlay: m };
}

/** English label for the mix (the UI shows trace.compare.mix* from the catalogue). */
export function mixLabel(mix: number): string {
  const m = clampMix(mix);
  if (m <= 0.001) return 'Your drawing';
  if (m >= 0.999) return 'Reference';
  return `Reference ${Math.round(m * 100)}%`;
}

/** Labels are English fallbacks; the UI shows `trace.compare.preset.<id>`. */
export const MIX_PRESETS: readonly { id: 'drawing' | 'both' | 'reference'; label: string; mix: number }[] = [
  { id: 'drawing', label: 'Show your drawing', mix: 0 },
  { id: 'both', label: 'Show both', mix: 0.5 },
  { id: 'reference', label: 'Show the reference', mix: 1 },
];

export function toggleCompareMode(m: CompareMode): CompareMode {
  return m === 'side' ? 'overlay' : 'side';
}

/** Whether a camera capture result is usable as a snapshot. */
export function isSnapshot(p: unknown): p is { uri: string; width?: number; height?: number } {
  return !!p && typeof p === 'object' && typeof (p as { uri?: unknown }).uri === 'string' && (p as { uri: string }).uri.length > 0;
}
