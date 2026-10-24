// Still life batch 3 (fb-1023b T138, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Everyday objects to draw from: a watering can, mugs, a plant on books, bottles and glasses, bread, headphones, a
// bulb, a record player, tools, chess pieces, a fan, a telephone, an oil lamp, a bicycle, a guitar, a sewing machine
// and an espresso machine. All unbranded and of our own design (no logos, maker names or model shapes). Overlaps use
// occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, petal, polar, rotate, rrect, type P } from './draw.ts';
import { roundPoly } from './occlude.ts';
import { join, layered, limb, smooth, type Art } from './figures.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `still3-${id}`,
    name,
    category: 'stilllife',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

const pl = (pts: readonly P[], closed = false): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ') + (closed ? ' Z' : '');
const ground = (x0: number, x1: number, y: number): string => `M ${f(x0)} ${f(y)} Q ${f((x0 + x1) / 2)} ${f(y + 4)} ${f(x1)} ${f(y)}`;
const mirror = (d: string, axis = 200): string => mapPath(d, { map: (x, y) => [2 * axis - x, y], scale: 1, rotate: 0, flip: true });
const lines = (segs: readonly (readonly [number, number, number, number])[]): string => segs.map((s) => line(...s)).join(' ');
const drop = (x: number, y: number, s: number): string =>
  `M ${f(x)} ${f(y - s)} C ${f(x + s * 0.8)} ${f(y)} ${f(x + s * 0.7)} ${f(y + s)} ${f(x)} ${f(y + s)} C ${f(x - s * 0.7)} ${f(y + s)} ${f(x - s * 0.8)} ${f(y)} ${f(x)} ${f(y - s)} Z`;
/** Radial spokes between r0 and r1. */
const spokes = (cx: number, cy: number, r0: number, r1: number, n: number, off = 0): string =>
  Array.from({ length: n }, (_, i) => line(...polar(cx, cy, r0, off + (360 * i) / n), ...polar(cx, cy, r1, off + (360 * i) / n))).join(' ');

// ---- beginner ----------------------------------------------------------------------------------------------------

function wateringCan(): Art {
  const body = rrect(140, 180, 150, 160, 16);
  const handle = 'M 160 184 C 160 92 272 92 272 184 L 254 184 C 254 116 178 116 178 184 Z';
  const spout = pl([[146, 306], [70, 192], [86, 182], [146, 268]], true);
  const rose = rotate(ellipse(72, 180, 26, 13), -35, 72, 180);
  const holes = [-12, 0, 12].map((k) => circle(72 + k * 0.82, 180 - k * 0.57, 2.5)).join(' ');
  return join(
    layered([
      { sil: rose, d: [holes] },
      { sil: spout },
      { sil: body, d: [line(140, 214, 290, 214), line(140, 306, 290, 306)] },
      { sil: handle },
    ]),
    { p: [], d: [drop(44, 220, 8), drop(62, 244, 7), drop(34, 256, 6), ground(110, 320, 352)] },
  );
}

function mugBody(x: number, y: number, w: number, h: number): string {
  const r = 14;
  return `M ${f(x)} ${f(y)} L ${f(x + w)} ${f(y)} L ${f(x + w)} ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} L ${f(x + r)} ${f(y + h)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} Z`;
}
function mugHandle(x: number, y: number, h: number): string {
  // handle on the right side of a body whose right edge is x
  return (
    `M ${f(x - 4)} ${f(y + 14)} C ${f(x + 44)} ${f(y + 8)} ${f(x + 44)} ${f(y + h - 8)} ${f(x - 4)} ${f(y + h - 14)} ` +
    `L ${f(x - 4)} ${f(y + h - 28)} C ${f(x + 24)} ${f(y + h - 26)} ${f(x + 24)} ${f(y + 26)} ${f(x - 4)} ${f(y + 28)} Z`
  );
}

function mugStack(): Art {
  return join(
    layered([
      { sil: ellipse(200, 122, 62, 10), p: [ellipse(200, 122, 52, 6)] },
      { sil: mugBody(138, 122, 124, 82), d: [line(138, 146, 262, 146), line(138, 154, 262, 154)] },
      { sil: mugHandle(262, 124, 70) },
      { sil: mugBody(124, 200, 152, 76), d: [[[160, 228], [200, 244], [240, 228], [180, 258], [220, 258]].map(([x, y]) => circle(x, y, 5)).join(' ')] },
      { sil: mirror(mugHandle(276, 202, 66)) },
      { sil: mugBody(110, 272, 180, 80), d: [line(110, 296, 290, 296), line(110, 312, 290, 312), line(110, 328, 290, 328)] },
      { sil: mugHandle(290, 276, 70) },
    ]),
    { p: [], d: ['M 178 104 C 170 88 190 80 182 62', 'M 214 104 C 206 86 228 78 218 58', ground(90, 330, 362)] },
  );
}

function plantOnBooks(): Art {
  const leaves: [number, number, number][] = [[0, 140, 26], [-40, 112, 24], [40, 112, 24], [-74, 92, 18], [74, 92, 18]];
  const items = leaves.map(([a, len, w]) => ({ sil: petal(200, 184, a, len, w, 0.45), d: [line(200, 184, ...polar(200, 184, len * 0.8, a))] }));
  return join(
    layered([
      { sil: rrect(130, 178, 140, 24, 6) },
      { sil: 'M 142 202 L 258 202 L 248 264 L 152 264 Z', d: [line(146, 226, 254, 226)] },
      ...items,
      { sil: rrect(98, 262, 214, 38, 6), d: [lines([[270, 272, 304, 272], [270, 281, 304, 281], [270, 290, 304, 290]]), line(124, 262, 124, 300)] },
      { sil: rrect(72, 298, 256, 42, 6), d: [lines([[90, 309, 320, 309], [90, 319, 320, 319], [90, 329, 320, 329]])] },
    ]),
    { p: [], d: [ground(50, 350, 352)] },
  );
}

function perfume(): Art {
  const body = roundPoly([[128, 196], [272, 196], [302, 272], [272, 350], [128, 350], [98, 272]], 8);
  const cap = roundPoly([[178, 140], [222, 140], [236, 106], [212, 66], [188, 66], [164, 106]], 5);
  const facets = pl([[150, 220], [250, 220], [270, 272], [250, 326], [150, 326], [130, 272]], true);
  return join(
    layered([
      { sil: cap, d: ['M 164 106 L 236 106 M 188 66 L 200 106 L 212 66'] },
      { sil: rrect(168, 140, 64, 18, 5) },
      { sil: rrect(180, 158, 40, 40, 4) },
      { sil: body, p: [facets], d: ['M 128 196 L 150 220 M 272 196 L 250 220 M 302 272 L 270 272 M 98 272 L 130 272 M 272 350 L 250 326 M 128 350 L 150 326'] },
      { sil: ellipse(330, 214, 22, 30), d: ['M 314 200 L 346 200 M 310 216 L 350 216 M 314 232 L 346 232'] },
      { sil: '', p: ['M 232 150 C 286 140 320 150 328 184'] },
    ]),
    { p: [], d: ['M 150 240 C 148 262 152 290 160 306', ground(80, 320, 360)] },
  );
}

function wineBottleGlass(): Art {
  const bottle = 'M 98 356 L 98 196 C 98 162 122 150 122 128 L 122 70 L 154 70 L 154 128 C 154 150 178 162 178 196 L 178 356 Z';
  const bowl = 'M 206 150 L 306 150 C 310 222 290 264 256 268 C 222 264 202 222 206 150 Z';
  return join(
    layered([
      { sil: bowl, d: ['M 208 204 Q 256 212 304 204', 'M 222 170 C 218 196 222 222 232 240'] },
      { sil: rrect(251, 266, 10, 74, 4) },
      { sil: ellipse(256, 344, 50, 10) },
      { sil: rrect(118, 56, 40, 16, 4) },
      { sil: rrect(110, 226, 56, 74, 6), d: ['M 122 252 L 154 252 M 122 264 L 154 264 M 130 276 L 146 276'] },
      { sil: bottle, d: ['M 110 200 L 110 340', 'M 122 92 L 154 92'] },
    ]),
    { p: [], d: [ground(70, 330, 362)] },
  );
}

function bread(): Art {
  const loaf = 'M 64 270 C 52 200 116 148 196 148 C 276 148 330 200 312 270 Z';
  const slashes = ['M 118 216 C 132 192 152 180 176 176', 'M 168 230 C 184 200 208 188 236 186', 'M 226 236 C 242 210 262 198 284 200'];
  return join(
    layered([
      { sil: loaf, d: slashes },
      { sil: rrect(306, 278, 66, 30, 15), p: [circle(352, 293, 6)] },
      { sil: rrect(36, 262, 286, 60, 12), d: ['M 60 288 C 120 282 200 296 300 286', 'M 80 304 C 140 298 220 310 290 302'] },
    ]),
    { p: [], d: [circle(96, 252, 2.5), circle(150, 256, 2.5), circle(250, 254, 2.5), ground(24, 376, 334)] },
  );
}

function headphones(): Art {
  const band = 'M 84 236 C 84 66 316 66 316 236 L 292 236 C 292 98 108 98 108 236 Z';
  return join(
    layered([
      { sil: rrect(66, 218, 58, 116, 26), d: [rrect(78, 236, 34, 80, 16)] },
      { sil: rrect(276, 218, 58, 116, 26), d: [rrect(288, 236, 34, 80, 16)] },
      { sil: rrect(118, 228, 26, 96, 13) },
      { sil: rrect(256, 228, 26, 96, 13) },
      { sil: rrect(80, 196, 32, 30, 6) },
      { sil: rrect(288, 196, 32, 30, 6) },
      { sil: band },
    ]),
    { p: [], d: [ground(70, 330, 356)] },
  );
}

function bulb(): Art {
  const glass = 'M 200 40 C 280 40 316 104 300 160 C 290 196 258 214 254 250 L 146 250 C 142 214 110 196 100 160 C 84 104 120 40 200 40 Z';
  return join(
    layered([
      { sil: 'M 176 312 L 224 312 L 212 336 L 188 336 Z' },
      { sil: rrect(158, 292, 84, 22, 9) },
      { sil: rrect(154, 270, 92, 22, 9) },
      { sil: rrect(150, 248, 100, 22, 9) },
      { sil: glass, p: ['M 184 248 L 184 168 M 216 248 L 216 168', 'M 184 168 C 186 148 194 148 196 164 C 198 148 202 148 204 164 C 206 148 214 148 216 168'], d: ['M 140 92 C 126 106 122 126 126 144'] },
    ]),
    { p: [], d: [lines([[200, 22, 200, 30], [118, 50, 112, 44], [282, 50, 288, 44], [330, 130, 340, 128], [70, 130, 60, 128]]), ground(150, 250, 352)] },
  );
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function recordPlayer(): Art {
  const c: P = [170, 200];
  const grooves = [46, 58, 70, 82, 94, 104].map((r) => circle(c[0], c[1], r)).join(' ');
  const head = rotate(rrect(250, 274, 32, 18, 4), 40, 266, 283);
  return join(
    layered([
      { sil: head },
      { sil: '', p: ['M 312 114 L 318 226 L 272 280'] },
      { sil: circle(312, 96, 18), p: [circle(312, 96, 6)] },
      { sil: rrect(300, 56, 24, 22, 5) },
      { sil: circle(c[0], c[1], 5) },
      { sil: circle(c[0], c[1], 34), d: ['M 150 190 L 190 190 M 156 212 L 184 212'] },
      { sil: circle(c[0], c[1], 110), d: [grooves] },
      { sil: circle(c[0], c[1], 118) },
      { sil: rrect(30, 60, 340, 280, 18), p: [circle(332, 300, 12), rrect(42, 306, 30, 16, 4), rrect(78, 306, 30, 16, 4)], d: [line(332, 290, 332, 296), rrect(38, 68, 324, 264, 12)] },
    ]),
    { p: [], d: [] },
  );
}

function toolbox(): Art {
  const handle = 'M 150 182 L 150 132 Q 150 118 164 118 L 236 118 Q 250 118 250 132 L 250 182 L 236 182 L 236 136 Q 236 132 232 132 L 168 132 Q 164 132 164 136 L 164 182 Z';
  const driver = [rotate(rrect(94, 84, 26, 70, 11), -14, 107, 180), rotate(rrect(104, 154, 6, 40, 2), -14, 107, 180)];
  const wrench = [rotate(rrect(276, 90, 18, 110, 9), 12, 285, 190), rotate('M 268 96 C 262 70 278 54 296 58 L 290 76 L 300 86 L 314 72 C 322 92 306 108 286 104 Z', 12, 285, 190)];
  const hammer = [rotate(rrect(192, 62, 14, 120, 6), 6, 200, 190), rotate(rrect(166, 52, 66, 22, 6), 6, 200, 190)];
  return join(
    layered([
      { sil: rrect(186, 208, 28, 24, 4), p: [circle(200, 220, 4)] },
      { sil: rrect(52, 180, 296, 40, 8) },
      { sil: rrect(60, 218, 280, 124, 10), d: [lines([[80, 250, 80, 320], [320, 250, 320, 320]]), line(60, 300, 340, 300), circle(76, 232, 3), circle(324, 232, 3)] },
      { sil: handle },
      { sil: driver, d: [rotate('M 100 96 L 100 140 M 107 94 L 107 142 M 114 96 L 114 140', -14, 107, 180)] },
      { sil: hammer },
      { sil: wrench },
    ]),
    { p: [], d: [ground(40, 360, 352)] },
  );
}

function chess(): Art {
  const pawn = layered([
    { sil: circle(96, 222, 24) },
    { sil: ellipse(96, 252, 30, 7) },
    { sil: 'M 76 256 C 80 290 72 304 66 318 L 126 318 C 120 304 112 290 116 256 Z' },
    { sil: rrect(54, 316, 84, 20, 8) },
    { sil: rrect(46, 334, 100, 16, 7) },
  ]);
  const king = layered([
    { sil: [rrect(194, 36, 12, 44, 3), rrect(182, 48, 36, 12, 3)] },
    { sil: 'M 168 92 C 168 74 232 74 232 92 L 226 114 L 174 114 Z' },
    { sil: ellipse(200, 118, 36, 8) },
    { sil: ellipse(200, 176, 30, 7) },
    { sil: 'M 176 124 C 182 200 168 270 160 314 L 240 314 C 232 270 218 200 224 124 Z', d: ['M 190 200 C 188 240 182 276 176 300'] },
    { sil: rrect(152, 312, 96, 22, 8) },
    { sil: rrect(150, 332, 100, 18, 8) },
  ]);
  const rook = layered([
    { sil: pl([[268, 192], [268, 150], [285, 150], [285, 166], [297, 166], [297, 150], [311, 150], [311, 166], [323, 166], [323, 150], [340, 150], [340, 192]], true) },
    { sil: ellipse(304, 196, 38, 7) },
    { sil: 'M 278 200 L 330 200 L 340 318 L 268 318 Z', d: [lines([[280, 230, 330, 230], [282, 260, 334, 260], [285, 290, 337, 290], [304, 200, 304, 230], [292, 230, 292, 260], [318, 230, 318, 260], [306, 260, 306, 290]])] },
    { sil: rrect(262, 316, 84, 20, 8) },
    { sil: rrect(258, 334, 92, 16, 7) },
  ]);
  return join(pawn, king, rook, { p: [], d: ['M 84 210 C 80 220 82 230 86 236', ground(30, 370, 358)] });
}

function deskFan(): Art {
  const cx = 200;
  const cy = 160;
  const blades = [0, 120, 240].map((a) => ({ sil: petal(cx, cy, a + 20, 104, 34, 0.65) }));
  return join(
    layered([
      { sil: circle(cx, cy, 22), p: [circle(cx, cy, 8)] },
      ...blades,
      { sil: '', d: [spokes(cx, cy, 24, 116, 24, 7.5), circle(cx, cy, 64), circle(cx, cy, 94)] },
      { sil: circle(cx, cy, 116) },
      { sil: circle(cx, cy, 124) },
      { sil: rrect(188, 282, 24, 44, 6) },
      { sil: 'M 112 356 C 112 330 156 318 200 318 C 244 318 288 330 288 356 Z', p: [rrect(176, 334, 14, 10, 3), rrect(198, 334, 14, 10, 3), rrect(220, 334, 14, 10, 3)] },
    ]),
    { p: [], d: [ground(90, 310, 364)] },
  );
}

function telephone(): Art {
  const body = 'M 72 330 L 102 194 C 106 176 118 168 136 168 L 264 168 C 282 168 294 176 298 194 L 328 330 Z';
  const holes = Array.from({ length: 10 }, (_, i) => circle(...polar(200, 262, 44, 40 + i * 28), 9)).join(' ');
  return join(
    layered([
      { sil: [rrect(80, 108, 240, 30, 15), rrect(48, 104, 80, 54, 22), rrect(272, 104, 80, 54, 22)], d: [ellipse(88, 150, 26, 4), ellipse(312, 150, 26, 4)] },
      { sil: rrect(112, 152, 30, 22, 5) },
      { sil: rrect(258, 152, 30, 22, 5) },
      { sil: circle(200, 262, 62), p: [holes, circle(200, 262, 22)], d: ['M 252 300 L 266 314', circle(200, 262, 30)] },
      { sil: body, d: ['M 116 200 L 284 200'] },
      { sil: rrect(56, 326, 288, 26, 8) },
    ]),
    { p: [], d: ['M 344 338 C 362 340 366 320 352 318 C 340 316 342 300 356 300 C 368 300 370 282 358 280', ground(40, 360, 362)] },
  );
}

function oilLamp(): Art {
  const chimney = 'M 172 240 C 138 204 138 150 176 118 L 182 70 L 218 70 L 224 118 C 262 150 262 204 228 240 Z';
  const flame = 'M 200 156 C 216 178 216 202 200 210 C 184 202 184 178 200 156 Z';
  const font = 'M 122 340 C 98 312 108 272 150 264 L 250 264 C 292 272 302 312 278 340 Z';
  const handle = 'M 118 318 C 56 318 58 254 128 266 L 132 280 C 84 274 84 304 120 302 Z';
  return join(
    layered([
      { sil: flame, d: ['M 200 186 L 200 214'] },
      { sil: chimney, d: ['M 162 150 C 154 172 156 198 168 216', 'M 186 82 L 214 82'] },
      { sil: circle(262, 252, 11), p: [circle(262, 252, 4)] },
      { sil: rrect(158, 238, 84, 26, 6), d: [lines([[170, 238, 170, 264], [186, 238, 186, 264], [214, 238, 214, 264], [230, 238, 230, 264]])] },
      { sil: font, d: ['M 136 292 C 140 312 150 324 162 330', 'M 120 296 L 280 296'] },
      { sil: handle },
      { sil: rrect(106, 336, 188, 20, 8) },
    ]),
    { p: [], d: [lines([[200, 50, 200, 38], [150, 66, 140, 56], [250, 66, 260, 56]]), ground(80, 320, 364)] },
  );
}

// ---- advanced ------------------------------------------------------------------------------------------------------

function bicycle(): Art {
  const rear: P = [104, 262];
  const front: P = [296, 262];
  const bb: P = [190, 266];
  const seat: P = [166, 160];
  const head: P = [284, 166];
  const fork: P = [290, 196];
  const t = 4.5;
  const frame = [limb(rear, bb, t, t), limb(bb, seat, t, t), limb(seat, rear, t - 0.5, t - 0.5), limb(seat, head, t, t), limb(bb, fork, t + 0.5, t), limb(head, fork, t + 1, t + 1), limb(fork, front, t - 0.5, t - 0.5)];
  const bars = [limb(head, [280, 138], 4, 4), limb([280, 138], [306, 132], 4, 4), limb([306, 132], [322, 146], 4, 4)];
  const saddle = 'M 128 144 C 136 132 186 130 198 140 C 198 152 152 154 128 150 Z';
  const wheel = (c: P) => ({ sil: circle(c[0], c[1], 84), p: [circle(c[0], c[1], 74)], d: [spokes(c[0], c[1], 9, 74, 18), circle(c[0], c[1], 9)] });
  return join(
    layered([
      { sil: rrect(198, 296, 30, 10, 3) },
      { sil: limb(bb, [212, 300], 4, 4) },
      { sil: circle(bb[0], bb[1], 24), p: [circle(bb[0], bb[1], 8)], d: [spokes(bb[0], bb[1], 10, 20, 5)] },
      { sil: saddle },
      { sil: limb(seat, [164, 148], 4, 4) },
      { sil: frame },
      { sil: bars },
      { sil: circle(rear[0], rear[1], 11) },
      { sil: '', p: ['M 190 242 L 104 251 M 190 290 L 104 273'] },
      wheel(rear),
      wheel(front),
    ]),
    { p: [], d: [rrect(316, 140, 14, 18, 5), ground(20, 380, 352)] },
  );
}

function guitar(): Art {
  const right: P[] = [[200, 152], [250, 156], [276, 186], [266, 226], [270, 256], [298, 296], [292, 344], [246, 372], [200, 376]];
  const left = right.slice(1, -1).reverse().map(([x, y]) => [400 - x, y] as P);
  const body = smooth([...right, ...left]);
  const head = 'M 184 58 L 178 20 L 222 20 L 216 58 Z';
  const pegs = [30, 40, 50].flatMap((y) => [rrect(166, y - 4, 12, 8, 3), rrect(222, y - 4, 12, 8, 3)]).join(' ');
  const frets = [74, 90, 105, 119, 132, 144].map((y) => line(184, y, 216, y)).join(' ');
  const strings = Array.from({ length: 6 }, (_, i) => line(187.5 + i * 5, 60, 180 + i * 8, 322)).join(' ');
  return join(
    layered([
      { sil: rrect(166, 316, 68, 16, 5), d: [line(176, 322, 224, 322)] },
      { sil: rrect(182, 56, 36, 112, 3), d: [frets] },
      { sil: head, p: [pegs], d: [circle(192, 34, 3), circle(208, 34, 3), circle(192, 48, 3), circle(208, 48, 3)] },
      { sil: circle(200, 236, 26), d: [circle(200, 236, 32), circle(200, 236, 36)] },
      { sil: 'M 228 256 C 256 258 266 230 254 210 C 242 200 226 210 228 226 Z' },
      { sil: body, d: ['M 132 340 C 150 360 176 368 200 368'] },
    ]),
    { p: [], d: [strings, circle(200, 368, 4), ground(110, 290, 386 - 6)] },
  );
}

function sewingMachine(): Art {
  const body =
    'M 270 300 L 270 162 L 142 162 L 142 222 Q 142 236 128 236 L 86 236 Q 72 236 72 222 L 72 122 Q 72 96 98 96 ' +
    'L 312 96 Q 338 96 338 122 L 338 300 Z';
  const scroll = (x: number, y: number) => `M ${f(x)} ${f(y)} C ${f(x + 16)} ${f(y - 14)} ${f(x + 34)} ${f(y - 6)} ${f(x + 30)} ${f(y + 6)} C ${f(x + 26)} ${f(y + 14)} ${f(x + 16)} ${f(y + 8)} ${f(x + 20)} ${f(y + 2)}`;
  return join(
    layered([
      { sil: rrect(204, 64, 24, 30, 4), d: [line(204, 72, 228, 72), line(204, 86, 228, 86)] },
      { sil: rrect(212, 50, 8, 16, 2) },
      { sil: circle(304, 214, 16), p: [circle(304, 214, 4)], d: [spokes(304, 214, 10, 15, 8)] },
      { sil: rrect(94, 234, 12, 30, 3) },
      { sil: 'M 80 286 L 120 286 L 120 296 L 80 296 Z' },
      { sil: '', p: ['M 100 264 L 100 286', 'M 112 236 L 112 286'] },
      { sil: body, d: [scroll(110, 126), scroll(176, 126), mirror(scroll(110, 126)), 'M 216 94 C 200 110 120 104 104 136 C 96 152 96 200 100 236', line(90, 112, 320, 112)] },
      { sil: circle(352, 150, 32), p: [circle(352, 150, 10)], d: [spokes(352, 150, 12, 28, 6)] },
      { sil: rrect(40, 300, 320, 44, 8), d: [rrect(64, 304, 74, 12, 3), line(76, 310, 126, 310), 'M 56 330 C 120 324 200 336 344 328'] },
    ]),
    { p: [], d: [ground(30, 370, 356)] },
  );
}

function espresso(): Art {
  const filter = 'M 160 176 L 240 176 L 232 198 Q 230 204 224 204 L 176 204 Q 170 204 168 198 Z';
  const cup = 'M 172 250 L 228 250 L 222 288 Q 220 296 212 296 L 188 296 Q 180 296 178 288 Z';
  const cupHandle = 'M 226 260 C 248 256 250 284 222 282 L 223 274 C 238 276 238 264 225 267 Z';
  return join(
    layered([
      { sil: cup, d: ['M 180 262 L 220 262'] },
      { sil: cupHandle },
      { sil: ellipse(200, 298, 40, 6) },
      { sil: [limb([236, 190], [338, 206], 7, 9)] },
      { sil: filter },
      { sil: rrect(156, 152, 88, 26, 6), d: [line(170, 165, 230, 165)] },
      { sil: circle(118, 134, 24), p: [circle(118, 134, 3)], d: ['M 118 134 L 132 120', spokes(118, 134, 17, 22, 9, -120)] },
      { sil: circle(282, 134, 14), d: [line(282, 124, 282, 134)] },
      { sil: [limb([314, 160], [326, 160], 5, 5), limb([326, 160], [334, 262], 5, 4)] },
      { sil: rrect(60, 300, 280, 40, 8), d: [lines([[90, 310, 90, 330], [110, 310, 110, 330], [130, 310, 130, 330], [150, 310, 150, 330], [250, 310, 250, 330], [270, 310, 270, 330], [290, 310, 290, 330], [310, 310, 310, 330]])] },
      { sil: rrect(70, 92, 260, 210, 14), d: [rrect(86, 108, 228, 64, 8), lines([[96, 240, 96, 290], [304, 240, 304, 290]])] },
      { sil: rrect(56, 66, 288, 28, 6), d: [lines([[80, 80, 120, 80], [280, 80, 320, 80]])] },
      { sil: [rrect(110, 44, 50, 24, 6), rrect(240, 44, 50, 24, 6)] },
    ]),
    { p: [], d: ['M 192 206 L 192 244 M 208 206 L 208 244', ground(40, 360, 352)] },
  );
}

// ---- catalogue -----------------------------------------------------------------------------------------------

export const stilllife4: Template[] = [
  tpl('watering-can', 'Garden watering can', 'beginner', ['watering can', 'garden', 'water', 'simple', 'objects', 'stylized'].map((t) => t.replace(' ', '-')), wateringCan()),
  tpl('mug-stack', 'Stack of three mugs', 'beginner', ['mug', 'cup', 'stack', 'kitchen', 'simple', 'cosy'], mugStack()),
  tpl('plant-books', 'Potted plant on books', 'beginner', ['books', 'plant', 'pot', 'desk', 'simple', 'home'], plantOnBooks()),
  tpl('perfume', 'Perfume bottle with atomizer', 'beginner', ['bottle', 'perfume', 'glass', 'vintage', 'simple', 'gift'], perfume()),
  tpl('wine-glass', 'Wine glass and bottle', 'beginner', ['bottle', 'glass', 'wine', 'dinner', 'simple', 'realistic'], wineBottleGlass()),
  tpl('bread-board', 'Bread loaf on a board', 'beginner', ['bread', 'loaf', 'kitchen', 'bakery', 'simple', 'realistic'], bread()),
  tpl('headphones', 'Studio headphones', 'beginner', ['headphones', 'music', 'audio', 'simple', 'objects', 'stylized'], headphones()),
  tpl('light-bulb', 'Glowing light bulb', 'beginner', ['bulb', 'light', 'idea', 'simple', 'objects', 'stylized'], bulb()),
  tpl('record-player', 'Record player from above', 'intermediate', ['record', 'turntable', 'music', 'vinyl', 'retro', 'objects'], recordPlayer()),
  tpl('toolbox', 'Toolbox with tools', 'intermediate', ['toolbox', 'tools', 'hammer', 'workshop', 'objects', 'realistic'], toolbox()),
  tpl('chess-pieces', 'Chess pieces trio', 'intermediate', ['chess', 'game', 'king', 'pawn', 'objects', 'classic'], chess()),
  tpl('desk-fan', 'Desk fan', 'intermediate', ['fan', 'summer', 'retro', 'home', 'objects', 'stylized'], deskFan()),
  tpl('telephone', 'Rotary telephone', 'intermediate', ['telephone', 'phone', 'rotary', 'vintage', 'retro', 'objects'], telephone()),
  tpl('oil-lamp', 'Oil lamp with glass chimney', 'intermediate', ['lamp', 'oil', 'light', 'vintage', 'antique', 'objects'], oilLamp()),
  tpl('bicycle', 'Classic bicycle', 'advanced', ['bicycle', 'bike', 'cycling', 'vintage', 'realistic', 'objects'], bicycle()),
  tpl('guitar', 'Detailed acoustic guitar', 'advanced', ['guitar', 'music', 'acoustic', 'instrument', 'realistic', 'objects'], guitar()),
  tpl('sewing-machine', 'Antique sewing machine', 'advanced', ['sewing machine', 'sewing', 'craft', 'vintage', 'antique', 'realistic'].map((t) => t.replace(' ', '-')), sewingMachine()),
  tpl('espresso', 'Espresso machine with cup', 'advanced', ['espresso', 'coffee', 'cup', 'kitchen', 'cafe', 'realistic'], espresso()),
];
