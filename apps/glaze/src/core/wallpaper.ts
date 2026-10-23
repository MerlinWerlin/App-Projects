// Wallpaper generation: seeded gradients, mesh blobs, grain and simple patterns laid out as
// a plain list of drawable primitives, at iPhone resolutions (the device table in loop.ts).
// Pure TS (no React Native / Expo) so Node can run and test it directly; src/render/WallpaperView
// draws the layout with react-native-svg.

import { hexToRgb, isHex, mix, normalizeHex, rgbToHex, seededRandom } from './colour.ts';
import { DEVICES, deviceForScreen, type Device } from './loop.ts';
import { gradientVector, type GradientVector } from './shapes.ts';
import type { WallpaperArt } from './artwork.ts';

export type WallpaperKind = 'gradient' | 'mesh' | 'grain' | 'pattern';
export type WallpaperPattern = 'dots' | 'grid' | 'waves' | 'checker';

export type WallpaperParams = {
  kind: WallpaperKind;
  /** 2–5 hex colours. The first is the base (mesh) / start (gradient). */
  colours: string[];
  seed: number;
  /** Gradient angle in degrees (CSS convention, 0 = bottom→top, 180 = top→bottom). */
  angle?: number;
  pattern?: WallpaperPattern;
  /** Grain amount 0..1. */
  grain?: number;
  /** Theme artwork composition drawn over the generated base (see artwork.ts compositionLayout). */
  art?: WallpaperArt;
};

export const WALLPAPER_KINDS: readonly WallpaperKind[] = ['gradient', 'mesh', 'grain', 'pattern'];
export const WALLPAPER_PATTERNS: readonly WallpaperPattern[] = ['dots', 'grid', 'waves', 'checker'];
export const MIN_COLOURS = 2;
export const MAX_COLOURS = 5;
/** Caps keep the SVG cheap enough to draw live and capture at full resolution. */
export const MAX_BLOBS = 8;
export const MAX_SHAPES = 600;
export const MAX_GRAIN_DOTS = 1200;
export const DEFAULT_ANGLE = 160;

// ---------------------------------------------------------------- primitives

export type GradientStop = { offset: number; colour: string };
/** Linear gradient; the vector is in 0..1 fractions of the canvas (objectBoundingBox). */
export type LinearGradientSpec = { stops: GradientStop[]; vector: GradientVector };
/** Soft radial blob; drawn as a radial gradient fading to transparent at r. */
export type Blob = { cx: number; cy: number; r: number; colour: string; opacity: number };
export type PatternShape =
  | { type: 'rect'; x: number; y: number; width: number; height: number; colour: string; opacity: number }
  | { type: 'circle'; cx: number; cy: number; r: number; colour: string; opacity: number }
  | { type: 'path'; d: string; colour: string; opacity: number; strokeWidth: number };
export type GrainDot = { cx: number; cy: number; r: number; colour: string; opacity: number };

export type WallpaperLayout = {
  width: number;
  height: number;
  /** Solid fill under everything. */
  base: string;
  gradient: LinearGradientSpec | null;
  blobs: Blob[];
  shapes: PatternShape[];
  grain: GrainDot[];
};

// ---------------------------------------------------------------- helpers

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const round2 = (v: number): number => Math.round(v * 100) / 100;

function normAngle(a: number | undefined): number {
  const v = typeof a === 'number' && Number.isFinite(a) ? a : DEFAULT_ANGLE;
  return ((v % 360) + 360) % 360;
}

function safeColours(colours: string[]): string[] {
  const ok = (Array.isArray(colours) ? colours : []).filter((c) => typeof c === 'string' && isHex(c)).map(normalizeHex);
  if (ok.length === 0) return ['#7A2E6B', '#E0794F'];
  if (ok.length === 1) return [ok[0], ok[0]];
  return ok.slice(0, MAX_COLOURS);
}

function grainAmount(p: WallpaperParams): number {
  const g = typeof p.grain === 'number' && Number.isFinite(p.grain) ? p.grain : 0;
  return clamp(g, 0, 1);
}

/** Problems with a params object (empty when valid). */
export function wallpaperErrors(p: WallpaperParams): string[] {
  const errs: string[] = [];
  if (!WALLPAPER_KINDS.includes(p.kind)) errs.push(`unknown kind ${String(p.kind)}`);
  if (!Array.isArray(p.colours) || p.colours.length < MIN_COLOURS || p.colours.length > MAX_COLOURS) {
    errs.push(`needs ${MIN_COLOURS}-${MAX_COLOURS} colours`);
  } else {
    for (const c of p.colours) if (!isHex(c)) errs.push(`bad colour ${c}`);
  }
  if (!Number.isInteger(p.seed) || p.seed < 0) errs.push('seed must be a non-negative integer');
  if (p.angle !== undefined && !Number.isFinite(p.angle)) errs.push('angle must be finite');
  if (p.grain !== undefined && (!Number.isFinite(p.grain) || p.grain < 0 || p.grain > 1)) errs.push('grain must be 0..1');
  if (p.kind === 'pattern' && (p.pattern === undefined || !WALLPAPER_PATTERNS.includes(p.pattern))) {
    errs.push('pattern kind needs a pattern');
  }
  return errs;
}

export function isValidWallpaper(p: WallpaperParams): boolean {
  return wallpaperErrors(p).length === 0;
}

function evenStops(colours: string[]): GradientStop[] {
  const n = colours.length;
  return colours.map((c, i) => ({ offset: n === 1 ? 0 : round2(i / (n - 1)), colour: c }));
}

// ---------------------------------------------------------------- layout

function layoutBlobs(cols: string[], w: number, h: number, rand: () => number): Blob[] {
  const count = clamp(cols.length + 2, 3, MAX_BLOBS);
  const big = Math.max(w, h);
  const out: Blob[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cx: round2(rand() * w),
      cy: round2(rand() * h),
      r: round2(big * (0.28 + rand() * 0.32)),
      colour: cols[(i + 1) % cols.length],
      opacity: round2(0.55 + rand() * 0.4),
    });
  }
  return out;
}

function layoutPattern(
  pattern: WallpaperPattern,
  cols: string[],
  w: number,
  h: number,
  rand: () => number,
): PatternShape[] {
  const ink = cols[cols.length - 1];
  const alt = cols.length > 2 ? cols[1] : mix(cols[0], '#FFFFFF', 0.35);
  const out: PatternShape[] = [];
  // Cell size from the short side; grown until the cell count fits under the cap.
  let cell = Math.max(4, Math.min(w, h) / (9 + Math.floor(rand() * 5)));
  const cells = () => Math.ceil(w / cell) * Math.ceil(h / cell);
  while (cells() > MAX_SHAPES) cell *= 1.15;
  const cx = Math.ceil(w / cell);
  const cy = Math.ceil(h / cell);

  if (pattern === 'dots') {
    const r = round2(cell * (0.12 + rand() * 0.12));
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        const x = (i + 0.5) * cell + (j % 2 === 1 ? cell / 4 : 0);
        const y = (j + 0.5) * cell;
        if (x > w || y > h) continue;
        out.push({ type: 'circle', cx: round2(Math.min(x, w)), cy: round2(y), r, colour: (i + j) % 3 === 0 ? alt : ink, opacity: 0.32 });
      }
    }
  } else if (pattern === 'checker') {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        if ((i + j) % 2 !== 0) continue;
        const x = i * cell;
        const y = j * cell;
        out.push({
          type: 'rect',
          x: round2(x),
          y: round2(y),
          width: round2(Math.min(cell, w - x)),
          height: round2(Math.min(cell, h - y)),
          colour: ink,
          opacity: 0.16,
        });
      }
    }
  } else if (pattern === 'grid') {
    const line = Math.max(1, round2(cell * 0.04));
    for (let i = 1; i < cx; i++) {
      out.push({ type: 'rect', x: round2(i * cell - line / 2), y: 0, width: line, height: h, colour: ink, opacity: 0.22 });
    }
    for (let j = 1; j < cy; j++) {
      out.push({ type: 'rect', x: 0, y: round2(j * cell - line / 2), width: w, height: line, colour: ink, opacity: 0.22 });
    }
  } else {
    // waves: horizontal sine-ish curves made of quadratic segments, kept inside the canvas.
    const gap = cell * 1.4;
    const amp = Math.min(gap * 0.35, cell * (0.25 + rand() * 0.2));
    const segs = Math.max(2, Math.round(w / cell));
    const segW = w / segs;
    const phase = rand() < 0.5 ? 1 : -1;
    const stroke = Math.max(1, round2(cell * 0.06));
    for (let y = gap / 2; y < h && out.length < MAX_SHAPES; y += gap) {
      const yy = clamp(y, amp, h - amp);
      let d = `M0 ${round2(yy)}`;
      for (let s = 0; s < segs; s++) {
        const x0 = s * segW;
        const dir = (s % 2 === 0 ? -1 : 1) * phase;
        d += ` Q${round2(x0 + segW / 2)} ${round2(clamp(yy + dir * amp * 2, 0, h))} ${round2(Math.min(x0 + segW, w))} ${round2(yy)}`;
      }
      out.push({ type: 'path', d, colour: ink, opacity: 0.3, strokeWidth: stroke });
    }
  }
  return out.slice(0, MAX_SHAPES);
}

function layoutGrain(amount: number, w: number, h: number, rand: () => number): GrainDot[] {
  const count = Math.min(MAX_GRAIN_DOTS, Math.round(amount * MAX_GRAIN_DOTS));
  const unit = Math.max(0.5, Math.min(w, h) / 400);
  const out: GrainDot[] = [];
  for (let i = 0; i < count; i++) {
    const r = round2(unit * (0.5 + rand() * 0.9));
    out.push({
      cx: round2(clamp(rand() * w, 0, w)),
      cy: round2(clamp(rand() * h, 0, h)),
      r,
      colour: rand() < 0.5 ? '#FFFFFF' : '#000000',
      opacity: round2(0.05 + rand() * 0.1 * (0.5 + amount)),
    });
  }
  return out;
}

/**
 * Drawable primitives for `params` on a width×height canvas (any unit: points for a
 * preview, pixels for export). Deterministic for the same params and size.
 */
export function layoutWallpaper(params: WallpaperParams, width: number, height: number): WallpaperLayout {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const cols = safeColours(params.colours);
  const seed = Number.isFinite(params.seed) ? Math.floor(Math.abs(params.seed)) : 0;
  const rand = seededRandom(seed);
  const grainRand = seededRandom((seed ^ 0x9e3779b9) >>> 0);
  const vector = gradientVector(normAngle(params.angle));
  const kind: WallpaperKind = WALLPAPER_KINDS.includes(params.kind) ? params.kind : 'gradient';
  let grain = grainAmount(params);

  const layout: WallpaperLayout = { width: w, height: h, base: cols[0], gradient: null, blobs: [], shapes: [], grain: [] };

  if (kind === 'mesh') {
    // Soft two-tone underlay, then blobs of the other colours.
    layout.gradient = { stops: evenStops([cols[0], mix(cols[0], cols[cols.length - 1], 0.35)]), vector };
    layout.blobs = layoutBlobs(cols, w, h, rand);
  } else if (kind === 'pattern') {
    layout.gradient = { stops: evenStops(cols.length > 2 ? cols.slice(0, cols.length - 1) : cols), vector };
    layout.shapes = layoutPattern(params.pattern ?? 'dots', cols, w, h, rand);
  } else {
    layout.gradient = { stops: evenStops(cols), vector };
    if (kind === 'grain') grain = Math.max(grain, 0.5);
  }
  if (grain > 0) layout.grain = layoutGrain(grain, w, h, grainRand);
  return layout;
}

// ---------------------------------------------------------------- colour + edits

/** Mean colour of the wallpaper's colours (base weighted double for mesh). */
export function averageColour(params: WallpaperParams): string {
  const cols = safeColours(params.colours);
  const weighted = params.kind === 'mesh' ? [cols[0], ...cols] : cols;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of weighted) {
    const v = hexToRgb(c);
    r += v.r;
    g += v.g;
    b += v.b;
  }
  const n = weighted.length;
  return rgbToHex({ r: r / n, g: g / n, b: b / n });
}

/** A theme's wallpaper as the maker edits it: a fresh colour list and every optional knob filled in. */
export function editorParamsFor(w: WallpaperParams): WallpaperParams {
  return { ...w, colours: [...w.colours], pattern: w.pattern ?? 'dots', angle: w.angle ?? 180, grain: w.grain ?? 0 };
}

/** Same look, new arrangement: new seed and (for gradients) a new angle picked from it. */
export function randomise(params: WallpaperParams, seed: number): WallpaperParams {
  const s = Math.floor(Math.abs(Number.isFinite(seed) ? seed : 0)) >>> 0;
  const rand = seededRandom(s);
  const angle = Math.round(rand() * 24) * 15;
  return { ...params, colours: [...params.colours], seed: s, angle };
}

/** A fresh seed from a clock / random source value. */
export function nextSeed(previous: number, salt: number = Date.now()): number {
  const rand = seededRandom(((previous >>> 0) ^ (Math.floor(salt) >>> 0)) >>> 0);
  return Math.floor(rand() * 0x7fffffff);
}

// ---------------------------------------------------------------- sizes + export

export type WallpaperSize = { id: string; name: string; width: number; height: number; points: { width: number; height: number } };

/** Portrait pixel sizes, one per device in the shared device table. */
export const WALLPAPER_SIZES: readonly WallpaperSize[] = DEVICES.map((d: Device) => ({
  id: d.id,
  name: d.name,
  width: d.pixels.width,
  height: d.pixels.height,
  points: { width: d.points.width, height: d.points.height },
}));

export function wallpaperSize(id: string): WallpaperSize | undefined {
  return WALLPAPER_SIZES.find((s) => s.id === id);
}

/** The size for this screen (points, either orientation); unknown screens get the closest. */
export function sizeForScreen(widthPt: number, heightPt: number): WallpaperSize {
  const d = deviceForScreen(widthPt, heightPt);
  return wallpaperSize(d.id) ?? WALLPAPER_SIZES[WALLPAPER_SIZES.length - 1];
}

/**
 * Layout and capture dimensions for exporting `size` at the screen's pixel ratio.
 * The view is laid out at pixels / ratio points (1:1 with device pixels). react-native-view-shot
 * takes pixels on Android but points (× screen scale) on iOS, so iOS gets the point size.
 */
export function exportPlan(
  size: { width: number; height: number },
  pixelRatio: number,
  os: string,
): { layout: { width: number; height: number }; capture: { width: number; height: number }; pixels: { width: number; height: number } } {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const layout = { width: size.width / ratio, height: size.height / ratio };
  const capture = os === 'ios' ? { ...layout } : { width: size.width, height: size.height };
  return { layout, capture, pixels: { width: size.width, height: size.height } };
}
