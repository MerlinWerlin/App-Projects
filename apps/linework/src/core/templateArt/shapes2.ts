// shapes2 template batch (T123, fb-1022b, 22 Oct 2026): drawing-practice forms and shape exercises on a 400×400 canvas.
// Original line art computed here: 3D forms are projected from simple solids (cube, cylinder, cone, sphere, torus,
// prism, pyramid, stairs) with hidden edges either removed or drawn as thin dashed construction lines, and flat shape
// exercises are built from regular geometry. Overlaps between separate solids use occlude.ts. See docs/TEMPLATES.md.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, f, line, ngon, poly, polar, type P } from './draw.ts';
import { clip, region, type Region } from './occlude.ts';

const VB = '0 0 400 400';

type V3 = readonly [number, number, number];
type Art = { p: string[]; d: string[] };

// ---- camera ------------------------------------------------------------------------------------------------------

/** az: turn about the vertical axis (deg); el: look-down angle (deg); D: eye distance (Infinity = parallel view). */
type Cam = { az: number; el: number; D: number; k: number; cx: number; cy: number; back?: number };

const rad = (d: number): number => (d * Math.PI) / 180;

function toView(c: Cam, p: V3): V3 {
  const a = rad(c.az);
  const e = rad(c.el);
  const x1 = p[0] * Math.cos(a) + p[2] * Math.sin(a);
  const z1 = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
  const y1 = p[1];
  return [x1, y1 * Math.cos(e) - z1 * Math.sin(e), y1 * Math.sin(e) + z1 * Math.cos(e) - (c.back ?? 0)];
}

function proj(c: Cam, p: V3): P {
  const v = toView(c, p);
  const s = Number.isFinite(c.D) ? c.D / (c.D - v[2]) : 1;
  return [c.cx + c.k * v[0] * s, c.cy - c.k * v[1] * s];
}

/** True when a surface at p with outward normal n faces the eye. */
function faces(c: Cam, p: V3, n: V3): boolean {
  const nv = toView({ ...c, back: 0 }, n);
  const pv = toView(c, p);
  const e: V3 = Number.isFinite(c.D) ? [-pv[0], -pv[1], c.D - pv[2]] : [0, 0, 1];
  return nv[0] * e[0] + nv[1] * e[1] + nv[2] * e[2] > 1e-9;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---- 2D path helpers ---------------------------------------------------------------------------------------------

const pl = (pts: readonly P[]): string => pts.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ');

/** Runs of consecutive visible points as polylines. */
function runs(pts: readonly P[], vis: readonly boolean[]): string {
  const out: string[] = [];
  let cur: P[] = [];
  pts.forEach((p, i) => {
    if (vis[i]) cur.push(p);
    else {
      if (cur.length > 1) out.push(pl(cur));
      cur = [];
    }
  });
  if (cur.length > 1) out.push(pl(cur));
  return out.join(' ');
}

/** Dashed straight line. */
function dashLine(a: P, b: P, dash = 7, gap = 6): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const out: string[] = [];
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    const t0 = s / len;
    const t1 = e / len;
    out.push(line(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1));
  }
  return out.join(' ');
}

/** Dashed polyline (dashes measured along the curve). */
function dashPoly(pts: readonly P[], dash = 7, gap = 6): string {
  const out: string[] = [];
  let cur: P[] = [];
  let acc = 0;
  let on = true;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (on) cur.push(pts[i]);
    if (on && acc >= dash) {
      if (cur.length > 1) out.push(pl(cur));
      cur = [];
      on = false;
      acc = 0;
    } else if (!on && acc >= gap) {
      on = true;
      acc = 0;
      cur = [pts[i]];
    }
  }
  if (on && cur.length > 1) out.push(pl(cur));
  return out.join(' ');
}

function hull(pts: readonly P[]): P[] {
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

/** Occluding region of a convex silhouette, shrunk a little so lines on its rim stay visible. */
function shrunk(pts: readonly P[], by = 1.2): Region {
  const h = hull(pts);
  const cx = h.reduce((n, p) => n + p[0], 0) / h.length;
  const cy = h.reduce((n, p) => n + p[1], 0) / h.length;
  return region(
    poly(
      h.map(([x, y]) => {
        const r = Math.hypot(x - cx, y - cy) || 1;
        return [x - ((x - cx) / r) * by, y - ((y - cy) / r) * by] as P;
      }),
    ),
  );
}

/** Parallel hatch lines at angle deg with the given spacing, kept where inside(x, y). */
function hatch(inside: (x: number, y: number) => boolean, box: readonly [number, number, number, number], deg: number, gap: number): string {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const ux = Math.cos(rad(deg));
  const uy = Math.sin(rad(deg));
  const out: string[] = [];
  for (let o = -R + gap / 2; o <= R; o += gap) {
    let start: P | null = null;
    let last: P | null = null;
    for (let t = -R; t <= R + 0.01; t += 1) {
      const x = cx + ux * t - uy * o;
      const y = cy + uy * t + ux * o;
      const ok = x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside(x, y);
      if (ok) {
        if (!start) start = [x, y];
        last = [x, y];
      } else if (start && last) {
        if (Math.hypot(last[0] - start[0], last[1] - start[1]) > 3) out.push(line(start[0], start[1], last[0], last[1]));
        start = last = null;
      }
    }
    if (start && last && Math.hypot(last[0] - start[0], last[1] - start[1]) > 3) out.push(line(start[0], start[1], last[0], last[1]));
  }
  return out.join(' ');
}

function inPoly(pts: readonly P[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const boxOf = (pts: readonly P[]): [number, number, number, number] => [
  Math.min(...pts.map((p) => p[0])),
  Math.min(...pts.map((p) => p[1])),
  Math.max(...pts.map((p) => p[0])),
  Math.max(...pts.map((p) => p[1])),
];

// ---- solids ------------------------------------------------------------------------------------------------------

type Solid = { vis: string[]; hid: string[]; sil: P[]; faces: { pts: P[]; normal: V3; lit: boolean }[] };

/**
 * Convex polyhedron (or an extruded profile with given outward normals): visible edges, hidden edges and the
 * projected outline. Faces are vertex-index loops; normals are computed outward from the centroid unless given.
 */
function polyhedron(c: Cam, V: readonly V3[], F: readonly number[][], normals?: readonly V3[]): Solid {
  const cen = mul(V.reduce((a, b) => add(a, b), [0, 0, 0] as V3), 1 / V.length);
  const facing: boolean[] = [];
  const ns: V3[] = [];
  F.forEach((fc, i) => {
    let n = normals?.[i] ?? cross(sub(V[fc[1]], V[fc[0]]), sub(V[fc[2]], V[fc[0]]));
    const fcen = mul(fc.reduce((a, k) => add(a, V[k]), [0, 0, 0] as V3), 1 / fc.length);
    if (!normals && dot(n, sub(fcen, cen)) < 0) n = mul(n, -1);
    ns.push(n);
    facing.push(faces(c, fcen, n));
  });
  const edges = new Map<string, { a: number; b: number; f: number[] }>();
  F.forEach((fc, i) =>
    fc.forEach((a, j) => {
      const b = fc[(j + 1) % fc.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const e = edges.get(key) ?? { a, b, f: [] };
      e.f.push(i);
      edges.set(key, e);
    }),
  );
  const vis: string[] = [];
  const hid: string[] = [];
  for (const e of edges.values()) {
    const A = proj(c, V[e.a]);
    const B = proj(c, V[e.b]);
    if (e.f.some((i) => facing[i])) vis.push(line(A[0], A[1], B[0], B[1]));
    else hid.push(dashLine(A, B));
  }
  return {
    vis,
    hid,
    sil: V.map((v) => proj(c, v)),
    faces: F.map((fc, i) => ({ pts: fc.map((k) => proj(c, V[k])), normal: ns[i], lit: facing[i] })).filter((x) => x.lit),
  };
}

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, turn = 0): { V: V3[]; F: number[][] } {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const a = rad(turn);
  const V: V3[] = [];
  for (const y of [y0, y1])
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
      const dx = x - cx;
      const dz = z - cz;
      V.push([cx + dx * Math.cos(a) - dz * Math.sin(a), y, cz + dx * Math.sin(a) + dz * Math.cos(a)]);
    }
  return { V, F: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
}

/** Upright cylinder (base centre b, radius r, height h): outline, rims, hidden back rim. */
function cylinder(c: Cam, b: V3, r: number, h: number, n = 96): Solid {
  const rim = (y: number) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      return { p: [b[0] + r * Math.cos(t), b[1] + y, b[2] + r * Math.sin(t)] as V3, nrm: [Math.cos(t), 0, Math.sin(t)] as V3 };
    });
  const top = rim(h);
  const bot = rim(0);
  const topFace = faces(c, add(b, [0, h, 0]), [0, 1, 0]);
  const botFace = faces(c, b, [0, -1, 0]);
  const vis: string[] = [];
  const hid: string[] = [];
  for (const [ring, cap] of [[top, topFace], [bot, botFace]] as const) {
    const pts = ring.map((q) => proj(c, q.p));
    const v = ring.map((q) => cap || faces(c, q.p, q.nrm));
    vis.push(runs(pts, v));
    const hidden = runs(pts, v.map((x) => !x));
    if (hidden) {
      const lists = hidden.split(/(?=M)/).map((s) => s.trim().replace(/[ML]/g, '').trim().split(/\s+/).map(Number));
      for (const nums of lists) {
        const ptsH: P[] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) ptsH.push([nums[i], nums[i + 1]]);
        hid.push(dashPoly(ptsH));
      }
    }
  }
  // silhouette generators: where the side normal turns away
  for (let i = 0; i < n; i++) {
    const s0 = faces(c, top[i].p, top[i].nrm);
    const s1 = faces(c, top[i + 1].p, top[i + 1].nrm);
    if (s0 !== s1) {
      const A = proj(c, top[i].p);
      const B = proj(c, bot[i].p);
      vis.push(line(A[0], A[1], B[0], B[1]));
    }
  }
  return { vis: vis.filter(Boolean), hid, sil: [...top, ...bot].map((q) => proj(c, q.p)), faces: [] };
}

/** Upright cone (base centre b, radius r, height h). */
function cone(c: Cam, b: V3, r: number, h: number, n = 96): Solid {
  const apex = add(b, [0, h, 0]);
  const A = proj(c, apex);
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    const p: V3 = [b[0] + r * Math.cos(t), b[1], b[2] + r * Math.sin(t)];
    return { p, nrm: [h * Math.cos(t), r, h * Math.sin(t)] as V3 };
  });
  const botFace = faces(c, b, [0, -1, 0]);
  const pts = ring.map((q) => proj(c, q.p));
  const side = ring.map((q) => faces(c, add(mul(q.p, 0.5), mul(apex, 0.5)), q.nrm));
  const v = side.map((s) => s || botFace);
  const vis = [runs(pts, v)];
  const hid: string[] = [];
  const hidden: P[] = [];
  pts.forEach((p, i) => {
    if (!v[i]) hidden.push(p);
  });
  // back arc (may wrap around the start): rebuild in ring order starting after the last visible point
  const start = v.findIndex((x, i) => x && !v[(i + 1) % pts.length]);
  if (start >= 0) {
    const back: P[] = [];
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (v[i]) break;
      back.push(pts[i]);
    }
    if (back.length > 1) hid.push(dashPoly([pts[start], ...back]));
  }
  for (let i = 0; i < n; i++) {
    if (side[i] !== side[i + 1]) vis.push(line(A[0], A[1], pts[i][0], pts[i][1]));
  }
  return { vis, hid, sil: [A, ...pts], faces: [] };
}

/** Sphere (centre o, radius r): outline circle, latitudes and meridians on the visible side. */
function sphere(c: Cam, o: V3, r: number, lats: readonly number[], mers: readonly number[]): Solid {
  const C = proj(c, o);
  const R = c.k * r;
  const curve = (fn: (t: number) => V3, n = 120) => {
    const pts: P[] = [];
    const v: boolean[] = [];
    for (let i = 0; i <= n; i++) {
      const q = fn((2 * Math.PI * i) / n);
      pts.push(proj(c, add(o, mul(q, r))));
      v.push(faces(c, add(o, mul(q, r)), q));
    }
    return runs(pts, v);
  };
  const d: string[] = [];
  for (const lat of lats) {
    const y = Math.sin(rad(lat));
    const rr = Math.cos(rad(lat));
    d.push(curve((t) => [rr * Math.cos(t), y, rr * Math.sin(t)]));
  }
  for (const m of mers) {
    const a = rad(m);
    d.push(curve((t) => [Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)]));
  }
  const sil = Array.from({ length: 48 }, (_, i) => polar(C[0], C[1], R, i * 7.5));
  return { vis: [circle(C[0], C[1], R)], hid: d.filter(Boolean), sil, faces: [] };
}

/** Lines of the solids, front to back: each solid's lines are clipped by the outlines of the ones in front. */
function scene(solids: readonly Solid[], keepHidden = false): Art {
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  for (const s of solids) {
    const cut = (x: string) => (regs.length ? clip(x, regs) : x);
    for (const x of s.vis) {
      const y = cut(x);
      if (y) p.push(y);
    }
    if (keepHidden)
      for (const x of s.hid) {
        const y = cut(x);
        if (y) d.push(y);
      }
    regs.push(shrunk(s.sil));
  }
  return { p, d };
}

const tpl = (id: string, name: string, level: TemplateLevel, tags: string[], a: Art, sw = 4, dw = 2): Template => ({
  id,
  name,
  category: 'shapes',
  level,
  tags,
  viewBox: VB,
  strokeWidth: sw,
  detailWidth: dw,
  paths: a.p.filter(Boolean),
  ...(a.d.filter(Boolean).length ? { detail: a.d.filter(Boolean) } : {}),
});

const ground = (y: number, x0 = 50, x1 = 350): string => line(x0, y, x1, y);

// ---- beginner ----------------------------------------------------------------------------------------------------

const PAR: Cam = { az: 0, el: 22, D: Infinity, k: 100, cx: 200, cy: 300 };

function coneArt(): Art {
  const s = cone(PAR, [0, 0, 0], 1.15, 2.35);
  const A = proj(PAR, [0, 2.35, 0]);
  const B = proj(PAR, [0, 0, 0]);
  return { p: s.vis, d: [...s.hid, dashLine(A, B), dashLine(proj(PAR, [-1.15, 0, 0]), proj(PAR, [1.15, 0, 0]))] };
}

function cylinderArt(): Art {
  const c: Cam = { ...PAR, el: 26, cy: 296 };
  const s = cylinder(c, [0, 0, 0], 1, 2.1);
  const T = proj(c, [0, 2.1, 0]);
  const B = proj(c, [0, 0, 0]);
  return { p: s.vis, d: [...s.hid, dashLine(T, B)] };
}

function pyramidArt(): Art {
  const c: Cam = { az: 28, el: 18, D: Infinity, k: 100, cx: 200, cy: 290 };
  const V: V3[] = [[-1.2, 0, -1.2], [1.2, 0, -1.2], [1.2, 0, 1.2], [-1.2, 0, 1.2], [0, 2.2, 0]];
  const s = polyhedron(c, V, [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]);
  return { p: s.vis, d: s.hid };
}

function prismArt(): Art {
  const c: Cam = { az: -32, el: 20, D: Infinity, k: 92, cx: 196, cy: 262 };
  const V: V3[] = [[-1.6, 0, -0.9], [-1.6, 0, 0.9], [-1.6, 1.55, 0], [1.6, 0, -0.9], [1.6, 0, 0.9], [1.6, 1.55, 0]];
  const s = polyhedron(c, V, [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]);
  return { p: s.vis, d: s.hid };
}

function nestedSquares(): Art {
  let sq: P[] = [[60, 60], [340, 60], [340, 340], [60, 340]];
  const p: string[] = [];
  for (let i = 0; i < 14; i++) {
    p.push(poly(sq));
    const t = 0.12;
    sq = sq.map((a, k) => {
      const b = sq[(k + 1) % 4];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as P;
    });
  }
  return { p, d: [] };
}

/** Star polygon {n/k} drawn as one continuous line, plus its guide circle. */
function starPoly(cx: number, cy: number, r: number, n: number, k: number): string {
  const pts: P[] = [];
  const g = (n % k === 0 ? k : 1) === 1 ? 1 : k;
  void g;
  let i = 0;
  const seen = new Set<number>();
  const loops: P[][] = [];
  for (let s = 0; s < n; s++) {
    if (seen.has(s)) continue;
    const loop: P[] = [];
    i = s;
    while (!seen.has(i)) {
      seen.add(i);
      loop.push(polar(cx, cy, r, (360 * i) / n));
      i = (i + k) % n;
    }
    loops.push(loop);
  }
  void pts;
  return loops.map((l) => poly(l)).join(' ');
}

function starPolygons(): Art {
  const spots: [number, number, number, number][] = [[110, 110, 5, 2], [290, 110, 7, 3], [110, 290, 8, 3], [290, 290, 9, 4]];
  return {
    p: spots.map(([x, y, n, k]) => starPoly(x, y, 78, n, k)),
    d: spots.map(([x, y]) => `${circle(x, y, 78)} ${circle(x, y, 3)}`),
  };
}

function circleGrid(): Art {
  const p: string[] = [poly([[50, 50], [350, 50], [350, 350], [50, 350]])];
  const d: string[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p.push(circle(100 + 100 * i, 100 + 100 * j, 50));
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) p.push(circle(150 + 100 * i, 150 + 100 * j, 50 * (Math.SQRT2 - 1)));
  d.push(`${line(50, 50, 350, 350)} ${line(350, 50, 50, 350)}`);
  return { p, d };
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function cubeTwoPoint(): Art {
  const c: Cam = { az: 45, el: 0, D: 2.2, k: 80, cx: 200, cy: 196, back: 2.4 };
  const d: string[] = [line(20, c.cy, 380, c.cy)];
  const p: string[] = [];
  // vanishing points of the two horizontal edge directions
  const vp = (dir: V3): P => {
    const v = toView({ ...c, back: 0 }, dir);
    return [c.cx + (c.k * c.D * v[0]) / -v[2], c.cy];
  };
  const L = vp([0, 0, -1]);
  const R = vp([1, 0, 0]);
  const side: V3 = [Math.cos(rad(45)), 0, Math.sin(rad(45))];
  // one cube below the horizon (we see its top) and one above it (we see its underside)
  for (const [off, y0, y1] of [[-0.62, -2.35, -0.95], [0.7, 0.95, 2.25]] as const) {
    const o = mul(side, off);
    const h = 0.68;
    const { V: V0, F } = box(-h, y0, -h, h, y1, h);
    const V = V0.map((v) => add(v, o));
    const s = polyhedron(c, V, F);
    p.push(...s.vis);
    d.push(...s.hid);
    const pts = V.map((v) => proj(c, v));
    const near = V.map((v, i) => [toView(c, v)[2], i] as const).filter(([, i]) => i < 4).sort((x, y) => y[0] - x[0])[0][1];
    for (const q of [L, R]) for (const k of [near, near + 4]) d.push(dashLine(pts[k], q, 5, 5));
  }
  d.push(circle(L[0], L[1], 4), circle(R[0], R[1], 4));
  return { p, d };
}

function sphereContours(): Art {
  const c: Cam = { az: 20, el: 24, D: Infinity, k: 140, cx: 200, cy: 196 };
  const s = sphere(c, [0, 0, 0], 1, [-60, -30, 0, 30, 60], [0, 30, 60, 90, 120, 150]);
  return { p: [...s.vis, ground(352, 110, 290)], d: s.hid };
}

function torusArt(): Art {
  const c: Cam = { az: 0, el: 34, D: Infinity, k: 98, cx: 200, cy: 205 };
  const R = 1.25;
  const r = 0.55;
  const P3 = (u: number, v: number): V3 => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
  const N3 = (u: number, v: number): V3 => [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)];
  // eye direction in world space (parallel view)
  const e = rad(c.el);
  const w: V3 = [0, Math.sin(e), Math.cos(e)];
  const inside = (p: V3) => (Math.hypot(p[0], p[2]) - R) ** 2 + p[1] ** 2 - r * r;
  const seen = (p: V3): boolean => {
    for (let t = 0.03; t < 3; t += 0.02) if (inside(add(p, mul(w, t))) < -0.004) return false;
    return true;
  };
  const p: string[] = [];
  const d: string[] = [];
  const n = 240;
  // outline: for each u the two v where the normal is side-on
  for (const branch of [0, Math.PI]) {
    const pts: P[] = [];
    const v: boolean[] = [];
    for (let i = 0; i <= n; i++) {
      const u = (2 * Math.PI * i) / n;
      const a = Math.cos(u) * w[0] + Math.sin(u) * w[2];
      const vv = Math.atan2(-a, w[1]) + branch;
      const q = P3(u, vv);
      pts.push(proj(c, q));
      v.push(seen(q));
    }
    p.push(runs(pts, v));
  }
  const curve = (fn: (t: number) => [number, number], m = 90) => {
    const pts: P[] = [];
    const v: boolean[] = [];
    for (let i = 0; i <= m; i++) {
      const [u, vv] = fn((2 * Math.PI * i) / m);
      const q = P3(u, vv);
      pts.push(proj(c, q));
      v.push(faces(c, q, N3(u, vv)) && seen(q));
    }
    return runs(pts, v);
  };
  for (let k = 0; k < 12; k++) d.push(curve((t) => [(2 * Math.PI * k) / 12 + Math.PI / 12, t]));
  for (const vv of [Math.PI / 2, Math.PI / 5, -Math.PI / 6]) d.push(curve((t) => [t, vv], 160));
  return { p, d };
}

function hexTiling(): Art {
  const r = 40;
  const hw = r * Math.sqrt(3);
  const p: string[] = [];
  const d: string[] = [];
  const cells: P[] = [];
  for (let q = -2; q <= 2; q++)
    for (let s = -2; s <= 2; s++) {
      if (Math.abs(q + s) > 2) continue;
      cells.push([200 + hw * (q + s / 2), 200 + r * 1.5 * s]);
    }
  for (const [x, y] of cells) p.push(ngon(x, y, r, 6));
  // tumbling-block shading in every other ring: three lines from the centre to alternate corners
  cells.forEach(([x, y], i) => {
    const ring = Math.round(Math.hypot(x - 200, y - 200) / hw);
    if (ring === 1 || (ring === 0 && i >= 0)) {
      d.push([0, 120, 240].map((a) => line(x, y, ...(polar(x, y, r, a) as [number, number]))).join(' '));
    } else d.push(ngon(x, y, r * 0.55, 6, 30));
  });
  return { p, d };
}

function squareSpiral(): Art {
  // Fibonacci squares 1,1,2,3,5,8,13 with a quarter-circle spiral through them
  const u = 13.6;
  const fib = [1, 1, 2, 3, 5, 8, 13];
  type Sq = { x: number; y: number; s: number };
  const sq: Sq[] = [];
  let bx = 0;
  let by = 0;
  let bw = 1;
  let bh = 1;
  sq.push({ x: 0, y: 0, s: 1 });
  for (let i = 1; i < fib.length; i++) {
    const s = fib[i];
    const dir = i % 4;
    let x = 0;
    let y = 0;
    if (dir === 1) [x, y] = [bx + bw, by];
    else if (dir === 2) [x, y] = [bx, by + bh];
    else if (dir === 3) [x, y] = [bx - s, by];
    else [x, y] = [bx, by - s];
    sq.push({ x, y, s });
    const nx0 = Math.min(bx, x);
    const ny0 = Math.min(by, y);
    const nx1 = Math.max(bx + bw, x + s);
    const ny1 = Math.max(by + bh, y + s);
    [bx, by, bw, bh] = [nx0, ny0, nx1 - nx0, ny1 - ny0];
  }
  const ox = 200 - ((bx + bw / 2) * u);
  const oy = 200 - ((by + bh / 2) * u);
  const X = (x: number) => ox + x * u;
  const Y = (y: number) => oy + y * u;
  const p = sq.map((q) => poly([[X(q.x), Y(q.y)], [X(q.x + q.s), Y(q.y)], [X(q.x + q.s), Y(q.y + q.s)], [X(q.x), Y(q.y + q.s)]]));
  // quarter arcs: centre at the square corner shared with the previous squares
  const arcs: string[] = [];
  sq.forEach((q, i) => {
    const dir = i % 4;
    const corners: [number, number, number, number][] = [
      [q.x + q.s, q.y + q.s, 180, 270], // i%4==0: centre bottom-right
      [q.x, q.y + q.s, 270, 360],
      [q.x, q.y, 0, 90],
      [q.x + q.s, q.y, 90, 180],
    ];
    const [cx, cy, a0, a1] = corners[dir];
    const pts: P[] = [];
    for (let t = 0; t <= 24; t++) {
      const a = rad(a0 + ((a1 - a0) * t) / 24);
      pts.push([X(cx) + q.s * u * Math.cos(a), Y(cy) + q.s * u * Math.sin(a)]);
    }
    arcs.push(pl(pts));
  });
  return { p: [...p, arcs.join(' ')], d: [] };
}

// ---- advanced ----------------------------------------------------------------------------------------------------

type Box6 = [number, number, number, number, number, number];

/** Axis-aligned boxes in a parallel view, drawn nearest first with hatching on the shaded side faces. */
function boxesScene(c: Cam, boxes: readonly Box6[], shade: V3, gap = 7): Art {
  const order = boxes
    .map((b) => ({ b, z: toView(c, [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2])[2] + toView(c, [b[3] - b[0], b[4] - b[1], b[5] - b[2]])[2] * 0 }))
    .sort((a, b) => b.z - a.z);
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  for (const { b } of order) {
    const { V, F } = box(...b);
    const s = polyhedron(c, V, F);
    const cut = (x: string) => (regs.length && x ? clip(x, regs) : x);
    const lines = cut(s.vis.join(' '));
    if (lines) p.push(lines);
    const h = s.faces
      .filter((fc) => dot(fc.normal, shade) > 0.5)
      .map((fc) => hatch((x, y) => inPoly(fc.pts, x, y), boxOf(fc.pts), -62, gap))
      .join(' ');
    const hc = cut(h);
    if (hc) d.push(hc);
    regs.push(shrunk(s.sil, 0.8));
  }
  return { p, d };
}

function isoCubes(): Art {
  const c: Cam = { az: 45, el: 35.26, D: Infinity, k: 44, cx: 200, cy: 250 };
  const heights = [
    [4, 3, 2, 1],
    [3, 2, 2, 1],
    [2, 2, 1, 0],
    [1, 1, 0, 0],
  ];
  const boxes: Box6[] = [];
  heights.forEach((row, i) =>
    row.forEach((h, j) => {
      for (let k = 0; k < h; k++) boxes.push([j - 2, k, i - 2, j - 1, k + 1, i - 1]);
    }),
  );
  return boxesScene(c, boxes, [0, 0, 1]);
}

function stairs(): Art {
  const c: Cam = { az: 30, el: 26, D: Infinity, k: 50, cx: 196, cy: 286 };
  const blocks: Box6[] = [];
  for (let i = 0; i < 6; i++) blocks.push([-2.6 + i * 0.85, 0, -1.3, -2.6 + (i + 1) * 0.85, (i + 1) * 0.6, 1.3]);
  return boxesScene(c, blocks, [-1, 0, 0], 6);
}

/** Light direction (pointing down, from the upper left and behind) for cast shadows. */
const LIGHT: V3 = [0.42, -1, 0.3];

/** Screen outline of the shadow that 3D points cast on the plane y = h. */
function castShadow(c: Cam, pts: readonly V3[], h: number): P[] {
  return hull(pts.map((p) => proj(c, add(p, mul(LIGHT, (h - p[1]) / LIGHT[1])))));
}

function stackedBoxes(): Art {
  const c: Cam = { az: 30, el: 30, D: 9, k: 60, cx: 200, cy: 270 };
  const parts: [Box6, number][] = [
    [[-1.4, 2.25, -0.8, 0.2, 3.3, 0.8], 18],
    [[-1.5, 1.05, -1.2, 1.3, 2.25, 1.0], -8],
    [[-2.2, 0, -1.4, 1.6, 1.05, 1.4], 6],
  ];
  const solids: Solid[] = [];
  const boxes = parts.map(([b, turn]) => box(...b, turn));
  const d: string[] = [];
  const regs: Region[] = [];
  boxes.forEach(({ V, F }, i) => {
    const s = polyhedron(c, V, F);
    solids.push(s);
    const cut = (x: string) => (regs.length && x ? clip(x, regs) : x);
    // dark side faces (turned to the right of the view)
    for (const fc of s.faces.filter((x) => Math.abs(x.normal[1]) < 1e-6 && toView(c, x.normal)[0] > 0)) {
      const h = cut(hatch((x, y) => inPoly(fc.pts, x, y), boxOf(fc.pts), -60, 6.5));
      if (h) d.push(h);
    }
    // shadow of the box above on this box's top face
    if (i > 0) {
      const top = s.faces.find((x) => x.normal[1] > 0.5);
      const sh = castShadow(c, boxes[i - 1].V, parts[i][0][4]);
      if (top) {
        const h = clip(hatch((x, y) => inPoly(sh, x, y) && inPoly(top.pts, x, y), boxOf(top.pts), 0, 5.5), [...regs, regs[i - 1]]);
        if (h) d.push(h);
      }
    }
    regs.push(shrunk(s.sil, 0.8));
  });
  const a = scene(solids);
  const floorSh = castShadow(c, boxes.flatMap((b) => b.V), 0);
  const fh = clip(hatch((x, y) => inPoly(floorSh, x, y), boxOf(floorSh), 0, 7), regs);
  if (fh) d.push(fh);
  const by = Math.max(...floorSh.map((q) => q[1]), ...solids[2].sil.map((q) => q[1])) + 10;
  return { p: [...a.p, line(36, by, 364, by)], d };
}

function formsStillLife(): Art {
  const c: Cam = { az: 18, el: 20, D: Infinity, k: 50, cx: 201, cy: 284 };
  const cub = box(-3.4, 0, -0.6, -1.4, 2, 1.4, -24);
  const ring = (b: V3, r: number, y: number): V3[] => Array.from({ length: 36 }, (_, i) => [b[0] + r * Math.cos(rad(i * 10)), y, b[2] + r * Math.sin(rad(i * 10))] as V3);
  const cyl = { b: [2.0, 0, -0.9] as V3, r: 0.95, h: 2.8 };
  const con = { b: [-0.6, 0, -2.4] as V3, r: 0.95, h: 3.4 };
  const sph = { o: [0.55, 1.05, 1.2] as V3, r: 1.05 };
  const sCube = polyhedron(c, cub.V, cub.F);
  const sCyl = cylinder(c, cyl.b, cyl.r, cyl.h);
  const sCone = cone(c, con.b, con.r, con.h);
  const sSph = sphere(c, sph.o, sph.r, [], []);
  const order = [sSph, sCube, sCyl, sCone];
  const a = scene(order);
  const regs = order.map((s) => shrunk(s.sil, 0.8));
  const d: string[] = [];
  // sphere: crescent of hatching on the side away from the light (light from the upper left)
  const C = proj(c, sph.o);
  const R = c.k * sph.r;
  d.push(hatch((x, y) => Math.hypot(x - C[0], y - C[1]) < R - 2 && Math.hypot(x - C[0] + R * 0.38, y - C[1] + R * 0.34) > R * 0.98, [C[0] - R, C[1] - R, C[0] + R, C[1] + R], 60, 5.5));
  for (const fc of sCube.faces.filter((x) => x.normal[1] < 0.5 && x.normal[0] > 0)) {
    const h = clip(hatch((x, y) => inPoly(fc.pts, x, y), boxOf(fc.pts), 60, 6), regs.slice(0, 1));
    if (h) d.push(h);
  }
  const band = (b: V3, r: number, h: number, a0: number, a1: number, apex = false): P[] => {
    const pts: P[] = [];
    if (apex) pts.push(proj(c, add(b, [0, h, 0])));
    else for (let i = a0; i <= a1; i += 5) pts.push(proj(c, [b[0] + r * Math.cos(rad(i)), b[1] + h, b[2] + r * Math.sin(rad(i))]));
    for (let i = a1; i >= a0; i -= 5) pts.push(proj(c, [b[0] + r * Math.cos(rad(i)), b[1], b[2] + r * Math.sin(rad(i))]));
    return pts;
  };
  const cylR = band(cyl.b, cyl.r, cyl.h, -20, 70);
  d.push(clip(hatch((x, y) => inPoly(cylR, x, y), boxOf(cylR), 90, 6), regs.slice(0, 2)));
  const coneR = band(con.b, con.r, con.h, -10, 80, true);
  d.push(clip(hatch((x, y) => inPoly(coneR, x, y), boxOf(coneR), 80, 6), regs.slice(0, 3)));
  // cast shadows on the table
  const sphPts: V3[] = [];
  for (let i = 0; i < 12; i++) for (let j = 1; j < 6; j++) sphPts.push(add(sph.o, mul([Math.sin(rad(j * 30)) * Math.cos(rad(i * 30)), Math.cos(rad(j * 30)), Math.sin(rad(j * 30)) * Math.sin(rad(i * 30))], sph.r)));
  const shadows = [
    castShadow(c, sphPts, 0),
    castShadow(c, cub.V, 0),
    castShadow(c, [...ring(cyl.b, cyl.r, 0), ...ring(cyl.b, cyl.r, cyl.h)], 0),
    castShadow(c, [...ring(con.b, con.r, 0), add(con.b, [0, con.h, 0])], 0),
  ];
  for (const sh of shadows) {
    const [bx0, by0, bx1, by1] = boxOf(sh);
    const h = clip(hatch((x, y) => inPoly(sh, x, y), [Math.max(22, bx0), by0, Math.min(378, bx1), by1], 0, 7), regs);
    if (h) d.push(h);
  }
  return { p: a.p, d: d.filter(Boolean) };
}

// ---- templates ---------------------------------------------------------------------------------------------------

export const shapes2: Template[] = [
  tpl('shape-cone', 'Cone with ellipse base', 'beginner', ['cone', 'shape', 'geometric', 'perspective', 'drawing-practice'], coneArt()),
  tpl('shape-cylinder', 'Upright cylinder', 'beginner', ['cylinder', 'shape', 'geometric', 'ellipse', 'drawing-practice'], cylinderArt()),
  tpl('shape-square-pyramid', 'Square pyramid', 'beginner', ['pyramid', 'shape', 'geometric', 'perspective', 'drawing-practice'], pyramidArt()),
  tpl('shape-triangular-prism', 'Triangular prism', 'beginner', ['prism', 'triangle', 'shape', 'geometric', 'drawing-practice'], prismArt()),
  tpl('shape-nested-squares', 'Whirl of nested squares', 'beginner', ['square', 'shape', 'geometric', 'optical', 'exercise'], nestedSquares()),
  tpl('shape-star-polygons', 'Star polygon set', 'beginner', ['polygons', 'stars', 'shape', 'geometric', 'exercise'], starPolygons()),
  tpl('shape-circle-grid', 'Circles in a square grid', 'beginner', ['circles', 'square', 'shape', 'geometric', 'exercise'], circleGrid()),
  tpl('shape-cube-two-point', 'Cube in two-point perspective', 'intermediate', ['cube', 'perspective', 'shape', 'vanishing-point', 'drawing-practice'], cubeTwoPoint()),
  tpl('shape-sphere-contours', 'Sphere with contour lines', 'intermediate', ['sphere', 'shape', 'contour', 'geometric', 'drawing-practice'], sphereContours()),
  tpl('shape-torus', 'Torus ring form', 'intermediate', ['torus', 'shape', 'contour', 'geometric', 'drawing-practice'], torusArt()),
  tpl('shape-hexagon-tiling', 'Hexagon tiling', 'intermediate', ['hexagon', 'shape', 'tiling', 'geometric', 'exercise'], hexTiling()),
  tpl('shape-square-spiral', 'Spiral of squares', 'intermediate', ['spiral', 'square', 'shape', 'golden', 'geometric'], squareSpiral()),
  tpl('shape-isometric-cubes', 'Isometric block of cubes', 'advanced', ['cube', 'isometric', 'shape', 'hatching', 'geometric'], isoCubes()),
  tpl('shape-stair-blocks', 'Stair block form', 'advanced', ['stairs', 'cube', 'perspective', 'shape', 'hatching'], stairs()),
  tpl('shape-stacked-boxes', 'Stacked boxes in perspective', 'advanced', ['cube', 'boxes', 'perspective', 'shape', 'hatching'], stackedBoxes()),
  tpl('shape-forms-still-life', 'Basic forms still life', 'advanced', ['sphere', 'cone', 'cylinder', 'cube', 'shape', 'hatching'], formsStillLife()),
];
