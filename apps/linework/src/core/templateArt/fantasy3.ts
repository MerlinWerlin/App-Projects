// fantasy3 template batch (fb-1023b T140, 23 Oct 2026): original fantasy and gothic pieces on a 400×400 canvas. See
// docs/TEMPLATES.md. Every piece is generic and of our own design: no film, TV, game or book references, no famous
// creatures or characters. Rune marks are invented, not a real alphabet. Overlaps use occlude.ts.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, poly, polar, rrect, star, type P } from './draw.ts';
import { clip, outline, region, type Layer, type Region } from './occlude.ts';

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

const R = (x: number, y: number, w: number, h: number): string => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

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

/** Round-topped (arched) opening: left x, top y of the arch, width w, total height h. */
const arch = (x: number, y: number, w: number, h: number): string =>
  `M ${f(x)} ${f(y + h)} L ${f(x)} ${f(y + w / 2)} A ${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(y + w / 2)} L ${f(x + w)} ${f(y + h)} Z`;

/** Pointed (gothic) arch: left x, top of the point y, width w, total height h. */
function pointed(x: number, y: number, w: number, h: number): string {
  const s = y + w * 0.85;
  return `M ${f(x)} ${f(y + h)} L ${f(x)} ${f(s)} Q ${f(x)} ${f(y + w * 0.25)} ${f(x + w / 2)} ${f(y)} Q ${f(x + w)} ${f(y + w * 0.25)} ${f(x + w)} ${f(s)} L ${f(x + w)} ${f(y + h)} Z`;
}

/** Pointed crystal prism from base (x, y) at angle deg (0° = up), length len, half-width w; facet line as detail. */
function crystal(x: number, y: number, deg: number, len: number, w: number): { sil: string; d: string } {
  const u = polar(0, 0, 1, deg);
  const n: P = [-u[1], u[0]];
  const at = (t: number, s: number): P => [x + u[0] * len * t + n[0] * w * s, y + u[1] * len * t + n[1] * w * s];
  return { sil: poly([at(0, -1), at(0.78, -1), at(1, 0), at(0.78, 1), at(0, 1)]), d: `M ${f(at(0, 0.15)[0])} ${f(at(0, 0.15)[1])} L ${f(at(0.78, 0.15)[0])} ${f(at(0.78, 0.15)[1])} L ${f(at(1, 0)[0])} ${f(at(1, 0)[1])}` };
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `fan3-${id}`,
    name,
    category: 'fantasy',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- beginner ----------------------------------------------------------------------------------------------------

function wizardTowerArt(): Art {
  const roof = 'M 136 156 Q 176 120 190 76 Q 198 46 232 34 Q 214 56 220 86 Q 228 124 262 152 Z';
  const tower = poly([[152, 330], [158, 156], [242, 152], [252, 330]]);
  const hill = 'M 24 384 L 24 350 Q 110 316 200 326 Q 300 336 376 352 L 376 384 Z';
  const ledge = poly([[148, 236], [256, 232], [256, 244], [148, 248]]);
  return layered([
    { sil: sparkle(240, 32, 12) },
    { sil: roof, d: ['M 160 140 Q 196 128 232 136', 'M 182 104 Q 200 98 216 104'] },
    { sil: ledge },
    { sil: tower, p: [arch(182, 268, 40, 62), arch(186, 180, 26, 40)], d: [line(202, 268, 202, 330), circle(214, 300, 2.5), line(199, 180, 199, 220), 'M 166 200 L 180 200 M 226 264 L 240 264 M 168 290 L 180 290 M 230 210 L 242 210 M 162 172 L 176 172'] },
    { sil: hill, d: ['M 70 360 L 76 350 L 82 360', 'M 300 364 L 306 354 L 312 364'] },
    { sil: crescent(86, 90, 36, 104, 78, 32) },
    { sil: '', p: [sparkle(320, 90, 10), sparkle(300, 200, 8)], d: [circle(60, 200, 3), circle(340, 260, 3)] },
  ]);
}

function treeDoorArt(): Art {
  const trunk = 'M 76 350 Q 116 334 126 290 L 132 130 Q 116 98 86 86 L 94 72 Q 132 84 150 104 Q 166 66 196 52 L 206 64 Q 184 82 180 104 Q 210 84 236 60 L 248 70 Q 226 94 226 112 Q 254 88 296 80 L 300 94 Q 268 104 262 130 L 272 290 Q 282 334 324 350 Z';
  const door = arch(164, 224, 72, 108);
  const step = rrect(150, 332, 100, 12, 4);
  const win = circle(200, 176, 18);
  return layered([
    { sil: step },
    { sil: door, p: [], d: [line(182, 262, 182, 332), line(200, 236, 200, 332), line(218, 262, 218, 332), circle(226, 290, 3), 'M 164 254 L 180 254 M 164 312 L 180 312'] },
    { sil: win, d: [line(182, 176, 218, 176), line(200, 158, 200, 194)] },
    { sil: [ellipse(312, 330, 18, 10), R(308, 330, 8, 20)], d: [circle(306, 328, 2), circle(318, 326, 2)] },
    { sil: trunk, d: ['M 146 140 Q 150 180 144 216', 'M 252 150 Q 248 190 254 230', 'M 110 330 Q 130 340 150 344', 'M 290 330 Q 270 340 250 344', 'M 140 300 Q 146 280 142 262'] },
    { sil: '', p: ['M 24 350 L 376 350'], d: ['M 40 362 Q 50 356 60 362', 'M 340 366 Q 350 360 360 366'] },
  ]);
}

function swordStoneArt(): Art {
  const rock = smooth([[90, 320], [110, 270], [160, 248], [230, 244], [290, 262], [318, 300], [310, 336], [200, 346], [100, 340]]);
  const blade = poly([[188, 260], [188, 118], [212, 118], [212, 260]]);
  const guard = 'M 140 106 Q 150 94 170 100 L 230 100 Q 250 94 260 106 Q 250 120 230 116 L 170 116 Q 150 120 140 106 Z';
  const grip = R(192, 56, 16, 44);
  const pommel = circle(200, 46, 11);
  const wraps: string[] = [];
  for (let y = 64; y < 100; y += 8) wraps.push(line(192, y, 208, y - 4));
  return layered([
    { sil: rock, d: ['M 130 300 Q 150 290 172 296', 'M 236 288 Q 262 282 280 296', 'M 180 330 L 220 326', 'M 200 260 L 200 248'] },
    { sil: pommel, d: [circle(200, 46, 4)] },
    { sil: guard, d: [circle(200, 108, 5)] },
    { sil: grip, d: wraps },
    { sil: blade, d: [line(200, 124, 200, 250)] },
    { sil: '', p: [sparkle(120, 140, 14), sparkle(290, 120, 12), sparkle(300, 210, 8), sparkle(96, 220, 8), 'M 24 344 L 376 344'] },
  ]);
}

function skullCandleArt(): Art {
  const skull = 'M 200 190 C 262 190 290 236 286 280 C 284 302 270 316 262 322 L 258 352 L 142 352 L 138 322 C 130 316 116 302 114 280 C 110 236 138 190 200 190 Z';
  const candle = R(180, 108, 40, 92);
  const wax = 'M 168 196 Q 166 182 180 180 L 220 180 Q 234 182 232 196 Q 226 212 222 196 Q 216 222 210 198 Q 196 206 186 198 Q 180 220 176 198 Q 172 206 168 196 Z';
  const drip = 'M 180 120 Q 176 136 182 146 Q 186 136 184 120 Z';
  const flame = petal(200, 100, 0, 52, 13, 0.3);
  const eyeL = 'M 146 268 Q 146 244 170 244 Q 190 246 188 268 Q 184 286 166 286 Q 148 284 146 268 Z';
  const eyeR = 'M 254 268 Q 254 244 230 244 Q 210 246 212 268 Q 216 286 234 286 Q 252 284 254 268 Z';
  const nose = 'M 200 288 L 190 310 Q 200 316 210 310 Z';
  return layered([
    { sil: flame, d: [petal(200, 100, 0, 26, 6, 0.3)] },
    { sil: drip },
    { sil: wax },
    { sil: candle, d: [line(200, 100, 200, 108)] },
    { sil: skull, p: [eyeL, eyeR, nose], d: [line(142, 330, 258, 330), line(162, 322, 162, 352), line(181, 322, 181, 352), line(200, 322, 200, 352), line(219, 322, 219, 352), line(238, 322, 238, 352), 'M 140 222 Q 156 206 176 204'] },
    { sil: '', p: ['M 60 352 L 340 352'] },
  ]);
}

function moonFaceArt(): Art {
  const inner: P[] = [[220, 48], [176, 84], [156, 128], [152, 166], [162, 184], [168, 194], [188, 216], [168, 224], [174, 238], [162, 244], [172, 254], [164, 262], [166, 280], [156, 300], [176, 326], [220, 352]];
  const moon = `M 220 48 A 152 152 0 1 0 220 352 ${smooth([...inner].reverse(), false).replace(/^M [^C]+/, '')} Z`;
  return layered([
    { sil: moon, d: ['M 116 172 Q 130 184 146 172', 'M 118 158 Q 132 150 146 158', 'M 112 214 Q 122 222 132 214', 'M 86 120 Q 90 110 98 106', 'M 80 260 Q 90 276 106 284'] },
    { sil: star(300, 110, 26, 11, 5) },
    { sil: '', p: [sparkle(316, 220, 16), sparkle(262, 300, 10), sparkle(352, 300, 8)], d: [circle(260, 70, 4), circle(350, 170, 3), circle(250, 210, 3)] },
  ]);
}

function phoenixFeatherArt(): Art {
  const a: P = [96, 344];
  const b: P = [292, 72];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: P = [-u[1], u[0]];
  const at = (t: number, s: number): P => [a[0] + u[0] * len * t + n[0] * s, a[1] + u[1] * len * t + n[1] * s];
  const left: P[] = [];
  const right: P[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = 0.18 + (0.82 * k) / 12;
    const w = 50 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.18) / 0.86)), 0.6) + 2;
    const notch = k % 3 === 2 ? 0.7 : 1;
    left.push(at(t, w * notch));
    right.push(at(t, -w * notch * 0.9));
  }
  const vane = smooth([at(0.17, 0), ...left, at(1.02, 0), ...right.reverse()]);
  const shaft = `M ${f(a[0])} ${f(a[1])} L ${f(at(0.96, 0)[0])} ${f(at(0.96, 0)[1])}`;
  const barbs: string[] = [];
  for (let k = 0; k < 14; k++) {
    const t = 0.24 + k * 0.05;
    barbs.push(line(...at(t, 0), ...at(t + 0.07, 34)), line(...at(t, 0), ...at(t + 0.07, -30)));
  }
  const curl1 = 'M 300 96 Q 336 86 330 56 Q 324 40 310 50';
  const curl2 = 'M 250 72 Q 248 40 274 34';
  return layered([
    { sil: '', p: [shaft] },
    { sil: vane, p: [curl1, curl2], d: [inside(barbs.join(' '), vane)] },
    { sil: '', p: [sparkle(110, 160, 14), sparkle(300, 250, 12), sparkle(340, 170, 8)], d: [circle(70, 250, 3), circle(250, 330, 3)] },
  ]);
}

function potionSignArt(): Art {
  const plate = rrect(30, 56, 18, 120, 4);
  const arm = R(48, 84, 290, 10);
  const scroll = 'M 48 160 Q 110 156 150 112 Q 166 94 186 96 Q 200 100 196 112 Q 190 122 180 116';
  const sign = 'M 96 174 L 304 174 Q 304 200 324 206 L 324 324 Q 304 330 304 356 L 96 356 Q 96 330 76 324 L 76 206 Q 96 200 96 174 Z';
  const bottle = 'M 186 214 L 214 214 L 214 244 Q 254 258 254 296 Q 254 336 200 336 Q 146 336 146 296 Q 146 258 186 244 Z';
  return layered([
    { sil: bottle, p: [R(182, 204, 36, 10)], d: ['M 152 300 Q 176 288 200 300 Q 224 312 248 300', circle(186, 314, 5), circle(214, 318, 3)] },
    { sil: sign, d: [sparkle(118, 230, 9), sparkle(282, 240, 10), sparkle(116, 316, 7), sparkle(284, 318, 8)] },
    { sil: '', p: ['M 120 94 L 120 174', 'M 280 94 L 280 174'], d: ['M 116 110 L 124 118 M 116 130 L 124 138 M 116 150 L 124 158 M 276 110 L 284 118 M 276 130 L 284 138 M 276 150 L 284 158'] },
    { sil: arm, d: [circle(338, 89, 4)] },
    { sil: plate, d: [circle(39, 70, 3), circle(39, 162, 3)] },
    { sil: '', p: [scroll] },
  ]);
}

function mushroomRingArt(): Art {
  const spots: [number, number, number][] = [];
  const items: Item[] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3;
    const x = 200 + 136 * Math.cos(a);
    const y = 284 + 62 * Math.sin(a);
    const s = 0.7 + 0.3 * ((Math.sin(a) + 1) / 2) * (k % 2 ? 0.9 : 1.1);
    spots.push([x, y, s]);
  }
  spots.sort((p, q) => q[1] - p[1]);
  for (const [x, y, s] of spots) {
    const cap = `M ${f(x - 30 * s)} ${f(y - 34 * s)} Q ${f(x - 28 * s)} ${f(y - 72 * s)} ${f(x)} ${f(y - 74 * s)} Q ${f(x + 28 * s)} ${f(y - 72 * s)} ${f(x + 30 * s)} ${f(y - 34 * s)} Z`;
    const stem = `M ${f(x - 10 * s)} ${f(y - 34 * s)} L ${f(x - 12 * s)} ${f(y)} L ${f(x + 12 * s)} ${f(y)} L ${f(x + 10 * s)} ${f(y - 34 * s)} Z`;
    items.push({ sil: [cap, stem], d: [circle(x - 12 * s, y - 52 * s, 4 * s), circle(x + 10 * s, y - 58 * s, 5 * s), line(x - 30 * s, y - 34 * s, x + 30 * s, y - 34 * s)] });
  }
  return layered([
    ...items,
    { sil: '', p: [sparkle(200, 250, 16), sparkle(160, 200, 9), sparkle(244, 196, 10)], d: [ellipse(200, 290, 110, 40), circle(200, 120, 3), circle(120, 150, 3), circle(286, 140, 3)] },
    { sil: crescent(300, 72, 30, 316, 62, 26) },
  ]);
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function hauntedHouseArt(): Art {
  const roof = poly([[128, 156], [196, 70], [272, 154]]);
  const body = poly([[142, 330], [140, 154], [262, 150], [266, 330]]);
  const towerRoof = poly([[256, 120], [298, 30], [336, 118]]);
  const tower = poly([[262, 330], [264, 118], [330, 116], [332, 330]]);
  const wing = poly([[70, 330], [70, 220], [140, 220], [142, 330]]);
  const wingRoof = poly([[60, 222], [104, 180], [148, 222]]);
  const door = arch(186, 262, 40, 68);
  const w1 = pointed(158, 176, 30, 52);
  const w2 = pointed(216, 172, 30, 52);
  const w3 = pointed(282, 150, 30, 50);
  const w4 = R(88, 250, 34, 34);
  const fenceP: string[] = [];
  for (let x = 30; x <= 370; x += 20) if (x < 180 || x > 230) fenceP.push(poly([[x - 3, 370], [x - 3, 342], [x, 334], [x + 3, 342], [x + 3, 370]]));
  const bat = (x: number, y: number, s: number) => `M ${f(x)} ${f(y)} Q ${f(x - 8 * s)} ${f(y - 10 * s)} ${f(x - 20 * s)} ${f(y - 6 * s)} Q ${f(x - 14 * s)} ${f(y)} ${f(x - 16 * s)} ${f(y + 6 * s)} Q ${f(x - 8 * s)} ${f(y + 2 * s)} ${f(x)} ${f(y + 6 * s)} Q ${f(x + 8 * s)} ${f(y + 2 * s)} ${f(x + 16 * s)} ${f(y + 6 * s)} Q ${f(x + 14 * s)} ${f(y)} ${f(x + 20 * s)} ${f(y - 6 * s)} Q ${f(x + 8 * s)} ${f(y - 10 * s)} ${f(x)} ${f(y)} Z`;
  const tree = 'M 352 330 L 350 230 Q 340 200 320 186 L 326 180 Q 344 192 352 206 Q 356 170 372 150 L 378 156 Q 364 180 362 214 L 364 330 Z';
  return layered([
    { sil: fenceP },
    { sil: '', p: ['M 24 350 L 180 350 M 230 350 L 376 350'] },
    { sil: door, d: [line(206, 262, 206, 330), circle(216, 300, 2.5)] },
    { sil: [w1, w2, w3], d: [line(173, 176, 173, 228), line(158, 206, 188, 206), line(231, 172, 231, 224), line(216, 202, 246, 202), line(297, 150, 297, 200)] },
    { sil: tree },
    { sil: towerRoof, d: [line(298, 30, 298, 18)] },
    { sil: tower, d: ['M 280 240 L 314 240 M 280 270 L 300 290'] },
    { sil: roof, d: ['M 168 120 L 180 128 M 214 100 L 226 116'] },
    { sil: body, d: ['M 150 250 L 170 254 M 236 240 L 254 236'] },
    { sil: wingRoof },
    { sil: wing, p: [w4], d: [line(88, 250, 122, 284), line(105, 250, 105, 267)] },
    { sil: '', p: [bat(90, 110, 1), bat(130, 70, 0.7), bat(340, 190, 0.6), 'M 24 330 L 376 330'] },
    { sil: circle(86, 94, 50) },
  ]);
}

function griffinArt(): Art {
  const talons = (x: number) => `M ${x - 4} 326 Q ${x - 16} 330 ${x - 18} 340 L ${x + 20} 340 Q ${x + 18} 330 ${x + 8} 326 Z`;
  const toes = (x: number) => `M ${x - 6} 340 L ${x - 6} 332 M ${x + 2} 340 L ${x + 2} 330 M ${x + 10} 340 L ${x + 10} 332`;
  const legNear = [R(156, 240, 18, 90), talons(164)];
  const legFar = [R(190, 240, 18, 90), talons(198)];
  const beak = 'M 130 114 Q 94 110 86 144 Q 102 132 120 140 Q 128 134 134 128 Z';
  const head = smooth([[128, 112], [150, 90], [176, 92], [190, 112], [194, 140], [206, 190], [214, 236], [176, 250], [150, 236], [146, 196], [140, 156], [130, 138]]);
  const tufts = [petal(178, 96, 40, 30, 6, 0.6), petal(184, 102, 64, 28, 5, 0.6)];
  const wing = smooth([[210, 220], [216, 150], [248, 96], [300, 56], [346, 40], [336, 76], [352, 92], [330, 118], [344, 140], [316, 160], [326, 186], [292, 200], [266, 226]]);
  const haunch = ellipse(270, 298, 46, 40);
  const body = smooth([[160, 214], [214, 210], [262, 240], [304, 280], [298, 334], [196, 334], [158, 290]]);
  const paw = ellipse(258, 336, 30, 8);
  const tail = tube([[310, 320], [346, 304], [360, 264], [350, 230]], (t) => 5 - 2 * t);
  const tuft = petal(348, 236, -20, 40, 10, 0.5);
  const ruff: string[] = [];
  for (let k = 0; k < 5; k++) ruff.push(`M ${f(150 + k * 7)} ${f(170 + k * 13)} Q ${f(162 + k * 7)} ${f(182 + k * 13)} ${f(176 + k * 7)} ${f(172 + k * 13)}`);
  return layered([
    { sil: legNear, d: [toes(164)] },
    { sil: beak, d: ['M 100 136 Q 112 128 128 132'] },
    { sil: head, d: [circle(154, 118, 5), 'M 142 106 Q 156 100 168 108', ...ruff] },
    { sil: tufts },
    { sil: legFar, d: [toes(198)] },
    { sil: wing, d: ['M 226 190 Q 262 140 330 60', 'M 240 202 Q 282 160 340 100', 'M 256 216 Q 290 188 334 146', 'M 270 226 Q 296 208 318 190'] },
    { sil: paw, d: ['M 236 340 L 236 334 M 246 342 L 246 334'] },
    { sil: haunch, d: ['M 240 318 Q 250 300 270 298'] },
    { sil: tuft },
    { sil: tail },
    { sil: body },
    { sil: '', p: ['M 40 340 L 360 340'], d: ['M 60 352 L 120 352', 'M 260 352 L 330 352'] },
  ]);
}

function alchemyTableArt(): Art {
  const top = R(36, 276, 328, 14);
  const legs = [R(52, 290, 14, 80), R(334, 290, 14, 80)];
  const flask = 'M 120 140 L 140 140 L 140 176 Q 176 190 176 222 Q 176 254 130 254 Q 84 254 84 222 Q 84 190 120 176 Z';
  const stand = 'M 92 276 L 104 240 M 168 276 L 156 240 M 98 250 L 162 250';
  const burner = poly([[118, 276], [142, 276], [138, 262], [122, 262]]);
  const flame = petal(130, 262, 0, 12, 4, 0.3);
  const retort = `M 244 270 Q 206 270 206 234 Q 206 198 244 198 Q 268 198 280 214 L 340 180 L 344 188 L 286 224 Q 284 270 244 270 Z`;
  const rack = R(40, 236, 40, 12);
  const tubes = [48, 64].map((x) => `M ${x} 186 L ${x} 266 Q ${x + 5} 272 ${x + 10} 266 L ${x + 10} 186`);
  const book = [R(290, 252, 60, 12), R(296, 240, 50, 12)];
  return layered([
    { sil: flame },
    { sil: burner },
    { sil: flask, p: [R(116, 128, 28, 12)], d: ['M 92 226 Q 130 216 168 226', circle(116, 236, 4), circle(140, 240, 3), circle(130, 112, 5), circle(140, 92, 7)] },
    { sil: '', p: [stand] },
    { sil: retort, d: ['M 214 244 Q 244 236 276 244', circle(236, 256, 3)] },
    { sil: book, d: [line(296, 258, 346, 258), line(302, 246, 340, 246)] },
    { sil: rack },
    { sil: '', p: tubes, d: ['M 48 226 L 58 226 M 64 210 L 74 210'] },
    { sil: '', p: [R(44, 248, 4, 28), R(72, 248, 4, 28)] },
    { sil: top },
    { sil: legs },
    { sil: '', p: ['M 24 370 L 376 370', sparkle(320, 100, 12), sparkle(220, 130, 8)] },
  ]);
}

function stoneCircleArt(): Art {
  const items: Item[] = [];
  // invented marks (spirals, eyes, waves), deliberately unlike any real script
  const runes = ['M 0 -12 Q 10 -12 10 -2 Q 10 8 0 8 Q -6 8 -6 2 Q -6 -4 0 -4', 'M -9 0 Q 0 -10 9 0 Q 0 10 -9 0 Z M -2 0 L 2 0', 'M -9 -8 Q -4 -14 0 -8 Q 4 -2 9 -8 M -9 4 Q -4 -2 0 4 Q 4 10 9 4', 'M -8 10 L 0 -12 L 8 10 M -4 2 L 4 2 M 0 12 L 0 14', 'M 0 -12 Q 12 0 0 12 Q -12 0 0 -12 M 0 -4 L 0 4'];
  const pos: [number, number, number][] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + Math.PI / 2;
    pos.push([200 + 150 * Math.cos(a), 282 + 50 * Math.sin(a), 0.7 + 0.3 * ((Math.sin(a) + 1) / 2)]);
  }
  pos.sort((p, q) => q[1] - p[1]);
  pos.forEach(([x, y, s], i) => {
    const w = 24 * s;
    const h = 96 * s;
    const stone = smooth([[x - w, y], [x - w * 1.1, y - h * 0.5], [x - w * 0.7, y - h * 0.95], [x, y - h], [x + w * 0.8, y - h * 0.9], [x + w * 1.05, y - h * 0.45], [x + w, y]]);
    const rune = runes[i % runes.length].replace(/(-?\d+) (-?\d+)/g, (_m, a, b) => `${f(x + Number(a) * s)} ${f(y - h * 0.5 + Number(b) * s)}`);
    items.push({ sil: stone, d: [rune] });
  });
  return layered([
    ...items,
    { sil: '', p: ['M 24 300 Q 200 280 376 300'], d: [ellipse(200, 282, 120, 30), 'M 60 330 L 66 320 L 72 330', 'M 320 340 L 326 330 L 332 340'] },
    { sil: circle(200, 110, 56), d: ['M 176 90 Q 186 84 194 92', circle(220, 124, 8), circle(184, 136, 5)] },
    { sil: '', p: [sparkle(80, 70, 10), sparkle(330, 60, 12)], d: [circle(300, 150, 3), circle(100, 160, 3)] },
  ]);
}

function spellScrollArt(): Art {
  const sheet = R(100, 74, 200, 252);
  const rollTop = rrect(84, 56, 232, 26, 13);
  const rollBot = rrect(84, 318, 232, 26, 13);
  const seal = smooth(Array.from({ length: 12 }, (_, k) => polar(250, 300, k % 2 ? 22 : 26, k * 30)));
  const ribbons = ['M 236 316 L 226 366 L 238 358 L 246 370 L 248 320 Z', 'M 262 318 L 270 364 L 258 356 L 252 366 L 252 322 Z'];
  const quill = 'M 330 40 Q 360 90 330 170 L 324 168 Q 330 100 330 40 Z';
  const writing: string[] = [];
  for (let k = 0; k < 4; k++) writing.push(`M 120 ${100 + k * 14} Q 140 ${96 + k * 14} 160 ${100 + k * 14} Q 180 ${104 + k * 14} 200 ${100 + k * 14} Q 220 ${96 + k * 14} 240 ${100 + k * 14} Q 260 ${104 + k * 14} 280 ${100 + k * 14}`);
  for (let k = 0; k < 3; k++) writing.push(`M 120 ${264 + k * 14} Q 140 ${260 + k * 14} 160 ${264 + k * 14} Q 180 ${268 + k * 14} 200 ${264 + k * 14}`);
  return layered([
    { sil: '', p: [line(330, 160, 316, 214)] },
    { sil: quill, d: ['M 332 60 Q 346 100 330 150'] },
    { sil: ribbons },
    { sil: seal, d: [star(250, 300, 12, 5, 5)] },
    { sil: rollTop, d: [ellipse(96, 69, 6, 13)] },
    { sil: rollBot, d: [ellipse(304, 331, 6, 13)] },
    { sil: sheet, p: [circle(200, 196, 46)], d: [...writing, star(200, 196, 42, 17, 5), circle(200, 196, 52)] },
  ]);
}

function crystalCaveArt(): Art {
  const rock = 'M 24 350 L 24 230 Q 40 150 110 110 Q 190 66 270 96 Q 350 130 376 230 L 376 350 Z';
  const mouth = 'M 120 350 L 120 260 Q 124 184 200 176 Q 276 184 280 260 L 280 350 Z';
  const cr = [crystal(160, 350, -18, 80, 13), crystal(186, 350, 6, 104, 15), crystal(214, 350, 22, 70, 12), crystal(250, 350, 34, 50, 10)];
  const cr2 = [crystal(60, 230, -30, 52, 9), crystal(74, 226, 4, 66, 11), crystal(330, 200, 30, 52, 9), crystal(316, 196, -6, 64, 11)];
  return layered([
    ...cr.map((c) => ({ sil: c.sil, d: [c.d] })),
    ...cr2.map((c) => ({ sil: c.sil, d: [c.d] })),
    { sil: mouth, d: ['M 150 240 Q 160 210 186 200', 'M 250 230 Q 246 214 236 206'] },
    { sil: rock, d: ['M 70 300 L 100 290', 'M 300 300 L 340 310', 'M 150 120 Q 180 110 210 116', 'M 290 140 Q 310 150 320 166'] },
    { sil: '', p: ['M 24 350 L 376 350', sparkle(200, 50, 12), sparkle(330, 60, 9), sparkle(80, 70, 8)], d: ['M 140 372 Q 160 362 180 372', 'M 220 376 Q 240 366 260 376'] },
  ]);
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function astrolabeArt(): Art {
  const c: P = [200, 226];
  const disc = circle(c[0], c[1], 146);
  const shackle = 'M 184 84 L 184 66 Q 184 46 200 46 Q 216 46 216 66 L 216 84';
  const throne = 'M 170 88 Q 170 70 186 70 L 214 70 Q 230 70 230 88 Z';
  const ring = circle(200, 32, 14);
  const ticks: string[] = [];
  for (let k = 0; k < 72; k++) ticks.push(line(...polar(c[0], c[1], 146, k * 5), ...polar(c[0], c[1], k % 6 === 0 ? 126 : k % 2 ? 136 : 132, k * 5)));
  const rete: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 10;
    const tip = polar(c[0], c[1], 104, a);
    const l = polar(c[0], c[1], 70, a - 12);
    const r = polar(c[0], c[1], 70, a + 12);
    rete.push(`M ${f(l[0])} ${f(l[1])} Q ${f(polar(c[0], c[1], 92, a - 4)[0])} ${f(polar(c[0], c[1], 92, a - 4)[1])} ${f(tip[0])} ${f(tip[1])} Q ${f(polar(c[0], c[1], 92, a + 4)[0])} ${f(polar(c[0], c[1], 92, a + 4)[1])} ${f(r[0])} ${f(r[1])}`);
  }
  const marks: string[] = [];
  for (let k = 0; k < 12; k++) {
    const p = polar(c[0], c[1], 116, k * 30 + 15);
    marks.push(k % 3 === 0 ? circle(p[0], p[1], 3) : k % 3 === 1 ? `M ${f(p[0] - 4)} ${f(p[1] - 3)} L ${f(p[0])} ${f(p[1] + 4)} L ${f(p[0] + 4)} ${f(p[1] - 3)}` : line(p[0] - 4, p[1], p[0] + 4, p[1]));
  }
  const arcs: string[] = [];
  for (let k = 1; k <= 5; k++) arcs.push(`M ${f(c[0] - 100 + k * 6)} ${f(c[1] + 10 - k * 8)} Q ${f(c[0])} ${f(c[1] - 60 - k * 12)} ${f(c[0] + 100 - k * 6)} ${f(c[1] + 10 - k * 8)}`);
  const rule = poly([[...polar(c[0], c[1], 140, 60 - 3)], [...polar(c[0], c[1], 140, 60 + 3)], [...polar(c[0], c[1], 140, 240 - 3)], [...polar(c[0], c[1], 140, 240 + 3)]] as P[]);
  const hub = circle(c[0], c[1], 10);
  return layered([
    { sil: hub, d: [circle(c[0], c[1], 3)] },
    { sil: rule, d: [line(...polar(c[0], c[1], 130, 60), ...polar(c[0], c[1], 20, 60)), line(...polar(c[0], c[1], 130, 240), ...polar(c[0], c[1], 20, 240))] },
    { sil: ring },
    { sil: '', p: [shackle] },
    { sil: throne, d: [circle(200, 80, 4)] },
    {
      sil: disc,
      p: [circle(c[0], c[1], 126), circle(c[0], c[1], 104), circle(c[0], c[1], 70)],
      d: [...ticks, ...rete, ...marks, ...arcs.map((s) => inside(s, circle(c[0], c[1], 104))), circle(c[0], c[1], 40), star(c[0], c[1], 30, 12, 8, 22.5), line(c[0] - 104, c[1], c[0] + 104, c[1]), line(c[0], c[1] - 104, c[0], c[1] + 104)],
    },
    { sil: '', p: [sparkle(52, 60, 12), sparkle(350, 70, 10)] },
  ]);
}

function phoenixArt(): Art {
  const cx = 200;
  const body = smooth([[200, 136], [222, 160], [228, 206], [214, 250], [200, 262], [186, 250], [172, 206], [178, 160]]);
  const head = circle(200, 120, 20);
  const beak = poly([[192, 128], [208, 128], [200, 146]]);
  const crest = [petal(200, 102, 0, 40, 6, 0.6), petal(196, 104, -26, 36, 5, 0.6), petal(204, 104, 26, 36, 5, 0.6)];
  const wing = (side: 1 | -1): { rows: string[][] } => {
    const rows: string[][] = [];
    const sh: P = [cx + side * 20, 176];
    const specs: [number, number, number, number][] = [
      [5, 150, 26, 15],
      [7, 112, 20, 11],
      [7, 74, 14, 8],
    ];
    specs.forEach(([n, len, w, startDeg], r) => {
      const row: string[] = [];
      for (let k = 0; k < n; k++) {
        const deg = side * (startDeg + 22 + k * ((92 - startDeg) / (n - 1)));
        row.push(petal(sh[0], sh[1] - r * 4, deg, len - k * (r === 0 ? 6 : 4), w * (1 - k * 0.04), 0.65));
      }
      rows.push(row);
    });
    return { rows };
  };
  const L = wing(-1);
  const Rw = wing(1);
  const tail: string[] = [];
  const tailRib: string[] = [];
  for (let k = -2; k <= 2; k++) {
    const x0 = cx + k * 6;
    const pts: P[] = [[x0, 250], [cx + k * 26, 300], [cx + k * 44, 340], [cx + k * 48 + (k >= 0 ? 14 : -14), 366]];
    tail.push(tube(pts, (t) => 11 * Math.sin(Math.PI * Math.min(0.98, t * 0.9 + 0.08)) + 1));
    tailRib.push(smooth(pts, false));
  }
  const ribsFor = (rows: string[][]) => rows.flat().map((p) => {
    const nums = p.match(/-?\d*\.?\d+/g)!.map(Number);
    const tipIdx = 6; // first C ends at the tip
    return line(nums[0], nums[1], (nums[0] * 0.3 + nums[tipIdx * 1] * 0.7), (nums[1] * 0.3 + nums[tipIdx + 1] * 0.7));
  });
  return layered([
    { sil: beak },
    { sil: head, d: ['M 188 114 Q 192 110 196 114', 'M 204 114 Q 208 110 212 114'] },
    { sil: crest, d: [circle(200, 62, 3), circle(178, 72, 3), circle(222, 72, 3)] },
    { sil: body, d: ['M 190 180 Q 200 188 210 180', 'M 188 200 Q 200 208 212 200', 'M 190 220 Q 200 228 210 220', 'M 194 240 Q 200 246 206 240'] },
    { sil: L.rows[2], d: ribsFor([L.rows[2]]) },
    { sil: Rw.rows[2], d: ribsFor([Rw.rows[2]]) },
    { sil: L.rows[1], d: ribsFor([L.rows[1]]) },
    { sil: Rw.rows[1], d: ribsFor([Rw.rows[1]]) },
    { sil: L.rows[0], d: ribsFor([L.rows[0]]) },
    { sil: Rw.rows[0], d: ribsFor([Rw.rows[0]]) },
    { sil: tail, d: tailRib },
    { sil: '', p: [sparkle(60, 300, 10), sparkle(340, 300, 10), sparkle(200, 32, 8)] },
  ]);
}

function bookshelfArt(): Art {
  const frame = R(52, 36, 296, 336);
  const shelves = [118, 210, 300].map((y) => R(64, y, 272, 10));
  const items: Item[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bases = [118, 210, 300, 362];
  bases.forEach((by, row) => {
    let x = 68;
    const top = row === 0 ? 46 : bases[row - 1] + 10;
    const maxH = by - top - 6;
    const stopAt = row === 0 ? 236 : row === 2 ? 252 : 332;
    while (x < stopAt) {
      const w = 14 + Math.floor(rnd() * 12);
      if (x + w > stopAt) break;
      const h = maxH * (0.62 + rnd() * 0.36);
      const lean = row === 1 && x > 250 && x < 290;
      const book = lean ? poly([[x, by], [x + w, by], [x + w + h * 0.35, by - h * 0.94], [x + h * 0.35, by - h * 0.94]]) : R(x, by - h, w, h);
      const d: string[] = [];
      if (!lean) {
        d.push(line(x, by - h + 8, x + w, by - h + 8), line(x, by - 10, x + w, by - 10));
        if (rnd() > 0.5) d.push(R(x + 4, by - h * 0.6, w - 8, 10));
        else d.push(circle(x + w / 2, by - h * 0.55, Math.min(4, w / 4)));
      }
      items.push({ sil: book, d });
      x += w + (lean ? h * 0.4 : 1);
    }
  });
  // extras: a candle on the top shelf, a jar on the third, an orb on its stand
  const candle = R(262, 70, 16, 48);
  const flame = petal(270, 64, 0, 22, 6, 0.3);
  const jar = 'M 272 300 L 272 256 Q 272 248 280 246 L 280 236 L 312 236 L 312 246 Q 320 248 320 256 L 320 300 Z';
  const orb = circle(300, 82, 22);
  const orbStand = poly([[286, 118], [290, 102], [310, 102], [314, 118]]);
  return layered([
    { sil: flame },
    { sil: candle, d: ['M 266 70 Q 264 80 268 86'] },
    { sil: orbStand },
    { sil: orb, d: [sparkle(294, 76, 6)] },
    { sil: jar, d: [line(272, 270, 320, 270), circle(290, 286, 4), circle(302, 280, 3)] },
    ...items,
    { sil: shelves },
    { sil: frame, p: [R(64, 46, 272, 316)] },
    { sil: '', p: ['M 24 372 L 376 372'], d: [sparkle(366, 140, 10)] },
  ]);
}

function gothicGateArt(): Art {
  const pillar = (x: number): Item[] => [
    { sil: poly([[x + 6, 112], [x + 30, 56], [x + 54, 112]]), d: [line(x + 30, 56, x + 30, 112)] },
    { sil: circle(x + 30, 48, 8) },
    { sil: R(x, 112, 60, 14) },
    { sil: R(x + 6, 126, 48, 232), p: [pointed(x + 18, 160, 24, 60)], d: [line(x + 6, 240, x + 54, 240), line(x + 6, 290, x + 54, 290), line(x + 30, 160, x + 30, 220), 'M ' + f(x + 6) + ' 320 L ' + f(x + 54) + ' 320'] },
  ];
  const bars: string[] = [];
  const tips: string[] = [];
  for (let x = 118; x <= 282; x += 16) {
    const dist = Math.abs(x - 200);
    const top = 120 + dist * dist * 0.004 + dist * 0.2;
    bars.push(line(x, top, x, 350));
    tips.push(poly([[x - 5, top], [x, top - 14], [x + 5, top]]));
  }
  const archTop = 'M 110 190 Q 200 130 290 190';
  const scrolls: string[] = [];
  for (const [x, y, sx] of [[134, 206, 1], [266, 206, -1], [150, 300, 1], [250, 300, -1]] as [number, number, number][]) {
    scrolls.push(`M ${x} ${y} Q ${x + sx * 22} ${y - 18} ${x + sx * 40} ${y} Q ${x + sx * 50} ${y + 14} ${x + sx * 36} ${y + 18} Q ${x + sx * 24} ${y + 16} ${x + sx * 28} ${y + 6}`);
  }
  const quatrefoil = [circle(200, 236, 12), circle(200, 268, 12), circle(184, 252, 12), circle(216, 252, 12)];
  return layered([
    ...pillar(50),
    ...pillar(290),
    { sil: quatrefoil, d: [circle(200, 252, 5)] },
    { sil: tips },
    { sil: '', p: [archTop, 'M 110 230 L 290 230', 'M 110 336 L 290 336', line(200, 150, 200, 350)], d: [...bars, ...scrolls] },
    { sil: crescent(310, 58, 26, 324, 48, 22) },
    { sil: '', p: ['M 24 358 L 376 358'], d: ['M 160 358 L 130 384 M 240 358 L 270 384', sparkle(200, 60, 10), circle(140, 90, 3), circle(250, 80, 3)] },
  ]);
}

export const fantasy3: Template[] = [
  tpl('wizard-tower', 'Crooked wizard tower', 'beginner', ['wizard', 'tower', 'moon', 'magic', 'stars'], wizardTowerArt()),
  tpl('tree-door', 'Enchanted door in a tree', 'beginner', ['enchanted', 'door', 'tree', 'woodland', 'whimsical'], treeDoorArt()),
  tpl('sword-stone', 'Legendary sword in the stone', 'beginner', ['enchanted', 'sword', 'stone', 'legend', 'magic'], swordStoneArt()),
  tpl('skull-candle', 'Skull with a melting candle', 'beginner', ['skull', 'candle', 'gothic', 'halloween', 'spooky'], skullCandleArt()),
  tpl('moon-face', 'Celestial moon face', 'beginner', ['celestial', 'moon', 'stars', 'face', 'dreamy'], moonFaceArt()),
  tpl('phoenix-feather', 'Magic phoenix feather', 'beginner', ['magic', 'feather', 'phoenix', 'sparkle', 'whimsical'], phoenixFeatherArt()),
  tpl('potion-sign', 'Hanging potion shop sign', 'beginner', ['potion', 'sign', 'shop', 'magic', 'vintage'], potionSignArt()),
  tpl('mushroom-ring', 'Fairy ring of mushrooms', 'beginner', ['mushroom', 'ring', 'woodland', 'magic', 'moon'], mushroomRingArt()),

  tpl('haunted-house', 'Haunted gothic house', 'intermediate', ['gothic', 'haunted', 'house', 'halloween', 'moon', 'spooky'], hauntedHouseArt()),
  tpl('griffin', 'Seated griffin guardian', 'intermediate', ['griffin', 'magic', 'wings', 'mythical', 'creature'], griffinArt()),
  tpl('alchemy-table', 'Alchemist’s potion table', 'intermediate', ['potion', 'alchemy', 'flask', 'magic', 'vintage'], alchemyTableArt()),
  tpl('stone-circle', 'Moonlit rune stone circle', 'intermediate', ['rune', 'stones', 'moon', 'mystic', 'magic'], stoneCircleArt()),
  tpl('spell-scroll', 'Spell scroll with a wax seal', 'intermediate', ['spell', 'scroll', 'seal', 'quill', 'magic'], spellScrollArt()),
  tpl('crystal-cave', 'Crystal cave entrance', 'intermediate', ['crystal', 'cave', 'gem', 'magic', 'sparkle'], crystalCaveArt()),

  tpl('astrolabe', 'Celestial astrolabe', 'advanced', ['celestial', 'astrolabe', 'stars', 'brass', 'ornamental', 'vintage'], astrolabeArt()),
  tpl('phoenix', 'Rising phoenix of flame', 'advanced', ['phoenix', 'magic', 'wings', 'fire', 'mythical', 'ornamental'], phoenixArt()),
  tpl('wizard-bookshelf', 'Wizard’s bookshelf', 'advanced', ['wizard', 'books', 'candle', 'orb', 'library', 'magic'], bookshelfArt()),
  tpl('gothic-gate', 'Gothic wrought-iron gate', 'advanced', ['gothic', 'gate', 'ironwork', 'moon', 'halloween', 'spooky'], gothicGateArt()),
];
