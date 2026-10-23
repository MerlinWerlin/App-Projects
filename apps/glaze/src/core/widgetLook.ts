// Widget looks for iOS 26 (T65; docs/WIDGETS.md "Widget looks"; MARKET.md gap 8 / takeaway 9).
//
// A look sits on top of a theme's widget style (glass / solid / outline):
//   theme   the theme's own style, unchanged.
//   clear   a light or dark frosted pane the wallpaper shows through (Liquid Glass-style).
//   tinted  the same pane tinted with the theme accent (or the user's background colour).
//   glow    a dark base with bright, softly glowing text (original "neon" look for dark themes).
//
// The clear and tinted panes are see-through, so text has to be readable on the wallpaper
// itself. `pairGlassText` picks the faintest pane and a text colour that keep every text line at
// WCAG AA (4.5:1) against every colour the wallpaper can show through it (3:1 for large
// numerals such as the clock time), checking both the theme wallpaper and its softened Home
// Screen version (wallpaperPair.ts), so it holds whichever one is on the Home Screen. With no
// known wallpaper (a photo, or an old payload) the pane is bounded over black and white like the
// theme glass style, which simply makes it more opaque.
//
// Pure TS (no React Native / Expo), Node-testable, deterministic.

import { composite, ensureContrast, gradientStops, hexToHsl, hslToHex, isHex, minContrast, mix, normalizeHex, relativeLuminance } from './colour.ts';
import { designedColours, homeColour, homeVersionFor } from './wallpaperPair.ts';
import type { WallpaperParams } from './wallpaper.ts';

export const WIDGET_LOOKS = Object.freeze(['theme', 'clear', 'tinted', 'glow'] as const);
export type WidgetLook = (typeof WIDGET_LOOKS)[number];

export const isWidgetLook = (v: unknown): v is WidgetLook => typeof v === 'string' && (WIDGET_LOOKS as readonly string[]).includes(v);

/** i18n key of a look's name (themeUi namespace). */
export const widgetLookKey = (look: WidgetLook): string => `themeUi.widgetStudio.look.${look}`;

export const BODY_TEXT_MIN_CONTRAST = 4.5;
/** WCAG AA for large text (≥ 18 pt regular / 14 pt bold); used for large numerals only. */
export const LARGE_TEXT_MIN_CONTRAST = 3;

/**
 * Widget Studio can shrink text to 70 % after colours are solved (STUDIO_SCALE_MIN), so a line
 * only counts as large when it is still large at that scale. Kept equal by a test.
 */
export const LARGE_TEXT_SAFETY_SCALE = 0.7;
/** WCAG large text in CSS px; iOS points are the same size. */
const LARGE_REGULAR_PT = 24;
const LARGE_BOLD_PT = 18.67;

/** Text sources that are digits (the only lines allowed the 3:1 large-text minimum). */
export const NUMERAL_SOURCES: readonly string[] = Object.freeze(['time', 'dayNumber', 'batteryLevel', 'countdown']);

/** True when a line is WCAG "large" even at the smallest studio text size. */
export function isLargeText(sizePt: number, weight: 'regular' | 'medium' | 'bold'): boolean {
  if (!Number.isFinite(sizePt)) return false;
  const pt = sizePt * LARGE_TEXT_SAFETY_SCALE;
  return pt >= LARGE_REGULAR_PT || (weight === 'bold' && pt >= LARGE_BOLD_PT);
}

/** Contrast a text line needs under a look: 3:1 for large numerals on clear / tinted / glow, else 4.5:1. */
export function textMinContrast(look: WidgetLook, source: string, sizePt: number, weight: 'regular' | 'medium' | 'bold'): number {
  if (look === 'theme') return BODY_TEXT_MIN_CONTRAST;
  return NUMERAL_SOURCES.includes(source) && isLargeText(sizePt, weight) ? LARGE_TEXT_MIN_CONTRAST : BODY_TEXT_MIN_CONTRAST;
}

// ---------------------------------------------------------------------------------- wallpaper

export const MAX_WALLPAPER_COLOURS = 8;

function cleanList(colours: readonly unknown[] | null | undefined, max: number): string[] {
  const out: string[] = [];
  for (const c of Array.isArray(colours) ? colours : []) {
    if (typeof c !== 'string' || !isHex(c)) continue;
    const n = normalizeHex(c);
    if (!out.includes(n)) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

/** The colours a designed wallpaper can show (its colours, pattern tint, art fills), at most 8. */
export function wallpaperColoursOf(params: Pick<WallpaperParams, 'colours' | 'art'> | null | undefined): string[] {
  if (!params) return [];
  return cleanList(designedColours(params), MAX_WALLPAPER_COLOURS);
}

/** Validated wallpaper colour list (tolerant: junk dropped, at most 8). */
export function cleanWallpaperColours(raw: unknown): string[] {
  return cleanList(Array.isArray(raw) ? raw : [], MAX_WALLPAPER_COLOURS);
}

/** Colours plus three blends between every pair (gradients and mesh blobs blend any two). */
function blends(colours: readonly string[]): string[] {
  const out = [...colours];
  for (let i = 0; i < colours.length; i++) {
    for (let j = i + 1; j < colours.length; j++) out.push(...gradientStops([colours[i], colours[j]], 5).slice(1, 4));
  }
  return out;
}

/**
 * Every colour the wallpaper can put behind a widget: the wallpaper's colours and blends, and the
 * same for its softened Home Screen version (the T62 pair). Empty when the wallpaper is unknown.
 */
export function wallpaperBackdrop(colours: readonly string[]): string[] {
  const lock = cleanWallpaperColours(colours);
  if (lock.length === 0) return [];
  const home = homeVersionFor({ colours: lock, size: { width: 1179, height: 2556 } });
  const homeCols = lock.map((c) => homeColour(c, home.wash, home.dim));
  return [...new Set([...blends(lock), ...blends(homeCols)])];
}

/** What a pane of `tint` at `opacity` looks like over the wallpaper (bounded over black / white when unknown). */
export function paneSamples(tint: string, opacity: number, backdrop: readonly string[]): string[] {
  const t = normalizeHex(tint);
  if (opacity >= 1) return [t];
  const under = backdrop.length ? backdrop : ['#000000', '#FFFFFF'];
  return compactByLuminance([...new Set(under.map((c) => composite(t, opacity, c)))]);
}

/** Luminance bucket width for compactByLuminance. */
const LUMA_BUCKET = 0.01;

/**
 * Fewer colours with the same contrast verdicts: contrast depends only on luminance, so per
 * 0.01-wide luminance bucket only the darkest and lightest colour are kept. For any colour outside
 * every kept bucket's range the lowest contrast is unchanged; one inside a bucket is within
 * 1.2:1 of it and fails any real threshold either way. Order: darkest first.
 */
export function compactByLuminance(samples: readonly string[]): string[] {
  const buckets = new Map<number, { lo: string; loL: number; hi: string; hiL: number }>();
  for (const c of samples) {
    const l = relativeLuminance(c);
    const k = Math.floor(l / LUMA_BUCKET);
    const b = buckets.get(k);
    if (!b) buckets.set(k, { lo: c, loL: l, hi: c, hiL: l });
    else {
      if (l < b.loL) { b.lo = c; b.loL = l; }
      if (l > b.hiL) { b.hi = c; b.hiL = l; }
    }
  }
  const out: string[] = [];
  for (const k of [...buckets.keys()].sort((x, y) => x - y)) {
    const b = buckets.get(k)!;
    out.push(b.lo);
    if (b.hi !== b.lo) out.push(b.hi);
  }
  return out;
}

/**
 * Can any colour reach `min` contrast against every colour in `samples`? Exact: contrast depends
 * only on luminance, so the best candidates are black, white, and the geometric middle of each gap
 * between neighbouring sample luminances. Cheap, so faint panes that can't work are skipped
 * before the full solve.
 */
export function backdropFeasible(samples: readonly string[], min: number): boolean {
  if (samples.length === 0) return true;
  const ls = [...new Set(samples.map((c) => relativeLuminance(c)))].sort((x, y) => x - y);
  if ((ls[0] + 0.05) / 0.05 >= min) return true; // black
  if (1.05 / (ls[ls.length - 1] + 0.05) >= min) return true; // white
  const sq = min * min;
  for (let i = 1; i < ls.length; i++) if ((ls[i] + 0.05) / (ls[i - 1] + 0.05) >= sq) return true;
  return false;
}

// ---------------------------------------------------------------------------------- glass pairing

/** Pane opacities tried, faintest first. */
export const CLEAR_OPACITIES: readonly number[] = Object.freeze([0.12, 0.2, 0.3, 0.4, 0.5, 0.62, 0.75, 0.88, 1]);
export const TINTED_OPACITIES: readonly number[] = Object.freeze([0.32, 0.42, 0.52, 0.62, 0.75, 0.88, 1]);
/** Clear panes: frosted white or smoked black, whichever needs less opacity (white on a tie). */
export const CLEAR_TINTS: readonly string[] = Object.freeze(['#FFFFFF', '#000000']);

export type GlassPairInput = {
  /** Wallpaper colours (wallpaperColoursOf); empty = unknown. */
  wallpaper: readonly string[];
  look: 'clear' | 'tinted';
  /** Tint for 'tinted' (theme accent or the user's background colour). Ignored for 'clear'. */
  tint?: string;
  /** Preferred text colours in order; black and white are always tried last. */
  text?: readonly string[];
  /** Contrast the text needs (default 4.5). */
  min?: number;
};

export type GlassPair = {
  tint: string;
  opacity: number;
  colour: string;
  /** Colours the text was checked against (the pane over every wallpaper colour). */
  backdrop: string[];
  contrast: number;
  /** False when the wallpaper was unknown and the pane was bounded over black and white. */
  wallpaperKnown: boolean;
};

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Pane candidates for a look, faintest first (clear interleaves white and black at each step). */
export function glassCandidates(look: 'clear' | 'tinted', tint?: string): { tint: string; opacity: number }[] {
  if (look === 'tinted') {
    const t = tint && isHex(tint) ? normalizeHex(tint) : '#FFFFFF';
    return TINTED_OPACITIES.map((opacity) => ({ tint: t, opacity }));
  }
  return CLEAR_OPACITIES.flatMap((opacity) => CLEAR_TINTS.map((t) => ({ tint: t, opacity })));
}

/**
 * The faintest pane (and a text colour on it) that keeps text at `min` contrast against everything
 * the wallpaper can show through. Always succeeds: the last candidate is opaque, where black or
 * white reaches at least 4.58:1.
 */
export function pairGlassText(input: GlassPairInput): GlassPair {
  const min = typeof input.min === 'number' && input.min > 0 ? Math.min(input.min, 4.5) : BODY_TEXT_MIN_CONTRAST;
  const backdrop = wallpaperBackdrop(input.wallpaper);
  const prefs = [...cleanList(input.text ?? [], 8), '#000000', '#FFFFFF'];
  for (const cand of glassCandidates(input.look, input.tint)) {
    const samples = paneSamples(cand.tint, cand.opacity, backdrop);
    if (!backdropFeasible(samples, min)) continue;
    for (const p of prefs) {
      const c = minContrast(p, samples) >= min ? p : null;
      if (c) return { tint: cand.tint, opacity: cand.opacity, colour: c, backdrop: samples, contrast: r3(minContrast(c, samples)), wallpaperKnown: backdrop.length > 0 };
    }
  }
  // Unreachable (opaque pane + black/white), kept for type safety.
  const last = glassCandidates(input.look, input.tint).pop()!;
  const samples = paneSamples(last.tint, 1, []);
  const colour = minContrast('#000000', samples) >= minContrast('#FFFFFF', samples) ? '#000000' : '#FFFFFF';
  return { tint: last.tint, opacity: 1, colour, backdrop: samples, contrast: r3(minContrast(colour, samples)), wallpaperKnown: backdrop.length > 0 };
}

// ---------------------------------------------------------------------------------- glow

/** Halo strength next to glowing strokes; text is also checked against the halo. */
export const GLOW_HALO_OPACITY = 0.25;
/** Halo blur radius in points at the nominal canvas. */
export const GLOW_RADIUS_PT = 6;
const GLOW_NIGHT = '#05040A';

export type GlowPalette = {
  /** Dark base gradient (top, bottom), from the accent. */
  base: [string, string];
  /** Bright text / glyph colour. */
  neon: string;
  /** Colours text is checked against: the base, and the base under the halo. */
  backdrop: string[];
};

/** Base, neon colour and contrast backdrop for the glow look from an accent colour. */
export function glowPalette(accent: string): GlowPalette {
  const a = isHex(accent) ? normalizeHex(accent) : '#B45CFF';
  const base: [string, string] = [mix(a, GLOW_NIGHT, 0.9), mix(a, GLOW_NIGHT, 0.8)];
  const hsl = hexToHsl(a);
  const bright = hslToHex({ h: hsl.h, s: Math.max(hsl.s, 0.75), l: 0.72 });
  const baseSamples = gradientStops(base, 5);
  const check = (c: string) => [...new Set([...baseSamples, ...baseSamples.map((b) => composite(c, GLOW_HALO_OPACITY, b))])];
  let neon = bright;
  // Lighten until the text clears AA on the base and on its own halo (white always does).
  for (let i = 0; i < 12 && minContrast(neon, check(neon)) < BODY_TEXT_MIN_CONTRAST; i++) neon = mix(neon, '#FFFFFF', 0.2);
  if (minContrast(neon, check(neon)) < BODY_TEXT_MIN_CONTRAST) neon = ensureContrast(neon, check(neon)) ?? '#FFFFFF';
  return { base, neon, backdrop: check(neon) };
}

/** True when a theme reads as dark (glow is offered first for these). */
export function suitsGlow(bg: readonly string[]): boolean {
  const cols = cleanList(bg, 2);
  return cols.length > 0 && cols.every((c) => hexToHsl(c).l < 0.35);
}
