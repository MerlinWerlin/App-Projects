// Occlusion helpers for layered line art: hide the part of an outline that lies behind another closed shape,
// so overlapping shapes read as one drawing (a head in front of a body, ears behind a head) instead of
// crossing lines. Pure geometry on absolute-command paths (M L C Q A Z) as emitted by draw.ts.
import { f, type P } from './draw.ts';

type Sub = { pts: P[]; closed: boolean };

const ARGS: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };

function arcPoints(x1: number, y1: number, a: number[], step: number): P[] {
  let [rx, ry] = [Math.abs(a[0]), Math.abs(a[1])];
  const [phiDeg, fa, fs, x2, y2] = [a[2], a[3], a[4], a[5], a[6]];
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (fa !== fs ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const th1 = ang(1, 0, ux, uy);
  let dth = ang(ux, uy, vx, vy);
  if (!fs && dth > 0) dth -= 2 * Math.PI;
  if (fs && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(4, Math.ceil((Math.abs(dth) * Math.max(rx, ry)) / step));
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const t = th1 + (dth * i) / n;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push([cx + ex * cos - ey * sin, cy + ex * sin + ey * cos]);
  }
  out[out.length - 1] = [x2, y2];
  return out;
}

/** Sample every subpath of an absolute-command path into points about `step` apart. */
export function samplePath(d: string, step = 2): Sub[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const subs: Sub[] = [];
  let cur: Sub | null = null;
  let x = 0;
  let y = 0;
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/[A-Za-z]/.test(tok)) {
      if (!(tok in ARGS)) throw new Error(`samplePath: unsupported command ${tok}`);
      cmd = tok;
      i++;
      if (cmd === 'Z') {
        if (cur) {
          cur.closed = true;
          const [sx, sy] = cur.pts[0];
          const n = Math.max(1, Math.ceil(Math.hypot(sx - x, sy - y) / step));
          for (let k = 1; k <= n; k++) cur.pts.push([x + ((sx - x) * k) / n, y + ((sy - y) * k) / n]);
          x = sx;
          y = sy;
        }
        continue;
      }
    }
    const v = tokens.slice(i, i + ARGS[cmd]).map(Number);
    i += ARGS[cmd];
    if (cmd === 'M') {
      cur = { pts: [[v[0], v[1]]], closed: false };
      subs.push(cur);
      [x, y] = v;
      cmd = 'L';
      continue;
    }
    if (!cur) throw new Error('samplePath: path must start with M');
    if (cmd === 'L') {
      const n = Math.max(1, Math.ceil(Math.hypot(v[0] - x, v[1] - y) / step));
      for (let k = 1; k <= n; k++) cur.pts.push([x + ((v[0] - x) * k) / n, y + ((v[1] - y) * k) / n]);
      [x, y] = v;
    } else if (cmd === 'C' || cmd === 'Q') {
      const ctrl: P[] =
        cmd === 'C'
          ? [[x, y], [v[0], v[1]], [v[2], v[3]], [v[4], v[5]]]
          : [[x, y], [v[0], v[1]], [v[0], v[1]], [v[2], v[3]]];
      if (cmd === 'Q') {
        // elevate the quadratic to a cubic
        ctrl[1] = [x + (2 / 3) * (v[0] - x), y + (2 / 3) * (v[1] - y)];
        ctrl[2] = [v[2] + (2 / 3) * (v[0] - v[2]), v[3] + (2 / 3) * (v[1] - v[3])];
      }
      let len = 0;
      for (let k = 1; k < 4; k++) len += Math.hypot(ctrl[k][0] - ctrl[k - 1][0], ctrl[k][1] - ctrl[k - 1][1]);
      const n = Math.max(4, Math.ceil(len / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        cur.pts.push([
          u * u * u * ctrl[0][0] + 3 * u * u * t * ctrl[1][0] + 3 * u * t * t * ctrl[2][0] + t * t * t * ctrl[3][0],
          u * u * u * ctrl[0][1] + 3 * u * u * t * ctrl[1][1] + 3 * u * t * t * ctrl[2][1] + t * t * t * ctrl[3][1],
        ]);
      }
      x = cmd === 'C' ? v[4] : v[2];
      y = cmd === 'C' ? v[5] : v[3];
    } else if (cmd === 'A') {
      cur.pts.push(...arcPoints(x, y, v, step));
      [x, y] = [v[5], v[6]];
    }
  }
  return subs;
}

/** A filled region: one closed shape (even-odd over its subpaths), or several shapes (inside any of them). */
export type Region = { parts: { polys: P[][]; box: [number, number, number, number] }[] };

/** A layer is one closed shape, or an array of overlapping closed shapes drawn as their merged outline. */
export type Layer = string | readonly string[];

export function region(layer: Layer): Region {
  const shapes = typeof layer === 'string' ? [layer] : layer;
  return {
    parts: shapes.map((d) => {
      const polys = samplePath(d, 1.5).map((s) => s.pts);
      const xs = polys.flat().map((p) => p[0]);
      const ys = polys.flat().map((p) => p[1]);
      return { polys, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number] };
    }),
  };
}

function insideRegion(r: Region, x: number, y: number): boolean {
  return r.parts.some((part) => {
    if (x < part.box[0] || x > part.box[2] || y < part.box[1] || y > part.box[3]) return false;
    let inside = false;
    for (const poly of part.polys) {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

/** Ramer–Douglas–Peucker simplification of a polyline. */
function simplify(pts: P[], tol: number): P[] {
  if (pts.length < 3) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1;
    let bestD = tol;
    for (let k = a + 1; k < b; k++) {
      const dist = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / len;
      if (dist > bestD) {
        bestD = dist;
        best = k;
      }
    }
    if (best >= 0) {
      keep[best] = true;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

function polyline(pts: P[]): string {
  const s = simplify(pts, 0.12);
  return s.map((p, k) => `${k === 0 ? 'M' : 'L'} ${f(p[0])} ${f(p[1])}`).join(' ');
}

/**
 * Keep the part of `d` outside every region in `hide` (mode 'outside'), or only the part inside the first
 * region (mode 'inside'). Subpaths that need no clipping keep their exact curves; clipped subpaths become
 * fine polylines with the cut points found by bisection.
 */
export function clip(d: string, hide: readonly Region[], mode: 'outside' | 'inside' = 'outside'): string {
  const visible = (x: number, y: number): boolean =>
    mode === 'inside' ? hide.every((r) => insideRegion(r, x, y)) : !hide.some((r) => insideRegion(r, x, y));
  const out: string[] = [];
  for (const part of d.split(/(?=M)/).map((s) => s.trim()).filter(Boolean)) {
    const [sub] = samplePath(part, 1.5);
    const vis = sub.pts.map(([x, y]) => visible(x, y));
    if (vis.every(Boolean)) {
      out.push(part);
      continue;
    }
    if (!vis.some(Boolean)) continue;
    const runs: P[][] = [];
    let run: P[] | null = vis[0] ? [sub.pts[0]] : null;
    for (let k = 1; k < sub.pts.length; k++) {
      const a = sub.pts[k - 1];
      const b = sub.pts[k];
      if (vis[k] !== vis[k - 1]) {
        let lo = 0;
        let hi = 1;
        for (let it = 0; it < 14; it++) {
          const mid = (lo + hi) / 2;
          const m: P = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
          if (visible(m[0], m[1]) === vis[k - 1]) lo = mid;
          else hi = mid;
        }
        const cut: P = [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo];
        if (run) {
          run.push(cut);
          runs.push(run);
          run = null;
        } else run = [cut, b];
      } else if (run) run.push(b);
    }
    if (run) runs.push(run);
    if (sub.closed && runs.length > 1 && vis[0] && vis[vis.length - 1]) {
      const last = runs.pop()!;
      runs[0] = [...last, ...runs[0].slice(1)];
    }
    for (const r of runs) if (r.length > 1) out.push(polyline(r));
  }
  return out.join(' ');
}

/** The drawn outline of a layer (a merged outline for an array of shapes). */
export function outline(layer: Layer): string {
  return typeof layer === 'string' ? layer : union(layer);
}

/**
 * Layer closed shapes front to back: each outline is clipped by every layer listed before it.
 * Empty results are dropped.
 */
export function stack(layers: readonly Layer[]): string[] {
  const regions: Region[] = [];
  const out: string[] = [];
  for (const layer of layers) {
    const d = outline(layer);
    const c = regions.length ? clip(d, regions) : d;
    if (c) out.push(c);
    regions.push(region(layer));
  }
  return out;
}

/** One merged outline from overlapping closed shapes (every shape clipped by all the others). */
export function union(shapes: readonly string[]): string {
  const regions = shapes.map((d) => region(d));
  return shapes
    .map((d, i) => clip(d, regions.filter((_, j) => j !== i)))
    .filter(Boolean)
    .join(' ');
}

/** Polygon with every corner rounded by a quadratic curve (r = distance cut back along each edge). */
export function roundPoly(points: readonly P[], r: number): string {
  const n = points.length;
  const cut = (from: P, to: P, dist: number): P => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const t = Math.min(0.5, dist / len);
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  };
  let d = '';
  for (let i = 0; i < n; i++) {
    const v = points[i];
    const a = cut(v, points[(i - 1 + n) % n], r);
    const b = cut(v, points[(i + 1) % n], r);
    d += `${i === 0 ? 'M' : ' L'} ${f(a[0])} ${f(a[1])} Q ${f(v[0])} ${f(v[1])} ${f(b[0])} ${f(b[1])}`;
  }
  return `${d} Z`;
}
