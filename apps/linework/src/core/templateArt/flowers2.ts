// Flowers & botanicals batch 2 (fb-1023 flowers2, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Roses, garden and wild flowers, tropical leaves, herbs, succulents, wreaths and borders of our own design, built
// from petal and leaf primitives whose overlaps are hidden with occlude.ts so each piece reads as one clean drawing.
// Beginner pieces are bold outlines; intermediate ones add midribs and inner lines; advanced ones add veins, creases,
// stamens and bark lines. No birds or insects here (those live in Birds & insects).
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, petal, polar, rotate, rrect, spiral, type P } from './draw.ts';
import { clip, outline, region, roundPoly, samplePath, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

type Art = { p: string[]; d: string[] };

// ---- geometry helpers -----------------------------------------------------------------------------------------

/** Smooth closed (or open) curve through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: readonly P[], closed = true): string {
  const n = pts.length;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** Points along a Catmull-Rom curve through pts (per = samples per segment). */
function curvePts(pts: readonly P[], per = 5): P[] {
  const n = pts.length;
  const at = (i: number): P => pts[Math.max(0, Math.min(n - 1, i))];
  const out: P[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, c2: number, d: number) =>
        0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** Unit tangent of a sampled curve at index i. */
function tangent(c: readonly P[], i: number): P {
  const a = c[Math.max(0, i - 1)];
  const b = c[Math.min(c.length - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}

/** Closed tube (stem, twig, branch) along a curve, full width w0 at the start tapering to w1, round ends. */
function tube(pts: readonly P[], w0: number, w1: number): string {
  const c = curvePts(pts, 4);
  const n = c.length;
  const L: P[] = [];
  const R: P[] = [];
  for (let i = 0; i < n; i++) {
    const [tx, ty] = tangent(c, i);
    const hw = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    L.push([c[i][0] - ty * hw, c[i][1] + tx * hw]);
    R.push([c[i][0] + ty * hw, c[i][1] - tx * hw]);
  }
  const [sx, sy] = tangent(c, 0);
  const [ex, ey] = tangent(c, n - 1);
  const start: P = [c[0][0] - sx * w0 * 0.48, c[0][1] - sy * w0 * 0.48];
  const end: P = [c[n - 1][0] + ex * w1 * 0.48, c[n - 1][1] + ey * w1 * 0.48];
  return smooth([start, ...L, end, ...R.reverse()]);
}

/** Point and unit tangent at fraction t (0..1) along a curve through pts. */
function along(pts: readonly P[], t: number): { p: P; tan: P; deg: number } {
  const c = curvePts(pts, 8);
  const i = Math.max(0, Math.min(c.length - 1, Math.round(t * (c.length - 1))));
  const tan = tangent(c, i);
  return { p: c[i], tan, deg: (Math.atan2(tan[0], -tan[1]) * 180) / Math.PI };
}

/** Local frame at (bx, by) pointing at deg (0° = up, clockwise): (a = along, s = across) → canvas point. */
function frame(bx: number, by: number, deg: number): (a: number, s: number) => P {
  const r = (deg * Math.PI) / 180;
  const u: P = [Math.sin(r), -Math.cos(r)];
  const n: P = [Math.cos(r), Math.sin(r)];
  return (a, s) => [bx + u[0] * a + n[0] * s, by + u[1] * a + n[1] * s];
}

/** Smooth closed shape from local [along, across] points placed in a frame. */
function shapeAt(local: readonly P[], bx: number, by: number, deg: number): string {
  const m = frame(bx, by, deg);
  return smooth(local.map(([a, s]) => m(a, s)));
}

/** Rounded petal (wide, blunt tip) of length len and half-width w. */
function roundPetal(bx: number, by: number, deg: number, len: number, w: number): string {
  return shapeAt([[0, 0], [len * 0.3, w * 0.75], [len * 0.68, w], [len * 0.94, w * 0.55], [len, 0], [len * 0.94, -w * 0.55], [len * 0.68, -w], [len * 0.3, -w * 0.75]], bx, by, deg);
}

/** Petal with a notched tip (cherry blossom, cosmos when teeth = 3). */
function notchPetal(bx: number, by: number, deg: number, len: number, w: number, teeth = 2): string {
  const tip: P[] =
    teeth === 2
      ? [[len, w * 0.42], [len * 0.88, 0], [len, -w * 0.42]]
      : [[len, w * 0.55], [len * 0.93, w * 0.28], [len, 0], [len * 0.93, -w * 0.28], [len, -w * 0.55]];
  return shapeAt([[0, 0], [len * 0.35, w * 0.6], [len * 0.75, w], ...tip, [len * 0.75, -w], [len * 0.35, -w * 0.6]], bx, by, deg);
}

/** Line from a curve's local points (open). */
function lineAt(local: readonly P[], bx: number, by: number, deg: number): string {
  const m = frame(bx, by, deg);
  return smooth(local.map(([a, s]) => m(a, s)), false);
}

/** Midrib of a leaf/petal from the base to 85% of its length, slightly bent. */
function rib(bx: number, by: number, deg: number, len: number, bend = 0): string {
  return lineAt([[len * 0.08, 0], [len * 0.45, bend], [len * 0.85, 0]], bx, by, deg);
}

/** Side veins of a pointed leaf (pairs angled to the tip), as one path string. */
function veins(bx: number, by: number, deg: number, len: number, w: number, n: number): string {
  const m = frame(bx, by, deg);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const t = 0.12 + (0.7 * i) / (n + 1);
    const prof = Math.sin(Math.PI * Math.min(0.95, t + 0.12));
    for (const side of [1, -1]) {
      const a = m(len * t, 0);
      const c = m(len * (t + 0.08), side * w * 0.45 * prof);
      const b = m(len * (t + 0.15), side * w * 0.85 * prof);
      out.push(`M ${f(a[0])} ${f(a[1])} Q ${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`);
    }
  }
  return out.join(' ');
}

/** Points of a closed path (first subpath), sampled every `step` units. */
const ptsOf = (d: string, step: number): P[] => samplePath(d, step)[0].pts;

function centroid(pts: readonly P[]): P {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

/** Redraw a closed shape with a wavy (ruffled) edge: waves of amplitude amp, about `step` units apart. */
function ruffle(d: string, amp: number, step: number, phase = 0): string {
  const pts = ptsOf(d, step / 3).slice(0, -1);
  const [cx, cy] = centroid(pts);
  const n = pts.length;
  const waves = Math.max(3, Math.round(n / 3));
  const out = pts.map(([x, y], i): P => {
    const l = Math.hypot(x - cx, y - cy) || 1;
    const k = amp * Math.sin((2 * Math.PI * waves * i) / n + phase);
    return [x + ((x - cx) / l) * k, y + ((y - cy) / l) * k];
  });
  return smooth(out);
}

/** Redraw a closed shape with a serrated (saw-tooth) edge, teeth `step` apart, pointing outward. */
function serrate(d: string, amp: number, step: number): string {
  const pts = ptsOf(d, step / 2).slice(0, -1);
  const [cx, cy] = centroid(pts);
  let out = '';
  pts.forEach(([x, y], i) => {
    const l = Math.hypot(x - cx, y - cy) || 1;
    const k = i % 2 === 0 ? 0 : amp;
    const q: P = [x + ((x - cx) / l) * k, y + ((y - cy) / l) * k];
    out += `${i === 0 ? 'M' : ' L'} ${f(q[0])} ${f(q[1])}`;
  });
  return `${out} Z`;
}

/** Group short strokes into a few path strings. */
function chunk(strokes: readonly string[], groups: number): string[] {
  const out: string[] = [];
  const size = Math.ceil(strokes.length / groups) || 1;
  for (let i = 0; i < strokes.length; i += size) out.push(strokes.slice(i, i + size).join(' '));
  return out;
}

/** Deterministic pseudo-random in [0, 1). */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A layered item: a closed silhouette (hides what is behind it) and its own lines. */
type Item = { sil: Layer; p?: string[]; d?: string[] };
const NONE = '';

/** Draw items front to back: each item's outline and lines are clipped by every item in front of it. */
function layered(items: readonly Item[]): Art {
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (regs.length ? clip(s, regs) : s);
  for (const it of items) {
    for (const s of [it.sil === NONE ? '' : outline(it.sil), ...(it.p ?? [])]) {
      const c = s ? cut(s) : '';
      if (c) p.push(c);
    }
    for (const s of it.d ?? []) {
      const c = s ? cut(s) : '';
      if (c) d.push(c);
    }
    if (it.sil !== NONE) regs.push(region(it.sil));
  }
  return { p, d };
}

/** Keep only the part of lines inside shape. */
const inside = (lines: string, shape: Layer): string => clip(lines, [region(shape)], 'inside');

/** Wavy horizontal line from x0 to x1 at y (water ripples, ground). */
function waves(x0: number, x1: number, y: number, step: number, amp: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  for (let x = x0, k = 0; x < x1 - 1; x += step, k++) d += ` Q ${f(x + step / 2)} ${f(y + (k % 2 ? amp : -amp))} ${f(x + step)} ${f(y)}`;
  return d;
}

const dot = (x: number, y: number, r = 4): string => circle(x, y, r);

/** Rotated ellipse. */
const E = (cx: number, cy: number, rx: number, ry: number, deg = 0): string =>
  deg ? rotate(ellipse(cx, cy, rx, ry), deg, cx, cy) : ellipse(cx, cy, rx, ry);

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `flora-${id}`,
    name,
    category: 'flowers',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- reusable flower parts --------------------------------------------------------------------------------------

/** Five-petal blossom (cherry, apple, wild rose) as a merged petal layer plus a centre. */
function blossom(cx: number, cy: number, r: number, rot = 0, notch = true): { petals: string[]; centre: string; stamens: string } {
  const petals = [0, 72, 144, 216, 288].map((a) => (notch ? notchPetal(cx, cy, a + rot, r, r * 0.46) : roundPetal(cx, cy, a + rot, r, r * 0.5)));
  const st: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + 18 + i * 36;
    const e = polar(cx, cy, r * (0.42 + 0.08 * (i % 2)), a);
    const s = polar(cx, cy, r * 0.16, a);
    st.push(`M ${f(s[0])} ${f(s[1])} L ${f(e[0])} ${f(e[1])}`, circle(e[0], e[1], Math.max(1.6, r * 0.045)));
  }
  return { petals, centre: circle(cx, cy, r * 0.16), stamens: st.join(' ') };
}

/** Daisy head: n slim petals around a centre. */
function daisyHead(cx: number, cy: number, r: number, n = 12, rot = 0): { petals: string[]; centre: string } {
  const petals: string[] = [];
  for (let i = 0; i < n; i++) petals.push(roundPetal(cx, cy, rot + (360 * i) / n, r, (Math.PI * r) / n * 0.62));
  return { petals, centre: circle(cx, cy, r * 0.3) };
}

/** Spiral rose head seen from above: rings of cupped petals and a curled centre. Returns items front to back. */
function roseHead(cx: number, cy: number, r: number, rot = 0): Item[] {
  const items: Item[] = [{ sil: circle(cx, cy, r * 0.22), p: [spiral(cx - r * 0.04, cy, r * 0.05, 4)] }];
  const rings: [number, number, number, number][] = [
    [3, 0.4, 0.3, 20],
    [4, 0.66, 0.42, 65],
    [5, 1, 0.55, 10],
  ];
  for (const [n, len, w, off] of rings)
    for (let i = 0; i < n; i++) items.push({ sil: roundPetal(cx, cy, rot + off + (360 * i) / n, r * len, r * w) });
  return items;
}

/** Tulip head on a stem top at (x, y): front petal over two side petals. */
function tulipHead(x: number, y: number, s: number, tilt = 0): Item[] {
  return [
    { sil: petal(x, y, tilt, 66 * s, 20 * s, 0.55) },
    { sil: [petal(x - 4 * s, y, tilt - 16, 62 * s, 19 * s, 0.6), petal(x + 4 * s, y, tilt + 16, 62 * s, 19 * s, 0.6)] },
  ];
}

/** Ivy-style lobed leaf (five points) from base (bx, by) pointing at deg, size s. */
function lobedLeaf(bx: number, by: number, deg: number, s: number): string {
  const spec: [number, number][] = [[0, 1], [32, 0.6], [62, 0.86], [94, 0.6], [124, 0.74], [158, 0.42], [180, 0.2]];
  const all = [...spec, ...spec.slice(1, -1).reverse().map(([a, r]): [number, number] => [360 - a, r])];
  const c: P = polar(bx, by, s * 0.45, deg);
  return smooth(all.map(([a, r]) => polar(c[0], c[1], r * s * 0.6, deg + a)));
}

/** Small serrated leaf (rose, mint). */
function toothLeaf(bx: number, by: number, deg: number, len: number, w: number, teeth = 7): string {
  return serrate(petal(bx, by, deg, len, w, 0.45), w * 0.18, Math.max(6, (len * 2.2) / (teeth * 2)));
}

// ---- beginner ---------------------------------------------------------------------------------------------------

function roseBudArt(): Art {
  const core = smooth([[200, 70], [222, 102], [232, 140], [222, 172], [200, 182], [178, 172], [168, 140], [178, 102]]);
  const wrap = smooth([[158, 122], [180, 138], [202, 142], [224, 134], [244, 118], [240, 158], [222, 186], [200, 196], [178, 186], [162, 158]]);
  const sepals = [petal(200, 192, 205, 52, 9, 0.4), petal(200, 192, 155, 52, 9, 0.4), petal(198, 190, 245, 46, 8, 0.4)];
  const stemLine: P[] = [[200, 192], [204, 260], [196, 320], [200, 372]];
  return layered([
    { sil: sepals },
    { sil: wrap, d: ['M 182 150 Q 200 166 220 150'] },
    { sil: core, p: ['M 178 104 Q 200 112 206 146'], d: ['M 190 88 Q 202 80 214 96', 'M 222 110 Q 214 124 216 140'] },
    { sil: petal(202, 280, -62, 70, 20, 0.5), d: [rib(202, 280, -62, 70, -3)] },
    { sil: petal(198, 316, 58, 64, 18, 0.5), d: [rib(198, 316, 58, 64, 3)] },
    { sil: tube(stemLine, 9, 8), p: ['M 204 236 L 214 228 L 205 232', 'M 197 344 L 187 337 L 196 340'] },
  ]);
}

function blossomSingleArt(): Art {
  const b = blossom(200, 196, 128, 0);
  return layered([
    { sil: b.centre, d: [circle(200, 196, 8)] },
    { sil: NONE, p: [b.stamens] },
    { sil: b.petals, d: [0, 72, 144, 216, 288].map((a) => lineAt([[72, 0], [100, 0]], 200, 196, a)) },
    { sil: petal(260, 300, 140, 70, 22, 0.5), d: [rib(260, 300, 140, 70)] },
    { sil: petal(140, 300, 220, 70, 22, 0.5), d: [rib(140, 300, 220, 70)] },
  ]);
}

function cosmosArt(): Art {
  const cx = 200;
  const cy = 156;
  const petals = Array.from({ length: 8 }, (_, i) => notchPetal(cx, cy, i * 45 + 10, 108, 34, 3));
  const grooves = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 + 10;
    return [lineAt([[34, -8], [70, -10], [92, -8]], cx, cy, a), lineAt([[34, 8], [70, 10], [92, 8]], cx, cy, a)].join(' ');
  });
  const stem: P[] = [[200, 180], [206, 260], [196, 320], [204, 376]];
  const budStem: P[] = [[203, 300], [240, 270], [270, 240], [284, 212]];
  return layered([
    { sil: circle(cx, cy, 28), d: [circle(cx, cy, 13)] },
    { sil: petals, d: grooves },
    { sil: E(288, 200, 14, 18, 25), d: ['M 280 190 Q 288 200 286 214', 'M 292 186 Q 296 198 294 212'] },
    { sil: [petal(286, 216, 200, 22, 6), petal(286, 216, 150, 22, 6)] },
    { sil: [tube(stem, 8, 7), tube(budStem, 6, 5)] },
    { sil: [petal(199, 334, -70, 76, 8, 0.45), petal(201, 350, 66, 70, 8, 0.45)] },
  ]);
}

function poppyArt(): Art {
  const cx = 186;
  const cy = 150;
  const pet = (a: number, l: number, w: number) => ruffle(roundPetal(cx, cy, a, l, w), 2.2, 22, a);
  const pod = circle(cx, cy, 20);
  const cap = [0, 45, 90, 135].map((a) => {
    const p1 = polar(cx, cy, 16, a);
    const p2 = polar(cx, cy, 16, a + 180);
    return `M ${f(p1[0])} ${f(p1[1])} L ${f(p2[0])} ${f(p2[1])}`;
  });
  const ring: string[] = [];
  for (let i = 0; i < 16; i++) {
    const [x, y] = polar(cx, cy, 32, i * 22.5);
    ring.push(circle(x, y, 2.5));
  }
  const budStem: P[] = [[230, 380], [270, 300], [300, 240], [312, 214]];
  return layered([
    { sil: pod, d: cap },
    { sil: NONE, p: [ring.join(' ')] },
    { sil: pet(135, 112, 66) },
    { sil: pet(315, 112, 66) },
    { sil: pet(45, 118, 70) },
    { sil: pet(225, 118, 70) },
    { sil: E(320, 192, 16, 26, 160), d: ['M 316 170 Q 324 192 320 214'] },
    { sil: [tube([[186, 250], [190, 320], [184, 370]], 8, 8), tube(budStem, 6, 6)] },
  ]);
}

/** Leaf outline with straight-sided slits cut in from the edge (monstera). */
function slitLeaf(leaf: string, slits: readonly string[]): string[] {
  const holes = slits.map((s) => region(s));
  return [clip(leaf, holes), ...slits.map((s) => inside(s, leaf))];
}

function monsteraArt(): Art {
  const leaf0 = smooth([[200, 36], [258, 56], [304, 106], [322, 172], [314, 240], [286, 292], [244, 322], [214, 312], [200, 268], [186, 312], [156, 322], [114, 292], [86, 240], [78, 172], [96, 106], [142, 56]]);
  const slits0: string[] = [];
  const ys = [96, 146, 198, 248];
  for (const [i, y] of ys.entries()) {
    const a = 70 + i * 16;
    slits0.push(petal(216, y + 24, a, 150, 9, 0.62), petal(184, y + 24, -a, 150, 9, 0.62));
  }
  const holes0 = [E(232, 150, 7, 14, 20), E(168, 200, 7, 14, -20), E(236, 238, 6, 12, 30)];
  const r = (d: string) => rotate(d, -14, 200, 268);
  const leaf = r(leaf0);
  const [outer, ...cuts] = slitLeaf(leaf, slits0.map(r));
  return layered([
    { sil: leaf, p: [outer, ...cuts, ...holes0.map(r)], d: [r('M 200 270 Q 204 170 200 50')] },
    { sil: tube([[200, 268], [204, 320], [196, 370]], 10, 8) },
  ]);
}

function palmFrondArt(): Art {
  const rach: P[] = [[96, 372], [140, 290], [200, 200], [270, 128], [330, 92]];
  const leaflets: string[] = [];
  for (let i = 0; i < 15; i++) {
    const t = 0.16 + i * 0.056;
    const { p, deg } = along(rach, t);
    const len = 112 - i * 5.4;
    for (const side of [1, -1]) leaflets.push(petal(p[0], p[1], deg + side * (58 - i * 1.2), len, 7 - i * 0.2, 0.42));
  }
  return layered([{ sil: [tube(rach, 9, 4), ...leaflets] }]);
}

function cactusArt(): Art {
  const body = rrect(172, 96, 56, 200, 28);
  const armL = tube([[176, 220], [132, 216], [118, 190], [118, 148]], 34, 30);
  const armR = tube([[224, 196], [266, 192], [280, 170], [280, 126]], 32, 28);
  const pot = roundPoly([[120, 296], [280, 296], [264, 380], [136, 370]], 8);
  const rim = rrect(110, 278, 180, 30, 8);
  const flower = [0, 72, 144, 216, 288].map((a) => roundPetal(200, 96, a, 22, 10));
  const spines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const y = 120 + i * 24;
    spines.push(`M 186 ${y} L 180 ${y - 5} M 214 ${y + 12} L 220 ${y + 7}`);
  }
  return layered([
    { sil: flower, p: [circle(200, 96, 5)] },
    { sil: rim },
    { sil: pot },
    { sil: body, d: ['M 200 120 L 200 270', ...spines] },
    { sil: [armL, armR], d: ['M 118 160 L 118 196', 'M 280 140 L 280 176'] },
  ]);
}

function oliveArt(): Art {
  const br: P[] = [[78, 336], [140, 270], [212, 196], [282, 128], [330, 86]];
  const items: Item[] = [];
  const olives: Item[] = [
    { sil: E(176, 262, 13, 18, 30), d: ['M 172 250 Q 168 256 170 262'] },
    { sil: E(250, 196, 12, 17, -20) },
    { sil: E(270, 212, 12, 17, 20) },
  ];
  const leaves: string[] = [];
  const ribs: string[] = [];
  for (let i = 0; i < 10; i++) {
    const t = 0.1 + i * 0.09;
    const { p, deg } = along(br, t);
    const side = i % 2 === 0 ? 1 : -1;
    const a = deg + side * 48;
    leaves.push(petal(p[0], p[1], a, 66 - i * 2, 10, 0.45));
    ribs.push(rib(p[0], p[1], a, 66 - i * 2));
  }
  items.push(...olives, { sil: leaves, d: ribs }, { sil: tube(br, 7, 4) });
  return layered(items);
}

function mintArt(): Art {
  const stem: P[] = [[200, 378], [202, 290], [198, 200], [200, 118]];
  const items: Item[] = [{ sil: [toothLeaf(200, 112, -14, 44, 15, 5), toothLeaf(200, 112, 18, 40, 14, 5)] }];
  const pairs: [number, number, number, number][] = [
    [140, 60, 22, 58],
    [208, 80, 28, 70],
    [282, 94, 32, 78],
  ];
  for (const [y, len, w, a] of pairs) {
    items.push(
      { sil: toothLeaf(200, y, -a, len, w, 7), d: [rib(200, y, -a, len, -2)] },
      { sil: toothLeaf(200, y + 4, a, len, w, 7), d: [rib(200, y + 4, a, len, 2)] },
    );
  }
  items.push({ sil: tube(stem, 8, 6) });
  return layered(items);
}

function basilArt(): Art {
  const pot = roundPoly([[130, 290], [270, 290], [256, 378], [144, 370]], 10);
  const rim = rrect(120, 270, 160, 28, 8);
  const items: Item[] = [{ sil: rim }, { sil: pot }];
  const stems: P[][] = [
    [[200, 276], [198, 200], [200, 104]],
    [[176, 276], [160, 220], [134, 170]],
    [[224, 276], [242, 222], [270, 176]],
  ];
  const leaf = (x: number, y: number, a: number, l: number, w: number): Item => ({ sil: roundPetal(x, y, a, l, w), d: [rib(x, y, a, l)] });
  items.push(
    leaf(200, 108, -20, 40, 15),
    leaf(200, 108, 22, 40, 15),
    leaf(199, 160, -70, 60, 24),
    leaf(199, 166, 70, 60, 24),
    leaf(136, 176, -30, 48, 19),
    leaf(150, 202, -88, 50, 20),
    leaf(266, 180, 30, 48, 19),
    leaf(252, 206, 88, 50, 20),
    leaf(198, 226, -64, 54, 22),
    leaf(199, 232, 64, 54, 22),
  );
  items.push({ sil: stems.map((s) => tube(s, 7, 5)) });
  return layered(items);
}

function lavenderSprigsArt(): Art {
  const sprig = (base: P, top: P, bend: number): Item => {
    const mid: P = [(base[0] + top[0]) / 2 + bend, (base[1] + top[1]) / 2];
    const pts: P[] = [base, mid, top];
    const buds: string[] = [];
    for (let i = 0; i < 9; i++) {
      const t = 0.56 + i * 0.05;
      const { p, deg } = along(pts, t);
      const len = 22 - i * 1.3;
      buds.push(petal(p[0], p[1], deg - 34, len, 6, 0.6), petal(p[0], p[1], deg + 34, len, 6, 0.6));
    }
    const tip = along(pts, 1);
    buds.push(petal(tip.p[0], tip.p[1], tip.deg, 16, 5, 0.6));
    return { sil: [...buds, tube(pts, 5, 4)] };
  };
  return layered([
    sprig([200, 372], [200, 52], 6),
    sprig([196, 372], [104, 82], -10),
    sprig([204, 372], [298, 82], 10),
    { sil: [petal(198, 360, -24, 90, 6, 0.45), petal(202, 360, 26, 90, 6, 0.45)] },
  ]);
}

function ginkgoArt(): Art {
  const fan = (bx: number, by: number, deg: number, s: number): Item => {
    const m = frame(bx, by, deg);
    const pts: P[] = [[0, 0], [0.4, 0.3], [0.78, 0.62], [0.98, 0.42], [1.06, 0.18], [0.9, 0.03], [0.82, 0], [0.9, -0.03], [1.06, -0.18], [0.98, -0.42], [0.78, -0.62], [0.4, -0.3]].map(([a, c]) => m(a * s, c * s));
    const vs: string[] = [];
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const e = m(s * (0.92 - Math.abs(i) * 0.03), s * i * 0.14);
      const b = m(s * 0.12, 0);
      vs.push(`M ${f(b[0])} ${f(b[1])} L ${f(e[0])} ${f(e[1])}`);
    }
    return { sil: smooth(pts), d: [vs.join(' ')] };
  };
  return layered([
    fan(196, 220, -2, 150),
    fan(170, 260, -52, 120),
    fan(222, 262, 54, 118),
    { sil: tube([[196, 220], [190, 300], [180, 376]], 6, 6) },
    { sil: [tube([[170, 260], [184, 290]], 5, 5), tube([[222, 262], [196, 296]], 5, 5)] },
  ]);
}

function daisyChainArt(): Art {
  const items: Item[] = [];
  const n = 7;
  const ringPts: P[] = [];
  for (let i = 0; i <= 48; i++) ringPts.push(polar(200, 200, 128, i * 7.5));
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(200, 200, 128, (360 * i) / n);
    const h = daisyHead(x, y, 38, 12, i * 9);
    items.push({ sil: h.centre, d: [circle(x, y, 5)] }, { sil: h.petals });
  }
  const ringA = tube(ringPts.slice(0, 25), 6, 6);
  const ringB = tube(ringPts.slice(24), 6, 6);
  items.push({ sil: [ringA, ringB] });
  return layered(items);
}

function lotusArt(): Art {
  const bx = 200;
  const by = 268;
  return layered([
    { sil: petal(bx, by, 0, 172, 38, 0.55), d: [rib(bx, by, 0, 172)] },
    { sil: [petal(bx - 6, by, -102, 108, 30, 0.6), petal(bx + 6, by, 102, 108, 30, 0.6)] },
    { sil: [petal(bx - 4, by, -34, 160, 36, 0.58), petal(bx + 4, by, 34, 160, 36, 0.58)] },
    { sil: [petal(bx - 2, by, -66, 140, 32, 0.6), petal(bx + 2, by, 66, 140, 32, 0.6)] },
    { sil: E(96, 312, 72, 18), d: ['M 96 312 L 150 306'] },
    { sil: E(306, 316, 66, 16), d: ['M 306 316 L 256 310'] },
    { sil: NONE, p: [waves(40, 360, 346, 40, 6), waves(90, 330, 370, 40, 6)] },
  ]);
}

function callaArt(): Art {
  const spathe = 'M 196 266 C 170 232 138 172 148 124 C 154 92 190 76 222 80 C 248 72 272 58 296 46 C 290 80 274 100 264 120 C 262 172 232 230 206 266 Z';
  const throat = 'M 148 124 C 168 150 234 146 264 120 C 246 104 200 98 178 102 C 162 106 152 114 148 124 Z';
  return layered([
    { sil: tube([[206, 146], [208, 120], [212, 98]], 9, 7) },
    { sil: spathe, p: [throat], d: ['M 168 150 Q 190 210 202 256', 'M 240 150 Q 226 210 206 256'] },
    { sil: petal(204, 330, -38, 132, 34, 0.42), d: [rib(204, 330, -38, 132, -4)] },
    { sil: tube([[200, 262], [198, 320], [194, 370]], 10, 10) },
  ]);
}


// ---- intermediate -----------------------------------------------------------------------------------------------

function roseOpenArt(): Art {
  const leaves: Item[] = [
    { sil: toothLeaf(150, 236, 236, 90, 30, 8), d: [rib(150, 236, 236, 90, 3)] },
    { sil: toothLeaf(252, 238, 122, 86, 28, 8), d: [rib(252, 238, 122, 86, -3)] },
    { sil: toothLeaf(198, 300, 205, 70, 24, 7), d: [rib(198, 300, 205, 70)] },
  ];
  return layered([
    ...roseHead(200, 160, 118, 8),
    ...leaves,
    { sil: tube([[200, 250], [204, 310], [196, 370]], 10, 9), p: ['M 203 330 L 214 322 L 205 324'] },
  ]);
}

function tulipBunchArt(): Art {
  const heads: [number, number, number, number][] = [
    [200, 96, 1, 0],
    [134, 134, 0.92, -14],
    [266, 130, 0.92, 14],
    [96, 196, 0.82, -24],
    [306, 192, 0.82, 24],
  ];
  const tie: P = [200, 300];
  const items: Item[] = [
    { sil: rrect(178, 288, 44, 24, 6) },
    { sil: [E(166, 296, 26, 12, -18), E(234, 296, 26, 12, 18)], d: ['M 150 292 Q 166 298 180 298', 'M 250 292 Q 234 298 220 298'] },
    { sil: [petal(190, 310, 200, 50, 8, 0.5), petal(210, 310, 160, 50, 8, 0.5)] },
  ];
  for (const [x, y, sc, tilt] of heads) items.push(...tulipHead(x, y, sc, tilt));
  items.push({ sil: [petal(186, 330, -16, 200, 16, 0.3), petal(214, 330, 18, 196, 16, 0.3)], d: [rib(186, 330, -16, 200), rib(214, 330, 18, 196)] });
  const stems = heads.map(([x, y]) => tube([[x, y], [(x + tie[0]) / 2 + (x - 200) * 0.1, (y + tie[1]) / 2], tie, [200 + (x - 200) * 0.18, 370]], 6, 6));
  items.push({ sil: stems });
  return layered(items);
}

function starLilyArt(): Art {
  const cx = 196;
  const cy = 160;
  const items: Item[] = [];
  const st: string[] = [];
  const anth: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = 30 + i * 60;
    const e = polar(cx, cy, 64, a + 6);
    const m = polar(cx, cy, 34, a - 4);
    st.push(`M ${f(cx)} ${f(cy)} Q ${f(m[0])} ${f(m[1])} ${f(e[0])} ${f(e[1])}`);
    anth.push(E(e[0], e[1], 4, 8, a + 96));
  }
  const pist = polar(cx, cy, 74, 0);
  items.push({ sil: [...anth, circle(pist[0], pist[1], 6)], p: [`M ${f(cx)} ${f(cy)} L ${f(pist[0])} ${f(pist[1] + 6)}`, st.join(' ')] });
  const spots: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    const m = frame(cx, cy, a);
    for (let k = 0; k < 4; k++) {
      const [x, y] = m(30 + k * 11, (k % 2 ? 7 : -7));
      spots.push(circle(x, y, 1.8));
    }
  }
  const pet = (a: number): Item => ({ sil: petal(cx, cy, a, 130, 30, 0.42), d: [rib(cx, cy, a, 130, 4)] });
  items.push(...[0, 120, 240].map(pet), ...[60, 180, 300].map(pet));
  items.push({ sil: NONE, d: [spots.join(' ')] });
  items.push(
    { sil: petal(304, 240, 20, 76, 14, 0.62), d: [rib(304, 240, 20, 76)] },
    { sil: petal(198, 296, -60, 90, 14, 0.4), d: [rib(198, 296, -60, 90)] },
    { sil: petal(200, 330, 58, 86, 14, 0.4), d: [rib(200, 330, 58, 86)] },
    { sil: [tube([[198, 250], [202, 320], [196, 370]], 9, 9), tube([[201, 300], [260, 290], [296, 262], [304, 240]], 6, 5)] },
  );
  return layered(items);
}

function irisArt(): Art {
  const cx = 200;
  const cy = 150;
  const fall = (a: number, l: number, w: number) => ruffle(roundPetal(cx, cy + 10, a, l, w), 1.8, 18, a);
  const beard: string[] = [];
  for (let k = 0; k < 7; k++) {
    const y = cy + 24 + k * 9;
    beard.push(`M ${f(cx - 5)} ${f(y)} L ${f(cx)} ${f(y + 5)} L ${f(cx + 5)} ${f(y)}`);
  }
  return layered([
    { sil: fall(180, 120, 40), p: [beard.join(' ')], d: [lineAt([[30, -16], [80, -22], [104, -14]], cx, cy + 10, 180), lineAt([[30, 16], [80, 22], [104, 14]], cx, cy + 10, 180)] },
    { sil: fall(126, 108, 36), d: [rib(cx, cy + 10, 126, 108, 4)] },
    { sil: fall(234, 108, 36), d: [rib(cx, cy + 10, 234, 108, -4)] },
    { sil: ruffle(roundPetal(cx, cy + 4, 0, 110, 34), 1.6, 18), d: [rib(cx, cy + 4, 0, 110)] },
    { sil: [ruffle(roundPetal(cx - 6, cy + 4, -26, 100, 30), 1.6, 18), ruffle(roundPetal(cx + 6, cy + 4, 26, 100, 30), 1.6, 18)] },
    { sil: [petal(196, 380, -14, 220, 16, 0.3), petal(206, 380, 16, 200, 15, 0.3), petal(190, 380, -34, 150, 13, 0.3)] },
    { sil: tube([[200, 170], [202, 280], [200, 370]], 10, 10) },
  ]);
}

function daffodilArt(): Art {
  const cx = 176;
  const cy = 142;
  const petals = [0, 60, 120, 180, 240, 300].map((a) => petal(cx, cy, a + 10, 96, 30, 0.6));
  const cup = ruffle(circle(cx, cy, 40), 3, 14);
  const pleats = [0, 60, 120, 180, 240, 300].map((a) => {
    const p1 = polar(cx, cy, 20, a + 30);
    const p2 = polar(cx, cy, 36, a + 30);
    return `M ${f(p1[0])} ${f(p1[1])} L ${f(p2[0])} ${f(p2[1])}`;
  });
  const neck: P[] = [[cx + 30, cy + 60], [240, 220], [244, 300], [240, 370]];
  return layered([
    { sil: circle(cx, cy, 18), d: [circle(cx, cy, 6)] },
    { sil: cup, d: pleats },
    { sil: petals, d: [0, 60, 120, 180, 240, 300].map((a) => rib(cx, cy, a + 10, 96)) },
    { sil: E(222, 214, 12, 18, -30) },
    { sil: [petal(236, 380, -18, 250, 14, 0.25), petal(250, 380, 14, 220, 13, 0.25)], d: [rib(236, 380, -18, 250), rib(250, 380, 14, 220)] },
    { sil: tube(neck, 9, 10) },
  ]);
}

function magnoliaArt(): Art {
  const flower = (x: number, y: number, a: number, s: number): Item[] => [
    { sil: roundPetal(x, y, a, 84 * s, 22 * s), d: [rib(x, y, a, 84 * s)] },
    { sil: [roundPetal(x - 6 * s, y, a - 24, 80 * s, 22 * s), roundPetal(x + 6 * s, y, a + 24, 80 * s, 22 * s)] },
    { sil: [roundPetal(x - 4 * s, y, a - 10, 86 * s, 20 * s), roundPetal(x + 4 * s, y, a + 10, 86 * s, 20 * s)] },
    { sil: E(...polar(x, y, 4 * s, a + 180), 14 * s, 10 * s, a), d: [] },
  ];
  const br: P[] = [[52, 360], [130, 300], [210, 240], [300, 200], [350, 190]];
  const tw1: P[] = [[132, 300], [128, 230], [118, 170]];
  const tw2: P[] = [[226, 232], [240, 170], [258, 120]];
  const bark: string[] = [];
  for (let i = 0; i < 9; i++) {
    const { p, tan } = along(br, 0.08 + i * 0.1);
    bark.push(`M ${f(p[0] - tan[1] * 3 - tan[0] * 6)} ${f(p[1] + tan[0] * 3 - tan[1] * 6)} L ${f(p[0] - tan[1] * 3 + tan[0] * 6)} ${f(p[1] + tan[0] * 3 + tan[1] * 6)}`);
  }
  return layered([
    ...flower(118, 172, -6, 1),
    ...flower(258, 124, 18, 0.92),
    { sil: E(352, 176, 9, 18, 70), d: ['M 342 180 Q 352 172 364 172'] },
    { sil: E(186, 240, 8, 16, -40) },
    { sil: [tube(br, 14, 6), tube(tw1, 8, 6), tube(tw2, 8, 6)], d: [bark.join(' ')] },
  ]);
}

function hibiscusArt(): Art {
  const cx = 184;
  const cy = 200;
  const items: Item[] = [];
  const col: P[] = [[cx, cy], [230, 150], [262, 112]];
  const stam: string[] = [];
  for (let i = 0; i < 12; i++) {
    const { p } = along(col, 0.55 + i * 0.035);
    const side = i % 2 ? 1 : -1;
    stam.push(circle(p[0] + side * 9, p[1] + side * 3 - 2, 3));
  }
  const pads = [0, 72, 144, 216, 288].map((a) => {
    const [x, y] = polar(262, 106, 12, a);
    return circle(x, y, 4.5);
  });
  items.push({ sil: pads }, { sil: tube(col, 7, 5), p: [stam.join(' ')] });
  const vein = (a: number) => [-14, 0, 14].map((o) => lineAt([[18, o * 0.3], [60, o * 0.8], [100, o]], cx, cy, a + 8)).join(' ');
  for (let i = 0; i < 5; i++) {
    const a = i * 72 - 10;
    items.push({ sil: ruffle(shapeAt([[0, 0], [40, 40], [92, 62], [124, 34], [130, 0], [118, -36], [80, -48], [36, -30]], cx, cy, a), 2.4, 20, i), d: [vein(a)] });
  }
  items.push(
    { sil: toothLeaf(266, 300, 130, 92, 34, 9), d: [rib(266, 300, 130, 92), veins(266, 300, 130, 92, 34, 3)] },
    { sil: toothLeaf(104, 300, 230, 84, 30, 8), d: [rib(104, 300, 230, 84), veins(104, 300, 230, 84, 30, 3)] },
  );
  return layered(items);
}

function ivyArt(): Art {
  const vine: P[] = [[44, 150], [100, 172], [160, 206], [226, 208], [284, 232], [340, 256]];
  const items: Item[] = [];
  const spots: [number, number, number][] = [
    [0.08, -1, 70],
    [0.22, 1, 80],
    [0.36, -1, 78],
    [0.5, 1, 88],
    [0.64, -1, 76],
    [0.78, 1, 80],
    [0.92, -1, 58],
  ];
  const stalks: string[] = [];
  for (const [t, side, s] of spots) {
    const { p, deg } = along(vine, t);
    const a = deg + side * 90 - side * 14;
    const base = polar(p[0], p[1], 16, a);
    const lobes = [0, 58, -58, 122, -122].map((o) => {
      const tip = polar(base[0], base[1], s * 0.45 + s * 0.6 * (o === 0 ? 1 : Math.abs(o) < 90 ? 0.82 : 0.66), a + o);
      const c = polar(base[0], base[1], s * 0.12, a);
      return `M ${f(c[0])} ${f(c[1])} L ${f(tip[0])} ${f(tip[1])}`;
    });
    const leaf = lobedLeaf(base[0], base[1], a, s);
    items.push({ sil: leaf, d: [inside(lobes.join(' '), leaf)] });
    stalks.push(tube([p, base], 4, 4));
  }
  items.push({ sil: [tube(vine, 7, 5), ...stalks] });
  return layered(items);
}

function eucalyptusArt(): Art {
  const stems: P[][] = [
    [[200, 380], [196, 260], [204, 140], [196, 40]],
    [[194, 380], [150, 280], [110, 190], [86, 110]],
    [[206, 380], [252, 290], [294, 210], [318, 130]],
  ];
  const items: Item[] = [];
  for (const [k, st] of stems.entries()) {
    const n = k === 0 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const t = 0.24 + (i * 0.74) / n;
      const { p, deg } = along(st, t);
      const r = 26 - i * 2.2 - (k ? 2 : 0);
      const side = i % 2 ? 1 : -1;
      const c = polar(p[0], p[1], r * 0.72, deg + side * 70);
      const leaf = circle(c[0], c[1], r);
      items.push({ sil: leaf, d: [`M ${f(p[0])} ${f(p[1])} L ${f(polar(c[0], c[1], r * 0.7, deg + side * 70)[0])} ${f(polar(c[0], c[1], r * 0.7, deg + side * 70)[1])}`] });
    }
  }
  items.push({ sil: stems.map((s) => tube(s, 6, 4)) });
  return layered(items);
}

function succulentTrioArt(): Art {
  const bowl = 'M 70 280 L 330 280 C 326 330 290 368 250 372 L 150 372 C 110 368 74 330 70 280 Z';
  const rim = rrect(60, 264, 280, 24, 10);
  const items: Item[] = [{ sil: rim }, { sil: bowl, d: ['M 110 320 L 290 320'] }];
  // echeveria rosette (centre)
  const ech: Item[] = [{ sil: [petal(200, 214, 0, 24, 9), petal(200, 214, 120, 24, 9), petal(200, 214, 240, 24, 9)] }];
  for (const [k, [n, l, w]] of ([[5, 44, 15], [7, 62, 19], [9, 76, 20]] as [number, number, number][]).entries())
    for (let i = 0; i < n; i++) {
      const a = (360 * i) / n + k * 20;
      if (Math.cos((a * Math.PI) / 180) < -0.55 && k === 2) continue;
      ech.push({ sil: petal(200, 214, a, l, w, 0.62) });
    }
  // jade (left)
  const jade: Item[] = [];
  const jadeStem: P[] = [[112, 266], [110, 220], [98, 180]];
  for (const [x, y, a] of [[98, 174, -10], [118, 196, 40], [88, 204, -60], [126, 226, 70], [96, 236, -80]] as [number, number, number][])
    jade.push({ sil: E(...polar(x, y, 14, a), 12, 20, a) });
  jade.push({ sil: tube(jadeStem, 9, 7) });
  // aloe (right)
  const aloe: string[] = [];
  for (const [a, l] of [[-40, 90], [-14, 110], [12, 104], [36, 86], [58, 66], [-62, 64]] as [number, number][]) aloe.push(petal(292, 268, a, l, 10, 0.3));
  items.push(...ech, ...jade, { sil: aloe, d: [[-40, 90], [-14, 110], [12, 104], [36, 86]].map(([a, l]) => rib(292, 268, a, l)).concat() });
  return layered(items);
}

function rosemaryArt(): Art {
  const branches: P[][] = [
    [[200, 380], [198, 280], [204, 170], [198, 50]],
    [[199, 300], [160, 240], [128, 170], [116, 110]],
    [[202, 260], [240, 210], [268, 150], [282, 96]],
  ];
  const items: Item[] = [];
  for (const [k, br] of branches.entries()) {
    const needles: string[] = [];
    const n = k === 0 ? 26 : 16;
    const t0 = k === 0 ? 0.24 : 0.12;
    for (let i = 0; i < n; i++) {
      const t = t0 + ((1 - t0) * i) / n;
      const { p, deg } = along(br, t);
      const len = 30 - (i / n) * 12;
      const side = i % 2 ? 1 : -1;
      needles.push(petal(p[0], p[1], deg + side * 36, len, 3.4, 0.45));
    }
    const top = along(br, 1);
    needles.push(petal(top.p[0], top.p[1], top.deg, 18, 3.4, 0.45));
    items.push({ sil: [...needles, tube(br, k === 0 ? 7 : 5, 3)] });
  }
  items.push({ sil: NONE, d: ['M 196 372 L 192 352 M 204 366 L 208 346'] });
  return layered(items);
}

function laurelWreathArt(): Art {
  const items: Item[] = [];
  const arcL: P[] = [];
  const arcR: P[] = [];
  for (let i = 0; i <= 20; i++) {
    arcL.push(polar(200, 196, 134, 194 + i * 7.6));
    arcR.push(polar(200, 196, 134, 166 - i * 7.6));
  }
  for (const arc of [arcL, arcR]) {
    const leaves: string[] = [];
    const ribs: string[] = [];
    for (let i = 0; i < 11; i++) {
      const t = 0.06 + i * 0.088;
      const { p, deg } = along(arc, t);
      for (const side of [1, -1]) {
        const a = deg + side * 40;
        const q = polar(p[0], p[1], 4, deg + side * 90);
        leaves.push(petal(q[0], q[1], a, 46 - i * 1.2, 11, 0.5));
        ribs.push(rib(q[0], q[1], a, 46 - i * 1.2));
      }
    }
    const tip = along(arc, 1);
    leaves.push(petal(tip.p[0], tip.p[1], tip.deg, 40, 10, 0.5));
    items.push({ sil: leaves, d: [ribs.join(' ')] });
    items.push({ sil: tube(arc, 6, 4) });
  }
  items.unshift({ sil: [E(186, 334, 18, 9, -20), E(214, 334, 18, 9, 20), circle(200, 334, 7)], p: [] }, { sil: [petal(196, 338, 205, 36, 6), petal(204, 338, 155, 36, 6)] });
  return layered(items);
}

function pressedSprigArt(): Art {
  const items: Item[] = [];
  const tape = (x: number, y: number, a: number) => rotate(rrect(x - 30, y - 10, 60, 20, 2), a, x, y);
  items.push({ sil: tape(198, 330, -12) }, { sil: tape(190, 238, 16) });
  const stem: P[] = [[200, 360], [196, 270], [180, 190], [150, 110]];
  const side: P[] = [[195, 250], [230, 200], [264, 150]];
  const f1 = blossom(146, 100, 48, 10, false);
  const f2 = blossom(268, 140, 42, 30, false);
  const f3 = blossom(116, 196, 26, 5, false);
  items.push(
    { sil: f1.centre, d: [f1.stamens] }, { sil: f1.petals },
    { sil: f2.centre, d: [f2.stamens] }, { sil: f2.petals },
    { sil: f3.centre }, { sil: f3.petals },
    { sil: E(250, 268, 8, 15, 40), d: [] },
    { sil: tube([[166, 164], [116, 196]], 3, 3) },
    { sil: tube([[198, 300], [250, 268]], 3, 3) },
  );
  const lv: [number, number, number, number][] = [
    [0.15, 1, 48, 12], [0.28, -1, 46, 12], [0.42, 1, 40, 10], [0.56, -1, 36, 9],
  ];
  for (const [t, sd, l, w] of lv) {
    const { p, deg } = along(stem, t);
    items.push({ sil: petal(p[0], p[1], deg + sd * 50, l, w, 0.5), d: [rib(p[0], p[1], deg + sd * 50, l)] });
  }
  items.push({ sil: [tube(stem, 5, 3), tube(side, 4, 3)] });
  return layered(items);
}

function flowerBorderArt(): Art {
  const items: Item[] = [];
  const vine: P[] = [];
  for (let x = 30; x <= 370; x += 10) vine.push([x, 200 + 24 * Math.sin(((x - 30) / 340) * Math.PI * 3)]);
  for (let i = 0; i < 4; i++) {
    const x = 58 + i * 95;
    const y = 200 + 24 * Math.sin(((x - 30) / 340) * Math.PI * 3);
    const b = blossom(x, y, 30, i * 17, false);
    items.push({ sil: b.centre, d: [circle(x, y, 2)] }, { sil: b.petals });
  }
  const leaves: string[] = [];
  const ribs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const t = 0.14 + i * 0.26;
    const { p, deg } = along(vine, t);
    const side = i % 2 ? 1 : -1;
    leaves.push(petal(p[0], p[1], deg + side * 55, 40, 11, 0.5), petal(p[0], p[1], deg - side * 125, 32, 9, 0.5));
    ribs.push(rib(p[0], p[1], deg + side * 55, 40), rib(p[0], p[1], deg - side * 125, 32));
  }
  for (const x of [100, 200, 300]) {
    const y = 200 + 24 * Math.sin(((x - 30) / 340) * Math.PI * 3);
    items.push({ sil: E(x, y + (y > 200 ? -22 : 22), 5, 5), d: [] });
  }
  items.push({ sil: leaves, d: [ribs.join(' ')] }, { sil: tube(vine, 5, 5) });
  items.push({ sil: NONE, p: ['M 24 132 L 376 132', 'M 24 268 L 376 268'], d: ['M 24 142 L 376 142', 'M 24 258 L 376 258'] });
  return layered(items);
}

// ---- advanced -------------------------------------------------------------------------------------------------

/** Two crease lines inside a petal (advanced shading-free detail). */
function creases(bx: number, by: number, deg: number, len: number, w: number, shape: string): string {
  return inside([lineAt([[len * 0.2, -w * 0.15], [len * 0.55, -w * 0.32], [len * 0.82, -w * 0.3]], bx, by, deg), lineAt([[len * 0.25, w * 0.1], [len * 0.6, w * 0.22], [len * 0.86, w * 0.18]], bx, by, deg)].join(' '), shape);
}

function peonyArt(): Art {
  const cx = 196;
  const cy = 156;
  const items: Item[] = [];
  const curls: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 72 + 20;
    curls.push(lineAt([[4, -8], [14, -2], [20, 8]], cx, cy, a));
  }
  items.push({ sil: circle(cx, cy, 16), p: [curls.join(' ')] });
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 12 + rnd(i) * 10;
    const sh = ruffle(roundPetal(cx, cy, a, 48, 22), 1.6, 14, i);
    items.push({ sil: sh });
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 51.4 + 30;
    const sh = ruffle(roundPetal(cx, cy, a, 88, 38), 2, 18, i);
    items.push({ sil: sh, d: [creases(cx, cy, a, 88, 38, sh)] });
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 51.4 + 4;
    const sh = ruffle(roundPetal(cx, cy, a, 124, 52), 2.4, 22, i + 3);
    items.push({ sil: sh, d: [creases(cx, cy, a, 124, 52, sh)] });
  }
  const leaf = (bx: number, by: number, a: number, l: number, w: number): Item => {
    const sh = petal(bx, by, a, l, w, 0.42);
    return { sil: sh, d: [rib(bx, by, a, l, 2), inside(veins(bx, by, a, l, w, 3), sh)] };
  };
  items.push(
    { sil: circle(318, 300, 24), d: ['M 302 288 Q 318 300 314 322', 'M 322 278 Q 334 296 330 318'] },
    { sil: [petal(312, 322, 200, 30, 9), petal(322, 322, 160, 30, 9)] },
    leaf(196, 300, -58, 110, 26),
    leaf(196, 300, -22, 70, 18),
    leaf(198, 320, 62, 104, 24),
    leaf(198, 320, 24, 70, 18),
    { sil: [tube([[196, 260], [200, 320], [196, 370]], 10, 10), tube([[199, 340], [260, 330], [306, 316]], 6, 6)] },
  );
  return layered(items);
}

function orchidArt(): Art {
  const flower = (cx: number, cy: number, s: number, rot: number): Item[] => {
    const lip = shapeAt([[0, 0], [12 * s, 16 * s], [30 * s, 14 * s], [40 * s, 6 * s], [44 * s, 0], [40 * s, -6 * s], [30 * s, -14 * s], [12 * s, -16 * s]], cx, cy, 180 + rot);
    const pet = (a: number, l: number, w: number): Item => {
      const sh = roundPetal(cx, cy, a + rot, l * s, w * s);
      return { sil: sh, d: [inside([-0.35, 0, 0.35].map((o) => lineAt([[l * s * 0.18, 0], [l * s * 0.6, o * w * s], [l * s * 0.9, o * w * s * 1.3]], cx, cy, a + rot)).join(' '), sh)] };
    };
    const spots: string[] = [];
    for (let k = 0; k < 4; k++) {
      const [x, y] = frame(cx, cy, 180 + rot)((14 + k * 7) * s, (k % 2 ? 4 : -4) * s);
      spots.push(circle(x, y, 1.6 * s));
    }
    return [
      { sil: E(cx, cy - 2 * s, 5 * s, 7 * s, rot) },
      { sil: lip, d: [spots.join(' ')] },
      pet(-78, 52, 30),
      pet(78, 52, 30),
      pet(0, 48, 16),
      pet(146, 46, 14),
      pet(214, 46, 14),
    ];
  };
  const stem: P[] = [[150, 372], [138, 280], [150, 180], [200, 110], [270, 84], [334, 96]];
  const items: Item[] = [];
  items.push(...flower(166, 196, 1, -8), ...flower(232, 124, 0.9, 6), ...flower(296, 108, 0.74, 16));
  items.push({ sil: E(338, 112, 9, 12, 20) }, { sil: E(352, 130, 7, 10, 30) });
  items.push({ sil: [tube([[334, 98], [338, 104]], 4, 4), tube([[340, 106], [350, 122]], 3, 3)] });
  const leafA = smooth([[150, 360], [110, 340], [56, 340], [30, 356], [70, 368], [120, 372]]);
  const leafB = smooth([[154, 362], [200, 330], [270, 322], [330, 340], [280, 362], [200, 374]]);
  items.push({ sil: leafA, d: ['M 140 358 Q 90 350 44 354'] }, { sil: leafB, d: ['M 164 360 Q 240 340 316 342'] });
  items.push({ sil: tube(stem, 6, 4), d: [] });
  items.push({ sil: NONE, d: ['M 140 300 L 146 292', 'M 142 230 L 150 226'] });
  return layered(items);
}

function climbingRoseArt(): Art {
  const items: Item[] = [];
  const frameR = rrect(36, 36, 328, 328, 6);
  const roses: [number, number, number][] = [[116, 110, 46], [262, 168, 50], [148, 262, 42], [296, 306, 34]];
  for (const [x, y, r] of roses) items.push(...roseHead(x, y, r, x));
  const leafSet = (bx: number, by: number, a: number, s: number): Item => {
    const ls = [toothLeaf(bx, by, a, 44 * s, 14 * s, 6), toothLeaf(bx, by, a - 50, 34 * s, 11 * s, 5), toothLeaf(bx, by, a + 50, 34 * s, 11 * s, 5)];
    return { sil: ls, d: [rib(bx, by, a, 44 * s), rib(bx, by, a - 50, 34 * s), rib(bx, by, a + 50, 34 * s)] };
  };
  items.push(
    leafSet(196, 120, 70, 1), leafSet(70, 190, 200, 1), leafSet(218, 236, 220, 0.9), leafSet(340, 230, 160, 0.9),
    leafSet(230, 320, 120, 0.9), leafSet(90, 320, 240, 0.9),
    { sil: E(334, 98, 10, 16, 30), d: ['M 330 86 Q 338 98 334 112'] },
    { sil: E(54, 268, 9, 14, -40) },
  );
  const vine: P[] = [[200, 370], [180, 320], [160, 270], [120, 200], [116, 140], [180, 120], [250, 150], [300, 200], [320, 260], [300, 320]];
  const thorns: string[] = [];
  for (let i = 0; i < 10; i++) {
    const { p, tan } = along(vine, 0.05 + i * 0.095);
    const n: P = [-tan[1], tan[0]];
    const sd = i % 2 ? 1 : -1;
    thorns.push(`M ${f(p[0] + n[0] * 4 * sd - tan[0] * 4)} ${f(p[1] + n[1] * 4 * sd - tan[1] * 4)} L ${f(p[0] + n[0] * 11 * sd + tan[0] * 3)} ${f(p[1] + n[1] * 11 * sd + tan[1] * 3)} L ${f(p[0] + n[0] * 4 * sd + tan[0] * 4)} ${f(p[1] + n[1] * 4 * sd + tan[1] * 4)}`);
  }
  items.push({ sil: [tube(vine, 9, 6), tube([[334, 104], [310, 150], [290, 186]], 4, 4), tube([[60, 276], [100, 240], [130, 210]], 4, 4)], p: [thorns.join(' ')] });
  const bars: string[] = [];
  for (let k = -3; k <= 3; k++) {
    bars.push(rotate(rrect(200 + k * 80 - 5, -60, 10, 520, 3), 45, 200 + k * 80, 200));
    bars.push(rotate(rrect(200 + k * 80 - 5, -60, 10, 520, 3), -45, 200 + k * 80, 200));
  }
  const lattice = bars.map((b) => inside(b, frameR));
  items.push({ sil: NONE, d: lattice }, { sil: NONE, p: [frameR] });
  return layered(items);
}

function cornflower(cx: number, cy: number, r: number): { sil: string[]; d: string } {
  const sil: string[] = [];
  const lines: string[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 40;
    sil.push(notchPetal(cx, cy, a, r, r * 0.3, 3));
    lines.push(lineAt([[r * 0.3, 0], [r * 0.8, 0]], cx, cy, a));
  }
  return { sil, d: lines.join(' ') };
}

function wildBouquetArt(): Art {
  const items: Item[] = [];
  const wrapFront = smooth([[110, 230], [200, 262], [290, 226], [236, 300], [206, 370], [194, 370], [164, 300]]);
  const wrapBack = smooth([[86, 196], [150, 176], [200, 186], [250, 172], [318, 190], [290, 226], [200, 262], [110, 230]]);
  items.push(
    { sil: [E(184, 298, 22, 10, -20), E(220, 298, 22, 10, 20), circle(202, 300, 7)], d: ['M 168 294 Q 184 300 196 300', 'M 236 294 Q 220 300 208 300'] },
    { sil: [petal(198, 304, 200, 52, 5), petal(206, 304, 165, 56, 5)] },
    { sil: wrapFront, d: ['M 200 262 Q 202 320 200 372', 'M 160 248 Q 176 290 190 330', 'M 244 246 Q 226 290 210 330'] },
  );
  const d1 = daisyHead(160, 140, 46, 14, 4);
  const d2 = daisyHead(268, 112, 40, 13, 10);
  items.push({ sil: d1.centre, d: [circle(160, 140, 6), circle(160, 140, 10)] }, { sil: d1.petals, d: [d1.petals.map((_, i) => lineAt([[18, 0], [36, 0]], 160, 140, 4 + (360 * i) / 14)).join(' ')] });
  items.push({ sil: d2.centre, d: [circle(268, 112, 8)] }, { sil: d2.petals });
  // poppy (side cup)
  const pc: P = [214, 196];
  items.push(
    { sil: ruffle(roundPetal(pc[0], pc[1] + 26, -18, 56, 26), 1.6, 14), d: [creases(pc[0], pc[1] + 26, -18, 56, 26, roundPetal(pc[0], pc[1] + 26, -18, 56, 26))] },
    { sil: ruffle(roundPetal(pc[0] + 4, pc[1] + 26, 24, 54, 24), 1.6, 14) },
    { sil: ruffle(roundPetal(pc[0], pc[1] + 24, 0, 62, 30), 1.6, 14) },
  );
  const cf = cornflower(108, 214, 30);
  items.push({ sil: circle(108, 214, 7) }, { sil: cf.sil, d: [cf.d] });
  const cf2 = cornflower(312, 190, 26);
  items.push({ sil: circle(312, 190, 6) }, { sil: cf2.sil, d: [cf2.d] });
  // lavender & grasses
  const spike = (pts: P[]): Item => {
    const buds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const { p, deg } = along(pts, 0.5 + i * 0.07);
      buds.push(petal(p[0], p[1], deg - 32, 16 - i, 5, 0.6), petal(p[0], p[1], deg + 32, 16 - i, 5, 0.6));
    }
    const t = along(pts, 1);
    buds.push(petal(t.p[0], t.p[1], t.deg, 12, 4, 0.6));
    return { sil: [...buds, tube(pts, 4, 3)] };
  };
  items.push(spike([[196, 230], [200, 130], [204, 34]]), spike([[180, 230], [130, 120], [96, 60]]));
  const oat = (pts: P[]): Item => {
    const seeds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const { p, deg } = along(pts, 0.55 + i * 0.075);
      seeds.push(petal(p[0], p[1], deg + (i % 2 ? 26 : -26), 18, 4, 0.5));
    }
    return { sil: [...seeds, tube(pts, 3, 2)] };
  };
  items.push(oat([[230, 230], [300, 130], [348, 70]]), oat([[170, 230], [86, 150], [44, 120]]));
  const st = (a: P, b: P): string => tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10], b], 5, 4);
  items.push({ sil: [st([200, 240], [160, 150]), st([200, 240], [268, 120]), st([200, 240], [108, 220]), st([200, 240], [312, 196])] });
  items.push({ sil: wrapBack, d: ['M 150 176 Q 170 200 176 240', 'M 250 172 Q 236 200 230 236'] });
  return layered(items);
}

function fernFiddleArt(): Art {
  const rach: P[] = [[110, 380], [140, 300], [180, 210], [230, 130], [280, 70], [322, 44]];
  const pinnae: string[] = [];
  const ribs: string[] = [];
  for (let i = 0; i < 12; i++) {
    const t = 0.16 + i * 0.07;
    const { p, deg } = along(rach, t);
    const len = 112 - i * 7.8;
    for (const side of [1, -1]) {
      const a = deg + side * 62;
      const sh = serrate(petal(p[0], p[1], a, len, len * 0.15, 0.4), Math.max(2, len * 0.045), 10);
      pinnae.push(sh);
      ribs.push(lineAt([[2, 0], [len * 0.5, 0], [len * 0.85, 0]], p[0], p[1], a));
    }
  }
  const tip = along(rach, 1);
  pinnae.push(petal(tip.p[0], tip.p[1], tip.deg, 26, 5, 0.4));
  const lobeVeins: string[] = [];
  for (let i = 0; i < 12; i += 2) {
    const t = 0.16 + i * 0.07;
    const { p, deg } = along(rach, t);
    const len = 112 - i * 7.8;
    for (const side of [1, -1]) {
      const a = deg + side * 62;
      const m = frame(p[0], p[1], a);
      for (let k = 1; k < 5; k++) {
        const s0 = m(len * k * 0.18, 0);
        for (const sd of [1, -1]) {
          const e = m(len * k * 0.18 + len * 0.05, sd * len * 0.11);
          lobeVeins.push(`M ${f(s0[0])} ${f(s0[1])} L ${f(e[0])} ${f(e[1])}`);
        }
      }
    }
  }
  const fiddle = (stem: P[], r: number): Item => {
    const top = stem[stem.length - 1];
    return { sil: circle(top[0], top[1], r * 4.2), p: [spiral(top[0] - r * 0.5, top[1], r, 8)], d: [] };
  };
  const fs1: P[] = [[60, 370], [56, 320], [70, 272]];
  const fs2: P[] = [[300, 370], [312, 320], [304, 280]];
  return layered([
    fiddle(fs1, 4.4),
    fiddle(fs2, 4),
    { sil: [tube(fs1, 9, 8), tube(fs2, 8, 7)], d: ['M 56 350 L 62 340 M 62 320 L 68 310', 'M 308 352 L 314 342 M 312 326 L 318 316'] },
    { sil: pinnae, d: chunk(ribs, 4).concat(chunk(lobeVeins.map((v) => inside(v, pinnae)).filter(Boolean), 4)) },
    { sil: tube(rach, 8, 3) },
  ]);
}

function floralWreathArt(): Art {
  const items: Item[] = [];
  const cxy: P = [200, 200];
  // flower clusters
  items.push(...roseHead(122, 284, 46, 10), ...roseHead(296, 120, 40, 40));
  const b1 = blossom(176, 318, 26, 20, false);
  const b2 = blossom(80, 230, 22, 4, false);
  const b3 = blossom(254, 96, 22, 30, false);
  const b4 = blossom(326, 168, 20, 12, false);
  for (const b of [b1, b2, b3, b4]) items.push({ sil: b.centre }, { sil: b.petals, d: [b.stamens] });
  const berries: string[] = [];
  for (const [x, y] of [[218, 328], [230, 318], [226, 336], [62, 196], [70, 184], [52, 186], [338, 208], [348, 196], [214, 82], [226, 74]] as P[]) berries.push(circle(x, y, 6));
  items.push({ sil: berries, d: [] });
  // leaf ring
  const ring: P[] = [];
  for (let i = 0; i <= 36; i++) ring.push(polar(cxy[0], cxy[1], 130, i * 10));
  const leaves: string[] = [];
  const ribs: string[] = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const { p, deg } = along(ring, t);
    const side = i % 2 ? 1 : -1;
    const a = deg + side * 42;
    if (i % 3 === 0) {
      const c = polar(p[0], p[1], 16, a);
      leaves.push(circle(c[0], c[1], 14));
      ribs.push(`M ${f(p[0])} ${f(p[1])} L ${f(c[0])} ${f(c[1])}`);
    } else {
      leaves.push(petal(p[0], p[1], a, 50, 12, 0.5));
      ribs.push(rib(p[0], p[1], a, 50), inside(veins(p[0], p[1], a, 50, 12, 2), petal(p[0], p[1], a, 50, 12, 0.5)));
    }
  }
  items.push({ sil: leaves, d: chunk(ribs, 4) });
  items.push({ sil: tube(ring, 6, 6) });
  return layered(items);
}

function cornerSprayArt(): Art {
  const items: Item[] = [];
  const cx = 104;
  const cy = 104;
  // anemone
  const dots: string[] = [];
  for (let i = 0; i < 18; i++) {
    const [x, y] = polar(cx, cy, 26 + (i % 2) * 5, i * 20);
    dots.push(circle(x, y, 2.4));
  }
  items.push({ sil: circle(cx, cy, 18), d: [circle(cx, cy, 9)] }, { sil: NONE, p: [dots.join(' ')] });
  for (let i = 0; i < 6; i++) {
    const a = i * 60 + 15;
    const sh = roundPetal(cx, cy, a, 74, 34);
    items.push({ sil: sh, d: [creases(cx, cy, a, 74, 34, sh)] });
  }
  const b = blossom(214, 70, 30, 12, false);
  const b2 = blossom(70, 216, 28, 30, false);
  items.push({ sil: b.centre }, { sil: b.petals, d: [b.stamens] }, { sil: b2.centre }, { sil: b2.petals, d: [b2.stamens] });
  const top: P[] = [[120, 84], [200, 68], [276, 64], [330, 74], [360, 94]];
  const left: P[] = [[84, 120], [68, 200], [64, 276], [74, 330], [94, 360]];
  const leafy = (st: P[], flip: number): Item => {
    const ls: string[] = [];
    const rs: string[] = [];
    for (let i = 0; i < 7; i++) {
      const t = 0.3 + i * 0.1;
      const { p, deg } = along(st, t);
      const side = i % 2 ? 1 : -1;
      const a = deg + side * 50;
      const l = 40 - i * 2.6;
      const sh = petal(p[0], p[1], a, l, 12 - i * 0.6, 0.45);
      ls.push(sh);
      rs.push(rib(p[0], p[1], a, l), inside(veins(p[0], p[1], a, l, 12 - i * 0.6, 2), sh));
    }
    const tip = along(st, 1);
    ls.push(petal(tip.p[0], tip.p[1], tip.deg, 22, 7, 0.45));
    void flip;
    return { sil: [...ls, tube(st, 5, 3)], d: rs };
  };
  items.push(leafy(top, 1), leafy(left, -1));
  // buds and sprigs
  items.push(
    { sil: E(176, 176, 12, 18, 135), d: ['M 168 166 Q 178 176 184 188'] },
    { sil: [petal(166, 166, 315, 22, 6), petal(170, 160, 290, 18, 5)] },
    { sil: tube([[120, 120], [166, 166]], 5, 4) },
  );
  const sprig = (st: P[]): Item => {
    const ls: string[] = [];
    for (let i = 0; i < 6; i++) {
      const { p, deg } = along(st, 0.3 + i * 0.12);
      ls.push(petal(p[0], p[1], deg - 40, 18, 4, 0.5), petal(p[0], p[1], deg + 40, 18, 4, 0.5));
    }
    return { sil: [...ls, tube(st, 3, 2)] };
  };
  items.push(sprig([[140, 96], [210, 120], [262, 140]]), sprig([[96, 140], [120, 210], [140, 262]]));
  items.push({ sil: NONE, d: ['M 30 30 L 30 52 M 30 30 L 52 30'] });
  return layered(items);
}

function poppyTrioArt(): Art {
  const items: Item[] = [];
  // open poppy (face)
  const c1: P = [130, 120];
  const pod = circle(c1[0], c1[1], 14);
  const ring: string[] = [];
  for (let i = 0; i < 14; i++) {
    const [x, y] = polar(c1[0], c1[1], 23, i * 25.7);
    const [x0, y0] = polar(c1[0], c1[1], 14, i * 25.7);
    ring.push(`M ${f(x0)} ${f(y0)} L ${f(x)} ${f(y)}`, circle(x, y, 2.4));
  }
  items.push({ sil: pod, d: [0, 45, 90, 135].map((a) => { const p1 = polar(c1[0], c1[1], 11, a); const p2 = polar(c1[0], c1[1], 11, a + 180); return `M ${f(p1[0])} ${f(p1[1])} L ${f(p2[0])} ${f(p2[1])}`; }) }, { sil: NONE, p: [ring.join(' ')] });
  for (const [a, l, w] of [[150, 78, 46], [330, 78, 46], [60, 84, 50], [240, 84, 50]] as [number, number, number][]) {
    const sh = ruffle(roundPetal(c1[0], c1[1], a, l, w), 1.8, 18, a);
    items.push({ sil: sh, d: [creases(c1[0], c1[1], a, l, w, sh)] });
  }
  // side cup poppy
  const c2: P = [286, 150];
  for (const [a, l, w, dx] of [[0, 74, 36, 0], [-30, 70, 32, -6], [30, 70, 32, 6]] as [number, number, number, number][]) {
    const sh = ruffle(roundPetal(c2[0] + dx, c2[1], a, l, w), 1.8, 16, a + 1);
    items.push({ sil: sh, d: [creases(c2[0] + dx, c2[1], a, l, w, sh)] });
  }
  items.push({ sil: [roundPetal(c2[0] - 10, c2[1] - 6, -52, 62, 24), roundPetal(c2[0] + 10, c2[1] - 6, 52, 62, 24)] });
  // drooping bud & seed pods
  items.push({ sil: E(210, 232, 14, 22, -150), d: ['M 204 214 Q 214 232 208 252'] });
  const seedPod = (x: number, y: number): Item => ({
    sil: [smooth([[x - 14, y - 22], [x + 14, y - 22], [x + 16, y], [x + 8, y + 22], [x - 8, y + 22], [x - 16, y]]), rrect(x - 18, y - 30, 36, 9, 4)],
    d: [`M ${x - 8} ${y - 18} L ${x - 6} ${y + 18} M ${x} ${y - 18} L ${x} ${y + 20} M ${x + 8} ${y - 18} L ${x + 6} ${y + 18}`],
  });
  items.push(seedPod(76, 252), seedPod(330, 270));
  const stems = [
    tube([[c1[0] + 4, c1[1] + 20], [150, 240], [170, 370]], 7, 7),
    tube([[c2[0], c2[1] + 10], [270, 260], [230, 370]], 7, 7),
    tube([[214, 252], [222, 270], [214, 300], [200, 370]], 6, 6),
    tube([[76, 280], [90, 330], [110, 370]], 6, 6),
    tube([[330, 300], [316, 340], [290, 370]], 6, 6),
  ];
  const hairs: string[] = [];
  for (const [k, st] of ([[[150, 240], [170, 370]], [[270, 260], [230, 370]], [[90, 330], [110, 370]]] as P[][]).entries())
    for (let i = 0; i < 5; i++) {
      const t = 0.15 + i * 0.17;
      const x = st[0][0] + (st[1][0] - st[0][0]) * t;
      const y = st[0][1] + (st[1][1] - st[0][1]) * t;
      const sd = i % 2 ? 1 : -1;
      hairs.push(`M ${f(x + sd * 4)} ${f(y)} L ${f(x + sd * 10)} ${f(y - 5)}`);
      void k;
    }
  const leaf = (bx: number, by: number, a: number, l: number): Item => {
    const sh = serrate(petal(bx, by, a, l, 14, 0.4), 4, 12);
    return { sil: sh, d: [rib(bx, by, a, l)] };
  };
  items.push(leaf(160, 320, -40, 64), leaf(244, 330, 40, 60));
  items.push({ sil: stems, d: [hairs.join(' ')] });
  return layered(items);
}

function cherryTwigArt(): Art {
  const items: Item[] = [];
  const blooms: [number, number, number, number][] = [[120, 120, 40, 0], [236, 96, 36, 20], [316, 186, 38, 8], [180, 214, 34, 30], [76, 250, 30, 12]];
  for (const [x, y, r, rot] of blooms) {
    const b = blossom(x, y, r, rot);
    items.push({ sil: b.centre }, { sil: NONE, p: [b.stamens] }, { sil: b.petals, d: [[0, 72, 144, 216, 288].map((a) => lineAt([[r * 0.55, 0], [r * 0.82, 0]], x, y, a + rot)).join(' ')] });
  }
  const bud = (x: number, y: number, a: number): Item[] => [
    { sil: petal(x, y, a, 26, 8, 0.6), d: [lineAt([[4, 0], [20, 0]], x, y, a)] },
    { sil: [petal(x, y, a - 20, 10, 4), petal(x, y, a + 20, 10, 4)] },
  ];
  items.push(...bud(286, 76, 30), ...bud(300, 88, 70), ...bud(350, 250, 160), ...bud(36, 196, -40));
  const main: P[] = [[40, 326], [100, 290], [180, 250], [260, 220], [330, 210], [376, 214]];
  const tw1: P[] = [[150, 262], [140, 190], [124, 130]];
  const tw2: P[] = [[226, 232], [240, 160], [240, 100], [270, 82]];
  const tw3: P[] = [[100, 290], [80, 260]];
  const tw4: P[] = [[300, 214], [316, 190]];
  const stalks = [tube([[270, 82], [286, 76]], 3, 3), tube([[270, 82], [300, 88]], 3, 3), tube([[330, 210], [350, 250]], 3, 3), tube([[80, 260], [36, 196]], 3, 3)];
  const bark: string[] = [];
  for (let i = 0; i < 12; i++) {
    const { p, tan } = along(main, 0.04 + i * 0.08);
    const n: P = [-tan[1], tan[0]];
    const w = 9 - i * 0.5;
    bark.push(`M ${f(p[0] + n[0] * w * 0.7)} ${f(p[1] + n[1] * w * 0.7)} Q ${f(p[0] + tan[0] * 3)} ${f(p[1] + tan[1] * 3)} ${f(p[0] - n[0] * w * 0.7)} ${f(p[1] - n[1] * w * 0.7)}`);
  }
  items.push(
    { sil: petal(196, 246, 160, 46, 14), d: [rib(196, 246, 160, 46), veins(196, 246, 160, 46, 14, 2)] },
    { sil: petal(262, 222, 200, 40, 12), d: [rib(262, 222, 200, 40)] },
    { sil: [tube(main, 20, 8), tube(tw1, 10, 6), tube(tw2, 10, 5), tube(tw3, 8, 6), tube(tw4, 7, 5), ...stalks], d: chunk(bark, 3) },
  );
  return layered(items);
}

function herbBundleArt(): Art {
  const items: Item[] = [];
  const tie: P = [200, 270];
  items.push(
    { sil: [E(176, 272, 22, 11, -24), E(224, 272, 22, 11, 24), circle(200, 274, 8)], d: ['M 160 268 Q 176 274 192 274', 'M 240 268 Q 224 274 208 274'] },
    { sil: [petal(196, 280, 205, 48, 4), petal(204, 280, 158, 52, 4)] },
    { sil: rotate(rrect(170, 258, 60, 28, 6), 0, 200, 270), d: ['M 172 266 L 228 266', 'M 172 272 L 228 272', 'M 172 278 L 228 278'] },
  );
  // basil (front centre)
  const basil = (x: number, y: number, a: number, l: number, w: number): Item => {
    const sh = roundPetal(x, y, a, l, w);
    return { sil: sh, d: [rib(x, y, a, l), inside(veins(x, y, a, l, w, 3), sh)] };
  };
  items.push(basil(200, 120, -18, 40, 15), basil(200, 120, 18, 40, 15), basil(199, 168, -70, 56, 22), basil(200, 174, 70, 56, 22), basil(200, 220, -60, 50, 20), basil(200, 224, 64, 50, 20));
  // mint (left)
  const mintSt: P[] = [[190, 262], [150, 190], [110, 120]];
  for (const [t, sd, l, w] of [[0.4, 1, 48, 18], [0.42, -1, 48, 18], [0.66, 1, 40, 15], [0.68, -1, 40, 15]] as [number, number, number, number][]) {
    const { p, deg } = along(mintSt, t);
    const a = deg + sd * 62;
    items.push({ sil: toothLeaf(p[0], p[1], a, l, w, 6), d: [rib(p[0], p[1], a, l), veins(p[0], p[1], a, l, w, 2)] });
  }
  const mt = along(mintSt, 1);
  items.push({ sil: [toothLeaf(mt.p[0], mt.p[1], mt.deg - 18, 32, 12, 5), toothLeaf(mt.p[0], mt.p[1], mt.deg + 18, 32, 12, 5)] });
  // rosemary (right) and (far left)
  const rosemary = (br: P[]): Item => {
    const needles: string[] = [];
    for (let i = 0; i < 18; i++) {
      const { p, deg } = along(br, 0.3 + (0.7 * i) / 18);
      needles.push(petal(p[0], p[1], deg + (i % 2 ? 36 : -36), 24 - i * 0.6, 3, 0.45));
    }
    const t = along(br, 1);
    needles.push(petal(t.p[0], t.p[1], t.deg, 14, 3, 0.45));
    return { sil: [...needles, tube(br, 5, 3)] };
  };
  items.push(rosemary([[210, 262], [262, 170], [306, 76]]), rosemary([[206, 262], [236, 150], [244, 40]]), rosemary([[194, 262], [118, 210], [52, 170]]));
  items.push({ sil: [tube([[200, 262], [200, 170], [200, 112]], 6, 5), tube(mintSt, 6, 5)] });
  // stems below the tie
  const ends: string[] = [];
  for (const [x0, x1] of [[190, 168], [196, 186], [202, 204], [208, 226], [214, 244]] as [number, number][]) ends.push(tube([[x0, 280], [x1, 370]], 6, 6));
  items.push({ sil: ends, d: [] });
  void tie;
  return layered(items);
}

// ---- catalogue ------------------------------------------------------------------------------------------------

export const flowers2: Template[] = [
  // beginner
  tpl('rose-bud', 'Single rosebud', 'beginner', ['rose', 'bud', 'flower', 'love', 'stylized'], roseBudArt()),
  tpl('blossom-single', 'Five-petal cherry blossom', 'beginner', ['blossom', 'cherry', 'sakura', 'flower', 'spring'], blossomSingleArt()),
  tpl('cosmos', 'Cosmos flower', 'beginner', ['cosmos', 'flower', 'garden', 'summer', 'stylized'], cosmosArt()),
  tpl('poppy', 'Open poppy with a bud', 'beginner', ['poppy', 'flower', 'remembrance', 'summer', 'stylized'], poppyArt()),
  tpl('monstera-split', 'Split-leaf monstera', 'beginner', ['monstera', 'leaf', 'tropical', 'plant', 'stylized'], monsteraArt()),
  tpl('palm-frond', 'Palm frond', 'beginner', ['palm', 'leaf', 'tropical', 'botanical', 'summer'], palmFrondArt()),
  tpl('cactus-pot', 'Potted cactus in flower', 'beginner', ['cactus', 'plant', 'desert', 'pot', 'stylized'], cactusArt()),
  tpl('olive-branch', 'Olive branch', 'beginner', ['olive', 'branch', 'leaf', 'peace', 'botanical'], oliveArt()),
  tpl('mint-sprig', 'Mint sprig', 'beginner', ['mint', 'herb', 'sprig', 'kitchen', 'botanical'], mintArt()),
  tpl('basil-pot', 'Basil in a pot', 'beginner', ['basil', 'herb', 'plant', 'kitchen', 'pot'], basilArt()),
  tpl('lavender-sprigs', 'Three lavender sprigs', 'beginner', ['lavender', 'sprig', 'herb', 'summer', 'botanical'], lavenderSprigsArt()),
  tpl('ginkgo-leaves', 'Ginkgo leaves', 'beginner', ['ginkgo', 'leaf', 'tree', 'autumn', 'botanical'], ginkgoArt()),
  tpl('daisy-chain', 'Daisy chain', 'beginner', ['daisy', 'flower', 'chain', 'summer', 'garland'], daisyChainArt()),
  tpl('lotus', 'Lotus blossom', 'beginner', ['lotus', 'flower', 'blossom', 'zen', 'water'], lotusArt()),
  tpl('calla-lily', 'Calla lily', 'beginner', ['lily', 'calla', 'flower', 'wedding', 'elegant'], callaArt()),
  // intermediate
  tpl('rose-open', 'Open rose in bloom', 'intermediate', ['rose', 'flower', 'garden', 'love', 'valentine'], roseOpenArt()),
  tpl('tulip-bunch', 'Bunch of tulips', 'intermediate', ['tulip', 'bouquet', 'flower', 'spring', 'gift'], tulipBunchArt()),
  tpl('star-lily', 'Star lily', 'intermediate', ['lily', 'flower', 'stamens', 'summer', 'elegant'], starLilyArt()),
  tpl('bearded-iris', 'Bearded iris', 'intermediate', ['iris', 'flower', 'garden', 'spring', 'elegant'], irisArt()),
  tpl('daffodil', 'Daffodil', 'intermediate', ['daffodil', 'flower', 'spring', 'easter', 'garden'], daffodilArt()),
  tpl('magnolia-branch', 'Magnolia branch', 'intermediate', ['magnolia', 'branch', 'blossom', 'flower', 'spring'], magnoliaArt()),
  tpl('hibiscus', 'Hibiscus flower', 'intermediate', ['hibiscus', 'flower', 'tropical', 'summer', 'island'], hibiscusArt()),
  tpl('ivy-vine', 'Trailing ivy vine', 'intermediate', ['ivy', 'vine', 'leaf', 'climbing', 'botanical'], ivyArt()),
  tpl('eucalyptus-stems', 'Silver dollar eucalyptus', 'intermediate', ['eucalyptus', 'leaf', 'stems', 'wedding', 'botanical'], eucalyptusArt()),
  tpl('succulent-trio', 'Succulent trio in a bowl', 'intermediate', ['succulent', 'plant', 'echeveria', 'aloe', 'pot'], succulentTrioArt()),
  tpl('rosemary-sprig', 'Rosemary sprig', 'intermediate', ['rosemary', 'herb', 'sprig', 'kitchen', 'botanical'], rosemaryArt()),
  tpl('laurel-wreath', 'Leafy laurel wreath', 'intermediate', ['laurel', 'wreath', 'leaf', 'victory', 'botanical'], laurelWreathArt()),
  tpl('pressed-sprig', 'Pressed flower sprig', 'intermediate', ['pressed', 'flower', 'sprig', 'journal', 'scrapbook'], pressedSprigArt()),
  tpl('flower-border', 'Flower border', 'intermediate', ['flower', 'border', 'vine', 'blossom', 'card'], flowerBorderArt()),
  // advanced
  tpl('peony-bloom', 'Peony in full bloom', 'advanced', ['peony', 'flower', 'bloom', 'wedding', 'romantic'], peonyArt()),
  tpl('orchid-spray', 'Phalaenopsis orchid spray', 'advanced', ['orchid', 'flower', 'tropical', 'elegant', 'realistic'], orchidArt()),
  tpl('climbing-rose', 'Climbing rose on a trellis', 'advanced', ['rose', 'climbing', 'trellis', 'garden', 'flower'], climbingRoseArt()),
  tpl('wildflower-bouquet', 'Wildflower bouquet in paper', 'advanced', ['wildflower', 'bouquet', 'daisy', 'cornflower', 'gift'], wildBouquetArt()),
  tpl('fern-fiddleheads', 'Fern with fiddleheads', 'advanced', ['fern', 'frond', 'fiddlehead', 'woodland', 'botanical'], fernFiddleArt()),
  tpl('floral-wreath', 'Rose & berry floral wreath', 'advanced', ['wreath', 'rose', 'flower', 'berries', 'wedding'], floralWreathArt()),
  tpl('corner-spray', 'Windflower corner spray', 'advanced', ['windflower', 'flower', 'corner', 'botanical', 'invitation'], cornerSprayArt()),
  tpl('poppy-trio', 'Poppies with seed heads', 'advanced', ['poppy', 'flower', 'seed', 'meadow', 'realistic'], poppyTrioArt()),
  tpl('cherry-twig', 'Cherry blossom twig with buds', 'advanced', ['blossom', 'cherry', 'sakura', 'branch', 'spring'], cherryTwigArt()),
  tpl('herb-bundle', 'Tied herb bundle', 'advanced', ['herb', 'sprig', 'rosemary', 'basil', 'mint'], herbBundleArt()),
];
