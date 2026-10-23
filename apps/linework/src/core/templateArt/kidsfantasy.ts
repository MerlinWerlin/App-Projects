// kidsfantasy template batch (fb-1023, 23 Oct 2026): original Kids pieces (friendly toys, vehicles, cartoon farm
// animals, party treats) and Fantasy & gothic pieces (dragons, griffin, phoenix, towers, skulls, runes) on a 400×400
// canvas. See docs/TEMPLATES.md. Every piece is generic and of our own design: no film, TV, game, book or toy-brand
// characters or lookalikes, no famous silhouettes. Rune glyphs are invented marks. Overlaps use occlude.ts.
import type { Template, TemplateCategory, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mirrorX, petal, poly, polar, rotate, rrect, star, type P } from './draw.ts';
import { clip, outline, region, roundPoly, union, type Layer, type Region } from './occlude.ts';
import { cloud, curve, limb, softStar } from './kit2.ts';

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

const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });
const free = (p: string[], d: string[] = []): Art => ({ p, d });

/** Lines of `d` kept only inside the closed shape `shape`. */
const inside = (d: string, shape: Layer): string => clip(d, [region(shape)], 'inside');

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

/** Little four-point sparkle. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

/** Crescent: the part of circle A outside circle B. */
function crescent(ax: number, ay: number, ar: number, bx: number, by: number, br: number): string {
  return `${clip(circle(ax, ay, ar), [region(circle(bx, by, br))])} ${clip(circle(bx, by, br), [region(circle(ax, ay, ar))], 'inside')}`;
}

/** Pointed (equilateral-ish) arch: left x, right x, spring line y, bottom y, arc radius r. */
function pointed(xl: number, xr: number, s: number, yb: number, r: number): string {
  const cx = (xl + xr) / 2;
  const apex = s - Math.sqrt(r * r - (cx - (xl + r)) * (cx - (xl + r)));
  return `M ${f(xl)} ${f(yb)} L ${f(xl)} ${f(s)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(apex)} A ${f(r)} ${f(r)} 0 0 1 ${f(xr)} ${f(s)} L ${f(xr)} ${f(yb)} Z`;
}

/** Round-topped arch: left x, right x, spring line y, bottom y. */
function roundArch(xl: number, xr: number, s: number, yb: number): string {
  const r = (xr - xl) / 2;
  return `M ${f(xl)} ${f(yb)} L ${f(xl)} ${f(s)} A ${f(r)} ${f(r)} 0 0 1 ${f(xr)} ${f(s)} L ${f(xr)} ${f(yb)} Z`;
}


/** Closed tube of half-width w(t) around an open centre line (t from 0 to 1). */
function tube(centre: readonly P[], w: (t: number) => number): string {
  const n = centre.length;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const ww = w(i / (n - 1));
    left.push([centre[i][0] + nx * ww, centre[i][1] + ny * ww]);
    right.push([centre[i][0] - nx * ww, centre[i][1] - ny * ww]);
  }
  return smooth([...left, ...right.reverse()]);
}

/** Faceted crystal standing at (bx, by), leaning deg, length len, half-width w. */
function crystal(bx: number, by: number, deg: number, len: number, w: number): Item {
  const tip = w * 1.1;
  const pts: P[] = [[-w, 0], [-w, -len + tip], [0, -len], [w, -len + tip], [w, 0]];
  const map = (q: P) => `${f(q[0] + bx)} ${f(q[1] + by)}`;
  const sil = rotate(`M ${pts.map(map).join(' L ')} Z`, deg, bx, by);
  const facet = rotate(`M ${map([0, -len])} L ${map([-w * 0.25, -len + tip])} L ${map([-w * 0.25, 0])} M ${map([-w * 0.25, -len + tip])} L ${map([-w, -len + tip])} M ${map([-w * 0.25, -len + tip])} L ${map([w, -len + tip])}`, deg, bx, by);
  return { sil, d: [facet] };
}

const R = (x: number, y: number, w: number, h: number): string => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const dot = (x: number, y: number, r = 5): string => circle(x, y, r);
const smile = (x: number, y: number, w: number, depth = 0.5): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * depth * 2)} ${f(x + w)} ${f(y)}`;
/** Happy closed eye (an upside-down U). */
const happyEye = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y - w * 1.2)} ${f(x + w)} ${f(y)}`;
/** Wavy line from x0 to x1 at y with crest width w and height h. */
function waves(x0: number, x1: number, y: number, w: number, h: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  for (let x = x0; x + w <= x1 + 0.1; x += w) d += ` Q ${f(x + w / 2)} ${f(y - h)} ${f(x + w)} ${f(y)}`;
  return d;
}
/** Grass tuft of three blades at (x, y). */
const tuft = (x: number, y: number, s = 1): string =>
  `M ${f(x - 10 * s)} ${f(y)} Q ${f(x - 10 * s)} ${f(y - 10 * s)} ${f(x - 16 * s)} ${f(y - 18 * s)} M ${f(x)} ${f(y)} Q ${f(x)} ${f(y - 14 * s)} ${f(x + 2 * s)} ${f(y - 24 * s)} M ${f(x + 10 * s)} ${f(y)} Q ${f(x + 10 * s)} ${f(y - 10 * s)} ${f(x + 18 * s)} ${f(y - 16 * s)}`;

function tpl(prefix: 'kid' | 'fan', category: TemplateCategory, id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
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
}
const kid = (id: string, name: string, level: TemplateLevel, tags: string[], art: Art) => tpl('kid', 'kids', id, name, level, tags, art);
const fan = (id: string, name: string, level: TemplateLevel, tags: string[], art: Art) => tpl('fan', 'fantasy', id, name, level, tags, art);

// ================================================================================================================
// KIDS
// ================================================================================================================

function fireEngineArt(): Art {
  const body = rrect(46, 196, 210, 104, 10);
  const cab = 'M 252 300 L 252 166 L 304 166 Q 322 166 330 182 L 352 230 Q 358 240 358 252 L 358 300 Z';
  const win = 'M 266 182 L 300 182 Q 310 182 314 192 L 330 228 L 266 228 Z';
  const wheel = (x: number): Item => ({ sil: circle(x, 300, 32), p: [circle(x, 300, 13)], d: [dot(x, 300, 4)] });
  const ladder = rrect(50, 168, 196, 16, 5);
  const rungs: string[] = [];
  for (let x = 70; x < 240; x += 22) rungs.push(line(x, 170, x, 182));
  return join(
    layered([
      wheel(112),
      wheel(296),
      { sil: rrect(346, 276, 24, 16, 5) },
      { sil: rrect(276, 144, 26, 22, 7), d: [line(282, 150, 296, 150)] },
      { sil: ladder, d: rungs },
      { sil: R(80, 184, 12, 14) },
      { sil: R(200, 184, 12, 14) },
      { sil: cab, p: [win], d: [dot(346, 254, 7), line(270, 250, 290, 250)] },
      { sil: body, p: [circle(160, 248, 30), circle(160, 248, 12)], d: [line(60, 278, 120, 278), line(200, 278, 240, 278), line(60, 214, 110, 214), line(210, 214, 240, 214)] },
    ]),
    free(['M 24 334 L 376 334']),
  );
}

function diggerArt(): Art {
  const track = rrect(150, 276, 200, 54, 27);
  const wheels = [175, 225, 275, 325].map((x) => circle(x, 303, 17));
  const base = rrect(180, 218, 170, 60, 10);
  const cab = 'M 250 218 L 250 124 Q 250 112 262 112 L 316 112 Q 330 112 332 126 L 340 218 Z';
  const win = rrect(264, 128, 56, 54, 6);
  const boom = limb([226, 236], [150, 120], 18, 14);
  const stick = limb([150, 120], [86, 206], 13, 11);
  const bucket = 'M 52 196 L 112 210 Q 110 258 78 270 Q 48 268 42 242 Z';
  const teeth = 'M 44 248 L 34 256 L 50 262 M 52 262 L 46 274 L 64 270';
  return join(
    layered([
      { sil: circle(150, 120, 8) },
      { sil: circle(86, 206, 8) },
      { sil: stick },
      { sil: bucket, p: [teeth], d: ['M 58 212 Q 86 230 102 216'] },
      { sil: boom, d: ['M 214 216 L 166 136'] },
      { sil: track, p: wheels, d: wheels.map((w, i) => dot([175, 225, 275, 325][i], 303, 4)) },
      { sil: R(212, 172, 14, 46), d: [line(212, 180, 226, 180)] },
      { sil: cab, p: [win], d: [line(270, 196, 300, 196)] },
      { sil: base, d: [line(196, 236, 236, 236), line(196, 248, 236, 248)] },
    ]),
    free(['M 24 334 L 376 334'], [tuft(60, 334), tuft(360, 334, 0.7)]),
  );
}

function trainArt(): Art {
  const boiler = rrect(108, 196, 160, 76, 22);
  const cab = rrect(258, 140, 90, 132, 8);
  const roof = rrect(248, 124, 110, 18, 6);
  const win = rrect(278, 162, 50, 46, 7);
  const chimney = 'M 152 196 L 144 146 L 184 146 L 176 196 Z';
  const chimTop = rrect(136, 130, 56, 18, 6);
  const dome = 'M 206 196 Q 206 172 224 172 Q 242 172 242 196 Z';
  const catcher = 'M 108 272 L 108 250 L 74 300 L 108 300 Z';
  const chassis = rrect(100, 270, 256, 20, 6);
  const puffs = union([circle(130, 92, 22), circle(98, 70, 26), circle(62, 50, 20), circle(156, 76, 18)]);
  return join(
    layered([
      { sil: circle(306, 300, 30), p: [circle(306, 300, 11)] },
      { sil: circle(190, 306, 22), p: [circle(190, 306, 8)] },
      { sil: circle(138, 306, 22), p: [circle(138, 306, 8)] },
      { sil: chimTop },
      { sil: chimney },
      { sil: dome },
      { sil: roof },
      { sil: catcher, d: [line(96, 268, 92, 298), line(102, 276, 100, 298)] },
      { sil: cab, p: [win], d: [line(278, 236, 328, 236)] },
      { sil: boiler, p: [circle(126, 222, 10)], d: [line(160, 198, 160, 270), line(208, 198, 208, 270)] },
      { sil: chassis, d: [line(138, 306, 190, 306)] },
      { sil: puffs },
    ]),
    free(['M 24 336 L 376 336'], [[60, 110, 160, 210, 260, 310, 360].map((x) => line(x - 14, 344, x + 14, 344)).join(' ')]),
  );
}

function sailboatArt(): Art {
  const hull = 'M 64 254 L 336 254 Q 316 308 272 314 L 128 314 Q 84 308 64 254 Z';
  const main = 'M 210 76 L 210 238 L 326 238 Z';
  const jib = 'M 192 96 L 192 238 L 92 238 Z';
  const flag = 'M 201 40 L 244 52 L 201 64 Z';
  const stripes = [120, 160, 200].map((y) => line(210, y, 340, y)).join(' ');
  return join(
    layered([
      { sil: flag },
      { sil: hull, p: [line(72, 274, 328, 274)], d: [circle(140, 292, 8), circle(200, 292, 8), circle(260, 292, 8)] },
      { sil: main, d: [inside(stripes, main)] },
      { sil: jib },
      { sil: '', p: [line(201, 40, 201, 254)] },
    ]),
    free([waves(24, 376, 334, 44, 14)], [waves(46, 354, 360, 44, 10), sparkle(330, 70, 12), sparkle(70, 120, 9)]),
  );
}

function planeArt(): Art {
  const body = 'M 74 168 Q 86 166 108 190 L 286 186 Q 336 190 338 214 Q 338 240 288 242 L 118 242 Q 84 236 74 168 Z';
  const tail = 'M 76 172 L 64 116 Q 64 104 78 106 L 132 190 Z';
  const wing = 'M 172 222 L 240 222 L 214 282 Q 208 292 194 290 Z';
  const top = 'M 198 188 L 236 188 L 222 140 Q 218 130 208 132 Z';
  const prop = ellipse(346, 214, 7, 44);
  return join(
    layered([
      { sil: circle(344, 214, 9) },
      { sil: prop },
      { sil: wing, d: [line(186, 236, 212, 236)] },
      { sil: circle(240, 266, 14), p: [circle(240, 266, 5)] },
      { sil: body, p: ['M 252 188 Q 266 166 290 172 L 296 190'], d: [circle(150, 210, 9), circle(184, 208, 9), dot(302, 208, 4.5), smile(304, 226, 12, 0.4), line(250, 242, 240, 254)] },
      { sil: top },
      { sil: tail, d: [line(80, 140, 104, 166)] },
      { sil: cloud(110, 296, 120) },
      { sil: cloud(300, 98, 110) },
    ]),
    free([], [sparkle(60, 60, 9), sparkle(350, 330, 10)]),
  );
}

function rocketArt(): Art {
  const body = 'M 200 40 Q 262 92 262 186 L 262 276 L 138 276 L 138 186 Q 138 92 200 40 Z';
  const finL = 'M 140 214 L 94 284 Q 92 306 112 306 L 140 278 Z';
  const finR = mirrorX(finL, 200);
  const nozzle = 'M 158 276 L 242 276 L 232 298 L 168 298 Z';
  const flame = 'M 172 300 Q 158 340 200 380 Q 242 340 228 300 Z';
  const inner = 'M 186 300 Q 180 330 200 354 Q 220 330 214 300';
  return join(
    layered([
      { sil: finL },
      { sil: finR },
      { sil: body, p: [circle(200, 160, 30), 'M 158 108 Q 200 124 242 108'], d: [circle(200, 160, 20), line(140, 240, 260, 240), dot(176, 214, 4), dot(224, 214, 4), dot(200, 214, 4)] },
      { sil: nozzle },
      { sil: flame, d: [inner] },
    ]),
    free([softStar(70, 90, 18, 8, 5, 2), softStar(330, 140, 14, 6, 5, 2), softStar(320, 300, 12, 5, 5, 2)], [sparkle(80, 250, 10), sparkle(300, 60, 8), dot(110, 180, 3), dot(350, 220, 3)]),
  );
}

function stegoArt(): Art {
  const body = smooth([[42, 250], [96, 212], [186, 176], [266, 192], [318, 212], [350, 222], [366, 244], [346, 262], [298, 262], [210, 292], [120, 286], [62, 268]]);
  const plate = (x: number, y: number, deg: number, len: number) => petal(x, y, deg, len, len * 0.42, 0.45);
  const legs = [rrect(104, 254, 40, 70, 16), rrect(232, 250, 40, 74, 16)];
  const backLegs = [rrect(146, 262, 36, 58, 15), rrect(272, 250, 34, 66, 14)];
  return join(
    layered([
      { sil: legs[0], d: ['M 110 316 L 110 322 M 124 316 L 124 324 M 138 316 L 138 322'] },
      { sil: legs[1], d: ['M 238 316 L 238 322 M 252 316 L 252 324 M 266 316 L 266 322'] },
      { sil: body, d: [dot(334, 230, 5.5), smile(338, 246, 12, 0.35), 'M 120 270 Q 200 280 270 256', circle(170, 230, 9), circle(214, 218, 7), circle(130, 244, 6)] },
      { sil: backLegs[0] },
      { sil: backLegs[1] },
      { sil: plate(110, 236, -38, 66) },
      { sil: plate(150, 218, -18, 80) },
      { sil: plate(194, 206, 0, 86) },
      { sil: plate(240, 210, 18, 74) },
      { sil: plate(282, 222, 36, 58) },
      { sil: plate(70, 254, -62, 44) },
      { sil: plate(60, 258, -96, 32) },
    ]),
    free(['M 24 324 L 376 324'], [tuft(40, 324), tuft(360, 324, 0.8)]),
  );
}

function hatchlingArt(): Art {
  const shell = 'M 104 246 L 128 222 L 150 248 L 174 222 L 198 248 L 222 222 L 246 248 L 270 222 L 296 246 Q 306 336 200 346 Q 94 336 104 246 Z';
  const dino = smooth([[150, 260], [146, 190], [150, 130], [186, 92], [250, 90], [298, 118], [304, 152], [282, 170], [240, 172], [234, 210], [250, 262]]);
  const cap = 'M 168 108 L 180 96 L 192 108 L 206 94 L 220 108 L 234 94 L 248 106 Q 250 72 210 64 Q 168 64 168 108 Z';
  const arm = limb([236, 226], [262, 240], 9, 9);
  return join(
    layered([
      { sil: cap },
      { sil: arm },
      { sil: shell, d: ['M 140 290 L 156 304 L 150 318', 'M 252 282 L 262 300'] },
      { sil: dino, p: [circle(222, 130, 14)], d: [dot(226, 132, 6), dot(286, 124, 3), smile(270, 152, 18, 0.3), 'M 168 176 Q 176 168 184 178', circle(172, 210, 6), circle(200, 196, 5)] },
      { sil: petal(148, 158, -95, 26, 10) },
      { sil: petal(148, 194, -95, 22, 9) },
    ]),
    free(['M 30 346 L 370 346'], [tuft(64, 346), tuft(338, 346), sparkle(330, 210, 10), sparkle(80, 120, 9)]),
  );
}

function cowArt(): Art {
  const head = smooth([[132, 112], [200, 98], [268, 112], [290, 190], [276, 256], [124, 256], [110, 190]]);
  const muzzle = ellipse(200, 278, 92, 58);
  const earL = rotate(ellipse(92, 150, 40, 18), -20, 92, 150);
  const earR = mirrorX(earL, 200);
  const hornL = 'M 150 112 Q 132 84 150 62 Q 162 84 174 106 Z';
  const hornR = mirrorX(hornL, 200);
  const spot = smooth([[226, 130], [262, 124], [276, 160], [256, 186], [232, 170]]);
  const tuftTop = 'M 178 104 Q 184 82 200 92 Q 212 76 222 102';
  return join(
    layered([
      { sil: muzzle, p: [ellipse(168, 272, 12, 16), ellipse(232, 272, 12, 16)], d: [smile(200, 302, 30, 0.35)] },
      { sil: head, p: [tuftTop], d: [inside(spot, head), dot(160, 186, 8), dot(240, 186, 8), 'M 144 204 Q 150 212 158 210', 'M 256 204 Q 250 212 242 210'] },
      { sil: earL, d: ['M 70 150 Q 92 142 112 152'] },
      { sil: earR, d: ['M 330 150 Q 308 142 288 152'] },
      { sil: hornL },
      { sil: hornR },
    ]),
    free([], [tuft(80, 356, 1.2), tuft(320, 356, 1.2)]),
  );
}

function pigArt(): Art {
  const body = ellipse(190, 236, 118, 78);
  const head = circle(296, 196, 62);
  const snout = ellipse(354, 212, 20, 26);
  const ear = 'M 266 148 L 270 104 Q 298 118 306 140 Z';
  const ear2 = 'M 300 140 L 322 104 Q 340 130 334 152 Z';
  const leg = (x: number) => rrect(x, 286, 32, 46, 10);
  const tail = 'M 74 214 Q 52 206 52 190 Q 54 176 66 182 Q 74 192 60 200 Q 46 206 40 196';
  return join(
    layered([
      { sil: snout, p: [ellipse(348, 204, 4, 6), ellipse(360, 220, 4, 6)] },
      { sil: ear2 },
      { sil: head, d: [dot(316, 186, 6), smile(318, 232, 14, 0.4), circle(286, 214, 10)] },
      { sil: ear },
      { sil: leg(230) },
      { sil: leg(110) },
      { sil: body, d: ['M 140 180 Q 160 166 186 168'] },
      { sil: leg(256) },
      { sil: leg(136) },
      { sil: '', p: [tail] },
    ]),
    free(['M 24 332 L 376 332'], [tuft(60, 332), tuft(360, 332, 0.8), 'M 174 324 Q 178 330 182 324']),
  );
}

function sheepArt(): Art {
  const wool: string[] = [ellipse(186, 226, 104, 62)];
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    wool.push(circle(186 + Math.cos(a) * 100, 226 + Math.sin(a) * 58, 30 + (i % 2) * 4));
  }
  const head = rotate(ellipse(302, 210, 32, 44), 20, 302, 210);
  const topKnot = union([circle(286, 168, 14), circle(304, 160, 14), circle(320, 170, 12)]);
  const ear = rotate(ellipse(264, 196, 22, 10), -20, 264, 196);
  const ear2 = rotate(ellipse(338, 192, 20, 9), 30, 338, 192);
  const leg = (x: number, y = 284) => rrect(x, y, 20, 56, 8);
  return join(
    layered([
      { sil: topKnot },
      { sil: head, d: [dot(296, 210, 5), dot(320, 214, 5), smile(304, 236, 10, 0.4)] },
      { sil: ear2 },
      { sil: ear },
      { sil: wool, d: ['M 120 220 Q 130 210 140 220', 'M 170 250 Q 180 240 190 250', 'M 210 210 Q 220 200 230 210'] },
      { sil: leg(118) },
      { sil: leg(238) },
      { sil: leg(146, 280) },
      { sil: leg(212, 280) },
    ]),
    free(['M 24 340 L 376 340'], [tuft(60, 340), tuft(350, 340), sparkle(70, 90, 10)]),
  );
}

function sundaeArt(): Art {
  const glass = 'M 104 206 L 296 206 Q 290 268 226 286 L 214 286 L 214 322 L 254 340 L 146 340 L 186 322 L 186 286 L 174 286 Q 110 268 104 206 Z';
  const scoops = [circle(154, 186, 46), circle(246, 186, 46), circle(200, 142, 48)];
  const wafer = rotate(rrect(256, 70, 26, 90, 4), 24, 270, 115);
  const cherry = circle(196, 80, 17);
  return join(
    layered([
      { sil: cherry, d: ['M 188 72 Q 192 66 198 68'] },
      { sil: '', p: ['M 200 64 Q 204 40 226 30'] },
      { sil: glass, p: [line(112, 228, 288, 228)], d: ['M 130 244 Q 140 262 160 270', line(160, 334, 240, 334)] },
      { sil: scoops[0], d: ['M 120 200 Q 130 214 146 216'] },
      { sil: scoops[1], d: [line(232, 168, 238, 160), line(256, 200, 264, 196)] },
      { sil: scoops[2], d: [line(180, 120, 186, 112), line(214, 160, 222, 164), line(230, 120, 236, 126), line(172, 156, 178, 162)] },
      { sil: wafer, d: [inside([0, 1, 2, 3].map((k) => line(240, 70 + k * 24, 300, 100 + k * 24)).join(' '), wafer)] },
    ]),
    free([], [sparkle(70, 110, 11), sparkle(334, 230, 9), sparkle(80, 300, 8)]),
  );
}

function birthdayCupcakeArt(): Art {
  const wrap = 'M 116 236 L 284 236 L 262 344 L 138 344 Z';
  const frost = [ellipse(200, 228, 100, 28), ellipse(200, 196, 78, 26), ellipse(200, 166, 52, 24)];
  const candle = rrect(190, 86, 20, 66, 5);
  const flame = petal(200, 82, 0, 34, 10, 0.3);
  const pleats = [150, 175, 200, 225, 250].map((x) => line(x, 258, x + (x - 200) * 0.06, 344)).join(' ');
  return join(
    layered([
      { sil: flame, d: [petal(200, 80, 0, 16, 4, 0.3)] },
      { sil: candle, d: [inside('M 186 104 L 214 92 M 186 124 L 214 112 M 186 144 L 214 132', candle)] },
      { sil: frost[2], d: [line(184, 160, 188, 154), line(214, 168, 220, 172)] },
      { sil: frost[1], d: [line(150, 196, 156, 190), line(240, 200, 248, 204), line(196, 210, 202, 214)] },
      { sil: frost[0], d: [line(124, 230, 130, 226), line(270, 232, 278, 228), line(170, 246, 176, 250), line(226, 244, 232, 240)] },
      { sil: wrap, d: [inside(pleats, wrap), dot(176, 288, 6), dot(224, 288, 6), smile(200, 304, 16, 0.4)] },
    ]),
    free([], [sparkle(80, 110, 12), sparkle(320, 120, 10), sparkle(330, 300, 8), sparkle(70, 290, 8)]),
  );
}

function balloonsArt(): Art {
  const balloon = (cx: number, cy: number, tilt: number): Item => {
    const shape = rotate(`M ${cx} ${cy - 60} C ${cx + 40} ${cy - 60} ${cx + 52} ${cy - 20} ${cx + 50} ${cy + 6} C ${cx + 46} ${cy + 40} ${cx + 14} ${cy + 64} ${cx} ${cy + 66} C ${cx - 14} ${cy + 64} ${cx - 46} ${cy + 40} ${cx - 50} ${cy + 6} C ${cx - 52} ${cy - 20} ${cx - 40} ${cy - 60} ${cx} ${cy - 60} Z`, tilt, cx, cy);
    const knot = rotate(poly([[cx, cy + 64], [cx - 8, cy + 76], [cx + 8, cy + 76]]), tilt, cx, cy);
    return { sil: [shape, knot], d: [rotate(`M ${cx - 30} ${cy - 22} Q ${cx - 28} ${cy - 40} ${cx - 12} ${cy - 46}`, tilt, cx, cy)] };
  };
  const knotAt = (cx: number, cy: number, tilt: number): P => polar(cx, cy, 76, 180 + tilt);
  const strings = ([[124, 128, -18], [200, 100, 0], [278, 132, 16]] as const).map(([x, y, t]) => {
    const k = knotAt(x, y, t);
    return curve([k, [(k[0] + 200) / 2 + (x < 200 ? -10 : x > 200 ? 10 : 8), (k[1] + 300) / 2], [200, 300]]);
  });
  const bow = [petal(200, 300, -60, 34, 12), petal(200, 300, 60, 34, 12)];
  return join(
    layered([
      balloon(200, 100, 0),
      balloon(124, 128, -18),
      balloon(278, 132, 16),
      { sil: circle(200, 300, 6) },
      { sil: bow },
      { sil: '', p: [...strings, 'M 196 304 Q 186 330 192 356', 'M 204 304 Q 214 330 208 356'] },
    ]),
    free([], [sparkle(60, 60, 10), sparkle(340, 50, 9), sparkle(330, 300, 9)]),
  );
}

function kiteArt(): Art {
  const kite = poly([[196, 34], [292, 144], [196, 272], [100, 144]]);
  const tail = curve([[196, 272], [170, 300], [196, 326], [230, 340], [250, 372]]);
  const bow = (x: number, y: number, deg: number) => rotate(`M ${x} ${y} L ${x - 16} ${y - 10} L ${x - 16} ${y + 10} Z M ${x} ${y} L ${x + 16} ${y - 10} L ${x + 16} ${y + 10} Z`, deg, x, y);
  return join(
    layered([
      { sil: bow(176, 298, -40) },
      { sil: bow(212, 332, 20) },
      { sil: bow(244, 362, 50) },
      { sil: kite, p: [line(196, 34, 196, 272), line(100, 144, 292, 144)], d: [dot(166, 120, 6), dot(226, 120, 6), smile(196, 176, 26, 0.45), circle(150, 158, 8), circle(242, 158, 8)] },
      { sil: '', p: [tail, curve([[196, 144], [130, 240], [60, 330], [40, 376]])] },
    ]),
    free([], [sparkle(320, 60, 10), sparkle(70, 70, 9)]),
  );
}

function sandcastleArt(): Art {
  const crenel = (x: number, y: number, w: number, n: number, bottom: number): string => {
    const step = w / (n * 2 - 1);
    const pts: P[] = [];
    for (let i = 0; i < n * 2 - 1; i++) {
      const xa = x + i * step;
      const top = i % 2 === 0 ? y : y + 12;
      pts.push([xa, top], [xa + step, top]);
    }
    return poly([...pts, [x + w, bottom], [x, bottom]]);
  };
  const towerShape = (x: number, y: number, w: number, bottom: number) => crenel(x, y, w, 3, bottom);
  const keep = towerShape(158, 120, 84, 300);
  const left = towerShape(96, 186, 62, 300);
  const right = towerShape(242, 186, 62, 300);
  const wall = R(96, 236, 208, 64);
  const door = roundArch(182, 218, 262, 300);
  const bucket = 'M 32 248 L 92 248 L 84 316 L 40 316 Z';
  const spade = [rotate('M 320 300 L 360 300 L 356 330 Q 340 344 324 330 Z', 14, 340, 300), rotate(rrect(334, 200, 10, 102, 4), 14, 340, 300)];
  return join(
    layered([
      { sil: '', p: ['M 200 120 L 200 74'] },
      { sil: poly([[201, 74], [232, 84], [201, 96]]) },
      { sil: spade, d: [rotate('M 330 312 L 350 312', 14, 340, 300)] },
      { sil: bucket, p: ['M 36 270 Q 62 236 88 270'], d: [line(36, 268, 88, 268), sparkle(62, 292, 9)] },
      { sil: door },
      { sil: keep, d: [roundArch(188, 212, 166, 196)] },
      { sil: left, d: [roundArch(118, 136, 218, 236)] },
      { sil: right, d: [roundArch(264, 282, 218, 236)] },
      { sil: wall, d: [dot(130, 268, 4), dot(270, 268, 4), dot(150, 284, 3), dot(250, 284, 3)] },
    ]),
    free([smooth([[16, 300], [100, 296], [200, 302], [300, 296], [384, 300]], false)], [waves(24, 376, 346, 44, 8), petal(140, 330, -30, 20, 8), tuft(370, 300, 0.6)]),
  );
}

function sunCloudsArt(): Art {
  const sun = circle(156, 150, 74);
  const rays: string[] = [];
  for (let i = 0; i < 12; i++) rays.push(petal(...polar(156, 150, 84, i * 30), i * 30, 34, 10, 0.3));
  const big = cloud(256, 258, 230);
  const small = cloud(318, 90, 110);
  return join(
    layered([
      { sil: big, d: [happyEye(226, 262, 12), happyEye(286, 262, 12), smile(256, 280, 18, 0.5)] },
      { sil: sun, d: [happyEye(128, 140, 13), happyEye(184, 140, 13), smile(156, 166, 28, 0.5), circle(112, 172, 9), circle(200, 172, 9)] },
      ...rays.map((r) => ({ sil: r })),
      { sil: small },
    ]),
    free([], [sparkle(70, 330, 10), sparkle(360, 190, 9), sparkle(40, 60, 8)]),
  );
}

function blockTowerArt(): Art {
  const base = rrect(84, 292, 232, 48, 6);
  const arch = 'M 108 292 L 108 232 L 292 232 L 292 292 L 242 292 A 42 42 0 0 0 158 292 Z';
  const col = (x: number) => rrect(x, 170, 50, 62, 4);
  const plank = rrect(100, 150, 200, 20, 4);
  const roof = poly([[132, 150], [200, 70], [268, 150]]);
  const ball = circle(348, 316, 24);
  const cube = rrect(28, 290, 50, 50, 5);
  return join(
    layered([
      { sil: roof, d: [softStar(200, 120, 16, 7, 5, 1.5)] },
      { sil: plank, d: [line(116, 160, 140, 160), line(262, 160, 284, 160)] },
      { sil: col(122), d: [circle(147, 201, 12)] },
      { sil: col(228), d: [poly([[253, 188], [266, 212], [240, 212]])] },
      { sil: arch, d: [line(124, 252, 150, 252), line(250, 252, 276, 252)] },
      { sil: base, d: [line(100, 316, 150, 316), line(250, 316, 300, 316), circle(200, 316, 10)] },
      { sil: ball, d: ['M 326 306 Q 348 296 370 306', 'M 330 330 Q 348 338 366 330'] },
      { sil: cube, d: [rrect(38, 300, 30, 30, 4)] },
    ]),
    free(['M 16 340 L 384 340'], [sparkle(70, 120, 10), sparkle(330, 120, 10)]),
  );
}

function teddyArt(): Art {
  const head = circle(200, 136, 72);
  const ears = [circle(138, 82, 28), circle(262, 82, 28)];
  const muzzle = ellipse(200, 164, 34, 26);
  const body = ellipse(200, 268, 80, 82);
  const armL = limb([146, 228], [114, 282], 19, 17);
  const armR = mirrorX(armL, 200);
  const footL = ellipse(140, 332, 40, 30);
  const footR = ellipse(260, 332, 40, 30);
  const bow = [poly([[200, 214], [168, 198], [168, 230]]), poly([[200, 214], [232, 198], [232, 230]]), circle(200, 214, 9)];
  const patch = rotate(rrect(204, 262, 36, 36, 6), 10, 222, 280);
  const stitch = rotate('M 210 270 L 216 270 M 224 270 L 230 270 M 210 290 L 216 290 M 224 290 L 230 290', 10, 222, 280);
  return join(
    layered([
      { sil: bow[2] },
      { sil: [bow[0], bow[1]] },
      { sil: footL, p: [ellipse(140, 336, 20, 15)] },
      { sil: footR, p: [ellipse(260, 336, 20, 15)] },
      { sil: muzzle, p: [ellipse(200, 152, 12, 8)], d: ['M 200 160 L 200 172 Q 190 182 182 176 M 200 172 Q 210 182 218 176'] },
      { sil: head, d: [dot(172, 122, 7), dot(228, 122, 7)] },
      { sil: ears[0], p: [circle(138, 82, 14)] },
      { sil: ears[1], p: [circle(262, 82, 14)] },
      { sil: armL, d: [ellipse(114, 286, 8, 7)] },
      { sil: armR, d: [ellipse(286, 286, 8, 7)] },
      { sil: patch, d: [stitch] },
      { sil: body, d: [ellipse(180, 284, 30, 38)] },
    ]),
    free([], [sparkle(70, 200, 10), sparkle(332, 200, 9)]),
  );
}

function xyzBlocksArt(): Art {
  const d = 30;
  const s = 112;
  const cube = (x: number, y: number, letter: string): Item => {
    const hex = poly([[x, y + s], [x, y], [x + d, y - d], [x + s + d, y - d], [x + s + d, y + s - d], [x + s, y + s]]);
    const edges = `M ${x} ${y} L ${x + s} ${y} L ${x + s} ${y + s} M ${x + s} ${y} L ${x + s + d} ${y - d}`;
    const cx = x + s / 2;
    const cy = y + s / 2;
    const g = 28;
    const glyph =
      letter === 'X'
        ? `M ${cx - g} ${cy - g} L ${cx + g} ${cy + g} M ${cx + g} ${cy - g} L ${cx - g} ${cy + g}`
        : letter === 'Y'
          ? `M ${cx - g} ${cy - g} L ${cx} ${cy} L ${cx + g} ${cy - g} M ${cx} ${cy} L ${cx} ${cy + g}`
          : `M ${cx - g} ${cy - g} L ${cx + g} ${cy - g} L ${cx - g} ${cy + g} L ${cx + g} ${cy + g}`;
    return {
      sil: hex,
      p: [edges, glyph],
      d: [rrect(x + 10, y + 10, s - 20, s - 20, 8), poly([[x + s + 8, y - 2], [x + s + d - 6, y - d + 12], [x + s + d - 6, y + s - d - 6], [x + s + 8, y + s - 10]]), softStar(x + s / 2 + d / 2, y - d / 2, 9, 4, 5, 1)],
    };
  };
  return join(
    layered([cube(138, 116, 'Z'), cube(66, 228, 'X'), cube(196, 228, 'Y')]),
    free(['M 24 340 L 376 340'], [sparkle(60, 120, 11), sparkle(350, 110, 9)]),
  );
}

function rockingHorseArt(): Art {
  const rocker = 'M 40 300 Q 200 372 360 300 Q 364 290 354 292 Q 200 352 46 292 Q 36 290 40 300 Z';
  const body = smooth([[110, 196], [170, 178], [250, 180], [290, 196], [292, 232], [250, 250], [160, 250], [112, 236]]);
  const head = smooth([[256, 196], [264, 140], [284, 96], [314, 76], [346, 90], [372, 124], [370, 146], [346, 152], [318, 140], [304, 180], [294, 208]]);
  const ear = petal(300, 88, -15, 30, 9);
  const legs = [limb([140, 236], [110, 316], 13, 10), limb([170, 240], [168, 322], 12, 10), limb([250, 240], [256, 322], 12, 10), limb([276, 230], [304, 314], 13, 10)];
  const mane = smooth([[262, 150], [270, 108], [292, 82], [270, 76], [256, 92], [244, 96], [242, 120], [232, 128], [236, 152], [228, 164], [238, 184], [262, 200]]);
  const tail = smooth([[112, 204], [80, 200], [60, 230], [64, 270], [84, 250], [100, 228], [114, 220]]);
  const saddle = 'M 176 182 Q 206 170 236 182 L 240 214 Q 206 226 172 214 Z';
  const handle = rrect(270, 122, 64, 10, 5);
  return join(
    layered([
      { sil: ear },
      { sil: head, d: [dot(322, 102, 5.5), dot(360, 124, 3), smile(350, 138, 9, 0.4)] },
      { sil: handle },
      { sil: mane, d: ['M 266 120 Q 262 150 266 180'] },
      { sil: saddle, d: [line(206, 214, 206, 248), rrect(198, 248, 16, 10, 3)] },
      { sil: body },
      { sil: tail, d: ['M 84 214 Q 72 236 76 256'] },
      { sil: legs[3] },
      { sil: legs[0] },
      { sil: rocker },
      { sil: legs[2] },
      { sil: legs[1] },
    ]),
    free([], [sparkle(70, 110, 11), sparkle(180, 90, 8), sparkle(360, 220, 8)]),
  );
}

// ================================================================================================================
// FANTASY
// ================================================================================================================


function moonFaceArt(): Art {
  const inner = smooth([[240, 356], [204, 330], [190, 300], [206, 284], [194, 274], [206, 262], [190, 250], [196, 234], [224, 216], [196, 202], [180, 172], [178, 122], [198, 80], [240, 44]], false);
  const moon = `M 240 44 C 120 52 54 128 54 204 C 54 288 128 352 240 356 ${inner.replace(/^M [^C]+/, '')} Z`;
  const zee = (x: number, y: number, s: number) => `M ${x} ${y} L ${x + s} ${y} L ${x} ${y + s} L ${x + s} ${y + s}`;
  return join(
    layered([{ sil: moon, d: ['M 128 184 Q 146 198 166 186', line(134, 190, 128, 200), line(146, 196, 144, 206), line(158, 194, 160, 204), circle(150, 244, 14), 'M 92 120 Q 104 96 128 82'] }]),
    free(
      [softStar(310, 110, 26, 11, 5, 3), softStar(326, 236, 18, 8, 5, 2), softStar(272, 324, 14, 6, 5, 2)],
      [zee(256, 160, 14), zee(282, 136, 18), sparkle(344, 330, 10), sparkle(360, 170, 8), sparkle(270, 60, 9), dot(240, 274, 3), dot(360, 60, 3)],
    ),
  );
}

function mushroomRingArt(): Art {
  const shroom = (x: number, by: number, sc: number, k: number): Item => {
    const stem = `M ${f(x - 12 * sc)} ${f(by)} L ${f(x - 9 * sc)} ${f(by - 40 * sc)} L ${f(x + 9 * sc)} ${f(by - 40 * sc)} L ${f(x + 12 * sc)} ${f(by)} Q ${f(x)} ${f(by + 5 * sc)} ${f(x - 12 * sc)} ${f(by)} Z`;
    const cap = `M ${f(x - 42 * sc)} ${f(by - 36 * sc)} Q ${f(x - 42 * sc)} ${f(by - 84 * sc)} ${f(x)} ${f(by - 86 * sc)} Q ${f(x + 42 * sc)} ${f(by - 84 * sc)} ${f(x + 42 * sc)} ${f(by - 36 * sc)} Q ${f(x)} ${f(by - 26 * sc)} ${f(x - 42 * sc)} ${f(by - 36 * sc)} Z`;
    const spots = [circle(x - 18 * sc, by - 58 * sc, 7 * sc), circle(x + 10 * sc, by - 68 * sc, 6 * sc), circle(x + 24 * sc, by - 46 * sc, 5 * sc)].slice(0, 2 + (k % 2));
    return { sil: [cap, stem], d: [inside(spots.join(' '), cap)] };
  };
  const items: { y: number; it: Item }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 + 10) * Math.PI) / 180;
    const x = 200 + Math.cos(a) * 148;
    const y = 270 + Math.sin(a) * 70;
    const sc = (0.36 + 0.44 * ((Math.sin(a) + 1) / 2)) * (i % 2 ? 0.78 : 1);
    items.push({ y, it: shroom(x, y, sc, i) });
  }
  items.sort((a, b) => b.y - a.y);
  return join(
    layered(items.map((x) => x.it)),
    free([crescent(320, 74, 32, 338, 62, 28)], [sparkle(200, 220, 14), sparkle(160, 180, 8), sparkle(244, 170, 9), dot(180, 250, 3), dot(226, 240, 3), dot(200, 150, 3), dot(90, 90, 3), sparkle(70, 120, 9), tuft(60, 360, 0.9), tuft(340, 360, 0.9), tuft(200, 344, 0.7)]),
  );
}

function fairyLanternArt(): Art {
  const branch = limb([34, 66], [366, 94], 11, 7);
  const leafAt: [number, number, number, number][] = [[90, 72, 200, 46], [130, 74, 20, 40], [290, 86, 160, 44], [330, 90, 30, 38]];
  const leaves = leafAt.map(([x, y, d, l]) => petal(x, y, d, l, l * 0.3));
  const lid = rrect(146, 132, 108, 22, 6);
  const jar = 'M 160 154 L 160 170 Q 118 188 118 242 L 118 312 Q 118 342 150 342 L 250 342 Q 282 342 282 312 L 282 242 Q 282 188 240 170 L 240 154 Z';
  const fairy = [circle(200, 222, 12), poly([[200, 236], [180, 284], [220, 284]])];
  const wings = [petal(198, 246, -55, 44, 14), petal(202, 246, 55, 44, 14), petal(198, 252, -120, 30, 10), petal(202, 252, 120, 30, 10)];
  const glow: string[] = [];
  for (const deg of [-110, -80, 80, 110, -140, 140]) {
    const a = polar(200, 260, 104, deg);
    const b = polar(200, 260, 124, deg);
    glow.push(line(a[0], a[1], b[0], b[1]));
  }
  return join(
    layered([
      ...leaves.map((l, i) => {
        const [bx, by, deg, len] = leafAt[i];
        const tip = polar(bx, by, len * 0.8, deg);
        return { sil: l, d: [line(bx, by, tip[0], tip[1])] };
      }),
      { sil: branch, d: ['M 60 70 L 110 74', 'M 240 86 L 300 90'] },
      { sil: '', p: ['M 152 142 Q 200 70 248 142'] },
      { sil: lid, d: [line(156, 143, 244, 143)] },
      { sil: fairy, d: ['M 190 252 L 172 238', 'M 210 252 L 230 236', line(194, 284, 192, 300), line(206, 284, 208, 300)] },
      { sil: wings },
      { sil: jar, p: [line(160, 170, 240, 170)], d: ['M 136 220 Q 132 250 136 290', sparkle(150, 300, 8), sparkle(252, 206, 7), dot(244, 312, 3), dot(162, 200, 2.5), dot(258, 270, 3)] },
    ]),
    free([], [...glow, sparkle(70, 220, 10), sparkle(330, 220, 10), sparkle(330, 330, 8)]),
  );
}

function moonArchArt(): Art {
  const outer = roundArch(64, 336, 196, 360);
  const inner = roundArch(92, 308, 196, 340);
  const band = `${outer} ${inner}`;
  const bandStars: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const [x, y] = polar(200, 196, 122, -90 + i * 22.5);
    bandStars.push(softStar(x, y, 7, 3, 5, 0.8));
  }
  const moon = crescent(176, 196, 64, 210, 174, 56);
  const clouds = [cloud(150, 318, 120), cloud(258, 324, 110)];
  return join(
    layered([
      { sil: clouds[0] },
      { sil: clouds[1] },
      { sil: moon, d: ['M 132 236 Q 140 254 158 260', circle(140, 196, 6)] },
      { sil: softStar(250, 150, 16, 7, 5, 2) },
      { sil: softStar(270, 228, 11, 5, 5, 1.5) },
      { sil: '', p: [line(250, 134, 250, 80), line(270, 217, 270, 120)] },
      { sil: band, p: [line(92, 340, 308, 340)], d: [...bandStars, line(64, 300, 92, 300), line(308, 300, 336, 300)] },
    ]),
    free(['M 30 360 L 370 360'], [sparkle(40, 120, 9), sparkle(366, 110, 8), sparkle(200, 110, 6)]),
  );
}

function swordStoneArt(): Art {
  const rock = smooth([[54, 340], [70, 290], [120, 258], [190, 246], [260, 252], [320, 280], [348, 340]]);
  const blade = 'M 188 150 L 188 280 L 212 280 L 212 150 Z';
  const guard = 'M 140 132 Q 126 132 128 144 Q 132 154 144 150 L 256 150 Q 268 154 272 144 Q 274 132 260 132 Z';
  const grip = rrect(191, 70, 18, 62, 4);
  const pommel = circle(200, 60, 13);
  return join(
    layered([
      { sil: pommel, d: [softStar(200, 60, 6, 3, 4, 0.5)] },
      { sil: guard, d: [circle(200, 141, 5)] },
      { sil: grip, d: ['M 191 82 L 209 90 M 191 96 L 209 104 M 191 110 L 209 118 M 191 124 L 209 132'] },
      { sil: rock, p: ['M 54 340 L 348 340'], d: ['M 110 290 L 130 304 L 126 324', 'M 280 286 L 268 302 L 284 316', 'M 176 262 Q 200 270 224 262', 'M 230 310 Q 250 300 270 312'] },
      { sil: blade, p: [line(200, 158, 200, 280)] },
    ]),
    free([], [sparkle(140, 90, 12), sparkle(266, 82, 10), sparkle(300, 180, 8), sparkle(100, 190, 8), tuft(44, 340), tuft(360, 340), tuft(150, 340, 0.6), petal(330, 340, -20, 22, 7), petal(334, 340, 30, 20, 6)]),
  );
}

function spellbookArt(): Art {
  const pages = rrect(118, 82, 206, 268, 8);
  const cover = rrect(100, 66, 210, 270, 10);
  const strap = rrect(286, 182, 52, 34, 6);
  const emblem = circle(214, 196, 50);
  const corner = (x: number, y: number, sx: number, sy: number) => poly([[x, y], [x + 30 * sx, y], [x, y + 30 * sy]]);
  const pageLines = [96, 112].map((d) => `M ${310} ${66 + d * 0 + 20} L ${310} ${336}`);
  return join(
    layered([
      { sil: strap, p: [circle(322, 199, 7)] },
      { sil: corner(104, 70, 1, 1) },
      { sil: corner(306, 70, -1, 1) },
      { sil: corner(104, 332, 1, -1) },
      { sil: corner(306, 332, -1, -1) },
      { sil: emblem, p: [crescent(206, 196, 30, 222, 186, 26)], d: [softStar(232, 206, 9, 4, 5, 1), circle(214, 196, 42)] },
      { sil: cover, p: [rrect(134, 92, 152, 218, 6)], d: [line(122, 66, 122, 336), line(100, 110, 122, 110), line(100, 292, 122, 292), sparkle(214, 116, 8), sparkle(214, 276, 8)] },
      { sil: pages, d: [line(318, 96, 318, 340), line(132, 344, 316, 344), ...pageLines.slice(0, 0)] },
    ]),
    free([], [sparkle(60, 100, 11), sparkle(352, 100, 9), sparkle(60, 300, 8)]),
  );
}

function dragonHatchlingArt(): Art {
  const head = smooth([[146, 154], [150, 104], [196, 82], [250, 92], [286, 128], [300, 160], [280, 182], [228, 190], [170, 188]]);
  const body = smooth([[170, 180], [236, 180], [262, 240], [258, 308], [200, 330], [144, 310], [138, 240]]);
  const belly = ellipse(200, 270, 34, 50);
  const wingL = 'M 150 220 Q 92 180 74 216 Q 92 220 92 240 Q 108 236 116 254 Q 128 244 144 254 Z';
  const wingR = mirrorX(wingL, 200);
  const tail = 'M 240 312 Q 300 330 320 300 Q 330 280 316 262 L 334 258 L 324 240 L 304 260 Q 316 282 300 302 Q 284 316 246 296 Z';
  const footL = ellipse(166, 330, 30, 18);
  const footR = ellipse(234, 330, 30, 18);
  const hornL = petal(180, 92, -30, 34, 9);
  const hornR = petal(236, 92, 24, 34, 9);
  return join(
    layered([
      { sil: footL, d: ['M 152 334 L 152 344 M 166 336 L 166 348 M 180 334 L 180 344'] },
      { sil: footR, d: ['M 220 334 L 220 344 M 234 336 L 234 348 M 248 334 L 248 344'] },
      { sil: head, p: [circle(196, 136, 16), circle(248, 136, 16)], d: [dot(200, 138, 7), dot(252, 138, 7), ellipse(276, 156, 3, 4), smile(230, 168, 20, 0.35)] },
      { sil: hornL },
      { sil: hornR },
      { sil: belly, d: [inside([240, 256, 272, 288, 304].map((y) => line(150, y, 250, y)).join(' '), belly)] },
      { sil: body },
      { sil: limb([170, 222], [160, 252], 9, 8) },
      { sil: wingL },
      { sil: wingR },
      { sil: tail },
    ]),
    free(['M 40 348 L 360 348'], [sparkle(80, 110, 11), sparkle(330, 80, 9), sparkle(340, 200, 8), tuft(60, 348), tuft(350, 348, 0.8)]),
  );
}

function potionShelfArt(): Art {
  const shelf1 = rrect(36, 178, 328, 14, 3);
  const shelf2 = rrect(36, 318, 328, 14, 3);
  const bracket = (x: number, y: number) => `M ${x} ${y} L ${x} ${y + 34} Q ${x + 4} ${y + 6} ${x + 30} ${y} Z`;
  const brR = (x: number, y: number) => mirrorX(bracket(x, y), x);
  // top shelf
  const flask = [circle(96, 144, 32), R(86, 96, 20, 24), rrect(80, 88, 32, 10, 3)];
  const cork1 = rrect(88, 72, 16, 18, 3);
  const tall = 'M 146 178 L 146 104 Q 146 92 158 88 L 158 64 L 178 64 L 178 88 Q 190 92 190 104 L 190 178 Z';
  const cork2 = rrect(160, 50, 16, 16, 3);
  const jar = rrect(210, 108, 62, 70, 10);
  const jarLid = rrect(206, 96, 70, 14, 5);
  const vial = 'M 296 178 L 296 120 L 308 120 L 308 104 L 320 104 L 320 120 L 332 120 L 332 178 Z';
  // bottom shelf
  const books = [rrect(52, 276, 110, 20, 3), rrect(60, 256, 96, 20, 3), rrect(48, 296, 120, 22, 3)];
  const candle = rrect(186, 252, 22, 66, 4);
  const flame = petal(197, 250, 0, 26, 8, 0.3);
  const cone = 'M 246 244 L 246 266 L 222 318 L 300 318 L 276 266 L 276 244 Z';
  const round2 = [circle(334, 290, 26), R(326, 250, 16, 18)];
  const cork3 = rrect(326, 238, 16, 14, 3);
  const web = ['M 24 24 L 24 120', 'M 24 24 L 70 108', 'M 24 24 L 104 72', 'M 24 24 L 116 24', 'M 24 56 Q 38 54 42 58 Q 50 46 56 42 Q 54 34 58 24', 'M 24 88 Q 48 84 56 92 Q 70 70 86 62 Q 86 44 92 24'];
  return join(
    layered([
      { sil: cork1 },
      { sil: flask, d: [inside('M 60 150 Q 78 140 96 150 Q 114 160 132 150', circle(96, 144, 32)), circle(90, 162, 4), circle(108, 156, 3)] },
      { sil: cork2 },
      { sil: tall, d: [rrect(152, 118, 32, 36, 4), softStar(168, 136, 9, 4, 5, 1)] },
      { sil: jarLid },
      { sil: jar, d: ['M 216 136 L 266 136', circle(230, 156, 6), circle(250, 162, 8), circle(240, 122, 2)] },
      { sil: vial, d: ['M 296 150 Q 314 144 332 150', dot(310, 164, 3)] },
      { sil: flame, d: [petal(197, 248, 0, 12, 3, 0.3)] },
      { sil: candle, p: ['M 186 268 Q 180 280 184 290'], d: [line(197, 250, 197, 254)] },
      { sil: cone, d: ['M 232 296 Q 248 290 261 296 Q 274 302 290 296', dot(256, 306, 3), dot(264, 280, 2.5)] },
      { sil: cork3 },
      { sil: round2, d: [inside('M 300 292 Q 318 284 334 292 Q 350 300 368 292', circle(334, 290, 26))] },
      { sil: books[1], d: [line(70, 266, 140, 266)] },
      { sil: books[0], d: [line(64, 286, 150, 286)] },
      { sil: books[2], d: [line(60, 307, 156, 307)] },
      { sil: shelf1 },
      { sil: shelf2 },
      { sil: bracket(60, 192) },
      { sil: brR(340, 192) },
      { sil: bracket(60, 332) },
      { sil: brR(340, 332) },
    ]),
    free([], [...web, sparkle(250, 50, 9), sparkle(350, 70, 8), sparkle(120, 220, 7), sparkle(330, 220, 7)]),
  );
}

/** Front-facing skull centred on (cx, cy) at scale s; returns the head, sockets, nose and jaw items. */
function skull(cx: number, cy: number, s: number): Item[] {
  const q = (x: number, y: number): P => [cx + (x - 200) * s, cy + (y - 170) * s];
  const sm = (pts: P[]) => smooth(pts.map(([x, y]) => q(x, y)));
  const head = sm([[118, 160], [124, 102], [160, 62], [200, 54], [240, 62], [276, 102], [282, 160], [268, 202], [250, 212], [246, 232], [154, 232], [150, 212], [132, 202]]);
  const sockL = sm([[146, 150], [170, 136], [192, 150], [186, 182], [158, 184]]);
  const sockR = sm([[254, 150], [230, 136], [208, 150], [214, 182], [242, 184]]);
  const p = (x: number, y: number) => `${f(q(x, y)[0])} ${f(q(x, y)[1])}`;
  const nose = `M ${p(200, 188)} Q ${p(186, 210)} ${p(190, 216)} Q ${p(198, 214)} ${p(200, 208)} Q ${p(202, 214)} ${p(210, 216)} Q ${p(214, 210)} ${p(200, 188)} Z`;
  const jaw = `M ${p(156, 230)} Q ${p(158, 270)} ${p(200, 274)} Q ${p(242, 270)} ${p(244, 230)} Z`;
  const teeth: string[] = [];
  for (let x = 168; x <= 232; x += 13) teeth.push(`M ${p(x, 232)} L ${p(x, 256)}`);
  return [
    { sil: sockL },
    { sil: sockR },
    { sil: nose },
    { sil: jaw, p: [`M ${p(160, 246)} Q ${p(200, 252)} ${p(240, 246)}`], d: teeth },
    { sil: head, d: [`M ${p(230, 70)} L ${p(222, 92)} L ${p(234, 104)}`, `M ${p(134, 180)} Q ${p(146, 196)} ${p(160, 198)}`, `M ${p(266, 180)} Q ${p(254, 196)} ${p(240, 198)}`] },
  ];
}

function rose(cx: number, cy: number, r: number): Item {
  const pts: P[] = [];
  for (let i = 0; i < 10; i++) pts.push(polar(cx, cy, r * (i % 2 ? 0.86 : 1), i * 36));
  const sp = (k: number) => polar(cx, cy, r * k, 0);
  return {
    sil: smooth(pts),
    d: [
      `M ${f(cx - r * 0.2)} ${f(cy)} Q ${f(cx - r * 0.2)} ${f(cy - r * 0.3)} ${f(cx + r * 0.1)} ${f(cy - r * 0.28)} Q ${f(cx + r * 0.36)} ${f(cy - r * 0.2)} ${f(cx + r * 0.3)} ${f(cy + r * 0.1)} Q ${f(cx + r * 0.2)} ${f(cy + r * 0.44)} ${f(cx - r * 0.2)} ${f(cy + r * 0.4)} Q ${f(cx - r * 0.56)} ${f(cy + r * 0.3)} ${f(cx - r * 0.52)} ${f(cy - r * 0.1)} Q ${f(cx - r * 0.46)} ${f(cy - r * 0.56)} ${f(cx + r * 0.04)} ${f(cy - r * 0.6)}`,
      `M ${f(cx - r * 0.86)} ${f(cy + r * 0.1)} Q ${f(cx - r * 0.7)} ${f(cy + r * 0.74)} ${f(cx)} ${f(cy + r * 0.74)} Q ${f(cx + r * 0.62)} ${f(cy + r * 0.7)} ${f(cx + r * 0.8)} ${f(cy + r * 0.2)}`,
      `M ${f(sp(0.62)[0] + r * 0.3)} ${f(sp(0.62)[1])} Q ${f(cx + r * 0.7)} ${f(cy - r * 0.5)} ${f(cx + r * 0.72)} ${f(cy - r * 0.1)}`,
    ],
  };
}

function skullRosesArt(): Art {
  const leaf = (x: number, y: number, deg: number, len: number): Item => {
    const tip = polar(x, y, len * 0.8, deg);
    return { sil: petal(x, y, deg, len, len * 0.3), d: [line(x, y, tip[0], tip[1])] };
  };
  return join(
    layered([
      rose(200, 300, 46),
      rose(116, 286, 40),
      rose(286, 286, 40),
      leaf(150, 324, 230, 54),
      leaf(252, 324, 130, 54),
      leaf(80, 300, 250, 44),
      leaf(322, 300, 110, 44),
      leaf(170, 260, 300, 40),
      leaf(232, 260, 60, 40),
      ...skull(200, 160, 0.92),
    ]),
    free([], [sparkle(60, 80, 10), sparkle(344, 90, 9), sparkle(60, 200, 7), sparkle(350, 200, 7)]),
  );
}

function ravenSkullArt(): Art {
  const head = circle(158, 112, 26);
  const beak = 'M 140 100 Q 118 102 96 116 Q 120 120 142 124 Z';
  const body = smooth([[146, 126], [184, 124], [228, 146], [262, 182], [336, 222], [328, 234], [262, 218], [212, 212], [174, 198], [148, 166]]);
  const wing = smooth([[178, 144], [226, 150], [270, 184], [306, 214], [240, 208], [192, 190]]);
  const legs = 'M 196 206 L 194 226 M 214 210 L 214 230';
  const toes = 'M 194 226 L 182 232 M 194 226 L 198 236 M 214 230 L 204 236 M 214 230 L 222 238';
  return join(
    layered([
      { sil: beak, d: ['M 140 112 L 104 116'] },
      { sil: head, d: [dot(154, 106, 4.5), 'M 172 96 Q 182 106 180 124'] },
      { sil: wing, d: ['M 210 170 Q 240 180 270 200', 'M 222 186 Q 250 196 280 210', 'M 196 160 Q 230 166 260 186'] },
      { sil: body, d: ['M 160 150 Q 168 170 182 180', 'M 290 206 L 330 228', 'M 290 214 L 322 232'] },
      { sil: '', p: [legs, toes] },
      ...skull(200, 294, 0.8),
    ]),
    free([crescent(318, 84, 40, 336, 70, 34)], [sparkle(70, 70, 10), sparkle(260, 60, 8), sparkle(360, 180, 7), dot(80, 200, 3), 'M 30 376 L 370 376']),
  );
}

/** Invented rune glyph number k centred at (x, y), size s, turned by deg. */
function glyph(k: number, x: number, y: number, s: number, deg: number): string {
  const q = (px: number, py: number) => `${f(x + px * s)} ${f(y + py * s)}`;
  const g = [
    `M ${q(0, -1)} L ${q(0, 1)} M ${q(0, -0.3)} L ${q(0.6, -0.9)} M ${q(0, 0.3)} L ${q(-0.6, 0.9)}`,
    `M ${q(-0.6, 1)} L ${q(0, -1)} L ${q(0.6, 1)} M ${q(-0.3, 0.2)} L ${q(0.3, 0.2)}`,
    `M ${q(-0.5, -1)} L ${q(-0.5, 1)} M ${q(-0.5, -1)} L ${q(0.5, -0.4)} L ${q(-0.5, 0.2)}`,
    `M ${q(0, -1)} L ${q(0, 1)} M ${q(-0.6, -0.6)} L ${q(0.6, 0.6)}`,
    `M ${q(-0.5, 1)} L ${q(-0.5, -1)} L ${q(0.5, -0.2)} L ${q(0.5, 1)}`,
    `M ${q(0, -1)} L ${q(0.6, 0)} L ${q(0, 1)} L ${q(-0.6, 0)} Z`,
    `M ${q(-0.6, -1)} L ${q(0.6, 1)} M ${q(0.6, -1)} L ${q(0, 0)}`,
    `M ${q(0, -1)} L ${q(0, 1)} M ${q(-0.6, -1)} L ${q(0, -0.4)} L ${q(0.6, -1)}`,
  ][k % 8];
  return rotate(g, deg, x, y);
}

function runicCircleArt(): Art {
  const ring = [circle(200, 200, 170), circle(200, 200, 146), circle(200, 200, 112), circle(200, 200, 46)];
  const glyphs: string[] = [];
  for (let i = 0; i < 16; i++) {
    const [x, y] = polar(200, 200, 158, i * 22.5);
    glyphs.push(glyph(i * 3, x, y, 8, i * 22.5));
  }
  const pts: P[] = [];
  for (let i = 0; i < 7; i++) pts.push(polar(200, 200, 112, (i * 3 * 360) / 7));
  const heptagram = poly(pts);
  const nodes = [];
  for (let i = 0; i < 7; i++) nodes.push(polar(200, 200, 112, (i * 360) / 7));
  const innerGlyphs: string[] = [];
  for (let i = 0; i < 7; i++) {
    const [x, y] = polar(200, 200, 70, (i * 360) / 7 + 360 / 14);
    innerGlyphs.push(glyph(i + 2, x, y, 7, (i * 360) / 7 + 360 / 14));
  }
  return join(
    layered([
      ...nodes.map(([x, y]) => ({ sil: circle(x, y, 12), d: [circle(x, y, 4)] })),
      { sil: '', p: [heptagram] },
    ]),
    free([...ring], [...glyphs, ...innerGlyphs, circle(200, 200, 176), sparkle(200, 200, 24), circle(200, 200, 34)]),
  );
}

function hauntedHouseArt(): Art {
  const hill = 'M 16 330 Q 120 280 220 290 Q 320 300 384 270';
  const moon = circle(296, 94, 52);
  const main = R(150, 190, 140, 112);
  const roof = 'M 136 194 L 214 118 L 304 196 Z';
  const tower = R(96, 160, 56, 142);
  const towerRoof = 'M 86 164 Q 112 120 118 58 Q 132 120 162 164 Z';
  const chimney = rotate(R(254, 116, 22, 50), 6, 265, 140);
  const door = roundArch(204, 236, 254, 302);
  const win = (x: number, y: number, w: number, h: number) => pointed(x, x + w, y + w / 2, y + h, w * 0.9);
  const fence = (x: number) => poly([[x, 352], [x, 316], [x + 6, 306], [x + 12, 316], [x + 12, 352]]);
  const bat = (x: number, y: number, s: number) => {
    const q = (px: number, py: number) => `${f(x + px * s)} ${f(y + py * s)}`;
    return `M ${q(0, 0)} Q ${q(-8, -10)} ${q(-22, -8)} Q ${q(-18, -2)} ${q(-20, 4)} Q ${q(-12, 0)} ${q(-8, 6)} Q ${q(-4, 2)} ${q(0, 6)} Q ${q(4, 2)} ${q(8, 6)} Q ${q(12, 0)} ${q(20, 4)} Q ${q(18, -2)} ${q(22, -8)} Q ${q(8, -10)} ${q(0, 0)} Z`;
  };
  const tree = [limb([340, 300], [336, 196], 11, 6), limb([338, 236], [370, 196], 5, 3), limb([337, 216], [306, 178], 5, 3), limb([336, 200], [346, 156], 4, 2.5)];
  const boards = 'M 160 262 L 194 282 M 160 280 L 194 262';
  return join(
    layered([
      ...[60, 84, 300, 324].map((x) => ({ sil: fence(x) })),
      { sil: tree },
      { sil: door, d: [circle(228, 280, 3)] },
      { sil: win(160, 210, 30, 44), p: [line(175, 214, 175, 254)] },
      { sil: win(250, 210, 30, 44), p: [line(265, 214, 265, 254)] },
      { sil: win(112, 186, 24, 40), d: [line(124, 194, 124, 226)] },
      { sil: win(112, 246, 24, 40), d: [boards.replace(/160/g, '112').replace(/194/g, '136').replace(/262/g, '250').replace(/282/g, '276').replace(/280/g, '272')] },
      { sil: circle(214, 162, 14), d: [line(214, 148, 214, 176), line(200, 162, 228, 162)] },
      { sil: R(160, 262, 34, 24), d: [boards] },
      { sil: main },
      { sil: roof, d: ['M 170 172 L 196 172 M 236 168 L 262 168'] },
      { sil: towerRoof },
      { sil: tower, d: [line(96, 236, 152, 236)] },
      { sil: chimney },
      { sil: '', p: [hill], d: [line(54, 334, 112, 334), 'M 230 330 Q 250 326 270 330', tuft(180, 340, 0.7), tuft(360, 320, 0.7)] },
      { sil: moon },
    ]),
    free([bat(80, 80, 1.2), bat(200, 70, 0.9), bat(350, 180, 0.8)], [sparkle(40, 150, 8), sparkle(370, 40, 8), dot(160, 40, 3)]),
  );
}

function wizardTowerArt(): Art {
  const tower = 'M 150 334 L 162 150 L 238 150 L 250 334 Z';
  const balcony = rrect(138, 136, 124, 16, 4);
  const roof = 'M 146 138 Q 176 110 190 62 Q 198 36 216 24 Q 210 52 222 82 Q 236 116 254 138 Z';
  const turret = R(246, 218, 42, 116);
  const turretRoof = 'M 238 222 L 267 160 L 296 222 Z';
  const win1 = pointed(186, 214, 196, 238, 24);
  const win2 = pointed(206, 226, 270, 296, 18);
  const win3 = pointed(258, 276, 250, 274, 16);
  const door = roundArch(180, 220, 300, 334);
  const rocks = [smooth([[40, 376], [52, 338], [110, 326], [170, 332], [176, 376]]), smooth([[150, 376], [170, 340], [240, 330], [320, 336], [360, 376]])];
  const steps = [rrect(172, 334, 56, 10, 3), rrect(164, 344, 72, 10, 3)];
  let blocks = '';
  for (let y = 168, k = 0; y < 334; y += 18, k++) {
    blocks += `M 140 ${y} L 260 ${y} `;
    for (let x = 170 + (k % 2) * 18; x < 240; x += 36) blocks += `M ${x} ${y} L ${x} ${y + 18} `;
  }
  let shingles = '';
  for (let y = 120, k = 0; y > 50; y -= 14, k++) for (let x = 140 + (k % 2) * 9; x < 260; x += 18) shingles += `M ${x} ${y} Q ${x + 9} ${y + 10} ${x + 18} ${y} `;
  const corbels: string[] = [];
  for (let x = 146; x < 256; x += 18) corbels.push(`M ${x} 152 Q ${x + 9} 166 ${x + 18} 152`);
  const ivy = curve([[156, 330], [166, 300], [158, 270], [168, 240], [160, 210]]);
  const ivyLeaves = [[160, 300, -60], [166, 270, 60], [160, 244, -60], [166, 220, 50]].map(([x, y, d]) => petal(x, y, d, 16, 5));
  return join(
    layered([
      { sil: steps[0] },
      { sil: steps[1] },
      { sil: door, d: [line(193, 300, 193, 334), line(207, 300, 207, 334), circle(214, 318, 2.5)] },
      { sil: win1, p: [line(200, 186, 200, 238)], d: [line(186, 214, 214, 214)] },
      { sil: win2 },
      ...ivyLeaves.map((l) => ({ sil: l })),
      { sil: '', p: [ivy] },
      { sil: balcony, d: [line(144, 144, 256, 144)] },
      { sil: roof, d: [inside(shingles, roof), softStar(196, 104, 8, 3.5, 5, 1), crescent(220, 76, 7, 223, 73, 6)] },
      { sil: tower, d: [inside(blocks, tower), ...corbels] },
      { sil: win3 },
      { sil: turretRoof, d: ['M 252 206 L 282 206'] },
      { sil: turret, d: [inside(blocks.replace(/M 140/g, 'M 236'), turret)] },
      { sil: rocks[1], d: ['M 270 350 L 290 360', 'M 196 356 Q 210 350 224 356'] },
      { sil: rocks[0], d: ['M 80 346 L 96 356'] },
      { sil: cloud(80, 300, 100) },
      { sil: cloud(330, 280, 90) },
    ]),
    free([crescent(80, 80, 40, 96, 66, 34)], [softStar(310, 60, 12, 5, 5, 1.5), softStar(130, 46, 8, 3.5, 5, 1), sparkle(340, 150, 10), sparkle(60, 190, 9), sparkle(290, 110, 6), dot(360, 40, 3), dot(40, 140, 3), dot(110, 230, 3)]),
  );
}

function roseWindowArt(): Art {
  const outer = pointed(28, 372, 302, 372, 316);
  const inner = pointed(48, 352, 302, 352, 290);
  const cx = 200;
  const cy = 220;
  const ringO = circle(cx, cy, 124);
  const ringI = circle(cx, cy, 110);
  const lancet = pointed(189, 211, 134, 168, 20);
  const lancets: Item[] = [];
  for (let i = 0; i < 12; i++) {
    const shape = rotate(lancet, i * 30, cx, cy);
    const a = polar(cx, cy, 58, i * 30);
    const b = polar(cx, cy, 98, i * 30);
    lancets.push({ sil: shape, d: [line(a[0], a[1], b[0], b[1])] });
  }
  const oculi = Array.from({ length: 12 }, (_, i) => circle(...polar(cx, cy, 97, 15 + i * 30), 7));
  const foils = union(Array.from({ length: 6 }, (_, i) => circle(...polar(cx, cy, 18, i * 60), 12)));
  const cusps: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = polar(cx, cy, 110, i * 15);
    const b = polar(cx, cy, 110, i * 15 + 15);
    const m = polar(cx, cy, 102, i * 15 + 7.5);
    cusps.push(`M ${f(a[0])} ${f(a[1])} Q ${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}`);
  }
  // voussoir joints between the two arches, and wall courses on the jambs
  const vous: string[] = [];
  const apex = Math.acos((344 - 200) / 316);
  for (let k = 1; k < 8; k++) {
    const th = (apex * k) / 8;
    const o: P = [344 - 316 * Math.cos(th), 302 - 316 * Math.sin(th)];
    const i: P = [o[0] + 22 * Math.cos(th), o[1] + 22 * Math.sin(th)];
    vous.push(line(o[0], o[1], i[0], i[1]), line(400 - o[0], o[1], 400 - i[0], i[1]));
  }
  const courses: string[] = [];
  for (let y = 318; y < 372; y += 18) courses.push(`M 28 ${y} L 48 ${y} M 352 ${y} L 372 ${y}`);
  return join(
    layered([
      { sil: circle(cx, cy, 8) },
      { sil: foils },
      { sil: circle(cx, cy, 44) },
      ...lancets,
      ...oculi.map((o) => ({ sil: o })),
      { sil: ringI, d: cusps },
      { sil: ringO },
      { sil: rrect(60, 350, 280, 14, 3) },
      { sil: `${outer} ${inner}`, d: [...vous, ...courses] },
    ]),
    free(['M 20 376 L 380 376'], [circle(cx, cy, 52)]),
  );
}

function dragonArt(): Art {
  const torso = smooth([[160, 214], [200, 190], [250, 194], [292, 218], [306, 262], [292, 300], [240, 312], [190, 304], [160, 278], [148, 244]]);
  const neck = tube([[194, 222], [170, 190], [152, 160], [142, 130], [136, 106]], (t) => 26 - 12 * t);
  const head = smooth([[152, 94], [136, 76], [110, 76], [84, 86], [58, 98], [48, 110], [58, 122], [86, 124], [112, 132], [140, 128], [158, 112]]);
  const hornA = tube([[134, 86], [148, 64], [170, 50], [194, 48]], (t) => 8 * (1 - t) + 0.6);
  const hornB = tube([[146, 96], [166, 84], [186, 80], [204, 86]], (t) => 6 * (1 - t) + 0.6);
  const wingNear = 'M 238 212 Q 244 130 272 70 L 334 30 Q 338 70 374 86 Q 344 114 378 154 Q 334 166 350 214 Q 314 214 292 236 Z';
  const wingFar = 'M 214 206 Q 214 120 234 70 L 208 28 Q 222 62 188 86 Q 214 108 196 150 Q 216 160 222 200 Z';
  const thigh = rotate(ellipse(270, 270, 46, 34), -30, 270, 270);
  const shin = limb([280, 292], [262, 330], 15, 11);
  const foot = smooth([[236, 344], [244, 330], [266, 326], [282, 338], [276, 348]]);
  const arm = [limb([180, 258], [172, 300], 14, 10), limb([172, 300], [148, 322], 10, 9)];
  const hand = smooth([[128, 330], [134, 318], [152, 314], [164, 326], [158, 336]]);
  const tail = tube([[296, 286], [330, 312], [326, 344], [276, 358], [200, 360], [130, 352], [84, 338]], (t) => 18 - 15 * t);
  const tip = petal(86, 338, -100, 34, 12, 0.4);
  const rock = smooth([[50, 372], [60, 338], [120, 324], [210, 330], [300, 326], [352, 344], [352, 372]]);
  const spikes: string[] = [];
  const back: P[] = [[156, 124], [164, 152], [178, 180], [204, 196], [236, 194], [266, 204], [292, 222], [308, 252]];
  back.forEach(([x, y], i) => {
    const deg = [40, 50, 55, 20, 5, 15, 40, 70][i];
    spikes.push(poly([polar(x, y, 7, deg - 90), polar(x, y, 15, deg), polar(x, y, 7, deg + 90)]));
  });
  const fingers = ['M 272 70 Q 330 70 374 86', 'M 272 70 Q 330 110 378 154', 'M 272 70 Q 312 150 350 214'];
  const farFingers = ['M 234 70 Q 210 76 188 86', 'M 234 70 Q 214 110 196 150'];
  const plates = [0.2, 0.35, 0.5, 0.65, 0.8].map((t) => {
    const y = 120 + t * 110;
    return `M ${f(136 + t * 30)} ${f(y)} Q ${f(150 + t * 34)} ${f(y + 6)} ${f(164 + t * 36)} ${f(y - 4)}`;
  });
  return join(
    layered([
      { sil: head, d: ['M 60 116 Q 90 112 118 120', 'M 114 92 Q 124 86 134 92 Q 126 100 114 92 Z', dot(64, 104, 2.5), 'M 98 84 Q 108 80 116 84'] },
      { sil: hornA },
      { sil: hornB },
      { sil: neck, d: [inside(plates.join(' '), neck)] },
      { sil: hand, d: ['M 132 330 L 124 338 M 142 334 L 138 344 M 154 334 L 154 344'] },
      { sil: arm, d: ['M 168 300 Q 174 296 180 300'] },
      { sil: foot, d: ['M 240 344 L 232 352 M 254 346 L 250 356 M 268 346 L 270 356'] },
      { sil: shin },
      { sil: thigh, d: ['M 248 252 Q 262 262 270 284'] },
      { sil: torso, d: ['M 168 258 Q 200 270 224 300', 'M 176 236 Q 214 246 236 280', circle(230, 236, 3), circle(250, 226, 3), circle(214, 220, 3)] },
      ...spikes.map((sp) => ({ sil: sp })),
      { sil: tip },
      { sil: tail, d: ['M 300 300 Q 318 320 310 340'] },
      { sil: wingNear, p: fingers, d: ['M 290 120 Q 310 130 330 128', 'M 300 170 Q 320 180 340 182'] },
      { sil: wingFar, p: farFingers },
      { sil: rock, d: ['M 90 352 L 110 362', 'M 330 352 L 344 364'] },
    ]),
    free([], [sparkle(40, 50, 10), sparkle(370, 260, 8), dot(80, 200, 3), dot(56, 250, 2.5)]),
  );
}

function griffinArt(): Art {
  const body = smooth([[156, 222], [196, 200], [252, 204], [302, 206], [332, 232], [330, 268], [300, 288], [262, 270], [226, 272], [192, 280], [160, 262]]);
  const neck = smooth([[146, 130], [172, 132], [190, 176], [212, 214], [206, 254], [176, 266], [152, 236], [138, 186]]);
  const head = smooth([[164, 104], [144, 90], [118, 94], [104, 108], [100, 124], [112, 136], [132, 142], [154, 144], [172, 128]]);
  const beak = 'M 108 108 Q 84 108 70 126 Q 76 142 92 142 Q 88 132 102 130 Q 100 120 108 108 Z';
  const tufts = [petal(162, 100, 30, 30, 7, 0.3), petal(168, 108, 52, 24, 6, 0.3)];
  const tips: P[] = [[366, 28], [376, 66], [368, 104], [352, 138], [328, 168], [298, 192], [266, 208]];
  let wing = 'M 228 214 C 200 170 212 110 248 76 C 280 46 320 30 366 28';
  for (let i = 1; i < tips.length; i++) {
    const [ax, ay] = tips[i - 1];
    const [bx, by] = tips[i];
    wing += ` Q ${f((ax + bx) / 2 - 14)} ${f((ay + by) / 2 - 2)} ${f(bx)} ${f(by)}`;
  }
  wing += ' L 244 218 Z';
  const feathers = tips.slice(1, -1).map(([x, y]) => `M ${f(x)} ${f(y)} L ${f(x + (262 - x) * 0.42)} ${f(y + (176 - y) * 0.42)}`);
  let coverts = '';
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
    const [x, y] = polar(236, 196, 50 + r * 26, 10 + k * 13);
    coverts += `M ${f(x - 10)} ${f(y)} Q ${f(x)} ${f(y + 10)} ${f(x + 10)} ${f(y)} `;
  }
  const raised = [limb([180, 262], [150, 282], 13, 10), limb([150, 282], [130, 262], 10, 8)];
  const talonR = 'M 130 262 L 118 254 M 130 262 L 116 266 M 130 262 L 124 276';
  const stand = limb([204, 270], [200, 334], 13, 9);
  const talonS = 'M 200 334 L 184 344 M 200 334 L 198 348 M 200 334 L 214 344';
  const thigh = rotate(ellipse(304, 262, 36, 30), -20, 304, 262);
  const hind = limb([308, 284], [318, 330], 13, 10);
  const paw = ellipse(322, 338, 20, 10);
  const farHind = limb([270, 280], [262, 332], 12, 9);
  const farPaw = ellipse(258, 340, 18, 9);
  const tail = tube([[330, 238], [356, 236], [370, 260], [368, 296], [356, 318]], () => 4);
  const tailTuft = petal(356, 316, 200, 34, 10, 0.5);
  let ruffs = '';
  for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) {
    const x = 156 + r * 8 + k * 14;
    const y = 160 + r * 20 + k * 4;
    ruffs += `M ${x - 7} ${y} Q ${x} ${y + 9} ${x + 7} ${y} `;
  }
  const ruff = inside(ruffs, smooth([[146, 130], [172, 132], [190, 176], [212, 214], [206, 254], [176, 266], [152, 236], [138, 186]]));
  const rock = smooth([[100, 372], [112, 346], [180, 338], [270, 342], [346, 346], [358, 372]]);
  return join(
    layered([
      { sil: beak, d: ['M 74 128 Q 88 126 102 130'] },
      { sil: head, d: [circle(128, 112, 6), dot(128, 112, 2.5), 'M 114 102 Q 128 96 144 102', 'M 140 126 Q 152 132 162 128'] },
      ...tufts.map((t) => ({ sil: t })),
      { sil: neck, d: [ruff] },
      { sil: talonR },
      { sil: raised },
      { sil: stand, p: [talonS], d: ['M 196 290 L 210 290 M 196 304 L 208 304 M 196 318 L 206 318'] },
      { sil: paw, d: ['M 316 344 L 316 348 M 326 344 L 326 348'] },
      { sil: hind },
      { sil: [body, thigh], d: ['M 260 270 Q 280 274 290 284', 'M 214 268 Q 236 276 256 274'] },
      { sil: farPaw },
      { sil: farHind },
      { sil: tailTuft, d: ['M 356 316 Q 336 330 330 344'] },
      { sil: tail },
      { sil: wing, p: feathers, d: [inside(coverts, wing)] },
      { sil: rock, d: ['M 140 356 L 160 364', 'M 290 356 Q 304 352 318 358'] },
    ]),
    free([], [sparkle(60, 60, 11), sparkle(200, 40, 8), sparkle(60, 220, 8), dot(100, 300, 3)]),
  );
}

function phoenixArt(): Art {
  const body = smooth([[200, 136], [218, 158], [224, 200], [214, 240], [200, 262], [186, 240], [176, 200], [182, 158]]);
  const head = circle(200, 116, 18);
  const beak = 'M 192 126 L 200 146 L 208 126 Z';
  const crest = [petal(200, 100, -28, 44, 7, 0.6), petal(200, 98, 0, 56, 8, 0.6), petal(200, 100, 28, 44, 7, 0.6)];
  const wingR: Item[] = [];
  const covR: Item[] = [];
  for (let k = 0; k <= 7; k++) {
    const t = k / 7;
    const bx = 216 + (300 - 216) * t;
    const by = 184 + (140 - 184) * t;
    const deg = 150 - k * 19;
    const len = 60 + k * 7;
    const shape = petal(bx, by, deg, len, 11 + k * 0.8, 0.6);
    const tip = polar(bx, by, len * 0.9, deg);
    wingR.push({ sil: shape, d: [line(bx, by, tip[0], tip[1])] });
  }
  const arm = smooth([[206, 170], [252, 146], [298, 128], [314, 138], [300, 158], [262, 180], [218, 204]]);
  let scal = '';
  for (let k = 0; k < 6; k++) {
    const [x, y] = [226 + k * 15, 182 - k * 8];
    scal += `M ${x - 9} ${y} Q ${x} ${y + 10} ${x + 9} ${y} `;
  }
  covR.push({ sil: arm, d: [inside(scal, arm)] });
  const tailC: P[][] = [
    [[200, 256], [204, 290], [196, 316], [200, 330]],
    [[204, 254], [226, 290], [256, 306], [284, 330]],
    [[206, 250], [246, 266], [292, 272], [330, 290]],
  ];
  const tails: Item[] = [];
  for (const c of tailC) {
    const end = c[c.length - 1];
    const prev = c[c.length - 2];
    const deg = (Math.atan2(end[0] - prev[0], prev[1] - end[1]) * 180) / Math.PI;
    const back = polar(end[0], end[1], 14, deg + 180);
    const plume = petal(back[0], back[1], deg, 40, 13, 0.55);
    const eye = polar(back[0], back[1], 24, deg);
    tails.push({ sil: plume, d: [circle(eye[0], eye[1], 5)] });
    tails.push({ sil: tube(c, (t) => 7 - 4 * t) });
  }
  const flame = (x: number, h: number, lean: number) => {
    const w = h * 0.26;
    const y = 378;
    return `M ${f(x - w)} ${y} C ${f(x - w * 1.5)} ${f(y - h * 0.5)} ${f(x - w * 0.1 + lean)} ${f(y - h * 0.6)} ${f(x + w * 0.4 + lean)} ${f(y - h)} C ${f(x + w * 0.5 + lean)} ${f(y - h * 0.6)} ${f(x + w * 1.5)} ${f(y - h * 0.45)} ${f(x + w)} ${y} Z`;
  };
  const flames = [flame(130, 70, -14), flame(200, 56, 0), flame(270, 70, 14), flame(90, 46, -24), flame(310, 46, 24), flame(164, 44, -6), flame(236, 44, 6)];
  const m = (it: Item): Item => ({ sil: typeof it.sil === 'string' ? mirrorX(it.sil, 200) : it.sil, p: it.p?.map((d) => mirrorX(d, 200)), d: it.d?.map((d) => mirrorX(d, 200)) });
  return join(
    layered([
      { sil: beak },
      { sil: head, d: [dot(192, 112, 3), dot(208, 112, 3)] },
      ...crest.map((c) => ({ sil: c })),
      { sil: body, d: ['M 188 170 Q 200 180 212 170', 'M 186 192 Q 200 202 214 192', 'M 188 214 Q 200 224 212 214'] },
      ...covR.flatMap((c) => [c, m(c)]),
      ...wingR.flatMap((c) => [c, m(c)]),
      ...tails.flatMap((c, i) => (i < 2 ? [c] : [c, m(c)])),
      ...flames.map((fl) => ({ sil: fl })),
    ]),
    free([], [sparkle(60, 60, 9), sparkle(340, 60, 9), dot(120, 320, 3), dot(280, 320, 3), dot(60, 250, 2.5), dot(340, 250, 2.5)]),
  );
}

function crystalCaveArt(): Art {
  const outerPts: P[] = [[18, 380], [20, 250], [34, 150], [70, 70], [140, 26], [230, 20], [310, 40], [362, 96], [380, 190], [382, 380]];
  const innerPts: P[] = [[330, 380], [336, 300], [338, 222], [324, 150], [300, 102], [286, 96], [278, 144], [266, 94], [240, 80], [214, 78], [204, 130], [192, 78], [160, 82], [132, 96], [120, 104], [112, 140], [102, 112], [84, 150], [72, 220], [66, 300], [70, 380]];
  const frame = roundPoly([...outerPts, ...innerPts], 6).replace(/\s+$/, '');
  const pool = ellipse(200, 352, 76, 14);
  return join(
    layered([
      { sil: frame, d: [inside('M 40 300 L 56 280 L 50 250 M 350 270 L 362 250 L 356 226 M 100 50 L 120 60 M 260 40 L 280 52 L 300 50 M 40 200 L 52 186', frame)] },
      crystal(108, 364, -14, 70, 14),
      crystal(130, 366, 6, 110, 20),
      crystal(156, 368, 26, 66, 13),
      crystal(296, 364, 16, 80, 15),
      crystal(270, 368, -8, 120, 21),
      crystal(246, 368, -32, 60, 12),
      { sil: pool, d: [ellipse(200, 352, 44, 7), ellipse(200, 352, 18, 3)] },
      crystal(186, 270, -6, 40, 8),
      crystal(208, 272, 10, 52, 10),
      crystal(226, 274, 28, 30, 6),
      { sil: '', p: ['M 70 300 Q 140 270 200 272 Q 270 270 336 296'] },
    ]),
    free(['M 70 372 L 330 372'], [sparkle(200, 180, 14), sparkle(150, 210, 8), sparkle(260, 200, 9), dot(176, 140, 3), dot(236, 150, 3), tuft(40, 380, 0.8), tuft(360, 380, 0.8)]),
  );
}

export const kidsfantasy: Template[] = [
  // ---- kids: beginner
  kid('toy-fire-engine', 'Toy fire engine with a hose reel', 'beginner', ['kids', 'toy', 'fire', 'truck', 'vehicle'], fireEngineArt()),
  kid('striped-sailboat', 'Toy sailboat with striped sails', 'beginner', ['kids', 'toy', 'boat', 'sea', 'waves'], sailboatArt()),
  kid('propeller-plane', 'Friendly propeller plane', 'beginner', ['kids', 'friendly', 'plane', 'clouds', 'vehicle'], planeArt()),
  kid('toy-rocket', 'Toy rocket blasting off', 'beginner', ['kids', 'toy', 'rocket', 'space', 'stars'], rocketArt()),
  kid('spiky-dino', 'Cute spiky-backed dinosaur', 'beginner', ['kids', 'cute', 'dinosaur', 'cartoon', 'prehistoric'], stegoArt()),
  kid('dino-hatchling', 'Baby dinosaur hatching', 'beginner', ['kids', 'baby', 'dinosaur', 'egg', 'cartoon'], hatchlingArt()),
  kid('farm-cow', 'Cartoon farm cow', 'beginner', ['kids', 'cartoon', 'cow', 'farm', 'animal'], cowArt()),
  kid('farm-pig', 'Cartoon farmyard pig', 'beginner', ['kids', 'cartoon', 'pig', 'farm', 'animal'], pigArt()),
  kid('fluffy-sheep', 'Fluffy cartoon sheep', 'beginner', ['kids', 'cartoon', 'sheep', 'farm', 'animal'], sheepArt()),
  kid('ice-cream-sundae', 'Ice-cream sundae with a cherry', 'beginner', ['kids', 'simple', 'ice-cream', 'dessert', 'treat'], sundaeArt()),
  kid('birthday-cupcake', 'Smiling birthday cupcake', 'beginner', ['kids', 'smiling', 'cupcake', 'birthday', 'party'], birthdayCupcakeArt()),
  kid('party-balloons', 'Bunch of party balloons', 'beginner', ['kids', 'simple', 'balloons', 'party', 'birthday'], balloonsArt()),
  kid('diamond-kite', 'Smiling diamond kite', 'beginner', ['kids', 'smiling', 'kite', 'wind', 'outdoors'], kiteArt()),
  kid('sun-and-clouds', 'Smiling sun and clouds', 'beginner', ['kids', 'smiling', 'sun', 'clouds', 'weather'], sunCloudsArt()),
  kid('block-tower', 'Toy building block tower', 'beginner', ['kids', 'toy', 'blocks', 'building', 'shapes'], blockTowerArt()),
  kid('patchwork-teddy', 'Patchwork teddy with a bow tie', 'beginner', ['kids', 'toy', 'teddy', 'bear', 'cuddly'], teddyArt()),
  // ---- kids: intermediate
  kid('chunky-digger', 'Chunky toy digger', 'intermediate', ['kids', 'toy', 'digger', 'construction', 'vehicle'], diggerArt()),
  kid('choo-choo-train', 'Choo-choo toy engine', 'intermediate', ['kids', 'toy', 'train', 'steam', 'vehicle'], trainArt()),
  kid('sandcastle', 'Sandcastle with bucket and spade', 'intermediate', ['kids', 'simple', 'sandcastle', 'beach', 'summer'], sandcastleArt()),
  kid('xyz-blocks', 'Stacked alphabet blocks X Y Z', 'intermediate', ['kids', 'toy', 'alphabet', 'letters', 'blocks'], xyzBlocksArt()),
  kid('rocking-horse', 'Wooden rocking horse', 'intermediate', ['kids', 'toy', 'horse', 'wooden', 'nursery'], rockingHorseArt()),
  // ---- fantasy: beginner
  fan('moon-face', 'Sleepy crescent moon face', 'beginner', ['moon', 'stars', 'night', 'sleepy', 'celestial'], moonFaceArt()),
  fan('mushroom-ring', 'Toadstool fairy ring', 'beginner', ['mushroom', 'toadstool', 'magic', 'woodland', 'fairy'], mushroomRingArt()),
  fan('fairy-lantern', 'Fairy lantern on a branch', 'beginner', ['lantern', 'fairy', 'magic', 'jar', 'glow'], fairyLanternArt()),
  fan('moon-arch', 'Moon and stars arch', 'beginner', ['moon', 'stars', 'arch', 'clouds', 'dreamy'], moonArchArt()),
  fan('sword-in-stone', 'Enchanted sword in a stone', 'beginner', ['enchanted', 'sword', 'stone', 'legend', 'magic'], swordStoneArt()),
  fan('moon-spellbook', 'Moon-clasp spellbook', 'beginner', ['spell', 'book', 'moon', 'magic', 'clasp'], spellbookArt()),
  fan('dragon-hatchling', 'Little dragon hatchling', 'beginner', ['dragon', 'baby', 'wings', 'cute', 'magic'], dragonHatchlingArt()),
  // ---- fantasy: intermediate
  fan('cobweb-potion-shelf', 'Cobwebbed shelf of potions', 'intermediate', ['potion', 'witch', 'shelf', 'bottles', 'cobweb'], potionShelfArt()),
  fan('skull-roses', 'Skull with roses', 'intermediate', ['skull', 'roses', 'gothic', 'tattoo', 'memento'], skullRosesArt()),
  fan('raven-skull', 'Raven perched on a skull', 'intermediate', ['skull', 'raven', 'gothic', 'moon', 'halloween'], ravenSkullArt()),
  fan('runic-circle', 'Runic magic circle', 'intermediate', ['rune', 'magic', 'circle', 'sigil', 'mystic'], runicCircleArt()),
  fan('haunted-house', 'Haunted house on a hill', 'intermediate', ['haunted', 'house', 'halloween', 'gothic', 'bats'], hauntedHouseArt()),
  // ---- fantasy: advanced
  fan('wizard-tower', 'Wizard’s tower at night', 'advanced', ['wizard', 'tower', 'moon', 'stars', 'stone', 'magic'], wizardTowerArt()),
  fan('rose-window', 'Rose window in a pointed arch', 'advanced', ['gothic', 'window', 'rose', 'tracery', 'stone', 'cathedral'], roseWindowArt()),
  fan('winged-dragon', 'Winged dragon on a rock', 'advanced', ['dragon', 'wings', 'horns', 'scales', 'legend'], dragonArt()),
  fan('griffin', 'Griffin with raised wings', 'advanced', ['griffin', 'magic', 'wings', 'eagle', 'heraldry'], griffinArt()),
  fan('phoenix', 'Phoenix rising from flames', 'advanced', ['phoenix', 'magic', 'flames', 'firebird', 'wings'], phoenixArt()),
  fan('crystal-cave', 'Crystal cave with a pool', 'advanced', ['crystal', 'cave', 'magic', 'gems', 'underground'], crystalCaveArt()),
];
