// Heroes, second batch (fb-1022b T124): Linework's own hero team on a 400×400 canvas — Starbright (star emblem,
// flies with a comet trail), Volt Fox (fox hero, lightning emblem), Tidewave (wave emblem), Iron Acorn (armoured
// squirrel), Gearbit (sidekick robot), plus a blanket-cape kid, a rescue ninja, an emblem sheet, a landing pose, a
// team lineup, a comic page and a Pip cameo (docs/CAST.md). Every name, costume and emblem is our own generic design
// from genre tropes (cape, domino mask, belt, boots, plain star / bolt / wave / acorn / gear badges); nothing draws
// or evokes an existing character, costume, emblem or logo (docs/TEMPLATES.md).
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, poly, polar, rotate, rrect, type P } from './draw.ts';
import { clip, region, roundPoly, stack, type Layer } from './occlude.ts';
import {
  acornMark, almond, bent, blob, bolt, cloud, curve, domino, dot, gear, limb, lines, m200, pip, shield, smile, softStar,
  sparkle, waveMark,
} from './kit2.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], paths: string[], detail: string[] = []): Template {
  const d = detail.filter(Boolean);
  return {
    id: `hero2-${id}`,
    name,
    category: 'heroes',
    level,
    tags: ['heroes', 'hero', 'superhero', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(d.length ? { detail: d } : {}),
  };
}

/** Scale by s about the origin, then move by (dx, dy). */
const place = (d: string, s: number, dx: number, dy: number): string =>
  mapPath(d, { map: (x, y) => [dx + x * s, dy + y * s], scale: s, rotate: 0, flip: false });
const placeL = (l: Layer, s: number, dx: number, dy: number): Layer =>
  typeof l === 'string' ? place(l, s, dx, dy) : l.map((d) => place(d, s, dx, dy));

// ---- standing figure kit ------------------------------------------------------------------------

type Who = 'starbright' | 'tidewave' | 'volt' | 'acorn';
type Fig = { layers: Layer[]; marks: string[]; detail: string[] };

/** Head of each team member, centred near (200, 66): front layers, face marks and detail. */
function headOf(who: Who): Fig {
  if (who === 'volt') {
    const head = blob([[166, 60], [176, 40], [200, 34], [224, 40], [234, 60], [244, 84], [222, 88], [200, 100], [178, 88], [156, 84]], 0.95);
    const earL = roundPoly([[172, 46], [160, 4], [194, 36]], 4);
    const earR = m200(earL);
    const mask = domino(200, 62, 30);
    return {
      layers: [mask, head, earL, earR],
      marks: [almond(188, 62, 6, 2.6), almond(212, 62, 6, 2.6), ellipse(200, 80, 5, 3.5)],
      detail: ['M 168 20 L 178 40 M 232 20 L 222 40', 'M 194 90 Q 200 94 206 90', 'M 160 82 L 170 78 M 240 82 L 230 78'],
    };
  }
  if (who === 'acorn') {
    const head = circle(200, 70, 30);
    const earL = roundPoly([[164, 54], [168, 18], [188, 44]], 5);
    const earR = m200(earL);
    const helmet = 'M 168 66 C 166 40 182 30 200 30 C 218 30 234 40 232 66 L 218 62 L 200 66 L 182 62 Z';
    const crest = blob([[190, 32], [194, 18], [200, 12], [206, 18], [210, 32]], 0.9);
    return {
      layers: [crest, helmet, head, earL, earR],
      marks: [dot(188, 72, 4), dot(212, 72, 4), 'M 196 84 Q 200 88 204 84 M 200 84 L 200 80'],
      detail: ['M 182 48 Q 200 42 218 48', 'M 196 92 L 196 98 M 204 92 L 204 98', 'M 196 24 L 204 24', 'M 176 82 L 162 80 M 176 88 L 164 92 M 224 82 L 238 80 M 224 88 L 236 92'],
    };
  }
  const head = circle(200, 68, 27);
  const mask = domino(200, 68, 27);
  if (who === 'tidewave') {
    const hair = blob([[170, 70], [168, 46], [186, 34], [210, 34], [230, 46], [236, 70], [244, 96], [232, 110], [226, 90], [220, 64], [204, 54], [188, 60], [180, 80], [174, 106], [160, 100]], 0.95);
    return {
      layers: [mask, hair, head],
      marks: [almond(189, 68, 6, 2.6), almond(211, 68, 6, 2.6)],
      detail: [smile(200, 86, 7, 0.4), 'M 196 72 L 194 79 L 199 80', 'M 194 40 Q 206 44 214 56'],
    };
  }
  const hair = blob([[172, 70], [172, 46], [190, 36], [214, 38], [230, 52], [228, 72], [220, 54], [204, 50], [186, 54]], 0.95);
  const clipStar = softStar(222, 44, 10, 4.5, 5, 1);
  return {
    layers: [clipStar, mask, hair, head],
    marks: [almond(189, 68, 6, 2.6), almond(211, 68, 6, 2.6)],
    detail: [smile(200, 86, 7, 0.4), 'M 200 72 L 197 80 L 202 81'],
  };
}

/** Chest emblem of each team member at (cx, cy), size s. */
function emblemOf(who: Who, cx: number, cy: number, s: number): string[] {
  if (who === 'volt') return [bolt(cx - 0.2 * s, cy - 0.5 * s, s)];
  if (who === 'tidewave') return [waveMark(cx, cy, s)];
  if (who === 'acorn') return acornMark(cx, cy + 0.04 * s, s * 0.9);
  return [softStar(cx, cy, s * 0.5, s * 0.22, 5, 1.5)];
}

/** A team member standing: hands on hips or one fist raised; with cape (human heroes) or tail (animal heroes). */
function standing(who: Who, pose: 'hips' | 'fist'): Fig {
  const h = headOf(who);
  const neck = rrect(189, 92, 22, 32, 6);
  const torso = roundPoly([[146, 120], [254, 120], [262, 146], [228, 236], [172, 236], [138, 146]], 16);
  const armL = bent([[154, 136], [116, 188], [164, 230]], [15, 12, 10]);
  const fistL = circle(168, 232, 11);
  const armR = pose === 'hips' ? armL.map(m200) : bent([[246, 136], [292, 112], [300, 60]], [15, 12, 10]);
  const fistR = pose === 'hips' ? m200(fistL) : circle(302, 50, 14);
  const belt = rrect(168, 226, 64, 15, 4);
  const trunks = roundPoly([[172, 236], [228, 236], [236, 272], [206, 278], [200, 264], [194, 278], [164, 272]], 6);
  const legL = bent([[184, 260], [178, 318], [172, 358]], [18, 13, 10]);
  const legR = legL.map(m200);
  const bootL = roundPoly([[160, 322], [190, 322], [188, 360], [196, 376], [146, 378], [156, 360]], 6);
  const bootR = m200(bootL);
  const animal = who === 'volt' || who === 'acorn';
  const back: Layer[] = [];
  if (who === 'volt') back.push(blob([[220, 250], [270, 286], [330, 290], [376, 250], [372, 210], [350, 236], [312, 248], [270, 236], [236, 224]], 0.95));
  else if (who === 'acorn') back.push(blob([[226, 244], [290, 262], [340, 230], [356, 160], [330, 110], [292, 108], [276, 136], [300, 150], [316, 180], [306, 216], [266, 222], [238, 214]], 0.95));
  else back.push(blob([[148, 116], [252, 116], [290, 220], [320, 372], [282, 360], [250, 380], [200, 366], [150, 380], [118, 360], [80, 372], [110, 220]], 0.95));
  const collar = animal ? [] : ['M 160 120 L 166 98 L 188 112 Z', 'M 240 120 L 234 98 L 212 112 Z'];
  const em = emblemOf(who, 200, 166, 34);
  const emBg = who === 'acorn' ? roundPoly([[180, 140], [220, 140], [232, 162], [220, 186], [180, 186], [168, 162]], 4) : circle(200, 166, 24);
  const layers: Layer[] = [fistL, fistR, ...h.layers, armL, armR, belt, em.length > 1 ? em : em[0], emBg, torso, trunks, neck, bootL, bootR, legL, legR, ...collar, ...back];
  const tR = region(torso);
  const detail = [
    ...h.detail,
    clip('M 162 196 Q 180 204 200 202 Q 220 204 238 196', [tR, region(emBg), region(armL), region(armR)].slice(0, 1), 'inside'),
    'M 196 226 L 196 241 M 204 226 L 204 241',
    'M 170 340 L 186 340 M 214 340 L 230 340',
  ];
  if (who === 'volt') detail.push('M 340 280 L 352 262 L 344 262 L 358 240');
  if (who === 'acorn') detail.push('M 300 238 Q 320 230 332 214 M 322 130 Q 340 150 342 176 M 336 196 Q 330 218 312 232');
  if (!animal) detail.push(clip('M 120 200 Q 112 280 100 360 M 280 200 Q 288 280 300 360', [region(back[0])], 'inside'));
  if (who === 'acorn') detail.push(clip(clip('M 150 150 L 250 150 M 146 200 L 254 200', [tR], 'inside'), [region(emBg), region(armL), region(armR)]));
  return { layers, marks: h.marks, detail };
}

/** Render a figure as front-to-back stacked outlines with marks; detail clipped to stay behind front layers. */
function drawFig(fig: Fig): { paths: string[]; detail: string[] } {
  return { paths: [...stack(fig.layers), ...fig.marks], detail: fig.detail.filter(Boolean) };
}

// ---- 1. kid hero in a blanket cape (beginner) ----------------------------------------------------

function capeKid(): Template {
  const head = circle(200, 110, 58);
  const hair = blob([[142, 108], [150, 66], [196, 48], [246, 62], [260, 104], [244, 90], [222, 84], [204, 96], [184, 84], [160, 96]], 0.95);
  const goggles = [circle(178, 76, 15), circle(222, 76, 15)];
  const strap = 'M 142 82 L 163 78 M 237 78 L 258 82';
  const tee = roundPoly([[150, 172], [250, 172], [262, 222], [238, 226], [240, 270], [160, 270], [162, 226], [138, 222]], 12);
  const armL = bent([[150, 182], [124, 222], [160, 252]], [12, 10, 9]);
  const armR = armL.map(m200);
  const handL = circle(164, 254, 11);
  const handR = m200(handL);
  const shorts = roundPoly([[160, 266], [240, 266], [244, 300], [206, 302], [200, 290], [194, 302], [156, 300]], 8);
  const legL = limb([182, 298], [180, 330], 11, 10);
  const legR = m200(legL);
  const bootL = roundPoly([[160, 318], [196, 318], [198, 360], [150, 360], [152, 340]], 8);
  const bootR = m200(bootL);
  const cape = blob([[160, 170], [240, 170], [290, 250], [330, 340], [270, 326], [200, 346], [130, 326], [70, 340], [110, 250]], 0.9);
  const cushion = rrect(110, 356, 180, 26, 12);
  const layers = stack([...goggles, hair, head, handL, handR, armL, armR, shorts, tee, bootL, bootR, legL, legR, cape, cushion]);
  return tpl(
    'cape-kid',
    'Kid hero in a blanket cape',
    'beginner',
    ['kid', 'child', 'cape', 'dress-up', 'pretend', 'kids', 'cute'],
    [...layers, strap, dot(184, 118, 5), dot(216, 118, 5), smile(200, 138, 14, 0.6), softStar(200, 212, 20, 9, 5, 2)],
    [
      'M 172 72 Q 176 68 182 68 M 216 72 Q 220 68 226 68',
      circle(108, 300, 6) + ' ' + circle(292, 300, 6) + ' ' + circle(100, 328, 5) + ' ' + circle(300, 328, 5) + ' ' + circle(140, 316, 5) + ' ' + circle(260, 316, 5),
      'M 150 124 Q 154 120 158 124 M 242 124 Q 246 120 250 124',
      sparkle(330, 80, 14),
      sparkle(70, 70, 10),
    ],
  );
}

// ---- 2. hero team emblem sheet (beginner) --------------------------------------------------------

function emblemSheet(): Template {
  const frames = [
    circle(80, 110, 54),
    shield(200, 54, 104, 118),
    rrect(270, 60, 100, 100, 26),
    poly([polar(80, 280, 56, -90), polar(80, 280, 56, -30), polar(80, 280, 56, 30), polar(80, 280, 56, 90), polar(80, 280, 56, 150), polar(80, 280, 56, 210)]),
    gear(200, 280, 58, 10, 9),
    roundPoly([[270, 236], [370, 236], [370, 300], [320, 334], [270, 300]], 10),
  ];
  const inner = [
    softStar(80, 112, 34, 15, 5, 3),
    bolt(194, 66, 82),
    waveMark(320, 112, 74),
    ...acornMark(80, 284, 70),
    circle(200, 280, 30),
    softStar(320, 282, 26, 11, 5, 3) ,
  ];
  return tpl(
    'emblem-sheet',
    'Hero team emblem sheet',
    'beginner',
    ['emblem', 'badge', 'shield', 'star', 'lightning', 'wave', 'acorn', 'geometric', 'kids'],
    [...frames, ...inner],
    [circle(80, 110, 46), circle(200, 280, 22), sparkle(200, 370, 10), sparkle(30, 200, 8), sparkle(370, 200, 8)],
  );
}

// ---- 3. Gearbit the sidekick robot (beginner) -----------------------------------------------------

function gearbitParts(): Fig {
  const body = rrect(140, 100, 120, 160, 60);
  const visor = rrect(156, 128, 88, 58, 26);
  const eyeL = ellipse(184, 156, 9, 12);
  const eyeR = ellipse(216, 156, 9, 12);
  const mast = rrect(196, 70, 8, 32, 3);
  const tip = softStar(200, 62, 13, 6, 5, 1.5);
  const armL = limb([144, 186], [104, 214], 9, 8);
  const handL = circle(98, 218, 14);
  const armR = limb([256, 186], [290, 140], 9, 8);
  const handR = circle(296, 132, 14);
  const em = gear(200, 216, 22, 8, 5);
  const jet = roundPoly([[164, 252], [236, 252], [222, 284], [178, 284]], 8);
  const flame = blob([[180, 284], [220, 284], [212, 312], [200, 340], [188, 312]], 0.9);
  const scarf = roundPoly([[142, 192], [258, 192], [258, 204], [142, 204]], 4);
  const tail = blob([[150, 196], [120, 236], [96, 248], [124, 210]], 0.9);
  return {
    layers: [eyeL, eyeR, visor, tip, mast, handL, handR, em, scarf, tail, armL, armR, body, jet, flame],
    marks: [circle(200, 216, 7)],
    detail: [smile(200, 174, 9, 0.45), 'M 182 150 Q 184 148 186 150 M 214 150 Q 216 148 218 150', 'M 306 112 Q 316 120 318 132 M 312 100 Q 326 112 328 130', 'M 192 300 Q 200 318 208 300'],
  };
}

function gearbit(): Template {
  const g = gearbitParts();
  return tpl(
    'gearbit-robot',
    'Gearbit the sidekick robot',
    'beginner',
    ['sidekick', 'robot', 'gearbit', 'gear', 'helper', 'cute', 'kids'],
    [...stack(g.layers), ...g.marks],
    [...g.detail, sparkle(70, 90, 12), sparkle(340, 290, 10), lines([[150, 330, 170, 352], [250, 330, 230, 352]])],
  );
}

// ---- 4. Pip the pencil hero (beginner, cast cameo) -------------------------------------------------

function pipHero(): Template {
  const p = pip(200, 340, 250);
  const s = 250 / 200;
  const top = 340 - 250;
  const q = (x: number, y: number): P => [200 + x * s, top + y * s];
  const mask = domino(q(0, 86)[0], q(0, 86)[1], 30 * s);
  const cape = blob([q(-30, 56), q(30, 56), q(64, 120), q(92, 196), q(50, 186), q(0, 200), q(-50, 186), q(-92, 196), q(-64, 120)], 0.9);
  const layers = stack([...p.layers.slice(0, 2), mask, ...p.layers.slice(2), cape]);
  return tpl(
    'pip-hero',
    'Pip the pencil hero',
    'beginner',
    ['cast', 'pip', 'pencil', 'cape', 'mask', 'mascot', 'cute', 'kids'],
    [...layers, ...p.face.slice(0, 2).map((d) => d), p.face[2], softStar(q(0, 128)[0], q(0, 128)[1], 16, 7, 5, 2)],
    [...p.detail.map((d) => clip(d, [region(mask), region(softStar(q(0, 128)[0], q(0, 128)[1], 18, 8, 5, 2))])), sparkle(80, 80, 12), sparkle(330, 70, 10), line(90, 370, 310, 370)],
  );
}

// ---- 5. acorn hero shield (beginner) --------------------------------------------------------------

function acornShield(): Template {
  const rim = circle(200, 200, 150);
  const ring = circle(200, 200, 122);
  const plate = circle(200, 200, 96);
  const acorn = acornMark(200, 206, 120);
  const rivets: string[] = [];
  for (let i = 0; i < 12; i++) rivets.push(circle(...polar(200, 200, 136, i * 30), 4));
  return tpl(
    'acorn-shield',
    'Iron Acorn hero shield',
    'beginner',
    ['shield', 'acorn', 'emblem', 'badge', 'armour', 'kids'],
    [rim, ring, plate, ...acorn],
    [rivets.join(' '), 'M 166 176 Q 200 168 234 176', 'M 150 210 Q 160 250 190 268', sparkle(360, 50, 12), sparkle(40, 360, 10)],
  );
}

// ---- 6. Starbright flying (intermediate) ------------------------------------------------------------

function starbrightFlyer(): { layers: Layer[]; marks: string[]; detail: string[] } {
  const head = circle(292, 196, 22);
  const hair = blob([[270, 200], [272, 178], [292, 170], [312, 176], [306, 186], [292, 184], [282, 194], [280, 210]], 0.95);
  const clipStar = softStar(278, 176, 9, 4, 5, 1);
  const mask = 'M 294 190 C 302 186 312 186 316 189 C 315 197 308 200 298 198 Z';
  const fistA = circle(352, 150, 11);
  const armA = bent([[256, 186], [300, 166], [344, 154]], [12, 10, 9]);
  const fistB = circle(354, 176, 11);
  const armB = bent([[258, 198], [304, 186], [346, 178]], [12, 10, 9]);
  const torso = limb([254, 202], [172, 206], 26, 20);
  const belt = rotate(rrect(176, 182, 14, 48, 4), -2, 183, 206);
  const legA = bent([[172, 196], [122, 190], [84, 194]], [19, 15, 11]);
  const bootA = limb([96, 194], [52, 196], 13, 12);
  const legB = bent([[170, 216], [132, 228], [96, 246]], [18, 15, 11]);
  const bootB = limb([108, 240], [66, 256], 13, 12);
  const scarf = blob([[262, 208], [230, 226], [200, 236], [170, 250], [196, 252], [230, 240], [264, 222]], 0.9);
  const layers: Layer[] = [fistA, armA, clipStar, mask, hair, head, fistB, armB, belt, scarf, torso, bootA, legA, bootB, legB];
  return {
    layers,
    marks: [almond(305, 193, 4, 1.7), softStar(222, 202, 10, 4.5, 5, 1, -90), 'M 310 206 Q 306 210 300 209'],
    detail: [],
  };
}

function starbrightFlying(): Template {
  const fig = starbrightFlyer();
  const r = (d: string) => rotate(d, -28, 200, 200);
  const rl = (l: Layer): Layer => (typeof l === 'string' ? r(l) : l.map(r));
  const layers = fig.layers.map(rl);
  const trail: string[] = [];
  const trailPts: [number, number, number][] = [[40, 200, 14], [12, 214, 10], [20, 250, 9], [-6, 236, 7], [0, 180, 7]];
  for (const [x, y, s] of trailPts) trail.push(r(softStar(x + 20, y + 10, s, s * 0.45, 5, 1)));
  const front = layers.map((l) => region(l));
  const streaks = r('M 40 222 Q 0 230 -30 240 M 50 236 Q 20 260 -10 290 M 46 206 Q 10 196 -20 190');
  return tpl(
    'starbright-flying',
    'Starbright flying high',
    'intermediate',
    ['starbright', 'flying', 'star', 'comet', 'sky', 'figure', 'mask'],
    [...stack([...layers, cloud(300, 340, 130)]), ...fig.marks.map(r), ...trail],
    [clip(streaks, front), sparkle(340, 60, 12), sparkle(150, 70, 8), sparkle(60, 330, 9)],
  );
}

// ---- 7. Volt Fox (intermediate) -------------------------------------------------------------------

function voltFox(): Template {
  const fig = standing('volt', 'fist');
  const d = drawFig(fig);
  return tpl(
    'volt-fox',
    'Volt Fox ready for action',
    'intermediate',
    ['volt', 'fox', 'lightning', 'mask', 'figure', 'animal', 'kids'],
    d.paths,
    [...d.detail, 'M 316 40 L 330 30 M 320 60 L 338 60 M 300 24 L 304 10', sparkle(70, 80, 12)],
  );
}

// ---- 8. Tidewave portrait (intermediate) ----------------------------------------------------------

function tidewavePortrait(): Template {
  const s = 2.4;
  const dx = 200 - 200 * s;
  const dy = 80 - 40 * s;
  const head = place(circle(200, 68, 27), s, dx, dy);
  const mask = place(domino(200, 68, 27), s, dx, dy);
  const hair = place(blob([[170, 70], [168, 46], [186, 34], [210, 34], [230, 46], [236, 70], [244, 96], [232, 110], [226, 90], [220, 64], [204, 54], [188, 60], [180, 80], [174, 106], [160, 100]], 0.95), s, dx, dy);
  const neck = rrect(172, 196, 56, 80, 18);
  const shoulders = roundPoly([[60, 398], [76, 300], [130, 262], [200, 256], [270, 262], [324, 300], [340, 398]], 30);
  const collarL = 'M 132 270 C 118 238 146 214 176 228 C 160 234 156 248 168 260 Z';
  const collarR = m200(collarL);
  const emblem = waveMark(200, 328, 70);
  const emBg = ellipse(200, 328, 50, 34);
  const layers = stack([mask, hair, head, collarL, collarR, neck, emblem, emBg, shoulders]);
  return tpl(
    'tidewave-portrait',
    'Tidewave masked hero portrait',
    'intermediate',
    ['tidewave', 'portrait', 'mask', 'wave', 'face', 'comic'],
    [...layers, place(almond(189, 68, 6, 2.6), s, dx, dy), place(almond(211, 68, 6, 2.6), s, dx, dy)],
    [
      place('M 199 72 L 196 80 L 201 81', s, dx, dy),
      place(smile(200, 86, 7, 0.4), s, dx, dy),
      place('M 194 40 Q 206 44 214 56 M 180 44 Q 176 60 178 74', s, dx, dy),
      place('M 186 63 Q 189 61 192 63 M 208 63 Q 211 61 214 63', s, dx, dy),
      'M 30 120 Q 50 100 70 120 Q 90 140 110 120 M 290 120 Q 310 100 330 120 Q 350 140 370 120',
      'M 20 170 Q 40 150 60 170 M 340 170 Q 360 150 380 170',
      sparkle(60, 50, 10),
      sparkle(350, 60, 12),
    ],
  );
}

// ---- 9. Iron Acorn (intermediate) -----------------------------------------------------------------

function ironAcorn(): Template {
  const fig = standing('acorn', 'hips');
  const d = drawFig(fig);
  return tpl(
    'iron-acorn',
    'Iron Acorn armoured squirrel hero',
    'intermediate',
    ['acorn', 'squirrel', 'armour', 'emblem', 'figure', 'animal', 'kids'],
    d.paths,
    [...d.detail, sparkle(70, 80, 12), sparkle(70, 300, 8), line(80, 384, 330, 384)],
  );
}

// ---- 10. rescue ninja with a kitten (intermediate) ------------------------------------------------

function rescueNinja(): Template {
  const head = circle(200, 92, 42);
  const hood = 'M 160 82 Q 200 72 240 82 L 241 106 Q 200 98 159 106 Z';
  const tails = [blob([[236, 80], [276, 62], [316, 70], [296, 78], [270, 82], [242, 92]]), blob([[236, 88], [278, 92], [312, 112], [292, 114], [266, 104], [240, 98]])];
  const torso = roundPoly([[146, 140], [254, 140], [262, 166], [236, 260], [164, 260], [138, 166]], 16);
  const sash = 'M 160 236 L 240 236 L 242 260 L 158 260 Z';
  const kHead = circle(200, 182, 30);
  const kEarL = roundPoly([[176, 170], [172, 140], [196, 156]], 3);
  const kEarR = m200(kEarL);
  const kBody = ellipse(200, 222, 36, 22);
  const kTail = blob([[232, 226], [262, 212], [276, 186], [266, 184], [250, 206], [228, 214]], 0.9);
  const armL = bent([[152, 158], [130, 220], [196, 238]], [16, 13, 11]);
  const armR = bent([[248, 158], [270, 220], [204, 238]], [16, 13, 11]);
  const pants = [
    roundPoly([[164, 256], [204, 256], [196, 308], [170, 342], [136, 336], [150, 298]], 12),
    roundPoly([[196, 256], [236, 256], [250, 298], [264, 336], [230, 342], [204, 308]], 12),
  ];
  const footL = roundPoly([[130, 336], [172, 336], [170, 362], [112, 364], [118, 350]], 6);
  const footR = m200(footL);
  const rope = 'M 150 150 C 120 170 110 220 130 250 C 140 262 152 258 156 248';
  const layers = stack([kEarL, kEarR, kHead, kTail, armL, armR, kBody, hood, head, tails, sash, torso, footL, footR, pants]);
  return tpl(
    'rescue-ninja',
    'Rescue ninja with a kitten',
    'intermediate',
    ['ninja', 'rescue', 'kitten', 'cat', 'stealth', 'figure', 'kids'],
    [...layers, almond(184, 94, 9, 3.4, 6), almond(216, 94, 9, 3.4, -6), dot(190, 180, 3.6), dot(210, 180, 3.6)],
    [
      'M 196 190 L 204 190 L 200 195 Z M 200 195 Q 196 200 192 198 M 200 195 Q 204 200 208 198',
      'M 170 186 L 156 184 M 170 192 L 158 196 M 230 186 L 244 184 M 230 192 L 242 196',
      clip(rope, [region(armL), region(kHead), region(kBody)]),
      'M 180 270 L 176 306 M 220 270 L 224 306',
      line(70, 368, 330, 368),
      sparkle(70, 120, 10),
      sparkle(330, 170, 12),
    ],
  );
}

// ---- 11. Starbright three-point landing (advanced) -------------------------------------------------

function landing(): Template {
  const h = headOf('starbright');
  const headL = h.layers.map((l) => (typeof l === 'string' ? place(l, 1.1, -20, 74) : l));
  const torso = roundPoly([[150, 176], [250, 176], [252, 204], [228, 262], [172, 262], [150, 204]], 16);
  const neck = rrect(190, 154, 22, 28, 6);
  const armDown = bent([[238, 190], [262, 260], [244, 330]], [15, 12, 10]);
  const fistDown = circle(242, 338, 15);
  const armBack = bent([[160, 190], [110, 196], [62, 168]], [15, 12, 10]);
  const fistBack = circle(54, 164, 13);
  const belt = rrect(170, 254, 60, 15, 4);
  const legKnee = bent([[184, 268], [140, 300], [150, 350]], [19, 15, 12]);
  const shin = roundPoly([[130, 340], [214, 344], [222, 362], [124, 362]], 6);
  const legUp = bent([[220, 270], [292, 288], [296, 336]], [19, 15, 12]);
  const boot = roundPoly([[278, 318], [314, 318], [316, 346], [338, 350], [340, 364], [272, 364], [276, 344]], 6);
  const cape = blob([[160, 176], [130, 150], [80, 120], [30, 110], [56, 136], [24, 162], [70, 168], [110, 190], [150, 210], [236, 196], [244, 176]], 0.9);
  const layers = stack([fistDown, armDown, ...headL, fistBack, armBack, belt, torso, neck, boot, legUp, shin, legKnee, cape]);
  const front = [fistDown, armDown, boot, shin].map((l) => region(l));
  const cracks = 'M 242 364 L 222 382 L 200 386 M 242 364 L 262 384 L 290 390 M 242 364 L 250 392 M 160 364 L 140 380 L 110 384 M 300 364 L 330 380 L 370 382';
  const rocks = [rotate(rrect(60, 340, 16, 12, 3), 20, 68, 346), rotate(rrect(350, 330, 14, 12, 3), -30, 357, 336), rotate(rrect(96, 300, 10, 9, 2), 40, 101, 304), rotate(rrect(330, 280, 10, 10, 2), 15, 335, 285)];
  return tpl(
    'starbright-landing',
    'Starbright hero landing',
    'advanced',
    ['starbright', 'landing', 'pose', 'cape', 'mask', 'figure', 'comic', 'action'],
    [...layers, ...h.marks.map((d) => place(d, 1.1, -20, 74)), softStar(200, 212, 18, 8, 5, 2), ...rocks],
    [
      ...h.detail.map((d) => place(d, 1.1, -20, 74)),
      line(20, 364, 380, 364),
      cracks,
      clip('M 70 130 Q 110 150 150 170 M 60 154 Q 100 170 130 186', [region(cape)], 'inside'),
      'M 196 254 L 196 269 M 204 254 L 204 269',
      'M 286 340 L 306 340',
      clip('M 20 300 Q 40 280 70 290 M 330 300 Q 360 280 386 296 M 30 330 Q 60 316 90 330', front),
      sparkle(350, 60, 12),
      sparkle(40, 60, 10),
      sparkle(370, 200, 8),
      softStar(60, 250, 8, 3.5, 5, 1),
      softStar(340, 240, 7, 3, 5, 1),
    ],
  );
}

// ---- 12. hero team lineup (advanced) ---------------------------------------------------------------

function lineup(): Template {
  const who: [Who, 'hips' | 'fist', number][] = [['starbright', 'hips', 148], ['tidewave', 'fist', 238], ['volt', 'fist', 58], ['acorn', 'hips', 322]];
  const s = 0.46;
  const dy = 138;
  const layers: Layer[] = [];
  const marks: string[] = [];
  const detail: string[] = [];
  const g = gearbitParts();
  const gs = 0.3;
  const gx = 200 - 200 * gs;
  const gy = 290;
  layers.push(...g.layers.map((l) => placeL(l, gs, gx, gy)));
  marks.push(...g.marks.map((d) => place(d, gs, gx, gy)));
  for (const [w, pose, cx] of who) {
    const fig = standing(w, pose);
    const dx = cx - 200 * s;
    layers.push(...fig.layers.map((l) => placeL(l, s, dx, dy)));
    marks.push(...fig.marks.map((d) => place(d, s, dx, dy)));
    detail.push(...fig.detail.map((d) => place(d, s, dx, dy)));
  }
  const banner = 'M 60 40 L 340 40 L 324 62 L 340 84 L 60 84 L 76 62 Z';
  const gReg = g.layers.slice(-4).map((l) => region(placeL(l, gs, gx, gy)));
  return {
    ...tpl(
      'team-lineup',
      'Hero team lineup',
      'advanced',
      ['team', 'group', 'starbright', 'volt', 'tidewave', 'acorn', 'gearbit', 'cape', 'mask', 'comic'],
      [...stack(layers), ...marks, banner, softStar(200, 62, 14, 6, 5, 1.5), softStar(140, 62, 9, 4, 5, 1), softStar(260, 62, 9, 4, 5, 1)],
      [...detail, clip(line(10, 314, 390, 314), gReg), sparkle(30, 120, 8), sparkle(372, 110, 8)],
    ),
    detailWidth: 1.6,
  };
}

// ---- 13. comic page (advanced) ---------------------------------------------------------------------

function comicPage(): Template {
  const panels = [rrect(16, 16, 176, 176, 6), rrect(208, 16, 176, 176, 6), rrect(16, 208, 176, 176, 6), rrect(208, 208, 176, 176, 6)];
  // panel 1: Volt Fox head close-up
  const vh = headOf('volt');
  const p1 = stack(vh.layers.map((l) => placeL(l, 1.5, 104 - 300, 120 - 99))).map((d) => clip(d, [region(panels[0])], 'inside'));
  const p1m = vh.marks.map((d) => place(d, 1.5, 104 - 300, 120 - 99));
  const shouldersV = clip(curve([[30, 192], [52, 168], [104, 158], [156, 168], [178, 192]]), [region(panels[0])], 'inside');
  // panel 2: action burst with a bolt
  const burst: P[] = [];
  for (let i = 0; i < 24; i++) burst.push(polar(296, 104, i % 2 === 0 ? 76 : 50, i * 15));
  const p2 = [poly(burst), bolt(290, 56, 96)];
  // panel 3: Gearbit waving
  const g = gearbitParts();
  const p3 = stack(g.layers.map((l) => placeL(l, 0.52, 104 - 104, 196)));
  const p3m = g.marks.map((d) => place(d, 0.52, 0, 196));
  const bubble = 'M 116 226 L 176 226 Q 184 226 184 234 L 184 258 Q 184 266 176 266 L 140 266 L 128 280 L 130 266 L 116 266 Q 108 266 108 258 L 108 234 Q 108 226 116 226 Z';
  // panel 4: Starbright flying over a city line
  const fl = starbrightFlyer();
  const r = (d: string) => place(rotate(d, -20, 200, 200), 0.5, 196, 196);
  const p4 = stack(fl.layers.map((l) => (typeof l === 'string' ? r(l) : l.map(r))));
  const city = 'M 208 384 L 208 330 L 236 330 L 236 312 L 262 312 L 262 344 L 290 344 L 290 300 L 318 300 L 318 336 L 346 336 L 346 318 L 384 318 L 384 384';
  return {
    ...tpl(
      'comic-page',
      'Hero team comic page',
      'advanced',
      ['comic', 'panels', 'story', 'volt', 'starbright', 'gearbit', 'action'],
      [...panels, ...p1, ...p1m, shouldersV, ...p2, ...p3, ...p3m, bubble, ...p4, ...fl.marks.map(r), clip(city, p4.length ? [region(p4.join(' '))] : [])],
      [
        ...vh.detail.map((d) => place(d, 1.5, 104 - 300, 120 - 99)).map((d) => clip(d, [region(panels[0])], 'inside')),
        ...g.detail.map((d) => place(d, 0.52, 0, 196)),
        dot(130, 246, 3) + ' ' + dot(146, 246, 3) + ' ' + dot(162, 246, 3),
        'M 226 40 L 246 52 M 366 40 L 346 52 M 226 168 L 246 156 M 366 168 L 346 156',
        'M 216 346 L 228 346 M 244 322 L 254 322 M 270 356 L 282 356 M 298 316 L 310 316 M 326 348 L 338 348 M 356 332 L 372 332',
        sparkle(250, 240, 7),
        sparkle(360, 250, 6),
        sparkle(60, 300, 7),
      ],
    ),
    detailWidth: 1.6,
  };
}

export const heroes2: Template[] = [
  capeKid(),
  emblemSheet(),
  gearbit(),
  pipHero(),
  acornShield(),
  starbrightFlying(),
  voltFox(),
  tidewavePortrait(),
  ironAcorn(),
  rescueNinja(),
  landing(),
  lineup(),
  comicPage(),
];

