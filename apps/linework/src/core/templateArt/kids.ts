// Kids: original, chunky, friendly line art for children (fb-1022) on a 400×400 canvas — woodland and safari
// animals, pets, vehicles, food, ABC blocks and seasonal pieces, plus three busier scenes. Every piece is our own
// generic design: no existing characters, mascots, toys, logos or franchise silhouettes (see docs/TEMPLATES.md).
// Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, mirrorX, petal, poly, polar, rotate, rrect, type P } from './draw.ts';
import { clip, region, roundPoly, stack, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

/** A drawing: outlines, fine detail and the closed silhouette shapes that hide what is behind it in a scene. */
type Art = { paths: string[]; detail: string[]; sil: Layer[] };

// ---- kit --------------------------------------------------------------------------------------

/** Dot eye: a tiny ring that reads as a solid dot at stroke width 4. */
const dot = (x: number, y: number, r = 3.4): string => circle(x, y, r);
const smile = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w)} ${f(x + w)} ${f(y)}`;
const blush = (x: number, y: number, rx = 9, ry = 5.5): string => ellipse(x, y, rx, ry);

/** Four-point sparkle. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

/** Rounded star with n points. */
function softStar(cx: number, cy: number, outer: number, inner: number, n: number, r: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rot + (180 * i) / n));
  return roundPoly(pts, r);
}

/** Fluffy cloud outline (merged circles on a flat base). */
function cloud(cx: number, cy: number, w: number): string {
  const s = w / 100;
  const p = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${p(-50, 15)} C ${p(-62, 15)} ${p(-62, -8)} ${p(-46, -8)} C ${p(-46, -28)} ${p(-20, -32)} ${p(-12, -18)} ` +
    `C ${p(-4, -40)} ${p(30, -40)} ${p(32, -14)} C ${p(54, -20)} ${p(62, 15)} ${p(46, 15)} Z`
  );
}

/** Simple flying bird ‿‿ seen from afar. */
const bird = (x: number, y: number, w: number): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x - w / 2)} ${f(y - w * 0.6)} ${f(x)} ${f(y)} Q ${f(x + w / 2)} ${f(y - w * 0.6)} ${f(x + w)} ${f(y)}`;

/** Snowflake: three crossed lines with little forks. */
function flake(x: number, y: number, r: number): string {
  let d = '';
  for (let a = 0; a < 180; a += 60) {
    const [x1, y1] = polar(x, y, r, a);
    const [x2, y2] = polar(x, y, r, a + 180);
    d += `${line(x1, y1, x2, y2)} `;
  }
  return d.trim();
}

/** Grass tuft of three blades standing on (x, y). */
const tuft = (x: number, y: number, h: number): string =>
  `M ${f(x - h * 0.5)} ${f(y)} Q ${f(x - h * 0.35)} ${f(y - h * 0.5)} ${f(x - h * 0.6)} ${f(y - h * 0.8)} ` +
  `M ${f(x)} ${f(y)} Q ${f(x + h * 0.05)} ${f(y - h * 0.6)} ${f(x)} ${f(y - h)} ` +
  `M ${f(x + h * 0.5)} ${f(y)} Q ${f(x + h * 0.35)} ${f(y - h * 0.5)} ${f(x + h * 0.6)} ${f(y - h * 0.8)}`;

/** Lumpy rounded blob (giraffe spot, coal, rock). */
function spot(cx: number, cy: number, r: number, seed: number): string {
  const pts: P[] = [];
  for (let i = 0; i < 6; i++) pts.push(polar(cx, cy, r * (0.82 + 0.28 * Math.sin(seed * 2.3 + i * 1.7)), i * 60 + seed * 13));
  return roundPoly(pts, r * 0.45);
}

/** Wavy horizontal line from x0 to x1 at y with amplitude a and wavelength w. */
function wave(x0: number, x1: number, y: number, a: number, w: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  for (let x = x0; x < x1 - 0.1; x += w) {
    d += ` Q ${f(x + w / 4)} ${f(y - a)} ${f(x + w / 2)} ${f(y)} Q ${f(x + (3 * w) / 4)} ${f(y + a)} ${f(x + w)} ${f(y)}`;
  }
  return d;
}

const inside = (d: string, layer: Layer): string => clip(d, [region(layer)], 'inside');
const hide = (d: string, layers: readonly Layer[]): string => clip(d, layers.map(region));

/** Scale by s and move by (dx, dy). */
function xf(d: string, s: number, dx: number, dy: number): string {
  return mapPath(d, { map: (x, y) => [x * s + dx, y * s + dy], scale: s, rotate: 0, flip: false });
}
function place(a: Art, s: number, dx: number, dy: number): Art {
  const m = (d: string) => xf(d, s, dx, dy);
  return {
    paths: a.paths.map(m),
    detail: a.detail.map(m),
    sil: a.sil.map((l) => (typeof l === 'string' ? m(l) : l.map(m))),
  };
}

/** Layer whole drawings front to back: each item is hidden behind the silhouettes of the items before it. */
function compose(items: readonly Art[]): { paths: string[]; detail: string[] } {
  const regions: Region[] = [];
  const paths: string[] = [];
  const detail: string[] = [];
  for (const it of items) {
    for (const d of it.paths) paths.push(regions.length ? clip(d, regions) : d);
    for (const d of it.detail) detail.push(regions.length ? clip(d, regions) : d);
    regions.push(...it.sil.map(region));
  }
  return { paths: paths.filter(Boolean), detail: detail.filter(Boolean) };
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], paths: string[], detail: string[] = []): Template {
  const d = detail.filter(Boolean);
  return {
    id: `kids-${id}`,
    name,
    category: 'kids',
    level,
    tags: ['kids', 'children', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(d.length ? { detail: d } : {}),
  };
}

const fromArt = (id: string, name: string, level: TemplateLevel, tags: string[], a: Art, extra: string[] = [], extraDetail: string[] = []): Template =>
  tpl(id, name, level, tags, [...a.paths, ...extra], [...a.detail, ...extraDetail]);

const sym = (pts: readonly P[]): P[] => pts.map(([x, y]) => [400 - x, y] as P);

// ---- woodland ---------------------------------------------------------------------------------

function fox(): Art {
  const head = roundPoly([[128, 62], [176, 110], [224, 110], [272, 62], [284, 140], [314, 194], [200, 242], [86, 194], [116, 140]], 14);
  const body = 'M 152 222 C 120 252 110 312 124 346 L 276 346 C 290 312 280 252 248 222 Z';
  const pawL = ellipse(166, 346, 24, 12);
  const pawR = ellipse(234, 346, 24, 12);
  const tail = 'M 266 340 C 334 352 372 300 356 238 C 348 208 318 200 310 224 C 330 262 318 306 272 306 Z';
  const layers = stack([pawL, pawR, head, body, tail]);
  const earIn = roundPoly([[136, 84], [164, 113], [128, 128]], 6);
  return {
    paths: [
      ...layers,
      inside(earIn, head),
      mirrorX(inside(earIn, head), 200),
      'M 92 193 C 124 178 164 184 184 214 M 308 193 C 276 178 236 184 216 214',
      dot(166, 170),
      dot(234, 170),
      roundPoly([[186, 212], [214, 212], [200, 228]], 5),
      'M 200 228 L 200 233 M 188 233 Q 194 240 200 233 Q 206 240 212 233',
      hide('M 176 292 L 174 340 M 224 292 L 226 340', [pawL, pawR]),
      inside('M 310 234 Q 330 222 352 236', tail),
    ],
    detail: [
      hide('M 170 242 Q 180 282 200 298 Q 220 282 230 242', [head]),
      inside('M 186 266 L 192 274 L 200 266 L 208 274 L 214 266', body),
      blush(146, 206),
      blush(254, 206),
      'M 156 340 L 156 350 M 166 339 L 166 351 M 176 340 L 176 350',
      'M 224 340 L 224 350 M 234 339 L 234 351 M 244 340 L 244 350',
    ],
    sil: [pawL, pawR, head, body, tail],
  };
}

function woodlandFox(): Template {
  const a = fox();
  const tree = roundPoly([[46, 112], [76, 200], [16, 200]], 8);
  const tree2 = roundPoly([[46, 160], [82, 270], [10, 270]], 8);
  const trees = stack([tree, tree2]);
  const mush = ['M 320 112 C 320 82 380 82 380 112 Z', 'M 340 112 L 338 140 L 362 140 L 360 112'];
  return fromArt(
    'woodland-fox',
    'Little fox in the woods',
    'beginner',
    ['fox', 'animal', 'woodland', 'forest', 'nature'],
    a,
    [...trees, 'M 40 270 L 40 296 L 52 296 L 52 270', ...mush],
    [circle(338, 100, 5), circle(362, 98, 4), tuft(330, 360, 18), tuft(70, 360, 16), line(20, 358, 380, 358)].map((d) => hide(d, a.sil)),
  );
}

function owl(): Art {
  const body = ['M 200 100 C 260 100 300 150 300 215 C 300 285 255 330 200 330 C 145 330 100 285 100 215 C 100 150 140 100 200 100 Z',
    roundPoly([[112, 160], [118, 76], [182, 112]], 8), roundPoly(sym([[112, 160], [118, 76], [182, 112]]), 8)];
  const wingL = 'M 106 182 C 78 222 86 292 132 318 C 128 270 132 222 106 182 Z';
  const wingR = mirrorX(wingL, 200);
  const disc = 'M 200 150 C 180 116 110 120 112 172 C 114 216 162 222 200 204 C 238 222 286 216 288 172 C 290 120 220 116 200 150 Z';
  const beak = roundPoly([[188, 194], [212, 194], [200, 222]], 4);
  const feet = [158, 170, 182, 218, 230, 242].map((x) => ellipse(x, 332, 6, 9));
  const branch = 'M 26 334 C 120 322 280 322 374 336 L 374 354 C 280 344 120 344 26 352 Z';
  const leafA = petal(352, 344, 60, 44, 13);
  const leafB = petal(48, 342, -70, 40, 12);
  const layers = stack([...feet, beak, disc, wingL, wingR, body, branch, leafA, leafB]);
  return {
    paths: [
      ...layers,
      circle(162, 172, 30),
      circle(238, 172, 30),
      circle(168, 176, 12),
      circle(232, 176, 12),
      circle(172, 170, 3.5),
      circle(228, 170, 3.5),
    ],
    detail: [
      ...[[176, 248], [200, 248], [224, 248], [164, 270], [188, 270], [212, 270], [236, 270], [176, 292], [200, 292], [224, 292]].map(
        ([x, y]) => `M ${x - 8} ${y} Q ${x} ${y + 9} ${x + 8} ${y}`,
      ),
      inside('M 104 220 Q 112 240 118 262 M 296 220 Q 288 240 282 262', body),
      inside('M 60 343 Q 200 333 360 345', branch),
    ],
    sil: [...feet, beak, disc, wingL, wingR, body, branch, leafA, leafB],
  };
}

function nightOwl(): Template {
  const a = owl();
  const moon = 'M 330 40 C 296 44 288 92 322 108 C 300 110 276 92 278 66 C 280 40 306 30 330 40 Z';
  return fromArt('owl-on-branch', 'Wide-eyed owl on a branch', 'beginner', ['owl', 'bird', 'animal', 'woodland', 'night'], a, [moon], [
    sparkle(60, 60, 12),
    sparkle(350, 150, 9),
    sparkle(48, 160, 8),
  ]);
}

function hedgehog(): Art {
  const pts: P[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const th = Math.PI * (0.96 - (0.92 * i) / n);
    const k = i % 2 === 0 ? 0.84 : 1;
    pts.push([215 + 128 * k * Math.cos(th), 300 - 138 * k * Math.sin(th)]);
  }
  pts.push([330, 300], [100, 300]);
  const dome = roundPoly(pts, 3);
  const face = 'M 176 196 C 138 204 100 238 68 260 C 54 270 58 286 72 288 C 112 296 150 306 190 304 C 206 270 200 226 176 196 Z';
  const nose = circle(62, 272, 9);
  const ear = circle(160, 220, 13);
  const feet = [ellipse(140, 304, 18, 9), ellipse(276, 304, 18, 9)];
  const apple = 'M 228 136 C 214 124 192 130 194 154 C 196 176 214 188 228 180 C 242 188 260 176 262 154 C 264 130 242 124 228 136 Z';
  const leaf = petal(232, 132, 55, 28, 8);
  const layers = stack([nose, ...feet, face, ear, apple, leaf, dome]);
  const quills: string[] = [];
  for (const [x, y] of [[230, 220], [270, 210], [300, 240], [250, 255], [290, 280], [210, 280], [180, 250], [320, 205], [190, 180]] as P[]) {
    quills.push(`M ${x - 7} ${y + 6} L ${x} ${y - 6} L ${x + 7} ${y + 6}`);
  }
  return {
    paths: [...layers, 'M 228 136 Q 226 122 232 112', dot(126, 246), smile(106, 282, 11)],
    detail: [hide(quills.join(' '), [face, apple]), blush(132, 270), inside('M 160 214 Q 156 222 162 228', ear)],
    sil: [nose, ...feet, face, ear, apple, leaf, dome],
  };
}

function appleHedgehog(): Template {
  const a = hedgehog();
  return fromArt('hedgehog-apple', 'Hedgehog carrying an apple', 'beginner', ['hedgehog', 'animal', 'woodland', 'apple', 'autumn'], a, [], [
    hide(`${line(24, 312, 376, 312)} ${tuft(40, 312, 20)} ${tuft(360, 312, 22)}`, a.sil),
    petal(330, 92, 30, 34, 11),
    petal(80, 120, -40, 30, 10),
    petal(330, 180, 120, 26, 9),
  ]);
}

// ---- safari -----------------------------------------------------------------------------------

function lion(): Art {
  const ring: string[] = [];
  for (let i = 0; i < 14; i++) {
    const [x, y] = polar(200, 205, 118, (360 * i) / 14);
    ring.push(circle(x, y, 34));
  }
  const mane = [circle(200, 205, 110), ...ring];
  const face = ellipse(200, 214, 92, 84);
  const earL = circle(136, 134, 24);
  const earR = circle(264, 134, 24);
  const muzzle = [ellipse(182, 252, 25, 19), ellipse(218, 252, 25, 19)];
  const nose = roundPoly([[183, 226], [217, 226], [200, 244]], 6);
  const layers = stack([nose, muzzle, face, earL, earR, mane]);
  const strands: string[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (360 * (i + 0.5)) / 14;
    const [x1, y1] = polar(200, 205, 100, a);
    const [x2, y2] = polar(200, 205, 134, a);
    strands.push(line(x1, y1, x2, y2));
  }
  return {
    paths: [...layers, 'M 200 244 L 200 252', smile(200, 274, 13), dot(166, 198), dot(234, 198)],
    detail: [
      hide(strands.join(' '), [face, earL, earR]),
      hide(`${circle(136, 134, 12)} ${circle(264, 134, 12)}`, [face]),
      ...[[174, 252], [182, 260], [168, 262], [226, 252], [218, 260], [232, 262]].map(([x, y]) => circle(x, y, 1.6)),
      'M 152 180 Q 166 172 180 180 M 220 180 Q 234 172 248 180',
      blush(150, 232),
      blush(250, 232),
    ],
    sil: [nose, muzzle, face, earL, earR, mane],
  };
}

function giraffe(): Art {
  const head = rotate(ellipse(110, 92, 44, 27), -15, 110, 92);
  const ear = petal(146, 80, 70, 32, 9);
  const hornA = `M 108 72 L 102 44 ${circle(101, 38, 7)}`;
  const hornB = `M 126 70 L 128 42 ${circle(128, 36, 7)}`;
  const hornSil = [circle(101, 38, 7), circle(128, 36, 7)];
  const neck = roundPoly([[170, 230], [102, 104], [146, 84], [224, 208]], 10);
  const body = ellipse(252, 236, 86, 48);
  const legs = [rrect(184, 250, 22, 118, 10), rrect(298, 250, 22, 118, 10), rrect(214, 258, 22, 110, 10), rrect(268, 258, 22, 110, 10)];
  const tailTuft = petal(352, 286, 175, 24, 7);
  const layers = stack([head, ear, ...hornSil, neck, body, ...legs, tailTuft]);
  const coat = [neck, body];
  const spots = [
    spot(210, 220, 13, 1), spot(250, 210, 14, 2), spot(292, 222, 13, 3), spot(234, 254, 12, 4), spot(276, 256, 12, 5),
    spot(318, 246, 10, 6), spot(162, 176, 11, 7), spot(140, 136, 10, 8), spot(190, 214, 9, 9),
  ];
  return {
    paths: [
      ...layers,
      hide(`M 108 72 L 102 46 M 126 70 L 128 44`, [head]),
      hide('M 334 226 Q 354 250 352 286', [body, tailTuft]),
      dot(118, 84, 3.6),
      'M 76 108 Q 88 116 100 110',
    ],
    detail: [
      ...spots.map((s) => hide(inside(s, coat), [head, ear])),
      circle(78, 96, 2.4),
      ...[184, 298, 214, 268].map((x) => line(x + 2, 352, x + 20, 352)),
      hide(`M 150 92 L 156 86 M 160 108 L 167 102 M 170 124 L 177 118 M 180 140 L 187 134 M 190 156 L 197 150 M 200 172 L 207 166`, [head, ear]),
      blush(122, 104, 8, 5),
    ],
    sil: [head, ear, ...hornSil, neck, body, ...legs, tailTuft],
  };
}

function elephant(): Art {
  const ear = 'M 150 136 C 214 118 236 178 222 222 C 210 258 172 262 158 232 C 150 206 146 170 150 136 Z';
  const head = [circle(138, 180, 62), 'M 90 212 C 68 242 62 282 74 312 C 80 324 96 322 98 310 C 92 284 98 258 120 236 Z'];
  const body = ellipse(248, 228, 106, 82);
  const legsF = [rrect(150, 262, 42, 98, 14), rrect(312, 262, 42, 98, 14)];
  const legsB = [rrect(204, 276, 40, 84, 14), rrect(262, 276, 40, 84, 14)];
  const tail = 'M 352 222 Q 374 244 368 274';
  const tuft = petal(368, 272, 175, 18, 6);
  const layers = stack([ear, head, body, ...legsF, ...legsB, tuft]);
  return {
    paths: [...layers, hide(tail, [body, tuft]), dot(116, 168), 'M 120 220 Q 132 230 144 222'],
    detail: [
      ...[150, 312].map((x) => `M ${x + 6} 360 Q ${x + 13} 346 ${x + 20} 360 M ${x + 22} 360 Q ${x + 29} 346 ${x + 36} 360`),
      inside('M 160 150 C 200 140 218 180 208 214', ear),
      inside('M 82 264 L 96 266 M 78 282 L 93 282 M 78 298 L 92 296', head),
      blush(104, 196),
    ],
    sil: [ear, head, body, ...legsF, ...legsB, tuft],
  };
}

function smilingLion(): Template {
  return fromArt('lion-cub', 'Smiling lion cub', 'beginner', ['lion', 'animal', 'safari', 'jungle', 'face'], lion());
}

function tallGiraffe(): Template {
  const a = giraffe();
  return fromArt('tall-giraffe', 'Tall giraffe', 'beginner', ['giraffe', 'animal', 'safari', 'africa', 'zoo'], a, [cloud(320, 70, 90)], [
    hide(`${line(30, 368, 380, 368)} ${tuft(60, 368, 22)} ${tuft(360, 368, 20)}`, a.sil),
    bird(260, 120, 10),
    bird(290, 140, 8),
  ]);
}

function babyElephant(): Template {
  const a = elephant();
  return fromArt('baby-elephant', 'Baby elephant', 'beginner', ['elephant', 'animal', 'safari', 'zoo', 'africa'], a, [
    circle(80, 76, 12), circle(56, 108, 9), circle(92, 118, 7),
  ], [hide(`${line(30, 360, 380, 360)} ${tuft(40, 360, 18)}`, a.sil), sparkle(330, 80, 14)]);
}

// ---- dinosaur & pets ----------------------------------------------------------------------------

function dino(): Art {
  const head = ellipse(110, 100, 42, 28);
  const neck = 'M 138 250 C 120 192 104 152 96 116 L 140 106 C 148 150 166 196 198 218 Z';
  const body = ellipse(226, 256, 102, 64);
  const legsF = [rrect(150, 282, 36, 74, 13), rrect(290, 282, 36, 74, 13)];
  const legsB = [rrect(190, 288, 34, 68, 13), rrect(250, 288, 34, 68, 13)];
  const tail = 'M 316 236 C 350 250 372 236 386 200 C 392 244 364 292 300 292 Z';
  const layers = stack([head, [neck, body], ...legsF, ...legsB, tail]);
  const dots = [circle(196, 222, 10), circle(236, 212, 12), circle(276, 226, 9), circle(250, 248, 7), circle(128, 156, 7)];
  return {
    paths: [...layers, dot(116, 92, 4), 'M 76 110 Q 92 122 110 112', ...dots.map((d) => hide(d, [head]))],
    detail: [
      circle(80, 94, 2.2),
      blush(128, 110, 8, 5),
      inside('M 150 290 Q 226 312 300 290', body),
      ...[150, 290].map((x) => `M ${x + 8} 356 Q ${x + 13} 347 ${x + 18} 356 M ${x + 20} 356 Q ${x + 25} 347 ${x + 30} 356`),
    ],
    sil: [head, [neck, body], ...legsF, ...legsB, tail],
  };
}

function friendlyDino(): Template {
  const a = dino();
  const sun = circle(330, 64, 28);
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const [x1, y1] = polar(330, 64, 38, i * 45 + 22);
    const [x2, y2] = polar(330, 64, 52, i * 45 + 22);
    rays += `${line(x1, y1, x2, y2)} `;
  }
  return fromArt('long-neck-dino', 'Friendly long-neck dinosaur', 'beginner', ['dinosaur', 'dino', 'animal', 'prehistoric', 'reptile'], a, [
    sun, hide(rays.trim(), a.sil),
  ], [
    hide(`${line(20, 356, 380, 356)} ${tuft(40, 356, 22)} ${tuft(364, 356, 20)}`, a.sil),
    spot(64, 346, 14, 2),
    tuft(96, 356, 26),
  ]);
}

function puppy(): Template {
  const head = circle(200, 160, 72);
  const earL = rotate(ellipse(134, 176, 24, 52), 18, 134, 176);
  const earR = rotate(ellipse(266, 176, 24, 52), -18, 266, 176);
  const muzzle = ellipse(200, 194, 36, 26);
  const nose = ellipse(200, 180, 13, 9);
  const body = 'M 150 216 C 124 252 118 312 130 346 L 270 346 C 282 312 276 252 250 216 Z';
  const pawL = ellipse(168, 346, 24, 12);
  const pawR = ellipse(232, 346, 24, 12);
  const tail = petal(266, 322, 55, 58, 10);
  const tag = circle(200, 252, 10);
  const collar = 'M 152 226 Q 200 250 248 226 L 248 238 Q 200 262 152 238 Z';
  const bone = [rrect(46, 330, 64, 16, 8), circle(46, 330, 9), circle(46, 346, 9), circle(110, 330, 9), circle(110, 346, 9)];
  const layers = stack([nose, muzzle, earL, earR, head, tag, collar, pawL, pawR, body, tail, bone]);
  return tpl('floppy-puppy', 'Floppy-eared puppy', 'beginner', ['puppy', 'dog', 'pet', 'animal', 'cute'], [
    ...layers,
    'M 200 189 L 200 198 M 186 200 Q 193 207 200 200 Q 207 207 214 200',
    dot(174, 150, 3.6),
    dot(226, 150, 3.6),
    hide('M 178 292 L 176 340 M 222 292 L 224 340', [pawL, pawR]),
  ], [
    'M 194 204 Q 194 214 200 214 Q 206 214 206 204',
    blush(160, 186),
    blush(240, 186),
    'M 300 280 Q 312 284 318 296 M 306 266 Q 322 268 330 280',
    hide(line(20, 358, 380, 358), [pawL, pawR, ...bone]),
  ]);
}

function goldfishBowl(): Template {
  const bowl = 'M 115.1 110 A 135 135 0 0 0 138.2 335 L 261.8 335 A 135 135 0 0 0 284.9 110';
  const bowlSil = `${bowl} Z`;
  const rim = rrect(106, 98, 188, 24, 12);
  const body = ellipse(190, 234, 50, 33);
  const tailFin = roundPoly([[234, 234], [284, 202], [274, 234], [284, 266]], 8);
  const topFin = petal(196, 206, 15, 34, 13);
  const sideFin = petal(196, 246, 210, 24, 8);
  const weedA = 'M 110 330 C 96 300 124 284 108 252 C 134 280 122 302 128 330 Z';
  const weedB = 'M 288 330 C 300 300 276 284 292 248 C 266 278 278 302 270 330 Z';
  const stand = rrect(124, 335, 152, 16, 7);
  const layers = stack([rim, sideFin, body, topFin, tailFin, weedA, weedB, stand]);
  const pebbles = [ellipse(156, 330, 14, 9), ellipse(186, 332, 12, 8), ellipse(214, 330, 14, 9), ellipse(244, 332, 12, 8)];
  return tpl('goldfish-bowl', 'Goldfish in a bowl', 'beginner', ['goldfish', 'fish', 'pet', 'animal', 'water'], [
    hide(bowl, [rim]),
    ...layers,
    inside(hide(wave(80, 320, 152, 6, 40), [rim]), bowlSil),
    circle(166, 226, 8),
    dot(168, 227, 2.4),
    'M 150 244 Q 158 250 166 245',
    circle(146, 190, 7),
    circle(132, 166, 5),
    circle(150, 176, 3.5),
    ...pebbles.map((p) => inside(hide(p, [weedA, weedB]), bowlSil)),
  ], [
    hide('M 196 222 Q 206 234 196 246 M 212 222 Q 222 234 212 246', [sideFin]),
    inside('M 250 234 L 276 222 M 250 234 L 276 246', tailFin),
    inside('M 134 108 L 266 108', rim),
    'M 240 140 Q 266 150 274 176',
    line(40, 351, 360, 351),
  ]);
}

// ---- vehicles ---------------------------------------------------------------------------------

function fireTruck(): Art {
  const body = rrect(30, 180, 270, 104, 10);
  const cab = roundPoly([[290, 284], [290, 138], [340, 138], [374, 196], [374, 284]], 10);
  const win = roundPoly([[304, 152], [336, 152], [360, 194], [304, 194]], 6);
  const ladder = rrect(42, 148, 238, 24, 6);
  const props = [rrect(70, 170, 12, 12, 2), rrect(240, 170, 12, 12, 2)];
  const light = rrect(308, 124, 28, 16, 7);
  const wheels = [circle(90, 290, 34), circle(322, 290, 34)];
  const hubs = [circle(90, 290, 14), circle(322, 290, 14)];
  const bumper = rrect(362, 262, 24, 18, 6);
  const lamp = rrect(364, 218, 16, 18, 5);
  const layers = stack([...wheels, bumper, lamp, light, ladder, ...props, cab, body]);
  const rungs: string[] = [];
  for (let x = 60; x < 280; x += 20) rungs.push(line(x, 152, x, 168));
  return {
    paths: [
      ...layers,
      win,
      ...hubs,
      rrect(46, 198, 66, 56, 6),
      rrect(124, 198, 66, 56, 6),
      circle(240, 226, 26),
      circle(240, 226, 9),
      hide('M 300 206 L 300 252 L 364 252', wheels),
    ],
    detail: [
      ...rungs,
      line(46, 160, 276, 160),
      line(68, 222, 90, 222),
      line(146, 222, 168, 222),
      hide(line(36, 268, 294, 268), wheels),
      line(318, 214, 334, 214),
      dot(90, 290, 2.5),
      dot(322, 290, 2.5),
      ...[0, 60, 120, 180, 240, 300].map((a) => {
        const [x, y] = polar(240, 226, 17, a);
        return line(240, 226, x, y);
      }),
      'M 314 118 L 310 108 M 322 116 L 322 104 M 330 118 L 334 108',
    ],
    sil: [...wheels, bumper, lamp, light, ladder, ...props, cab, body],
  };
}

function fireTruckTpl(): Template {
  const a = fireTruck();
  return fromArt('fire-truck', 'Fire truck with a ladder', 'intermediate', ['fire-truck', 'truck', 'vehicle', 'transport', 'rescue'], a, [], [
    hide(`${line(16, 324, 390, 324)} ${line(40, 340, 80, 340)} ${line(140, 340, 180, 340)} ${line(240, 340, 280, 340)} ${line(340, 340, 380, 340)}`, a.sil),
  ]);
}

function digger(): Art {
  const bucket = roundPoly([[326, 196], [382, 206], [374, 262], [324, 272]], 8);
  const teeth = poly([[322, 262], [330, 284], [338, 266], [346, 284], [354, 264], [362, 282], [370, 262]], false);
  const stick = roundPoly([[296, 116], [354, 206], [338, 216], [284, 128]], 8);
  const boom = roundPoly([[226, 232], [292, 112], [314, 124], [256, 244]], 8);
  const joint = circle(300, 120, 9);
  const body = rrect(60, 212, 204, 76, 10);
  const cab = roundPoly([[92, 222], [92, 116], [184, 116], [212, 222]], 12);
  const win = roundPoly([[106, 132], [174, 132], [192, 200], [106, 200]], 6);
  const pipe = rrect(70, 166, 13, 50, 5);
  const track = rrect(48, 284, 226, 60, 30);
  const wheels = [80, 132, 186, 242].map((x) => circle(x, 314, 20));
  const dirt = 'M 290 344 C 304 300 360 296 392 344 Z';
  const layers = stack([joint, bucket, stick, boom, body, cab, pipe, ...wheels, track, dirt]);
  let treads = '';
  for (let x = 72; x < 260; x += 18) treads += `${line(x, 344, x + 6, 336)} `;
  return {
    paths: [...layers, win, hide(teeth, [bucket]), ...wheels.map((w, i) => circle([80, 132, 186, 242][i], 314, 6))],
    detail: [
      hide(treads.trim(), wheels),
      hide('M 214 224 L 270 172 M 222 232 L 276 180', [boom, cab]),
      line(76, 150, 76, 140),
      circle(84, 128, 7),
      circle(98, 112, 9),
      line(80, 250, 120, 250),
      ...[spot(330, 330, 6, 1), spot(360, 324, 5, 2), spot(372, 336, 4, 3)],
      line(10, 344, 390, 344),
    ],
    sil: [joint, bucket, stick, boom, body, cab, pipe, ...wheels, track, dirt],
  };
}

function diggerTpl(): Template {
  return fromArt('busy-digger', 'Busy digger', 'intermediate', ['digger', 'excavator', 'vehicle', 'construction', 'truck'], digger());
}

function train(): Art {
  const roof = rrect(220, 116, 116, 18, 7);
  const cab = rrect(232, 128, 92, 144, 8);
  const win = rrect(250, 148, 54, 46, 8);
  const boiler = rrect(58, 190, 184, 76, 16);
  const chimney = roundPoly([[90, 194], [88, 142], [76, 118], [124, 118], [112, 142], [110, 194]], 5);
  const dome = rrect(150, 164, 38, 34, 15);
  const lampSil = rrect(44, 198, 18, 22, 6);
  const chassis = rrect(40, 262, 290, 18, 6);
  const wheels = [circle(88, 300, 20), circle(158, 290, 30), circle(228, 290, 30), circle(294, 296, 24)];
  const tender = rrect(340, 196, 54, 76, 6);
  const coal = `M 340 200 Q 346 182 356 190 Q 364 174 374 188 Q 384 178 392 198 Z`;
  const tWheels = [circle(352, 304, 14), circle(384, 304, 14)];
  const buffer = rrect(26, 262, 18, 16, 5);
  const layers = stack([...wheels, ...tWheels, buffer, chassis, lampSil, roof, boiler, chimney, dome, cab, tender, coal]);
  const puffs = [circle(116, 92, 14), circle(146, 68, 18), circle(188, 46, 22)];
  return {
    paths: [...layers, win, ...puffs, ...wheels.map((_, i) => circle([88, 158, 228, 294][i], [300, 290, 290, 296][i], 6))],
    detail: [
      'M 158 290 L 228 290 M 228 290 L 294 296',
      inside('M 96 192 L 96 264', boiler),
      inside('M 120 200 L 230 200 M 120 256 L 230 256', boiler),
      line(10, 322, 394, 322),
      ...[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((x) => line(x - 8, 332, x + 8, 332)),
      line(276, 194, 276, 148),
      line(252, 220, 304, 220),
      dot(352, 304, 2.5),
      dot(384, 304, 2.5),
    ],
    sil: [...wheels, ...tWheels, buffer, chassis, lampSil, roof, boiler, chimney, dome, cab, tender, coal, ...puffs],
  };
}

function trainTpl(): Template {
  return fromArt('steam-train', 'Little steam train', 'intermediate', ['train', 'locomotive', 'vehicle', 'transport', 'railway'], train());
}

function sailboat(): Template {
  const hull = roundPoly([[66, 268], [334, 268], [296, 320], [104, 320]], 12);
  const mast = rrect(196, 62, 8, 208, 3);
  const main = roundPoly([[190, 80], [190, 256], [90, 256]], 8);
  const jib = roundPoly([[210, 96], [210, 256], [296, 256]], 8);
  const flag = roundPoly([[204, 64], [244, 74], [204, 86]], 4);
  const sun = circle(330, 80, 28);
  const layers = stack([hull, mast, main, jib, flag]);
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const [x1, y1] = polar(330, 80, 38, i * 45);
    const [x2, y2] = polar(330, 80, 50, i * 45);
    rays += `${line(x1, y1, x2, y2)} `;
  }
  return tpl('sailboat', 'Sailboat on the waves', 'beginner', ['boat', 'sailboat', 'sea', 'vehicle', 'summer'], [
    ...layers,
    circle(150, 292, 8),
    circle(200, 292, 8),
    circle(250, 292, 8),
    hide(wave(0, 400, 318, 8, 40), [hull]),
    wave(0, 400, 352, 8, 50),
    sun,
    rays.trim(),
    cloud(80, 70, 80),
  ], [
    inside('M 120 210 L 190 210 M 150 160 L 190 160', main),
    inside('M 210 210 L 260 210', jib),
    wave(40, 360, 380, 5, 40),
    bird(310, 160, 10),
    bird(280, 180, 8),
  ]);
}

// ---- food -------------------------------------------------------------------------------------

function iceCream(): Template {
  const cone = roundPoly([[128, 192], [272, 192], [200, 372]], 10);
  let drip = 'M 122 194 C 110 142 150 116 200 116 C 250 116 290 142 278 194';
  const xs = [278, 252, 226, 200, 174, 148, 122];
  const depth = [0, 18, 40, 16, 34, 18];
  for (let i = 0; i < 6; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    drip += ` C ${f(a - 2)} ${f(196 + depth[i] * 1.3)} ${f(b + 2)} ${f(196 + depth[i] * 1.3)} ${f(b)} 194`;
  }
  drip += ' Z';
  const top = circle(200, 104, 60);
  const cherry = circle(206, 40, 15);
  const layers = stack([cherry, drip, top, cone]);
  let grid = '';
  for (let k = -6; k <= 6; k++) grid += `${line(140 + k * 24, 190, 220 + k * 24, 380)} ${line(260 + k * 24, 190, 180 + k * 24, 380)} `;
  const sprinkles = [[176, 70, 30], [216, 66, -20], [240, 92, 60], [160, 100, -50], [196, 92, 10], [226, 120, 80]].map(([x, y, a]) =>
    rotate(line(x - 6, y, x + 6, y), a, x, y),
  );
  return tpl('ice-cream-cone', 'Double-scoop ice-cream cone', 'beginner', ['ice-cream', 'food', 'dessert', 'summer', 'sweet'], [
    ...layers,
    'M 208 26 Q 212 12 226 8',
  ], [hide(inside(grid, cone), [drip]), ...sprinkles.map((s) => hide(s, [cherry, drip])), circle(200, 36, 4)]);
}

function pizza(): Template {
  const slice = 'M 86 120 Q 200 92 314 120 L 206 362 Q 200 374 194 362 Z';
  const crust = 'M 70 118 Q 200 68 330 118 Q 338 144 316 142 Q 200 114 84 142 Q 62 144 70 118 Z';
  const pep = [circle(158, 182, 22), circle(244, 184, 22), circle(200, 262, 20)];
  const olives = [circle(206, 186, 8), circle(170, 230, 7), circle(226, 224, 7)];
  const leaf = petal(196, 312, 20, 30, 9);
  const layers = stack([...pep, ...olives, leaf, crust, slice]);
  return tpl('pizza-slice', 'Cheesy pizza slice', 'beginner', ['pizza', 'food', 'snack', 'party', 'lunch'], [
    ...layers,
    circle(206, 186, 3),
    circle(170, 230, 2.5),
    circle(226, 224, 2.5),
  ], [
    circle(150, 176, 2.5), circle(164, 190, 2.5), circle(238, 178, 2.5), circle(252, 192, 2.5), circle(196, 256, 2.5), circle(206, 270, 2.5),
    inside('M 110 120 L 118 128 M 150 104 L 156 114 M 200 98 L 200 108 M 250 104 L 244 114 M 290 120 L 282 128', crust),
  ]);
}

function cupcake(): Template {
  const wrap = roundPoly([[112, 232], [288, 232], [262, 356], [138, 356]], 8);
  const l1 = rrect(94, 196, 212, 50, 25);
  const l2 = rrect(120, 156, 160, 48, 24);
  const l3 = rrect(150, 120, 100, 44, 22);
  const cherry = circle(200, 102, 20);
  const layers = stack([cherry, l1, l2, l3, wrap]);
  const pleats = [150, 175, 200, 225, 250].map((x) => line(x, 246, 200 + (x - 200) * 0.75, 356));
  const sprinkles = [[130, 220, 20], [170, 214, 70], [222, 218, -30], [262, 224, 40], [150, 180, -60], [196, 176, 20], [244, 182, 80], [178, 142, 40], [222, 140, -50]].map(
    ([x, y, a]) => rotate(line(x - 6, y, x + 6, y), a, x, y),
  );
  return tpl('cherry-cupcake', 'Cherry-top cupcake', 'beginner', ['cupcake', 'cake', 'food', 'dessert', 'birthday', 'sweet'], [
    ...layers,
    'M 204 82 Q 210 62 228 58',
    ...pleats.map((p) => inside(p, wrap)),
  ], [...sprinkles, circle(194, 96, 4), sparkle(70, 120, 12), sparkle(334, 90, 10), sparkle(330, 300, 9)]);
}

// ---- ABC blocks -------------------------------------------------------------------------------

function letterA(x: number, y: number): string[] {
  const o = roundPoly([[-32, 35], [-9, -36], [9, -36], [32, 35], [14, 35], [9, 20], [-9, 20], [-14, 35]].map(([a, b]) => [x + a, y + b] as P), 5);
  const h = roundPoly([[-7, 4], [0, -16], [7, 4]].map(([a, b]) => [x + a, y + b] as P), 2);
  return [o, h];
}
function letterB(x: number, y: number): string[] {
  const p = (a: number, b: number) => `${f(x + a)} ${f(y + b)}`;
  return [
    `M ${p(-22, -36)} L ${p(6, -36)} C ${p(36, -36)} ${p(36, -2)} ${p(14, -2)} C ${p(42, -2)} ${p(40, 36)} ${p(8, 36)} L ${p(-22, 36)} ` +
      `Q ${p(-28, 36)} ${p(-28, 30)} L ${p(-28, -30)} Q ${p(-28, -36)} ${p(-22, -36)} Z`,
    `M ${p(-10, -23)} L ${p(4, -23)} C ${p(16, -23)} ${p(16, -11)} ${p(4, -11)} L ${p(-10, -11)} Z`,
    `M ${p(-10, 9)} L ${p(6, 9)} C ${p(20, 9)} ${p(20, 23)} ${p(6, 23)} L ${p(-10, 23)} Z`,
  ];
}
function letterC(x: number, y: number): string[] {
  const R = 36;
  const r = 17;
  const a = (40 * Math.PI) / 180;
  const o1: P = [x + R * Math.cos(a), y - R * Math.sin(a)];
  const o2: P = [x + R * Math.cos(a), y + R * Math.sin(a)];
  const i1: P = [x + r * Math.cos(a), y - r * Math.sin(a)];
  const i2: P = [x + r * Math.cos(a), y + r * Math.sin(a)];
  const c = (R - r) / 2;
  return [
    `M ${f(o1[0])} ${f(o1[1])} A ${R} ${R} 0 1 0 ${f(o2[0])} ${f(o2[1])} A ${f(c)} ${f(c)} 0 0 0 ${f(i2[0])} ${f(i2[1])} ` +
      `A ${r} ${r} 0 1 1 ${f(i1[0])} ${f(i1[1])} A ${f(c)} ${f(c)} 0 0 0 ${f(o1[0])} ${f(o1[1])} Z`,
  ];
}

function block(x: number, y: number, s: number, d: number): { sil: string; lines: string[]; detail: string[]; cx: number; cy: number } {
  const dy = d * 0.8;
  const sil = roundPoly([[x, y + s], [x, y], [x + d, y - dy], [x + s + d, y - dy], [x + s + d, y + s - dy], [x + s, y + s]], 6);
  return {
    sil,
    lines: [poly([[x + 3, y], [x + s, y], [x + s, y + s - 3]], false), ''],
    detail: [rrect(x + 10, y + 10, s - 20, s - 20, 10), line(x + s, y, x + s + d - 3, y - dy + 2)],
    cx: x + s / 2,
    cy: y + s / 2,
  };
}

function abcBlocks(): Template {
  const top = block(126, 108, 110, 32);
  const right = block(192, 232, 110, 32);
  const left = block(62, 232, 110, 32);
  const order = [top, right, left];
  const outs = stack(order.map((b) => b.sil));
  const paths: string[] = [...outs];
  const detail: string[] = [];
  const letters = [letterA(left.cx, left.cy), letterB(right.cx, right.cy), letterC(top.cx, top.cy)];
  order.forEach((b, i) => {
    const front = order.slice(0, i).map((o) => o.sil);
    for (const l of b.lines) if (l) paths.push(front.length ? hide(l, front) : l);
    for (const l of b.detail) detail.push(front.length ? hide(l, front) : l);
  });
  for (const ls of letters) paths.push(...ls);
  detail.push(
    `${softStar(56, 76, 22, 10, 5, 4)} ${softStar(338, 120, 18, 8, 5, 3)} ${sparkle(80, 160, 10)} ${sparkle(344, 200, 10)}`,
    line(24, 344, 376, 344),
  );
  return tpl('abc-blocks', 'ABC building blocks', 'intermediate', ['alphabet', 'letters', 'abc', 'blocks', 'learning', 'school'], paths, detail);
}

function bubbleLetters(): Template {
  const L = [letterA(0, 0), letterB(0, 0), letterC(0, 0)];
  const paths: string[] = [];
  const pos: P[] = [[96, 130], [204, 210], [308, 290]];
  L.forEach((ls, i) => paths.push(...ls.map((d) => xf(d, 1.5, pos[i][0], pos[i][1]))));
  return tpl('bubble-abc', 'Bubble letters A B C', 'beginner', ['alphabet', 'letters', 'abc', 'learning', 'lettering'], paths, [
    softStar(300, 90, 26, 12, 5, 4),
    softStar(90, 300, 22, 10, 5, 4),
    sparkle(196, 80, 12),
    sparkle(220, 330, 10),
    sparkle(350, 190, 9),
    sparkle(50, 210, 9),
  ]);
}

// ---- seasonal ---------------------------------------------------------------------------------

function ghost(): Art {
  let body = 'M 120 324 L 120 172 C 120 104 158 70 200 70 C 242 70 280 104 280 172 L 280 324';
  for (let i = 0; i < 4; i++) {
    const x0 = 280 - i * 40;
    body += ` Q ${x0 - 10} ${i % 2 ? 340 : 352} ${x0 - 20} 334 Q ${x0 - 30} ${i % 2 ? 352 : 340} ${x0 - 40} 324`;
  }
  body += ' Z';
  const armL = rotate(ellipse(108, 224, 26, 14), -28, 108, 224);
  const armR = rotate(ellipse(292, 224, 26, 14), 28, 292, 224);
  const mouth = 'M 184 204 Q 200 230 216 204 Q 200 212 184 204 Z';
  const ghostSil = [body, armL, armR];
  const outline = stack([[body, armL, armR]])[0];
  return {
    paths: [outline, ellipse(174, 168, 11, 16), ellipse(226, 168, 11, 16), circle(177, 162, 3.5), circle(229, 162, 3.5), mouth],
    detail: [blush(156, 196), blush(244, 196)],
    sil: ghostSil,
  };
}

function friendlyGhost(): Template {
  const a = ghost();
  const moon = 'M 92 40 C 58 44 50 92 84 108 C 62 110 38 92 40 66 C 42 40 68 30 92 40 Z';
  return fromArt('friendly-ghost', 'Friendly little ghost', 'beginner', ['ghost', 'halloween', 'spooky', 'cute', 'autumn'], a, [moon], [
    softStar(330, 60, 18, 8, 5, 3),
    softStar(350, 150, 12, 5, 5, 2),
    sparkle(60, 170, 10),
    sparkle(344, 280, 10),
    'M 46 260 Q 56 248 66 256 Q 72 244 80 256 Q 90 248 100 260',
  ]);
}

function pumpkin(): Art {
  const center = ellipse(200, 236, 76, 108);
  const inL = ellipse(152, 238, 70, 102);
  const inR = ellipse(248, 238, 70, 102);
  const outL = ellipse(112, 244, 64, 90);
  const outR = ellipse(288, 244, 64, 90);
  const stem = roundPoly([[186, 140], [190, 96], [212, 90], [214, 140]], 5);
  const leaf = petal(214, 112, 70, 50, 15);
  const eyeL = roundPoly([[146, 214], [184, 214], [165, 180]], 5);
  const eyeR = roundPoly(sym([[146, 214], [184, 214], [165, 180]]), 5);
  const nose = roundPoly([[190, 244], [210, 244], [200, 228]], 3);
  const mouth = 'M 140 266 C 166 316 234 316 260 266 C 236 280 164 280 140 266 Z';
  const lobes = [center, inL, inR, outL, outR];
  const layers = stack([eyeL, eyeR, nose, mouth, ...lobes]);
  const backs = stack([...lobes, leaf, stem]).slice(lobes.length);
  return {
    paths: [...layers, ...backs, inside(`${rrect(166, 266, 18, 22, 4)} ${rrect(216, 266, 18, 22, 4)}`, mouth), 'M 214 98 C 234 78 260 92 248 106 C 240 116 228 104 238 98'],
    detail: [inside('M 226 108 L 254 96', leaf), blush(126, 250), blush(274, 250)],
    sil: [...lobes, leaf, stem],
  };
}

function pumpkinTpl(): Template {
  const a = pumpkin();
  return fromArt('pumpkin-lantern', 'Grinning pumpkin lantern', 'beginner', ['pumpkin', 'jack-o-lantern', 'halloween', 'autumn', 'harvest'], a, [], [
    softStar(60, 60, 18, 8, 5, 3),
    softStar(340, 70, 14, 6, 5, 2),
    'M 300 40 Q 312 28 322 36 Q 328 24 336 36 Q 346 28 358 40',
    hide(line(24, 356, 376, 356), a.sil),
  ]);
}

function tier(cx: number, top: number, bottom: number, w: number, bumps: number): string {
  let d = `M ${f(cx - 8)} ${f(top + 10)} Q ${f(cx)} ${f(top - 2)} ${f(cx + 8)} ${f(top + 10)} L ${f(cx + w)} ${f(bottom)}`;
  const step = (2 * w) / bumps;
  for (let i = 0; i < bumps; i++) {
    const x0 = cx + w - i * step;
    d += ` Q ${f(x0 - step / 2)} ${f(bottom + 16)} ${f(x0 - step)} ${f(bottom)}`;
  }
  return `${d} Z`;
}

function xmasTree(): Art {
  const star = softStar(200, 58, 30, 13, 5, 4);
  const t1 = tier(200, 66, 160, 72, 3);
  const t2 = tier(200, 108, 240, 108, 4);
  const t3 = tier(200, 160, 316, 140, 5);
  const trunk = rrect(178, 312, 44, 26, 4);
  const pot = roundPoly([[146, 334], [254, 334], [240, 382], [160, 382]], 6);
  const giftA = rrect(52, 322, 64, 60, 4);
  const giftB = rrect(282, 334, 62, 48, 4);
  const tree = [t1, t2, t3];
  const layers = stack([star, t1, t2, t3, pot, trunk, giftA, giftB]);
  const baubles = [circle(176, 140, 10), circle(226, 130, 9), circle(150, 210, 11), circle(238, 206, 10), circle(196, 186, 9), circle(120, 290, 11), circle(276, 288, 11), circle(200, 270, 10), circle(160, 258, 9), circle(240, 256, 9)];
  return {
    paths: [
      ...layers,
      ...baubles.map((b) => hide(b, [star])),
      line(84, 322, 84, 382),
      line(52, 350, 116, 350),
      'M 84 322 C 64 300 60 316 84 322 C 104 300 108 316 84 322',
      line(313, 334, 313, 382),
      'M 313 334 C 296 314 292 330 313 334 C 330 314 334 330 313 334',
    ],
    detail: [
      hide(inside('M 150 150 Q 200 172 248 146 M 116 230 Q 200 262 290 226 M 98 300 Q 200 330 304 298', tree), baubles),
      inside('M 160 352 L 240 352', pot),
      sparkle(60, 80, 12),
      sparkle(340, 70, 10),
      sparkle(330, 200, 8),
      sparkle(66, 220, 8),
    ],
    sil: [star, ...tree, pot, trunk, giftA, giftB],
  };
}

function xmasTreeTpl(): Template {
  return fromArt('christmas-tree', 'Starry Christmas tree', 'beginner', ['christmas', 'tree', 'winter', 'holiday', 'presents'], xmasTree());
}

function snowman(): Art {
  const head = circle(200, 126, 46);
  const mid = circle(200, 214, 60);
  const base = circle(200, 312, 74);
  const dome = 'M 158 112 C 158 58 242 58 242 112 Z';
  const band = rrect(150, 100, 100, 22, 10);
  const pom = circle(200, 60, 14);
  const scarf = rrect(148, 162, 104, 22, 11);
  const tail = roundPoly([[214, 172], [240, 172], [250, 238], [222, 242]], 6);
  const nose = roundPoly([[198, 130], [198, 144], [238, 140]], 3);
  const layers = stack([nose, scarf, tail, band, pom, dome, head, mid, base]);
  return {
    paths: [
      ...layers,
      dot(184, 122, 3.6),
      dot(216, 122, 3.6),
      circle(200, 206, 6),
      circle(200, 234, 6),
      circle(200, 290, 7),
      circle(200, 322, 7),
      'M 142 206 L 92 166 M 112 182 L 96 160 M 112 182 L 88 186',
      'M 258 206 L 312 172 M 290 186 L 306 162 M 290 186 L 316 192',
    ],
    detail: [
      ...[[182, 152], [192, 157], [208, 157], [218, 152]].map(([x, y]) => circle(x, y, 2)),
      blush(172, 140),
      blush(228, 140),
      inside('M 224 236 L 224 230 M 233 236 L 233 228 M 242 235 L 242 228', tail),
      inside('M 170 112 L 170 110 M 186 102 L 186 120 M 200 102 L 200 120 M 214 102 L 214 120 M 230 102 L 230 120', band),
      inside('M 166 166 L 166 182 M 184 162 L 184 184', scarf),
    ],
    sil: [nose, scarf, tail, band, pom, dome, head, mid, base],
  };
}

function snowmanTpl(): Template {
  const a = snowman();
  return fromArt('snowman-scarf', 'Snowman in a woolly hat', 'beginner', ['snowman', 'christmas', 'winter', 'snow', 'holiday'], a, [], [
    hide('M 10 380 Q 100 362 200 376 Q 300 390 390 368', a.sil),
    flake(60, 60, 12),
    flake(340, 70, 10),
    flake(330, 260, 9),
    flake(56, 250, 9),
    flake(100, 120, 6),
    flake(300, 130, 6),
  ]);
}

// ---- advanced scenes --------------------------------------------------------------------------

function rays(cx: number, cy: number, r1: number, r2: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const [x1, y1] = polar(cx, cy, r1, (360 * i) / n);
    const [x2, y2] = polar(cx, cy, r2, (360 * i) / n);
    return line(x1, y1, x2, y2);
  });
}

function safariScene(): Template {
  const g = place(giraffe(), 0.66, -30, 87);
  const e = place(elephant(), 0.56, 182, 133);
  const l = place(lion(), 0.4, 120, 246);
  const canopy = [ellipse(214, 96, 84, 16), ellipse(172, 86, 44, 15), ellipse(254, 84, 50, 16), ellipse(214, 78, 40, 12)];
  const trunk = roundPoly([[204, 300], [208, 180], [176, 106], [188, 102], [214, 160], [238, 100], [250, 104], [222, 184], [226, 300]], 4);
  const tree: Art = { paths: [stack([canopy])[0], hide(trunk, canopy)], detail: [inside('M 150 96 Q 214 108 282 94', canopy)], sil: [canopy, trunk] };
  const back: Art = {
    paths: ['M 0 330 Q 100 316 200 326 Q 300 336 400 320', circle(340, 52, 26)],
    detail: [
      ...rays(340, 52, 34, 44, 12),
      cloud(80, 50, 70),
      bird(130, 128, 8),
      bird(150, 142, 6),
      bird(300, 130, 7),
      'M 0 262 Q 60 240 120 254 Q 160 264 200 254 Q 260 236 320 250 Q 360 260 400 246',
      ...[[24, 330], [110, 324], [300, 334], [380, 326], [40, 368], [110, 384], [300, 380], [366, 372], [270, 356], [134, 350]].map(([x, y]) => tuft(x, y, 14)),
      ...Array.from({ length: 44 }, (_, i) => {
        const x = 6 + i * 9;
        const y = 398 - ((i * 37) % 11);
        const h = 16 + ((i * 53) % 14);
        return `M ${f(x)} ${f(y)} Q ${f(x + 2)} ${f(y - h * 0.6)} ${f(x + ((i % 3) - 1) * 6)} ${f(y - h)}`;
      }),
      ...[[70, 300], [160, 296], [300, 292]].map(([x, y]) => `${circle(x, y, 4)} ${line(x, y + 4, x, y + 14)}`),
      ...[[96, 236], [350, 230]].map(([x, y]) => bird(x, y, 5)),
    ],
    sil: [],
  };
  const r = compose([l, e, g, tree, back]);
  return tpl('safari-parade', 'Safari parade under an acacia', 'advanced', ['safari', 'africa', 'animal', 'lion', 'giraffe', 'elephant', 'scene'], r.paths, r.detail);
}

function christmasScene(): Template {
  const t = place(xmasTree(), 0.66, -16, 136);
  const s = place(snowman(), 0.55, 150, 172);
  const roof = roundPoly([[300, 190], [350, 140], [400, 190]], 5);
  const wall = rrect(310, 184, 80, 104, 3);
  const chimney = rrect(366, 136, 16, 40, 3);
  const houseArt: Art = {
    paths: [...stack([roof, wall, chimney]), rrect(322, 204, 26, 26, 3), rrect(360, 230, 22, 58, 4)],
    detail: [
      'M 335 204 L 335 230 M 322 217 L 348 217',
      circle(377, 258, 2),
      circle(372, 120, 6),
      circle(380, 104, 8),
      circle(392, 84, 7),
      inside('M 310 250 L 352 250 M 310 268 L 352 268', wall),
    ],
    sil: [roof, wall, chimney],
  };
  const flakes: string[] = [];
  const pts: P[] = [[30, 30], [80, 52], [140, 26], [200, 64], [250, 30], [120, 96], [30, 118], [236, 116], [300, 40], [380, 40], [276, 150], [20, 220], [228, 196], [340, 100]];
  pts.forEach(([x, y], i) => flakes.push(i % 3 === 0 ? flake(x, y, 8) : circle(x, y, 2.5)));
  const sky: Art = {
    paths: ['M 0 300 Q 100 278 200 292 Q 300 304 400 284', 'M 196 40 C 176 42 170 70 190 80 C 176 82 162 70 164 56 C 166 40 182 34 196 40 Z'],
    detail: [
      ...flakes,
      softStar(290, 90, 10, 4, 5, 2),
      softStar(60, 180, 8, 3.5, 5, 1.5),
      ...[[20, 330], [380, 330], [210, 384], [380, 380]].map(([x, y]) => flake(x, y, 6)),
      'M 0 352 Q 60 340 120 350 M 300 352 Q 350 340 400 348',
      ...[[150, 150], [96, 70], [330, 330], [270, 360], [180, 330]].map(([x, y]) => circle(x, y, 2)),
    ],
    sil: [],
  };
  const r = compose([s, t, houseArt, sky]);
  return tpl('christmas-night', 'Snowy Christmas night', 'advanced', ['christmas', 'winter', 'snow', 'snowman', 'tree', 'scene', 'holiday'], r.paths, r.detail);
}

function townScene(): Template {
  const truck = place(fireTruck(), 0.46, 10, 219);
  const dig = place(digger(), 0.42, 215, 223);
  const tr = place(train(), 0.38, 120, 128);
  const base = 178;
  const houses: Art[] = [
    [24, 74, 86],
    [112, 84, 70],
    [210, 76, 92],
    [300, 80, 76],
  ].map(([x, w, h]) => {
    const roof = roundPoly([[x - 6, base - h], [x + w / 2, base - h - 38], [x + w + 6, base - h]], 4);
    const wall = rrect(x, base - h, w, h, 3);
    const door = rrect(x + w / 2 - 10, base - 32, 20, 32, 4);
    const winL = rrect(x + 9, base - h + 12, 18, 18, 3);
    const winR = rrect(x + w - 27, base - h + 12, 18, 18, 3);
    return {
      paths: [...stack([roof, wall]), door, winL, winR],
      detail: [
        line(x + 18, base - h + 12, x + 18, base - h + 30),
        line(x + w - 18, base - h + 12, x + w - 18, base - h + 30),
        inside(`M ${x} ${f(base - h - 10)} L ${x + w} ${f(base - h - 10)}`, roof),
        circle(x + w / 2 + 5, base - 16, 1.6),
        inside(`M ${x} ${f(base - h - 22)} L ${x + w} ${f(base - h - 22)}`, roof),
        line(x + w / 2 - 14, base, x + w / 2 - 18, base + 16),
        line(x + w / 2 + 14, base, x + w / 2 + 18, base + 16),
      ],
      sil: [roof, wall],
    };
  });
  const track: Art = {
    paths: [line(0, 250, 400, 250)],
    detail: Array.from({ length: 20 }, (_, i) => line(i * 20 + 4, 257, i * 20 + 16, 257)),
    sil: [],
  };
  const road: Art = {
    paths: [line(0, 270, 400, 270), line(0, 178, 400, 178)],
    detail: [
      ...[16, 96, 176, 256, 336].map((x) => line(x, 386, x + 44, 386)),
      cloud(80, 40, 60),
      cloud(250, 34, 52),
      circle(356, 36, 18),
      ...rays(356, 36, 25, 33, 8),
      bird(160, 50, 7),
      bird(178, 60, 5),
      ...Array.from({ length: 12 }, (_, i) => line(i * 32 + 14, 196, i * 32 + 28, 196)),
      ...[[104, 216], [376, 216], [200, 216]].map(([x, y]) => `${circle(x, y - 22, 14)} M ${x} ${y - 8} L ${x} ${y + 12}`),
    ],
    sil: [],
  };
  const r = compose([truck, dig, tr, track, ...houses, road]);
  return tpl('busy-town', 'Busy little town', 'advanced', ['town', 'vehicle', 'fire-truck', 'train', 'digger', 'scene', 'city'], r.paths, r.detail);
}

export const kids: Template[] = [
  woodlandFox(),
  nightOwl(),
  appleHedgehog(),
  smilingLion(),
  tallGiraffe(),
  babyElephant(),
  friendlyDino(),
  puppy(),
  goldfishBowl(),
  fireTruckTpl(),
  diggerTpl(),
  trainTpl(),
  sailboat(),
  iceCream(),
  pizza(),
  cupcake(),
  abcBlocks(),
  bubbleLetters(),
  friendlyGhost(),
  pumpkinTpl(),
  xmasTreeTpl(),
  snowmanTpl(),
  safariScene(),
  christmasScene(),
  townScene(),
];
