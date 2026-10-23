// Cute & chibi: original kawaii-style line art on a 400×400 canvas — round chubby shapes, big heads, dot eyes
// and small blush ovals. Every character here is our own generic design (no existing characters, mascots or
// brands; see docs/TEMPLATES.md). Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, poly, polar, rotate, rrect, type P } from './draw.ts';
import { clip, outline, region, roundPoly, stack } from './occlude.ts';

const VB = '0 0 400 400';

// ---- face kit -------------------------------------------------------------------------------

/** Dot eye: a tiny ring that reads as a solid dot at stroke width 4. */
const dot = (x: number, y: number, r = 3.2): string => circle(x, y, r);
/** Open smile ∪. */
const smile = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w)} ${f(x + w)} ${f(y)}`;
/** Cat mouth ω. */
const catMouth = (x: number, y: number, w: number): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x - w / 2)} ${f(y + w)} ${f(x)} ${f(y)} Q ${f(x + w / 2)} ${f(y + w)} ${f(x + w)} ${f(y)}`;
/** Closed sleepy eye ∪. */
const sleepy = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * 0.9)} ${f(x + w)} ${f(y)}`;
/** Happy closed eye ∩. */
const happy = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y - w * 1.1)} ${f(x + w)} ${f(y)}`;
/** Big chibi eye: tall oval with a highlight. */
const bigEye = (x: number, y: number, rx: number, ry: number): string =>
  `${ellipse(x, y, rx, ry)} ${circle(x + rx * 0.3, y - ry * 0.35, rx * 0.35)}`;
const blush = (x: number, y: number, rx = 9, ry = 5.5): string => ellipse(x, y, rx, ry);
const pair = (fn: (x: number, y: number) => string, cx: number, y: number, dx: number): string =>
  `${fn(cx - dx, y)} ${fn(cx + dx, y)}`;

/** Little four-point sparkle. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

/** Heart centred on (cx, cy), s = overall width. */
function heart(cx: number, cy: number, s: number): string {
  const p = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${p(0, -0.22)} C ${p(-0.1, -0.55)} ${p(-0.5, -0.55)} ${p(-0.5, -0.15)} C ${p(-0.5, 0.15)} ${p(-0.2, 0.35)} ${p(0, 0.55)} ` +
    `C ${p(0.2, 0.35)} ${p(0.5, 0.15)} ${p(0.5, -0.15)} C ${p(0.5, -0.55)} ${p(0.1, -0.55)} ${p(0, -0.22)} Z`
  );
}

/** Rounded star with n points. */
function softStar(cx: number, cy: number, outer: number, inner: number, n: number, r: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rot + (180 * i) / n));
  return roundPoly(pts, r);
}

/** Z letter for sleepy scenes. */
const zed = (x: number, y: number, s: number): string => poly([[x, y], [x + s, y], [x, y + s], [x + s, y + s]], false);

/** Teardrop pointing up, tip at (x, y). */
const drop = (x: number, y: number, h: number): string =>
  `M ${f(x)} ${f(y)} C ${f(x + h * 0.45)} ${f(y + h * 0.5)} ${f(x + h * 0.45)} ${f(y + h)} ${f(x)} ${f(y + h)} ` +
  `C ${f(x - h * 0.45)} ${f(y + h)} ${f(x - h * 0.45)} ${f(y + h * 0.5)} ${f(x)} ${f(y)} Z`;

/** Fluffy cloud from overlapping circles on a rounded base. */
function cloud(cx: number, cy: number, w: number): string[] {
  const s = w / 200;
  return [
    rrect(cx - 100 * s, cy - 10 * s, 200 * s, 50 * s, 25 * s),
    circle(cx - 50 * s, cy - 10 * s, 36 * s),
    circle(cx + 5 * s, cy - 30 * s, 48 * s),
    circle(cx + 58 * s, cy - 6 * s, 34 * s),
  ];
}

function tpl(
  id: string,
  name: string,
  level: TemplateLevel,
  tags: string[],
  paths: string[],
  detail: string[] = [],
): Template {
  return {
    id: `cute-${id}`,
    name,
    category: 'cute',
    level,
    tags: ['cute', 'kawaii', 'chibi', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(detail.length ? { detail: detail.filter(Boolean) } : {}),
  };
}

// ---- 1. cat loaf ----------------------------------------------------------------------------

function catLoaf(): Template {
  const body =
    'M 90 300 C 78 300 74 288 76 268 C 79 228 98 196 124 176 L 118 116 L 166 154 C 177 151 188 150 200 150 ' +
    'C 212 150 223 151 234 154 L 282 116 L 276 176 C 302 196 321 228 324 268 C 326 288 322 300 310 300 Z';
  const tail = 'M 312 292 C 350 298 368 266 352 236 C 346 226 334 230 338 242 C 348 266 334 282 310 278 Z';
  const paws = 'M 158 300 C 158 284 188 284 188 300 M 212 300 C 212 284 242 284 242 300';
  const [b, t] = stack([body, tail]);
  return tpl(
    'cat-loaf',
    'Round cat loaf',
    'beginner',
    ['cat', 'kitten', 'pet', 'animal', 'loaf', 'kids'],
    [
      b,
      t,
      'M 131 170 L 127 134 L 154 154 M 269 170 L 273 134 L 246 154',
      pair(dot, 200, 216, 36),
      'M 195 228 L 205 228 L 200 233 Z',
      catMouth(200, 234, 9),
      paws,
    ],
    [
      pair(blush, 200, 238, 58),
      `${line(132, 224, 104, 218)} ${line(132, 232, 104, 236)} ${line(268, 224, 296, 218)} ${line(268, 232, 296, 236)}`,
      'M 182 160 L 185 174 M 200 157 L 200 172 M 218 160 L 215 174',
      line(60, 304, 340, 304),
    ],
  );
}

// ---- 2. sleepy bunny ------------------------------------------------------------------------

function sleepyBunny(): Template {
  const head = circle(150, 235, 68);
  const pawL = ellipse(126, 304, 17, 10);
  const pawR = ellipse(172, 306, 17, 10);
  const earFront = petal(185, 188, 80, 125, 19, 0.45);
  const earBack = petal(160, 178, 64, 125, 20, 0.45);
  const body = ellipse(245, 262, 98, 52);
  const tail = circle(340, 250, 15);
  const layers = stack([pawL, pawR, head, earFront, earBack, body, tail]);
  const fronts = [pawL, pawR, head].map(region);
  return tpl(
    'sleepy-bunny',
    'Sleepy bunny',
    'beginner',
    ['bunny', 'rabbit', 'sleep', 'bedtime', 'easter', 'baby', 'animal', 'kids'],
    [
      ...layers,
      pair((x, y) => sleepy(x, y, 9), 150, 240, 26),
      'M 146 252 L 154 252 L 150 256 Z',
      catMouth(150, 257, 6),
      zed(64, 124, 22),
      zed(98, 90, 16),
      zed(124, 64, 11),
    ],
    [
      pair(blush, 150, 260, 40),
      clip(petal(192, 186, 80, 92, 8, 0.45), [region(head)]),
      clip(petal(168, 176, 64, 92, 8, 0.45), [region(head), region(earFront)]),
      clip(line(56, 316, 352, 316), fronts),
    ],
  );
}

// ---- 3. smiling cloud -----------------------------------------------------------------------

function smilingCloud(): Template {
  return tpl(
    'smiling-cloud',
    'Smiling cloud',
    'beginner',
    ['cloud', 'weather', 'rain', 'sky', 'baby', 'nursery', 'kids'],
    [
      outline(cloud(200, 210, 260)),
      pair(dot, 205, 210, 30),
      smile(205, 226, 12),
      drop(140, 300, 26),
      drop(205, 318, 26),
      drop(268, 300, 26),
    ],
    [pair(blush, 205, 232, 52), sparkle(78, 110, 14), sparkle(328, 98, 10), sparkle(342, 300, 9)],
  );
}

// ---- 4. happy boba cup ----------------------------------------------------------------------

function bobaCup(): Template {
  const rim = rrect(116, 138, 168, 16, 8);
  const dome = 'M 132 138 C 136 92 264 92 268 138 Z';
  const cup = 'M 130 154 L 150 330 C 152 345 160 352 175 352 L 225 352 C 240 352 248 345 250 330 L 270 154 Z';
  const straw = rotate(rrect(226, 22, 16, 110, 3), 18, 234, 120);
  const layers = stack([rim, dome, cup, straw]);
  const pearls = [
    [172, 330], [194, 334], [216, 332], [236, 326], [162, 308], [184, 312], [206, 312], [228, 306],
  ].map(([x, y]) => circle(x, y, 9.5));
  return tpl(
    'boba-cup',
    'Happy bubble tea',
    'beginner',
    ['bubble-tea', 'boba', 'drink', 'tea', 'food', 'sweet', 'kids'],
    [...layers, pair(dot, 200, 214, 22), smile(200, 226, 9), ...pearls],
    [
      pair(blush, 200, 230, 40),
      clip('M 136 182 C 170 174 230 190 266 180', [region(cup)], 'inside'),
      sparkle(84, 120, 12),
      sparkle(318, 210, 9),
      line(258, 66, 276, 60),
    ],
  );
}

// ---- 5. rice ball ---------------------------------------------------------------------------

function riceBall(): Template {
  const rice = roundPoly([[200, 72], [342, 322], [58, 322]], 46);
  const nori = rrect(156, 246, 88, 80, 8);
  const [n, r] = stack([nori, rice]);
  const grains: string[] = [];
  for (const [x, y, a] of [[150, 160, 30], [252, 168, -25], [120, 270, 60], [282, 274, -60], [200, 110, 0], [110, 300, 10], [292, 300, -10]]) {
    grains.push(rotate(`M ${x - 5} ${y} Q ${x} ${y - 4} ${x + 5} ${y}`, a, x, y));
  }
  return tpl(
    'rice-ball',
    'Smiling rice ball',
    'beginner',
    ['rice', 'rice-ball', 'food', 'snack', 'lunch', 'kids'],
    [n, r, pair(dot, 200, 196, 26), 'M 190 210 L 210 210 Q 210 226 200 226 Q 190 226 190 210 Z'],
    [pair(blush, 200, 218, 44), ...grains, 'M 172 262 L 172 310 M 228 262 L 228 310'],
  );
}

// ---- 6. cactus in a pot ---------------------------------------------------------------------

function cactus(): Template {
  const rim = rrect(126, 272, 148, 24, 9);
  const pot = 'M 138 296 L 152 362 L 248 362 L 262 296 Z';
  const flower = [0, 72, 144, 216, 288].map((a) => circle(...polar(200, 104, 10, a), 9));
  const body = [
    rrect(160, 108, 80, 180, 40),
    'M 170 234 L 130 234 C 115 234 106 225 106 210 L 106 172 C 106 154 134 154 134 172 L 134 206 L 170 206 Z',
    'M 230 202 L 270 202 C 285 202 294 193 294 178 L 294 142 C 294 124 266 124 266 142 L 266 174 L 230 174 Z',
  ];
  const layers = stack([rim, pot, flower, body]);
  const spines = [[176, 236], [224, 250], [200, 262], [120, 182], [280, 150], [218, 130]]
    .map(([x, y]) => `M ${x - 4} ${y - 4} L ${x} ${y} L ${x + 4} ${y - 4}`)
    .join(' ');
  return tpl(
    'cactus',
    'Cactus in a pot',
    'beginner',
    ['cactus', 'plant', 'succulent', 'pot', 'flower', 'desert', 'kids'],
    [...layers, circle(200, 104, 4), pair(dot, 200, 176, 16), smile(200, 188, 7)],
    [pair(blush, 200, 194, 28), spines, heart(200, 330, 34)],
  );
}

// ---- 7. mushroom house ----------------------------------------------------------------------

function mushroomHouse(): Template {
  const cap =
    'M 80 200 C 80 112 140 70 200 70 C 260 70 320 112 320 200 C 320 216 300 222 280 217 ' +
    'C 240 210 160 210 120 217 C 100 222 80 216 80 200 Z';
  const stem = 'M 136 210 L 128 340 L 272 340 L 264 210 Z';
  const door = 'M 178 340 L 178 294 A 22 22 0 0 1 222 294 L 222 340';
  const [c, s] = stack([cap, stem]);
  const spots = clip(
    [circle(138, 132, 17), circle(210, 102, 12), circle(262, 150, 21), circle(104, 184, 10), circle(190, 168, 11), circle(300, 190, 9)].join(' '),
    [region(cap)],
    'inside',
  );
  const win = (x: number) => `${circle(x, 266, 12)} M ${x - 12} 266 L ${x + 12} 266 M ${x} 254 L ${x} 278`;
  const tufts = [70, 96, 300, 330]
    .map((x) => `M ${x - 8} 340 Q ${x - 6} 330 ${x - 10} 322 M ${x} 340 L ${x} 318 M ${x + 8} 340 Q ${x + 6} 330 ${x + 10} 322`)
    .join(' ');
  return tpl(
    'mushroom-house',
    'Mushroom cottage',
    'intermediate',
    ['mushroom', 'house', 'cottage', 'fairy', 'garden', 'whimsical', 'home'],
    [c, s, door, circle(213, 318, 3), win(152), win(248), pair(dot, 200, 238, 16), smile(200, 248, 6), line(50, 340, 350, 340)],
    [
      spots,
      pair((x, y) => blush(x, y, 7, 4.5), 200, 252, 30),
      'M 190 300 L 190 340 M 200 296 L 200 340 M 210 300 L 210 340',
      tufts,
      `${ellipse(176, 356, 14, 6)} ${ellipse(204, 372, 16, 7)} ${ellipse(178, 388, 13, 5)}`,
      'M 100 100 C 106 92 116 92 122 100 M 290 78 C 296 70 306 70 312 78',
    ],
  );
}

// ---- 8. round penguin -----------------------------------------------------------------------

function penguin(): Template {
  const body = ellipse(200, 222, 110, 126);
  const flipL = 'M 102 186 C 56 214 50 272 106 286 Z';
  const flipR = 'M 298 186 C 344 214 350 272 294 286 Z';
  const footL = ellipse(160, 344, 30, 13);
  const footR = ellipse(240, 344, 30, 13);
  const belly =
    'M 200 150 C 240 118 292 150 280 212 C 288 290 250 330 200 330 C 150 330 112 290 120 212 C 108 150 160 118 200 150 Z';
  const layers = stack([belly, body, flipL, flipR, footL, footR]);
  return tpl(
    'penguin',
    'Round penguin',
    'beginner',
    ['penguin', 'bird', 'winter', 'snow', 'christmas', 'animal', 'baby', 'kids'],
    [...layers, pair(dot, 200, 190, 34), 'M 188 204 L 212 204 L 200 218 Z', 'M 194 96 C 188 78 204 70 210 84'],
    [pair(blush, 200, 214, 52), sparkle(64, 80, 10), sparkle(340, 70, 8), circle(80, 140, 3), circle(326, 130, 3)],
  );
}

// ---- 9. bear with a balloon -----------------------------------------------------------------

function bearBalloon(): Template {
  const head = circle(170, 170, 60);
  const earL = circle(122, 124, 23);
  const earR = circle(218, 124, 23);
  const body = ellipse(170, 285, 70, 62);
  const pawL = circle(150, 262, 13);
  const pawR = circle(192, 260, 13);
  const footL = ellipse(132, 336, 25, 15);
  const footR = ellipse(208, 336, 25, 15);
  const balloon = heart(302, 92, 112);
  const string = 'M 302 160 C 296 205 236 200 194 248';
  const layers = stack([pawL, pawR, footL, footR, head, earL, earR, body, string]);
  return tpl(
    'bear-balloon',
    'Bear with a heart balloon',
    'intermediate',
    ['bear', 'teddy', 'balloon', 'heart', 'love', 'birthday', 'gift', 'animal', 'kids'],
    [
      ...layers,
      balloon,
      'M 295 168 L 302 158 L 309 168 Z',
      ellipse(170, 194, 24, 17),
      ellipse(170, 186, 7, 5),
      `M 170 191 L 170 197 ${catMouth(170, 197, 6)}`,
      pair(dot, 170, 165, 25),
    ],
    [
      pair(blush, 170, 192, 42),
      clip(`${circle(119, 121, 11)} ${circle(221, 121, 11)}`, [region(head)]),
      `${circle(132, 338, 6)} ${circle(208, 338, 6)}`,
      'M 270 66 C 274 56 284 52 292 54',
      sparkle(70, 70, 12),
      sparkle(350, 210, 9),
    ],
  );
}

// ---- 10. star with a face -------------------------------------------------------------------

function happyStar(): Template {
  return tpl(
    'happy-star',
    'Happy star',
    'beginner',
    ['star', 'night', 'sky', 'baby', 'nursery', 'christmas', 'kids'],
    [softStar(200, 214, 156, 76, 5, 16), pair(dot, 200, 210, 28), smile(200, 226, 11)],
    [pair(blush, 200, 232, 48), sparkle(66, 70, 13), sparkle(340, 76, 10), sparkle(334, 340, 11), sparkle(70, 330, 9)],
  );
}

// ---- 11. strawberry -------------------------------------------------------------------------

function strawberry(): Template {
  const crown = roundPoly(
    [[116, 172], [158, 150], [170, 190], [200, 160], [230, 190], [242, 150], [284, 172], [254, 132], [200, 126], [146, 132]],
    6,
  );
  const berry =
    'M 200 140 C 270 128 318 150 312 214 C 306 276 252 330 200 344 C 148 330 94 276 88 214 C 82 150 130 128 200 140 Z';
  const [c, b] = stack([crown, berry]);
  const seeds = [[134, 214], [266, 214], [126, 262], [274, 262], [160, 296], [240, 296], [200, 318], [200, 200], [160, 190], [240, 190]]
    .map(([x, y]) => ellipse(x, y, 2.5, 4))
    .join(' ');
  return tpl(
    'strawberry',
    'Smiling strawberry',
    'beginner',
    ['strawberry', 'fruit', 'berry', 'food', 'summer', 'sweet', 'kids'],
    [c, b, 'M 200 126 C 198 108 204 94 216 86', pair(dot, 200, 236, 28), smile(200, 250, 10)],
    [pair(blush, 200, 256, 48), seeds, 'M 176 150 L 186 162 M 224 150 L 214 162'],
  );
}

// ---- 12. chubby whale -----------------------------------------------------------------------

function whale(): Template {
  const body = ellipse(168, 238, 116, 86);
  const stem = 'M 262 206 C 300 196 326 180 340 150 L 360 158 C 348 210 316 250 268 268 Z';
  const fluke = [petal(350, 154, -50, 52, 14), petal(350, 154, 40, 52, 14), stem];
  const flipper = 'M 168 266 C 172 290 200 298 214 282 C 200 278 184 272 168 266 Z';
  const [b, t] = stack([body, fluke]);
  return tpl(
    'whale',
    'Chubby whale',
    'beginner',
    ['whale', 'sea', 'ocean', 'nautical', 'baby', 'nursery', 'animal', 'kids'],
    [
      b,
      t,
      flipper,
      pair(dot, 128, 234, 28),
      smile(128, 252, 11),
      'M 164 150 C 162 124 152 108 138 98 M 170 150 L 172 92 M 176 150 C 180 124 190 108 204 98',
    ],
    [
      pair(blush, 128, 258, 46),
      clip(clip('M 78 282 C 130 312 230 314 272 284 M 92 298 C 140 320 220 322 258 298', [region(body)], 'inside'), [region(flipper)]),
      `${circle(128, 82, 5)} ${circle(172, 72, 5)} ${circle(214, 84, 5)}`,
      'M 40 368 Q 60 356 80 368 Q 100 380 120 368 Q 140 356 160 368 M 240 368 Q 260 356 280 368 Q 300 380 320 368 Q 340 356 360 368',
    ],
  );
}

// ---- 13. duckling ---------------------------------------------------------------------------

function duckling(): Template {
  const head = circle(165, 168, 58);
  const body = ellipse(210, 272, 102, 70);
  const tuft = 'M 300 244 L 334 224 L 314 262 Z';
  const foot = (x: number) => roundPoly([[x - 6, 330], [x - 18, 362], [x, 354], [x + 18, 362], [x + 6, 330]], 4);
  const beak = 'M 147 188 C 147 176 183 176 183 188 C 183 200 147 200 147 188 Z';
  const wing = 'M 226 268 C 236 246 274 240 290 258 C 296 266 288 270 282 268 C 290 278 282 286 274 282 C 276 296 250 300 236 292 C 226 286 222 278 226 268 Z';
  const layers = stack([beak, head, body, tuft, foot(178), foot(242)]);
  return tpl(
    'duckling',
    'Little duckling',
    'beginner',
    ['duck', 'duckling', 'bird', 'spring', 'easter', 'baby', 'animal', 'kids'],
    [...layers, wing, pair(dot, 165, 160, 26), 'M 150 116 C 146 96 160 92 162 108 C 168 94 182 98 174 114'],
    [pair(blush, 165, 182, 42), line(152, 188, 178, 188), 'M 70 370 L 130 370 M 270 370 L 340 370 M 100 382 L 300 382'],
  );
}

// ---- 14. hamster with a seed ----------------------------------------------------------------

function hamster(): Template {
  const body = ellipse(200, 226, 126, 108);
  const earL = circle(124, 132, 25);
  const earR = circle(276, 132, 25);
  const seed = 'M 200 238 C 224 250 224 290 200 306 C 176 290 176 250 200 238 Z';
  const pawL = ellipse(172, 280, 12, 10);
  const pawR = ellipse(228, 280, 12, 10);
  const footL = ellipse(156, 332, 20, 10);
  const footR = ellipse(244, 332, 20, 10);
  const layers = stack([seed, pawL, pawR, footL, footR, body, earL, earR]);
  return tpl(
    'hamster-seed',
    'Hamster with a seed',
    'intermediate',
    ['hamster', 'pet', 'rodent', 'seed', 'animal', 'kids'],
    [...layers, pair((x, y) => `${circle(x, y, 7)} ${circle(x + 2.5, y - 2.5, 2)}`, 200, 200, 42), ellipse(200, 216, 5, 3.5), catMouth(200, 221, 8)],
    [
      pair(blush, 200, 232, 70),
      clip(`${circle(126, 134, 12)} ${circle(274, 134, 12)}`, [region(body)]),
      'M 200 124 L 200 150 M 188 128 L 190 148 M 212 128 L 210 148',
      'M 200 256 L 200 290 M 192 262 L 192 284 M 208 262 L 208 284',
      clip('M 132 300 C 160 330 240 330 268 300', [region(seed), region(pawL), region(pawR), region(footL), region(footR)]),
    ],
  );
}

// ---- 15. sun and rainbow --------------------------------------------------------------------

function sunRainbow(): Template {
  const cl = cloud(84, 292, 120);
  const cr = cloud(316, 292, 120);
  const arcs = [150, 122, 94, 66].map((r) => `M ${200 - r} 300 A ${r} ${r} 0 0 1 ${200 + r} 300`).join(' ');
  const sun = circle(320, 86, 40);
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = i * 36;
    const [x1, y1] = polar(320, 86, 52, a);
    const [x2, y2] = polar(320, 86, 66, a);
    return line(x1, y1, x2, y2);
  }).join(' ');
  return tpl(
    'sun-rainbow',
    'Sun and rainbow',
    'beginner',
    ['rainbow', 'sun', 'cloud', 'weather', 'sky', 'baby', 'nursery', 'kids'],
    [outline(cl), outline(cr), clip(arcs, [region(cl), region(cr)]), sun, rays, pair(dot, 320, 82, 14), smile(320, 94, 8)],
    [pair((x, y) => blush(x, y, 6, 4), 320, 98, 24), pair(dot, 84, 290, 10), pair(dot, 316, 290, 10), sparkle(60, 90, 11), sparkle(200, 60, 8)],
  );
}

// ---- 16. cupcake ----------------------------------------------------------------------------

function cupcake(): Template {
  const wrapper = 'M 112 236 L 136 352 C 138 360 144 364 152 364 L 248 364 C 256 364 262 360 264 352 L 288 236 Z';
  const frost = [rrect(100, 204, 200, 48, 24), rrect(124, 164, 152, 50, 25), rrect(152, 128, 96, 46, 23)];
  const cherry = circle(200, 116, 15);
  const layers = stack([cherry, frost, wrapper]);
  const pleats = clip([142, 168, 196, 224, 252].map((x) => line(x, 252, x + (x - 200) * 0.12, 364)).join(' '), [region(wrapper)], 'inside');
  const sprinkles = [[140, 190, 30], [184, 180, -20], [236, 186, 40], [262, 222, -30], [130, 228, 60], [214, 150, 10], [172, 146, -50]]
    .map(([x, y, a]) => rotate(line(x - 6, y, x + 6, y), a, x, y))
    .join(' ');
  return tpl(
    'cupcake',
    'Happy cupcake',
    'beginner',
    ['cupcake', 'cake', 'birthday', 'party', 'sweet', 'food', 'kids'],
    [...layers, 'M 200 101 C 200 88 206 78 216 72', pair(dot, 200, 290, 26), smile(200, 304, 10)],
    [pleats, sprinkles, pair(blush, 200, 310, 46), circle(194, 110, 4)],
  );
}

// ---- 17. little dino ------------------------------------------------------------------------

function dino(): Template {
  const head = circle(132, 168, 64);
  const body = ellipse(224, 256, 98, 76);
  const tail = 'M 300 222 C 340 236 370 266 386 304 C 350 304 318 298 296 288 Z';
  const legs = [rrect(170, 296, 42, 56, 18), rrect(248, 296, 42, 56, 18)];
  const arm = petal(146, 268, 240, 34, 10, 0.6);
  // back spikes, pointing out of the body/head outline (hidden part clipped by the shapes)
  const spikes: string[] = [];
  const spikeAt = (cx: number, cy: number, rx: number, ry: number, deg: number, size: number) => {
    const t = (deg * Math.PI) / 180;
    const p: P = [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
    const nx = Math.cos(t) / rx;
    const ny = Math.sin(t) / ry;
    const nl = Math.hypot(nx, ny);
    const n: P = [nx / nl, ny / nl];
    const tg: P = [-n[1], n[0]];
    spikes.push(
      roundPoly(
        [
          [p[0] + tg[0] * size - n[0] * 6, p[1] + tg[1] * size - n[1] * 6],
          [p[0] + n[0] * size * 1.4, p[1] + n[1] * size * 1.4],
          [p[0] - tg[0] * size - n[0] * 6, p[1] - tg[1] * size - n[1] * 6],
        ],
        4,
      ),
    );
  };
  for (const deg of [-125, -95, -68]) spikeAt(132, 168, 64, 64, deg, 13);
  for (const deg of [-110, -84, -58, -32]) spikeAt(224, 256, 98, 76, deg, 15);
  const layers = stack([arm, head, body, tail, ...legs, ...spikes]);
  return tpl(
    'dino',
    'Chubby dinosaur',
    'intermediate',
    ['dinosaur', 'dino', 'animal', 'prehistoric', 'baby', 'kids'],
    [...layers, pair(dot, 128, 164, 24), smile(128, 186, 12), line(140, 370, 330, 370)],
    [
      pair(blush, 128, 190, 42),
      clip('M 150 286 C 190 320 250 326 296 300', [region(arm), region(head), ...legs.map(region)]),
      clip(`${circle(238, 228, 9)} ${circle(270, 250, 7)} ${circle(250, 270, 5)}`, [region(body)], 'inside'),
      `${line(178, 352, 178, 344)} ${line(190, 352, 190, 344)} ${line(256, 352, 256, 344)} ${line(268, 352, 268, 344)}`,
    ],
  );
}

// ---- 18. panda with bamboo ------------------------------------------------------------------

function pandaBamboo(): Template {
  const head = circle(196, 150, 72);
  const earL = circle(138, 92, 24);
  const earR = circle(254, 92, 24);
  const body = ellipse(196, 292, 86, 76);
  const bamboo = rrect(262, 112, 26, 268, 7);
  const pawA = circle(268, 250, 15);
  const pawB = circle(272, 294, 15);
  const footL = ellipse(156, 356, 26, 16);
  const footR = ellipse(232, 356, 26, 16);
  const leafA = petal(282, 116, 40, 56, 11);
  const leafB = petal(268, 114, -30, 46, 9);
  const leafC = petal(290, 210, 70, 50, 10);
  const layers = stack([pawA, pawB, footL, footR, head, leafA, leafB, leafC, bamboo, body, earL, earR]);
  const nodes = clip([170, 230, 290, 350].map((y) => line(262, y, 288, y)).join(' '), [region(pawA), region(pawB), region(head)]);
  return tpl(
    'panda-bamboo',
    'Panda with bamboo',
    'intermediate',
    ['panda', 'bear', 'bamboo', 'animal', 'baby', 'kids'],
    [
      ...layers,
      rotate(ellipse(166, 150, 16, 22), 35, 166, 150),
      rotate(ellipse(226, 150, 16, 22), -35, 226, 150),
      pair(dot, 196, 148, 28),
      ellipse(196, 176, 9, 6),
      catMouth(196, 186, 7),
      nodes,
    ],
    [
      pair(blush, 196, 192, 46),
      clip(`${circle(134, 88, 12)} ${circle(258, 88, 12)}`, [region(head), region(leafA), region(leafB)]),
      clip(`${leafLine(282, 116, 40, 48)} ${leafLine(268, 114, -30, 40)} ${leafLine(290, 210, 70, 42)}`, [region(head)]),
      `${circle(156, 358, 6)} ${circle(232, 358, 6)}`,
      clip('M 140 300 C 160 336 230 336 252 300', [region(pawA), region(pawB), region(footL), region(footR)]),
    ],
  );
}

function leafLine(bx: number, by: number, deg: number, len: number): string {
  const [x, y] = polar(bx, by, len, deg);
  return line(bx, by, x, y);
}

// ---- 19. sleeping moon ----------------------------------------------------------------------

function sleepingMoon(): Template {
  const outer = circle(196, 206, 136);
  const inner = circle(262, 166, 116);
  const moon = `${clip(outer, [region(inner)])} ${clip(inner, [region(outer)], 'inside')}`;
  const cl = cloud(276, 330, 150);
  const moonShape = [clip(moon, [region(cl)]), outline(cl)];
  return tpl(
    'sleeping-moon',
    'Sleeping moon',
    'beginner',
    ['moon', 'night', 'sleep', 'bedtime', 'star', 'baby', 'nursery', 'kids'],
    [
      ...moonShape,
      sleepy(106, 226, 13),
      smile(124, 272, 9),
      softStar(310, 70, 24, 11, 5, 3),
      softStar(352, 166, 15, 7, 5, 2),
      softStar(56, 70, 13, 6, 5, 2),
      zed(236, 196, 18),
      zed(266, 162, 13),
      zed(290, 134, 9),
    ],
    [blush(98, 250), sparkle(250, 40, 9), sparkle(372, 250, 8), circle(40, 180, 3), circle(360, 110, 3)],
  );
}

// ---- 20. chibi painter ----------------------------------------------------------------------

function chibiPainter(): Template {
  const head = circle(200, 160, 82);
  const hair =
    'M 112 176 C 98 92 150 54 200 54 C 250 54 302 92 288 176 C 282 152 276 138 262 128 Q 248 152 230 128 ' +
    'Q 212 152 196 124 Q 178 150 160 128 Q 140 146 128 152 C 120 160 116 168 112 176 Z';
  const beret = rotate(ellipse(186, 64, 66, 20), -10, 186, 64);
  const smock = 'M 162 232 C 150 262 142 300 140 332 L 260 332 C 258 300 250 262 238 232 Z';
  const legL = rrect(168, 326, 26, 30, 10);
  const legR = rrect(206, 326, 26, 30, 10);
  const shoeL = ellipse(178, 360, 22, 11);
  const shoeR = ellipse(222, 360, 22, 11);
  const handR = circle(296, 222, 12);
  const armR = rotate(rrect(236, 240, 64, 22, 11), -30, 242, 252);
  const brush = rotate(rrect(292, 150, 8, 100, 3), 22, 296, 222);
  const tip = rotate(petal(296, 152, 0, 34, 9, 0.2), 22, 296, 222);
  const handL = circle(134, 282, 11);
  const armL = rotate(rrect(124, 253, 56, 20, 10), -46, 152, 263);
  const palette = 'M 70 280 C 70 250 110 244 134 256 C 150 264 150 280 138 290 C 128 298 140 308 132 316 C 110 330 70 312 70 280 Z';
  const layers = stack([beret, hair, head, handR, tip, brush, handL, armR, armL, palette, smock, shoeL, shoeR, legL, legR]);
  const dots = [[88, 274, 6], [108, 264, 5], [92, 298, 5], [114, 310, 4]].map(([x, y, r]) => circle(x, y, r)).join(' ');
  return tpl(
    'chibi-painter',
    'Chibi kid painting',
    'intermediate',
    ['chibi', 'kid', 'child', 'girl', 'boy', 'artist', 'painter', 'paint', 'brush', 'beret', 'people'],
    [...layers, line(180, 46, 186, 34), pair((x, y) => bigEye(x, y, 10, 13), 200, 180, 32), smile(200, 206, 7)],
    [
      pair(blush, 200, 202, 50),
      clip(dots, [region(handL)]),
      clip('M 176 236 L 200 256 L 224 236', [region(head)]),
      rrect(212, 280, 26, 22, 5),
      sparkle(330, 330, 10),
      sparkle(60, 120, 9),
    ],
  );
}

export const cute: Template[] = [
  catLoaf(),
  sleepyBunny(),
  smilingCloud(),
  bobaCup(),
  riceBall(),
  cactus(),
  mushroomHouse(),
  penguin(),
  bearBalloon(),
  happyStar(),
  strawberry(),
  whale(),
  duckling(),
  hamster(),
  sunRainbow(),
  cupcake(),
  dino(),
  pandaBamboo(),
  sleepingMoon(),
  chibiPainter(),
];
