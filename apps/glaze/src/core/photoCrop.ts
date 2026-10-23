// Photo wallpaper crop maths (T25, owner review §2): fit the user's own photo to the
// device's Lock/Home Screen aspect with pan + pinch, never leaving empty edges.
// Pure TypeScript: no React Native or Expo imports, so Node runs it directly.
//
// The transform is stored device-independently so it survives switching iPhone size:
// - scale: zoom as a multiple of the cover scale, MIN_ZOOM (1 = photo just covers the
//   frame) .. MAX_ZOOM (5×). The absolute scale (target px per image px) is
//   coverScale × scale, so it is always ≥ the cover scale.
// - offsetX / offsetY: where the frame sits inside the zoomed photo along each axis,
//   -1 (left / top edge) .. 0 (centred) .. 1 (right / bottom edge). An axis with no
//   spare photo (e.g. the height of a landscape shot at 1×) has nothing to pan.

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type PhotoTransform = { scale: number; offsetX: number; offsetY: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const DEFAULT_TRANSFORM: PhotoTransform = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });
/** Above this many target px per photo px the saved wallpaper starts to look soft. */
export const SOFT_UPSCALE = 1.5;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const finite = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** True for a size both sides of which are finite and > 0. */
export function isUsableSize(s: Partial<Size> | null | undefined): s is Size {
  return !!s && finite(s.width, 0) > 0 && finite(s.height, 0) > 0;
}

/** Scale (target units per image px) at which the image just covers the target. */
export function coverScale(image: Size, target: Size): number {
  if (!isUsableSize(image) || !isUsableSize(target)) return 1;
  return Math.max(target.width / image.width, target.height / image.height);
}

/** Scale at which the whole image just fits inside the target (letterboxed). */
export function containScale(image: Size, target: Size): number {
  if (!isUsableSize(image) || !isUsableSize(target)) return 1;
  return Math.min(target.width / image.width, target.height / image.height);
}

/** Clamp any (possibly corrupt) transform into range; zoom 1..5, offsets -1..1. */
export function clampTransform(t: Partial<PhotoTransform> | null | undefined): PhotoTransform {
  const v = t ?? {};
  return {
    scale: clamp(finite(v.scale, 1), MIN_ZOOM, MAX_ZOOM),
    offsetX: clamp(finite(v.offsetX, 0), -1, 1),
    offsetY: clamp(finite(v.offsetY, 0), -1, 1),
  };
}

/** Absolute scale (target units per image px) for a transform: always ≥ coverScale. */
export function effectiveScale(image: Size, target: Size, t: PhotoTransform): number {
  return coverScale(image, target) * clampTransform(t).scale;
}

/**
 * Where to draw the whole image, in target units, so the target shows the transform:
 * `left`/`top` are ≤ 0 and the image always reaches the far edges (no empty edges).
 * Use it for the live preview frame (target = frame in points) and for the export
 * view (target = device px / pixel ratio).
 */
export function photoLayout(image: Size, target: Size, t: PhotoTransform): Rect {
  if (!isUsableSize(target)) return { x: 0, y: 0, width: 0, height: 0 };
  if (!isUsableSize(image)) return { x: 0, y: 0, width: target.width, height: target.height };
  const c = clampTransform(t);
  const s = coverScale(image, target) * c.scale;
  const width = image.width * s;
  const height = image.height * s;
  const freeX = Math.max(0, width - target.width);
  const freeY = Math.max(0, height - target.height);
  return {
    x: -(freeX / 2) * (1 + c.offsetX),
    y: -(freeY / 2) * (1 + c.offsetY),
    width,
    height,
  };
}

/**
 * Source crop rect in image px for the transform: the part of the photo that lands on
 * the target. Exact (unrounded); always inside the image and of the target's aspect.
 */
export function sourceCrop(image: Size, target: Size, t: PhotoTransform): Rect {
  if (!isUsableSize(image) || !isUsableSize(target)) return { x: 0, y: 0, width: 0, height: 0 };
  const l = photoLayout(image, target, t);
  const s = l.width / image.width;
  const width = Math.min(image.width, target.width / s);
  const height = Math.min(image.height, target.height / s);
  return {
    x: clamp(-l.x / s, 0, image.width - width),
    y: clamp(-l.y / s, 0, image.height - height),
    width,
    height,
  };
}

/** sourceCrop rounded to whole pixels, still inside the image. */
export function sourceCropPx(image: Size, target: Size, t: PhotoTransform): Rect {
  const r = sourceCrop(image, target, t);
  const W = Math.floor(finite(image.width, 0));
  const H = Math.floor(finite(image.height, 0));
  const width = clamp(Math.round(r.width), Math.min(1, W), W);
  const height = clamp(Math.round(r.height), Math.min(1, H), H);
  return {
    x: clamp(Math.round(r.x), 0, W - width),
    y: clamp(Math.round(r.y), 0, H - height),
    width,
    height,
  };
}

/** Turn a desired image position (left/top, target units) back into clamped offsets. */
function offsetsFor(left: number, top: number, drawn: Size, frame: Size, zoom: number): PhotoTransform {
  const freeX = Math.max(0, drawn.width - frame.width);
  const freeY = Math.max(0, drawn.height - frame.height);
  // left = -(freeX / 2)(1 + offsetX)  =>  offsetX = -2·left / freeX - 1
  const offsetX = freeX > 0 ? (-2 * clamp(left, -freeX, 0)) / freeX - 1 : 0;
  const offsetY = freeY > 0 ? (-2 * clamp(top, -freeY, 0)) / freeY - 1 : 0;
  return clampTransform({ scale: zoom, offsetX, offsetY });
}

/**
 * Pan by (dx, dy) points of finger movement inside a `frame` that previews the
 * transform. The photo follows the finger and stops at its edges.
 */
export function panBy(t: PhotoTransform, dx: number, dy: number, image: Size, frame: Size): PhotoTransform {
  const c = clampTransform(t);
  if (!isUsableSize(image) || !isUsableSize(frame)) return c;
  const l = photoLayout(image, frame, c);
  return offsetsFor(l.x + finite(dx, 0), l.y + finite(dy, 0), l, frame, c.scale);
}

/**
 * Zoom by `factor` (pinch scale ratio since the last update) around `focal`
 * (frame points; default the frame centre): the photo point under the fingers stays
 * put where the clamps allow. Zoom stays within 1×..5× of cover.
 */
export function pinchBy(
  t: PhotoTransform,
  factor: number,
  image: Size,
  frame: Size,
  focal?: Point,
): PhotoTransform {
  const c = clampTransform(t);
  if (!isUsableSize(image) || !isUsableSize(frame) || !(finite(factor, 0) > 0)) return c;
  const zoom = clamp(c.scale * factor, MIN_ZOOM, MAX_ZOOM);
  const before = photoLayout(image, frame, c);
  const fx = finite(focal?.x, frame.width / 2);
  const fy = finite(focal?.y, frame.height / 2);
  const s0 = before.width / image.width;
  const s1 = coverScale(image, frame) * zoom;
  // Image point under the focal point, kept under it after the zoom.
  const u = (fx - before.x) / s0;
  const v = (fy - before.y) / s0;
  const drawn = { width: image.width * s1, height: image.height * s1 };
  return offsetsFor(fx - u * s1, fy - v * s1, drawn, frame, zoom);
}

/**
 * Pan + pinch deltas between two touch snapshots (screen points, same fingers in the
 * same order): centroid movement, distance ratio (1 for a single finger) and the
 * centroid to zoom around. Feed into panBy / pinchBy.
 */
export function touchDelta(
  prev: readonly Point[],
  next: readonly Point[],
): { dx: number; dy: number; factor: number; focal: Point } {
  const n = Math.min(prev.length, next.length);
  if (n === 0) return { dx: 0, dy: 0, factor: 1, focal: { x: 0, y: 0 } };
  const centroid = (ps: readonly Point[]): Point => {
    let x = 0;
    let y = 0;
    for (let i = 0; i < n; i++) {
      x += finite(ps[i].x, 0);
      y += finite(ps[i].y, 0);
    }
    return { x: x / n, y: y / n };
  };
  const a = centroid(prev);
  const b = centroid(next);
  let factor = 1;
  if (n >= 2) {
    const d0 = Math.hypot(prev[1].x - prev[0].x, prev[1].y - prev[0].y);
    const d1 = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
    if (Number.isFinite(d0) && Number.isFinite(d1) && d0 > 1 && d1 > 0) factor = d1 / d0;
  }
  return { dx: b.x - a.x, dy: b.y - a.y, factor, focal: b };
}

/** True when the saved wallpaper enlarges the photo enough to look soft. */
export function looksSoft(image: Size, target: Size, t: PhotoTransform): boolean {
  if (!isUsableSize(image) || !isUsableSize(target)) return false;
  return effectiveScale(image, target, t) > SOFT_UPSCALE;
}

// --- Live crop view (T37, docs/POLISH.md G4) -----------------------------------------
// The crop editor animates on the UI thread in "view space": the photo drawn at
// `zoom` x its cover size with its top-left at (x, y) frame points. These helpers are
// self-contained (no calls into the functions above) and marked 'worklet' so
// reanimated can run them on the UI thread; Node ignores the directive. The saved
// format is still PhotoTransform: convert with cropViewFor / transformForView.

export type CropView = { zoom: number; x: number; y: number };
export type CropBounds = { minX: number; maxX: number; minY: number; maxY: number };

/** Rubber-band coefficient (same as src/core/motion.ts rubberBand). */
export const CROP_RUBBER = 0.55;
/** Zoom may stretch past 1x / 5x by at most this fraction of the limit while pinching. */
export const ZOOM_STRETCH = 0.5;

function okNum(v: unknown, fallback: number): number {
  'worklet';
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function between(v: number, lo: number, hi: number): number {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
}

/** The photo's drawn size at zoom 1 (just covering the frame); the frame size when unusable. */
export function cropBaseSize(image: Size, frame: Size): Size {
  'worklet';
  const iw = okNum(image.width, 0);
  const ih = okNum(image.height, 0);
  const fw = Math.max(0, okNum(frame.width, 0));
  const fh = Math.max(0, okNum(frame.height, 0));
  if (!(iw > 0 && ih > 0 && fw > 0 && fh > 0)) return { width: fw, height: fh };
  const s = Math.max(fw / iw, fh / ih);
  return { width: iw * s, height: ih * s };
}

/**
 * Allowed top-left positions for the photo at `zoom` so it covers the frame. When the
 * drawn photo is narrower/shorter than the frame (only while a pinch rubber-bands
 * below 1x) that axis is centred (min = max).
 */
export function cropBounds(base: Size, frame: Size, zoom: number): CropBounds {
  'worklet';
  const fx = frame.width - base.width * zoom;
  const fy = frame.height - base.height * zoom;
  return {
    minX: fx < 0 ? fx : fx / 2,
    maxX: fx < 0 ? 0 : fx / 2,
    minY: fy < 0 ? fy : fy / 2,
    maxY: fy < 0 ? 0 : fy / 2,
  };
}

/**
 * Rubber-band `value` into [lo, hi]: unchanged inside; past an edge it moves less the
 * further it goes and never more than `dimension` past (iOS-style). Same maths as
 * rubberClamp in src/core/motion.ts, as a worklet.
 */
export function rubberInto(value: number, lo: number, hi: number, dimension: number, coefficient: number = CROP_RUBBER): number {
  'worklet';
  const v = okNum(value, lo);
  if (!(dimension > 0)) return between(v, lo, hi);
  let over: number;
  let edge: number;
  if (v < lo) {
    over = v - lo;
    edge = lo;
  } else if (v > hi) {
    over = v - hi;
    edge = hi;
  } else {
    return v;
  }
  const sign = over < 0 ? -1 : 1;
  const x = Math.abs(over);
  return edge + sign * (1 - 1 / ((x * coefficient) / dimension + 1)) * dimension;
}

/** Displayed zoom for a raw pinch zoom: rubber-banded past 1x / 5x, or hard-clamped when reduced. */
export function cropZoomShown(rawZoom: number, reduced: boolean): number {
  'worklet';
  const z = okNum(rawZoom, MIN_ZOOM);
  if (reduced) return between(z, MIN_ZOOM, MAX_ZOOM);
  if (z < MIN_ZOOM) return rubberInto(z, MIN_ZOOM, MAX_ZOOM, MIN_ZOOM * ZOOM_STRETCH);
  if (z > MAX_ZOOM) return rubberInto(z, MIN_ZOOM, MAX_ZOOM, MAX_ZOOM * ZOOM_STRETCH);
  return z;
}

/**
 * What the editor shows for a raw (finger-driven, unclamped) view: zoom and position
 * stretch past their limits with the rubber band, or are hard-clamped when `reduced`
 * (Reduce Motion: no rubber band).
 */
export function cropShown(raw: CropView, base: Size, frame: Size, reduced: boolean): CropView {
  'worklet';
  const zoom = cropZoomShown(raw.zoom, reduced);
  const b = cropBounds(base, frame, zoom);
  const x = okNum(raw.x, 0);
  const y = okNum(raw.y, 0);
  if (reduced) return { zoom, x: between(x, b.minX, b.maxX), y: between(y, b.minY, b.maxY) };
  return {
    zoom,
    x: rubberInto(x, b.minX, b.maxX, frame.width),
    y: rubberInto(y, b.minY, b.maxY, frame.height),
  };
}

/**
 * One pinch update on the raw view: raw zoom x `ratio`, position scaled about `focal`
 * (frame points) by the change in *displayed* zoom, so the photo point under the
 * fingers stays put even while the zoom rubber-bands.
 */
export function cropPinchStep(raw: CropView, ratio: number, focal: Point, reduced: boolean): CropView {
  'worklet';
  const r = okNum(ratio, 1);
  if (!(r > 0)) return raw;
  const z0 = okNum(raw.zoom, MIN_ZOOM);
  const zoom = z0 * r;
  const before = cropZoomShown(z0, reduced);
  const after = cropZoomShown(zoom, reduced);
  const k = before > 0 ? after / before : 1;
  const fx = okNum(focal.x, 0);
  const fy = okNum(focal.y, 0);
  return { zoom, x: fx - (fx - okNum(raw.x, 0)) * k, y: fy - (fy - okNum(raw.y, 0)) * k };
}

/**
 * Where a released view settles: zoom back inside 1x..5x (scaled about `focal`,
 * default the frame centre) and the photo back over the whole frame.
 */
export function cropSettle(shown: CropView, base: Size, frame: Size, focal?: Point): CropView {
  'worklet';
  const z0 = okNum(shown.zoom, MIN_ZOOM);
  const zoom = between(z0, MIN_ZOOM, MAX_ZOOM);
  const fx = okNum(focal ? focal.x : undefined, frame.width / 2);
  const fy = okNum(focal ? focal.y : undefined, frame.height / 2);
  const k = z0 > 0 ? zoom / z0 : 1;
  const x = fx - (fx - okNum(shown.x, 0)) * k;
  const y = fy - (fy - okNum(shown.y, 0)) * k;
  const b = cropBounds(base, frame, zoom);
  return { zoom, x: between(x, b.minX, b.maxX), y: between(y, b.minY, b.maxY) };
}

/** True when `v` is already settled (zoom in range and the photo covers the frame). */
export function cropInBounds(v: CropView, base: Size, frame: Size, eps: number = 0.01): boolean {
  'worklet';
  if (!(v.zoom >= MIN_ZOOM - 1e-6 && v.zoom <= MAX_ZOOM + 1e-6)) return false;
  const b = cropBounds(base, frame, v.zoom);
  return v.x >= b.minX - eps && v.x <= b.maxX + eps && v.y >= b.minY - eps && v.y <= b.maxY + eps;
}

/** View for a saved transform (the same x/y as photoLayout). */
export function cropViewFor(image: Size, frame: Size, t: Partial<PhotoTransform> | null | undefined): CropView {
  'worklet';
  const zoom = between(okNum(t ? t.scale : undefined, 1), MIN_ZOOM, MAX_ZOOM);
  const ox = between(okNum(t ? t.offsetX : undefined, 0), -1, 1);
  const oy = between(okNum(t ? t.offsetY : undefined, 0), -1, 1);
  const base = cropBaseSize(image, frame);
  const freeX = Math.max(0, base.width * zoom - frame.width);
  const freeY = Math.max(0, base.height * zoom - frame.height);
  return { zoom, x: -(freeX / 2) * (1 + ox), y: -(freeY / 2) * (1 + oy) };
}

/** Saved transform for a view (clamped; the inverse of cropViewFor for settled views). */
export function transformForView(image: Size, frame: Size, v: CropView): PhotoTransform {
  'worklet';
  const zoom = between(okNum(v.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const base = cropBaseSize(image, frame);
  const freeX = Math.max(0, base.width * zoom - frame.width);
  const freeY = Math.max(0, base.height * zoom - frame.height);
  // A corrupt position falls back to centred.
  const x = between(okNum(v.x, -freeX / 2), -freeX, 0);
  const y = between(okNum(v.y, -freeY / 2), -freeY, 0);
  return {
    scale: zoom,
    offsetX: freeX > 0 ? between((-2 * x) / freeX - 1, -1, 1) : 0,
    offsetY: freeY > 0 ? between((-2 * y) / freeY - 1, -1, 1) : 0,
  };
}
