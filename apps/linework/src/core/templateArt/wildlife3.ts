// Birds & insects batch 3 (wildlife3, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Songbirds, owls, waders, garden birds, butterflies, moths, beetles and other insects of our own design, built
// from simple geometry (ellipses, smooth blobs, tubes along a curve, petals) whose overlaps are hidden with
// occlude.ts so each piece reads as one clean drawing. Beginner pieces are bold outlines; intermediate ones add
// markings and inner lines; advanced ones add feather, vein and texture detail. No sea creatures here.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, polar, poly, rotate, rrect, spiral, mirrorX, type P } from './draw.ts';
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

/** Open smooth curve through points. */
const curve = (pts: readonly P[]): string => smooth(pts, false);

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

function tangent(c: readonly P[], i: number): P {
  const a = c[Math.max(0, i - 1)];
  const b = c[Math.min(c.length - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}

/** Closed tube (leg, neck, tail) along a curve, full width w0 at the start tapering to w1, round ends. */
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

const ptsOf = (d: string, step: number): P[] => samplePath(d, step)[0].pts;

function centroid(pts: readonly P[]): P {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

/** The closed shape d redrawn with a scalloped edge (round bumps of height amp every `step` units). */
function scallop(d: string, amp: number, step: number): string {
  const all = ptsOf(d, 1);
  const pts = all.slice(0, -1);
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
    const c: P = [mx + ((mx - cx) / ol) * amp * 2, my + ((my - cy) / ol) * amp * 2];
    out += ` Q ${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;
  }
  return `${out} Z`;
}

/** Fluffy outline: short curled tufts all round the closed shape d. */
function fluffy(d: string, amp: number, step: number): string {
  const pts = ptsOf(d, 1).slice(0, -1);
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

function chunk(strokes: readonly string[], groups: number): string[] {
  const out: string[] = [];
  const s = strokes.filter(Boolean);
  const size = Math.ceil(s.length / groups) || 1;
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size).join(' '));
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

/** Rows of small feather scallops (staggered arcs) filling a box, kept inside shape; split into `groups` paths. */
function scales(shape: Layer, x0: number, y0: number, x1: number, y1: number, w: number, h: number, groups = 4): string[] {
  const out: string[] = [];
  let row = 0;
  for (let y = y0; y <= y1; y += h * 1.6, row++) {
    for (let x = x0 + (row % 2 ? w / 2 : 0); x + w <= x1; x += w) {
      out.push(`M ${f(x)} ${f(y)} Q ${f(x + w / 2)} ${f(y + h)} ${f(x + w)} ${f(y)}`);
    }
  }
  return chunk(out.map((s) => inside(s, shape)), groups);
}

/** Lines fanning from a root point across a shape (wing veins, feather barbs), kept inside the shape. */
function fan(shape: Layer, root: P, degs: readonly number[], len: number, bend = 0): string {
  return degs
    .map((a) => {
      const tip = polar(root[0], root[1], len, a);
      const mid = polar(root[0], root[1], len / 2, a + bend);
      return inside(`M ${f(root[0])} ${f(root[1])} Q ${f(mid[0])} ${f(mid[1])} ${f(tip[0])} ${f(tip[1])}`, shape);
    })
    .filter(Boolean)
    .join(' ');
}

/** Shape scaled by k toward a point (for inner bands of wings). Arcs are not supported. */
function scaleAbout(d: string, k: number, [ax, ay]: P): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const out: string[] = [];
  let cmd = '';
  let xy = 0;
  for (const tok of tokens) {
    if (/[A-Za-z]/.test(tok)) {
      cmd = tok;
      xy = 0;
      out.push(tok);
      continue;
    }
    if (cmd === 'A') throw new Error('scaleAbout: arcs not supported');
    const v = Number(tok);
    out.push(f(xy % 2 === 0 ? ax + (v - ax) * k : ay + (v - ay) * k));
    xy++;
  }
  return out.join(' ');
}

/** Mirror a shape across x = 200. */
const m = (d: string): string => mirrorX(d, 200);

/** Three-toed perching foot gripping at (x, y). */
const claw = (x: number, y: number, s = 1): string =>
  `M ${f(x - 10 * s)} ${f(y + 2)} Q ${f(x - 12 * s)} ${f(y - 8)} ${f(x - 2 * s)} ${f(y - 8)} M ${f(x)} ${f(y + 3)} Q ${f(x + 2 * s)} ${f(y - 9)} ${f(x + 10 * s)} ${f(y - 6)}`;

/** Grass tufts along a baseline. */
const grass = (xs: readonly number[], y: number): string =>
  xs.map((x) => `M ${x - 6} ${y} Q ${x - 6} ${y - 10} ${x - 11} ${y - 18} M ${x} ${y} L ${x} ${y - 22} M ${x + 6} ${y} Q ${x + 6} ${y - 10} ${x + 11} ${y - 18}`).join(' ');

/** Five-petal blossom centred on (x, y). */
function blossom(x: number, y: number, r: number, rot = 0): Item {
  const petals = Array.from({ length: 5 }, (_, i) => circle(...polar(x, y, r * 0.62, rot + i * 72), r * 0.48));
  return { sil: [...petals, circle(x, y, r * 0.4)], p: [circle(x, y, r * 0.3)], d: [fan(circle(x, y, r), [x, y], [0, 72, 144, 216, 288].map((a) => a + rot), r * 0.75)] };
}

function tpl(prefix: 'bird' | 'bug', id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `${prefix}-${id}`,
    name,
    category: 'wildlife',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- beginner: birds ------------------------------------------------------------------------------------------

function robinArt(): Art {
  const body = [circle(140, 160, 46), E(214, 224, 98, 74, -16)];
  const wing = smooth([[172, 196], [232, 186], [292, 210], [326, 252], [262, 256], [198, 238]]);
  return layered([
    { sil: wing, d: ['M 226 212 Q 262 222 292 238', 'M 214 228 Q 250 238 278 250'] },
    { sil: body, p: [dot(128, 148, 6), inside('M 102 170 Q 118 252 206 300', body)] },
    { sil: roundPoly([[102, 148], [66, 162], [102, 174]], 4), p: [line(76, 162, 100, 161)] },
    { sil: roundPoly([[282, 236], [354, 204], [364, 226], [298, 270]], 8) },
    { sil: NONE, p: ['M 194 280 L 190 332 M 222 280 L 226 332', 'M 170 334 L 190 332 L 206 336 M 208 336 L 226 332 L 246 336', line(50, 336, 350, 336)] },
  ]);
}

function sparrowPostArt(): Art {
  const head = circle(262, 138, 36);
  const body = [head, E(210, 192, 84, 54, -28)];
  const wing = smooth([[176, 168], [236, 158], [270, 180], [228, 204], [146, 228]]);
  const post = rrect(160, 256, 80, 118, 6);
  return layered([
    { sil: wing, d: ['M 200 176 Q 220 184 238 180', 'M 186 192 Q 210 198 232 194', 'M 172 208 Q 196 210 220 204'] },
    { sil: body, p: [dot(272, 132, 5), 'M 246 120 Q 262 110 282 116', inside('M 252 160 Q 268 168 288 156', head)] },
    { sil: roundPoly([[292, 128], [320, 140], [294, 150]], 4) },
    { sil: roundPoly([[156, 212], [94, 262], [110, 280], [176, 236]], 6) },
    { sil: NONE, p: ['M 206 232 L 202 256 M 226 226 L 226 256', claw(202, 257), claw(226, 257)] },
    { sil: post, p: [line(160, 270, 240, 270)], d: ['M 180 290 Q 186 320 178 360', 'M 214 284 Q 208 316 218 352'] },
  ]);
}

function wrenArt(): Art {
  const body = [circle(196, 222, 70), circle(146, 176, 40)];
  return layered([
    { sil: petal(178, 214, 118, 82, 22, 0.5), d: ['M 196 214 Q 220 226 236 244', 'M 190 228 Q 210 240 226 256'] },
    { sil: body, p: [dot(138, 168, 5), 'M 124 154 Q 148 144 176 158'] },
    { sil: roundPoly([[110, 166], [74, 174], [110, 182]], 3) },
    { sil: petal(236, 182, 36, 92, 17, 0.6), d: ['M 254 156 L 266 166 M 262 140 L 276 150 M 270 124 L 284 134'] },
    { sil: NONE, p: ['M 190 286 L 186 304 M 212 284 L 214 304', claw(186, 306), claw(214, 306), curve([[36, 312], [140, 304], [250, 306], [364, 296]]), 'M 300 302 Q 318 282 340 278'] },
  ]);
}

function chickEggArt(): Art {
  const shell = 'M 116 236 C 116 320 156 360 200 360 C 244 360 284 320 284 236 L 264 216 L 244 242 L 222 218 L 200 244 L 178 218 L 156 242 L 136 216 Z';
  const capBase = 'M 146 150 C 146 92 254 92 254 150 L 238 138 L 220 158 L 200 136 L 180 158 L 162 138 Z';
  const cap = rotate(capBase, -14, 200, 140);
  return layered([
    { sil: cap },
    { sil: shell, d: ['M 150 300 Q 160 330 186 342', 'M 254 290 L 262 280'] },
    {
      sil: circle(200, 196, 60),
      p: [dot(178, 186, 6), dot(222, 186, 6), roundPoly([[188, 202], [212, 202], [200, 220]], 3), line(190, 208, 210, 208)],
    },
    { sil: petal(146, 222, 240, 40, 13) },
    { sil: petal(254, 222, 120, 40, 13) },
    { sil: NONE, p: ['M 84 150 L 104 160 M 80 196 L 102 196 M 316 150 L 296 160 M 320 196 L 298 196', 'M 104 110 L 118 124 M 296 110 L 282 124'] },
  ]);
}

function owlRoundArt(): Art {
  const body = [E(200, 214, 88, 106), roundPoly([[118, 154], [118, 92], [162, 128]], 8), roundPoly([[282, 154], [282, 92], [238, 128]], 8)];
  const face = outline([circle(166, 180, 36), circle(234, 180, 36)]);
  const feet = (x: number) => [circle(x - 12, 316, 9), circle(x, 318, 9), circle(x + 12, 316, 9)];
  const vs = [[180, 252], [220, 252], [200, 276], [170, 290], [230, 290]].map(([x, y]) => `M ${x - 9} ${y} L ${x} ${y + 8} L ${x + 9} ${y}`).join(' ');
  return layered([
    { sil: feet(176) },
    { sil: feet(224) },
    {
      sil: body,
      p: [face, circle(166, 182, 16), circle(234, 182, 16), dot(169, 184, 7), dot(231, 184, 7), roundPoly([[189, 208], [211, 208], [200, 232]], 4), 'M 122 196 Q 108 266 152 316', 'M 278 196 Q 292 266 248 316'],
      d: [vs],
    },
    { sil: tube([[30, 330], [200, 322], [370, 338]], 24, 18), d: ['M 70 326 L 96 324', 'M 300 330 L 330 332'] },
    { sil: petal(330, 324, 30, 50, 14), d: ['M 330 324 L 352 286'] },
  ]);
}

function duckArt(): Art {
  const body = smooth([[84, 196], [140, 210], [220, 204], [282, 214], [304, 250], [272, 290], [182, 300], [118, 282], [94, 240]]);
  const head = [circle(262, 134, 40), tube([[258, 216], [262, 160]], 52, 46)];
  const wing = smooth([[150, 228], [210, 218], [262, 236], [238, 262], [170, 262], [124, 244]]);
  const foot = (x: number) => roundPoly([[x, 330], [x + 30, 340], [x - 6, 342]], 4);
  return layered([
    { sil: wing, d: ['M 168 240 Q 200 246 230 242', 'M 156 252 Q 190 256 216 254'] },
    { sil: [body, ...head], p: [dot(272, 124, 6)] },
    { sil: roundPoly([[292, 128], [342, 136], [340, 152], [294, 156]], 8), p: [line(300, 144, 336, 145)] },
    { sil: NONE, p: ['M 186 296 L 184 330 M 226 294 L 228 330'] },
    { sil: foot(184) },
    { sil: foot(228) },
    { sil: NONE, p: [line(40, 344, 360, 344)] },
  ]);
}

function henArt(): Art {
  const body = smooth([[150, 190], [190, 196], [250, 186], [300, 200], [320, 250], [290, 300], [210, 312], [150, 290], [126, 240]]);
  const head = [circle(150, 150, 38), tube([[156, 230], [152, 170]], 54, 44)];
  const tail = [petal(286, 210, 30, 110, 22), petal(296, 216, 52, 100, 20), petal(300, 226, 74, 86, 18)];
  const wing = smooth([[178, 230], [240, 220], [290, 240], [262, 276], [200, 276], [170, 252]]);
  return layered([
    { sil: wing, d: ['M 196 246 Q 230 250 264 246', 'M 192 260 Q 224 266 252 262'] },
    { sil: [body, ...head], p: [dot(140, 142, 6)] },
    { sil: roundPoly([[116, 148], [92, 158], [116, 166]], 3) },
    { sil: [circle(128, 176, 9), circle(124, 190, 8)] },
    { sil: [circle(136, 112, 11), circle(154, 106, 12), circle(172, 114, 10)] },
    { sil: tail },
    { sil: NONE, p: ['M 200 306 L 196 340 M 244 304 L 246 340', 'M 176 342 L 196 340 L 212 344 M 228 344 L 246 340 L 264 344', line(50, 346, 350, 346)] },
  ]);
}

function nestEggsArt(): Art {
  const bowl = 'M 78 236 C 78 336 322 336 322 236 C 270 258 130 258 78 236 Z';
  const backRim = E(200, 236, 122, 24);
  const weave = [
    'M 96 268 Q 200 292 304 268', 'M 116 296 Q 200 316 284 296', 'M 140 258 L 160 310 M 200 262 L 200 316 M 260 258 L 240 310',
  ];
  return layered([
    { sil: bowl, d: [inside(weave.join(' '), bowl)], p: ['M 84 244 L 52 226', 'M 316 246 L 352 232', 'M 300 300 L 334 316'] },
    { sil: E(160, 222, 30, 38, -12), d: ['M 146 202 Q 150 194 158 192'] },
    { sil: E(246, 222, 29, 36, 12) },
    { sil: E(204, 212, 30, 40), d: ['M 190 192 Q 194 184 202 182'] },
    { sil: backRim },
    { sil: NONE, p: [curve([[40, 352], [200, 340], [360, 352]])], d: ['M 120 340 L 110 356 M 280 340 L 290 356'] },
  ]);
}

function swanGlideArt(): Art {
  const body = smooth([[110, 248], [160, 218], [250, 220], [330, 196], [312, 248], [256, 290], [150, 292]]);
  const neck = tube([[150, 236], [116, 180], [124, 126], [162, 102]], 30, 20);
  const wing = smooth([[170, 236], [230, 214], [300, 190], [326, 178], [300, 226], [250, 262], [190, 262]]);
  return layered([
    { sil: wing, d: ['M 214 234 Q 250 224 286 204', 'M 210 248 Q 248 240 282 222'] },
    { sil: [body, neck, circle(172, 104, 20)], p: [dot(176, 98, 4)] },
    { sil: roundPoly([[188, 96], [226, 112], [190, 118]], 5), p: [line(196, 102, 190, 110)] },
    { sil: NONE, p: ['M 60 306 Q 90 298 120 306 Q 150 314 180 306', 'M 220 314 Q 250 306 280 314 Q 310 322 340 314', 'M 120 330 Q 150 322 180 330 Q 210 338 240 330'] },
  ]);
}

function featherCurveArt(): Art {
  const vane = smooth([[150, 318], [122, 282], [114, 252], [138, 238], [118, 222], [126, 180], [150, 132], [190, 92], [238, 64], [266, 56], [286, 80], [290, 130], [280, 180], [266, 210], [248, 214], [254, 238], [226, 276], [186, 304], [160, 318]]);
  const barbs = ['M 168 262 Q 146 262 128 270', 'M 184 214 Q 160 206 136 204', 'M 204 168 Q 184 156 160 150', 'M 226 124 Q 210 108 190 102', 'M 190 226 Q 214 222 236 214', 'M 212 180 Q 238 172 258 158', 'M 236 128 Q 256 116 268 100'];
  return layered([
    { sil: NONE, p: [curve([[128, 364], [150, 300], [184, 200], [236, 98], [264, 60]])] },
    { sil: vane, d: [inside(barbs.join(' '), vane)] },
  ]);
}

// ---- beginner: insects ----------------------------------------------------------------------------------------

function ladybirdTopArt(): Art {
  const body = circle(200, 226, 104);
  const legs = [-1, 1].flatMap((s) => [
    tube([[200 + 90 * s, 170], [200 + 132 * s, 146], [200 + 148 * s, 120]], 10, 8),
    tube([[200 + 100 * s, 230], [200 + 150 * s, 236], [200 + 166 * s, 220]], 10, 8),
    tube([[200 + 86 * s, 290], [200 + 128 * s, 318], [200 + 136 * s, 346]], 10, 8),
  ]);
  const spots = [[150, 200, 18], [140, 268, 15], [178, 310, 12], [250, 200, 18], [260, 268, 15], [222, 310, 12]].map(([x, y, r]) => circle(x, y, r));
  return layered([
    { sil: body, p: [line(200, 140, 200, 330), ...spots] },
    { sil: E(200, 132, 64, 30) , p: [dot(176, 128, 9), dot(224, 128, 9)] },
    { sil: E(200, 98, 38, 26), p: [dot(186, 92, 4), dot(214, 92, 4)] },
    { sil: NONE, p: ['M 186 76 Q 176 52 152 44', 'M 214 76 Q 224 52 248 44'] },
    ...legs.map((l) => ({ sil: l })),
  ]);
}

function butterflySimpleArt(): Art {
  const up = smooth([[194, 190], [160, 120], [100, 82], [56, 98], [58, 160], [96, 206], [160, 214]]);
  const lo = smooth([[194, 214], [140, 220], [96, 260], [100, 312], [150, 322], [190, 262]]);
  return layered([
    { sil: E(200, 220, 12, 66), d: ['M 190 236 L 210 236 M 190 252 L 210 252 M 190 268 L 210 268'] },
    { sil: circle(200, 144, 15) },
    { sil: NONE, p: ['M 194 132 Q 178 90 150 74', 'M 206 132 Q 222 90 250 74', dot(148, 72, 5), dot(252, 72, 5)] },
    { sil: up, p: [circle(118, 140, 20)] },
    { sil: m(up), p: [circle(282, 140, 20)] },
    { sil: lo, p: [circle(140, 280, 13)] },
    { sil: m(lo), p: [circle(260, 280, 13)] },
  ]);
}

function beeFlyingArt(): Art {
  const body = E(212, 222, 92, 66, -8);
  const stripes = 'M 186 150 Q 166 222 192 294 M 236 146 Q 214 222 240 290';
  return layered([
    {
      sil: circle(116, 206, 46),
      p: [dot(100, 196, 6), 'M 94 222 Q 106 232 120 224'],
    },
    { sil: NONE, p: ['M 104 164 Q 92 128 70 118', 'M 124 162 Q 128 126 150 112', dot(68, 117, 5), dot(152, 110, 5)] },
    { sil: body, p: [inside(stripes, body)] },
    { sil: roundPoly([[298, 206], [330, 216], [300, 234]], 4) },
    { sil: E(196, 122, 36, 58, -28), d: ['M 196 172 Q 190 130 176 100'] },
    { sil: E(250, 132, 32, 50, 18), d: ['M 236 176 Q 248 140 262 112'] },
    { sil: NONE, p: ['M 336 260 Q 352 280 340 296', 'M 322 312 Q 304 330 318 346', 'M 342 348 Q 366 356 370 334'] },
  ]);
}

function snailArt(): Art {
  const shell = circle(226, 196, 86);
  const body = smooth([[60, 300], [72, 248], [100, 226], [132, 238], [148, 278], [300, 278], [364, 300], [330, 318], [80, 318]]);
  return layered([
    { sil: shell, p: [inside(spiral(214, 196, 13, 6), shell)] },
    { sil: body, p: [dot(106, 252, 5), 'M 88 274 Q 96 282 108 278'] },
    { sil: NONE, p: ['M 96 238 Q 86 198 70 180', 'M 114 236 Q 116 196 128 176', dot(70, 178, 6), dot(128, 174, 6), curve([[30, 320], [200, 318], [370, 322]])] },
  ]);
}

function caterpillarLeafArt(): Art {
  const segs: Item[] = [];
  const spine = curvePts([[118, 196], [170, 222], [220, 196], [270, 222], [320, 214]], 2);
  const head = circle(110, 190, 34);
  segs.push({
    sil: head,
    p: [dot(100, 184, 5), dot(124, 184, 5), 'M 100 202 Q 112 212 124 202'],
  });
  segs.push({ sil: NONE, p: ['M 98 158 Q 88 132 72 126', 'M 120 158 Q 128 132 146 124', dot(72, 125, 5), dot(147, 123, 5)] });
  spine.slice(1).forEach(([x, y], i) => {
    const r = 28 - i * 1.1;
    segs.push({ sil: circle(x, y, r), d: [`M ${f(x - 6)} ${f(y + r - 2)} L ${f(x - 8)} ${f(y + r + 8)} M ${f(x + 6)} ${f(y + r - 2)} L ${f(x + 8)} ${f(y + r + 8)}`] });
  });
  const leaf = petal(36, 300, 78, 344, 46, 0.45);
  segs.push({ sil: leaf, p: [inside('M 36 300 Q 200 260 372 230', leaf)], d: [inside('M 120 280 L 104 240 M 200 266 L 186 226 M 280 250 L 268 214 M 130 284 L 148 320 M 210 270 L 230 302', leaf)] });
  return layered(segs);
}

function spiderThreadArt(): Art {
  const legs = [-1, 1].flatMap((s) => [
    [[200 + 18 * s, 214], [200 + 70 * s, 176], [200 + 104 * s, 210]],
    [[200 + 22 * s, 226], [200 + 86 * s, 214], [200 + 116 * s, 252]],
    [[200 + 22 * s, 240], [200 + 80 * s, 252], [200 + 102 * s, 300]],
    [[200 + 18 * s, 252], [200 + 62 * s, 284], [200 + 70 * s, 334]],
  ] as P[][]);
  return layered([
    { sil: circle(200, 196, 26), p: [dot(190, 192, 5), dot(210, 192, 5), 'M 192 206 Q 200 212 208 206'] },
    { sil: circle(200, 258, 44), d: ['M 186 240 Q 200 250 214 240 M 184 262 Q 200 272 216 262'] },
    ...legs.map((l) => ({ sil: tube(l, 9, 6) })),
    { sil: NONE, p: [line(200, 24, 200, 172)] },
  ]);
}

// ---- intermediate: birds --------------------------------------------------------------------------------------

function kingfisherArt(): Art {
  const head = circle(160, 150, 46);
  const body = [head, E(214, 216, 58, 84, -32)];
  const wing = smooth([[200, 188], [250, 190], [286, 236], [292, 276], [256, 262], [210, 236]]);
  return layered([
    { sil: wing, p: [], d: [inside('M 228 214 Q 250 222 266 244 M 222 232 Q 246 244 262 266', wing), dot(234, 206, 3), dot(250, 214, 3), dot(244, 196, 3)] },
    {
      sil: body,
      p: [dot(150, 140, 6), inside('M 120 160 Q 150 178 188 168 Q 200 156 210 162', head), inside('M 132 176 Q 160 250 228 296', body)],
      d: [inside('M 140 112 L 146 120 M 158 108 L 162 118 M 176 110 L 178 120', head)],
    },
    { sil: roundPoly([[124, 138], [44, 160], [124, 166]], 3), p: [line(56, 158, 122, 153)] },
    { sil: petal(262, 282, 146, 62, 14) },
    { sil: NONE, p: ['M 210 290 L 206 304 M 230 284 L 228 300', claw(206, 306), claw(228, 300)] },
    { sil: tube([[40, 336], [210, 304], [362, 252]], 18, 12), d: ['M 90 324 L 118 320 M 260 284 L 290 274'] },
    { sil: tube([[300, 274], [334, 300], [352, 330]], 10, 6) },
  ]);
}

function heronArt(): Art {
  const body = smooth([[192, 150], [238, 128], [300, 140], [356, 196], [304, 192], [234, 204], [196, 188]]);
  const neck = tube([[206, 164], [178, 132], [204, 96], [176, 66]], 24, 16);
  const head = E(168, 64, 22, 15, -10);
  return layered([
    { sil: body, d: ['M 236 152 Q 280 156 330 188', 'M 226 172 Q 270 176 312 194'] },
    { sil: [neck, head], p: [dot(162, 60, 3.5)], d: ['M 184 116 L 192 120 M 186 128 L 196 130 M 190 140 L 200 142'] },
    { sil: roundPoly([[152, 58], [84, 74], [152, 72]], 3) },
    { sil: NONE, p: ['M 180 54 Q 214 46 238 58'] },
    { sil: tube([[246, 194], [250, 280], [248, 350]], 8, 6) },
    { sil: NONE, p: ['M 252 280 L 276 254 L 256 230', 'M 222 352 L 248 350 L 278 354 M 248 350 L 238 360'] },
    { sil: NONE, p: [line(40, 360, 360, 360), 'M 330 360 Q 326 300 336 236', 'M 344 360 Q 346 310 360 264', 'M 64 360 Q 58 310 70 260', 'M 80 360 Q 84 320 98 292'], d: ['M 100 374 Q 130 368 160 374 M 230 374 Q 260 368 290 374'] },
  ]);
}

function flamingoArt(): Art {
  const body = smooth([[132, 168], [170, 140], [240, 140], [282, 160], [264, 196], [200, 206], [150, 196]]);
  const neck = tube([[256, 158], [292, 116], [254, 74], [262, 40]], 22, 16);
  const head = circle(266, 40, 16);
  return layered([
    { sil: smooth([[160, 158], [210, 150], [258, 164], [230, 188], [176, 186]]), d: ['M 178 168 Q 208 168 236 172', 'M 184 178 Q 208 180 228 182'] },
    { sil: [body, neck, head], p: [dot(270, 36, 3.5)] },
    { sil: 'M 278 34 Q 300 40 300 60 Q 298 76 288 82 Q 290 66 280 58 Z', p: ['M 296 66 L 290 72'] },
    { sil: NONE, p: ['M 130 172 L 104 182 L 120 160'] },
    { sil: tube([[200, 200], [206, 280], [198, 356]], 8, 6) },
    { sil: tube([[212, 202], [246, 252], [208, 276]], 8, 6) },
    { sil: NONE, p: ['M 176 358 L 198 356 L 222 360'] },
    { sil: NONE, p: [line(60, 362, 340, 362)], d: ['M 90 376 Q 120 370 150 376 M 250 376 Q 280 370 310 376'] },
  ]);
}

function parrotPerchArt(): Art {
  const head = circle(186, 112, 46);
  const body = [head, E(216, 194, 58, 86, -12)];
  const beak = 'M 152 92 C 118 86 98 112 108 146 C 112 134 124 128 134 132 C 140 118 148 112 156 114 Z';
  const wing = smooth([[214, 140], [262, 170], [272, 240], [262, 290], [228, 266], [208, 206]]);
  return layered([
    { sil: wing, d: [inside('M 222 190 Q 246 200 262 196 M 222 214 Q 246 226 266 222 M 226 240 Q 248 252 266 250 M 236 264 L 262 280', wing)] },
    { sil: [circle(206, 276, 12), circle(226, 276, 12)] },
    { sil: body, p: [circle(184, 102, 11), dot(186, 102, 4.5)], d: [inside('M 160 120 Q 170 126 178 122 M 162 130 Q 172 136 182 132', head)] },
    { sil: beak, p: ['M 118 134 Q 128 124 140 126'] },
    { sil: rrect(56, 280, 290, 18, 9), d: ['M 90 284 L 110 284 M 290 292 L 316 292'] },
    { sil: petal(244, 270, 166, 104, 18, 0.35), d: ['M 244 270 L 254 362'] },
    { sil: petal(230, 274, 184, 92, 14, 0.35) },
  ]);
}

function toucanArt(): Art {
  const head = circle(226, 128, 38);
  const body = [head, E(250, 214, 52, 82, -10)];
  const beak = 'M 200 112 C 156 90 96 104 62 148 C 100 152 150 156 198 148 Z';
  return layered([
    { sil: smooth([[248, 160], [290, 186], [298, 250], [286, 296], [258, 270], [246, 210]]), d: ['M 262 210 Q 280 220 292 218 M 262 236 Q 282 248 294 246'] },
    { sil: body, p: [circle(234, 120, 12), dot(236, 120, 5), inside('M 204 146 Q 220 176 252 178 Q 266 168 262 150', body)] },
    { sil: beak, p: ['M 72 144 Q 130 128 198 128', 'M 172 104 L 168 150'] },
    { sil: NONE, p: ['M 236 290 L 234 306 M 256 288 L 256 306', claw(234, 308), claw(256, 308)] },
    { sil: tube([[40, 322], [220, 308], [362, 318]], 20, 16), d: ['M 80 318 L 110 316 M 300 316 L 330 318'] },
    { sil: petal(266, 280, 172, 92, 16, 0.4), d: ['M 266 280 L 278 360'] },
    { sil: petal(110, 314, 210, 46, 14), d: ['M 110 314 L 88 350'] },
  ]);
}

function eagleHeadArt(): Art {
  const neckJag: P[] = [];
  for (let i = 0; i <= 10; i++) neckJag.push([310 - i * 19, i % 2 ? 330 : 350]);
  const head = smooth([[146, 128], [190, 86], [256, 76], [318, 110], [340, 180], [328, 260], [314, 316]], false);
  const headShape = `${head} L ${neckJag.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} L 120 300 Q 132 240 146 196 Z`;
  const beak = 'M 152 124 C 108 116 70 138 62 178 C 60 196 70 210 80 216 C 82 198 92 188 108 188 L 156 190 Z';
  return layered([
    {
      sil: headShape,
      p: [circle(184, 140, 11), dot(186, 140, 5), 'M 160 122 Q 184 110 216 124'],
      d: ['M 214 170 Q 232 200 228 232', 'M 250 150 Q 270 190 262 230', 'M 290 160 Q 304 200 296 250', 'M 190 230 Q 212 260 206 300', 'M 240 260 Q 256 290 250 320'],
    },
    { sil: beak, p: ['M 92 186 Q 120 176 150 168', E(132, 150, 5, 3)] },
  ]);
}

function hummingbirdHoverArt(): Art {
  const head = circle(150, 160, 30);
  const body = [head, tube([[156, 172], [216, 220], [266, 286]], 54, 22)];
  return layered([
    { sil: body, p: [dot(142, 154, 5)], d: [inside('M 128 176 Q 156 200 186 196', body), inside('M 170 214 Q 200 230 216 226', body)] },
    { sil: roundPoly([[124, 152], [40, 124], [124, 162]], 2) },
    { sil: petal(196, 196, -6, 150, 28, 0.6), d: ['M 196 196 L 190 80 M 202 196 L 214 104'] },
    { sil: petal(214, 204, 30, 140, 24, 0.6), d: ['M 214 204 L 274 100'] },
    { sil: [petal(262, 280, 160, 70, 10, 0.4), petal(270, 280, 196, 70, 10, 0.4)] },
    { sil: NONE, p: ['M 300 130 L 316 126 M 296 150 L 314 152', 'M 116 224 L 102 236 M 128 238 L 118 252'] },
  ]);
}

function swallowArt(): Art {
  const wing = smooth([[206, 166], [270, 146], [334, 156], [378, 196], [318, 190], [262, 196], [212, 204]]);
  const tail = roundPoly([[186, 244], [166, 346], [200, 284], [234, 346], [214, 244]], 5);
  return layered([
    { sil: [E(200, 202, 26, 62), circle(200, 130, 24)], p: [dot(190, 124, 4), dot(210, 124, 4), inside('M 180 150 Q 200 166 220 150', E(200, 202, 26, 62))], d: ['M 192 220 L 192 250 M 208 220 L 208 250'] },
    { sil: roundPoly([[192, 108], [200, 92], [208, 108]], 3) },
    { sil: wing, d: [inside('M 240 176 Q 290 172 336 186 M 230 190 Q 280 184 320 192 M 300 160 L 312 190', wing)] },
    { sil: m(wing), d: [m(inside('M 240 176 Q 290 172 336 186 M 230 190 Q 280 184 320 192 M 300 160 L 312 190', wing))] },
    { sil: tail, d: ['M 200 260 L 200 280'] },
    { sil: NONE, p: ['M 60 86 Q 76 80 92 86', 'M 304 286 Q 320 280 336 286', 'M 90 300 Q 102 294 114 300'] },
  ]);
}

// ---- intermediate: insects ------------------------------------------------------------------------------------

function monarchArt(): Art {
  const fore = smooth([[194, 188], [168, 118], [112, 64], [62, 56], [48, 90], [74, 166], [148, 204]]);
  const hind = smooth([[194, 212], [134, 214], [96, 262], [108, 314], [162, 324], [194, 256]]);
  const veinsF = fan(fore, [190, 194], [-20, -36, -52, -66, -80, -96], 170, 6);
  const veinsH = fan(hind, [190, 216], [-130, -150, -172, -196], 120, -6);
  const bandF = scaleAbout(fore, 0.8, [190, 194]);
  const bandH = scaleAbout(hind, 0.8, [190, 216]);
  const spots = (d: string, n: number) => ptsOf(d, 4).filter((_, i, a) => i % Math.floor(a.length / n) === 0).slice(0, n);
  const dotsF = spots(scaleAbout(fore, 0.9, [190, 194]), 14).filter(([x, y]) => y < 190 || x < 120).map(([x, y]) => circle(x, y, 3)).join(' ');
  const dotsH = spots(scaleAbout(hind, 0.9, [190, 216]), 12).filter(([x]) => x < 186).map(([x, y]) => circle(x, y, 3)).join(' ');
  const R = (s: string) => m(s);
  return layered([
    { sil: E(200, 222, 11, 68), d: ['M 190 240 L 210 240 M 190 256 L 210 256 M 190 272 L 210 272'] },
    { sil: E(200, 186, 14, 20) },
    { sil: circle(200, 158, 13) },
    { sil: NONE, p: ['M 194 146 Q 180 100 156 82', 'M 206 146 Q 220 100 244 82', dot(155, 80, 4.5), dot(245, 80, 4.5)] },
    { sil: fore, p: [inside(bandF, fore)], d: [veinsF, dotsF] },
    { sil: R(fore), p: [inside(R(bandF), R(fore))], d: [R(veinsF), R(dotsF)] },
    { sil: hind, p: [inside(bandH, hind)], d: [veinsH, dotsH] },
    { sil: R(hind), p: [inside(R(bandH), R(hind))], d: [R(veinsH), R(dotsH)] },
  ]);
}

function mothFluffyArt(): Art {
  const fore = smooth([[194, 176], [140, 128], [62, 120], [32, 150], [52, 196], [120, 222], [190, 214]]);
  const hind = smooth([[192, 220], [130, 232], [104, 272], [130, 300], [176, 290], [196, 248]]);
  const body = fluffy(E(200, 222, 20, 66), 5, 9);
  const thorax = fluffy(circle(200, 172, 26), 5, 8);
  const antenna = (s: number) => {
    const spine = curvePts([[200 + 8 * s, 148], [200 + 30 * s, 110], [200 + 70 * s, 84]], 6);
    return [curve([[200 + 8 * s, 148], [200 + 30 * s, 110], [200 + 70 * s, 84]]), spine.slice(2).map(([x, y], i) => `M ${f(x)} ${f(y)} L ${f(x + 10 * s)} ${f(y + 8 - i * 0.3)} M ${f(x)} ${f(y)} L ${f(x - 4 * s)} ${f(y - 10)}`).join(' ')];
  };
  const bands = 'M 160 154 Q 120 170 120 216 M 110 136 Q 90 170 84 210';
  return layered([
    { sil: thorax },
    { sil: body, d: ['M 186 214 Q 200 222 214 214 M 186 236 Q 200 244 214 236 M 188 258 Q 200 266 212 258'] },
    { sil: circle(200, 142, 13), p: [dot(194, 140, 3), dot(206, 140, 3)] },
    { sil: NONE, p: antenna(-1) },
    { sil: NONE, p: antenna(1) },
    { sil: fore, p: [circle(104, 172, 14), dot(104, 172, 5)], d: [inside(bands, fore)] },
    { sil: m(fore), p: [circle(296, 172, 14), dot(296, 172, 5)], d: [m(inside(bands, fore))] },
    { sil: hind, d: [inside('M 180 236 Q 150 250 130 280', hind)] },
    { sil: m(hind), d: [m(inside('M 180 236 Q 150 250 130 280', hind))] },
  ]);
}

function damselflyReedArt(): Art {
  const reed = tube([[96, 368], [104, 240], [124, 60]], 16, 10);
  const eyes = [circle(112, 186, 14), circle(126, 176, 14)];
  return layered([
    { sil: eyes, p: [dot(116, 182, 4)] },
    { sil: E(152, 196, 26, 15, 10), d: ['M 140 188 L 146 204 M 156 186 L 162 204'] },
    { sil: tube([[176, 202], [270, 214], [364, 206]], 12, 8), d: [[200, 226, 252, 278, 304, 330].map((x) => line(x, 199 + (x - 176) * 0.08, x, 213 + (x - 176) * 0.06)).join(' ')] },
    { sil: petal(160, 188, 74, 176, 13, 0.6), d: ['M 160 188 Q 250 166 330 144'] },
    { sil: petal(166, 186, 64, 168, 12, 0.6) },
    { sil: NONE, p: ['M 144 208 L 128 226 L 112 224', 'M 156 210 L 146 234 L 110 238', 'M 166 208 L 166 240 L 112 250'] },
    { sil: reed, d: ['M 102 300 L 112 306 M 108 200 L 118 206'] },
    { sil: petal(100, 290, -40, 90, 10), d: ['M 100 290 L 46 222'] },
  ]);
}

function grasshopperArt(): Art {
  const body = tube([[110, 196], [200, 204], [326, 214]], 50, 26);
  const head = E(98, 196, 30, 40, -16);
  return layered([
    { sil: tube([[214, 216], [262, 174], [304, 132]], 34, 14), d: ['M 228 200 L 250 182 M 244 206 L 270 176 M 262 200 L 286 162'] },
    { sil: tube([[306, 132], [326, 210], [348, 288]], 10, 8), d: ['M 316 170 L 324 166 M 322 200 L 330 196 M 330 230 L 338 226 M 336 260 L 344 256'] },
    { sil: NONE, p: ['M 340 292 L 360 296 M 348 288 L 356 300'] },
    { sil: head, p: [E(94, 184, 9, 12), 'M 84 222 Q 92 232 104 228'] },
    { sil: petal(128, 186, 96, 196, 16, 0.5), d: ['M 150 186 Q 230 186 310 198'] },
    { sil: body, p: [inside('M 128 172 Q 136 200 128 228 M 162 172 Q 170 200 162 230', body)], d: [inside('M 200 216 L 220 222 M 240 220 L 260 226 M 280 224 L 300 228', body)] },
    { sil: NONE, p: ['M 92 160 Q 140 90 230 70', 'M 104 162 Q 160 104 250 96'] },
    { sil: tube([[132, 226], [118, 260], [100, 292]], 8, 6) },
    { sil: tube([[170, 228], [174, 262], [160, 294]], 8, 6) },
    { sil: NONE, p: [curve([[40, 300], [200, 296], [370, 300]])], d: [grass([60, 230, 372], 300)] },
  ]);
}

function stagBeetleArt(): Art {
  const elytra = E(200, 268, 72, 96);
  const mand = (s: number) => smooth([[200 - 16 * s, 116], [200 - 40 * s, 92], [200 - 50 * s, 56], [200 - 36 * s, 26], [200 - 26 * s, 30], [200 - 32 * s, 54], [200 - 22 * s, 62], [200 - 30 * s, 70], [200 - 24 * s, 96], [200 - 6 * s, 112]]);
  const legs = [-1, 1].flatMap((s) => [
    [[200 + 50 * s, 160], [200 + 112 * s, 130], [200 + 140 * s, 90]],
    [[200 + 64 * s, 212], [200 + 128 * s, 220], [200 + 160 * s, 196]],
    [[200 + 60 * s, 290], [200 + 120 * s, 320], [200 + 140 * s, 368]],
  ] as P[][]);
  return layered([
    { sil: elytra, p: [line(200, 176, 200, 362)], d: ['M 160 210 Q 150 270 166 330', 'M 240 210 Q 250 270 234 330'] },
    { sil: E(200, 164, 64, 34), d: ['M 172 160 Q 200 150 228 160'] },
    { sil: E(200, 122, 44, 24), p: [dot(166, 120, 6), dot(234, 120, 6)] },
    { sil: mand(1) },
    { sil: mand(-1) },
    { sil: NONE, p: ['M 162 128 L 122 120 L 108 92', 'M 238 128 L 278 120 L 292 92'] },
    ...legs.map((l) => ({ sil: tube(l, 12, 8) })),
  ]);
}

function fireflyArt(): Art {
  const body = tube([[150, 200], [220, 216], [286, 236]], 34, 26);
  const glow = E(300, 240, 30, 24, 16);
  const sparkle = (x: number, y: number, r: number) => `M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`;
  return layered([
    { sil: circle(128, 196, 26), p: [dot(120, 190, 5)] },
    { sil: NONE, p: ['M 116 174 Q 96 140 70 132', 'M 128 172 Q 120 132 132 108'] },
    { sil: E(200, 156, 60, 26, -30), d: ['M 160 182 Q 200 156 244 128'] },
    { sil: E(222, 166, 58, 24, -12), d: ['M 176 178 Q 220 166 270 156'] },
    { sil: glow },
    { sil: body, d: ['M 236 210 Q 230 228 238 248 M 256 218 Q 250 234 256 252'] },
    { sil: NONE, p: ['M 160 214 L 150 246 M 190 224 L 186 254 M 220 232 L 222 262'] },
    { sil: NONE, p: ['M 342 228 L 366 222 M 338 260 L 360 272 M 318 276 L 328 298 M 310 202 L 320 182', sparkle(84, 300, 12), sparkle(318, 92, 14), sparkle(56, 70, 9)] },
  ]);
}

// ---- advanced -------------------------------------------------------------------------------------------------

function peacockArt(): Art {
  const C: P = [200, 304];
  const R = 172;
  const edge: P[] = [];
  for (let a = -86; a <= 86; a += 8.6) edge.push(polar(C[0], C[1], R, a));
  let fanOut = `M ${f(edge[0][0])} ${f(edge[0][1])}`;
  for (let i = 1; i < edge.length; i++) {
    const mid = polar(C[0], C[1], R + 18, -86 + (i - 0.5) * 8.6);
    fanOut += ` Q ${f(mid[0])} ${f(mid[1])} ${f(edge[i][0])} ${f(edge[i][1])}`;
  }
  fanOut += ' Q 300 344 200 334 Q 100 344 28.4 292 Z';
  const eye = (r: number, a: number, s: number): Item => {
    const [x, y] = polar(C[0], C[1], r, a);
    const drop = rotate(petal(x, y + 24 * s, 0, 46 * s, 15 * s, 0.62), a, x, y);
    return { sil: drop, p: [rotate(E(x, y - 6 * s, 8 * s, 11 * s), a, x, y)], d: [rotate(dot(x, y - 8 * s, 3.5 * s), a, x, y)] };
  };
  const eyes: Item[] = [];
  for (let a = -78; a <= 78.1; a += 13) eyes.push(eye(146, a, 1));
  for (let a = -66; a <= 66.1; a += 16.5) eyes.push(eye(96, a, 0.82));
  const quills: string[] = [];
  for (let a = -84; a <= 84.1; a += 6.5) {
    const [x, y] = polar(C[0], C[1], R - 4, a);
    quills.push(`M ${f(C[0])} ${f(C[1])} L ${f(x)} ${f(y)}`);
  }
  const body = [E(200, 286, 34, 56), tube([[200, 248], [196, 210], [204, 178]], 30, 20), circle(204, 170, 17)];
  return layered([
    {
      sil: body,
      p: [dot(208, 166, 3.5), 'M 196 180 Q 204 186 214 182'],
      d: [...scales(body, 172, 228, 230, 330, 12, 6, 3)],
    },
    { sil: roundPoly([[218, 166], [234, 172], [218, 178]], 2) },
    { sil: NONE, p: ['M 200 152 L 190 124 M 204 152 L 204 122 M 208 152 L 218 124', dot(190, 121, 4), dot(204, 119, 4), dot(219, 121, 4)] },
    { sil: NONE, p: ['M 190 336 L 186 366 M 210 336 L 214 366', 'M 170 368 L 186 366 L 200 370 M 200 370 L 214 366 L 230 370'] },
    ...eyes,
    { sil: NONE, d: chunk(quills, 4) },
    { sil: fanOut },
  ]);
}

function owlPerchedArt(): Art {
  const body = smooth([[200, 70], [258, 84], [286, 146], [284, 230], [262, 300], [200, 326], [138, 300], [116, 230], [114, 146], [142, 84]]);
  const tufts = [roundPoly([[150, 92], [128, 34], [176, 80]], 6), roundPoly([[250, 92], [272, 34], [224, 80]], 6)];
  const disc = smooth([[200, 120], [236, 100], [268, 120], [270, 170], [238, 200], [200, 216], [162, 200], [130, 170], [132, 120], [164, 100]]);
  const wing = smooth([[124, 160], [150, 190], [164, 260], [152, 320], [124, 330], [112, 260]]);
  const branch = tube([[34, 336], [200, 330], [370, 344]], 26, 18);
  const discRays: string[] = [];
  for (const cx of [166, 234])
    for (let a = 0; a < 360; a += 20) {
      const s = polar(cx, 152, 26, a);
      const e = polar(cx, 152, 46, a);
      discRays.push(inside(line(s[0], s[1], e[0], e[1]), disc));
    }
  const bark: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 38 + rnd(i) * 12;
    bark.push(`M ${f(x)} ${f(330 + rnd(i + 3) * 6)} Q ${f(x + 10)} ${f(334)} ${f(x + 22)} ${f(332 + rnd(i + 7) * 6)}`);
  }
  const breast = scales(body, 150, 220, 250, 310, 14, 7, 6);
  const tuftLines = ['M 146 80 L 138 56 M 156 82 L 150 60', 'M 254 80 L 262 56 M 244 82 L 250 60'];
  return layered([
    { sil: [circle(178, 330, 9), circle(192, 333, 9), circle(208, 333, 9), circle(222, 330, 9)], d: ['M 172 338 L 170 344 M 192 341 L 192 347 M 208 341 L 208 347 M 228 338 L 230 344'] },
    {
      sil: disc,
      p: [circle(166, 152, 22), circle(234, 152, 22), circle(166, 152, 10), circle(234, 152, 10), roundPoly([[192, 170], [208, 170], [200, 196]], 3)],
      d: [dot(162, 148, 3), dot(230, 148, 3), ...chunk(discRays, 3)],
    },
    { sil: wing, d: [inside('M 128 200 Q 146 240 140 300 M 120 230 Q 134 270 128 320 M 136 180 Q 156 220 152 270', wing)] },
    { sil: m(wing), d: [m(inside('M 128 200 Q 146 240 140 300 M 120 230 Q 134 270 128 320 M 136 180 Q 156 220 152 270', wing))] },
    { sil: [body, ...tufts], d: [...breast, ...tuftLines, inside('M 160 84 Q 200 74 240 84 M 170 96 L 176 104 M 200 88 L 200 98 M 230 96 L 224 104', body)] },
    { sil: branch, d: [...chunk(bark, 2)] },
    { sil: petal(66, 328, -40, 50, 13), d: ['M 66 328 L 96 292'] },
  ]);
}

function eagleSoaringArt(): Art {
  const wing = (s: number): string[] => {
    const base = roundPoly([[214, 150], [256, 128], [300, 116], [340, 108], [376, 104], [338, 124], [380, 126], [338, 142], [378, 150], [334, 160], [370, 176], [326, 178], [350, 198], [300, 196], [260, 204], [220, 200]], 7);
    return s > 0 ? [base] : [m(base)];
  };
  const W = wing(1);
  const coverts = (s: number): string[] => {
    const rows: string[] = [];
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 6; k++) {
        const x = 200 + (32 + k * 17 + r * 4) * s;
        const y = 152 + r * 14 + Math.abs(x - 200) * 0.02;
        rows.push(`M ${f(x)} ${f(y)} Q ${f(x + 8 * s)} ${f(y + 10)} ${f(x + 16 * s)} ${f(y)}`);
      }
    const prim: string[] = [];
    for (let k = 0; k < 9; k++) {
      const x = 200 + (40 + k * 13) * s;
      prim.push(`M ${f(x)} ${f(200)} L ${f(x + 5 * s)} ${f(176)}`);
    }
    return [...rows, ...prim];
  };
  const tail = smooth([[176, 220], [160, 300], [200, 314], [240, 300], [224, 220]]);
  const head = circle(200, 132, 26);
  return layered([
    { sil: head, p: [dot(190, 128, 4), dot(210, 128, 4), 'M 180 120 L 196 124 M 220 120 L 204 124'], d: [inside('M 180 150 L 186 140 M 220 150 L 214 140', head)] },
    { sil: roundPoly([[192, 146], [208, 146], [200, 170]], 4) },
    { sil: E(200, 196, 30, 52), d: [...scales(E(200, 196, 30, 52), 172, 168, 228, 240, 11, 6, 2)] },
    { sil: W, d: chunk(coverts(1).map((s) => inside(s, W)), 4) },
    { sil: wing(-1), d: chunk(coverts(-1).map((s) => inside(s, wing(-1))), 4) },
    { sil: tail, d: [inside('M 186 230 L 180 306 M 200 230 L 200 312 M 214 230 L 220 306', tail)] },
    { sil: NONE, p: ['M 186 244 L 178 262 M 214 244 L 222 262'] },
    { sil: NONE, p: ['M 40 330 Q 120 300 200 326 Q 280 352 360 322'], d: ['M 60 360 Q 120 344 180 360'] },
  ]);
}

function mantisArt(): Art {
  const abdomen = petal(204, 236, 116, 168, 30, 0.45);
  const thorax = tube([[204, 240], [178, 176], [166, 132]], 20, 12);
  const head = roundPoly([[116, 106], [186, 92], [158, 152]], 10);
  const twig = tube([[30, 350], [200, 330], [370, 292]], 16, 10);
  const veins: string[] = [];
  for (let k = 0; k < 10; k++) {
    const t = 0.15 + k * 0.08;
    const a = polar(204, 236, 168 * t, 116);
    veins.push(`M ${f(a[0])} ${f(a[1] - 18)} Q ${f(a[0] + 6)} ${f(a[1])} ${f(a[0] + 2)} ${f(a[1] + 20)}`);
  }
  const spikes = 'M 136 172 L 128 166 M 140 182 L 132 178 M 146 192 L 138 190 M 150 168 L 160 162 M 154 156 L 162 150';
  return layered([
    { sil: head, p: [circle(127, 107, 11), circle(176, 97, 11), dot(128, 107, 4), dot(175, 97, 4)], d: ['M 150 134 L 158 140'] },
    { sil: NONE, p: ['M 150 102 Q 130 60 84 30', 'M 160 100 Q 170 56 214 26'] },
    { sil: tube([[170, 150], [132, 196]], 16, 11), d: ['M 156 172 L 146 182'] },
    { sil: tube([[132, 196], [150, 156], [146, 136]], 8, 5), d: [spikes] },
    { sil: thorax, d: ['M 190 210 L 194 214 M 182 186 L 188 188'] },
    { sil: abdomen, d: chunk(veins.map((v) => inside(v, abdomen)), 3).concat([inside('M 204 236 Q 270 290 330 330', abdomen), inside('M 214 230 Q 280 270 342 312', abdomen)]) },
    { sil: tube([[206, 244], [180, 290], [160, 334]], 7, 5) },
    { sil: tube([[214, 248], [250, 290], [232, 324]], 7, 5) },
    { sil: tube([[230, 262], [290, 280], [300, 304]], 7, 5) },
    { sil: twig, d: ['M 80 340 L 104 338 M 250 320 L 280 312'] },
    { sil: petal(320, 304, 30, 60, 16), d: ['M 320 304 L 350 252'] },
  ]);
}

function morphoArt(): Art {
  const foreBase = smooth([[194, 186], [170, 126], [118, 70], [64, 58], [40, 92], [56, 160], [100, 200], [170, 208]]);
  const hindBase = smooth([[194, 210], [140, 212], [84, 236], [70, 290], [100, 336], [160, 340], [192, 264]]);
  const fore = scallop(foreBase, 2.2, 16);
  const hind = scallop(hindBase, 3.4, 20);
  const vF = fan(fore, [190, 194], [-14, -28, -42, -56, -70, -84, -100, -116], 180, 5);
  const vH = fan(hind, [190, 214], [-124, -140, -158, -176, -196, -214], 140, -5);
  const crossF = inside(curve([[176, 150], [140, 136], [104, 136], [76, 150]]), fore);
  const crossH = inside(curve([[176, 236], [150, 252], [130, 280], [126, 310]]), hind);
  const margin = (d: string, k: number, about: P, n: number) => ptsOf(scaleAbout(d, k, about), 3).filter((_, i, a) => i % Math.floor(a.length / n) === 0);
  const mF = margin(foreBase, 0.86, [190, 194], 26).filter(([x, y]) => x < 176 && !(y > 196 && x > 120)).map(([x, y]) => circle(x, y, 2.6)).join(' ');
  const mH = margin(hindBase, 0.84, [190, 214], 22).filter(([x, y]) => x < 180 && y > 218).map(([x, y]) => circle(x, y, 2.6)).join(' ');
  const eyesH = `${circle(116, 296, 12)} ${circle(116, 296, 5)}`;
  const eyesF = `${circle(96, 112, 10)} ${circle(96, 112, 4)} ${circle(128, 160, 8)} ${circle(128, 160, 3)}`;
  const body = E(200, 228, 11, 70);
  const L: Item[] = [
    { sil: body, d: ['M 190 238 L 210 238 M 190 252 L 210 252 M 190 266 L 210 266 M 191 280 L 209 280'] },
    { sil: E(200, 184, 15, 22), d: ['M 192 176 L 208 176 M 192 190 L 208 190'] },
    { sil: circle(200, 154, 13), p: [dot(194, 152, 3), dot(206, 152, 3)] },
    { sil: NONE, p: ['M 194 142 Q 176 96 148 74', 'M 206 142 Q 224 96 252 74', E(147, 72, 4, 6), E(253, 72, 4, 6)] },
  ];
  for (const [w, v, cr, mm, ey] of [[fore, vF, crossF, mF, eyesF], [hind, vH, crossH, mH, eyesH]] as const) {
    L.push({ sil: w, p: [ey], d: [v, cr, mm] });
    L.push({ sil: m(w), p: [m(ey)], d: [m(v), m(cr), m(mm)] });
  }
  return layered(L);
}

function rhinoBeetleArt(): Art {
  const elytra = smooth([[180, 170], [250, 150], [320, 168], [352, 220], [336, 272], [270, 290], [196, 280], [170, 230]]);
  const pronotum = smooth([[120, 190], [150, 160], [196, 156], [214, 200], [196, 256], [146, 262], [116, 232]]);
  const horn = smooth([[96, 222], [70, 190], [60, 150], [68, 110], [92, 86], [100, 94], [88, 122], [90, 160], [106, 194], [128, 214]]);
  const head = E(108, 230, 26, 22, -10);
  const thHorn = roundPoly([[150, 170], [128, 128], [176, 162]], 6);
  const legs: P[][] = [
    [[140, 250], [104, 286], [80, 330]],
    [[190, 262], [176, 310], [150, 346]],
    [[250, 276], [276, 320], [306, 350]],
  ];
  const farLegs: P[][] = [
    [[160, 246], [140, 290], [126, 336]],
    [[220, 268], [218, 314], [204, 352]],
    [[290, 270], [326, 302], [356, 336]],
  ];
  const spikesOf = (l: P[]) => curvePts(l, 3).slice(3, -1).map(([x, y], i) => (i % 2 ? '' : `M ${f(x)} ${f(y)} L ${f(x + 7)} ${f(y - 4)}`)).join(' ');
  const shine: string[] = [];
  for (let k = 0; k < 9; k++) shine.push(inside(`M ${f(200 + k * 16)} ${f(166 + k * 2)} Q ${f(216 + k * 16)} ${f(220)} ${f(206 + k * 16)} ${f(280)}`, elytra));
  const pits: string[] = [];
  for (let k = 0; k < 24; k++) pits.push(inside(circle(130 + rnd(k) * 70, 176 + rnd(k + 40) * 70, 1.8), pronotum));
  return layered([
    { sil: horn, d: ['M 78 120 Q 72 150 86 186'] },
    { sil: head, p: [dot(116, 222, 4.5)], d: ['M 96 238 Q 104 246 116 244'] },
    { sil: thHorn },
    { sil: pronotum, d: chunk(pits, 2).concat(['M 140 178 Q 168 168 192 176']) },
    { sil: elytra, p: [inside('M 196 222 Q 270 214 352 222', elytra)], d: chunk(shine, 3) },
    ...legs.map((l) => ({ sil: tube(l, 14, 8), d: [spikesOf(l)] })),
    ...farLegs.map((l) => ({ sil: tube(l, 12, 7), d: [spikesOf(l)] })),
    { sil: NONE, p: ['M 92 244 L 72 252 L 60 244', 'M 96 248 L 80 262'], d: ['M 40 362 Q 200 352 370 360'] },
  ]);
}

function craneDanceArt(): Art {
  const body = smooth([[160, 196], [200, 180], [252, 186], [280, 220], [262, 252], [210, 262], [168, 240]]);
  const neck = tube([[186, 196], [168, 150], [176, 100], [160, 70]], 24, 16);
  const head = E(154, 64, 20, 15, -14);
  const wingL = smooth([[190, 196], [150, 150], [96, 100], [40, 70], [56, 120], [92, 170], [150, 214]]);
  const wingR = smooth([[236, 192], [270, 140], [314, 76], [362, 30], [358, 90], [330, 160], [270, 210]]);
  const fingers = (d: string, n: number, from: P, to: P, len: number, deg: number): string[] => {
    const out: string[] = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      out.push(petal(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, deg + t * 20, len, 7));
    }
    return out;
  };
  const LW = [wingL, ...fingers(wingL, 5, [56, 104], [100, 160], 34, 230)];
  const RW = [wingR, ...fingers(wingR, 5, [352, 70], [320, 160], 34, 110)];
  const featherRows = (shape: Layer, root: P, degs: number[]) => fan(shape, root, degs, 230, 4);
  return layered([
    { sil: [neck, head], p: [dot(150, 60, 3.5)], d: ['M 140 54 Q 152 46 166 52', 'M 170 120 L 180 122 M 172 136 L 184 138 M 176 152 L 188 154'] },
    { sil: roundPoly([[138, 60], [84, 78], [140, 72]], 3) },
    { sil: body, d: [...scales(body, 176, 196, 266, 250, 14, 7, 2)] },
    { sil: LW, d: [featherRows(LW, [190, 200], [-50, -58, -66, -74, -82, -90, -98]), ...scales(wingL, 110, 120, 190, 200, 14, 7, 2)] },
    { sil: RW, d: [featherRows(RW, [240, 196], [24, 32, 40, 48, 56, 64, 72]), ...scales(wingR, 240, 100, 330, 200, 14, 7, 2)] },
    { sil: roundPoly([[262, 230], [312, 262], [300, 276], [256, 252]], 8), d: ['M 270 242 L 300 266'] },
    { sil: tube([[212, 258], [214, 310], [210, 360]], 8, 6) },
    { sil: tube([[236, 254], [262, 300], [250, 352]], 8, 6) },
    { sil: NONE, p: ['M 188 362 L 210 360 L 232 364 M 228 354 L 250 352 L 272 356'], d: ['M 60 370 Q 120 362 180 370 M 270 372 Q 320 364 360 372'] },
  ]);
}

function songbirdBlossomArt(): Art {
  const head = circle(236, 150, 40);
  const body = [head, E(196, 206, 82, 62, 22)];
  const wing = smooth([[230, 200], [190, 186], [132, 196], [96, 232], [150, 240], [210, 228]]);
  const tail = roundPoly([[122, 238], [52, 280], [62, 300], [140, 262]], 6);
  const branch = tube([[34, 298], [140, 274], [260, 266], [378, 236]], 18, 10);
  const twig = tube([[300, 254], [330, 210], [340, 170]], 10, 6);
  const twig2 = tube([[120, 280], [92, 320], [90, 350]], 10, 6);
  const wingFeathers = [
    'M 222 210 Q 180 206 142 228', 'M 216 222 Q 180 222 150 238', 'M 160 200 L 150 236', 'M 184 196 L 176 232', 'M 206 198 L 200 226',
  ];
  const breast = scales(body, 186, 200, 270, 262, 12, 6, 3);
  return layered([
    { sil: wing, d: [inside(wingFeathers.join(' '), wing)] },
    { sil: body, p: [circle(248, 140, 7), dot(249, 140, 3), inside('M 262 170 Q 230 200 228 256', body)], d: [...breast, inside('M 214 120 L 220 128 M 230 114 L 232 124 M 246 112 L 246 122', head)] },
    { sil: roundPoly([[272, 146], [300, 156], [272, 166]], 3), p: [line(280, 156, 272, 156)] },
    { sil: tail, d: ['M 128 248 L 66 286', 'M 132 256 L 76 292'] },
    { sil: NONE, p: ['M 200 262 L 196 274 M 220 258 L 222 270', claw(196, 276), claw(222, 272)] },
    blossom(320, 168, 28, 10),
    blossom(358, 212, 22, 40),
    blossom(84, 340, 24, 0),
    blossom(46, 272, 20, 20),
    { sil: petal(270, 262, -20, 60, 14), d: ['M 270 262 L 286 210'] },
    { sil: petal(160, 276, 160, 54, 13), d: ['M 160 276 L 176 326'] },
    { sil: petal(340, 240, 130, 40, 12), d: ['M 340 240 L 370 266'] },
    { sil: branch, d: ['M 60 290 L 86 284 M 180 270 L 206 268 M 300 254 L 330 246'] },
    { sil: twig },
    { sil: twig2 },
  ]);
}

function honeybeeArt(): Art {
  const thorax = fluffy(circle(170, 196, 40), 5, 8);
  const abdomen = E(264, 220, 74, 52, 14);
  const head = circle(104, 196, 32);
  const fore = petal(176, 170, 64, 170, 30, 0.6);
  const hind = petal(186, 176, 90, 120, 22, 0.6);
  const stripes = ['M 236 162 Q 218 214 234 270', 'M 270 168 Q 252 224 268 278', 'M 304 182 Q 290 228 300 270'];
  const hairs: string[] = [];
  ptsOf(abdomen, 9).forEach(([x, y], i) => {
    const dx = x - 264;
    const dy = y - 220;
    const l = Math.hypot(dx, dy) || 1;
    hairs.push(`M ${f(x - (dx / l) * 2)} ${f(y - (dy / l) * 2)} L ${f(x + (dx / l) * (5 + rnd(i) * 3))} ${f(y + (dy / l) * (5 + rnd(i) * 3))}`);
  });
  const veinsF = [
    'M 176 170 Q 250 132 330 104', 'M 186 178 Q 260 160 340 118', 'M 230 150 L 240 166 L 280 150 L 276 128', 'M 280 150 L 320 140 L 336 112',
  ];
  const veinsH = ['M 186 176 Q 250 180 300 174', 'M 240 178 L 250 170 L 280 172'];
  const furT: string[] = [];
  for (let k = 0; k < 26; k++) {
    const [x, y] = [140 + rnd(k) * 60, 166 + rnd(k + 9) * 60];
    furT.push(inside(`M ${f(x)} ${f(y)} L ${f(x + 3)} ${f(y + 7)}`, thorax));
  }
  const legs: P[][] = [
    [[150, 228], [124, 262], [112, 300]],
    [[172, 232], [168, 272], [150, 310]],
    [[196, 228], [226, 270], [232, 314]],
  ];
  return layered([
    { sil: head, p: [E(96, 188, 12, 18, 10), 'M 80 216 Q 86 226 96 226'], d: ['M 90 182 L 98 180 M 88 192 L 98 190 M 90 202 L 98 200'] },
    { sil: NONE, p: ['M 96 168 Q 82 128 54 112', 'M 108 166 Q 108 128 128 104'] },
    { sil: fore, d: [inside(veinsF.join(' '), fore)] },
    { sil: hind, d: [inside(veinsH.join(' '), hind)] },
    { sil: thorax, d: chunk(furT, 2) },
    { sil: abdomen, p: [inside(stripes.join(' '), abdomen)], d: [...chunk(hairs, 3), inside('M 300 250 Q 316 236 320 214', abdomen)] },
    { sil: roundPoly([[334, 236], [358, 250], [332, 252]], 3) },
    ...legs.map((l, i) => ({ sil: tube(l, 10, 6), d: [i === 2 ? E(228, 286, 12, 16, -20) : ''] })),
    { sil: NONE, d: ['M 120 284 L 112 288 M 162 292 L 154 294 M 232 300 L 240 302'] },
  ]);
}

// ---- catalogue ------------------------------------------------------------------------------------------------

export const wildlife3: Template[] = [
  // beginner
  tpl('bird', 'robin-ground', 'Robin on the ground', 'beginner', ['robin', 'bird', 'garden', 'winter'], robinArt()),
  tpl('bird', 'sparrow-post', 'Sparrow on a fence post', 'beginner', ['sparrow', 'bird', 'fence', 'garden'], sparrowPostArt()),
  tpl('bird', 'wren-twig', 'Wren on a twig', 'beginner', ['wren', 'bird', 'songbird', 'garden'], wrenArt()),
  tpl('bird', 'chick-hatching', 'Chick hatching from an egg', 'beginner', ['chick', 'bird', 'egg', 'spring'], chickEggArt()),
  tpl('bird', 'owl-round', 'Round owl on a branch', 'beginner', ['owl', 'bird', 'night', 'woodland'], owlRoundArt()),
  tpl('bird', 'duck-waddling', 'Waddling duck', 'beginner', ['duck', 'bird', 'farm', 'stylized'], duckArt()),
  tpl('bird', 'hen', 'Farmyard hen', 'beginner', ['hen', 'bird', 'farm', 'chicken'], henArt()),
  tpl('bird', 'nest-eggs', 'Nest with three eggs', 'beginner', ['nest', 'bird', 'egg', 'spring'], nestEggsArt()),
  tpl('bird', 'swan-gliding', 'Gliding swan', 'beginner', ['swan', 'bird', 'lake', 'elegant'], swanGlideArt()),
  tpl('bird', 'feather-curved', 'Curved feather', 'beginner', ['feather', 'bird', 'quill', 'boho'], featherCurveArt()),
  tpl('bug', 'ladybird-top', 'Ladybird from above', 'beginner', ['ladybird', 'ladybug', 'insect', 'garden'], ladybirdTopArt()),
  tpl('bug', 'butterfly-simple', 'Simple butterfly', 'beginner', ['butterfly', 'insect', 'garden', 'spring'], butterflySimpleArt()),
  tpl('bug', 'bee-flying', 'Busy flying bee', 'beginner', ['bee', 'insect', 'honey', 'garden'], beeFlyingArt()),
  tpl('bug', 'snail', 'Garden snail', 'beginner', ['snail', 'garden', 'shell', 'slow'], snailArt()),
  tpl('bug', 'caterpillar-leaf', 'Caterpillar on a leaf', 'beginner', ['caterpillar', 'insect', 'leaf', 'garden'], caterpillarLeafArt()),
  tpl('bug', 'spider-thread', 'Spider on a thread', 'beginner', ['spider', 'web', 'halloween', 'garden'], spiderThreadArt()),
  // intermediate
  tpl('bird', 'halcyon-branch', 'Kingfisher on a branch', 'intermediate', ['kingfisher', 'bird', 'river', 'branch'], kingfisherArt()),
  tpl('bird', 'heron-reeds', 'Heron in the reeds', 'intermediate', ['heron', 'bird', 'wader', 'reeds'], heronArt()),
  tpl('bird', 'flamingo', 'Flamingo on one leg', 'intermediate', ['flamingo', 'bird', 'tropical', 'wader'], flamingoArt()),
  tpl('bird', 'parrot-perch', 'Parrot on a perch', 'intermediate', ['parrot', 'macaw', 'bird', 'tropical'], parrotPerchArt()),
  tpl('bird', 'toucan', 'Toucan on a branch', 'intermediate', ['toucan', 'bird', 'tropical', 'rainforest'], toucanArt()),
  tpl('bird', 'eagle-head', 'Eagle head in profile', 'intermediate', ['eagle', 'bird', 'raptor', 'profile'], eagleHeadArt()),
  tpl('bird', 'hummingbird-hover', 'Hovering hummingbird', 'intermediate', ['hummingbird', 'bird', 'flight', 'tiny'], hummingbirdHoverArt()),
  tpl('bird', 'swallow', 'Swallow in flight', 'intermediate', ['swallow', 'bird', 'flight', 'summer'], swallowArt()),
  tpl('bug', 'monarch', 'Monarch butterfly', 'intermediate', ['butterfly', 'monarch', 'insect', 'wings'], monarchArt()),
  tpl('bug', 'moth-fluffy', 'Fluffy night moth', 'intermediate', ['moth', 'insect', 'night', 'wings'], mothFluffyArt()),
  tpl('bug', 'damselfly', 'Damselfly on a reed', 'intermediate', ['damselfly', 'dragonfly', 'insect', 'reed'], damselflyReedArt()),
  tpl('bug', 'grasshopper', 'Grasshopper in the grass', 'intermediate', ['grasshopper', 'insect', 'meadow', 'summer'], grasshopperArt()),
  tpl('bug', 'stag-beetle', 'Stag beetle', 'intermediate', ['beetle', 'stag-beetle', 'insect', 'woodland'], stagBeetleArt()),
  tpl('bug', 'firefly', 'Glowing firefly', 'intermediate', ['firefly', 'insect', 'night', 'glow'], fireflyArt()),
  // advanced
  tpl('bird', 'peacock-fan', 'Peacock with fanned tail', 'advanced', ['peacock', 'bird', 'feathers', 'ornate'], peacockArt()),
  tpl('bird', 'owl-perched', 'Long-eared owl perched', 'advanced', ['owl', 'bird', 'night', 'realistic'], owlPerchedArt()),
  tpl('bird', 'eagle-soaring', 'Soaring eagle', 'advanced', ['eagle', 'bird', 'raptor', 'flight'], eagleSoaringArt()),
  tpl('bird', 'crane-dance', 'Dancing crane', 'advanced', ['crane', 'bird', 'wings', 'elegant'], craneDanceArt()),
  tpl('bird', 'songbird-blossom', 'Songbird on a blossom branch', 'advanced', ['songbird', 'bird', 'blossom', 'spring'], songbirdBlossomArt()),
  tpl('bug', 'mantis', 'Praying mantis', 'advanced', ['mantis', 'insect', 'garden', 'realistic'], mantisArt()),
  tpl('bug', 'morpho', 'Scalloped morpho butterfly', 'advanced', ['butterfly', 'morpho', 'insect', 'ornate'], morphoArt()),
  tpl('bug', 'rhino-beetle', 'Rhinoceros beetle', 'advanced', ['beetle', 'rhinoceros', 'insect', 'realistic'], rhinoBeetleArt()),
  tpl('bug', 'honeybee', 'Detailed honeybee', 'advanced', ['bee', 'honeybee', 'insect', 'realistic'], honeybeeArt()),
];
