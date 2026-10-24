// Birds & insects batch 2 (fb-1023b T135, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Generic birds and insects of our own design (no mascots, no characters), built from smooth closed curves, tapered
// tubes and ellipses whose overlaps are hidden with occlude.ts so each piece reads as one clean drawing. Beginner pieces
// are bold outlines, intermediate ones add markings and feather lines, advanced ones add barring, veins and hatching.
// The small drawing helpers below are shared with flowers2.ts.
import type { Template, TemplateCategory, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, mirrorX, petal, poly, polar, rotate, type P } from './draw.ts';
import { clip, outline, region, roundPoly, samplePath, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

export type Art = { p: string[]; d: string[] };

// ---- shared helpers ----------------------------------------------------------------------------------------------

/** Smooth closed (or open) curve through points (Catmull-Rom as cubic Béziers). */
export function smooth(pts: readonly P[], closed = true): string {
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

/** Points along a Catmull-Rom curve through pts. */
export function curvePts(pts: readonly P[], per = 5): P[] {
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

function tangent(c: readonly P[], i: number): P {
  const a = c[Math.max(0, i - 1)];
  const b = c[Math.min(c.length - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}

/** Closed tube (leg, stem, branch, neck) along a curve, full width w0 tapering to w1, round ends. */
export function tube(pts: readonly P[], w0: number, w1: number): string {
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

/** Rotated ellipse. */
export const E = (cx: number, cy: number, rx: number, ry: number, deg = 0): string =>
  deg ? rotate(ellipse(cx, cy, rx, ry), deg, cx, cy) : ellipse(cx, cy, rx, ry);

/** A layered item: a closed silhouette (hides what is behind it) and its own lines. */
export type Item = { sil: Layer; p?: string[]; d?: string[] };
export const NONE = '';

/** Draw items front to back: each item's outline and lines are clipped by every item in front of it. */
export function layered(items: readonly Item[]): Art {
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

export const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });

/** Keep only the part of lines inside shape. */
export const inside = (lines: string, shape: Layer): string => clip(lines, [region(shape)], 'inside');

/** Map local (t along, s across) to a frame at base (bx, by) pointing at deg (0° = up), length len. */
export function frame(bx: number, by: number, deg: number, len: number): (t: number, s: number) => P {
  const [ux, uy] = polar(0, 0, 1, deg);
  const [nx, ny] = polar(0, 0, 1, deg + 90);
  return (t, s) => [bx + ux * len * t + nx * s, by + uy * len * t + ny * s];
}

/** Rounded (spoon) petal from a base point: widest near the tip. */
export function spoon(bx: number, by: number, deg: number, len: number, w: number): string {
  const q = frame(bx, by, deg, len);
  return smooth([q(0, w * 0.12), q(0.45, w * 0.75), q(0.85, w), q(1, 0), q(0.85, -w), q(0.45, -w * 0.75), q(0, -w * 0.12)]);
}

/** Ruffled petal: like spoon but the tip edge is scalloped into `waves` bumps. */
export function ruffle(bx: number, by: number, deg: number, len: number, w: number, waves = 3): string {
  const q = frame(bx, by, deg, len);
  const pts: P[] = [q(0, w * 0.12), q(0.5, w * 0.8), q(0.82, w)];
  const n = waves * 2;
  for (let i = 1; i < n; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / n;
    const r = i % 2 === 1 ? 1 : 0.9;
    pts.push(q(0.82 + 0.18 * Math.cos(a) * r, w * Math.sin(a) * r));
  }
  pts.push(q(0.82, -w), q(0.5, -w * 0.8), q(0, -w * 0.12));
  return smooth(pts);
}

/** Toothed (serrated) leaf outline from base pointing at deg. */
export function serrated(bx: number, by: number, deg: number, len: number, w: number, teeth = 7): string {
  const q = frame(bx, by, deg, len);
  const half = (side: number): P[] => {
    const out: P[] = [];
    for (let i = 1; i <= teeth * 2; i++) {
      const t = i / (teeth * 2 + 1);
      const env = Math.sin(Math.PI * Math.pow(t, 0.8)) * w;
      out.push(q(t + (i % 2 === 1 ? 0.02 : 0), side * env * (i % 2 === 1 ? 1.08 : 0.88)));
    }
    return out;
  };
  const right = half(1);
  const left = half(-1).reverse();
  return poly([q(0, 0), ...right, q(1, 0), ...left]);
}

/** Leaf with a midrib and a few side veins (veins returned separately). */
export function veinLeaf(bx: number, by: number, deg: number, len: number, w: number, veins = 4): { sil: string; d: string } {
  const q = frame(bx, by, deg, len);
  const sil = petal(bx, by, deg, len, w, 0.35);
  let d = `M ${f(q(0.02, 0)[0])} ${f(q(0.02, 0)[1])} L ${f(q(0.9, 0)[0])} ${f(q(0.9, 0)[1])}`;
  for (let i = 1; i <= veins; i++) {
    const t = 0.12 + (0.66 * i) / veins;
    const span = Math.sin(Math.PI * Math.min(0.95, t)) * w * 0.75;
    for (const s of [1, -1]) {
      const a = q(t - 0.02, 0);
      const b = q(t + 0.1, s * span);
      d += ` M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}`;
    }
  }
  return { sil, d: inside(d, sil) };
}

/** Mirror a list of paths across x = 200 and keep both sides. */
export const both = (ds: readonly string[]): string[] => [...ds, ...ds.map((d) => mirrorX(d, 200))];

export const dot = (x: number, y: number, r = 4): string => circle(x, y, r);

export function lines(segs: readonly (readonly [number, number, number, number])[]): string {
  return segs.map((s) => line(...s)).join(' ');
}

/** Short parallel strokes across a shape (barring / stripes), kept inside it. */
export function bars(shape: Layer, from: P, to: P, n: number, half: number, deg: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const c: P = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    const a = polar(c[0], c[1], half, deg);
    const b = polar(c[0], c[1], half, deg + 180);
    out.push(line(a[0], a[1], b[0], b[1]));
  }
  return inside(out.join(' '), shape);
}

/** Scalloped feather rows inside a shape: rows of small arcs (u-shapes) between y0 and y1. */
export function scallops(shape: Layer, x0: number, x1: number, y0: number, y1: number, size: number): string {
  let d = '';
  let row = 0;
  for (let y = y0; y <= y1; y += size * 0.8, row++) {
    for (let x = x0 + (row % 2) * (size / 2); x <= x1; x += size) {
      d += `M ${f(x - size / 2)} ${f(y)} Q ${f(x)} ${f(y + size * 0.7)} ${f(x + size / 2)} ${f(y)} `;
    }
  }
  return inside(d.trim(), shape);
}

/** Bird foot gripping a perch: three toes forward (pointing at dir) from (x, y). */
export function foot(x: number, y: number, dir = -1): string {
  return `M ${f(x)} ${f(y - 14)} L ${f(x)} ${f(y)} M ${f(x)} ${f(y)} Q ${f(x + dir * 8)} ${f(y - 2)} ${f(x + dir * 14)} ${f(y + 4)} M ${f(x)} ${f(y)} Q ${f(x + dir * 4)} ${f(y + 6)} ${f(x + dir * 7)} ${f(y + 10)} M ${f(x)} ${f(y)} Q ${f(x - dir * 6)} ${f(y + 3)} ${f(x - dir * 9)} ${f(y + 8)}`;
}

/** Eye: ring with a pupil. */
export const eye = (x: number, y: number, r: number): string[] => [circle(x, y, r), circle(x - r * 0.15, y - r * 0.1, r * 0.45)];

/** Shrink a drawing about the canvas centre just enough that every sampled point lies inside 18..382. */
function fit(art: Art): Art {
  let worst = 0;
  for (const d of [...art.p, ...art.d]) {
    for (const sub of samplePath(d, 4)) for (const [x, y] of sub.pts) worst = Math.max(worst, Math.abs(x - 200), Math.abs(y - 200));
  }
  if (worst <= 182) return art;
  const k = 182 / worst;
  const t = { map: (x: number, y: number): P => [200 + (x - 200) * k, 200 + (y - 200) * k], scale: k, rotate: 0, flip: false };
  return { p: art.p.map((d) => mapPath(d, t)), d: art.d.map((d) => mapPath(d, t)) };
}

export function makeTpl(prefix: string, category: TemplateCategory) {
  return (id: string, name: string, level: TemplateLevel, tags: string[], raw: Art): Template => {
    const art = fit({ p: raw.p.filter(Boolean), d: raw.d.filter(Boolean) });
    const detail = art.d.filter(Boolean);
    return {
      id: `${prefix}-${id}`,
      name,
      category,
      level,
      tags,
      viewBox: VB,
      paths: art.p.filter(Boolean),
      ...(detail.length ? { detail } : {}),
    };
  };
}

const tpl = makeTpl('wild2', 'wildlife');

/** Horizontal branch with a couple of knots. */
function branchTube(pts: readonly P[], w0: number, w1: number): string {
  return tube(pts, w0, w1);
}

// ---- beginner ----------------------------------------------------------------------------------------------------

function kingfisherArt(): Art {
  const head = circle(150, 150, 40);
  const body = smooth([[132, 178], [196, 164], [250, 186], [276, 230], [254, 268], [204, 278], [160, 252], [138, 214]]);
  const wing = smooth([[178, 186], [232, 190], [282, 236], [304, 276], [256, 266], [198, 236]]);
  return layered([
    { sil: head, p: eye(142, 140, 8), d: ['M 160 160 Q 178 166 186 182', 'M 116 156 Q 132 168 150 168'] },
    { sil: roundPoly([[120, 136], [36, 156], [118, 166]], 3), d: ['M 118 152 L 60 155'] },
    { sil: wing, d: ['M 214 206 Q 248 226 268 256', 'M 206 222 Q 236 240 252 262'] },
    { sil: body, d: ['M 150 214 Q 170 248 206 262'] },
    { sil: roundPoly([[262, 252], [330, 286], [318, 302], [252, 272]], 6) },
    { sil: NONE, p: [foot(196, 286), foot(222, 286)] },
    { sil: branchTube([[30, 296], [200, 290], [374, 304]], 18, 12), d: ['M 300 294 Q 312 276 330 270', 'M 90 296 L 84 306'] },
  ]);
}

function toucanArt(): Art {
  const head = circle(224, 128, 36);
  const beak = smooth([[200, 110], [150, 96], [92, 104], [56, 128], [74, 146], [128, 150], [196, 150]]);
  const body = smooth([[196, 150], [250, 140], [282, 200], [276, 268], [244, 300], [206, 280], [194, 220]]);
  const wing = smooth([[238, 168], [282, 186], [294, 250], [276, 300], [252, 270], [240, 220]]);
  return layered([
    { sil: head, p: [circle(224, 122, 13), dot(222, 121, 5)] },
    { sil: beak, p: ['M 196 128 Q 140 120 66 136'], d: ['M 120 100 Q 110 124 116 148'] },
    { sil: wing, d: ['M 252 196 Q 270 230 270 272', 'M 262 186 Q 284 220 282 252'] },
    { sil: body, d: [inside('M 196 176 Q 222 196 214 150', body), 'M 200 232 Q 226 252 236 290'] },
    { sil: roundPoly([[246, 286], [280, 286], [290, 360], [252, 362]], 8), d: ['M 268 296 L 272 356'] },
    { sil: NONE, p: [foot(226, 300, -1), foot(248, 302, -1)] },
    { sil: branchTube([[40, 312], [200, 308], [370, 296]], 18, 13), d: ['M 110 312 Q 98 330 84 336'] },
  ]);
}

function pelicanArt(): Art {
  const body = smooth([[176, 210], [240, 178], [320, 186], [356, 214], [330, 252], [262, 270], [200, 262], [170, 238]]);
  const neck = tube([[196, 226], [174, 176], [172, 132], [182, 104]], 40, 30);
  const head = E(190, 98, 30, 24, -10);
  const pouch = smooth([[170, 112], [130, 124], [72, 126], [100, 150], [150, 152], [180, 130]]);
  const upper = roundPoly([[178, 88], [40, 112], [42, 120], [176, 112]], 4);
  return layered([
    { sil: head, p: eye(196, 92, 6), d: ['M 206 82 Q 222 80 230 90'] },
    { sil: upper },
    { sil: pouch, d: ['M 150 136 Q 110 140 86 132'] },
    { sil: smooth([[230, 190], [300, 188], [348, 214], [310, 236], [252, 232]]), d: ['M 262 204 Q 296 210 326 222', 'M 256 218 Q 290 226 318 232'] },
    { sil: neck },
    { sil: body },
    { sil: tube([[236, 264], [234, 310], [240, 340]], 12, 9), d: [] },
    { sil: tube([[272, 264], [278, 308], [284, 340]], 12, 9) },
    { sil: NONE, p: ['M 220 346 Q 240 336 262 348 L 240 342 Z', 'M 266 346 Q 286 336 306 348 L 284 342 Z', line(30, 356, 370, 356)] },
  ]);
}

function crowArt(): Art {
  const head = circle(150, 128, 34);
  const body = smooth([[140, 152], [210, 150], [262, 182], [278, 226], [240, 252], [182, 246], [146, 214]]);
  const wing = smooth([[184, 170], [244, 172], [300, 214], [334, 250], [276, 246], [206, 226]]);
  return layered([
    { sil: head, p: eye(140, 120, 6) },
    { sil: roundPoly([[124, 116], [70, 138], [126, 146]], 5), d: ['M 124 132 L 82 137'] },
    { sil: wing, d: ['M 228 194 Q 268 214 300 240', 'M 216 210 Q 252 226 280 244', 'M 300 238 L 318 248'] },
    { sil: body },
    { sil: roundPoly([[262, 222], [340, 262], [330, 278], [254, 240]], 6) },
    { sil: NONE, p: ['M 196 248 L 196 266', 'M 220 250 L 220 266', foot(196, 268), foot(220, 268)] },
    { sil: poly([[150, 274], [270, 274], [270, 290], [150, 290]]), d: ['M 160 282 L 260 282'] },
    { sil: poly([[180, 290], [240, 290], [240, 370], [180, 370]]), d: ['M 196 300 L 196 360', 'M 222 310 L 222 352'] },
  ]);
}

function bumbleBeeArt(): Art {
  const body = E(200, 238, 70, 92);
  const thorax = circle(200, 150, 50);
  const head = circle(200, 92, 34);
  const stripes = inside('M 120 210 Q 200 230 280 210 M 120 254 Q 200 274 280 254 M 120 298 Q 200 314 280 298', body);
  return layered([
    { sil: head, p: [...eye(186, 88, 7), ...eye(214, 88, 7), 'M 190 106 Q 200 112 210 106'] },
    { sil: NONE, p: ['M 188 62 Q 176 36 158 30', 'M 212 62 Q 224 36 242 30', dot(156, 30, 5), dot(244, 30, 5)] },
    { sil: thorax },
    { sil: spoon(166, 150, -60, 120, 34), d: ['M 160 146 Q 110 130 76 100'] },
    { sil: spoon(234, 150, 60, 120, 34), d: ['M 240 146 Q 290 130 324 100'] },
    { sil: body, p: [stripes], d: ['M 196 324 L 200 338 L 204 324'] },
    { sil: NONE, p: both(['M 146 176 L 112 196 L 104 222', 'M 140 230 L 106 254 L 104 282', 'M 146 280 L 120 312 L 124 340']) },
  ]);
}

function antArt(): Art {
  const head = E(108, 168, 34, 28, -10);
  const thorax = E(186, 194, 40, 18, 10);
  const abdomen = E(286, 210, 66, 48, 8);
  const leg = (pts: P[]) => tube(pts, 7, 5);
  return layered([
    { sil: head, p: eye(96, 162, 6), d: ['M 82 186 Q 90 192 98 186'] },
    { sil: NONE, p: ['M 112 142 L 120 100 L 90 70', 'M 100 144 L 96 104 L 62 82'] },
    { sil: thorax },
    { sil: E(234, 202, 14, 12) },
    { sil: abdomen, d: [inside('M 250 176 Q 238 210 254 252 M 286 164 Q 274 210 290 258', abdomen)] },
    { sil: leg([[170, 206], [140, 248], [118, 290]]) },
    { sil: leg([[186, 208], [184, 254], [168, 300]]) },
    { sil: leg([[206, 206], [242, 262], [244, 304]]) },
    { sil: NONE, p: [line(30, 312, 370, 312)] },
  ]);
}

function caterpillarArt(): Art {
  const c = curvePts([[96, 160], [130, 200], [180, 214], [230, 196], [276, 198], [320, 226]], 3);
  const seg = c.filter((_, i) => i % 2 === 0).slice(0, 9);
  const items: { sil: string; d?: string[]; p?: string[] }[] = [];
  items.push({ sil: circle(84, 150, 36), p: [...eye(72, 140, 7), ...eye(98, 140, 7), 'M 72 162 Q 84 172 96 162'], d: ['M 70 116 Q 60 90 48 84', 'M 96 116 Q 104 90 118 84'] });
  seg.forEach(([x, y], i) => {
    const r = 30 - i * 1.4;
    items.push({ sil: circle(x + 10, y, r), d: [`M ${f(x + 4)} ${f(y + r)} L ${f(x + 2)} ${f(y + r + 12)} M ${f(x + 18)} ${f(y + r)} L ${f(x + 20)} ${f(y + r + 12)}`] });
  });
  const leafS = veinLeaf(120, 330, 70, 240, 42, 5);
  items.push({ sil: leafS.sil, d: [leafS.d] });
  items.push({ sil: tube([[30, 360], [90, 340], [126, 330]], 10, 8) });
  return layered(items);
}

function spiderArt(): Art {
  const web: string[] = [];
  const cx = 200;
  const cy = 170;
  for (let i = 0; i < 12; i++) {
    const [x, y] = polar(cx, cy, 150, i * 30);
    web.push(line(cx, cy, x, Math.max(20, Math.min(380, y))));
  }
  const spiral: string[] = [];
  for (let r = 34; r <= 140; r += 22) {
    const pts: P[] = [];
    for (let i = 0; i <= 12; i++) pts.push(polar(cx, cy, r, i * 30));
    spiral.push(poly(pts, false));
  }
  const body = E(200, 250, 30, 38);
  const head = circle(200, 206, 20);
  const legs = both(['M 182 222 Q 150 196 132 214 Q 120 228 112 244', 'M 180 236 Q 140 226 124 250 L 110 270', 'M 180 254 Q 146 262 138 290 L 132 312', 'M 184 270 Q 160 290 162 318 L 160 340']);
  return join(
    layered([
      { sil: head, p: [dot(193, 202, 3.5), dot(207, 202, 3.5)] },
      { sil: body, d: [inside('M 186 240 Q 200 250 214 240 M 188 262 Q 200 270 212 262', body)] },
      { sil: NONE, p: legs },
      { sil: NONE, d: [...web, ...spiral] },
    ]),
  );
}

function fireflyArt(): Art {
  const head = circle(112, 176, 24);
  const thorax = E(156, 182, 30, 26, 10);
  const glow = E(286, 238, 46, 38, 20);
  const shell = spoon(168, 172, 112, 150, 30);
  const under = spoon(168, 166, 66, 150, 24);
  const rays: string[] = [];
  for (let i = 0; i < 9; i++) {
    const a = 40 + i * 25;
    const [x1, y1] = polar(300, 246, 62, a);
    const [x2, y2] = polar(300, 246, 84, a);
    rays.push(line(x1, y1, x2, y2));
  }
  const twinkle = (x: number, y: number, r: number) => poly([[x, y - r], [x + r * 0.25, y - r * 0.25], [x + r, y], [x + r * 0.25, y + r * 0.25], [x, y + r], [x - r * 0.25, y + r * 0.25], [x - r, y], [x - r * 0.25, y - r * 0.25]]);
  return layered([
    { sil: head, p: eye(104, 172, 7), d: ['M 96 190 Q 104 196 112 190'] },
    { sil: NONE, p: ['M 106 154 Q 96 110 64 90', 'M 118 154 Q 124 106 104 70'] },
    { sil: shell, d: ['M 178 184 Q 240 210 300 228', 'M 180 172 L 196 168'] },
    { sil: thorax },
    { sil: under, d: ['M 178 160 Q 240 120 300 110'] },
    { sil: glow, d: [inside('M 262 214 Q 252 240 266 270 M 290 208 Q 282 238 296 272', glow)] },
    { sil: NONE, p: [tube([[146, 204], [126, 236], [130, 262]], 7, 5), tube([[166, 206], [164, 242], [176, 266]], 7, 5)], d: [...rays, twinkle(330, 80, 16), twinkle(70, 300, 12), twinkle(360, 340, 10)] },
  ]);
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function woodpeckerArt(): Art {
  const trunk = poly([[262, 16], [372, 16], [376, 384], [258, 384]]);
  const body = smooth([[168, 150], [214, 128], [248, 168], [258, 232], [244, 290], [214, 300], [186, 262], [170, 204]]);
  const head = circle(176, 118, 32);
  const wing = smooth([[200, 150], [240, 168], [256, 236], [246, 296], [222, 266], [206, 206]]);
  const bark: string[] = [];
  for (let i = 0; i < 9; i++) bark.push(`M ${f(276 + i * 11)} ${f(20 + (i % 3) * 30)} Q ${f(270 + i * 11)} 200 ${f(278 + i * 11)} ${f(380 - (i % 2) * 40)}`);
  return layered([
    { sil: head, p: eye(168, 112, 6), d: ['M 150 128 Q 170 140 196 132', 'M 160 92 Q 180 80 204 96'] },
    { sil: smooth([[156, 94], [180, 72], [212, 86], [204, 102], [176, 92]]) },
    { sil: roundPoly([[150, 108], [92, 126], [150, 130]], 3) },
    { sil: wing, d: [bars(wing, [210, 170], [240, 280], 6, 20, 70)] },
    { sil: body, d: ['M 184 160 Q 176 210 196 268'] },
    { sil: roundPoly([[226, 280], [256, 284], [262, 364], [244, 366]], 6), d: ['M 246 292 L 252 360'] },
    { sil: NONE, p: ['M 236 196 Q 252 196 260 186 M 248 200 L 262 204', 'M 230 244 Q 250 246 260 238 M 246 250 L 262 254'] },
    { sil: E(320, 130, 16, 22), d: [] },
    { sil: trunk, d: bark },
    { sil: NONE, d: ['M 74 112 L 60 104 M 72 124 L 54 126 M 76 136 L 62 146'] },
  ]);
}

function magpieArt(): Art {
  const head = circle(110, 150, 32);
  const body = smooth([[100, 172], [160, 160], [214, 182], [232, 226], [200, 252], [148, 248], [112, 216]]);
  const belly = smooth([[118, 196], [160, 196], [196, 222], [178, 246], [140, 240], [118, 220]]);
  const wing = smooth([[146, 180], [204, 180], [246, 214], [264, 236], [214, 238], [160, 214]]);
  const tail = smooth([[222, 220], [300, 236], [376, 262], [370, 276], [296, 262], [216, 240]]);
  return layered([
    { sil: head, p: eye(102, 142, 6) },
    { sil: roundPoly([[84, 140], [40, 154], [86, 160]], 4) },
    { sil: wing, p: [inside('M 156 196 Q 190 196 220 214 Q 190 220 166 210 Z', wing)], d: ['M 218 222 L 254 234', 'M 206 228 L 240 238'] },
    { sil: body, p: [inside(belly, body)] },
    { sil: tail, d: ['M 236 232 Q 300 246 368 268'] },
    { sil: NONE, p: ['M 152 248 L 152 268', 'M 172 248 L 172 268', foot(152, 270), foot(172, 270)] },
    { sil: branchTube([[24, 282], [180, 276], [300, 290]], 16, 10), d: ['M 240 284 Q 256 304 276 312'] },
    { sil: NONE, d: ['M 300 290 Q 320 300 340 296'] },
  ]);
}

function storkArt(): Art {
  const body = smooth([[176, 160], [236, 150], [300, 172], [340, 206], [300, 222], [230, 220], [184, 196]]);
  const wingTip = smooth([[240, 174], [306, 180], [356, 210], [370, 226], [320, 224], [262, 206]]);
  const neck = tube([[196, 178], [168, 130], [150, 96], [156, 74]], 26, 20);
  const head = E(158, 66, 22, 18);
  return layered([
    { sil: head, p: eye(154, 62, 5) },
    { sil: roundPoly([[140, 58], [56, 96], [140, 76]], 3), d: ['M 140 67 L 78 88'] },
    { sil: neck, d: ['M 168 104 L 160 112 M 172 118 L 164 126'] },
    { sil: wingTip, d: ['M 280 194 L 346 214', 'M 270 202 L 330 220', 'M 300 186 L 360 212'] },
    { sil: body, d: ['M 214 176 Q 250 168 280 182'] },
    { sil: tube([[242, 216], [236, 270], [222, 300], [226, 360]], 8, 6) },
    { sil: tube([[264, 216], [272, 280], [286, 354]], 8, 6) },
    { sil: NONE, p: ['M 206 364 L 226 360 L 248 364', 'M 268 358 L 286 354 L 308 360', line(40, 368, 360, 368)], d: ['M 70 340 Q 76 320 72 300 M 80 342 Q 92 324 96 310', 'M 330 344 Q 334 326 328 312'] },
  ]);
}

function cockatooArt(): Art {
  const head = circle(200, 150, 46);
  const crest = [0, 1, 2, 3, 4].map((i) => spoon(206 - i * 4, 112, -40 + i * 18, 92 - Math.abs(i - 2) * 8, 13));
  const body = smooth([[160, 176], [232, 176], [262, 236], [252, 306], [210, 330], [170, 306], [150, 240]]);
  const wing = smooth([[222, 196], [266, 224], [270, 300], [246, 350], [224, 300], [216, 240]]);
  return layered([
    { sil: head, p: [circle(186, 144, 9), dot(185, 143, 4.5)], d: ['M 170 166 Q 160 176 162 190'] },
    { sil: smooth([[164, 152], [148, 160], [140, 184], [152, 196], [160, 180], [170, 176]]), d: ['M 150 172 Q 158 176 166 170'] },
    { sil: crest, d: crest.map((_, i) => { const a = polar(206 - i * 4, 112, 70 - Math.abs(i - 2) * 8, -40 + i * 18); return line(206 - i * 4, 116, a[0], a[1]); }) },
    { sil: wing, d: ['M 232 232 Q 248 268 244 320', 'M 244 220 Q 262 252 260 296'] },
    { sil: body, d: [scallops(body, 168, 226, 196, 290, 18)] },
    { sil: roundPoly([[214, 314], [246, 314], [256, 384], [222, 384]], 8), d: ['M 234 322 L 238 380'] },
    { sil: NONE, p: [foot(190, 336, -1), foot(216, 338, -1)] },
    { sil: branchTube([[30, 348], [200, 342], [370, 334]], 18, 12) },
  ]);
}

function mantisArt(): Art {
  const thorax = tube([[188, 210], [168, 160], [160, 120]], 16, 12);
  const head = roundPoly([[118, 84], [182, 78], [160, 132]], 12);
  const abdomen = smooth([[196, 200], [250, 214], [318, 232], [350, 250], [320, 262], [244, 246], [196, 226]]);
  const wing = smooth([[194, 200], [262, 206], [336, 238], [310, 246], [236, 230], [196, 218]]);
  return layered([
    { sil: head, p: [circle(134, 94, 10), dot(132, 93, 4), 'M 150 116 L 160 122'], d: ['M 146 80 Q 120 50 96 44', 'M 160 80 Q 150 46 136 30'] },
    { sil: tube([[166, 136], [128, 166], [124, 136], [116, 110]], 14, 8), d: ['M 132 160 L 124 166 M 126 148 L 118 152 M 122 132 L 114 134'] },
    { sil: tube([[162, 146], [112, 176], [108, 148], [98, 120]], 12, 7) },
    { sil: thorax },
    { sil: wing, d: ['M 210 210 Q 270 220 326 240', 'M 230 214 Q 280 226 300 244'] },
    { sil: abdomen, d: [inside('M 252 214 Q 246 232 252 252 M 280 220 Q 274 238 280 256 M 308 228 Q 302 244 308 258', abdomen)] },
    { sil: tube([[200, 222], [220, 270], [210, 306]], 6, 5) },
    { sil: tube([[208, 224], [258, 268], [276, 304]], 6, 5) },
    { sil: tube([[190, 214], [176, 262], [160, 302]], 6, 5) },
    { sil: tube([[60, 380], [160, 306], [290, 310], [384, 294]], 12, 8), d: [] },
  ]);
}

function stagBeetleArt(): Art {
  const elytra = smooth([[200, 196], [262, 206], [278, 270], [254, 340], [200, 364], [146, 340], [122, 270], [138, 206]]);
  const pronotum = E(200, 168, 66, 34);
  const jaw = 'M 172 112 Q 150 70 160 30 Q 168 50 176 54 Q 172 68 184 84 L 190 108 Z';
  const legPts: P[][] = [[[146, 162], [98, 140], [80, 108]], [[136, 230], [86, 238], [64, 270]], [[142, 290], [104, 320], [98, 360]]];
  const legs = legPts.map((pts) => tube(pts, 9, 6));
  return layered([
    { sil: [jaw, mirrorX(jaw, 200)], d: ['M 164 64 L 156 58', mirrorX('M 164 64 L 156 58', 200)] },
    { sil: roundPoly([[150, 110], [250, 110], [242, 148], [158, 148]], 10), p: [dot(160, 122, 6), dot(240, 122, 6)] },
    { sil: NONE, p: both(['M 156 116 Q 126 104 118 82 L 110 72']) },
    { sil: pronotum, d: ['M 158 172 Q 200 186 242 172'] },
    { sil: elytra, p: ['M 200 196 L 200 362'], d: [inside('M 166 220 Q 156 280 172 336 M 234 220 Q 244 280 228 336', elytra)] },
    { sil: both(legs) },
  ]);
}

function damselflyArt(): Art {
  const head = circle(92, 196, 20);
  const thorax = E(134, 202, 28, 18, 4);
  const body = tube([[156, 204], [230, 206], [300, 210], [370, 214]], 11, 7);
  const wingA = spoon(150, 194, 76, 196, 15);
  const wingB = spoon(146, 190, 66, 190, 15);
  const segs: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 180 + i * 21;
    segs.push(line(x, 196, x, 220));
  }
  const reed = tube([[214, 384], [208, 300], [196, 230], [190, 210]], 12, 9);
  return layered([
    { sil: head, p: [circle(86, 190, 10), dot(84, 189, 4)] },
    { sil: wingA, d: ['M 158 192 Q 250 166 336 160'] },
    { sil: wingB, d: ['M 152 186 Q 240 140 324 124'] },
    { sil: thorax, d: ['M 120 196 Q 136 190 150 198'] },
    { sil: body, d: [inside(segs.join(' '), body)] },
    { sil: NONE, p: ['M 124 216 L 146 240 L 188 236', 'M 140 218 L 170 246 L 200 246', 'M 112 212 L 120 240 L 186 232'] },
    { sil: reed, d: ['M 210 360 L 206 300'] },
    { sil: petal(96, 382, -14, 210, 11), d: ['M 97 372 L 76 250'] },
    { sil: petal(300, 382, 18, 180, 10), d: ['M 302 372 L 344 254'] },
  ]);
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function wrenArt(): Art {
  const head = circle(150, 150, 38);
  const body = smooth([[136, 170], [196, 156], [252, 182], [268, 230], [236, 268], [182, 270], [142, 236], [128, 200]]);
  const wing = smooth([[178, 184], [236, 186], [270, 230], [254, 260], [210, 244], [186, 214]]);
  const tail = smooth([[236, 196], [262, 150], [288, 100], [306, 106], [288, 160], [262, 208]]);
  const branch = branchTube([[24, 300], [140, 288], [260, 294], [380, 278]], 18, 12);
  const thorn = (x: number, y: number, s = 1) => poly([[x - 5, y], [x + 1, y - 13 * s], [x + 6, y]]);
  const leafA = veinLeaf(300, 286, 30, 70, 18, 3);
  const leafB = veinLeaf(80, 296, -40, 62, 16, 3);
  const leafC = veinLeaf(340, 280, 110, 50, 14, 3);
  return layered([
    { sil: head, p: eye(140, 144, 6), d: ['M 116 132 Q 146 120 178 138', 'M 120 152 Q 140 162 166 158', scallops(head, 144, 184, 114, 132, 9)] },
    { sil: roundPoly([[114, 142], [86, 152], [116, 154]], 2) },
    { sil: tail, d: [bars(tail, [250, 184], [292, 112], 7, 16, 60), 'M 262 196 L 296 108'] },
    { sil: wing, d: [bars(wing, [194, 196], [256, 246], 7, 16, 30), 'M 216 228 L 250 254', 'M 206 234 L 238 258'] },
    { sil: body, d: [scallops(body, 150, 230, 196, 254, 12), 'M 136 206 Q 150 236 180 254'] },
    { sil: NONE, p: [foot(184, 284), foot(208, 282)] },
    { sil: leafA.sil, d: [leafA.d] },
    { sil: leafC.sil, d: [leafC.d] },
    { sil: leafB.sil, d: [leafB.d] },
    { sil: branch, p: [thorn(56, 292), thorn(232, 287), thorn(330, 276, 0.8)], d: ['M 110 298 Q 140 292 170 298', 'M 250 296 Q 280 290 300 292'] },
  ]);
}

function cicadaArt(): Art {
  const wing = smooth([[178, 150], [140, 170], [84, 250], [70, 330], [96, 366], [150, 330], [186, 250], [194, 170]]);
  const hind = smooth([[180, 186], [130, 214], [104, 268], [124, 290], [168, 260], [190, 210]]);
  const veins = inside('M 184 170 Q 120 240 98 352 M 186 186 Q 150 260 140 336 M 182 156 Q 110 220 82 300 M 116 286 Q 132 300 150 300 M 96 318 Q 120 324 140 316 M 132 228 Q 150 236 170 230 M 104 260 Q 130 262 160 258', wing);
  const hindVeins = inside('M 182 196 Q 140 226 118 270 M 184 210 Q 158 240 150 270', hind);
  const head = smooth([[150, 92], [200, 80], [250, 92], [244, 122], [200, 130], [156, 122]]);
  const thorax = smooth([[150, 124], [200, 116], [250, 124], [258, 168], [236, 196], [200, 204], [164, 196], [142, 168]]);
  const abdomen = smooth([[164, 196], [236, 196], [240, 260], [222, 310], [200, 324], [178, 310], [160, 260]]);
  const segs = inside('M 160 216 Q 200 226 240 216 M 162 236 Q 200 246 238 236 M 166 256 Q 200 266 234 256 M 172 276 Q 200 286 228 276 M 180 296 Q 200 304 220 296', abdomen);
  return layered([
    { sil: head, p: [E(150, 102, 13, 16), E(250, 102, 13, 16)], d: ['M 186 106 L 214 106', dot(190, 92, 3), dot(210, 92, 3), dot(200, 88, 3)] },
    { sil: thorax, d: ['M 172 140 Q 200 156 228 140', 'M 200 124 L 200 196', 'M 176 172 Q 200 186 224 172'] },
    { sil: [wing, mirrorX(wing, 200)], d: [veins, mirrorX(veins, 200)] },
    { sil: [hind, mirrorX(hind, 200)], d: [hindVeins, mirrorX(hindVeins, 200)] },
    { sil: abdomen, d: [segs] },
    { sil: NONE, p: both(['M 150 140 L 112 120 L 100 92', 'M 148 160 L 108 168 L 92 196']) },
  ]);
}

function eagleArt(): Art {
  const head = smooth([[120, 128], [160, 100], [220, 90], [280, 94], [318, 120], [336, 170], [346, 250], [360, 340], [300, 380], [220, 380], [204, 300], [176, 240], [140, 206], [124, 180]]);
  const beak = smooth([[130, 120], [92, 120], [58, 130], [38, 152], [32, 186], [42, 198], [52, 180], [74, 172], [110, 172], [134, 180]]);
  const lower = smooth([[70, 186], [100, 180], [132, 186], [120, 206], [86, 204]]);
  const feathers: string[] = [];
  const rows: [number, number, number][] = [[230, 150, 6], [250, 190, 6], [262, 232, 6], [270, 274, 6], [282, 316, 6], [296, 356, 5]];
  rows.forEach(([x, y, n], r) => {
    for (let i = 0; i < n; i++) {
      const cx = x + i * 16 - (r % 2) * 8 - 40;
      feathers.push(`M ${f(cx - 10)} ${f(y - 10 + i * 2)} Q ${f(cx)} ${f(y + 8 + i * 2)} ${f(cx + 12)} ${f(y - 6 + i * 2)}`);
    }
  });
  const scal = inside(feathers.join(' '), head);
  const nape = inside('M 300 100 Q 290 140 310 170 M 318 140 Q 304 190 330 220 M 330 200 Q 320 250 342 280 M 340 260 Q 330 310 352 340', head);
  const brow = smooth([[138, 132], [166, 116], [206, 120], [196, 130], [166, 128]]);
  return layered([
    { sil: brow },
    { sil: lower },
    { sil: beak, p: ['M 134 180 Q 100 174 74 184'], d: ['M 120 126 Q 112 150 120 176', 'M 96 136 Q 76 146 64 166'] },
    { sil: NONE, p: [E(172, 146, 15, 12), circle(174, 146, 6)], d: ['M 152 158 Q 170 168 190 156'] },
    { sil: head, d: [scal, nape, 'M 186 176 Q 210 206 230 260', 'M 214 112 Q 250 116 280 140', 'M 200 300 Q 210 340 220 380'] },
  ]);
}

function grasshopperArt(): Art {
  const head = smooth([[90, 162], [118, 140], [146, 150], [150, 190], [130, 210], [100, 204]]);
  const thorax = smooth([[140, 152], [196, 148], [212, 176], [196, 206], [148, 206]]);
  const abdomen = smooth([[196, 168], [270, 170], [340, 186], [356, 202], [330, 214], [264, 214], [196, 206]]);
  const wing = smooth([[170, 156], [260, 152], [346, 174], [342, 186], [260, 176], [176, 176]]);
  const femur = smooth([[208, 196], [252, 168], [300, 150], [320, 156], [300, 176], [236, 208], [212, 214]]);
  const tibia = tube([[312, 160], [290, 230], [262, 290]], 9, 6);
  const spines: string[] = [];
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const x = 312 + (262 - 312) * t + (t < 0.5 ? -10 * t : -5);
    const y = 160 + (290 - 160) * t;
    spines.push(line(x + 2, y, x - 8, y - 6));
  }
  const blade = tube([[20, 330], [140, 300], [260, 300], [384, 280]], 14, 8);
  return layered([
    { sil: head, p: eye(112, 162, 8), d: ['M 100 196 L 92 210 M 112 202 L 108 216', 'M 132 156 Q 140 180 132 204'] },
    { sil: NONE, p: ['M 112 142 Q 120 80 170 36', 'M 104 146 Q 96 90 120 40'] },
    { sil: femur, d: [inside('M 222 196 L 236 180 M 236 194 L 250 176 M 250 190 L 264 170 M 264 182 L 278 164 M 278 176 L 292 160 M 230 186 Q 270 170 306 156', femur)] },
    { sil: tibia, d: spines },
    { sil: thorax, d: ['M 152 172 Q 176 168 200 176', 'M 160 186 Q 178 192 196 188'] },
    { sil: wing, d: [inside('M 186 162 Q 260 158 340 178 M 200 170 Q 270 166 330 182 M 220 154 L 226 176 M 250 154 L 256 176 M 280 158 L 284 178 M 310 164 L 314 182', wing)] },
    { sil: abdomen, d: [inside('M 222 170 L 220 212 M 246 170 L 244 214 M 270 172 L 268 214 M 294 176 L 292 214 M 318 182 L 316 214', abdomen)] },
    { sil: tube([[150, 200], [134, 250], [122, 296]], 8, 6) },
    { sil: tube([[178, 204], [184, 254], [176, 300]], 8, 6) },
    { sil: blade, d: ['M 40 324 Q 160 296 370 284'] },
  ]);
}

// ---- catalogue ---------------------------------------------------------------------------------------------------

export const wild2: Template[] = [
  // beginner
  tpl('river-bird', 'Kingfisher bird on a branch', 'beginner', ['kingfisher', 'bird', 'river', 'branch', 'stylized'], kingfisherArt()),
  tpl('toucan', 'Toucan bird', 'beginner', ['toucan', 'bird', 'tropical', 'jungle', 'stylized'], toucanArt()),
  tpl('pelican', 'Standing pelican bird', 'beginner', ['pelican', 'bird', 'waterbird', 'coast', 'stylized'], pelicanArt()),
  tpl('crow', 'Crow bird on a fence post', 'beginner', ['crow', 'bird', 'fence', 'countryside', 'stylized'], crowArt()),
  tpl('bumblebee', 'Fuzzy bumble bee', 'beginner', ['bee', 'bumblebee', 'insect', 'garden', 'stylized'], bumbleBeeArt()),
  tpl('ant', 'Worker ant insect', 'beginner', ['ant', 'insect', 'bug', 'garden', 'stylized'], antArt()),
  tpl('caterpillar', 'Garden caterpillar', 'beginner', ['caterpillar', 'insect', 'garden', 'kids', 'stylized'], caterpillarArt()),
  tpl('spider', 'Garden spider on its web', 'beginner', ['spider', 'web', 'garden', 'halloween', 'stylized'], spiderArt()),
  tpl('firefly', 'Summer night firefly', 'beginner', ['firefly', 'insect', 'night', 'summer', 'stylized'], fireflyArt()),
  // intermediate
  tpl('woodpecker', 'Woodpecker bird on a tree trunk', 'intermediate', ['woodpecker', 'bird', 'woodland', 'tree', 'stylized'], woodpeckerArt()),
  tpl('magpie', 'Long-tailed magpie bird', 'intermediate', ['magpie', 'bird', 'branch', 'garden', 'stylized'], magpieArt()),
  tpl('stork', 'Wading stork bird', 'intermediate', ['stork', 'bird', 'wetland', 'waterbird', 'stylized'], storkArt()),
  tpl('cockatoo', 'Crested cockatoo bird', 'intermediate', ['cockatoo', 'bird', 'crest', 'tropical', 'stylized'], cockatooArt()),
  tpl('mantis', 'Praying mantis insect', 'intermediate', ['mantis', 'insect', 'bug', 'garden', 'stylized'], mantisArt()),
  tpl('stag-beetle', 'Woodland stag beetle', 'intermediate', ['beetle', 'insect', 'bug', 'woodland', 'symmetrical'], stagBeetleArt()),
  tpl('damselfly', 'Damselfly insect on a reed', 'intermediate', ['damselfly', 'insect', 'reed', 'wetland', 'stylized'], damselflyArt()),
  // advanced
  tpl('wren', 'Wren bird on a briar branch', 'advanced', ['wren', 'bird', 'songbird', 'branch', 'realistic'], wrenArt()),
  tpl('cicada', 'Cicada insect wing study', 'advanced', ['cicada', 'insect', 'wings', 'summer', 'symmetrical'], cicadaArt()),
  tpl('eagle-head', 'Eagle head profile', 'advanced', ['eagle', 'bird', 'portrait', 'feathers', 'realistic'], eagleArt()),
  tpl('grasshopper', 'Grasshopper on a grass blade', 'advanced', ['grasshopper', 'insect', 'meadow', 'summer', 'realistic'], grasshopperArt()),
];
