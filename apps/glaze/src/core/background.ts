// Per-theme background choice (T25, owner review §2): each theme's wallpaper is either
// the theme's designed artwork (src/core/wallpaper.ts, unchanged) or the user's own
// photo, cropped to the device (src/core/photoCrop.ts) with an optional overlay in the
// theme's colours. Versioned, sanitised persistence; the store lives in src/store/background.ts.
// Pure TypeScript: no React Native or Expo imports, so Node runs it directly.

import { isHex, normalizeHex, seededRandom } from './colour.ts';
import { clampTransform, DEFAULT_TRANSFORM, type PhotoTransform } from './photoCrop.ts';

export type BackgroundSource = 'theme' | 'photo';

export type PhotoOverlay = {
  /** Strength of a wash in the theme's colour over the photo, 0..MAX_TINT. */
  tint: number;
  /** Fine film grain on top. */
  grain: boolean;
  /** A thin double frame in the theme's colours. */
  border: boolean;
};

export type ThemeBackground = {
  source: BackgroundSource;
  /** Our private copy of the photo (documents folder). Kept when switching back to 'theme'. */
  photoUri?: string;
  imageW?: number;
  imageH?: number;
  transform?: PhotoTransform;
  overlay: PhotoOverlay;
};

/** Theme id → its background choice. Themes not in the map use the theme design. */
export type BackgroundsState = Record<string, ThemeBackground>;

export const BACKGROUNDS_VERSION = 1;
export const MAX_TINT = 0.6;
export const TINT_STEP = 0.1;
export const MAX_THEMES = 200;
const MAX_URI = 2048;
const MAX_IMAGE_SIDE = 100_000;

export const DEFAULT_OVERLAY: PhotoOverlay = Object.freeze({ tint: 0, grain: false, border: false });

export function defaultBackground(): ThemeBackground {
  return { source: 'theme', overlay: { ...DEFAULT_OVERLAY } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function isThemeId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
}

function isPhotoUri(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_URI && /^(file|ph|content|assets-library):/i.test(v);
}

function isSide(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= MAX_IMAGE_SIDE;
}

/** Round to the slider step and clamp (so 0.30000000004 never shows as 31 %). */
export function clampTint(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.round(clamp(n, 0, MAX_TINT) * 100) / 100;
}

export function sanitizeOverlay(v: unknown): PhotoOverlay {
  if (!isObj(v)) return { ...DEFAULT_OVERLAY };
  return { tint: clampTint(v.tint), grain: v.grain === true, border: v.border === true };
}

/**
 * Clean one theme's background. Anything unreadable becomes the theme default; a photo
 * choice without a valid photo (uri + size) falls back to the theme design.
 */
export function sanitizeBackground(v: unknown): ThemeBackground {
  if (!isObj(v)) return defaultBackground();
  const overlay = sanitizeOverlay(v.overlay);
  const hasPhoto = isPhotoUri(v.photoUri) && isSide(v.imageW) && isSide(v.imageH);
  const wantsPhoto = v.source === 'photo';
  if (!hasPhoto) return { source: 'theme', overlay };
  return {
    source: wantsPhoto ? 'photo' : 'theme',
    photoUri: v.photoUri as string,
    imageW: Math.round(v.imageW as number),
    imageH: Math.round(v.imageH as number),
    transform: clampTransform(isObj(v.transform) ? (v.transform as Partial<PhotoTransform>) : DEFAULT_TRANSFORM),
    overlay,
  };
}

function sanitizeMap(v: unknown): BackgroundsState {
  const out: BackgroundsState = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [id, raw] of Object.entries(v)) {
    if (n >= MAX_THEMES) break;
    if (!isThemeId(id)) continue;
    out[id] = sanitizeBackground(raw);
    n += 1;
  }
  return out;
}

/**
 * Parse stored JSON. v1 is `{ v: 1, themes: { [id]: ThemeBackground } }`; an unversioned
 * bare map (pre-release drafts) is migrated; a newer version we can't read, broken JSON
 * or anything else gives an empty state (every theme on its design).
 */
export function parseBackgrounds(raw: string | null | undefined): BackgroundsState {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isObj(data)) return {};
  if ('v' in data) {
    if (data.v !== BACKGROUNDS_VERSION) return {};
    return sanitizeMap(data.themes);
  }
  // Unversioned: a bare { themeId: background } map.
  return sanitizeMap(data);
}

export function serializeBackgrounds(state: BackgroundsState): string {
  return JSON.stringify({ v: BACKGROUNDS_VERSION, themes: sanitizeMap(state) });
}

/** The theme's background, or its default (theme design, no overlay). */
export function backgroundFor(state: BackgroundsState, themeId: string): ThemeBackground {
  const b = isThemeId(themeId) ? state[themeId] : undefined;
  return b ? sanitizeBackground(b) : defaultBackground();
}

/** New state with `themeId` set to `bg` (sanitised). Defaults are dropped to keep storage small. */
export function setBackground(state: BackgroundsState, themeId: string, bg: ThemeBackground): BackgroundsState {
  if (!isThemeId(themeId)) return state;
  const clean = sanitizeBackground(bg);
  const next: BackgroundsState = { ...state };
  const isDefault =
    clean.source === 'theme' && !clean.photoUri && !clean.overlay.tint && !clean.overlay.grain && !clean.overlay.border;
  if (isDefault) delete next[themeId];
  else next[themeId] = clean;
  return next;
}

/** True when this background should draw the photo. */
export function usesPhoto(bg: ThemeBackground): bg is ThemeBackground & {
  source: 'photo';
  photoUri: string;
  imageW: number;
  imageH: number;
} {
  return bg.source === 'photo' && isPhotoUri(bg.photoUri) && isSide(bg.imageW) && isSide(bg.imageH);
}

/** Every photo file any theme still points at (so a replaced copy is only deleted when unused). */
export function referencedPhotoUris(state: BackgroundsState): Set<string> {
  const out = new Set<string>();
  for (const b of Object.values(state)) if (b && typeof b.photoUri === 'string') out.add(b.photoUri);
  return out;
}

/** A photo uri that `prev` used and `next` no longer references anywhere, or null. */
export function orphanedPhoto(prevUri: string | undefined, next: BackgroundsState): string | null {
  if (!prevUri) return null;
  return referencedPhotoUris(next).has(prevUri) ? null : prevUri;
}

/** File name for a new private copy: unique per pick so caches never show the old photo. */
export function photoFileName(themeId: string, stamp: number, sourceUri: string): string {
  const id = isThemeId(themeId) ? themeId : 'theme';
  const ext = (/\.(jpe?g|png|heic|heif|webp|gif)(?:[?#].*)?$/i.exec(sourceUri)?.[1] ?? 'jpg').toLowerCase();
  const n = Math.max(0, Math.floor(Number.isFinite(stamp) ? stamp : 0)).toString(36);
  return `${id}-${n}.${ext}`;
}

// ---------------------------------------------------------------- overlay drawing

export type OverlayPalette = { bg: string; surface: string; accent: string };

export type OverlayLayout = {
  tint: { colour: string; opacity: number } | null;
  /** Two inset rounded rects: an outer line in the accent and an inner hairline in the surface colour. */
  border: {
    outer: { inset: number; radius: number; strokeWidth: number; colour: string };
    inner: { inset: number; radius: number; strokeWidth: number; colour: string };
    /** Small dots at the four corners of the outer line. */
    dots: { cx: number; cy: number; r: number; colour: string }[];
  } | null;
  grain: { cx: number; cy: number; r: number; colour: string; opacity: number }[];
};

export const OVERLAY_GRAIN_DOTS = 900;

const hex = (v: string, fallback: string): string => (isHex(v) ? normalizeHex(v) : fallback);
const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Overlay primitives for a width×height canvas (any unit; proportional, so the preview
 * and the full-size export match). Deterministic for the same inputs.
 */
export function overlayLayout(overlay: PhotoOverlay, palette: OverlayPalette, width: number, height: number): OverlayLayout {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const o = sanitizeOverlay(overlay);
  const accent = hex(palette.accent, '#7A2E6B');
  const surface = hex(palette.surface, '#FFFFFF');
  const unit = Math.min(w, h);

  const tint = o.tint > 0 ? { colour: accent, opacity: o.tint } : null;

  let border: OverlayLayout['border'] = null;
  if (o.border) {
    const outerInset = r2(unit * 0.045);
    const innerInset = r2(unit * 0.065);
    const radius = r2(unit * 0.09);
    border = {
      outer: { inset: outerInset, radius, strokeWidth: r2(Math.max(1, unit * 0.008)), colour: accent },
      inner: { inset: innerInset, radius: r2(radius * 0.8), strokeWidth: r2(Math.max(0.5, unit * 0.004)), colour: surface },
      dots: [
        [outerInset, outerInset],
        [w - outerInset, outerInset],
        [outerInset, h - outerInset],
        [w - outerInset, h - outerInset],
      ].map(([cx, cy]) => ({ cx: r2(cx), cy: r2(cy), r: r2(unit * 0.014), colour: surface })),
    };
  }

  const grain: OverlayLayout['grain'] = [];
  if (o.grain) {
    const rand = seededRandom(0x5eed);
    const dot = Math.max(0.5, unit / 400);
    for (let i = 0; i < OVERLAY_GRAIN_DOTS; i++) {
      grain.push({
        cx: r2(rand() * w),
        cy: r2(rand() * h),
        r: r2(dot * (0.5 + rand() * 0.9)),
        colour: rand() < 0.5 ? '#FFFFFF' : '#000000',
        opacity: r2(0.06 + rand() * 0.1),
      });
    }
  }
  return { tint, border, grain };
}
