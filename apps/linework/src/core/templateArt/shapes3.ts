// shapes3 template batch (T137, fb-1023b, 23 Oct 2026): more drawing-practice forms and shape exercises on a 400×400
// canvas. Original line art computed here: polyhedra are built as convex hulls and projected with hidden edges removed
// (or drawn as thin dashed construction lines), curved solids are sampled and projected, and flat exercises come from
// regular geometry. Shading is parallel hatching clipped to each face; overlaps between solids use occlude.ts.
// See docs/TEMPLATES.md.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, f, line, ngon, poly, polar, type P } from './draw.ts';
import { clip, region, type Region } from './occlude.ts';

const VB = '0 0 400 400';

type V3 = readonly [number, number, number];
type Art = { p: string[]; d: string[] };

const rad = (d: number): number => (d * Math.PI) / 180;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));

// ---- parallel camera ---------------------------------------------------------------------------------------------

/** Turn about the vertical axis by az, then tilt to look down by el (degrees). +z of the result points at the eye. */
type Cam = { az: number; el: number; k: number; cx: number; cy: number };

function view(c: Cam, p: V3): V3 {
  const a = rad(c.az);
  const e = rad(c.el);
  const x1 = p[0] * Math.cos(a) + p[2] * Math.sin(a);
  const z1 = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
  return [x1, p[1] * Math.cos(e) - z1 * Math.sin(e), p[1] * Math.sin(e) + z1 * Math.cos(e)];
}
const pr = (c: Cam, p: V3): P => {
  const v = view(c, p);
  return [c.cx + c.k * v[0], c.cy - c.k * v[1]];
};
const facing = (c: Cam, n: V3): boolean => view(c, n)[2] > 1e-6;

// ---- 2D helpers --------------------------------------------------------------------------------------------------

const pl = (pts: readonly P[]): string => pts.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ');

/** Runs of consecutive visible points as polylines (closed loops wrap around). */
function runs(pts: readonly P[], vis: readonly boolean[], closed = true): string {
  const n = pts.length;
  if (vis.every(Boolean)) return closed ? `${pl(pts)} Z` : pl(pts);
  const out: string[] = [];
  let start = 0;
  if (closed) while (vis[start]) start++;
  let cur: P[] = [];
  for (let s = 0; s <= (closed ? n : n - 1); s++) {
    const i = (start + s) % n;
    if (vis[i]) cur.push(pts[i]);
    else {
      if (cur.length > 1) out.push(pl(cur));
      cur = [];
    }
  }
  if (cur.length > 1) out.push(pl(cur));
  return out.join(' ');
}

function dashLine(a: P, b: P, dash = 7, gap = 6): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  let d = '';
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    d += `M ${f(a[0] + ux * s)} ${f(a[1] + uy * s)} L ${f(a[0] + ux * e)} ${f(a[1] + uy * e)} `;
  }
  return d.trim();
}

/** Dashed polyline through points (dashes restart per segment). */
const dashPoly = (pts: readonly P[]): string =>
  pts.slice(1).map((p, i) => dashLine(pts[i], p, 5, 5)).join(' ');

/** 2D convex hull (monotone chain). */
function hull2(pts: readonly P[]): P[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = [];
  for (const p of s) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up: P[] = [];
  for (const p of [...s].reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Grow a polygon about its centroid (so a region safely covers outlines that coincide with its edge). */
function grow(pts: readonly P[], by: number): P[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => {
    const l = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / l) * by, y + ((y - cy) / l) * by] as P;
  });
}

/** Parallel hatching of a polygon (even-odd) at angle deg with spacing gap. */
function hatch(pts: readonly P[], deg: number, gap: number, phase = 0.5): string {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const r = pts.map(([x, y]) => [x * c + y * s, -x * s + y * c] as P);
  const ys = r.map((p) => p[1]);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  let d = '';
  for (let y = y0 + gap * phase; y < y1; y += gap) {
    const xs: number[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] < 3) continue;
      const A: P = [xs[i] * c - y * s, xs[i] * s + y * c];
      const B: P = [xs[i + 1] * c - y * s, xs[i + 1] * s + y * c];
      d += `M ${f(A[0])} ${f(A[1])} L ${f(B[0])} ${f(B[1])} `;
    }
  }
  return d.trim();
}

// ---- convex polyhedra --------------------------------------------------------------------------------------------

type Face = { idx: number[]; n: V3 };

/** Faces of the convex hull of V (brute force; fine for a few dozen vertices), each ordered around its normal. */
function hullFaces(V: readonly V3[]): Face[] {
  const c = mul(V.reduce((s, v) => add(s, v), [0, 0, 0] as V3), 1 / V.length);
  const out: Face[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < V.length; i++)
    for (let j = i + 1; j < V.length; j++)
      for (let k = j + 1; k < V.length; k++) {
        let n = cross(sub(V[j], V[i]), sub(V[k], V[i]));
        const len = Math.hypot(n[0], n[1], n[2]);
        if (len < 1e-9) continue;
        n = mul(n, 1 / len);
        if (dot(n, sub(V[i], c)) < 0) n = mul(n, -1);
        const dd = dot(n, V[i]);
        if (!V.every((v) => dot(n, v) <= dd + 1e-6)) continue;
        const members = V.map((v, m) => (Math.abs(dot(n, v) - dd) < 1e-6 ? m : -1)).filter((m) => m >= 0);
        const key = members.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const fc = mul(members.reduce((s, m) => add(s, V[m]), [0, 0, 0] as V3), 1 / members.length);
        const u = norm(sub(V[members[0]], fc));
        const w = cross(n, u);
        members.sort((a, b) => {
          const pa = sub(V[a], fc);
          const pb = sub(V[b], fc);
          return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u));
        });
        out.push({ idx: members, n });
      }
  return out;
}

type Solid = { faces: { pts: P[]; n: V3; vis: boolean }[]; edges: string; hidden: string; outline: P[] };

/** Project a convex polyhedron: visible edges as one path, hidden edges dashed, faces for shading. */
function solid(c: Cam, V: readonly V3[]): Solid {
  const F = hullFaces(V);
  const P2 = V.map((v) => pr(c, v));
  const edgeVis = new Map<string, boolean>();
  for (const fc of F) {
    const vis = facing(c, fc.n);
    for (let i = 0; i < fc.idx.length; i++) {
      const a = fc.idx[i];
      const b = fc.idx[(i + 1) % fc.idx.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeVis.set(key, (edgeVis.get(key) ?? false) || vis);
    }
  }
  let edges = '';
  let hidden = '';
  for (const [key, vis] of edgeVis) {
    const [a, b] = key.split('-').map(Number);
    if (vis) edges += `${line(P2[a][0], P2[a][1], P2[b][0], P2[b][1])} `;
    else hidden += `${dashLine(P2[a], P2[b], 6, 6)} `;
  }
  return {
    faces: F.map((fc) => ({ pts: fc.idx.map((i) => P2[i]), n: fc.n, vis: facing(c, fc.n) })),
    edges: edges.trim(),
    hidden: hidden.trim(),
    outline: hull2(P2),
  };
}

const PHI = (1 + Math.sqrt(5)) / 2;

function icosaVerts(): V3[] {
  const V: V3[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) V.push([0, a, b], [a, b, 0], [b, 0, a]);
  return V;
}

function dodecaVerts(): V3[] {
  const V: V3[] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const cc of [-1, 1]) V.push([a, b, cc]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) V.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]);
  return V;
}

const ringV = (r: number, n: number, y: number, rot = 0): V3[] =>
  Array.from({ length: n }, (_, i) => [r * Math.cos(rad(rot + (360 * i) / n)), y, r * Math.sin(rad(rot + (360 * i) / n))] as V3);

/** A polyhedron drawing: visible edges, hidden edges dashed, a soft ground line. */
function polyArt(c: Cam, V: readonly V3[], extra: string[] = []): Art {
  const s = solid(c, V);
  return { p: [s.edges], d: [s.hidden, ...extra].filter(Boolean) };
}

// ---- beginner ----------------------------------------------------------------------------------------------------

function octahedron(): Art {
  const V: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1.25, 0], [0, -1.25, 0], [0, 0, 1], [0, 0, -1]];
  return polyArt({ az: 22, el: 14, k: 140, cx: 200, cy: 200 }, V);
}

function tetrahedron(): Art {
  const r = Math.sqrt(8 / 9);
  const V: V3[] = [[0, 1, 0], ...ringV(r, 3, -1 / 3, 100)];
  const c: Cam = { az: 0, el: 16, k: 205, cx: 200, cy: 230 };
  return polyArt(c, V);
}

function hexPrism(): Art {
  const V: V3[] = [...ringV(1, 6, 0.95, 15), ...ringV(1, 6, -0.95, 15)];
  return polyArt({ az: 0, el: 24, k: 138, cx: 200, cy: 198 }, V);
}

function pentPyramid(): Art {
  const V: V3[] = [[0, 1.05, 0], ...ringV(1, 5, -0.7, 8)];
  return polyArt({ az: 0, el: 20, k: 155, cx: 200, cy: 195 }, V);
}

function lyingCylinder(): Art {
  const [lx, rx, cy, ex, ey] = [118, 286, 200, 50, 112];
  const top = cy - ey;
  const bot = cy + ey;
  const right = `M ${rx - ex} ${cy} A ${ex} ${ey} 0 1 0 ${rx + ex} ${cy} A ${ex} ${ey} 0 1 0 ${rx - ex} ${cy} Z`;
  const left = `M ${lx} ${top} A ${ex} ${ey} 0 0 0 ${lx} ${bot}`;
  const sides = `M ${lx} ${top} L ${rx} ${top} M ${lx} ${bot} L ${rx} ${bot}`;
  const back = dashPoly(Array.from({ length: 25 }, (_, i) => {
    const t = rad(-90 + (180 * i) / 24);
    return [lx + ex * Math.cos(t), cy + ey * Math.sin(t)] as P;
  }));
  return {
    p: [right, left, sides],
    d: [back, dashLine([lx, cy], [rx, cy]), line(rx - 10, cy, rx + 10, cy), line(rx, cy - 10, rx, cy + 10), 'M 60 330 L 340 330'],
  };
}

function halfSphere(): Art {
  const c: Cam = { az: 0, el: 18, k: 150, cx: 200, cy: 262 };
  const N = 96;
  const loop = (fn: (t: number) => V3) => Array.from({ length: N }, (_, i) => fn((360 * i) / N));
  const base = loop((t) => [Math.cos(rad(t)), 0, Math.sin(rad(t))]);
  const baseVis = base.map((p) => view(c, p)[2] > 0);
  const p: string[] = [];
  // dome silhouette: the top half of the view circle
  const sil: P[] = Array.from({ length: 49 }, (_, i) => [200 - 150 * Math.cos(rad((180 * i) / 48)), 262 - 150 * Math.sin(rad((180 * i) / 48))] as P);
  const lo = pr(c, [-1, 0, 0]);
  p.push(`${pl([lo, ...sil.slice(1)])}`);
  p.push(runs(base.map((q) => pr(c, q)), baseVis));
  const d: string[] = [];
  d.push(dashPoly(base.map((q) => pr(c, q)).filter((_, i) => !baseVis[i] && i > 0 && i < N / 2)));
  for (const lat of [30, 60]) {
    const r = Math.cos(rad(lat));
    const y = Math.sin(rad(lat));
    const pts = loop((t) => [r * Math.cos(rad(t)), y, r * Math.sin(rad(t))]);
    d.push(runs(pts.map((q) => pr(c, q)), pts.map((q) => view(c, q)[2] > 0)));
  }
  for (const lon of [60, 90, 120]) {
    const pts: V3[] = Array.from({ length: 31 }, (_, i) => {
      const a = rad((90 * i) / 30);
      return [Math.cos(a) * Math.cos(rad(lon)), Math.sin(a), Math.cos(a) * Math.sin(rad(lon))];
    });
    d.push(runs(pts.map((q) => pr(c, q)), pts.map((q) => view(c, q)[2] > -1e-9), false));
  }
  return { p, d: d.filter(Boolean) };
}

function nestedPolygons(): Art {
  const p: string[] = [];
  for (let n = 3; n <= 8; n++) p.push(ngon(200, 204, 36 + 27 * (n - 3), n, n % 2 ? 0 : 180 / n));
  return { p: [...p, circle(200, 200, 178)], d: [circle(200, 204, 5)] };
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function dodecahedron(): Art {
  return polyArt({ az: 18, el: 24, k: 100, cx: 200, cy: 200 }, dodecaVerts());
}

function ellipseLadder(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const rx = 106;
  const eye = 200;
  for (let y = 62; y <= 338; y += 46) {
    const ry = rx * Math.min(0.42, Math.abs(y - eye) / 330);
    if (ry < 1) p.push(line(200 - rx, y, 200 + rx, y));
    else p.push(`M ${200 - rx} ${y} A ${rx} ${f(ry)} 0 1 0 ${200 + rx} ${y} A ${rx} ${f(ry)} 0 1 0 ${200 - rx} ${y} Z`);
    if (ry >= 1) d.push(line(200 - rx + 8, y, 200 + rx - 8, y), line(200, y - ry + 4, 200, y + ry - 4));
  }
  p.push(line(200 - rx, 62, 200 - rx, 338), line(200 + rx, 62, 200 + rx, 338));
  d.push(dashLine([24, eye], [376, eye], 10, 7));
  return { p, d };
}

function triangleWhirl(): Art {
  let tri: P[] = [polar(200, 222, 182, 0), polar(200, 222, 182, 120), polar(200, 222, 182, 240)];
  const p: string[] = [poly(tri)];
  const t = 0.1;
  for (let i = 0; i < 17; i++) {
    tri = tri.map((a, k) => {
      const b = tri[(k + 1) % 3];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as P;
    });
    p.push(poly(tri));
  }
  return { p, d: [] };
}

/** Line of a family clipped to a circle. */
function chord(cx: number, cy: number, R: number, n: P, off: number): string {
  // points with n·(p-c) = off: foot + t·dir
  const dir: P = [-n[1], n[0]];
  const h = R * R - off * off;
  if (h <= 4) return '';
  const t = Math.sqrt(h);
  const fx = cx + n[0] * off;
  const fy = cy + n[1] * off;
  return line(fx - dir[0] * t, fy - dir[1] * t, fx + dir[0] * t, fy + dir[1] * t);
}

function trihexTiling(): Art {
  const R = 176;
  const gap = 46;
  const p: string[] = [circle(200, 200, R)];
  for (let k = 0; k < 3; k++) {
    const a = rad(90 + 120 * k);
    const n: P = [Math.cos(a), Math.sin(a)];
    let fam = '';
    for (let i = -5; i <= 5; i++) fam += `${chord(200, 200, R, n, gap * (i + 1 / 6))} `;
    p.push(fam.trim());
  }
  // a small hexagon in each hexagonal cell: cell centres lie half a gap from the nearest line of every family
  const d: string[] = [];
  const ns: P[] = [0, 1, 2].map((k) => [Math.cos(rad(90 + 120 * k)), Math.sin(rad(90 + 120 * k))] as P);
  const det = ns[0][0] * ns[1][1] - ns[0][1] * ns[1][0];
  for (let i = -6; i <= 6; i++)
    for (let j = -6; j <= 6; j++) {
      const s1 = gap * (i + 2 / 3);
      const s2 = gap * (j + 2 / 3);
      const x = (s1 * ns[1][1] - s2 * ns[0][1]) / det;
      const y = (ns[0][0] * s2 - ns[1][0] * s1) / det;
      if (Math.hypot(x, y) > R - gap * 0.75) continue;
      d.push(ngon(200 + x, 200 + y, gap * 0.36, 6, 0));
    }
  return { p, d };
}

function cubeStack(): Art {
  const c: Cam = { az: 38, el: 30, k: 56, cx: 196, cy: 252 };
  const vox: V3[] = [
    [0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1], [1, 0, 1], [0, 0, 2],
    [0, 1, 0], [1, 1, 0], [0, 1, 1], [0, 2, 0],
  ].map(([x, y, z]) => [x - 1.2, y, z - 1.2] as V3);
  return cubes(c, vox, false);
}

/** Unit cubes at the given corners, nearest first, each hiding what is behind it. */
function cubes(c: Cam, vox: readonly V3[], shade: boolean): Art {
  const centre = (v: V3): V3 => add(v, [0.5, 0.5, 0.5]);
  const order = [...vox].sort((a, b) => view(c, centre(b))[2] - view(c, centre(a))[2]);
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (s && regs.length ? clip(s, regs) : s);
  const L = norm([-0.5, 0.8, 0.35]);
  for (const v of order) {
    const corners: V3[] = [];
    for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) corners.push(add(v, [dx, dy, dz]));
    const P2 = corners.map((q) => pr(c, q));
    const hl = hull2(P2);
    const near = corners.reduce((bi, q, i) => (view(c, q)[2] > view(c, corners[bi])[2] ? i : bi), 0);
    let inner = '';
    for (let i = 0; i < 8; i++) {
      const diff = sub(corners[i], corners[near]).map(Math.abs);
      if (diff[0] + diff[1] + diff[2] === 1) inner += `${line(P2[near][0], P2[near][1], P2[i][0], P2[i][1])} `;
    }
    const o = cut(poly(hl));
    if (o) p.push(o);
    const ii = cut(inner.trim());
    if (ii) p.push(ii);
    if (shade) {
      for (const n of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as V3[]) {
        if (!facing(c, n)) continue;
        const lit = dot(n, L);
        if (lit > 0.2) continue;
        const fc = corners.map((q, i) => [q, i] as const).filter(([q]) => dot(sub(q, centre(v)), n) > 0).map(([, i]) => P2[i]);
        const h = cut(hatch(hull2(fc), lit < -0.3 ? 70 : 110, lit < -0.3 ? 5 : 8));
        if (h) d.push(h);
      }
    }
    regs.push(region(poly(grow(hl, 0.8))));
  }
  return { p, d };
}

function cylinderTwoPoint(): Art {
  const az = 32;
  const D = 8;
  const k = 72;
  const eyeH = 5;
  const Yh = -76;
  const a = rad(az);
  const vv = (p: V3): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  const P = (p: V3): P => {
    const v = vv(p);
    const s = D / (D - v[2]);
    return [200 + k * v[0] * s, Yh + k * (eyeH - v[1]) * s];
  };
  const H = 2.3;
  const N = 96;
  const ring = (y: number): V3[] => Array.from({ length: N }, (_, i) => [Math.cos(rad((360 * i) / N)), y, Math.sin(rad((360 * i) / N))] as V3);
  const faceEye = (q: V3): boolean => {
    const v = vv(q);
    const n = vv([q[0], 0, q[2]]);
    return n[0] * (0 - v[0]) + n[2] * (D - v[2]) > 0;
  };
  const bottom = ring(0);
  const vis = bottom.map(faceEye);
  const p: string[] = [];
  p.push(`${pl(ring(H).map(P))} Z`);
  p.push(runs(bottom.map(P), vis));
  for (let i = 0; i < N; i++) {
    if (vis[i] !== vis[(i + 1) % N]) {
      const q = bottom[vis[i] ? i : (i + 1) % N];
      const A = P(q);
      const B = P([q[0], H, q[2]]);
      p.push(line(A[0], A[1], B[0], B[1]));
    }
  }
  const d: string[] = [];
  const box: V3[] = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]];
  const top = box.map(([x, , z]) => [x, H, z] as V3);
  for (let i = 0; i < 4; i++) {
    d.push(dashLine(P(box[i]), P(box[(i + 1) % 4]), 6, 5), dashLine(P(top[i]), P(top[(i + 1) % 4]), 6, 5), dashLine(P(box[i]), P(top[i]), 6, 5));
  }
  d.push(dashLine(P(top[0]), P(top[2]), 4, 5), dashLine(P(top[1]), P(top[3]), 4, 5));
  d.push(dashLine(P([0, H, -1]), P([0, H, 1]), 4, 5), dashLine(P([-1, H, 0]), P([1, H, 0]), 4, 5));
  // lines running towards the two vanishing points
  const toward = (p0: V3, dir: V3, len: number): string => {
    const A = P(p0);
    const B = P(add(p0, mul(dir, 0.6)));
    const l = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const E: P = [A[0] + ((B[0] - A[0]) / l) * len, A[1] + ((B[1] - A[1]) / l) * len];
    return dashLine(A, E, 3, 6);
  };
  d.push(toward(top[1], [1, 0, 0], 70), toward(top[2], [1, 0, 0], 60), toward(top[3], [0, 0, 1], 70));
  return { p, d };
}

// ---- advanced ----------------------------------------------------------------------------------------------------

const LIGHT = norm([-0.55, 0.75, 0.4]);

function hexColumns(): Art {
  const c: Cam = { az: 12, el: 34, k: 34, cx: 200, cy: 262 };
  const cells: [number, number][] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) cells.push([q, r]);
  const sp = 1.9;
  const cols = cells.map(([q, r], i) => {
    const x = sp * (q + r / 2) * (Math.sqrt(3) / 2) * 1.16;
    const z = sp * r * 0.87 * 1.16;
    const h = 1.2 + 0.9 * ((i * 7) % 5) + (q === 0 && r === 0 ? 2.6 : 0);
    return { x, z, h };
  });
  cols.sort((A, B) => view(c, [B.x, 0, B.z])[2] - view(c, [A.x, 0, A.z])[2]);
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (s && regs.length ? clip(s, regs) : s);
  for (const col of cols) {
    const top = ringV(1, 6, col.h, 0).map((v) => add(v, [col.x, 0, col.z]));
    const bot = ringV(1, 6, 0, 0).map((v) => add(v, [col.x, 0, col.z]));
    const T = top.map((q) => pr(c, q));
    const B = bot.map((q) => pr(c, q));
    const hl = hull2([...T, ...B]);
    const o = cut(poly(hl));
    if (o) p.push(o);
    const tp = cut(`${pl(T)} Z`);
    if (tp) p.push(tp);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const mid = mul(add(sub(top[i], [col.x, col.h, col.z]), sub(top[j], [col.x, col.h, col.z])), 0.5);
      const n = norm([mid[0], 0, mid[2]]);
      if (!facing(c, n)) continue;
      const e = cut(line(T[i][0], T[i][1], B[i][0], B[i][1]) + ' ' + line(T[j][0], T[j][1], B[j][0], B[j][1]));
      if (e) p.push(e);
      const lit = dot(n, LIGHT);
      if (lit < 0.25) {
        const h = cut(hatch([T[i], T[j], B[j], B[i]], 90, lit < -0.2 ? 4.5 : 7.5));
        if (h) d.push(h);
      }
    }
    regs.push(region(poly(grow(hl, 0.8))));
  }
  return { p, d };
}

function coneCylinderGroup(): Art {
  const c: Cam = { az: 0, el: 16, k: 78, cx: 200, cy: 318 };
  const N = 120;
  const ring = (o: V3, r: number, y: number): V3[] =>
    Array.from({ length: N }, (_, i) => add(o, [r * Math.cos(rad((360 * i) / N)), y, r * Math.sin(rad((360 * i) / N))]));
  const cyl = { o: [-0.95, 0, -0.7] as V3, r: 0.85, h: 2.6 };
  const con = { o: [0.85, 0, 0.55] as V3, r: 0.95, h: 2.2 };
  const cylTop = ring(cyl.o, cyl.r, cyl.h);
  const cylBot = ring(cyl.o, cyl.r, 0);
  const conBase = ring(con.o, con.r, 0);
  const apex = add(con.o, [0, con.h, 0]);
  const cylHull = hull2([...cylTop, ...cylBot].map((q) => pr(c, q)));
  const conHull = hull2([...conBase, apex].map((q) => pr(c, q)));
  const conReg = region(poly(grow(conHull, 0.6)));
  const cylReg = region(poly(grow(cylHull, 0.6)));
  const p: string[] = [];
  const d: string[] = [];
  // cone (front)
  p.push(poly(conHull));
  // cylinder (behind the cone)
  p.push(clip(poly(cylHull), [conReg]));
  const topVis = cylTop.map((q) => view(c, sub(q, add(cyl.o, [0, cyl.h, 0])))[2] > 0);
  p.push(clip(runs(cylTop.map((q) => pr(c, q)), topVis), [conReg]));
  // table edge behind both
  p.push(clip('M 24 196 L 376 196', [conReg, cylReg]));
  // shading: generator lines on the dark side
  for (let i = 0; i < N; i += 3) {
    const n: V3 = [Math.cos(rad((360 * i) / N)), 0, Math.sin(rad((360 * i) / N))];
    if (!facing(c, n)) continue;
    const lit = dot(n, LIGHT);
    if (lit > 0.15 || (lit > -0.25 && i % 6)) continue;
    const A = pr(c, cylBot[i]);
    const B = pr(c, cylTop[i]);
    d.push(clip(line(A[0], A[1] - 2, B[0], B[1] + 2), [conReg]));
  }
  for (let i = 0; i < N; i += 2) {
    const a = rad((360 * i) / N);
    const n = norm([Math.cos(a) * con.h, con.r, Math.sin(a) * con.h]);
    if (!facing(c, n)) continue;
    const lit = dot(n, LIGHT);
    if (lit > 0.2 || (lit > -0.15 && i % 4)) continue;
    const A = pr(c, conBase[i]);
    const T = pr(c, apex);
    d.push(line(A[0] + (T[0] - A[0]) * 0.03, A[1] + (T[1] - A[1]) * 0.03, A[0] + (T[0] - A[0]) * 0.72, A[1] + (T[1] - A[1]) * 0.72));
  }
  // cast shadows on the table, hatched
  const SUN = norm([-0.8, 0.5, 0.25]);
  const onGround = (q: V3): V3 => sub(q, mul(SUN, q[1] / SUN[1]));
  const shCyl = hull2([...cylTop, ...cylBot].map((q) => pr(c, onGround(q))));
  const shCon = hull2([...conBase, apex].map((q) => pr(c, onGround(q))));
  const box = (pts: P[]) => pts.map(([x, y]) => [Math.min(376, Math.max(24, x)), Math.min(376, Math.max(24, y))] as P);
  d.push(clip(hatch(box(shCyl), 35, 6), [conReg, cylReg]));
  d.push(clip(hatch(box(shCon), 35, 6), [conReg, cylReg]));
  d.push(clip(pl(box(shCon)) + ' Z', [conReg, cylReg]));
  d.push(clip(pl(box(shCyl)) + ' Z', [conReg, cylReg]));
  return { p: p.filter(Boolean), d: d.filter(Boolean) };
}

function shadedIcosahedron(): Art {
  const c: Cam = { az: 16, el: 20, k: 74, cx: 196, cy: 196 };
  const V = icosaVerts();
  const s = solid(c, V);
  const reg = region(poly(grow(s.outline, 0.6)));
  const d: string[] = [];
  for (const fc of s.faces) {
    if (!fc.vis) continue;
    const lit = dot(fc.n, LIGHT);
    if (lit > 0.62) continue;
    d.push(hatch(fc.pts, 25, lit > 0.25 ? 9 : 5.5));
    if (lit < -0.1) d.push(hatch(fc.pts, -40, 6));
  }
  // cast shadow on the ground under the solid
  const bottom = Math.max(...s.outline.map((q) => q[1]));
  const sh: P[] = Array.from({ length: 48 }, (_, i) => [222 + 128 * Math.cos(rad(i * 7.5)), bottom + 4 + 30 * Math.sin(rad(i * 7.5))] as P);
  d.push(clip(hatch(sh, -20, 6), [reg]));
  return { p: [s.edges, clip(`${pl(sh)} Z`, [reg])].filter(Boolean), d: d.filter(Boolean) };
}

// ---- templates ---------------------------------------------------------------------------------------------------

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `shape3-${id}`,
    name,
    category: 'shapes',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

export const shapes3: Template[] = [
  // beginner
  tpl('octahedron', 'Octahedron double pyramid', 'beginner', ['pyramid', 'shape', 'geometric', 'solid', 'drawing-practice'], octahedron()),
  tpl('tetrahedron', 'Tetrahedron triangle pyramid', 'beginner', ['pyramid', 'triangle', 'shape', 'geometric', 'drawing-practice'], tetrahedron()),
  tpl('hexagonal-prism', 'Hexagonal prism', 'beginner', ['prism', 'hexagon', 'shape', 'geometric', 'drawing-practice'], hexPrism()),
  tpl('pentagonal-pyramid', 'Pentagonal pyramid', 'beginner', ['pyramid', 'polygon', 'shape', 'geometric', 'drawing-practice'], pentPyramid()),
  tpl('lying-cylinder', 'Cylinder lying on its side', 'beginner', ['cylinder', 'shape', 'ellipse', 'geometric', 'drawing-practice'], lyingCylinder()),
  tpl('half-sphere', 'Half sphere dome', 'beginner', ['sphere', 'dome', 'shape', 'contour', 'drawing-practice'], halfSphere()),
  tpl('nested-polygons', 'Nested polygons from triangle to octagon', 'beginner', ['polygon', 'triangle', 'shape', 'geometric', 'exercise'], nestedPolygons()),
  // intermediate
  tpl('dodecahedron', 'Dodecahedron polygon solid', 'intermediate', ['polygon', 'pentagon', 'shape', 'geometric', 'drawing-practice'], dodecahedron()),
  tpl('ellipse-ladder', 'Circles in perspective ladder', 'intermediate', ['circle', 'ellipse', 'perspective', 'shape', 'drawing-practice'], ellipseLadder()),
  tpl('triangle-whirl', 'Whirl of nested triangles', 'intermediate', ['triangle', 'spiral', 'shape', 'optical', 'geometric'], triangleWhirl()),
  tpl('trihex-tiling', 'Triangle and hexagon tessellation', 'intermediate', ['triangle', 'hexagon', 'shape', 'tessellation', 'geometric'], trihexTiling()),
  tpl('cube-stack', 'Stacked cubes corner tower', 'intermediate', ['cube', 'stacked', 'shape', 'geometric', 'drawing-practice'], cubeStack()),
  tpl('cylinder-two-point', 'Cylinder in two-point perspective', 'intermediate', ['cylinder', 'perspective', 'shape', 'vanishing-point', 'drawing-practice'], cylinderTwoPoint()),
  // advanced
  tpl('hex-columns', 'Hexagonal prism columns', 'advanced', ['prism', 'hexagon', 'shape', 'hatching', 'geometric'], hexColumns()),
  tpl('cone-cylinder-group', 'Cone and cylinder group with shadows', 'advanced', ['cone', 'cylinder', 'shape', 'hatching', 'still-life'], coneCylinderGroup()),
  tpl('shaded-icosahedron', 'Shaded icosahedron polygon solid', 'advanced', ['polygon', 'shape', 'hatching', 'geometric', 'solid'], shadedIcosahedron()),
];
