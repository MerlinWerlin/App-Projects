// Matched Lock + Home wallpaper pairs (T62, MARKET.md gap 3): from any Lock Screen
// wallpaper (designed or the user's photo) derive a softened Home Screen version:
// blurred, washed toward a neutral grey (a cheap desaturate), then dimmed until white
// icon labels pass WCAG AA (4.5:1) against the lightest colour the wallpaper can show.
// The render layer draws the captured Lock PNG with an Image blurRadius plus two
// plain overlay layers (wash, dim); this module only does the maths.
// Pure TypeScript: no React Native or Expo imports, so Node runs it directly.

import { composite, contrastRatio, hexToRgb, isHex, mix, normalizeHex, relativeLuminance, rgbToHex } from './colour.ts';
import { DEFAULT_TRANSFORM, photoLayout, type PhotoTransform, type Rect, type Size } from './photoCrop.ts';
import type { WallpaperParams } from './wallpaper.ts';

export type PairStrength = 'soft' | 'strong';

export type HomeVersionInput = {
  /**
   * Colours the Lock wallpaper can show. For a designed wallpaper pass its colours; for a
   * photo (pixels unknown in JS) pass nothing and the worst case (white) is assumed.
   */
  colours?: readonly string[];
  /** Export size in pixels (the device the pair is for). */
  size: Size;
  strength?: PairStrength;
};

export type HomeVersion = {
  /** Blur as a fraction of the short side of the canvas (size-independent). */
  blurFraction: number;
  /** Blur radius in export pixels for `size`. */
  blurPx: number;
  /**
   * Zoom (≥ 1) applied to the blurred image about its centre so the soft, see-through
   * rim a blur leaves at the edges falls outside the frame.
   */
  overscan: number;
  /** Neutral grey wash over the blur (opacity 0..1): pulls colour toward grey. */
  wash: { colour: string; opacity: number };
  /** Black layer opacity on top, raised until labels pass. */
  dim: number;
  /** Lowest contrast of white labels against the Home version (1..21). */
  labelContrast: number;
  /** True when labelContrast ≥ LABEL_MIN_CONTRAST. */
  passes: boolean;
};

export const LABEL_COLOUR = '#FFFFFF';
/** WCAG AA for normal-size text: Home Screen labels are small. */
export const LABEL_MIN_CONTRAST = 4.5;
export const MAX_DIM = 0.8;
export const DIM_STEP = 0.01;

export const PAIR_PRESETS: Readonly<Record<PairStrength, { blur: number; desaturate: number; dim: number }>> = Object.freeze({
  soft: Object.freeze({ blur: 0.018, desaturate: 0.3, dim: 0.18 }),
  strong: Object.freeze({ blur: 0.035, desaturate: 0.5, dim: 0.28 }),
});

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

function cleanColours(colours: readonly string[] | undefined): string[] {
  const ok = (Array.isArray(colours) ? colours : []).filter((c) => typeof c === 'string' && isHex(c)).map(normalizeHex);
  // Unknown pixels (a photo): plan for the brightest possible area.
  return ok.length > 0 ? ok : ['#FFFFFF'];
}

/** Mean of the colours, then a grey of the same relative luminance (the wash colour). */
export function neutralGrey(colours: readonly string[]): string {
  const cols = cleanColours(colours);
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of cols) {
    const v = hexToRgb(c);
    r += v.r;
    g += v.g;
    b += v.b;
  }
  const mean = rgbToHex({ r: r / cols.length, g: g / cols.length, b: b / cols.length });
  const L = relativeLuminance(mean);
  // Invert the sRGB transfer curve for a grey of luminance L.
  const s = L <= 0.0031308 ? L * 12.92 : 1.055 * Math.pow(L, 1 / 2.4) - 0.055;
  const v = Math.round(clamp(s, 0, 1) * 255);
  return rgbToHex({ r: v, g: v, b: v });
}

/** What one Lock colour looks like on the Home version (wash, then dim; blur only averages). */
export function homeColour(colour: string, wash: { colour: string; opacity: number }, dim: number): string {
  const washed = composite(wash.colour, clamp(wash.opacity, 0, 1), normalizeHex(colour));
  return composite('#000000', clamp(dim, 0, 1), washed);
}

/** Lowest contrast of white labels over every colour on the Home version. */
export function labelContrastFor(colours: readonly string[], wash: { colour: string; opacity: number }, dim: number): number {
  let lo = 21;
  for (const c of cleanColours(colours)) lo = Math.min(lo, contrastRatio(LABEL_COLOUR, homeColour(c, wash, dim)));
  return lo;
}

/** Blur radius in pixels for a fraction of the short side. */
export function blurPxFor(fraction: number, size: Size): number {
  const short = Math.max(1, Math.min(Number.isFinite(size.width) ? size.width : 1, Number.isFinite(size.height) ? size.height : 1));
  return Math.round(clamp(fraction, 0, 0.2) * short * 10) / 10;
}

/** Zoom so a blur of `blurPx` loses its soft rim off the frame (2 radii per side). */
export function overscanFor(blurPx: number, size: Size): number {
  const short = Math.max(1, Math.min(Number.isFinite(size.width) ? size.width : 1, Number.isFinite(size.height) ? size.height : 1));
  const b = Math.max(0, Number.isFinite(blurPx) ? blurPx : 0);
  return r3(clamp(1 + (4 * b) / short, 1, 1.5));
}

/**
 * Home Screen parameters for a Lock wallpaper on `size`: the preset's blur / wash / dim,
 * with the dim raised in DIM_STEP steps (up to MAX_DIM) until white labels reach AA.
 */
export function homeVersionFor(input: HomeVersionInput): HomeVersion {
  const preset = PAIR_PRESETS[input.strength === 'strong' ? 'strong' : 'soft'];
  const cols = cleanColours(input.colours);
  const wash = { colour: neutralGrey(cols), opacity: preset.desaturate };
  let dim = preset.dim;
  let contrast = labelContrastFor(cols, wash, dim);
  while (contrast < LABEL_MIN_CONTRAST && dim < MAX_DIM) {
    dim = Math.min(MAX_DIM, r3(dim + DIM_STEP));
    contrast = labelContrastFor(cols, wash, dim);
  }
  const blurPx = blurPxFor(preset.blur, input.size);
  return {
    blurFraction: preset.blur,
    blurPx,
    overscan: overscanFor(blurPx, input.size),
    wash,
    dim: r3(dim),
    labelContrast: Math.round(contrast * 100) / 100,
    passes: contrast >= LABEL_MIN_CONTRAST,
  };
}

/**
 * Every colour a designed wallpaper can put behind a label: its colours, the pattern's
 * lightened alternate and the theme artwork's fills. (Grain is a few % and blurs away.)
 */
export function designedColours(params: Pick<WallpaperParams, 'colours' | 'art'>): string[] {
  const cols = (Array.isArray(params.colours) ? params.colours : []).filter((c) => typeof c === 'string' && isHex(c)).map(normalizeHex);
  const out = [...cols];
  if (cols.length > 0) out.push(mix(cols[0], '#FFFFFF', 0.35));
  const art = params.art?.colours;
  if (art) for (const c of Object.values(art)) if (typeof c === 'string' && isHex(c)) out.push(normalizeHex(c));
  return [...new Set(out)];
}

/**
 * Where to draw the source image (any size) inside a `frame` (points or px) for the
 * Home version: the Lock crop (`transform`, default centred cover; built on
 * photoLayout so it always reaches every edge), then zoomed by `overscan` about the
 * frame centre so the blur's soft rim falls outside.
 */
export function homeImageLayout(image: Size, frame: Size, overscan: number, transform: PhotoTransform = DEFAULT_TRANSFORM): Rect {
  const zoom = clamp(Number.isFinite(overscan) ? overscan : 1, 1, 5);
  const l = photoLayout(image, frame, transform);
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  return {
    x: cx - (cx - l.x) * zoom,
    y: cy - (cy - l.y) * zoom,
    width: l.width * zoom,
    height: l.height * zoom,
  };
}

/** Blur radius in layout units for a frame (preview points or export points). */
export function blurForFrame(home: Pick<HomeVersion, 'blurFraction'>, frame: Size): number {
  return blurPxFor(home.blurFraction, frame);
}
