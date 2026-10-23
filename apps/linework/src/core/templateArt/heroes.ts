// Heroes: original superhero-genre line art (fb-1022) on a 400×400 canvas — caped heroes in classic poses,
// masked heroes, a hero kid and a caped pup, ninjas, a knight, simple geometric badges and a city rescue.
// Every figure, costume and emblem here is our own generic design built from genre tropes only (cape, domino
// mask, belt, boots, a plain star / bolt / wing badge); nothing draws or evokes an existing character, costume,
// emblem or logo (see docs/TEMPLATES.md). Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, mirrorX, petal, polar, rotate, rrect, type P } from './draw.ts';
import { clip, region, roundPoly, stack, type Layer } from './occlude.ts';

const VB = '0 0 400 400';

function tpl(
  id: string,
  name: string,
  level: TemplateLevel,
  tags: string[],
  paths: string[],
  detail: string[] = [],
): Template {
  return {
    id: `hero-${id}`,
    name,
    category: 'heroes',
    level,
    tags: ['heroes', 'superhero', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(detail.length ? { detail: detail.filter(Boolean) } : {}),
  };
}

// ---- figure kit -----------------------------------------------------------------------------

/** Tapered capsule from a (half-width wa) to b (half-width wb) with round ends: an arm or leg segment. */
function limb(a: P, b: P, wa: number, wb: number): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dx = (b[0] - a[0]) / len;
  const dy = (b[1] - a[1]) / len;
  const nx = -dy;
  const ny = dx;
  const p = (x: number, y: number) => `${f(x)} ${f(y)}`;
  const k = 1.33;
  return (
    `M ${p(a[0] + nx * wa, a[1] + ny * wa)} L ${p(b[0] + nx * wb, b[1] + ny * wb)} ` +
    `C ${p(b[0] + nx * wb + dx * wb * k, b[1] + ny * wb + dy * wb * k)} ${p(b[0] - nx * wb + dx * wb * k, b[1] - ny * wb + dy * wb * k)} ${p(b[0] - nx * wb, b[1] - ny * wb)} ` +
    `L ${p(a[0] - nx * wa, a[1] - ny * wa)} ` +
    `C ${p(a[0] - nx * wa - dx * wa * k, a[1] - ny * wa - dy * wa * k)} ${p(a[0] + nx * wa - dx * wa * k, a[1] + ny * wa - dy * wa * k)} ${p(a[0] + nx * wa, a[1] + ny * wa)} Z`
  );
}

/** A bent limb through joints (shoulder → elbow → wrist), widths per joint, as one merged layer. */
function bent(pts: readonly P[], ws: readonly number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(limb(pts[i], pts[i + 1], ws[i], ws[i + 1]));
  return out;
}

/** Smooth closed blob through points (Catmull-Rom → cubic Bézier). */
function blob(pts: readonly P[], tension = 1): string {
  const n = pts.length;
  const p = (q: P) => `${f(q[0])} ${f(q[1])}`;
  let d = `M ${p(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: P = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C ${p(c1)} ${p(c2)} ${p(p2)}`;
  }
  return `${d} Z`;
}

/** Smooth open curve through points. */
function curve(pts: readonly P[]): string {
  const p = (q: P) => `${f(q[0])} ${f(q[1])}`;
  let d = `M ${p(pts[0])}`;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${p([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${p(p2)}`;
  }
  return d;
}

/** Ribbon / strap along a smooth curve, tapering from half-width w0 to w1. */
function strap(pts: readonly P[], w0: number, w1: number): string {
  const n = pts.length;
  const left: P[] = [];
  const right: P[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = w0 + ((w1 - w0) * i) / (n - 1);
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  });
  return `${curve(left)} ${curve(right.reverse()).replace(/^M/, 'L')} Z`;
}

/** Domino mask across the eyes centred on (cx, cy), half-width w. */
function domino(cx: number, cy: number, w: number): string {
  const p = (x: number, y: number) => `${f(cx + x * w)} ${f(cy + y * w)}`;
  return (
    `M ${p(0, -0.12)} C ${p(-0.25, -0.38)} ${p(-0.75, -0.4)} ${p(-1.05, -0.2)} ` +
    `C ${p(-1.0, 0.1)} ${p(-0.75, 0.38)} ${p(-0.45, 0.32)} C ${p(-0.2, 0.28)} ${p(-0.12, 0.1)} ${p(0, 0.08)} ` +
    `C ${p(0.12, 0.1)} ${p(0.2, 0.28)} ${p(0.45, 0.32)} C ${p(0.75, 0.38)} ${p(1.0, 0.1)} ${p(1.05, -0.2)} ` +
    `C ${p(0.75, -0.4)} ${p(0.25, -0.38)} ${p(0, -0.12)} Z`
  );
}

/** Almond eye opening for a mask. */
function almond(cx: number, cy: number, w: number, h: number, tilt = 0): string {
  const d = `M ${f(cx - w)} ${f(cy)} Q ${f(cx)} ${f(cy - h * 2)} ${f(cx + w)} ${f(cy)} Q ${f(cx)} ${f(cy + h * 2)} ${f(cx - w)} ${f(cy)} Z`;
  return tilt ? rotate(d, tilt, cx, cy) : d;
}

/** Rounded star badge. */
function softStar(cx: number, cy: number, outer: number, inner: number, n: number, r: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rot + (180 * i) / n));
  return roundPoly(pts, r);
}

/** Zig-zag lightning bolt, top at (x, y), height h. */
function bolt(x: number, y: number, h: number): string {
  const s = h / 100;
  const q = (px: number, py: number): P => [x + px * s, y + py * s];
  return roundPoly([q(14, 0), q(-22, 52), q(2, 52), q(-12, 100), q(28, 38), q(4, 38), q(24, 0)], 1.5 * s);
}

/** Simple heater shield centred on cx, top y, width w, height h. */
function shield(cx: number, y: number, w: number, h: number): string {
  const p = (px: number, py: number) => `${f(cx + px * w)} ${f(y + py * h)}`;
  return (
    `M ${p(-0.5, 0.04)} Q ${p(-0.25, 0.08)} ${p(0, 0)} Q ${p(0.25, 0.08)} ${p(0.5, 0.04)} ` +
    `C ${p(0.52, 0.45)} ${p(0.38, 0.78)} ${p(0, 1)} C ${p(-0.38, 0.78)} ${p(-0.52, 0.45)} ${p(-0.5, 0.04)} Z`
  );
}

/** Puffy cloud. */
function cloud(cx: number, cy: number, w: number): string[] {
  const s = w / 200;
  return [
    rrect(cx - 100 * s, cy - 10 * s, 200 * s, 44 * s, 22 * s),
    circle(cx - 50 * s, cy - 8 * s, 34 * s),
    circle(cx + 5 * s, cy - 26 * s, 44 * s),
    circle(cx + 58 * s, cy - 4 * s, 30 * s),
  ];
}

/** Four-point sparkle. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

const smile = (x: number, y: number, w: number, depth = 0.5): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * depth * 2)} ${f(x + w)} ${f(y)}`;
const dot = (x: number, y: number, r = 3.2): string => circle(x, y, r);
const m = (d: string): string => mirrorX(d, 200);
const lines = (segs: readonly [number, number, number, number][]): string => segs.map((s) => line(...s)).join(' ');

// ---- 1. star shield badge (beginner) ---------------------------------------------------------

function starShield(): Template {
  const outer = shield(200, 48, 264, 310);
  const inner = shield(200, 72, 220, 262);
  const st = softStar(200, 188, 78, 34, 5, 5);
  return tpl(
    'star-shield',
    'Star shield badge',
    'beginner',
    ['shield', 'star', 'badge', 'emblem', 'kids', 'geometric', 'simple'],
    [outer, inner, st],
    [sparkle(54, 70, 14), sparkle(350, 86, 11), sparkle(338, 330, 9)],
  );
}

// ---- 2. bolt badge (beginner) ----------------------------------------------------------------

function boltBadge(): Template {
  const ring = circle(200, 200, 150);
  const ring2 = circle(200, 200, 124);
  const b = bolt(196, 92, 216);
  const rays: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = i * 30 + 15;
    const p1 = polar(200, 200, 158, a);
    const p2 = polar(200, 200, 184, a);
    rays.push(line(p1[0], p1[1], p2[0], p2[1]));
  }
  return tpl(
    'bolt-badge',
    'Lightning bolt badge',
    'beginner',
    ['lightning', 'bolt', 'badge', 'emblem', 'kids', 'geometric', 'simple'],
    [ring, ring2, b],
    [rays.join(' ')],
  );
}

// ---- 3. hero mask (beginner) -----------------------------------------------------------------

function heroMask(): Template {
  const mask = domino(200, 186, 142);
  const eyeL = almond(140, 196, 34, 12, 8);
  const eyeR = almond(260, 196, 34, 12, -8);
  const knotL = ellipse(54, 170, 11, 15);
  const tie1 = strap([[54, 176], [40, 214], [52, 252], [34, 300]], 7, 2);
  const tie2 = strap([[52, 176], [28, 196], [18, 236], [24, 276]], 7, 2);
  const knotR = m(knotL);
  const [msk, kL, kR, t1, t2, t3, t4] = stack([mask, knotL, knotR, tie1, tie2, m(tie1), m(tie2)]);
  return tpl(
    'mask',
    'Hero eye mask',
    'beginner',
    ['mask', 'costume', 'disguise', 'kids', 'simple', 'dress-up'],
    [msk, kL, kR, t1, t2, t3, t4, eyeL, eyeR],
    [
      clip(
        `M 120 150 Q 160 140 192 158 M 280 150 Q 240 140 208 158`,
        [region(mask)],
        'inside',
      ),
      sparkle(330, 90, 14),
      sparkle(80, 320, 10),
      sparkle(318, 310, 8),
    ],
  );
}

// ---- 4. caped pup (beginner) -----------------------------------------------------------------

function capedPup(): Template {
  const head = blob([[200, 70], [252, 84], [270, 132], [256, 178], [200, 196], [144, 178], [130, 132], [148, 84]]);
  const earL = petal(150, 92, 220, 92, 22, 0.55);
  const earR = petal(250, 92, 140, 92, 22, 0.55);
  const muzzle = ellipse(200, 166, 34, 24);
  const mask = domino(200, 128, 66);
  const body = blob([[200, 182], [252, 214], [270, 290], [262, 346], [200, 358], [138, 346], [130, 290], [148, 214]]);
  const pawL = ellipse(170, 352, 24, 14);
  const pawR = ellipse(230, 352, 24, 14);
  const cape = blob([[160, 196], [240, 196], [300, 260], [340, 344], [300, 336], [270, 350], [200, 300], [130, 350], [100, 336], [60, 344], [100, 260]], 0.9);
  const knot = circle(200, 196, 12);
  const tail = blob([[262, 300], [300, 272], [318, 240], [328, 248], [310, 290], [270, 322]]);
  const layers = stack([muzzle, mask, earL, earR, head, knot, pawL, pawR, body, tail, cape]);
  return tpl(
    'caped-pup',
    'Caped hero pup',
    'beginner',
    ['dog', 'puppy', 'pet', 'cape', 'mask', 'sidekick', 'animal', 'kids', 'cute'],
    [
      ...layers,
      almond(176, 128, 12, 5),
      almond(224, 128, 12, 5),
      dot(176, 128, 3.5),
      dot(224, 128, 3.5),
      'M 190 156 Q 200 150 210 156 Q 208 166 200 168 Q 192 166 190 156 Z',
      'M 200 168 L 200 176 M 186 176 Q 193 184 200 176 Q 207 184 214 176',
      softStar(200, 270, 24, 11, 5, 2),
    ],
    [line(170, 340, 170, 352) + ' ' + line(230, 340, 230, 352), line(40, 362, 360, 362)],
  );
}

// ---- 5. hero kid (beginner) ------------------------------------------------------------------

function heroKid(): Template {
  const head = circle(200, 118, 70);
  const hair = blob([[130, 112], [140, 66], [192, 42], [252, 54], [274, 100], [270, 116], [250, 98], [226, 90], [212, 104], [194, 88], [164, 94], [140, 116]]);
  const mask = domino(200, 132, 62);
  const torso = roundPoly([[160, 188], [240, 188], [248, 282], [152, 282]], 16);
  const belt = rrect(150, 262, 100, 18, 6);
  const armL = bent([[166, 202], [134, 236], [156, 268]], [13, 11, 10]);
  const fistL = circle(160, 266, 13);
  const armR = bent([[234, 202], [280, 180], [300, 128]], [13, 11, 10]);
  const fistR = circle(304, 118, 15);
  const legL = limb([182, 284], [176, 330], 16, 14);
  const legR = limb([218, 284], [224, 330], 16, 14);
  const bootL = roundPoly([[156, 318], [194, 318], [196, 366], [148, 366], [150, 346]], 8);
  const bootR = roundPoly([[206, 318], [244, 318], [250, 346], [252, 366], [204, 366]], 8);
  const cape = blob([[162, 190], [238, 190], [262, 260], [300, 350], [250, 338], [200, 352], [150, 338], [100, 350], [138, 260]], 0.9);
  const layers = stack([fistR, fistL, mask, hair, head, armR, armL, belt, torso, bootL, bootR, legL, legR, cape]);
  return tpl(
    'kid',
    'Hero kid',
    'beginner',
    ['kid', 'child', 'cape', 'mask', 'costume', 'kids', 'cute', 'dress-up'],
    [
      ...layers,
      almond(176, 134, 11, 5),
      almond(224, 134, 11, 5),
      smile(200, 164, 14, 0.6),
      softStar(200, 226, 22, 10, 5, 2),
    ],
    [
      sparkle(330, 70, 14),
      sparkle(70, 180, 10),
      line(196, 262, 196, 280) + ' ' + line(204, 262, 204, 280),
      line(90, 370, 310, 370),
    ],
  );
}

// ---- 6. caped hero, hands on hips (intermediate) ------------------------------------------------

function standingHero(): Template {
  const head = 'M 176 66 C 176 46 186 38 200 38 C 214 38 224 46 224 66 C 224 86 214 100 200 100 C 186 100 176 86 176 66 Z';
  const earL = ellipse(176, 72, 5, 9);
  const earR = ellipse(224, 72, 5, 9);
  const hair = 'M 172 70 C 166 40 184 28 202 29 C 222 30 234 44 228 70 C 225 58 220 52 212 50 C 206 56 196 57 188 53 C 182 57 176 62 172 70 Z';
  const mask = domino(200, 68, 26);
  const neck = rrect(189, 92, 22, 32, 6);
  const torso = roundPoly([[140, 120], [260, 120], [268, 148], [228, 238], [172, 238], [132, 148]], 16);
  const armL = bent([[148, 136], [112, 190], [164, 234]], [15, 12, 10]);
  const armR = armL.map(m);
  const fistL = circle(170, 236, 11);
  const fistR = m(fistL);
  const belt = rrect(168, 228, 64, 15, 4);
  const trunks = roundPoly([[172, 238], [228, 238], [236, 274], [206, 280], [200, 266], [194, 280], [164, 274]], 6);
  const legL = bent([[184, 262], [176, 318], [170, 360]], [18, 13, 10]);
  const legR = legL.map(m);
  const bootL = roundPoly([[160, 322], [188, 322], [186, 362], [194, 378], [146, 380], [156, 362]], 6);
  const bootR = m(bootL);
  const cape = blob([[148, 116], [252, 116], [290, 220], [320, 372], [282, 360], [250, 380], [200, 366], [150, 380], [118, 360], [80, 372], [110, 220]], 0.95);
  const collar = 'M 160 120 L 166 96 L 188 112 Z M 240 120 L 234 96 L 212 112 Z';
  const layers = stack([fistL, fistR, mask, hair, head, earL, earR, armL, armR, belt, torso, trunks, neck, bootL, bootR, legL, legR, collar, cape]);
  const emblem = roundPoly([[184, 150], [216, 150], [218, 170], [200, 186], [182, 170]], 4);
  const tR = region(torso);
  return tpl(
    'standing-tall',
    'Caped hero standing tall',
    'intermediate',
    ['cape', 'mask', 'pose', 'figure', 'costume', 'comic'],
    [
      ...layers,
      almond(189, 68, 6, 2.6),
      almond(211, 68, 6, 2.6),
      emblem,
      softStar(200, 166, 10, 4.5, 5, 1),
    ],
    [
      'M 200 74 L 197 83 L 202 84',
      smile(200, 89, 7, 0.35),
      clip('M 162 196 Q 180 204 200 202 Q 220 204 238 196 M 200 188 L 200 228', [tR], 'inside'),
      clip('M 150 134 Q 176 142 184 150 M 250 134 Q 224 142 216 150', [tR], 'inside'),
      'M 196 228 L 196 243 M 204 228 L 204 243',
      'M 170 340 L 186 340 M 214 340 L 230 340',
      clip('M 120 200 Q 112 280 100 360 M 280 200 Q 288 280 300 360', [region(cape)], 'inside'),
      line(60, 384, 340, 384),
    ],
  );
}

/** Scale by s about the origin then move by (dx, dy). */
const place = (d: string, s: number, dx: number, dy: number): string =>
  mapPath(d, { map: (x, y) => [dx + x * s, dy + y * s], scale: s, rotate: 0, flip: false });

// ---- flying hero figure (shared by the flying piece and the rescue scene) ---------------------------

/** Side-view hero flying to the right, nose tilted up; returns front-to-back layers and detail. */
function flyer(tilt: number): { layers: Layer[]; detail: string[]; fixed: string[] } {
  const r = (d: string) => rotate(d, tilt, 200, 200);
  const rl = (l: Layer): Layer => (typeof l === 'string' ? r(l) : l.map(r));
  const head = ellipse(294, 196, 21, 22);
  const hair = blob([[274, 200], [276, 180], [292, 172], [312, 178], [316, 186], [302, 184], [290, 190], [284, 204]]);
  const mask = 'M 296 190 C 304 186 314 186 318 189 C 317 197 310 200 300 198 Z';
  const neck = limb([262, 200], [282, 200], 9, 9);
  const fist = circle(356, 150, 11);
  const armF = bent([[258, 188], [306, 164], [348, 154]], [12, 10, 9]);
  const torso = limb([252, 202], [170, 206], 27, 21);
  const belt = rotate(rrect(176, 182, 14, 48, 4), -2, 183, 206);
  const armB = bent([[248, 212], [218, 230], [190, 226]], [13, 11, 10]);
  const fistB = circle(184, 224, 11);
  const bootA = limb([96, 194], [50, 196], 13, 12);
  const legA = bent([[172, 196], [122, 190], [84, 194]], [20, 15, 11]);
  const bootB = limb([108, 240], [68, 256], 13, 12);
  const legB = bent([[170, 216], [132, 228], [96, 246]], [19, 15, 11]);
  const cape = blob([[262, 186], [232, 168], [180, 160], [120, 140], [60, 146], [86, 160], [36, 178], [92, 184], [64, 204], [140, 194], [200, 196]], 0.9);
  const layers: Layer[] = [mask, hair, head, fistB, armB, belt, torso, bootB, legB, neck, fist, armF, bootA, legA, cape].map(rl);
  const detail = ['M 160 158 Q 124 162 96 176', 'M 216 172 Q 166 172 124 188'].map(r);
  const fixed = [r(almond(308, 193, 4, 1.7)), r(softStar(222, 200, 9, 4, 5, 1, -90)), r('M 312 205 Q 308 209 302 208')];
  return { layers, detail, fixed };
}

// ---- 7. flying hero (intermediate) ---------------------------------------------------------------

function flyingHero(): Template {
  const fig = flyer(-18);
  const front = fig.layers.map((l) => region(l));
  const c1 = cloud(110, 330, 150);
  const c2 = cloud(310, 360, 110);
  const layers = stack([...fig.layers, c1, c2]);
  const speed: string[] = [];
  for (const [x, y, len] of [[38, 214, 60], [26, 244, 46], [40, 274, 70], [60, 300, 30], [48, 120, 40]] as const) {
    speed.push(rotate(line(x, y, x + len, y), -18, 200, 200));
  }
  return tpl(
    'flying',
    'Flying caped hero',
    'intermediate',
    ['flying', 'cape', 'mask', 'sky', 'clouds', 'figure', 'comic'],
    [...layers, ...fig.fixed],
    [clip(speed.join(' '), front), ...fig.detail.map((d) => clip(d, front.slice(0, -1))), sparkle(342, 60, 12), sparkle(60, 60, 9)],
  );
}

// ---- 8. running hero (intermediate) --------------------------------------------------------------

function runningHero(): Template {
  const head = ellipse(262, 92, 24, 26);
  const hair = blob([[238, 92], [240, 70], [262, 62], [286, 70], [282, 78], [268, 78], [256, 86], [246, 102]]);
  const mask = 'M 266 86 C 274 82 284 82 288 86 C 286 94 278 96 270 94 Z';
  const neck = limb([256, 110], [248, 128], 9, 9);
  const torso = roundPoly([[220, 122], [272, 126], [252, 212], [202, 206]], 16);
  const belt = rotate(rrect(200, 196, 48, 14, 4), 8, 224, 203);
  const trunks = roundPoly([[204, 204], [246, 210], [240, 232], [204, 230]], 6);
  const armF = bent([[252, 142], [274, 184], [304, 162]], [13, 11, 10]);
  const fistF = circle(308, 158, 12);
  const armB = bent([[232, 142], [200, 174], [170, 186]], [13, 11, 10]);
  const fistB = circle(164, 188, 11);
  const legF = bent([[232, 220], [274, 256], [264, 316]], [18, 14, 11]);
  const bootF = [limb([268, 288], [264, 326], 13, 12), limb([260, 332], [294, 338], 11, 10)];
  const legB = bent([[214, 222], [180, 270], [128, 268]], [18, 14, 11]);
  const bootB = [limb([152, 270], [128, 267], 13, 12), limb([124, 262], [112, 292], 11, 10)];
  const cape = blob([[230, 120], [196, 106], [140, 96], [70, 108], [32, 92], [56, 128], [24, 150], [86, 156], [140, 160], [198, 150]], 0.9);
  const layers = stack([fistF, armF, mask, hair, head, neck, belt, trunks, torso, bootF, legF, fistB, armB, cape, bootB, legB]);
  const speed = lines([[30, 196, 96, 196], [40, 222, 110, 222], [56, 246, 100, 246], [20, 300, 80, 300]]);
  return tpl(
    'running',
    'Speedy running hero',
    'intermediate',
    ['running', 'speed', 'fast', 'cape', 'mask', 'figure', 'comic'],
    [...layers, almond(278, 88, 4.5, 1.8), bolt(232, 146, 40)],
    [
      speed,
      'M 284 104 Q 280 108 274 108',
      clip('M 150 110 Q 110 118 70 128 M 196 128 Q 150 130 100 146', [region(cape)], 'inside'),
      'M 150 352 L 340 352',
      sparkle(330, 70, 11),
    ],
  );
}

// ---- 9. winged emblem (intermediate) ----------------------------------------------------------------

/** Twelve little dots around a ring. */
function ring12(cx: number, cy: number, r: number): string {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) out.push(circle(...polar(cx, cy, r, i * 30), 1.5));
  return out.join(' ');
}

function wingedEmblem(): Template {
  const disc = circle(200, 196, 70);
  const disc2 = circle(200, 196, 56);
  const st = softStar(200, 198, 40, 17, 5, 3);
  const wing: string[] = [];
  const feathers: string[] = [];
  const base: P = [150, 204];
  const tips: P[] = [[22, 88], [34, 132], [52, 168], [78, 198], [108, 222], [138, 240]];
  const notches: P[] = [[56, 122], [72, 154], [94, 180], [118, 202], [140, 220]];
  const pts: P[] = [[154, 168], [126, 140], [96, 116], [62, 98], tips[0]];
  for (let i = 0; i < notches.length; i++) pts.push(notches[i], tips[i + 1]);
  pts.push([150, 214]);
  const wingL = roundPoly(pts, 5);
  wing.push(wingL);
  for (const n of notches) {
    const e: P = [n[0] + (base[0] - n[0]) * 0.3, n[1] + (base[1] - n[1]) * 0.3];
    feathers.push(line(n[0], n[1], e[0], e[1]));
  }
  const ribbon = 'M 104 300 L 296 300 L 280 322 L 296 344 L 104 344 L 120 322 Z';
  const layers = stack([disc, ribbon, wingL, m(wingL)]);
  const featherLines = clip([...feathers, ...feathers.map(m)].join(' '), [region(disc)]);
  return tpl(
    'winged-emblem',
    'Winged star emblem',
    'intermediate',
    ['wings', 'star', 'emblem', 'badge', 'geometric', 'kids'],
    [...layers, disc2, st],
    [featherLines, ring12(200, 196, 63), 'M 132 322 L 268 322', sparkle(54, 70, 12), sparkle(346, 70, 12)],
  );
}

// ---- 10. ninja (intermediate) -------------------------------------------------------------------------

function ninja(): Template {
  const head = circle(200, 88, 40);
  const band = 'M 162 78 Q 200 70 238 78 L 239 100 Q 200 94 161 100 Z';
  const tails = [
    blob([[236, 72], [270, 54], [312, 56], [300, 66], [272, 72], [244, 86]]),
    blob([[236, 80], [276, 80], [316, 96], [298, 102], [270, 94], [240, 92]]),
  ];
  const knot = circle(236, 78, 8);
  const hiltG = rotate(rrect(122, 124, 34, 8, 3), -40, 139, 128);
  const hilt = rotate(rrect(132, 76, 12, 50, 5), -40, 138, 128);
  const scab = rotate(rrect(132, 128, 12, 170, 5), -40, 138, 128);
  const torso = roundPoly([[150, 136], [250, 136], [258, 160], [234, 250], [166, 250], [142, 160]], 16);
  const sash = 'M 162 228 L 238 228 L 240 252 L 160 252 Z';
  const sashTail = 'M 214 250 L 230 290 L 246 286 L 232 250 Z';
  const armL = bent([[154, 152], [126, 204], [232, 192]], [16, 13, 11]);
  const armR = bent([[246, 152], [274, 204], [170, 198]], [16, 13, 11]);
  const pants = [
    roundPoly([[164, 248], [204, 248], [196, 300], [168, 336], [134, 330], [150, 292]], 12),
    roundPoly([[196, 248], [236, 248], [250, 292], [266, 330], [232, 336], [204, 300]], 12),
  ];
  const footL = roundPoly([[130, 330], [172, 330], [170, 356], [112, 358], [118, 344]], 6);
  const footR = m(footL);
  const layers = stack([armL, armR, band, head, knot, tails, hiltG, hilt, sash, sashTail, torso, footL, footR, pants, scab]);
  return tpl(
    'ninja',
    'Shadow ninja',
    'intermediate',
    ['ninja', 'martial-arts', 'sword', 'stealth', 'figure', 'kids'],
    [...layers, almond(184, 90, 9, 3.4, 6), almond(216, 90, 9, 3.4, -6)],
    [
      clip(clip('M 184 136 L 216 204 M 216 136 L 196 178', [region(torso)], 'inside'), [region(armL), region(armR), region(sash)]),
      'M 176 82 L 194 86 M 224 82 L 206 86',
      'M 180 262 L 176 300 M 220 262 L 224 300',
      'M 120 342 L 172 342 M 228 342 L 280 342',
      line(70, 362, 330, 362),
      softStar(330, 210, 16, 5, 4, 1),
      circle(330, 210, 3),
    ],
  );
}

// ---- 11. hero landing on one knee (advanced) ----------------------------------------------------

function landingHero(): Template {
  const head = 'M 186 104 C 186 82 196 72 212 72 C 228 72 238 82 238 104 C 238 124 226 136 212 136 C 198 136 186 124 186 104 Z';
  const hair = 'M 182 108 C 176 76 196 64 214 65 C 234 66 246 80 240 108 C 236 94 230 88 222 86 C 214 92 204 93 196 89 C 190 93 186 100 182 108 Z';
  const mask = domino(212, 106, 28);
  const neck = rrect(200, 126, 24, 28, 6);
  const torso = roundPoly([[160, 150], [266, 150], [270, 178], [240, 250], [184, 250], [154, 178]], 18);
  const belt = rrect(180, 240, 64, 16, 4);
  const armL = bent([[166, 168], [126, 238], [126, 318]], [16, 13, 11]);
  const fistL = circle(126, 326, 14);
  const armR = bent([[260, 168], [306, 214], [348, 228]], [16, 13, 11]);
  const handR = blob([[340, 216], [362, 214], [374, 222], [370, 234], [352, 240], [340, 238]]);
  const thighR = bent([[232, 262], [290, 268], [292, 330]], [20, 16, 12]);
  const bootR = roundPoly([[274, 300], [308, 300], [310, 336], [332, 340], [334, 352], [268, 352], [272, 336]], 6);
  const thighL = bent([[192, 262], [166, 336]], [20, 16]);
  const kneePad = ellipse(166, 340, 18, 12);
  const shinL = roundPoly([[150, 340], [230, 338], [252, 352], [150, 352]], 6);
  const cape = blob([[170, 150], [132, 116], [80, 86], [24, 88], [56, 122], [18, 164], [66, 176], [32, 232], [96, 226], [150, 236], [196, 200], [250, 204], [290, 196], [264, 150]], 0.9);
  const layers = stack([fistL, armL, mask, hair, head, handR, armR, belt, torso, neck, kneePad, thighL, bootR, thighR, shinL, cape]);
  const front = [fistL, armL, bootR, kneePad, shinL].map((l) => region(l));
  const det: string[] = [
    almond(200, 106, 6, 2.6),
    almond(224, 106, 6, 2.6),
    'M 206 120 Q 212 124 218 120',
    roundPoly([[196, 176], [228, 176], [230, 196], [212, 212], [194, 196]], 4),
    bolt(208, 180, 28),
    clip('M 172 168 Q 196 176 200 186 M 254 168 Q 230 176 226 186 M 212 214 L 212 240', [region(torso)], 'inside'),
    'M 208 240 L 208 256 M 216 240 L 216 256',
    'M 276 316 L 308 316',
    'M 112 306 L 140 306',
  ];
  det.push(
    clip(
      clip('M 120 126 Q 90 160 70 210 M 150 160 Q 120 210 100 270 M 116 100 Q 80 120 60 150', [region(cape)], 'inside'),
      [fistL, armL, handR, armR, torso, belt, thighL, thighR, neck].map((l) => region(l)),
    ),
  );
  const ground = 'M 20 352 L 380 352';
  const cracks = [
    'M 126 352 L 110 364 L 116 374 L 96 390',
    'M 126 352 L 142 368 L 136 378 L 150 394',
    'M 126 352 L 80 358 L 64 370 L 30 372',
    'M 126 352 L 176 364 L 210 362 L 240 378',
    'M 180 352 L 196 372 L 186 386',
    'M 300 352 L 320 372 L 360 378',
    'M 252 352 L 270 366 L 266 384',
  ];
  const rocks = [
    roundPoly([[60, 316], [74, 310], [80, 322], [66, 328]], 2),
    roundPoly([[90, 290], [100, 286], [104, 296], [94, 300]], 2),
    roundPoly([[350, 316], [364, 312], [368, 326], [354, 330]], 2),
    roundPoly([[42, 286], [50, 280], [56, 290], [48, 294]], 2),
    roundPoly([[372, 290], [380, 286], [384, 296], [376, 298]], 1.5),
  ];
  const dust = [circle(54, 342, 10), circle(72, 338, 13), circle(92, 344, 9), circle(330, 342, 10), circle(348, 336, 12), circle(366, 344, 8)];
  det.push(clip(cracks.join(' '), front));
  det.push(...rocks);
  det.push(clip(stack(dust).join(' '), front));
  return tpl(
    'landing',
    'Hero landing on one knee',
    'advanced',
    ['landing', 'action', 'cape', 'mask', 'figure', 'comic', 'dynamic'],
    [...layers, clip(ground, front)],
    det,
  );
}

// ---- 12. city rescue (advanced) -------------------------------------------------------------------------

function cityRescue(): Template {
  const fig = flyer(-10);
  const s = 0.55;
  const pl = (l: Layer): Layer => (typeof l === 'string' ? place(l, s, 92, 44) : l.map((d) => place(d, s, 92, 44)));
  const figL: Layer[] = fig.layers.map(pl);
  const bx: [number, number, number, number][] = [[20, 220, 70, 180], [84, 170, 66, 230], [150, 250, 60, 150], [206, 196, 70, 204], [270, 140, 64, 260], [330, 230, 60, 170]];
  const buildings = bx.map(([x, y, w, h]) => rrect(x, y, w, h, 2));
  const kitten = [circle(306, 114, 11), 'M 297 108 L 296 96 L 304 104 Z M 315 108 L 316 96 L 308 104 Z', ellipse(306, 131, 12, 9)];
  const moon = 'M 82 40 A 34 34 0 1 0 112 92 A 26 26 0 1 1 82 40 Z';
  const layers = stack([...figL, ...kitten, ...buildings]);
  const blds = buildings.map((b) => region(b));
  const front = [...figL, ...kitten].map((l) => region(l));
  const win: string[] = [];
  bx.forEach(([x, y, w, h], i) => {
    const cols = Math.floor((w - 12) / 14);
    for (let yy = y + 14; yy < Math.min(400, y + h) - 18; yy += 20) {
      for (let c = 0; c < cols; c++) {
        if ((c * 7 + yy + i * 3) % 5 === 0) continue;
        win.push(rrect(x + 8 + c * 14, yy, 8, 11, 1));
      }
    }
  });
  const roofs = ['M 110 170 L 110 140 M 104 140 L 116 140', rrect(220, 182, 18, 14, 2), 'M 358 230 L 358 210 M 352 214 L 364 214', 'M 34 220 L 34 206 L 50 206 L 50 220'];
  return tpl(
    'city-rescue',
    'Rooftop rescue',
    'advanced',
    ['city', 'skyline', 'rescue', 'kitten', 'flying', 'cape', 'night', 'scene'],
    [...layers, moon, place(fig.fixed[0], s, 92, 44)],
    [
      clip(win.join(' '), front),
      clip(roofs.join(' '), front),
      place(fig.fixed[1], s, 92, 44),
      place(fig.fixed[2], s, 92, 44),
      ...fig.detail.map((d) => clip(place(d, s, 92, 44), front.slice(0, figL.length - 1))),
      'M 302 119 Q 306 122 310 119',
      dot(301, 112, 1.4),
      dot(311, 112, 1.4),
      'M 318 134 Q 330 128 326 118',
      sparkle(160, 50, 9),
      sparkle(370, 60, 7),
      sparkle(220, 120, 6),
      circle(340, 30, 2),
      circle(30, 120, 2),
      circle(250, 36, 2),
      clip(lines([[150, 120, 190, 108], [146, 136, 176, 128]]), [...blds, ...front]),
    ],
  );
}

// ---- 13. knight (advanced) -----------------------------------------------------------------------------

function knight(): Template {
  const helm = 'M 166 108 C 164 62 182 40 200 40 C 218 40 236 62 234 108 L 230 128 Q 200 138 170 128 Z';
  const plume = blob([[200, 44], [214, 18], [244, 8], [276, 18], [258, 26], [272, 40], [240, 36], [216, 50]]);
  const visor = 'M 172 84 L 228 84 L 226 104 Q 200 112 174 104 Z';
  const gorget = roundPoly([[168, 124], [232, 124], [240, 144], [160, 144]], 8);
  const pauldL = blob([[144, 140], [176, 136], [184, 170], [160, 186], [128, 180], [126, 156]]);
  const pauldR = m(pauldL);
  const chest = roundPoly([[156, 142], [244, 142], [248, 186], [230, 244], [170, 244], [152, 186]], 16);
  const faulds = [0, 1, 2].map((i) => roundPoly([[166 - i * 4, 238 + i * 14], [234 + i * 4, 238 + i * 14], [236 + i * 4, 256 + i * 14], [164 - i * 4, 256 + i * 14]], 5));
  const shieldS = shield(130, 168, 126, 168);
  const shieldIn = shield(130, 180, 104, 146);
  const armR = bent([[248, 160], [270, 210], [262, 252]], [16, 13, 12]);
  const gauntR = circle(262, 258, 15);
  const swordBlade = 'M 256 280 L 268 280 L 268 372 L 262 384 L 256 372 Z';
  const guard = rrect(236, 268, 52, 10, 4);
  const grip = rrect(256, 230, 12, 40, 4);
  const pommel = circle(262, 226, 7);
  const legL = bent([[186, 284], [180, 330], [178, 366]], [17, 14, 12]);
  const legR = legL.map(m);
  const kneeL = ellipse(181, 328, 16, 12);
  const kneeR = m(kneeL);
  const sabL = roundPoly([[164, 360], [194, 360], [196, 384], [150, 386], [154, 372]], 6);
  const sabR = m(sabL);
  const layers = stack([shieldIn, shieldS, gauntR, pommel, grip, guard, armR, visor, helm, plume, pauldR, pauldL, gorget, chest, ...faulds, swordBlade, sabL, sabR, kneeL, kneeR, legL, legR]);
  const front = [shieldS, gauntR, grip, guard, armR, pauldR, pauldL, chest, ...faulds].map((l) => region(l));
  const det: string[] = [];
  for (let i = 0; i < 4; i++) det.push(line(180, 90 + i * 4.5, 220, 90 + i * 4.5));
  det.push('M 200 46 L 200 82');
  det.push(clip('M 200 150 L 200 236 M 168 170 Q 200 184 232 170 M 172 206 Q 200 216 228 206', [region(chest)], 'inside'));
  for (const [x, y] of [[164, 154], [236, 154], [176, 232], [224, 232]]) det.push(clip(circle(x, y, 2), [region(shieldS)]));
  det.push(clip('M 134 162 Q 156 154 180 160 M 132 172 Q 154 164 182 170', [region(shieldS)]));
  det.push(clip('M 266 162 Q 244 154 220 160 M 268 172 Q 246 164 218 170', [region(armR)]));
  det.push('M 96 230 L 130 262 L 164 230 M 96 248 L 130 280 L 164 248');
  det.push(softStar(130, 216, 18, 8, 5, 1.5));
  const mail: string[] = [];
  for (let y = 290; y < 360; y += 8) mail.push(`M 166 ${y} L 198 ${y + 4} M 202 ${y + 4} L 234 ${y}`);
  det.push(clip(clip(mail.join(' '), [region(legL), region(legR)], 'inside'), [region(kneeL), region(kneeR), ...front]));
  for (let i = 0; i < 6; i++) det.push(clip(line(216 + i * 9, 30 - i * 2, 226 + i * 9, 16 - i * 1.5), [region(plume)], 'inside'));
  det.push('M 262 284 L 262 366', 'M 256 238 L 268 244 M 256 248 L 268 254 M 256 258 L 268 264');
  det.push(line(40, 388, 360, 388));
  det.push(sparkle(330, 60, 12), sparkle(66, 78, 9));
  return tpl('knight', 'Shield knight', 'advanced', ['knight', 'armor', 'sword', 'shield', 'medieval', 'figure'], layers, det.filter(Boolean));
}

export const heroes: Template[] = [
  starShield(),
  boltBadge(),
  heroMask(),
  capedPup(),
  heroKid(),
  standingHero(),
  flyingHero(),
  runningHero(),
  wingedEmblem(),
  ninja(),
  landingHero(),
  cityRescue(),
  knight(),
];
