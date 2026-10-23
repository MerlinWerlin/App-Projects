// Game world, second batch (fb-1022b T124): original pixel and outline game pieces on a 400×400 canvas — pixel
// sprites (knight, slime king, potions, key, spaceship, open chest), an unbranded arcade cabinet and pocket
// console, a front-view kart, a walker mech, a boss monster of our own, a joystick, a gamepad doodle, a platform
// scene with a Pip cameo (docs/CAST.md) and a world map. Every piece is our own design from genre tropes only:
// no existing character, item design, logo, console or controller shape is drawn or evoked (docs/TEMPLATES.md).
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, line, petal, poly, rotate, rrect, shift, type P } from './draw.ts';
import { clip, region, roundPoly, stack, union } from './occlude.ts';
import { bent, blob, cloud, curve, dot, gear, limb, lines, m200, pip, pixel, pixSpark, smile, softStar, sparkle, type Grid } from './kit2.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], paths: string[], detail: string[] = []): Template {
  const d = detail.filter(Boolean);
  return {
    id,
    name,
    category: 'game',
    level,
    tags: ['game', 'video-game', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(d.length ? { detail: d } : {}),
  };
}

/** Symmetric rows of a sprite from widths per row (cols even). */
function sym(widths: number[], cols: number, ch: string): string[][] {
  return widths.map((w) => [...'.'.repeat((cols - w) / 2) + ch.repeat(w) + '.'.repeat((cols - w) / 2)]);
}
function paint(g: string[][], ch: string, cells: [number, number][]): void {
  for (const [r, c] of cells) g[r][c] = ch;
}
const rowsOf = (g: string[][]): Grid => g.map((r) => r.join(''));

// ---- 1. pixel slime king (beginner) -------------------------------------------------------------

function slimeKing(): Template {
  const crown: string[][] = [
    '.....k...kk...k.....',
    '.....kk.kkkk.kk.....',
    '.....kkkkkkkkkk.....',
    '.....kjkkjjkkjk.....',
    '.....kkkkkkkkkk.....',
  ].map((r) => [...r]);
  const body = sym([8, 12, 14, 16, 18, 18, 20, 20, 20, 20, 20, 20], 20, 's');
  const g = [...crown, ...body];
  // eyes (2×3) with a shine cell, blush, a wide grin
  paint(g, 'e', [[9, 6], [9, 7], [10, 6], [10, 7], [11, 6], [11, 7], [9, 12], [9, 13], [10, 12], [10, 13], [11, 12], [11, 13]]);
  paint(g, 'w', [[9, 6], [9, 12]]);
  paint(g, 'b', [[12, 3], [12, 4], [12, 15], [12, 16]]);
  paint(g, 'm', [[13, 8], [13, 11], [14, 9], [14, 10]]);
  paint(g, 'h', [[6, 4], [6, 5], [7, 3]]);
  g.push([...'ssssssssssssssssssss'], [...'.s..ssss....ssss..s.']);
  const p = pixel(rowsOf(g), 16);
  return tpl(
    'game2-pixel-slime-king',
    'Pixel slime king',
    'beginner',
    ['pixel', 'pixel-art', 'slime', 'monster', 'crown', 'king', 'cute', 'retro', 'kids'],
    [p.outline, p.colours],
    [pixSpark(54, 64, 8), pixSpark(350, 80, 7), pixSpark(356, 330, 5)],
  );
}

// ---- 2. pixel spaceship (beginner) --------------------------------------------------------------

function spaceship(): Template {
  const g = [
    '.......cc.......',
    '......cccc......',
    '......cwwc......',
    '.....cwwwwc.....',
    '.....cwwwwc.....',
    '.....cccccc.....',
    '....cccccccc....',
    '...fcccsscccf...',
    '..ffcccsscccff..',
    '.fffccccccccfff.',
    'ffffccccccccffff',
    'fff.cccccccc.fff',
    'ff...cc..cc...ff',
    '.....tt..tt.....',
    '.....tt..tt.....',
    '......t..t......',
  ];
  const p = pixel(g, 19);
  const stars = [pixSpark(60, 70, 7), pixSpark(340, 60, 9), pixSpark(46, 300, 6), pixSpark(356, 280, 6), pixSpark(300, 360, 5)];
  return tpl(
    'game2-pixel-spaceship',
    'Pixel star fighter',
    'beginner',
    ['pixel', 'pixel-art', 'spaceship', 'space', 'shooter', 'retro', 'kids'],
    [p.outline, p.colours],
    stars,
  );
}

// ---- 3. power-up gem (beginner) -----------------------------------------------------------------

function powerGem(): Template {
  const outer = poly([[110, 160], [158, 104], [242, 104], [290, 160], [200, 316]]);
  const facets = [
    poly([[110, 160], [290, 160]], false),
    poly([[158, 104], [176, 160], [200, 104], [224, 160], [242, 104]], false),
    poly([[176, 160], [200, 316], [224, 160]], false),
    poly([[130, 160], [200, 316]], false) + ' ' + poly([[270, 160], [200, 316]], false),
  ];
  const rays: string[] = [];
  for (const a of [-150, -120, -60, -30, 10, 170]) {
    const r0 = 150;
    const r1 = 176;
    const ax = (a * Math.PI) / 180;
    rays.push(line(200 + r0 * Math.cos(ax), 196 + r0 * Math.sin(ax), 200 + r1 * Math.cos(ax), 196 + r1 * Math.sin(ax)));
  }
  return tpl(
    'game2-power-gem',
    'Power-up gem',
    'beginner',
    ['power-up', 'gem', 'crystal', 'diamond', 'bonus', 'sparkle', 'kids'],
    [outer, ...facets, sparkle(300, 92, 20)],
    [rays.join(' '), 'M 150 132 L 162 118', sparkle(96, 300, 12), sparkle(316, 290, 9), line(140, 356, 260, 356)],
  );
}

// ---- 4. arcade joystick (beginner) --------------------------------------------------------------

function joystick(): Template {
  const top = poly([[90, 210], [150, 160], [330, 160], [310, 210]]);
  const front = rrect(90, 210, 220, 110, 10);
  const side = poly([[310, 210], [330, 160], [330, 266], [310, 316]]);
  const ball = circle(200, 92, 34);
  const shaft = rrect(193, 110, 14, 80, 6);
  const collar = ellipse(200, 186, 26, 9);
  const b1 = ellipse(258, 186, 16, 7);
  const b2 = ellipse(286, 172, 13, 5.5);
  const layers = stack([ball, collar, shaft, b1, b2, front, top, side]);
  return tpl(
    'arcade-joystick',
    'Arcade joystick box',
    'beginner',
    ['arcade', 'joystick', 'controller', 'retro', 'buttons', 'kids'],
    [...layers],
    [
      'M 186 74 Q 192 66 202 66',
      'M 120 250 L 150 250 M 120 270 L 150 270 M 120 290 L 150 290',
      circle(270, 270, 9),
      curve([[90, 290], [56, 300], [44, 336], [80, 352], [120, 344], [150, 360], [190, 366]]),
      sparkle(330, 80, 12),
    ],
  );
}

// ---- 5. gamepad doodle (beginner) ---------------------------------------------------------------

function gamepadDoodle(): Template {
  const body = blob([[86, 190], [120, 150], [200, 158], [280, 150], [314, 190], [322, 262], [292, 298], [252, 270], [200, 262], [148, 270], [108, 298], [78, 262]], 0.95);
  const dpad = roundPoly([[118, 196], [134, 196], [134, 180], [150, 180], [150, 196], [166, 196], [166, 212], [150, 212], [150, 228], [134, 228], [134, 212], [118, 212]], 3);
  const btns = [circle(252, 190, 10), circle(276, 210, 10), circle(252, 230, 10)];
  const armL = limb([88, 214], [44, 166], 7, 6);
  const handL = circle(40, 160, 12);
  const armR = limb([312, 214], [352, 168], 7, 6);
  const handR = circle(356, 162, 12);
  const legL = limb([150, 268], [146, 322], 7, 7);
  const legR = limb([250, 268], [254, 322], 7, 7);
  const shoeL = ellipse(138, 330, 22, 11);
  const shoeR = ellipse(262, 330, 22, 11);
  const layers = stack([dpad, ...btns, handL, handR, body, armL, armR, shoeL, shoeR, legL, legR]);
  const cord = curve([[200, 158], [196, 120], [220, 96], [208, 70]]);
  const heart = `M 208 70 C 196 54 176 64 188 80 L 208 98 L 228 80 C 240 64 220 54 208 70 Z`;
  return tpl(
    'game2-gamepad-doodle',
    'Happy gamepad doodle',
    'beginner',
    ['gamepad', 'controller', 'doodle', 'cute', 'face', 'kids'],
    [...layers, dot(184, 214, 6), dot(216, 214, 6), smile(200, 234, 12, 0.6), heart],
    [clip(cord, [region(heart)]), 'M 180 208 Q 181 206 183 206', 'M 30 150 Q 22 140 26 128 M 370 150 Q 378 140 374 128', line(100, 346, 300, 346)],
  );
}

// ---- 6. pixel key (beginner) --------------------------------------------------------------------

function pixelKey(): Template {
  const g = [
    '...bbbbbb...........',
    '..bbbbbbbb..........',
    '.bbb....bbb.........',
    'bbb..gg..bbb........',
    'bbb.gggg.bbsssssssss',
    'bbb.gggg.bbsssssssss',
    'bbb..gg..bbb...tt.tt',
    '.bbb....bbb....tt.tt',
    '..bbbbbbbb.....tt...',
    '...bbbbbb...........',
  ];
  const p = pixel(g, 17);
  return tpl(
    'game2-pixel-key',
    'Pixel dungeon key',
    'beginner',
    ['pixel', 'pixel-art', 'key', 'dungeon', 'loot', 'retro', 'kids'],
    [p.outline, p.colours],
    [pixSpark(80, 90, 8), pixSpark(330, 110, 7), pixSpark(300, 300, 6)],
  );
}

// ---- 7. pixel knight sprite (intermediate) ------------------------------------------------------

function knightSprite(): Template {
  const g = [
    '.......ppp........',
    '......ppppp...x...',
    '.....hhhhhhh..x...',
    '....hhhhhhhhh.x...',
    '....hvvvvvvvh.x...',
    '....hhhhhhhhh.x...',
    '.....hhhhhhh..x...',
    'ssss..bbbbb..ggg..',
    'scss.abbbbbaaaq...',
    'cccsaabbbbb...q...',
    'scss.abbbbb.......',
    'scss..ttttt.......',
    '.ss...bbbbb.......',
    '......ll.ll.......',
    '.....lll.lll......',
  ];
  const p = pixel(g, 20, 20, 50);
  return tpl(
    'game2-pixel-knight-sprite',
    'Pixel knight sprite',
    'intermediate',
    ['pixel', 'pixel-art', 'knight', 'sprite', 'sword', 'shield', 'retro', 'kids'],
    [p.outline, p.colours],
    [line(20, 364, 380, 364), pixSpark(330, 300, 8), pixSpark(40, 40, 6), pixSpark(370, 180, 5)],
  );
}

// ---- 8. pixel potion trio (intermediate) --------------------------------------------------------

function potionTrio(): Template {
  const round = pixel(
    ['...cc...', '...cc...', '..gggg..', '...gg...', '.gggggg.', 'gwgggggg', 'gwllllll', 'llllblll', 'llllllll', 'lllbllll', '.llllll.', '..llll..'],
    15, 30, 190,
  );
  const tall = pixel(
    ['..cc..', '..cc..', '.gggg.', '..gg..', '..gg..', '.gggg.', '.gwgg.', '.gwll.', '.llll.', '.llbl.', '.llll.', '.lbll.', '.llll.', '.llll.', '..ll..'],
    15, 155, 145,
  );
  const heart = pixel(
    ['....cc....', '....cc....', '...gggg...', '....gg....', '.gg.gg.gg.', 'gggggggggg', 'gwgggggggg', 'gwllllllll', 'llllllblll', '.llbllllll', '..llllll..', '...llll...', '....ll....'],
    15, 238, 175,
  );
  const shelf = rrect(20, 375, 360, 12, 4);
  return tpl(
    'game2-pixel-potion-trio',
    'Pixel potion shelf',
    'intermediate',
    ['pixel', 'pixel-art', 'potion', 'magic', 'bottle', 'shop', 'retro'],
    [round.outline, round.colours, tall.outline, tall.colours, heart.outline, heart.colours, shelf],
    [pixSpark(100, 120, 7), pixSpark(300, 100, 8), pixSpark(220, 80, 5), pixSpark(40, 140, 5)],
  );
}

// ---- 9. retro arcade cabinet (intermediate) ------------------------------------------------------

function arcadeCabinet(): Template {
  const cab = roundPoly([[120, 40], [280, 40], [280, 196], [304, 214], [304, 242], [278, 252], [278, 372], [122, 372], [122, 252], [96, 242], [96, 214], [120, 196]], 6);
  const marquee = rrect(134, 52, 132, 38, 6);
  const bezel = rrect(134, 100, 132, 92, 8);
  const screen = rrect(148, 110, 104, 72, 10);
  const slime = pixel(['..ssss..', '.ssssss.', 'sseesees', 'ssssssss', 'ssmmmmss', 'ssssssss'], 6, 176, 136);
  const ball = circle(150, 194, 8);
  const shaft = rrect(147, 196, 6, 18, 2);
  const door = rrect(170, 280, 60, 62, 5);
  const slots = [rrect(182, 292, 12, 20, 2), rrect(206, 292, 12, 20, 2)];
  const layers = stack([ball, shaft, cab]);
  return tpl(
    'arcade-cabinet',
    'Retro arcade cabinet',
    'intermediate',
    ['arcade', 'cabinet', 'retro', 'coin-op', 'screen', 'buttons'],
    [...layers, marquee, bezel, screen, slime.outline, door, ...slots, circle(206, 228, 6), circle(228, 228, 6), circle(250, 228, 6)],
    [
      'M 280 40 L 300 30 L 300 202',
      'M 104 214 L 296 214',
      softStar(156, 71, 9, 4, 5, 1),
      softStar(244, 71, 9, 4, 5, 1),
      'M 172 71 Q 186 61 200 71 Q 214 81 228 71',
      slime.colours,
      pixSpark(162, 122, 2.5) + ' ' + pixSpark(240, 124, 2.5),
      'M 160 172 L 172 172 M 228 172 L 240 172',
      line(132, 356, 268, 356),
      'M 184 324 L 216 324',
      sparkle(60, 80, 12),
      sparkle(346, 300, 10),
    ],
  );
}

// ---- 10. pocket console (intermediate) ----------------------------------------------------------

function pocketConsole(): Template {
  const body = blob([[60, 200], [80, 130], [150, 108], [250, 108], [320, 130], [340, 200], [320, 270], [250, 292], [150, 292], [80, 270]], 0.95);
  const bumpL = rrect(84, 98, 70, 24, 12);
  const bumpR = rrect(246, 98, 70, 24, 12);
  const screenRim = circle(200, 186, 66);
  const screen = circle(200, 186, 54);
  const ship = pixel(['.hh..hh.', 'hwhhhhhh', 'hhhhhhhh', '.hhhhhh.', '..hhhh..', '...hh...'], 8, 168, 162);
  const dpad = roundPoly([[90, 190], [106, 190], [106, 174], [122, 174], [122, 190], [138, 190], [138, 206], [122, 206], [122, 222], [106, 222], [106, 206], [90, 206]], 3);
  const btn = [circle(290, 172, 13), circle(270, 212, 13), circle(310, 212, 13)];
  const strap = 'M 330 240 C 360 250 372 290 350 316 C 334 334 306 328 300 306';
  const layers = stack([dpad, ...btn, screenRim, body, bumpL, bumpR]);
  return tpl(
    'arcade-pocket-console',
    'Pocket game console',
    'intermediate',
    ['handheld', 'console', 'portable', 'retro', 'arcade', 'screen'],
    [...layers, screen, ship.outline, clip(strap, [region(body)])],
    [
      ship.colours,
      pixSpark(176, 214, 2.5) + ' ' + pixSpark(232, 150, 2.5) + ' ' + pixSpark(170, 146, 2),
      'M 170 262 L 186 262 M 192 262 L 208 262 M 214 262 L 230 262',
      'M 96 250 L 104 258 M 108 246 L 116 254 M 120 242 L 128 250',
      circle(114, 198, 4),
      sparkle(60, 60, 12),
      sparkle(350, 70, 9),
    ],
  );
}

// ---- 11. racing kart, front view (intermediate) -------------------------------------------------

function kartFront(): Template {
  const helmet = circle(200, 140, 54);
  const goggles = rrect(160, 128, 80, 30, 14);
  const lensL = circle(181, 143, 11);
  const lensR = circle(219, 143, 11);
  const torso = roundPoly([[156, 186], [244, 186], [254, 250], [146, 250]], 14);
  const wheelS = ellipse(200, 230, 44, 13);
  const gloveL = circle(160, 228, 13);
  const gloveR = circle(240, 228, 13);
  const armL = bent([[166, 200], [140, 214], [158, 228]], [12, 10, 9]);
  const armR = armL.map(m200);
  const nose = roundPoly([[140, 290], [260, 290], [276, 330], [124, 330]], 10);
  const chassis = roundPoly([[108, 236], [292, 236], [304, 300], [96, 300]], 14);
  const tyreL = rrect(56, 262, 62, 92, 22);
  const tyreR = rrect(282, 262, 62, 92, 22);
  const spoiler = rrect(84, 168, 232, 20, 7);
  const posts = [rrect(110, 186, 12, 52, 3), rrect(278, 186, 12, 52, 3)];
  const rearL = rrect(40, 220, 50, 74, 18);
  const rearR = rrect(310, 220, 50, 74, 18);
  const layers = stack([lensL, lensR, goggles, gloveL, gloveR, wheelS, armL, armR, helmet, torso, nose, tyreL, tyreR, chassis, spoiler, ...posts, rearL, rearR]);
  const plate = circle(200, 310, 14);
  return tpl(
    'game2-racing-kart',
    'Racing kart head-on',
    'intermediate',
    ['racing', 'kart', 'race', 'driver', 'speed', 'car', 'kids'],
    [...layers, plate, softStar(200, 310, 9, 4, 5, 1)],
    [
      'M 154 108 Q 200 84 246 108',
      'M 176 138 Q 180 135 184 136 M 214 138 Q 218 135 222 136',
      smile(200, 172, 10, 0.5),
      'M 70 286 L 104 286 M 70 306 L 104 306 M 70 326 L 104 326 M 296 286 L 330 286 M 296 306 L 330 306 M 296 326 L 330 326',
      line(20, 362, 380, 362),
      lines([[20, 110, 60, 110], [340, 110, 380, 110], [30, 140, 60, 140], [340, 140, 370, 140]]),
    ],
  );
}

// ---- 12. boss monster (intermediate) -------------------------------------------------------------

function bossMonster(): Template {
  const body = blob([[96, 230], [104, 150], [150, 110], [200, 102], [250, 110], [296, 150], [304, 230], [290, 310], [240, 340], [160, 340], [110, 310]], 0.95);
  const hornL = blob([[130, 132], [96, 96], [92, 50], [112, 82], [150, 112]], 0.9);
  const hornR = blob([[270, 132], [304, 96], [308, 50], [288, 82], [250, 112]], 0.9);
  const hornM = petal(200, 112, -90, 44, 22, 0.4);
  const belly = ellipse(200, 278, 62, 50);
  const eyes = [circle(150, 186, 18), circle(200, 168, 22), circle(250, 186, 18)];
  const pupils = [circle(154, 190, 7), circle(204, 172, 9), circle(254, 190, 7)];
  const mouth = 'M 136 224 Q 200 262 264 224 Q 256 270 200 276 Q 144 270 136 224 Z';
  const tuskL = 'M 152 238 L 160 214 L 170 244 Z';
  const tuskR = m200(tuskL);
  const armL = limb([106, 240], [62, 272], 18, 14);
  const armR = limb([294, 240], [338, 272], 18, 14);
  const clawL = 'M 58 262 L 40 266 L 54 274 L 40 284 L 58 286 L 52 298 L 70 290 Z';
  const clawR = m200(clawL);
  const footL = ellipse(160, 346, 34, 16);
  const footR = ellipse(240, 346, 34, 16);
  const layers = stack([...pupils, ...eyes, tuskL, tuskR, mouth, clawL, clawR, armL, armR, footL, footR, belly, body, hornM, hornL, hornR]);
  const hp = rrect(100, 20, 200, 20, 6);
  const hpFill: string[] = [];
  for (let i = 1; i < 8; i++) hpFill.push(line(100 + i * 25, 24, 100 + i * 25, 36));
  return tpl(
    'game2-boss-monster',
    'Three-eyed boss monster',
    'intermediate',
    ['monster', 'boss', 'horns', 'creature', 'battle', 'kids'],
    [...layers, hp, softStar(84, 30, 10, 4.5, 5, 1)],
    [
      hpFill.join(' '),
      'M 172 254 L 178 264 L 186 256 L 194 268 L 200 258 L 206 268 L 214 256 L 222 264 L 228 254',
      'M 170 290 Q 200 300 230 290 M 176 310 Q 200 318 224 310',
      'M 144 340 L 144 354 M 160 342 L 160 358 M 176 340 L 176 354 M 224 340 L 224 354 M 240 342 L 240 358 M 256 340 L 256 354',
      sparkle(350, 110, 10),
      sparkle(46, 150, 8),
    ],
  );
}

// ---- 13. open treasure chest (advanced) ----------------------------------------------------------

function openChest(): Template {
  const g = [
    '..wwwwwwwwwwwwwwww..',
    '.wmmwwwwwwwwwwwwmmw.',
    'wwmmwwwwwwwwwwwwmmww',
    'wwmmwwwwwwwwwwwwmmww',
    'rrrrrrrrrrrrrrrrrrrr',
    '.oo.ooo.oooo.ooo.oo.',
    'oooooooooooooooooooo',
    'rrrrrrrrrkkrrrrrrrrr',
    'vvvvmmvvkkkkvvmmvvvv',
    'vvvvmmvvkkkkvvmmvvvv',
    'uuuummuuukkuuummuuuu',
    'uuuummuuuuuuuummuuuu',
    'vvvvmmvvvvvvvvmmvvvv',
    'vvvvmmvvvvvvvvmmvvvv',
    'rrrrrrrrrrrrrrrrrrrr',
  ];
  const p = pixel(g, 15, 50, 128);
  const coins: string[] = [];
  for (const [x, y, r] of [[120, 106, 13], [160, 96, 13], [204, 90, 14], [248, 98, 13], [284, 110, 12], [182, 72, 11], [226, 70, 11]] as const) coins.push(circle(x, y, r));
  const gem = poly([[200, 34], [218, 50], [200, 70], [182, 50]]);
  const coinsDrawn = stack([gem, ...coins]);
  const loose = [ellipse(70, 368, 16, 6), ellipse(334, 366, 16, 6), ellipse(356, 352, 14, 5)];
  return {
    ...tpl(
      'game2-open-chest',
      'Pixel treasure hoard',
      'advanced',
      ['pixel', 'pixel-art', 'treasure', 'chest', 'loot', 'gold', 'coins', 'retro'],
      [p.outline, p.colours, ...coinsDrawn, ...loose],
      [
        p.grid,
        'M 182 50 L 218 50 M 192 50 L 200 34 L 208 50 L 200 70',
        pixSpark(56, 70, 8),
        pixSpark(346, 60, 9),
        pixSpark(360, 160, 5),
        pixSpark(40, 160, 5),
        line(30, 382, 370, 382),
      ],
    ),
    detailWidth: 1.4,
  };
}

// ---- 14. walker mech with pilot (advanced) -------------------------------------------------------

function walkerMech(): Template {
  const dome = circle(200, 118, 52);
  const head = circle(200, 124, 26);
  const hair = blob([[176, 120], [178, 100], [200, 92], [222, 100], [226, 116], [212, 108], [196, 112]]);
  const goggles = rrect(178, 116, 44, 14, 7);
  const hull = roundPoly([[120, 150], [280, 150], [300, 196], [286, 250], [114, 250], [100, 196]], 22);
  const collar = rrect(140, 156, 120, 14, 6);
  const shoulderL = circle(104, 182, 24);
  const shoulderR = circle(296, 182, 24);
  const armL = bent([[100, 196], [74, 236], [80, 276]], [14, 12, 11]);
  const armR = bent([[300, 196], [326, 236], [320, 276]], [14, 12, 11]);
  const clawL = 'M 66 276 Q 60 304 76 314 L 80 300 L 88 316 Q 102 304 94 276 Z';
  const clawR = m200(clawL);
  const hip = rrect(150, 246, 100, 22, 8);
  const thighL = limb([166, 262], [140, 302], 14, 12);
  const thighR = limb([234, 262], [260, 302], 14, 12);
  const kneeL = circle(138, 306, 13);
  const kneeR = circle(262, 306, 13);
  const shinL = roundPoly([[124, 306], [154, 306], [158, 348], [118, 348]], 6);
  const shinR = m200(shinL);
  const footL = roundPoly([[96, 344], [170, 344], [176, 368], [90, 368]], 8);
  const footR = m200(footL);
  const antenna = 'M 260 86 L 286 50';
  const layers = stack([goggles, hair, head, dome, collar, shoulderL, shoulderR, clawL, clawR, armL, armR, hull, kneeL, kneeR, hip, thighL, thighR, footL, footR, shinL, shinR]);
  const hullR = region(hull);
  const rivets: string[] = [];
  for (const x of [130, 160, 240, 270]) rivets.push(circle(x, 236, 3));
  for (const [x, y] of [[124, 170], [276, 170]] as const) rivets.push(circle(x, y, 3));
  return {
    ...tpl(
      'game2-walker-mech',
      'Walker mech with pilot',
      'advanced',
      ['mech', 'robot', 'walker', 'pilot', 'sci-fi', 'machine', 'kids'],
      [...layers, clip(antenna, [region(dome)]), circle(288, 46, 6)],
      [
        'M 160 92 Q 172 76 190 72',
        'M 188 123 L 196 123 M 204 123 L 212 123',
        smile(200, 140, 8, 0.5),
        rivets.join(' '),
        clip('M 200 172 L 200 248 M 130 210 L 270 210', [hullR], 'inside'),
        rrect(150, 184, 34, 18, 4),
        gear(244, 194, 16, 8, 4) + ' ' + circle(244, 194, 5),
        'M 214 222 L 230 222 M 214 230 L 230 230',
        'M 126 320 L 152 320 M 126 330 L 152 330 M 248 320 L 274 320 M 248 330 L 274 330',
        'M 110 356 L 156 356 M 244 356 L 290 356',
        line(40, 380, 360, 380),
        sparkle(340, 110, 11),
        sparkle(60, 90, 9),
      ],
    ),
    detailWidth: 1.6,
  };
}

// ---- 15. platform scene with a Pip cameo (advanced) ----------------------------------------------

function platformScene(): Template {
  const islandA = roundPoly([[20, 300], [170, 300], [170, 330], [140, 356], [50, 356], [20, 330]], 10);
  const islandB = roundPoly([[220, 230], [380, 230], [380, 256], [356, 280], [244, 280], [220, 256]], 10);
  const islandC = roundPoly([[90, 150], [200, 150], [200, 172], [182, 190], [108, 190], [90, 172]], 10);
  const grassA = 'M 20 312 Q 32 322 44 312 Q 56 322 68 312 Q 80 322 92 312 Q 104 322 116 312 Q 128 322 140 312 Q 152 322 164 312';
  const grassB = shift(grassA, 206, -70).replace(/^M [^ ]+ [^ ]+/, 'M 226 242');
  const ladder = [line(150, 190, 150, 300), line(174, 190, 174, 300)];
  const rungs: string[] = [];
  for (let y = 206; y < 300; y += 18) rungs.push(line(150, y, 174, y));
  const block = rrect(270, 120, 42, 42, 4);
  const coins = [ellipse(110, 110, 8, 12), ellipse(140, 104, 8, 12), ellipse(170, 110, 8, 12)];
  const slime = blob([[250, 230], [254, 204], [272, 194], [290, 204], [294, 230]], 0.9);
  const door = 'M 340 230 L 340 176 Q 340 156 360 156 Q 380 156 380 176 L 380 230';
  const spikes = 'M 0 384 Q 25 374 50 384 Q 75 394 100 384 Q 125 374 150 384 Q 175 394 200 384 Q 225 374 250 384 Q 275 394 300 384 Q 325 374 350 384 Q 375 394 400 384';
  const p = pip(62, 272, 124);
  const pipLayers = p.layers.map((d) => rotate(d, -8, 62, 210));
  const front = [...pipLayers];
  const scene = stack([...front, slime, islandA, islandB, islandC, block, ...coins]);
  return {
    ...tpl(
      'game2-platform-scene',
      'Pip jumps a platform level',
      'advanced',
      ['platform', 'level', 'platformer', 'jump', 'cast', 'pip', 'scene'],
      [...scene, ...ladder.map((l) => clip(l, [region(islandC)])), door, spikes, ...p.face.map((d) => rotate(d, -8, 62, 210))],
      [
        clip(grassA, [region(pipLayers)]),
        grassB,
        'M 104 172 Q 124 180 144 172 Q 164 180 184 172',
        rungs.join(' '),
        softStar(291, 141, 12, 5, 5, 1.5),
        lines([[288, 168, 294, 180], [272, 166, 266, 176], [310, 166, 316, 176]]),
        dot(266, 214, 3) + ' ' + dot(280, 214, 3) + ' ' + smile(273, 222, 5, 0.5),
        ...p.detail.map((d) => rotate(d, -8, 62, 210)),
        'M 44 288 L 38 296 M 62 290 L 62 298 M 80 288 L 86 296',
        union(cloud(300, 60, 90)),
        union(cloud(80, 50, 70)),
        'M 50 356 L 46 372 M 80 356 L 84 376 M 120 356 L 118 370 M 270 280 L 266 296 M 320 280 L 324 298',
        'M 40 150 Q 32 166 40 182 M 134 150 Q 142 166 134 182',
        dot(360, 196, 3),
      ],
    ),
    detailWidth: 1.8,
  };
}

// ---- 16. world map (advanced) --------------------------------------------------------------------

function worldMap(): Template {
  const land = blob([[40, 120], [80, 50], [170, 40], [230, 66], [310, 40], [364, 90], [356, 170], [372, 250], [330, 340], [240, 364], [170, 336], [90, 360], [40, 300], [56, 210]], 0.95);
  const lake = blob([[210, 200], [240, 186], [266, 200], [258, 222], [226, 226]]);
  const castle = [rrect(280, 70, 50, 46, 2), rrect(272, 52, 16, 64, 2), rrect(322, 52, 16, 64, 2)];
  const nodes: P[] = [[90, 300], [150, 260], [130, 190], [190, 140], [250, 270], [310, 220], [300, 140]];
  const nodeC = nodes.map(([x, y]) => circle(x, y, 13));
  const mount = ['M 70 160 L 100 104 L 130 160', 'M 112 150 L 140 98 L 172 150'];
  const trees: string[] = [];
  for (const [x, y] of [[200, 318], [226, 330], [70, 230], [330, 290], [270, 330]] as const) trees.push(circle(x, y - 14, 12) + ' ' + line(x, y - 2, x, y + 8));
  const layers = stack([...nodeC, ...castle, lake, land]);
  // dotted route between nodes
  const route: string[] = [];
  for (let i = 0; i + 1 < nodes.length; i++) {
    const [a, b] = [nodes[i], nodes[i + 1]];
    const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12);
    for (let k = 2; k < n - 1; k++) route.push(circle(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, 3));
  }
  const marks = nodes.map(([x, y], i) => (i === nodes.length - 1 ? softStar(x, y, 8, 3.5, 5, 1) : i % 2 === 0 ? dot(x, y, 4) : line(x - 4, y, x + 4, y)));
  return {
    ...tpl(
      'game2-world-map',
      'Level select world map',
      'advanced',
      ['level', 'map', 'world', 'adventure', 'island', 'castle', 'retro'],
      [...layers, ...mount.map((d) => clip(d, [region(nodeC[2])]))],
      [
        clip(route.join(' '), [region(lake)]),
        ...marks,
        trees.join(' '),
        'M 280 70 L 330 70 M 296 116 L 296 98 Q 305 88 314 98 L 314 116',
        'M 272 52 L 272 44 L 278 44 L 278 52 M 282 52 L 282 44 L 288 44 L 288 52 M 322 52 L 322 44 L 328 44 L 328 52 M 332 52 L 332 44 L 338 44 L 338 52',
        'M 330 52 L 330 30 L 348 36 L 330 42',
        'M 90 126 L 100 104 L 108 122 M 132 116 L 140 98 L 150 118',
        'M 220 206 Q 230 202 240 206',
        'M 10 60 Q 20 54 30 60 M 360 380 Q 370 374 380 380 M 14 380 Q 24 374 34 380 M 370 20 Q 380 14 390 20',
        circle(370, 330, 20) + ' ' + 'M 370 316 L 374 330 L 370 344 L 366 330 Z',
        'M 30 300 Q 24 330 52 340',
      ],
    ),
    detailWidth: 1.8,
  };
}

export const game2: Template[] = [
  slimeKing(),
  spaceship(),
  powerGem(),
  joystick(),
  gamepadDoodle(),
  pixelKey(),
  knightSprite(),
  potionTrio(),
  arcadeCabinet(),
  pocketConsole(),
  kartFront(),
  bossMonster(),
  openChest(),
  walkerMech(),
  platformScene(),
  worldMap(),
];

