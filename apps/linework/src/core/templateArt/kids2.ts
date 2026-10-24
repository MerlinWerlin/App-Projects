// kids2 template batch (T137, fb-1023b, 23 Oct 2026): more chunky, friendly line art for children on a 400×400 canvas —
// vehicles, toys, party and outdoor things, a spiky dinosaur and two busier scenes. Every piece is our own generic
// design: no existing characters, mascots, toys, logos or franchise silhouettes (see docs/TEMPLATES.md). Overlaps are
// drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, petal, poly, polar, rotate, rrect, type P } from './draw.ts';
import { clip, outline, region, roundPoly, type Layer, type Region } from './occlude.ts';
import { blob, curve, limb, sparkle } from './kit2.ts';

const VB = '0 0 400 400';

type Art = { p: string[]; d: string[] };
type Item = { sil: Layer | ''; p?: string[]; d?: string[] };

/** Draw items front to back: each item's outline and lines are clipped by every item in front of it. */
function layered(items: readonly Item[]): Art {
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (regs.length ? clip(s, regs) : s);
  for (const it of items) {
    for (const s of [it.sil === '' ? '' : outline(it.sil), ...(it.p ?? [])]) {
      const c = s ? cut(s) : '';
      if (c) p.push(c);
    }
    for (const s of it.d ?? []) {
      const c = s ? cut(s) : '';
      if (c) d.push(c);
    }
    if (it.sil !== '') regs.push(region(it.sil));
  }
  return { p, d };
}

/** Scale by s and move by (dx, dy). */
const xf = (d: string, s: number, dx: number, dy: number): string =>
  mapPath(d, { map: (x, y) => [x * s + dx, y * s + dy], scale: s, rotate: 0, flip: false });

/** Move a whole drawing (as items, so it can take part in a scene's layering). */
const place = (items: readonly Item[], s: number, dx: number, dy: number): Item[] =>
  items.map((it) => ({
    sil: it.sil === '' ? '' : typeof it.sil === 'string' ? xf(it.sil, s, dx, dy) : it.sil.map((q) => xf(q, s, dx, dy)),
    p: (it.p ?? []).map((q) => xf(q, s, dx, dy)),
    d: (it.d ?? []).map((q) => xf(q, s, dx, dy)),
  }));

// ---- kit ----------------------------------------------------------------------------------------------------------

const R = (x: number, y: number, w: number, h: number): string => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const dot = (x: number, y: number, r = 4.5): string => circle(x, y, r);
const smile = (x: number, y: number, w: number, depth = 0.7): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * depth)} ${f(x + w)} ${f(y)}`;
/** Two dot eyes and a smile centred on (x, y); s scales it. */
const face = (x: number, y: number, s = 1): string[] => [dot(x - 14 * s, y, 4.5 * s), dot(x + 14 * s, y, 4.5 * s), smile(x, y + 13 * s, 11 * s)];
const cheeks = (x: number, y: number, s = 1): string[] => [ellipse(x - 26 * s, y + 10 * s, 7 * s, 4.5 * s), ellipse(x + 26 * s, y + 10 * s, 7 * s, 4.5 * s)];

/** Fluffy cloud of width w centred at (cx, cy). */
function cloud(cx: number, cy: number, w: number): string {
  const s = w / 100;
  const p = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${p(-50, 15)} C ${p(-62, 15)} ${p(-62, -8)} ${p(-46, -8)} C ${p(-46, -28)} ${p(-20, -32)} ${p(-12, -18)} ` +
    `C ${p(-4, -40)} ${p(30, -40)} ${p(32, -14)} C ${p(54, -20)} ${p(62, 15)} ${p(46, 15)} Z`
  );
}

/** Horizontal wavy line from x0 to x1. */
function wave(x0: number, x1: number, y: number, a: number, w: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  for (let x = x0; x < x1 - 0.1; x += w) d += ` Q ${f(x + w / 4)} ${f(y - a)} ${f(x + w / 2)} ${f(y)} Q ${f(x + (3 * w) / 4)} ${f(y + a)} ${f(x + w)} ${f(y)}`;
  return d;
}

/** Scalloped lower edge from x0 to x1 at y (bumps hang down by h). */
function scallops(x0: number, x1: number, y: number, n: number, h: number): string {
  const w = (x1 - x0) / n;
  let d = `M ${f(x0)} ${f(y)}`;
  for (let i = 0; i < n; i++) d += ` Q ${f(x0 + w * (i + 0.5))} ${f(y + h * 2)} ${f(x0 + w * (i + 1))} ${f(y)}`;
  return d;
}

/** Closed shape: a straight top from x0 to x1 at y with a scalloped bottom. */
const scallopBand = (x0: number, x1: number, y: number, depth: number, n: number, h: number): string =>
  `M ${f(x0)} ${f(y)} L ${f(x1)} ${f(y)} L ${f(x1)} ${f(y + depth)} ${scallops(x1, x0, y + depth, n, h).replace(/^M [^ ]+ [^ ]+/, '')} Z`;

/** Wheel with a hub and four spokes. */
function wheel(cx: number, cy: number, r: number): Item {
  return { sil: circle(cx, cy, r), p: [circle(cx, cy, r * 0.38)], d: [circle(cx, cy, r * 0.12)] };
}

/** Rounded wall with crenellations (merlons) along the top. */
function crenel(x: number, y: number, w: number, h: number, n: number, th: number): string {
  const s = w / (2 * n - 1);
  const pts: P[] = [[x, y + h]];
  for (let i = 0; i < 2 * n - 1; i++) {
    const yy = i % 2 === 0 ? y : y + th;
    pts.push([x + i * s, yy], [x + (i + 1) * s, yy]);
  }
  pts.push([x + w, y + h]);
  return roundPoly(pts, 2.5);
}

/** Round-topped arch opening. */
const arch = (x: number, y: number, w: number, h: number): string =>
  `M ${f(x)} ${f(y + h)} L ${f(x)} ${f(y + w / 2)} A ${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(y + w / 2)} L ${f(x + w)} ${f(y + h)} Z`;

/** Rain drop with its point up, bottom at (x, y). */
const drop = (x: number, y: number, len: number): string => petal(x, y, 0, len, len * 0.32, 0.15);

/** Bow tie on a string centred on (x, y). */
const bow = (x: number, y: number, s: number): string =>
  `${roundPoly([[x, y], [x - 16 * s, y - 10 * s], [x - 16 * s, y + 10 * s]], 3 * s)} ${roundPoly([[x, y], [x + 16 * s, y - 10 * s], [x + 16 * s, y + 10 * s]], 3 * s)}`;

// ---- beginner pieces -------------------------------------------------------------------------------------------------

function tractor(): Art {
  return layered([
    { ...wheel(130, 290, 62), d: ['M 130 268 L 130 236 M 130 312 L 130 344 M 108 290 L 76 290 M 152 290 L 184 290'] },
    wheel(300, 312, 40),
    { sil: rrect(70, 106, 132, 18, 7) },
    { sil: rrect(180, 200, 150, 88, 16), p: [...face(262, 234, 1.1), rrect(312, 214, 14, 26, 5)] },
    { sil: rrect(84, 120, 106, 158, 10), p: [rrect(102, 140, 70, 62, 8)], d: [line(137, 140, 137, 202)] },
    { sil: rrect(286, 150, 16, 56, 6), p: [] },
    { sil: '', p: ['M 30 352 L 370 352'], d: ['M 56 360 L 80 360 M 210 364 L 246 364 M 330 360 L 352 360'] },
  ]);
}

function balloonItems(): Item[] {
  const bal = (cx: number, cy: number, r: number): Item => ({
    sil: `M ${f(cx)} ${f(cy + r)} C ${f(cx - r * 1.25)} ${f(cy + r * 0.75)} ${f(cx - r * 1.05)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} C ${f(cx + r * 1.05)} ${f(cy - r)} ${f(cx + r * 1.25)} ${f(cy + r * 0.75)} ${f(cx)} ${f(cy + r)} Z`,
    p: [roundPoly([[cx, cy + r - 2], [cx - 7, cy + r + 10], [cx + 7, cy + r + 10]], 2)],
    d: [`M ${f(cx - r * 0.55)} ${f(cy - r * 0.15)} Q ${f(cx - r * 0.5)} ${f(cy - r * 0.6)} ${f(cx - r * 0.1)} ${f(cy - r * 0.72)}`],
  });
  const B: [number, number, number][] = [[200, 118, 60], [116, 160, 50], [286, 162, 50], [148, 72, 44], [256, 74, 44]];
  const items = B.map(([x, y, r]) => bal(x, y, r));
  items[0].p!.push(...face(200, 116, 1.1));
  const strings = B.map(([x, y, r]) => curve([[x, y + r + 10], [x + (200 - x) * 0.4 + 8, y + r + 60], [200, 322]]));
  return [
    ...items,
    { sil: `${bow(200, 326, 1)}` },
    { sil: '', p: [strings.join(' '), 'M 196 330 Q 184 350 170 362 M 204 330 Q 216 350 232 360'] },
  ];
}

function kite(): Art {
  return layered([
    { sil: roundPoly([[200, 40], [300, 160], [200, 296], [100, 160]], 8), p: face(200, 150, 1.3), d: ['M 200 48 L 200 288 M 108 160 L 292 160'] },
    { sil: '', p: [`${bow(214, 334, 0.9)} ${bow(262, 364, 0.9)} ${bow(316, 356, 0.9)}`] },
    { sil: '', p: [curve([[200, 296], [222, 324], [208, 340], [238, 362], [282, 366], [334, 350]])] },
    { sil: '', p: [cloud(70, 74, 80), cloud(330, 76, 70)] },
  ]);
}

function teddy(): Art {
  return layered([
    {
      sil: circle(200, 130, 72),
      p: [ellipse(200, 157, 32, 24), ellipse(200, 145, 10, 7), dot(172, 116, 5.5), dot(228, 116, 5.5), 'M 200 152 L 200 164 M 186 166 Q 193 174 200 164 Q 207 174 214 166'],
    },
    { sil: ellipse(150, 350, 34, 24), p: [ellipse(150, 352, 16, 11)] },
    { sil: ellipse(250, 350, 34, 24), p: [ellipse(250, 352, 16, 11)] },
    { sil: limb([146, 236], [104, 296], 22, 24) },
    { sil: limb([254, 236], [296, 296], 22, 24) },
    { sil: circle(142, 76, 26), p: [circle(142, 76, 13)] },
    { sil: circle(258, 76, 26), p: [circle(258, 76, 13)] },
    { sil: ellipse(200, 282, 84, 80), p: [ellipse(200, 296, 42, 40)] },
  ]);
}

function rocket(): Art {
  return layered([
    { sil: circle(200, 158, 34), p: face(200, 152, 0.85) },
    { sil: 'M 200 38 C 238 70 252 110 252 150 L 252 280 L 148 280 L 148 150 C 148 110 162 70 200 38 Z', d: ['M 148 240 L 252 240', 'M 170 80 Q 200 96 230 80'] },
    { sil: roundPoly([[150, 210], [100, 282], [104, 316], [150, 280]], 6) },
    { sil: roundPoly([[250, 210], [300, 282], [296, 316], [250, 280]], 6) },
    { sil: roundPoly([[164, 280], [236, 280], [244, 304], [156, 304]], 4) },
    { sil: 'M 166 306 Q 160 340 200 374 Q 240 340 234 306 Z', d: ['M 184 308 Q 182 332 200 352 Q 218 332 216 308'] },
    { sil: '', p: [sparkle(76, 90, 16), sparkle(326, 120, 13), sparkle(70, 250, 11), sparkle(330, 260, 14)], d: [dot(110, 170, 3), dot(296, 66, 3), dot(320, 340, 3)] },
  ]);
}

function sandcastleItems(): Item[] {
  return [
    { sil: roundPoly([[200, 88], [240, 74], [200, 60]], 3), p: [] },
    { sil: '', p: ['M 200 122 L 200 60'] },
    { sil: crenel(164, 120, 72, 108, 3, 14), p: [...face(200, 168, 0.9)] },
    { sil: crenel(70, 160, 70, 170, 3, 14), p: [arch(94, 200, 22, 34)] },
    { sil: crenel(260, 160, 70, 170, 3, 14), p: [arch(284, 200, 22, 34)] },
    { sil: crenel(110, 222, 180, 108, 5, 14), p: [arch(176, 270, 48, 60)], d: ['M 120 300 L 150 300 M 250 300 L 280 300 M 130 254 L 160 254'] },
    { sil: '', p: ['M 30 330 L 370 330'] },
  ];
}

function bus(): Art {
  const wins = [50, 112, 174].map((x) => rrect(x, 150, 52, 56, 8));
  return layered([
    wheel(100, 300, 36),
    wheel(290, 300, 36),
    { sil: rrect(338, 282, 32, 16, 6) },
    {
      sil: rrect(30, 130, 330, 170, 22),
      p: [...wins, rrect(236, 150, 44, 130, 6), rrect(296, 150, 50, 74, 10), ...face(321, 182, 0.75), circle(346, 260, 9)],
      d: ['M 258 150 L 258 280', 'M 30 236 L 236 236 M 280 236 L 360 236'],
    },
    { sil: '', p: ['M 24 336 L 376 336'] },
  ]);
}

function rubberDuck(): Art {
  return layered([
    { sil: 'M 300 148 Q 338 134 354 154 Q 332 166 302 164 Z' },
    { sil: 'M 302 166 Q 330 168 346 176 Q 326 192 300 178 Z' },
    { sil: circle(250, 150, 62), p: [dot(262, 132, 6.5)], d: [ellipse(276, 176, 10, 6)] },
    { sil: 'M 148 252 Q 190 236 234 260 Q 206 298 158 288 Q 138 272 148 252 Z' },
    { sil: blob([[64, 200], [120, 236], [200, 240], [262, 214], [322, 226], [338, 270], [302, 314], [200, 330], [116, 320], [80, 286]]) },
    { sil: '', p: [wave(30, 350, 350, 7, 40)], d: [wave(80, 320, 372, 5, 40), circle(56, 260, 8), circle(40, 230, 5), circle(352, 300, 6)] },
  ]);
}

function cakeItems(): Item[] {
  const candles = [150, 192, 234];
  return [
    ...candles.map((x) => ({ sil: petal(x + 8, 124, 0, 28, 9, 0.3), d: [petal(x + 8, 120, 0, 14, 4, 0.3)] })),
    ...candles.map((x) => ({ sil: rrect(x, 130, 16, 56, 4), d: [`M ${x} 146 L ${x + 16} 138 M ${x} 162 L ${x + 16} 154 M ${x} 178 L ${x + 16} 170`] })),
    {
      sil: rrect(120, 180, 160, 76, 10),
      p: [scallops(122, 278, 198, 6, 7)],
      d: ['M 150 226 L 156 220 M 186 236 L 194 234 M 226 224 L 230 230 M 252 236 L 258 230'],
    },
    { sil: rrect(80, 252, 240, 88, 12), p: [scallops(82, 318, 270, 8, 7), ...face(200, 296, 1.1)] },
    { sil: ellipse(200, 340, 148, 20) },
  ];
}

function dinosaur(): Art {
  const plate = (cx: number, by: number, w: number, h: number): string => roundPoly([[cx - w, by + 14], [cx, by - h], [cx + w, by + 14]], 7);
  return layered([
    {
      sil: blob([[318, 186], [352, 188], [366, 210], [350, 234], [316, 244], [288, 266], [254, 292], [196, 302], [134, 298], [86, 284], [40, 302], [28, 292], [66, 258], [108, 222], [170, 198], [240, 196], [286, 196]]),
      p: [dot(336, 204, 5.5), 'M 322 226 Q 338 234 354 222'],
      d: ['M 120 276 Q 190 296 262 274', circle(170, 236, 9), circle(214, 228, 7), circle(240, 256, 8), circle(130, 250, 6)],
    },
    { sil: plate(112, 222, 20, 38) },
    { sil: plate(152, 206, 22, 46) },
    { sil: plate(198, 198, 22, 50) },
    { sil: plate(244, 200, 20, 44) },
    { sil: plate(282, 208, 16, 32) },
    ...[118, 158, 226, 266].map((x) => ({ sil: rrect(x, 258, 34, 76, 14), d: [`M ${x + 11} 334 L ${x + 11} 324 M ${x + 23} 334 L ${x + 23} 324`] })),
    { sil: '', p: ['M 24 340 L 376 340'] },
  ]);
}

function spinningTop(): Art {
  const body = 'M 70 190 C 110 140 290 140 330 190 C 300 250 240 300 206 340 L 200 354 L 194 340 C 160 300 100 250 70 190 Z';
  const inside = (s: string) => clip(s, [region(body)], 'inside');
  return layered([
    { sil: circle(200, 48, 13) },
    { sil: rrect(189, 56, 22, 106, 8) },
    {
      sil: body,
      p: [inside('M 60 198 Q 200 250 340 198'), inside('M 90 246 Q 200 290 310 246')],
      d: [sparkle(150, 230, 10), sparkle(200, 240, 10), sparkle(250, 230, 10), ...face(200, 180, 0.9)],
    },
    { sil: '', p: ['M 44 214 Q 30 250 50 286', 'M 356 214 Q 370 250 350 286'], d: [ellipse(200, 366, 54, 8), 'M 28 236 Q 22 250 30 266 M 372 236 Q 378 250 370 266'] },
  ]);
}

function umbrella(): Art {
  const canopy = `M 60 200 Q 60 80 200 76 Q 340 80 340 200 ${scallops(340, 60, 200, 5, -10).replace(/^M [^ ]+ [^ ]+/, '')} Z`;
  return layered([
    { sil: canopy, p: face(200, 140, 1.2), d: ['M 200 78 Q 150 110 116 200', 'M 200 78 Q 176 120 172 200', 'M 200 78 Q 224 120 228 200', 'M 200 78 Q 250 110 284 200'] },
    { sil: '', p: ['M 200 76 L 200 54', circle(200, 48, 6), 'M 200 196 L 200 322 Q 200 350 222 350 Q 242 350 242 332'] },
    { sil: '', p: [drop(50, 260, 30), drop(100, 316, 28), drop(300, 262, 30), drop(340, 330, 28), drop(56, 90, 24), drop(352, 98, 24), drop(144, 360, 22)], d: [ellipse(300, 366, 60, 9)] },
  ]);
}

function drum(): Art {
  const zig: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = 200 - 116 * Math.cos(rad((180 * i) / 12));
    zig.push([x, i % 2 ? 282 : 196]);
  }
  return layered([
    { sil: circle(242, 124, 13) },
    { sil: circle(160, 120, 13) },
    { sil: limb([90, 50], [236, 120], 6, 6) },
    { sil: limb([316, 52], [166, 116], 6, 6) },
    {
      sil: `M 80 170 A 120 36 0 0 1 320 170 L 320 300 A 120 36 0 0 1 80 300 Z`,
      p: [ellipse(200, 170, 120, 36), 'M 80 186 A 120 36 0 0 0 320 186', 'M 80 284 A 120 36 0 0 0 320 284', poly(zig, false)],
    },
    { sil: '', d: ['M 70 120 L 52 108 M 74 140 L 50 140 M 330 120 L 348 108 M 326 140 L 350 140'] },
  ]);
}

function wateringCan(): Art {
  return layered([
    { sil: rrect(110, 180, 170, 150, 24), p: [...face(195, 248, 1.1)], d: ['M 120 300 L 270 300'] },
    { sil: rotate(ellipse(352, 168, 20, 11), -58, 352, 168), d: [dot(346, 162, 2), dot(356, 168, 2), dot(352, 176, 2)] },
    { sil: roundPoly([[268, 286], [340, 176], [358, 186], [276, 320]], 4) },
    { sil: ellipse(166, 180, 40, 10) },
    { sil: 'M 114 204 C 44 200 44 310 114 306 L 114 284 C 72 286 72 226 114 226 Z' },
    { sil: '', d: ['M 372 190 L 380 206 M 362 196 L 366 214 M 372 220 L 378 236'], p: ['M 24 340 L 376 340', 'M 330 340 L 330 300', petal(330, 312, -55, 30, 9), petal(330, 304, 55, 26, 8)] },
  ]);
}

// ---- intermediate pieces ---------------------------------------------------------------------------------------------

function iceCreamVan(): Art {
  const body = roundPoly([[30, 120], [282, 120], [282, 172], [326, 172], [362, 226], [370, 300], [30, 300]], 12);
  return layered([
    wheel(96, 300, 34),
    wheel(300, 300, 34),
    { sil: circle(150, 62, 28), p: face(150, 60, 0.75), d: ['M 124 70 Q 136 80 146 72 Q 156 82 168 70'] },
    { sil: roundPoly([[124, 80], [176, 80], [150, 118]], 4), d: ['M 136 86 L 158 108 M 150 84 L 166 98 M 164 86 L 142 108 M 152 84 L 136 98'] },
    { sil: rrect(338, 280, 34, 16, 6) },
    { sil: scallopBand(50, 220, 132, 14, 7, 6), d: ['M 74 132 L 74 146 M 98 132 L 98 146 M 122 132 L 122 146 M 146 132 L 146 146 M 170 132 L 170 146 M 194 132 L 194 146'] },
    {
      sil: body,
      p: [rrect(60, 154, 150, 76, 8), rrect(56, 228, 158, 10, 4), roundPoly([[290, 182], [322, 182], [352, 228], [290, 228]], 6), rrect(232, 150, 36, 52, 4), circle(356, 262, 8)],
      d: [wave(30, 370, 268, 5, 34), 'M 286 236 L 286 300', 'M 238 166 L 262 166 M 238 178 L 262 178 M 238 190 L 254 190', 'M 76 214 L 94 214 M 114 216 L 128 216'],
    },
    { sil: '', p: ['M 24 336 L 376 336'] },
  ]);
}

function hotDogStand(): Art {
  return layered([
    { sil: 'M 132 166 Q 132 188 158 188 L 242 188 Q 268 188 268 166 Z', p: face(200, 172, 0.7) },
    { sil: rrect(116, 146, 168, 26, 13), d: ['M 136 158 L 148 152 L 160 160 L 172 152 L 184 160 L 196 152 L 208 160 L 220 152 L 232 160 L 244 152 L 256 160 L 266 154'] },
    { sil: rrect(66, 188, 268, 16, 6) },
    wheel(126, 318, 30),
    wheel(274, 318, 30),
    { sil: limb([328, 236], [372, 216], 5, 5) },
    { sil: rrect(80, 204, 240, 106, 10), p: [rrect(96, 220, 96, 72, 6), rrect(208, 220, 96, 72, 6)], d: [sparkle(144, 256, 14), sparkle(256, 256, 14)] },
    { sil: '', p: ['M 196 112 L 196 188 M 204 112 L 204 188'] },
    {
      sil: `M 64 112 Q 200 18 336 112 ${scallops(336, 64, 112, 6, -8).replace(/^M [^ ]+ [^ ]+/, '')} Z`,
      d: ['M 200 54 Q 130 70 109 112', 'M 200 54 Q 165 76 155 112', 'M 200 54 L 200 112', 'M 200 54 Q 235 76 245 112', 'M 200 54 Q 270 70 291 112'],
      p: ['M 200 54 L 200 36', circle(200, 30, 6)],
    },
    { sil: '', p: ['M 24 350 L 376 350'] },
  ]);
}

function helicopter(): Art {
  return layered([
    { sil: circle(170, 122, 11) },
    { sil: rrect(36, 114, 270, 14, 7) },
    { sil: rrect(162, 126, 16, 26, 4) },
    { sil: 'M 74 222 Q 78 164 150 158 L 150 222 Z', p: face(114, 196, 0.8) },
    { sil: ellipse(170, 220, 102, 72), p: [circle(214, 200, 18)], d: ['M 176 160 L 176 286', 'M 82 250 Q 170 270 262 248'] },
    { sil: rrect(346, 128, 14, 58, 7) },
    { sil: circle(353, 156, 9) },
    { sil: roundPoly([[332, 196], [344, 150], [364, 150], [364, 212]], 6) },
    { sil: roundPoly([[260, 196], [350, 188], [352, 212], [262, 238]], 6) },
    { sil: '', p: ['M 120 290 L 108 328 M 222 290 L 234 328', 'M 64 330 L 280 330 Q 300 330 304 314'] },
    { sil: '', p: [cloud(70, 56, 70), cloud(330, 330, 70)], d: ['M 30 180 L 54 180 M 24 200 L 46 200'] },
  ]);
}

function playground(): Art {
  const rails: string[] = [];
  for (let y = 176; y <= 336; y += 32) rails.push(`M 338 ${y} L 362 ${y}`);
  return layered([
    { sil: circle(310, 72, 26), p: face(310, 68, 0.72), d: [[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const [x1, y1] = polar(310, 72, 33, a); const [x2, y2] = polar(310, 72, 44, a); return line(x1, y1, x2, y2); }).join(' ')] },
    { sil: rrect(84, 270, 64, 14, 6) },
    { sil: rotate(rrect(150, 254, 58, 14, 6), -18, 179, 261) },
    { sil: '', p: ['M 96 116 L 96 270 M 136 116 L 136 270', 'M 162 116 L 158 258 M 202 116 L 194 248'] },
    { sil: rrect(40, 104, 196, 16, 7) },
    { sil: limb([56, 116], [30, 350], 6, 6) },
    { sil: limb([56, 116], [90, 350], 6, 6) },
    { sil: limb([222, 116], [196, 350], 6, 6) },
    { sil: limb([222, 116], [256, 350], 6, 6) },
    { sil: rrect(320, 140, 56, 12, 5) },
    { sil: 'M 328 152 C 300 164 286 300 236 336 L 246 352 C 306 316 322 186 348 160 Z' },
    { sil: '', p: ['M 338 152 L 338 352 M 362 152 L 362 352', ...rails, 'M 326 140 Q 326 112 348 112 Q 370 112 370 140'] },
    { sil: '', p: ['M 24 352 L 376 352'], d: ['M 60 352 L 56 340 M 66 352 L 68 338 M 72 352 L 78 342', 'M 280 352 L 276 342 M 286 352 L 288 338 M 292 352 L 298 342'] },
  ]);
}

// ---- advanced scenes -------------------------------------------------------------------------------------------------

function beachDay(): Art {
  const stripes = ['M 300 108 Q 262 130 246 176', 'M 300 108 Q 286 140 282 176', 'M 300 108 Q 314 140 318 176', 'M 300 108 Q 340 130 356 176'];
  const parasol = `M 228 178 Q 230 110 300 104 Q 370 110 372 178 ${scallops(372, 228, 178, 4, -8).replace(/^M [^ ]+ [^ ]+/, '')} Z`;
  const sand: string[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 40; i++) sand.push(circle(30 + rnd() * 340, 262 + rnd() * 110, 1.6));
  const sunRays = [0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => {
    const [x1, y1] = polar(70, 72, 38, a);
    const [x2, y2] = polar(70, 72, 52, a);
    return line(x1, y1, x2, y2);
  });
  const castle = place(sandcastleItems().filter((it) => it.sil !== '' || (it.p ?? [])[0] !== 'M 30 330 L 370 330'), 0.52, 8, 178);
  return layered([
    { sil: circle(352, 352, 22), p: ['M 330 352 Q 352 340 374 352', 'M 352 330 Q 340 352 352 374'] },
    { sil: roundPoly([[214, 300], [270, 300], [262, 360], [222, 360]], 5), p: ['M 216 300 Q 242 268 268 300'], d: ['M 220 318 L 264 318'] },
    { sil: limb([300, 312], [276, 254], 4, 4) },
    { sil: roundPoly([[296, 306], [312, 322], [304, 352], [286, 340]], 4) },
    ...castle,
    { sil: parasol, d: stripes },
    { sil: '', p: ['M 300 104 L 300 92', 'M 300 176 L 300 300'] },
    { sil: circle(70, 72, 28), p: face(70, 68, 0.7), d: sunRays },
    { sil: roundPoly([[150, 170], [190, 170], [184, 180], [156, 180]], 3) },
    { sil: roundPoly([[170, 168], [170, 136], [190, 166]], 3) },
    { sil: '', p: [cloud(196, 70, 80)] },
    { sil: '', p: ['M 24 180 L 376 180', wave(24, 376, 248, 6, 44)], d: [wave(40, 360, 202, 4, 36), wave(60, 340, 224, 4, 40), ...sand] },
  ]);
}

function birthdayParty(): Art {
  const flags: string[] = [];
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const x = 24 + 352 * t;
    const y = 36 + 2 * t * (1 - t) * 60;
    flags.push(roundPoly([[x - 13, y], [x + 13, y], [x, y + 26]], 2));
  }
  const confetti = [[70, 270], [100, 252], [340, 160], [300, 120], [250, 104], [146, 108], [42, 140], [360, 100], [60, 210]]
    .map(([x, y], i) => (i % 2 ? circle(x, y, 3) : `M ${x - 6} ${y + 3} Q ${x} ${y - 6} ${x + 6} ${y + 3}`));
  const cake = place(cakeItems(), 0.55, 98, 112);
  const balloons = place(balloonItems(), 0.5, -12, 66);
  return layered([
    ...balloons,
    ...cake,
    { sil: rrect(318, 206, 50, 40, 3), p: ['M 343 206 L 343 246', 'M 343 206 Q 326 186 334 182 Q 342 184 343 206 Q 346 184 354 182 Q 362 186 343 206'] },
    { sil: rrect(300, 244, 72, 56, 3), d: ['M 336 244 L 336 300 M 300 272 L 372 272'] },
    { sil: roundPoly([[60, 300], [96, 300], [78, 240]], 4), d: ['M 66 284 L 90 284 M 72 266 L 84 266'], p: [circle(78, 236, 6)] },
    { sil: scallopBand(24, 376, 300, 22, 11, 8) },
    { sil: '', p: ['M 60 338 L 60 380 M 340 338 L 340 380'] },
    { sil: '', p: flags, d: ['M 24 36 Q 200 96 376 36'] },
    { sil: '', d: confetti },
  ]);
}

const rad = (d: number): number => (d * Math.PI) / 180;

// ---- catalogue ----------------------------------------------------------------------------------------------------

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `kids2-${id}`,
    name,
    category: 'kids',
    level,
    tags: ['kids', 'children', ...tags],
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

export const kids2: Template[] = [
  // beginner
  tpl('smiling-tractor', 'Smiling farm tractor', 'beginner', ['tractor', 'farm', 'vehicle', 'smiling'], tractor()),
  tpl('balloon-bunch', 'Happy balloon bunch', 'beginner', ['balloons', 'party', 'birthday', 'happy'], layered(balloonItems())),
  tpl('diamond-kite', 'Little diamond kite', 'beginner', ['kite', 'wind', 'outdoor', 'little'], kite()),
  tpl('cuddly-teddy', 'Cuddly toy teddy bear', 'beginner', ['teddy', 'bear', 'toy', 'cuddly'], teddy()),
  tpl('toy-rocket', 'Little toy rocket', 'beginner', ['rocket', 'space', 'toy', 'stars'], rocket()),
  tpl('sandcastle', 'Happy sandcastle with a flag', 'beginner', ['sandcastle', 'beach', 'summer', 'happy'], layered(sandcastleItems())),
  tpl('school-bus', 'Smiling school bus', 'beginner', ['bus', 'school', 'vehicle', 'smiling'], bus()),
  tpl('rubber-duck', 'Little rubber duck', 'beginner', ['bath', 'toy', 'duck', 'little'], rubberDuck()),
  tpl('birthday-cake', 'Happy two-tier birthday cake', 'beginner', ['cake', 'birthday', 'party', 'candles', 'happy'], layered(cakeItems())),
  tpl('spiky-dinosaur', 'Friendly spiky dinosaur', 'beginner', ['dinosaur', 'prehistoric', 'friendly', 'animal'], dinosaur()),
  tpl('spinning-top', 'Little toy spinning top', 'beginner', ['toy', 'spinning-top', 'play', 'little'], spinningTop()),
  tpl('rain-umbrella', 'Smiling umbrella in the rain', 'beginner', ['umbrella', 'rain', 'weather', 'smiling'], umbrella()),
  tpl('toy-drum', 'Toy drum and sticks', 'beginner', ['drum', 'music', 'toy', 'play'], drum()),
  tpl('watering-can', 'Happy watering can', 'beginner', ['watering-can', 'garden', 'plant', 'happy'], wateringCan()),
  // intermediate
  tpl('ice-cream-van', 'Happy ice-cream van', 'intermediate', ['ice-cream', 'van', 'vehicle', 'summer', 'happy'], iceCreamVan()),
  tpl('hot-dog-stand', 'Little hot dog stand', 'intermediate', ['hot-dog', 'food', 'cart', 'stand', 'little'], hotDogStand()),
  tpl('toy-helicopter', 'Friendly toy helicopter', 'intermediate', ['helicopter', 'vehicle', 'toy', 'friendly'], helicopter()),
  tpl('playground', 'Happy little playground', 'intermediate', ['playground', 'swing', 'slide', 'outdoor', 'happy'], playground()),
  // advanced
  tpl('beach-day', 'Busy beach day', 'advanced', ['beach', 'summer', 'sandcastle', 'parasol', 'scene', 'busy'], beachDay()),
  tpl('birthday-party', 'Busy birthday party', 'advanced', ['birthday', 'party', 'cake', 'balloons', 'presents', 'scene', 'busy'], birthdayParty()),
];
