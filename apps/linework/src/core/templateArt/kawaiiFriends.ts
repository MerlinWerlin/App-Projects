// kawaiiFriends template batch (fb-1022b, 22 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Kawaii animals, stationery and objects with faces, chibi kids and creatures, plus three pieces of the cast member
// Pip the pencil sprite (docs/CAST.md). Same face kit as cute.ts: round chubby shapes, dot eyes, small blush ovals.
// Every design is our own (no existing characters, mascots or brands). Overlaps are hidden with occlude.ts.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, mirrorX, petal, poly, polar, rotate, rrect, type P } from './draw.ts';
import { clip, outline, region, roundPoly, stack, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

// ---- face kit -------------------------------------------------------------------------------

const dot = (x: number, y: number, r = 3.4): string => circle(x, y, r);
const smile = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w)} ${f(x + w)} ${f(y)}`;
const catMouth = (x: number, y: number, w: number): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x - w / 2)} ${f(y + w)} ${f(x)} ${f(y)} Q ${f(x + w / 2)} ${f(y + w)} ${f(x + w)} ${f(y)}`;
const sleepy = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * 0.9)} ${f(x + w)} ${f(y)}`;
const happy = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y - w * 1.1)} ${f(x + w)} ${f(y)}`;
const bigEye = (x: number, y: number, rx: number, ry: number): string =>
  `${ellipse(x, y, rx, ry)} ${circle(x + rx * 0.3, y - ry * 0.35, rx * 0.35)}`;
const blush = (x: number, y: number, rx = 9, ry = 5.5): string => ellipse(x, y, rx, ry);
const pair = (fn: (x: number, y: number) => string, cx: number, y: number, dx: number): string =>
  `${fn(cx - dx, y)} ${fn(cx + dx, y)}`;

function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

function heart(cx: number, cy: number, s: number): string {
  const p = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${p(0, -0.22)} C ${p(-0.1, -0.55)} ${p(-0.5, -0.55)} ${p(-0.5, -0.15)} C ${p(-0.5, 0.15)} ${p(-0.2, 0.35)} ${p(0, 0.55)} ` +
    `C ${p(0.2, 0.35)} ${p(0.5, 0.15)} ${p(0.5, -0.15)} C ${p(0.5, -0.55)} ${p(0.1, -0.55)} ${p(0, -0.22)} Z`
  );
}

function softStar(cx: number, cy: number, outer: number, inner: number, n: number, r: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rot + (180 * i) / n));
  return roundPoly(pts, r);
}

const zed = (x: number, y: number, s: number): string => poly([[x, y], [x + s, y], [x, y + s], [x + s, y + s]], false);

const drop = (x: number, y: number, h: number): string =>
  `M ${f(x)} ${f(y)} C ${f(x + h * 0.45)} ${f(y + h * 0.5)} ${f(x + h * 0.45)} ${f(y + h)} ${f(x)} ${f(y + h)} ` +
  `C ${f(x - h * 0.45)} ${f(y + h)} ${f(x - h * 0.45)} ${f(y + h * 0.5)} ${f(x)} ${f(y)} Z`;

/** Capsule (stadium) from (x1, y1) to (x2, y2) with radius r. */
function capsule(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI - 90;
  return rotate(rrect(cx - r, cy - len / 2 - r, 2 * r, len + 2 * r, r), deg, cx, cy);
}

/** Circle with n soft bumps (fur, clouds, fluffy ears). */
function fuzzy(cx: number, cy: number, r: number, n: number, b: number, rot = 0): string {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const p = polar(cx, cy, r, rot + (360 * i) / n);
    if (i === 0) d = `M ${f(p[0])} ${f(p[1])}`;
    else {
      const c = polar(cx, cy, r + 2 * b, rot + (360 * (i - 0.5)) / n);
      d += ` Q ${f(c[0])} ${f(c[1])} ${f(p[0])} ${f(p[1])}`;
    }
  }
  return `${d} Z`;
}

/** Place local art: scale s, rotate deg clockwise, local origin moved to (cx, cy). */
function place(d: string, cx: number, cy: number, s = 1, deg = 0): string {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return mapPath(d, { map: (x, y) => [cx + s * (x * c - y * sn), cy + s * (x * sn + y * c)], scale: s, rotate: deg, flip: false });
}

function placePoint(x: number, y: number, cx: number, cy: number, s = 1, deg = 0): P {
  const a = (deg * Math.PI) / 180;
  return [cx + s * (x * Math.cos(a) - y * Math.sin(a)), cy + s * (x * Math.sin(a) + y * Math.cos(a))];
}

/** Scale a finished template's art about (cx, cy). */
function zoom(t: Template, s: number, cx: number, cy: number): Template {
  const z = (d: string) => place(shiftOrigin(d, cx, cy), cx, cy, s);
  return { ...t, paths: t.paths.map(z), ...(t.detail ? { detail: t.detail.map(z) } : {}) };
}

function shiftOrigin(d: string, cx: number, cy: number): string {
  return mapPath(d, { map: (x, y) => [x - cx, y - cy], scale: 1, rotate: 0, flip: false });
}

const regions = (ls: readonly Layer[]): Region[] => ls.map(region);

function tpl(
  id: string,
  name: string,
  level: TemplateLevel,
  tags: string[],
  paths: string[],
  detail: string[] = [],
): Template {
  return {
    id: `kawaii-${id}`,
    name,
    category: 'cute',
    level,
    tags: ['cute', 'kawaii', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(detail.filter(Boolean).length ? { detail: detail.filter(Boolean) } : {}),
  };
}

// ---- Pip the pencil sprite (cast, docs/CAST.md) ---------------------------------------------------
// Local coordinates: origin at the top centre of the eraser cap; the point (feet) ends at y = 222.

type PipOpts = {
  eyes: 'dot' | 'sleepy' | 'happy';
  arms: string[]; // open strokes in local coordinates
  hands: P[];
};

function pip(cx: number, cy: number, s: number, deg: number, o: PipOpts) {
  const pl = (d: string) => place(d, cx, cy, s, deg);
  const eraser = 'M -38 30 L -38 16 C -38 5 -30 0 -20 0 L 20 0 C 30 0 38 5 38 16 L 38 30 Z';
  const ferrule = rrect(-46, 24, 92, 22, 5);
  const body = rrect(-45, 44, 90, 118, 5);
  const cone = 'M -43 158 L 43 158 L 7.5 212 Q 0 222 -7.5 212 Z';
  const leafShape = petal(6, -22, 55, 36, 10, 0.4);
  const hands = o.hands.map(([x, y]) => circle(x, y, 7.5));
  const local = stack([...hands, ferrule, eraser, body, cone, leafShape]);
  const eyes =
    o.eyes === 'dot'
      ? pair((x, y) => dot(x, y, 3.6), 0, 94, 14)
      : o.eyes === 'sleepy'
        ? pair((x, y) => sleepy(x, y, 7), 0, 94, 14)
        : pair((x, y) => happy(x, y, 7), 0, 96, 14);
  const handR = regions(hands);
  const extras = [
    'M 0 0 C -1 -8 1 -16 6 -22',
    ...o.arms.map((a) => clip(a, handR)),
    eyes,
    smile(0, 107, 7),
  ];
  const fine = [
    pair((x, y) => blush(x, y, 5.5, 3.4), 0, 108, 23),
    `${line(-30, 47, -30, 160)} ${line(30, 47, 30, 160)}`,
    `${line(-45, 31.5, 45, 31.5)} ${line(-45, 38.5, 45, 38.5)}`,
    clip('M -44 168 Q -29 178 -14.5 169 Q 0 179 14.5 169 Q 29 178 44 168', [region(cone)], 'inside'),
    'M -16 199 Q 0 204 16 199',
    line(6, -22, ...polar(6, -22, 28, 55)),
  ];
  return {
    layers: [...hands, ferrule, eraser, body, cone, leafShape].map(pl) as string[],
    strokes: extras.filter(Boolean).map(pl),
    paths: [...local, ...extras].filter(Boolean).map(pl),
    detail: fine.filter(Boolean).map(pl),
  };
}

// ---- beginner ---------------------------------------------------------------------------------

function curledFox(): Template {
  const head =
    'M 76 224 C 84 184 112 162 150 162 C 188 162 216 184 224 224 C 224 238 214 246 200 252 ' +
    'C 184 258 168 274 150 276 C 132 274 116 258 100 252 C 86 246 76 238 76 224 Z';
  const earL = roundPoly([[96, 200], [92, 124], [146, 166]], 9);
  const earR = roundPoly([[154, 166], [208, 124], [204, 200]], 9);
  const body = ellipse(240, 256, 124, 84);
  const tail =
    'M 344 276 C 378 330 324 372 230 368 C 160 364 96 348 84 314 C 82 300 94 294 106 300 ' +
    'C 142 318 200 326 248 320 C 296 314 330 298 344 276 Z';
  const layers = stack([head, earL, earR, tail, body]);
  return tpl(
    'fox-curled',
    'Sleepy curled-up fox',
    'beginner',
    ['fox', 'animal', 'sleep', 'bedtime', 'woodland', 'baby', 'kids'],
    [
      ...layers,
      pair((x, y) => sleepy(x, y, 11), 150, 224, 28),
      ellipse(150, 248, 8, 5.5),
      catMouth(150, 256, 6),
      zed(270, 112, 24),
      zed(306, 78, 17),
      zed(334, 52, 12),
    ],
    [
      pair(blush, 150, 252, 46),
      clip('M 108 192 L 106 152 L 132 172 M 192 192 L 194 152 L 168 172', [region(head)]),
      clip('M 124 312 C 112 326 112 346 124 360', [region(tail)], 'inside'),
      'M 84 228 C 104 232 122 242 136 258 M 216 228 C 196 232 178 242 164 258',
      clip('M 268 300 C 270 270 290 252 318 252', [region(body)], 'inside'),
      line(40, 368, 360, 368),
    ],
  );
}

/** Lily pad with a notch between angles a1 and a2 (degrees, 0 = right, clockwise). */
function lilyPad(cx: number, cy: number, rx: number, ry: number, a1: number, a2: number): string {
  const at = (deg: number): P => [cx + rx * Math.cos((deg * Math.PI) / 180), cy + ry * Math.sin((deg * Math.PI) / 180)];
  const [ax, ay] = at(a1);
  const [bx, by] = at(a2);
  const ix = cx + (ax + bx - 2 * cx) * 0.25;
  const iy = cy + (ay + by - 2 * cy) * 0.25;
  return `M ${f(ix)} ${f(iy)} L ${f(bx)} ${f(by)} A ${f(rx)} ${f(ry)} 0 1 1 ${f(ax)} ${f(ay)} Z`;
}

function frogLily(): Template {
  const head = [ellipse(200, 196, 108, 72), circle(142, 136, 34), circle(258, 136, 34)];
  const body = ellipse(200, 282, 84, 58);
  const handL = ellipse(160, 306, 18, 12);
  const handR = ellipse(240, 306, 18, 12);
  const footL = ellipse(122, 326, 32, 14);
  const footR = ellipse(278, 326, 32, 14);
  const pad = lilyPad(200, 336, 168, 38, 20, 48);
  const layers = stack([handL, handR, head, body, footL, footR, pad]);
  const eyes = `${circle(142, 138, 13)} ${circle(258, 138, 13)} ${circle(146, 133, 4)} ${circle(262, 133, 4)}`;
  return tpl(
    'frog-lily',
    'Happy frog on a lily pad',
    'beginner',
    ['frog', 'pond', 'animal', 'summer', 'garden', 'kids'],
    [...layers, eyes, smile(200, 214, 30)],
    [
      pair(blush, 200, 222, 64),
      `${line(150, 306, 150, 314)} ${line(160, 307, 160, 316)} ${line(250, 306, 250, 314)} ${line(240, 307, 240, 316)}`,
      clip('M 60 340 L 200 336 L 330 326 M 200 336 L 150 364 M 200 336 L 250 366', regions([body, footL, footR, handL, handR])),
      'M 32 236 Q 46 228 60 236 M 340 236 Q 354 228 368 236 M 50 380 Q 70 370 90 380 M 310 382 Q 330 372 350 382',
      sparkle(70, 90, 12),
      sparkle(332, 76, 9),
    ],
  );
}

function axolotl(): Template {
  const head = ellipse(200, 180, 104, 78);
  const gills = [
    petal(112, 152, -55, 62, 13, 0.6),
    petal(104, 180, -88, 64, 13, 0.6),
    petal(112, 208, -122, 60, 13, 0.6),
    petal(288, 152, 55, 62, 13, 0.6),
    petal(296, 180, 88, 64, 13, 0.6),
    petal(288, 208, 122, 60, 13, 0.6),
  ];
  const body = ellipse(196, 294, 82, 56);
  const tail = 'M 262 272 C 312 266 352 278 368 300 C 344 320 300 330 260 318 Z';
  const armL = ellipse(146, 334, 18, 13);
  const armR = ellipse(236, 340, 18, 13);
  const layers = stack([head, ...gills, armL, armR, body, tail]);
  return tpl(
    'axolotl',
    'Smiling axolotl',
    'beginner',
    ['axolotl', 'animal', 'pond', 'pet', 'baby', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 4.2), 200, 186, 50), smile(200, 204, 12)],
    [
      pair((x, y) => blush(x, y, 11, 6), 200, 208, 74),
      ...gills.map((g, i) => {
        const [bx, by, deg] = [[112, 152, -55], [104, 180, -88], [112, 208, -122], [288, 152, 55], [296, 180, 88], [288, 208, 122]][i];
        return clip(line(bx, by, ...polar(bx, by, 48, deg)), [region(head)]);
      }),
      clip('M 268 296 C 300 296 330 298 360 300', [region(tail)], 'inside'),
      `${line(140, 334, 140, 342)} ${line(152, 334, 152, 342)} ${line(230, 340, 230, 348)} ${line(242, 340, 242, 348)}`,
      `${circle(60, 300, 8)} ${circle(80, 330, 5)} ${circle(340, 120, 7)} ${circle(356, 96, 4)}`,
    ],
  );
}

function chickEgg(): Template {
  const shell =
    'M 106 250 L 130 230 L 154 256 L 178 228 L 202 256 L 226 228 L 250 256 L 274 230 L 296 250 ' +
    'C 304 270 302 296 292 316 C 274 352 240 370 200 370 C 160 370 126 352 108 316 C 98 296 98 270 106 250 Z';
  const cap = rotate(
    'M 140 148 L 158 162 L 176 144 L 196 164 L 216 144 L 236 162 L 256 146 C 252 104 226 84 198 84 C 168 84 144 106 140 148 Z',
    -14,
    198,
    130,
  );
  const chick = circle(200, 210, 86);
  const wingL = petal(122, 236, -120, 40, 13, 0.5);
  const wingR = petal(278, 236, 120, 40, 13, 0.5);
  const layers = stack([shell, cap, wingL, wingR, chick]);
  return tpl(
    'chick-egg',
    'Baby chick in an eggshell',
    'beginner',
    ['chick', 'egg', 'easter', 'spring', 'baby', 'animal', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 4), 200, 204, 32), 'M 190 218 L 210 218 L 200 230 Z'],
    [
      pair(blush, 200, 226, 50),
      'M 150 300 L 168 314 L 160 330 M 252 290 L 238 310 L 248 322',
      sparkle(70, 120, 13),
      sparkle(336, 110, 10),
      sparkle(346, 320, 8),
      line(60, 376, 340, 376),
    ],
  );
}

function sealPup(): Template {
  const body =
    'M 84 262 C 80 196 130 156 186 160 C 246 164 290 206 318 252 C 330 272 330 300 310 310 ' +
    'C 270 326 160 330 120 318 C 96 310 86 292 84 262 Z';
  const tailA = petal(316, 292, 62, 54, 15, 0.6);
  const tailB = petal(316, 298, 112, 54, 15, 0.6);
  const flipper = petal(196, 292, 150, 52, 15, 0.5);
  const layers = stack([flipper, body, tailA, tailB]);
  return tpl(
    'seal-pup',
    'Chubby seal pup',
    'beginner',
    ['seal', 'pup', 'animal', 'winter', 'snow', 'baby', 'kids'],
    [
      ...layers,
      pair((x, y) => dot(x, y, 5), 144, 226, 26),
      ellipse(144, 242, 8, 5),
      catMouth(144, 252, 8),
      'M 40 332 C 120 344 280 344 368 330',
    ],
    [
      pair(blush, 144, 250, 40),
      `${circle(126, 250, 1.6)} ${circle(120, 244, 1.6)} ${circle(162, 250, 1.6)} ${circle(168, 244, 1.6)}`,
      `${line(116, 254, 94, 258)} ${line(172, 254, 194, 258)}`,
      sparkle(76, 110, 12),
      sparkle(300, 100, 9),
      `${circle(220, 70, 4)} ${circle(352, 170, 4)} ${circle(50, 180, 3)}`,
    ],
  );
}

function kittenCup(): Template {
  const head = circle(200, 178, 68);
  const earL = roundPoly([[142, 150], [146, 92], [186, 118]], 9);
  const earR = roundPoly([[214, 118], [254, 92], [258, 150]], 9);
  const pawL = ellipse(166, 234, 16, 11);
  const pawR = ellipse(234, 234, 16, 11);
  const cup = 'M 96 230 A 104 16 0 0 0 304 230 C 304 302 262 340 200 340 C 138 340 96 302 96 230 Z';
  const handle = 'M 298 252 C 352 242 356 312 284 314 L 290 296 C 330 292 330 262 300 268 Z';
  const saucer = ellipse(200, 346, 144, 20);
  const layers = stack([pawL, pawR, cup, handle, head, earL, earR, saucer]);
  const back = clip('M 96 230 A 104 16 0 0 1 304 230', regions([head, earL, earR, pawL, pawR]));
  return tpl(
    'kitten-teacup',
    'Kitten in a teacup',
    'beginner',
    ['kitten', 'cat', 'teacup', 'tea', 'pet', 'animal', 'kids'],
    [...layers, back, pair((x, y) => dot(x, y, 3.8), 200, 180, 26), 'M 195 194 L 205 194 L 200 199 Z', catMouth(200, 200, 7)],
    [
      pair(blush, 200, 204, 42),
      `${line(150, 190, 124, 186)} ${line(150, 198, 124, 202)} ${line(250, 190, 276, 186)} ${line(250, 198, 276, 202)}`,
      clip('M 156 140 L 156 112 L 176 124 M 244 140 L 244 112 L 224 124', [region(head)]),
      heart(200, 286, 34),
      heart(320, 110, 26),
      heart(86, 96, 20),
    ],
  );
}

function eraserBuddy(): Template {
  const body = rrect(90, 150, 220, 130, 30);
  const sleeve = rrect(204, 138, 80, 154, 10);
  const footL = ellipse(150, 288, 20, 11);
  const footR = ellipse(250, 300, 20, 11);
  const layers = stack([sleeve, body, footL, footR]);
  return tpl(
    'eraser-buddy',
    'Happy eraser buddy',
    'beginner',
    ['eraser', 'stationery', 'school', 'office', 'object', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 4), 148, 206, 24), smile(148, 222, 8), 'M 34 350 Q 54 336 74 350 Q 94 364 114 350'],
    [
      pair((x, y) => blush(x, y, 8, 5), 148, 226, 38),
      softStar(244, 214, 20, 9, 5, 2),
      `${line(212, 156, 276, 156)} ${line(212, 274, 276, 274)}`,
      `${ellipse(320, 330, 9, 5)} ${ellipse(342, 346, 7, 4)} ${ellipse(310, 352, 6, 3.5)} ${ellipse(128, 348, 6, 3.5)}`,
      sparkle(70, 110, 12),
      sparkle(338, 100, 10),
    ],
  );
}

function teapot(): Template {
  const lid = 'M 146 162 C 146 126 254 126 254 162 Z';
  const knob = circle(200, 124, 12);
  const body = ellipse(200, 242, 112, 86);
  const spout = 'M 102 222 C 70 216 58 186 44 160 L 60 152 C 76 176 94 192 118 196 Z';
  const handle = 'M 300 198 C 362 192 366 292 296 292 L 302 272 C 340 270 342 216 306 220 Z';
  const foot = rrect(146, 314, 108, 22, 9);
  const layers = stack([lid, knob, body, spout, handle, foot]);
  return tpl(
    'teapot',
    'Smiling little teapot',
    'beginner',
    ['teapot', 'tea', 'kitchen', 'object', 'cozy', 'kids'],
    [...layers, pair((x, y) => happy(x, y, 11), 200, 236, 36), smile(200, 254, 10)],
    [
      pair(blush, 200, 258, 56),
      clip('M 96 214 C 150 228 250 228 304 214', [region(body)], 'inside'),
      'M 46 132 C 34 116 56 106 46 88 M 72 120 C 62 106 80 98 72 84',
      heart(310, 110, 26),
      heart(346, 70, 16),
      line(60, 340, 340, 340),
    ],
  );
}

function peekabooGhost(): Template {
  const ghost =
    'M 122 300 L 122 196 C 122 126 160 94 200 94 C 240 94 278 126 278 196 L 278 300 ' +
    'Q 258 328 239 300 Q 219 328 200 300 Q 181 328 161 300 Q 141 328 122 300 Z';
  const armL = rotate(ellipse(112, 204, 26, 15), -30, 112, 204);
  const armR = rotate(ellipse(288, 204, 26, 15), 30, 288, 204);
  const layers = stack([ghost, armL, armR]);
  return tpl(
    'ghost-peekaboo',
    'Tiny peekaboo ghost',
    'beginner',
    ['ghost', 'halloween', 'spooky', 'creature', 'night', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 5), 200, 186, 30), ellipse(200, 216, 9, 11)],
    [
      pair(blush, 200, 206, 50),
      ellipse(200, 358, 70, 10),
      softStar(70, 90, 16, 7, 5, 2),
      softStar(334, 80, 12, 5, 5, 2),
      sparkle(350, 250, 10),
      sparkle(54, 260, 9),
    ],
  );
}

function pipWaving(): Template {
  const p = pip(200, 104, 1.05, 0, {
    eyes: 'dot',
    arms: ['M -45 118 Q -64 128 -68 146', 'M 45 112 Q 68 104 74 78'],
    hands: [[-69, 152], [75, 71]],
  });
  return tpl(
    'pip-waving',
    'Pip the pencil sprite waving',
    'beginner',
    ['cast', 'pip', 'pencil', 'stationery', 'mascot', 'kids'],
    [...p.paths],
    [
      ...p.detail,
      ellipse(200, 344, 56, 8),
      'M 300 160 Q 312 150 314 136 M 312 176 Q 328 170 334 156',
      sparkle(80, 110, 13),
      sparkle(330, 300, 10),
      sparkle(70, 290, 8),
    ],
  );
}

function babyBat(): Template {
  const body = circle(200, 222, 70);
  const earL = roundPoly([[150, 182], [150, 124], [186, 158]], 8);
  const earR = mirrorX(earL, 200);
  const wingL =
    'M 142 200 C 112 158 62 150 30 172 C 46 192 50 212 44 236 Q 66 226 80 246 Q 96 230 112 252 Q 126 236 144 248 Z';
  const wingR = mirrorX(wingL, 200);
  const footL = ellipse(182, 294, 9, 7);
  const footR = ellipse(218, 294, 9, 7);
  const moon = 'M 330 40 C 296 50 286 96 312 120 C 332 136 356 132 368 120 C 342 120 322 100 324 74 C 325 60 328 50 330 40 Z';
  const layers = stack([body, earL, earR, wingL, wingR, footL, footR]);
  return tpl(
    'bat-baby',
    'Round baby bat',
    'beginner',
    ['bat', 'halloween', 'night', 'animal', 'spooky', 'kids'],
    [...layers, moon, pair((x, y) => dot(x, y, 4.2), 200, 216, 26), smile(200, 232, 9), 'M 204 238 L 208 246 L 212 237'],
    [
      pair(blush, 200, 236, 42),
      clip('M 112 200 L 80 244 M 80 180 L 60 228', [region(body)]),
      clip(mirrorX('M 112 200 L 80 244 M 80 180 L 60 228', 200), [region(body)]),
      softStar(70, 80, 12, 5, 5, 2),
      softStar(250, 60, 9, 4, 5, 2),
      sparkle(80, 330, 10),
      sparkle(330, 320, 9),
    ],
  );
}

function alarmClock(): Template {
  const body = circle(200, 225, 104);
  const face = circle(200, 225, 84);
  const bellL = rotate('M 88 130 A 42 36 0 0 1 172 130 Z', -32, 130, 130);
  const bellR = mirrorX(bellL, 200);
  const hammer = `${rrect(194, 100, 12, 24, 4)}`;
  const legL = capsule(140, 318, 122, 350, 9);
  const legR = capsule(260, 318, 278, 350, 9);
  const layers = stack([body, bellL, bellR, hammer, legL, legR]);
  const ticks = [[200, 156], [269, 225], [200, 294], [131, 225]].map(([x, y]) => circle(x, y, 4)).join(' ');
  return tpl(
    'alarm-clock',
    'Sleepy alarm clock',
    'beginner',
    ['clock', 'alarm', 'morning', 'bedtime', 'object', 'kids'],
    [...layers, face, ticks, pair((x, y) => sleepy(x, y, 11), 200, 232, 32), smile(200, 256, 8), 'M 200 204 L 200 176 M 200 204 L 222 192', circle(200, 206, 4)],
    [pair(blush, 200, 252, 50), zed(300, 96, 22), zed(334, 64, 15), zed(360, 40, 10), line(60, 360, 340, 360)],
  );
}

function backpack(): Template {
  const body =
    'M 110 170 C 110 120 150 100 200 100 C 250 100 290 120 290 170 L 290 320 C 290 340 278 350 258 350 ' +
    'L 142 350 C 122 350 110 340 110 320 Z';
  const handle = 'M 174 104 C 174 64 226 64 226 104 L 214 104 C 214 80 186 80 186 104 Z';
  const pocket = rrect(140, 254, 120, 82, 20);
  const flap = 'M 140 278 C 140 260 150 250 168 250 L 232 250 C 250 250 260 260 260 278 Q 200 300 140 278 Z';
  const strapL = rrect(96, 190, 20, 120, 10);
  const strapR = rrect(284, 190, 20, 120, 10);
  const layers = stack([flap, pocket, body, handle, strapL, strapR]);
  return tpl(
    'backpack',
    'Happy little backpack',
    'beginner',
    ['backpack', 'school', 'bag', 'travel', 'object', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 4), 200, 188, 28), smile(200, 204, 9), circle(200, 288, 6)],
    [
      pair(blush, 200, 210, 46),
      'M 124 160 C 140 120 260 120 276 160',
      rrect(268, 152, 8, 18, 3),
      `${line(304, 220, 330, 250)} ${softStar(336, 262, 16, 7, 5, 2)}`,
      sparkle(70, 110, 12),
      sparkle(60, 300, 9),
    ],
  );
}

function fuzzyMonster(): Template {
  const body = fuzzy(200, 218, 104, 22, 6);
  const hornL = petal(152, 128, -25, 42, 12, 0.3);
  const hornR = petal(248, 128, 25, 42, 12, 0.3);
  const armL = petal(98, 236, -112, 40, 13, 0.6);
  const armR = petal(302, 236, 112, 40, 13, 0.6);
  const footL = ellipse(160, 330, 30, 15);
  const footR = ellipse(240, 330, 30, 15);
  const layers = stack([footL, footR, body, hornL, hornR, armL, armR]);
  return tpl(
    'monster-fuzzy',
    'Tiny fuzzy monster',
    'beginner',
    ['monster', 'creature', 'fuzzy', 'halloween', 'silly', 'kids'],
    [
      ...layers,
      `${circle(170, 200, 17)} ${circle(230, 200, 17)}`,
      `${circle(173, 204, 7)} ${circle(233, 204, 7)}`,
      'M 168 240 Q 200 266 232 240',
      'M 206 248 L 216 247 L 211 258 Z',
    ],
    [pair(blush, 200, 236, 56), `${circle(160, 282, 6)} ${circle(240, 276, 8)} ${circle(204, 296, 5)}`, sparkle(66, 100, 12), sparkle(338, 96, 10)],
  );
}

// ---- intermediate -----------------------------------------------------------------------------

function otterFloat(): Template {
  const head = circle(110, 220, 52);
  const earL = circle(76, 178, 12);
  const earR = circle(140, 172, 12);
  const body = ellipse(218, 250, 120, 48);
  const shellPath = 'M 210 236 L 182 208 C 180 176 240 176 238 208 Z';
  const pawL = circle(184, 216, 11);
  const pawR = circle(236, 216, 11);
  const footA = rotate(ellipse(316, 206, 13, 24), 20, 316, 206);
  const footB = rotate(ellipse(340, 216, 13, 24), 30, 340, 216);
  const tail = petal(330, 266, 100, 48, 15, 0.4);
  const front = [pawL, pawR, shellPath, head, earL, earR, footA, footB, body, tail];
  const layers = stack(front);
  const water =
    'M 24 290 Q 48 276 72 290 Q 96 304 120 290 Q 144 276 168 290 Q 192 304 216 290 Q 240 276 264 290 ' +
    'Q 288 304 312 290 Q 336 276 360 290 Q 372 297 380 293';
  return tpl(
    'otter-floating',
    'Otter floating with a shell',
    'intermediate',
    ['otter', 'river', 'animal', 'water', 'shell', 'baby', 'kids'],
    [
      ...layers,
      clip(water, regions(front)),
      ellipse(104, 236, 24, 16),
      ellipse(104, 228, 8, 5),
      pair((x, y) => dot(x, y, 3.8), 104, 208, 20),
      catMouth(104, 240, 6),
    ],
    [
      blush(70, 232),
      blush(140, 232),
      clip(`${line(210, 232, 192, 196)} ${line(210, 232, 210, 188)} ${line(210, 232, 228, 196)}`, regions([pawL, pawR])),
      `${line(84, 236, 62, 232)} ${line(84, 242, 62, 246)} ${line(124, 236, 146, 232)} ${line(124, 242, 146, 246)}`,
      clip('M 150 270 C 200 284 260 282 310 266', regions([pawL, pawR, shellPath]).concat([]), 'outside'),
      'M 40 336 Q 70 322 100 336 M 150 350 Q 180 336 210 350 M 270 334 Q 300 320 330 334',
      `${circle(60, 120, 6)} ${circle(76, 98, 4)} ${circle(320, 140, 5)}`,
      sparkle(260, 90, 12),
    ],
  );
}

function koalaBranch(): Template {
  const head = circle(200, 168, 76);
  const earL = fuzzy(126, 112, 38, 9, 4.5, 10);
  const earR = fuzzy(274, 112, 38, 9, 4.5, -10);
  const nose = ellipse(200, 184, 19, 27);
  const body = ellipse(210, 290, 70, 64);
  const branch = rotate(rrect(30, 258, 360, 30, 15), -25, 210, 273);
  const armL = rotate(ellipse(162, 268, 22, 42), 35, 162, 268);
  const armR = rotate(ellipse(256, 244, 22, 42), 35, 256, 244);
  const leg = rotate(ellipse(236, 326, 22, 36), -30, 236, 326);
  const leaves = [
    petal(336, 200, 20, 44, 16, 0.5),
    petal(328, 208, 80, 46, 16, 0.5),
    petal(70, 340, 200, 44, 16, 0.5),
    petal(78, 334, 250, 46, 16, 0.5),
  ];
  const layers = stack([nose, armL, armR, leg, head, earL, earR, branch, ...leaves, body]);
  return tpl(
    'koala-branch',
    'Koala hugging a branch',
    'intermediate',
    ['koala', 'animal', 'eucalyptus', 'tree', 'hug', 'baby', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 4.2), 200, 162, 42), smile(200, 222, 8)],
    [
      pair(blush, 200, 196, 52),
      clip(`${circle(126, 112, 20)} ${circle(274, 112, 20)}`, [region(head)]),
      'M 150 292 L 160 282 M 162 298 L 172 288 M 246 268 L 256 258 M 258 274 L 268 264',
      clip(clip('M 70 330 C 150 296 250 252 370 196', regions([armL, armR, leg, ...leaves])), [region(branch)], 'inside'),
      ...[[336, 200, 20], [328, 208, 80], [70, 340, 200], [78, 334, 250]].map(([x, y, d]) => line(x, y, ...polar(x, y, 34, d))),
      sparkle(60, 90, 12),
      sparkle(330, 60, 9),
    ],
  );
}

function slothHanging(): Template {
  const branch = rrect(20, 78, 360, 24, 12);
  const head = circle(200, 214, 60);
  const armL = capsule(150, 96, 162, 236, 17);
  const armR = capsule(250, 96, 238, 236, 17);
  const body = ellipse(200, 282, 72, 70);
  const legL = capsule(168, 330, 160, 360, 14);
  const legR = capsule(232, 330, 240, 360, 14);
  const leaves = [petal(44, 100, 160, 46, 14, 0.5), petal(68, 100, 200, 40, 12, 0.5), petal(336, 100, 170, 46, 14, 0.5), petal(360, 100, 215, 40, 12, 0.5)];
  const layers = stack([head, armL, armR, body, legL, legR, ...leaves, branch]);
  const patches = `${rotate(ellipse(176, 212, 19, 12), 18, 176, 212)} ${rotate(ellipse(224, 212, 19, 12), -18, 224, 212)}`;
  return tpl(
    'sloth-hanging',
    'Sleepy sloth hanging from a branch',
    'intermediate',
    ['sloth', 'animal', 'jungle', 'tree', 'sleep', 'baby', 'kids'],
    [...layers, patches, pair((x, y) => sleepy(x, y, 8), 200, 212, 24), ellipse(200, 232, 8, 5), smile(200, 242, 7)],
    [
      ellipse(200, 224, 46, 38),
      pair((x, y) => blush(x, y, 7, 4.5), 200, 238, 36),
      'M 138 82 Q 142 72 150 76 M 150 80 Q 154 70 162 74 M 238 80 Q 242 70 250 74 M 250 82 Q 254 72 262 76',
      clip('M 172 300 C 190 310 210 310 228 300 M 168 318 C 190 330 210 330 232 318', []),
      ...leaves.map((_, i) => {
        const [x, deg] = [[44, 160], [68, 200], [336, 170], [360, 215]][i];
        return line(x, 100, ...polar(x, 100, 34, deg));
      }),
      zed(262, 186, 18),
      zed(288, 164, 13),
      zed(308, 148, 9),
      sparkle(80, 300, 10),
    ],
  );
}

function hedgehogSleep(): Template {
  const pts: P[] = [];
  const n = 17;
  for (let i = 0; i <= 2 * n; i++) pts.push(polar(218, 300, i % 2 === 0 ? 100 : 122, -94 + (188 * i) / (2 * n)));
  const spikes = roundPoly(pts, 3);
  const face = 'M 168 246 C 136 236 96 252 76 274 C 68 284 74 296 86 298 C 112 304 152 306 176 300 Z';
  const nose = circle(76, 284, 8);
  const ear = circle(150, 246, 11);
  const leaves = [petal(120, 320, -100, 70, 18, 0.5), petal(300, 320, 100, 56, 18, 0.5), petal(210, 324, 180, 40, 15, 0.5)];
  const layers = stack([nose, face, ear, spikes, ...leaves]);
  const marks: string[] = [];
  for (let i = 0; i < 14; i++) {
    const a = -70 + i * 11;
    const r = 60 + (i % 3) * 14;
    const [x, y] = polar(218, 300, r, a);
    marks.push(`M ${f(x - 5)} ${f(y + 4)} L ${f(x)} ${f(y - 6)} L ${f(x + 5)} ${f(y + 4)}`);
  }
  return zoom(tpl(
    'hedgehog-sleeping',
    'Sleepy hedgehog on autumn leaves',
    'intermediate',
    ['hedgehog', 'animal', 'autumn', 'woodland', 'sleep', 'baby', 'kids'],
    [...layers, sleepy(116, 268, 9), smile(98, 292, 5)],
    [
      clip(marks.join(' '), regions([face, ear])),
      blush(130, 284, 8, 5),
      ...leaves.map((_, i) => {
        const [x, deg, len] = [[120, -100, 56], [300, 100, 44], [210, 180, 30]][i];
        return line(x, i === 2 ? 324 : 320, ...polar(x, i === 2 ? 324 : 320, len, deg));
      }),
      zed(110, 150, 22),
      zed(80, 116, 15),
      zed(58, 90, 10),
      line(50, 350, 350, 350),
    ],
  ), 1.1, 210, 240);
}

function bunny(cx: number, deg: number, floppy: boolean) {
  const r = (d: string) => rotate(d, deg, cx, 300);
  const head = r(circle(cx, 180, 54));
  const out = deg > 0 ? -1 : 1; // ears lean away from the partner
  const earA = r(petal(cx - 18, 138, -6 + out * 10, 92, 15, 0.5));
  const earB = floppy ? r(petal(cx + 26, 142, 72, 74, 15, 0.5)) : r(petal(cx + 18, 138, 6 + out * 10, 92, 15, 0.5));
  const body = r(ellipse(cx, 288, 60, 62));
  const feet = [r(ellipse(cx - 28, 346, 22, 12)), r(ellipse(cx + 28, 346, 22, 12))];
  const pt = (x: number, y: number): P => {
    const a = (deg * Math.PI) / 180;
    return [cx + (x - cx) * Math.cos(a) - (y - 300) * Math.sin(a), 300 + (x - cx) * Math.sin(a) + (y - 300) * Math.cos(a)];
  };
  return { head, ears: [earA, earB], body, feet, pt };
}

function bunnyPair(): Template {
  const a = bunny(130, 8, false);
  const b = bunny(270, -8, true);
  const pawL = circle(170, 272, 13);
  const pawR = circle(230, 272, 13);
  const hrt = heart(200, 268, 88);
  const layers = stack([pawL, pawR, hrt, a.head, b.head, ...a.ears, ...b.ears, a.body, b.body, ...a.feet, ...b.feet]);
  const [ax, ay] = a.pt(130, 186);
  const [bx, by] = b.pt(270, 186);
  return tpl(
    'bunny-pair',
    'Bunny pair sharing a heart',
    'intermediate',
    ['bunny', 'rabbit', 'love', 'valentine', 'friends', 'animal', 'baby'],
    [
      ...layers,
      pair((x, y) => happy(x, y, 8), ax, ay - 4, 22),
      pair((x, y) => dot(x, y, 3.8), bx, by - 4, 22),
      `M ${f(ax - 4)} ${f(ay + 10)} L ${f(ax + 4)} ${f(ay + 10)} L ${f(ax)} ${f(ay + 14)} Z`,
      `M ${f(bx - 4)} ${f(by + 10)} L ${f(bx + 4)} ${f(by + 10)} L ${f(bx)} ${f(by + 14)} Z`,
      catMouth(ax, ay + 15, 5),
      catMouth(bx, by + 15, 5),
    ],
    [
      pair((x, y) => blush(x, y, 8, 5), ax, ay + 14, 34),
      pair((x, y) => blush(x, y, 8, 5), bx, by + 14, 34),
      clip(`${rotate(petal(112, 138, -16, 70, 6, 0.5), 8, 130, 300)} ${rotate(petal(148, 138, -4, 70, 6, 0.5), 8, 130, 300)} ${rotate(petal(252, 138, 4, 70, 6, 0.5), -8, 270, 300)}`, regions([a.head, b.head])),
      heart(200, 66, 30),
      heart(150, 40, 18),
      heart(254, 44, 16),
      line(40, 362, 360, 362),
    ],
  );
}

function puppyGift(): Template {
  const box = rrect(100, 236, 200, 124, 10);
  const lid = rotate(rrect(40, 196, 150, 30, 7), -24, 115, 211);
  const head = circle(200, 186, 70);
  const earL = petal(146, 146, 205, 86, 24, 0.55);
  const earR = petal(254, 146, 155, 86, 24, 0.55);
  const pawL = circle(162, 238, 16);
  const pawR = circle(238, 238, 16);
  const bowL = petal(200, 300, -70, 44, 17, 0.6);
  const bowR = petal(200, 300, 70, 44, 17, 0.6);
  const knot = circle(200, 300, 10);
  const layers = stack([pawL, pawR, knot, bowL, bowR, box, earL, earR, head, lid]);
  return tpl(
    'puppy-gift',
    'Puppy in a gift box',
    'intermediate',
    ['puppy', 'dog', 'gift', 'present', 'birthday', 'pet', 'animal', 'kids'],
    [...layers, ellipse(200, 208, 30, 22), ellipse(200, 198, 10, 7), pair((x, y) => dot(x, y, 4.2), 200, 176, 28), catMouth(200, 212, 7)],
    [
      pair(blush, 200, 212, 44),
      clip(`${line(188, 236, 188, 360)} ${line(212, 236, 212, 360)}`, regions([knot, bowL, bowR, pawL, pawR])),
      `${line(154, 232, 154, 242)} ${line(162, 230, 162, 242)} ${line(230, 230, 230, 242)} ${line(238, 230, 238, 242)}`,
      'M 200 214 Q 196 228 204 228 Q 210 226 206 214',
      sparkle(60, 100, 12),
      sparkle(340, 90, 10),
      sparkle(346, 300, 8),
      softStar(312, 168, 13, 6, 5, 2),
    ],
  );
}

function redPanda(): Template {
  const head = [ellipse(200, 168, 88, 70), petal(118, 182, -130, 30, 14, 0.4), petal(282, 182, 130, 30, 14, 0.4)];
  const earL = roundPoly([[118, 136], [126, 76], [172, 108]], 12);
  const earR = mirrorX(earL, 200);
  const scarf = 'M 136 236 C 168 256 232 256 264 236 L 268 258 C 234 280 166 280 132 258 Z';
  const scarfTail = rotate(rrect(226, 254, 28, 70, 6), -12, 240, 260);
  const body = ellipse(200, 302, 68, 64);
  const pawL = ellipse(172, 354, 20, 13);
  const pawR = ellipse(228, 354, 20, 13);
  const tail = 'M 250 340 C 324 350 374 296 352 230 C 342 200 312 196 302 214 C 324 244 318 296 258 304 Z';
  const layers = stack([scarf, scarfTail, head, earL, earR, pawL, pawR, body, tail]);
  return tpl(
    'red-panda-scarf',
    'Red panda in a cosy scarf',
    'intermediate',
    ['red-panda', 'panda', 'animal', 'winter', 'scarf', 'baby', 'kids'],
    [...layers, ellipse(200, 194, 34, 25), 'M 192 186 L 208 186 L 200 195 Z', pair((x, y) => dot(x, y, 4.2), 200, 166, 38), catMouth(200, 200, 6)],
    [
      pair(blush, 200, 196, 58),
      `${ellipse(160, 144, 12, 7)} ${ellipse(240, 144, 12, 7)}`,
      'M 156 178 C 150 194 152 206 160 214 M 244 178 C 250 194 248 206 240 214',
      clip('M 132 120 L 140 92 L 160 110 M 268 120 L 260 92 L 240 110', regions([head])),
      clip('M 296 330 C 312 316 318 308 322 296 M 322 312 C 340 296 346 284 348 270 M 324 238 C 336 244 344 252 350 262', [region(tail)], 'inside'),
      clip(`${line(222, 316, 230, 322)} ${line(232, 316, 240, 322)} ${line(242, 314, 250, 320)}`, []),
      'M 156 258 L 170 246 M 180 262 L 194 250 M 206 262 L 220 250',
      sparkle(70, 90, 12),
      sparkle(60, 300, 9),
    ],
  );
}

function instantCamera(): Template {
  const body = rrect(70, 110, 260, 190, 34);
  const button = rrect(96, 92, 44, 26, 7);
  const photo = rrect(134, 270, 132, 102, 5);
  const lensOuter = circle(200, 212, 72);
  const lensInner = circle(200, 212, 54);
  const flash = rrect(96, 130, 46, 30, 8);
  const finder = rrect(262, 130, 40, 26, 8);
  const lugL = rrect(58, 160, 16, 30, 5);
  const lugR = rrect(326, 160, 16, 30, 5);
  const layers = stack([lensOuter, flash, finder, body, button, photo, lugL, lugR]);
  return tpl(
    'camera-instant',
    'Smiling instant camera',
    'intermediate',
    ['camera', 'photo', 'travel', 'gadget', 'object', 'kids'],
    [...layers, lensInner, pair((x, y) => dot(x, y, 4), 200, 206, 18), smile(200, 222, 8), heart(200, 338, 40)],
    [
      pair((x, y) => blush(x, y, 7, 4.5), 200, 224, 32),
      'M 168 180 A 40 40 0 0 1 196 166',
      line(70, 286, 330, 286),
      softStar(298, 236, 13, 6, 5, 2),
      `${line(110, 140, 128, 150)} ${line(128, 140, 110, 150)}`,
      sparkle(46, 70, 12),
      sparkle(360, 70, 9),
      'M 70 330 Q 90 316 110 330 M 290 330 Q 310 316 330 330',
    ],
  );
}

function pipHeart(): Template {
  const deg = 28;
  const s = 0.9;
  const [ox, oy] = [312.3, 110.5];
  const p = pip(ox, oy, s, deg, {
    eyes: 'happy',
    arms: ['M -45 118 Q -66 112 -74 94', 'M 45 118 Q 66 112 74 94'],
    hands: [[-77, 88], [77, 88]],
  });
  const [tx, ty] = placePoint(0, 222, ox, oy, s, deg);
  const hrt = heart(tx - 52, ty - 30, 150);
  const paper = rotate(rrect(50, 136, 250, 228, 10), -5, 175, 250);
  const pipR = regions(p.layers);
  return tpl(
    'pip-drawing-heart',
    'Pip drawing a heart',
    'intermediate',
    ['cast', 'pip', 'pencil', 'heart', 'love', 'drawing', 'kids'],
    [...p.paths, clip(hrt, pipR), clip(paper, pipR.concat(regions([hrt]).slice(0, 0)))],
    [
      ...p.detail,
      clip(`${heart(80, 104, 22)} ${heart(352, 300, 20)}`, pipR),
      sparkle(60, 60, 11),
      sparkle(354, 230, 9),
      clip('M 90 190 L 120 190 M 96 316 L 140 316', pipR),
    ],
  );
}

function raincoatKid(): Template {
  const head = circle(200, 172, 76);
  const fringe = 'M 128 160 C 136 106 264 106 272 160 Q 254 146 240 128 Q 226 150 210 126 Q 192 150 176 126 Q 160 150 128 160 Z';
  const hood = 'M 108 200 C 96 110 140 72 200 72 C 260 72 304 110 292 200 C 290 230 280 248 268 256 L 132 256 C 120 248 110 230 108 200 Z';
  const coat = 'M 150 240 C 136 270 124 310 120 334 C 140 344 260 344 280 334 C 276 310 264 270 250 240 Z';
  const bootL = rrect(152, 330, 38, 34, 10);
  const bootR = rrect(210, 330, 38, 34, 10);
  const handR = circle(298, 278, 12);
  const armR = capsule(250, 262, 292, 276, 12);
  const handL = circle(124, 306, 11);
  const armL = capsule(150, 260, 128, 300, 12);
  const canopy =
    'M 60 112 C 70 30 330 30 340 112 Q 313 98 287 112 Q 260 98 233 112 Q 207 98 180 112 Q 153 98 127 112 Q 100 98 60 112 Z';
  const shaft = rrect(296, 100, 6, 170, 3);
  const puddle = ellipse(200, 366, 124, 14);
  const layers = stack([handR, handL, fringe, head, hood, armR, armL, coat, bootL, bootR, shaft, canopy, puddle]);
  return tpl(
    'chibi-raincoat',
    'Chibi kid in a raincoat',
    'intermediate',
    ['chibi', 'kid', 'child', 'rain', 'umbrella', 'weather', 'puddle', 'kids'],
    [
      ...layers,
      'M 299 290 L 299 304 Q 299 318 286 318 Q 276 318 276 308',
      pair((x, y) => bigEye(x, y, 10, 13), 200, 186, 30),
      smile(200, 212, 7),
    ],
    [
      pair(blush, 200, 206, 48),
      `${circle(200, 276, 5)} ${circle(200, 304, 5)}`,
      clip(`${line(152, 344, 188, 344)} ${line(212, 344, 248, 344)}`, []),
      clip('M 200 30 L 200 46 M 127 112 C 140 70 170 46 200 40 M 273 112 C 260 70 230 46 200 40', regions([shaft])),
      drop(34, 150, 22),
      drop(360, 170, 22),
      drop(46, 250, 18),
      drop(358, 300, 18),
      drop(80, 196, 14),
    ],
  );
}

function paintPalette(): Template {
  const palette =
    'M 70 226 C 62 146 146 98 228 106 C 310 114 352 170 334 230 C 322 268 284 262 266 282 ' +
    'C 250 300 274 330 244 350 C 192 382 82 320 70 226 Z';
  const hole = ellipse(222, 300, 16, 12);
  const blobs = [[128, 166, 21], [184, 140, 21], [244, 142, 21], [296, 176, 20], [106, 236, 19]].map(([x, y, r]) => circle(x, y, r));
  const brushLocal = `${rrect(-7, 0, 14, 92, 7)}`;
  const ferrule = rrect(-10, -24, 20, 26, 3);
  const tip = petal(0, -22, 0, 40, 11, 0.25);
  const [bx, by, bd] = [322, 278, 34];
  const brush = [place(brushLocal, bx, by, 1, bd), place(ferrule, bx, by, 1, bd), place(tip, bx, by, 1, bd)];
  const layers = stack([brush[1], brush[0], brush[2], ...blobs, hole, palette]);
  return tpl(
    'paint-palette',
    'Happy paint palette',
    'intermediate',
    ['palette', 'paint', 'art', 'brush', 'artist', 'object', 'kids'],
    [...layers, pair((x, y) => dot(x, y, 4.2), 196, 226, 26), smile(196, 242, 10)],
    [
      pair(blush, 196, 248, 44),
      ...blobs.map((_, i) => {
        const [x, y, r] = [[128, 166, 21], [184, 140, 21], [244, 142, 21], [296, 176, 20], [106, 236, 19]][i];
        return `M ${f(x - r * 0.55)} ${f(y - r * 0.1)} Q ${f(x - r * 0.45)} ${f(y - r * 0.5)} ${f(x - r * 0.05)} ${f(y - r * 0.6)}`;
      }),
      clip('M 120 300 Q 140 320 170 326', [region(palette)], 'inside'),
      sparkle(56, 80, 12),
      sparkle(350, 90, 10),
      sparkle(60, 340, 8),
    ],
  );
}

// ---- advanced ---------------------------------------------------------------------------------

function owlBooks(): Template {
  const owl = [
    'M 205 56 C 270 56 300 112 298 170 C 296 222 262 252 205 252 C 148 252 114 222 112 170 C 110 112 140 56 205 56 Z',
    petal(150, 84, -38, 46, 13, 0.4),
    petal(260, 84, 38, 46, 13, 0.4),
  ];
  const disc = [circle(172, 140, 42), circle(238, 140, 42)];
  const wingL = 'M 122 150 C 92 180 96 230 132 246 C 146 222 146 182 132 152 Z';
  const wingR = mirrorX(wingL, 205);
  const belly = ellipse(205, 206, 50, 42);
  const toes = [176, 190, 220, 234].map((x) => ellipse(x, 252, 7, 9));
  const books = [rrect(118, 252, 186, 34, 6), rrect(96, 286, 220, 38, 6), rrect(76, 324, 262, 42, 6)];
  const layers = stack([...toes, outline(disc), wingL, wingR, owl, ...books]);
  const scallops: string[] = [];
  for (let row = 0; row < 4; row++) {
    const y = 182 + row * 14;
    const w = 50 * Math.sqrt(Math.max(0, 1 - ((y - 206) / 42) ** 2));
    let d = '';
    for (let x = 205 - w + 8; x + 12 <= 205 + w - 4; x += 14) d += `M ${f(x)} ${f(y)} Q ${f(x + 7)} ${f(y + 9)} ${f(x + 14)} ${f(y)} `;
    if (d) scallops.push(d.trim());
  }
  const pageLines: string[] = [];
  for (const [x2, y1, h] of [[304, 252, 34], [316, 286, 38], [338, 324, 42]]) {
    let d = '';
    for (let k = 1; k <= 3; k++) d += `M ${f(x2 - 10 - k * 0)} ${f(y1 + (h * k) / 4)} L ${f(x2 - 36)} ${f(y1 + (h * k) / 4)} `;
    pageLines.push(d.trim());
  }
  return tpl(
    'owl-books',
    'Little owl on a stack of books',
    'advanced',
    ['owl', 'books', 'reading', 'school', 'night', 'animal', 'kids'],
    [
      ...layers,
      `${circle(172, 140, 23)} ${circle(238, 140, 23)}`,
      `${circle(176, 142, 11)} ${circle(234, 142, 11)}`,
      `${circle(180, 136, 3.5)} ${circle(238, 136, 3.5)}`,
      'M 205 154 L 214 166 L 205 180 L 196 166 Z',
      clip(belly, regions([...toes])),
    ],
    [
      ...scallops,
      pair((x, y) => blush(x, y, 8, 5), 205, 180, 58),
      clip('M 108 182 L 128 172 M 104 204 L 126 196 M 110 226 L 130 220', []),
      mirrorX('M 108 182 L 128 172 M 104 204 L 126 196 M 110 226 L 130 220', 205),
      ...pageLines,
      `${line(150, 252, 150, 286)} ${line(164, 252, 164, 286)}`,
      `${line(130, 286, 130, 324)} ${line(144, 286, 144, 324)} ${softStar(110, 305, 7, 3, 5, 1)}`,
      `${line(116, 324, 116, 366)} ${line(132, 324, 132, 366)} ${heart(98, 345, 14)}`,
      'M 268 252 L 268 236 L 276 244 L 284 236 L 284 252',
      'M 160 66 L 172 82 M 250 66 L 238 82',
      sparkle(60, 80, 13),
      sparkle(350, 70, 10),
      softStar(330, 160, 12, 5, 5, 2),
      softStar(66, 200, 10, 4, 5, 2),
      `${circle(354, 230, 3)} ${circle(44, 140, 3)} ${circle(300, 30, 3)}`,
      'M 60 380 L 340 380',
    ],
  );
}

function pipNotebook(): Template {
  const [s, deg] = [1.05, -70];
  const [ox, oy] = [101.3, 214.1];
  const p = pip(ox, oy, s, deg, { eyes: 'sleepy', arms: [], hands: [] });
  const pageL = 'M 36 150 Q 116 136 192 154 L 192 352 Q 116 336 36 350 Z';
  const pageR = 'M 208 154 Q 284 136 364 150 L 364 350 Q 284 336 208 352 Z';
  const rings: string[] = [];
  for (let y = 170; y <= 340; y += 21) rings.push(ellipse(200, y, 15, 5.5));
  const layers = stack([...p.layers, ...rings, pageL, pageR]);
  const doodles = [softStar(326, 182, 12, 5, 5, 2), heart(70, 316, 24)];
  const block = regions([...p.layers, ...rings, ...doodles]);
  const ruled: string[] = [];
  for (let k = 34; k <= 186; k += 19) {
    ruled.push(clip(clip(`M 46 ${f(150 + k)} Q 116 ${f(137 + k)} 184 ${f(154 + k)}`, block), [region(pageL)], 'inside'));
    ruled.push(clip(clip(`M 216 ${f(154 + k)} Q 284 ${f(137 + k)} 354 ${f(150 + k)}`, block), [region(pageR)], 'inside'));
  }
  const moon = 'M 92 32 C 70 40 64 70 82 86 C 94 96 110 94 118 86 C 100 86 88 72 90 56 C 90 46 92 38 92 32 Z';
  return tpl(
    'pip-asleep-notebook',
    'Pip asleep on a notebook',
    'advanced',
    ['cast', 'pip', 'pencil', 'notebook', 'sleep', 'school', 'bedtime', 'kids'],
    [...layers, ...p.strokes, zed(170, 92, 22), zed(206, 62, 16), zed(232, 40, 11)],
    [
      ...p.detail,
      ...ruled.filter(Boolean),
      ...doodles,
      'M 36 356 Q 116 342 192 358 M 208 358 Q 284 342 364 356',
      'M 40 362 Q 116 348 192 364 M 208 364 Q 284 348 360 362',
      mirrorX(moon, 200),
      sparkle(60, 90, 11),
      sparkle(270, 110, 9),
      softStar(120, 40, 9, 4, 5, 2),
      softStar(366, 110, 8, 3.5, 5, 1.5),
      `${circle(40, 40, 3)} ${circle(250, 30, 3)}`,
    ],
  );
}

function astronautKid(): Template {
  const helmet = circle(200, 150, 96);
  const head = circle(200, 166, 64);
  const hair = 'M 136 160 C 132 112 162 96 200 96 C 238 96 268 112 264 160 Q 248 146 236 132 Q 222 148 206 130 Q 190 148 174 130 Q 158 150 136 160 Z';
  const collar = rrect(134, 236, 132, 24, 12);
  const suit = 'M 142 252 C 126 282 118 318 122 344 L 278 344 C 282 318 274 282 258 252 Z';
  const pack = rrect(116, 254, 168, 84, 16);
  const bootL = rrect(144, 334, 48, 36, 13);
  const bootR = rrect(208, 334, 48, 36, 13);
  const armR = capsule(258, 274, 300, 250, 15);
  const handR = circle(308, 244, 14);
  const armL = capsule(144, 274, 120, 314, 15);
  const handL = circle(116, 322, 14);
  const starHeld = softStar(316, 206, 26, 12, 5, 3);
  const box = rrect(170, 298, 40, 24, 5);
  const ground = 'M 20 376 Q 200 336 380 376 Z';
  const layers = stack([starHeld, handR, handL, collar, armR, armL, box, suit, bootL, bootR, pack, ground]);
  const planet = circle(326, 76, 24);
  const ring = clip(rotate(ellipse(326, 76, 44, 11), -18, 326, 76), [region(planet)]);
  return tpl(
    'chibi-astronaut',
    'Chibi astronaut kid with a star',
    'advanced',
    ['chibi', 'kid', 'child', 'space', 'astronaut', 'moon', 'stars', 'kids'],
    [
      helmet,
      clip(head, [region(hair)]),
      hair,
      ...layers,
      pair((x, y) => bigEye(x, y, 9, 12), 200, 176, 26),
      smile(200, 200, 7),
      planet,
      ring,
    ],
    [
      pair((x, y) => blush(x, y, 8, 5), 200, 196, 42),
      'M 130 110 A 84 84 0 0 1 176 72',
      'M 268 196 A 84 84 0 0 1 254 220',
      clip(heart(232, 284, 26), []),
      `${circle(180, 310, 3)} ${circle(192, 310, 3)} ${line(200, 306, 204, 314)}`,
      clip(`${line(142, 344, 192, 344)} ${line(208, 344, 258, 344)}`, []),
      clip(`${line(126, 300, 150, 300)} ${line(250, 300, 274, 300)}`, regions([suit, armL, handL])),
      `${ellipse(70, 360, 18, 5)} ${ellipse(326, 364, 22, 6)} ${ellipse(110, 372, 10, 3)}`,
      softStar(60, 70, 13, 6, 5, 2),
      softStar(90, 200, 9, 4, 5, 2),
      softStar(360, 200, 10, 4, 5, 2),
      sparkle(260, 34, 10),
      sparkle(40, 270, 9),
      `${circle(150, 36, 3)} ${circle(370, 140, 3)} ${circle(30, 150, 3)} ${circle(352, 290, 3)}`,
      'M 290 196 L 280 186 M 336 180 L 344 168 M 340 226 L 352 232',
    ],
  );
}

function witchKid(): Template {
  const brim = ellipse(196, 122, 122, 24);
  const cone = 'M 128 120 C 146 92 166 44 210 24 C 234 14 256 26 252 42 C 232 42 226 64 240 120 Z';
  const band = 'M 140 104 C 170 112 214 112 238 104 L 240 120 C 214 128 170 128 136 120 Z';
  const head = circle(200, 182, 70);
  const hairBack = 'M 120 170 C 108 232 118 262 140 272 L 260 272 C 282 262 292 232 280 170 Z';
  const bangs = 'M 136 150 C 150 132 250 132 264 150 Q 248 162 232 148 Q 216 166 200 148 Q 184 166 168 148 Q 152 164 136 150 Z';
  const dress = 'M 160 244 C 140 284 120 330 112 352 L 288 352 C 280 330 260 284 240 244 Z';
  const collarL = petal(200, 252, -110, 30, 11, 0.5);
  const collarR = petal(200, 252, 110, 30, 11, 0.5);
  const handR = circle(286, 276, 12);
  const armR = capsule(240, 268, 280, 278, 12);
  const handL = circle(118, 300, 12);
  const armL = capsule(160, 266, 124, 296, 12);
  const wand = capsule(292, 270, 326, 206, 3.5);
  const wandStar = softStar(332, 192, 22, 10, 5, 3);
  const shoeL = 'M 152 352 L 190 352 L 190 366 L 140 366 C 132 366 134 356 152 352 Z';
  const shoeR = 'M 210 352 L 248 352 C 266 356 268 366 260 366 L 210 366 Z';
  const catHead = [circle(70, 318, 20), roundPoly([[54, 312], [54, 288], [70, 302]], 3), roundPoly([[86, 312], [86, 288], [70, 302]], 3)];
  const catBody = ellipse(74, 352, 24, 22);
  const catTail = 'M 96 360 C 120 362 124 334 110 326 C 104 324 102 330 106 334 C 114 342 108 352 94 352 Z';
  const layers = stack([
    wandStar, handR, handL, wand, band, brim, cone, bangs, head, hairBack, collarL, collarR, armR, armL, dress, shoeL, shoeR,
    catHead, catBody, catTail,
  ]);
  const patch = rotate(rrect(176, 60, 26, 22, 3), -12, 189, 71);
  return tpl(
    'chibi-witch',
    'Chibi witch kid with a star wand',
    'advanced',
    ['chibi', 'kid', 'child', 'witch', 'halloween', 'magic', 'cat', 'kids'],
    [...layers, clip(patch, []), pair((x, y) => bigEye(x, y, 9, 12), 200, 196, 28), smile(200, 222, 7), pair((x, y) => dot(x, y, 2.6), 70, 318, 8)],
    [
      pair((x, y) => blush(x, y, 8, 5), 200, 216, 46),
      `M 180 64 L 182 70 M 186 62 L 188 68 M 192 60 L 194 66 M 182 80 L 184 86 M 196 78 L 198 84`,
      softStar(220, 112, 7, 3, 5, 1),
      clip('M 178 252 L 168 352 M 222 252 L 232 352 M 200 270 L 200 352', regions([armR, armL, handR, handL])),
      clip(`${softStar(150, 330, 7, 3, 5, 1)} ${softStar(250, 320, 7, 3, 5, 1)} ${softStar(214, 300, 6, 2.5, 5, 1)}`, []),
      `${line(60, 326, 44, 324)} ${line(60, 330, 44, 334)} ${line(80, 326, 96, 324)} ${line(80, 330, 96, 334)}`,
      catMouth(70, 326, 3.5),
      'M 340 40 C 312 48 304 84 324 104 C 338 116 356 114 366 104 C 344 104 328 88 330 66 C 330 54 334 46 340 40 Z',
      softStar(60, 70, 11, 5, 5, 2),
      softStar(92, 150, 8, 3.5, 5, 1.5),
      sparkle(360, 160, 10),
      sparkle(34, 230, 9),
      sparkle(330, 300, 8),
      `M 316 160 L 310 150 M 352 174 L 362 168 M 346 208 L 356 214`,
    ],
  );
}

function blanketKid(): Template {
  const blanket = 'M 72 360 C 60 260 98 140 200 132 C 302 140 340 260 328 360 Z';
  const rim = ellipse(200, 206, 74, 70);
  const face = circle(200, 212, 58);
  const bangs = 'M 144 196 C 150 150 250 150 256 196 Q 240 184 228 170 Q 216 188 200 168 Q 184 188 172 170 Q 160 186 144 196 Z';
  const flap = 'M 72 300 C 140 278 236 290 318 344 L 328 360 L 72 360 Z';
  const toeL = ellipse(176, 362, 16, 11);
  const toeR = ellipse(222, 362, 16, 11);
  const pillow = rrect(40, 300, 320, 70, 30);
  const layers = stack([toeL, toeR, bangs, face, rim, flap, blanket, pillow]);
  const inside = regions([blanket]);
  const hide = regions([rim, toeL, toeR]);
  const quilt: string[] = [];
  for (let c = -240; c <= 240; c += 40) {
    const d = `M ${f(200 + c - 120)} ${f(140)} L ${f(200 + c + 120)} ${f(380)}`;
    const e = `M ${f(200 + c + 120)} ${f(140)} L ${f(200 + c - 120)} ${f(380)}`;
    for (const seg of [d, e]) {
      const q = clip(clip(seg, hide.concat(regions([flap]))), inside, 'inside');
      if (q) quilt.push(q);
    }
  }
  const flapLines: string[] = [];
  for (let k = 1; k <= 3; k++) {
    const q = clip(clip(`M 60 ${f(306 + k * 16)} C 140 ${f(284 + k * 16)} 236 ${f(296 + k * 14)} 330 ${f(350 + k * 6)}`, hide), regions([flap]), 'inside');
    if (q) flapLines.push(q);
  }
  return tpl(
    'chibi-blanket',
    'Sleepy chibi wrapped in a quilt',
    'advanced',
    ['chibi', 'kid', 'child', 'sleep', 'bedtime', 'quilt', 'cozy', 'kids'],
    [...layers, pair((x, y) => sleepy(x, y, 10), 200, 222, 24), smile(200, 240, 6), circle(236, 240, 9), zed(276, 76, 22), zed(310, 48, 15)],
    [
      pair((x, y) => blush(x, y, 8, 5), 200, 236, 38),
      ...quilt,
      ...flapLines,
      clip(`${heart(110, 250, 16)} ${heart(290, 250, 16)} ${softStar(130, 330, 8, 3.5, 5, 1)} ${softStar(276, 316, 8, 3.5, 5, 1)}`, hide),
      'M 92 32 C 70 40 64 70 82 86 C 94 96 110 94 118 86 C 100 86 88 72 90 56 C 90 46 92 38 92 32 Z',
      softStar(150, 70, 10, 4, 5, 2),
      softStar(360, 130, 9, 4, 5, 2),
      sparkle(40, 170, 10),
      sparkle(352, 220, 8),
      `${circle(200, 50, 3)} ${circle(30, 110, 3)} ${circle(370, 60, 3)}`,
    ],
  );
}

export const kawaiiFriends: Template[] = [
  curledFox(),
  frogLily(),
  axolotl(),
  chickEgg(),
  sealPup(),
  kittenCup(),
  eraserBuddy(),
  teapot(),
  peekabooGhost(),
  pipWaving(),
  babyBat(),
  alarmClock(),
  backpack(),
  fuzzyMonster(),
  otterFloat(),
  koalaBranch(),
  slothHanging(),
  hedgehogSleep(),
  bunnyPair(),
  puppyGift(),
  redPanda(),
  instantCamera(),
  pipHeart(),
  raincoatKid(),
  paintPalette(),
  owlBooks(),
  pipNotebook(),
  astronautKid(),
  witchKid(),
  blanketKid(),
];
