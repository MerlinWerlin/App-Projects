// T76 (docs/MARKET.md "Owner screenshots 18 Oct" L5): photo-collage Lock Screen maker.
//
// Layout maths for 2..6 of the person's own photos on a portrait canvas of any device size
// (e.g. 1290 x 2796). Every layout is a guillotine split tree (rows / columns with weights), so
// tiles never overlap by construction; gutters sit exactly between neighbours and as the outer
// margin, and every rect is whole pixels inside the canvas.
//
// Clock-safe area: the top band where the iOS Lock Screen date and big clock sit
// (CLOCK_BAND, fractions of the canvas height). "Clock band clear" layouts keep that band
// photo-free, so it shows the solid / gradient background and the clock stays readable.
// Full-bleed layouts use the whole canvas and let the clock sit over a photo.
//
// "Scatter" layouts shrink each cell by a fixed, asymmetric inset pattern, so tiles look
// loosely placed while staying inside their own cell (still non-overlapping, still inside).
//
// Photos never leave the device: this module only does arithmetic on sizes. Using a collage as
// a Live Lock source is a later task.
//
// Pure TS, no React.

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 6;

/** Top band kept for the Lock Screen date + clock, as fractions of the canvas height. */
export type ClockBand = { top: number; bottom: number };

/**
 * Covers the date line (from ~7.5 %) and the tallest clock styles (to ~30 %), with a little air.
 * Clock-clear layouts start their photos at `bottom`; nothing is drawn in [top, bottom].
 */
export const CLOCK_BAND: ClockBand = Object.freeze({ top: 0.06, bottom: 0.32 });

export type CollageSize = { width: number; height: number };

/** A tile in canvas pixels (integers). `r` is the corner radius, clamped to half the short side. */
export type CollageRect = { x: number; y: number; w: number; h: number; r: number };

export type CollageStyle = 'grid' | 'strips' | 'hero' | 'columns' | 'offset' | 'scatter';

/** A split tree: a leaf is one photo; a split divides its area by weights along an axis. */
export type CollageNode = { kind: 'leaf' } | { kind: 'split'; axis: 'row' | 'column'; weights: readonly number[]; children: readonly CollageNode[] };

export type CollageLayout = {
  /** Unique within a photo count, e.g. 'grid-clear'. */
  id: string;
  count: number;
  style: CollageStyle;
  /** True when no photo enters the clock band. */
  clockClear: boolean;
  tree: CollageNode;
  /** Scatter layouts: shrink each cell by this inset pattern. */
  scatter: boolean;
};

export type CollageOptions = {
  /** Space between tiles in canvas px (default defaultGutter(canvas)). */
  gutter?: number;
  /** Outer margin in canvas px (default: the gutter). */
  margin?: number;
  /** Corner radius in canvas px (default defaultRadius(canvas)). */
  radius?: number;
  band?: ClockBand;
};

export type CollageResult = {
  layout: CollageLayout;
  rects: CollageRect[];
  /** The photo-free clock band in px (clock-clear layouts only). */
  band: { y: number; h: number } | null;
};

// ------------------------------------------------------------------------------------ helpers

const leaf: CollageNode = Object.freeze({ kind: 'leaf' });

function row(weights: readonly number[], children?: readonly CollageNode[]): CollageNode {
  return { kind: 'split', axis: 'row', weights, children: children ?? weights.map(() => leaf) };
}

function column(weights: readonly number[], children?: readonly CollageNode[]): CollageNode {
  return { kind: 'split', axis: 'column', weights, children: children ?? weights.map(() => leaf) };
}

const ones = (n: number): number[] => Array.from({ length: n }, () => 1);

/** Number of photos a tree holds. */
export function leafCount(node: CollageNode): number {
  if (node.kind === 'leaf') return 1;
  let n = 0;
  for (const c of node.children) n += leafCount(c);
  return n;
}

/** A whole number of photos in 2..6 (non-numbers become 2). */
export function clampPhotoCount(n: number): number {
  if (!Number.isFinite(n)) return MIN_PHOTOS;
  return Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, Math.floor(n)));
}

/** Two staggered columns: the split lines on each side never line up. */
function staggered(left: number, right: number): CollageNode {
  const lw = ones(left);
  const rw = ones(right);
  if (left > 1) lw[0] = 1.5;
  if (right > 1) rw[right - 1] = 1.5;
  return row([1, 1], [left > 1 ? column(lw) : leaf, right > 1 ? column(rw) : leaf]);
}

/** Rows of a near-square grid (2 or 3 per row), top to bottom. */
function gridTree(n: number, perRow: number): CollageNode {
  const rows: CollageNode[] = [];
  let left = n;
  while (left > 0) {
    const take = Math.min(perRow, left);
    rows.push(take === 1 ? leaf : row(ones(take)));
    left -= take;
  }
  return rows.length === 1 ? rows[0] : column(ones(rows.length), rows);
}

/** One big photo on top, the rest in a row (or two rows) below. */
function heroTree(n: number): CollageNode {
  const rest = n - 1;
  if (rest <= 3) return column([3, 2], [leaf, rest === 1 ? leaf : row(ones(rest))]);
  const a = Math.ceil(rest / 2);
  const b = rest - a;
  return column([3, 1.5, 1.5], [leaf, row(ones(a)), row(ones(b))]);
}

function make(count: number, id: string, style: CollageStyle, clockClear: boolean, tree: CollageNode): CollageLayout {
  return { id, count, style, clockClear, tree, scatter: style === 'scatter' };
}

function buildLayouts(n: number): CollageLayout[] {
  const out: CollageLayout[] = [];
  out.push(make(n, 'grid-clear', 'grid', true, gridTree(n, 2)));
  out.push(make(n, 'strips-clear', 'strips', true, column(ones(n))));
  out.push(make(n, 'hero-clear', 'hero', true, heroTree(n)));
  out.push(make(n, 'offset-clear', 'offset', true, staggered(Math.ceil(n / 2), Math.floor(n / 2))));
  out.push(make(n, 'scatter-clear', 'scatter', true, staggered(Math.ceil(n / 2), Math.floor(n / 2))));
  out.push(make(n, 'grid-full', 'grid', false, gridTree(n, n === 6 ? 3 : 2)));
  out.push(make(n, 'columns-full', 'columns', false, n <= 3 ? row(ones(n)) : staggered(Math.ceil(n / 2), Math.floor(n / 2))));
  return out;
}

const LAYOUTS: ReadonlyMap<number, readonly CollageLayout[]> = new Map(
  Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => {
    const n = i + MIN_PHOTOS;
    return [n, Object.freeze(buildLayouts(n))] as const;
  }),
);

/** Every layout for `n` photos (n clamped to 2..6), clock-clear ones first. */
export function layoutsFor(n: number): readonly CollageLayout[] {
  return LAYOUTS.get(clampPhotoCount(n)) ?? [];
}

/** The layout with `id` for `n` photos, else the first one (always a clock-clear grid). */
export function layoutFor(n: number, id: string | null | undefined): CollageLayout {
  const list = layoutsFor(n);
  return list.find((l) => l.id === id) ?? list[0];
}

/** The next (or previous, step -1) layout for `n` photos, wrapping around. */
export function cycleLayout(n: number, id: string | null | undefined, step: number = 1): CollageLayout {
  const list = layoutsFor(n);
  const i = Math.max(0, list.findIndex((l) => l.id === id));
  const s = Number.isFinite(step) ? Math.trunc(step) : 1;
  const len = list.length;
  return list[(((i + s) % len) + len) % len];
}

/** A pleasant default gutter: 2.5 % of the canvas width, whole pixels. */
export function defaultGutter(canvas: CollageSize): number {
  return Math.max(0, Math.round(safeDim(canvas.width) * 0.025));
}

/** Default corner radius: 4 % of the canvas width. */
export function defaultRadius(canvas: CollageSize): number {
  return Math.max(0, Math.round(safeDim(canvas.width) * 0.04));
}

/** Spacing presets the screen offers (fractions of the canvas width). */
export const COLLAGE_SPACINGS = Object.freeze(['none', 'thin', 'wide'] as const);
export type CollageSpacing = (typeof COLLAGE_SPACINGS)[number];

/** Gutter + radius for a spacing preset. 'none' is edge-to-edge with square corners. */
export function spacingOptions(spacing: CollageSpacing, canvas: CollageSize): { gutter: number; radius: number } {
  const w = safeDim(canvas.width);
  if (spacing === 'none') return { gutter: 0, radius: 0 };
  if (spacing === 'wide') return { gutter: Math.round(w * 0.045), radius: Math.round(w * 0.06) };
  return { gutter: defaultGutter(canvas), radius: defaultRadius(canvas) };
}

function safeDim(v: number): number {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function safeNonNeg(v: number | undefined, fallback: number): number {
  return v !== undefined && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;
}

function validBand(b: ClockBand | undefined): ClockBand {
  if (!b || !Number.isFinite(b.top) || !Number.isFinite(b.bottom)) return CLOCK_BAND;
  const top = Math.max(0, Math.min(1, b.top));
  const bottom = Math.max(top, Math.min(0.9, b.bottom));
  return { top, bottom };
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Split [start, start + length) into `weights.length` integer spans with exactly `gutter` px
 * between them. The gutter shrinks when there is not room for at least 1 px per span.
 */
export function splitSpan(start: number, length: number, weights: readonly number[], gutter: number): { start: number; size: number }[] {
  const n = weights.length;
  if (n === 0) return [];
  const ws = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1));
  const sum = ws.reduce((a, b) => a + b, 0);
  const maxGutter = n > 1 ? Math.max(0, Math.floor((length - n) / (n - 1))) : 0;
  const g = Math.max(0, Math.min(Math.round(gutter), maxGutter));
  const total = Math.max(0, length - g * (n - 1));
  const out: { start: number; size: number }[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.round((acc / sum) * total);
    acc += ws[i];
    const b = i === n - 1 ? total : Math.round((acc / sum) * total);
    out.push({ start: start + a + i * g, size: Math.max(0, b - a) });
  }
  return out;
}

function place(node: CollageNode, box: Box, gutter: number, out: Box[]): void {
  if (node.kind === 'leaf') {
    out.push(box);
    return;
  }
  const along = node.axis === 'row' ? box.w : box.h;
  const spans = splitSpan(node.axis === 'row' ? box.x : box.y, along, node.weights, gutter);
  node.children.forEach((child, i) => {
    const s = spans[i];
    if (!s) return;
    const sub = node.axis === 'row' ? { x: s.start, y: box.y, w: s.size, h: box.h } : { x: box.x, y: s.start, w: box.w, h: s.size };
    place(child, sub, gutter, out);
  });
}

/** Asymmetric insets (fractions of the cell's short side: start, top, end, bottom) for scatter tiles. */
const SCATTER_INSETS: readonly (readonly [number, number, number, number])[] = [
  [0.02, 0.06, 0.1, 0.0],
  [0.1, 0.0, 0.02, 0.08],
  [0.06, 0.1, 0.0, 0.03],
  [0.0, 0.03, 0.08, 0.1],
  [0.08, 0.08, 0.04, 0.0],
  [0.03, 0.0, 0.09, 0.06],
];

function scatterBox(b: Box, i: number): Box {
  const [s, t, e, btm] = SCATTER_INSETS[i % SCATTER_INSETS.length];
  const short = Math.min(b.w, b.h);
  const l = Math.round(short * s);
  const top = Math.round(short * t);
  const r = Math.round(short * e);
  const bo = Math.round(short * btm);
  const w = b.w - l - r;
  const h = b.h - top - bo;
  if (w < 1 || h < 1) return b;
  return { x: b.x + l, y: b.y + top, w, h };
}

/**
 * Tiles for `n` photos (clamped to 2..6) in `layoutId` on `canvas` (px). Unknown ids fall back
 * to the first layout. Rects are in photo order, whole pixels, inside the canvas and
 * non-overlapping; clock-clear layouts start below the clock band.
 */
export function collageRects(n: number, layoutId: string | null | undefined, canvas: CollageSize, options: CollageOptions = {}): CollageResult {
  const layout = layoutFor(n, layoutId);
  const W = safeDim(canvas.width);
  const H = safeDim(canvas.height);
  const gutter = safeNonNeg(options.gutter, defaultGutter({ width: W, height: H }));
  const margin = Math.min(safeNonNeg(options.margin, gutter), Math.floor(Math.min(W, H) / 4));
  const radius = safeNonNeg(options.radius, defaultRadius({ width: W, height: H }));
  const band = validBand(options.band);

  let area: Box = { x: margin, y: margin, w: Math.max(0, W - margin * 2), h: Math.max(0, H - margin * 2) };
  let bandPx: { y: number; h: number } | null = null;
  if (layout.clockClear) {
    const bandTop = Math.floor(H * band.top);
    const bandBottom = Math.ceil(H * band.bottom);
    const y = Math.max(margin, bandBottom);
    area = { x: margin, y, w: area.w, h: Math.max(0, H - margin - y) };
    bandPx = { y: bandTop, h: Math.max(0, bandBottom - bandTop) };
  }

  const boxes: Box[] = [];
  if (area.w > 0 && area.h > 0) place(layout.tree, area, gutter, boxes);
  const rects = boxes.map((b, i) => {
    const s = layout.scatter ? scatterBox(b, i) : b;
    const r = Math.max(0, Math.min(radius, Math.floor(Math.min(s.w, s.h) / 2)));
    return { x: s.x, y: s.y, w: s.w, h: s.h, r };
  });
  return { layout, rects, band: bandPx };
}

// --------------------------------------------------------------------------------- crop maths

export type CoverFit = {
  /** The part of the photo shown, in the photo's own pixels. */
  crop: { x: number; y: number; width: number; height: number };
  /** Where to draw the whole photo, relative to the tile's top-left (tile clips it). */
  draw: { x: number; y: number; width: number; height: number };
  scale: number;
};

/**
 * Cover-fit a photo of `image` px into a `tile` (w x h): scale so the photo fills the tile, then
 * centre on `focus` (0..1 on each axis, default the middle). Degenerate sizes give an empty crop.
 */
export function coverFit(image: CollageSize, tile: { w: number; h: number }, focus: { x: number; y: number } = { x: 0.5, y: 0.5 }): CoverFit {
  const iw = Number.isFinite(image.width) && image.width > 0 ? image.width : 0;
  const ih = Number.isFinite(image.height) && image.height > 0 ? image.height : 0;
  const tw = Number.isFinite(tile.w) && tile.w > 0 ? tile.w : 0;
  const th = Number.isFinite(tile.h) && tile.h > 0 ? tile.h : 0;
  if (iw === 0 || ih === 0 || tw === 0 || th === 0) {
    return { crop: { x: 0, y: 0, width: 0, height: 0 }, draw: { x: 0, y: 0, width: tw, height: th }, scale: 0 };
  }
  const fx = Number.isFinite(focus.x) ? Math.max(0, Math.min(1, focus.x)) : 0.5;
  const fy = Number.isFinite(focus.y) ? Math.max(0, Math.min(1, focus.y)) : 0.5;
  const scale = Math.max(tw / iw, th / ih);
  const cw = Math.min(iw, tw / scale);
  const ch = Math.min(ih, th / scale);
  const cx = (iw - cw) * fx;
  const cy = (ih - ch) * fy;
  return {
    crop: { x: cx, y: cy, width: cw, height: ch },
    // `+ 0` turns -0 into 0 for a photo that needs no crop on that axis.
    draw: { x: -cx * scale + 0, y: -cy * scale + 0, width: iw * scale, height: ih * scale },
    scale,
  };
}

/** Scale canvas-pixel rects to a preview of `width` points (keeps proportions; not rounded). */
export function scaleRects(rects: readonly CollageRect[], canvasWidth: number, width: number): CollageRect[] {
  const k = canvasWidth > 0 && Number.isFinite(width) && width > 0 ? width / canvasWidth : 0;
  return rects.map((r) => ({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k, r: r.r * k }));
}

/** True when two rects share any area (touching edges do not count). */
export function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Background gradient for gutters and the clock band from a theme's wallpaper colours. */
export function collageBackground(colours: readonly string[] | null | undefined, fallback: string): { from: string; to: string } {
  const list = (colours ?? []).filter((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c));
  if (list.length === 0) return { from: fallback, to: fallback };
  return { from: list[0], to: list[list.length - 1] };
}

/** i18n keys under `wallpaper.collage.style.*` for each style (completeness tests use this). */
export const collageStyleKey = (style: CollageStyle): `wallpaper.collage.style.${CollageStyle}` => `wallpaper.collage.style.${style}`;
export const COLLAGE_STYLES: readonly CollageStyle[] = Object.freeze(['grid', 'strips', 'hero', 'columns', 'offset', 'scatter']);
export const collageSpacingKey = (spacing: CollageSpacing): `wallpaper.collage.spacingOpt.${CollageSpacing}` => `wallpaper.collage.spacingOpt.${spacing}`;
