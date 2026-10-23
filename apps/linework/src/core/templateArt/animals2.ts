// Animals & pets batch (fb-1022b T120, 22 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Generic cats, dogs, farm, woodland and safari animals of our own design, built from simple geometry (ellipses,
// rounded rects, tubes along a curve) whose overlaps are hidden with occlude.ts so each animal reads as one clean
// drawing. Beginner pieces are bold outlines; intermediate ones add markings and inner lines; advanced ones add
// fur, mane and spine hatching. No birds or sea creatures here (those live in Birds & insects and Sea life).
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, polar, poly, rotate, rrect, type P } from './draw.ts';
import { clip, outline, region, roundPoly, samplePath, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

type Art = { p: string[]; d: string[] };

// ---- helpers --------------------------------------------------------------------------------------------------

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

/** Closed tube (leg, neck, tail, trunk) along a curve, full width w0 at the start tapering to w1, round ends. */
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

/** Rotated ellipse. */
const E = (cx: number, cy: number, rx: number, ry: number, deg = 0): string =>
  deg ? rotate(ellipse(cx, cy, rx, ry), deg, cx, cy) : ellipse(cx, cy, rx, ry);

/** Points of a closed path (first subpath), sampled every `step` units. */
const ptsOf = (d: string, step: number): P[] => samplePath(d, step)[0].pts;

function centroid(pts: readonly P[]): P {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

/** Shaggy outline: the closed shape d redrawn as a ring of curled fur tufts (amp = tuft height, step = tuft width). */
function shaggy(d: string, amp: number, step: number): string {
  const pts = ptsOf(d, 1).filter((_, i, a) => i < a.length - 1);
  const per = Math.max(3, Math.round(step));
  const base = pts.filter((_, i) => i % per === 0);
  const [cx, cy] = centroid(pts);
  const n = base.length;
  let out = `M ${f(base[0][0])} ${f(base[0][1])}`;
  for (let i = 0; i < n; i++) {
    const a = base[i];
    const b = base[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const ol = Math.hypot(mx - cx, my - cy) || 1;
    const [ox, oy] = [(mx - cx) / ol, (my - cy) / ol];
    const tip: P = [mx + ox * amp + (b[0] - a[0]) * 0.3, my + oy * amp + (b[1] - a[1]) * 0.3];
    const c1: P = [a[0] + ox * amp * 0.9, a[1] + oy * amp * 0.9];
    out += ` Q ${f(c1[0])} ${f(c1[1])} ${f(tip[0])} ${f(tip[1])} Q ${f((tip[0] + b[0]) / 2 - ox * 2)} ${f((tip[1] + b[1]) / 2 - oy * 2)} ${f(b[0])} ${f(b[1])}`;
  }
  return `${out} Z`;
}

/** Short fur strokes just inside the outline of d, pointing toward (cx, cy). Grouped into a few path strings. */
function furEdge(d: string, len: number, every: number, toward?: P, groups = 3): string[] {
  const pts = ptsOf(d, every);
  const c = toward ?? centroid(pts);
  const strokes: string[] = [];
  pts.forEach((p, i) => {
    const dx = c[0] - p[0];
    const dy = c[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    const k = len * (0.75 + 0.35 * ((i * 7) % 5) / 4);
    const [ux, uy] = [dx / l, dy / l];
    const a: P = [p[0] + ux * 5, p[1] + uy * 5];
    const b: P = [p[0] + ux * (5 + k), p[1] + uy * (5 + k)];
    const m: P = [(a[0] + b[0]) / 2 - uy * k * 0.15, (a[1] + b[1]) / 2 + ux * k * 0.15];
    strokes.push(`M ${f(a[0])} ${f(a[1])} Q ${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}`);
  });
  return chunk(strokes, groups);
}

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

const dot = (x: number, y: number, r = 5): string => circle(x, y, r);

/** Mirror a point list / path helper for symmetric front-view pieces. */
const mx = (x: number): number => 400 - x;

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `ani-${id}`,
    name,
    category: 'animals',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- beginner ---------------------------------------------------------------------------------------------------

function catStretchArt(): Art {
  const head = [circle(96, 262, 38), roundPoly([[66, 244], [58, 200], [92, 228]], 6), roundPoly([[100, 228], [134, 200], [126, 244]], 6)];
  const face = [
    'M 74 258 Q 81 251 88 258', 'M 104 258 Q 111 251 118 258', 'M 92 270 L 100 270 L 96 275 Z',
    'M 88 280 Q 92 285 96 278 Q 100 285 104 280',
  ];
  return layered([
    { sil: head, p: face, d: ['M 70 236 L 66 214 L 84 230', 'M 108 230 L 126 214 L 122 236', 'M 80 274 L 50 268 M 80 279 L 52 288 M 112 274 L 142 268'] },
    { sil: tube([[150, 284], [114, 306], [62, 318]], 28, 22) },
    { sil: tube([[290, 220], [302, 270], [298, 318]], 40, 22) },
    { sil: E(215, 250, 108, 46, -20), d: ['M 180 226 Q 200 236 224 222'] },
    { sil: tube([[318, 212], [350, 182], [352, 134], [332, 106]], 18, 12) },
    { sil: tube([[164, 278], [130, 298], [90, 310]], 24, 20) },
    { sil: tube([[268, 234], [276, 278], [274, 318]], 30, 20) },
    { sil: NONE, p: [line(30, 334, 370, 334)] },
  ]);
}

function catCurledArt(): Art {
  const head = [circle(132, 200, 54), roundPoly([[92, 184], [78, 130], [122, 156]], 7), roundPoly([[138, 152], [178, 124], [176, 184]], 7)];
  const z = (x: number, y: number, s: number) => poly([[x, y], [x + s, y], [x, y + s], [x + s, y + s]], false);
  return layered([
    {
      sil: head,
      p: ['M 102 204 Q 112 212 122 204', 'M 142 204 Q 152 212 162 204', 'M 127 218 L 137 218 L 132 224 Z', 'M 124 232 Q 128 236 132 228 Q 136 236 140 232'],
      d: ['M 96 176 L 88 144 L 112 162', 'M 146 158 L 170 140 L 168 172', 'M 112 226 L 80 222 M 112 232 L 82 240 M 152 226 L 184 222 M 152 232 L 182 240'],
    },
    { sil: E(180, 262, 30, 17), d: ['M 196 256 L 204 256 M 196 266 L 204 266'] },
    { sil: tube([[322, 238], [300, 304], [220, 336], [130, 322], [90, 292]], 32, 24), d: ['M 300 312 Q 292 326 300 336', 'M 250 330 Q 246 344 254 352'] },
    { sil: E(210, 228, 128, 100), d: ['M 236 136 Q 252 156 246 180', 'M 270 144 Q 284 166 278 190', 'M 300 164 Q 310 184 304 206'] },
    { sil: NONE, p: [z(300, 70, 22), z(334, 46, 15)] },
  ]);
}

function pigArt(): Art {
  return layered([
    { sil: roundPoly([[100, 156], [142, 150], [84, 116]], 10), d: ['M 104 148 L 98 132'] },
    {
      sil: [circle(112, 200, 60), E(56, 212, 18, 28)],
      p: ['M 58 185 Q 72 212 58 239', E(46, 203, 3, 6), E(46, 221, 3, 6), dot(108, 186), 'M 70 248 Q 84 256 98 246'],
    },
    { sil: E(222, 215, 120, 82) },
    { sil: rrect(132, 268, 32, 64, 12), d: [line(134, 320, 162, 320)] },
    { sil: rrect(298, 268, 32, 64, 12), d: [line(300, 320, 328, 320)] },
    { sil: rrect(176, 276, 28, 56, 12), d: [line(178, 320, 202, 320)] },
    { sil: rrect(258, 276, 28, 56, 12), d: [line(260, 320, 284, 320)] },
    { sil: NONE, p: ['M 340 196 C 364 186 368 164 352 162 C 338 160 338 180 354 182 C 366 184 374 174 372 164'] },
  ]);
}

function sheepArt(): Art {
  const puffs = Array.from({ length: 14 }, (_, i) => {
    const [x, y] = polar(0, 0, 1, (i * 360) / 14);
    return circle(185 + x * 100, 205 + y * 62, 30);
  });
  const legs = [[120, 262], [248, 262], [150, 268], [220, 268]].map(([x, y]) => ({ sil: rrect(x, y, 22, 332 - y, 10), d: [line(x, 320, x + 22, 320)] }));
  return layered([
    { sil: petal(286, 170, -112, 40, 11) },
    {
      sil: [E(304, 192, 30, 42, -30), circle(290, 156, 12), circle(306, 150, 12), circle(320, 158, 11)],
      p: [dot(312, 184, 4.5), 'M 318 222 Q 326 228 334 220'],
    },
    { sil: petal(318, 168, 105, 34, 10) },
    { sil: [E(185, 205, 100, 62), ...puffs] },
    ...legs,
    { sil: circle(80, 192, 16) },
  ]);
}

function frogArt(): Art {
  const front = (x: number, s: number): string[] => [tube([[x, 262], [x - 8 * s, 305], [x - 12 * s, 334]], 30, 26), circle(x - 12 * s - 16, 346, 9), circle(x - 12 * s, 350, 9), circle(x - 12 * s + 16, 346, 9)];
  const back = (x: number, s: number): string[] => [E(x, 340, 34, 12), circle(x - 34 * s, 334, 9), circle(x - 30 * s, 348, 9)];
  return layered([
    { sil: front(168, 1) },
    { sil: front(232, -1) },
    {
      sil: [E(200, 185, 100, 58), circle(142, 132, 36), circle(258, 132, 36)],
      p: [circle(142, 132, 17), dot(146, 130, 5), circle(258, 132, 17), dot(254, 130, 5), 'M 132 200 Q 200 242 268 200', dot(188, 172, 2.5), dot(212, 172, 2.5)],
    },
    { sil: E(106, 296, 52, 40) },
    { sil: E(294, 296, 52, 40) },
    { sil: back(80, 1) },
    { sil: back(320, -1) },
    { sil: E(200, 262, 102, 82), d: ['M 160 300 Q 200 324 240 300'] },
  ]);
}

function tortoiseArt(): Art {
  const shell = 'M 92 268 C 92 140 308 140 308 268 Z';
  const rimS = rrect(80, 258, 240, 24, 12);
  const hex = poly(Array.from({ length: 6 }, (_, i) => polar(200, 214, 36, 30 + i * 60)));
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const a = polar(200, 214, 36, 30 + i * 60);
    const b = polar(200, 214, 140, 30 + i * 60);
    return line(a[0], a[1], b[0], b[1]);
  }).join(' ');
  const rimLines = [120, 160, 200, 240, 280].map((x) => line(x, 258, x, 282)).join(' ');
  return layered([
    { sil: rimS, p: [inside(rimLines, rimS)] },
    { sil: shell, p: [hex, inside(spokes, shell)], d: [inside('M 120 212 Q 136 176 168 164', shell)] },
    { sil: [tube([[290, 266], [328, 246]], 30, 30), circle(344, 236, 24)], p: [dot(352, 230, 4), 'M 350 246 Q 358 250 366 244'] },
    { sil: rrect(112, 270, 36, 54, 16), d: ['M 118 318 L 118 312 M 130 320 L 130 314 M 142 318 L 142 312'] },
    { sil: rrect(252, 270, 36, 54, 16), d: ['M 258 318 L 258 312 M 270 320 L 270 314 M 282 318 L 282 312'] },
    { sil: rrect(160, 270, 30, 46, 14) },
    { sil: rrect(212, 270, 30, 46, 14) },
    { sil: roundPoly([[90, 264], [60, 280], [92, 282]], 4) },
  ]);
}

function elephantArt(): Art {
  return layered([
    { sil: E(166, 178, 44, 62, 12), d: [inside(E(170, 180, 30, 46, 12), E(166, 178, 44, 62, 12))] },
    { sil: tube([[84, 196], [64, 246], [70, 292], [96, 308]], 38, 22), d: ['M 62 236 L 82 238 M 60 256 L 80 256 M 62 276 L 82 274'] },
    { sil: petal(100, 216, 215, 42, 7) },
    { sil: circle(124, 168, 62), p: [dot(104, 156)] },
    { sil: E(240, 205, 112, 85) },
    { sil: rrect(142, 242, 46, 90, 18), d: ['M 150 330 Q 156 322 162 330 M 168 330 Q 174 322 180 330'] },
    { sil: rrect(304, 242, 46, 90, 18), d: ['M 312 330 Q 318 322 324 330 M 330 330 Q 336 322 342 330'] },
    { sil: rrect(194, 252, 40, 78, 16) },
    { sil: rrect(258, 252, 40, 78, 16) },
    { sil: [tube([[350, 200], [360, 236], [362, 262]], 8, 6), petal(362, 260, 180, 20, 6)] },
  ]);
}

function pandaArt(): Art {
  const arm = (s: number) => tube([[200 - 58 * s, 234], [200 - 66 * s, 280], [200 - 40 * s, 306]], 40, 34);
  const foot = (s: number) => E(200 - 74 * s, 342, 36, 24);
  const pads = (s: number) => `${circle(200 - 74 * s, 346, 10)} ${circle(200 - 88 * s, 330, 4)} ${circle(200 - 74 * s, 326, 4)} ${circle(200 - 60 * s, 330, 4)}`;
  return layered([
    {
      sil: E(200, 160, 84, 72),
      p: [E(166, 162, 19, 27, 30), E(234, 162, 19, 27, -30), dot(168, 158), dot(232, 158), roundPoly([[188, 186], [212, 186], [200, 198]], 4), 'M 200 198 L 200 206 M 186 206 Q 193 214 200 206 Q 207 214 214 206'],
    },
    { sil: arm(1) },
    { sil: arm(-1) },
    { sil: foot(1), d: [pads(1)] },
    { sil: foot(-1), d: [pads(-1)] },
    { sil: E(200, 282, 96, 78) },
    { sil: circle(132, 102, 26), d: [circle(134, 104, 13)] },
    { sil: circle(268, 102, 26), d: [circle(266, 104, 13)] },
  ]);
}

function rabbitArt(): Art {
  return layered([
    { sil: E(232, 336, 62, 14) },
    { sil: E(260, 282, 60, 54) },
    { sil: rrect(136, 280, 26, 62, 12), d: ['M 142 340 L 142 334 M 150 340 L 150 334'] },
    {
      sil: E(132, 196, 52, 42, -12),
      p: [dot(122, 186), E(84, 200, 4, 3)],
      d: ['M 86 210 Q 92 218 100 212', 'M 96 204 L 62 196 M 96 210 L 64 216'],
    },
    { sil: petal(160, 168, 18, 112, 20, 0.55), d: [petal(163, 176, 18, 90, 9, 0.55)] },
    { sil: petal(178, 172, 36, 100, 17, 0.55) },
    { sil: E(222, 265, 92, 74) },
    { sil: circle(316, 262, 18) },
  ]);
}

function bearArt(): Art {
  return layered([
    {
      sil: [E(102, 182, 48, 40), E(62, 196, 28, 20)],
      p: [dot(98, 172), circle(38, 190, 6), 'M 46 210 Q 58 216 70 210'],
    },
    { sil: circle(118, 146, 15), d: [circle(118, 146, 7)] },
    { sil: rrect(118, 214, 48, 118, 22), d: ['M 126 330 L 126 322 M 138 332 L 138 324 M 150 330 L 150 322'] },
    { sil: rrect(282, 210, 52, 122, 22), d: ['M 292 330 L 292 322 M 304 332 L 304 324 M 316 330 L 316 322'] },
    { sil: [E(228, 205, 118, 70), circle(250, 160, 44)] },
    { sil: rrect(170, 236, 40, 92, 18) },
    { sil: rrect(236, 236, 40, 92, 18) },
    { sil: circle(346, 186, 10) },
  ]);
}

function hamsterArt(): Art {
  const body = E(200, 236, 118, 112);
  return layered([
    { sil: E(150, 350, 28, 12), d: ['M 136 346 L 136 352 M 150 346 L 150 352 M 164 346 L 164 352'] },
    { sil: E(250, 350, 28, 12), d: ['M 236 346 L 236 352 M 250 346 L 250 352 M 264 346 L 264 352'] },
    {
      sil: body,
      p: [dot(166, 206, 7), dot(234, 206, 7), roundPoly([[192, 226], [208, 226], [200, 234]], 3), 'M 200 234 L 200 242 M 188 246 Q 194 252 200 242 Q 206 252 212 246'],
      d: ['M 112 232 Q 124 252 142 256', 'M 288 232 Q 276 252 258 256', 'M 140 300 Q 200 336 260 300'],
    },
    { sil: circle(120, 140, 22), d: [circle(122, 142, 11)] },
    { sil: circle(280, 140, 22), d: [circle(278, 142, 11)] },
  ]);
}

function puppyBallArt(): Art {
  const ball = circle(314, 322, 34);
  return layered([
    { sil: ball, p: [inside('M 280 312 Q 314 300 348 318 M 296 296 Q 300 330 326 354', ball)] },
    { sil: petal(146, 118, 205, 92, 24, 0.6) },
    { sil: petal(254, 118, 155, 92, 24, 0.6) },
    {
      sil: E(200, 160, 66, 60),
      p: [dot(174, 150, 6), dot(226, 150, 6), E(200, 186, 30, 22), E(200, 175, 11, 8), 'M 200 183 L 200 194 M 188 198 Q 200 206 212 198'],
    },
    { sil: rrect(160, 214, 80, 16, 8), p: [circle(200, 238, 8)] },
    { sil: rrect(160, 270, 32, 84, 15), d: ['M 170 352 L 170 344 M 182 352 L 182 344'] },
    { sil: rrect(208, 270, 32, 84, 15), d: ['M 218 352 L 218 344 M 230 352 L 230 344'] },
    { sil: E(200, 282, 76, 72) },
    { sil: tube([[268, 300], [292, 280], [300, 252]], 16, 10) },
  ]);
}

function koalaArt(): Art {
  const head = E(200, 220, 112, 98);
  return layered([
    {
      sil: head,
      p: [rrect(176, 196, 48, 70, 24), dot(148, 206, 7), dot(252, 206, 7), 'M 186 290 Q 200 300 214 290'],
    },
    { sil: circle(98, 140, 58), d: [circle(104, 146, 32)] },
    { sil: circle(302, 140, 58), d: [circle(296, 146, 32)] },
    { sil: NONE, p: ['M 64 380 Q 74 324 120 300', 'M 336 380 Q 326 324 280 300'] },
  ]);
}

function llamaArt(): Art {
  return layered([
    { sil: E(290, 98, 40, 24, 12), p: [dot(282, 90, 4.5), 'M 318 112 Q 324 114 322 106', 'M 324 100 L 328 96'] },
    { sil: petal(258, 84, -14, 40, 9) },
    { sil: petal(272, 80, 6, 40, 9) },
    { sil: tube([[238, 226], [262, 160], [268, 106]], 54, 46), d: ['M 120 196 Q 126 190 132 196 Q 138 190 144 196 Q 150 190 156 196 Q 162 190 168 196 Q 174 190 180 196'] },
    { sil: rrect(86, 252, 24, 84, 10) },
    { sil: rrect(234, 252, 24, 84, 10) },
    { sil: E(168, 232, 98, 52) },
    { sil: rrect(118, 258, 22, 78, 10) },
    { sil: rrect(206, 258, 22, 78, 10) },
    { sil: circle(70, 214, 14) },
  ]);
}

// ---- intermediate ---------------------------------------------------------------------------------------------

function kittenYarnArt(): Art {
  const yarn = circle(316, 296, 46);
  return layered([
    { sil: tube([[214, 252], [250, 244], [278, 254]], 28, 26), d: ['M 282 246 L 290 246 M 284 258 L 292 258'] },
    {
      sil: [circle(168, 168, 64), roundPoly([[118, 138], [110, 76], [156, 118]], 8), roundPoly([[180, 118], [226, 76], [218, 138]], 8)],
      p: [circle(146, 170, 11), dot(149, 166, 3), circle(190, 170, 11), dot(193, 166, 3), 'M 162 190 L 174 190 L 168 197 Z', 'M 158 204 Q 163 210 168 200 Q 173 210 178 204'],
      d: ['M 124 128 L 118 92 L 146 118', 'M 190 118 L 218 92 L 212 128', 'M 130 192 L 96 186 M 130 198 L 98 208 M 206 192 L 240 186 M 206 198 L 238 208', 'M 150 112 Q 158 106 166 112 M 172 112 Q 180 106 188 112'],
    },
    {
      sil: yarn,
      p: [inside('M 276 270 Q 316 300 300 344 M 290 256 Q 336 270 352 320 M 322 252 Q 300 300 334 340 M 272 302 Q 300 322 344 332', yarn)],
      d: [inside('M 300 254 Q 280 290 290 336 M 340 262 Q 320 300 352 312', yarn)],
    },
    { sil: rrect(140, 298, 30, 58, 14), d: ['M 148 354 L 148 346 M 160 354 L 160 346'] },
    { sil: E(172, 282, 74, 74), d: ['M 150 236 Q 160 246 168 236 Q 176 246 186 236'] },
    { sil: tube([[112, 330], [78, 332], [62, 300], [74, 268]], 22, 16) },
    { sil: NONE, p: ['M 300 341 C 280 366 220 354 200 366 C 188 374 166 372 152 366'] },
  ]);
}

function longEarDogArt(): Art {
  const ear = petal(158, 112, 188, 150, 30, 0.6);
  return layered([
    { sil: ear, d: [inside('M 162 134 Q 154 190 140 246', ear)] },
    {
      sil: [E(142, 140, 56, 46, -8), rrect(56, 132, 92, 52, 24)],
      p: [dot(128, 126), E(62, 148, 10, 8), 'M 62 174 Q 88 182 110 170'],
      d: ['M 114 114 Q 126 106 140 112', 'M 84 160 L 84 162 M 94 156 L 94 158 M 94 166 L 94 168'],
    },
    { sil: rrect(152, 228, 36, 118, 16), d: ['M 162 344 L 162 336 M 176 344 L 176 336'] },
    { sil: rrect(190, 238, 30, 106, 14) },
    { sil: E(244, 340, 46, 12) },
    { sil: E(274, 298, 56, 50), d: ['M 240 274 Q 252 262 270 260'] },
    { sil: E(238, 252, 78, 96) },
    { sil: tube([[312, 316], [344, 290], [356, 256]], 16, 10) },
  ]);
}

function spottedDogArt(): Art {
  const body = E(190, 198, 104, 48);
  const neck = tube([[262, 188], [288, 142], [298, 118]], 48, 40);
  const spots = [[140, 180, 12, 9], [180, 204, 14, 10], [220, 176, 10, 8], [250, 212, 12, 9], [108, 206, 9, 7], [204, 228, 9, 6], [156, 228, 8, 6], [118, 168, 7, 5]]
    .map(([x, y, a, b]) => E(x, y, a, b, x % 3 ? 20 : -15))
    .join(' ');
  return layered([
    { sil: petal(296, 96, 200, 52, 15), d: [E(292, 120, 6, 5)] },
    {
      sil: [E(306, 116, 34, 30), E(338, 128, 30, 17, 15)],
      p: [dot(312, 106, 4.5), circle(364, 128, 5), 'M 358 144 Q 346 150 334 144'],
      d: [E(322, 102, 5, 4), E(340, 114, 4, 3)],
    },
    { sil: neck, d: [inside(`${E(286, 160, 7, 5)} ${E(276, 182, 6, 5)}`, neck)] },
    { sil: tube([[262, 226], [266, 280], [262, 330]], 26, 20), d: [E(262, 268, 5, 7)] },
    { sil: tube([[128, 224], [110, 276], [122, 330]], 30, 20), d: [E(116, 260, 6, 7)] },
    { sil: body, d: [inside(spots, body)] },
    { sil: tube([[240, 226], [236, 280], [242, 328]], 22, 18) },
    { sil: tube([[150, 226], [140, 278], [150, 328]], 24, 18) },
    { sil: tube([[90, 186], [64, 166], [52, 138]], 14, 8) },
  ]);
}

function horseHeadArt(): Art {
  const head = smooth([
    [232, 74], [198, 92], [160, 128], [120, 178], [84, 224], [64, 256], [70, 282], [96, 294], [126, 288], [152, 264],
    [180, 248], [206, 248], [224, 266], [240, 302], [250, 340], [254, 372], [304, 373], [360, 372], [354, 300], [338, 228],
    [316, 166], [290, 118], [262, 86],
  ]);
  const crest: P[] = curvePts([[262, 86], [290, 118], [316, 166], [338, 228], [352, 290], [356, 330]], 3);
  const mane = crest.slice(0, -1).map((p, i) => petal(p[0] - 4, p[1], 120 + i * 2, 40 + (i % 3) * 8, 9, 0.55));
  const strands = crest.slice(0, -1).map((p, i) => {
    const t = polar(p[0] - 4, p[1], 30 + (i % 3) * 6, 120 + i * 2);
    return `M ${f(p[0] + 2)} ${f(p[1] + 4)} Q ${f((p[0] + t[0]) / 2 + 4)} ${f((p[1] + t[1]) / 2)} ${f(t[0])} ${f(t[1])}`;
  });
  return layered([
    { sil: [petal(236, 80, 222, 54, 12), petal(230, 84, 240, 46, 10)], d: ['M 226 92 Q 214 104 206 120'] },
    { sil: mane, d: chunk(strands, 3) },
    { sil: petal(242, 82, 12, 56, 13), d: ['M 244 76 Q 248 56 252 36'] },
    {
      sil: head,
      p: ['M 166 152 Q 184 138 202 150 Q 184 162 166 152 Z', dot(184, 150, 4), 'M 84 252 Q 96 240 102 256', 'M 72 278 Q 88 284 104 280'],
      d: ['M 152 262 C 196 250 214 206 196 180', 'M 122 196 Q 108 222 96 240', 'M 170 136 Q 186 126 204 134'],
    },
    { sil: petal(258, 88, 30, 46, 11) },
  ]);
}

function ponyArt(): Art {
  const neckPts: P[] = curvePts([[118, 96], [132, 124], [152, 152], [174, 176]], 2);
  const mane = neckPts.map((p, i) => petal(p[0] + 2, p[1] - 2, 112 + i * 4, 34 + (i % 2) * 8, 9, 0.55));
  const hoof = (x: number, w: number) => rrect(x - w / 2 - 2, 318, w + 4, 16, 4);
  return layered([
    { sil: petal(116, 92, 214, 32, 9) },
    { sil: mane, d: chunk(neckPts.map((p, i) => { const t = polar(p[0] + 2, p[1] - 2, 26, 112 + i * 4); return line(p[0] + 4, p[1] + 2, t[0], t[1]); }), 2) },
    { sil: tube([[118, 100], [86, 124], [62, 150]], 46, 36), p: [dot(100, 114, 4.5), 'M 64 144 Q 70 140 72 148', 'M 52 162 Q 60 168 70 164'] },
    { sil: petal(116, 92, -8, 28, 8) },
    { sil: tube([[164, 200], [130, 150], [118, 112]], 62, 48) },
    { sil: hoof(148, 22) },
    { sil: hoof(296, 22) },
    { sil: tube([[150, 236], [146, 286], [148, 322]], 26, 22) },
    { sil: tube([[294, 226], [300, 280], [296, 322]], 30, 22) },
    { sil: E(222, 206, 100, 54) },
    { sil: hoof(180, 18) },
    { sil: hoof(268, 18) },
    { sil: tube([[176, 240], [176, 290], [180, 322]], 22, 18) },
    { sil: tube([[268, 236], [272, 284], [268, 322]], 22, 18) },
    { sil: [tube([[318, 196], [344, 236], [346, 300]], 34, 16), petal(328, 210, 172, 100, 16)], d: ['M 334 222 Q 348 260 340 300', 'M 324 230 Q 330 270 326 304'] },
  ]);
}

function foxArt(): Art {
  const head = [
    roundPoly([[118, 128], [242, 128], [180, 216]], 26), circle(180, 150, 48),
    roundPoly([[120, 140], [96, 188], [150, 184]], 8), roundPoly([[240, 140], [264, 188], [210, 184]], 8),
    roundPoly([[134, 126], [124, 56], [172, 108]], 8), roundPoly([[188, 108], [236, 56], [226, 126]], 8),
  ];
  const tail = smooth([[236, 316], [292, 318], [330, 286], [346, 236], [352, 196], [370, 250], [362, 312], [318, 352], [252, 358], [226, 348]]);
  const body = E(196, 276, 70, 84);
  return layered([
    {
      sil: head,
      p: ['M 150 154 Q 160 146 170 154 Q 160 160 150 154 Z', 'M 190 154 Q 200 146 210 154 Q 200 160 190 154 Z', circle(180, 204, 7)],
      d: ['M 112 168 Q 150 172 170 198', 'M 248 168 Q 210 172 190 198', 'M 138 114 L 132 74 L 160 104', 'M 200 104 L 228 74 L 222 114', 'M 180 211 L 180 218'],
    },
    { sil: rrect(160, 292, 26, 68, 12), d: ['M 168 358 L 168 350 M 178 358 L 178 350'] },
    { sil: rrect(198, 292, 26, 68, 12), d: ['M 206 358 L 206 350 M 216 358 L 216 350'] },
    { sil: tail, p: [inside('M 336 232 Q 350 244 368 236', tail)], d: ['M 280 340 Q 310 330 330 306', 'M 300 350 Q 330 336 346 300'] },
    { sil: body, d: [inside('M 152 230 Q 196 300 240 230', body), inside('M 176 252 L 182 260 M 196 262 L 196 270 M 214 252 L 208 260', body)] },
  ]);
}

function fawnArt(): Art {
  const body = E(224, 206, 82, 44);
  const spots = [[196, 184, 7, 5], [220, 176, 7, 5], [246, 184, 7, 5], [208, 200, 6, 4], [234, 200, 6, 4], [262, 194, 6, 4], [184, 198, 5, 4], [272, 178, 5, 4]]
    .map(([x, y, a, b]) => E(x, y, a, b))
    .join(' ');
  const hoofL = (x: number, y: number, w: number) => `M ${f(x - w / 2)} ${f(y)} L ${f(x + w / 2)} ${f(y)}`;
  return layered([
    { sil: petal(146, 102, 58, 46, 13), d: [petal(148, 102, 58, 32, 6)] },
    {
      sil: [E(128, 112, 32, 24, -15), E(96, 126, 20, 13, -25)],
      p: [dot(124, 106, 5), dot(80, 126, 4)],
      d: ['M 84 136 Q 92 140 100 136'],
    },
    { sil: petal(132, 98, -34, 42, 12) },
    { sil: tube([[168, 198], [148, 152], [140, 124]], 38, 30) },
    { sil: tube([[166, 234], [162, 290], [164, 334]], 16, 12), d: [hoofL(164, 326, 12)] },
    { sil: tube([[276, 228], [286, 280], [280, 334]], 20, 12), d: [hoofL(280, 326, 12)] },
    { sil: body, d: [inside(spots, body)] },
    { sil: tube([[188, 236], [190, 290], [192, 330]], 14, 11), d: [hoofL(192, 322, 10)] },
    { sil: tube([[258, 234], [262, 284], [258, 330]], 16, 11), d: [hoofL(258, 322, 10)] },
    { sil: petal(300, 192, 60, 28, 8) },
  ]);
}

function cowArt(): Art {
  const body = rrect(128, 146, 214, 112, 52);
  const patches = [
    smooth([[190, 150], [232, 156], [244, 186], [214, 210], [184, 196]]),
    smooth([[268, 196], [304, 190], [320, 220], [296, 250], [266, 236]]),
    smooth([[300, 148], [338, 150], [342, 184], [318, 178]]),
    smooth([[142, 200], [170, 214], [160, 246], [134, 236]]),
  ].join(' ');
  return layered([
    { sil: petal(134, 160, 104, 36, 10) },
    {
      sil: [tube([[122, 148], [102, 186], [94, 214]], 60, 52), E(88, 224, 32, 22)],
      p: [dot(104, 174), E(76, 222, 4, 6), E(98, 222, 4, 6), 'M 72 238 Q 88 244 104 238'],
      d: [smooth([[110, 132], [132, 146], [120, 168], [104, 156]])],
    },
    { sil: petal(108, 136, -38, 26, 6) },
    { sil: petal(130, 132, 30, 26, 6) },
    { sil: rrect(146, 240, 30, 92, 10), d: [line(148, 320, 174, 320)] },
    { sil: rrect(312, 240, 30, 92, 10), d: [line(314, 320, 340, 320)] },
    { sil: body, d: [inside(patches, body)] },
    { sil: E(268, 262, 24, 14), d: ['M 258 274 L 258 282 M 278 274 L 278 282'] },
    { sil: rrect(184, 246, 26, 84, 10), d: [line(186, 320, 208, 320)] },
    { sil: rrect(280, 246, 26, 84, 10), d: [line(282, 320, 304, 320)] },
    { sil: [tube([[340, 170], [354, 220], [356, 264]], 8, 6), petal(356, 262, 180, 26, 8)] },
  ]);
}

function goatArt(): Art {
  const hoof = (x: number) => line(x - 8, 324, x + 8, 324);
  return layered([
    { sil: tube([[298, 100], [280, 72], [254, 68]], 12, 6), d: ['M 286 82 L 292 78 M 276 72 L 280 66'] },
    { sil: tube([[308, 100], [294, 70], [270, 62]], 12, 6) },
    { sil: petal(292, 112, -96, 32, 8) },
    { sil: E(306, 128, 22, 38, -35), p: ['M 298 112 Q 304 108 310 112 Q 304 116 298 112 Z', 'M 328 156 Q 324 160 318 158'] },
    { sil: petal(318, 156, 192, 36, 8) },
    { sil: tube([[250, 198], [276, 152], [292, 126]], 44, 34) },
    { sil: tube([[244, 230], [248, 282], [244, 332]], 20, 14), d: [hoof(244)] },
    { sil: tube([[122, 232], [114, 282], [118, 332]], 22, 14), d: [hoof(118)] },
    { sil: E(182, 208, 96, 50) },
    { sil: tube([[222, 234], [222, 284], [224, 330]], 18, 13), d: [hoof(224)] },
    { sil: tube([[142, 234], [138, 284], [142, 330]], 18, 13), d: [hoof(142)] },
    { sil: petal(92, 190, -50, 30, 8) },
  ]);
}

function lambArt(): Art {
  const puffs = Array.from({ length: 9 }, (_, i) => {
    const [x, y] = polar(0, 0, 1, -100 + i * 25);
    return circle(222 + x * 104, 268 + y * 54, 24);
  });
  const wool = [E(222, 268, 110, 54), ...puffs];
  const curls = [[190, 252], [230, 240], [270, 256], [210, 284], [250, 290], [296, 280], [176, 290], [314, 244]]
    .map(([x, y]) => `M ${x - 6} ${y} Q ${x - 6} ${y - 7} ${x} ${y - 7} Q ${x + 6} ${y - 7} ${x + 6} ${y} Q ${x + 6} ${y + 5} ${x + 1} ${y + 5}`)
    .join(' ');
  const tufts = [36, 70, 340, 368].map((x) => `M ${x - 8} 322 Q ${x - 8} 312 ${x - 12} 302 M ${x} 322 L ${x} 298 M ${x + 8} 322 Q ${x + 8} 312 ${x + 12} 302`).join(' ');
  return layered([
    { sil: petal(84, 206, -116, 40, 11) },
    {
      sil: [E(114, 220, 38, 46), circle(100, 180, 14), circle(118, 174, 14), circle(134, 182, 12)],
      p: ['M 92 222 Q 99 228 106 222', 'M 122 222 Q 129 228 136 222', 'M 106 246 Q 114 252 122 246', 'M 114 238 L 114 246'],
    },
    { sil: petal(146, 204, 112, 38, 11) },
    { sil: rrect(124, 302, 62, 20, 10), d: [line(132, 304, 132, 320)] },
    { sil: wool, d: [inside(curls, wool)] },
    { sil: NONE, p: [line(30, 322, 370, 322)], d: [tufts] },
  ]);
}

function zebraArt(): Art {
  const body = E(182, 204, 100, 50);
  const neck = tube([[250, 194], [276, 140], [284, 112]], 52, 42);
  const head = tube([[288, 98], [318, 136], [330, 162]], 42, 32);
  const legs = [
    tube([[250, 232], [254, 282], [250, 324]], 22, 18), tube([[118, 232], [110, 282], [116, 324]], 24, 18),
    tube([[226, 236], [226, 284], [230, 322]], 20, 16), tube([[140, 236], [136, 284], [140, 322]], 20, 16),
  ];
  const bodyStripes = [104, 124, 146, 168, 190, 212, 234, 256].map((x, i) => petal(x + (i % 2) * 4, 156, 180 + (i - 4) * 3, 58 + (i % 3) * 8, 6)).join(' ');
  const neckStripes = [0, 1, 2, 3, 4].map((i) => petal(298 - i * 4, 112 + i * 18, 245, 40, 5)).join(' ');
  const legStripes = (x: number) => [258, 276, 294].map((y) => line(x - 14, y, x + 14, y - 4)).join(' ');
  const hoof = (x: number, w: number) => rrect(x - w / 2 - 2, 318, w + 4, 14, 4);
  return layered([
    { sil: petal(284, 90, -18, 34, 9) },
    { sil: petal(298, 92, 20, 32, 8) },
    { sil: head, p: [dot(300, 110, 4.5), E(326, 160, 4, 3)], d: [inside('M 296 124 L 314 118 M 302 138 L 320 132', head)] },
    { sil: tube([[244, 172], [262, 122], [280, 88]], 18, 12), d: ['M 240 160 L 258 166 M 248 140 L 266 146 M 256 120 L 272 126 M 266 100 L 280 106'] },
    { sil: neck, d: [inside(neckStripes, neck)] },
    { sil: hoof(250, 18) },
    { sil: hoof(116, 18) },
    { sil: legs[0], d: [inside(legStripes(250), legs[0])] },
    { sil: legs[1], d: [inside(legStripes(114), legs[1])] },
    { sil: body, d: [inside(bodyStripes, body)] },
    { sil: hoof(230, 16) },
    { sil: hoof(140, 16) },
    { sil: legs[2], d: [inside(legStripes(228), legs[2])] },
    { sil: legs[3], d: [inside(legStripes(138), legs[3])] },
    { sil: [tube([[84, 190], [72, 220], [70, 252]], 8, 6), petal(70, 250, 180, 26, 9)] },
  ]);
}

function giraffeArt(): Art {
  const body = E(140, 222, 82, 46);
  const neck = tube([[194, 210], [240, 138], [282, 64]], 46, 30);
  const patches: string[] = [];
  let k = 0;
  for (let y = 40; y < 280; y += 24)
    for (let x = 50 + ((y / 24) % 2) * 12; x < 300; x += 26) {
      k++;
      const pts: P[] = Array.from({ length: 5 }, (_, i) => polar(x + (rnd(k) - 0.5) * 6, y + (rnd(k + 9) - 0.5) * 6, 8 + rnd(k * 3 + i) * 3, i * 72 + rnd(k) * 40));
      patches.push(roundPoly(pts, 3));
    }
  const hoof = (x: number) => line(x - 7, 362, x + 7, 362);
  return layered([
    { sil: NONE, p: ['M 280 46 L 276 30', 'M 292 48 L 292 30', circle(275, 26, 5), circle(292, 26, 5)] },
    { sil: petal(270, 52, -70, 28, 8) },
    { sil: E(300, 62, 34, 18, 25), p: [dot(298, 54, 4), E(326, 74, 3, 2)], d: ['M 316 80 Q 324 84 330 80'] },
    { sil: neck, d: [inside(patches.join(' '), neck), 'M 232 136 L 244 140 M 244 116 L 256 120 M 256 96 L 268 100 M 266 76 L 278 80'] },
    { sil: tube([[94, 250], [90, 310], [92, 370]], 18, 14), d: [hoof(92)] },
    { sil: tube([[190, 250], [196, 310], [194, 370]], 18, 14), d: [hoof(194)] },
    { sil: body, d: [inside(patches.join(' '), body)] },
    { sil: tube([[118, 256], [120, 310], [118, 366]], 16, 12), d: [line(112, 358, 124, 358)] },
    { sil: tube([[170, 256], [172, 310], [170, 366]], 16, 12), d: [line(164, 358, 176, 358)] },
    { sil: [tube([[60, 214], [48, 250], [46, 280]], 6, 5), petal(46, 278, 180, 22, 7)] },
  ]);
}

function monkeyArt(): Art {
  const head = circle(200, 132, 60);
  return layered([
    {
      sil: head,
      p: [inside(outline([circle(180, 128, 25), circle(220, 128, 25), E(200, 164, 42, 30)]), head), dot(182, 128), dot(218, 128), 'M 182 172 Q 200 186 218 172'],
      d: [dot(194, 156, 2), dot(206, 156, 2), 'M 168 96 Q 184 88 200 100 Q 216 88 232 96'],
    },
    { sil: circle(132, 140, 22), d: [circle(134, 140, 12)] },
    { sil: circle(268, 140, 22), d: [circle(266, 140, 12)] },
    { sil: [tube([[150, 214], [118, 260], [128, 304]], 26, 24), circle(130, 310, 15)] },
    { sil: [tube([[250, 214], [282, 260], [272, 304]], 26, 24), circle(270, 310, 15)] },
    { sil: E(140, 346, 32, 13) },
    { sil: E(260, 346, 32, 13) },
    { sil: E(156, 320, 38, 28) },
    { sil: E(244, 320, 38, 28) },
    { sil: E(200, 262, 64, 76), d: [inside(E(200, 272, 40, 48), E(200, 262, 64, 76))] },
    { sil: tube([[256, 300], [304, 340], [340, 316], [340, 282], [316, 280]], 14, 12) },
  ]);
}

function slothArt(): Art {
  const branch = rrect(20, 72, 360, 26, 13);
  const claw = (x: number) => `M ${x - 10} 86 Q ${x - 6} 66 ${x + 2} 70 M ${x} 88 Q ${x + 4} 66 ${x + 12} 72`;
  return layered([
    { sil: NONE, p: [claw(124), claw(266), claw(82), claw(312)] },
    {
      sil: circle(200, 168, 48),
      p: [petal(176, 160, 245, 34, 9), petal(224, 160, 115, 34, 9), dot(180, 162), dot(220, 162), E(200, 182, 10, 7), 'M 186 196 Q 200 206 214 196'],
      d: ['M 168 132 Q 184 124 200 128 Q 216 124 232 132'],
    },
    { sil: branch, p: [petal(354, 98, 168, 40, 11), petal(46, 98, 196, 34, 10)], d: ['M 60 85 L 110 85 M 160 80 L 230 80 M 300 88 L 344 88'] },
    { sil: tube([[160, 196], [128, 140], [128, 84]], 32, 24) },
    { sil: tube([[240, 196], [272, 140], [272, 84]], 32, 24) },
    { sil: E(200, 236, 74, 96), d: ['M 160 230 Q 170 250 166 272', 'M 240 230 Q 230 250 234 272', 'M 196 290 Q 204 306 198 320'] },
    { sil: tube([[168, 312], [96, 246], [86, 88]], 30, 24) },
    { sil: tube([[232, 312], [304, 246], [312, 88]], 30, 24) },
  ]);
}

// ---- advanced ---------------------------------------------------------------------------------------------------

function lionArt(): Art {
  const mane = smooth(Array.from({ length: 36 }, (_, i) => polar(200, 202, i % 2 ? 150 : 172, i * 10)));
  const face = [E(200, 214, 90, 100), circle(128, 130, 24), circle(272, 130, 24)];
  const strokes: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = i * 5 + (i % 2) * 2;
    const r1 = 96 + (i % 3) * 8;
    const r2 = 140 + (i % 4) * 7;
    const s = polar(200, 210, r1, a);
    const e = polar(200, 202, r2, a + 6);
    const m = polar(200, 206, (r1 + r2) / 2, a - 4);
    strokes.push(`M ${f(s[0])} ${f(s[1])} Q ${f(m[0])} ${f(m[1])} ${f(e[0])} ${f(e[1])}`);
  }
  const muzzle = [circle(180, 262, 30), circle(220, 262, 30)];
  return layered([
    {
      sil: face,
      p: [
        'M 146 196 Q 164 182 184 196 Q 164 206 146 196 Z', dot(166, 195, 5), 'M 216 196 Q 236 182 254 196 Q 236 206 216 196 Z', dot(234, 195, 5),
        roundPoly([[176, 232], [224, 232], [200, 256]], 8), outline(muzzle), E(200, 298, 18, 12),
      ],
      d: [
        circle(128, 132, 12), circle(272, 132, 12), 'M 142 180 Q 164 166 188 178', 'M 212 178 Q 236 166 258 180',
        'M 188 200 Q 182 220 184 232', 'M 212 200 Q 218 220 216 232', 'M 200 256 L 200 270',
        [[166, 256], [176, 266], [164, 272], [234, 256], [224, 266], [236, 272]].map(([x, y]) => circle(x, y, 2)).join(' '),
        'M 152 120 Q 176 140 200 122 Q 224 140 248 120',
      ],
    },
    { sil: mane, d: chunk(strokes.map((s) => inside(s, mane)).filter(Boolean), 8) },
  ]);
}

function wolfArt(): Art {
  const neck = shaggy(tube([[188, 118], [198, 176], [206, 240]], 74, 98), 7, 14);
  const tailBase = tube([[296, 346], [336, 352], [362, 330], [366, 300]], 34, 16);
  const tail = shaggy(tailBase, 5, 12);
  const body = E(260, 282, 74, 76, 15);
  const haunch = E(280, 302, 54, 52);
  const head = [circle(184, 104, 38), tube([[166, 100], [130, 74], [100, 54]], 46, 18)];
  return layered([
    {
      sil: head,
      p: ['M 164 94 Q 173 100 184 96', E(100, 54, 7, 5), 'M 112 76 L 142 96'],
      d: ['M 150 74 Q 162 66 176 74', 'M 200 100 L 212 104 M 198 114 L 210 120'],
    },
    { sil: roundPoly([[176, 76], [198, 28], [216, 90]], 5), d: ['M 188 72 L 198 44 L 206 82'] },
    { sil: neck, d: furEdge(tube([[188, 118], [198, 176], [206, 240]], 74, 98), 10, 12, [210, 170], 2).map((x) => inside(x, neck)) },
    { sil: rrect(172, 232, 34, 122, 15), d: ['M 186 352 L 186 344 M 198 352 L 198 344', 'M 186 260 L 190 270 M 196 290 L 200 300'] },
    { sil: rrect(208, 238, 32, 116, 15), d: ['M 216 352 L 216 344 M 228 352 L 228 344'] },
    { sil: E(252, 346, 42, 10) },
    { sil: haunch, d: [...furEdge(haunch, 8, 12, undefined, 1), 'M 250 300 Q 262 286 280 284'] },
    { sil: body, d: furEdge(body, 9, 12, undefined, 2) },
    { sil: tail, d: furEdge(tailBase, 8, 10, undefined, 2) },
    { sil: circle(312, 92, 50), d: [circle(326, 78, 10), circle(298, 112, 7), circle(332, 116, 5)] },
    { sil: NONE, p: [line(40, 358, 380, 358)], d: ['M 60 50 L 60 62 M 54 56 L 66 56', 'M 250 30 L 250 40 M 245 35 L 255 35', 'M 50 160 L 50 168 M 46 164 L 54 164'] },
  ]);
}

function shaggyDogArt(): Art {
  const head = shaggy(E(200, 150, 92, 80), 9, 16);
  const earL = shaggy(petal(126, 116, 200, 136, 30), 7, 14);
  const earR = shaggy(petal(274, 116, 160, 136, 30), 7, 14);
  const body = shaggy(E(200, 288, 96, 76), 8, 16);
  const legL = rrect(158, 292, 36, 74, 16);
  const legR = rrect(206, 292, 36, 74, 16);
  const hair = (cx: number, cy: number, rx: number, ry: number, n: number, seed: number, shape: string) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = cx + (rnd(seed + i) - 0.5) * 2 * rx;
      const y = cy + (rnd(seed + i + 50) - 0.5) * 2 * ry;
      const lean = (x - cx) * 0.12;
      out.push(`M ${f(x)} ${f(y)} Q ${f(x + lean + 3)} ${f(y + 9)} ${f(x + lean)} ${f(y + 18)}`);
    }
    return chunk(out.map((s) => inside(s, shape)).filter(Boolean), 2);
  };
  const fringe = Array.from({ length: 11 }, (_, i) => {
    const x = 140 + i * 12;
    return `M ${x} ${100 + (i % 2) * 4} Q ${x + 6} ${126} ${x + 2} ${146 + (i % 3) * 4}`;
  }).join(' ');
  return layered([
    {
      sil: head,
      p: [dot(174, 160, 6), dot(226, 160, 6), E(200, 190, 18, 13), 'M 200 203 L 200 212 M 176 212 Q 188 224 200 212 Q 212 224 224 212', 'M 190 220 Q 190 242 200 242 Q 210 242 210 220'],
      d: [fringe, ...hair(200, 120, 70, 30, 26, 1, head), 'M 160 196 Q 170 210 166 226 M 240 196 Q 230 210 234 226'],
    },
    { sil: earL, d: hair(116, 180, 26, 50, 16, 100, earL) },
    { sil: earR, d: hair(284, 180, 26, 50, 16, 200, earR) },
    { sil: legL, d: ['M 168 364 L 168 354 M 182 364 L 182 354'] },
    { sil: legR, d: ['M 218 364 L 218 354 M 232 364 L 232 354'] },
    { sil: body, d: hair(200, 290, 80, 56, 40, 300, body) },
  ]);
}

function squirrelArt(): Art {
  const tailBase = tube([[236, 334], [300, 322], [330, 256], [314, 180], [276, 132], [244, 136]], 56, 40);
  const tail = shaggy(tailBase, 8, 13);
  const tc = curvePts([[236, 334], [300, 322], [330, 256], [314, 180], [276, 132], [244, 136]], 6);
  const tailFur: string[] = [];
  tc.forEach((p, i) => {
    if (i < 2 || i > tc.length - 2) return;
    const [tx, ty] = tangent(tc, i);
    for (const off of [-16, -6, 4, 14]) {
      const s: P = [p[0] - ty * off, p[1] + tx * off];
      tailFur.push(`M ${f(s[0])} ${f(s[1])} Q ${f(s[0] + tx * 8 - ty * 3)} ${f(s[1] + ty * 8 + tx * 3)} ${f(s[0] + tx * 16)} ${f(s[1] + ty * 16)}`);
    }
  });
  const body = E(196, 262, 56, 76, 12);
  const nut = E(128, 256, 18, 22);
  return layered([
    { sil: tube([[178, 226], [152, 238], [140, 244]], 18, 14) },
    { sil: E(128, 236, 26, 11), d: ['M 110 234 L 146 234 M 114 240 L 142 240', 'M 128 225 L 132 214'] },
    { sil: nut, d: ['M 120 248 Q 124 262 128 272'] },
    {
      sil: [circle(158, 170, 42), E(124, 186, 26, 20, -10)],
      p: [circle(150, 164, 8), dot(152, 161, 2.5), dot(100, 182, 4), 'M 104 196 Q 112 200 118 194'],
      d: ['M 132 202 Q 150 214 172 206', 'M 176 156 L 190 150 M 178 166 L 194 164'],
    },
    { sil: shaggy(petal(170, 136, 14, 42, 11), 3, 8), d: [petal(171, 136, 14, 30, 5)] },
    { sil: E(186, 344, 44, 11), d: ['M 150 340 L 150 348 M 162 340 L 162 348'] },
    { sil: E(222, 300, 44, 44), d: furEdge(E(222, 300, 44, 44), 7, 12, undefined, 1) },
    { sil: body, d: [inside('M 166 220 Q 154 260 170 310', body), ...furEdge(body, 8, 12, undefined, 2)] },
    { sil: tail, d: chunk(tailFur.map((s) => inside(s, tail)).filter(Boolean), 6) },
  ]);
}

function raccoonArt(): Art {
  const head = smooth([
    [200, 92], [250, 98], [284, 122], [300, 150], [322, 176], [298, 186], [310, 202], [280, 212], [250, 230], [200, 238],
    [150, 230], [120, 212], [90, 202], [102, 186], [78, 176], [100, 150], [116, 122], [150, 98],
  ]);
  const body = shaggy(E(200, 292, 88, 70), 6, 16);
  const tailBase = tube([[268, 340], [318, 332], [350, 292], [344, 234]], 44, 28);
  const tail = shaggy(tailBase, 5, 12);
  const tc = curvePts([[268, 340], [318, 332], [350, 292], [344, 234]], 4);
  const rings = tc
    .filter((_, i) => i > 1 && i % 2 === 0)
    .map((p, i) => {
      const [tx, ty] = tangent(tc, i * 2 + 2);
      return `M ${f(p[0] - ty * 30)} ${f(p[1] + tx * 30)} Q ${f(p[0] + tx * 6)} ${f(p[1] + ty * 6)} ${f(p[0] + ty * 30)} ${f(p[1] - tx * 30)}`;
    })
    .join(' ');
  return layered([
    {
      sil: head,
      p: [
        'M 120 170 C 140 140 180 146 200 170 C 220 146 260 140 280 170 C 262 198 230 196 200 184 C 170 196 138 198 120 170 Z',
        circle(160, 170, 9), dot(162, 167, 2.5), circle(240, 170, 9), dot(242, 167, 2.5), E(200, 198, 12, 8), 'M 200 206 L 200 214 M 188 218 Q 194 224 200 214 Q 206 224 212 218',
      ],
      d: [petal(200, 162, 0, 56, 6), 'M 140 124 Q 160 116 176 126', 'M 260 124 Q 240 116 224 126', ...furEdge(head, 9, 12, [200, 180], 2).map((s) => inside(s, head))],
    },
    { sil: roundPoly([[122, 124], [116, 68], [166, 102]], 12), d: ['M 130 116 L 126 86 L 152 106'] },
    { sil: roundPoly([[234, 102], [284, 68], [278, 124]], 12), d: ['M 248 106 L 274 86 L 270 116'] },
    { sil: rrect(160, 310, 30, 54, 14), d: ['M 168 362 L 168 352 M 182 362 L 182 352'] },
    { sil: rrect(210, 310, 30, 54, 14), d: ['M 218 362 L 218 352 M 232 362 L 232 352'] },
    { sil: body, d: furEdge(E(200, 292, 88, 70), 9, 13, undefined, 2) },
    { sil: tail, d: [inside(rings, tail)] },
  ]);
}

function tigerArt(): Art {
  const head = smooth([
    [200, 96], [262, 104], [300, 136], [316, 186], [340, 212], [318, 222], [336, 246], [304, 252], [288, 284], [248, 312],
    [200, 320], [152, 312], [112, 284], [96, 252], [64, 246], [82, 222], [60, 212], [84, 186], [100, 136], [138, 104],
  ]);
  const side = (s: number): string[] => {
    const X = (x: number) => (s > 0 ? x : mx(x));
    return [
      petal(X(80), 158, s > 0 ? 104 : -104, 58, 8, 0), petal(X(66), 212, s > 0 ? 96 : -96, 60, 8, 0), petal(X(80), 246, s > 0 ? 84 : -84, 52, 7, 0),
      petal(X(100), 276, s > 0 ? 66 : -66, 46, 7, 0), petal(X(112), 124, s > 0 ? 128 : -128, 42, 6, 0),
    ];
  };
  const forehead = [petal(200, 88, 180, 58, 8, 0), petal(174, 92, 172, 44, 7, 0), petal(226, 92, 188, 44, 7, 0), petal(150, 112, 150, 34, 6, 0), petal(250, 112, 210, 34, 6, 0)];
  const muzzle = [circle(182, 262, 24), circle(218, 262, 24)];
  return layered([
    {
      sil: head,
      p: [
        'M 140 190 Q 160 172 184 188 Q 162 202 140 190 Z', E(164, 189, 4, 7), 'M 216 188 Q 240 172 260 190 Q 238 202 216 188 Z', E(236, 189, 4, 7),
        roundPoly([[180, 226], [220, 226], [200, 248]], 8), outline(muzzle), E(200, 292, 18, 12),
      ],
      d: [
        ...[...side(1), ...side(-1)].map((s) => inside(s, head)), ...forehead.map((s) => inside(s, head)),
        'M 190 196 Q 186 214 188 226', 'M 210 196 Q 214 214 212 226', 'M 200 248 L 200 262',
        [[170, 256], [178, 266], [168, 272], [230, 256], [222, 266], [232, 272]].map(([x, y]) => circle(x, y, 2)).join(' '),
        'M 134 176 Q 160 160 186 174', 'M 214 174 Q 240 160 266 176',
      ],
    },
    { sil: circle(124, 112, 30), d: [circle(126, 114, 16)] },
    { sil: circle(276, 112, 30), d: [circle(274, 114, 16)] },
  ]);
}

function hedgehogArt(): Art {
  const spikes: P[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -96 + (i * 192) / 40;
    const r = i % 2 ? 1 : 0.86;
    const [x, y] = polar(0, 0, 1, a);
    spikes.push([220 + x * 136 * r, 300 + y * 120 * r]);
  }
  const back = roundPoly([...spikes, [356, 318], [84, 318]], 3);
  const face = smooth([[160, 236], [118, 232], [84, 248], [56, 272], [40, 290], [50, 304], [84, 314], [130, 322], [170, 316], [178, 280]]);
  const strokes: string[] = [];
  let k = 0;
  for (let ring = 0.38; ring < 0.86; ring += 0.12)
    for (let a = -84; a <= 86; a += 9 - ring * 3) {
      k++;
      const aa = a + (rnd(k) - 0.5) * 6;
      const [x, y] = polar(0, 0, 1, aa);
      const s: P = [220 + x * 136 * ring, 300 + y * 120 * ring];
      const e: P = [220 + x * 136 * (ring + 0.14), 300 + y * 120 * (ring + 0.14)];
      strokes.push(`M ${f(s[0])} ${f(s[1])} L ${f(e[0] + 4)} ${f(e[1] - 1)}`);
    }
  const grass = [30, 200, 300, 372].map((x) => `M ${x - 6} 340 Q ${x - 6} 330 ${x - 10} 322 M ${x} 340 L ${x} 318 M ${x + 6} 340 Q ${x + 6} 330 ${x + 10} 322`).join(' ');
  return layered([
    {
      sil: face,
      p: [circle(44, 290, 7), dot(98, 266, 5), 'M 60 306 Q 70 310 80 304'],
      d: ['M 104 254 Q 112 248 120 254', 'M 132 290 Q 150 300 160 290'],
    },
    { sil: circle(136, 244, 13), d: [circle(136, 244, 6)] },
    { sil: rrect(112, 314, 24, 26, 10), d: ['M 118 338 L 118 332 M 128 338 L 128 332'] },
    { sil: rrect(270, 314, 26, 26, 10), d: ['M 276 338 L 276 332 M 288 338 L 288 332'] },
    { sil: back, d: chunk(strokes.map((s) => inside(s, back)).filter(Boolean), 8) },
    { sil: NONE, p: [line(24, 340, 376, 340)], d: [grass] },
  ]);
}

// ---- catalogue ------------------------------------------------------------------------------------------------

export const animals2: Template[] = [
  // beginner
  tpl('cat-stretching', 'Stretching cat', 'beginner', ['cat', 'pet', 'stretch', 'stylized'], catStretchArt()),
  tpl('cat-curled', 'Cat curled up asleep', 'beginner', ['cat', 'pet', 'sleeping', 'cosy'], catCurledArt()),
  tpl('pig', 'Farm pig', 'beginner', ['pig', 'farm', 'pet', 'stylized'], pigArt()),
  tpl('sheep', 'Woolly sheep', 'beginner', ['sheep', 'farm', 'wool', 'stylized'], sheepArt()),
  tpl('frog', 'Sitting frog', 'beginner', ['frog', 'garden', 'amphibian', 'stylized'], frogArt()),
  tpl('tortoise', 'Garden tortoise', 'beginner', ['tortoise', 'pet', 'garden', 'stylized'], tortoiseArt()),
  tpl('elephant', 'Elephant', 'beginner', ['elephant', 'safari', 'africa', 'stylized'], elephantArt()),
  tpl('panda', 'Sitting panda', 'beginner', ['panda', 'bear', 'safari', 'stylized'], pandaArt()),
  tpl('rabbit', 'Rabbit in profile', 'beginner', ['rabbit', 'bunny', 'pet', 'easter'], rabbitArt()),
  tpl('bear', 'Walking bear', 'beginner', ['bear', 'woodland', 'forest', 'stylized'], bearArt()),
  tpl('hamster', 'Chubby hamster', 'beginner', ['hamster', 'pet', 'stylized'], hamsterArt()),
  tpl('puppy-ball', 'Puppy with a ball', 'beginner', ['puppy', 'dog', 'pet', 'stylized'], puppyBallArt()),
  tpl('koala', 'Koala face', 'beginner', ['koala', 'australia', 'stylized'], koalaArt()),
  tpl('llama', 'Llama', 'beginner', ['llama', 'farm', 'stylized'], llamaArt()),
  // intermediate
  tpl('kitten-yarn', 'Kitten with yarn', 'intermediate', ['kitten', 'cat', 'pet', 'yarn', 'stylized'], kittenYarnArt()),
  tpl('dog-long-eared', 'Long-eared dog', 'intermediate', ['dog', 'pet', 'hound', 'stylized'], longEarDogArt()),
  tpl('dog-spotted', 'Spotted dog', 'intermediate', ['dog', 'pet', 'spots', 'stylized'], spottedDogArt()),
  tpl('horse-head', 'Horse head', 'intermediate', ['horse', 'mane', 'equestrian', 'realistic'], horseHeadArt()),
  tpl('pony', 'Pony', 'intermediate', ['pony', 'horse', 'farm', 'stylized'], ponyArt()),
  tpl('fox', 'Sitting fox', 'intermediate', ['fox', 'woodland', 'forest', 'stylized'], foxArt()),
  tpl('deer-fawn', 'Spotted fawn', 'intermediate', ['deer', 'fawn', 'woodland', 'baby'], fawnArt()),
  tpl('cow', 'Dairy cow', 'intermediate', ['cow', 'farm', 'stylized'], cowArt()),
  tpl('goat', 'Goat with horns', 'intermediate', ['goat', 'farm', 'stylized'], goatArt()),
  tpl('lamb', 'Lamb in the grass', 'intermediate', ['lamb', 'sheep', 'farm', 'easter', 'baby'], lambArt()),
  tpl('zebra', 'Zebra', 'intermediate', ['zebra', 'safari', 'africa', 'stripes'], zebraArt()),
  tpl('giraffe', 'Giraffe', 'intermediate', ['giraffe', 'safari', 'africa', 'stylized'], giraffeArt()),
  tpl('monkey', 'Monkey', 'intermediate', ['monkey', 'jungle', 'safari', 'stylized'], monkeyArt()),
  tpl('sloth', 'Sloth on a branch', 'intermediate', ['sloth', 'jungle', 'rainforest', 'stylized'], slothArt()),
  // advanced
  tpl('lion', 'Lion with a full mane', 'advanced', ['lion', 'mane', 'safari', 'africa', 'realistic'], lionArt()),
  tpl('wolf', 'Howling wolf', 'advanced', ['wolf', 'moon', 'night', 'forest', 'realistic'], wolfArt()),
  tpl('dog-shaggy', 'Shaggy dog', 'advanced', ['dog', 'pet', 'fluffy', 'realistic'], shaggyDogArt()),
  tpl('squirrel', 'Squirrel with an acorn', 'advanced', ['squirrel', 'acorn', 'woodland', 'autumn'], squirrelArt()),
  tpl('raccoon', 'Raccoon', 'advanced', ['raccoon', 'woodland', 'night', 'realistic'], raccoonArt()),
  tpl('tiger', 'Tiger face', 'advanced', ['tiger', 'stripes', 'jungle', 'realistic'], tigerArt()),
  tpl('hedgehog', 'Hedgehog in the grass', 'advanced', ['hedgehog', 'garden', 'spines', 'autumn'], hedgehogArt()),
];
