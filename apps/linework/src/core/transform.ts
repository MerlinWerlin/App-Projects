// Overlay transform for the Trace screen: pan, pinch about a focal point, rotate, clamp, fit, mirror, lock.
//
// Model: an image point p (in points, relative to the image centre, before mirroring) lands on screen at
//   screen = (x, y) + R(rotation) · scale · M · p        where M = diag(mirror ? -1 : 1, 1)
// with all screen coordinates relative to the view centre. Every function is pure and returns a new object.

export type Transform = {
  x: number;
  y: number;
  scale: number;
  /** radians, normalised to [-π, π) */
  rotation: number;
  mirror: boolean;
  locked: boolean;
};

/** Cumulative gesture values since gesture start (as react-native-gesture-handler reports them). */
export type Gesture = {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
  /** focal point relative to the view centre */
  focalX: number;
  focalY: number;
};

export type TransformStyle = [
  { translateX: number },
  { translateY: number },
  { rotate: string },
  { scale: number },
  { scaleX: number },
];

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

const TWO_PI = Math.PI * 2;
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function identity(): Transform {
  return { x: 0, y: 0, scale: 1, rotation: 0, mirror: false, locked: false };
}

export function clampScale(s: number): number {
  if (!fin(s)) return s === Infinity ? MAX_SCALE : s === -Infinity ? MIN_SCALE : 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export function normalizeAngle(a: number): number {
  if (!fin(a)) return 0;
  const r = (((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI - Math.PI;
  return Object.is(r, -0) ? 0 : r;
}

/** Map a point given relative to the image centre (pre-mirror) to view-centre coordinates. */
export function imageToView(t: Transform, px: number, py: number): { x: number; y: number } {
  const mx = t.mirror ? -px : px;
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  return { x: t.x + t.scale * (c * mx - s * py), y: t.y + t.scale * (s * mx + c * py) };
}

/** Inverse of imageToView. */
export function viewToImage(t: Transform, vx: number, vy: number): { x: number; y: number } {
  const dx = vx - t.x;
  const dy = vy - t.y;
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  const ix = (c * dx + s * dy) / t.scale;
  const iy = (-s * dx + c * dy) / t.scale;
  return { x: t.mirror ? -ix : ix, y: iy };
}

export function pan(t: Transform, dx: number, dy: number): Transform {
  if (t.locked || !fin(dx) || !fin(dy)) return t;
  return { ...t, x: t.x + dx, y: t.y + dy };
}

/** Scale by `factor` about the focal point (relative to view centre); the image point under it stays put. */
export function pinch(t: Transform, factor: number, focalX: number, focalY: number): Transform {
  if (t.locked || !fin(factor) || factor <= 0 || !fin(focalX) || !fin(focalY)) return t;
  const scale = clampScale(t.scale * factor);
  const k = scale / t.scale;
  return { ...t, scale, x: focalX + k * (t.x - focalX), y: focalY + k * (t.y - focalY) };
}

/** Rotate by `dRadians` about the focal point (default: the overlay centre). */
export function rotate(t: Transform, dRadians: number, focalX?: number, focalY?: number): Transform {
  if (t.locked || !fin(dRadians)) return t;
  const fx = fin(focalX) ? focalX : t.x;
  const fy = fin(focalY) ? focalY : t.y;
  const c = Math.cos(dRadians);
  const s = Math.sin(dRadians);
  const ox = t.x - fx;
  const oy = t.y - fy;
  return {
    ...t,
    rotation: normalizeAngle(t.rotation + dRadians),
    x: fx + c * ox - s * oy,
    y: fy + s * ox + c * oy,
  };
}

/**
 * Transform from a gesture-start snapshot plus cumulative gesture values.
 * Order: scale and rotate about the focal point, then pan. Locked → start unchanged.
 * Non-finite gesture fields fall back to neutral values (no pan, scale 1, no rotation, focal = overlay centre).
 */
export function applyGesture(start: Transform, g: Partial<Gesture>): Transform {
  if (start.locked) return start;
  const fx = fin(g.focalX) ? g.focalX : start.x;
  const fy = fin(g.focalY) ? g.focalY : start.y;
  const factor = fin(g.scale) && g.scale > 0 ? g.scale : 1;
  const r = fin(g.rotation) ? g.rotation : 0;
  let t = pinch(start, factor, fx, fy);
  t = rotate(t, r, fx, fy);
  return pan(t, fin(g.dx) ? g.dx : 0, fin(g.dy) ? g.dy : 0);
}

/** Scale at which an image of natural size imgW×imgH (points) fits inside viewW×viewH times `margin`. */
export function fitScale(imgW: number, imgH: number, viewW: number, viewH: number, margin = 0.9): number {
  if (![imgW, imgH, viewW, viewH].every((n) => fin(n) && n > 0)) return 1;
  const m = fin(margin) && margin > 0 ? margin : 0.9;
  return clampScale(Math.min(viewW / imgW, viewH / imgH) * m);
}

export function fitToView(imgW: number, imgH: number, viewW: number, viewH: number, margin = 0.9): Transform {
  return { ...identity(), scale: fitScale(imgW, imgH, viewW, viewH, margin) };
}

/** Back to the fitted, centred, unrotated state; keeps the given mirror flag and unlocks. */
export function reset(imgW: number, imgH: number, viewW: number, viewH: number, mirror = false): Transform {
  return { ...fitToView(imgW, imgH, viewW, viewH), mirror: mirror === true };
}

/** Flip the mirror flag. Mirroring is about the overlay's own axis, so position is unchanged. No-op when locked. */
export function toggleMirror(t: Transform): Transform {
  if (t.locked) return t;
  return { ...t, mirror: !t.mirror };
}

export function setLocked(t: Transform, locked: boolean): Transform {
  return t.locked === locked ? t : { ...t, locked };
}

/** RN `transform` style. RN applies the array right-to-left to points, matching the model above. */
export function toStyle(t: Transform): TransformStyle {
  const deg = (t.rotation * 180) / Math.PI;
  return [
    { translateX: fin(t.x) ? t.x : 0 },
    { translateY: fin(t.y) ? t.y : 0 },
    { rotate: `${fin(deg) ? deg : 0}deg` },
    { scale: clampScale(t.scale) },
    { scaleX: t.mirror ? -1 : 1 },
  ];
}
