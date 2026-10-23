// Trade & workshop pack, part 2 (owner 23 Oct 2026: "the trade section ... could be the main selling point").
// 120+ more exact layout guides across every trade sub-category (src/core/tradeSubs.ts): compound crown mitres,
// sliding-bevel settings, joinery, wall/deck framing, roof pitches by ratio, weld symbols, flat patterns, lobster-back
// elbows, pipe saddles (exact unrolled curves), conduit bending, tile patterns, drafting constructions and set-out
// geometry. Every labelled angle, multiplier and ratio is computed from the geometry that is drawn; lengths are NOT
// to scale on paper (spacings like 450 / 600 are nominal and marked so). Original, generic line art (no standards
// logos or brands). Labels use a single-stroke font so they trace cleanly. Cheap to generate (not baked).
import type { Template, TemplateLevel } from '../templates.ts';
import { f, line, poly, rrect, type P } from './draw.ts';

const VB = '0 0 400 400';
const RAD = Math.PI / 180;

type Sub = 'angles' | 'carpentry' | 'framing' | 'metal' | 'pipe' | 'electrical' | 'tiling' | 'drafting' | 'layout';
/** A labelled angle that must be exact in the shipped data: [degrees, vertex, ray end A, ray end B]. */
type Claim = [number, P, P, P];
type Spec = {
  id: string;
  name: string;
  level: TemplateLevel;
  sub: Sub;
  tags: string[];
  paths: string[];
  detail?: string[];
  claims?: Claim[];
  /** Name pattern key + arguments, for the 10-locale name pack (src/i18n/packs/trade2.ts). */
  nk: (string | number)[];
};

// ---------------------------------------------------------------------------------------------- geometry helpers

/** Point at `deg` (counter-clockwise from +x, screen y down) and radius r from (cx, cy). */
function at(cx: number, cy: number, r: number, deg: number): P {
  return [cx + r * Math.cos(deg * RAD), cy - r * Math.sin(deg * RAD)];
}
const atP = (c: P, r: number, deg: number): P => at(c[0], c[1], r, deg);
/** Direction (degrees, counter-clockwise, screen y down) from a to b. */
const dirOf = (a: P, b: P): number => Math.atan2(-(b[1] - a[1]), b[0] - a[0]) / RAD;
const dist = (a: P, b: P): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function circle(cx: number, cy: number, r: number): string {
  return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
}

/** Arc from angle a to b (degrees, counter-clockwise) at radius r. */
function arc(cx: number, cy: number, r: number, a: number, b: number): string {
  const [x1, y1] = at(cx, cy, r, a);
  const [x2, y2] = at(cx, cy, r, b);
  const large = Math.abs(b - a) > 180 ? 1 : 0;
  return `M ${f(x1)} ${f(y1)} A ${f(r)} ${f(r)} 0 ${large} 0 ${f(x2)} ${f(y2)}`;
}
const arcP = (c: P, r: number, a: number, b: number) => arc(c[0], c[1], r, a, b);

/** Arc segment appended to a path (no M): from the current point to angle b, counter-clockwise (ccw) or not. */
function arcTo(c: P, r: number, from: number, to: number, ccw = true): string {
  const [x2, y2] = at(c[0], c[1], r, to);
  let sweep = ccw ? to - from : from - to;
  sweep = ((sweep % 360) + 360) % 360;
  return ` A ${f(r)} ${f(r)} 0 ${sweep > 180 ? 1 : 0} ${ccw ? 0 : 1} ${f(x2)} ${f(y2)}`;
}

const seg = (a: P, b: P) => line(a[0], a[1], b[0], b[1]);
const pl = (pts: readonly P[], closed = false) => poly(pts, closed);
const rect = (x: number, y: number, w: number, h: number) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

function ray(cx: number, cy: number, r: number, deg: number, r0 = 0): string {
  return seg(at(cx, cy, r0, deg), at(cx, cy, r, deg));
}

/** Right-angle box marker at a vertex between two perpendicular directions. */
function rightMark(v: P, a: number, b: number, s = 16): string {
  const p1 = atP(v, s, a);
  const p3 = atP(v, s, b);
  return pl([p1, [p1[0] + p3[0] - v[0], p1[1] + p3[1] - v[1]], p3]);
}

/** Line with an arrow head at the end. */
function arrow(a: P, b: P, s = 11): string {
  const d = dirOf(a, b);
  const h1 = atP(b, s, d + 155), h2 = atP(b, s, d - 155);
  return `${seg(a, b)} M ${f(h1[0])} ${f(h1[1])} L ${f(b[0])} ${f(b[1])} L ${f(h2[0])} ${f(h2[1])}`;
}
/** Dimension line with arrow heads at both ends. */
function dim(a: P, b: P, s = 9): string {
  const d = dirOf(a, b);
  const h = (p: P, dd: number) => {
    const h1 = atP(p, s, dd + 155), h2 = atP(p, s, dd - 155);
    return ` M ${f(h1[0])} ${f(h1[1])} L ${f(p[0])} ${f(p[1])} L ${f(h2[0])} ${f(h2[1])}`;
  };
  return seg(a, b) + h(b, d) + h(a, d + 180);
}

/** Line clipped to a box (Liang-Barsky), or null when it misses. */
function clipSeg(a: P, b: P, x0 = 0, y0 = 0, x1 = 400, y1 = 400): string | null {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]] as const) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  if ((t1 - t0) * Math.hypot(dx, dy) < 1.5) return null;
  return seg(lerp(a, b, t0), lerp(a, b, t1));
}

/** Convex polygon clipped to an axis-aligned box (Sutherland-Hodgman). */
function clipPoly(pts: readonly P[], x0: number, y0: number, x1: number, y1: number): P[] | null {
  let out: P[] = [...pts];
  const edges: [(p: P) => boolean, (a: P, b: P) => P][] = [
    [(p) => p[0] >= x0, (a, b) => lerp(a, b, (x0 - a[0]) / (b[0] - a[0]))],
    [(p) => p[0] <= x1, (a, b) => lerp(a, b, (x1 - a[0]) / (b[0] - a[0]))],
    [(p) => p[1] >= y0, (a, b) => lerp(a, b, (y0 - a[1]) / (b[1] - a[1]))],
    [(p) => p[1] <= y1, (a, b) => lerp(a, b, (y1 - a[1]) / (b[1] - a[1]))],
  ];
  for (const [inside, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i]!, prev = src[(i + src.length - 1) % src.length]!;
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (out.length < 3) return null;
  }
  // drop slivers
  let area = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!, b = out[(i + 1) % out.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) < 12 ? null : out;
}

/** Many closed polygons merged into a few path strings. */
function chunks(polys: readonly P[][], per = 30): string[] {
  const out: string[] = [];
  for (let i = 0; i < polys.length; i += per) out.push(polys.slice(i, i + per).map((p) => pl(p, true)).join(' '));
  return out;
}
function joinPaths(ds: readonly (string | null)[], per = 40): string[] {
  const ok = ds.filter((d): d is string => !!d);
  const out: string[] = [];
  for (let i = 0; i < ok.length; i += per) out.push(ok.slice(i, i + per).join(' '));
  return out;
}

// ---------------------------------------------------------------------------------------- single-stroke labels

// Glyphs on a 6 x 10 cell (x right, y down), as polylines. Digits match trade.ts.
const G: Record<string, readonly (readonly P[])[]> = {
  '0': [[[1, 0], [5, 0], [6, 1], [6, 9], [5, 10], [1, 10], [0, 9], [0, 1], [1, 0]]],
  '1': [[[1.5, 2], [3.5, 0], [3.5, 10]], [[1.5, 10], [5.5, 10]]],
  '2': [[[0, 2], [1, 0], [5, 0], [6, 1.5], [6, 3.5], [0, 10], [6, 10]]],
  '3': [[[0, 0], [6, 0], [3, 4], [5, 4], [6, 5.5], [6, 8.5], [5, 10], [1, 10], [0, 9]]],
  '4': [[[4.5, 10], [4.5, 0], [0, 7], [6, 7]]],
  '5': [[[6, 0], [0.5, 0], [0, 4.5], [4.5, 4], [6, 5.5], [6, 8.5], [5, 10], [1, 10], [0, 9]]],
  '6': [[[5.5, 0], [2, 0], [0, 3], [0, 9], [1, 10], [5, 10], [6, 9], [6, 6], [5, 5], [1, 5], [0, 6]]],
  '7': [[[0, 0], [6, 0], [2, 10]]],
  '8': [[[1, 0], [5, 0], [6, 1], [6, 3.5], [5, 4.6], [1, 4.6], [0, 3.5], [0, 1], [1, 0]], [[1, 4.6], [0, 5.8], [0, 9], [1, 10], [5, 10], [6, 9], [6, 5.8], [5, 4.6]]],
  '9': [[[6, 4], [5, 5], [1, 5], [0, 4], [0, 1], [1, 0], [5, 0], [6, 1], [6, 7], [4, 10], [0.5, 10]]],
  '.': [[[2, 8.2], [4, 8.2], [4, 10], [2, 10], [2, 8.2]]],
  ':': [[[2, 1.8], [4, 1.8], [4, 3.6], [2, 3.6], [2, 1.8]], [[2, 8.2], [4, 8.2], [4, 10], [2, 10], [2, 8.2]]],
  '°': [[[1, 0], [3, 0], [4, 1], [4, 3], [3, 4], [1, 4], [0, 3], [0, 1], [1, 0]]],
  "'": [[[3, 0], [2.2, 3.5]]],
  '-': [[[1, 5], [5, 5]]],
  '/': [[[5, 0], [1, 10]]],
  '+': [[[3, 2.5], [3, 7.5]], [[0.5, 5], [5.5, 5]]],
  '=': [[[0.5, 3.5], [5.5, 3.5]], [[0.5, 6.5], [5.5, 6.5]]],
  x: [[[1, 4], [5, 10]], [[5, 4], [1, 10]]],
  A: [[[0, 10], [3, 0], [6, 10]], [[1, 6.5], [5, 6.5]]],
  B: [[[0, 10], [0, 0], [4.5, 0], [6, 1.5], [6, 3.5], [4.5, 5], [0, 5]], [[4.5, 5], [6, 6.5], [6, 8.5], [4.5, 10], [0, 10]]],
  C: [[[6, 1], [5, 0], [1, 0], [0, 1], [0, 9], [1, 10], [5, 10], [6, 9]]],
  D: [[[0, 0], [4, 0], [6, 2], [6, 8], [4, 10], [0, 10], [0, 0]]],
  E: [[[6, 0], [0, 0], [0, 10], [6, 10]], [[0, 5], [4.5, 5]]],
  F: [[[6, 0], [0, 0], [0, 10]], [[0, 5], [4.5, 5]]],
  G: [[[6, 1], [5, 0], [1, 0], [0, 1], [0, 9], [1, 10], [5, 10], [6, 9], [6, 5.5], [3.5, 5.5]]],
  H: [[[0, 0], [0, 10]], [[6, 0], [6, 10]], [[0, 5], [6, 5]]],
  I: [[[1.5, 0], [4.5, 0]], [[3, 0], [3, 10]], [[1.5, 10], [4.5, 10]]],
  J: [[[6, 0], [6, 9], [5, 10], [1, 10], [0, 9], [0, 7.5]]],
  K: [[[0, 0], [0, 10]], [[6, 0], [0, 6]], [[2, 4], [6, 10]]],
  L: [[[0, 0], [0, 10], [6, 10]]],
  M: [[[0, 10], [0, 0], [3, 6], [6, 0], [6, 10]]],
  N: [[[0, 10], [0, 0], [6, 10], [6, 0]]],
  O: [[[1.5, 0], [4.5, 0], [6, 1.5], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.5], [0, 1.5], [1.5, 0]]],
  P: [[[0, 10], [0, 0], [4.5, 0], [6, 1.5], [6, 3.5], [4.5, 5], [0, 5]]],
  R: [[[0, 10], [0, 0], [4.5, 0], [6, 1.5], [6, 3.5], [4.5, 5], [0, 5]], [[3, 5], [6, 10]]],
  S: [[[6, 1], [5, 0], [1, 0], [0, 1], [0, 4], [1, 5], [5, 5], [6, 6], [6, 9], [5, 10], [1, 10], [0, 9]]],
  T: [[[0, 0], [6, 0]], [[3, 0], [3, 10]]],
  U: [[[0, 0], [0, 9], [1, 10], [5, 10], [6, 9], [6, 0]]],
  V: [[[0, 0], [3, 10], [6, 0]]],
  W: [[[0, 0], [1.5, 10], [3, 4], [4.5, 10], [6, 0]]],
  X: [[[0, 0], [6, 10]], [[6, 0], [0, 10]]],
  Y: [[[0, 0], [3, 5], [6, 0]], [[3, 5], [3, 10]]],
  Z: [[[0, 0], [6, 0], [0, 10], [6, 10]]],
};

/** Text as one stroked path. (x, y) is the centre of the label; h is the cap height. */
export function txt(text: string, x: number, y: number, h = 16): string {
  const k = h / 10;
  const adv = (ch: string) => (ch === ' ' ? 5 : ch === '°' || ch === "'" ? 5 : ch === '.' || ch === ':' ? 5 : 8) * k;
  const width = [...text].reduce((w, ch) => w + adv(ch), 0) - 2 * k;
  let cx = x - width / 2;
  const top = y - h / 2;
  const out: string[] = [];
  for (const ch of text) {
    const g = G[ch];
    if (g) for (const p of g) out.push(pl(p.map(([gx, gy]) => [cx + gx * k, top + gy * k] as P)));
    cx += adv(ch);
  }
  const d = out.join(' ');
  LABELS.add(d);
  return d;
}
const LABELS = new Set<string>();

/** Mirror a spec's geometry left-right ('x') or top-bottom ('y'); labels move but stay readable. */
function flip(sp: Spec, axis: 'x' | 'y'): Spec {
  const fx = (x: number) => (axis === 'x' ? 400 - x : x), fy = (y: number) => (axis === 'y' ? 400 - y : y);
  const fd = (d: string): string => {
    if (LABELS.has(d)) {
      const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
      const dx = axis === 'x' ? 400 - (Math.min(...xs) + Math.max(...xs)) : 0;
      const dy = axis === 'y' ? 400 - (Math.min(...ys) + Math.max(...ys)) : 0;
      let i = 0;
      return d.replace(/-?\d+(?:\.\d+)?/g, (m) => f(Number(m) + (i++ % 2 === 0 ? dx : dy)));
    }
    return d.replace(/([MLQA])([^MLQAZ]*)/g, (_m, c: string, args: string) => {
      const n = (args.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const o: string[] = [];
      if (c === 'A') {
        for (let i = 0; i + 7 <= n.length; i += 7) o.push(`${f(n[i]!)} ${f(n[i + 1]!)} ${f(n[i + 2]!)} ${n[i + 3]} ${1 - n[i + 4]!} ${f(fx(n[i + 5]!))} ${f(fy(n[i + 6]!))}`);
      } else for (let i = 0; i + 2 <= n.length; i += 2) o.push(`${f(fx(n[i]!))} ${f(fy(n[i + 1]!))}`);
      return `${c} ${o.join(' ')} `;
    }).trim().replace(/\s+/g, ' ');
  };
  const fp = (p: P): P => [fx(p[0]), fy(p[1])];
  return {
    ...sp,
    paths: sp.paths.map(fd),
    detail: sp.detail?.map(fd),
    claims: sp.claims?.map(([dd, v, a, b]) => [dd, fp(v), fp(a), fp(b)] as Claim),
  };
}

/** Degrees label: integer or one decimal. */
const dg = (a: number) => {
  const r = Math.round(a * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}°`;
};
const idNum = (a: number) => String(Math.round(a * 10) / 10).replace('.', '-');
const fix = (v: number, n: number) => v.toFixed(n);

// ================================================================================================= ANGLES

/** Compound mitre for crown moulding laid flat on a mitre saw: spring angle S, wall corner W. */
function crown(S: number, W: number, level: TemplateLevel): Spec {
  const M = Math.atan(Math.sin(S * RAD) / Math.tan((W / 2) * RAD)) / RAD;
  const B = Math.asin(Math.cos(S * RAD) * Math.cos((W / 2) * RAD)) / RAD;
  const paths: string[] = [], detail: string[] = [], claims: Claim[] = [];
  // spring angle: wall / ceiling corner with the moulding's back across it
  const c: P = [50, 40], h = 104, w = h * Math.tan(S * RAD);
  const pw: P = [c[0], c[1] + h], pc: P = [c[0] + w, c[1]];
  paths.push(pl([[c[0], c[1] + h + 26], c, [c[0] + w + 34, c[1]]]), seg(pw, pc));
  const n: P = [h / Math.hypot(w, h), w / Math.hypot(w, h)];
  const fa = add(pw, [n[0] * 20, n[1] * 20]), fb = add(pc, [n[0] * 20, n[1] * 20]);
  const fm = add(mid(pw, pc), [n[0] * 44, n[1] * 44]);
  detail.push(`M ${f(pw[0])} ${f(pw[1])} L ${f(fa[0])} ${f(fa[1])} Q ${f(fm[0])} ${f(fm[1])} ${f(fb[0])} ${f(fb[1])} L ${f(pc[0])} ${f(pc[1])}`);
  detail.push(arcP(pw, 34, 90 - S, 90));
  paths.push(txt(dg(S), c[0] + 20, c[1] + 26, 11), txt('SPRING', c[0] + 52, 18, 10));
  claims.push([S, pw, c, pc]);
  // wall corner in plan
  const v: P = [282, 50], len = 96;
  const e1 = atP(v, len, 270 - W / 2), e2 = atP(v, len, 270 + W / 2);
  paths.push(pl([e1, v, e2]));
  detail.push(arcP(v, 30, 270 - W / 2, 270 + W / 2));
  paths.push(txt(dg(W), v[0], v[1] + 56, 13), txt('CORNER', v[0], v[1] + 84, 10));
  claims.push([W, v, e1, e2]);
  // mitre (table) and bevel (blade tilt) settings
  const v1: P = [110, 350];
  const z1: P = [110, 190], c1 = atP(v1, 160, 90 - M);
  paths.push(pl([[30, 350], v1, [190, 350]]), seg(v1, z1), seg(v1, c1));
  detail.push(arcP(v1, 70, 90 - M, 90));
  paths.push(txt(dg(M), 110 + 40 * Math.sin(M * RAD) + 8, 172, 16), txt('MITRE', 110, 374, 11));
  claims.push([M, v1, z1, c1]);
  const v2: P = [290, 350];
  const z2: P = [290, 190], c2 = atP(v2, 160, 90 + B);
  paths.push(pl([[210, 350], v2, [370, 350]]), seg(v2, z2), seg(v2, c2));
  detail.push(arcP(v2, 70, 90, 90 + B));
  paths.push(txt(dg(B), 290 - 40 * Math.sin(B * RAD) - 8, 172, 16), txt('BEVEL', 290, 374, 11));
  claims.push([B, v2, z2, c2]);
  return {
    id: `crown-mitre-${S}-${W}`,
    name: `Crown mitre and bevel, ${S}° spring, ${W}° corner`,
    level,
    sub: 'angles',
    tags: ['crown', 'compound-mitre', 'mitre', 'bevel', 'carpentry'],
    paths,
    detail,
    claims,
    nk: ['crown', S, W],
  };
}

/** Skirting boards meeting in a wall corner of W degrees: the mitre saw setting is (180 - W) / 2. */
function skirting(W: number): Spec {
  const cut = (180 - W) / 2;
  const v: P = [300, 270], t = 40;
  const d2 = 180 - W;
  const wa: P = [40, 270], wb = atP(v, Math.min(150, 75 / Math.cos(d2 * RAD)), d2);
  const q = atP(v, t / Math.sin((W / 2) * RAD), 180 - W / 2);
  const nb = at(0, 0, t, d2 + 90);
  const fb = add(wb, nb);
  const paths = [pl([wa, v, wb]), pl([wa, [40, 270 - t], q, fb, wb]), seg(v, q)];
  const sq = atP(v, t + 44, 90);
  paths.push(seg(v, sq));
  const detail = [arcP(v, t + 30, 90, 180 - W / 2)];
  // hatch behind the walls
  for (let x = 60; x <= 280; x += 20) detail.push(seg([x, 270], [x - 12, 284]));
  const lab = atP(v, t + 66, 90 + cut / 2);
  paths.push(txt(dg(cut), lab[0] - 8, lab[1] - 6, 16), txt('SAW', lab[0] - 8, lab[1] - 28, 10));
  // the wall corner, drawn alone below
  const pv: P = [190, 362];
  const p1: P = [70, 362], p2 = atP(pv, 80, d2);
  paths.push(pl([p1, pv, p2]));
  detail.push(arcP(pv, 26, d2, 180));
  const pl2 = atP(pv, 44, 180 - W / 2);
  paths.push(txt(dg(W), pl2[0], pl2[1] - 4, 12));
  return {
    id: `skirting-mitre-${W}`,
    name: `Skirting mitre for a ${W}° corner`,
    level: 'intermediate',
    sub: 'angles',
    tags: ['skirting', 'baseboard', 'mitre', 'trim', 'carpentry'],
    paths,
    detail,
    claims: [[cut, v, sq, q], [W, pv, p1, p2]],
    nk: ['skirting', W],
  };
}

/** Sliding bevel set to an odd angle. */
function slidingBevel(a: number): Spec {
  const v: P = [340, 285], s0: P = [90, 285];
  const d = 180 - a;
  const e = atP(v, 270, d);
  const o = at(0, 0, 22, 90 - a);
  const paths = [
    pl([s0, v]),
    pl([v, [v[0], 318], [s0[0], 318], s0]),
    pl([v, e]),
    pl([e, add(e, o), add(v, o)]),
  ];
  const detail = [
    seg(atP(add(v, [o[0] / 2, o[1] / 2]), 40, d), atP(add(v, [o[0] / 2, o[1] / 2]), 200, d)),
    circle(v[0] - 14, v[1] + 16, 7),
    seg([110, 285], [110, 318]),
    seg([300, 285], [300, 318]),
    arcP(v, 150, d, 180),
  ];
  const r = Math.min(232, Math.max(120, 46 / Math.tan(a * RAD)));
  const lp = atP(v, r, 180 - a / 2);
  paths.push(txt(dg(a), lp[0], lp[1] + 2, a < 14 ? 13 : 18));
  paths.push(txt('SLIDING BEVEL', 210, 352, 11));
  return {
    id: `sliding-bevel-${idNum(a)}`,
    name: `Sliding bevel set to ${dg(a)}`,
    level: 'beginner',
    sub: 'angles',
    tags: ['sliding-bevel', 'bevel', 'angle-guide', 'carpentry'],
    paths,
    detail,
    claims: [[a, v, s0, e]],
    nk: ['bevel', dg(a)],
  };
}

/** Full 360° protractor with 1° ticks and a degree-minute (5') vernier. */
function protractor360(): Spec {
  const c: P = [200, 200], R = 176;
  const paths = [circle(200, 200, R), circle(200, 200, 70)];
  const minor: string[] = [], major: string[] = [];
  for (let a = 0; a < 360; a++) {
    const l = a % 10 === 0 ? 22 : a % 5 === 0 ? 14 : 8;
    (a % 10 === 0 ? major : minor).push(ray(200, 200, R, a, R - l));
  }
  paths.push(major.join(' '));
  const labels: string[] = [];
  for (let a = 0; a < 360; a += 10) {
    const p = atP(c, R - 36, a);
    labels.push(txt(String(a), p[0], p[1], 9));
  }
  paths.push(labels.join(' '));
  // vernier: 12 divisions over 23°, each one reads 5 minutes
  const vt: string[] = [arc(200, 200, 118, -2, 25), arc(200, 200, 98, -2, 25)];
  for (let k = 0; k <= 12; k++) vt.push(ray(200, 200, 118, (23 * k) / 12, k % 6 === 0 ? 98 : 106));
  paths.push(vt.join(' '));
  for (const [k, s] of [[0, "0'"], [6, "30'"], [12, "60'"]] as const) {
    const p = atP(c, 86, (23 * k) / 12);
    paths.push(txt(s, p[0], p[1], 8));
  }
  const detail = [minor.join(' '), seg([186, 200], [214, 200]), seg([200, 186], [200, 214]), circle(200, 200, 3)];
  return {
    id: 'protractor-360-vernier',
    name: '360° protractor with minute vernier',
    level: 'advanced',
    sub: 'angles',
    tags: ['protractor', 'degrees', 'vernier', 'measuring'],
    paths,
    detail,
    nk: ['prot360'],
  };
}

function bisector(): Spec {
  const v: P = [50, 330], A = 74;
  const ea = atP(v, 310, 0), eb = atP(v, 300, A);
  const pa = atP(v, 120, 0), pb = atP(v, 120, A);
  const r2 = 112;
  const hc = 120 * Math.cos((A / 2) * RAD), hs = 120 * Math.sin((A / 2) * RAD);
  const dp = hc + Math.sqrt(r2 * r2 - hs * hs);
  const p = atP(v, dp, A / 2);
  const bis = atP(v, 300, A / 2);
  const paths = [pl([ea, v, eb]), seg(v, bis)];
  const detail = [arcP(v, 120, -6, A + 6)];
  for (const q of [pa, pb]) {
    const dq = dirOf(q, p);
    detail.push(arcP(q, r2, dq - 14, dq + 14));
  }
  detail.push(circle(p[0], p[1], 4), circle(pa[0], pa[1], 3), circle(pb[0], pb[1], 3));
  const l1 = atP(v, 230, A / 4), l2 = atP(v, 230, (3 * A) / 4);
  paths.push(txt(dg(A / 2), l1[0], l1[1], 15), txt(dg(A / 2), l2[0] + 6, l2[1], 15));
  return {
    id: 'angle-bisector-construction',
    name: 'Angle bisector construction',
    level: 'beginner',
    sub: 'angles',
    tags: ['bisector', 'compass', 'construction', 'layout'],
    paths,
    detail,
    claims: [[A / 2, v, ea, bis], [A / 2, v, bis, eb]],
    nk: ['bisector'],
  };
}

function dovetailGauge(r1: number, r2: number): Spec {
  const paths: string[] = [], detail: string[] = [], claims: Claim[] = [];
  for (const [r, vx, sgn] of [[r1, 110, 1], [r2, 290, -1]] as const) {
    const v: P = [vx, 330], top: P = [vx, 70];
    const e: P = [vx + (sgn * 260) / r, 70];
    paths.push(pl([top, v, e]), seg(top, e));
    for (let i = 1; i < r; i++) detail.push(seg([vx, 70 + (260 * i) / r], [vx - sgn * 10, 70 + (260 * i) / r]));
    const ang = Math.atan(1 / r) / RAD;
    detail.push(arcP(v, 120, sgn > 0 ? 90 - ang : 90, sgn > 0 ? 90 : 90 + ang));
    paths.push(txt(`1:${r}`, vx, 360, 18), txt(dg(ang), vx + sgn * 44, 196, 14));
    claims.push(sgn > 0 ? [ang, v, top, e] : [ang, v, e, top]);
  }
  return {
    id: `dovetail-gauge-${r1}-${r2}`,
    name: `Dovetail gauge 1:${r1} and 1:${r2}`,
    level: 'beginner',
    sub: 'angles',
    tags: ['dovetail', 'gauge', 'slope', 'joinery'],
    paths,
    detail,
    claims,
    nk: ['dtgauge', r1, r2],
  };
}

// ================================================================================================= CARPENTRY

function mortiseTenon(): Spec {
  const paths = [
    rect(50, 30, 80, 340),
    pl([[360, 110], [210, 110], [210, 140], [160, 140], [160, 260], [210, 260], [210, 290], [360, 290]]),
    arrow([152, 200], [138, 200], 9),
    rect(250, 320, 90, 50),
    rect(280, 320, 30, 50),
    txt('1/3', 295, 306, 11),
  ];
  const detail = [rect(70, 140, 40, 120), seg([90, 140], [90, 260]), seg([210, 140], [210, 260])];
  return { id: 'joint-mortise-tenon', name: 'Mortise and tenon joint', level: 'beginner', sub: 'carpentry', tags: ['mortise', 'tenon', 'joinery', 'woodwork'], paths, detail, nk: ['mortise'] };
}

function halfLap(): Spec {
  const paths = [
    pl([[40, 250], [190, 250], [190, 280], [250, 280], [250, 310], [40, 310]], true),
    pl([[190, 120], [360, 120], [360, 180], [250, 180], [250, 150], [190, 150]], true),
    arrow([220, 192], [220, 268], 9),
    txt('1/2', 280, 265, 11),
  ];
  const detail = [seg([190, 280], [190, 310]), seg([190, 150], [190, 180]), seg([190, 180], [250, 180])];
  return { id: 'joint-half-lap', name: 'Half-lap joint', level: 'beginner', sub: 'carpentry', tags: ['half-lap', 'lap', 'joinery', 'woodwork'], paths, detail, nk: ['halflap'] };
}

function bridle(): Spec {
  const paths = [
    pl([[120, 370], [120, 220], [173, 220], [173, 300], [227, 300], [227, 220], [280, 220], [280, 370]], true),
    pl([[120, 40], [280, 40], [280, 130], [227, 130], [227, 190], [173, 190], [173, 130], [120, 130]], true),
    arrow([320, 150], [320, 210], 9),
    txt('1/3', 200, 270, 12),
  ];
  const detail = [seg([173, 220], [227, 220]), seg([120, 160], [173, 160]), seg([227, 160], [280, 160])];
  return { id: 'joint-bridle', name: 'Bridle joint', level: 'intermediate', sub: 'carpentry', tags: ['bridle', 'open-mortise', 'joinery', 'woodwork'], paths, detail, nk: ['bridle'] };
}

function housing(stopped: boolean): Spec {
  if (!stopped) {
    const paths = [
      pl([[40, 250], [175, 250], [175, 275], [225, 275], [225, 250], [360, 250], [360, 320], [40, 320]], true),
      rect(175, 50, 50, 170),
      arrow([260, 150], [260, 230], 9),
      txt('1/3', 290, 290, 11),
    ];
    const detail = [seg([175, 220], [225, 220])];
    for (let x = 50; x <= 350; x += 25) if (x < 170 || x > 230) detail.push(seg([x, 300], [x + 10, 310]));
    return { id: 'joint-housing-dado', name: 'Housing (dado) joint', level: 'beginner', sub: 'carpentry', tags: ['housing', 'dado', 'shelf', 'joinery'], paths, detail, nk: ['housing'] };
  }
  // plan of a side panel with a stopped housing, and the notched shelf front
  const paths = [
    rect(60, 40, 140, 320),
    pl([[110, 40], [110, 300], [150, 300], [150, 40]]),
    pl([[240, 300], [240, 360], [370, 360], [370, 260], [280, 260], [280, 300], [240, 300]], true),
    arrow([230, 200], [175, 200], 9),
  ];
  const detail = [seg([240, 260], [280, 260]), seg([110, 300], [150, 300])];
  return { id: 'joint-stopped-housing', name: 'Stopped housing joint', level: 'intermediate', sub: 'carpentry', tags: ['housing', 'stopped-dado', 'shelf', 'joinery'], paths, detail, nk: ['stoppedhousing'] };
}

function rebate(): Spec {
  const paths = [
    pl([[60, 360], [60, 140], [100, 140], [100, 180], [140, 180], [140, 360]], true),
    rect(170, 70, 200, 40),
    arrow([200, 120], [148, 150], 9),
    txt('1/2', 80, 126, 10),
  ];
  const detail = [seg([100, 180], [100, 360])];
  return { id: 'joint-rebate', name: 'Rebate (rabbet) joint', level: 'beginner', sub: 'carpentry', tags: ['rebate', 'rabbet', 'joinery', 'woodwork'], paths, detail, nk: ['rebate'] };
}

function tongueGroove(): Spec {
  const y0 = 160, y1 = 240, a0 = 187, a1 = 213;
  const paths = [
    pl([[30, y0], [164, y0], [170, y0 + 6], [170, a0], [198, a0], [198, a1], [170, a1], [170, y1], [30, y1]], true),
    pl([[370, y0], [226, y0], [220, y0 + 6], [220, a0], [248, a0], [248, a1], [220, a1], [220, y1], [370, y1]], true),
    txt('1/3', 209, 128, 12),
  ];
  const detail = [seg([209, 138], [209, 150])];
  for (let x = 40; x <= 150; x += 22) detail.push(`M ${f(x)} ${y0 + 15} Q ${f(x + 18)} ${y0 + 40} ${f(x)} ${y1 - 15}`);
  for (let x = 250; x <= 360; x += 22) detail.push(`M ${f(x)} ${y0 + 15} Q ${f(x + 18)} ${y0 + 40} ${f(x)} ${y1 - 15}`);
  return { id: 'joint-tongue-groove', name: 'Tongue and groove profile', level: 'beginner', sub: 'carpentry', tags: ['tongue-groove', 'boards', 'joinery', 'flooring'], paths, detail, nk: ['tng'] };
}

function biscuit(): Spec {
  const n = 5, x0 = 40, x1 = 360, s = (x1 - x0) / n;
  const paths = [rect(x0, 90, x1 - x0, 100), rect(x0, 210, x1 - x0, 100)];
  const slots: string[] = [];
  const detail: string[] = [];
  for (let i = 0; i < n; i++) {
    const cx = x0 + s * (i + 0.5);
    for (const y of [190, 210]) {
      slots.push(`M ${f(cx - 26)} ${y} A 40 40 0 0 ${y === 190 ? 1 : 0} ${f(cx + 26)} ${y}`);
      detail.push(seg([cx, y === 190 ? 160 : 240], [cx, y === 190 ? 196 : 204]));
    }
  }
  paths.push(slots.join(' '), txt('1/2', x0 + s / 4, 70, 10), txt('1', x0 + s, 70, 10));
  detail.push(dim([x0, 80], [x0 + s / 2, 80], 6), dim([x0 + s / 2, 80], [x0 + 1.5 * s, 80], 6));
  return { id: 'joint-biscuit-spacing', name: 'Biscuit joint spacing layout', level: 'intermediate', sub: 'carpentry', tags: ['biscuit', 'spacing', 'edge-joint', 'joinery'], paths, detail, nk: ['biscuit'] };
}

function dowel(): Spec {
  const paths = [rect(40, 60, 320, 70), rect(40, 260, 320, 70)];
  const holes: string[] = [], detail: string[] = [seg([30, 95], [370, 95]), seg([30, 295], [370, 295])];
  const xs = [70, 150, 250, 330];
  for (const x of xs) {
    holes.push(circle(x, 95, 12), circle(x, 295, 12));
    detail.push(seg([x, 140], [x, 250]));
  }
  paths.push(holes.join(' '), txt('1/2', 385 - 12, 112, 9));
  detail.push(dim([20, 60], [20, 95], 6));
  return { id: 'joint-dowel-spacing', name: 'Dowel joint layout', level: 'beginner', sub: 'carpentry', tags: ['dowel', 'spacing', 'edge-joint', 'joinery'], paths, detail, nk: ['dowel'] };
}

function hingeMortise(): Spec {
  const paths = [
    pl([[150, 20], [150, 380]]),
    pl([[230, 20], [230, 380]]),
    rect(150, 120, 62, 150),
  ];
  const detail: string[] = [];
  const screws: string[] = [];
  for (const y of [145, 195, 245]) screws.push(circle(186, y, 8));
  paths.push(screws.join(' '));
  for (const y of [145, 195, 245]) detail.push(seg([180, y], [192, y]));
  detail.push(seg([158, 120], [158, 270]));
  paths.push(txt('DOOR EDGE', 300, 200, 10));
  return { id: 'joint-hinge-mortise', name: 'Butt hinge mortise layout', level: 'intermediate', sub: 'carpentry', tags: ['hinge', 'mortise', 'door', 'carpentry'], paths, detail, nk: ['hinge'] };
}

function drawerBox(): Spec {
  // plan of a drawer box, and the corner as seen from the side (interlocking fingers)
  const paths = [rect(40, 40, 150, 110), rect(56, 56, 118, 78)];
  const n = 7, x0 = 230, x1 = 360, y0 = 40, y1 = 360;
  const h = (y1 - y0) / n, w = 40;
  const pts: P[] = [[x0, y0]];
  for (let i = 0; i < n; i++) {
    const inX = i % 2 === 0 ? x0 + w : x0;
    pts.push([inX, y0 + i * h], [inX, y0 + (i + 1) * h]);
  }
  pts.push([x0, y1]);
  paths.push(pl(pts), seg([x0, y0], [x1, y0]), seg([x0, y1], [x1, y1]), seg([x0, y0], [x0, y1]));
  const detail: string[] = [seg([x0 + w, y0], [x0 + w, y1])];
  return { id: 'joint-drawer-box', name: 'Drawer box joint corner', level: 'intermediate', sub: 'carpentry', tags: ['box-joint', 'drawer', 'finger', 'joinery'], paths, detail, nk: ['drawerbox'] };
}

function splinedMitre(): Spec {
  const v: P = [60, 340], w = 70;
  const o: P = [60 + w, 340 - w];
  const paths = [
    pl([[360, 340], v, [60, 40]]),
    pl([[360, 340 - w], o, [60 + w, 40]]),
    seg(v, o),
    seg([360, 340], [360, 340 - w]),
    seg([60, 40], [60 + w, 40]),
  ];
  const c = mid(v, o);
  const sp = (d: number, r: number) => atP(c, r, d);
  const s1 = sp(135, 30), s2 = sp(-45, 30);
  const k = at(0, 0, 9, 45);
  paths.push(pl([add(s1, k), add(s2, k), add(s2, [-k[0], -k[1]]), add(s1, [-k[0], -k[1]])], true));
  paths.push(txt('45°', 170, 300, 16));
  const detail = [arcP(v, 90, 0, 45), arcP(v, 70, 45, 90)];
  return {
    id: 'joint-splined-mitre', name: 'Splined mitre joint', level: 'intermediate', sub: 'carpentry', tags: ['spline', 'mitre', 'frame', 'joinery'], paths, detail,
    claims: [[45, v, [360, 340], o], [45, v, o, [60, 40]]],
    nk: ['spline'],
  };
}

function scarf(): Spec {
  const ang = Math.atan(1 / 8) / RAD;
  const paths = [
    pl([[20, 130], [360, 130], [40, 170], [20, 170]], true),
    pl([[40, 240], [380, 240], [380, 200], [360, 200]], true),
    arrow([200, 176], [200, 208], 8),
    txt('1:8', 120, 290, 18),
    txt(dg(ang), 116, 216, 12),
  ];
  const detail = [arcP([40, 240], 60, 0, ang)];
  return { id: 'joint-scarf', name: 'Scarf joint 1:8', level: 'intermediate', sub: 'carpentry', tags: ['scarf', 'splice', 'joinery', 'timber'], paths, detail, claims: [[ang, [40, 240], [380, 240], [360, 200]]], nk: ['scarf'] };
}

function birdsmouth(p: number): Spec {
  const t = Math.tan(p * RAD);
  const cpt: P = [200, 250]; // outer top corner of the wall plate
  const yb = (x: number) => 250 + 22 - (x - 200) * t; // rafter underside (22 below the plate corner at x = 200)
  const sx = 200 + 22 / t; // seat cut meets the underside
  const tail: P = [40, yb(40)], d: P = [200, yb(200)], s: P = [sx, 250];
  const x2 = 380;
  const top = (x: number) => yb(x) - 70 / Math.cos(p * RAD);
  const paths = [
    pl([tail, d, cpt, s, [x2, yb(x2)]]),
    seg([40, top(40)], [x2, top(x2)]),
    seg(tail, [40, top(40)]),
    rect(200, 250, 90, 60),
    pl([[210, 310], [210, 380]]),
    pl([[280, 310], [280, 380]]),
  ];
  const detail = [arcP(s, 34, 180, 180 + p)];
  paths.push(txt(dg(p), 252, 296, 13), txt('SEAT', s[0] + 30, 240, 9), txt('PLUMB', 168, 290, 9));
  return {
    id: `birdsmouth-${idNum(p)}`,
    name: `Birdsmouth cut for a ${dg(p)} rafter`,
    level: 'intermediate',
    sub: 'carpentry',
    tags: ['birdsmouth', 'rafter', 'seat-cut', 'roofing'],
    paths,
    detail,
    claims: [[p, s, cpt, tail]],
    nk: ['birdsmouth', dg(p)],
  };
}

function mitreFrame(n: number): Spec {
  const c: P = [200, 205], R = 175, w = n > 6 ? 30 : 46;
  const r2 = R - w / Math.cos((180 / n) * RAD);
  const outer: P[] = [], inner: P[] = [];
  for (let i = 0; i < n; i++) {
    outer.push(atP(c, R, 90 + (360 / n) * i));
    inner.push(atP(c, r2, 90 + (360 / n) * i));
  }
  const cut = 180 / n; // saw setting from square
  const paths = [pl(outer, true), pl(inner, true)];
  const joints = outer.map((o, i) => seg(o, inner[i]!)).join(' ');
  paths.push(joints);
  // square line across the member next to the bottom corner, and the mitre angle from it
  const k = n === 5 ? 3 : 5; // a lower vertex
  const vtx = outer[k]!, nxt = outer[(k + 1) % n]!;
  const edgeDir = dirOf(vtx, nxt);
  const sqEnd = atP(vtx, w + 40, edgeDir + 90);
  paths.push(seg(vtx, sqEnd));
  const jd = dirOf(vtx, inner[k]!);
  const detail = [arcP(vtx, w + 14, Math.min(edgeDir + 90, jd), Math.max(edgeDir + 90, jd)), circle(200, 205, 3), seg(inner[k]!, c)];
  const lp = atP(c, r2 * 0.45, 270);
  paths.push(txt(dg(cut), lp[0], lp[1], 20));
  return {
    id: `mitre-frame-${n}-sided`,
    name: `${dg(cut)} mitre for a ${n}-sided frame`,
    level: n > 6 ? 'advanced' : 'intermediate',
    sub: 'carpentry',
    tags: ['mitre', 'frame', 'polygon', 'joinery'],
    paths,
    detail,
    claims: [[cut, vtx, sqEnd, c]],
    nk: ['mitreframe', dg(cut), n],
  };
}

// ================================================================================================= FRAMING

function studLayout(sp: 450 | 600): Spec {
  const px = sp === 450 ? 72 : 96;
  const xs: number[] = [];
  for (let x = 38; x < 362 - 20; x += px) xs.push(x);
  xs.push(362);
  const sw = 14;
  const paths = [rect(30, 330, 340, 16), rect(30, 62, 340, 16), rect(30, 46, 340, 16)];
  const studs = xs.map((x) => rect(x - sw / 2, 78, sw, 252)).join(' ');
  paths.push(studs);
  const nog: string[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const y = sp === 450 ? (i % 2 ? 196 : 212) : 204;
    nog.push(rect(xs[i]! + sw / 2, y, xs[i + 1]! - xs[i]! - sw, 14));
  }
  paths.push(nog.join(' '));
  const detail: string[] = [];
  const dl: string[] = [];
  for (let i = 0; i + 1 < xs.length - 1; i++) {
    detail.push(dim([xs[i]!, 30], [xs[i + 1]!, 30], 6));
    dl.push(txt(String(sp), (xs[i]! + xs[i + 1]!) / 2, 20, 9));
  }
  for (const x of xs.slice(0, -1)) detail.push(seg([x, 24], [x, 44]));
  paths.push(dl.join(' '), txt('CENTRES NOMINAL', 200, 368, 10));
  return {
    id: `stud-layout-${sp}`,
    name: `Wall stud layout at ${sp} centres`,
    level: 'intermediate',
    sub: 'framing',
    tags: ['studs', 'wall-frame', 'spacing', 'carpentry'],
    paths,
    detail,
    nk: ['studs', sp],
  };
}

function opening(win: boolean): Spec {
  const sw = 14;
  const paths = [
    rect(30, 46, 340, 16),
    rect(30, 62, 340, 16),
    win ? rect(30, 340, 340, 16) : pl([[30, 340], [128, 340], [128, 356], [30, 356]], true),
  ];
  if (!win) paths.push(pl([[272, 340], [370, 340], [370, 356], [272, 356]], true));
  const studs: string[] = [rect(30, 78, sw, 262), rect(356, 78, sw, 262), rect(100, 78, sw, 262), rect(286, 78, sw, 262)];
  studs.push(rect(114, 150, sw, 190), rect(272, 150, sw, 190));
  paths.push(studs.join(' '));
  paths.push(rect(114, 116, 172, 34));
  const detail = [seg([114, 133], [286, 133])];
  const crip: string[] = [];
  for (const x of [160, 200, 240]) crip.push(rect(x - sw / 2, 78, sw, 38));
  if (win) {
    paths.push(rect(128, 250, 144, 14));
    for (const x of [160, 200, 240]) crip.push(rect(x - sw / 2, 264, sw, 76));
    detail.push(seg([140, 160], [260, 240]), seg([260, 160], [140, 240]));
  } else {
    detail.push(arc(128, 340, 140, 0, 50));
  }
  paths.push(crip.join(' '));
  paths.push(txt('LINTEL', 200, 104, 9));
  return {
    id: win ? 'frame-window-opening' : 'frame-door-opening',
    name: win ? 'Window opening framing with lintel' : 'Door opening framing with lintel',
    level: 'intermediate',
    sub: 'framing',
    tags: [win ? 'window' : 'door', 'lintel', 'header', 'wall-frame'],
    paths,
    detail,
    nk: [win ? 'window' : 'door'],
  };
}

function hipPlan(): Spec {
  const paths = [pl([[40, 90], [360, 90], [360, 310], [40, 310]], true), pl([[40, 310], [150, 200], [40, 90]]), pl([[360, 310], [250, 200], [360, 90]]), seg([150, 200], [250, 200])];
  const detail: string[] = [];
  for (let x = 170; x <= 230; x += 20) detail.push(seg([x, 90], [x, 200]), seg([x, 200], [x, 310]));
  for (let k = 20; k < 110; k += 20) {
    detail.push(seg([40 + k, 310], [40 + k, 310 - k]), seg([40 + k, 90], [40 + k, 90 + k]));
    detail.push(seg([360 - k, 310], [360 - k, 310 - k]), seg([360 - k, 90], [360 - k, 90 + k]));
  }
  detail.push(arc(40, 310, 60, 0, 45));
  paths.push(txt('45°', 120, 290, 14), txt('HIP', 100, 236, 10), txt('RIDGE', 200, 186, 10));
  return { id: 'hip-roof-plan', name: 'Hip roof plan, equal pitches', level: 'intermediate', sub: 'framing', tags: ['hip', 'roof-plan', 'rafter', 'roofing'], paths, detail, claims: [[45, [40, 310], [360, 310], [150, 200]]], nk: ['hipplan'] };
}

function hipUnequal(p1: number, p2: number): Spec {
  const W = 200, half = W / 2;
  const run = (half * Math.tan(p1 * RAD)) / Math.tan(p2 * RAD);
  const th = Math.atan(half / run) / RAD;
  const L0 = 40, R0 = 360, T = 100, Bt = 300;
  const hl: P = [L0 + run, 200], hr: P = [R0 - run, 200];
  const paths = [pl([[L0, T], [R0, T], [R0, Bt], [L0, Bt]], true), pl([[L0, Bt], hl, [L0, T]]), pl([[R0, Bt], hr, [R0, T]]), seg(hl, hr)];
  const detail = [arc(L0, Bt, 54, 0, th)];
  // pitch symbols (exact small triangles) on a long face and an end face
  const tri = (x: number, y: number, b: number, ang: number) => pl([[x, y], [x + b, y], [x + b, y - b * Math.tan(ang * RAD)]], true);
  paths.push(tri(190, 260, 56, p1), txt(dg(p1), 218, 278, 10));
  paths.push(tri(L0 + 8, 218, 30, p2), txt(dg(p2), L0 + 24, 234, 9));
  paths.push(txt(dg(th), L0 + 92, Bt - 22, 14));
  return {
    id: `hip-plan-${p1}-${p2}`,
    name: `Hip roof plan, ${p1}° sides and ${p2}° ends`,
    level: 'advanced',
    sub: 'framing',
    tags: ['hip', 'roof-plan', 'unequal-pitch', 'roofing'],
    paths,
    detail,
    claims: [[th, [L0, Bt], [R0, Bt], hl]],
    nk: ['hipunequal', p1, p2],
  };
}

function valleyPlan(): Spec {
  const paths = [
    pl([[40, 60], [360, 60], [360, 200], [320, 200], [320, 360], [200, 360], [200, 200], [40, 200]], true),
    pl([[40, 60], [110, 130], [40, 200]]),
    pl([[360, 60], [290, 130], [360, 200]]),
    seg([110, 130], [290, 130]),
    pl([[200, 200], [260, 140], [320, 200]]),
    seg([260, 140], [260, 360]),
  ];
  const detail = [seg([200, 200], [320, 200]), arc(200, 200, 44, 0, 45)];
  for (let y = 220; y <= 340; y += 24) detail.push(seg([200, y], [260, y]), seg([260, y], [320, y]));
  paths.push(txt('45°', 250, 216, 12), txt('VALLEY', 150, 160, 10));
  return { id: 'valley-roof-plan', name: 'Valley roof plan, L-shaped', level: 'advanced', sub: 'framing', tags: ['valley', 'roof-plan', 'hip', 'roofing'], paths, detail, claims: [[45, [200, 200], [320, 200], [260, 140]]], nk: ['valleyplan'] };
}

function pitchRatio(r: number): Spec {
  const u = 25, x0 = 50, y0 = 335, x1 = x0 + 12 * u;
  const top: P = [x1, y0 - r * u];
  const a = Math.atan(r / 12) / RAD;
  const ext = atP([x0, y0], 12 * u / Math.cos(a * RAD) + 30, a);
  const paths = [pl([top, [x0, y0], [x1, y0], top]), seg(top, ext)];
  const ticks: string[] = [];
  for (let i = 1; i < 12; i++) ticks.push(seg([x0 + i * u, y0], [x0 + i * u, y0 - 8]));
  for (let i = 1; i < r; i++) ticks.push(seg([x1, y0 - i * u], [x1 - 8, y0 - i * u]));
  const detail = [ticks.join(' '), arc(x0, y0, 80, 0, a)];
  paths.push(txt('12', (x0 + x1) / 2, y0 + 22, 14), txt(String(r), x1 + 20, y0 - (r * u) / 2, 14));
  paths.push(txt(`${r}:12`, 120, 80, 26), a < 25 ? txt(dg(a), x0 + 120, y0 - 120 * Math.tan(a * RAD) - 22, 16) : txt(dg(a), x0 + 120, y0 - 120 * Math.tan((a / 2) * RAD) - 12, 16));
  return {
    id: `roof-pitch-ratio-${r}-12`,
    name: `Roof pitch ${r}:12 (${dg(a)})`,
    level: 'beginner',
    sub: 'framing',
    tags: ['roof-pitch', 'ratio', 'rafter', 'roofing'],
    paths,
    detail,
    claims: [[a, [x0, y0], [x1, y0], top]],
    nk: ['pitchratio', r, dg(a)],
  };
}

function stairPitch(a: number): Spec {
  const run = 60, rise = run * Math.tan(a * RAD), x0 = 110, y0 = 340, n = 4;
  const pts: P[] = [[x0, y0]];
  for (let i = 0; i < n; i++) pts.push([x0 + i * run, y0 - (i + 1) * rise], [x0 + (i + 1) * run, y0 - (i + 1) * rise]);
  pts.push([370, y0 - n * rise]);
  const v: P = [x0 - run, y0];
  const e = atP(v, 330, a);
  const paths = [pl(pts), pl([[30, y0], v, [x0, y0], [370, y0]]), seg(v, e)];
  const hr0 = atP(v, 60, a), hr1 = atP(v, 330, a);
  const detail = [seg([hr0[0], hr0[1] - 70], [hr1[0], hr1[1] - 70]), arcP(v, 70, 0, a)];
  paths.push(txt(dg(a), v[0] + 108, y0 - 18, 16));
  paths.push(txt('RISE', x0 + 2 * run + 24, y0 - 2.5 * rise + 2, 9), txt('RUN', x0 + 3.5 * run, y0 - 4 * rise + 12, 9));
  return {
    id: `stair-pitch-${a}`,
    name: `Stair pitch ${dg(a)} with rise and run`,
    level: 'beginner',
    sub: 'framing',
    tags: ['stairs', 'rise-run', 'pitch', 'carpentry'],
    paths,
    detail,
    claims: [[a, v, [370, y0], e]],
    nk: ['stair', dg(a)],
  };
}

function deckJoists(): Spec {
  const paths = [rect(30, 40, 340, 320), rect(30, 110, 340, 26), rect(30, 264, 340, 26)];
  const xs: number[] = [];
  for (let k = 0; k <= 5; k++) xs.push(37 + (326 * k) / 5);
  paths.push(xs.map((x) => rect(x - 7, 40, 14, 320)).join(' '));
  const detail: string[] = [];
  const lab: string[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    detail.push(dim([xs[i]!, 22], [xs[i + 1]!, 22], 6));
    lab.push(txt('450', (xs[i]! + xs[i + 1]!) / 2, 12, 8));
  }
  for (let i = 0; i + 1 < xs.length; i++) detail.push(rect(xs[i]! + 7, 196, 50, 10));
  paths.push(lab.join(' '), txt('NOMINAL', 200, 378, 10));
  return { id: 'deck-joist-layout', name: 'Deck joist layout at 450 centres', level: 'intermediate', sub: 'framing', tags: ['deck', 'joists', 'bearer', 'spacing'], paths, detail, nk: ['deck'] };
}

function gableEnd(p: number): Spec {
  const x0 = 30, x1 = 370, y0 = 300, half = (x1 - x0) / 2;
  const apex: P = [200, y0 - half * Math.tan(p * RAD)];
  const th = 16 / Math.cos(p * RAD);
  const paths = [pl([[x0, y0], apex, [x1, y0]]), pl([[x0, y0 - th], [200, apex[1] - th], [x1, y0 - th]]), pl([[x0, y0], [x1, y0]]), rect(x0, y0, x1 - x0, 14), rect(x0, 360, x1 - x0, 14)];
  const studs: string[] = [];
  for (let x = 100; x <= 300; x += 40) {
    const yt = y0 - Math.min(x - x0, x1 - x) * Math.tan(p * RAD);
    if (y0 - yt > 18) studs.push(pl([[x - 6, y0], [x - 6, yt + (x < 200 ? 6 : -6) * Math.tan(p * RAD)], [x + 6, yt - (x < 200 ? 6 : -6) * Math.tan(p * RAD)], [x + 6, y0]]));
    studs.push(rect(x - 6, y0 + 14, 12, 46));
  }
  paths.push(studs.join(' '));
  const detail = [arc(x0, y0, 22, 0, p)];
  paths.push(txt(dg(p), x0 + 36, y0 - 13, 12));
  return { id: `gable-end-${p}`, name: `Gable end framing at ${dg(p)}`, level: 'intermediate', sub: 'framing', tags: ['gable', 'wall-frame', 'rafter', 'roofing'], paths, detail, claims: [[p, [x0, y0], [x1, y0], apex]], nk: ['gable', dg(p)] };
}

const PART1: Spec[] = [
  crown(38, 90, 'intermediate'),
  flip(crown(45, 90, 'intermediate'), 'x'),
  crown(38, 135, 'advanced'),
  flip(crown(45, 135, 'advanced'), 'x'),
  skirting(120),
  skirting(135),
  skirting(150),
  ...[10, 12.5, 18, 36, 52].map((a, i) => (i % 2 ? flip(slidingBevel(a), 'x') : slidingBevel(a))),
  protractor360(),
  bisector(),
  dovetailGauge(5, 7),
  flip(dovetailGauge(6, 8), 'y'),
  mortiseTenon(),
  halfLap(),
  bridle(),
  housing(false),
  housing(true),
  rebate(),
  tongueGroove(),
  biscuit(),
  dowel(),
  hingeMortise(),
  drawerBox(),
  splinedMitre(),
  scarf(),
  birdsmouth(22.5),
  birdsmouth(30),
  mitreFrame(5),
  mitreFrame(10),
  studLayout(450),
  studLayout(600),
  opening(false),
  opening(true),
  hipPlan(),
  hipUnequal(30, 45),
  valleyPlan(),
  ...[3, 4, 6, 8, 10, 12].map(pitchRatio),
  ...[30, 34, 38].map(stairPitch),
  deckJoists(),
  gableEnd(35),
];

/** Polyline offset by d (left of travel direction in screen terms when d > 0), with mitred corners. */
function offsetLine(pts: readonly P[], d: number): P[] {
  const nrm = (a: P, b: P): P => {
    const L = dist(a, b);
    return [((b[1] - a[1]) / L) * d, (-(b[0] - a[0]) / L) * d];
  };
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) out.push(add(pts[0]!, nrm(pts[0]!, pts[1]!)));
    else if (i === pts.length - 1) out.push(add(pts[i]!, nrm(pts[i - 1]!, pts[i]!)));
    else {
      const n1 = nrm(pts[i - 1]!, pts[i]!), n2 = nrm(pts[i]!, pts[i + 1]!);
      const p1 = add(pts[i - 1]!, n1), p2 = add(pts[i]!, n1), q1 = add(pts[i]!, n2), q2 = add(pts[i + 1]!, n2);
      const den = (p1[0] - p2[0]) * (q1[1] - q2[1]) - (p1[1] - p2[1]) * (q1[0] - q2[0]);
      if (Math.abs(den) < 1e-9) out.push(p2);
      else {
        const t = ((p1[0] - q1[0]) * (q1[1] - q2[1]) - (p1[1] - q1[1]) * (q1[0] - q2[0])) / den;
        out.push(lerp(p1, p2, t));
      }
    }
  }
  return out;
}

// ================================================================================================= METAL

type WeldKind = 'fillet' | 'fillet-both' | 'v-groove' | 'bevel' | 'plug' | 'spot' | 'all-round';
function weldSym(kind: WeldKind): Spec {
  const mir = kind === 'fillet-both' || kind === 'spot';
  const X = (x: number) => (mir ? 400 - x : x);
  const Pm = (p: P): P => [X(p[0]), p[1]];
  const r0: P = Pm([150, 130]), r1: P = Pm([340, 130]);
  const paths = [seg(r0, r1), pl([Pm([364, 108]), r1, Pm([364, 152])])];
  const detail: string[] = [];
  const claims: Claim[] = [];
  let tip: P = [0, 0];
  let name = '';
  const tri = (pts: P[]) => pl(pts.map(Pm), true);
  if (kind === 'fillet' || kind === 'fillet-both' || kind === 'all-round') {
    const tube = kind === 'all-round';
    paths.push(rect(Math.min(X(150), X(360)), 320, 210, 30));
    const ux0 = tube ? 222 : 250, ux1 = tube ? 290 : 276;
    paths.push(pl([Pm([ux0, 320]), Pm([ux0, tube ? 210 : 190]), Pm([ux1, tube ? 210 : 190]), Pm([ux1, 320])]));
    if (tube) detail.push(seg(Pm([256, 200]), Pm([256, 330])));
    paths.push(tri([[ux0, 320], [ux0, 296], [ux0 - 24, 320]]), tri([[ux1, 320], [ux1, 296], [ux1 + 24, 320]]));
    tip = Pm([ux0 - 13, 307]);
    const lx = mir ? 150 : 215;
    paths.push(pl([[lx, 130], [lx, 162], [lx + 32, 130]], true));
    if (kind === 'fillet-both') paths.push(pl([[lx, 130], [lx, 98], [lx + 32, 130]], true));
    if (tube) paths.push(circle(r0[0], r0[1], 10), pl([r0, Pm([150, 70]), Pm([182, 82]), Pm([150, 94])]));
    name = kind === 'fillet' ? 'Fillet weld symbol' : kind === 'fillet-both' ? 'Fillet weld symbol, both sides' : 'Weld-all-round field weld symbol';
  } else if (kind === 'v-groove' || kind === 'bevel') {
    const half = kind === 'v-groove' ? 30 : 45;
    const off = 50 * Math.tan(half * RAD);
    const gx = 230;
    if (kind === 'v-groove') {
      paths.push(pl([Pm([60, 290]), Pm([gx - 3 - off, 290]), Pm([gx - 3, 340]), Pm([60, 340])], true));
      paths.push(pl([Pm([380, 290]), Pm([gx + 3 + off, 290]), Pm([gx + 3, 340]), Pm([380, 340])], true));
      tip = Pm([gx, 296]);
      const v: P = Pm([250, 130]);
      const ea = atP(v, 76, 240), eb = atP(v, 76, 300);
      paths.push(pl([ea, v, eb]), txt('60°', v[0], 228, 13));
      detail.push(arcP(v, 50, 240, 300));
      claims.push([60, v, ea, eb]);
      name = 'V-groove weld symbol (60°)';
    } else {
      paths.push(pl([Pm([60, 290]), Pm([gx - 3, 290]), Pm([gx - 3, 340]), Pm([60, 340])], true));
      paths.push(pl([Pm([380, 290]), Pm([gx + 3 + off, 290]), Pm([gx + 3, 340]), Pm([380, 340])], true));
      tip = Pm([gx + 8, 296]);
      const v: P = Pm([230, 130]);
      const ea: P = Pm([230, 210]), eb = Pm([230 + 76 * Math.SQRT1_2, 130 + 76 * Math.SQRT1_2]);
      paths.push(pl([ea, v, eb]), txt('45°', X(276), 228, 13));
      detail.push(arcP(v, 46, mir ? 225 : 270, mir ? 270 : 315));
      claims.push(mir ? [45, v, eb, ea] : [45, v, ea, eb]);
      name = 'Bevel-groove weld symbol (45°)';
    }
  } else if (kind === 'plug') {
    paths.push(rect(60, 260, 220, 34), rect(150, 294, 220, 34));
    paths.push(pl([[190, 260], [196, 294]]), pl([[230, 260], [224, 294]]));
    detail.push(seg([196, 294], [224, 294]));
    tip = [210, 266];
    paths.push(rect(222, 130, 40, 26));
    name = 'Plug weld symbol';
  } else {
    paths.push(rect(X(330), 250, 210, 70), rect(X(260), 290, 210, 70));
    const sp: string[] = [];
    for (const x of [150, 200, 250]) sp.push(circle(X(x), 305, 9));
    paths.push(sp.join(' '));
    tip = Pm([150, 296]);
    paths.push(circle(X(245), 130, 16));
    name = 'Spot weld symbol';
  }
  paths.push(arrow(r0, tip, 14));
  return {
    id: `weld-symbol-${kind}`,
    name,
    level: 'beginner',
    sub: 'metal',
    tags: ['weld-symbol', 'welding', 'fabrication', 'drawing'],
    paths,
    detail,
    claims,
    nk: ['weldsym', kind],
  };
}

function gusset(kind: '45' | '30-60'): Spec {
  const A: P = [kind === '45' ? 60 : 50, 340];
  const B: P = [kind === '45' ? 320 : 350, 340];
  const ang = kind === '45' ? 45 : 30;
  const C: P = [A[0], A[1] - (B[0] - A[0]) * Math.tan(ang * RAD)];
  const paths = [pl([A, B, C], true), rightMark(A, 0, 90, 20)];
  const holes: string[] = [];
  for (let i = 0; i < 3; i++) holes.push(circle(A[0] + 56 + i * 44, A[1] - 26, 10));
  for (let i = 0; i < (kind === '45' ? 3 : 1); i++) holes.push(circle(A[0] + 26, A[1] - 56 - i * 44, 10));
  paths.push(holes.join(' '));
  const detail = [arcP(B, 70, 180 - ang, 180), arcP(C, 60, 270, 270 + 90 - ang)];
  const lb = atP(B, 104, 180 - ang / 2), lc = atP(C, kind === '45' ? 92 : 64, 270 + (90 - ang) / 2);
  paths.push(txt(dg(ang), lb[0], lb[1], 15), txt(dg(90 - ang), lc[0] + 4, lc[1], 15));
  return {
    id: `gusset-plate-${kind}`,
    name: kind === '45' ? 'Gusset plate 45° with holes' : 'Gusset plate 30° / 60° with holes',
    level: kind === '45' ? 'beginner' : 'intermediate',
    sub: 'metal',
    tags: ['gusset', 'plate', 'bracing', 'fabrication'],
    paths,
    detail,
    claims: [[ang, B, A, C], [90 - ang, C, B, A]],
    nk: ['gusset', kind === '45' ? '45°' : '30° / 60°'],
  };
}

/** Hatch lines at 45° clipped to rectangles. */
function hatch(rects: readonly [number, number, number, number][], s = 16): string {
  const out: string[] = [];
  for (const [x, y, w, h] of rects) {
    for (let c = -h; c < w; c += s) {
      const l = clipSeg([x + c, y + h], [x + c + h, y], x, y, x + w, y + h);
      if (l) out.push(l);
    }
  }
  return out.join(' ');
}

function section(kind: 'equal-angle' | 'unequal-angle' | 'channel' | 'i-beam' | 'rhs'): Spec {
  let paths: string[] = [], detail: string[] = [];
  let name = '';
  const t = 36;
  if (kind === 'equal-angle' || kind === 'unequal-angle') {
    const top = kind === 'equal-angle' ? 80 : 160, right = kind === 'equal-angle' ? 340 : 350;
    paths = [
      `M 80 340 L 80 ${top} L ${80 + t - 8} ${top} A 8 8 0 0 1 ${80 + t} ${top + 8} L ${80 + t} ${340 - t - 24} A 24 24 0 0 0 ${80 + t + 24} ${340 - t} L ${right - 8} ${340 - t} A 8 8 0 0 1 ${right} ${340 - t + 8} L ${right} 340 Z`,
    ];
    detail = [hatch([[80, top + 10, t, 340 - top - 10], [80 + t, 340 - t, right - 80 - t - 6, t]])];
    if (kind === 'unequal-angle') paths.push(txt('3:2', 250, 230, 22));
    name = kind === 'equal-angle' ? 'Equal angle section' : 'Unequal angle section 3:2';
  } else if (kind === 'channel') {
    paths = [`M 100 50 L 314 50 A 6 6 0 0 1 320 56 L 320 80 L 156 80 A 20 20 0 0 0 136 100 L 136 300 A 20 20 0 0 0 156 320 L 320 320 L 320 344 A 6 6 0 0 1 314 350 L 100 350 Z`];
    detail = [hatch([[100, 56, 36, 288], [136, 50, 178, 30], [136, 320, 178, 30]])];
    name = 'Channel section';
  } else if (kind === 'i-beam') {
    paths = [`M 60 50 L 340 50 L 340 80 L 231 80 A 18 18 0 0 0 213 98 L 213 302 A 18 18 0 0 0 231 320 L 340 320 L 340 350 L 60 350 L 60 320 L 169 320 A 18 18 0 0 0 187 302 L 187 98 A 18 18 0 0 0 169 80 L 60 80 Z`];
    detail = [hatch([[60, 50, 280, 30], [60, 320, 280, 30], [187, 80, 26, 240]], 14), seg([200, 30], [200, 370]), seg([40, 200], [360, 200])];
    name = 'I-beam section';
  } else {
    paths = [rrect(80, 80, 240, 240, 30), rrect(108, 108, 184, 184, 10)];
    detail = [seg([200, 60], [200, 340]), seg([60, 200], [340, 200])];
    name = 'Square hollow section';
  }
  return {
    id: `section-${kind}`,
    name,
    level: 'beginner',
    sub: 'metal',
    tags: ['steel-section', 'profile', 'structural', 'fabrication'],
    paths,
    detail,
    nk: ['section', kind],
  };
}

/** Cone (k = 0) or frustum (k = top / bottom diameter) flat pattern, with the elevation. */
function conePattern(A: number, k: number, O: P, Rf: number, level: TemplateLevel): Spec {
  const h = A / 2;
  const Th = 360 * Math.sin(h * RAD);
  const paths: string[] = [], detail: string[] = [], claims: Claim[] = [];
  // elevation
  const apex: P = [60, 26], bw = 46, H = bw / Math.tan(h * RAD);
  const bl: P = [apex[0] - bw, apex[1] + H], br: P = [apex[0] + bw, apex[1] + H];
  if (k === 0) {
    paths.push(pl([bl, apex, br, bl]));
    claims.push([A, apex, bl, br]);
  } else {
    const tl = lerp(apex, bl, 1 - k), tr = lerp(apex, br, 1 - k);
    paths.push(pl([bl, tl, tr, br], true));
    detail.push(pl([tl, apex, tr]));
    claims.push([A, apex, bl, br]);
  }
  detail.push(seg(apex, [apex[0], apex[1] + H + 8]), arcP(apex, 24, 270 - h, 270 + h));
  paths.push(txt(dg(A), apex[0] + bw + 22, apex[1] + 22, 11));
  // flat pattern
  const a0 = 270 - Th / 2, a1 = 270 + Th / 2;
  const ea = atP(O, Rf, a0), eb = atP(O, Rf, a1);
  if (k === 0) {
    paths.push(`M ${f(O[0])} ${f(O[1])} L ${f(ea[0])} ${f(ea[1])}${arcTo(O, Rf, a0, a1)} Z`);
    claims.push([Th, O, ea, eb]);
  } else {
    const ri = Rf * k;
    const ia = atP(O, ri, a0), ib = atP(O, ri, a1);
    paths.push(`M ${f(ia[0])} ${f(ia[1])} L ${f(ea[0])} ${f(ea[1])}${arcTo(O, Rf, a0, a1)} L ${f(ib[0])} ${f(ib[1])}${arcTo(O, ri, a1, a0, false)}`);
    detail.push(pl([ia, O, ib]));
    claims.push([Th, O, ea, eb]);
  }
  for (let i = 1; i < 12; i++) detail.push(ray(O[0], O[1], Rf, a0 + (Th * i) / 12, k === 0 ? 0 : Rf * k));
  detail.push(arcP(O, 30, a0, a1));
  const lp = atP(O, k === 0 ? 62 : Rf * k * 0.55, 270);
  paths.push(txt(dg(Th), lp[0], lp[1] + (k === 0 ? 0 : 0), 14));
  return {
    id: k === 0 ? `cone-pattern-${A}` : `frustum-pattern-${A}-${Math.round(k * 10)}`,
    name: k === 0 ? `Cone flat pattern, ${A}° cone` : `Frustum flat pattern, ${A}° cone, top ${k * 10}/10 of base`,
    level,
    sub: 'metal',
    tags: [k === 0 ? 'cone' : 'frustum', 'flat-pattern', 'sheet-metal', 'fabrication'],
    paths,
    detail,
    claims,
    nk: k === 0 ? ['cone', A] : ['frustum', A, k * 10],
  };
}

/** n-piece 90° lobster-back (segmented) elbow. */
function lobster(n: number): Spec {
  const C: P = [55, 345], Rc = 200, D = 80, Ro = Rc + D / 2, Ri = Rc - D / 2;
  const phi = 90 / (n - 1);
  const bounds: { a: number; diff: number }[] = [{ a: 0, diff: 0 }];
  for (let j = 0; j < n - 1; j++) bounds.push({ a: phi / 2 + j * phi, diff: phi / 2 });
  bounds.push({ a: 90, diff: 0 });
  const outer = bounds.map((b) => atP(C, Ro / Math.cos(b.diff * RAD), b.a));
  const inner = bounds.map((b) => atP(C, Ri / Math.cos(b.diff * RAD), b.a));
  const paths = [pl(outer), pl(inner), outer.map((o, i) => seg(inner[i]!, o)).join(' ')];
  const detail = [inner.map((p) => seg(C, p)).join(' '), arcP(C, 100, 0, phi / 2), circle(C[0], C[1], 4)];
  const lp = atP(C, 128, phi / 4);
  paths.push(txt(dg(phi / 2), lp[0] + 6, lp[1] + 2, 12));
  paths.push(txt(`${n} PIECE`, 230, 40, 14));
  return {
    id: `lobster-back-${n}-piece`,
    name: `Lobster-back 90° elbow, ${n} pieces`,
    level: n > 3 ? 'advanced' : 'intermediate',
    sub: 'metal',
    tags: ['lobster-back', 'segmented-elbow', 'pipe', 'fabrication'],
    paths,
    detail,
    claims: [[phi / 2, C, inner[0]!, inner[1]!]],
    nk: ['lobster', n],
  };
}

function flangeN(n: number): Spec {
  const c: P = [200, 200];
  const R = n === 10 ? 162 : n === 12 ? 174 : 184, pcd = n === 10 ? 124 : n === 12 ? 142 : 160;
  const hr = n === 10 ? 15 : n === 12 ? 12 : 9, bore = n === 10 ? 46 : n === 12 ? 62 : 80;
  const paths = [circle(200, 200, R), circle(200, 200, bore)];
  if (n === 10) paths.push(circle(200, 200, 80));
  else if (n === 12) paths.push(circle(200, 200, 98), circle(200, 200, 88));
  else paths.push(circle(200, 200, 120), circle(200, 200, 104), circle(200, 200, 96));
  const holes: string[] = [];
  const angs: number[] = [];
  for (let i = 0; i < n; i++) angs.push(90 - 180 / n + (360 / n) * i);
  for (const a of angs) {
    const p = atP(c, pcd, a);
    holes.push(circle(p[0], p[1], hr));
  }
  paths.push(holes.join(' '));
  const h1 = atP(c, pcd, angs[0]!), h2 = atP(c, pcd, angs[1]!);
  const detail = [circle(200, 200, pcd), seg(c, h1), seg(c, h2), arcP(c, pcd - hr - 4, angs[0]!, angs[1]!), seg([200, 20], [200, 380]), seg([20, 200], [380, 200])];
  paths.push(txt(dg(360 / n), 200, 200 - pcd + hr + 17, 10));
  return {
    id: `flange-${n}-hole`,
    name: `${n}-hole flange, holes off centre`,
    level: n > 12 ? 'advanced' : 'intermediate',
    sub: 'metal',
    tags: ['flange', 'bolt-circle', 'holes', 'pipework'],
    paths,
    detail,
    claims: [[360 / n, c, h1, h2]],
    nk: ['flange', n],
  };
}

function countersinkCutter(): Spec {
  const inc = 82, h = inc / 2, W2 = 70;
  const tip: P = [200, 120 + W2 / Math.tan(h * RAD)];
  const a: P = [200 - W2, 120], b: P = [200 + W2, 120];
  const paths = [rect(180, 30, 40, 90), pl([a, tip, b], true)];
  const detail = [seg([200, 124], [200 - 30, 120 + 30]), seg([200 + 18, 124], [200 - 6, tip[1] - 12]), arcP(tip, 50, 90 - h, 90 + h), seg([200, 20], [200, 220])];
  // the plate it cuts, in section
  const hr = 20, depth = 40, W = hr + depth * Math.tan(h * RAD);
  const pa: P = [200 - W, 250], pb: P = [200 + W, 250];
  paths.push(pl([[40, 250], pa, [200 - hr, 290], [200 - hr, 330], [40, 330]], true), pl([[360, 250], pb, [200 + hr, 290], [200 + hr, 330], [360, 330]], true));
  detail.push(hatchPoly([[40, 250], pa, [200 - hr, 290], [200 - hr, 330], [40, 330]], 45, 16), hatchPoly([[360, 250], [360, 330], [200 + hr, 330], [200 + hr, 290], pb], 45, 16));
  paths.push(txt('82°', 200, 136, 14), txt('CUTTER', 300, 70, 11));
  return {
    id: 'countersink-82-cutter',
    name: 'Countersink 82° cutter and hole',
    level: 'intermediate',
    sub: 'metal',
    tags: ['countersink', 'cutter', 'machining', 'fabrication'],
    paths,
    detail,
    claims: [[inc, tip, a, b]],
    nk: ['csk82'],
  };
}

function countersink(inc: number): Spec {
  const h = inc / 2, depth = 50, hr = 25;
  const W = hr + depth * Math.tan(h * RAD);
  const apex: P = [200, 250 + hr / Math.tan(h * RAD)];
  const a: P = [200 - W, 200], b: P = [200 + W, 200];
  const paths = [
    pl([[40, 200], a, [175, 250], [175, 300], [40, 300]], true),
    pl([[360, 200], b, [225, 250], [225, 300], [360, 300]], true),
  ];
  const ra = apex[1] - 176;
  const detail = [
    pl([[175, 250], apex, [225, 250]]),
    arcP(apex, ra, 90 - h, 90 + h),
    hatchPoly([[40, 200], a, [175, 250], [175, 300], [40, 300]], 45, 16),
    hatchPoly([[360, 200], [360, 300], [225, 300], [225, 250], b], 45, 16),
    seg([200, 160], [200, 330]),
  ];
  paths.push(txt(dg(inc), 200, apex[1] - ra - 16, 16));
  return {
    id: `countersink-${inc}`,
    name: `Countersink profile ${inc}°`,
    level: 'intermediate',
    sub: 'metal',
    tags: ['countersink', 'hole', 'machining', 'fabrication'],
    paths,
    detail,
    claims: [[inc, apex, a, b]],
    nk: ['csk', inc],
  };
}

function chamfers(): Spec {
  const y0 = 120, y1 = 280;
  const c1a: P = [50, 200], c1b: P = [130, 120];
  const r = 160, c2a: P = [350 - r * Math.cos(30 * RAD), y0], c2b: P = [350, y0 + r * Math.sin(30 * RAD)];
  const paths = [pl([c1a, c1b, c2a, c2b, [350, y1], [50, y1]], true)];
  const detail = [pl([c2a, [372, y0]]), pl([c1a, [50, 100]]), arcP(c1a, 50, 45, 90), arcP(c2a, 70, -30, 0)];
  paths.push(txt('45°', 96, 186, 14), txt('30°', c2a[0] + 96, y0 + 28, 14), txt('CHAMFER', 200, 320, 12));
  return {
    id: 'chamfer-45-30',
    name: 'Chamfer profiles 45° and 30°',
    level: 'beginner',
    sub: 'metal',
    tags: ['chamfer', 'edge', 'machining', 'fabrication'],
    paths,
    detail,
    claims: [[45, c1a, [50, 100], c1b], [30, c2a, [372, y0], c2b]],
    nk: ['chamfer'],
  };
}

function kneeBracket(): Spec {
  const paths = [
    pl([[60, 40], [90, 40], [90, 130], [90, 160], [90, 310], [240, 310], [270, 310], [360, 310], [360, 340], [60, 340]], true),
    seg([90, 130], [270, 310]),
    seg([90, 160], [240, 310]),
  ];
  const holes = [circle(75, 70, 8), circle(75, 250, 8), circle(310, 325, 8), circle(340, 325, 8)].join(' ');
  paths.push(holes, txt('45°', 214, 292, 13));
  const detail = [arc(270, 310, 44, 135, 180), rightMark([90, 310], 0, 90, 18)];
  return {
    id: 'knee-bracket-45',
    name: 'Knee bracket with 45° brace',
    level: 'beginner',
    sub: 'metal',
    tags: ['bracket', 'brace', 'angle', 'fabrication'],
    paths,
    detail,
    claims: [[45, [270, 310], [90, 310], [90, 130]]],
    nk: ['knee'],
  };
}

// ================================================================================================= PIPE

const ratioName = (k: number) => (k === 1 ? '1:1' : k === 0.75 ? '3:4' : '1:2');

/** Unrolled cut line for a branch of radius r meeting a run of radius R = r / k at `alpha` degrees (axes intersect). */
function saddle(k: number, alpha: number): Spec {
  const x0 = 40, W = 320, r = W / (2 * Math.PI), R = r / k;
  const sa = Math.sin(alpha * RAD), ca = Math.cos(alpha * RAD);
  const tOf = (th: number) => (Math.sqrt(R * R - r * r * Math.sin(th) ** 2) - r * Math.cos(th) * ca) / sa;
  const N = 96;
  const ts: number[] = [];
  for (let i = 0; i <= N; i++) ts.push(tOf((2 * Math.PI * i) / N));
  const tmax = Math.max(...ts), tmin = Math.min(...ts);
  const yBase = alpha === 90 ? (k === 1 ? 336 : k === 0.75 ? 312 : 290) : k === 1 ? 350 : k === 0.75 ? 340 : 330;
  const gap = alpha === 90 ? (k === 1 ? 60 : k === 0.75 ? 90 : 120) : k === 1 ? 40 : k === 0.75 ? 50 : 60;
  const div = k === 1 ? 12 : k === 0.75 ? 16 : 8;
  const yOf = (t: number) => yBase - gap - (tmax - t);
  const curve: P[] = ts.map((t, i) => [x0 + (W * i) / N, yOf(t)]);
  const paths = [pl(curve), pl([curve[0]!, [x0, yBase], [x0 + W, yBase], curve[N]!])];
  const ords: string[] = [];
  for (let i = 1; i < div; i++) ords.push(seg([x0 + (W * i) / div, yBase], [x0 + (W * i) / div, yOf(tOf((2 * Math.PI * i) / div))]));
  const detail = [ords.join(' ')];
  // junction sketch
  const s = 22 / R, cy = 104 - (tmax - tmin) * 0 + 0, mx = 300;
  const Rs = R * s, rs = r * s;
  detail.push(rect(mx - 60, cy - Rs, 120, 2 * Rs));
  const u = at(0, 0, 1, alpha), nn = at(0, 0, rs, alpha + 90);
  const lenB = 70;
  for (const sg of [1, -1]) {
    const p0 = add([mx, cy], [sg * nn[0], sg * nn[1]]);
    const tt = (cy - Rs - p0[1]) / u[1];
    detail.push(seg(add(p0, [u[0] * tt, u[1] * tt]), add(p0, [u[0] * lenB, u[1] * lenB])));
  }
  const e1 = add(add([mx, cy], [u[0] * lenB, u[1] * lenB]), nn), e2 = add(add([mx, cy], [u[0] * lenB, u[1] * lenB]), [-nn[0], -nn[1]]);
  detail.push(seg(e1, e2));
  const lab: string[] = [];
  for (let i = 0; i <= div; i += div / 4) lab.push(txt(String(i), x0 + (W * i) / div, yBase + 16, 9));
  paths.push(lab.join(' '), txt(`${ratioName(k)} ${alpha}°`, 120, k === 0.5 ? 70 : 52, 22));
  return {
    id: `pipe-saddle-${ratioName(k).replace(':', '-')}-${alpha}`,
    name: `Pipe saddle cut, ${ratioName(k)} branch at ${alpha}°`,
    level: alpha === 90 && k === 1 ? 'intermediate' : 'advanced',
    sub: 'pipe',
    tags: ['pipe-saddle', 'fishmouth', 'branch', 'boilermaker'],
    paths,
    detail,
    nk: ['saddle', ratioName(k), alpha],
  };
}

/** Hole to cut in the run for a 1:2 branch at 90°, unrolled over the run's circumference. */
function saddleHole(): Spec {
  const W = 320, R = W / (2 * Math.PI), r = R / 2, x0 = 40;
  const cx = 200, cy = 200;
  const pts: P[] = [];
  for (let i = 0; i <= 96; i++) {
    const th = (2 * Math.PI * i) / 96;
    pts.push([cx + R * Math.asin((r * Math.sin(th)) / R), cy - r * Math.cos(th)]);
  }
  const paths = [pl(pts, true), rect(x0, 60, W, 280)];
  const detail: string[] = [seg([x0, cy], [x0 + W, cy]), seg([cx, 60], [cx, 340])];
  for (let i = 1; i < 8; i++) detail.push(seg([x0 + (W * i) / 8, 60], [x0 + (W * i) / 8, 70]), seg([x0 + (W * i) / 8, 330], [x0 + (W * i) / 8, 340]));
  paths.push(txt('1:2 90°', 200, 40, 18), txt('RUN PIPE WRAP', 200, 362, 11));
  return { id: 'pipe-saddle-hole-1-2', name: 'Run pipe hole for a 1:2 branch', level: 'intermediate', sub: 'pipe', tags: ['pipe-saddle', 'hole', 'branch', 'boilermaker'], paths, detail, nk: ['saddlehole'] };
}

function pipeOffset(a: number): Spec {
  const O = Math.min(150, 230 * Math.tan(a * RAD));
  const run = O / Math.tan(a * RAD);
  const yl = 290, yu = yl - O;
  const b1: P = [200 - run / 2, yl], b2: P = [200 + run / 2, yu];
  const cl: P[] = [[30, yl], b1, b2, [370, yu]];
  const paths = [pl(cl)];
  const w1 = offsetLine(cl, 16), w2 = offsetLine(cl, -16);
  const detail = [pl(w1), pl(w2), seg(b1, [b1[0] + 110, yl]), arcP(b1, 64, 0, a), seg([30, yu], [b1[0] - 12, yu]), dim([46, yl], [46, yu]), dim([b1[0], yl + 34], [b2[0], yl + 34])];
  for (let i = 1; i < 3; i++) detail.push(seg(w1[i]!, w2[i]!));
  const mp = mid(b1, b2), nn = at(0, 0, 34, a + 90);
  const tm = 1 / Math.sin(a * RAD), rm = 1 / Math.tan(a * RAD);
  paths.push(txt(`TRAVEL x${fix(tm, 3)}`, mp[0] + nn[0] * 1.5 - 14, mp[1] + nn[1] * 1.5 - 4, 10));
  paths.push(txt(`RUN x${fix(rm, 3)}`, 200, yl + 54, 10), txt('OFFSET', 96, (yl + yu) / 2, 10));
  paths.push(txt(dg(a), b1[0] + 70, yl + 18, 14));
  return {
    id: `pipe-offset-${idNum(a)}`,
    name: `Pipe offset at ${dg(a)} with travel multiplier`,
    level: a === 45 ? 'beginner' : 'intermediate',
    sub: 'pipe',
    tags: ['pipe-offset', 'travel', 'multiplier', 'plumbing'],
    paths,
    detail,
    claims: [[a, b1, [b1[0] + 110, yl], b2]],
    nk: ['pipeoffset', dg(a)],
  };
}

function pipeTee(lateral: boolean): Spec {
  if (!lateral) {
    const paths = [pl([[30, 170], [170, 170], [170, 40]]), pl([[370, 170], [230, 170], [230, 40]]), seg([30, 230], [370, 230]), pl([[170, 170], [200, 200], [230, 170]]), seg([170, 40], [230, 40])];
    const detail = [pl([[20, 200], [200, 200], [380, 200]]), seg([200, 200], [200, 26]), rightMark([200, 200], 0, 90, 18)];
    paths.push(txt('90°', 250, 260, 16));
    return { id: 'pipe-tee-equal', name: 'Equal pipe tee layout', level: 'beginner', sub: 'pipe', tags: ['tee', 'branch', 'pipework', 'plumbing'], paths, detail, claims: [[90, [200, 200], [380, 200], [200, 26]]], nk: ['tee'] };
  }
  const O: P = [150, 200], u = at(0, 0, 1, 45), n = at(0, 0, 30, 135);
  const p1: P = [150 - 12.43, 170], p2: P = [150 + 82.43, 170];
  const L = 210;
  const end = add(O, [u[0] * L, u[1] * L]);
  const paths = [
    pl([[30, 170], p1, add(end, n)]),
    pl([[370, 170], p2, add(end, [-n[0], -n[1]])]),
    seg(add(end, n), add(end, [-n[0], -n[1]])),
    seg([30, 230], [370, 230]),
    pl([p1, O, p2]),
  ];
  const detail = [pl([[20, 200], O, [380, 200]]), seg(O, add(O, [u[0] * (L + 10), u[1] * (L + 10)])), arcP(O, 100, 0, 45)];
  paths.push(txt('45°', 290, 160, 16));
  return { id: 'pipe-lateral-45', name: 'Equal 45° lateral layout', level: 'intermediate', sub: 'pipe', tags: ['lateral', 'wye', 'branch', 'plumbing'], paths, detail, claims: [[45, O, [380, 200], add(O, [u[0] * (L + 10), u[1] * (L + 10)])]], nk: ['lateral'] };
}

function mitredBend(dl: number): Spec {
  const J: P = [170, 280];
  const B = atP(J, 210, dl);
  const cl: P[] = [[30, 280], J, B];
  const w1 = offsetLine(cl, 30), w2 = offsetLine(cl, -30);
  const paths = [pl(w1), pl(w2), seg(w1[1]!, w2[1]!), seg(w1[0]!, w2[0]!), seg(w1[2]!, w2[2]!)];
  const ext: P = [370, 280];
  const sq: P = [J[0], J[1] - 90];
  const detail = [pl(cl), seg(J, ext), arcP(J, 120, 0, dl), seg([J[0], J[1] + 50], sq)];
  const lp = atP(J, 150, dl / 2);
  paths.push(txt(dg(dl), lp[0] + 8, lp[1], 15), txt(`CUT ${dg(dl / 2)}`, J[0] - 10, J[1] + 70, 11));
  return {
    id: `pipe-mitre-bend-${dl}`,
    name: `Two-piece mitred pipe bend, ${dg(dl)}`,
    level: 'intermediate',
    sub: 'pipe',
    tags: ['mitre-bend', 'pipe', 'cut', 'fabrication'],
    paths,
    detail,
    claims: [[dl, J, ext, B]],
    nk: ['mitrebend', dg(dl)],
  };
}

// ================================================================================================= ELECTRICAL

const mult = (a: number) => fix(1 / Math.sin(a * RAD), 2);

function conduitOffset(a: number): Spec {
  const O = a === 10 ? 40 : a === 22.5 ? 80 : a === 30 ? 100 : 120;
  const run = O / Math.tan(a * RAD);
  const yl = 300, yu = yl - O;
  const b1: P = [190 - run / 2, yl], b2: P = [190 + run / 2, yu];
  const paths = [pl([[30, yl], b1, b2, [370, yu]])];
  const tick = (p: P, d: number) => seg(atP(p, 12, d + 90), atP(p, 12, d - 90));
  paths.push(tick(b1, a / 2), tick(b2, a / 2));
  const ox = b2[0] + 24;
  paths.push(pl([[ox, yl + 8], [ox, yu + 14], [366, yu + 14], [366, yl + 8]]));
  const nn = at(0, 0, 26, a + 90);
  const detail = [seg([20, yl + 8], [380, yl + 8]), seg(b1, [b1[0] + 90, yl]), arcP(b1, 56, 0, a), dim(add(b1, nn), add(b2, nn), 7), dim([44, yl], [44, yu], 7), seg([30, yu], [Math.min(b1[0] - 8, 80), yu])];
  const mp = mid(b1, b2);
  paths.push(txt(`x${mult(a)}`, mp[0] + nn[0] * 1.9, mp[1] + nn[1] * 1.9, 14));
  paths.push(txt('OFFSET', 90, (yl + yu) / 2, 9), txt(dg(a), b1[0] + 64, yl + 24, 13));
  return {
    id: `conduit-offset-${idNum(a)}`,
    name: `Conduit offset bend ${dg(a)}`,
    level: a === 30 || a === 45 ? 'beginner' : 'intermediate',
    sub: 'electrical',
    tags: ['conduit', 'offset', 'bending', 'multiplier'],
    paths,
    detail,
    claims: [[a, b1, [b1[0] + 90, yl], b2]],
    nk: ['conoffset', dg(a)],
  };
}

function backToBack(): Spec {
  const paths = [`M 80 60 L 80 260 A 40 40 0 0 0 120 300 L 280 300 A 40 40 0 0 0 320 260 L 320 60`, seg([30, 308], [370, 308])];
  const detail = [pl([[80, 150], [80, 300], [240, 300]]), pl([[160, 300], [320, 300], [320, 150]]), dim([76, 340], [324, 340], 8), rightMark([80, 300], 0, 90, 22), rightMark([320, 300], 180, 90, 22)];
  paths.push(txt('90°', 136, 250, 15), txt('90°', 264, 250, 15), txt('BACK TO BACK', 200, 362, 10));
  return { id: 'conduit-back-to-back-90', name: 'Conduit back-to-back 90° bends', level: 'beginner', sub: 'electrical', tags: ['conduit', 'ninety', 'bending', 'stub'], paths, detail, claims: [[90, [80, 300], [80, 150], [240, 300]]], nk: ['b2b'] };
}

function kick(a: number): Spec {
  const B: P = [150, 300];
  const E = atP(B, 230, a);
  const paths = [pl([[30, 300], B, E]), seg([20, 312], [380, 312]), seg(atP(B, 12, a / 2 + 90), atP(B, 12, a / 2 - 90))];
  const ext: P = [340, 300];
  const detail = [seg(B, ext), arcP(B, 90, 0, a)];
  paths.push(txt(dg(a), B[0] + 120, 286, 15), txt('KICK', E[0] - 30, E[1] - 20, 12));
  return { id: `conduit-kick-${a}`, name: `Conduit kick at ${dg(a)}`, level: 'beginner', sub: 'electrical', tags: ['conduit', 'kick', 'bending', 'wall'], paths, detail, claims: [[a, B, ext, E]], nk: ['kick', dg(a)] };
}

function saddle3(c: number): Spec {
  const s = c / 2, h = c === 45 ? 60 : 80;
  const dx = h / Math.tan(s * RAD);
  const S1: P = [200 - dx, 300], C: P = [200, 300 - h], S2: P = [200 + dx, 300];
  const rr = (h - 2) / 2;
  const paths = [pl([[30, 300], S1, C, S2, [370, 300]]), circle(200, 308 - rr, rr)];
  const tick = (p: P, d: number) => seg(atP(p, 11, d + 90), atP(p, 11, d - 90));
  paths.push([tick(S1, s / 2), tick(C, 0), tick(S2, -s / 2)].join(' '));
  const e1: P = [S1[0] + 90, 300], e2 = atP(C, 70, s);
  const detail = [seg([20, 308], [380, 308]), seg(S1, e1), seg(C, e2), arcP(S1, 54, 0, s), arcP(C, 44, -s, s)];
  const mp = mid(S1, C), nn = at(0, 0, 30, s + 90);
  paths.push(txt(dg(c), 200, C[1] - 26, 15), txt(dg(s), S1[0] + 30, 326, 12), txt(dg(s), S2[0] - 30, 326, 12), txt(`x${mult(s)}`, mp[0] + nn[0] - 8, mp[1] + nn[1] - 4, 12));
  return {
    id: `conduit-saddle-3-point-${c}`,
    name: `Conduit 3-point saddle, ${dg(c)} centre`,
    level: 'intermediate',
    sub: 'electrical',
    tags: ['conduit', 'saddle', 'bending', 'obstacle'],
    paths,
    detail,
    claims: [[s, S1, e1, C], [c, C, e2, S2]],
    nk: ['saddle3', dg(c), dg(s)],
  };
}

function saddle4(a: number): Spec {
  const h = a === 30 ? 60 : 50, x1 = a === 30 ? 50 : 40;
  const run = h / Math.tan(a * RAD);
  const B1: P = [x1, 300], B2: P = [x1 + run, 300 - h], B3: P = [400 - x1 - run, 300 - h], B4: P = [400 - x1, 300];
  const paths = [pl([[20, 300], B1, B2, B3, B4, [380, 300]]), pl([[B2[0] + 6, 308], [B2[0] + 6, 300 - h + 12], [B3[0] - 6, 300 - h + 12], [B3[0] - 6, 308]])];
  const tick = (p: P, d: number) => seg(atP(p, 11, d + 90), atP(p, 11, d - 90));
  paths.push([tick(B1, a / 2), tick(B2, a / 2), tick(B3, -a / 2), tick(B4, -a / 2)].join(' '));
  const e1: P = [B1[0] + 80, 300];
  const detail = [seg([20, 308], [380, 308]), seg(B1, e1), arcP(B1, 50, 0, a)];
  const mp = mid(B1, B2), nn = at(0, 0, 28, a + 90);
  paths.push(txt(dg(a), B1[0] + 60, 324, 12), txt(dg(a), B4[0] - 60, 324, 12), txt(`x${mult(a)}`, mp[0] + nn[0] - 10, mp[1] + nn[1] - 4, 12));
  return {
    id: `conduit-saddle-4-point-${idNum(a)}`,
    name: `Conduit 4-point saddle, ${dg(a)} bends`,
    level: 'intermediate',
    sub: 'electrical',
    tags: ['conduit', 'saddle', 'bending', 'obstacle'],
    paths,
    detail,
    claims: [[a, B1, e1, B2]],
    nk: ['saddle4', dg(a)],
  };
}

function boxOffset(): Spec {
  const a = 10, O = 34;
  const B1: P = [60, 244], B2: P = [60 + O / Math.tan(a * RAD), 210];
  const paths = [pl([[20, 244], B1, B2, [262, 210]]), seg([20, 250], [380, 250]), rect(262, 160, 100, 90)];
  const tick = (p: P) => seg(atP(p, 11, a / 2 + 90), atP(p, 11, a / 2 - 90));
  paths.push(tick(B1), tick(B2));
  const e1: P = [B1[0] + 120, 244];
  const detail = [seg(B1, e1), arcP(B1, 90, 0, a), seg([256, 196], [256, 224]), seg([268, 196], [268, 224]), rect(276, 174, 72, 62)];
  paths.push(txt(dg(a), 130, 268, 13), txt(`x${mult(a)}`, 160, 196, 13), txt('BOX OFFSET', 200, 300, 12));
  return { id: 'conduit-box-offset', name: 'Conduit box offset (10° bends)', level: 'intermediate', sub: 'electrical', tags: ['conduit', 'box-offset', 'bending', 'knockout'], paths, detail, claims: [[a, B1, e1, B2]], nk: ['boxoffset'] };
}

function segmented90(): Spec {
  const O: P = [130, 160], R = 170;
  const pts: P[] = [[30, 330]];
  for (let k = 0; k <= 9; k++) pts.push(atP(O, R, 270 + 10 * k));
  pts.push([300, 30]);
  const paths = [pl(pts)];
  const detail = [pl([pts[1]!, [300, 330], pts[10]!]), rightMark([300, 330], 180, 90, 20)];
  const tk: string[] = [];
  for (let k = 0; k <= 9; k++) {
    const p = atP(O, R, 270 + 10 * k);
    tk.push(seg(atP(O, R - 10, 270 + 10 * k), atP(O, R + 10, 270 + 10 * k)));
    void p;
  }
  paths.push(tk.join(' '), txt('9 x 10°', 170, 220, 16), txt('90°', 268, 300, 14));
  return { id: 'conduit-segmented-90', name: 'Segmented 90° conduit bend (9 × 10°)', level: 'advanced', sub: 'electrical', tags: ['conduit', 'segment-bend', 'bending', 'ninety'], paths, detail, claims: [[90, [300, 330], [30, 330], [300, 30]]], nk: ['seg90'] };
}

// generic schematic symbols (no standards logos)
function swOneWay(x: number, y: number, ticks = 1): string {
  const e = at(x, y, 50, 45);
  let d = circle(x, y, 8) + ' ' + seg(at(x, y, 8, 45), e);
  for (let i = 0; i < ticks; i++) {
    const b = at(x, y, 50 - i * 10, 45);
    d += ' ' + seg(b, atP(b, 14, -45));
  }
  return d;
}
function symbolSheet(kind: 'switch' | 'power' | 'light'): Spec {
  const cells: P[] = [[80, 120], [200, 120], [320, 120], [80, 290], [200, 290], [320, 290]];
  const paths: string[] = [];
  const detail = [seg([140, 30], [140, 370]), seg([260, 30], [260, 370]), seg([20, 205], [380, 205])];
  const [c0, c1, c2, c3, c4, c5] = cells as [P, P, P, P, P, P];
  if (kind === 'switch') {
    paths.push(swOneWay(c0[0], c0[1]));
    const e1 = at(c1[0], c1[1], 50, 45), e2 = at(c1[0], c1[1], 50, 225);
    paths.push(`${circle(c1[0], c1[1], 8)} ${seg(e1, e2)} ${seg(e1, atP(e1, 14, -45))} ${seg(e2, atP(e2, 14, 135))}`);
    const f1 = at(c2[0], c2[1], 50, 45), f2 = at(c2[0], c2[1], 50, 225), g1 = at(c2[0], c2[1], 50, 135), g2 = at(c2[0], c2[1], 50, 315);
    paths.push(`${circle(c2[0], c2[1], 8)} ${seg(f1, f2)} ${seg(g1, g2)} ${seg(f1, atP(f1, 14, -45))} ${seg(f2, atP(f2, 14, 135))}`);
    paths.push(swOneWay(c3[0], c3[1]), arrow(at(c3[0], c3[1], 36, 200), at(c3[0], c3[1], 40, 20), 10));
    paths.push(swOneWay(c4[0], c4[1], 2));
    paths.push(circle(c5[0], c5[1], 18), circle(c5[0], c5[1], 7));
  } else if (kind === 'power') {
    const out = (c: P, n: number) => {
      let d = `${seg([c[0] - 30, c[1] + 16], [c[0] + 30, c[1] + 16])} ${arc(c[0], c[1] + 16, 22, 0, 180)}`;
      const xs = n === 1 ? [0] : [-7, 7];
      for (const dx of xs) d += ' ' + seg([c[0] + dx, c[1] + 16], [c[0] + dx, c[1] - 30]);
      return d;
    };
    paths.push(out(c0, 1), out(c1, 2));
    paths.push(out(c2, 2), seg([c2[0] + 7, c2[1] - 30], [c2[0] + 22, c2[1] - 40]));
    paths.push(out(c3, 1), pl([[c3[0] + 28, c3[1] - 30], [c3[0] + 46, c3[1] - 30], [c3[0] + 37, c3[1] - 46]], true));
    paths.push(rect(c4[0] - 22, c4[1] - 22, 44, 44), seg([c4[0] - 22, c4[1] + 22], [c4[0] + 22, c4[1] - 22]));
    paths.push(rect(c5[0] - 24, c5[1] - 24, 48, 48), circle(c5[0], c5[1], 14));
  } else {
    const xo = (c: P, r: number) => `${circle(c[0], c[1], r)} ${seg(at(c[0], c[1], r, 45), at(c[0], c[1], r, 225))} ${seg(at(c[0], c[1], r, 135), at(c[0], c[1], r, 315))}`;
    paths.push(xo(c0, 24));
    paths.push(`${seg([c1[0] - 34, c1[1] + 14], [c1[0] + 34, c1[1] + 14])} ${arc(c1[0], c1[1] + 14, 24, 0, 180)} ${seg(at(c1[0], c1[1] + 14, 24, 45), [c1[0], c1[1] + 14])} ${seg(at(c1[0], c1[1] + 14, 24, 135), [c1[0], c1[1] + 14])}`);
    paths.push(circle(c2[0], c2[1], 20), circle(c2[0], c2[1], 7));
    paths.push(rect(c3[0] - 44, c3[1] - 8, 88, 16), seg([c3[0] - 44, c3[1] - 18], [c3[0] - 44, c3[1] + 18]), seg([c3[0] + 44, c3[1] - 18], [c3[0] + 44, c3[1] + 18]));
    let fan = circle(c4[0], c4[1], 26);
    for (const a of [90, 210, 330]) {
      const p = at(c4[0], c4[1], 22, a), q = at(c4[0], c4[1], 16, a + 40);
      fan += ` M ${f(c4[0])} ${f(c4[1])} Q ${f(q[0])} ${f(q[1])} ${f(p[0])} ${f(p[1])}`;
    }
    paths.push(fan);
    paths.push(`${circle(c5[0], c5[1], 18)} ${circle(c5[0], c5[1], 6)} ${arc(c5[0], c5[1], 28, -40, 40)} ${arc(c5[0], c5[1], 36, -40, 40)}`);
  }
  const names = { switch: 'Switch symbols (generic)', power: 'Power point symbols (generic)', light: 'Lighting symbols (generic)' };
  return { id: `electrical-symbols-${kind}`, name: names[kind], level: 'beginner', sub: 'electrical', tags: ['electrical-symbols', kind === 'light' ? 'lighting' : kind, 'schematic', 'wiring'], paths, detail, nk: ['symbols', kind] };
}

function roomPlan(): Spec {
  const paths = [
    pl([[80, 340], [40, 340], [40, 60], [360, 60], [360, 340], [150, 340]]),
    pl([[80, 350], [30, 350], [30, 50], [370, 50], [370, 350], [150, 350]]),
    seg([150, 340], [150, 270]),
  ];
  const detail = [arc(150, 340, 70, 90, 180), seg([200, 55], [320, 55])];
  paths.push(seg([200, 50], [200, 60]), seg([320, 50], [320, 60]));
  paths.push(swOneWay(170, 322));
  const xo = (c: P, r: number) => `${circle(c[0], c[1], r)} ${seg(at(c[0], c[1], r, 45), at(c[0], c[1], r, 225))} ${seg(at(c[0], c[1], r, 135), at(c[0], c[1], r, 315))}`;
  paths.push(xo([200, 200], 20));
  const dl = [[110, 120], [290, 120], [110, 280], [290, 280]].map(([x, y]) => `${circle(x!, y!, 12)} ${circle(x!, y!, 4)}`).join(' ');
  paths.push(dl);
  // double outlets on the side walls, facing into the room
  paths.push(`${arc(40, 150, 18, -90, 90)} ${seg([40, 144], [62, 144])} ${seg([40, 156], [62, 156])}`);
  paths.push(`${arc(360, 250, 18, 90, 270)} ${seg([360, 244], [338, 244])} ${seg([360, 256], [338, 256])}`);
  detail.push(`M 180 310 Q 220 260 200 220`, `M 200 180 Q 150 130 122 120`, `M 220 190 Q 260 140 278 120`, `M 186 214 Q 140 260 120 270`, `M 214 214 Q 260 260 280 270`);
  return { id: 'electrical-room-layout', name: 'Room lighting and power layout', level: 'advanced', sub: 'electrical', tags: ['electrical-plan', 'lighting', 'power', 'wiring'], paths, detail, nk: ['room'] };
}

const PART2: Spec[] = [
  ...(['fillet', 'fillet-both', 'v-groove', 'bevel', 'plug', 'spot', 'all-round'] as const).map(weldSym),
  gusset('45'),
  gusset('30-60'),
  ...(['equal-angle', 'unequal-angle', 'channel', 'i-beam', 'rhs'] as const).map(section),
  conePattern(60, 0, [220, 150], 160, 'intermediate'),
  conePattern(90, 0, [245, 195], 135, 'intermediate'),
  conePattern(40, 0, [210, 170], 170, 'intermediate'),
  conePattern(60, 0.5, [220, 150], 160, 'advanced'),
  conePattern(45, 0.4, [205, 150], 170, 'advanced'),
  lobster(2),
  lobster(3),
  lobster(4),
  flangeN(10),
  flangeN(12),
  flangeN(16),
  countersink(90),
  countersinkCutter(),
  chamfers(),
  kneeBracket(),
  saddle(1, 90),
  saddle(0.75, 90),
  saddle(0.5, 90),
  saddle(1, 45),
  saddle(0.75, 45),
  saddle(0.5, 45),
  saddleHole(),
  ...[22.5, 30, 45, 60].map(pipeOffset),
  pipeTee(false),
  pipeTee(true),
  ...[30, 45, 60].map(mitredBend),
  ...[10, 22.5, 30, 45].map(conduitOffset),
  backToBack(),
  kick(30),
  saddle3(45),
  saddle3(60),
  saddle4(30),
  saddle4(22.5),
  boxOffset(),
  segmented90(),
  symbolSheet('switch'),
  symbolSheet('power'),
  symbolSheet('light'),
  roomPlan(),
];

// ================================================================================================= TILING

const FB = [20, 20, 380, 380] as const;
function tileSet(polys: readonly P[][], box: readonly [number, number, number, number] = FB): P[][] {
  const out: P[][] = [];
  for (const p of polys) {
    const c = clipPoly(p, box[0], box[1], box[2], box[3]);
    if (c) out.push(c);
  }
  return out;
}
const R4 = (x: number, y: number, w: number, h: number): P[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function subway(frac: number, vertical: boolean): Spec {
  const w = 64, h = 32;
  const polys: P[][] = [];
  for (let i = 0; i * h < 360; i++) {
    const off = (((i * frac) % 1) + 1) % 1 * w;
    for (let x = 20 - off - w; x < 380; x += w) polys.push(R4(x, 20 + i * h, w, h));
  }
  const T = vertical ? polys.map((p) => p.map(([x, y]) => [y, x] as P)) : polys;
  const paths = chunks(tileSet(T), 40);
  const lab = frac === 0.5 ? '1/2' : frac === 1 / 3 ? '1/3' : '1/4';
  const detail = [vertical ? seg([20, 200], [380, 200]) : seg([200, 20], [200, 380])];
  return {
    id: `tile-subway-${frac === 0.5 ? 'half' : frac === 1 / 3 ? 'third' : 'quarter'}${vertical ? '-vertical' : ''}`,
    name: `${vertical ? 'Vertical subway' : 'Subway'} tile, ${lab} offset`,
    level: 'beginner',
    sub: 'tiling',
    tags: ['subway', 'running-bond', 'tile-pattern', 'tiling'],
    paths,
    detail,
    nk: [vertical ? 'subwayv' : 'subway', lab],
  };
}

function herring(rot: number, double: boolean): Spec {
  const u = double ? 34 : 26;
  const polys: P[][] = [];
  const tf = (x: number, y: number): P => {
    const c = Math.cos(rot * RAD), s = Math.sin(rot * RAD);
    const X = x * u, Y = y * u;
    return [200 + X * c - Y * s, 200 + X * s + Y * c];
  };
  const K = 16;
  for (let m = -K; m <= K; m++)
    for (let k = -K; k <= K; k++) {
      const ox = k + 2 * m, oy = k - 2 * m;
      const hT: [number, number, number, number] = [ox, oy, 2, 1];
      const vT: [number, number, number, number] = [ox, oy + 1, 1, 2];
      const parts: [number, number, number, number][] = double
        ? [[hT[0], hT[1], 2, 0.5], [hT[0], hT[1] + 0.5, 2, 0.5], [vT[0], vT[1], 0.5, 2], [vT[0] + 0.5, vT[1], 0.5, 2]]
        : [hT, vT];
      for (const [x, y, w, h] of parts) {
        const q = [tf(x, y), tf(x + w, y), tf(x + w, y + h), tf(x, y + h)];
        if (q.some(([a, b]) => a > -40 && a < 440 && b > -40 && b < 440)) polys.push(q);
      }
    }
  const paths = chunks(tileSet(polys), 40);
  paths.push(rect(20, 20, 360, 360));
  const detail = rot ? [seg([20, 200], [380, 200]), seg([200, 20], [200, 380])] : [seg([20, 20], [380, 380])];
  const id = double ? 'tile-double-herringbone' : rot ? 'tile-herringbone-45' : 'tile-herringbone-straight';
  const name = double ? 'Double herringbone tile pattern' : rot ? 'Herringbone tile pattern at 45°' : 'Straight herringbone tile pattern';
  return { id, name, level: double ? 'advanced' : 'intermediate', sub: 'tiling', tags: ['herringbone', 'tile-pattern', 'parquet', 'tiling'], paths, detail, nk: [double ? 'herringdouble' : rot ? 'herring45' : 'herringstraight'] };
}

function basketweave(): Spec {
  const u = 30, polys: P[][] = [];
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      const x = 20 + i * 2 * u, y = 20 + j * 2 * u;
      if ((i + j) % 2 === 0) polys.push(R4(x, y, 2 * u, u), R4(x, y + u, 2 * u, u));
      else polys.push(R4(x, y, u, 2 * u), R4(x + u, y, u, 2 * u));
    }
  return { id: 'tile-basketweave', name: 'Basketweave tile pattern', level: 'beginner', sub: 'tiling', tags: ['basketweave', 'tile-pattern', 'paving', 'tiling'], paths: chunks(polys, 40), nk: ['basket'] };
}

function hexTiles(): Spec {
  const s = 30, polys: P[][] = [];
  const hh = Math.sqrt(3) * s;
  for (let c = -1; c < 11; c++)
    for (let r = -1; r < 9; r++) {
      const cx = 20 + c * 1.5 * s, cy = 20 + r * hh + (c % 2 ? hh / 2 : 0);
      const pts: P[] = [];
      for (let k = 0; k < 6; k++) pts.push(at(cx, cy, s, 60 * k));
      polys.push(pts);
    }
  const paths = chunks(tileSet(polys), 40);
  paths.push(rect(20, 20, 360, 360));
  return { id: 'tile-hexagon', name: 'Hexagon tile pattern', level: 'intermediate', sub: 'tiling', tags: ['hexagon', 'tile-pattern', 'honeycomb', 'tiling'], paths, nk: ['hex'] };
}

function chevronTiles(): Spec {
  const cw = 50, h = 34, polys: P[][] = [];
  for (let col = 0; col < 4; col++) {
    const x0 = 20 + col * 2 * cw;
    for (let y = -2 * cw; y < 420; y += h) {
      polys.push([[x0, y], [x0 + cw, y - cw], [x0 + cw, y - cw + h], [x0, y + h]]);
      polys.push([[x0 + cw, y - cw], [x0 + 2 * cw, y], [x0 + 2 * cw, y + h], [x0 + cw, y - cw + h]]);
    }
  }
  const paths = chunks(tileSet(polys), 40);
  paths.push(rect(20, 20, 360, 360));
  // reference: one tile end against a level line
  const yv = -2 * cw + h * 7, xv = 20 + 2 * cw;
  const v: P = [xv, yv], e: P = [xv + cw, yv - cw], ref: P = [xv + 90, yv];
  paths.push(seg(v, e), txt('45°', xv + 60, yv - 14, 13));
  const detail = [seg(v, ref), arcP(v, 40, 0, 45)];
  return { id: 'tile-chevron-45', name: 'Chevron tile pattern with 45° ends', level: 'intermediate', sub: 'tiling', tags: ['chevron', 'tile-pattern', 'parquet', 'tiling'], paths, detail, claims: [[45, v, ref, e]], nk: ['chevron'] };
}

function versailles(): Spec {
  const u = 30;
  const unit: [number, number, number, number][] = [
    [0, 0, 3, 2], [3, 0, 2, 2], [5, 0, 1, 2], [0, 2, 2, 2], [2, 2, 1, 1], [2, 3, 1, 1], [3, 2, 2, 3], [5, 2, 1, 2], [0, 4, 3, 2], [3, 5, 2, 1], [5, 4, 1, 2],
  ];
  const polys: P[][] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (const [x, y, w, h] of unit) polys.push(R4(20 + (i * 6 + x) * u, 20 + (j * 6 + y) * u, w * u, h * u));
  return { id: 'tile-versailles-mix', name: 'Versailles-style mixed tile pattern', level: 'advanced', sub: 'tiling', tags: ['versailles', 'tile-pattern', 'paving', 'tiling'], paths: chunks(tileSet(polys), 40), nk: ['versailles'] };
}

function diagonalSetOut(): Spec {
  const box = [30, 40, 370, 360] as const;
  const c: P = [200, 200];
  const paths = [rect(30, 40, 340, 320), pl([[30, 200], c, [370, 200]]), seg([200, 40], [200, 360])];
  const e = atP(c, 150, 45);
  paths.push(seg(c, e));
  const detail: string[] = [];
  const s = 40 * Math.SQRT2;
  for (let k = -12; k <= 12; k++) {
    const l1 = clipSeg([200 + k * s - 400, 200 + 400], [200 + k * s + 400, 200 - 400], box[0], box[1], box[2], box[3]);
    const l2 = clipSeg([200 + k * s - 400, 200 - 400], [200 + k * s + 400, 200 + 400], box[0], box[1], box[2], box[3]);
    if (l1) detail.push(l1);
    if (l2) detail.push(l2);
  }
  paths.push(arcP(c, 60, 0, 45), txt('45°', 290, 176, 16));
  return { id: 'tile-diagonal-set-out', name: 'Diagonal 45° tile set-out', level: 'intermediate', sub: 'tiling', tags: ['diagonal', 'set-out', 'tile-layout', 'tiling'], paths, detail: [detail.join(' ')], claims: [[45, c, [370, 200], e]], nk: ['diagonal'] };
}

function tileCut(a: number): Spec {
  const rectTile = a === 45;
  const x0 = 60, x1 = 340, y1 = rectTile ? 270 : 340, y0 = rectTile ? 130 : 60;
  const v: P = [x0, y1];
  const run = (y1 - y0) / Math.tan(a * RAD);
  const e: P = run <= x1 - x0 ? [x0 + run, y0] : [x1, y1 - (x1 - x0) * Math.tan(a * RAD)];
  const paths = [pl([v, [x1, y1], [x1, y0], [x0, y0]], true), seg(v, e)];
  const detail = [arcP(v, 90, 0, a)];
  const n = at(0, 0, 1, a + 90);
  for (let k = 14; k < 140; k += 14) {
    const l = clipSeg(add(v, [n[0] * k - 400 * Math.cos(a * RAD), n[1] * k + 400 * Math.sin(a * RAD)]), add(v, [n[0] * k + 400 * Math.cos(a * RAD), n[1] * k - 400 * Math.sin(a * RAD)]), x0, y0, x1, y1);
    if (l) detail.push(l);
  }
  const lp = atP(v, 130, a / 2);
  const cm = add(mid(v, e), at(0, 0, 18, a + 90));
  paths.push(txt(dg(a), lp[0] + 16, lp[1] + 8, 18), txt('CUT', cm[0], cm[1], 11));
  return {
    id: `tile-cut-${idNum(a)}`,
    name: `Tile cut guide at ${dg(a)}`,
    level: 'beginner',
    sub: 'tiling',
    tags: ['tile-cut', 'cut-guide', 'angle', 'tiling'],
    paths,
    detail: [detail.join(' ')],
    claims: [[a, v, [x1, y1], e]],
    nk: ['tilecut', dg(a)],
  };
}

function pinwheel(): Spec {
  const u = 36, polys: P[][] = [];
  for (let i = -8; i <= 8; i++)
    for (let j = -8; j <= 8; j++) {
      const ox = 20 + (2 * i - j) * u, oy = 20 + (i + 2 * j) * u;
      polys.push(R4(ox, oy, 2 * u, 2 * u), R4(ox + 2 * u, oy, u, u));
    }
  const paths = chunks(tileSet(polys), 40);
  paths.push(rect(20, 20, 360, 360));
  return { id: 'tile-pinwheel', name: 'Pinwheel (hopscotch) tile pattern', level: 'intermediate', sub: 'tiling', tags: ['pinwheel', 'hopscotch', 'tile-pattern', 'tiling'], paths, nk: ['pinwheel'] };
}

// ================================================================================================= DRAFTING

function isoBox(): Spec {
  const F: P = [200, 330], a = 170, b = 130, h = 150;
  const R = atP(F, a, 30), L = atP(F, b, 150);
  const up = (p: P): P => [p[0], p[1] - h];
  const back = add(R, [L[0] - F[0], L[1] - F[1]]);
  const paths = [pl([L, F, R]), seg(F, up(F)), seg(L, up(L)), seg(R, up(R)), pl([up(L), up(F), up(R), up(back), up(L)])];
  const ref: P = [F[0] + 160, F[1]];
  const detail = [pl([L, back, R]), seg(back, up(back)), seg([F[0] - 160, F[1]], ref), arcP(F, 70, 0, 30)];
  paths.push(txt('30°', F[0] + 100, F[1] - 12, 14), txt('30°', F[0] - 100, F[1] - 12, 14));
  return { id: 'iso-box-construction', name: 'Isometric box construction', level: 'beginner', sub: 'drafting', tags: ['isometric', 'box', 'drawing', 'drafting'], paths, detail, claims: [[30, F, ref, R]], nk: ['isobox'] };
}

/** Four-centre isometric ellipse for a circle of diameter d in the horizontal plane. */
function isoEllipse(c: P, d: number, part: 'all' | 'front' = 'all'): { arcs: string; rh: string; left: P; right: P; back: string } {
  const T: P = [c[0], c[1] - d / 2], Bm: P = [c[0], c[1] + d / 2], Rr: P = [c[0] + d * Math.cos(30 * RAD), c[1]], Lr: P = [c[0] - d * Math.cos(30 * RAD), c[1]];
  const mTR = mid(T, Rr), mRB = mid(Rr, Bm), mBL = mid(Bm, Lr), mLT = mid(Lr, T);
  const inter = (p1: P, p2: P, q1: P, q2: P): P => {
    const den = (p1[0] - p2[0]) * (q1[1] - q2[1]) - (p1[1] - p2[1]) * (q1[0] - q2[0]);
    const t = ((p1[0] - q1[0]) * (q1[1] - q2[1]) - (p1[1] - q1[1]) * (q1[0] - q2[0])) / den;
    return lerp(p1, p2, t);
  };
  const SR = inter(Bm, mTR, T, mRB), SL = inter(Bm, mLT, T, mBL);
  const rb = dist(Bm, mTR), rs = dist(SR, mTR);
  const A = (p: P) => `${f(p[0])} ${f(p[1])}`;
  const front = `M ${A(mBL)} A ${f(rs)} ${f(rs)} 0 0 0 ${A(mLT)}`; // placeholder for left small arc (unused)
  void front;
  const top = `M ${A(mLT)} A ${f(rb)} ${f(rb)} 0 0 1 ${A(mTR)}`;
  const right = `M ${A(mTR)} A ${f(rs)} ${f(rs)} 0 0 1 ${A(mRB)}`;
  const bottom = `M ${A(mRB)} A ${f(rb)} ${f(rb)} 0 0 1 ${A(mBL)}`;
  const left = `M ${A(mBL)} A ${f(rs)} ${f(rs)} 0 0 1 ${A(mLT)}`;
  const Le: P = [SL[0] - rs, SL[1]], Re: P = [SR[0] + rs, SR[1]];
  const frontHalf = `M ${A(Le)} A ${f(rs)} ${f(rs)} 0 0 0 ${A(mBL)} A ${f(rb)} ${f(rb)} 0 0 0 ${A(mRB)} A ${f(rs)} ${f(rs)} 0 0 0 ${A(Re)}`;
  const backHalf = `M ${A(Re)} A ${f(rs)} ${f(rs)} 0 0 0 ${A(mTR)} A ${f(rb)} ${f(rb)} 0 0 0 ${A(mLT)} A ${f(rs)} ${f(rs)} 0 0 0 ${A(Le)}`;
  const arcs = part === 'all' ? [top, right, bottom, left].join(' ') : frontHalf;
  const rh = `${pl([T, Rr, Bm, Lr], true)} ${seg(Bm, mTR)} ${seg(Bm, mLT)} ${seg(T, mRB)} ${seg(T, mBL)}`;
  return { arcs, rh, left: Le, right: Re, back: backHalf };
}

function isoCylinder(): Spec {
  const d = 190, c1: P = [200, 120], c2: P = [200, 290];
  const e1 = isoEllipse(c1, d), e2 = isoEllipse(c2, d, 'front');
  const paths = [e1.arcs, e2.arcs, seg(e1.left, e2.left), seg(e1.right, e2.right)];
  const detail = [e1.rh, e2.back, seg([200, 120], [200, 290])];
  return { id: 'iso-cylinder-four-centre', name: 'Isometric cylinder (four-centre ellipses)', level: 'intermediate', sub: 'drafting', tags: ['isometric', 'cylinder', 'ellipse', 'drafting'], paths, detail, nk: ['isocyl'] };
}

function orthoThree(): Spec {
  // L-block: front (width 120, height 100, step), top (depth 70), right side
  const fx = 50, fy = 230, W = 120, H = 100, Dp = 70, gap = 40;
  const front = pl([[fx, fy + H], [fx, fy], [fx + 50, fy], [fx + 50, fy + 50], [fx + W, fy + 50], [fx + W, fy + H]], true);
  const top = `${rect(fx, fy - gap - Dp, W, Dp)} ${seg([fx + 50, fy - gap - Dp], [fx + 50, fy - gap])}`;
  const sx = fx + W + gap;
  const side = `${rect(sx, fy, Dp, H)} ${seg([sx, fy + 50], [sx + Dp, fy + 50])}`;
  const paths = [front, top, side];
  const detail: string[] = [];
  for (const x of [fx, fx + 50, fx + W]) detail.push(seg([x, fy - 6], [x, fy - gap + 6]));
  for (const y of [fy, fy + 50, fy + H]) detail.push(seg([fx + W + 6, y], [sx - 6, y]));
  // 45° mitre line transfers depth between top and side views
  const m0: P = [sx, fy - gap], m1: P = [sx + Dp + 30, fy - gap - Dp - 30];
  detail.push(seg(m0, m1));
  for (const y of [fy - gap - Dp, fy - gap]) {
    const xm = sx + (fy - gap - y);
    detail.push(seg([fx + W + 6, y], [xm, y]), seg([xm, y], [xm, fy - 6]));
  }
  paths.push(txt('FRONT', fx + W / 2, fy + H + 24, 10), txt('TOP', fx + W / 2, fy - gap - Dp - 16, 10), txt('SIDE', sx + Dp / 2, fy + H + 24, 10));
  return { id: 'ortho-three-view', name: 'Orthographic three-view layout', level: 'intermediate', sub: 'drafting', tags: ['orthographic', 'projection', 'views', 'drafting'], paths, detail, nk: ['ortho'] };
}

function projectionSymbol(first: boolean): Spec {
  const cy = 200;
  const circX = first ? 110 : 300, trX0 = first ? 190 : 60, trX1 = first ? 350 : 220;
  const big = 70, small = 38;
  const paths = [circle(circX, cy, big), circle(circX, cy, small), pl([[trX0, cy - big], [trX1, cy - small], [trX1, cy + small], [trX0, cy + big]], true)];
  const detail = [seg([circX - big - 16, cy], [circX + big + 16, cy]), seg([circX, cy - big - 16], [circX, cy + big + 16]), seg([trX0 - 16, cy], [trX1 + 16, cy])];
  paths.push(txt(first ? 'FIRST ANGLE' : 'THIRD ANGLE', 200, 330, 14));
  return {
    id: first ? 'projection-symbol-first-angle' : 'projection-symbol-third-angle',
    name: first ? 'First-angle projection symbol' : 'Third-angle projection symbol',
    level: 'beginner',
    sub: 'drafting',
    tags: ['projection', 'symbol', 'orthographic', 'drafting'],
    paths,
    detail,
    nk: [first ? 'first' : 'third'],
  };
}

/** Convex polygon hatch (Cyrus-Beck clipping of parallel lines). */
function hatchPoly(poly: readonly P[], ang: number, s: number, off = 0): string {
  const out: string[] = [];
  const u = at(0, 0, 1, ang), n = at(0, 0, 1, ang + 90);
  const proj = poly.map((p) => p[0] * n[0] + p[1] * n[1]);
  const lo = Math.min(...proj), hi = Math.max(...proj);
  for (let k = Math.ceil((lo - off) / s) * s + off; k <= hi; k += s) {
    const base: P = [n[0] * k, n[1] * k];
    let t0 = -2000, t1 = 2000;
    let cw = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      cw += (b[0] - a[0]) * (b[1] + a[1]);
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      // inward normal
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      if (cw > 0) { nx = -nx; ny = -ny; }
      const den = nx * u[0] + ny * u[1];
      const num = nx * (base[0] - a[0]) + ny * (base[1] - a[1]);
      if (Math.abs(den) < 1e-9) {
        if (num < 0) { t0 = 1; t1 = 0; }
        continue;
      }
      const t = -num / den;
      if (den > 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (t1 - t0 > 2) out.push(seg(add(base, [u[0] * t0, u[1] * t0]), add(base, [u[0] * t1, u[1] * t1])));
  }
  return out.join(' ');
}

function sectionHatch(): Spec {
  // a bushing in a housing, cut in half: opposite hatch directions on the two parts
  const outer: P[] = [[40, 80], [360, 80], [360, 320], [40, 320]];
  const paths = [pl(outer, true), rect(120, 80, 160, 240), rect(170, 80, 60, 240)];
  const detail = [
    hatchPoly([[40, 80], [120, 80], [120, 320], [40, 320]], 45, 16),
    hatchPoly([[280, 80], [360, 80], [360, 320], [280, 320]], 45, 16),
    hatchPoly([[120, 80], [170, 80], [170, 320], [120, 320]], 135, 12),
    hatchPoly([[230, 80], [280, 80], [280, 320], [230, 320]], 135, 12),
    seg([200, 60], [200, 340]),
  ];
  const v: P = [40, 320], e: P = [40 + 150, 320 - 150];
  paths.push(txt('45°', 200, 360, 14));
  void v; void e;
  return { id: 'section-hatch-45', name: 'Section hatching at 45°', level: 'beginner', sub: 'drafting', tags: ['section', 'hatching', 'cross-section', 'drafting'], paths, detail, nk: ['hatch45'] };
}

function hatchSamples(): Spec {
  const boxes: [number, number][] = [[40, 40], [220, 40], [40, 220], [220, 220]];
  const paths = boxes.map(([x, y]) => rect(x, y, 140, 140));
  const sq = (x: number, y: number): P[] => [[x, y], [x + 140, y], [x + 140, y + 140], [x, y + 140]];
  const detail = [
    hatchPoly(sq(40, 40), 45, 14),
    `${hatchPoly(sq(220, 40), 45, 14)} ${hatchPoly(sq(220, 40), 135, 14)}`,
    `${hatchPoly(sq(40, 220), 45, 26)} ${hatchPoly(sq(40, 220), 45, 26, 7)}`,
    hatchPoly(sq(220, 220), 0, 14),
  ];
  return { id: 'section-hatch-samples', name: 'Section hatch samples', level: 'beginner', sub: 'drafting', tags: ['section', 'hatching', 'materials', 'drafting'], paths, detail, nk: ['hatchsamples'] };
}

function hexNut(): Spec {
  const c: P = [200, 150], rin = 100, R = rin / Math.cos(30 * RAD);
  const v: P[] = [];
  for (let k = 0; k < 6; k++) v.push(atP(c, R, 30 + 60 * k));
  const paths = [pl(v, true), circle(c[0], c[1], rin), circle(c[0], c[1], 46)];
  const detail = [arcP(c, 54, 0, 270), seg([c[0] - 130, c[1]], [c[0] + 130, c[1]]), seg([c[0], c[1] - 130], [c[0], c[1] + 130]), seg(c, v[0]!), seg(c, v[1]!), arcP(c, 70, 30, 90)];
  for (const k of [0, 2]) detail.push(seg(atP(v[k]!, 40, 30 + 60 * k + 120), atP(v[k]!, 40, 30 + 60 * k - 120)));
  // side view: three faces, chamfer arcs
  const y0 = 300, y1 = 370, half = R;
  paths.push(rect(c[0] - half, y0, 2 * half, y1 - y0), seg([c[0] - half / 2, y0], [c[0] - half / 2, y1]), seg([c[0] + half / 2, y0], [c[0] + half / 2, y1]));
  const ch: string[] = [];
  for (const [xa, xb] of [[c[0] - half, c[0] - half / 2], [c[0] - half / 2, c[0] + half / 2], [c[0] + half / 2, c[0] + half]] as const) {
    const w = xb - xa;
    ch.push(`M ${f(xa)} ${y0 + 8} Q ${f((xa + xb) / 2)} ${f(y0 - w * 0.12 + 18)} ${f(xb)} ${y0 + 8}`, `M ${f(xa)} ${y1 - 8} Q ${f((xa + xb) / 2)} ${f(y1 + w * 0.12 - 18)} ${f(xb)} ${y1 - 8}`);
  }
  detail.push(ch.join(' '));
  paths.push(txt('60°', 225, 82, 12), txt('AF', 200, 262, 10));
  detail.push(dim([c[0] - rin, 262], [c[0] - 22, 262], 6), dim([c[0] + 22, 262], [c[0] + rin, 262], 6));
  return { id: 'hex-nut-across-flats', name: 'Hex nut, across-flats construction', level: 'intermediate', sub: 'drafting', tags: ['hex-nut', 'across-flats', 'fastener', 'drafting'], paths, detail, claims: [[60, c, v[0]!, v[1]!]], nk: ['hexnut'] };
}

function boltThread(): Spec {
  // bolt in side view, and an enlarged 60° thread form below
  const paths = [rect(30, 60, 70, 120), seg([30, 90], [100, 90]), seg([30, 150], [100, 150]), pl([[100, 85], [360, 85]]), pl([[100, 155], [360, 155]]), seg([360, 85], [370, 95]), seg([370, 95], [370, 145]), seg([370, 145], [360, 155])];
  const detail: string[] = [];
  for (let x = 230; x <= 350; x += 12) detail.push(seg([x, 85], [x + 6, 155]));
  detail.push(seg([230, 93], [360, 93]), seg([230, 147], [360, 147]), seg([20, 120], [380, 120]));
  const p = 110, d = (p / 2) / Math.tan(30 * RAD), yb = 350;
  const pts: P[] = [];
  for (let i = 0; i <= 3; i++) pts.push([45 + i * p, yb - d], [45 + i * p + p / 2, yb]);
  pts.pop();
  paths.push(pl(pts));
  const root: P = [45 + p / 2, yb], c1: P = [45, yb - d], c2: P = [45 + p, yb - d];
  detail.push(arcP(root, 40, 60, 120), seg([30, yb - d], [370, yb - d]), seg([30, yb], [370, yb]));
  paths.push(txt('60°', root[0], yb - d - 14 + 0, 14), txt('THREAD FORM', 260, 214, 11));
  return { id: 'bolt-thread-60', name: 'Bolt with 60° thread form', level: 'advanced', sub: 'drafting', tags: ['bolt', 'thread', 'fastener', 'drafting'], paths, detail, claims: [[60, root, c2, c1]], nk: ['bolt'] };
}

function spurGear(n: number): Spec {
  const c: P = [200, 200];
  const m = 172 / (n / 2 + 1);
  const rp = (m * n) / 2, ro = rp + m, rf = rp - 1.25 * m, rb = rp * Math.cos(20 * RAD);
  const inv = (a: number) => Math.tan(a) - a;
  const half = Math.PI / (2 * n) + inv(20 * RAD);
  const psi = (r: number) => half - inv(Math.acos(Math.min(1, rb / r)));
  const pts: P[] = [];
  const pol = (r: number, a: number): P => [c[0] + r * Math.cos(a), c[1] - r * Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n;
    const r0 = Math.max(rb, rf);
    // root arc from previous tooth
    const prevEnd = th - (2 * Math.PI) / n + psi(r0);
    const start = th - psi(r0);
    for (let k = 1; k <= 3; k++) pts.push(pol(rf, prevEnd + ((start - prevEnd) * k) / 4));
    if (rf < rb) pts.push(pol(rf, start));
    for (let k = 0; k <= 6; k++) {
      const r = r0 + ((ro - r0) * k) / 6;
      pts.push(pol(r, th - psi(r)));
    }
    for (let k = 6; k >= 0; k--) {
      const r = r0 + ((ro - r0) * k) / 6;
      pts.push(pol(r, th + psi(r)));
    }
    if (rf < rb) pts.push(pol(rf, th + psi(r0)));
  }
  const paths = [pl(pts, true), circle(200, 200, 30), rect(194, 166, 12, 8)];
  const detail = [circle(200, 200, rp), seg([20, 200], [380, 200]), seg([200, 20], [200, 380])];
  paths.push(txt('APPROX', 200, 250, 12), txt(String(n), 200, 280, 12));
  return { id: `spur-gear-${n}`, name: `Spur gear outline, ${n} teeth`, level: 'advanced', sub: 'drafting', tags: ['gear', 'involute', 'machine', 'drafting'], paths, detail, nk: ['gear', n] };
}

function cam(): Spec {
  const c: P = [200, 214], rb = 80, h = 80;
  const r = (t: number) => (t <= 120 ? rb + (h / 2) * (1 - Math.cos((Math.PI * t) / 120)) : t <= 180 ? rb + h : t <= 300 ? rb + (h / 2) * (1 + Math.cos((Math.PI * (t - 180)) / 120)) : rb);
  const pts: P[] = [];
  for (let t = 0; t < 360; t += 3) pts.push(atP(c, r(t), 90 - t));
  const paths = [pl(pts, true), circle(c[0], c[1], 22)];
  const ends: P[] = [0, 120, 180, 300].map((t) => atP(c, rb + h + 14, 90 - t));
  const detail = [circle(c[0], c[1], rb), ...ends.map((e) => seg(c, e)), arcP(c, 40, -30, 90), arcP(c, 46, -90, -30), arcP(c, 52, 150, 270), arcP(c, 40, 90, 150)];
  const roller = atP(c, r(0) + 14, 90);
  detail.push(circle(roller[0], roller[1], 14), seg([roller[0], roller[1] - 14], [roller[0], 6]));
  const lab = (t0: number, t1: number, s: string) => {
    const p = atP(c, rb - 26, 90 - (t0 + t1) / 2);
    return txt(s, p[0], p[1], 10);
  };
  paths.push(lab(0, 120, '120°'), lab(120, 180, '60°'), lab(180, 300, '120°'), lab(300, 360, '60°'));
  return {
    id: 'cam-profile-harmonic',
    name: 'Plate cam profile, rise-dwell-fall',
    level: 'advanced',
    sub: 'drafting',
    tags: ['cam', 'profile', 'machine', 'drafting'],
    paths,
    detail,
    claims: [[120, c, ends[1]!, ends[0]!], [60, c, ends[2]!, ends[1]!], [120, c, ends[3]!, ends[2]!]],
    nk: ['cam'],
  };
}

function ellipseFourCentre(): Spec {
  const a = 150, b = 90, c: P = [200, 200];
  const A: P = [c[0] + a, c[1]], C: P = [c[0], c[1] - b];
  const AC = dist(A, C);
  const E = lerp(C, A, (a - b) / AC);
  const M = mid(A, E);
  const dir: P = [-(A[1] - E[1]), A[0] - E[0]];
  const t1 = (c[1] - M[1]) / dir[1];
  const O1: P = [M[0] + dir[0] * t1, c[1]];
  const t2 = (c[0] - M[0]) / dir[0];
  const O2: P = [c[0], M[1] + dir[1] * t2];
  const O3: P = [2 * c[0] - O1[0], c[1]], O4: P = [c[0], 2 * c[1] - O2[1]];
  const R2 = dist(O2, C), R1 = dist(O1, A);
  const tp = (big: P, small: P, rb: number): P => {
    const d = dist(big, small);
    return lerp(big, small, rb / d);
  };
  const T1 = tp(O2, O1, R2), T2 = tp(O2, O3, R2), T3 = tp(O4, O3, R2), T4 = tp(O4, O1, R2);
  const A_ = (p: P) => `${f(p[0])} ${f(p[1])}`;
  const ell = `M ${A_(T1)} A ${f(R2)} ${f(R2)} 0 0 0 ${A_(T2)} A ${f(R1)} ${f(R1)} 0 0 0 ${A_(T3)} A ${f(R2)} ${f(R2)} 0 0 0 ${A_(T4)} A ${f(R1)} ${f(R1)} 0 0 0 ${A_(T1)} Z`;
  const paths = [ell];
  const detail = [seg([c[0] - a - 14, c[1]], [c[0] + a + 14, c[1]]), seg([c[0], O4[1] - 10], [c[0], O2[1] + 10]), seg(A, C), seg(lerp(M, add(M, dir), -0.4), O2), pl([T1, O2, T2]), pl([T3, O4, T4]), circle(O1[0], O1[1], 3), circle(O3[0], O3[1], 3), arcP(C, a - b, -40, 10)];
  return { id: 'ellipse-four-centre', name: 'Ellipse by the four-centre method', level: 'intermediate', sub: 'drafting', tags: ['ellipse', 'construction', 'compass', 'drafting'], paths, detail, nk: ['ellipse4'] };
}

function circleInter(c1: P, r1: number, c2: P, r2: number, upper: boolean): P {
  const d = dist(c1, c2);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const pm = lerp(c1, c2, a / d);
  const ux = (c2[0] - c1[0]) / d, uy = (c2[1] - c1[1]) / d;
  const p1: P = [pm[0] - uy * h, pm[1] + ux * h], p2: P = [pm[0] + uy * h, pm[1] - ux * h];
  return upper ? (p1[1] < p2[1] ? p1 : p2) : p1[1] < p2[1] ? p2 : p1;
}

function tangentArcs(): Spec {
  const C1: P = [110, 240], r1 = 50, C2: P = [290, 230], r2 = 35;
  const R = 110, R2 = 250;
  const O = circleInter(C1, R + r1, C2, R + r2, true);
  const t1 = lerp(O, C1, R / (R + r1)), t2 = lerp(O, C2, R / (R + r2));
  const Q = circleInter(C1, R2 - r1, C2, R2 - r2, true);
  const u1 = lerp(Q, C1, R2 / (R2 - r1)), u2 = lerp(Q, C2, R2 / (R2 - r2));
  const A_ = (p: P) => `${f(p[0])} ${f(p[1])}`;
  const paths = [circle(C1[0], C1[1], r1), circle(C2[0], C2[1], r2), `M ${A_(t1)} A ${R} ${R} 0 0 0 ${A_(t2)}`, `M ${A_(u1)} A ${R2} ${R2} 0 0 0 ${A_(u2)}`];
  const detail = [pl([C1, O, C2]), pl([u1, Q, u2]), circle(O[0], O[1], 3), circle(Q[0], Q[1], 3), circle(C1[0], C1[1], 3), circle(C2[0], C2[1], 3)];
  const d1 = dirOf(C1, O), d2 = dirOf(C2, O);
  detail.push(arcP(C1, R + r1, d1 - 10, d1 + 10), arcP(C2, R + r2, d2 - 10, d2 + 10));
  return { id: 'tangent-arcs-construction', name: 'Tangent arcs joining two circles', level: 'intermediate', sub: 'drafting', tags: ['tangent', 'arc', 'construction', 'drafting'], paths, detail, nk: ['tangent'] };
}

function titleBlock(): Spec {
  const paths = [rect(14, 14, 372, 372), rect(28, 28, 344, 344), rect(220, 300, 152, 72), seg([220, 324], [372, 324]), seg([220, 348], [372, 348]), seg([290, 300], [290, 372])];
  const detail: string[] = [];
  for (let i = 1; i < 4; i++) detail.push(seg([28 + (344 * i) / 4, 14], [28 + (344 * i) / 4, 28]), seg([28 + (344 * i) / 4, 372], [28 + (344 * i) / 4, 386]), seg([14, 28 + (344 * i) / 4], [28, 28 + (344 * i) / 4]), seg([372, 28 + (344 * i) / 4], [386, 28 + (344 * i) / 4]));
  detail.push(seg([200, 14], [200, 40]), seg([14, 200], [40, 200]), seg([200, 360], [200, 386]), seg([360, 200], [386, 200]));
  const nums: string[] = [];
  for (let i = 0; i < 4; i++) nums.push(txt(String(i + 1), 28 + (344 * (i + 0.5)) / 4, 21, 8));
  for (let i = 0; i < 4; i++) nums.push(txt('ABCD'[i]!, 21, 28 + (344 * (i + 0.5)) / 4, 8));
  paths.push(nums.join(' '));
  return { id: 'drawing-title-block-frame', name: 'Drawing frame with blank title block', level: 'beginner', sub: 'drafting', tags: ['title-block', 'frame', 'drawing-sheet', 'drafting'], paths, detail, nk: ['titleblock'] };
}

function dimensionStyles(): Spec {
  const paths = [rect(50, 70, 180, 70), circle(300, 105, 45)];
  const detail = [seg([50, 66], [50, 30]), seg([230, 66], [230, 30])];
  paths.push(dim([50, 42], [230, 42], 10));
  const rp = at(300, 105, 45, 40);
  paths.push(arrow([370, 40], rp, 10), txt('R', 378, 36, 12));
  const v: P = [70, 350];
  const ea = atP(v, 260, 0), eb = atP(v, 260, 40);
  paths.push(pl([ea, v, eb]));
  const aa = atP(v, 180, 0), ab = atP(v, 180, 40);
  paths.push(`${arcP(v, 180, 0, 40)} ${(() => {
    const h1 = atP(aa, 10, 90 + 25), h2 = atP(aa, 10, 90 - 25), g1 = atP(ab, 10, 40 - 90 + 25), g2 = atP(ab, 10, 40 - 90 - 25);
    return `M ${f(h1[0])} ${f(h1[1])} L ${f(aa[0])} ${f(aa[1])} L ${f(h2[0])} ${f(h2[1])} M ${f(g1[0])} ${f(g1[1])} L ${f(ab[0])} ${f(ab[1])} L ${f(g2[0])} ${f(g2[1])}`;
  })()}`);
  const lp = atP(v, 210, 20);
  paths.push(txt('40°', lp[0], lp[1], 15));
  detail.push(seg([300, 50], [300, 160]), seg([245, 105], [355, 105]));
  return { id: 'dimension-styles', name: 'Dimension line styles', level: 'beginner', sub: 'drafting', tags: ['dimension', 'arrows', 'drawing', 'drafting'], paths, detail, claims: [[40, v, ea, eb]], nk: ['dims'] };
}

// ================================================================================================= LAYOUT

function chordStar(n: number): Spec {
  const c: P = [200, 200], R = 156;
  const v: P[] = [];
  for (let i = 0; i < n; i++) v.push(atP(c, R, 90 + (360 / n) * i));
  const star: P[] = [];
  for (let i = 0; i <= n; i++) star.push(v[(i * 2) % n]!);
  const paths = [circle(200, 200, R), pl(v, true), pl(star)];
  const detail = [seg(c, v[0]!), seg(c, v[1]!), arcP(c, 40, 90, 90 + 360 / n), circle(200, 200, 3)];
  const nums: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = atP(c, R + 18, 90 + (360 / n) * i);
    nums.push(txt(String(i + 1), p[0], p[1], 9));
  }
  paths.push(nums.join(' '));
  const lp = atP(c, 70, 90 + 180 / n);
  paths.push(txt(dg(360 / n), lp[0], lp[1], 11));
  return {
    id: `circle-chords-${n}`,
    name: `Circle in ${n} equal chords`,
    level: n > 9 ? 'advanced' : 'intermediate',
    sub: 'layout',
    tags: ['circle', 'division', 'chords', 'layout'],
    paths,
    detail,
    claims: [[360 / n, c, v[0]!, v[1]!]],
    nk: ['chords', n],
  };
}

function findCentre(): Spec {
  const c: P = [200, 210], R = 150;
  const A = atP(c, R, 160), B = atP(c, R, 100), Cc = atP(c, R, 60), D = atP(c, R, -10);
  const M1 = mid(A, B), M2 = mid(Cc, D);
  const ext = (M: P, k: number): [P, P] => {
    const d = dirOf(M, c);
    return [atP(M, 30, d + 180), atP(M, dist(M, c) + k, d)];
  };
  const [p1, q1] = ext(M1, 40), [p2, q2] = ext(M2, 40);
  const paths = [circle(c[0], c[1], R), pl([A, M1, B]), pl([Cc, M2, D]), pl([p1, M1, q1]), pl([p2, M2, q2])];
  const detail = [rightMark(M1, dirOf(M1, B), dirOf(M1, q1), 14), rightMark(M2, dirOf(M2, D), dirOf(M2, q2), 14), seg([c[0] - 10, c[1]], [c[0] + 10, c[1]]), seg([c[0], c[1] - 10], [c[0], c[1] + 10])];
  for (const [P1, P2] of [[A, B], [Cc, D]] as const) {
    const rr = dist(P1, P2) * 0.62;
    for (const q of [P1, P2]) {
      const o = q === P1 ? P2 : P1;
      const d = dirOf(q, o);
      detail.push(arcP(q, rr, d - 50, d - 30), arcP(q, rr, d + 30, d + 50));
    }
  }
  return { id: 'find-circle-centre', name: "Finding a circle's centre", level: 'beginner', sub: 'layout', tags: ['circle', 'centre', 'construction', 'layout'], paths, detail, claims: [[90, M1, B, q1], [90, M2, D, q2]], nk: ['findcentre'] };
}

function goldenRect(): Spec {
  const phi = (1 + Math.sqrt(5)) / 2;
  const W = 340, H = W / phi, x0 = 30, y0 = 90;
  const paths = [rect(x0, y0, W, H)];
  const lines: string[] = [];
  let x = x0, y = y0, w = W, h = H;
  const arcs: string[] = [];
  for (let i = 0; i < 7; i++) {
    const s = Math.min(w, h);
    const k = i % 4;
    if (k === 0) { lines.push(seg([x + s, y], [x + s, y + h])); arcs.push(`M ${f(x)} ${f(y + s)} A ${f(s)} ${f(s)} 0 0 1 ${f(x + s)} ${f(y)}`); x += s; w -= s; }
    else if (k === 1) { lines.push(seg([x, y + s], [x + w, y + s])); arcs.push(`M ${f(x)} ${f(y)} A ${f(s)} ${f(s)} 0 0 1 ${f(x + s)} ${f(y + s)}`); y += s; h -= s; }
    else if (k === 2) { lines.push(seg([x + w - s, y], [x + w - s, y + h])); arcs.push(`M ${f(x + w)} ${f(y)} A ${f(s)} ${f(s)} 0 0 1 ${f(x + w - s)} ${f(y + s)}`); w -= s; }
    else { lines.push(seg([x, y + h - s], [x + w, y + h - s])); arcs.push(`M ${f(x + w)} ${f(y + h)} A ${f(s)} ${f(s)} 0 0 1 ${f(x)} ${f(y + h - s)}`); h -= s; }
  }
  paths.push(lines.join(' '), arcs.join(' '));
  paths.push(txt(`1:${fix(phi, 3)}`, 200, 340, 18));
  return { id: 'golden-ratio-rectangle', name: 'Golden-ratio rectangle', level: 'intermediate', sub: 'layout', tags: ['golden-ratio', 'rectangle', 'proportion', 'layout'], paths, detail: [], nk: ['golden'] };
}

function ladder(n: number): Spec {
  const xa = 70, xb = 330, y0 = 350, ang = 40;
  const L = (xb - xa) / Math.cos(ang * RAD);
  const e = atP([xa, y0], L, ang);
  const nn = at(0, 0, 14, ang + 90);
  const paths = [seg([xa, 24], [xa, 376]), seg([xb, 24], [xb, 376]), pl([[xa, y0], e, add(e, nn), add([xa, y0], nn)], true)];
  const marks: string[] = [], vert: string[] = [], nums: string[] = [];
  for (let i = 1; i < n; i++) {
    const p = lerp([xa, y0], e, i / n);
    marks.push(seg(p, add(p, nn)));
    vert.push(seg([p[0], 30], [p[0], 370]));
    nums.push(txt(String(i), p[0] + nn[0] * 2, p[1] + nn[1] * 2, 9));
  }
  paths.push(marks.join(' '), nums.join(' '), txt('0', xa - 2 + nn[0] * 2, y0 + nn[1] * 2, 9), txt(String(n), e[0] + nn[0] * 2, e[1] + nn[1] * 2, 9));
  return { id: `equal-spacing-ladder-${n}`, name: `Equal spacing by diagonal rule, ${n} parts`, level: 'beginner', sub: 'layout', tags: ['spacing', 'division', 'rule', 'layout'], paths, detail: [vert.join(' ')], nk: ['ladder', n] };
}

function perpBisector(): Spec {
  const A: P = [60, 220], B: P = [340, 220], r = 180;
  const M = mid(A, B);
  const h = Math.sqrt(r * r - 140 * 140);
  const P1: P = [200, 220 - h], Q: P = [200, 220 + h];
  const top: P = [200, 220 - h - 40], bot: P = [200, 220 + h + 40];
  const paths = [pl([A, M, B]), pl([top, M, bot]), circle(A[0], A[1], 4), circle(B[0], B[1], 4)];
  const detail = [rightMark(M, 0, 90, 18)];
  for (const [c, s] of [[A, 1], [B, -1]] as const) {
    const d1 = dirOf(c, P1), d2 = dirOf(c, Q);
    detail.push(arcP(c, r, d1 - 10, d1 + 10), arcP(c, r, d2 - 10, d2 + 10));
    void s;
  }
  paths.push(txt('90°', 236, 196, 14));
  return { id: 'perpendicular-bisector', name: 'Perpendicular bisector construction', level: 'beginner', sub: 'layout', tags: ['bisector', 'perpendicular', 'construction', 'layout'], paths, detail, claims: [[90, M, B, top]], nk: ['perp'] };
}

function arcThree(): Spec {
  const O: P = [200, 360], R = 230;
  const P1 = atP(O, R, 135), P2 = atP(O, R, 90), P3 = atP(O, R, 45);
  const M1 = mid(P1, P2), M2 = mid(P2, P3);
  const paths = [arcP(O, R, 45, 135), pl([P1, M1, P2, M2, P3]), pl([atP(M1, 30, 112.5), M1, O]), pl([atP(M2, 30, 67.5), M2, O])];
  const pts = [P1, P2, P3].map((p) => circle(p[0], p[1], 5)).join(' ');
  paths.push(pts);
  const detail = [rightMark(M1, dirOf(M1, P2), 112.5, 12), rightMark(M2, dirOf(M2, P3), 67.5, 12), seg([O[0] - 10, O[1]], [O[0] + 10, O[1]]), seg([O[0], O[1] - 10], [O[0], O[1] + 4])];
  return { id: 'arc-through-three-points', name: 'Arc through three points', level: 'intermediate', sub: 'layout', tags: ['arc', 'three-points', 'construction', 'layout'], paths, detail, claims: [[90, M1, P2, O], [90, M2, P3, O]], nk: ['arc3'] };
}

function divideLine(n: number): Spec {
  const A: P = [50, 300], B: P = [350, 300], ang = 35, L = 320;
  const E = atP(A, L, ang);
  const paths = [seg(A, B), seg(A, E), seg(lerp(A, E, 1), B)];
  const tk: string[] = [], par: string[] = [], nums: string[] = [];
  for (let i = 1; i <= n; i++) {
    const p = lerp(A, E, i / n);
    tk.push(seg(atP(p, 7, ang + 90), atP(p, 7, ang - 90)));
    nums.push(txt(String(i), atP(p, 18, ang + 90)[0], atP(p, 18, ang + 90)[1], 9));
    if (i < n) {
      const q = lerp(A, B, i / n);
      par.push(seg(p, q));
      tk.push(seg([q[0], 292], [q[0], 308]));
    }
  }
  paths.push(tk.join(' '), nums.join(' '), txt('A', 40, 320, 11), txt('B', 360, 320, 11));
  return { id: `divide-line-${n}-parts`, name: `Divide a line into ${n} equal parts`, level: 'intermediate', sub: 'layout', tags: ['division', 'parallel', 'construction', 'layout'], paths, detail: [par.join(' ')], nk: ['divide', n] };
}

function hexCompass(): Spec {
  const c: P = [200, 200], R = 150;
  const v: P[] = [];
  for (let k = 0; k < 6; k++) v.push(atP(c, R, 90 + 60 * k));
  const paths = [circle(200, 200, R), pl(v, true)];
  const petals: string[] = [];
  for (let k = 0; k < 6; k++) petals.push(arcP(v[k]!, R, 90 + 60 * k + 120, 90 + 60 * k + 240));
  paths.push(txt('120°', v[3]![0], v[3]![1] - 46, 11));
  return { id: 'hexagon-by-compass', name: 'Hexagon by compass (radius stepped six times)', level: 'beginner', sub: 'layout', tags: ['hexagon', 'compass', 'construction', 'layout'], paths, detail: [petals.join(' '), circle(200, 200, 3)], claims: [[120, v[3]!, v[2]!, v[4]!]], nk: ['hexcompass'] };
}

function pentagonCon(): Spec {
  const O: P = [200, 210], R = 150;
  const T: P = [200, 60], Mx: P = [275, 210];
  const rr = dist(Mx, T);
  const N: P = [Mx[0] - rr, 210];
  const side = dist(T, N);
  const v: P[] = [];
  for (let k = 0; k < 5; k++) v.push(atP(O, R, 90 + 72 * k));
  const paths = [circle(O[0], O[1], R), pl(v, true)];
  const detail = [seg([40, 210], [360, 210]), seg([200, 50], [200, 370]), arcP(Mx, rr, 90 + 30, 180), seg(T, N), circle(Mx[0], Mx[1], 3), circle(N[0], N[1], 3), arcP(T, side, 200, 250)];
  paths.push(txt('108°', 200, 112, 12));
  return { id: 'pentagon-construction', name: 'Pentagon construction in a circle', level: 'intermediate', sub: 'layout', tags: ['pentagon', 'compass', 'construction', 'layout'], paths, detail, claims: [[108, v[0]!, v[4]!, v[1]!]], nk: ['pentacon'] };
}

function octagonFromSquare(): Spec {
  const x0 = 60, x1 = 340, s = x1 - x0, hd = (s * Math.SQRT2) / 2;
  const k = hd; // distance from each corner along the sides
  const pts: P[] = [[x0 + (s - k), x0], [x1 - (s - k), x0], [x1, x0 + (s - k)], [x1, x1 - (s - k)], [x1 - (s - k), x1], [x0 + (s - k), x1], [x0, x1 - (s - k)], [x0, x0 + (s - k)]];
  const paths = [rect(x0, x0, s, s), pl(pts, true)];
  const detail = [seg([x0, x0], [x1, x1]), seg([x1, x0], [x0, x1])];
  for (const [cx, cy, a0] of [[x0, x0, 270], [x1, x0, 180], [x1, x1, 90], [x0, x1, 0]] as const) detail.push(arc(cx, cy, hd, a0, a0 + 90));
  paths.push(txt('135°', 200, x0 + 26, 12));
  return { id: 'octagon-from-square', name: 'Octagon from a square (corner arcs)', level: 'intermediate', sub: 'layout', tags: ['octagon', 'square', 'construction', 'layout'], paths, detail, claims: [[135, pts[0]!, pts[7]!, pts[1]!]], nk: ['octsquare'] };
}

function cornerRadii(): Spec {
  const cx = 50, cy = 350;
  const paths = [pl([[cx, 30], [cx, cy], [370, cy]])];
  const arcs: string[] = [], nums: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const r = 46 * i;
    arcs.push(`M ${cx} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx + r)} ${cy}`);
    const p = at(cx + r, cy - r, r, 225);
    nums.push(txt(String(i), p[0] + 10, p[1] - 10, 10));
  }
  paths.push(arcs.join(' '), nums.join(' '));
  return { id: 'corner-radius-set', name: 'Corner fillet radius set', level: 'beginner', sub: 'layout', tags: ['radius', 'fillet', 'corner', 'layout'], paths, nk: ['radii'] };
}

function stringEllipse(): Spec {
  const c: P = [200, 200], a = 160, b = 100;
  const fc = Math.sqrt(a * a - b * b);
  const F1: P = [c[0] - fc, 200], F2: P = [c[0] + fc, 200];
  const Pp = at(c[0], c[1], 0, 0);
  void Pp;
  const t = 62 * RAD;
  const P0: P = [c[0] + a * Math.cos(t), c[1] - b * Math.sin(t)];
  const paths = [`M ${c[0] - a} 200 A ${a} ${b} 0 1 0 ${c[0] + a} 200 A ${a} ${b} 0 1 0 ${c[0] - a} 200 Z`, pl([F1, P0, F2]), circle(F1[0], F1[1], 6), circle(F2[0], F2[1], 6), circle(P0[0], P0[1], 4)];
  const detail = [seg([20, 200], [380, 200]), seg([200, 80], [200, 320]), arcP([200, 100], a, 180 + Math.atan(b / fc) / RAD - 8, 180 + Math.atan(b / fc) / RAD + 8), arcP([200, 100], a, -Math.atan(b / fc) / RAD - 8, -Math.atan(b / fc) / RAD + 8), pl([F1, [200, 100], F2])];
  return { id: 'ellipse-string-method', name: 'Ellipse by pins and string', level: 'intermediate', sub: 'layout', tags: ['ellipse', 'string', 'set-out', 'layout'], paths, detail, nk: ['stringellipse'] };
}

const PART3: Spec[] = [
  subway(0.5, false),
  subway(1 / 3, false),
  subway(0.5, true),
  herring(45, false),
  herring(0, false),
  herring(45, true),
  basketweave(),
  hexTiles(),
  chevronTiles(),
  versailles(),
  diagonalSetOut(),
  tileCut(45),
  tileCut(22.5),
  pinwheel(),
  isoBox(),
  isoCylinder(),
  orthoThree(),
  projectionSymbol(true),
  projectionSymbol(false),
  sectionHatch(),
  hatchSamples(),
  hexNut(),
  boltThread(),
  spurGear(12),
  spurGear(20),
  cam(),
  ellipseFourCentre(),
  tangentArcs(),
  titleBlock(),
  dimensionStyles(),
  chordStar(7),
  chordStar(9),
  chordStar(11),
  findCentre(),
  goldenRect(),
  ladder(5),
  ladder(7),
  perpBisector(),
  arcThree(),
  divideLine(6),
  hexCompass(),
  pentagonCon(),
  octagonFromSquare(),
  cornerRadii(),
  stringEllipse(),
];

// constructions that take the most steps to use are filed as advanced (level mix ~40 / 35 / 25)
const ADVANCED = new Set([
  'cone-pattern-60', 'cone-pattern-90', 'cone-pattern-40', 'lobster-back-3-piece', 'flange-12-hole', 'pipe-saddle-1-1-90', 'pipe-lateral-45',
  'conduit-saddle-3-point-45', 'conduit-saddle-3-point-60', 'ellipse-four-centre', 'tangent-arcs-construction', 'ortho-three-view',
  'iso-cylinder-four-centre', 'hex-nut-across-flats', 'tile-herringbone-45', 'pentagon-construction',
]);
export const TRADE2_SPECS: Spec[] = [...PART1, ...PART2, ...PART3].map((s) => (ADVANCED.has(s.id) ? { ...s, level: 'advanced' as const } : s));

function make(s: Spec): Template {
  const tags = [...new Set(['trade', 'workshop', `sub-${s.sub}`, ...s.tags])];
  const detail = (s.detail ?? []).filter((d) => d.length > 0);
  return {
    id: `trade-${s.id}`,
    name: s.name,
    category: 'trade',
    level: s.level,
    tags,
    viewBox: VB,
    strokeWidth: 3,
    detailWidth: 1.6,
    paths: s.paths.filter((d) => d.length > 0),
    ...(detail.length ? { detail } : {}),
  };
}

export const trade2: Template[] = TRADE2_SPECS.map(make);

/** Labelled angles that must be exact in the shipped path data (paths or detail): vertex v, ray ends a and b. */
export function trade2Claims(): { id: string; deg: number; v: P; a: P; b: P }[] {
  return TRADE2_SPECS.flatMap((s) => (s.claims ?? []).map(([deg, v, a, b]) => ({ id: `trade-${s.id}`, deg, v, a, b })));
}

/** Name pattern keys for the 10-locale name pack (scripts only). */
export function trade2NameKeys(): Record<string, (string | number)[]> {
  return Object.fromEntries(TRADE2_SPECS.map((s) => [`trade-${s.id}`, s.nk]));
}
