// fantasy2 template batch (fb-1022b T122, 22 Oct 2026): original fantasy objects and scenes on a 400×400 canvas. See
// docs/TEMPLATES.md. Every piece is generic and of our own design: no film, TV, game or book references, no famous
// silhouettes, no characters. Rune glyphs are invented marks, not a real alphabet. Overlaps use occlude.ts.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, poly, polar, rotate, rrect, star, type P } from './draw.ts';
import { clip, outline, region, union, type Layer, type Region } from './occlude.ts';

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

/** Pointed (equilateral) arch: left x, right x, spring line y, bottom y. */
function pointed(xl: number, xr: number, s: number, yb: number, r: number): string {
  const cx = (xl + xr) / 2;
  const apex = s - Math.sqrt(r * r - (cx - (xl + r)) * (cx - (xl + r)));
  return `M ${f(xl)} ${f(yb)} L ${f(xl)} ${f(s)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(apex)} A ${f(r)} ${f(r)} 0 0 1 ${f(xr)} ${f(s)} L ${f(xr)} ${f(yb)} Z`;
}

/** Diamond lattice lines covering a box (for leaded glass). */
function lattice(x0: number, y0: number, x1: number, y1: number, step: number): string {
  let d = '';
  const h = y1 - y0;
  for (let x = x0 - h; x < x1; x += step) d += `M ${f(x)} ${f(y1)} L ${f(x + h)} ${f(y0)} M ${f(x)} ${f(y0)} L ${f(x + h)} ${f(y1)} `;
  return d.trim();
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `fan-${id}`,
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

function crystalClusterArt(): Art {
  const crystal = (bx: number, by: number, deg: number, len: number, w: number): Item => {
    const tip = w * 1.1;
    const pts: P[] = [[-w, 0], [-w, -len + tip], [0, -len], [w, -len + tip], [w, 0]];
    const map = (q: P) => `${f(q[0] + bx)} ${f(q[1] + by)}`;
    const sil = rotate(`M ${pts.map(map).join(' L ')} Z`, deg, bx, by);
    const facet = rotate(`M ${map([0, -len])} L ${map([-w * 0.25, -len + tip])} L ${map([-w * 0.25, 0])} M ${map([-w * 0.25, -len + tip])} L ${map([-w, -len + tip])} M ${map([-w * 0.25, -len + tip])} L ${map([w, -len + tip])}`, deg, bx, by);
    return { sil, d: [facet] };
  };
  const rocks = smooth([[70, 320], [110, 296], [170, 304], [230, 296], [300, 300], [334, 318], [320, 340], [200, 346], [84, 340]]);
  return join(
    layered([
      crystal(150, 322, -12, 70, 16),
      crystal(262, 324, 18, 80, 18),
      crystal(200, 318, 0, 220, 34),
      crystal(232, 314, 30, 150, 24),
      crystal(168, 316, -28, 160, 26),
      crystal(120, 318, -50, 100, 18),
      crystal(290, 318, 52, 90, 16),
      { sil: rocks, d: ['M 110 318 Q 130 312 150 320', 'M 250 326 Q 280 318 300 326'] },
    ]),
    { p: [], d: [sparkle(84, 110, 14), sparkle(320, 130, 11), sparkle(340, 220, 8), sparkle(60, 220, 9)] },
  );
}

function potionBottlesArt(): Art {
  // round flask (left), tall bottle (middle back), cone flask (right front)
  const flask = [circle(124, 268, 64), R(110, 172, 28, 44), rrect(104, 162, 40, 12, 4)];
  const cork1 = rrect(112, 142, 24, 22, 4);
  const tall = 'M 196 344 L 196 172 Q 196 148 214 140 L 214 98 L 246 98 L 246 140 Q 264 148 264 172 L 264 344 Z';
  const cork2 = rrect(220, 74, 20, 26, 4);
  const cone = 'M 276 236 L 276 268 L 236 344 L 356 344 L 316 268 L 316 236 Z';
  const lip = rrect(270, 228, 52, 10, 4);
  const cork3 = poly([[284, 228], [282, 208], [310, 208], [308, 228]]);
  const label = rrect(206, 220, 48, 56, 6);
  return join(
    layered([
      { sil: cork3 },
      { sil: lip },
      { sil: cone, d: [inside('M 250 318 Q 268 310 284 318 Q 300 326 316 318 Q 332 310 344 318', cone), circle(290, 330, 4), circle(304, 300, 3), circle(280, 286, 2.5)] },
      { sil: flask, d: [inside('M 60 268 Q 80 258 100 268 Q 120 278 140 268 Q 160 258 190 268', circle(124, 268, 64)), circle(110, 300, 5), circle(140, 290, 3.5), circle(124, 312, 3), 'M 84 240 Q 92 222 108 216'] },
      { sil: cork1, d: ['M 118 150 L 130 150'] },
      { sil: label, p: [], d: [star(230, 248, 12, 5, 5)] },
      { sil: tall, d: ['M 196 200 Q 214 192 230 200 Q 246 208 264 200', 'M 254 300 L 254 330'] },
      { sil: cork2 },
      { sil: '', p: ['M 40 344 L 360 344'] },
    ]),
    { p: [], d: [sparkle(80, 120, 10), sparkle(320, 150, 12), sparkle(300, 70, 7)] },
  );
}

function wizardHatArt(): Art {
  const cone = 'M 104 300 Q 160 230 182 130 Q 194 76 252 66 Q 276 64 286 84 Q 252 80 236 110 Q 226 200 296 300 Q 200 332 104 300 Z';
  const brim = ellipse(200, 312, 156, 40);
  const band = 'M 118 282 Q 200 310 282 282';
  return join(
    layered([
      { sil: cone, p: [band], d: [star(200, 236, 16, 7, 5), star(170, 180, 9, 4, 5), star(222, 160, 7, 3, 5), crescent(196, 116, 14, 203, 111, 12)] },
      { sil: brim },
      { sil: '', p: [circle(290, 86, 8)] },
    ]),
    { p: [], d: [sparkle(70, 140, 12), sparkle(330, 170, 10), sparkle(320, 380 - 20, 8)] },
  );
}

function moonMobileArt(): Art {
  const moonShape = crescent(166, 230, 96, 210, 200, 84);
  const strings = [line(120, 84, 120, 147), line(66, 84, 66, 148), line(262, 84, 262, 150), line(306, 84, 306, 232), line(350, 84, 350, 170)];
  const bar = 'M 40 88 Q 200 72 366 88';
  return join(
    { p: [moonShape, bar, ...strings, circle(200, 70, 6), line(200, 64, 200, 24)], d: [] },
    layered([{ sil: star(66, 166, 18, 8, 5) }, { sil: star(262, 168, 18, 8, 5) }, { sil: star(306, 256, 24, 11, 5) }, { sil: star(350, 186, 15, 7, 5) }]),
    { p: [], d: ['M 96 260 Q 104 278 120 282', circle(110, 214, 6), circle(96, 186, 3.5), circle(138, 300, 4.5), sparkle(250, 330, 10), sparkle(60, 340, 10), sparkle(340, 330, 8)] },
  );
}

function dragonEggArt(): Art {
  const egg = 'M 200 70 C 262 70 300 168 300 236 C 300 296 254 330 200 330 C 146 330 100 296 100 236 C 100 168 138 70 200 70 Z';
  let scales = '';
  for (let r = 0; r < 9; r++) {
    const y = 106 + r * 26;
    const off = (r % 2) * 14;
    for (let x = 80 + off; x < 320; x += 28) scales += `M ${x} ${y} Q ${x + 14} ${y + 20} ${x + 28} ${y} `;
  }
  const stones = [
    smooth([[60, 330], [100, 300], [150, 318], [140, 350], [80, 354]]),
    smooth([[150, 334], [200, 316], [256, 330], [246, 356], [160, 358]]),
    smooth([[250, 330], [300, 302], [344, 320], [336, 352], [262, 356]]),
  ];
  return join(
    layered([
      { sil: stones[1] },
      { sil: stones[0] },
      { sil: stones[2] },
      { sil: egg, d: [inside(scales.trim(), egg), 'M 140 140 Q 150 112 170 98'] },
    ]),
    { p: ['M 40 356 L 360 356'], d: [sparkle(80, 110, 12), sparkle(322, 90, 10), sparkle(330, 220, 8)] },
  );
}

function hourglassArt(): Art {
  const top = rrect(110, 54, 180, 22, 8);
  const bottom = rrect(110, 324, 180, 22, 8);
  const glass = 'M 136 76 C 136 150 194 170 194 200 C 194 230 136 250 136 324 L 264 324 C 264 250 206 230 206 200 C 206 170 264 150 264 76 Z';
  const post = (x: number) => `M ${x - 5} 76 L ${x - 5} 324 L ${x + 5} 324 L ${x + 5} 76 Z`;
  const posts = [post(122), post(278)];
  return join(
    layered([
      { sil: top, d: [line(120, 65, 280, 65)] },
      { sil: bottom, d: [line(120, 335, 280, 335)] },
      { sil: posts, d: ['M 117 120 L 127 120 M 117 280 L 127 280 M 273 120 L 283 120 M 273 280 L 283 280'] },
      {
        sil: glass,
        p: ['M 146 130 Q 200 140 254 130', 'M 156 324 Q 170 280 200 270 Q 230 280 244 324'],
        d: [line(200, 200, 200, 268), 'M 160 100 Q 156 120 166 140', 'M 166 300 Q 162 312 164 320'],
      },
    ]),
    { p: [], d: [sparkle(70, 160, 12), sparkle(330, 120, 10), sparkle(340, 260, 8)] },
  );
}

function runeStonesArt(): Art {
  const pouch = 'M 110 210 Q 70 260 90 320 Q 110 350 170 350 Q 220 350 236 320 Q 250 260 206 210 Q 230 190 212 178 Q 158 196 104 178 Q 90 192 110 210 Z';
  const tie = 'M 112 208 Q 158 220 206 208';
  const stone = (cx: number, cy: number, rx: number, ry: number, rot: number) =>
    rotate(smooth([[cx - rx, cy], [cx - rx * 0.6, cy - ry], [cx + rx * 0.5, cy - ry * 0.96], [cx + rx, cy - ry * 0.1], [cx + rx * 0.6, cy + ry], [cx - rx * 0.5, cy + ry * 0.92]]), rot, cx, cy);
  const glyphs = [
    // invented marks
    (x: number, y: number) => `M ${x} ${y - 16} L ${x} ${y + 16} M ${x} ${y - 4} L ${x + 10} ${y - 14} M ${x} ${y + 4} L ${x - 10} ${y + 14}`,
    (x: number, y: number) => `${circle(x, y, 9)} M ${x} ${y - 18} L ${x} ${y - 9} M ${x} ${y + 9} L ${x} ${y + 18}`,
    (x: number, y: number) => `M ${x} ${y} Q ${x + 6} ${y - 4} ${x + 2} ${y - 9} Q ${x - 8} ${y - 12} ${x - 11} ${y - 1} Q ${x - 12} ${y + 13} ${x + 3} ${y + 14} Q ${x + 16} ${y + 12} ${x + 14} ${y - 4}`,
    (x: number, y: number) => `M ${x - 12} ${y - 8} Q ${x - 6} ${y - 14} ${x} ${y - 8} Q ${x + 6} ${y - 2} ${x + 12} ${y - 8} M ${x - 12} ${y + 6} Q ${x - 6} ${y} ${x} ${y + 6} Q ${x + 6} ${y + 12} ${x + 12} ${y + 6}`,
    (x: number, y: number) => `M ${x - 4} ${y - 14} Q ${x + 14} ${y} ${x - 4} ${y + 14} Q ${x + 4} ${y} ${x - 4} ${y - 14} Z ${circle(x - 10, y, 2.5)}`,
    (x: number, y: number) => `M ${x} ${y - 15} L ${x} ${y + 15} M ${x - 12} ${y - 6} L ${x + 12} ${y + 6} M ${x + 12} ${y - 6} L ${x - 12} ${y + 6}`,
  ];
  const stones: [number, number, number, number, number][] = [
    [270, 318, 38, 30, 8],
    [196, 330, 34, 26, -6],
    [330, 250, 32, 26, 14],
    [270, 222, 30, 25, -10],
    [326, 336, 26, 22, 20],
    [160, 268, 30, 24, 4],
  ];
  const items: Item[] = stones.map(([x, y, rx, ry, rot], i) => ({ sil: stone(x, y, rx, ry, rot), p: [glyphs[i](x, y)] }));
  return join(
    layered([...items, { sil: pouch, p: [tie], d: ['M 120 300 Q 140 330 170 334', 'M 214 226 Q 220 260 214 290', 'M 130 236 Q 124 260 128 284'] }, { sil: '', p: ['M 150 186 Q 140 160 122 162 M 168 188 Q 176 160 196 166'] }]),
    { p: ['M 40 360 L 370 360'], d: [sparkle(60, 120, 12), sparkle(320, 110, 10), sparkle(250, 150, 7)] },
  );
}

function broomArt(): Art {
  // drawn upright, then tilted
  const handle = 'M 194 30 Q 192 24 200 22 Q 208 24 206 30 L 208 236 L 192 236 Z';
  const bind = rrect(176, 230, 48, 22, 6);
  const bristles = 'M 180 252 Q 150 300 120 368 Q 160 376 200 372 Q 240 376 280 368 Q 250 300 220 252 Z';
  const bow = 'M 200 241 Q 176 222 168 240 Q 176 256 200 241 Z M 200 241 Q 224 222 232 240 Q 224 256 200 241 Z M 200 241 L 190 270 M 200 241 L 212 272';
  const lines: string[] = [];
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    lines.push(`M ${f(184 + 32 * t)} 256 Q ${f(170 + 60 * t)} 300 ${f(128 + 144 * t)} 362`);
  }
  const art = layered([
    { sil: '', p: [bow] },
    { sil: bind, d: [line(176, 241, 224, 241)] },
    { sil: handle, d: ['M 197 80 Q 202 84 197 88', 'M 203 150 Q 198 154 203 158'] },
    { sil: bristles, d: lines },
  ]);
  const tilt = (d: string) => mapPath(rotate(d, 28, 200, 200), { map: (x, y) => [200 + (x - 200) * 0.9, 186 + (y - 200) * 0.9], scale: 0.9, rotate: 0, flip: false });
  return join({ p: art.p.map(tilt), d: art.d.map(tilt) }, { p: [], d: [sparkle(80, 90, 14), sparkle(110, 150, 8), sparkle(320, 110, 10), star(300, 300, 12, 5, 5), star(70, 260, 9, 4, 5)] });
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function spellBookArt(): Art {
  const cover = 'M 40 288 Q 120 264 200 296 Q 280 264 360 288 L 360 304 Q 280 280 200 312 Q 120 280 40 304 Z';
  const left = 'M 52 284 L 64 150 Q 132 128 200 160 L 200 296 Q 128 262 52 284 Z';
  const right = 'M 348 284 L 336 150 Q 268 128 200 160 L 200 296 Q 272 262 348 284 Z';
  const textLines: string[] = [];
  for (let k = 0; k < 7; k++) {
    const y = 172 + k * 14;
    textLines.push(`M 222 ${y} Q 270 ${y - 12} ${k === 6 ? 290 : 322} ${y - 6}`);
  }
  const ribbon = 'M 196 296 L 190 352 L 200 344 L 210 352 L 204 296';
  const pages = ['M 48 292 Q 124 270 200 302', 'M 352 292 Q 276 270 200 302'];
  return join(
    layered([
      { sil: '', p: [ribbon] },
      { sil: left, d: [circle(128, 214, 34), star(128, 214, 30, 12, 5), circle(128, 214, 40), 'M 80 170 Q 100 160 120 164'] },
      { sil: right, d: textLines },
      { sil: cover, d: pages },
    ]),
    {
      p: [],
      d: [sparkle(200, 80, 16), sparkle(150, 100, 9), sparkle(256, 104, 11), 'M 200 140 Q 190 120 200 106', 'M 170 140 Q 160 124 168 110', 'M 232 140 Q 240 126 234 114', star(100, 70, 9, 4, 5), star(304, 70, 10, 4, 5)],
    },
  );
}

function magicLanternArt(): Art {
  const ring = circle(200, 40, 12);
  const cap = 'M 140 120 L 166 76 L 234 76 L 260 120 Z';
  const finial = 'M 186 76 Q 200 54 214 76 Z';
  const body = 'M 148 120 L 252 120 L 244 290 L 156 290 Z';
  const base = poly([[136, 290], [264, 290], [252, 314], [148, 314]]);
  const foot = rrect(166, 314, 68, 14, 5);
  const pane = 'M 174 134 L 226 134 L 222 276 L 178 276 Z';
  const flame = 'M 200 168 C 216 196 224 216 214 236 C 208 248 192 248 186 236 C 176 216 184 196 200 168 Z';
  const inner = 'M 200 196 C 206 212 208 222 204 232 C 202 238 198 238 196 232 C 192 222 194 212 200 196 Z';
  return join(
    layered([
      { sil: finial },
      { sil: ring },
      { sil: cap, d: ['M 152 112 L 248 112', line(190, 76, 180, 120), line(210, 76, 220, 120)] },
      { sil: foot },
      { sil: base, d: ['M 146 300 L 254 300'] },
      { sil: body, p: [pane, flame], d: [inner, line(162, 134, 166, 276), line(238, 134, 234, 276), 'M 180 260 L 220 260', 'M 156 136 Q 160 160 156 184 M 244 136 Q 240 160 244 184'] },
    ]),
    {
      p: [line(200, 28, 200, 16)],
      d: ['M 120 200 L 96 200', 'M 128 160 L 106 146', 'M 128 240 L 106 254', 'M 280 200 L 304 200', 'M 272 160 L 294 146', 'M 272 240 L 294 254', sparkle(80, 100, 12), sparkle(320, 96, 10), sparkle(330, 320, 9), sparkle(70, 320, 8)],
    },
  );
}

function toadstoolCottageArt(): Art {
  const cap = 'M 70 196 C 60 110 140 56 206 56 C 280 56 344 110 336 196 C 300 216 110 216 70 196 Z';
  const stem = 'M 130 206 C 132 260 120 316 112 340 L 298 340 C 286 316 276 260 278 206 Z';
  const door = 'M 182 340 L 182 282 C 182 256 230 256 230 282 L 230 340 Z';
  const win1 = circle(150, 264, 16);
  const win2 = circle(256, 250, 14);
  const chimney = 'M 260 74 L 262 40 L 284 40 L 286 86 Z';
  const spots = [ellipse(130, 140, 20, 14), ellipse(196, 100, 24, 15), ellipse(270, 128, 20, 13), ellipse(310, 176, 12, 9), ellipse(98, 180, 11, 8), ellipse(220, 166, 16, 10)];
  const small = ['M 40 340 C 36 312 76 300 84 324 C 78 330 50 332 40 340 Z', 'M 58 330 L 58 340 L 66 340 L 66 330'];
  const stones = [ellipse(206, 352, 20, 6), ellipse(180, 366, 18, 6), ellipse(214, 376, 16, 5)];
  return join(
    layered([
      { sil: '', p: ['M 272 34 Q 262 26 274 20'] },
      { sil: chimney },
      { sil: cap, p: spots, d: ['M 110 200 Q 200 186 300 200'] },
      { sil: stem, p: [door, win1, win2], d: [line(150, 248, 150, 280), line(134, 264, 166, 264), line(256, 236, 256, 264), line(242, 250, 270, 250), circle(222, 306, 3), 'M 140 222 Q 136 280 128 330', 'M 266 300 Q 268 320 272 334'] },
      { sil: '', p: small },
      { sil: '', p: ['M 24 340 L 112 340 M 298 340 L 376 340'], d: ['M 300 340 L 306 326 L 312 340 M 330 340 L 336 330 L 342 340 M 88 340 L 94 328 L 100 340'] },
    ]),
    { p: stones, d: [sparkle(60, 80, 10), sparkle(350, 70, 12)] },
  );
}

function crystalBallArt(): Art {
  const orb = circle(200, 168, 96);
  const cup = 'M 138 236 Q 200 286 262 236 L 270 262 Q 200 300 130 262 Z';
  const stem = 'M 166 282 Q 176 296 172 314 L 228 314 Q 224 296 234 282 Q 200 300 166 282 Z';
  const base = rrect(124, 314, 152, 28, 10);
  const plinth = rrect(108, 342, 184, 18, 6);
  const swirl = 'M 150 190 Q 160 140 210 150 Q 250 160 240 196 Q 230 224 200 212 Q 180 202 192 186';
  return join(
    layered([
      { sil: cup, d: ['M 150 250 Q 200 280 250 250'] },
      { sil: orb, d: [swirl, 'M 130 120 Q 146 92 176 82', star(244, 126, 10, 4, 5), star(166, 228, 7, 3, 5), circle(256, 210, 3), circle(140, 160, 2.5)] },
      { sil: stem },
      { sil: base, d: ['M 132 328 L 268 328', circle(200, 328, 5)] },
      { sil: plinth },
    ]),
    { p: [], d: [sparkle(70, 70, 14), sparkle(330, 80, 10), sparkle(330, 250, 9), sparkle(64, 230, 8)] },
  );
}

function enchantedMirrorArt(): Art {
  const frame = ellipse(200, 176, 92, 128);
  const glass = ellipse(200, 176, 76, 112);
  const crest = crescent(200, 34, 18, 208, 28, 15);
  const posts = [R(94, 160, 10, 200), R(296, 160, 10, 200)];
  const feet = [rrect(70, 356, 58, 12, 5), rrect(272, 356, 58, 12, 5)];
  const pins = [circle(99, 170, 7), circle(301, 170, 7)];
  const scroll = (x: number, s: number) => `M ${x} 300 Q ${x + 26 * s} 296 ${x + 30 * s} 316 Q ${x + 32 * s} 334 ${x + 16 * s} 332 Q ${x + 6 * s} 328 ${x + 12 * s} 318`;
  return join(
    layered([
      { sil: pins },
      { sil: crest },
      { sil: [frame], p: [glass], d: ['M 160 100 L 140 140', 'M 182 92 L 140 176', 'M 250 230 L 230 268'] },
      { sil: posts },
      { sil: feet },
      { sil: '', p: [line(104, 340, 296, 340)], d: [scroll(150, -1), scroll(250, 1)] },
    ]),
    {
      p: [],
      d: [sparkle(226, 120, 12), sparkle(170, 230, 8), star(200, 54, 6, 2.5, 5), 'M 186 300 Q 200 312 214 300', sparkle(50, 80, 10), sparkle(350, 70, 10)],
    },
  );
}

function cauldronArt(): Art {
  const rim = ellipse(200, 164, 112, 22);
  const mouth = ellipse(200, 164, 96, 14);
  const pot = 'M 96 170 C 70 236 100 300 200 304 C 300 300 330 236 304 170 Z';
  const legs = ['M 128 286 L 118 320 L 136 320 L 146 294 Z', 'M 272 286 L 282 320 L 264 320 L 254 294 Z'];
  const ears = [circle(88, 200, 12), circle(312, 200, 12)];
  const logs = [rotate(rrect(110, 332, 180, 18, 9), -8, 200, 341), rotate(rrect(110, 332, 180, 18, 9), 8, 200, 341)];
  const flame = (x: number, h: number) => `M ${x} ${330 - h} C ${x + h * 0.4} ${330 - h * 0.5} ${x + h * 0.36} 330 ${x} 330 C ${x - h * 0.36} 330 ${x - h * 0.4} ${330 - h * 0.5} ${x} ${330 - h} Z`;
  const bubbles = [circle(166, 140, 14), circle(204, 128, 18), circle(240, 144, 11), circle(186, 104, 8), circle(226, 98, 6)];
  return join(
    layered([
      { sil: bubbles, d: ['M 198 120 Q 202 114 208 116'] },
      { sil: rim },
      { sil: '', p: [mouth] },
      { sil: pot, d: ['M 120 214 Q 200 236 280 214', 'M 128 260 Q 116 240 120 220'] },
      { sil: legs },
      { sil: ears },
      { sil: [flame(170, 34), flame(200, 46), flame(230, 32)] },
      { sil: logs, d: [ellipse(116, 346, 4, 7), ellipse(284, 346, 4, 7)] },
    ]),
    { p: [], d: ['M 150 80 Q 140 60 156 48', 'M 248 70 Q 260 52 248 36', sparkle(80, 90, 12), sparkle(330, 100, 10), 'M 40 360 L 360 360'] },
  );
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function floatingIslandArt(): Art {
  const top = smooth([[70, 200], [120, 186], [200, 180], [290, 186], [338, 202], [300, 214], [200, 220], [100, 214]]);
  const under = 'M 70 204 L 92 236 L 110 232 L 126 270 L 148 262 L 166 318 L 184 300 L 200 360 L 216 304 L 238 322 L 250 266 L 274 274 L 290 238 L 310 242 L 336 206 Z';
  const house = [poly([[160, 200], [160, 160], [196, 160], [196, 200]]), poly([[152, 162], [178, 130], [204, 162]])];
  const tree = [R(256, 160, 8, 40), circle(260, 136, 30)];
  const fall = 'M 112 210 L 106 300 L 122 300 L 124 212 Z';
  const rock1 = poly([[44, 120], [70, 112], [80, 126], [66, 144], [52, 138]]);
  const rock2 = poly([[320, 100], [350, 96], [356, 112], [338, 128], [324, 120]]);
  const cracks = ['M 110 240 L 124 262 L 120 280', 'M 170 240 L 178 270 L 172 296', 'M 220 238 L 214 270 L 222 300', 'M 260 240 L 268 262', 'M 300 222 L 292 236', 'M 196 300 L 200 340'];
  const grass = 'M 92 196 L 96 186 L 100 196 M 222 182 L 226 172 L 230 182 M 300 190 L 304 180 L 308 190 M 132 186 L 136 176 L 140 186';
  return join(
    layered([
      { sil: house, p: [R(170, 178, 14, 22), R(184, 168, 8, 8)], d: [line(178, 130, 178, 116)] },
      { sil: tree, d: ['M 244 128 Q 252 120 262 124', 'M 262 148 Q 272 142 280 148'] },
      { sil: fall, d: ['M 112 220 L 110 296', 'M 118 220 L 117 296'] },
      { sil: top, d: [grass] },
      { sil: under, d: cracks },
      { sil: rock1, d: ['M 56 124 L 64 134'] },
      { sil: rock2 },
    ]),
    {
      p: ['M 96 300 Q 100 290 106 300 Q 114 288 122 300 Q 130 292 132 304'],
      d: [
        'M 30 330 Q 50 312 74 322 Q 90 306 112 318 Q 132 314 136 330 Z',
        'M 264 350 Q 284 334 306 342 Q 322 328 344 340 Q 364 340 366 354 Z',
        'M 300 50 Q 316 34 336 44 Q 350 36 366 50',
        sparkle(60, 60, 12),
        sparkle(200, 40, 9),
        sparkle(150, 70, 6),
        star(360, 200, 9, 4, 5),
        star(40, 230, 7, 3, 5),
      ],
    },
  );
}

function sleepingDragonArt(): Art {
  // a dragon curled asleep on a mound of coins, head resting at the front, tail wrapped round
  const mound = 'M 40 350 Q 60 320 140 302 Q 250 288 330 304 Q 356 320 362 350 Z';
  const body = smooth([[150, 252], [172, 214], [232, 198], [302, 210], [342, 246], [332, 282], [270, 298], [190, 294], [154, 278]]);
  const neck = tube([[214, 244], [176, 252], [146, 268], [122, 288]], (t) => 26 - 6 * t);
  const head = smooth([[50, 302], [58, 286], [84, 272], [120, 268], [144, 280], [146, 302], [122, 316], [80, 318], [54, 312]]);
  const horn = (x: number, y: number, len: number) => `M ${x} ${y} Q ${x + len * 0.6} ${y - len * 0.5} ${x + len} ${y - len * 0.3} Q ${x + len * 0.55} ${y - len * 0.2} ${x + 8} ${y + 10} Z`;
  const tailC: P[] = [[322, 278], [350, 302], [344, 328], [296, 340], [226, 344], [168, 338]];
  const tail = tube(tailC, (t) => 20 - 16 * t);
  const wing = 'M 184 232 Q 196 168 252 140 Q 250 168 264 182 Q 292 172 322 188 Q 304 202 310 226 Q 284 218 266 234 Q 242 222 222 240 Q 204 230 184 232 Z';
  const spikes: string[] = [];
  for (const [x, y] of [[300, 210], [322, 222], [338, 240]] as const) spikes.push(poly([[x - 10, y + 4], [x + 6, y - 14], [x + 8, y + 6]]));
  let coins = '';
  for (const [x, y] of [[60, 336], [96, 322], [230, 314], [300, 318], [352, 338], [240, 334], [120, 340]] as const) coins += `${ellipse(x, y, 10, 3.5)} `;
  return join(
    layered([
      { sil: head, p: ['M 102 288 Q 112 296 124 288'], d: ['M 60 292 Q 64 288 70 292', 'M 56 308 Q 90 312 128 304'] },
      { sil: [horn(118, 274, 46), horn(130, 282, 40)] },
      { sil: tail, d: ['M 340 312 Q 330 326 300 332', 'M 250 334 Q 220 338 196 334'] },
      { sil: neck, d: ['M 168 266 Q 156 272 148 282', 'M 190 262 Q 176 266 166 272'] },
      { sil: wing, d: ['M 252 140 L 266 234', 'M 252 140 L 222 240', 'M 252 140 L 310 226'] },
      { sil: body, d: ['M 200 288 Q 250 296 300 286', 'M 210 278 L 214 290 M 240 282 L 242 294 M 270 280 L 272 292'] },
      { sil: spikes },
      { sil: mound, d: [coins.trim()] },
    ]),
    { p: [], d: ['M 46 276 Q 34 258 46 244 Q 58 230 48 214', 'M 70 196 L 84 196 L 70 210 L 84 210', 'M 96 168 L 106 168 L 96 178 L 106 178', 'M 112 140 L 118 140 L 112 146 L 118 146', sparkle(330, 90, 12), sparkle(250, 70, 8), sparkle(40, 110, 9)] },
  );
}

function sunAndMoonArt(): Art {
  const c: P = [200, 200];
  const disc = circle(200, 200, 82);
  const ringIn = circle(200, 200, 94);
  const rays: string[] = [];
  const rayD: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = i * 15;
    const long = i % 2 === 0;
    const len = long ? (i % 4 === 0 ? 176 : 156) : 128;
    const half = long ? 7 : 5;
    rays.push(poly([polar(c[0], c[1], 98, a - half), polar(c[0], c[1], len, a), polar(c[0], c[1], 98, a + half)]));
    if (long) rayD.push(line(...polar(c[0], c[1], 102, a), ...polar(c[0], c[1], len - 22, a)));
  }
  const terminator = clip(circle(236, 186, 74), [region(disc)], 'inside');
  const sunDots: string[] = [];
  for (let k = 0; k < 8; k++) sunDots.push(circle(...polar(200, 200, 72, 20 + k * 20), 2.2));
  return {
    p: [disc, ringIn, ...rays, terminator],
    d: [
      ...rayD,
      star(170, 172, 10, 4, 5),
      star(156, 226, 7, 3, 5),
      star(186, 254, 6, 2.5, 5),
      sparkle(146, 194, 6),
      inside(sunDots.join(' '), circle(236, 186, 74)),
      circle(200, 200, 88),
      sparkle(46, 46, 14),
      sparkle(354, 46, 12),
      sparkle(46, 354, 12),
      sparkle(354, 354, 14),
    ],
  };
}

function gothicWindowArt(): Art {
  const r = 160;
  const outer = pointed(70, 330, 214, 350, r);
  const inner = pointed(90, 310, 214, 330, r - 20);
  const lancetL = pointed(110, 192, 236, 318, 54);
  const lancetR = pointed(208, 290, 236, 318, 54);
  const ocCx = 200;
  const ocCy = 142;
  const oculus = circle(ocCx, ocCy, 34);
  const foil = union([circle(ocCx, ocCy - 13, 13), circle(ocCx + 13, ocCy, 13), circle(ocCx, ocCy + 13, 13), circle(ocCx - 13, ocCy, 13)]);
  const sill = rrect(54, 350, 292, 16, 4);
  const lat = (shape: string, x0: number, x1: number) => inside(lattice(x0, 170, x1, 318, 20), shape);
  // voussoirs: radial joints between the outer and inner arch (both arcs share their centres)
  const vous: string[] = [];
  const apexDeg = (Math.acos((200 - (70 + r)) / r) * 180) / Math.PI; // angle of the apex seen from the left arc's centre
  for (let k = 1; k < 7; k++) {
    const a = 180 - ((180 - apexDeg) * k) / 7;
    const rad = (a * Math.PI) / 180;
    for (const [cx, sx] of [[70 + r, 1], [330 - r, -1]] as const) {
      const pOut: P = [cx + sx * Math.cos(rad) * r, 214 - Math.sin(rad) * r];
      const pIn: P = [cx + sx * Math.cos(rad) * (r - 20), 214 - Math.sin(rad) * (r - 20)];
      vous.push(line(pOut[0], pOut[1], pIn[0], pIn[1]));
    }
  }
  const blocks: string[] = [];
  for (let y = 236; y < 350; y += 26) blocks.push(`M 70 ${y} L 90 ${y} M 310 ${y} L 330 ${y}`);
  return {
    p: [outer, inner, lancetL, lancetR, oculus, foil, sill, line(200, 236, 200, 330)],
    d: [lat(lancetL, 110, 192), lat(lancetR, 208, 290), ...vous, ...blocks, circle(ocCx, ocCy, 5), line(54, 358, 346, 358), 'M 30 376 L 370 376'],
  };
}


// ---- catalogue ------------------------------------------------------------------------------------------------

export const fantasy2: Template[] = [
  // beginner
  tpl('crystal-cluster', 'Crystal cluster', 'beginner', ['crystal', 'gem', 'magic', 'mineral', 'sparkle'], crystalClusterArt()),
  tpl('potion-bottles', 'Three potion bottles', 'beginner', ['potion', 'bottles', 'magic', 'flask', 'witch'], potionBottlesArt()),
  tpl('wizard-hat', 'Starry wizard hat', 'beginner', ['wizard', 'hat', 'stars', 'moon', 'magic'], wizardHatArt()),
  tpl('moon-mobile', 'Moon and stars mobile', 'beginner', ['moon', 'stars', 'mobile', 'night', 'dreamy'], moonMobileArt()),
  tpl('dragon-egg', 'Dragon egg in a stone nest', 'beginner', ['dragon', 'egg', 'scales', 'nest', 'magic'], dragonEggArt()),
  tpl('hourglass', 'Magic hourglass', 'beginner', ['hourglass', 'sand', 'time', 'magic', 'vintage'], hourglassArt()),
  tpl('rune-stones', 'Rune stones and pouch', 'beginner', ['rune', 'stones', 'pouch', 'magic', 'mystic'], runeStonesArt()),
  tpl('witch-broom', 'Witch’s broom', 'beginner', ['witch', 'broom', 'halloween', 'magic', 'stars'], broomArt()),
  // intermediate
  tpl('spell-book', 'Open spell book', 'intermediate', ['spell', 'book', 'magic', 'sparkle', 'stars'], spellBookArt()),
  tpl('magic-lantern', 'Glowing magic lantern', 'intermediate', ['lantern', 'magic', 'flame', 'night', 'glow'], magicLanternArt()),
  tpl('toadstool-cottage', 'Toadstool cottage', 'intermediate', ['mushroom', 'toadstool', 'cottage', 'woodland', 'whimsical'], toadstoolCottageArt()),
  tpl('crystal-ball', 'Crystal ball on a stand', 'intermediate', ['crystal', 'orb', 'fortune', 'magic', 'stars'], crystalBallArt()),
  tpl('enchanted-mirror', 'Enchanted standing mirror', 'intermediate', ['mirror', 'enchanted', 'moon', 'magic', 'vintage'], enchantedMirrorArt()),
  tpl('cauldron', 'Cauldron over a log fire', 'intermediate', ['cauldron', 'potion', 'fire', 'witch', 'halloween'], cauldronArt()),
  // advanced
  tpl('floating-island', 'Floating island in the sky', 'advanced', ['island', 'magic', 'clouds', 'waterfall', 'cottage', 'whimsical'], floatingIslandArt()),
  tpl('sleeping-dragon', 'Dragon asleep on gold', 'advanced', ['dragon', 'treasure', 'gold', 'sleeping', 'wings'], sleepingDragonArt()),
  tpl('sun-and-moon', 'Celestial sun and moon', 'advanced', ['celestial', 'sun', 'moon', 'stars', 'mystic', 'ornamental'], sunAndMoonArt()),
  tpl('gothic-window', 'Gothic arch window', 'advanced', ['gothic', 'window', 'arch', 'tracery', 'stone', 'architecture'], gothicWindowArt()),
];
