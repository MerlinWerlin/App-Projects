// places2 template batch (fb-1022b T122, 22 Oct 2026): original buildings and landscapes on a 400×400 canvas. See
// docs/TEMPLATES.md. Every piece is generic and of our own design: no real landmark, no named place, no brand and no
// film, TV or game location. Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, poly, polar, rrect, type P } from './draw.ts';
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

/** Round-topped (arched) opening: left x, top y of the arch, width w, total height h. */
const arch = (x: number, y: number, w: number, h: number): string =>
  `M ${f(x)} ${f(y + h)} L ${f(x)} ${f(y + w / 2)} A ${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(y + w / 2)} L ${f(x + w)} ${f(y + h)} Z`;

/** Window with a cross of glazing bars (bars in the detail list). */
function win(x: number, y: number, w: number, h: number, bars: 'cross' | 'v' | 'grid' | 'none' = 'cross'): Art {
  const d: string[] = [];
  if (bars === 'cross' || bars === 'v') d.push(line(x + w / 2, y, x + w / 2, y + h));
  if (bars === 'cross') d.push(line(x, y + h / 2, x + w, y + h / 2));
  if (bars === 'grid') d.push(`${line(x + w / 3, y, x + w / 3, y + h)} ${line(x + (2 * w) / 3, y, x + (2 * w) / 3, y + h)} ${line(x, y + h / 2, x + w, y + h / 2)}`);
  return { p: [R(x, y, w, h)], d };
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

/** Smooth closed curve through points (Catmull-Rom as cubic Béziers). */
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
function fir(x: number, base: number, h: number, tiers = 3): string {
  const w = h * 0.36;
  const pts: P[] = [[x, base - h]];
  for (let i = 0; i < tiers; i++) {
    const yb = base - h * 0.15 - ((tiers - 1 - i) * h * 0.85) / (tiers + 0.6);
    const ww = w * (0.55 + (0.45 * (i + 1)) / tiers);
    pts.push([x + ww, yb], [x + ww * 0.45, yb]);
  }
  const right = pts.slice(1);
  const left = right.map(([px, py]) => [2 * x - px, py] as P).reverse();
  const trunk: P[] = [[x + h * 0.05, base - h * 0.15], [x + h * 0.05, base], [x - h * 0.05, base], [x - h * 0.05, base - h * 0.15]];
  // drop the innermost points of the bottom tier so the trunk joins the bottom edge
  const r = right.slice(0, -1);
  const l = left.slice(1);
  return poly([pts[0], ...r, trunk[0], trunk[1], trunk[2], trunk[3], ...l]);
}

/** Round lollipop tree: crown circle-ish blob on a trunk. */
function roundTree(x: number, base: number, h: number): Layer {
  const r = h * 0.32;
  return [R(x - h * 0.04, base - h * 0.45, h * 0.08, h * 0.45), circle(x, base - h + r, r)];
}

/** Simple gabled house seen from the front: left x, ground y, width w, wall height h, roof height rh. */
function gableHouse(x: number, y: number, w: number, h: number, rh: number): string {
  return poly([[x, y], [x, y - h], [x + w / 2, y - h - rh], [x + w, y - h], [x + w, y]]);
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `place-${id}`,
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

function windmillArt(): Art {
  const hub: P = [200, 150];
  const blade = (deg: number): { sil: string; d: string[] } => {
    const u = polar(0, 0, 1, deg);
    const n = polar(0, 0, 1, deg + 90);
    const at = (r: number, s: number): P => [hub[0] + u[0] * r + n[0] * s, hub[1] + u[1] * r + n[1] * s];
    const sil = poly([at(18, 0), at(150, 0), at(150, 30), at(40, 30)]);
    const d: string[] = [];
    for (let k = 0; k < 6; k++) {
      const r = 50 + k * 20;
      d.push(line(...at(r, 0), ...at(r, 30)));
    }
    d.push(line(...at(40, 15), ...at(150, 15)));
    return { sil, d };
  };
  const blades = [45, 135, 225, 315].map(blade);
  const cap = 'M 160 182 C 160 136 176 116 200 112 C 224 116 240 136 240 182 Z';
  const tower = poly([[148, 336], [164, 182], [236, 182], [252, 336]]);
  const ground = 'M 24 340 Q 110 326 200 334 Q 290 342 376 326';
  return layered([
    { sil: circle(hub[0], hub[1], 11) },
    ...blades.map((b) => ({ sil: b.sil, d: b.d })),
    { sil: cap, d: [line(166, 158, 234, 158)] },
    {
      sil: tower,
      p: [arch(186, 290, 28, 46), arch(190, 214, 20, 30)],
      d: [line(156, 260, 244, 260)],
    },
    { sil: '', p: [ground] },
  ]);
}

function barnArt(): Art {
  // front gambrel face, side wall receding right, silo on the left
  const front = poly([[110, 330], [110, 230], [126, 180], [180, 148], [234, 180], [250, 230], [250, 330]]);
  const sideWall = poly([[250, 330], [346, 312], [346, 214], [250, 230]]);
  const roofLow = poly([[250, 230], [234, 180], [330, 166], [346, 214]]);
  const roofHigh = poly([[234, 180], [180, 148], [276, 136], [330, 166]]);
  const silo = 'M 44 330 L 44 180 C 44 140 98 140 98 180 L 98 330 Z';
  const doors = R(148, 262, 64, 68);
  const shingles: string[] = [];
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    shingles.push(line(250 + (234 - 250) * t, 230 + (180 - 230) * t, 346 + (330 - 346) * t, 214 + (166 - 214) * t));
    shingles.push(line(234 + (180 - 234) * t, 180 + (148 - 180) * t, 330 + (276 - 330) * t, 166 + (136 - 166) * t));
  }
  return layered([
    {
      sil: front,
      p: [doors, R(166, 188, 28, 28)],
      d: [line(180, 262, 180, 330), line(148, 262, 180, 330), line(180, 262, 148, 330), line(180, 262, 212, 330), line(212, 262, 180, 330), line(166, 202, 194, 202)],
    },
    { sil: roofHigh, d: shingles.filter((_, i) => i % 2 === 1) },
    { sil: roofLow, d: shingles.filter((_, i) => i % 2 === 0) },
    { sil: sideWall, p: [R(282, 252, 24, 22)], d: [line(298, 320, 298, 222)] },
    { sil: silo, d: [line(44, 200, 98, 200), line(44, 250, 98, 250), line(44, 300, 98, 300)] },
    { sil: '', p: ['M 24 336 L 376 336'] },
  ]);
}

function beachHutsArt(): Art {
  const items: Item[] = [];
  const xs = [36, 118, 200, 282];
  xs.forEach((x, i) => {
    const w = 72;
    const top = 196 + (i % 2) * 8;
    const hut = gableHouse(x, 316, w, 316 - top, 46);
    const door = R(x + 18, top + 30, 36, 316 - top - 30);
    const d: string[] = [];
    if (i % 2 === 0) for (let k = 1; k < 4; k++) d.push(line(x + (w * k) / 4, top + 6, x + (w * k) / 4, 316));
    else for (let k = 1; k < 4; k++) d.push(line(x + 18 + 9 * k, top + 30, x + 18 + 9 * k, 316));
    items.push({ sil: hut, p: [door, ellipse(x + w / 2, top - 18, 7, 7)], d: i % 2 === 0 ? d.map((s) => clip(s, [region(door)])) : d });
    items.push({ sil: '', p: [line(x + 8, 316, x + 8, 334), line(x + w - 8, 316, x + w - 8, 334)] });
  });
  return join(layered(items), { p: ['M 24 334 Q 120 328 200 334 Q 280 340 376 330'], d: ['M 60 356 Q 70 352 80 356 M 180 366 Q 190 362 200 366 M 300 354 Q 310 350 320 354'] });
}

function clockTowerArt(): Art {
  const roof = poly([[150, 140], [200, 46], [250, 140]]);
  const body = poly([[160, 140], [240, 140], [240, 322], [160, 322]]);
  const base = poly([[146, 322], [254, 322], [254, 352], [146, 352]]);
  const face = circle(200, 182, 28);
  const ticks: string[] = [];
  for (let h = 0; h < 12; h++) ticks.push(line(...polar(200, 182, 22, h * 30), ...polar(200, 182, h % 3 === 0 ? 16 : 19, h * 30)));
  return layered([
    { sil: face, p: [`M 200 182 L 200 164 M 200 182 L 213 190`], d: [ticks.join(' ')] },
    { sil: roof, d: [line(200, 46, 200, 30), 'M 200 30 L 214 36 L 200 42'] },
    {
      sil: body,
      p: [line(152, 220, 248, 220), arch(186, 236, 28, 54), arch(184, 290, 32, 32)],
      d: [line(200, 236, 200, 290), line(186, 262, 214, 262), line(160, 148, 240, 148)],
    },
    { sil: base, d: [line(146, 336, 254, 336)] },
    { sil: '', p: ['M 24 352 L 376 352'] },
  ]);
}

function mesaArt(): Art {
  const sun = circle(316, 92, 30);
  const mesa = 'M 24 262 L 40 236 Q 52 220 56 196 L 64 150 L 168 150 L 176 196 Q 182 224 206 244 L 224 262 Z';
  const butte = 'M 214 262 L 236 238 L 246 196 L 292 196 L 302 238 L 330 262 Z';
  const spire = 'M 344 262 L 350 226 L 356 218 L 364 226 L 368 262 Z';
  const cactus =
    'M 112 352 L 112 284 Q 112 272 122 272 Q 132 272 132 284 L 132 352 Z ' +
    'M 112 318 L 98 318 Q 88 318 88 306 L 88 292 Q 88 284 95 284 Q 102 284 102 292 L 102 304 L 112 304 ' +
    'M 132 310 L 146 310 Q 152 310 152 302 L 152 286 Q 152 278 159 278 Q 166 278 166 286 L 166 310 Q 166 324 150 324 L 132 324';
  return layered([
    { sil: '', p: [cactus] },
    { sil: mesa, d: ['M 60 176 L 172 176', 'M 50 214 Q 110 208 182 220', 'M 254 222 L 296 222'] },
    { sil: butte },
    { sil: spire },
    { sil: sun },
    { sil: '', p: ['M 24 262 L 376 262', 'M 24 352 L 376 352'], d: ['M 190 300 L 230 296 L 262 304', 'M 280 330 L 320 326', 'M 40 290 L 66 288'] },
  ]);
}

function shopfrontArt(): Art {
  const facade = R(86, 80, 228, 260);
  const cornice = R(78, 150, 244, 14);
  const sign = rrect(112, 166, 176, 30, 4);
  const awning = 'M 96 204 L 304 204 L 316 246 L 84 246 Z';
  const window = R(104, 252, 116, 78);
  const door = R(238, 252, 52, 88);
  const stripes: string[] = [];
  for (let k = 1; k < 8; k++) {
    const t = k / 8;
    stripes.push(line(96 + 208 * t, 204, 84 + 232 * t, 246));
  }
  const scallops = Array.from({ length: 8 }, (_, k) => {
    const x = 84 + 29 * k;
    return `M ${f(x)} 246 Q ${f(x + 14.5)} 262 ${f(x + 29)} 246`;
  }).join(' ');
  return layered([
    { sil: awning, p: [scallops], d: stripes },
    { sil: sign, d: [line(132, 181, 268, 181)] },
    { sil: cornice },
    {
      sil: facade,
      p: [window, door, R(126, 96, 46, 50), R(228, 96, 46, 50), R(120, 146, 58, 4), R(222, 146, 58, 4)],
      d: [line(162, 252, 162, 330), line(248, 264, 280, 264), line(248, 264, 248, 302), line(280, 264, 280, 302), line(248, 302, 280, 302), circle(282, 300, 2.5), line(149, 96, 149, 146), line(251, 96, 251, 146)],
    },
    { sil: '', p: ['M 24 340 L 376 340'] },
  ]);
}

function greenhouseArt(): Art {
  const body = poly([[80, 320], [80, 210], [200, 128], [320, 210], [320, 320]]);
  const door = R(178, 236, 44, 84);
  const d: string[] = [];
  for (const x of [110, 140, 260, 290]) d.push(line(x, 320, x, 210 - (x < 200 ? (x - 80) : (320 - x)) * (82 / 120)));
  d.push(line(80, 262, 178, 262), line(222, 262, 320, 262));
  for (const x of [110, 140, 170]) d.push(line(x, 210 - (x - 80) * (82 / 120), x, 210));
  for (const x of [230, 260, 290]) d.push(line(x, 210 - (320 - x) * (82 / 120), x, 210));
  d.push(line(200, 128, 200, 236));
  const pot = (x: number): Item => ({
    sil: [poly([[x - 16, 326], [x + 16, 326], [x + 12, 352], [x - 12, 352]]), `M ${x - 4} 326 Q ${x - 22} 300 ${x - 12} 290 Q ${x - 2} 300 ${x - 4} 326 Z`, `M ${x + 4} 326 Q ${x + 22} 296 ${x + 12} 284 Q ${x} 298 ${x + 4} 326 Z`],
  });
  return layered([
    pot(48),
    pot(352),
    { sil: body, p: [door, line(80, 210, 320, 210)], d: [...d, line(200, 236, 200, 320), circle(214, 280, 2.5)] },
    { sil: '', p: ['M 24 352 L 376 352'] },
  ]);
}

function skylineArt(): Art {
  // left x, width, height (top = 330 - h), roof style
  const blocks: [number, number, number, string][] = [
    [30, 46, 120, 'flat'],
    [70, 40, 190, 'step'],
    [104, 54, 150, 'flat'],
    [150, 44, 236, 'spire'],
    [188, 58, 170, 'dome'],
    [240, 40, 210, 'step'],
    [274, 52, 136, 'flat'],
    [318, 52, 180, 'tank'],
  ];
  const items: Item[] = [];
  blocks.forEach(([x, w, h, roof], i) => {
    const top = 330 - h;
    let sil: Layer = R(x, top, w, h);
    if (roof === 'step') sil = poly([[x, 330], [x, top + 24], [x + 8, top + 24], [x + 8, top + 10], [x + 16, top + 10], [x + 16, top], [x + w - 16, top], [x + w - 16, top + 10], [x + w - 8, top + 10], [x + w - 8, top + 24], [x + w, top + 24], [x + w, 330]]);
    if (roof === 'spire') sil = poly([[x, 330], [x, top + 40], [x + w / 2, top], [x + w, top + 40], [x + w, 330]]);
    if (roof === 'dome') sil = [R(x, top, w, h), `M ${x + 8} ${top} A ${w / 2 - 8} ${w / 2 - 8} 0 0 1 ${x + w - 8} ${top} Z`];
    if (roof === 'tank') sil = [R(x, top, w, h), R(x + 14, top - 22, 22, 22)];
    const d: string[] = [];
    const wy0 = roof === 'spire' ? top + 52 : roof === 'step' ? top + 36 : top + 14;
    let row = '';
    for (let y = wy0; y < 312; y += 18) {
      for (let c = 0; c < Math.floor((w - 8) / 14); c++) {
        const wx = x + 8 + c * 14;
        if ((c + Math.round(y / 18) + i) % 3 !== 0) row += `${R(wx, y, 6, 9)} `;
      }
    }
    if (row) d.push(row.trim());
    items.push({ sil, d });
  });
  // draw the taller back buildings behind: order front (short) to back (tall)
  const order = items.map((it, i) => ({ it, h: blocks[i][2] })).sort((a, b) => a.h - b.h).map((o) => o.it);
  const shifted = order.map((it) => it);
  return join(layered(shifted), { p: ['M 24 330 L 376 330'], d: [line(172, 94, 172, 72)] });
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function treehouseArt(): Art {
  const roof = poly([[124, 142], [206, 84], [288, 142]]);
  const house = R(140, 142, 132, 62);
  const platform = R(112, 204, 188, 12);
  const trunk = 'M 160 352 Q 180 336 182 300 L 186 160 L 226 160 L 228 300 Q 230 336 254 352 Z';
  const canopy = [circle(110, 132, 52), circle(186, 90, 62), circle(268, 104, 60), circle(300, 172, 46), circle(116, 188, 40), circle(206, 150, 60)];
  const rail = (x: number) => line(x, 216, x, 352);
  const rungs: string[] = [];
  for (let y = 236; y < 352; y += 22) rungs.push(line(124, y, 150, y));
  const planks: string[] = [];
  for (let y = 158; y < 204; y += 15) planks.push(line(140, y, 272, y));
  return layered([
    { sil: roof, d: ['M 150 124 L 262 124', 'M 176 106 L 236 106'] },
    {
      sil: house,
      p: [R(156, 156, 34, 30), R(222, 160, 32, 44)],
      d: [line(173, 156, 173, 186), line(156, 171, 190, 171), circle(248, 184, 2), ...planks.map((s) => clip(s, [region(R(156, 156, 34, 30)), region(R(222, 160, 32, 44))]))],
    },
    { sil: platform },
    { sil: '', p: [rail(124), rail(150)], d: rungs },
    { sil: poly([[120, 216], [154, 216], [154, 352], [120, 352]]) },
    { sil: trunk, d: ['M 196 230 Q 200 270 196 330', 'M 214 250 Q 218 290 214 320'] },
    { sil: canopy, d: ['M 90 120 Q 100 110 112 116', 'M 290 96 Q 300 88 312 94', 'M 300 164 Q 310 156 322 162', 'M 170 70 Q 182 62 194 68'] },
    { sil: '', p: ['M 24 352 Q 200 344 376 352'] },
  ]);
}

function cabinArt(): Art {
  const chimney = R(290, 172, 20, 46);
  const roofSide = poly([[198, 196], [292, 184], [346, 252], [254, 264]]);
  const front = poly([[150, 330], [150, 262], [134, 264], [198, 196], [262, 264], [246, 262], [246, 330]]);
  const side = poly([[246, 330], [334, 314], [334, 251], [246, 262]]);
  const mountains = 'M 24 300 L 24 200 L 84 120 L 118 160 L 176 80 L 248 170 L 290 132 L 376 222 L 376 300 Z';
  const logs: string[] = [];
  for (let y = 274; y < 330; y += 12) logs.push(line(150, y, 246, y));
  const sideLogs: string[] = [];
  for (let k = 1; k < 6; k++) sideLogs.push(line(246, 262 + (68 * k) / 6, 334, 251 + (63 * k) / 6));
  const door = R(182, 280, 32, 50);
  const smoke = 'M 300 164 Q 290 150 302 140 Q 314 130 304 116 Q 296 104 308 92';
  return layered([
    { sil: '', d: [smoke] },
    { sil: chimney },
    { sil: roofSide, d: [line(222, 193, 278, 260), line(246, 190, 302, 257), line(270, 187, 326, 254)] },
    { sil: front, p: [door, circle(198, 236, 10)], d: [...logs.map((s) => clip(s, [region(door)])), line(198, 226, 198, 246), line(188, 236, 208, 236)] },
    { sil: side, p: [R(274, 272, 34, 26)], d: [...sideLogs.map((s) => clip(s, [region(R(274, 272, 34, 26))])), line(291, 272, 291, 298)] },
    { sil: fir(100, 340, 150) },
    { sil: fir(56, 336, 110) },
    { sil: fir(344, 330, 100) },
    { sil: mountains, d: ['M 70 138 L 84 148 L 96 136 L 104 144', 'M 160 100 L 176 112 L 190 98 L 204 114 L 214 106', 'M 280 142 L 292 150 L 304 144'] },
    { sil: '', p: ['M 24 340 Q 200 326 376 336'] },
  ]);
}

function pierArt(): Art {
  const pavilion = R(260, 170, 100, 66);
  const dome = 'M 266 170 C 266 128 290 112 310 112 C 330 112 354 128 354 170 Z';
  const deck = R(24, 236, 340, 12);
  const items: Item[] = [
    { sil: '', p: [line(310, 112, 310, 86), 'M 310 86 L 330 92 L 310 98'] },
    { sil: dome, d: ['M 286 170 Q 290 132 310 120', 'M 334 170 Q 330 132 310 120'] },
    { sil: pavilion, p: [arch(270, 186, 20, 50), arch(300, 186, 20, 50), arch(330, 186, 20, 50)], d: [line(260, 178, 360, 178)] },
    { sil: deck },
  ];
  const legs: string[] = [];
  const braces: string[] = [];
  for (let x = 40; x <= 350; x += 40) {
    legs.push(R(x - 3, 248, 6, 70));
    if (x + 40 <= 350) braces.push(`${line(x + 3, 256, x + 37, 296)} ${line(x + 37, 256, x + 3, 296)}`);
  }
  let rail = 'M 24 210 L 260 210 M 24 220 L 260 220';
  for (let x = 30; x < 260; x += 20) rail += ` M ${x} 210 L ${x} 236`;
  items.push({ sil: '', p: [rail] });
  items.push({ sil: legs, d: braces });
  return join(
    layered([...items, { sil: '', p: ['M 24 300 L 376 300'] }]),
    { p: [], d: [...ripples(30, 370, 310, 370, 4, 3), 'M 24 160 L 60 160', 'M 70 150 Q 90 140 110 150 Q 130 140 150 150'] },
  );
}

function harbourArt(): Art {
  // a row of quay-side houses of different heights above a stone harbour wall, with bollards and a lamp
  const houses: [number, number, number, number][] = [
    [30, 62, 120, 34],
    [92, 56, 150, 30],
    [148, 70, 110, 40],
    [218, 54, 140, 28],
    [272, 52, 124, 30],
    [324, 52, 100, 30],
  ];
  const items: Item[] = [];
  const lamp: Item = { sil: [R(118, 216, 4, 50), poly([[110, 204], [130, 204], [126, 216], [114, 216]]), poly([[112, 204], [120, 196], [128, 204]])] };
  items.push(lamp);
  items.push({ sil: [rrect(176, 254, 18, 12, 4), R(179, 262, 12, 6)] });
  items.push({ sil: [rrect(286, 254, 18, 12, 4), R(289, 262, 12, 6)] });
  houses.forEach(([x, w, h, rh], i) => {
    const sil = gableHouse(x, 266, w, h, rh);
    const p: string[] = [];
    const d: string[] = [];
    const floors = Math.floor((h - 50) / 34) + 1;
    for (let k = 0; k < floors; k++) {
      const wy = 266 - h + 14 + k * 34;
      const ww = w > 60 ? 14 : 12;
      const wa = win(x + w * 0.22 - ww / 2, wy, ww, 20, 'v');
      const wb = win(x + w * 0.78 - ww / 2, wy, ww, 20, 'v');
      p.push(...wa.p, ...wb.p);
      d.push(...wa.d, ...wb.d);
    }
    p.push(i % 2 === 0 ? R(x + w / 2 - 9, 230, 18, 36) : arch(x + w / 2 - 9, 228, 18, 38));
    if (i % 2 === 1) p.push(circle(x + w / 2, 266 - h - rh * 0.45, 5));
    items.push({ sil, p, d });
  });
  const wall = R(24, 266, 352, 46);
  const blocks: string[] = [];
  for (let r = 0; r < 3; r++) {
    const y = 266 + 15 * r;
    if (r > 0) blocks.push(line(24, y, 376, y));
    let row = '';
    for (let x = 24 + (r % 2) * 22 + 22; x < 376; x += 44) row += `M ${x} ${y} L ${x} ${y + 15} `;
    blocks.push(row.trim());
  }
  return join(layered([...items, { sil: wall, d: blocks }]), {
    p: ['M 24 330 L 376 330', 'M 220 312 L 220 330 M 244 312 L 244 330 M 220 318 L 244 318 M 220 324 L 244 324'],
    d: [...ripples(30, 370, 338, 378, 3, 7), circle(80, 296, 5), circle(330, 296, 5)],
  });
}

function waterfallArt(): Art {
  const cliffL = 'M 24 300 L 24 108 L 60 100 L 96 112 L 128 104 L 166 110 L 172 160 L 164 220 L 176 280 L 150 300 Z';
  const cliffR = 'M 376 300 L 376 118 L 330 104 L 290 112 L 240 106 L 232 150 L 240 210 L 228 270 L 252 300 Z';
  const fall = 'M 166 110 Q 200 104 240 106 L 236 150 Q 232 220 240 282 L 168 282 Q 174 220 170 150 Z';
  const pool = 'M 24 300 Q 100 286 150 296 Q 200 306 252 296 Q 320 286 376 300 L 376 340 Q 300 330 200 338 Q 100 346 24 334 Z';
  const streams: string[] = [];
  for (const x of [182, 196, 210, 224]) streams.push(`M ${x} 116 Q ${x - 4} 190 ${x + 2} 276`);
  const foam = 'M 160 290 Q 168 276 178 286 Q 188 272 200 284 Q 212 270 222 284 Q 234 274 244 290';
  return layered([
    { sil: fir(64, 104, 70) },
    { sil: fir(100, 112, 56) },
    { sil: fir(300, 108, 66) },
    { sil: fir(342, 112, 50) },
    { sil: '', p: [foam] },
    { sil: fall, d: streams },
    { sil: cliffL, d: ['M 40 150 L 80 160 L 120 150', 'M 50 210 L 100 220 L 140 212', 'M 36 260 L 86 268 L 130 262'] },
    { sil: cliffR, d: ['M 260 160 L 300 170 L 350 160', 'M 256 220 L 310 230 L 360 220', 'M 262 270 L 320 278 L 364 270'] },
    { sil: pool, d: ripples(40, 360, 306, 330, 2, 5) },
    { sil: '', p: ['M 24 334 Q 100 346 200 338 Q 300 330 376 340'], d: ['M 60 360 Q 120 352 160 366', 'M 240 364 Q 300 352 350 362'] },
  ]);
}

function cafeArt(): Art {
  const facade = R(56, 52, 288, 248);
  const awning = 'M 64 156 L 336 156 L 350 196 L 50 196 Z';
  const sign = rrect(120, 120, 160, 28, 6);
  const window = R(74, 204, 150, 86);
  const door = arch(248, 204, 64, 96);
  const stripes: string[] = [];
  for (let k = 1; k < 10; k++) stripes.push(line(64 + 27.2 * k, 156, 50 + 30 * k, 196));
  const scallops = Array.from({ length: 10 }, (_, k) => `M ${50 + 30 * k} 196 Q ${65 + 30 * k} 212 ${80 + 30 * k} 196`).join(' ');
  const table = (x: number): Item => ({
    sil: [ellipse(x, 300, 26, 7), R(x - 2.5, 300, 5, 44), ellipse(x, 344, 14, 3.5)],
  });
  const chair = (x: number, dir: number): Item => ({
    sil: '',
    p: [`M ${x} 344 L ${x} 312 L ${x + 22 * dir} 312 L ${x + 22 * dir} 344 M ${x} 312 L ${x - 4 * dir} 276 M ${x - 4 * dir} 276 Q ${x + 6 * dir} 270 ${x + 4 * dir} 290`],
  });
  const upper: string[] = [];
  const upperD: string[] = [];
  for (const x of [82, 172, 262]) {
    const w = win(x, 66, 56, 42, 'cross');
    upper.push(...w.p, R(x - 4, 108, 64, 6));
    upperD.push(...w.d);
  }
  return layered([
    table(110),
    chair(70, 1),
    chair(150, -1),
    { sil: [rrect(316, 312, 32, 32, 4), circle(332, 296, 22)], d: ['M 322 290 Q 332 282 342 292', 'M 320 306 Q 330 298 344 304'] },
    { sil: awning, p: [scallops], d: stripes },
    { sil: sign, d: ['M 186 128 L 186 140 Q 186 144 190 144 L 206 144 Q 210 144 210 140 L 210 128 Z', 'M 210 131 Q 218 132 210 140', 'M 192 124 Q 196 118 194 112', 'M 202 124 Q 206 118 204 112'] },
    { sil: facade, p: [window, door, ...upper], d: [line(149, 204, 149, 290), line(74, 226, 224, 226), line(280, 236, 280, 300), circle(272, 262, 2.5), circle(288, 262, 2.5), ...upperD] },
    { sil: '', p: ['M 24 344 L 376 344', 'M 24 300 L 56 300 M 344 300 L 376 300'] },
  ]);
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function canalHousesArt(): Art {
  const ground = 300;
  const items: Item[] = [];
  const specs: [number, number, number, 'step' | 'bell' | 'neck' | 'point'][] = [
    [28, 84, 120, 'step'],
    [112, 80, 92, 'bell'],
    [192, 86, 132, 'neck'],
    [278, 94, 108, 'point'],
  ];
  for (const [x, w, top, kind] of specs) {
    const xr = x + w;
    let sil = '';
    if (kind === 'step') {
      const s = w / 7;
      sil = poly([[x, ground], [x, top], [x + s, top], [x + s, top - 16], [x + 2 * s, top - 16], [x + 2 * s, top - 32], [x + 3 * s, top - 32], [x + 3 * s, top - 48], [xr - 3 * s, top - 48], [xr - 3 * s, top - 32], [xr - 2 * s, top - 32], [xr - 2 * s, top - 16], [xr - s, top - 16], [xr - s, top], [xr, top], [xr, ground]]);
    } else if (kind === 'bell') {
      const c = x + w / 2;
      sil = `M ${x} ${ground} L ${x} ${top} Q ${x + 14} ${top} ${x + 16} ${top - 14} Q ${x + 18} ${top - 36} ${c - 14} ${top - 44} Q ${c} ${top - 60} ${c + 14} ${top - 44} Q ${xr - 18} ${top - 36} ${xr - 16} ${top - 14} Q ${xr - 14} ${top} ${xr} ${top} L ${xr} ${ground} Z`;
    } else if (kind === 'neck') {
      const c = x + w / 2;
      sil = `M ${x} ${ground} L ${x} ${top} Q ${x + 22} ${top} ${c - 20} ${top - 22} L ${c - 20} ${top - 50} L ${c} ${top - 66} L ${c + 20} ${top - 50} L ${c + 20} ${top - 22} Q ${xr - 22} ${top} ${xr} ${top} L ${xr} ${ground} Z`;
    } else {
      sil = poly([[x, ground], [x, top], [x + w / 2, top - 56], [xr, top], [xr, ground]]);
    }
    const p: string[] = [];
    const d: string[] = [];
    const ww = w * 0.24;
    const floors = Math.floor((ground - 60 - top) / 46);
    for (let k = 0; k < floors; k++) {
      const wy = top + 12 + k * 46;
      for (const cx of [x + w * 0.27, x + w * 0.73]) {
        const wa = win(cx - ww / 2, wy, ww, 32, 'cross');
        p.push(...wa.p);
        d.push(...wa.d, line(cx - ww / 2 - 3, wy + 35, cx + ww / 2 + 3, wy + 35));
      }
    }
    // gable window and hoist beam
    p.push(kind === 'step' || kind === 'point' ? R(x + w / 2 - 9, top - 30, 18, 22) : arch(x + w / 2 - 8, top - 34, 16, 26));
    // door with steps
    const door = arch(x + w / 2 - 12, ground - 50, 24, 44);
    p.push(door, `M ${x + w / 2 - 20} ${ground} L ${x + w / 2 - 20} ${ground - 6} L ${x + w / 2 + 20} ${ground - 6} L ${x + w / 2 + 20} ${ground}`);
    items.push({ sil, p, d });
  }
  return join(layered(items), {
    p: [line(24, ground, 376, ground), line(24, ground + 14, 376, ground + 14)],
    d: [
      ...ripples(30, 370, ground + 26, 378, 5, 11),
      (() => {
        let s = '';
        for (let x = 40; x < 376; x += 34) s += `M ${x} ${ground} L ${x} ${ground + 14} `;
        return s.trim();
      })(),
    ],
  });
}

function suspensionBridgeArt(): Art {
  const deckTop = 236;
  const deck = R(24, deckTop, 352, 14);
  const tower = (x: number): Item => {
    const sil = R(x - 16, 84, 32, 216);
    return { sil, p: [arch(x - 9, 104, 18, 46), arch(x - 9, 166, 18, 56)], d: [line(x - 16, 98, x + 16, 98), line(x - 16, 158, x + 16, 158), line(x - 16, 290, x + 16, 290)] };
  };
  const tops = [116, 284];
  const cableY = (x: number): number => {
    if (x <= tops[0]) return 84 + ((tops[0] - x) / (tops[0] - 24)) * (deckTop - 6 - 84);
    if (x >= tops[1]) return 84 + ((x - tops[1]) / (376 - tops[1])) * (deckTop - 6 - 84);
    const t = (x - tops[0]) / (tops[1] - tops[0]);
    return 84 + 4 * t * (1 - t) * (deckTop - 14 - 84);
  };
  const cable = (dy: number) => {
    const pts: P[] = [];
    for (let x = 24; x <= 376; x += 4) pts.push([x, cableY(x) + dy]);
    pts.push([376, cableY(376) + dy]);
    return poly(pts, false);
  };
  const hangers: string[] = [];
  for (let x = 32; x < 376; x += 12) {
    if (Math.abs(x - tops[0]) < 20 || Math.abs(x - tops[1]) < 20) continue;
    const y = cableY(x);
    if (deckTop - y > 6) hangers.push(line(x, y, x, deckTop));
  }
  const truss: string[] = [];
  for (let x = 24; x < 376; x += 16) truss.push(line(x, deckTop + 14, x + 8, deckTop + 4));
  return join(
    layered([
      { sil: '', p: [cable(0)] },
      { sil: deck, d: [line(24, deckTop + 4, 376, deckTop + 4), truss.join(' ')] },
      tower(tops[0]),
      tower(tops[1]),
      { sil: '', d: hangers },
      { sil: '', p: ['M 24 300 L 376 300'] },
    ]),
    {
      p: [],
      d: [
        ...ripples(30, 370, 312, 376, 5, 21),
        'M 56 300 Q 60 288 66 300 M 334 300 Q 338 288 344 300',
        'M 60 60 Q 76 48 92 58 Q 104 50 116 60',
        'M 300 50 Q 316 38 332 48 Q 344 40 356 50',
        'M 150 70 Q 160 62 172 68',
      ],
    },
  );
}

function pagodaArt(): Art {
  const tiers = 5;
  const items: Item[] = [];
  const d: string[] = [];
  let y = 328;
  const spire = [R(197, 48, 6, 30), circle(200, 44, 6)];
  const rings = [ellipse(200, 60, 9, 3), ellipse(200, 68, 10, 3)];
  const layers: Item[] = [];
  for (let i = 0; i < tiers; i++) {
    const bw = 120 - i * 18;
    const bh = i === 0 ? 46 : 30;
    const ew = bw + 54;
    const top = y - bh;
    const roofTop = top - 16;
    const body = R(200 - bw / 2, top, bw, bh);
    const roof = `M ${f(200 - ew / 2 - 8)} ${f(top - 10)} Q ${f(200 - ew / 2 + 6)} ${f(top + 2)} ${f(200 - ew / 2 + 22)} ${f(top)} L ${f(200 + ew / 2 - 22)} ${f(top)} Q ${f(200 + ew / 2 - 6)} ${f(top + 2)} ${f(200 + ew / 2 + 8)} ${f(top - 10)} Q ${f(200 + ew / 2 - 14)} ${f(roofTop + 4)} ${f(200 + bw / 2 - 10)} ${f(roofTop)} L ${f(200 - bw / 2 + 10)} ${f(roofTop)} Q ${f(200 - ew / 2 - 14 + 28)} ${f(roofTop + 4)} ${f(200 - ew / 2 - 8)} ${f(top - 10)} Z`;
    const p: string[] = [];
    const dd: string[] = [];
    if (i === 0) {
      p.push(R(186, top + 12, 28, bh - 12));
      dd.push(line(200, top + 12, 200, y));
    } else {
      const ww = bw * 0.32;
      p.push(R(200 - ww / 2, top + 7, ww, bh - 12));
      let lat = '';
      for (let k = 1; k < 4; k++) lat += `M ${f(200 - ww / 2 + (ww * k) / 4)} ${f(top + 7)} L ${f(200 - ww / 2 + (ww * k) / 4)} ${f(top + bh - 5)} `;
      dd.push(lat.trim());
    }
    // posts on the body
    dd.push(`${line(200 - bw / 2 + 6, top, 200 - bw / 2 + 6, y)} ${line(200 + bw / 2 - 6, top, 200 + bw / 2 - 6, y)}`);
    // roof tiles
    let tiles = '';
    for (let k = -3; k <= 3; k++) tiles += `M ${f(200 + k * (bw / 7))} ${f(roofTop + 2)} L ${f(200 + k * (ew / 7.5))} ${f(top - 2)} `;
    layers.push({ sil: roof, d: [tiles.trim()] });
    layers.push({ sil: body, p, d: dd });
    y = roofTop;
  }
  // front to back: roof i is in front of body i and body i+1
  const ordered: Item[] = [{ sil: rings[0] }, { sil: rings[1] }, { sil: spire }];
  for (let i = tiers - 1; i >= 0; i--) ordered.push(layers[2 * i], layers[2 * i + 1]);
  // reorder so each roof is drawn in front of the body above it
  const fixed: Item[] = [{ sil: rings[0] }, { sil: rings[1] }, { sil: spire }];
  for (let i = 0; i < tiers; i++) fixed.push(layers[2 * i]);
  for (let i = 0; i < tiers; i++) fixed.push(layers[2 * i + 1]);
  void ordered;
  items.push(...fixed);
  items.push({ sil: poly([[110, 328], [290, 328], [300, 342], [100, 342]]) });
  items.push({ sil: poly([[96, 342], [304, 342], [314, 356], [86, 356]]) });
  d.push('M 24 356 L 86 356 M 314 356 L 376 356');
  return join(layered(items), {
    p: [],
    d: [...d, fir(60, 356, 110), fir(340, 356, 100), 'M 40 80 Q 60 64 84 76 Q 100 66 118 78', 'M 290 92 Q 310 78 330 90 Q 346 80 362 92'],
  });
}

function hillVillageArt(): Art {
  const items: Item[] = [];
  // houses on the middle hill: x, ground y, width, wall height, roof height, side depth
  const houses: [number, number, number, number, number][] = [
    [96, 206, 40, 26, 18],
    [140, 200, 34, 22, 16],
    [232, 204, 44, 28, 20],
    [282, 210, 36, 24, 16],
    [118, 236, 46, 30, 20],
    [254, 238, 42, 28, 18],
  ];
  const church = [R(184, 120, 24, 80), poly([[180, 120], [196, 70], [212, 120]]), gableHouse(208, 200, 34, 34, 20)];
  const front: Item[] = [];
  for (const [x, gy, w, h, rh] of houses) {
    const sil = [gableHouse(x, gy, w, h, rh), poly([[x + w / 2, gy - h - rh], [x + w + 22, gy - h - rh - 4], [x + w + 22, gy - 4], [x + w, gy], [x + w, gy - h]])];
    front.push({ sil, p: [R(x + w / 2 - 5, gy - 16, 10, 16), R(x + w + 6, gy - h + 4, 9, 9)], d: [line(x + w, gy - h, x + w + 22, gy - h - 4)] });
  }
  // nearer houses first (bigger ground y in front)
  front.sort((a, b) => 0 * (a.p!.length - b.p!.length));
  const near = front.slice(4);
  const far = front.slice(0, 4);
  items.push(...near);
  items.push({ sil: roundTree(84, 250, 50) }, { sil: roundTree(312, 252, 46) }, { sil: roundTree(210, 252, 40) });
  items.push(...far);
  items.push({ sil: church, p: [arch(190, 138, 12, 18), circle(196, 104, 0.1)], d: [line(196, 70, 196, 58), line(190, 63, 202, 63), arch(219, 176, 12, 24)] });
  items.push({ sil: roundTree(70, 212, 40) }, { sil: roundTree(330, 214, 44) });
  const hillFront = 'M 24 376 L 24 290 Q 120 250 220 284 Q 300 308 376 272 L 376 376 Z';
  const hillMid = 'M 24 300 L 24 230 Q 110 186 200 196 Q 300 206 376 222 L 376 300 Z';
  const hillBack = 'M 24 240 L 24 176 Q 90 132 170 160 Q 250 116 330 140 Q 360 150 376 140 L 376 240 Z';
  const furrows: string[] = [];
  for (let k = 1; k < 6; k++) furrows.push(`M ${24 + k * 18} 376 Q ${110 + k * 30} 300 ${210 + k * 24} ${290 + k * 4}`);
  const path = 'M 196 376 Q 210 330 200 300 Q 190 280 200 262 M 230 376 Q 236 330 222 300 Q 212 280 212 262';
  items.push({ sil: '', p: [path] });
  items.push({ sil: hillFront, d: furrows.map((s) => clip(s, [region('M 194 376 Q 210 330 198 300 Q 188 280 198 262 L 214 262 Q 214 280 224 300 Q 238 330 232 376 Z')])) });
  items.push({ sil: hillMid, d: ['M 40 270 Q 80 262 120 272', 'M 290 270 Q 330 262 360 268'] });
  items.push({ sil: hillBack, d: ['M 60 186 Q 90 176 120 184', 'M 260 160 Q 290 150 320 158'] });
  return join(layered(items), { p: [], d: ['M 60 80 Q 80 62 104 74 Q 120 64 138 76', 'M 270 70 Q 290 54 312 66 Q 328 58 344 70', circle(330, 104, 0.1)].filter((s) => !s.includes('A 0.1')) });
}

function cliffLighthouseArt(): Art {
  const tower = poly([[284, 222], [292, 112], [324, 112], [332, 222]]);
  const gallery = R(282, 102, 52, 10);
  const lantern = R(290, 70, 36, 32);
  const dome = 'M 286 70 Q 308 40 330 70 Z';
  const cottage = [gableHouse(196, 224, 66, 34, 26), R(240, 180, 8, 16)];
  const cliff =
    'M 376 376 L 376 226 Q 300 216 236 222 Q 186 226 160 232 L 150 252 L 158 270 L 140 290 L 150 312 L 128 334 L 136 356 L 120 376 Z';
  const bands: string[] = [];
  for (const yy of [150, 190]) bands.push(line(292 - ((yy - 112) / 110) * 8, yy, 324 + ((yy - 112) / 110) * 8, yy));
  const rays = ['M 286 80 L 226 62', 'M 286 92 L 222 106', 'M 330 80 L 376 64', 'M 330 92 L 376 106'];
  const cracks = ['M 176 240 L 186 262 L 178 288', 'M 214 238 L 222 266 L 214 296 L 222 322', 'M 262 236 L 256 270 L 266 300', 'M 310 236 L 318 264 L 310 292 L 318 330', 'M 350 240 L 344 276 L 352 310', 'M 170 320 L 180 346 L 172 370', 'M 248 330 L 256 360'];
  const waves = 'M 24 300 Q 40 290 56 300 Q 72 290 88 300 Q 104 290 120 300 Q 134 292 146 300';
  const splash = 'M 112 356 Q 100 338 116 326 Q 108 314 122 306 M 128 318 Q 120 308 130 298';
  const grass = 'M 172 230 L 176 220 L 180 230 M 268 222 L 272 212 L 276 222 M 346 222 L 350 212 L 354 222 M 362 223 L 366 214 L 370 223';
  return join(
    layered([
      { sil: dome, d: [line(308, 48, 308, 38)] },
      { sil: lantern, d: [line(302, 70, 302, 102), line(314, 70, 314, 102)] },
      { sil: gallery, d: ['M 286 102 L 286 96 M 296 102 L 296 96 M 320 102 L 320 96 M 330 102 L 330 96 M 282 96 L 334 96'] },
      { sil: tower, p: [arch(300, 190, 16, 32), R(302, 140, 12, 18)], d: bands },
      { sil: cottage, p: [R(206, 196, 18, 16), R(234, 194, 16, 30)], d: [line(215, 196, 215, 212), line(206, 204, 224, 204), 'M 244 176 Q 236 164 246 154 Q 256 144 248 132'] },
      { sil: cliff, d: [...cracks, grass] },
      { sil: '', p: [waves, 'M 24 334 Q 70 324 130 336'], d: [splash, ...ripples(28, 120, 344, 376, 2, 13), ...ripples(28, 130, 308, 326, 1, 4), ...rays] },
    ]),
    { p: [], d: ['M 60 150 Q 76 136 96 146 Q 110 136 128 148', 'M 150 110 Q 160 102 172 110'] },
  );
}

function stationArt(): Art {
  const centre = poly([[150, 236], [150, 120], [200, 76], [250, 120], [250, 236]]);
  const wingL = R(70, 150, 80, 86);
  const wingR = R(250, 150, 80, 86);
  const roofL = poly([[62, 150], [76, 128], [150, 128], [150, 150]]);
  const roofR = poly([[250, 150], [250, 128], [324, 128], [338, 150]]);
  const clock = circle(200, 116, 18);
  const platform = R(24, 236, 352, 16);
  const archWin = (x: number) => arch(x, 172, 20, 40);
  const winL = [82, 116].map(archWin);
  const winR = [264, 298].map(archWin);
  const door = arch(176, 160, 48, 76);
  const ticks: string[] = [];
  for (let h = 0; h < 12; h += 3) ticks.push(line(...polar(200, 116, 14, h * 30), ...polar(200, 116, 10, h * 30)));
  const lamp = [R(46, 166, 4, 70), poly([[38, 152], [58, 152], [54, 166], [42, 166]]), poly([[40, 152], [48, 144], [56, 152]])];
  const bench = 'M 330 222 L 366 222 M 330 228 L 366 228 M 334 228 L 334 236 M 362 228 L 362 236 M 328 212 L 368 212 M 330 212 L 330 222 M 366 212 L 366 222';
  const brick: string[] = [];
  for (let y = 160; y < 236; y += 12) brick.push(`M 70 ${y} L 76 ${y} M 324 ${y} L 330 ${y}`);
  const sleepers: string[] = [];
  for (let x = 34; x < 360; x += 26) sleepers.push(R(x, 296, 12, 52));
  return join(
    layered([
      { sil: clock, p: ['M 200 116 L 200 104 M 200 116 L 209 120'], d: ticks },
      { sil: lamp },
      { sil: '', p: [bench] },
      { sil: centre, p: [door, R(188, 198, 24, 38)], d: [line(200, 160, 200, 236), 'M 150 140 L 250 140', line(170, 236, 170, 120), line(230, 236, 230, 120)] },
      { sil: roofL, d: ['M 90 128 L 84 150 M 110 128 L 104 150 M 130 128 L 124 150'] },
      { sil: roofR, d: ['M 270 128 L 276 150 M 290 128 L 296 150 M 310 128 L 316 150'] },
      { sil: wingL, p: winL, d: [...winL.map((_, i) => line(92 + 34 * i, 172, 92 + 34 * i, 212)), brick.join(' ')] },
      { sil: wingR, p: winR, d: winR.map((_, i) => line(274 + 34 * i, 172, 274 + 34 * i, 212)) },
      { sil: platform, d: ['M 24 242 L 376 242'] },
      { sil: [R(24, 302, 352, 8), R(24, 334, 352, 8)] },
      { sil: '', d: sleepers },
    ]),
    { p: [], d: ['M 60 70 Q 80 54 104 66 Q 120 56 140 68', 'M 270 60 Q 290 46 312 58'] },
  );
}

// ---- catalogue ------------------------------------------------------------------------------------------------

export const places2: Template[] = [
  // beginner
  tpl('windmill', 'Country windmill', 'beginner', ['windmill', 'landscape', 'countryside', 'farm', 'village'], windmillArt()),
  tpl('barn', 'Farm barn and silo', 'beginner', ['barn', 'farm', 'silo', 'countryside', 'landscape'], barnArt()),
  tpl('beach-huts', 'Row of beach huts', 'beginner', ['beach', 'huts', 'seaside', 'summer', 'holiday'], beachHutsArt()),
  tpl('clock-tower', 'Town clock tower', 'beginner', ['tower', 'clock', 'town', 'street', 'architecture'], clockTowerArt()),
  tpl('desert-mesa', 'Desert mesa landscape', 'beginner', ['desert', 'mesa', 'landscape', 'cactus', 'sun'], mesaArt()),
  tpl('shopfront', 'Corner shopfront', 'beginner', ['shop', 'shopfront', 'street', 'awning', 'town'], shopfrontArt()),
  tpl('greenhouse', 'Garden greenhouse', 'beginner', ['greenhouse', 'garden', 'glasshouse', 'plants', 'spring'], greenhouseArt()),
  tpl('city-skyline', 'City skyline', 'beginner', ['city', 'skyline', 'skyscrapers', 'urban', 'buildings'], skylineArt()),
  // intermediate
  tpl('treehouse', 'Treehouse with a ladder', 'intermediate', ['treehouse', 'house', 'tree', 'garden', 'adventure'], treehouseArt()),
  tpl('mountain-cabin', 'Log cabin in the mountains', 'intermediate', ['mountain', 'cabin', 'log', 'fir', 'landscape', 'winter'], cabinArt()),
  tpl('pier', 'Seaside pier and pavilion', 'intermediate', ['pier', 'beach', 'seaside', 'pavilion', 'holiday'], pierArt()),
  tpl('harbour', 'Harbour quay houses', 'intermediate', ['harbour', 'quay', 'house', 'town', 'seaside'], harbourArt()),
  tpl('waterfall', 'Waterfall landscape', 'intermediate', ['waterfall', 'landscape', 'cliffs', 'river', 'nature'], waterfallArt()),
  tpl('street-cafe', 'Street café front', 'intermediate', ['cafe', 'street', 'awning', 'coffee', 'town'], cafeArt()),
  // advanced
  tpl('canal-houses', 'Canal houses', 'advanced', ['canal', 'house', 'gables', 'city', 'water', 'architecture'], canalHousesArt()),
  tpl('suspension-bridge', 'Suspension bridge', 'advanced', ['bridge', 'suspension', 'river', 'city', 'architecture'], suspensionBridgeArt()),
  tpl('pagoda-tower', 'Five-tier pagoda tower', 'advanced', ['pagoda', 'tower', 'garden', 'architecture', 'asian'], pagodaArt()),
  tpl('hill-village', 'Village on rolling hills', 'advanced', ['village', 'hills', 'landscape', 'countryside', 'church'], hillVillageArt()),
  tpl('cliff-lighthouse', 'Lighthouse on a sea cliff', 'advanced', ['lighthouse', 'cliff', 'cottage', 'coast', 'waves'], cliffLighthouseArt()),
  tpl('train-station', 'Old train station', 'advanced', ['station', 'train', 'railway', 'clock', 'architecture', 'vintage'], stationArt()),
];
