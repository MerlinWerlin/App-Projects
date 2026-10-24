// Animals & pets batch 3 (fb-1023b T139, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Generic pets, farm, outback, savanna and mountain animals of our own design (new subjects and poses beside
// animals.ts and animals2.ts), built from simple geometry (ellipses, tubes along a curve, smooth blobs) whose
// overlaps are hidden with occlude.ts so each animal reads as one clean drawing. Beginner pieces are bold outlines;
// intermediate ones add markings and inner lines; advanced ones add fur, scales, mane and rock hatching.
// No birds or sea creatures here (those live in Birds & insects and Sea life).
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, polar, poly, rotate, shift, type P } from './draw.ts';
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

function tangent(c: readonly P[], i: number): P {
  const a = c[Math.max(0, i - 1)];
  const b = c[Math.min(c.length - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}

/** Closed tube (leg, neck, tail) along a curve, full width w0 at the start tapering to w1, round ends. */
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
  // round caps: points on a half circle at each end (the curve passes through them)
  const cap = (q: P, t: P, hw: number, sign: number): P[] =>
    [0.25, 0.5, 0.75].map((k) => {
      const a = k * Math.PI;
      const ux = sign * -t[1];
      const uy = sign * t[0];
      return [q[0] + hw * (Math.cos(a) * ux + sign * Math.sin(a) * t[0]), q[1] + hw * (Math.cos(a) * uy + sign * Math.sin(a) * t[1])] as P;
    });
  const end = cap(c[n - 1], tangent(c, n - 1), w1 / 2, 1);
  const start = cap(c[0], tangent(c, 0), w0 / 2, -1);
  return smooth([...L, ...end, ...R.reverse(), ...start]);
}

/** Rotated ellipse. */
const E = (cx: number, cy: number, rx: number, ry: number, deg = 0): string =>
  deg ? rotate(ellipse(cx, cy, rx, ry), deg, cx, cy) : ellipse(cx, cy, rx, ry);

const ptsOf = (d: string, step: number): P[] => samplePath(d, step)[0].pts;

function centroid(pts: readonly P[]): P {
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Shaggy outline: the closed shape d redrawn as a ring of fur tufts (amp = tuft height, step = tuft width). */
export function shaggy(d: string, amp: number, step: number): string {
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

/** Deterministic pseudo-random in [0, 1). */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function chunk(strokes: readonly string[], groups: number): string[] {
  const out: string[] = [];
  const size = Math.ceil(strokes.length / groups) || 1;
  for (let i = 0; i < strokes.length; i += size) out.push(strokes.slice(i, i + size).join(' '));
  return out;
}

/** Short curved fur strokes scattered inside shape, leaning along direction deg (0° = up). */
function furFill(shape: Layer, box: [number, number, number, number], n: number, len: number, deg: number, seed: number, groups = 3): string[] {
  const strokes: string[] = [];
  const [x0, y0, x1, y1] = box;
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd(seed + i * 2) * (x1 - x0);
    const y = y0 + rnd(seed + i * 2 + 1) * (y1 - y0);
    const a = polar(x, y, len, deg + (rnd(seed + i * 3) - 0.5) * 30);
    const m = polar((x + a[0]) / 2, (y + a[1]) / 2, len * 0.2, deg + 90);
    strokes.push(`M ${f(x)} ${f(y)} Q ${f(m[0])} ${f(m[1])} ${f(a[0])} ${f(a[1])}`);
  }
  return chunk(strokes, groups).map((s) => inside(s, shape)).filter(Boolean);
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

const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });

/** Keep only the part of lines inside shape. */
const inside = (lines: string, shape: Layer): string => clip(lines, [region(shape)], 'inside');

const dot = (x: number, y: number, r = 5): string => circle(x, y, r);

/** Gentle ground line from x0 to x1 at y. */
const ground = (x0: number, x1: number, y: number): string =>
  `M ${f(x0)} ${f(y)} Q ${f((x0 * 3 + x1) / 4)} ${f(y - 3)} ${f((x0 + x1) / 2)} ${f(y)} Q ${f((x0 + x1 * 3) / 4)} ${f(y + 3)} ${f(x1)} ${f(y)}`;

/** Grass tuft of three blades at (x, y). */
const tuft = (x: number, y: number, h = 22): string =>
  `M ${f(x - 8)} ${f(y)} Q ${f(x - 8)} ${f(y - h * 0.5)} ${f(x - 14)} ${f(y - h * 0.9)} M ${f(x)} ${f(y)} L ${f(x)} ${f(y - h)} M ${f(x + 8)} ${f(y)} Q ${f(x + 8)} ${f(y - h * 0.5)} ${f(x + 14)} ${f(y - h * 0.9)}`;

/** Hoof line across the bottom of a leg ending at (x, y). */
const hoof = (x: number, y: number, w = 8): string => line(x - w, y, x + w, y);

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `ani3-${id}`,
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

function kangarooArt(): Art {
  return join(
    layered([
      { sil: tube([[240, 168], [262, 194], [274, 212]], 16, 10) },
      { sil: E(272, 92, 34, 20, 12), p: [dot(282, 86, 4), 'M 300 104 Q 296 110 288 110'] },
      { sil: petal(252, 80, -12, 42, 9), d: ['M 252 78 L 258 46'] },
      { sil: petal(240, 84, -38, 38, 9) },
      { sil: E(184, 262, 62, 54, -10) },
      { sil: tube([[176, 300], [214, 328], [282, 334]], 30, 14) },
      { sil: smooth([[246, 96], [268, 112], [264, 160], [254, 218], [236, 276], [190, 300], [164, 240], [186, 172], [224, 118]]), d: ['M 240 216 Q 254 250 238 284'] },
      { sil: tube([[150, 284], [100, 318], [36, 334]], 36, 12) },
    ]),
    { p: [], d: [ground(24, 376, 346)] },
  );
}

function wombatArt(): Art {
  const claws = (x: number, y: number) => `M ${x - 8} ${y} L ${x - 10} ${y + 6} M ${x} ${y} L ${x} ${y + 7} M ${x + 8} ${y} L ${x + 10} ${y + 6}`;
  return join(
    layered([
      { sil: roundPoly([[334, 226], [362, 226], [366, 262], [336, 264]], 10), p: ['M 346 240 Q 352 236 358 240'] },
      { sil: E(300, 246, 54, 46), p: [dot(318, 232, 4.5), 'M 336 272 Q 326 278 314 274'] },
      { sil: petal(278, 208, -24, 30, 10) },
      { sil: petal(304, 204, 14, 30, 10) },
      { sil: tube([[288, 288], [294, 328]], 34, 30), d: [claws(296, 340)] },
      { sil: tube([[104, 286], [100, 328]], 38, 30), d: [claws(102, 340)] },
      { sil: E(188, 250, 124, 70), d: ['M 160 196 Q 200 186 236 200'] },
      { sil: tube([[248, 296], [256, 330]], 28, 24) },
      { sil: tube([[140, 296], [146, 330]], 30, 24) },
    ]),
    { p: [], d: [ground(30, 370, 352)] },
  );
}

function camelArt(): Art {
  const body = [E(178, 196, 94, 46), smooth([[104, 190], [126, 128], [178, 104], [230, 128], [250, 190]])];
  return join(
    layered([
      { sil: E(330, 102, 32, 17, 18), p: [dot(332, 94, 3.6), 'M 356 116 Q 350 122 340 120', 'M 358 104 L 362 106'] },
      { sil: petal(312, 90, -30, 18, 6) },

      { sil: tube([[230, 216], [236, 282], [232, 344]], 24, 14), d: [hoof(232, 352, 10)] },
      { sil: tube([[122, 216], [118, 282], [124, 344]], 26, 14), d: [hoof(124, 352, 10)] },
      { sil: [...body, tube([[240, 196], [292, 168], [300, 124], [316, 100]], 48, 30)], d: ['M 140 212 Q 178 232 220 214'] },
      { sil: tube([[208, 222], [216, 284], [212, 344]], 20, 12) },
      { sil: tube([[148, 222], [154, 284], [148, 344]], 20, 12) },
      { sil: tube([[88, 190], [80, 228], [84, 262]], 9, 6) },
    ]),
    { p: [], d: [ground(30, 370, 356), 'M 46 356 Q 70 340 96 356', 'M 290 356 Q 320 344 352 356'] },
  );
}

function hippoArt(): Art {
  return join(
    layered([
      {
        sil: smooth([[262, 178], [300, 160], [342, 168], [364, 198], [366, 250], [342, 282], [292, 284], [262, 262]]),
        p: [E(340, 186, 6, 4, -20), E(356, 194, 5, 4, -20), 'M 318 262 Q 344 266 364 248'],
      },
      { sil: circle(302, 160, 13), p: [dot(304, 160, 4)] },
      { sil: petal(284, 166, -40, 20, 9) },
      { sil: tube([[252, 288], [254, 330]], 42, 40), d: ['M 240 348 L 240 342 M 254 349 L 254 343 M 268 348 L 268 342'] },
      { sil: tube([[96, 286], [92, 330]], 46, 42), d: ['M 78 348 L 78 342 M 92 349 L 92 343 M 106 348 L 106 342'] },
      { sil: E(180, 228, 128, 82) },
      { sil: tube([[220, 296], [226, 332]], 36, 34) },
      { sil: tube([[132, 296], [138, 332]], 36, 34) },
      { sil: tube([[54, 220], [44, 238]], 8, 6) },
    ]),
    { p: [], d: [ground(24, 376, 354)] },
  );
}

function catBoxArt(): Art {
  const earL = roundPoly([[152, 176], [154, 108], [198, 146]], 7);
  const earR = roundPoly([[268, 176], [266, 108], [222, 146]], 7);
  const eye = (x: number) => `M ${x - 12} 186 Q ${x} 172 ${x + 12} 186 Q ${x} 196 ${x - 12} 186 Z`;
  return layered([
    { sil: E(168, 246, 20, 13), d: ['M 162 252 L 162 244 M 174 252 L 174 244'] },
    { sil: E(252, 246, 20, 13), d: ['M 246 252 L 246 244 M 258 252 L 258 244'] },
    { sil: poly([[100, 244], [300, 244], [300, 372], [100, 372]]), d: ['M 186 244 L 186 290 L 214 290 L 214 244'] },
    { sil: poly([[300, 244], [344, 214], [344, 340], [300, 372]]) },
    {
      sil: [E(210, 190, 64, 54), earL, earR],
      p: [eye(184), eye(236), 'M 204 204 L 216 204 L 210 211 Z', 'M 210 211 Q 204 220 196 218 M 210 211 Q 216 220 224 218'],
      d: ['M 164 140 L 168 122 L 182 140', 'M 256 140 L 252 122 L 238 140', 'M 160 206 L 124 200 M 160 214 L 124 216 M 260 206 L 296 200 M 260 214 L 296 216'],
    },
    { sil: NONE, p: ['M 100 244 L 142 214 L 344 214'] },
    { sil: poly([[100, 244], [52, 214], [92, 196], [142, 214]]) },
    { sil: poly([[344, 214], [372, 176], [330, 172], [302, 214]]) },
  ]);
}

function dachshundArt(): Art {
  const S = (d: string): string => shift(d, 0, 40);
  return join(
    layered([
      { sil: S(smooth([[298, 140], [316, 144], [318, 176], [308, 200], [292, 194], [288, 162]])) },
      { sil: S(tube([[318, 166], [364, 178]], 32, 20)), p: [dot(366, 216, 5), 'M 352 228 Q 342 232 332 226'] },
      { sil: S(E(314, 156, 32, 26)), p: [dot(322, 186, 4)] },
      { sil: S(tube([[286, 214], [304, 176]], 48, 40)) },
      { sil: tube([[292, 290], [296, 332]], 22, 18), d: ['M 286 342 L 308 342'] },
      { sil: tube([[108, 286], [104, 332]], 26, 18), d: ['M 94 342 L 116 342'] },
      { sil: [S(E(190, 226, 112, 40)), S(E(276, 238, 38, 36))], d: [S('M 252 260 Q 280 270 300 256')] },
      { sil: tube([[264, 294], [270, 332]], 20, 16) },
      { sil: tube([[136, 292], [140, 332]], 22, 16) },
      { sil: S(tube([[84, 214], [56, 188], [40, 166]], 14, 6)) },
    ]),
    { p: [], d: [ground(30, 370, 352)] },
  );
}

/** A gecko foot: leg through hip-elbow-foot with four splayed toes ending in round pads. */
function geckoLeg(pts: readonly P[], deg: number): string[] {
  const foot = pts[pts.length - 1];
  const out = [tube(pts, 18, 12)];
  for (const a of [-50, -17, 17, 50]) {
    const tip = polar(foot[0], foot[1], 20, deg + a);
    out.push(tube([foot, tip], 7, 6), circle(tip[0], tip[1], 5.5));
  }
  return out;
}

function geckoArt(): Art {
  return join(
    layered([
      { sil: E(202, 78, 30, 36), p: [E(182, 66, 7, 9), E(222, 66, 7, 9), 'M 192 106 Q 202 110 212 106'] },
      { sil: geckoLeg([[180, 130], [138, 126], [124, 92]], -20) },
      { sil: geckoLeg([[224, 130], [266, 126], [280, 92]], 20) },
      { sil: geckoLeg([[184, 236], [140, 250], [126, 292]], 200) },
      { sil: geckoLeg([[220, 236], [264, 250], [276, 292]], 160) },
      { sil: tube([[202, 104], [198, 170], [202, 236]], 58, 44), d: [dot(190, 150, 6), dot(212, 178, 6), dot(192, 206, 6)] },
      { sil: tube([[202, 236], [212, 296], [246, 340], [296, 352], [334, 330]], 42, 8), d: ['M 214 290 L 218 290 M 236 324 L 240 322'] },
    ]),
  );
}

function meerkatArt(): Art {
  return join(
    layered([
      { sil: tube([[222, 166], [244, 190], [238, 210]], 15, 10) },
      { sil: tube([[196, 168], [216, 196], [212, 212]], 14, 10) },
      { sil: smooth([[184, 100], [198, 80], [224, 82], [250, 100], [262, 112], [252, 120], [222, 124], [194, 120]]), p: [dot(259, 112, 3.4), E(222, 98, 9, 7), dot(224, 98, 3)] },
      { sil: circle(194, 92, 9) },
      { sil: E(214, 336, 26, 9) },
      { sil: tube([[204, 124], [200, 160]], 40, 56) },
      { sil: tube([[200, 150], [198, 230], [196, 310]], 58, 82), d: ['M 222 200 Q 232 250 220 300'] },
      { sil: E(176, 338, 22, 8) },
      { sil: tube([[176, 308], [130, 332], [80, 338]], 24, 8) },
    ]),
    { p: [], d: [ground(40, 360, 348), 'M 120 348 Q 200 330 300 348'] },
  );
}

// ---- intermediate -----------------------------------------------------------------------------------------------

function rhinoArt(): Art {
  const nails = (x: number, y: number) => `M ${x - 12} ${y} Q ${x - 6} ${y - 6} ${x} ${y} Q ${x + 6} ${y - 6} ${x + 12} ${y}`;
  return join(
    layered([
      { sil: roundPoly([[328, 222], [374, 140], [352, 230]], 3) },
      { sil: roundPoly([[302, 204], [318, 166], [326, 210]], 3) },
      {
        sil: smooth([[266, 172], [318, 182], [358, 222], [368, 254], [346, 270], [300, 258], [268, 230]]),
        p: [E(318, 222, 5, 4), 'M 368 252 Q 352 252 340 260', E(356, 238, 4, 3)],
        d: ['M 300 226 Q 312 236 326 236', 'M 286 196 Q 280 220 290 240'],
      },
      { sil: petal(282, 172, -24, 32, 10), d: ['M 282 170 L 288 146'] },
      { sil: tube([[252, 256], [256, 330]], 44, 40), d: [nails(256, 350)] },
      { sil: tube([[106, 256], [100, 330]], 48, 42), d: [nails(100, 350)] },
      {
        sil: [E(178, 210, 116, 68), E(244, 190, 56, 58)],
        d: ['M 222 152 Q 208 206 224 262', 'M 118 152 Q 140 202 122 254', 'M 250 140 Q 262 160 262 180', 'M 150 266 Q 180 274 210 266', 'M 80 196 Q 74 220 82 240'],
      },
      { sil: tube([[220, 266], [226, 332]], 38, 34) },
      { sil: tube([[136, 266], [142, 332]], 40, 34) },
      { sil: tube([[64, 196], [54, 236]], 9, 6), d: ['M 50 236 L 46 248 M 56 238 L 58 250'] },
    ]),
    { p: [], d: [ground(24, 376, 354), tuft(52, 354), tuft(340, 354, 18)] },
  );
}

function mooseArt(): Art {
  const antler = smooth([
    [292, 112], [262, 96], [236, 92], [222, 74], [234, 72], [236, 58], [250, 66], [256, 46], [268, 62], [280, 44], [288, 64],
    [302, 54], [306, 76], [318, 70], [316, 92], [306, 108],
  ]);
  const antler2 = smooth([[318, 108], [332, 84], [340, 60], [352, 66], [356, 48], [368, 62], [372, 82], [360, 102], [334, 116]]);
  return join(
    layered([
      { sil: antler, d: ['M 300 104 Q 270 88 246 82'] },
      { sil: antler2 },
      { sil: petal(300, 124, -64, 30, 9) },
      { sil: tube([[302, 122], [334, 150], [356, 196]], 46, 40), p: [dot(318, 132, 4), E(360, 200, 5, 4, 30), 'M 346 214 Q 340 220 330 218'] },
      { sil: petal(324, 206, 184, 34, 9) },
      { sil: [tube([[236, 176], [296, 136]], 64, 48), E(180, 182, 98, 52), circle(236, 160, 46)], d: ['M 270 186 Q 286 160 300 150', 'M 146 220 Q 180 236 218 222'] },
      { sil: tube([[246, 216], [252, 284], [250, 348]], 28, 14), d: [hoof(250, 356, 9)] },
      { sil: tube([[118, 214], [112, 284], [118, 348]], 32, 14), d: [hoof(118, 356, 9)] },
      { sil: tube([[222, 220], [230, 286], [226, 346]], 22, 12) },
      { sil: tube([[140, 220], [146, 286], [142, 346]], 24, 12) },
      { sil: tube([[84, 168], [78, 188]], 10, 7) },
    ]),
    { p: [], d: [ground(30, 370, 360), tuft(60, 360), tuft(300, 360, 16)] },
  );
}

function alpacaArt(): Art {
  const curls = (pts: readonly P[]) =>
    pts.map(([x, y]) => `M ${f(x - 6)} ${f(y)} Q ${f(x - 6)} ${f(y - 7)} ${f(x)} ${f(y - 7)} Q ${f(x + 6)} ${f(y - 7)} ${f(x + 6)} ${f(y)}`).join(' ');
  return join(
    layered([
      { sil: E(294, 92, 17, 14), p: [E(306, 88, 3, 2.5), 'M 300 100 Q 306 104 310 100'] },
      { sil: E(272, 80, 26, 22), p: [dot(278, 74, 3.8)] },
      { sil: shaggy(circle(264, 58, 18), 4, 9) },
      { sil: petal(256, 62, -14, 30, 7) },
      { sil: petal(278, 60, 16, 30, 7) },
      { sil: tube([[236, 246], [238, 342]], 22, 14), d: [hoof(238, 350, 9)] },
      { sil: tube([[124, 248], [120, 342]], 24, 14), d: [hoof(120, 350, 9)] },
      { sil: shaggy(tube([[248, 196], [262, 130], [266, 92]], 58, 46), 5, 12), d: [curls([[256, 150], [262, 118], [248, 178]])] },
      { sil: shaggy(E(180, 208, 96, 54), 6, 14), d: [curls([[140, 196], [180, 184], [220, 196], [160, 228], [200, 232], [120, 222], [240, 226]])] },
      { sil: tube([[214, 252], [220, 340]], 20, 12) },
      { sil: tube([[146, 252], [150, 340]], 20, 12) },
      { sil: shaggy(circle(86, 192, 16), 4, 8) },
    ]),
    { p: [], d: [ground(30, 370, 356), tuft(320, 356), tuft(56, 356, 18)] },
  );
}

function corgiArt(): Art {
  return join(
    layered([
      { sil: smooth([[296, 158], [326, 166], [352, 178], [358, 192], [344, 202], [314, 206], [296, 196]]), p: [dot(352, 186, 5.5), 'M 342 202 Q 334 208 322 204'] },
      { sil: E(296, 172, 44, 38), p: [dot(310, 162, 4.5)], d: ['M 316 196 Q 300 186 296 156'] },
      { sil: roundPoly([[262, 160], [260, 102], [300, 140]], 8), d: ['M 270 150 L 268 118 L 290 140'] },
      { sil: roundPoly([[296, 140], [322, 98], [334, 156]], 8) },
      { sil: tube([[288, 256], [292, 300]], 26, 22), d: ['M 280 312 L 304 312'] },
      { sil: tube([[110, 252], [106, 300]], 30, 22), d: ['M 94 312 L 118 312'] },
      {
        sil: [E(190, 224, 106, 46), E(272, 228, 42, 44)],
        d: ['M 296 210 Q 300 240 286 266', 'M 250 268 Q 270 262 284 268', 'M 140 184 Q 170 176 200 182'],
      },
      { sil: tube([[256, 258], [262, 300]], 24, 20) },
      { sil: tube([[134, 256], [138, 300]], 26, 20) },
      { sil: shaggy(E(88, 210, 22, 26), 4, 8) },
    ]),
    { p: [], d: [ground(30, 370, 326)] },
  );
}

function poodleArt(): Art {
  const pom = (x: number, y: number, r: number) => shaggy(circle(x, y, r), 4, 9);
  return join(
    layered([
      { sil: tube([[316, 124], [352, 134]], 24, 18), p: [dot(354, 132, 4.5), 'M 342 142 Q 334 146 326 142'] },
      { sil: E(298, 118, 26, 26), p: [dot(306, 110, 3.8)] },
      { sil: shaggy(E(280, 150, 15, 30), 4, 9) },
      { sil: pom(290, 86, 26) },
      { sil: pom(262, 326, 18) },
      { sil: tube([[262, 238], [262, 318]], 16, 12) },
      { sil: pom(150, 326, 18) },
      { sil: tube([[146, 230], [150, 318]], 18, 12) },
      { sil: shaggy(E(258, 206, 46, 44), 5, 10) },
      { sil: tube([[284, 140], [266, 192]], 32, 42) },
      { sil: pom(140, 202, 38) },
      { sil: tube([[248, 210], [150, 206]], 54, 38) },
      { sil: pom(230, 324, 16) },
      { sil: tube([[230, 236], [230, 316]], 14, 10) },
      { sil: pom(176, 324, 16) },
      { sil: tube([[170, 230], [176, 316]], 14, 10) },
      { sil: pom(90, 120, 18) },
      { sil: tube([[118, 182], [100, 140]], 10, 8) },
    ]),
    { p: [], d: [ground(40, 360, 346)] },
  );
}

function redPandaArt(): Art {
  const tail = tube([[244, 322], [306, 312], [346, 262], [342, 196]], 52, 40);
  const rings = [0, 1, 2, 3, 4].map((i) => {
    const y = 200 + i * 26;
    return `M ${f(260 + i * 8)} ${f(y + 60)} Q ${f(330)} ${f(y + 10)} ${f(370)} ${f(y - 10)}`;
  });
  const earL = roundPoly([[142, 128], [140, 82], [178, 104]], 9);
  const earR = mirrorPts([[142, 128], [140, 82], [178, 104]]);
  return join(
    layered([
      { sil: E(176, 322, 18, 26), d: ['M 170 340 L 170 346 M 182 340 L 182 346'] },
      { sil: E(224, 322, 18, 26), d: ['M 218 340 L 218 346 M 230 340 L 230 346'] },
      {
        sil: [E(200, 150, 72, 54), earL, roundPoly(earR, 9)],
        p: [E(200, 172, 26, 18), 'M 192 166 L 208 166 L 200 174 Z', 'M 200 174 Q 194 184 186 182 M 200 174 Q 206 184 214 182', dot(172, 144, 6), dot(228, 144, 6)],
        d: [
          E(170, 124, 14, 8, -10), E(230, 124, 14, 8, 10), 'M 172 154 Q 168 172 176 190', 'M 228 154 Q 232 172 224 190',
          'M 150 104 L 156 116', 'M 250 104 L 244 116', 'M 136 166 Q 150 188 176 196', 'M 264 166 Q 250 188 224 196',
        ],
      },
      { sil: E(200, 272, 72, 82), d: ['M 176 220 Q 200 232 224 220'] },
      { sil: E(150, 350, 26, 12) },
      { sil: E(250, 350, 26, 12) },
      { sil: tail, d: rings.map((r) => inside(r, tail)) },
    ]),
  );
}

function mirrorPts(pts: readonly P[]): P[] {
  return pts.map(([x, y]) => [400 - x, y] as P);
}

// ---- advanced ---------------------------------------------------------------------------------------------------

function bisonArt(): Art {
  const mane = shaggy(smooth([[150, 140], [210, 92], [276, 100], [326, 150], [338, 230], [312, 286], [250, 290], [190, 260], [158, 200]]), 7, 14);
  const head = smooth([[292, 196], [334, 186], [364, 226], [362, 282], [340, 304], [312, 296], [294, 256]]);
  const beard = shaggy(petal(330, 284, 186, 50, 16), 4, 8);
  const body = E(162, 222, 104, 64);
  const legs = [
    tube([[278, 280], [280, 340]], 36, 30), tube([[236, 282], [240, 340]], 34, 28), tube([[96, 266], [92, 340]], 34, 26), tube([[140, 270], [146, 340]], 30, 24),
  ];
  return join(
    layered([
      { sil: tube([[318, 196], [300, 176], [306, 156]], 12, 5) },
      { sil: tube([[348, 196], [364, 178], [358, 160]], 10, 5) },
      {
        sil: head,
        p: [dot(326, 222, 4.5), E(354, 272, 5, 4, 20)],
        d: furFill(head, [296, 190, 362, 290], 26, 12, 180, 11, 2),
      },
      { sil: beard, d: furFill(beard, [312, 284, 352, 336], 10, 14, 180, 5, 1) },
      { sil: shaggy(legs[0], 4, 9), d: [hoof(280, 358, 12)] },
      { sil: mane, d: furFill(mane, [150, 96, 340, 290], 120, 14, 200, 21, 4) },
      { sil: legs[2], d: [hoof(92, 358, 12)] },
      { sil: body, d: [...furFill(body, [60, 160, 260, 290], 50, 10, 250, 41, 2), 'M 120 280 Q 150 292 190 284'] },
      { sil: legs[1], d: [hoof(240, 358, 11)] },
      { sil: legs[3], d: [hoof(146, 358, 11)] },
      { sil: tube([[60, 196], [46, 240]], 9, 6), d: [] },
      { sil: shaggy(E(44, 252, 8, 14), 3, 6) },
    ]),
    { p: [], d: [ground(24, 376, 370), tuft(190, 370), tuft(370, 370, 16), tuft(40, 370, 18)] },
  );
}

function chameleonArt(): Art {
  // tail: a spiral tube that curls under the branch
  const tail = tube([[132, 252], [96, 266], [70, 296], [72, 334], [100, 352], [126, 340], [128, 316], [110, 306], [98, 318]], 34, 8);
  const body = smooth([[118, 254], [140, 200], [196, 172], [256, 182], [292, 214], [290, 256], [236, 272], [160, 274]]);
  const head = smooth([[276, 206], [300, 168], [328, 186], [356, 222], [354, 248], [322, 258], [286, 252]]);
  const branch = tube([[36, 304], [140, 298], [260, 292], [376, 284]], 22, 16);
  const leaves = [petal(300, 284, 150, 56, 13), petal(342, 280, 40, 50, 12), petal(60, 298, 210, 46, 12)];
  const scales: string[] = [];
  for (let y = 186; y < 276; y += 16)
    for (let x = 126 + (((y - 186) / 16) % 2) * 8; x < 300; x += 16) scales.push(circle(x, y, 3.6));
  const crest = 'M 140 204 L 148 196 L 156 198 L 164 190 L 172 192 L 180 184 L 188 186 L 196 178 L 204 180 L 212 174 L 222 178 L 232 174 L 240 180 L 250 178 L 258 184';
  return join(
    layered([
      { sil: circle(322, 222, 15), p: [circle(322, 222, 9), dot(324, 221, 3.4)], d: [] },
      {
        sil: head,
        p: ['M 322 254 Q 340 248 356 236'],
        d: ['M 300 172 L 296 196 M 312 178 L 304 200 M 290 188 L 300 210', 'M 290 230 Q 300 240 318 244'],
      },
      { sil: [tube([[270, 260], [284, 286]], 18, 14), E(286, 290, 12, 8)] },
      { sil: [tube([[168, 262], [176, 294]], 18, 14), E(178, 298, 12, 8)] },
      { sil: leaves[0], d: ['M 300 284 L 266 306'] },
      { sil: branch, d: ['M 40 296 Q 70 300 90 296', 'M 200 286 Q 230 290 250 286', 'M 330 280 Q 350 282 366 278'] },
      { sil: leaves[1], d: ['M 342 280 L 374 252'] },
      { sil: leaves[2], d: ['M 60 298 L 30 330'] },
      {
        sil: body,
        p: [],
        d: [crest, ...chunk(scales, 6).map((s) => inside(s, body)), 'M 186 200 Q 196 230 186 262', 'M 236 194 Q 246 228 236 262'],
      },
      { sil: [tube([[248, 250], [238, 288]], 16, 12), E(236, 292, 11, 7)] },
      { sil: [tube([[150, 250], [138, 292]], 16, 12), E(136, 297, 11, 7)] },
      { sil: tail, d: ['M 84 284 L 96 292', 'M 72 316 L 86 318', 'M 88 344 L 96 334'] },
    ]),
  );
}

function horseGrazingArt(): Art {
  const neck = tube([[244, 160], [292, 196], [318, 252]], 64, 42);
  const head = tube([[318, 252], [336, 296], [346, 330]], 44, 30);
  const maneLines = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const x = 236 + t * 84;
    const y = 130 + t * 106;
    return `M ${f(x)} ${f(y)} Q ${f(x + 4)} ${f(y - 14)} ${f(x + 16)} ${f(y - 18)}`;
  }).join(' ');
  const tail = smooth([[88, 160], [64, 188], [52, 250], [56, 310], [70, 300], [78, 250], [92, 196]]);
  return join(
    layered([
      { sil: petal(324, 248, -12, 26, 8), d: ['M 324 246 L 328 230'] },
      { sil: head, p: [dot(334, 278, 4), E(342, 332, 5, 3.6, 70), 'M 330 338 Q 338 342 346 340'] },
      { sil: [neck, E(178, 180, 100, 50)], d: [maneLines, 'M 246 148 Q 290 168 316 226', 'M 290 216 Q 288 236 300 256', 'M 220 136 Q 236 160 232 210', 'M 112 150 Q 120 180 116 216', 'M 150 222 Q 180 232 214 224'] },
      { sil: tube([[250, 204], [256, 280], [254, 346]], 30, 16), d: [hoof(254, 354, 10), 'M 256 280 L 262 282'] },
      { sil: tube([[116, 206], [108, 270], [120, 346]], 36, 16), d: [hoof(120, 354, 10), 'M 108 270 L 102 272'] },
      { sil: tube([[224, 210], [232, 280], [228, 346]], 26, 14), d: [hoof(228, 354, 9)] },
      { sil: tube([[140, 212], [144, 280], [138, 346]], 30, 14), d: [hoof(138, 354, 9)] },
      { sil: tail, d: ['M 80 180 Q 66 230 62 296', 'M 86 190 Q 76 240 72 290', 'M 72 176 Q 60 210 58 260'] },
    ]),
    {
      p: [],
      d: [
        ground(24, 376, 360), tuft(320, 360, 26), tuft(356, 360, 20), tuft(200, 362, 18), tuft(60, 362, 22),
        'M 286 360 Q 290 344 296 336 M 372 360 Q 370 346 376 336',
      ],
    },
  );
}

function goatRockArt(): Art {
  const rock = roundPoly([[22, 384], [40, 316], [96, 282], [170, 268], [250, 264], [312, 286], [356, 330], [378, 384]], 10);
  const rock2 = roundPoly([[250, 384], [276, 330], [330, 316], [366, 340], [384, 384]], 8);
  const hatch = (x: number, y: number, n: number) =>
    Array.from({ length: n }, (_, i) => `M ${f(x + i * 8)} ${f(y)} L ${f(x + i * 8 - 10)} ${f(y + 14)}`).join(' ');
  const body = shaggy(E(196, 190, 78, 42), 5, 12);
  const neck = tube([[140, 180], [118, 140], [108, 112]], 50, 38);
  const head = smooth([[92, 92], [120, 84], [128, 106], [108, 134], [80, 146], [66, 138], [72, 112]]);
  const beard = shaggy(petal(84, 140, 196, 40, 10), 3, 7);
  return join(
    layered([
      { sil: tube([[110, 90], [128, 64], [156, 60], [170, 74]], 12, 5), d: ['M 124 70 L 130 76 M 136 62 L 140 70 M 148 60 L 150 68'] },
      { sil: petal(116, 100, 104, 30, 8) },
      { sil: head, p: [dot(100, 104, 4), E(72, 126, 4, 3, -30), 'M 70 138 Q 78 140 86 136'] },
      { sil: beard, d: ['M 84 146 L 80 170 M 90 148 L 92 168'] },
      { sil: shaggy(neck, 4, 10), d: furFill(neck, [96, 100, 160, 200], 20, 12, 160, 3, 2) },
      { sil: tube([[150, 214], [146, 262]], 22, 14), d: [hoof(146, 270, 9)] },
      { sil: tube([[240, 214], [246, 262]], 22, 14), d: [hoof(246, 268, 9)] },
      { sil: body, d: furFill(body, [120, 150, 272, 230], 60, 12, 200, 9, 3) },
      { sil: tube([[170, 220], [176, 266]], 18, 12) },
      { sil: tube([[222, 218], [216, 264]], 18, 12) },
      { sil: tube([[270, 176], [282, 160]], 12, 8) },
      { sil: rock2, d: ['M 300 330 L 312 362 L 330 384', hatch(318, 346, 4)] },
      {
        sil: rock,
        d: [
          'M 96 282 L 122 320 L 116 384', 'M 170 268 L 186 300 L 236 312 L 280 384', 'M 122 320 L 186 300', 'M 40 316 L 80 340 L 70 384',
          hatch(60, 300, 4), hatch(196, 318, 5), hatch(130, 340, 5), hatch(40, 352, 3),
        ],
      },
    ]),
    { p: [], d: ['M 300 60 Q 320 50 340 60 Q 356 52 370 62', 'M 240 40 Q 254 32 268 40'] },
  );
}

export const animals3: Template[] = [
  // beginner
  tpl('kangaroo', 'Kangaroo standing tall', 'beginner', ['kangaroo', 'outback', 'wildlife', 'stylized'], kangarooArt()),
  tpl('wombat', 'Chunky wombat', 'beginner', ['wombat', 'outback', 'cute', 'stylized'], wombatArt()),
  tpl('camel', 'Desert camel', 'beginner', ['camel', 'desert', 'hump', 'stylized'], camelArt()),
  tpl('hippo', 'River hippo', 'beginner', ['hippo', 'safari', 'river', 'stylized'], hippoArt()),
  tpl('cat-box', 'Cat peeking out of a cardboard box', 'beginner', ['cat', 'pet', 'box', 'cute'], catBoxArt()),
  tpl('dachshund', 'Dachshund sausage dog', 'beginner', ['dachshund', 'dog', 'pet', 'stylized'], dachshundArt()),
  tpl('gecko', 'Gecko seen from above', 'beginner', ['gecko', 'lizard', 'pet', 'stylized'], geckoArt()),
  tpl('meerkat', 'Meerkat on lookout', 'beginner', ['meerkat', 'desert', 'cute', 'stylized'], meerkatArt()),
  // intermediate
  tpl('rhino', 'Rhino with two horns', 'intermediate', ['rhino', 'safari', 'wildlife', 'realistic'], rhinoArt()),
  tpl('moose', 'Moose with broad antlers', 'intermediate', ['moose', 'forest', 'antlers', 'realistic'], mooseArt()),
  tpl('alpaca', 'Fluffy alpaca', 'intermediate', ['alpaca', 'farm', 'fluffy', 'cute'], alpacaArt()),
  tpl('corgi', 'Corgi standing', 'intermediate', ['corgi', 'dog', 'pet', 'cute'], corgiArt()),
  tpl('poodle', 'Poodle with pompom trim', 'intermediate', ['poodle', 'dog', 'pet', 'whimsical'], poodleArt()),
  tpl('red-panda', 'Red panda sitting', 'intermediate', ['panda', 'red-panda', 'forest', 'cute'], redPandaArt()),
  // advanced
  tpl('bison', 'Shaggy bison', 'advanced', ['bison', 'prairie', 'fur', 'realistic'], bisonArt()),
  tpl('chameleon', 'Chameleon on a branch', 'advanced', ['chameleon', 'lizard', 'branch', 'realistic'], chameleonArt()),
  tpl('horse-grazing', 'Horse grazing in a meadow', 'advanced', ['horse', 'meadow', 'farm', 'realistic'], horseGrazingArt()),
  tpl('goat-rock', 'Mountain goat on a rock', 'advanced', ['goat', 'mountain', 'rock', 'realistic'], goatRockArt()),
];
