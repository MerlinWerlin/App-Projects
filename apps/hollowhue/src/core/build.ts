// Authoring helpers for scene line art. Every shape becomes SVG path data (absolute M/L/C/Q/Z only),
// so the same string draws the art and drives tap-to-fill hit testing.
import type { Level, Region } from './scene.ts';

const f = (v: number) => String(Math.round(v * 100) / 100);
const K = 0.5523; // cubic circle constant

export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (r <= 0) return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
  const q = Math.min(r, w / 2, h / 2);
  const c = q * (1 - K);
  return (
    `M${f(x + q)} ${f(y)}H${f(x + w - q)}C${f(x + w - c)} ${f(y)} ${f(x + w)} ${f(y + c)} ${f(x + w)} ${f(y + q)}` +
    `V${f(y + h - q)}C${f(x + w)} ${f(y + h - c)} ${f(x + w - c)} ${f(y + h)} ${f(x + w - q)} ${f(y + h)}` +
    `H${f(x + q)}C${f(x + c)} ${f(y + h)} ${f(x)} ${f(y + h - c)} ${f(x)} ${f(y + h - q)}` +
    `V${f(y + q)}C${f(x)} ${f(y + c)} ${f(x + c)} ${f(y)} ${f(x + q)} ${f(y)}Z`
  );
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rx * K;
  const ky = ry * K;
  return (
    `M${f(cx + rx)} ${f(cy)}C${f(cx + rx)} ${f(cy + ky)} ${f(cx + kx)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)}` +
    `C${f(cx - kx)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ky)} ${f(cx - rx)} ${f(cy)}` +
    `C${f(cx - rx)} ${f(cy - ky)} ${f(cx - kx)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)}` +
    `C${f(cx + kx)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ky)} ${f(cx + rx)} ${f(cy)}Z`
  );
}

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);

export function poly(pts: number[]): string {
  let d = `M${f(pts[0]!)} ${f(pts[1]!)}`;
  for (let i = 2; i < pts.length; i += 2) d += `L${f(pts[i]!)} ${f(pts[i + 1]!)}`;
  return d + 'Z';
}

/** Open polyline (for detail lines only). */
export function line(pts: number[]): string {
  let d = `M${f(pts[0]!)} ${f(pts[1]!)}`;
  for (let i = 2; i < pts.length; i += 2) d += `L${f(pts[i]!)} ${f(pts[i + 1]!)}`;
  return d;
}

/** Closed smooth shape through points (Catmull-Rom converted to cubics). Good for leaves, blobs, cats. */
export function smooth(pts: number[], tension = 1): string {
  const n = pts.length / 2;
  const P = (i: number) => {
    const k = ((i % n) + n) % n;
    return [pts[k * 2]!, pts[k * 2 + 1]!] as const;
  };
  let d = `M${f(P(0)[0])} ${f(P(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = P(i - 1);
    const [x1, y1] = P(i);
    const [x2, y2] = P(i + 1);
    const [x3, y3] = P(i + 2);
    const t = tension / 6;
    d += `C${f(x1 + (x2 - x0) * t)} ${f(y1 + (y2 - y0) * t)} ${f(x2 - (x3 - x1) * t)} ${f(y2 - (y3 - y1) * t)} ${f(x2)} ${f(y2)}`;
  }
  return d + 'Z';
}

/** Open smooth curve through points (detail lines: whiskers, fur, smoke). */
export function curve(pts: number[], tension = 1): string {
  const n = pts.length / 2;
  const P = (i: number) => {
    const k = Math.max(0, Math.min(n - 1, i));
    return [pts[k * 2]!, pts[k * 2 + 1]!] as const;
  };
  let d = `M${f(P(0)[0])} ${f(P(0)[1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = P(i - 1);
    const [x1, y1] = P(i);
    const [x2, y2] = P(i + 1);
    const [x3, y3] = P(i + 2);
    const t = tension / 6;
    d += `C${f(x1 + (x2 - x0) * t)} ${f(y1 + (y2 - y0) * t)} ${f(x2 - (x3 - x1) * t)} ${f(y2 - (y3 - y1) * t)} ${f(x2)} ${f(y2)}`;
  }
  return d;
}

/** Scalloped blob around an ellipse: clouds, bushes, tree tops, cushions. */
export function scallop(cx: number, cy: number, rx: number, ry: number, n: number, bulge = 0.35, rot = 0): string {
  const pt = (a: number, s = 1) => [cx + Math.cos(a) * rx * s, cy + Math.sin(a) * ry * s] as const;
  const a0 = rot;
  let [px, py] = pt(a0);
  let d = `M${f(px)} ${f(py)}`;
  for (let i = 1; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const am = a0 + ((i - 0.5) / n) * Math.PI * 2;
    const [qx, qy] = pt(am, 1 + bulge * 2);
    [px, py] = pt(a);
    d += `Q${f(qx)} ${f(qy)} ${f(px)} ${f(py)}`;
  }
  return d + 'Z';
}

/** Petal from (cx,cy) pointing at angle a, from radius r0 to r1 with half-width w. */
export function petal(cx: number, cy: number, a: number, r0: number, r1: number, w: number, pointy = false): string {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const vx = -uy;
  const vy = ux;
  const b = [cx + ux * r0, cy + uy * r0];
  const tip = [cx + ux * r1, cy + uy * r1];
  const mid = r0 + (r1 - r0) * 0.5;
  const s = pointy ? 1.25 : 1.6;
  const L1 = [cx + ux * mid + vx * w * s, cy + uy * mid + vy * w * s];
  const R1 = [cx + ux * mid - vx * w * s, cy + uy * mid - vy * w * s];
  const tl = pointy ? tip : [tip[0]! + vx * w * 0.9, tip[1]! + vy * w * 0.9];
  const tr = pointy ? tip : [tip[0]! - vx * w * 0.9, tip[1]! - vy * w * 0.9];
  return (
    `M${f(b[0]!)} ${f(b[1]!)}Q${f(L1[0]!)} ${f(L1[1]!)} ${f(tl[0]!)} ${f(tl[1]!)}` +
    (pointy ? '' : `Q${f(tip[0]! + ux * w * 0.6)} ${f(tip[1]! + uy * w * 0.6)} ${f(tr[0]!)} ${f(tr[1]!)}`) +
    `Q${f(R1[0]!)} ${f(R1[1]!)} ${f(b[0]!)} ${f(b[1]!)}Z`
  );
}

/** Ring band between two circles (even-odd hole). */
export const ring = (cx: number, cy: number, r0: number, r1: number) => circle(cx, cy, r1) + circle(cx, cy, r0);

/** Rectangle with rectangular holes (window frames). */
export function frame(x: number, y: number, w: number, h: number, holes: [number, number, number, number][], r = 0): string {
  return rect(x, y, w, h, r) + holes.map(([hx, hy, hw, hh]) => rect(hx, hy, hw, hh)).join('');
}

/** Rotate a point list around (cx,cy) by deg. */
export function rot(pts: number[], cx: number, cy: number, deg: number): number[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i]! - cx;
    const dy = pts[i + 1]! - cy;
    out.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return out;
}

export const rectPts = (x: number, y: number, w: number, h: number) => [x, y, x + w, y, x + w, y + h, x, y + h];

/** Builds one level's region list with readable, stable ids. */
export class LevelArt {
  readonly regions: Region[] = [];
  private n = new Map<string, number>();
  readonly id: string;
  readonly w: number;
  readonly h: number;

  constructor(id: string, w = 1200, h = 900) {
    this.id = id;
    this.w = w;
    this.h = h;
  }

  /** A fillable region. Later regions draw on top and win taps. */
  fill(name: string, d: string, from?: string): string {
    const k = (this.n.get(name) ?? 0) + 1;
    this.n.set(name, k);
    const id = k === 1 ? name : `${name}${k}`;
    this.regions.push(from ? { id, d, from } : { id, d });
    return id;
  }

  /** A line that is drawn but can't be filled (spines, whiskers, wood grain). */
  ink(d: string, weight = 0.6): void {
    const k = (this.n.get('_') ?? 0) + 1;
    this.n.set('_', k);
    this.regions.push({ id: `_${k}`, d, line: weight });
  }

  level(extra: Omit<Level, 'id' | 'w' | 'h' | 'regions'>): Level {
    return { id: this.id, w: this.w, h: this.h, regions: this.regions, ...extra };
  }
}
