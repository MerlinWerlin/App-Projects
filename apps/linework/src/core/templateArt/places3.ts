// places3 template batch (fb-1023b T140, 23 Oct 2026): original buildings and landscapes on a 400×400 canvas. See
// docs/TEMPLATES.md. Every piece is generic and of our own design: no real landmark, no named place, no brand and no
// film, TV or game location. Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, poly, polar, rrect, type P } from './draw.ts';
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

const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });

/** Axis-aligned rectangle. */
const R = (x: number, y: number, w: number, h: number): string => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

/** Lines of `d` kept only inside the closed shape `shape`. */
const inside = (d: string, shape: Layer): string => clip(d, [region(shape)], 'inside');

/** Lines of `d` with the parts inside any of `holes` removed. */
const minus = (d: string, holes: readonly Layer[]): string => clip(d, holes.map((h) => region(h)));

/** Round-topped (arched) opening: left x, top y of the arch, width w, total height h. */
const arch = (x: number, y: number, w: number, h: number): string =>
  `M ${f(x)} ${f(y + h)} L ${f(x)} ${f(y + w / 2)} A ${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(y + w / 2)} L ${f(x + w)} ${f(y + h)} Z`;

/** Window frame with glazing bars (bars returned as detail). */
function win(x: number, y: number, w: number, h: number, bars: 'cross' | 'v' | 'grid' = 'cross'): { p: string; d: string } {
  let d = '';
  if (bars === 'cross' || bars === 'v') d += line(x + w / 2, y, x + w / 2, y + h);
  if (bars === 'cross') d += ` ${line(x, y + h / 2, x + w, y + h / 2)}`;
  if (bars === 'grid') d += `${line(x + w / 3, y, x + w / 3, y + h)} ${line(x + (2 * w) / 3, y, x + (2 * w) / 3, y + h)} ${line(x, y + h / 2, x + w, y + h / 2)}`;
  return { p: R(x, y, w, h), d: d.trim() };
}

/** Horizontal ripple dashes for water between y0 and y1. */
function ripples(x0: number, x1: number, y0: number, y1: number, rows: number, seed = 1): string[] {
  const out: string[] = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let r = 0; r < rows; r++) {
    const y = y0 + ((y1 - y0) * (r + 0.5)) / rows;
    const len = 18 + 10 * (r / rows);
    let x = x0 + rnd() * 30;
    let row = '';
    while (x + len < x1) {
      row += `M ${f(x)} ${f(y)} Q ${f(x + len / 2)} ${f(y - 3)} ${f(x + len)} ${f(y)} `;
      x += len + 14 + rnd() * 26;
    }
    if (row) out.push(row.trim());
  }
  return out;
}

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

/** Layered fir tree: trunk at (x, base), height h. */
function fir(x: number, base: number, h: number): string {
  const w = h * 0.34;
  const t = (k: number) => base - h * 0.15 - (k * h * 0.85) / 3.4;
  return poly([
    [x, base - h],
    [x + w * 0.7, t(1.6)], [x + w * 0.3, t(1.6)],
    [x + w * 0.85, t(0.8)], [x + w * 0.35, t(0.8)],
    [x + w, t(0)], [x + h * 0.05, t(0)], [x + h * 0.05, base], [x - h * 0.05, base], [x - h * 0.05, t(0)],
    [x - w, t(0)], [x - w * 0.35, t(0.8)], [x - w * 0.85, t(0.8)],
    [x - w * 0.3, t(1.6)], [x - w * 0.7, t(1.6)],
  ]);
}

/** Round tree: trunk plus a lumpy crown. */
function roundTree(x: number, base: number, h: number): Layer {
  const r = h * 0.3;
  const cy = base - h + r;
  return [R(x - h * 0.04, base - h * 0.45, h * 0.08, h * 0.45), smooth(Array.from({ length: 10 }, (_, k) => polar(x, cy, r * (k % 2 ? 0.9 : 1.05), k * 36)))];
}

/** Simple gabled outline: left x, ground y, width w, wall height h, roof height rh. */
function gable(x: number, y: number, w: number, h: number, rh: number): string {
  return poly([[x, y], [x, y - h], [x + w / 2, y - h - rh], [x + w, y - h], [x + w, y]]);
}

/** Little four-point sparkle star. */
function twinkle(x: number, y: number, r: number): string {
  const k = r * 0.25;
  return `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`;
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `place3-${id}`,
    name,
    category: 'places',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- beginner ----------------------------------------------------------------------------------------------------

function stiltHouseArt(): Art {
  const roof = poly([[78, 176], [132, 112], [268, 112], [322, 176]]);
  const body = R(96, 176, 208, 92);
  const w1 = win(118, 196, 46, 42);
  const w2 = win(184, 196, 46, 42);
  const door = R(252, 196, 34, 72);
  const stairs = poly([[286, 262], [300, 262], [364, 340], [346, 340]]);
  const treads: string[] = [];
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    treads.push(line(286 + 60 * t, 262 + 78 * t, 300 + 64 * t, 262 + 78 * t));
  }
  const posts = [104, 168, 232, 292].map((x) => R(x - 5, 268, 10, 72));
  const corrugation: string[] = [];
  for (let x = 140; x <= 260; x += 16) corrugation.push(line(x, 114, x - (x - 200) * 0.45, 174));
  return layered([
    { sil: stairs, d: treads },
    { sil: roof, d: corrugation },
    { sil: body, p: [w1.p, w2.p, door], d: [w1.d, w2.d, circle(280, 234, 2.5), line(96, 254, 252, 254)] },
    { sil: posts, d: [line(109, 300, 163, 300), line(173, 300, 227, 300), line(237, 300, 287, 300)] },
    { sil: '', p: ['M 24 340 L 376 340'], d: ['M 40 352 Q 50 346 60 352', 'M 200 360 Q 210 354 220 360'] },
  ]);
}

function countryChurchArt(): Art {
  const spire = poly([[86, 172], [124, 62], [162, 172]]);
  const tower = R(92, 172, 64, 158);
  const roof = poly([[148, 236], [176, 186], [330, 186], [346, 236]]);
  const nave = R(156, 236, 178, 94);
  const windows = [182, 232, 282].map((x) => arch(x, 254, 22, 50));
  return layered([
    { sil: '', p: [line(124, 62, 124, 34), line(114, 44, 134, 44)] },
    { sil: spire, d: [line(124, 70, 106, 172), line(124, 70, 142, 172)] },
    { sil: tower, p: [arch(108, 272, 32, 58), arch(112, 190, 24, 34)], d: [line(124, 272, 124, 330), line(112, 206, 136, 206), line(92, 246, 156, 246)] },
    { sil: roof, d: [line(160, 211, 338, 211)] },
    { sil: nave, p: windows, d: [182, 232, 282].map((x) => line(x + 11, 254, x + 11, 304)) },
    { sil: '', p: ['M 24 330 L 376 330', 'M 124 330 Q 118 350 110 372'] },
  ]);
}

function campsiteArt(): Art {
  const tent = poly([[96, 334], [186, 196], [276, 334]]);
  const door = 'M 186 196 L 158 334 M 186 196 L 214 334 M 214 334 Q 226 300 196 252';
  const fire = 'M 322 318 Q 304 296 318 274 Q 320 290 330 292 Q 330 270 342 262 Q 340 286 352 296 Q 356 312 340 318 Z';
  const logs = [poly([[300, 330], [304, 320], [364, 330], [360, 340]]), poly([[300, 330], [356, 320], [362, 330], [306, 340]])];
  const mountains = 'M 24 250 L 92 170 L 132 210 L 204 128 L 286 230 L 330 194 L 376 240';
  return layered([
    { sil: fire, d: ['M 330 312 Q 324 300 332 290'] },
    { sil: logs },
    { sil: tent, p: [door], d: [line(186, 196, 186, 180), 'M 186 180 L 200 186 L 186 192'] },
    { sil: fir(62, 334, 110) },
    { sil: '', p: [mountains, 'M 24 268 L 376 268', 'M 24 334 L 376 334'], d: [...ripples(40, 370, 276, 320, 3, 5), 'M 186 152 L 204 128 L 222 152', 'M 84 180 L 92 170 L 102 182'] },
    { sil: circle(316, 82, 22) },
  ]);
}

function palmBeachArt(): Art {
  const trunk = 'M 150 344 Q 150 250 206 150 L 218 156 Q 166 252 168 344 Z';
  const crown: P = [212, 150];
  const fronds = [-70, -30, 10, 50, 90, 130].map((deg, i) => petal(crown[0], crown[1], deg, i % 2 ? 92 : 104, 16, 0.4));
  const rings: string[] = [];
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    const y = 344 - 190 * t;
    const xl = 150 + (206 - 150) * t * t;
    rings.push(line(xl, y, xl + 16, y + 3));
  }
  const ribs = [-70, -30, 10, 50, 90, 130].map((deg, i) => line(...crown, ...polar(crown[0], crown[1], (i % 2 ? 92 : 104) * 0.85, deg)));
  return layered([
    { sil: fronds, d: ribs },
    { sil: trunk, d: rings },
    { sil: [circle(212, 156, 8), circle(224, 164, 8)] },
    { sil: 'M 254 262 A 60 60 0 0 1 374 262 Z' },
    { sil: '', p: ['M 24 262 L 376 262', 'M 24 300 Q 120 290 200 300 Q 300 312 376 296'], d: ripples(30, 370, 270, 290, 2, 4) },
  ]);
}

function fencedHillsArt(): Art {
  const hillFront = 'M 24 384 L 24 290 Q 120 236 220 270 Q 300 296 376 262 L 376 384 Z';
  const hillMid = 'M 24 300 L 24 236 Q 110 196 200 222 Q 300 252 376 200 L 376 300 Z';
  const hillBack = 'M 24 250 L 24 190 Q 140 130 250 178 Q 320 200 376 160 L 376 250 Z';
  const hy = (x: number) => {
    // y on the front hill crest (two quadratic segments)
    if (x <= 220) {
      const t = (x - 24) / 196;
      return (1 - t) * (1 - t) * 290 + 2 * (1 - t) * t * 236 + t * t * 270;
    }
    const t = (x - 220) / 156;
    return (1 - t) * (1 - t) * 270 + 2 * (1 - t) * t * 296 + t * t * 262;
  };
  const posts: string[] = [];
  let r1 = '';
  let r2 = '';
  for (let x = 40; x <= 360; x += 32) {
    const y = hy(x) + 30;
    posts.push(R(x - 3, y - 26, 6, 30));
    r1 += `${x === 40 ? 'M' : 'L'} ${f(x)} ${f(y - 20)} `;
    r2 += `${x === 40 ? 'M' : 'L'} ${f(x)} ${f(y - 8)} `;
  }
  return layered([
    { sil: posts },
    { sil: '', p: [r1.trim(), r2.trim()] },
    { sil: hillFront, d: ['M 90 340 Q 100 334 110 340', 'M 280 330 Q 290 324 300 330'] },
    { sil: roundTree(110, 236, 80) },
    { sil: hillMid },
    { sil: roundTree(300, 176, 60) },
    { sil: hillBack },
    { sil: circle(110, 86, 28), d: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => line(...polar(110, 86, 36, a), ...polar(110, 86, 46, a))) },
  ]);
}

function stoneBridgeArt(): Art {
  const bridge = 'M 24 196 L 376 196 L 376 300 L 290 300 A 90 90 0 0 0 110 300 L 24 300 Z';
  const parapet = R(24, 178, 352, 18);
  const voussoirs: string[] = [];
  for (let a = -84; a <= 84; a += 14) voussoirs.push(line(...polar(200, 300, 90, a), ...polar(200, 300, 110, a)));
  const arcOut = 'M 90 300 A 110 110 0 0 1 310 300';
  const water = ripples(40, 370, 316, 372, 4, 7);
  return layered([
    { sil: parapet, d: [line(80, 178, 80, 196), line(140, 178, 140, 196), line(200, 178, 200, 196), line(260, 178, 260, 196), line(320, 178, 320, 196)] },
    { sil: bridge, d: [arcOut, ...voussoirs, line(24, 240, 92, 240), line(308, 240, 376, 240), line(60, 240, 60, 300), line(340, 240, 340, 300)] },
    { sil: '', p: ['M 24 300 L 110 300 M 290 300 L 376 300'], d: water },
  ]);
}

function observatoryArt(): Art {
  const dome = 'M 140 220 A 60 60 0 0 1 260 220 Z';
  const drum = R(146, 220, 108, 84);
  const scope = poly([[214, 182], [256, 128], [268, 138], [228, 192]]);
  const slit = poly([[196, 161], [222, 165], [222, 220], [196, 220]]);
  const mountain = 'M 24 384 L 24 340 L 120 304 L 280 304 L 376 350 L 376 384 Z';
  return layered([
    { sil: scope },
    { sil: slit },
    { sil: dome, d: ['M 170 220 Q 172 182 196 166', 'M 236 220 Q 236 190 222 170'] },
    { sil: drum, p: [arch(184, 254, 32, 50)], d: [line(146, 236, 254, 236), line(200, 254, 200, 304)] },
    { sil: mountain, d: ['M 60 350 L 90 342', 'M 300 330 L 330 340'] },
    { sil: '', p: [twinkle(70, 90, 12), twinkle(320, 70, 14), twinkle(130, 46, 8), twinkle(350, 190, 8)], d: [circle(60, 180, 3), circle(250, 60, 3)] },
  ]);
}

function castleRuinArt(): Art {
  const keep = poly([[130, 300], [130, 110], [148, 110], [148, 96], [168, 96], [168, 112], [182, 112], [182, 92], [200, 92], [212, 124], [226, 140], [236, 136], [236, 300]]);
  const wall = poly([[236, 300], [236, 196], [252, 196], [252, 186], [270, 186], [270, 200], [292, 210], [306, 230], [330, 236], [340, 300]]);
  const lowWall = poly([[60, 300], [60, 236], [76, 236], [76, 226], [92, 226], [92, 250], [112, 256], [130, 250], [130, 300]]);
  const hill = 'M 24 384 L 24 312 Q 200 282 376 316 L 376 384 Z';
  return layered([
    { sil: hill, d: ['M 80 340 L 86 330 L 92 340', 'M 260 350 L 266 340 L 272 350'] },
    { sil: keep, p: [arch(162, 230, 42, 70), arch(150, 150, 18, 32), arch(198, 160, 18, 32)], d: [line(130, 210, 236, 210), line(150, 254, 150, 270), line(220, 120, 216, 140)] },
    { sil: wall, p: [arch(272, 236, 20, 34)], d: [line(236, 250, 336, 250)] },
    { sil: lowWall, d: [line(60, 270, 130, 270), line(90, 270, 90, 300)] },
    { sil: '', p: [twinkle(320, 80, 10)], d: ['M 300 120 Q 318 110 336 120'] },
  ]);
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function terraceHousesArt(): Art {
  const items: Item[] = [];
  const xs = [32, 144, 256];
  xs.forEach((x, i) => {
    const w = 112;
    const parapet = poly([[x, 124], [x + w / 2 - 16, 124], [x + w / 2, 104], [x + w / 2 + 16, 124], [x + w, 124], [x + w, 140], [x, 140]]);
    const facade = R(x, 140, w, 196);
    const balcony = R(x + 4, 216, w - 8, 10);
    const roofV = poly([[x + 2, 216], [x + w - 2, 216], [x + w - 2, 206], [x + 2, 206]]);
    const cols = [R(x + 6, 226, 6, 110), R(x + w - 12, 226, 6, 110)];
    const lace: string[] = [];
    for (let k = 0; k < 6; k++) {
      const lx = x + 12 + k * ((w - 24) / 6);
      const lw = (w - 24) / 6;
      lace.push(`M ${f(lx)} 226 Q ${f(lx + lw / 2)} 244 ${f(lx + lw)} 226`);
    }
    let rail = `M ${f(x + 12)} 196 L ${f(x + w - 12)} 196`;
    for (let k = 0; k <= 10; k++) rail += ` M ${f(x + 12 + (k * (w - 24)) / 10)} 196 L ${f(x + 12 + (k * (w - 24)) / 10)} 206`;
    const w1 = win(x + 20, 152, 30, 40, 'v');
    const w2 = win(x + 62, 152, 30, 40, 'v');
    const door = arch(x + 18, 266, 28, 70);
    const w3 = win(x + 62, 262, 32, 46, 'cross');
    items.push(
      { sil: '', p: [rail], d: [] },
      { sil: cols },
      { sil: balcony, d: lace },
      { sil: roofV },
      { sil: [parapet, facade], p: [w1.p, w2.p, door, w3.p], d: [w1.d, w2.d, w3.d, circle(x + 40, 304, 2.2), i === 1 ? '' : line(x + 32, 130, x + 32, 124)] },
    );
  });
  return join(layered(items), { p: ['M 24 336 L 376 336'], d: ['M 24 352 L 376 352'] });
}

function pubArt(): Art {
  const chimney = R(272, 64, 26, 50);
  const roof = poly([[64, 140], [100, 92], [300, 92], [336, 140]]);
  const body = R(72, 140, 256, 196);
  const bay = poly([[96, 250], [106, 236], [186, 236], [196, 250], [196, 316], [96, 316]]);
  const bayPanes: string[] = [];
  for (let x = 116; x < 196; x += 20) bayPanes.push(line(x, 252, x, 316));
  bayPanes.push(line(96, 284, 196, 284), line(106, 236, 106, 316), line(186, 236, 186, 316));
  const door = R(222, 240, 46, 96);
  const sign = rrect(272, 166, 52, 60, 4);
  const bracket = 'M 328 150 L 262 150 M 328 170 L 300 150';
  const timber: string[] = [];
  for (const x of [72, 136, 200, 264]) timber.push(line(x, 140, x + 64, 222), line(x + 64, 140, x, 222));
  const uw = [win(92, 158, 36, 40), win(164, 158, 36, 40), win(236, 158, 36, 40)];
  const barrel = (x: number): Item => ({ sil: ellipse(x, 316, 18, 22), d: [`M ${x - 18} 310 Q ${x} 316 ${x + 18} 310`, `M ${x - 18} 322 Q ${x} 328 ${x + 18} 322`] });
  return layered([
    { sil: '', p: [line(284, 150, 284, 166), line(312, 150, 312, 166)] },
    { sil: sign, d: ['M 286 186 L 310 186 M 286 198 L 304 198 M 286 210 L 310 210'] },
    barrel(318),
    { sil: chimney, d: [line(272, 74, 298, 74)] },
    { sil: roof, d: [line(80, 116, 320, 116)] },
    {
      sil: body,
      p: [bay, door, line(72, 222, 328, 222), ...uw.map((w) => w.p)],
      d: [...bayPanes, ...uw.map((w) => w.d), ...timber.map((s) => minus(s, uw.map((w) => w.p))), bracket, line(222, 262, 268, 262), circle(260, 292, 2.5), line(92, 316, 200, 316)],
    },
    { sil: '', p: ['M 24 336 L 376 336'] },
  ]);
}

function bakeryArt(): Art {
  const facade = R(70, 70, 260, 270);
  const sign = rrect(100, 88, 200, 44, 8);
  const awning = 'M 82 150 L 318 150 L 334 196 L 66 196 Z';
  const scallops = Array.from({ length: 9 }, (_, k) => {
    const x = 66 + (268 / 9) * k;
    return `M ${f(x)} 196 Q ${f(x + 268 / 18)} 212 ${f(x + 268 / 9)} 196`;
  }).join(' ');
  const stripes: string[] = [];
  for (let k = 1; k < 9; k++) stripes.push(line(82 + (236 * k) / 9, 150, 66 + (268 * k) / 9, 196));
  const window = R(88, 220, 140, 96);
  const door = R(250, 220, 58, 120);
  const loaves = [ellipse(120, 300, 22, 12), ellipse(164, 300, 20, 14), ellipse(204, 300, 18, 11), circle(124, 262, 13), ellipse(180, 262, 26, 11)];
  const scoring = ['M 108 296 L 114 304 M 118 294 L 124 304 M 128 294 L 134 304', 'M 156 296 Q 164 290 172 296', 'M 196 300 L 212 300', 'M 162 258 L 168 266 M 174 258 L 180 266 M 186 258 L 192 266'];
  const wheat = 'M 200 118 L 200 100 M 200 106 L 192 100 M 200 106 L 208 100 M 200 112 L 192 106 M 200 112 L 208 106';
  return layered([
    { sil: awning, p: [scallops], d: stripes },
    { sil: sign, d: [line(126, 110, 184, 110), line(216, 110, 274, 110), wheat] },
    { sil: loaves, d: scoring },
    {
      sil: facade,
      p: [window, door, R(88, 316, 140, 10)],
      d: [line(88, 282, 228, 282), R(262, 232, 34, 46), circle(298, 290, 2.5), line(250, 300, 308, 300), line(158, 220, 158, 282)],
    },
    { sil: '', p: ['M 24 340 L 376 340'] },
  ]);
}

function mountainRoadArt(): Art {
  const roadL: P[] = [[60, 384], [150, 330], [250, 290], [230, 250], [176, 222], [196, 196]];
  const roadR: P[] = [[250, 384], [270, 330], [310, 286], [272, 244], [214, 218], [206, 196]];
  const road = `${smooth(roadL, false)} L ${f(roadR[roadR.length - 1][0])} ${f(roadR[roadR.length - 1][1])} ${smooth([...roadR].reverse(), false).replace(/^M [^C]+/, '')} L ${roadL[0][0]} ${roadL[0][1]} Z`;
  const centre: P[] = roadL.map((p, i) => [(p[0] + roadR[i][0]) / 2, (p[1] + roadR[i][1]) / 2]);
  const dashes: string[] = [];
  const cpath = smooth(centre, false);
  // dashes: sample the centre line coarsely
  for (let i = 0; i < centre.length - 1; i++) {
    const [a, b] = [centre[i], centre[i + 1]];
    const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const len = 0.18 * Math.max(0.5, (b[1] + a[1]) / 600);
    dashes.push(line(m[0] - (b[0] - a[0]) * len, m[1] - (b[1] - a[1]) * len, m[0] + (b[0] - a[0]) * len, m[1] + (b[1] - a[1]) * len));
  }
  const mountains = 'M 24 250 L 24 170 L 96 90 L 150 150 L 214 62 L 290 160 L 330 120 L 376 170 L 376 250 Z';
  const ground = 'M 24 384 L 24 230 Q 200 190 376 236 L 376 384 Z';
  void cpath;
  return layered([
    { sil: fir(70, 300, 110) },
    { sil: fir(56, 340, 90) },
    { sil: fir(340, 330, 120) },
    { sil: road, d: dashes },
    { sil: '', p: [R(292, 300, 6, 24), R(310, 262, 5, 20), R(98, 340, 6, 24)] },
    { sil: ground },
    { sil: mountains, d: ['M 80 108 L 96 118 L 110 106', 'M 196 86 L 214 100 L 232 84', 'M 316 136 L 330 146 L 342 136'] },
    { sil: '', d: ['M 70 50 Q 90 40 110 50 Q 130 40 150 50', 'M 270 60 Q 286 52 302 60'] },
  ]);
}

function harbourBoatsArt(): Art {
  const boat = (x: number, y: number, s: number, mast: boolean): Item[] => {
    const hull = `M ${f(x - 60 * s)} ${f(y - 26 * s)} L ${f(x + 66 * s)} ${f(y - 26 * s)} Q ${f(x + 54 * s)} ${f(y)} ${f(x + 34 * s)} ${f(y + 4 * s)} L ${f(x - 44 * s)} ${f(y + 4 * s)} Q ${f(x - 56 * s)} ${f(y - 8 * s)} ${f(x - 60 * s)} ${f(y - 26 * s)} Z`;
    const cabin = R(x - 30 * s, y - 56 * s, 40 * s, 30 * s);
    const items: Item[] = [
      { sil: hull, d: [line(x - 56 * s, y - 16 * s, x + 60 * s, y - 16 * s), circle(x + 40 * s, y - 8 * s, 4 * s)] },
      { sil: cabin, p: [R(x - 24 * s, y - 50 * s, 12 * s, 12 * s), R(x - 6 * s, y - 50 * s, 12 * s, 12 * s)] },
    ];
    if (mast) items.push({ sil: '', p: [line(x + 26 * s, y - 26 * s, x + 26 * s, y - 120 * s), line(x + 26 * s, y - 110 * s, x + 64 * s, y - 30 * s)], d: [line(x + 26 * s, y - 90 * s, x - 10 * s, y - 56 * s)] });
    return items;
  };
  const quay = poly([[24, 384], [24, 250], [110, 250], [110, 384]]);
  const stones: string[] = [];
  for (let y = 272; y < 384; y += 22) stones.push(line(24, y, 110, y));
  for (let y = 250, r = 0; y < 384; y += 22, r++) for (let x = 40 + (r % 2) * 18; x < 110; x += 36) stones.push(line(x, y, x, Math.min(384, y + 22)));
  const bollard = 'M 70 250 L 70 232 Q 70 224 78 224 L 86 224 Q 94 224 94 232 L 94 250 Z';
  return layered([
    { sil: '', p: [bollard] },
    { sil: quay, d: stones },
    ...boat(200, 316, 1, true),
    ...boat(310, 262, 0.7, true),
    ...boat(170, 232, 0.5, false),
    { sil: '', p: ['M 110 230 L 376 230', 'M 110 200 Q 180 150 260 190 Q 320 160 376 180'], d: ripples(120, 376, 240, 380, 6, 9) },
  ]);
}

function tramArt(): Art {
  const tram = rrect(84, 190, 232, 120, 14);
  const roofTop = rrect(104, 176, 192, 16, 6);
  const pole = 'M 200 176 L 220 140 L 200 106 M 220 140 L 240 106 M 200 106 L 240 106';
  const wins = [100, 146, 192, 238].map((x) => rrect(x, 206, 38, 44, 4));
  const door = R(284, 206, 22, 96);
  const wheels = [130, 270].map((x) => circle(x, 316, 14));
  const bldA = R(24, 60, 90, 270);
  const bldB = R(114, 100, 100, 230);
  const bldC = R(214, 40, 90, 290);
  const bldD = R(304, 90, 72, 240);
  const winGrid = (x0: number, y0: number, w: number, h: number): string => {
    let d = '';
    for (let y = y0 + 14; y < y0 + h - 40; y += 30) for (let x = x0 + 12; x < x0 + w - 16; x += 24) d += `${R(x, y, 12, 16)} `;
    return d.trim();
  };
  return layered([
    { sil: wheels },
    { sil: tram, p: wins, d: [line(84, 268, 316, 268), line(84, 284, 316, 284), circle(300, 294, 3), line(295, 206, 295, 302)] },
    { sil: door },
    { sil: roofTop },
    { sil: '', p: [pole] },
    { sil: '', p: ['M 24 330 L 376 330', 'M 24 98 L 376 104'], d: ['M 24 346 L 376 346', 'M 24 360 L 376 360'] },
    { sil: bldA, d: [winGrid(24, 60, 90, 270)] },
    { sil: bldC, d: [winGrid(214, 40, 90, 290)] },
    { sil: bldB, d: [winGrid(114, 100, 100, 230)] },
    { sil: bldD, d: [winGrid(304, 90, 72, 240)] },
  ]);
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function riceTerracesArt(): Art {
  const items: Item[] = [];
  // terraces from front (bottom) to back (top); each band is a closed wavy strip
  const bands = 9;
  const edge = (k: number, x: number) => 362 - k * 25 - 14 * Math.sin((x / 400) * Math.PI * 1.5 + k * 0.2) - (x - 200) * 0.03 * k;
  for (let k = 0; k < bands; k++) {
    const top: P[] = [];
    const bot: P[] = [];
    for (let x = 24; x <= 376; x += 22) {
      top.push([x, edge(k + 1, x)]);
      bot.push([x, edge(k, x) + (k === 0 ? 4 : 0)]);
    }
    const band = `${smooth(top, false)} L ${f(bot[bot.length - 1][0])} ${f(bot[bot.length - 1][1])} ${smooth([...bot].reverse(), false).replace(/^M [^C]+/, '')} Z`;
    const wall = smooth(top.map(([x, y]) => [x, y + 6] as P), false);
    let tufts = '';
    for (let x = 40 + (k % 2) * 14; x < 366; x += 28) {
      const y = (edge(k, x) + edge(k + 1, x)) / 2 + 5;
      tufts += `M ${f(x - 6)} ${f(y - 6)} L ${f(x - 3)} ${f(y)} L ${f(x)} ${f(y - 8)} L ${f(x + 3)} ${f(y)} L ${f(x + 6)} ${f(y - 6)} `;
    }
    items.push({ sil: band, d: [wall, tufts.trim()] });
  }
  const hut: Item[] = [
    { sil: poly([[262, 112], [296, 84], [330, 112]]), d: [line(278, 104, 314, 104)] },
    { sil: R(270, 112, 52, 30), p: [R(288, 118, 14, 24)] },
    { sil: [R(274, 142, 5, 22), R(313, 142, 5, 22)] },
  ];
  const mountains = 'M 24 300 L 24 110 L 90 50 L 140 90 L 200 40 L 260 96 L 300 70 L 376 120 L 376 300 Z';
  const palms: Item[] = [
    { sil: [petal(70, 120, -60, 34, 6), petal(70, 120, -10, 36, 6), petal(70, 120, 40, 34, 6), petal(70, 120, 90, 30, 5), petal(70, 120, -100, 30, 5)] },
    { sil: 'M 66 170 Q 66 140 70 120 L 74 121 Q 70 144 72 170 Z' },
  ];
  return layered([...hut, ...palms, ...items, { sil: mountains, d: ['M 40 136 Q 120 126 200 134 Q 280 142 360 132', 'M 76 64 L 90 74 L 102 62'] }]);
}

function rooftopsArt(): Art {
  const items: Item[] = [];
  // rows of houses seen from above the street: wall strip with windows under a tiled roof; front rows first
  const row = (y: number, xs: number[], h: number, wall: number, seed: number) => {
    xs.forEach((x, i) => {
      const ww = (xs[i + 1] ?? 368) - x + 8;
      const kind = (i + seed) % 3;
      const ry = y - wall;
      const ridge = ry - h;
      const roof = kind === 0 ? poly([[x - 4, ry], [x + ww / 2, ridge], [x + ww + 4, ry]]) : poly([[x - 4, ry], [x + 16, ridge], [x + ww - 16, ridge], [x + ww + 4, ry]]);
      const tiles: string[] = [];
      for (let ty = ridge + 10, r = 0; ty < ry; ty += 10, r++) {
        tiles.push(line(x - 4, ty, x + ww + 4, ty));
        for (let tx = x + (r % 2) * 7; tx < x + ww; tx += 14) tiles.push(line(tx, ty - 10, tx, ty));
      }
      const cx = x + ww * 0.7;
      const slopeY = kind === 0 ? ridge + ((cx - (x + ww / 2)) / (ww / 2 + 4)) * h : ridge + Math.max(0, (cx - (x + ww - 16)) / 20) * h;
      const chim = R(cx, ridge - 22, 16, slopeY - ridge + 30);
      const pots = [R(cx + 2, ridge - 30, 5, 8), R(cx + 9, ridge - 28, 5, 6)];
      const facade = R(x, ry, ww, wall);
      const wins: string[] = [];
      for (let wx = x + 12; wx + 14 < x + ww - 6; wx += 26) wins.push(R(wx, ry + 10, 14, Math.min(20, wall - 16)));
      const dx = x + ww * 0.24;
      const dormer = kind !== 2 ? gable(dx, ry - 10, 26, 20, 12) : '';
      items.push({ sil: facade, p: wins, d: wins.map((w) => { const n = w.match(/-?\d*\.?\d+/g)!.map(Number); return line(n[0] + 7, n[1], n[0] + 7, n[5]); }) });
      items.push({ sil: pots }, { sil: chim, d: [line(cx, ridge - 12, cx + 16, ridge - 12)] });
      if (dormer) items.push({ sil: dormer, p: [R(dx + 7, ry - 26, 12, 14)] });
      items.push({ sil: roof, d: [inside(tiles.join(' '), roof)] });
    });
  };
  row(384, [24, 140, 260], 74, 40, 0);
  row(300, [24, 96, 196, 296], 64, 34, 1);
  row(226, [40, 140, 236, 316], 52, 28, 2);
  return join(layered([...items, { sil: '', p: [circle(320, 56, 22)], d: ['M 60 64 Q 80 52 100 64 Q 120 52 140 64', 'M 200 44 Q 214 36 228 44'] }]));
}

function villageStairsArt(): Art {
  const items: Item[] = [];
  // stair: a winding band of steps climbing from the bottom centre to the top left
  const stepsL: P[] = [[130, 384], [150, 330], [170, 280], [160, 230], [138, 190], [140, 150]];
  const stepsR: P[] = [[270, 384], [250, 330], [234, 280], [214, 230], [182, 190], [170, 150]];
  const stair = `${smooth(stepsL, false)} L 170 150 ${smooth([...stepsR].reverse(), false).replace(/^M [^C]+/, '')} Z`;
  let treads = '';
  for (let k = 0; k < 20; k++) {
    const t = k / 20;
    const yy = 384 - t * 234;
    const xl = 130 + (t < 0.4 ? 40 * (t / 0.4) : 40 - 30 * ((t - 0.4) / 0.6));
    const xr = 270 - (t < 0.4 ? 36 * (t / 0.4) : 36 + 64 * ((t - 0.4) / 0.6));
    treads += `M ${f(xl)} ${f(yy)} L ${f(xr)} ${f(yy)} `;
  }
  // left houses
  const hL1 = 'M 24 384 L 24 250 Q 24 240 34 240 L 120 240 Q 130 240 130 250 L 136 384 Z';
  const hL2 = 'M 24 240 L 24 140 Q 24 130 34 130 L 112 130 Q 122 130 122 140 L 128 240 Z';
  const dome = 'M 40 130 A 40 40 0 0 1 120 130 Z';
  const cross = line(80, 90, 80, 72) + ' ' + line(72, 80, 88, 80);
  // right houses
  const hR1 = 'M 266 384 L 276 270 Q 276 260 286 260 L 366 260 Q 376 260 376 270 L 376 384 Z';
  const hR2 = 'M 220 260 L 226 176 Q 226 166 236 166 L 360 166 Q 370 166 370 176 L 370 260 Z';
  const hTop = 'M 150 150 L 150 70 Q 150 62 158 62 L 252 62 Q 260 62 260 70 L 260 150 Z';
  const shut = (x: number, y: number, w: number, h: number): { p: string[]; d: string[] } => ({
    p: [R(x, y, w, h), R(x - 10, y, 10, h), R(x + w, y, 10, h)],
    d: [line(x - 10, y + h / 3, x, y + h / 3), line(x - 10, y + (2 * h) / 3, x, y + (2 * h) / 3), line(x + w, y + h / 3, x + w + 10, y + h / 3), line(x + w, y + (2 * h) / 3, x + w + 10, y + (2 * h) / 3), line(x + w / 2, y, x + w / 2, y + h)],
  });
  const s1 = shut(54, 160, 26, 34);
  const s2 = shut(310, 196, 26, 34);
  const s3 = shut(300, 290, 26, 34);
  const pot = (x: number, y: number): Item => ({
    sil: [poly([[x - 10, y], [x + 10, y], [x + 7, y + 18], [x - 7, y + 18]]), circle(x - 7, y - 6, 8), circle(x + 7, y - 6, 8), circle(x, y - 14, 8)],
    d: [line(x - 10, y + 5, x + 9, y + 5)],
  });
  items.push(
    pot(146, 352),
    pot(258, 340),
    pot(178, 168),
    { sil: stair, d: [treads.trim()] },
    { sil: hL1, p: [arch(56, 290, 36, 94)], d: [line(74, 290, 74, 384), circle(84, 340, 2.2), line(24, 256, 130, 256)] },
    { sil: '', p: [cross] },
    { sil: dome, d: ['M 60 130 Q 62 104 80 92', 'M 100 130 Q 98 104 80 92', 'M 44 120 L 116 120'] },
    { sil: hL2, p: s1.p, d: s1.d },
    { sil: hR1, p: [...s3.p, arch(330, 334, 26, 50)], d: [...s3.d, line(343, 334, 343, 384)] },
    { sil: hR2, p: [...s2.p, arch(250, 200, 26, 60)], d: [...s2.d, line(226, 180, 370, 180)] },
    { sil: hTop, p: [arch(192, 92, 24, 58), R(224, 92, 20, 24)], d: [line(234, 92, 234, 116), line(150, 76, 260, 76)] },
    { sil: '', p: [twinkle(330, 60, 12)], d: ['M 290 40 Q 310 30 330 40', 'M 300 110 Q 320 100 340 110'] },
  );
  return layered(items);
}

function farmhouseArt(): Art {
  const chimney = R(256, 76, 22, 46);
  const roof = poly([[84, 176], [136, 104], [276, 104], [328, 176]]);
  const body = R(100, 176, 212, 112);
  const veranda = poly([[84, 214], [328, 214], [340, 238], [72, 238]]);
  const posts = [R(80, 238, 6, 50), R(160, 238, 6, 50), R(246, 238, 6, 50), R(326, 238, 6, 50)];
  const door = R(186, 222, 38, 66);
  const w1 = win(118, 190, 40, 30, 'grid');
  const w2 = win(252, 190, 40, 30, 'grid');
  const boards: string[] = [];
  for (let y = 186; y < 288; y += 8) boards.push(line(100, y, 312, y));
  const tank = 'M 330 288 L 330 220 Q 352 210 374 220 L 374 288 Z';
  const tankLines: string[] = [];
  for (let x = 336; x < 374; x += 6) tankLines.push(line(x, 222, x, 288));
  const pickets: string[] = [];
  const fenceTop = 304;
  for (let x = 30; x <= 370; x += 16) pickets.push(poly([[x - 4, 340], [x - 4, fenceTop + 6], [x, fenceTop], [x + 4, fenceTop + 6], [x + 4, 340]]));
  const gate = R(190, 300, 28, 40);
  const rows: string[] = [];
  for (let k = 0; k < 3; k++) {
    const y = 354 + k * 10;
    let sprouts = '';
    for (let x = 40 + (k % 2) * 10; x < 370; x += 20) sprouts += `M ${f(x)} ${f(y)} Q ${f(x - 6)} ${f(y - 8)} ${f(x - 8)} ${f(y - 4)} M ${f(x)} ${f(y)} Q ${f(x + 6)} ${f(y - 8)} ${f(x + 8)} ${f(y - 4)} `;
    rows.push(`M 30 ${y} L 370 ${y}`, sprouts.trim());
  }
  const tree = roundTree(64, 300, 124);
  const tiles: string[] = [];
  for (let x = 150; x < 276; x += 14) tiles.push(line(x, 106, x - (x - 206) * 0.6, 174));
  const smoke = 'M 266 70 Q 256 56 268 46 Q 280 36 270 22';
  return layered([
    { sil: gate, d: [line(190, 300, 218, 340), line(204, 300, 204, 340)] },
    { sil: pickets.map((s) => s) },
    { sil: '', p: ['M 24 316 L 376 316', 'M 24 330 L 376 330'] },
    { sil: tank, d: tankLines },
    { sil: posts },
    { sil: veranda, d: [line(78, 226, 334, 226)] },
    { sil: '', d: [smoke] },
    { sil: chimney, d: [line(256, 86, 278, 86)] },
    { sil: roof, d: tiles },
    { sil: body, p: [door, w1.p, w2.p], d: [w1.d, w2.d, circle(218, 258, 2.5), ...boards.map((s) => minus(s, [door, w1.p, w2.p]))] },
    { sil: tree, d: ['M 48 214 Q 58 204 70 210', 'M 62 238 Q 72 228 84 234'] },
    { sil: '', p: ['M 24 288 L 376 288'], d: rows },
  ]);
}

export const places3: Template[] = [
  tpl('stilt-house', 'Raised house on stilts', 'beginner', ['house', 'stilts', 'veranda', 'tropical', 'architecture'], stiltHouseArt()),
  tpl('country-church', 'Country church with a steeple', 'beginner', ['church', 'steeple', 'village', 'countryside', 'architecture'], countryChurchArt()),
  tpl('campsite', 'Lakeside campsite tent', 'beginner', ['lake', 'tent', 'camping', 'mountain', 'campfire'], campsiteArt()),
  tpl('palm-beach', 'Palm tree beach at sunset', 'beginner', ['beach', 'palm', 'sunset', 'tropical', 'holiday'], palmBeachArt()),
  tpl('fenced-hills', 'Rolling hills with a fence', 'beginner', ['hills', 'fence', 'countryside', 'landscape', 'farm'], fencedHillsArt()),
  tpl('stone-bridge', 'Stone arch bridge', 'beginner', ['bridge', 'stone', 'river', 'arch', 'landscape'], stoneBridgeArt()),
  tpl('observatory', 'Mountain observatory dome', 'beginner', ['mountain', 'observatory', 'telescope', 'stars', 'night'], observatoryArt()),
  tpl('castle-ruin', 'Ruined castle keep', 'beginner', ['castle', 'ruin', 'stone', 'hill', 'history'], castleRuinArt()),

  tpl('terrace-houses', 'Terrace houses with iron lace', 'intermediate', ['house', 'terrace', 'balcony', 'street', 'architecture'], terraceHousesArt()),
  tpl('village-pub', 'Old village pub', 'intermediate', ['village', 'pub', 'inn', 'timber', 'vintage'], pubArt()),
  tpl('bakery', 'Bakery shopfront with loaves', 'intermediate', ['shopfront', 'bakery', 'bread', 'awning', 'street'], bakeryArt()),
  tpl('mountain-road', 'Winding mountain road', 'intermediate', ['mountain', 'road', 'fir', 'landscape', 'travel'], mountainRoadArt()),
  tpl('harbour-boats', 'Fishing boats in the harbour', 'intermediate', ['harbour', 'boats', 'quay', 'seaside', 'water'], harbourBoatsArt()),
  tpl('city-tram', 'Tram on a city street', 'intermediate', ['city', 'street', 'tram', 'buildings', 'travel'], tramArt()),

  tpl('rice-terraces', 'Rice terraces landscape', 'advanced', ['landscape', 'rice', 'terraces', 'hills', 'hut', 'nature'], riceTerracesArt()),
  tpl('rooftops', 'City rooftops and chimneys', 'advanced', ['city', 'rooftops', 'chimneys', 'tiles', 'architecture'], rooftopsArt()),
  tpl('village-stairs', 'Whitewashed village stairs', 'advanced', ['village', 'stairs', 'dome', 'seaside', 'architecture'], villageStairsArt()),
  tpl('farmhouse', 'Farmhouse with a kitchen garden', 'advanced', ['garden', 'farm', 'house', 'veranda', 'vegetables', 'countryside'], farmhouseArt()),
];
