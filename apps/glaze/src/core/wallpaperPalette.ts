// Colours of the user's own wallpaper photo for widget contrast pairing (T85).
//
// When a theme's background is the user's photo (background.ts usesPhoto), the colours the
// see-through widget looks are checked against (WidgetTokens.wallpaper, widgetLook.ts) should be
// the photo's, not the theme design's. The app captures a small downscaled copy of the wallpaper
// as it is drawn (crop and theme tint included) with react-native-view-shot, decodes it with
// png.ts and passes the pixels here. Nothing leaves the phone.
//
// The colour list is the photo's k-means palette (colour.ts paletteFromPixels) plus two bounds:
// the per-channel darkest (min R, min G, min B) and lightest (max R, max G, max B) colours of the
// sample. A pane composite is monotonic in every channel and luminance is too, so every sampled
// pixel seen through a pane lies between the pane over those two bounds; the bounds and the blends
// between them (widgetLook.wallpaperBackdrop) leave no luminance gap a text colour could hide in,
// so text that passes on the backdrop passes on every sampled pixel (tested).
//
// Fallback: when sampling isn't possible (no capture, unreadable PNG, nothing opaque) the result is
// empty and `photoWallpaperTokens` marks the wallpaper unknown, so panes are bounded over black and
// white (the safe fallback; never the theme design's colours, which the photo may not share).
//
// Pure TS, deterministic, Node-testable.

import { paletteFromPixels, rgbToHex } from './colour.ts';
import { decodePng } from './png.ts';
import { MAX_WALLPAPER_COLOURS, cleanWallpaperColours } from './widgetLook.ts';
import { normaliseTokens, type WidgetTokens } from './widgetSets.ts';

/** Palette size (k); with the two bounds this fills MAX_WALLPAPER_COLOURS. */
export const PHOTO_PALETTE_K = MAX_WALLPAPER_COLOURS - 2;
/** Size the app captures the wallpaper at for sampling (pixels; a 9:19.5 phone aspect). */
export const PHOTO_SAMPLE_SIZE: Readonly<{ width: number; height: number }> = Object.freeze({ width: 36, height: 78 });
/** Pixels with alpha below this are ignored (the capture is opaque; this skips stray edges). */
const MIN_ALPHA = 128;
const SEED = 85;

export type PhotoPalette = {
  /** Colours for WidgetTokens.wallpaper: palette by share, then the darkest and lightest bounds. */
  colours: string[];
  /** Per-channel darkest / lightest sampled colour (null when nothing was opaque). */
  darkest: string | null;
  lightest: string | null;
  /** Opaque pixels that were read. */
  pixels: number;
};

const EMPTY: PhotoPalette = Object.freeze({ colours: [], darkest: null, lightest: null, pixels: 0 }) as PhotoPalette;

/** Palette and bounds from RGBA pixels (straight alpha). Empty when no pixel is opaque. */
export function photoPaletteFromPixels(rgba: Uint8Array | Uint8ClampedArray | number[]): PhotoPalette {
  if (!rgba || typeof rgba.length !== 'number' || rgba.length < 4) return { ...EMPTY, colours: [] };
  const lo = [255, 255, 255];
  const hi = [0, 0, 0];
  let n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < MIN_ALPHA) continue;
    n++;
    for (let c = 0; c < 3; c++) {
      const v = rgba[i + c];
      if (v < lo[c]) lo[c] = v;
      if (v > hi[c]) hi[c] = v;
    }
  }
  if (n === 0) return { ...EMPTY, colours: [] };
  const darkest = rgbToHex({ r: lo[0], g: lo[1], b: lo[2] });
  const lightest = rgbToHex({ r: hi[0], g: hi[1], b: hi[2] });
  // Every opaque pixel feeds k-means (the sample is small), deterministic seed.
  const palette = paletteFromPixels(rgba, PHOTO_PALETTE_K, SEED, { minAlpha: MIN_ALPHA, maxSamples: n });
  // Bounds go in first so the cap can never drop them; the palette fills the rest by share.
  const bounded = cleanWallpaperColours([darkest, lightest, ...palette]);
  const colours = [...bounded.slice(2), ...bounded.slice(0, 2)];
  return { colours: cleanWallpaperColours(colours), darkest, lightest, pixels: n };
}

/** Palette from a PNG (the downscaled capture). Empty when the PNG can't be read. Never throws. */
export function photoPaletteFromPng(png: Uint8Array): PhotoPalette {
  const img = decodePng(png);
  return img ? photoPaletteFromPixels(img.rgba) : { ...EMPTY, colours: [] };
}

/**
 * Widget tokens for a theme whose wallpaper is the user's photo: `wallpaper` becomes the sampled
 * colours, or empty (unknown: panes bounded over black and white) when sampling failed or hasn't
 * finished. Everything else is the theme's. Pure; the input is not changed.
 */
export function photoWallpaperTokens(tokens: WidgetTokens, sampled: readonly string[] | null | undefined): WidgetTokens {
  const t = normaliseTokens(tokens);
  return { ...t, bg: [...t.bg], wallpaper: cleanWallpaperColours(sampled ?? []) };
}

/**
 * The tokens widgets should be solved with: the theme's own when the wallpaper is the theme design,
 * the photo's sampled colours (or unknown) when it is the user's photo.
 */
export function wallpaperTokensFor(tokens: WidgetTokens, background: { usesPhoto: boolean; sampled: readonly string[] | null }): WidgetTokens {
  return background.usesPhoto ? photoWallpaperTokens(tokens, background.sampled) : tokens;
}
