// Fairy tales (fb-1022): original line art of classic public-domain fairy-tale motifs drawn our own way —
// princesses, a knight, castles, carriages, a mermaid, unicorns, a fairy, a crown, a wand, a frog prince, a tower
// with a long braid and a glass slipper. Every piece is our own generic design: no studio character, costume,
// castle logo or silhouette is drawn or evoked (see docs/TEMPLATES.md). Overlaps use occlude.ts.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, leaf, line, mapPath, petal, poly, polar, rotate, rrect, mirrorX, type P } from './draw.ts';
import { clip, region, roundPoly, stack, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

function tpl(
  id: string,
  name: string,
  level: TemplateLevel,
  tags: string[],
  paths: string[],
  detail: string[] = [],
): Template {
  const d = detail.filter(Boolean);
  return {
    id: `fairy-${id}`,
    name,
    category: 'fairytales',
    level,
    tags: ['fairytale', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(d.length ? { detail: d } : {}),
  };
}

// ---- shared kit -----------------------------------------------------------------------------

/** Smooth curve through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: readonly P[], closed = true, k = 1 / 6): string {
  const n = pts.length;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: P = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: P = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** Closed tapered ribbon (a lock of hair, a braid strand, a tail) around a centre line; widths are half-widths. */
function strand(center: readonly P[], w0: number, w1: number, tipRound = false): string {
  const n = center.length;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const t = i / (n - 1);
    const w = w0 + (w1 - w0) * t;
    left.push([center[i][0] + nx * w, center[i][1] + ny * w]);
    right.push([center[i][0] - nx * w, center[i][1] - ny * w]);
  }
  const pts: P[] = [...left];
  if (w1 < 0.5 && !tipRound) pts[pts.length - 1] = center[n - 1];
  else pts.push(center[n - 1]);
  const back = right.reverse();
  if (w1 < 0.5 && !tipRound) back.shift();
  return smooth([...pts, ...back.slice(0, -1), ...(w0 < 0.5 ? [] : [right[right.length - 1]])]);
}

/** Little four-point sparkle. */
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

/** Heart centred on (cx, cy), s = overall width. */
function heart(cx: number, cy: number, s: number): string {
  const p = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${p(0, -0.22)} C ${p(-0.1, -0.55)} ${p(-0.5, -0.55)} ${p(-0.5, -0.15)} C ${p(-0.5, 0.15)} ${p(-0.2, 0.35)} ${p(0, 0.55)} ` +
    `C ${p(0.2, 0.35)} ${p(0.5, 0.15)} ${p(0.5, -0.15)} C ${p(0.5, -0.55)} ${p(0.1, -0.55)} ${p(0, -0.22)} Z`
  );
}

const dot = (x: number, y: number, r = 3): string => circle(x, y, r);
const smile = (x: number, y: number, w: number, h = w * 0.6): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + h)} ${f(x + w)} ${f(y)}`;
/** Closed eye with lashes (∪ with three short lashes). */
function lashEye(x: number, y: number, w: number, flip = false): string {
  const s = flip ? -1 : 1;
  return (
    `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * 0.8)} ${f(x + w)} ${f(y)} ` +
    `${line(x + s * w * 0.95, y + w * 0.05, x + s * w * 1.35, y - w * 0.3)} ${line(x + s * w * 0.55, y + w * 0.35, x + s * w * 0.8, y + w * 0.05 - w * 0.2)}`
  );
}
/** Big storybook eye: oval with a pupil highlight. */
const bigEye = (x: number, y: number, rx: number, ry: number): string =>
  `${ellipse(x, y, rx, ry)} ${circle(x + rx * 0.3, y - ry * 0.35, rx * 0.35)}`;

/** Clip `d` to the inside of `within`, then hide what lies behind `front`. */
function inside(d: string, within: Layer, front: readonly Layer[] = []): string {
  const kept = clip(d, [region(within)], 'inside');
  return front.length && kept ? clip(kept, front.map(region)) : kept;
}
const hide = (d: string, front: readonly Layer[]): string => clip(d, front.map(region));

/** Crenellated top edge from x0 to x1 at height y (merlons h tall, n merlons). */
function crenels(x0: number, x1: number, y: number, h: number, n: number): P[] {
  const pts: P[] = [];
  const w = (x1 - x0) / (2 * n - 1);
  for (let i = 0; i < n; i++) {
    const a = x0 + 2 * i * w;
    pts.push([a, y - h], [a + w, y - h]);
    if (i < n - 1) pts.push([a + w, y], [a + 2 * w, y]);
  }
  return pts;
}

/** Arched window (closed): bottom-left (x, y), width w, height h. */
function archWin(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M ${f(x)} ${f(y)} L ${f(x)} ${f(y - h + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y - h + r)} L ${f(x + w)} ${f(y)} Z`;
}

/** Pennant flag on a pole whose foot is (x, y). */
function flag(x: number, y: number, h: number, dir = 1): string {
  const top = y - h;
  return (
    `${line(x, y, x, top)} M ${f(x)} ${f(top)} C ${f(x + dir * h * 0.4)} ${f(top - 4)} ${f(x + dir * h * 0.6)} ${f(top + 8)} ` +
    `${f(x + dir * h * 0.95)} ${f(top + 6)} C ${f(x + dir * h * 0.6)} ${f(top + 12)} ${f(x + dir * h * 0.4)} ${f(top + 18)} ${f(x)} ${f(top + h * 0.45)}`
  );
}

/** Wheel with hub and spokes. */
function wheel(cx: number, cy: number, r: number, spokes: number): { rim: string; inner: string[] } {
  const inner: string[] = [circle(cx, cy, r * 0.82), circle(cx, cy, r * 0.18)];
  let s = '';
  for (let i = 0; i < spokes; i++) {
    const a = polar(cx, cy, r * 0.18, (360 * i) / spokes);
    const b = polar(cx, cy, r * 0.82, (360 * i) / spokes);
    s += ` M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}`;
  }
  inner.push(s.trim());
  return { rim: circle(cx, cy, r), inner };
}

/** Scalloped edge points from (x0, y) to (x1, y) with n bumps of depth h (downwards). */
function scallops(x0: number, x1: number, y: number, n: number, h: number): string {
  const w = (x1 - x0) / n;
  let d = `M ${f(x0)} ${f(y)}`;
  for (let i = 0; i < n; i++) d += ` Q ${f(x0 + w * (i + 0.5))} ${f(y + h * 2)} ${f(x0 + w * (i + 1))} ${f(y)}`;
  return d;
}

/** Little five-petal flower. */
function blossom(x: number, y: number, r: number): string {
  let d = '';
  for (let i = 0; i < 5; i++) d += ` ${petal(x, y, i * 72, r, r * 0.42, 0.6)}`;
  return `${d.trim()} ${circle(x, y, r * 0.25)}`;
}

/** Rose seen from above: a few spiralling arcs inside a round outline. */
function rose(x: number, y: number, r: number): { outer: string; inner: string } {
  const outer = smooth(Array.from({ length: 7 }, (_, i) => polar(x, y, r * (i % 2 ? 0.92 : 1), i * (360 / 7))));
  const inner =
    `M ${f(x - r * 0.15)} ${f(y - r * 0.05)} A ${f(r * 0.2)} ${f(r * 0.2)} 0 1 1 ${f(x + r * 0.2)} ${f(y + r * 0.1)} ` +
    `A ${f(r * 0.42)} ${f(r * 0.42)} 0 0 1 ${f(x - r * 0.4)} ${f(y + r * 0.15)} ` +
    `A ${f(r * 0.62)} ${f(r * 0.62)} 0 0 1 ${f(x + r * 0.15)} ${f(y - r * 0.62)} ` +
    `M ${f(x + r * 0.55)} ${f(y - r * 0.3)} A ${f(r * 0.7)} ${f(r * 0.7)} 0 0 1 ${f(x + r * 0.1)} ${f(y + r * 0.72)}`;
  return { outer, inner };
}

// ---- 1. crown (beginner) --------------------------------------------------------------------

function crownT(): Template {
  const body = roundPoly(
    [[104, 252], [74, 150], [124, 206], [140, 116], [174, 192], [200, 88], [226, 192], [260, 116], [276, 206], [326, 150], [296, 252]],
    7,
  );
  const band = rrect(90, 240, 220, 58, 16);
  const tips: P[] = [[74, 140], [140, 106], [200, 78], [260, 106], [326, 140]];
  const balls = tips.map(([x, y]) => circle(x, y, 13));
  const gems = [ellipse(200, 269, 16, 20), circle(140, 269, 11), circle(260, 269, 11)];
  const bodyGems = [
    poly([[200, 150], [216, 176], [200, 202], [184, 176]]),
    `M 140 176 C 150 190 150 204 140 210 C 130 204 130 190 140 176 Z`,
    `M 260 176 C 270 190 270 204 260 210 C 250 204 250 190 260 176 Z`,
  ];
  let beads = '';
  for (const x of [108, 118, 162, 172, 228, 238, 282, 292]) beads += ` ${circle(x, 269, 2.6)}`;
  return tpl(
    'crown',
    'Royal crown with jewels',
    'beginner',
    ['crown', 'royal', 'king', 'queen', 'princess', 'jewels', 'kids', 'gift'],
    [...stack([band, ...balls, body]), ...gems, ...bodyGems],
    [
      beads.trim(),
      line(100, 250, 300, 250),
      line(100, 288, 300, 288),
      sparkle(56, 92, 16),
      sparkle(344, 84, 12),
      sparkle(330, 330, 14),
      sparkle(70, 330, 10),
      'M 196 164 L 204 164',
      'M 120 340 Q 200 352 280 340',
    ],
  );
}

// ---- 2. magic wand (beginner) ---------------------------------------------------------------

function wandT(): Template {
  const starC: P = [135, 135];
  const star = softStar(starC[0], starC[1], 80, 36, 5, 9, -14);
  const a: P = [172, 178];
  const b: P = [326, 350];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const w = 9;
  const stick = roundPoly(
    [[a[0] - uy * w, a[1] + ux * w], [b[0] - uy * w, b[1] + ux * w], [b[0] + uy * w, b[1] - ux * w], [a[0] + uy * w, a[1] - ux * w]],
    6,
  );
  const gripAt = (t: number): P => [a[0] + ux * len * t, a[1] + uy * len * t];
  const g0 = gripAt(0.66);
  const g1 = gripAt(0.72);
  const gw = w + 3;
  const grip = poly([[g0[0] - uy * gw, g0[1] + ux * gw], [g1[0] - uy * gw, g1[1] + ux * gw], [g1[0] + uy * gw, g1[1] - ux * gw], [g0[0] + uy * gw, g0[1] - ux * gw]]);
  const knotC: P = [190, 198];
  const knot = circle(knotC[0], knotC[1], 9);
  const loopL = petal(knotC[0], knotC[1], 290, 48, 15, 0.65);
  const loopR = petal(knotC[0], knotC[1], 160, 48, 15, 0.65);
  return tpl(
    'magic-wand',
    'Magic wand with stars',
    'beginner',
    ['wand', 'magic', 'star', 'fairy', 'sparkle', 'kids', 'whimsical'],
    [
      ...stack([knot, loopL, loopR, grip, star, stick]),
      sparkle(286, 92, 24),
      sparkle(330, 190, 15),
      sparkle(60, 270, 18),
      softStar(240, 40, 14, 6, 5, 2),
      softStar(96, 340, 12, 5, 5, 2),
    ],
    [
      softStar(starC[0], starC[1], 46, 21, 5, 5, -14),
      'M 230 70 Q 270 120 262 160',
      circle(300, 250, 3),
      circle(250, 300, 2.5),
      circle(46, 190, 3),
      circle(200, 60, 2.5),
      circle(360, 130, 2.5),
    ],
  );
}

// ---- 3. glass slipper (beginner) ------------------------------------------------------------

function slipperT(): Template {
  const shell =
    'M 56 296 C 54 268 92 250 136 246 C 168 243 188 256 214 254 C 250 250 278 222 302 194 ' +
    'C 316 206 322 232 318 262 C 316 268 308 271 298 272 C 262 276 232 292 202 306 C 170 320 118 322 80 316 C 64 314 56 306 56 296 Z';
  const heel = 'M 282 272 C 294 284 296 306 292 340 L 306 340 C 306 304 312 282 318 260 Z';
  const knot = ellipse(140, 252, 9, 8);
  const bowL = petal(140, 252, 285, 36, 13, 0.7);
  const bowR = petal(140, 252, 75, 36, 13, 0.7);
  return tpl(
    'glass-slipper',
    'Glass slipper with a bow',
    'beginner',
    ['slipper', 'shoe', 'glass', 'ball', 'princess', 'sparkle', 'kids'],
    [
      ...stack([knot, bowL, bowR, shell, heel]),
      'M 160 254 C 200 268 262 244 300 204',
      sparkle(300, 120, 22),
      sparkle(350, 180, 13),
      sparkle(90, 200, 15),
    ],
    [
      'M 74 304 C 120 312 170 306 206 292 C 236 280 262 266 296 262',
      'M 96 270 L 112 288 M 180 276 L 196 290 M 240 260 L 252 276',
      'M 60 350 Q 180 362 330 350',
      circle(240, 110, 3),
      circle(130, 170, 2.5),
    ],
  );
}

// ---- 4. little castle (beginner) ------------------------------------------------------------

function castleSimpleT(): Template {
  const hill = 'M 14 336 C 90 318 150 328 200 326 C 260 324 320 316 386 336 L 386 380 L 14 380 Z';
  const hillTop = 'M 14 336 C 90 318 150 328 200 326 C 260 324 320 316 386 336';
  const cTower = poly([[164, 128], [236, 128], [236, 345], [164, 345]]);
  const cRoof = roundPoly([[150, 132], [200, 40], [250, 132]], 5);
  const lTower = poly([[80, 178], [130, 178], [130, 345], [80, 345]]);
  const lRoof = roundPoly([[68, 182], [105, 100], [142, 182]], 5);
  const rTower = mirrorX(lTower, 200);
  const rRoof = mirrorX(lRoof, 200);
  const wall = poly([[124, 345], ...crenels(124, 276, 222, 14, 5), [276, 345]]);
  const door = 'M 176 345 L 176 296 A 24 24 0 0 1 224 296 L 224 345 Z';
  const layers = stack([hill, door, cRoof, lRoof, rRoof, cTower, lTower, rTower, wall]);
  layers[0] = hillTop;
  return tpl(
    'castle-simple',
    'Little fairy-tale castle',
    'beginner',
    ['castle', 'tower', 'kingdom', 'princess', 'flag', 'kids', 'building'],
    [
      ...layers,
      archWin(188, 190, 24, 36),
      archWin(95, 240, 20, 30),
      archWin(285, 240, 20, 30),
      flag(200, 40, 34),
      flag(105, 100, 26),
      flag(295, 100, 26),
    ],
    [
      line(200, 296, 200, 330),
      line(188, 160, 212, 160),
      'M 30 360 Q 40 350 50 360 M 340 362 Q 350 352 360 362',
      sparkle(56, 70, 12),
      sparkle(350, 60, 10),
      'M 260 40 Q 270 34 280 40 Q 290 34 300 40',
    ],
  );
}

// ---- 5. cute unicorn (beginner) -------------------------------------------------------------

function unicornCuteT(): Template {
  const head = ellipse(242, 150, 68, 58);
  const snout = ellipse(292, 180, 42, 32);
  const ear = petal(212, 104, -18, 42, 12, 0.5);
  const horn = 'M 230 100 C 240 76 254 48 270 24 C 272 50 270 78 262 104 Z';
  const mane = [circle(190, 100, 28), circle(166, 136, 27), circle(162, 176, 24), circle(232, 92, 22)];
  const body = ellipse(178, 258, 88, 52);
  const neck = rotate(ellipse(226, 214, 30, 40), -25, 226, 214);
  const legs = [rrect(104, 282, 28, 62, 13), rrect(144, 290, 28, 54, 13), rrect(200, 290, 28, 54, 13), rrect(238, 282, 28, 62, 13)];
  const tail =
    'M 98 246 C 66 214 30 226 34 258 C 36 276 54 280 46 298 C 70 304 98 290 104 268 Z';
  const layers = stack([horn, ear, [head, snout], ...mane, [body, neck], ...legs, tail]);
  return tpl(
    'unicorn-cute',
    'Cute baby unicorn',
    'beginner',
    ['unicorn', 'horse', 'foal', 'magic', 'cute', 'kids', 'rainbow'],
    [
      ...layers,
      bigEye(248, 148, 10, 13),
      ellipse(316, 172, 3.5, 4.5),
      smile(300, 194, 12, 7),
      sparkle(340, 70, 16),
      sparkle(60, 120, 12),
      softStar(330, 290, 14, 6, 5, 2),
    ],
    [
      'M 244 62 Q 258 66 268 58 M 240 78 Q 254 84 266 76',
      ellipse(270, 180, 9, 5.5),
      'M 104 330 L 132 330 M 144 330 L 172 330 M 200 330 L 228 330 M 238 330 L 266 330',
      'M 60 248 Q 74 250 84 260 M 52 270 Q 70 272 86 280',
      'M 20 352 Q 200 362 380 352',
    ],
  );
}

// ---- 6. little princess (beginner) ----------------------------------------------------------

function littlePrincessT(): Template {
  const face = circle(200, 150, 56);
  const hairBack = [ellipse(200, 156, 76, 80), circle(132, 222, 22), circle(268, 222, 22)];
  const bangs =
    'M 144 152 C 138 104 168 88 200 88 C 232 88 262 104 256 152 C 240 128 214 120 200 104 C 186 120 160 128 144 152 Z';
  const crown = roundPoly([[172, 96], [168, 58], [186, 78], [200, 50], [214, 78], [232, 58], [228, 96]], 4);
  const sleeveL = circle(170, 220, 15);
  const sleeveR = circle(230, 220, 15);
  const bodice = roundPoly([[178, 206], [222, 206], [214, 256], [186, 256]], 5);
  const armL = strand([[166, 230], [154, 252], [152, 268]], 7, 6, true);
  const armR = strand([[234, 230], [246, 252], [248, 268]], 7, 6, true);
  const handL = circle(152, 272, 9);
  const handR = circle(248, 272, 9);
  const hemY = 345;
  const skirt = `M 188 250 C 160 280 124 318 106 ${hemY} ${scallops(106, 294, hemY, 8, 7).replace(/^M [\d.]+ [\d.]+/, '')} C 276 318 240 280 212 250 Z`;
  const layers = stack([crown, bangs, face, handL, handR, armL, armR, sleeveL, sleeveR, bodice, skirt, hairBack]);
  return tpl(
    'little-princess',
    'Little princess with a crown',
    'beginner',
    ['princess', 'girl', 'crown', 'dress', 'cute', 'kids', 'royal'],
    [...layers, bigEye(178, 160, 9, 11), bigEye(222, 160, 9, 11), smile(200, 182, 9, 6), sparkle(70, 90, 14), sparkle(330, 80, 11)],
    [
      ellipse(162, 178, 8, 5),
      ellipse(238, 178, 8, 5),
      circle(200, 80, 4),
      heart(200, 228, 14),
      'M 150 312 Q 200 326 250 312',
      softStar(70, 300, 10, 4, 5, 1.5),
      softStar(330, 290, 12, 5, 5, 1.5),
      'M 120 362 Q 200 370 280 362',
    ],
  );
}

// ---- 7. frog prince (intermediate) ----------------------------------------------------------

function frogPrinceT(): Template {
  const head = ellipse(200, 172, 96, 58);
  const eyeL = circle(146, 120, 32);
  const eyeR = circle(254, 120, 32);
  const crown = roundPoly([[176, 116], [170, 74], [188, 94], [200, 66], [212, 94], [230, 74], [224, 116]], 4);
  const body = ellipse(200, 262, 80, 68);
  const hauchL = ellipse(128, 296, 46, 36);
  const hauchR = ellipse(272, 296, 46, 36);
  const handL = smooth([[156, 300], [170, 318], [174, 336], [162, 344], [150, 340], [138, 346], [124, 342], [126, 330], [140, 318]]);
  const handR = mirrorX(handL, 200);
  const footL = 'M 100 316 C 80 330 60 336 46 338 C 60 348 100 350 120 340 Z';
  const footR = mirrorX(footL, 200);
  const pad = 'M 200 328 L 236 314 C 330 312 384 328 384 344 C 384 362 300 372 200 372 C 100 372 16 362 16 344 C 16 326 90 312 200 314 Z';
  const layers = stack([crown, eyeL, eyeR, head, handL, handR, body, hauchL, hauchR, footL, footR, pad]);
  const belly = inside(ellipse(200, 278, 50, 46), body, [head, handL, handR]);
  const spots = [circle(124, 160, 6), circle(276, 160, 6), circle(112, 288, 6), circle(288, 290, 6), circle(140, 306, 4), circle(260, 306, 4)];
  return tpl(
    'frog-prince',
    'Frog prince with a crown',
    'intermediate',
    ['frog', 'prince', 'crown', 'pond', 'lily-pad', 'animal', 'kids', 'whimsical'],
    [
      ...layers,
      circle(146, 122, 14),
      circle(254, 122, 14),
      'M 140 184 C 170 212 230 212 260 184',
      belly,
    ],
    [
      circle(150, 116, 4.5),
      circle(258, 116, 4.5),
      ellipse(132, 186, 9, 5.5),
      ellipse(268, 186, 9, 5.5),
      circle(190, 160, 2.5),
      circle(210, 160, 2.5),
      ...spots,
      'M 124 332 L 132 340 M 140 334 L 146 342 M 260 334 L 254 342 M 276 332 L 268 340',
      circle(200, 102, 4),
      'M 180 108 L 220 108',
      hide('M 216 318 L 300 330 M 236 314 L 340 326', [hauchR, footR, body]),
      'M 60 380 Q 80 372 100 380 M 300 384 Q 320 376 340 384',
      blossom(340, 80, 18),
      sparkle(60, 70, 12),
      inside('M 168 252 Q 200 262 232 252 M 172 276 Q 200 286 228 276 M 176 300 Q 200 308 224 300', ellipse(200, 278, 50, 46), [head, handL, handR]),
    ],
  );
}

// ---- 8. pumpkin carriage (intermediate) -----------------------------------------------------

function pumpkinCarriageT(): Template {
  const lobes = [ellipse(200, 186, 72, 100), ellipse(144, 192, 74, 88), ellipse(256, 192, 74, 88), ellipse(104, 200, 50, 70), ellipse(296, 200, 50, 70)];
  const win = 'M 168 220 L 168 172 C 168 142 232 142 232 172 L 232 220 Z';
  const stem = 'M 192 92 C 190 72 196 56 214 46 L 222 56 C 208 64 206 76 208 92 Z';
  const leaf = petal(212, 92, 60, 62, 18, 0.45);
  const wl = wheel(118, 300, 52, 10);
  const wr = wheel(290, 304, 46, 10);
  const layers = stack([wl.rim, wr.rim, win, stem, leaf, lobes]);
  const behind = [wl.rim, wr.rim, win];
  const ribs = [
    'M 200 88 C 172 120 170 250 200 286',
    'M 200 88 C 228 120 230 250 200 286',
    'M 150 106 C 110 140 112 250 146 280',
    'M 250 106 C 290 140 288 250 254 280',
  ];
  return tpl(
    'pumpkin-carriage',
    'Pumpkin carriage',
    'intermediate',
    ['pumpkin', 'carriage', 'coach', 'ball', 'princess', 'wheels', 'kids', 'whimsical'],
    [
      ...layers,
      ...wl.inner,
      ...wr.inner,
      line(200, 152, 200, 220),
      line(168, 188, 232, 188),
    ],
    [
      ...ribs.map((d) => hide(d, behind)),
      inside(petal(212, 92, 60, 62, 0.1, 0.5), leaf),
      'M 222 52 C 240 40 252 52 244 62 C 238 68 230 62 236 56',
      hide(line(118, 300, 290, 304), [wl.rim, wr.rim]),
      'M 330 150 C 352 138 362 160 350 168 C 342 172 336 164 342 160',
      'M 70 150 C 48 138 38 160 50 168 C 58 172 64 164 58 160',
      sparkle(60, 80, 15),
      sparkle(350, 90, 12),
      sparkle(46, 220, 9),
      'M 20 358 L 380 358',
    ],
  );
}


// ---- 9. tower with a long braid (intermediate) ----------------------------------------------

/** Braid: a chain of tilted ovals along a cubic curve, lower links drawn in front. */
function braid(p0: P, p1: P, p2: P, p3: P, n: number, w0: number, w1: number): string[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  const links: string[] = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay);
    const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI + (i % 2 ? 30 : -30);
    const w = w0 + ((w1 - w0) * i) / (n - 1);
    links.push(rotate(ellipse(cx, cy, len * 0.92, w), ang, cx, cy));
  }
  return links.reverse();
}

function towerBraidT(): Template {
  const tower = poly([[150, 150], [250, 150], [260, 372], [140, 372]]);
  const band = rrect(134, 132, 132, 26, 8);
  const roof = 'M 126 140 C 160 112 186 72 200 24 C 214 72 240 112 274 140 Z';
  const win = archWin(176, 226, 48, 58);
  const sill = rrect(168, 224, 64, 10, 4);
  const links = braid([200, 232], [206, 290], [238, 330], [300, 352], 14, 13, 8);
  const end: P = [300, 352];
  const bow = [rotate(ellipse(end[0] + 4, end[1] + 2, 5, 10), -20, end[0] + 4, end[1] + 2)];
  const tuft = [petal(end[0] + 6, end[1] + 3, 70, 36, 8, 0.4), petal(end[0] + 6, end[1] + 3, 95, 34, 8, 0.4), petal(end[0] + 6, end[1] + 3, 120, 28, 7, 0.4)];
  const hill = 'M 10 366 C 90 346 170 352 220 356 C 290 360 340 352 390 366 L 390 396 L 10 396 Z';
  const hillTop = 'M 10 366 C 90 346 170 352 220 356 C 290 360 340 352 390 366';
  const front: Layer[] = [...bow, ...tuft, ...links, sill, hill, win, band, roof];
  const layers = stack([...front, tower]);
  layers[bow.length + tuft.length + links.length + 1] = hillTop;
  // stones on the tower
  let bricks = '';
  for (let r = 0; r < 12; r++) {
    const y = 172 + r * 16;
    bricks += ` M 130 ${y} L 270 ${y}`;
    for (let x = 150 + (r % 2) * 14; x < 260; x += 28) bricks += ` M ${x} ${y} L ${x} ${y + 16}`;
  }
  let shingles = '';
  for (let r = 0; r < 5; r++) {
    const y = 60 + r * 17;
    for (let x = 140 + (r % 2) * 10; x < 270; x += 20) shingles += ` M ${x} ${y} Q ${x + 10} ${y + 12} ${x + 20} ${y}`;
  }
  const ivy = 'M 146 372 C 160 330 140 300 158 270 C 170 250 158 230 166 210';
  const ivyLeaves = [petal(152, 340, -60, 18, 6), petal(150, 312, 50, 18, 6), petal(156, 282, -50, 16, 5), petal(162, 256, 50, 16, 5), petal(162, 232, -50, 14, 5)];
  return tpl(
    'tower-braid',
    'Tower with a long braid',
    'intermediate',
    ['tower', 'braid', 'hair', 'princess', 'castle', 'stone', 'kids', 'storybook'],
    [...layers, flag(200, 24, 22), line(200, 168, 200, 224), hide(ivy, front), ...ivyLeaves.map((l) => hide(l, front))],
    [
      inside(bricks, tower, front),
      inside(shingles, roof, [band]),
      'M 140 158 Q 146 166 152 158 M 168 158 Q 174 166 180 158 M 220 158 Q 226 166 232 158 M 248 158 Q 254 166 260 158',
      blossom(60, 340, 10),
      blossom(90, 352, 8),
      blossom(352, 346, 9),
      'M 310 70 Q 318 62 326 70 Q 334 62 342 70 M 340 100 Q 346 94 352 100 Q 358 94 364 100',
      sparkle(70, 90, 12),
      sparkle(90, 200, 9),
    ],
  );
}

// ---- 10. mermaid on a rock (intermediate) ---------------------------------------------------

function mermaidT(): Template {
  const head = ellipse(198, 104, 27, 32);
  const torso = smooth([[190, 132], [206, 132], [210, 146], [230, 154], [234, 166], [224, 184], [218, 204], [220, 222], [226, 240], [200, 248], [172, 242], [176, 222], [178, 204], [172, 184], [162, 166], [168, 154], [186, 146]]);
  const armL = strand([[168, 160], [154, 196], [150, 236]], 9, 6, true);
  const armR = strand([[228, 160], [244, 196], [236, 234]], 9, 6, true);
  const handL = ellipse(150, 244, 9, 7);
  const handR = ellipse(232, 240, 8, 7);
  const tail = strand([[198, 236], [236, 266], [280, 278], [314, 266], [334, 240]], 30, 6);
  const finA = petal(334, 240, 20, 58, 16, 0.65);
  const finB = petal(334, 240, 80, 52, 15, 0.65);
  const capHair = 'M 170 108 C 166 70 190 64 202 66 C 222 68 232 84 226 108 C 220 92 208 84 196 86 C 186 90 176 98 170 108 Z';
  const lock1 = strand([[180, 76], [152, 116], [154, 168], [124, 206], [104, 246]], 22, 1);
  const lock2 = strand([[190, 84], [168, 136], [176, 182], [150, 220], [138, 256]], 16, 1);
  const lock3 = strand([[220, 86], [234, 120], [228, 150], [246, 184]], 12, 1);
  const rock = smooth([[64, 372], [70, 320], [100, 270], [150, 252], [214, 262], [280, 284], [336, 296], [366, 330], [372, 372]]);
  const sea = 'M 8 352 L 392 352 L 392 398 L 8 398 Z';
  const waves = `M 8 352 ${Array.from({ length: 12 }, (_, i) => `Q ${f(8 + 32 * i + 16)} 340 ${f(8 + 32 * (i + 1))} 352`).join(' ')}`;
  const front: Layer[] = [sea, capHair, head, handL, handR, armL, armR, torso, finA, finB, tail, lock3, lock1, lock2, rock];
  const layers = stack(front);
  layers[0] = waves;
  let scales = '';
  for (let r = 0; r < 6; r++) {
    for (let k = 0; k < 9; k++) {
      const x = 200 + k * 16 + (r % 2) * 8;
      const y = 238 + r * 10 - k * 1.5;
      scales += ` M ${f(x)} ${f(y)} Q ${f(x + 8)} ${f(y + 9)} ${f(x + 16)} ${f(y)}`;
    }
  }
  const bandeau = 'M 172 172 Q 198 162 228 172 M 174 190 Q 200 198 224 188';
  return tpl(
    'mermaid-rock',
    'Mermaid on a rock',
    'intermediate',
    ['mermaid', 'sea', 'ocean', 'tail', 'rock', 'waves', 'kids', 'storybook'],
    [
      ...layers,
      inside(bandeau, torso, [armL, armR, handL, handR]),
      lashEye(188, 106, 6),
      lashEye(210, 106, 6),
      smile(199, 120, 5, 4),
      softStar(184, 78, 9, 4, 5, 1.5),
    ],
    [
      inside(scales.trim(), tail, [handR]),
      inside(petal(334, 240, 20, 50, 1, 0.5) + ' ' + petal(334, 240, 80, 46, 1, 0.5), [finA, finB], []),
      inside('M 152 128 C 146 150 152 170 140 190 M 172 120 C 160 150 168 180 150 210', [lock1, lock2], [capHair, head, armL, handL, torso]),
      'M 206 132 Q 199 140 192 132',
      softStar(110, 320, 16, 7, 5, 3),
      'M 290 320 Q 300 330 312 326 M 120 290 Q 140 300 160 296',
      circle(80, 120, 7),
      circle(92, 96, 4),
      circle(70, 80, 3),
      circle(330, 130, 6),
      circle(344, 108, 3.5),
      'M 20 378 Q 40 368 60 378 M 120 384 Q 140 374 160 384 M 240 380 Q 260 370 280 380 M 330 386 Q 350 376 370 386',
      'M 300 50 Q 310 40 320 50 Q 330 40 340 50',
    ],
  );
}

// ---- 11. fairy with wings (intermediate) ----------------------------------------------------

function fairyT(): Template {
  const head = circle(200, 112, 30);
  const bun = circle(200, 70, 16);
  const hair = 'M 168 118 C 164 84 184 76 200 76 C 216 76 236 84 232 118 C 222 100 210 94 200 88 C 190 94 178 100 168 118 Z';
  const bodice = roundPoly([[186, 142], [214, 142], [210, 186], [190, 186]], 5);
  const skirt = [petal(200, 180, 180, 76, 18, 0.55), petal(200, 180, 160, 70, 16, 0.55), petal(200, 180, 200, 70, 16, 0.55), petal(200, 180, 140, 58, 14, 0.55), petal(200, 180, 220, 58, 14, 0.55)];
  const legL = strand([[194, 240], [188, 286], [182, 326]], 7, 5, true);
  const legR = strand([[208, 240], [222, 280], [244, 300]], 7, 5, true);
  const armL = strand([[188, 150], [164, 140], [150, 112]], 6, 4.5, true);
  const armR = strand([[212, 150], [234, 170], [246, 192]], 6, 4.5, true);
  const handL = circle(150, 108, 6.5);
  const handR = circle(248, 196, 6.5);
  const wandStar = softStar(118, 56, 20, 9, 5, 3, -20);
  const wandStick = line(148, 104, 126, 72);
  const wings = [petal(204, 160, 52, 132, 42, 0.62), petal(196, 160, -52, 132, 42, 0.62), petal(204, 172, 128, 92, 28, 0.55), petal(196, 172, -128, 92, 28, 0.55)];
  const front: Layer[] = [handL, wandStar, hair, bun, head, handR, armL, armR, bodice, ...skirt, legL, legR];
  const layers = stack([...front, ...wings]);
  const veins = wings.map((_, i) => {
    const ang = [52, -52, 128, -128][i];
    const base: P = i % 2 ? [196, i < 2 ? 160 : 172] : [204, i < 2 ? 160 : 172];
    const len = i < 2 ? 132 : 92;
    const tip = polar(base[0], base[1], len * 0.8, ang);
    const inner = petal(base[0], base[1], ang, len * 0.75, (i < 2 ? 42 : 28) * 0.55, 0.62);
    return hide(`${inner} M ${f(base[0])} ${f(base[1])} L ${f(tip[0])} ${f(tip[1])}`, front);
  });
  return tpl(
    'winged-fairy',
    'Fairy with butterfly wings',
    'intermediate',
    ['fairy', 'wings', 'wand', 'magic', 'sparkle', 'kids', 'whimsical'],
    [...layers, hide(wandStick, [handL, wandStar]), dot(190, 114, 3.2), dot(210, 114, 3.2), smile(200, 124, 6, 4), sparkle(80, 120, 12), sparkle(330, 330, 14)],
    [
      ...veins,
      ellipse(180, 124, 6, 3.5),
      ellipse(220, 124, 6, 3.5),
      blossom(214, 62, 7),
      'M 186 162 L 214 162',
      'M 100 80 Q 90 110 100 140',
      circle(96, 160, 3),
      circle(84, 190, 2.5),
      circle(110, 200, 2),
      sparkle(60, 230, 8),
      sparkle(330, 60, 10),
    ],
  );
}

// ---- 12. knight (intermediate) --------------------------------------------------------------

function knightT(): Template {
  const face = ellipse(196, 122, 26, 30);
  const helmet = smooth([[154, 150], [150, 104], [168, 68], [196, 58], [224, 68], [242, 104], [238, 150], [222, 154], [196, 144], [170, 154]]);
  const plume = [strand([[196, 62], [214, 36], [246, 30], [270, 46]], 10, 3), strand([[200, 64], [226, 50], [256, 56], [272, 76]], 8, 2)];
  const padL = circle(160, 168, 17);
  const padR = circle(232, 168, 17);
  const tunic = roundPoly([[166, 156], [226, 156], [240, 196], [234, 214], [250, 274], [142, 274], [158, 214], [152, 196]], 8);
  const belt = rrect(150, 222, 92, 13, 5);
  const shield = 'M 222 190 L 302 190 L 302 230 C 302 270 282 294 262 308 C 242 294 222 270 222 230 Z';
  const fist = circle(128, 226, 12);
  const pommel = circle(128, 196, 7);
  const grip = rrect(122, 200, 12, 40, 4);
  const guard = rrect(100, 240, 56, 10, 5);
  const blade = poly([[120, 250], [136, 250], [136, 326], [128, 344], [120, 326]]);
  const armL = strand([[158, 176], [138, 200], [128, 222]], 11, 9, true);
  const armR = strand([[234, 178], [248, 200], [250, 220]], 11, 9, true);
  const legL = rrect(170, 268, 22, 62, 8);
  const legR = rrect(202, 268, 22, 62, 8);
  const bootL = 'M 166 322 L 196 322 L 196 344 L 154 344 C 154 334 160 326 166 322 Z';
  const bootR = 'M 200 322 L 230 322 C 236 326 242 334 242 344 L 200 344 Z';
  const cape = smooth([[166, 152], [228, 152], [262, 230], [290, 324], [262, 316], [232, 326], [200, 318], [168, 326], [136, 316], [108, 324], [134, 230]]);
  const front: Layer[] = [shield, fist, pommel, grip, guard, blade, padL, padR, face, helmet, plume[0], plume[1], armL, armR, belt, tunic, bootL, bootR, legL, legR, cape];
  return tpl(
    'knight',
    'Brave knight with a shield',
    'intermediate',
    ['knight', 'prince', 'armour', 'sword', 'shield', 'hero', 'kids', 'medieval'],
    [
      ...stack(front),
      dot(186, 124, 3.2),
      dot(206, 124, 3.2),
      smile(196, 136, 7, 5),
      softStar(262, 240, 22, 10, 5, 3),
      hide(heart(196, 192, 22), [padL, padR, armL, armR, shield]),
    ],
    [
      'M 230 198 L 294 198 L 294 230 C 294 264 278 284 262 297 C 246 284 230 264 230 230 Z',
      hide(line(196, 58, 196, 88), [face]),
      ellipse(180, 136, 6, 3.5),
      ellipse(212, 136, 6, 3.5),
      inside('M 160 150 L 236 150', helmet, [face]),
      circle(160, 168, 9),
      circle(232, 168, 9),
      line(128, 256, 128, 330),
      hide('M 150 250 L 160 274 M 236 250 L 244 274 M 196 244 L 196 274', [shield, fist, guard, blade]),
      'M 60 346 L 340 346',
      blossom(70, 330, 9),
      blossom(320, 330, 8),
      'M 70 340 L 70 346 M 320 338 L 320 346',
    ],
  );
}

// ---- 13. princess in a ball gown (advanced) --------------------------------------------------

function ballGownT(): Template {
  const face = ellipse(200, 84, 20, 25);
  const neck = rrect(193, 100, 14, 24, 5);
  const bun = circle(200, 40, 14);
  const hairCap = smooth([[178, 90], [176, 64], [188, 54], [212, 54], [224, 64], [222, 90], [214, 72], [200, 68], [186, 72]]);
  const tiara = roundPoly([[186, 66], [189, 54], [195, 60], [200, 50], [205, 60], [211, 54], [214, 66]], 2);
  const curlL = strand([[180, 84], [174, 100], [180, 114], [172, 130]], 5, 1);
  const curlR = strand([[220, 84], [226, 100], [220, 114], [228, 130]], 5, 1);
  const shoulders = smooth([[192, 118], [208, 118], [224, 124], [232, 134], [222, 144], [178, 144], [168, 134], [176, 124]]);
  const sleeveL = ellipse(172, 134, 12, 10);
  const sleeveR = ellipse(228, 134, 12, 10);
  const bodice = 'M 178 132 Q 189 122 200 132 Q 211 122 222 132 L 216 176 L 200 192 L 184 176 Z';
  const armL = strand([[170, 142], [158, 162], [164, 184], [190, 196]], 5, 4, true);
  const armR = strand([[230, 142], [242, 162], [236, 184], [210, 196]], 5, 4, true);
  const r = rose(200, 196, 9);
  const roseLeaves = [petal(194, 202, 220, 16, 5), petal(206, 202, 140, 16, 5)];
  const hemWave = (x0: number, x1: number, y: number, n: number, h: number): string => {
    const w = (x1 - x0) / n;
    let d = '';
    for (let i = 0; i < n; i++) d += ` Q ${f(x0 + w * (i + 0.5))} ${f(y + (i % 2 ? -h : h))} ${f(x0 + w * (i + 1))} ${f(y)}`;
    return d;
  };
  const overL = `M 184 176 C 150 206 118 250 100 292 C 86 322 70 342 56 354${hemWave(56, 136, 354, 4, 6)} C 150 316 170 254 198 196 Z`;
  const overR = mirrorX(overL, 200);
  const under = `M 196 190 C 180 250 150 310 128 362${scallops(128, 272, 362, 8, 5).replace(/^M [\d.]+ [\d.]+/, '')} C 250 310 220 250 204 190 Z`;
  const front: Layer[] = [r.outer, ...roseLeaves, tiara, curlL, curlR, hairCap, face, bun, armL, armR, sleeveL, sleeveR, bodice, neck, shoulders, overL, overR, under];
  const layers = stack(front);
  const ruffles = [0, 1, 2, 3].map((k) => {
    const y = 240 + k * 30;
    const half = 10 + (y - 200) * 0.4;
    return inside(scallops(200 - half - 10, 200 + half + 10, y, 6 + k, 4), under, [overL, overR, r.outer]);
  });
  const folds = ['M 182 200 C 156 250 124 300 96 352', 'M 188 214 C 172 270 150 320 124 356', 'M 174 196 C 140 240 108 290 76 350'];
  const foldPaths = folds
    .map((d) => inside(d, overL, [armL, armR, r.outer]))
    .concat(folds.map((d) => inside(mirrorX(d, 200), overR, [armL, armR, r.outer])));
  const spots: P[] = [[150, 262], [250, 262], [112, 316], [288, 316]];
  const garland = spots.map(([x, y]) => rose(x, y, 10));
  return tpl(
    'princess-ball-gown',
    'Princess in a ball gown',
    'advanced',
    ['princess', 'ball', 'gown', 'dress', 'tiara', 'royal', 'roses', 'elegant'],
    [
      ...layers,
      ...garland.map((g) => g.outer),
      lashEye(192, 86, 5, true),
      lashEye(208, 86, 5),
      'M 196 100 Q 200 103 204 100',
      'M 200 88 L 199 94',
    ],
    [
      r.inner,
      ...garland.map((g) => g.inner),
      ...garland.flatMap((g, i) => {
        const [x, y] = spots[i];
        return [hide(petal(x - 8, y + 6, 240, 16, 5), [g.outer]), hide(petal(x + 8, y + 6, 120, 16, 5), [g.outer])];
      }),
      ...ruffles,
      ...foldPaths,
      inside('M 192 132 L 192 182 M 208 132 L 208 182', bodice, [armL, armR, r.outer]),
      'M 190 120 Q 200 128 210 120',
      circle(200, 129, 2.5),
      circle(200, 60, 2),
      'M 40 372 Q 200 384 360 372',
      sparkle(70, 80, 14),
      sparkle(330, 90, 12),
      sparkle(56, 200, 9),
      sparkle(346, 220, 10),
      softStar(300, 40, 8, 3.5, 5, 1.5),
      softStar(96, 34, 7, 3, 5, 1.5),
    ],
  );
}

// ---- 14. grand castle (advanced) -------------------------------------------------------------

function grandCastleT(): Template {
  type T = { body: string; roof: string; band: string; cx: number; top: number; w: number; roofH: number };
  const tower = (cx: number, w: number, top: number, bottom: number, roofH: number): T => {
    const h = w / 2;
    return {
      body: poly([[cx - h, top], [cx + h, top], [cx + h, bottom], [cx - h, bottom]]),
      roof:
        `M ${f(cx - h - 9)} ${f(top + 2)} C ${f(cx - h * 0.4)} ${f(top - roofH * 0.35)} ${f(cx - 4)} ${f(top - roofH * 0.7)} ${f(cx)} ${f(top - roofH)} ` +
        `C ${f(cx + 4)} ${f(top - roofH * 0.7)} ${f(cx + h * 0.4)} ${f(top - roofH * 0.35)} ${f(cx + h + 9)} ${f(top + 2)} Z`,
      band: rrect(cx - h - 5, top - 2, w + 10, 14, 4),
      cx,
      top,
      w,
      roofH,
    };
  };
  const t1 = tower(82, 52, 196, 340, 76);
  const t4 = tower(352, 38, 214, 340, 58);
  const t2 = tower(146, 44, 132, 340, 84);
  const t3 = tower(298, 50, 108, 340, 82);
  const tt = tower(219, 30, 120, 170, 52);
  const keep = poly([[172, 340], ...crenels(172, 266, 164, 12, 5), [266, 340]]);
  const wall = poly([[82, 340], ...crenels(82, 352, 254, 12, 11), [352, 340]]);
  const gate = 'M 196 342 L 196 292 A 24 24 0 0 1 244 292 L 244 342 Z';
  const bridge = poly([[196, 342], [244, 342], [262, 394], [178, 394]]);
  const hill = smooth([[6, 346], [40, 336], [80, 344], [130, 334], [176, 340], [262, 340], [300, 332], [350, 342], [394, 336], [394, 396], [6, 396]]);
  const ordered: Layer[] = [bridge, hill, gate, t1.band, t1.roof, t1.body, t4.band, t4.roof, t4.body, wall, keep, t2.band, t2.roof, t2.body, t3.band, t3.roof, t3.body, tt.band, tt.roof, tt.body];
  const layers = stack(ordered);
  // draw only the hill's top edge
  layers[1] = clip(smooth([[6, 346], [40, 336], [80, 344], [130, 334], [176, 340], [262, 340], [300, 332], [350, 342], [394, 336]], false), [region(bridge)]);
  const reg = ordered.map((l) => region(l));
  const idx = (l: Layer): number => ordered.indexOf(l);
  const within = (d: string, l: Layer): string => {
    const k = clip(d, [reg[idx(l)]], 'inside');
    return k && idx(l) > 0 ? clip(k, reg.slice(0, idx(l))) : k;
  };
  const bricks = (x0: number, x1: number, y0: number, y1: number): string => {
    let d = '';
    for (let r = 0, y = y0; y < y1; r++, y += 15) {
      d += ` M ${f(x0)} ${f(y)} L ${f(x1)} ${f(y)}`;
      for (let x = x0 + 8 + (r % 2) * 12; x < x1; x += 24) d += ` M ${f(x)} ${f(y)} L ${f(x)} ${f(Math.min(y + 15, y1))}`;
    }
    return d.trim();
  };
  const shingles = (t: T): string => {
    let d = '';
    for (let r = 0, y = t.top - t.roofH * 0.62; y < t.top; r++, y += 12) {
      for (let x = t.cx - t.w + (r % 2) * 7; x < t.cx + t.w; x += 14) d += ` M ${f(x)} ${f(y)} Q ${f(x + 7)} ${f(y + 9)} ${f(x + 14)} ${f(y)}`;
    }
    return d.trim();
  };
  const towers = [t1, t2, t3, t4, tt];
  const windows: string[] = [
    archWin(72, 250, 20, 30), archWin(72, 300, 20, 30), archWin(137, 196, 18, 28), archWin(137, 244, 18, 28),
    archWin(287, 160, 22, 32), archWin(287, 214, 22, 32), archWin(345, 262, 14, 24), archWin(212, 158, 14, 22),
    archWin(186, 224, 18, 30), archWin(234, 224, 18, 30), archWin(210, 262, 20, 24),
  ];
  const winRegions = windows.map((w) => region(w));
  const portcullis = within('M 204 300 L 204 342 M 214 290 L 214 342 M 226 290 L 226 342 M 236 300 L 236 342 M 196 304 L 244 304 M 196 320 L 244 320', gate);
  return tpl(
    'castle-grand',
    'Grand fairy-tale castle',
    'advanced',
    ['castle', 'kingdom', 'towers', 'bridge', 'flags', 'building', 'storybook', 'medieval'],
    [
      ...layers,
      ...windows.map((w) => clip(w, reg.slice(0, 3))),
      ...towers.map((t, i) => flag(t.cx, t.top - t.roofH, i === 2 ? 26 : 24, i % 2 ? -1 : 1)),
    ],
    [
      clip(within(bricks(56, 108, 214, 340), t1.body), winRegions),
      clip(within(bricks(124, 168, 148, 340), t2.body), winRegions),
      clip(within(bricks(273, 323, 124, 340), t3.body), winRegions),
      clip(within(bricks(333, 371, 230, 340), t4.body), winRegions),
      clip(within(bricks(108, 336, 256, 340), wall), winRegions),
      clip(within(bricks(172, 266, 166, 340), keep), winRegions),
      ...towers.map((t) => within(shingles(t), t.roof)),
      portcullis,
      within('M 186 352 L 254 352 M 184 362 L 256 362 M 182 372 L 258 372 M 180 382 L 260 382', bridge),
      'M 30 360 L 44 372 M 100 356 L 92 374 M 140 352 L 150 370 M 300 352 L 290 372 M 340 356 L 352 376 M 370 352 L 362 366',
      'M 30 80 C 30 66 52 62 60 72 C 68 60 92 64 90 80 Z',
      'M 330 50 C 330 38 348 34 354 42 C 362 32 384 38 380 50 Z',
      'M 230 40 Q 238 32 246 40 Q 254 32 262 40 M 250 64 Q 256 58 262 64 Q 268 58 274 64',
    ],
  );
}

// ---- 15. elegant unicorn (advanced) ---------------------------------------------------------

function unicornElegantT(): Template {
  const head = smooth([
    [232, 96], [212, 106], [188, 124], [160, 158], [128, 196], [104, 226], [90, 246], [90, 264], [100, 276], [118, 282],
    [146, 276], [176, 262], [200, 252], [214, 264], [226, 300], [236, 350], [244, 392], [346, 392], [332, 300], [304, 190], [270, 120], [250, 98],
  ]);
  const earF = petal(242, 104, -6, 58, 14, 0.5);
  const earB = petal(256, 108, 14, 52, 13, 0.5);
  const horn = roundPoly([[196, 116], [148, 14], [220, 106]], 3);
  const forelock = strand([[230, 98], [206, 116], [194, 140], [204, 164]], 13, 1);
  const forelock2 = strand([[234, 100], [222, 126], [224, 150], [238, 170]], 10, 1);
  const m1c: P[] = [[244, 94], [280, 112], [300, 156], [336, 204], [342, 262], [374, 318], [370, 384]];
  const m2c: P[] = [[238, 110], [266, 146], [278, 198], [312, 246], [312, 302], [340, 352], [332, 392]];
  const m3c: P[] = [[254, 92], [300, 96], [326, 132], [364, 170], [370, 226], [388, 270]];
  const m4c: P[] = [[236, 126], [256, 174], [262, 232], [290, 290], [288, 340], [304, 388]];
  const m1 = strand(m1c, 24, 3);
  const m2 = strand(m2c, 20, 3);
  const m3 = strand(m3c, 16, 2);
  const m4 = strand(m4c, 14, 2);
  const roses = [rose(244, 118, 13), rose(262, 140, 11)];
  const leafs = [petal(228, 128, 220, 22, 7), petal(274, 128, 60, 22, 7)];
  const eye = 'M 164 168 Q 176 154 194 162 Q 184 176 164 168 Z';
  const front: Layer[] = [roses[0].outer, roses[1].outer, ...leafs, forelock, forelock2, horn, earF, m4, m2, head, earB, m1, m3];
  const layers = stack(front);
  const hornLines: string[] = [];
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const a: P = [196 + (148 - 196) * t, 116 + (14 - 116) * t];
    const b: P = [220 + (148 - 220) * t, 106 + (14 - 106) * t];
    hornLines.push(`M ${f(a[0])} ${f(a[1] + 4 * (1 - t))} Q ${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2 + 6 * (1 - t))} ${f(b[0])} ${f(b[1] - 6 * (1 - t))}`);
  }
  const lockLine = (c: P[], off: number, cut = 1): string => smooth(c.slice(0, c.length - cut).map(([x, y]) => [x + off, y] as P), false);
  const fr = front.map((l) => region(l));
  const inLock = (d: string, l: Layer): string => {
    const i = front.indexOf(l);
    const k = clip(d, [fr[i]], 'inside');
    return k && i > 0 ? clip(k, fr.slice(0, i)) : k;
  };
  return tpl(
    'unicorn-elegant',
    'Elegant unicorn portrait',
    'advanced',
    ['unicorn', 'horse', 'magic', 'mane', 'roses', 'elegant', 'portrait', 'stars'],
    [...layers, clip(eye, fr.slice(0, 6)), 'M 100 246 C 108 238 118 246 112 256', 'M 100 272 Q 112 275 122 270'],
    [
      inLock(hornLines.join(' '), horn),
      clip(circle(182, 164, 6), [region(eye)], 'inside'),
      'M 170 160 L 166 152 M 178 156 L 176 148 M 186 156 L 188 148',
      roses[0].inner,
      roses[1].inner,
      inLock('M 200 248 C 178 238 162 220 168 198 M 232 280 C 250 300 270 320 280 360 M 140 230 C 150 236 166 238 176 234', head),
      inLock(lockLine(m1c, 4), m1),
      inLock(lockLine(m2c, -3), m2),
      inLock(lockLine(m3c, 3), m3),
      inLock(lockLine(m4c, 2), m4),
      inLock(lockLine([[230, 98], [206, 116], [196, 140], [200, 152]], 2), forelock),
      softStar(60, 60, 18, 8, 5, 3),
      sparkle(110, 110, 14),
      sparkle(40, 150, 9),
      sparkle(80, 330, 16),
      softStar(140, 360, 10, 4.5, 5, 2),
      sparkle(200, 30, 10),
      circle(60, 250, 3),
      circle(120, 40, 2.5),
      circle(30, 220, 2.5),
    ],
  );
}

// ---- 16. horse-drawn coach (advanced) -------------------------------------------------------

function coachT(): Template {
  const body = 'M 232 172 L 380 172 C 384 220 378 258 360 290 L 252 290 C 234 258 228 220 232 172 Z';
  const roof = rrect(222, 150, 168, 24, 10);
  const crown = roundPoly([[290, 152], [286, 128], [298, 140], [306, 120], [314, 140], [326, 128], [322, 152]], 3);
  const door = rrect(282, 186, 50, 92, 8);
  const wf = wheel(252, 326, 34, 10);
  const wb = wheel(350, 322, 42, 12);
  const lamp = 'M 216 172 L 230 172 L 232 196 L 214 196 Z';
  // horse, facing left: head, neck and body as one outline
  const horse = smooth([
    [18, 158], [16, 146], [24, 130], [40, 108], [54, 92], [66, 86], [80, 92], [98, 112], [114, 140], [130, 166], [154, 176], [182, 176],
    [202, 188], [208, 210], [200, 234], [182, 248], [150, 252], [112, 252], [88, 244], [76, 226], [72, 202], [66, 178], [58, 158], [48, 150], [36, 160], [24, 164],
  ]);
  const earF = petal(62, 90, 4, 24, 6);
  const plume = petal(72, 92, 22, 22, 6);
  const legFN = strand([[90, 236], [80, 270], [62, 286], [60, 302]], 10, 6, true);
  const legFF = strand([[110, 240], [108, 290], [106, 330]], 9, 6, true);
  const legHN = strand([[176, 232], [184, 280], [174, 334]], 12, 6, true);
  const legHF = strand([[158, 236], [150, 280], [134, 300], [134, 322]], 9, 6, true);
  const hooves = [rrect(52, 300, 18, 10, 3), rrect(98, 330, 18, 10, 3), rrect(164, 334, 20, 10, 3), rrect(124, 320, 18, 10, 3)];
  const tail = strand([[204, 194], [222, 214], [220, 256], [210, 290]], 9, 2);
  const mane = strand([[68, 88], [86, 104], [102, 128], [118, 156], [134, 170]], 10, 4);
  const collar = 'M 70 190 C 86 180 100 172 112 168 L 118 182 C 104 186 92 194 78 204 Z';
  const shaft = 'M 112 216 L 238 260 L 238 268 L 110 224 Z';
  const front: Layer[] = [
    hooves[0], hooves[1], hooves[2], earF, mane, collar, horse, plume, legFN, legHN, tail, legFF, legHF, hooves[3], shaft,
    wf.rim, wb.rim, crown, lamp, door, roof, body,
  ];
  const layers = stack(front);
  const fr = front.map((l) => region(l));
  return tpl(
    'horse-coach',
    'Horse-drawn royal coach',
    'advanced',
    ['coach', 'carriage', 'horse', 'royal', 'wheels', 'ball', 'storybook', 'vintage'],
    [
      ...layers,
      ...wf.inner.map((d) => clip(d, fr.slice(0, 15))),
      ...wb.inner,
      clip(archWin(292, 236, 30, 40), fr.slice(0, 19)),
      clip(archWin(242, 236, 26, 40), fr.slice(0, 19)),
      clip(archWin(344, 236, 26, 40), fr.slice(0, 19)),
      circle(48, 112, 3.2),
    ],
    [
      'M 22 150 Q 26 144 30 150',
      'M 18 158 L 28 159',
      'M 28 140 L 62 122 L 56 96 M 62 122 L 66 150',
      clip('M 290 248 L 324 248 M 290 262 L 324 262', [region(door)], 'inside'),
      circle(326, 230, 3),
      heart(307, 266, 10),
      'M 242 214 L 268 214 M 255 196 L 255 236 M 344 214 L 370 214 M 357 196 L 357 236 M 292 214 L 322 214 M 307 196 L 307 236',
      clip('M 252 290 C 280 304 330 304 360 290', fr.slice(0, 17)),
      clip('M 240 300 C 220 310 222 330 236 330 M 372 296 C 392 304 392 326 378 330', fr.slice(0, 17)),
      'M 214 196 L 232 196 M 223 172 L 223 164',
      circle(298, 130, 2.5),
      circle(306, 116, 2.5),
      circle(314, 130, 2.5),
      clip(clip('M 144 178 L 150 250 M 170 200 C 176 216 186 224 196 222', [region(horse)], 'inside'), fr.slice(0, 6)),
      'M 10 344 L 390 344',
      'M 40 360 L 70 360 M 120 366 L 160 366 M 280 362 L 320 362',
      clip(clip(scallops(234, 380, 176, 12, 3), [region(body)], 'inside'), fr.slice(0, 21)),
      'M 240 280 C 246 266 262 268 260 278 C 258 286 248 284 250 278 M 372 280 C 366 266 350 268 352 278 C 354 286 364 284 362 278',
      clip(clip('M 238 200 C 232 220 236 248 246 270 M 376 200 C 380 220 378 248 370 270', [region(body)], 'inside'), fr.slice(0, 21)),
      clip(clip('M 76 98 C 90 112 102 132 114 156 M 70 104 C 82 118 92 136 104 156', [region(mane)], 'inside'), fr.slice(0, 4)),
      clip(clip('M 216 220 C 218 240 216 262 210 280', [region(tail)], 'inside'), fr.slice(0, 10)),
      circle(252, 326, 3),
      circle(350, 322, 3.5),
      sparkle(200, 80, 12),
      sparkle(140, 50, 9),
      sparkle(370, 90, 10),
    ],
  );
}

// ==== fb-1022b B3 (T112): more storybook pieces and the Linework cast (docs/CAST.md) ===========================

/** Place a path drawn in local coordinates: scale s, then move to (tx, ty); flip mirrors left-right. */
function place(d: string, tx: number, ty: number, s: number, flip = false): string {
  return mapPath(d, { map: (x, y) => [tx + (flip ? -x : x) * s, ty + y * s], scale: s, rotate: 0, flip });
}

/** A figure: closed layers front to back, marks drawn on top (eyes, mouths), fine detail. */
type Fig = { layers: Layer[]; marks: string[]; detail: string[] };

function mapFig(fig: Fig, fn: (d: string) => string): Fig {
  return {
    layers: fig.layers.map((l) => (typeof l === 'string' ? fn(l) : l.map(fn))),
    marks: fig.marks.filter(Boolean).map(fn),
    detail: fig.detail.filter(Boolean).map(fn),
  };
}
const placeFig = (fig: Fig, tx: number, ty: number, s: number, flip = false): Fig =>
  mapFig(fig, (d) => place(d, tx, ty, s, flip));
const turnFig = (fig: Fig, deg: number, cx: number, cy: number): Fig => mapFig(fig, (d) => rotate(d, deg, cx, cy));

/** Closed fan of scallops: centre → bumps along the arc a0..a1 (degrees, 0 = up, clockwise) → centre. */
function scallopFan(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, n: number): string {
  const s = polar(cx, cy, r0, a0);
  let d = `M ${f(cx)} ${f(cy)} L ${f(s[0])} ${f(s[1])}`;
  for (let i = 0; i < n; i++) {
    const c = polar(cx, cy, r1, a0 + ((a1 - a0) * (i + 0.5)) / n);
    const e = polar(cx, cy, r0, a0 + ((a1 - a0) * (i + 1)) / n);
    d += ` Q ${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}`;
  }
  return `${d} Z`;
}

/** Midrib and side veins of a petal(bx, by, deg, len, w) leaf. */
function veins(bx: number, by: number, deg: number, len: number, w: number, n = 2): string {
  const tip = polar(bx, by, len * 0.85, deg);
  let d = line(bx, by, tip[0], tip[1]);
  for (let i = 1; i <= n; i++) {
    const t = 0.2 + (0.55 * i) / (n + 0.5);
    const m = polar(bx, by, len * t, deg);
    for (const s of [-1, 1]) {
      const e = polar(m[0], m[1], w * 0.9, deg + s * 55);
      d += ` ${line(m[0], m[1], e[0], e[1])}`;
    }
  }
  return d;
}

/** Hatch lines at angle deg (0 = vertical) every gap px, kept inside the closed shape `within`. */
function hatch(within: string, deg: number, gap: number, box: [number, number, number, number]): string {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  let d = '';
  for (let o = -r; o <= r; o += gap) {
    const a = polar(cx, cy, r, deg);
    const b = polar(cx, cy, r, deg + 180);
    const n = polar(0, 0, o, deg + 90);
    d += ` ${line(a[0] + n[0], a[1] + n[1], b[0] + n[0], b[1] + n[1])}`;
  }
  return clip(d.trim(), [region(within)], 'inside');
}

/** Puffy cloud: overlapping circles along a base line, drawn as one merged outline. */
function puff(cx: number, cy: number, w: number, h: number): string[] {
  const out: string[] = [ellipse(cx, cy, w * 0.5, h * 0.32)];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = cx - w * 0.42 + w * 0.84 * t;
    const r = h * (0.32 + 0.22 * Math.sin(Math.PI * t));
    out.push(circle(x, cy - h * 0.08 - r * 0.4, r));
  }
  return out;
}

/** Storybook tree: round crown on a trunk standing on ground y g. */
function tree(x: number, g: number, h: number, r: number): { layers: Layer[]; detail: string[] } {
  const top = g - h;
  const crown = [circle(x, top + r, r), circle(x - r * 0.72, top + r * 1.55, r * 0.78), circle(x + r * 0.72, top + r * 1.55, r * 0.78)];
  const trunk = `M ${f(x - 12)} ${f(g)} C ${f(x - 7)} ${f(g - 20)} ${f(x - 7)} ${f(top + r * 2)} ${f(x - 6)} ${f(top + r * 1.6)} L ${f(x + 6)} ${f(top + r * 1.6)} C ${f(x + 7)} ${f(top + r * 2)} ${f(x + 7)} ${f(g - 20)} ${f(x + 12)} ${f(g)} Z`;
  const bark = clip(`M ${f(x - 2)} ${f(g - 8)} L ${f(x - 1)} ${f(g - 26)} M ${f(x + 3)} ${f(g - 18)} L ${f(x + 3)} ${f(g - 34)}`, [region(crown)]);
  const curls = `M ${f(x - r * 0.4)} ${f(top + r * 1.1)} Q ${f(x - r * 0.25)} ${f(top + r * 0.8)} ${f(x)} ${f(top + r * 0.9)} M ${f(x + r * 0.6)} ${f(top + r * 1.7)} Q ${f(x + r * 0.8)} ${f(top + r * 1.45)} ${f(x + r * 1.05)} ${f(top + r * 1.55)}`;
  return { layers: [crown, trunk], detail: [bark, curls] };
}

/** Little cottage with a pitched roof and chimney standing on ground y g. */
function house(x: number, g: number, w: number, h: number, rh: number): { layers: Layer[]; marks: string[] } {
  const walls = poly([[x, g], [x, g - h], [x + w, g - h], [x + w, g]]);
  const roof = roundPoly([[x - 8, g - h + 4], [x + w / 2, g - h - rh], [x + w + 8, g - h + 4]], 3);
  const chim = poly([[x + w * 0.66, g - h - rh * 0.3], [x + w * 0.66, g - h - rh * 0.95], [x + w * 0.8, g - h - rh * 0.95], [x + w * 0.8, g - h - rh * 0.2]]);
  const door = archWin(x + w * 0.42, g, w * 0.22, h * 0.6);
  const win = rrect(x + w * 0.1, g - h * 0.72, w * 0.2, h * 0.32, 2);
  const winX = `${line(x + w * 0.2, g - h * 0.72, x + w * 0.2, g - h * 0.4)} ${line(x + w * 0.1, g - h * 0.56, x + w * 0.3, g - h * 0.56)}`;
  return { layers: [roof, chim, walls], marks: [door, win, winX] };
}

const grass = (x: number, y: number, s = 1): string =>
  `M ${f(x)} ${f(y)} L ${f(x - 4 * s)} ${f(y - 9 * s)} M ${f(x)} ${f(y)} L ${f(x)} ${f(y - 12 * s)} M ${f(x)} ${f(y)} L ${f(x + 4 * s)} ${f(y - 9 * s)}`;

/** Open smoke curl rising from (x, y). */
const smokeCurl = (x: number, y: number, s = 1): string =>
  `M ${f(x)} ${f(y)} C ${f(x + 14 * s)} ${f(y - 4 * s)} ${f(x + 18 * s)} ${f(y - 18 * s)} ${f(x + 8 * s)} ${f(y - 22 * s)} ` +
  `C ${f(x)} ${f(y - 25 * s)} ${f(x - 3 * s)} ${f(y - 15 * s)} ${f(x + 5 * s)} ${f(y - 14 * s)} ` +
  `M ${f(x + 12 * s)} ${f(y - 30 * s)} C ${f(x + 26 * s)} ${f(y - 34 * s)} ${f(x + 26 * s)} ${f(y - 50 * s)} ${f(x + 14 * s)} ${f(y - 52 * s)}`;

// ---- the cast -------------------------------------------------------------------------------

/** Bramble, the hedgehog squire (docs/CAST.md): faces right, feet on y = 0, about 108 tall. */
function brambleFig(): Fig {
  const body = ellipse(0, -40, 36, 36);
  const snout = 'M 18 -60 C 40 -60 56 -46 62 -38 C 54 -31 36 -28 20 -30 Z';
  const spikes = scallopFan(0, -40, 33, 66, 200, 398, 9);
  const cap = 'M -18 -64 C -22 -86 -6 -98 12 -98 C 32 -98 44 -86 40 -64 C 24 -70 -2 -70 -18 -64 Z';
  const stem = rrect(9, -108, 6, 13, 2);
  const feet = [ellipse(-12, -4, 12, 6), ellipse(18, -4, 12, 6)];
  const shield = 'M -28 -56 Q -6 -62 16 -56 L 16 -36 C 16 -20 2 -10 -6 -6 C -14 -10 -28 -20 -28 -36 Z';
  const hand = circle(40, -20, 6.5);
  const blade = rotate(roundPoly([[37, -24], [43, -24], [43, -66], [40, -74], [37, -66]], 1.5), 60, 40, -20);
  const guard = rotate(rrect(29, -30, 22, 6, 3), 60, 40, -20);
  const nose = circle(62, -38, 4.5);
  return {
    layers: [hand, guard, blade, shield, nose, cap, stem, ...feet, [body, snout], spikes],
    marks: [bigEye(30, -50, 5, 6), 'M 42 -35 Q 47 -32 52 -36', hide(leaf(-6, -16, 0, 34, 8), [hand])],
    detail: [
      hatch(cap, 45, 7, [-22, -98, 44, -64]),
      hatch(cap, -45, 7, [-22, -98, 44, -64]),
      clip('M -23 -51 Q -6 -56 11 -51 L 11 -36 C 11 -23 0 -15 -6 -11 C -12 -15 -23 -23 -23 -36 Z', [region(hand)]),
      veins(-6, -16, 0, 34, 8),
      ellipse(36, -41, 5, 3),
      clip('M -28 -46 L -36 -50 M -26 -30 L -34 -30 M -20 -62 L -26 -68', [region(shield)]),
    ],
  };
}

/** Fern, the shy little dragon (docs/CAST.md): faces right, feet on y = 0, about 118 tall. */
function fernFig(): Fig {
  const body = ellipse(0, -36, 34, 33);
  const head = ellipse(30, -80, 27, 24);
  const snout = ellipse(52, -73, 15, 11);
  const hornL = petal(16, -98, -25, 18, 5.5, 0.4);
  const hornR = petal(34, -100, 20, 17, 5.5, 0.4);
  const wingA = petal(-16, -56, -60, 54, 16, 0.55);
  const wingB = petal(-8, -62, -22, 44, 13, 0.55);
  const tail = strand([[-26, -18], [-46, -12], [-62, -18], [-68, -34], [-60, -46], [-50, -42], [-50, -34]], 9, 2.5, true);
  const feet = [ellipse(-14, -4, 12, 7), ellipse(18, -4, 12, 7)];
  const arm = rotate(ellipse(26, -44, 6, 10), -30, 26, -44);
  const belly = ellipse(9, -32, 17, 21);
  return {
    layers: [arm, ...feet, [head, snout], hornL, hornR, body, wingA, wingB, tail],
    marks: [bigEye(36, -85, 8, 10), circle(61, -76, 1.8), 'M 44 -65 Q 50 -62 56 -66', hide(belly, [arm, ...feet])],
    detail: [
      clip(veins(-16, -56, -60, 54, 16), [region(body)]),
      clip(veins(-8, -62, -22, 44, 13), [region(body), region(wingA)]),
      clip('M -10 -42 L 26 -42 M -8 -32 L 26 -32 M -6 -22 L 24 -22', [region(belly)], 'inside'),
      ellipse(22, -72, 5, 3),
    ],
  };
}

/** Mossy, the gentle stone forest giant (docs/CAST.md): faces front, feet on y = 0, about 305 tall. */
function mossyFig(): Fig {
  const body = roundPoly([[-70, -20], [-92, -84], [-86, -150], [-58, -188], [-6, -198], [52, -190], [86, -152], [94, -96], [74, -22], [4, -12]], 22);
  const head = roundPoly([[-46, -194], [-52, -234], [-30, -262], [6, -268], [36, -258], [52, -230], [46, -196], [0, -184]], 14);
  const armL = roundPoly([[-74, -170], [-108, -152], [-122, -100], [-116, -58], [-94, -62], [-88, -112], [-76, -140]], 12);
  const handL = ellipse(-106, -52, 20, 17);
  const armR = mirrorX(armL, 0);
  const handR = mirrorX(handL, 0);
  const legL = rrect(-62, -44, 46, 44, 18);
  const legR = rrect(16, -44, 46, 44, 18);
  const moss = [ellipse(-22, -258, 20, 8), ellipse(8, -265, 22, 8), ellipse(34, -254, 13, 7)];
  const mossR = [ellipse(58, -188, 16, 7), ellipse(78, -172, 10, 6)];
  const cap = 'M -2 -282 C 0 -306 40 -306 42 -282 Q 20 -288 -2 -282 Z';
  const stem = rrect(15, -286, 10, 16, 3);
  const nest = 'M -104 -194 C -100 -170 -56 -168 -50 -194 Q -77 -188 -104 -194 Z';
  const bird = circle(-70, -204, 10);
  const birdTail = petal(-84, -196, -70, 20, 6, 0.5);
  const beak = roundPoly([[-62, -208], [-50, -205], [-62, -201]], 1);
  return {
    layers: [beak, nest, bird, birdTail, mossR, cap, moss, stem, head, handL, handR, armL, armR, body, legL, legR],
    marks: [
      circle(-17, -226, 4.5),
      circle(17, -226, 4.5),
      'M -16 -207 Q 0 -198 16 -207',
      'M -26 -239 Q -17 -244 -8 -240 M 8 -240 Q 17 -244 26 -239',
      'M -3 -218 Q 0 -214 3 -218',
      circle(-67, -207, 1.8),
    ],
    detail: [
      'M -40 -122 L -30 -104 L -38 -86',
      'M 38 -150 L 50 -132 L 46 -120',
      'M 28 -74 L 42 -60 L 38 -42',
      'M -54 -60 L -44 -52',
      circle(-20, -150, 2.5),
      circle(14, -112, 2),
      circle(-6, -60, 2.5),
      circle(56, -96, 2),
      clip('M -102 -186 L -54 -184 M -98 -178 L -58 -176', [region(nest)], 'inside'),
      'M -112 -80 L -104 -74 M 112 -80 L 104 -74',
      circle(10, -296, 3),
      circle(28, -294, 2.5),
      blossom(-38, -100, 7),
      'M -34 -264 L -38 -276 M -24 -265 L -24 -280 M -14 -264 L -10 -275 M 18 -271 L 22 -282 M 36 -260 L 40 -270 M 62 -194 L 60 -204 M 70 -193 L 74 -203',
      'M -60 -120 Q -50 -128 -40 -120 Q -30 -128 -20 -120 M 20 -40 Q 30 -48 40 -40 Q 50 -48 60 -40',
      'M -70 -40 L -60 -46 L -64 -58 M 64 -170 L 72 -158',
      'M -40 -220 L -36 -212 M 38 -214 L 34 -206',
    ],
  };
}

const fernTag = ['cast', 'fern', 'dragon', 'storybook'];
const brambleTag = ['cast', 'bramble', 'hedgehog', 'squire', 'knight'];
const mossyTag = ['cast', 'mossy', 'giant', 'forest', 'stone'];

// ---- 17. Fern's first smoke ring (beginner) --------------------------------------------------

function fernSmokeRingT(): Template {
  const fig = placeFig(fernFig(), 160, 348, 2.05);
  const ring = smooth(Array.from({ length: 12 }, (_, i) => polar(318, 118, i % 2 ? 34 : 36, i * 30)));
  const hole = circle(318, 118, 14);
  const ground = hide('M 26 352 Q 200 364 374 352', fig.layers);
  return tpl(
    'fern-smoke-ring',
    'Fern’s first smoke ring',
    'beginner',
    [...fernTag, 'smoke', 'cute', 'kids'],
    [
      ...stack(fig.layers),
      ...fig.marks,
      ring,
      hole,
      'M 304 190 C 316 182 316 170 308 166 C 300 164 298 174 306 176',
      ground,
      sparkle(360, 210, 13),
      sparkle(250, 60, 11),
    ],
    [...fig.detail, grass(50, 352), grass(344, 356), grass(370, 348, 0.8), 'M 296 104 Q 306 96 318 98', circle(270, 140, 3), circle(352, 170, 2.5)],
  );
}

// ---- 18. Bramble the hedgehog squire (beginner) --------------------------------------------

function brambleSquireT(): Template {
  const fig = placeFig(brambleFig(), 168, 344, 2.2);
  const ground = hide('M 24 350 Q 200 360 376 350', fig.layers);
  return tpl(
    'bramble-squire',
    'Bramble the hedgehog squire',
    'beginner',
    [...brambleTag, 'storybook', 'kids', 'cute'],
    [...stack(fig.layers), ...fig.marks, ground, sparkle(330, 90, 14), sparkle(70, 80, 10), blossom(352, 330, 10)],
    [...fig.detail, grass(40, 350), grass(300, 352), grass(372, 346, 0.8), line(352, 340, 352, 352), circle(250, 70, 3)],
  );
}

// ---- 19. Magic mirror (beginner) ------------------------------------------------------------

function magicMirrorT(): Template {
  const frame = smooth(Array.from({ length: 24 }, (_, i) => {
    const [x, y] = polar(0, 0, i % 2 ? 104 : 112, i * 15);
    return [200 + x, 190 + y * 1.22] as P;
  }));
  const glass = ellipse(200, 190, 80, 104);
  const crest = roundPoly([[170, 66], [164, 26], [185, 44], [200, 16], [215, 44], [236, 26], [230, 66]], 4);
  const stand = 'M 160 312 L 240 312 L 262 362 L 138 362 Z';
  const foot = rrect(118, 356, 164, 18, 9);
  const gems = [circle(104, 190, 8), circle(296, 190, 8)];
  return tpl(
    'magic-mirror',
    'Magic mirror with a crown crest',
    'beginner',
    ['mirror', 'magic', 'enchanted', 'crown', 'storybook', 'kids', 'ornamental'],
    [...stack([crest, foot, frame, stand]), glass, ...gems, sparkle(62, 80, 15), sparkle(344, 100, 11), sparkle(340, 300, 12)],
    ['M 150 150 L 196 104', 'M 152 182 L 222 112', 'M 240 270 L 262 248', circle(200, 42, 4), circle(60, 250, 3), circle(352, 220, 2.5)],
  );
}

// ---- 20. Spinning wheel (beginner) ----------------------------------------------------------

function spinningWheelT(): Template {
  const wh = wheel(244, 160, 92, 10);
  const post = rrect(236, 150, 16, 120, 6);
  const bench = rotate(rrect(70, 258, 270, 22, 10), 4, 205, 269);
  const legs = [rotate(rrect(96, 270, 16, 86, 6), 12, 104, 270), rotate(rrect(296, 270, 16, 86, 6), -12, 304, 270), rrect(200, 276, 16, 80, 6)];
  const distaff = rrect(102, 128, 12, 134, 5);
  const wool = puff(108, 110, 70, 64);
  const treadle = rrect(150, 352, 110, 12, 6);
  return tpl(
    'spinning-wheel',
    'Storybook spinning wheel',
    'beginner',
    ['spinning-wheel', 'wheel', 'spindle', 'wool', 'storybook', 'castle', 'vintage'],
    [...stack([post, wool, bench, distaff, wh.rim, treadle, ...legs]), ...wh.inner.map((d) => hide(d, [post, bench]))],
    [circle(244, 160, 5), 'M 140 100 C 180 112 210 140 236 158', 'M 84 108 Q 96 98 108 104 M 112 92 Q 124 86 132 96', 'M 30 372 L 370 372', sparkle(350, 60, 12), sparkle(52, 300, 10)],
  );
}

// ---- 21. Gnome toadstool house (beginner) --------------------------------------------------

function gnomeHouseT(): Template {
  const cap = `M 56 204 C 56 64 344 64 344 204 ${scallops(344, 56, 204, 7, 7).replace(/^M [\d.]+ [\d.]+/, '')} Z`;
  const stemHouse = 'M 112 204 C 100 262 96 320 100 350 L 300 350 C 304 320 300 262 288 204 Z';
  const chimney = rrect(262, 70, 22, 50, 4);
  const door = archWin(170, 350, 60, 92);
  const step = rrect(156, 350, 88, 12, 5);
  const spots = [circle(130, 150, 16), circle(200, 108, 14), circle(272, 150, 18), circle(96, 186, 8), circle(220, 168, 10), circle(316, 186, 7)];
  return tpl(
    'gnome-house',
    'Gnome toadstool house',
    'beginner',
    ['gnome', 'house', 'mushroom', 'toadstool', 'forest', 'enchanted', 'kids'],
    [...stack([step, cap, chimney, stemHouse]), door, circle(136, 262, 18), circle(266, 252, 16), ...spots, smokeCurl(273, 66, 0.85)],
    [
      circle(218, 310, 3.5),
      'M 136 244 L 136 280 M 118 262 L 154 262 M 266 236 L 266 268 M 250 252 L 282 252',
      'M 188 292 L 188 350 M 212 292 L 212 350',
      'M 20 362 L 380 362',
      grass(60, 362),
      grass(340, 362),
      blossom(40, 340, 9),
      line(40, 349, 40, 362),
      blossom(360, 336, 8),
      line(360, 344, 360, 362),
    ],
  );
}

// ---- 22. Goose with a golden egg (beginner) ------------------------------------------------

function gooseT(): Template {
  const body = smooth([[118, 252], [150, 214], [222, 202], [292, 192], [340, 168], [336, 220], [304, 268], [226, 290], [152, 286]]);
  const neck = strand([[146, 232], [132, 196], [122, 160], [118, 132]], 20, 14);
  const head = ellipse(118, 120, 26, 22);
  const beak = roundPoly([[96, 112], [58, 124], [96, 132]], 3);
  const wing = smooth([[178, 226], [238, 210], [300, 214], [272, 250], [214, 262]]);
  const legs = [poly([[186, 288], [180, 330], [160, 344], [200, 344], [188, 330]]), poly([[222, 286], [222, 326], [204, 344], [244, 344], [230, 326]])];
  const egg = ellipse(296, 312, 32, 40);
  return tpl(
    'golden-egg-goose',
    'Goose with a golden egg',
    'beginner',
    ['goose', 'golden-egg', 'egg', 'farm', 'storybook', 'beanstalk', 'kids'],
    [...stack([egg, beak, head, wing, neck, body, ...legs]), circle(116, 114, 4), sparkle(352, 252, 14), sparkle(230, 140, 9)],
    ['M 230 236 Q 252 230 276 232 M 222 248 Q 246 244 266 244', 'M 280 288 Q 284 300 282 310', 'M 30 352 L 370 352', 'M 70 124 L 92 122', grass(60, 352), grass(370, 352, 0.8)],
  );
}

// ---- 23. Mermaid holding a pearl (beginner) -------------------------------------------------

function mermaidPearlT(): Template {
  const face = circle(180, 116, 38);
  const hair = smooth([[132, 108], [140, 64], [180, 54], [222, 64], [232, 108], [228, 160], [238, 210], [218, 240], [206, 200], [154, 200], [140, 240], [122, 212], [130, 160]]);
  const bangs = 'M 143 112 C 142 80 164 70 180 70 C 196 70 220 80 217 112 C 204 96 192 92 180 84 C 168 94 156 98 143 112 Z';
  const body = roundPoly([[162, 152], [198, 152], [212, 252], [148, 252]], 12);
  const tail = strand([[180, 244], [188, 296], [226, 334], [286, 330], [318, 300]], 34, 7);
  const finA = petal(318, 300, 15, 52, 17, 0.6);
  const finB = petal(318, 300, 95, 52, 17, 0.6);
  const armL = strand([[164, 168], [150, 196], [160, 214]], 7, 6, true);
  const armR = strand([[196, 168], [210, 196], [200, 214]], 7, 6, true);
  const handL = circle(160, 214, 9);
  const handR = circle(200, 214, 9);
  const pearl = circle(180, 212, 20);
  const flower = blossom(222, 84, 11);
  return tpl(
    'mermaid-pearl',
    'Mermaid holding a pearl',
    'beginner',
    ['mermaid', 'pearl', 'tail', 'sea', 'storybook', 'kids', 'cute'],
    [...stack([flower, handL, handR, pearl, bangs, face, armL, armR, finA, finB, tail, body, hair]), circle(168, 120, 4), circle(194, 120, 4), smile(181, 134, 7, 4)],
    [
      circle(186, 204, 5),
      clip(scallops(150, 210, 246, 6, 3), [region(tail)]),
      clip('M 194 284 Q 204 290 214 286 M 210 306 Q 220 312 230 306 M 236 318 Q 246 324 256 318', [region(tail)], 'inside'),
      'M 40 360 Q 70 348 100 360 Q 130 372 160 360 Q 190 348 220 360 Q 250 372 280 360 Q 310 348 340 360',
      circle(300, 220, 6),
      circle(318, 190, 4),
      circle(80, 270, 5),
      sparkle(70, 120, 12),
    ],
  );
}

// ---- 24. Witch's bubbling cauldron (beginner) ----------------------------------------------

function cauldronT(): Template {
  const pot = 'M 104 212 C 82 296 130 338 200 338 C 270 338 318 296 296 212 Z';
  const rim = rrect(84, 192, 232, 28, 14);
  const brew = [circle(140, 192, 18), circle(176, 184, 22), circle(216, 186, 20), circle(254, 192, 17)];
  const legs = [rrect(124, 324, 18, 26, 6), rrect(258, 324, 18, 26, 6)];
  const logA = rotate(rrect(110, 346, 180, 18, 9), 6, 200, 355);
  const logB = rotate(rrect(110, 346, 180, 18, 9), -6, 200, 355);
  const ladle = rotate(rrect(254, 90, 12, 120, 6), 22, 260, 190);
  return tpl(
    'witch-cauldron',
    'Witch’s bubbling cauldron',
    'beginner',
    ['witch', 'cauldron', 'potion', 'magic', 'bubbles', 'halloween', 'kids'],
    [...stack([rim, ...legs, pot, logA, logB, brew, ladle]), circle(150, 140, 10), circle(196, 116, 14), circle(240, 86, 8), circle(120, 100, 6)],
    [circle(146, 136, 3), circle(190, 110, 4), 'M 150 260 Q 160 280 176 288', 'M 244 270 Q 238 290 224 298', softStar(320, 70, 14, 6, 5, 2), softStar(70, 180, 10, 4, 5, 1.5), sparkle(330, 160, 10), 'M 20 376 L 380 376'],
  );
}

// ---- 25. Young prince with a feathered cap (beginner) --------------------------------------

function youngPrinceT(): Template {
  const face = circle(200, 132, 50);
  const hair = 'M 150 130 C 148 88 176 76 200 76 C 226 76 254 88 250 130 C 238 112 220 106 200 104 C 182 108 162 114 150 130 Z';
  const cap = 'M 138 96 C 146 50 252 46 264 90 C 232 80 170 82 138 96 Z';
  const feather = petal(244, 72, 55, 78, 11, 0.55);
  const cape = roundPoly([[150, 186], [250, 186], [284, 326], [116, 326]], 14);
  const tunic = roundPoly([[166, 182], [234, 182], [246, 300], [154, 300]], 12);
  const legs = [rrect(170, 294, 24, 38, 8), rrect(206, 294, 24, 38, 8)];
  const boots = [rrect(160, 326, 38, 22, 9), rrect(202, 326, 38, 22, 9)];
  const armL = strand([[166, 196], [150, 234], [154, 262]], 9, 8, true);
  const armR = strand([[234, 196], [250, 234], [246, 262]], 9, 8, true);
  const hands = [circle(154, 266, 9), circle(246, 266, 9)];
  return tpl(
    'young-prince',
    'Young prince with a feathered cap',
    'beginner',
    ['prince', 'cap', 'feather', 'cape', 'royal', 'kids', 'cute'],
    [...stack([cap, feather, hair, face, ...hands, armL, armR, ...boots, tunic, ...legs, cape]), circle(182, 140, 5), circle(218, 140, 5), smile(200, 158, 9, 6), softStar(200, 236, 16, 7, 5, 2)],
    [ellipse(168, 156, 7, 4), ellipse(232, 156, 7, 4), veins(244, 72, 55, 78, 11, 3), line(158, 272, 242, 272), 'M 176 184 L 200 204 L 224 184', 'M 40 356 L 360 356', sparkle(70, 90, 12), sparkle(334, 200, 10)],
  );
}

// ---- 26. Bramble guards the bridge (intermediate) ------------------------------------------

function brambleBridgeT(): Template {
  const fig = placeFig(brambleFig(), 186, 236, 1.3);
  const deck = 'M 26 272 Q 200 198 374 272 L 374 292 Q 200 218 26 292 Z';
  const posts = [64, 124, 276, 336].map((x) => {
    const t = (x - 26) / 348;
    const y = (1 - t) * (1 - t) * 272 + 2 * t * (1 - t) * 198 + t * t * 272;
    return rrect(x - 6, y - 52, 12, 56, 4);
  });
  const rail = 'M 46 218 Q 200 148 354 218 L 354 228 Q 200 158 46 228 Z';
  const banner = flag(336, 186, 40, -1);
  const front = [...fig.layers];
  const layers = stack([...front, deck, ...posts, rail]);
  const planks: string[] = [];
  for (let x = 50; x < 370; x += 22) planks.push(`M ${f(x)} ${f(300)} L ${f(x)} ${f(190)}`);
  return tpl(
    'bramble-bridge',
    'Bramble guards the bridge',
    'intermediate',
    [...brambleTag, 'bridge', 'stream', 'storybook', 'kids'],
    [
      ...layers,
      ...fig.marks,
      hide(banner, front),
      'M 10 330 Q 60 300 110 312 M 290 312 Q 340 300 390 330',
      'M 40 352 Q 70 342 100 352 Q 130 362 160 352 M 180 364 Q 210 354 240 364 Q 270 374 300 364 M 250 336 Q 280 326 310 336',
      ellipse(60, 340, 20, 9),
      ellipse(344, 344, 24, 10),
    ],
    [
      ...fig.detail,
      clip(planks.join(' '), [region(deck)], 'inside'),
      hide(clip(planks.join(' '), [region(rail)], 'inside'), front),
      'M 20 300 L 14 270 M 26 300 L 30 266 M 380 302 L 386 270 M 374 302 L 368 268',
      grass(110, 312),
      grass(290, 312),
      'M 140 376 Q 160 370 180 376 M 60 380 Q 80 374 100 380',
      sparkle(80, 80, 12),
      sparkle(300, 60, 10),
      circle(120, 120, 3),
      'M 230 90 Q 238 84 246 90 Q 254 84 262 90',
    ],
  );
}

// ---- 27. Fern shelters under a toadstool (intermediate) ------------------------------------

function fernToadstoolT(): Template {
  const fig = placeFig(fernFig(), 226, 350, 1.5);
  const cap = `M 54 196 C 54 70 346 70 346 196 ${scallops(346, 54, 196, 8, 5).replace(/^M [\d.]+ [\d.]+/, '')} Z`;
  const stem = 'M 150 200 C 140 260 136 320 140 352 L 210 352 C 212 320 206 260 200 200 Z';
  const small = `M 300 300 C 300 270 360 270 360 300 Z`;
  const smallStem = rrect(322, 296, 16, 54, 6);
  const spots = [circle(120, 140, 14), circle(200, 106, 12), circle(280, 140, 15), circle(166, 162, 8), circle(240, 166, 9), circle(330, 180, 6), circle(80, 180, 6)];
  return tpl(
    'fern-toadstool',
    'Fern shelters under a toadstool',
    'intermediate',
    [...fernTag, 'toadstool', 'mushroom', 'rain', 'enchanted', 'kids'],
    [
      ...stack([...fig.layers, cap, stem, small, smallStem]),
      ...fig.marks,
      ...spots,
      hide(smokeCurl(330, 220, 0.8), fig.layers),
      hide('M 20 356 L 380 356', fig.layers),
    ],
    [
      ...fig.detail,
      'M 40 40 L 34 56 M 90 30 L 84 46 M 360 40 L 354 56 M 310 24 L 304 40 M 26 120 L 20 136 M 380 110 L 374 126',
      clip('M 160 220 L 158 330 M 178 214 L 176 340', [region(stem)], 'inside'),
      'M 70 232 L 76 226 M 110 236 L 114 228 M 290 232 L 286 226',
      circle(316, 286, 3),
      circle(342, 284, 2.5),
      grass(60, 356),
      grass(100, 356, 0.8),
      grass(370, 356, 0.9),
      'M 30 376 L 60 376 M 250 374 L 290 374',
    ],
  );
}

// ---- 28. Mossy the gentle forest giant (intermediate) --------------------------------------

function mossyGiantT(): Template {
  const fig = placeFig(mossyFig(), 200, 374, 1.12);
  return tpl(
    'mossy-giant',
    'Mossy the gentle forest giant',
    'intermediate',
    [...mossyTag, 'moss', 'storybook', 'kids'],
    [...stack(fig.layers), ...fig.marks, hide('M 20 376 L 380 376', fig.layers), blossom(40, 340, 9), blossom(366, 330, 10)],
    [...fig.detail, line(40, 349, 40, 376), line(366, 340, 366, 376), grass(80, 376), grass(330, 376), grass(20, 376, 0.8), sparkle(40, 60, 11), sparkle(360, 70, 9)],
  );
}

// ---- 29. Witch's crooked cottage (intermediate) --------------------------------------------

function witchCottageT(): Template {
  const walls = poly([[112, 344], [104, 222], [290, 212], [300, 344]]);
  const roof = 'M 78 230 L 180 74 C 192 52 212 36 240 30 C 224 44 216 60 218 80 L 318 218 Z';
  const chimney = poly([[256, 136], [262, 84], [286, 88], [278, 156]]);
  const door = 'M 172 344 L 168 272 Q 192 242 218 270 L 222 344 Z';
  const winL = circle(144, 266, 18);
  const winR = poly([[242, 250], [278, 247], [280, 284], [244, 287]]);
  const pumpkins = [ellipse(70, 334, 26, 20), ellipse(334, 338, 20, 15)];
  const moon = 'M 64 44 A 30 30 0 1 0 104 92 A 24 24 0 1 1 64 44 Z';
  const broomStick = rotate(rrect(316, 220, 7, 110, 3), 14, 320, 330);
  const bristles = rotate('M 310 312 L 330 312 L 340 350 L 300 350 Z', 14, 320, 330);
  const layers = stack([...pumpkins, broomStick, bristles, roof, chimney, walls]);
  const thatch = clip('M 120 210 L 190 90 M 150 216 L 206 84 M 186 214 L 216 100 M 230 210 L 220 120 M 270 214 L 230 150 M 100 220 L 170 110', [region(roof)], 'inside');
  return tpl(
    'witch-cottage',
    'Witch’s crooked cottage',
    'intermediate',
    ['witch', 'cottage', 'house', 'roof', 'broom', 'moon', 'halloween', 'storybook'],
    [...layers, door, winL, winR, moon, smokeCurl(268, 80, 1.3), 'M 20 346 Q 200 336 380 348'],
    [
      thatch,
      'M 144 248 L 144 284 M 126 266 L 162 266',
      'M 260 248 L 262 286 M 243 268 L 279 266',
      circle(210, 310, 3),
      'M 178 290 L 212 290 M 176 318 L 214 318',
      'M 70 314 Q 70 334 70 354 M 56 318 Q 52 334 58 350 M 84 318 Q 88 334 82 350',
      'M 70 314 Q 74 306 80 306',
      'M 334 323 L 334 353',
      softStar(150, 40, 9, 4, 5, 1.5),
      softStar(340, 60, 11, 5, 5, 1.5),
      sparkle(30, 160, 8),
      'M 120 300 L 140 304 M 260 318 L 284 314 M 230 230 L 250 232',
      'M 186 360 Q 196 354 206 360 M 196 374 Q 208 368 220 374',
      'M 30 380 Q 40 370 50 380',
      clip('M 248 104 L 280 108 M 250 124 L 276 128', [region(chimney)], 'inside'),
    ],
  );
}

// ---- 30. Candy cottage with an icing roof (intermediate) -----------------------------------

function candyCottageT(): Template {
  const walls = poly([[104, 344], [104, 204], [296, 204], [296, 344]]);
  const roof = `M 78 214 L 200 94 L 322 214 ${scallops(322, 78, 214, 9, 8).replace(/^M [\d.]+ [\d.]+/, '')} Z`;
  const chimney = rrect(244, 100, 28, 70, 4);
  const chimCap = `M 238 104 C 238 92 278 92 278 104 ${scallops(278, 238, 104, 3, 4).replace(/^M [\d.]+ [\d.]+/, '')} Z`;
  const door = archWin(172, 344, 56, 86);
  const winL = circle(140, 262, 22);
  const winR = circle(260, 262, 22);
  const cane = (x: number, dir: number) => strand([[x, 346], [x, 280], [x + dir * 2, 262], [x + dir * 14, 254], [x + dir * 26, 262]], 6, 6, true);
  const caneL = cane(60, 1);
  const caneR = cane(340, -1);
  const gumdrops = [ellipse(150, 166, 12, 10), ellipse(200, 132, 12, 10), ellipse(250, 172, 12, 10), ellipse(112, 202, 9, 8), ellipse(288, 202, 9, 8)];
  const layers = stack([chimCap, ...gumdrops, roof, chimney, caneL, caneR, walls]);
  return tpl(
    'candy-cottage',
    'Candy cottage with an icing roof',
    'intermediate',
    ['cottage', 'candy', 'sweets', 'icing', 'candy-cane', 'storybook', 'kids', 'house'],
    [...layers, door, winL, winR, heart(200, 300, 22), 'M 20 346 L 380 346'],
    [
      `M 140 240 L 140 284 M 118 262 L 162 262 M 260 240 L 260 284 M 238 262 L 282 262`,
      ...Array.from({ length: 8 }, (_, i) => circle(...polar(140, 262, 27, i * 45), 2)),
      ...Array.from({ length: 8 }, (_, i) => circle(...polar(260, 262, 27, i * 45), 2)),
      clip('M 54 330 L 66 322 M 54 314 L 66 306 M 54 298 L 66 290 M 54 282 L 66 274', [region(caneL)], 'inside'),
      clip('M 334 330 L 346 322 M 334 314 L 346 306 M 334 298 L 346 290 M 334 282 L 346 274', [region(caneR)], 'inside'),
      clip(hatch(walls, 45, 22, [104, 204, 296, 344]), [region(door), region(winL), region(winR), region(roof), region(caneL), region(caneR)]),
      circle(166, 182, 4),
      circle(228, 150, 4),
      circle(216, 196, 4),
      circle(220, 300, 3),
      'M 150 362 Q 160 356 170 362 M 190 370 Q 200 364 210 370 M 230 362 Q 240 356 250 362',
    ],
  );
}

// ---- 31. Fox in a waistcoat (intermediate) -------------------------------------------------

function foxWaistcoatT(): Template {
  const head = smooth([[146, 104], [160, 78], [200, 68], [240, 78], [254, 104], [236, 136], [200, 156], [164, 136]]);
  const earL = roundPoly([[154, 96], [148, 34], [192, 74]], 6);
  const earR = mirrorX(earL, 200);
  const torso = roundPoly([[160, 160], [240, 160], [254, 292], [146, 292]], 22);
  const vest = poly([[166, 176], [200, 236], [234, 176], [246, 286], [154, 286]]);
  const tail = smooth([[236, 260], [300, 250], [344, 200], [356, 150], [330, 170], [300, 220], [244, 236]]);
  const armL = strand([[164, 178], [138, 220], [142, 256]], 11, 10, true);
  const armR = strand([[236, 178], [264, 214], [262, 250]], 11, 10, true);
  const pawL = circle(142, 260, 11);
  const pawR = circle(262, 254, 11);
  const legs = [rrect(162, 286, 30, 50, 10), rrect(208, 286, 30, 50, 10)];
  const feet = [ellipse(172, 340, 22, 10), ellipse(228, 340, 22, 10)];
  const bowL = petal(200, 162, 270, 24, 9, 0.6);
  const bowR = petal(200, 162, 90, 24, 9, 0.6);
  const watch = circle(290, 270, 15);
  const layers = stack([watch, circle(200, 162, 5), bowL, bowR, pawL, pawR, armL, armR, head, earL, earR, ...feet, vest, torso, ...legs, tail]);
  return tpl(
    'fox-waistcoat',
    'Fox in a waistcoat',
    'intermediate',
    ['fox', 'waistcoat', 'talking', 'animal', 'storybook', 'gentleman', 'kids'],
    [
      ...layers,
      'M 168 128 Q 200 118 232 128 Q 214 152 200 156 Q 186 152 168 128 Z',
      ellipse(200, 146, 7, 5),
      ellipse(180, 110, 5, 6),
      ellipse(220, 110, 5, 6),
      circle(200, 252, 3.5),
      circle(200, 270, 3.5),
      hide('M 214 230 Q 250 250 278 262', [watch, pawR]),
    ],
    [
      clip(poly([[160, 90], [154, 50], [182, 78]], false), [region(head)]),
      clip(poly([[240, 90], [246, 50], [218, 78]], false), [region(head)]),
      'M 286 262 L 290 270 L 298 266',
      circle(290, 270, 11),
      clip('M 340 162 Q 320 190 312 214', [region(tail)], 'inside'),
      'M 176 236 L 188 240 M 212 240 L 224 236',
      clip('M 150 268 L 158 262 M 248 268 L 240 262', [region(vest)], 'inside'),
      'M 160 340 L 164 334 M 216 340 L 220 334',
      'M 130 252 L 136 258 M 252 246 L 258 252',
      'M 60 352 L 340 352',
      'M 236 120 L 260 116 M 236 126 L 258 128',
      'M 164 120 L 140 116 M 164 126 L 142 128',
      sparkle(70, 90, 10),
    ],
  );
}

// ---- 32. Cat in tall boots with a satchel (intermediate) -----------------------------------

function catBootsT(): Template {
  const head = ellipse(190, 112, 50, 44);
  const earL = roundPoly([[148, 96], [146, 44], [184, 74]], 6);
  const earR = roundPoly([[232, 96], [234, 44], [196, 74]], 6);
  const body = roundPoly([[156, 150], [224, 150], [236, 270], [144, 270]], 22);
  const scarf = roundPoly([[156, 148], [224, 148], [190, 196]], 6);
  const legs = [rrect(152, 262, 30, 40, 10), rrect(198, 262, 30, 40, 10)];
  const bootL = 'M 146 278 L 188 278 L 186 334 L 194 334 C 200 334 202 350 194 350 L 146 350 Z';
  const bootR = 'M 196 278 L 238 278 L 238 334 L 244 334 C 252 334 254 350 244 350 L 196 350 Z';
  const cuffL = rrect(140, 272, 54, 18, 6);
  const cuffR = rrect(190, 272, 54, 18, 6);
  const tail = strand([[146, 252], [104, 250], [80, 220], [86, 186], [104, 182]], 10, 6, true);
  const armL = strand([[158, 166], [140, 204], [146, 232]], 10, 9, true);
  const armR = strand([[222, 166], [252, 196], [262, 222]], 10, 9, true);
  const pawL = circle(146, 236, 10);
  const pawR = circle(264, 226, 10);
  const stick = rrect(260, 200, 8, 152, 4);
  const knob = circle(264, 196, 9);
  const bag = rrect(204, 220, 48, 40, 8);
  const flapBag = 'M 204 232 L 204 228 Q 204 220 212 220 L 244 220 Q 252 220 252 228 L 252 236 Q 228 248 204 236 Z';
  const layers = stack([pawR, knob, stick, flapBag, bag, pawL, armL, armR, scarf, head, earL, earR, cuffL, cuffR, bootL, bootR, body, ...legs, tail]);
  return tpl(
    'cat-boots',
    'Cat in tall boots with a satchel',
    'intermediate',
    ['cat', 'boots', 'satchel', 'talking', 'animal', 'storybook', 'traveller', 'kids'],
    [
      ...layers,
      ellipse(172, 110, 6, 8),
      ellipse(208, 110, 6, 8),
      'M 184 126 L 196 126 L 190 132 Z',
      'M 180 140 Q 185 144 190 138 Q 195 144 200 140',
      hide('M 158 160 L 218 222', [scarf, bag, flapBag, armL, armR, head]),
      circle(228, 240, 3),
    ],
    [
      'M 150 128 L 120 122 M 150 136 L 122 140 M 230 128 L 260 122 M 230 136 L 258 140',
      clip(poly([[154, 92], [152, 58], [176, 76]], false), [region(head)]),
      clip(poly([[226, 92], [228, 58], [204, 76]], false), [region(head)]),
      'M 176 76 L 180 88 M 190 72 L 190 86 M 204 76 L 200 88',
      clip('M 92 214 L 104 216 M 96 238 L 108 234 M 120 252 L 124 244', [region(tail)], 'inside'),
      'M 150 318 L 184 318 M 200 318 L 236 318',
      'M 160 168 L 172 178 M 220 168 L 208 178',
      'M 60 354 L 340 354',
      'M 136 236 L 140 230 M 270 232 L 274 226',
      sparkle(330, 90, 11),
      sparkle(70, 110, 8),
    ],
  );
}

// ---- 33. Troll under the stone bridge (intermediate) ---------------------------------------

function trollBridgeT(): Template {
  const bridge = 'M 14 130 L 386 130 L 386 300 L 320 300 C 320 176 80 176 80 300 L 14 300 Z';
  const parapet = poly([[14, 130], ...crenels(14, 386, 104, 16, 12), [386, 130]]);
  const head = ellipse(200, 256, 54, 46);
  const earL = petal(152, 248, 284, 32, 11, 0.5);
  const earR = petal(248, 248, 76, 32, 11, 0.5);
  const nose = ellipse(200, 262, 13, 18);
  const shoulders = ellipse(200, 320, 92, 40);
  const hand = (x: number, y: number, s: number): string[] => [circle(x - 10 * s, y - 2, 8), circle(x, y - 5, 8.5), circle(x + 10 * s, y - 2, 8), ellipse(x, y + 8, 15, 11)];
  const handL = hand(94, 250, 1);
  const handR = hand(306, 250, -1);
  const tuft = 'M 184 214 C 176 194 190 186 196 204 C 198 184 212 186 208 208 C 220 194 230 204 216 216 Z';
  const water = 'M 14 312 Q 50 302 86 312 Q 122 322 158 312 Q 194 302 230 312 Q 266 322 302 312 Q 338 302 386 312 L 386 390 L 14 390 Z';
  const layers = stack([handL, handR, water, bridge, parapet, nose, tuft, head, earL, earR, shoulders]);
  layers[2] = 'M 14 312 Q 50 302 86 312 Q 122 322 158 312 Q 194 302 230 312 Q 266 322 302 312 Q 338 302 386 312';
  const rows = [160, 190, 220, 250, 280];
  let joints = '';
  rows.forEach((y, r) => {
    joints += ` M 14 ${y} L 386 ${y}`;
    for (let x = 14 + (r % 2 ? 36 : 0) + 34; x < 386; x += 72) joints += ` M ${x} ${y - 30} L ${x} ${y}`;
  });
  joints += ' M 50 280 L 50 300 M 350 280 L 350 300';
  const stones = clip(joints.trim(), [region(bridge)], 'inside');
  return tpl(
    'troll-bridge',
    'Troll under the stone bridge',
    'intermediate',
    ['troll', 'bridge', 'stone', 'river', 'storybook', 'whimsical', 'kids'],
    [
      ...layers,
      bigEye(181, 240, 7, 7),
      bigEye(219, 240, 7, 7),
      'M 170 284 Q 200 300 230 284',
      poly([[180, 289], [186, 289], [183, 281]]),
      poly([[214, 289], [220, 289], [217, 281]]),
    ],
    [
      clip(stones, [region(handL), region(handR)]),
      'M 168 226 Q 180 220 192 226 M 208 226 Q 220 220 232 226',
      ellipse(166, 266, 7, 4),
      ellipse(234, 266, 7, 4),
      'M 40 340 Q 60 332 80 340 M 120 352 Q 140 344 160 352 M 240 346 Q 260 338 280 346 M 320 360 Q 340 352 360 360 M 170 372 Q 190 366 210 372',
      'M 30 70 Q 40 62 50 70 Q 60 62 70 70',
      'M 260 60 Q 268 52 276 60 Q 284 52 292 60',
      sparkle(340, 56, 10),
      'M 20 312 L 14 290 M 380 312 L 386 288',
    ],
  );
}

// ---- 34. Princess with a lantern (intermediate) --------------------------------------------

function princessLanternT(): Template {
  const face = circle(180, 112, 34);
  const curls = [circle(148, 96, 16), circle(156, 72, 16), circle(180, 62, 17), circle(204, 70, 16), circle(214, 94, 15), circle(146, 122, 14), circle(216, 120, 13)];
  const bangs = 'M 152 104 C 150 82 168 76 180 78 C 196 76 212 84 210 104 C 196 96 188 92 180 88 C 172 96 164 98 152 104 Z';
  const tiara = roundPoly([[166, 66], [168, 46], [176, 56], [182, 40], [188, 56], [196, 46], [196, 66]], 2.5);
  const cloak = smooth([[146, 150], [214, 150], [248, 250], [270, 346], [90, 346], [112, 250]]);
  const bodice = roundPoly([[164, 146], [196, 146], [204, 214], [156, 214]], 8);
  const skirt = `M 160 206 C 140 250 122 300 112 336 ${scallops(112, 248, 336, 7, 5).replace(/^M [\d.]+ [\d.]+/, '')} C 238 300 220 250 200 206 Z`;
  const armR = strand([[198, 160], [230, 184], [262, 190]], 7, 6, true);
  const hand = circle(264, 190, 8);
  const loop = 'M 262 198 C 254 206 256 214 268 214 C 280 214 282 206 274 198';
  const top = roundPoly([[252, 214], [284, 214], [292, 226], [244, 226]], 3);
  const lantern = roundPoly([[248, 226], [288, 226], [294, 280], [242, 280]], 4);
  const base = rrect(238, 280, 60, 10, 4);
  const flame = petal(268, 264, 0, 24, 7, 0.4);
  const armL = strand([[162, 160], [140, 200], [148, 228]], 7, 6, true);
  const handL = circle(150, 230, 8);
  const layers = stack([hand, armR, handL, armL, tiara, bangs, face, ...curls.map((c) => c), bodice, skirt, cloak]);
  return tpl(
    'princess-lantern',
    'Princess with a lantern',
    'intermediate',
    ['princess', 'lantern', 'cloak', 'tiara', 'night', 'storybook', 'kids'],
    [...stack([top, lantern, base]), flame, hide(loop, [hand]), ...layers, circle(168, 116, 4), circle(194, 116, 4), smile(181, 130, 7, 4)],
    [
      circle(182, 50, 2.5),
      ellipse(158, 128, 6, 3.5),
      ellipse(204, 128, 6, 3.5),
      clip('M 258 226 L 256 280 M 278 226 L 280 280', [region(flame)]),
      'M 310 220 L 324 214 M 312 250 L 328 252 M 300 196 L 310 184 M 226 248 L 214 252',
      clip('M 160 250 Q 150 290 146 330 M 200 250 Q 210 290 214 330 M 180 236 L 180 334', [region(skirt)], 'inside'),
      clip('M 120 300 L 106 340 M 250 300 L 262 340', [region(cloak)], 'inside'),
      'M 164 160 L 180 176 L 196 160',
      softStar(70, 80, 12, 5, 5, 1.5),
      softStar(330, 110, 9, 4, 5, 1.5),
      'M 60 160 A 22 22 0 1 0 84 196 A 17 17 0 1 1 60 160 Z',
      'M 40 356 L 360 356',
      circle(340, 300, 2.5),
    ],
  );
}

// ---- 35. Mossy carries Bramble through the forest (advanced) -------------------------------

function mossyCarriesT(): Template {
  const mossy = placeFig(mossyFig(), 196, 378, 1.0);
  const bram = placeFig(brambleFig(), 290, 198, 0.72);
  const tL = tree(66, 372, 300, 38);
  const tR = tree(346, 372, 250, 30);
  const tB = tree(120, 300, 150, 30);
  const path = 'M 120 390 C 150 370 170 360 176 350 M 280 390 C 250 370 236 360 230 350';
  const front = [...bram.layers, ...mossy.layers];
  const layers = stack([...bram.layers, ...mossy.layers, ...tR.layers, ...tL.layers, ...tB.layers]);
  const mushrooms = [`M 300 360 C 300 342 330 342 330 360 Z`, rrect(310, 358, 10, 18, 3), `M 60 380 C 60 366 84 366 84 380 Z`, rrect(68, 378, 8, 12, 3)];
  return tpl(
    'mossy-carries-bramble',
    'Mossy carries Bramble through the forest',
    'advanced',
    ['cast', 'mossy', 'bramble', 'giant', 'hedgehog', 'forest', 'storybook'],
    [...layers, ...bram.marks, ...mossy.marks.map((d) => hide(d, bram.layers)), ...stack(mushrooms).map((d) => hide(d, front)), hide(path, front)],
    [
      ...bram.detail,
      ...mossy.detail.map((d) => hide(d, bram.layers)),
      ...tL.detail.map((d) => hide(d, front)),
      ...tR.detail.map((d) => hide(d, front)),
      ...tB.detail.map((d) => hide(d, front)),
      hide('M 10 378 L 390 378', front),
      grass(150, 384),
      grass(250, 386),
      grass(20, 386, 0.8),
      grass(384, 384, 0.8),
      circle(308, 350, 3),
      circle(320, 352, 2.5),
      hide(sparkle(150, 60, 9), front),
      hide(sparkle(260, 40, 7), front),
      hide('M 196 30 Q 204 24 212 30 Q 220 24 228 30', front),
      hide('M 330 40 Q 336 34 342 40 Q 348 34 354 40', front),
      circle(100, 340, 2.5),
      circle(130, 320, 2.5),
      circle(370, 330, 2.5),
    ],
  );
}

// ---- 36. Beanstalk to a castle in the clouds (advanced) ------------------------------------

function beanstalkT(): Template {
  const stalkC: P[] = [[196, 392], [226, 340], [178, 286], [222, 226], [182, 172], [214, 128], [204, 100]];
  const stalk = strand(stalkC, 13, 6);
  const leafAt: [number, number, number, number][] = [
    [214, 352, 60, 58], [196, 312, -70, 54], [196, 262, 70, 50], [208, 214, -60, 48], [196, 182, 65, 42], [204, 146, -65, 34],
  ];
  const leaves = leafAt.map(([x, y, a, l]) => petal(x, y, a, l, l * 0.3, 0.45));
  const cloud = [...puff(140, 116, 180, 70), ...puff(270, 124, 190, 66)];
  const keep = poly([[220, 96], ...crenels(220, 290, 52, 10, 4), [290, 96]]);
  const towerL = rrect(196, 42, 26, 60, 2);
  const towerR = rrect(288, 44, 26, 60, 2);
  const roofL = roundPoly([[190, 46], [209, 20], [228, 46]], 2);
  const roofR = roundPoly([[282, 48], [301, 24], [320, 48]], 2);
  const hills = 'M 10 372 C 80 340 140 350 200 360 C 260 350 320 336 390 368 L 390 392 L 10 392 Z';
  const cot = house(36, 370, 62, 38, 30);
  const fence = 'M 280 372 L 380 372 M 280 360 L 380 360';
  const layers = stack([...leaves, cloud, stalk, keep, roofL, roofR, towerL, towerR, ...cot.layers, hills]);
  const hillLine = 'M 10 372 C 80 340 140 350 200 360 C 260 350 320 336 390 368';
  const out = layers.slice(0, -1);
  const front = [...leaves, cloud, stalk];
  return tpl(
    'beanstalk-clouds',
    'Beanstalk to a castle in the clouds',
    'advanced',
    ['beanstalk', 'castle', 'clouds', 'giant', 'leaves', 'storybook', 'kids'],
    [
      ...out,
      hide(hillLine, [...front, ...cot.layers]),
      ...cot.marks,
      hide(fence, front),
      hide(archWin(246, 96, 18, 26), [cloud]),
      'M 206 92 C 230 78 246 94 232 104 C 222 112 214 100 224 96',
      'M 196 300 C 160 300 150 280 166 272 C 178 268 182 282 172 284',
      'M 222 200 C 254 196 262 176 246 170 C 236 168 232 180 242 182',
    ],
    [
      ...leafAt.map(([x, y, a, l]) => veins(x, y, a, l, l * 0.3, 3)),
      hide(clip('M 186 380 L 210 360 M 196 330 L 214 318 M 186 300 L 204 284 M 200 250 L 214 238 M 186 200 L 206 188 M 198 150 L 210 140', [region(stalk)], 'inside'), leaves),
      ...[290, 304, 318, 332, 346, 360, 374].map((x) => hide(line(x, 354, x, 376), front)),
      'M 90 140 Q 110 130 130 138 M 260 146 Q 290 136 320 144',
      clip('M 230 62 L 280 62 M 230 76 L 280 76 M 242 62 L 242 76 M 262 62 L 262 76 M 252 76 L 252 92', [region(keep)], 'inside'),
      'M 30 160 Q 40 152 50 160 Q 60 152 70 160',
      'M 330 170 Q 338 162 346 170 Q 354 162 362 170',
      sparkle(360, 230, 10),
      sparkle(60, 250, 8),
      grass(120, 360),
      grass(260, 362),
      grass(160, 380, 0.8),
      smokeCurl(80, 300, 0.8),
      circle(150, 330, 2.5),
      circle(340, 300, 2.5),
    ],
  );
}

// ---- 37. Enchanted forest path (advanced) --------------------------------------------------

function forestPathT(): Template {
  const trunkL = 'M 20 392 C 40 380 56 370 58 340 L 66 120 C 50 90 30 70 14 60 L 20 50 C 40 60 60 76 76 100 C 92 70 110 50 140 36 L 146 46 C 116 64 96 92 88 124 L 92 340 C 94 370 110 382 130 392 Z';
  const trunkR = mirrorX(trunkL, 200);
  const canopy = [circle(62, 66, 42), circle(130, 60, 40), circle(200, 58, 38), circle(270, 60, 40), circle(338, 66, 42)];
  const midL = tree(130, 250, 130, 30);
  const midR = tree(280, 246, 124, 28);
  const farL = tree(170, 214, 70, 18);
  const farR = tree(240, 212, 64, 16);
  const pathD = 'M 136 392 C 170 330 200 280 194 222 L 212 222 C 220 280 250 330 290 392 Z';
  const door = archWin(62, 330, 22, 34);
  const lanternPost = rrect(314, 250, 8, 120, 3);
  const lanternBox = roundPoly([[300, 236], [336, 236], [332, 270], [304, 270]], 3);
  const lanternTop = roundPoly([[296, 236], [318, 220], [340, 236]], 2);
  const toad = [`M 150 336 C 150 316 186 316 186 336 Z`, rrect(162, 334, 12, 20, 4), `M 230 350 C 230 336 254 336 254 350 Z`, rrect(238, 348, 8, 14, 3)];
  const front = [door, trunkL, trunkR, canopy];
  const layers = stack([door, lanternTop, lanternBox, lanternPost, trunkL, trunkR, canopy, ...toad, pathD, ...midL.layers, ...midR.layers, ...farL.layers, ...farR.layers]);
  return tpl(
    'enchanted-forest-path',
    'Enchanted forest path',
    'advanced',
    ['enchanted', 'forest', 'path', 'trees', 'lantern', 'toadstool', 'storybook'],
    [...layers, petal(318, 262, 0, 18, 5, 0.4), circle(78, 316, 2.5)],
    [
      ...midL.detail.map((d) => hide(d, [...front, pathD])),
      ...midR.detail.map((d) => hide(d, [...front, pathD, lanternPost, lanternBox])),
      ...farL.detail,
      ...farR.detail,
      clip('M 70 160 Q 74 200 70 240 M 80 260 Q 84 290 80 320 M 76 130 Q 80 150 78 170', [region(trunkL)], 'inside'),
      clip(mirrorX('M 70 160 Q 74 200 70 240 M 80 260 Q 84 290 80 320 M 76 130 Q 80 150 78 170', 200), [region(trunkR)], 'inside'),
      line(73, 296, 73, 330),
      'M 158 324 L 162 320 M 172 322 L 176 326 M 238 344 L 242 340',
      hide('M 100 270 L 300 270', [...front, pathD, ...midL.layers, ...midR.layers, lanternPost, ...farL.layers, ...farR.layers]),
      sparkle(150, 150, 8),
      sparkle(250, 130, 7),
      sparkle(200, 180, 6),
      sparkle(120, 290, 6),
      sparkle(280, 300, 7),
      circle(170, 120, 2.5),
      circle(232, 160, 2.5),
      circle(260, 200, 2),
      circle(140, 210, 2),
      'M 304 252 L 332 252',
      hide(clip('M 186 300 L 196 304 M 176 340 L 190 344 M 210 280 L 222 284 M 226 330 L 240 334 M 164 372 L 180 376 M 246 368 L 262 372', [region(pathD)], 'inside'), [...toad]),
      ...[100, 116, 290, 300].map((x) => grass(x, 392, 0.9)),
      hide(petal(130, 392, -40, 40, 10, 0.4) + ' ' + petal(130, 392, -10, 44, 10, 0.4), [trunkL]),
      hide(petal(272, 392, 40, 40, 10, 0.4) + ' ' + petal(272, 392, 10, 44, 10, 0.4), [trunkR]),
    ],
  );
}

// ---- 38. Sleeping dragon before a cliff castle (advanced) ----------------------------------

function sleepingDragonT(): Template {
  const body = smooth([[124, 330], [146, 282], [200, 254], [270, 258], [322, 290], [334, 338], [300, 360], [200, 364], [146, 356]]);
  const neck = strand([[160, 306], [130, 300], [104, 302]], 22, 18);
  const head = ellipse(84, 298, 38, 28);
  const snout = ellipse(50, 310, 26, 17);
  const hornA = petal(98, 274, -62, 32, 7, 0.4);
  const hornB = petal(112, 278, -40, 28, 7, 0.4);
  const spikes = ([[166, 274, -40], [200, 258, -14], [238, 254, 6], [276, 262, 26], [308, 282, 48]] as const).map(([x, y, a]) => {
    const tip = polar(x, y, 24, a);
    const l = polar(x, y, 12, a - 90);
    const r = polar(x, y, 12, a + 90);
    return roundPoly([l, tip, r, polar(x, y, 8, a + 180)], 3);
  });
  const wing = roundPoly([[192, 304], [212, 232], [296, 228], [282, 254], [262, 258], [248, 280], [226, 288]], 5);
  const tail = strand([[316, 344], [306, 368], [250, 376], [180, 374], [138, 366]], 14, 4);
  const tip = roundPoly([[142, 366], [122, 352], [104, 368], [122, 382]], 3);
  const paw = ellipse(112, 338, 24, 11);
  const crag = 'M 150 262 C 168 238 184 222 194 200 C 202 186 212 180 226 176 L 336 176 C 350 188 362 210 374 232 C 380 244 384 252 384 262 Z';
  const keep = poly([[230, 178], ...crenels(230, 330, 96, 12, 5), [330, 178]]);
  const towerA = rrect(206, 86, 34, 92, 2);
  const towerB = rrect(324, 102, 34, 76, 2);
  const roofA = roundPoly([[198, 90], [223, 42], [248, 90]], 3);
  const roofB = roundPoly([[316, 106], [341, 64], [366, 106]], 3);
  const hills = 'M 10 262 C 60 240 110 246 160 258 L 160 300 L 10 300 Z';
  const front: Layer[] = [paw, [head, snout], hornA, hornB, tip, tail, wing, neck, body, ...spikes];
  const layers = stack([...front, roofA, roofB, towerA, towerB, keep, crag, hills]);
  layers[layers.length - 1] = hide('M 10 262 C 60 240 110 246 160 258', front);
  const z = (x: number, y: number, s: number): string => poly([[x, y], [x + s, y], [x, y + s], [x + s, y + s]], false);
  return tpl(
    'sleeping-dragon-castle',
    'Sleeping dragon before a cliff castle',
    'advanced',
    ['dragon', 'castle', 'cliff', 'sleeping', 'storybook', 'kingdom', 'fantasy'],
    [
      ...layers,
      'M 72 292 Q 84 302 96 292',
      circle(34, 304, 2.5),
      archWin(270, 178, 24, 34),
      archWin(216, 136, 14, 22),
      archWin(334, 146, 14, 22),
      flag(223, 42, 22),
      z(40, 236, 14),
      z(62, 212, 10),
      z(78, 194, 7),
    ],
    [
      clip('M 212 232 L 282 254 M 212 232 L 248 280 M 212 232 L 226 288', [region(wing)], 'inside'),
      hide(clip('M 150 340 Q 220 352 320 336 M 160 326 Q 230 338 326 322', [region(body)], 'inside'), [wing, paw, tail]),
      clip('M 150 372 L 156 360 M 190 376 L 196 364 M 230 378 L 236 366 M 270 376 L 276 364', [region(tail)], 'inside'),
      'M 100 338 L 102 344 M 112 340 L 114 346 M 124 338 L 126 344',
      ellipse(92, 310, 8, 4),
      clip('M 230 126 L 330 126 M 230 150 L 330 150 M 260 102 L 260 126 M 300 102 L 300 126 M 250 126 L 250 150 M 320 126 L 320 150', [region(keep)], 'inside'),
      hide(clip('M 200 206 L 222 216 M 362 216 L 340 236 M 184 238 L 206 250 M 330 196 L 350 210', [region(crag)], 'inside'), front),
      'M 120 150 Q 128 142 136 150 Q 144 142 152 150',
      'M 150 110 Q 156 104 162 110 Q 168 104 174 110',
      sparkle(370, 40, 10),
      sparkle(60, 60, 8),
      sparkle(130, 200, 6),
      grass(30, 362),
      grass(370, 372, 0.9),
      'M 10 384 L 110 384 M 340 384 L 390 384',
    ],
  );
}

// ---- 39. The bear family's cottage table (advanced) ----------------------------------------

function bearTableT(): Template {
  const win = rrect(150, 40, 100, 110, 6);
  const curtainL = 'M 136 30 L 176 30 C 170 70 160 110 174 156 L 136 156 Z';
  const curtainR = mirrorX(curtainL, 200);
  const rod = rrect(126, 24, 148, 8, 4);
  const top = rrect(40, 236, 320, 22, 8);
  const apron = rrect(56, 256, 288, 22, 4);
  const legs = [rrect(64, 276, 18, 96, 5), rrect(318, 276, 18, 96, 5)];
  const chairBig = rrect(56, 132, 82, 110, 14);
  const chairMid = rrect(162, 166, 70, 76, 12);
  const chairSmall = rrect(258, 192, 54, 50, 10);
  const bowl = (cx: number, w: number): string => `M ${f(cx - w)} ${f(236 - w * 0.9)} C ${f(cx - w)} ${f(236 + w * 0.15)} ${f(cx + w)} ${f(236 + w * 0.15)} ${f(cx + w)} ${f(236 - w * 0.9)} Z`;
  const bowls = [bowl(98, 34), bowl(198, 26), bowl(286, 19)];
  const bowlRims = [ellipse(98, 205.4, 34, 6), ellipse(198, 212.6, 26, 5), ellipse(286, 218.9, 19, 4)];
  const spoonA = rotate(rrect(126, 168, 6, 44, 3), 24, 129, 210);
  const bear = (cx: number, cy: number, r: number): { frame: string; inner: string[] } => ({
    frame: ellipse(cx, cy, r * 1.25, r * 1.45),
    inner: [...stack([ellipse(cx, cy + r * 0.3, r * 0.42, r * 0.32), [circle(cx, cy, r * 0.8), circle(cx - r * 0.62, cy - r * 0.62, r * 0.3), circle(cx + r * 0.62, cy - r * 0.62, r * 0.3)]]), circle(cx - r * 0.3, cy - r * 0.1, r * 0.08), circle(cx + r * 0.3, cy - r * 0.1, r * 0.08), circle(cx, cy + r * 0.2, r * 0.1)],
  });
  const bA = bear(64, 74, 30);
  const bB = bear(318, 70, 24);
  const bC = bear(362, 130, 17);
  const rug = ellipse(200, 372, 150, 18);
  const front = [...bowls, spoonA, top, apron, ...legs];
  const layers = stack([...bowls, spoonA, top, apron, ...legs, chairBig, chairMid, chairSmall, curtainL, curtainR, rod, win, rug]);
  return tpl(
    'bear-family-table',
    'The bear family’s cottage table',
    'advanced',
    ['bear', 'cottage', 'table', 'bowls', 'chairs', 'storybook', 'kitchen', 'talking'],
    [...layers, ...bowlRims.map((d) => hide(d, [spoonA])), bA.frame, bB.frame, hide(bC.frame, [curtainR]), ...bA.inner, ...bB.inner, ...bC.inner.map((d) => hide(d, [curtainR])), hide(heart(97, 162, 26), front), hide(heart(197, 194, 22), front), hide(heart(285, 214, 16), front)],
    [
      hide(clip('M 200 40 L 200 150 M 150 96 L 250 96', [region(win)], 'inside'), [curtainL, curtainR]),
      'M 88 192 C 84 182 94 178 90 168 M 104 192 C 100 182 110 178 106 168',
      'M 194 200 C 190 190 200 186 196 176',
      'M 284 208 C 280 200 288 196 284 188',
      'M 60 247 L 120 247 M 160 247 L 260 247 M 300 247 L 340 247',
      clip('M 148 40 C 156 80 150 120 160 150 M 160 40 C 164 70 160 110 168 150', [region(curtainL)], 'inside'),
      clip(mirrorX('M 148 40 C 156 80 150 120 160 150 M 160 40 C 164 70 160 110 168 150', 200), [region(curtainR)], 'inside'),
      hide('M 10 300 L 56 300 M 344 300 L 390 300 M 10 340 L 64 340 M 336 340 L 390 340', [rug]),
      hide('M 30 300 L 30 340 M 370 300 L 370 340 M 46 340 L 46 380 M 360 340 L 360 384', [rug]),
      clip('M 70 372 L 330 372', [region(rug)], 'inside'),
      clip(ellipse(200, 372, 120, 12), [region(rug)], 'inside'),
      clip('M 100 362 L 104 382 M 150 360 L 152 384 M 250 360 L 248 384 M 300 362 L 296 382', [region(rug)], 'inside'),
      'M 166 60 Q 176 56 186 62 M 214 70 Q 224 64 234 70',
      'M 10 380 L 390 380',
      'M 68 286 L 68 360 M 330 286 L 330 360',
    ],
  );
}

// ---- 40. Fern's first flight over the village (advanced) -----------------------------------

function fernFlightT(): Template {
  const fern = turnFig(placeFig(fernFig(), 196, 196, 1.15), -14, 196, 150);
  const hills = 'M 10 300 C 80 270 150 280 210 292 C 270 280 330 266 390 286 L 390 392 L 10 392 Z';
  const hA = house(36, 362, 70, 46, 34);
  const hB = house(128, 356, 60, 40, 30);
  const hC = house(292, 360, 72, 48, 36);
  const towerBody = rrect(214, 236, 40, 124, 2);
  const towerRoof = roundPoly([[206, 240], [234, 186], [262, 240]], 3);
  const tA = tree(198, 366, 70, 18);
  const tB = tree(372, 352, 60, 14);
  const cloudA = puff(70, 104, 100, 44);
  const cloudB = puff(334, 70, 90, 40);
  const fr = fern.layers;
  const layers = stack([...fr, cloudA, cloudB, ...hA.layers, ...hB.layers, ...hC.layers, ...tA.layers, ...tB.layers, towerRoof, towerBody, hills]);
  layers[layers.length - 1] = hide('M 10 300 C 80 270 150 280 210 292 C 270 280 330 266 390 286', [...hA.layers, ...hB.layers, ...hC.layers, ...tA.layers, ...tB.layers, towerRoof, towerBody]);
  return tpl(
    'fern-first-flight',
    'Fern’s first flight over the village',
    'advanced',
    [...fernTag, 'village', 'flying', 'clouds', 'kids'],
    [
      ...layers,
      ...fern.marks,
      ...hA.marks,
      ...hB.marks,
      ...hC.marks,
      archWin(226, 286, 16, 28),
      flag(234, 186, 26),
      hide('M 128 180 C 108 190 92 182 98 170 C 104 160 116 168 110 176', fr),
    ],
    [
      ...fern.detail,
      ...tA.detail,
      ...tB.detail,
      'M 10 372 L 390 372',
      'M 108 364 L 108 372 M 120 364 L 120 372 M 194 364 L 194 372 M 270 364 L 270 372 M 282 364 L 282 372',
      'M 100 366 L 128 366 M 190 366 L 210 366 M 266 366 L 290 366',
      clip('M 214 260 L 254 260 M 214 320 L 254 320', [region(towerBody)], 'inside'),
      'M 40 150 Q 48 142 56 150 Q 64 142 72 150',
      'M 300 140 Q 306 134 312 140 Q 318 134 324 140',
      'M 360 200 Q 366 194 372 200',
      sparkle(130, 40, 9),
      sparkle(260, 40, 8),
      sparkle(350, 240, 7),
      smokeCurl(84, 290, 0.6),
      smokeCurl(166, 290, 0.5),
      smokeCurl(344, 286, 0.6),
      clip('M 60 320 L 80 318 M 300 314 L 320 312 M 150 306 L 170 304', [region(hills)], 'inside'),
      grass(20, 386),
      grass(250, 388),
    ],
  );
}

export const fairytales: Template[] = [
  crownT(),
  wandT(),
  slipperT(),
  castleSimpleT(),
  unicornCuteT(),
  littlePrincessT(),
  frogPrinceT(),
  pumpkinCarriageT(),
  towerBraidT(),
  mermaidT(),
  fairyT(),
  knightT(),
  ballGownT(),
  grandCastleT(),
  unicornElegantT(),
  coachT(),
  fernSmokeRingT(),
  brambleSquireT(),
  magicMirrorT(),
  spinningWheelT(),
  gnomeHouseT(),
  gooseT(),
  mermaidPearlT(),
  cauldronT(),
  youngPrinceT(),
  brambleBridgeT(),
  fernToadstoolT(),
  mossyGiantT(),
  witchCottageT(),
  candyCottageT(),
  foxWaistcoatT(),
  catBootsT(),
  trollBridgeT(),
  princessLanternT(),
  mossyCarriesT(),
  beanstalkT(),
  forestPathT(),
  sleepingDragonT(),
  bearTableT(),
  fernFlightT(),
];
