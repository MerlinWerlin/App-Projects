// Pure geometry for line art: parse SVG path data, flatten curves to polygons, point-in-shape tests.
// No React Native imports, so it runs under `node --test`.

export type Pt = { x: number; y: number };
export type Ring = number[]; // flat [x0, y0, x1, y1, ...], implicitly closed
export type BBox = { x: number; y: number; w: number; h: number };

const CMD = /([MmLlHhVvCcQqSsTtZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

/** Tokenise path data into commands and numbers. Throws on anything it can't read (caught by scene tests). */
function tokens(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const m of d.matchAll(CMD)) out.push(m[1] ? m[1] : Number(m[2]));
  return out;
}

/**
 * Flatten a path to closed rings (one per subpath). Supports M L H V C S Q T Z, absolute and relative.
 * Curves are split into `steps` segments, which is plenty for hit testing at any zoom we allow.
 */
export function flatten(d: string, steps = 10): Ring[] {
  const tk = tokens(d);
  const rings: Ring[] = [];
  let ring: Ring = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lcx = 0; // last control point (for S / T)
  let lcy = 0;
  let lastCmd = '';
  const num = (): number => {
    const v = tk[i++];
    if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`bad path data near token ${i} in "${d.slice(0, 60)}"`);
    return v;
  };
  const close = () => {
    if (ring.length >= 4) rings.push(ring);
    ring = [];
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      ring.push(
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey,
      );
    }
    lcx = x2;
    lcy = y2;
    x = ex;
    y = ey;
  };
  const quad = (x1: number, y1: number, ex: number, ey: number) => {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      ring.push(u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey);
    }
    lcx = x1;
    lcy = y1;
    x = ex;
    y = ey;
  };
  while (i < tk.length) {
    const t = tk[i];
    if (typeof t === 'string') {
      cmd = t;
      i++;
    } else if (!cmd) {
      throw new Error(`path must start with a command: "${d.slice(0, 60)}"`);
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        close();
        x = ox + num();
        y = oy + num();
        sx = x;
        sy = y;
        ring.push(x, y);
        cmd = rel ? 'l' : 'L'; // implicit lineto after the first pair
        break;
      }
      case 'L':
        x = ox + num();
        y = oy + num();
        ring.push(x, y);
        break;
      case 'H':
        x = ox + num();
        ring.push(x, y);
        break;
      case 'V':
        y = oy + num();
        ring.push(x, y);
        break;
      case 'C': {
        const x1 = ox + num();
        const y1 = oy + num();
        const x2 = ox + num();
        const y2 = oy + num();
        cubic(x1, y1, x2, y2, ox + num(), oy + num());
        break;
      }
      case 'S': {
        const rx = 'CcSs'.includes(lastCmd) ? 2 * x - lcx : x;
        const ry = 'CcSs'.includes(lastCmd) ? 2 * y - lcy : y;
        const x2 = ox + num();
        const y2 = oy + num();
        cubic(rx, ry, x2, y2, ox + num(), oy + num());
        break;
      }
      case 'Q': {
        const x1 = ox + num();
        const y1 = oy + num();
        quad(x1, y1, ox + num(), oy + num());
        break;
      }
      case 'T': {
        const rx = 'QqTt'.includes(lastCmd) ? 2 * x - lcx : x;
        const ry = 'QqTt'.includes(lastCmd) ? 2 * y - lcy : y;
        quad(rx, ry, ox + num(), oy + num());
        break;
      }
      case 'Z':
        x = sx;
        y = sy;
        close();
        break;
      default:
        throw new Error(`unsupported path command ${cmd}`);
    }
    lastCmd = cmd;
  }
  close();
  return rings;
}

/** Even-odd point-in-polygon over all rings (holes work by drawing an inner ring). */
export function inRings(rings: Ring[], px: number, py: number): boolean {
  let inside = false;
  for (const r of rings) {
    const n = r.length / 2;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const xa = r[a * 2]!;
      const ya = r[a * 2 + 1]!;
      const xb = r[b * 2]!;
      const yb = r[b * 2 + 1]!;
      if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
    }
  }
  return inside;
}

export function bboxOf(rings: Ring[]): BBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rings)
    for (let k = 0; k < r.length; k += 2) {
      x0 = Math.min(x0, r[k]!);
      x1 = Math.max(x1, r[k]!);
      y0 = Math.min(y0, r[k + 1]!);
      y1 = Math.max(y1, r[k + 1]!);
    }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Signed-area magnitude with even-odd semantics approximated by summing |ring areas| of outer minus holes. */
export function ringArea(r: Ring): number {
  let a = 0;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += (r[j * 2]! + r[i * 2]!) * (r[j * 2 + 1]! - r[i * 2 + 1]!);
  return Math.abs(a / 2);
}

export function inBox(b: BBox, x: number, y: number): boolean {
  return x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
}

/** Distance from a point to a segment, for the stroke eraser. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Simplify a freehand polyline (radial distance), keeping first and last points. */
export function simplify(pts: number[], minDist: number): number[] {
  if (pts.length <= 4) return pts.slice();
  const out = [pts[0]!, pts[1]!];
  let lx = pts[0]!;
  let ly = pts[1]!;
  for (let k = 2; k < pts.length - 2; k += 2) {
    if (Math.hypot(pts[k]! - lx, pts[k + 1]! - ly) >= minDist) {
      out.push(pts[k]!, pts[k + 1]!);
      lx = pts[k]!;
      ly = pts[k + 1]!;
    }
  }
  out.push(pts[pts.length - 2]!, pts[pts.length - 1]!);
  return out;
}

/** Smooth SVG path through freehand points (quadratic midpoints), rounded to 2 decimals to keep saves small. */
export function strokePath(pts: number[]): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  const n = pts.length / 2;
  if (n === 0) return '';
  if (n === 1) return `M${r(pts[0]!)} ${r(pts[1]!)}l0.01 0`;
  if (n === 2) return `M${r(pts[0]!)} ${r(pts[1]!)}L${r(pts[2]!)} ${r(pts[3]!)}`;
  let d = `M${r(pts[0]!)} ${r(pts[1]!)}`;
  for (let k = 1; k < n - 1; k++) {
    const mx = (pts[k * 2]! + pts[k * 2 + 2]!) / 2;
    const my = (pts[k * 2 + 1]! + pts[k * 2 + 3]!) / 2;
    d += `Q${r(pts[k * 2]!)} ${r(pts[k * 2 + 1]!)} ${r(mx)} ${r(my)}`;
  }
  d += `L${r(pts[(n - 1) * 2]!)} ${r(pts[(n - 1) * 2 + 1]!)}`;
  return d;
}
