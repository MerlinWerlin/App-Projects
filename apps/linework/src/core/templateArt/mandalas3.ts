// mandalas3 template batch (fb-1023b T136, 23 Oct 2026): original mandalas, rosettes, compass roses, sacred-geometry
// constructions and geometric star tilings on a 400×400 canvas, from beginner (a few bold rings) to advanced (layered
// lace). All geometry is generated here around the canvas centre (200, 200); compass letters come from the skeleton
// capitals in lettering2.ts.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, f, line, ngon, petal, polar, poly, ring, rotate, star, type P } from './draw.ts';
import { clip, region } from './occlude.ts';
import { mono, placeC } from './lettering2.ts';

const VB = '0 0 400 400';
const C = 200;

function T(id: string, name: string, level: TemplateLevel, tags: string[], paths: string[], detail: string[] = [], strokeWidth = 3): Template {
  const t: Template = { id: `mand2-${id}`, name, category: 'mandalas', level, tags, viewBox: VB, paths, strokeWidth };
  if (detail.length) {
    t.detail = detail;
    t.detailWidth = 1.6;
  }
  return t;
}

/** Dots on a circle. */
const dots = (r: number, n: number, size: number, offset = 0): string =>
  Array.from({ length: n }, (_, i) => {
    const [x, y] = polar(C, C, r, offset + (360 * i) / n);
    return circle(x, y, size);
  }).join(' ');

/** Scalloped ring: n outward half-round bumps sitting on radius r. */
function scallops(r: number, n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = polar(C, C, r, (360 * i) / n);
    const p1 = polar(C, C, r, (360 * (i + 1)) / n);
    const b = Math.PI * r / n;
    parts.push(`M ${f(p0[0])} ${f(p0[1])} A ${f(b)} ${f(b)} 0 0 1 ${f(p1[0])} ${f(p1[1])}`);
  }
  return parts.join(' ');
}

/** Pointed arch between two angles at radius r0 rising to a point at r1. */
function arch(r0: number, r1: number, from: number, to: number): string {
  const a = polar(C, C, r0, from);
  const b = polar(C, C, r0, to);
  const mid = (from + to) / 2;
  const tip = polar(C, C, r1, mid);
  const ca = polar(C, C, r0 + (r1 - r0) * 0.75, from + (mid - from) * 0.1);
  const cb = polar(C, C, r0 + (r1 - r0) * 0.75, to - (to - mid) * 0.1);
  return `M ${f(a[0])} ${f(a[1])} Q ${f(ca[0])} ${f(ca[1])} ${f(tip[0])} ${f(tip[1])} Q ${f(cb[0])} ${f(cb[1])} ${f(b[0])} ${f(b[1])}`;
}
const arches = (r0: number, r1: number, n: number, off = 0): string =>
  Array.from({ length: n }, (_, i) => arch(r0, r1, off + (360 * i) / n, off + (360 * (i + 1)) / n)).join(' ');

/** Ring of petals with their base on radius r0. */
const petals = (r0: number, n: number, len: number, w: number, off = 0, round = 0.5): string => ring(petal(C, C - r0, 0, len, w, round), n, C, C, off);

/** Midrib lines inside a ring of petals. */
const ribs = (r0: number, n: number, len: number, off = 0): string =>
  Array.from({ length: n }, (_, i) => {
    const a = off + (360 * i) / n;
    const p = polar(C, C, r0 + len * 0.12, a);
    const q = polar(C, C, r0 + len * 0.82, a);
    return line(p[0], p[1], q[0], q[1]);
  }).join(' ');

/** Heart pointing at the centre, its point at radius r0, length len. */
function heartAt(r0: number, len: number, deg: number): string {
  const s = len / 2;
  const cx = C;
  const cy = C - r0 - s;
  const d =
    `M ${f(cx)} ${f(cy + s)} C ${f(cx - s * 1.4)} ${f(cy + s * 0.1)} ${f(cx - s * 1.1)} ${f(cy - s * 1.1)} ${f(cx)} ${f(cy - s * 0.4)} ` +
    `C ${f(cx + s * 1.1)} ${f(cy - s * 1.1)} ${f(cx + s * 1.4)} ${f(cy + s * 0.1)} ${f(cx)} ${f(cy + s)} Z`;
  return rotate(d, deg, C, C);
}

/** Compass letters N E S W at radius r, cap height h. */
function compassLetters(r: number, h: number): string[] {
  return [
    ...mono(placeC('N', C, C - r - h / 2, h, 0)),
    ...mono(placeC('S', C, C + r - h / 2, h, 0)),
    ...mono(placeC('E', C + r, C - h / 2, h, 0)),
    ...mono(placeC('W', C - r, C - h / 2, h, 0)),
  ];
}

/** Compass point: a kite from the centre to radius r with half-width w, split down the middle. */
function kite(r: number, w: number, deg: number, rIn = 0): { p: string; d: string } {
  const tip = polar(C, C, r, deg);
  const l = polar(C, C, w, deg - 90 + (rIn ? 0 : 0));
  const rr = polar(C, C, w, deg + 90);
  const base = polar(C, C, rIn, deg);
  const lp = polar(l[0], l[1], r * 0.18, deg);
  const rp = polar(rr[0], rr[1], r * 0.18, deg);
  return { p: poly([base, lp, tip, rp]), d: line(base[0], base[1], tip[0], tip[1]) };
}

// ---- beginner ----------------------------------------------------------------------------------------

const sixPetal = T(
  'six-petal',
  'Six-petal beginner mandala',
  'beginner',
  ['mandala', 'flower', 'simple', 'relaxing'],
  [circle(C, C, 26), petals(26, 6, 104, 30), petals(70, 6, 70, 18, 30), circle(C, C, 158), dots(144, 12, 6, 15)],
);

const seedPts: P[] = [[C, C], ...Array.from({ length: 6 }, (_, i) => polar(C, C, 64, i * 60))];
const seedOfLife = T(
  'seed-of-life',
  'Seed of life sacred geometry',
  'beginner',
  ['sacred', 'geometric', 'circles', 'spiritual'],
  [...seedPts.map(([x, y]) => circle(x, y, 64)), circle(C, C, 128), circle(C, C, 150), dots(164, 12, 4)],
);

const vesica = T(
  'vesica',
  'Vesica piscis sacred geometry',
  'beginner',
  ['sacred', 'geometric', 'circles', 'minimal'],
  [
    circle(156, C, 88),
    circle(244, C, 88),
    poly([[C, C - 76.2], [C + 44, C], [C, C + 76.2], [C - 44, C]]),
    `${line(C, 30, C, 370)} ${line(30, C, 370, C)}`,
    circle(C, C, 170),
  ],
);

const nested = T(
  'nested-polygons',
  'Nested polygons geometric mandala',
  'beginner',
  ['geometric', 'polygons', 'mandala', 'minimal'],
  [
    ngon(C, C, 170, 8, 22.5),
    ngon(C, C, 150, 7),
    ngon(C, C, 128, 6),
    ngon(C, C, 106, 5, 36),
    ngon(C, C, 84, 4, 45),
    ngon(C, C, 62, 3, 180),
    circle(C, C, 30),
  ],
);

const rosette8 = T(
  'rosette-8',
  'Simple eight-fold rosette',
  'beginner',
  ['rosette', 'mandala', 'star', 'simple'],
  [star(C, C, 156, 100, 8), circle(C, C, 92), petals(20, 8, 64, 15), circle(C, C, 20), circle(C, C, 168), dots(128, 8, 7, 22.5)],
);

const compassSimple = T(
  'compass-simple',
  'Simple compass star',
  'beginner',
  ['compass', 'star', 'navigation', 'geometric'],
  [star(C, C, 140, 26, 4), star(C, C, 86, 22, 4, 45), circle(C, C, 108), circle(C, C, 14), ...compassLetters(170, 26)],
);

const hexagram = T(
  'hexagram',
  'Six-point star geometric mandala',
  'beginner',
  ['geometric', 'star', 'mandala', 'hexagon'],
  [ngon(C, C, 150, 3), ngon(C, C, 150, 3, 180), ngon(C, C, 86.6, 6, 30), circle(C, C, 160), circle(C, C, 50), star(C, C, 34, 14, 6)],
);

const heartRing = T(
  'heart-ring',
  'Heart ring mandala',
  'beginner',
  ['mandala', 'love', 'hearts', 'cute'],
  [
    circle(C, C, 34),
    Array.from({ length: 8 }, (_, i) => heartAt(44, 54, i * 45)).join(' '),
    dots(116, 8, 7, 22.5),
    Array.from({ length: 16 }, (_, i) => heartAt(136, 22, i * 22.5 + 11.25)).join(' '),
    circle(C, C, 168),
    star(C, C, 20, 9, 8),
  ],
);

// ---- intermediate -------------------------------------------------------------------------------------

const lotus10 = T(
  'lotus-10',
  'Ten-fold lotus mandala',
  'intermediate',
  ['mandala', 'lotus', 'flower', 'meditation'],
  [
    circle(C, C, 22),
    petals(22, 10, 56, 13),
    circle(C, C, 76),
    petals(76, 10, 74, 20, 18, 0.45),
    petals(76, 10, 58, 14),
    circle(C, C, 160),
    scallops(160, 30),
  ],
  [ribs(22, 10, 56), ribs(76, 10, 74, 18), dots(150, 10, 4), dots(48, 10, 3, 18), circle(C, C, 12)],
);

const sun16 = T(
  'sun-16',
  'Sixteen-ray sun mandala',
  'intermediate',
  ['mandala', 'sun', 'rays', 'geometric'],
  [
    circle(C, C, 46),
    star(C, C, 34, 22, 8),
    circle(C, C, 58),
    star(C, C, 116, 76, 16, 11.25),
    clip(star(C, C, 152, 96, 16), [region(star(C, C, 116, 76, 16, 11.25))]),
    circle(C, C, 166),
  ],
  [
    dots(176, 32, 3),
    clip(
      Array.from({ length: 16 }, (_, i) => {
        const a = i * 22.5;
        const p = polar(C, C, 104, a);
        const q = polar(C, C, 140, a);
        return line(p[0], p[1], q[0], q[1]);
      }).join(' '),
      [region(star(C, C, 116, 76, 16, 11.25))],
    ),
    Array.from({ length: 16 }, (_, i) => {
      const a = i * 22.5 + 11.25;
      const p = polar(C, C, 70, a);
      const q = polar(C, C, 104, a);
      return line(p[0], p[1], q[0], q[1]);
    }).join(' '),
    circle(C, C, 64),
    dots(70, 16, 2.5, 11.25),
    circle(C, C, 8),
  ],
);

const thirteen: P[] = [[C, C], ...Array.from({ length: 6 }, (_, i) => polar(C, C, 56, i * 60)), ...Array.from({ length: 6 }, (_, i) => polar(C, C, 112, i * 60))];
const thirteenLines: string[] = [];
for (let i = 0; i < thirteen.length; i++) for (let j = i + 1; j < thirteen.length; j++) thirteenLines.push(line(thirteen[i][0], thirteen[i][1], thirteen[j][0], thirteen[j][1]));
const thirteenRegs = thirteen.map(([x, y]) => region(circle(x, y, 26)));
const thirteenCircles = T(
  'thirteen-circles',
  'Thirteen-circle sacred geometry',
  'intermediate',
  ['sacred', 'geometric', 'circles', 'lines'],
  [...thirteen.map(([x, y]) => circle(x, y, 26)), circle(C, C, 160)],
  [clip(thirteenLines.join(' '), thirteenRegs), circle(C, C, 172)],
);

const k16main = [0, 90, 180, 270].map((a) => kite(150, 22, a));
const k16diag = [45, 135, 225, 315].map((a) => kite(108, 16, a));
const k16small = Array.from({ length: 8 }, (_, i) => kite(76, 10, 22.5 + i * 45));
const compassRegs = [...k16main, ...k16diag].map((k) => region(k.p));
const compass16 = T(
  'compass-16',
  'Vintage sixteen-point compass',
  'intermediate',
  ['compass', 'navigation', 'nautical', 'vintage'],
  [
    ...k16main.map((k) => k.p),
    clip(k16diag.map((k) => k.p).join(' '), compassRegs.slice(0, 4)),
    clip(k16small.map((k) => k.p).join(' '), compassRegs),
    clip(`${circle(C, C, 96)} ${circle(C, C, 104)}`, compassRegs),
    circle(C, C, 14),
    ...compassLetters(168, 22),
  ],
  [
    k16main.map((k) => k.d).join(' '),
    k16diag.map((k) => k.d).join(' '),
    clip(
      Array.from({ length: 64 }, (_, i) => {
        const a = (360 * i) / 64;
        const p = polar(C, C, 122, a);
        const q = polar(C, C, i % 4 === 0 ? 134 : 128, a);
        return line(p[0], p[1], q[0], q[1]);
      }).join(' '),
      compassRegs,
    ),
    clip(`${circle(C, C, 120)} ${circle(C, C, 136)}`, compassRegs),
  ],
);

/** Eight-point star made of two overlapping squares, as one outline (star polygon). */
const star8 = (cx: number, cy: number, r: number): string => star(cx, cy, r, r * 0.7654, 8, 22.5);
const tileStep = 80;
const starTiling = T(
  'star-tiling',
  'Eight-point star geometric tiling',
  'intermediate',
  ['geometric', 'tiling', 'star', 'pattern'],
  [
    poly([[40, 40], [360, 40], [360, 360], [40, 360]]),
    Array.from({ length: 16 }, (_, k) => star8(80 + (k % 4) * tileStep, 80 + Math.floor(k / 4) * tileStep, 34)).join(' '),
    // crosses between the stars
    Array.from({ length: 9 }, (_, k) => {
      const x = 120 + (k % 3) * tileStep;
      const y = 120 + Math.floor(k / 3) * tileStep;
      return ngon(x, y, 16, 4);
    }).join(' '),
  ],
  [
    Array.from({ length: 16 }, (_, k) => ngon(80 + (k % 4) * tileStep, 80 + Math.floor(k / 4) * tileStep, 14, 8, 22.5)).join(' '),
    Array.from({ length: 9 }, (_, k) => circle(120 + (k % 3) * tileStep, 120 + Math.floor(k / 3) * tileStep, 5)).join(' '),
  ],
);

const layered = T(
  'layered-rosette',
  'Layered petal rosette',
  'intermediate',
  ['rosette', 'mandala', 'flower', 'layered'],
  [
    circle(C, C, 18),
    petals(18, 12, 46, 9),
    circle(C, C, 64),
    petals(64, 12, 52, 15, 15),
    petals(64, 12, 40, 11),
    circle(C, C, 120),
    petals(120, 24, 34, 8, 7.5),
    circle(C, C, 160),
    scallops(160, 36),
  ],
  [ribs(64, 12, 52, 15), dots(110, 12, 3), dots(40, 12, 2.5, 15)],
);

// ---- advanced ------------------------------------------------------------------------------------------

const lace12 = T(
  'lace-12',
  'Twelve-fold lace mandala',
  'advanced',
  ['mandala', 'lace', 'intricate', 'meditation'],
  [
    circle(C, C, 14),
    star(C, C, 34, 20, 12),
    circle(C, C, 40),
    arches(40, 92, 12),
    arches(40, 72, 12),
    circle(C, C, 98),
    petals(98, 12, 50, 13, 15),
    petals(98, 12, 34, 9, 0),
    circle(C, C, 150),
    arches(150, 176, 24),
  ],
  [
    arches(40, 56, 12),
    ribs(98, 12, 50, 15),
    dots(124, 12, 3.5),
    dots(160, 24, 2.5, 7.5),
    dots(86, 12, 3, 15),
    Array.from({ length: 12 }, (_, i) => petal(...polar(C, C, 104, 15 + i * 30), 15 + i * 30, 30, 6)).join(' '),
    circle(C, C, 144),
    circle(C, C, 24),
  ],
);

// triangular lattice of six-point stars whose tips touch, kept inside a circle
const hexStars: P[] = [];
const hs = 64;
for (let row = -5; row <= 5; row++)
  for (let col = -5; col <= 5; col++) {
    const x = C + col * hs + (row % 2 ? hs / 2 : 0);
    const y = C + row * hs * 0.866;
    if (Math.hypot(x - C, y - C) <= 200) hexStars.push([x, y]);
  }
const inside = region(circle(C, C, 166));
const inCircle = (d: string): string => clip(d, [inside], 'inside');
const hexTiling = T(
  'hex-star-tiling',
  'Six-point star geometric tiling',
  'advanced',
  ['geometric', 'tiling', 'star', 'hexagon'],
  [circle(C, C, 166), circle(C, C, 176), inCircle(hexStars.map(([x, y]) => star(x, y, hs / 2, hs / 2 / Math.sqrt(3), 6, 30)).join(' '))],
  [
    inCircle(hexStars.map(([x, y]) => ngon(x, y, 12, 6)).join(' ')),
    inCircle(hexStars.map(([x, y]) => circle(x, y, 4)).join(' ')),
    inCircle(
      hexStars
        .flatMap(([x, y]) =>
          [0, 60, 120, 180, 240, 300].map((a) => {
            const p = polar(x, y, 12, a);
            const q = polar(x, y, hs / 2 / Math.sqrt(3), a);
            return line(p[0], p[1], q[0], q[1]);
          }),
        )
        .join(' '),
    ),
    dots(171, 48, 2),
    circle(C, C, 182),
    star(C, C, 8, 4, 6, 30),
  ],
);

const layered16 = T(
  'layered-16',
  'Sixteen-fold layered mandala',
  'advanced',
  ['mandala', 'intricate', 'layered', 'meditation'],
  [
    circle(C, C, 16),
    petals(16, 8, 30, 8),
    circle(C, C, 48),
    petals(48, 16, 40, 8),
    circle(C, C, 92),
    arches(92, 140, 16),
    arches(92, 120, 16),
    petals(98, 16, 32, 7, 11.25),
    circle(C, C, 156),
    scallops(156, 48),
  ],
  [
    ribs(48, 16, 40),
    arches(92, 104, 16),
    dots(146, 16, 3, 11.25),
    dots(64, 16, 2.5, 11.25),
    dots(172, 48, 2),
    ribs(98, 16, 32, 11.25),
    circle(C, C, 40),
    circle(C, C, 86),
  ],
);

const interlaceN = 18;
const interlace = T(
  'interlaced-rosette',
  'Interlaced circles rosette',
  'advanced',
  ['rosette', 'geometric', 'circles', 'interlaced'],
  [
    Array.from({ length: interlaceN }, (_, i) => {
      const [x, y] = polar(C, C, 70, (360 * i) / interlaceN);
      return circle(x, y, 52);
    }).join(' '),
    circle(C, C, 18),
    circle(C, C, 124),
    petals(124, 18, 40, 9),
    circle(C, C, 172),
  ],
  [
    petals(124, 18, 26, 5),
    dots(160, 18, 3, 10),
    dots(132, 18, 2.5, 10),
    star(C, C, 12, 5, 9),
    circle(C, C, 136),
    ribs(124, 18, 40),
  ],
);

export const mandalas3: Template[] = [
  sixPetal,
  seedOfLife,
  vesica,
  nested,
  rosette8,
  compassSimple,
  hexagram,
  heartRing,
  lotus10,
  sun16,
  thirteenCircles,
  compass16,
  starTiling,
  layered,
  lace12,
  hexTiling,
  layered16,
  interlace,
];
