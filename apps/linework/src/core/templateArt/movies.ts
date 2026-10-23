// Movie night: original line art in blockbuster-movie genres (space adventure, dinosaurs, fantasy, pirates,
// robots, jungle expeditions, the cinema itself) on a 400×400 canvas. Every piece is our own generic genre
// design: no existing characters, ships, droids, props, logos or silhouettes from any film or studio (see
// docs/TEMPLATES.md). Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { bez, circle, ellipse, f, line, mapPath, mirrorX, petal, poly, polar, rotate, rrect, shift, spiral, star, type P } from './draw.ts';
import { clip, region, roundPoly, stack, union } from './occlude.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], paths: string[], detail: string[] = []): Template {
  const d = detail.filter(Boolean);
  return {
    id: `movie-${id}`,
    name,
    category: 'movies',
    level,
    tags: ['movies', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(d.length ? { detail: d } : {}),
  };
}

// ---- shared kit -------------------------------------------------------------------------------

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

const smile = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w)} ${f(x + w)} ${f(y)}`;
const happyEye = (x: number, y: number, w: number): string => `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y - w * 1.1)} ${f(x + w)} ${f(y)}`;

/** Points of a cubic. */
function sampleCubic(p0: P, p1: P, p2: P, p3: P, n: number): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) out.push(bez(p0, p1, p2, p3, i / n));
  return out;
}

/** Unit tangent of a cubic at t. */
function tangent(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const a = bez(p0, p1, p2, p3, Math.max(0, t - 0.01));
  const b = bez(p0, p1, p2, p3, Math.min(1, t + 0.01));
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

/** Triangular spikes standing on a cubic (normal = left of travel, flipped by sign). Bases sink 5 units inward. */
function spikesAlong(c: [P, P, P, P], n: number, h: number, w: number, t0 = 0.05, t1 = 0.95, sign = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * (i + 0.5)) / n;
    const p = bez(...c, t);
    const [ux, uy] = tangent(...c, t);
    const nx = uy * sign;
    const ny = -ux * sign;
    out.push(
      poly([
        [p[0] - ux * w - nx * 5, p[1] - uy * w - ny * 5],
        [p[0] + nx * h + ux * w * 0.5, p[1] + ny * h + uy * w * 0.5],
        [p[0] + ux * w - nx * 5, p[1] + uy * w - ny * 5],
      ]),
    );
  }
  return out;
}

/** Leaf with a midrib and paired side veins (outline, veins). */
function veinLeaf(bx: number, by: number, deg: number, len: number, w: number, veins = 5): [string, string] {
  const o = petal(bx, by, deg, len, w, 0.4);
  const tip = polar(bx, by, len * 0.92, deg);
  let v = `M ${f(bx)} ${f(by)} L ${f(tip[0])} ${f(tip[1])}`;
  for (let k = 1; k <= veins; k++) {
    const t = k / (veins + 1);
    const [mx, my] = polar(bx, by, len * t, deg);
    const vl = w * 1.15 * (1 - Math.abs(t - 0.45));
    const a = polar(mx, my, vl, deg - 55);
    const b = polar(mx, my, vl, deg + 55);
    v += ` M ${f(mx)} ${f(my)} L ${f(a[0])} ${f(a[1])} M ${f(mx)} ${f(my)} L ${f(b[0])} ${f(b[1])}`;
  }
  return [o, clip(v, [region(o)], 'inside')];
}

/** Row of ∪-shaped scale arcs. */
function scaleRows(x0: number, x1: number, y0: number, y1: number, r: number): string {
  let d = '';
  let row = 0;
  for (let y = y0; y <= y1; y += r * 1.3, row++) {
    for (let x = x0 + (row % 2 ? r : 0); x + 2 * r <= x1; x += 2 * r) {
      d += ` M ${f(x)} ${f(y)} A ${f(r)} ${f(r)} 0 0 0 ${f(x + 2 * r)} ${f(y)}`;
    }
  }
  return d.trim();
}

/** Wavy water crest band: bumps along y from x0 to x1, closed down to yBottom. */
function waveBand(x0: number, x1: number, y: number, yBottom: number, step: number, amp: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  let i = 0;
  for (let x = x0; x < x1 - 0.1; x += step, i++) {
    const a = i % 2 ? amp * 0.7 : amp;
    d += ` C ${f(x + step * 0.2)} ${f(y - a)} ${f(x + step * 0.75)} ${f(y - a)} ${f(x + step)} ${f(y)}`;
  }
  return `${d} L ${f(x1)} ${f(yBottom)} L ${f(x0)} ${f(yBottom)} Z`;
}

// ---- 1. space explorer ------------------------------------------------------------------------

function astronaut(): Template {
  const helmet = circle(200, 128, 66);
  const visor = 'M 152 120 C 152 92 248 92 248 120 L 248 140 C 248 172 152 172 152 140 Z';
  const collar = rrect(148, 182, 104, 22, 11);
  const body = rrect(146, 192, 108, 104, 34);
  const armL = rotate(rrect(132, 206, 36, 84, 18), 128, 150, 222);
  const gloveL = circle(...polar(150, 222, 82, -52), 19);
  const armR = rotate(rrect(232, 206, 36, 80, 18), -24, 250, 222);
  const gloveR = circle(...polar(250, 222, 78, 156), 18);
  const legL = rrect(160, 280, 36, 60, 14);
  const legR = rrect(204, 280, 36, 60, 14);
  const bootL = rrect(150, 330, 52, 28, 13);
  const bootR = rrect(198, 330, 52, 28, 13);
  const pack = rrect(126, 186, 148, 96, 20);
  const light = rrect(254, 92, 18, 26, 6);
  const layers = stack([helmet, light, collar, gloveL, armL, gloveR, armR, bootL, bootR, legL, legR, body, pack]);
  const panel = rrect(174, 220, 52, 36, 7);
  const bodyR = region(body);
  return tpl(
    'astronaut',
    'Space explorer',
    'intermediate',
    ['astronaut', 'space', 'spaceman', 'stars', 'adventure', 'sci-fi', 'kids'],
    [
      ...layers,
      visor,
      panel,
      `${circle(186, 238, 6)} ${circle(214, 238, 6)}`,
      softStar(68, 300, 20, 9, 5, 3),
      softStar(338, 60, 16, 7, 5, 3),
      circle(332, 300, 26),
    ],
    [
      'M 166 112 C 172 102 186 98 198 98 M 230 150 C 238 146 242 140 243 132',
      `${line(186, 230, 186, 234)} ${line(214, 230, 214, 234)}`,
      clip('M 146 268 L 254 268', [bodyR], 'inside'),
      'M 160 306 L 196 306 M 204 306 L 240 306',
      clip(`${circle(320, 292, 6)} ${circle(342, 310, 4)} M 306 296 C 316 312 340 322 356 316`, [region(circle(332, 300, 26))], 'inside'),
      'M 274 230 C 320 226 330 180 360 170 C 380 164 392 180 384 196',
      sparkle(66, 70, 12),
      sparkle(98, 360, 9),
      sparkle(372, 130, 8),
      `${circle(110, 40, 2.5)} ${circle(300, 30, 2.5)} ${circle(40, 190, 2.5)} ${circle(370, 360, 2.5)} ${circle(290, 380, 2.5)}`,
    ],
  );
}

// ---- 2. retro rocket --------------------------------------------------------------------------

function retroRocket(): Template {
  const body = 'M 200 34 C 252 76 264 150 258 252 L 142 252 C 136 150 148 76 200 34 Z';
  const finL = 'M 150 168 C 112 190 98 232 100 300 C 116 284 134 272 152 266 Z';
  const finR = 'M 250 168 C 288 190 302 232 300 300 C 284 284 266 272 248 266 Z';
  const finC = 'M 200 214 C 214 240 214 284 200 306 C 186 284 186 240 200 214 Z';
  const nozzle = poly([[162, 250], [238, 250], [226, 284], [174, 284]]);
  const flame = 'M 170 280 C 164 318 186 334 200 380 C 214 334 236 318 230 280 Z';
  const window = circle(200, 132, 28);
  const layers = stack([finC, window, body, finL, finR, nozzle, flame]);
  return tpl(
    'retro-rocket',
    'Retro rocket ship',
    'beginner',
    ['rocket', 'space', 'launch', 'retro', 'sci-fi', 'stars', 'kids'],
    [
      ...layers,
      circle(200, 132, 18),
      clip('M 120 196 C 170 208 230 208 280 196', [region(body)], 'inside'),
      clip('M 120 84 C 170 94 230 94 280 84', [region(body)], 'inside'),
      'M 186 292 C 184 316 194 330 200 350 C 206 330 216 316 214 292',
      softStar(70, 90, 22, 10, 5, 3),
      softStar(330, 300, 18, 8, 5, 3),
    ],
    [
      'M 190 124 C 192 118 198 114 204 114',
      `${circle(160, 230, 3)} ${circle(240, 230, 3)} ${circle(162, 176, 3)} ${circle(238, 176, 3)}`,
      sparkle(330, 70, 13),
      sparkle(62, 300, 10),
      sparkle(346, 190, 8),
      `${circle(90, 200, 2.5)} ${circle(320, 140, 2.5)} ${circle(120, 360, 2.5)} ${circle(280, 360, 2.5)}`,
    ],
  );
}

// ---- 3. flying saucer -------------------------------------------------------------------------

function flyingSaucer(): Template {
  const dome = 'M 128 200 C 128 90 272 90 272 200 Z';
  const disc = ellipse(200, 212, 156, 38);
  const belly = ellipse(200, 244, 70, 18);
  const head = circle(200, 166, 30);
  const antL = 'M 186 140 C 182 130 178 124 172 118';
  const antR = 'M 214 140 C 218 130 222 124 228 118';
  const domeR = region(dome);
  const [d, dm, b] = stack([disc, dome, belly]);
  const lights = [-110, -55, 0, 55, 110].map((dx) => circle(200 + dx, 216 + Math.abs(dx) * -0.06, 8)).join(' ');
  return tpl(
    'flying-saucer',
    'Flying saucer visitor',
    'beginner',
    ['ufo', 'saucer', 'alien', 'space', 'sci-fi', 'cute', 'kids'],
    [
      d,
      dm,
      b,
      clip(`${head} ${antL} ${antR} ${circle(170, 114, 6)} ${circle(230, 114, 6)}`, [domeR], 'inside'),
      `${ellipse(188, 164, 7, 10)} ${ellipse(212, 164, 7, 10)}`,
      smile(200, 180, 8),
      lights,
      'M 160 262 L 104 372 M 240 262 L 296 372',
      ellipse(200, 372, 96, 14),
    ],
    [
      'M 148 168 C 150 146 160 130 174 122',
      `${circle(190, 160, 2)} ${circle(214, 160, 2)}`,
      clip('M 120 222 C 160 236 240 236 280 222', [region(disc)], 'inside'),
      'M 150 300 L 140 320 M 250 300 L 260 320 M 200 290 L 200 330',
      sparkle(60, 80, 14),
      sparkle(340, 70, 11),
      sparkle(70, 300, 9),
      sparkle(338, 300, 9),
      `${circle(120, 40, 2.5)} ${circle(280, 36, 2.5)} ${circle(30, 180, 2.5)} ${circle(370, 170, 2.5)}`,
    ],
  );
}

// ---- 4. ringed planet -------------------------------------------------------------------------

function ringedPlanet(): Template {
  const tilt = -16;
  const R = (d: string): string => rotate(d, tilt, 200, 200);
  const planet = circle(200, 200, 100);
  const ringOut = R(ellipse(200, 200, 172, 46));
  const ringIn = R(ellipse(200, 200, 128, 28));
  const backHalf = region(R('M 98 200 A 102 102 0 0 1 302 200 Z'));
  const frontBand = region(R('M 28 200 A 172 46 0 0 0 372 200 L 328 200 A 128 28 0 0 1 72 200 Z'));
  const planetR = region(planet);
  const bands = clip(
    clip(R('M 100 168 C 160 150 240 150 300 168 M 104 236 C 160 254 240 254 296 236 M 112 140 C 170 128 230 128 288 140'), [planetR], 'inside'),
    [frontBand],
  );
  const moon = circle(330, 70, 24);
  return tpl(
    'ringed-planet',
    'Ringed planet and moons',
    'beginner',
    ['planet', 'space', 'stars', 'moon', 'astronomy', 'sci-fi', 'kids'],
    [
      clip(planet, [frontBand]),
      clip(ringOut, [backHalf]),
      clip(ringIn, [backHalf]),
      moon,
      circle(70, 330, 14),
      softStar(70, 80, 22, 10, 5, 3),
      softStar(340, 330, 18, 8, 5, 3),
      'M 250 360 L 300 348 M 236 372 L 296 358',
      softStar(316, 346, 9, 4, 5, 2),
    ],
    [
      bands,
      clip(`${circle(320, 62, 6)} ${circle(340, 82, 4)} ${circle(336, 58, 3)}`, [region(moon)], 'inside'),
      sparkle(150, 40, 10),
      sparkle(40, 200, 8),
      sparkle(370, 200, 9),
      `${circle(110, 360, 2.5)} ${circle(250, 30, 2.5)} ${circle(30, 120, 2.5)} ${circle(380, 120, 2.5)} ${circle(180, 380, 2.5)}`,
    ],
  );
}

// ---- 5. roaring T-rex -------------------------------------------------------------------------

function tRex(): Template {
  const S = (d: string): string => shift(d, 0, 34);
  const body = S(
    'M 36 146 C 40 120 80 98 120 94 C 150 91 170 100 182 112 C 200 128 214 136 240 138 ' +
      'C 280 140 330 140 388 148 Q 396 152 388 158 C 330 170 300 188 282 212 C 270 240 240 256 210 252 ' +
      'C 190 248 172 234 160 218 C 140 216 104 214 74 212 C 62 212 56 204 64 199 C 90 190 120 180 144 168 ' +
      'C 116 164 72 162 48 160 C 38 158 34 154 36 146 Z',
  );
  const thigh = S(rotate(ellipse(256, 216, 46, 58), -14, 256, 216));
  const leg =
    'M 238 284 C 246 306 262 322 280 332 C 278 346 270 356 258 362 C 238 364 222 368 220 376 C 220 382 226 384 234 384 ' +
    'L 300 384 C 310 384 312 376 306 368 C 310 350 312 330 306 312 C 302 300 298 290 294 278 Z';
  const farLeg = shift(leg, -48, -6);
  const arm = S('M 186 226 C 176 232 166 240 160 250 C 156 256 162 260 166 256 C 172 248 182 242 194 238 Z');
  const layers = stack([arm, thigh, leg, body, farLeg]);
  const teethUp = [62, 80, 98, 116].map((x) => {
    const y = 158.6 + (x - 46) * 0.09;
    return S(poly([[x - 4.5, y], [x, y + 11], [x + 4.5, y]]));
  });
  const teethLow = [82, 100, 118].map((x) => {
    const y = 195.5 - (x - 66) * 0.36;
    return S(poly([[x - 4.5, y], [x, y - 10], [x + 4.5, y]]));
  });
  const bodyR = region(body);
  const volcano = 'M 262 118 L 300 58 L 324 58 L 362 118';
  return tpl(
    't-rex',
    'Roaring T-rex',
    'intermediate',
    ['dinosaur', 't-rex', 'prehistoric', 'adventure', 'roar', 'reptile', 'kids'],
    [
      ...layers,
      ...teethUp,
      ...teethLow,
      S(circle(140, 118, 6.5)),
      S('M 124 106 C 134 98 150 98 158 106'),
      S('M 160 250 L 156 260 M 166 256 L 166 266'),
      'M 222 380 L 214 386 M 238 384 L 232 390 M 174 374 L 166 380 M 190 378 L 184 384',
      clip(volcano, [bodyR]),
      line(14, 390, 386, 390),
    ],
    [
      S(ellipse(54, 132, 4, 2.5)),
      S('M 82 192 C 100 182 122 176 138 172'),
      clip(clip(S('M 176 206 C 190 226 210 238 236 240 M 168 196 C 184 214 204 226 232 228'), [bodyR], 'inside'), [region(thigh), region(arm)]),
      S('M 196 124 L 200 114 M 220 136 L 226 126 M 250 140 L 256 130 M 282 141 L 288 131 M 314 142 L 320 132 M 346 144 L 350 135'),
      clip(S(`${circle(214, 168, 3)} ${circle(236, 158, 3)} ${circle(306, 160, 3)} ${circle(330, 156, 3)} ${circle(196, 150, 3)} ${circle(170, 140, 3)}`), [region(thigh)]),
      clip(S('M 236 190 C 248 200 252 216 250 232'), [region(thigh)], 'inside'),
      S('M 20 120 L 30 130 M 10 160 L 24 160 M 18 196 L 28 188'),
      'M 352 390 C 348 366 336 350 322 340 M 352 390 C 356 364 368 348 384 340 M 352 390 C 352 366 352 350 354 332',
      clip('M 296 46 C 290 36 300 30 296 20 C 306 24 312 18 318 24 C 326 18 336 26 330 36 C 334 42 328 50 322 48', [bodyR]),
      clip('M 286 92 L 296 80 M 336 92 L 328 82 M 306 108 L 312 98', [bodyR]),
      'M 30 60 Q 40 50 50 60 Q 60 50 70 60 M 90 40 Q 98 32 106 40 Q 114 32 122 40',
    ],
  );
}

// ---- 6. long-neck dinosaur --------------------------------------------------------------------

function longNeck(): Template {
  const body =
    'M 62 104 C 60 86 82 78 100 82 C 116 86 126 98 130 112 C 142 160 162 196 200 210 ' +
    'C 236 190 302 188 328 222 C 344 244 364 262 392 268 C 362 280 336 274 318 270 ' +
    'C 300 296 252 300 212 296 C 174 292 148 270 138 240 C 126 200 108 154 98 118 C 86 116 70 114 62 104 Z';
  const legs = [rrect(152, 262, 34, 92, 12), rrect(278, 262, 36, 92, 12)];
  const far = [rrect(190, 258, 28, 86, 10), rrect(248, 258, 28, 86, 10)];
  const layers = stack([...legs, body, ...far]);
  const bodyR = region(body);
  const trunk = 'M 46 344 C 52 300 50 250 40 214 L 52 212 C 62 250 64 300 58 344 Z';
  return tpl(
    'long-neck-dinosaur',
    'Gentle long-neck dinosaur',
    'beginner',
    ['dinosaur', 'prehistoric', 'adventure', 'reptile', 'gentle', 'animal', 'kids'],
    [
      ...layers,
      circle(90, 94, 4),
      'M 66 106 Q 74 112 82 108',
      trunk,
      petal(46, 212, -60, 52, 10),
      petal(46, 212, -20, 50, 9),
      petal(46, 212, 30, 52, 10),
      petal(46, 212, 75, 50, 9),
      line(16, 354, 384, 354),
      'M 300 120 L 330 56 L 370 120',
    ],
    [
      clip(`${circle(240, 228, 10)} ${circle(270, 222, 7)} ${circle(292, 236, 9)} ${circle(258, 252, 6)} ${circle(222, 248, 6)}`, [bodyR], 'inside'),
      'M 160 354 L 160 346 M 168 354 L 168 346 M 286 354 L 286 346 M 296 354 L 296 346',
      'M 318 94 C 324 88 330 92 336 86 C 342 92 346 88 352 94',
      'M 322 50 C 318 40 326 34 324 24 M 334 48 C 336 38 344 34 342 26',
      clip('M 140 204 C 160 234 190 252 220 258', [bodyR], 'inside'),
      'M 110 354 Q 112 342 106 334 M 118 354 L 118 336 M 126 354 Q 124 342 130 334',
      'M 340 354 Q 342 342 336 334 M 348 354 L 348 336',
      'M 170 60 C 176 52 186 52 192 60 M 230 40 C 236 32 246 32 252 40',
    ],
  );
}

// ---- 7. wizard --------------------------------------------------------------------------------

function wizard(): Template {
  const brim = ellipse(190, 152, 98, 16);
  const cone = 'M 126 150 C 160 128 182 82 214 42 C 224 30 238 26 250 34 C 238 38 230 46 228 58 C 224 92 236 126 256 150 Z';
  const face = ellipse(190, 190, 36, 38);
  const nose = ellipse(190, 196, 9, 8);
  const mous = 'M 190 204 C 176 196 160 204 154 218 C 168 214 180 214 190 210 C 200 214 212 214 226 218 C 220 204 204 196 190 204 Z';
  const beard = 'M 156 198 C 140 252 152 304 190 342 C 228 304 240 252 224 198 C 210 222 170 222 156 198 Z';
  const robe = 'M 150 216 C 130 276 112 330 98 370 L 282 370 C 268 330 250 276 230 216 C 214 206 166 206 150 216 Z';
  const sleeveR = 'M 228 218 C 252 220 276 232 292 248 L 278 270 C 262 262 246 254 236 250 Z';
  const handR = circle(296, 254, 14);
  const staff = rrect(292, 70, 12, 300, 6);
  const crystal = poly([[298, 22], [314, 46], [298, 72], [282, 46]]);
  const sleeveL = 'M 152 218 C 132 236 118 262 112 290 L 138 298 C 142 276 150 256 160 244 Z';
  const handL = circle(124, 302, 13);
  const shoes = ['M 148 370 C 136 370 120 380 112 386 C 132 388 160 386 170 380 L 168 370 Z', 'M 212 370 L 210 380 C 220 386 248 388 268 386 C 260 380 244 370 232 370 Z'];
  const layers = stack([nose, mous, brim, cone, beard, face, handR, crystal, staff, sleeveR, handL, sleeveL, robe, ...shoes]);
  return tpl(
    'wizard',
    'Wise old wizard',
    'intermediate',
    ['wizard', 'magic', 'fantasy', 'spell', 'staff', 'adventure', 'kids'],
    [
      ...layers,
      happyEye(176, 184, 7),
      happyEye(204, 184, 7),
      'M 162 174 Q 174 165 186 171 M 194 171 Q 206 165 218 174',
      line(16, 386, 384, 386),
    ],
    [
      clip(`${softStar(204, 102, 9, 4, 5, 2)} ${softStar(232, 128, 7, 3, 5, 2)} ${softStar(178, 132, 6, 3, 5, 2)}`, [region(cone)], 'inside'),
      clip(`${softStar(120, 340, 8, 4, 5, 2)} ${softStar(250, 320, 7, 3, 5, 2)} ${softStar(140, 290, 6, 3, 5, 2)}`, [region(robe)], 'inside'),
      clip('M 172 230 C 168 260 174 290 186 316 M 190 226 L 190 330 M 208 230 C 212 260 206 290 194 316', [region(beard)], 'inside'),
      'M 298 30 L 298 64 M 288 46 L 308 46',
      sparkle(338, 30, 12),
      sparkle(262, 20, 8),
      sparkle(344, 98, 8),
      sparkle(60, 120, 10),
      'M 314 32 C 330 40 336 54 330 66',
      `${circle(70, 220, 2.5)} ${circle(340, 160, 2.5)} ${circle(52, 60, 2.5)}`,
    ],
  );
}

// ---- 8. mountain dragon (advanced) --------------------------------------------------------

function dragon(): Template {
  const neckBack: [P, P, P, P] = [[146, 92], [186, 100], [206, 140], [236, 168]];
  const back: [P, P, P, P] = [[236, 168], [280, 196], [320, 220], [330, 270]];
  const body =
    'M 146 92 C 186 100 206 140 236 168 C 280 196 320 220 330 270 C 322 300 290 316 250 316 ' +
    'C 210 316 178 296 164 264 C 152 236 148 200 130 170 C 122 156 120 144 124 128 C 128 110 136 96 146 92 Z';
  const head =
    'M 140 80 C 120 70 90 72 70 84 C 56 90 42 94 34 100 C 26 106 28 116 38 119 C 52 132 90 138 120 136 ' +
    'C 140 134 156 120 158 104 C 158 92 152 84 140 80 Z';
  const horn1 = 'M 130 82 C 152 62 178 48 208 42 C 188 58 168 76 150 96 Z';
  const horn2 = 'M 140 100 C 162 90 186 86 212 90 C 190 96 172 104 152 114 Z';
  const wing =
    'M 236 168 C 250 130 270 102 298 94 C 318 86 332 66 344 44 Q 350 34 356 44 C 370 54 384 64 394 74 ' +
    'Q 374 108 392 152 Q 352 168 366 214 Q 330 210 312 250 L 240 190 Z';
  const farWing = rotate(wing, -18, 236, 168);
  const thigh = rotate(ellipse(284, 290, 42, 54), -25, 284, 290);
  const foot =
    'M 296 314 C 304 336 302 350 288 356 C 270 358 252 358 240 362 C 230 366 232 376 242 376 L 304 376 C 318 376 322 364 318 340 Z';
  const arm =
    'M 192 258 C 186 290 176 318 170 340 C 156 344 146 350 146 360 C 146 366 152 368 160 368 L 202 368 ' +
    'C 210 368 212 360 206 352 L 200 344 C 208 318 216 292 226 266 Z';
  const tail =
    'M 318 262 C 352 292 352 342 314 362 C 262 390 162 390 96 372 C 80 368 70 360 64 350 C 84 356 112 362 152 364 ' +
    'C 212 366 270 358 298 336 C 316 322 316 300 300 286 Z';
  const tip = roundPoly([[72, 346], [54, 336], [32, 356], [54, 374], [72, 364]], 4);
  const spikeN = spikesAlong(neckBack, 4, 16, 7, 0.15, 0.95);
  const spikeB = spikesAlong(back, 5, 18, 8, 0.02, 0.8);
  const front = [head, horn1, horn2, arm, foot, thigh, tip, tail];
  const layers = stack([...front, body, ...spikeN, ...spikeB, wing, farWing]);
  const frontR = front.map(region);
  const bodyR = region(body);
  const wingR = region(wing);
  // belly plates between the front line and an inner line
  const outer1: [P, P, P, P] = [[250, 316], [210, 316], [178, 296], [164, 264]];
  const inner1: [P, P, P, P] = [[252, 296], [220, 296], [196, 280], [186, 256]];
  const outer2: [P, P, P, P] = [[164, 264], [152, 236], [148, 200], [130, 170]];
  const inner2: [P, P, P, P] = [[186, 256], [174, 228], [170, 196], [152, 156]];
  let plates = '';
  for (const [o, i] of [[outer1, inner1], [outer2, inner2]] as const) {
    const a = sampleCubic(...o, 6);
    const b = sampleCubic(...i, 6);
    for (let k = 1; k <= 6; k++) plates += ` M ${f(a[k][0])} ${f(a[k][1])} Q ${f((a[k][0] + b[k][0]) / 2 + 3)} ${f((a[k][1] + b[k][1]) / 2 + 3)} ${f(b[k][0])} ${f(b[k][1])}`;
  }
  const innerLine = `M 252 296 C 220 296 196 280 186 256 C 174 228 170 196 152 156 C 146 144 140 136 136 128`;
  const bellyBand = region('M 250 318 C 210 318 176 298 162 264 C 150 236 146 200 128 170 L 136 120 L 156 154 C 172 196 176 228 188 256 C 198 278 220 294 254 294 Z');
  const scales = clip(clip(scaleRows(150, 340, 150, 300, 7), [bodyR], 'inside'), [...frontR, bellyBand]);
  const tailScales = clip(clip(scaleRows(80, 330, 362, 382, 6), [region(tail)], 'inside'), [region(foot), region(arm)]);
  const tailPlates = clip(
    [110, 140, 170, 200, 230, 260].map((x) => `M ${x} 360 L ${x + 4} 372`).join(' ') + ' M 286 344 L 294 356 M 304 318 L 316 324',
    [region(tail)],
    'inside',
  );
  const wingRibs = clip(clip('M 350 42 L 392 152 M 350 42 L 366 214 M 350 42 C 340 120 326 180 312 250', [wingR], 'inside'), [bodyR, ...spikeB.map(region)]);
  const farRibs = clip(
    clip(rotate('M 350 42 L 392 152 M 350 42 L 366 214', -18, 236, 168), [region(farWing)], 'inside'),
    [wingR, bodyR, ...frontR, ...spikeN.map(region)],
  );
  const membrane = clip(
    clip('M 300 100 C 330 120 352 150 360 180 M 306 130 C 330 150 344 180 348 206 M 288 120 C 300 160 304 200 300 230', [wingR], 'inside'),
    [bodyR, ...spikeB.map(region)],
  );
  const thighScales = clip(scaleRows(256, 312, 262, 318, 6), [region(thigh)], 'inside');
  return tpl(
    'dragon',
    'Mountain dragon',
    'advanced',
    ['dragon', 'fantasy', 'wings', 'scales', 'adventure', 'epic', 'creature'],
    [
      ...layers,
      'M 92 92 C 100 86 112 86 118 94 C 110 100 100 100 92 92 Z',
      'M 104 89 L 104 98',
      'M 84 84 C 96 76 112 76 122 82',
      'M 40 117 C 60 122 86 124 112 120 C 118 118 122 114 124 110',
      'M 54 120 L 58 128 L 62 121 M 72 122 L 76 130 L 80 123',
      'M 44 104 C 48 100 52 101 52 105',
      'M 160 106 L 186 114 L 160 118 M 156 122 L 176 134 L 152 130',
      tip,
      'M 146 360 L 136 364 M 160 368 L 152 374 M 174 368 L 168 376',
      'M 240 362 L 230 366 M 254 376 L 246 382 M 270 376 L 264 382',
      line(10, 390, 390, 390),
    ],
    [
      clip(plates, [...frontR.filter((_, k) => k !== 0)]),
      clip(innerLine, [...frontR]),
      scales,
      tailScales,
      tailPlates,
      wingRibs,
      farRibs,
      membrane,
      thighScales,
      'M 160 344 L 160 366 M 176 344 L 178 366',
      clip('M 258 356 C 264 364 266 370 266 376 M 276 356 C 282 364 284 370 284 376', [region(foot)], 'inside'),
      clip('M 62 108 C 72 112 80 112 88 108 M 132 96 C 138 104 140 114 136 124', [region(head)], 'inside'),
      'M 20 60 C 30 50 44 50 54 60 C 64 52 78 54 82 64 M 10 160 C 20 150 34 150 44 160',
      'M 70 220 C 76 214 82 214 88 220 C 94 214 100 214 106 220',
    ],
  );
}

// ---- 9. friendly robot ------------------------------------------------------------------------

function robot(): Template {
  const head = rrect(128, 86, 144, 104, 30);
  const screen = rrect(148, 106, 104, 64, 20);
  const earL = rrect(110, 116, 22, 44, 8);
  const earR = rrect(268, 116, 22, 44, 8);
  const neck = rrect(182, 184, 36, 20, 4);
  const body = rrect(136, 200, 128, 110, 26);
  const armL = rotate(rrect(122, 212, 28, 76, 14), 140, 136, 222);
  const handL = circle(...polar(136, 222, 78, -40), 16);
  const armR = rotate(rrect(250, 212, 28, 76, 14), -18, 264, 222);
  const handR = circle(...polar(264, 222, 76, 162), 16);
  const legL = rrect(158, 302, 30, 40, 10);
  const legR = rrect(212, 302, 30, 40, 10);
  const footL = rrect(144, 336, 54, 26, 13);
  const footR = rrect(202, 336, 54, 26, 13);
  const ant = 'M 196 86 L 196 60 L 204 60 L 204 86 Z';
  const ball = circle(200, 50, 11);
  const layers = stack([ball, ant, head, earL, earR, neck, handL, armL, handR, armR, footL, footR, legL, legR, body]);
  const heart =
    'M 200 236 C 196 226 180 226 180 238 C 180 250 194 256 200 264 C 206 256 220 250 220 238 C 220 226 204 226 200 236 Z';
  return tpl(
    'robot',
    'Friendly helper robot',
    'beginner',
    ['robot', 'sci-fi', 'machine', 'friendly', 'future', 'cute', 'kids'],
    [
      ...layers,
      screen,
      `${circle(178, 136, 11)} ${circle(222, 136, 11)}`,
      smile(200, 150, 10),
      heart,
      `${circle(170, 284, 6)} ${circle(200, 284, 6)} ${circle(230, 284, 6)}`,
      line(40, 362, 360, 362),
    ],
    [
      `${circle(181, 132, 3)} ${circle(225, 132, 3)}`,
      `${circle(142, 100, 3)} ${circle(258, 100, 3)} ${circle(142, 176, 3)} ${circle(258, 176, 3)}`,
      `${line(117, 130, 125, 130)} ${line(117, 146, 125, 146)} ${line(275, 130, 283, 130)} ${line(275, 146, 283, 146)}`,
      'M 160 336 L 160 344 M 186 336 L 186 344 M 214 336 L 214 344 M 240 336 L 240 344',
      sparkle(70, 70, 14),
      sparkle(334, 60, 10),
      sparkle(330, 250, 9),
      'M 80 110 C 74 120 74 132 80 142 M 64 102 C 56 118 56 136 64 152',
    ],
  );
}

// ---- 10. pirate galleon (advanced) ----------------------------------------------------------

function pirateShip(): Template {
  const hull = 'M 46 232 L 80 246 L 290 246 L 296 214 L 350 206 C 356 244 346 284 322 306 L 116 306 C 86 298 62 270 46 232 Z';
  const sea = waveBand(10, 390, 300, 390, 38, 14);
  const sail = (cx: number, y1: number, y2: number, w: number): string => {
    const m = (y1 + y2) / 2;
    return (
      `M ${f(cx - w / 2)} ${f(y1)} L ${f(cx + w / 2)} ${f(y1)} Q ${f(cx + w / 2 + 12)} ${f(m)} ${f(cx + w / 2 + 2)} ${f(y2)} ` +
      `Q ${f(cx)} ${f(y2 + 18)} ${f(cx - w / 2 - 2)} ${f(y2)} Q ${f(cx - w / 2 - 12)} ${f(m)} ${f(cx - w / 2)} ${f(y1)} Z`
    );
  };
  const yard = (cx: number, y: number, w: number): string => rrect(cx - w / 2 - 8, y - 4, w + 16, 7, 3);
  const sails = [sail(120, 80, 128, 70), sail(120, 140, 206, 100), sail(204, 48, 104, 84), sail(204, 118, 200, 124), sail(286, 96, 168, 78)];
  const yards = [yard(120, 80, 70), yard(120, 140, 100), yard(204, 48, 84), yard(204, 118, 124), yard(286, 96, 78)];
  const masts = [rrect(116, 66, 8, 182, 3), rrect(200, 30, 8, 218, 3), rrect(282, 82, 8, 136, 3)];
  const nest = rrect(188, 106, 32, 12, 3);
  const jib = 'M 112 84 Q 66 150 26 216 L 108 214 Z';
  const bowsprit = rotate(rrect(10, 216, 52, 6, 3), -28, 50, 226);
  const flag = 'M 208 18 C 222 10 236 26 256 18 C 250 26 252 34 258 40 C 238 48 224 32 208 40 Z';
  const pennant = 'M 124 54 L 160 62 L 124 70 Z';
  const lantern = rrect(344, 186, 14, 20, 4);
  const front = [sea, ...yards, nest, ...sails, flag, pennant, lantern];
  const layers = stack([...front, ...masts, hull, jib, bowsprit]);
  layers[0] = sea.split(' L ')[0]; // draw only the wave crest, not the box around the water
  const hullR = region(hull);
  const seaR = region(sea);
  const sailR = [...sails, ...yards, nest].map(region);
  // skull and crossbones on the big main sail
  const bone = (deg: number): string => {
    const b = rrect(178, 162, 52, 7, 3.5);
    const ends = `${circle(178, 162, 4.5)} ${circle(178, 169, 4.5)} ${circle(230, 162, 4.5)} ${circle(230, 169, 4.5)}`;
    return rotate(`${b} ${ends}`, deg, 204, 165.5);
  };
  const skull = 'M 204 134 C 222 134 230 146 228 158 C 226 166 220 168 218 174 L 190 174 C 188 168 182 166 180 158 C 178 146 186 134 204 134 Z';
  const skullArt = [
    clip(`${bone(30)} ${bone(-30)}`, [region(skull)]),
    skull,
    `${circle(196, 154, 5)} ${circle(212, 154, 5)}`,
    'M 202 164 L 204 160 L 206 164 Z',
    'M 196 174 L 196 168 M 204 174 L 204 168 M 212 174 L 212 168',
  ];
  const planks = clip(clip('M 56 258 C 140 266 260 262 340 250 M 70 276 C 150 284 260 280 334 268 M 90 292 C 160 298 260 296 326 286', [hullR], 'inside'), [seaR]);
  const ports = clip([130, 166, 202, 238, 274].map((x) => rrect(x, 254, 14, 12, 2)).join(' '), [seaR]);
  const rig = clip(
    'M 120 66 L 50 232 M 120 66 L 160 246 M 204 30 L 132 246 M 204 30 L 270 246 M 286 82 L 250 246 M 286 82 L 344 208 M 204 30 L 124 66 M 208 34 L 286 84',
    [...sailR, hullR, region(jib), region(flag)],
  );
  return tpl(
    'pirate-ship',
    'Pirate galleon at sea',
    'advanced',
    ['pirate', 'ship', 'sailing', 'ocean', 'adventure', 'treasure', 'nautical'],
    [
      ...layers,
      ...skullArt,
      ports,
      clip(`${rrect(304, 222, 12, 16, 2)} ${rrect(322, 220, 12, 16, 2)}`, [seaR]),
      'M 30 60 Q 40 50 50 60 Q 60 50 70 60',
      'M 330 40 Q 338 32 346 40 Q 354 32 362 40',
    ],
    [
      planks,
      rig,
      clip('M 300 214 L 300 246 M 296 222 L 352 214', [seaR, region(lantern)]),
      clip('M 120 92 C 118 104 118 116 120 124 M 102 94 C 100 104 100 114 102 124 M 138 94 C 140 104 140 114 138 124', [region(sails[0])], 'inside'),
      clip('M 96 154 C 94 170 94 186 96 202 M 144 154 C 146 170 146 186 144 202 M 120 152 L 120 206', [region(sails[1])], 'inside'),
      clip('M 186 62 C 184 76 184 90 186 100 M 222 62 C 224 76 224 90 222 100', [region(sails[2])], 'inside'),
      clip('M 162 130 C 158 150 158 176 162 196 M 246 130 C 250 150 250 176 246 196', [region(sails[3])], 'inside'),
      clip('M 270 110 C 268 130 268 150 270 166 M 302 110 C 304 130 304 150 302 166', [region(sails[4])], 'inside'),
      clip('M 26 330 C 50 324 70 336 94 330 M 120 352 C 150 346 176 358 204 352 M 240 334 C 266 328 290 340 316 334 M 60 370 C 90 364 116 376 146 370 M 250 372 C 280 366 310 378 340 372', [seaR], 'inside'),
      'M 214 26 C 226 22 236 32 248 26',
      `${circle(350, 196, 3)}`,
      'M 300 60 C 320 50 350 50 370 62 C 380 56 392 60 390 70 L 300 70 Z',
      'M 20 140 C 30 128 50 128 60 138 C 70 132 84 136 84 146 L 20 146 Z',
    ],
  );
}

// ---- 11. treasure map -------------------------------------------------------------------------

function treasureMap(): Template {
  const sheet = 'M 66 66 L 334 66 C 326 120 344 180 332 240 C 326 280 340 310 334 334 L 66 334 C 72 300 56 260 68 200 C 74 150 58 110 66 66 Z';
  const rollTop = rrect(44, 46, 312, 30, 15);
  const rollBot = rrect(44, 324, 312, 30, 15);
  const [rt, rb, sh] = stack([rollTop, rollBot, sheet]);
  const island =
    'M 104 200 C 96 160 130 132 170 140 C 200 120 250 128 266 160 C 300 170 304 214 280 240 C 270 280 220 296 180 282 C 140 296 104 270 110 240 C 96 228 98 212 104 200 Z';
  const islandR = region(island);
  // dashed trail
  const trail: [P, P, P, P] = [[138, 176], [160, 250], [210, 200], [250, 254]];
  const pts = sampleCubic(...trail, 28);
  let dash = '';
  for (let k = 0; k < pts.length - 1; k += 2) dash += ` M ${f(pts[k][0])} ${f(pts[k][1])} L ${f(pts[k + 1][0])} ${f(pts[k + 1][1])}`;
  const mountain = 'M 176 196 L 196 162 L 210 182 L 220 170 L 240 196';
  const palmTrunk = 'M 140 186 C 144 172 144 160 138 148';
  const leaves = [-80, -30, 20, 70].map((a) => petal(138, 148, a, 24, 5)).join(' ');
  return tpl(
    'treasure-map',
    'Treasure island map',
    'intermediate',
    ['treasure', 'map', 'pirate', 'island', 'adventure', 'compass', 'kids'],
    [
      rt,
      rb,
      sh,
      island,
      mountain,
      palmTrunk,
      leaves,
      dash.trim(),
      'M 242 246 L 258 262 M 258 246 L 242 262',
      star(292, 108, 26, 6, 4),
      circle(292, 108, 8),
      'M 286 72 L 286 62 L 298 72 L 298 62',
    ],
    [
      `${circle(59, 61, 7)} ${circle(341, 61, 7)} ${circle(59, 339, 7)} ${circle(341, 339, 7)}`,
      star(292, 108, 16, 4, 4, 45),
      clip('M 90 110 Q 98 104 106 110 Q 114 104 122 110 M 230 98 Q 238 92 246 98 Q 254 92 262 98 M 92 290 Q 100 284 108 290 Q 116 284 124 290 M 270 290 Q 278 284 286 290 Q 294 284 302 290 M 300 200 Q 308 194 316 200', [islandR]),
      clip('M 116 216 C 130 230 146 232 160 230 M 250 170 C 264 176 276 190 278 206 M 200 272 C 220 276 240 270 256 260', [islandR], 'inside'),
      'M 188 184 L 196 176 L 204 186 M 214 180 L 220 176',
      'M 80 250 C 86 240 96 240 100 250 L 92 252 Z M 84 250 L 86 236 C 90 238 94 240 96 246',
      'M 290 312 C 300 300 316 298 324 306',
    ],
  );
}

// ---- 12. popcorn and clapperboard ------------------------------------------------------------

function popcornClapper(): Template {
  const rim = rrect(96, 172, 160, 22, 8);
  const bucket = roundPoly([[106, 188], [246, 188], [228, 364], [124, 364]], 8);
  const puff = (cx: number, cy: number, r: number): string[] => [
    circle(cx, cy, r),
    circle(cx - r * 0.75, cy + r * 0.2, r * 0.68),
    circle(cx + r * 0.75, cy + r * 0.15, r * 0.7),
    circle(cx + r * 0.1, cy - r * 0.62, r * 0.62),
  ];
  const puffs = [
    puff(124, 168, 20), puff(170, 160, 22), puff(216, 164, 21), puff(244, 170, 16),
    puff(146, 130, 19), puff(196, 124, 21), puff(234, 134, 16), puff(172, 96, 17),
  ];
  const board = rrect(232, 238, 150, 110, 8);
  const stick = rotate(rrect(232, 210, 150, 26, 4), -16, 236, 236);
  const layers = stack([rim, ...puffs, bucket, stick, board]);
  const bucketR = region(bucket);
  const stripes = clip('M 140 194 L 150 364 M 176 194 L 176 364 M 212 194 L 202 364', [bucketR], 'inside');
  const badge = circle(176, 272, 26);
  const boardR = region(board);
  const stickR = region(stick);
  const diag = (y0: number) => [0, 1, 2, 3, 4, 5].map((k) => `M ${232 + k * 30} ${y0 + 30} L ${252 + k * 30} ${y0}`).join(' ');
  return tpl(
    'popcorn-clapperboard',
    'Popcorn and clapperboard',
    'beginner',
    ['popcorn', 'cinema', 'film', 'snack', 'clapperboard', 'movie-night', 'kids'],
    [
      ...layers,
      clip(stripes, [region(badge)]),
      badge,
      softStar(176, 272, 16, 7, 5, 2),
      clip(clip(diag(238), [boardR], 'inside'), [bucketR]),
      clip(rotate(diag(210), -16, 236, 236), [stickR], 'inside'),
      clip('M 232 268 L 382 268', [bucketR]),
      circle(240, 238, 5),
    ],
    [
      clip('M 252 292 L 360 292 M 252 312 L 330 312 M 252 330 L 350 330', [bucketR]),
      `${puff(60, 352, 9).join(' ')}`,
      `${puff(300, 376, 9).join(' ')}`,
      sparkle(66, 90, 14),
      sparkle(310, 80, 11),
      sparkle(350, 170, 8),
      `${circle(100, 40, 2.5)} ${circle(250, 40, 2.5)} ${circle(40, 220, 2.5)}`,
    ],
  );
}

// ---- 13. film reel and 3D glasses -----------------------------------------------------------

function reelGlasses(): Template {
  const reel = circle(150, 140, 104);
  const holes = [0, 72, 144, 216, 288].map((a) => circle(...polar(150, 140, 56, a), 24)).join(' ');
  // film strip ribbon leaving the bottom of the reel
  const c: [P, P, P, P] = [[110, 266], [240, 270], [270, 170], [388, 200]];
  const N = 40;
  const top: P[] = [];
  const bot: P[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = bez(...c, t);
    const [ux, uy] = tangent(...c, t);
    top.push([p[0] + uy * 22, p[1] - ux * 22]);
    bot.push([p[0] - uy * 22, p[1] + ux * 22]);
  }
  const strip = poly([...top, ...bot.reverse()]);
  bot.reverse();
  const glasses = rotate(
    'M 40 300 L 250 300 C 260 300 264 306 264 314 L 264 352 C 264 362 258 366 250 366 L 186 366 C 176 366 170 348 152 348 C 134 348 128 366 118 366 L 54 366 C 46 366 40 362 40 352 Z',
    -6,
    152,
    330,
  );
  const lensL = rotate(rrect(54, 312, 84, 42, 10), -6, 152, 330);
  const lensR = rotate(rrect(166, 312, 84, 42, 10), -6, 152, 330);
  const templeL = rotate('M 40 308 L 18 296 L 18 304 L 40 318 Z', -6, 152, 330);
  const layers = stack([glasses, templeL, reel, strip]);
  const stripR = region(strip);
  let frames = '';
  let sprockets = '';
  for (let i = 4; i < N; i += 6) {
    frames += ` M ${f(top[i][0])} ${f(top[i][1])} L ${f(bot[i][0])} ${f(bot[i][1])}`;
  }
  for (let i = 2; i < N - 1; i += 3) {
    const p = bez(...c, i / N);
    const [ux, uy] = tangent(...c, i / N);
    for (const s of [16, -16]) {
      const q: P = [p[0] + uy * s, p[1] - ux * s];
      sprockets += ` ${rotate(rrect(q[0] - 3, q[1] - 2.5, 6, 5, 1.5), (Math.atan2(uy, ux) * 180) / Math.PI, q[0], q[1])}`;
    }
  }
  const hide = [region(glasses), region(reel), region(templeL)];
  const hatch = clip(
    [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `M ${170 + k * 12} 358 L ${190 + k * 12} 306`).join(' '),
    [region(lensR)],
    'inside',
  );
  return tpl(
    'film-reel-3d-glasses',
    'Film reel and 3D glasses',
    'beginner',
    ['film', 'cinema', 'reel', 'glasses', 'theater', 'movie-night', 'kids'],
    [...layers, lensL, lensR, clip(holes, [region(glasses)]), circle(150, 140, 14)],
    [
      clip(circle(150, 140, 92), [region(glasses)]),
      clip(clip(`${frames} ${sprockets}`, [stripR], 'inside'), hide),
      hatch,
      'M 64 322 C 70 316 80 314 88 316',
      sparkle(330, 70, 16),
      sparkle(292, 120, 9),
      sparkle(370, 130, 8),
      `${circle(286, 40, 2.5)} ${circle(372, 300, 2.5)} ${circle(300, 380, 2.5)}`,
    ],
  );
}

// ---- 14. jungle temple expedition (advanced) -----------------------------------------------

function jungleExpedition(): Template {
  const tiers = [rrect(76, 262, 248, 40, 3), rrect(100, 224, 200, 40, 3), rrect(124, 186, 152, 40, 3), rrect(148, 148, 104, 40, 3)];
  const shrine = 'M 166 150 L 166 104 L 234 104 L 234 150 Z';
  const roof = 'M 156 106 L 200 74 L 244 106 Z';
  const door = 'M 188 150 L 188 128 A 12 12 0 0 1 212 128 L 212 150 Z';
  const stairs = 'M 184 150 L 168 302 L 232 302 L 216 150 Z';
  // foreground: explorer's helmet and lantern on a rock, framed by big leaves
  const helmet = 'M 230 350 C 230 292 300 292 300 350 Z';
  const brim = 'M 212 356 C 214 340 316 340 318 356 C 300 366 230 366 212 356 Z';
  const lantern = rrect(112, 318, 32, 44, 6);
  const lanternTop = 'M 108 320 L 148 320 L 138 306 L 118 306 Z';
  const rock = 'M 70 384 C 70 346 130 336 200 340 C 270 336 330 346 330 384 Z';
  const leavesL = [veinLeaf(30, 392, 30, 200, 24, 6), veinLeaf(30, 392, 8, 160, 18, 5)];
  const leavesR = [veinLeaf(370, 392, -30, 200, 24, 6), veinLeaf(370, 392, -8, 160, 18, 5)];
  const leaves = [...leavesL, ...leavesR];
  const vineL = 'M 30 8 C 40 60 20 100 34 150 C 42 180 36 200 30 220';
  const vineR = 'M 372 8 C 360 50 382 90 366 130 C 358 150 362 170 368 188';
  const vineLeaves = [
    petal(34, 60, 60, 22, 6), petal(30, 100, -60, 22, 6), petal(34, 150, 60, 20, 6), petal(32, 196, -60, 18, 5),
    petal(366, 50, -60, 22, 6), petal(374, 96, 60, 22, 6), petal(364, 140, -60, 20, 6),
  ];
  const front = [brim, helmet, lanternTop, lantern, ...leaves.map((l) => l[0]), rock];
  const temple = [roof, door, shrine, stairs, ...tiers];
  const layers = stack([...front, ...vineLeaves, vineL, vineR, ...temple]);
  const frontR = front.map(region);
  const stairsR = region(stairs);
  // stone blocks on each tier
  let blocks = '';
  tiers.forEach((_, k) => {
    const y = [282, 244, 206, 168][k];
    const x0 = [76, 100, 124, 148][k];
    const x1 = [324, 300, 276, 252][k];
    blocks += ` M ${x0} ${y} L ${x1} ${y}`;
    for (let x = x0 + 20 + (k % 2) * 12; x < x1 - 8; x += 26) blocks += ` M ${x} ${y - 20} L ${x} ${y} M ${x + 13} ${y} L ${x + 13} ${y + 20}`;
  });
  const steps: string[] = [];
  for (let y = 162; y < 302; y += 12) {
    const t = (y - 150) / 152;
    steps.push(`M ${f(184 - t * 16)} ${y} L ${f(216 + t * 16)} ${y}`);
  }
  const mountains = 'M 40 230 L 96 150 L 130 190 L 168 120 L 200 74 M 244 106 L 268 130 L 300 96 L 360 190';
  const sun = circle(300, 56, 22);
  return tpl(
    'jungle-temple',
    'Jungle temple expedition',
    'advanced',
    ['jungle', 'temple', 'explorer', 'adventure', 'expedition', 'ruins', 'tropical'],
    [
      ...layers,
      clip(mountains, [...temple.map(region), ...frontR, region(vineL)]),
      clip(sun, [...temple.map(region)]),
      'M 122 330 L 122 352 M 134 330 L 134 352 M 128 300 C 128 290 136 290 136 300',
      clip('M 226 334 C 246 326 284 326 304 334', [region(brim)]),
      circle(265, 304, 4),
    ],
    [
      clip(clip(blocks, [stairsR, region(shrine)]), frontR),
      clip(steps.join(' '), frontR),
      ...leaves.map((l, k) => clip(l[1], [...frontR.slice(0, 4), ...leaves.slice(k < 2 ? 0 : 2, k).map((x) => region(x[0]))])),
      'M 180 120 L 220 120 M 176 104 L 224 104',
      clip('M 152 196 C 160 208 156 222 164 236 M 248 196 C 240 210 246 226 238 238 M 108 268 C 116 278 112 290 120 300', frontR),
      'M 80 40 Q 88 32 96 40 Q 104 32 112 40 M 120 64 Q 126 58 132 64 Q 138 58 144 64',
      'M 300 24 L 300 14 M 326 32 L 334 24 M 274 32 L 266 24 M 332 56 L 342 56 M 268 56 L 258 56',
      clip(clip('M 150 372 C 170 366 190 368 204 374 M 170 352 C 186 348 200 350 210 354', [region(rock)], 'inside'), frontR.slice(0, 4)),
      clip('M 244 330 C 246 316 254 306 265 304 M 265 304 L 265 330 M 286 330 C 284 316 276 306 265 304', [region(helmet)], 'inside'),
    ],
  );
}

// ==== fb-1022b B3 (T111): more genres and the Linework cast (docs/CAST.md) ===========================
// Sci-fi, monsters, mystery, westerns, pirates, spy gadgets and the cinema, plus four of our own recurring
// characters: Nova (young astronaut), Inspector Quill (heron detective), Captain Ottoline (sea-otter pirate
// captain, shell badge, never a skull) and Sheriff Sage (tortoise cowboy). Each character is built once below
// in a local frame (feet near y = 56) and placed into scenes, so every appearance stays on-model.

/** A placed character: closed shapes front to back, open lines drawn on top, fine detail, and anchor points. */
type Fig = { shapes: string[]; lines: string[]; detail: string[]; at: Record<string, P> };

function placeFig(g: Fig, s: number, dx: number, dy: number, flip = false): Fig {
  const m = (d: string): string => mapPath(d, { map: (x, y) => [(flip ? -x : x) * s + dx, y * s + dy], scale: s, rotate: 0, flip });
  const at: Record<string, P> = {};
  for (const [k, [x, y]] of Object.entries(g.at)) at[k] = [(flip ? -x : x) * s + dx, y * s + dy];
  return { shapes: g.shapes.map(m), lines: g.lines.map(m).filter(Boolean), detail: g.detail.map(m).filter(Boolean), at };
}

/** Limb from a shoulder: rounded bar of length len and width w at angle deg (0 = hanging down, clockwise), plus a round hand. */
function limb(sx: number, sy: number, len: number, w: number, deg: number, hand: number): [string, string, P] {
  const a = rotate(rrect(sx - w / 2, sy - w / 2, w, len, w / 2), deg, sx, sy);
  const r = (deg * Math.PI) / 180;
  const h: P = [sx - (len - w / 2) * Math.sin(r), sy + (len - w / 2) * Math.cos(r)];
  return [a, circle(h[0], h[1], hand), h];
}

/** Scallop shell (outline, ribs): Captain Ottoline's badge. */
function scallop(cx: number, cy: number, r: number): [string, string] {
  const b: P = [cx, cy + r * 0.7];
  const R = r * 1.5;
  const n = 5;
  const ang = (k: number): number => -55 + (110 * k) / n;
  const pts: P[] = [];
  for (let k = 0; k <= n; k++) pts.push(polar(b[0], b[1], R, ang(k)));
  let d = `M ${f(b[0])} ${f(b[1])} L ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let k = 0; k < n; k++) {
    const c = polar(b[0], b[1], R * 1.17, ang(k + 0.5));
    d += ` Q ${f(c[0])} ${f(c[1])} ${f(pts[k + 1][0])} ${f(pts[k + 1][1])}`;
  }
  let ribs = '';
  for (let k = 1; k < n; k++) {
    const q = polar(b[0], b[1], R * 0.9, ang(k));
    ribs += ` M ${f(b[0])} ${f(b[1] - 2)} L ${f(q[0])} ${f(q[1])}`;
  }
  return [`${d} Z`, ribs.trim()];
}

/** Fuzzy blob: an ellipse whose edge is a ring of small outward bumps. */
function fuzzy(cx: number, cy: number, rx: number, ry: number, n: number, bump: number): string {
  const at = (deg: number, k: number): P => {
    const a = (deg * Math.PI) / 180;
    return [cx + (rx + k) * Math.sin(a), cy - (ry + k) * Math.cos(a)];
  };
  const p0 = at(0, 0);
  let d = `M ${f(p0[0])} ${f(p0[1])}`;
  for (let i = 0; i < n; i++) {
    const c = at((360 * (i + 0.5)) / n, bump * 2);
    const p = at((360 * (i + 1)) / n, 0);
    d += ` Q ${f(c[0])} ${f(c[1])} ${f(p[0])} ${f(p[1])}`;
  }
  return `${d} Z`;
}

/** Five-point star flag on a pole (Nova's flag; our own design). */
const starPatch = (x: number, y: number, r: number): string => softStar(x, y, r, r * 0.44, 5, r * 0.14);

/** Simple seagull "m" mark. */
const gull = (x: number, y: number, w: number): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x - w / 2)} ${f(y - w * 0.6)} ${f(x)} ${f(y)} Q ${f(x + w / 2)} ${f(y - w * 0.6)} ${f(x + w)} ${f(y)}`;

/** Saguaro-style cactus with two arms as one merged outline, plus rib lines. */
function cactus(x: number, base: number, h: number, w: number): [string, string] {
  const trunk = rrect(x - w / 2, base - h, w, h + 4, w / 2);
  const armL = `M ${f(x - w / 2 + 2)} ${f(base - h * 0.42)} L ${f(x - w * 1.3)} ${f(base - h * 0.42)} C ${f(x - w * 1.75)} ${f(base - h * 0.42)} ${f(x - w * 1.75)} ${f(base - h * 0.5)} ${f(x - w * 1.75)} ${f(base - h * 0.55)} L ${f(x - w * 1.75)} ${f(base - h * 0.72)} C ${f(x - w * 1.75)} ${f(base - h * 0.8)} ${f(x - w * 1.05)} ${f(base - h * 0.8)} ${f(x - w * 1.05)} ${f(base - h * 0.72)} L ${f(x - w * 1.05)} ${f(base - h * 0.6)} L ${f(x - w / 2 + 2)} ${f(base - h * 0.6)} Z`;
  const armR = mirrorX(
    shift(`M ${f(x - w / 2 + 2)} ${f(base - h * 0.55)} L ${f(x - w * 1.3)} ${f(base - h * 0.55)} C ${f(x - w * 1.75)} ${f(base - h * 0.55)} ${f(x - w * 1.75)} ${f(base - h * 0.62)} ${f(x - w * 1.75)} ${f(base - h * 0.67)} L ${f(x - w * 1.75)} ${f(base - h * 0.86)} C ${f(x - w * 1.75)} ${f(base - h * 0.94)} ${f(x - w * 1.05)} ${f(base - h * 0.94)} ${f(x - w * 1.05)} ${f(base - h * 0.86)} L ${f(x - w * 1.05)} ${f(base - h * 0.72)} L ${f(x - w / 2 + 2)} ${f(base - h * 0.72)} Z`, 0, 0),
    x,
  );
  const o = union([trunk, armL, armR]);
  const ribs = clip(`${line(x, base - h + w * 0.4, x, base)} ${line(x - w * 1.4, base - h * 0.75, x - w * 1.4, base - h * 0.47)} ${line(x + w * 1.4, base - h * 0.89, x + w * 1.4, base - h * 0.6)}`, [region(o)], 'inside');
  return [o, ribs];
}

// ---- the cast ---------------------------------------------------------------------------------

/** Nova, young astronaut: bubble helmet with curls inside, puffy suit with a star patch, chunky boots, backpack antenna. */
function nova(armL: number, armR: number): Fig {
  const face = circle(0, -130, 28);
  const hair = union([circle(-22, -146, 13), circle(-8, -158, 13), circle(8, -158, 13), circle(22, -146, 13), circle(-30, -132, 9), circle(30, -132, 9)]);
  const helmet = circle(0, -140, 52);
  const [aL, gL, hL] = limb(-36, -68, 56, 24, armL, 14);
  const [aR, gR, hR] = limb(36, -68, 56, 24, armR, 14);
  const collar = rrect(-34, -94, 68, 14, 7);
  const body = rrect(-44, -86, 88, 90, 30);
  const boots = [rrect(-42, 28, 40, 26, 12), rrect(2, 28, 40, 26, 12)];
  const legs = [rrect(-34, -6, 28, 40, 12), rrect(6, -6, 28, 40, 12)];
  const pack = rrect(-58, -80, 116, 74, 16);
  const ball = circle(54, -124, 6);
  const ant = rrect(51.5, -120, 5, 42, 2.5);
  const shapes = [face, hair, helmet, gL, aL, gR, aR, collar, body, ...boots, ...legs, pack, ball, ant];
  const bodyR = region(body);
  const armsR = [region(aL), region(aR), region(gL), region(gR)];
  return {
    shapes,
    lines: [
      `${circle(-10, -132, 3.2)} ${circle(10, -132, 3.2)}`,
      smile(0, -120, 8),
      clip(starPatch(0, -46, 15), armsR),
    ],
    detail: [
      'M -38.1 -162 A 44 44 0 0 1 -22 -178.1',
      'M -20 -120 L -16 -122 M 20 -120 L 16 -122',
      clip(clip('M -44 -14 L 44 -14', [bodyR], 'inside'), armsR),
      'M -42 40 L -2 40 M 2 40 L 42 40',
    ],
    at: { handL: hL, handR: hR },
  };
}

/** Inspector Quill, heron detective: long beak, round spectacles, short cape-coat with two buttons, magnifying glass. */
function quill(wingDeg: number, glassDeg: number): Fig {
  const head = ellipse(12, -200, 22, 18);
  const beak = 'M 30 -207 C 52 -206 74 -201 96 -196 C 74 -193 52 -191 30 -191 Z';
  const crest = union([petal(-4, -210, -70, 34, 5), petal(-2, -204, -98, 28, 4)]);
  const neck = 'M 2 -186 C -14 -162 14 -140 2 -110 L 26 -110 C 36 -142 8 -164 22 -188 Z';
  const cape = roundPoly([[-34, -116], [46, -116], [66, -52], [-56, -52]], 14);
  const coat = roundPoly([[-30, -90], [42, -90], [56, 4], [-48, 4]], 14);
  const tail = petal(-38, -6, 235, 36, 9);
  const tip = polar(44, -92, 50, wingDeg);
  const wing = petal(40, -96, wingDeg, 56, 11);
  const hc = polar(tip[0], tip[1], 14, glassDeg);
  const handle = shift(rotate(rrect(-5, -20, 10, 40, 5), glassDeg, 0, 0), hc[0], hc[1]);
  const lc = polar(tip[0], tip[1], 56, glassDeg);
  const lens = circle(lc[0], lc[1], 22);
  const legs = [rrect(-8, 2, 7, 54, 3.5), rrect(16, 2, 7, 54, 3.5)];
  const coatR = region(coat);
  return {
    shapes: [lens, wing, handle, head, beak, crest, cape, neck, coat, tail, ...legs],
    lines: [
      `${circle(16, -203, 8)} ${circle(16, -203, 2.5)}`,
      'M 8 -204 L -6 -207',
      circle(lc[0], lc[1], 16),
      clip(`${circle(6, -34, 3.5)} ${circle(6, -14, 3.5)}`, [region(wing)]),
      'M 6 -116 L 14 -100 L 22 -116',
    ],
    detail: [
      'M 36 -199 L 82 -198',
      `M ${f(lc[0] - 9)} ${f(lc[1] - 4)} A 10 10 0 0 1 ${f(lc[0] - 3)} ${f(lc[1] - 10)}`,
      'M -20 56 L 6 56 M -6 56 L -14 49 M 8 56 L 32 56 M 20 56 L 12 49',
      clip('M -48 -30 C -30 -26 -10 -26 0 -30', [coatR], 'inside'),
    ],
    at: { lens: lc, tip },
  };
}

/** Captain Ottoline, sea-otter pirate captain: round whiskered face, tricorn hat with a shell badge, striped shirt. */
function ottoline(armL: number, armR: number, armLen = 54): Fig {
  const [badge, ribs] = scallop(0, -184, 12);
  const hat = 'M -76 -168 Q -40 -146 0 -150 Q 40 -146 76 -168 Q 52 -174 42 -196 Q 0 -226 -42 -196 Q -52 -174 -76 -168 Z';
  const muzzle = ellipse(0, -110, 24, 16);
  const head = ellipse(0, -128, 48, 42);
  const ears = [circle(-46, -150, 10), circle(46, -150, 10)];
  const [aL, gL, hL] = limb(-40, -80, armLen, 22, armL, 13);
  const [aR, gR, hR] = limb(40, -80, armLen, 22, armR, 13);
  const buckle = rrect(-11, 2, 22, 18, 4);
  const body = 'M -36 -94 C -62 -70 -64 20 -42 48 L 42 48 C 64 20 62 -70 36 -94 Z';
  const feet = [ellipse(-24, 52, 20, 10), ellipse(24, 52, 20, 10)];
  const tail = 'M 40 30 C 80 30 100 10 106 -22 C 116 4 104 46 44 50 Z';
  const front = [region(aL), region(aR), region(gL), region(gR), region(buckle)];
  const stripes = clip(clip('M -70 -66 L 70 -66 M -70 -44 L 70 -44 M -70 -22 L 70 -22 M -70 32 L 70 32', [region(body)], 'inside'), front);
  const belt = clip(clip('M -70 4 L 70 4 M -70 18 L 70 18', [region(body)], 'inside'), front);
  return {
    shapes: [badge, hat, muzzle, head, ...ears, gL, aL, gR, aR, buckle, body, ...feet, tail],
    lines: [
      `${circle(-18, -134, 4.5)} ${circle(18, -134, 4.5)}`,
      roundPoly([[-8, -121], [8, -121], [0, -112]], 3),
      'M 0 -112 L 0 -106 M -10 -103 Q -5 -99 0 -106 Q 5 -99 10 -103',
      stripes,
      belt,
    ],
    detail: [
      ribs,
      clip('M -66 -166 Q -38 -153 0 -157 Q 38 -153 66 -166', [region(badge)]),
      'M -22 -112 L -42 -116 M -22 -106 L -42 -104 M 22 -112 L 42 -116 M 22 -106 L 42 -104',
      `${circle(-16, -136, 1.2)} ${circle(20, -136, 1.2)}`,
    ],
    at: { handL: hL, handR: hR },
  };
}

/** Sheriff Sage, tortoise cowboy (faces right): wide-brim hat, neckerchief, star badge on the shell, slow happy smile. */
function sage(): Fig {
  const kerchief = roundPoly([[72, -24], [104, -13], [84, 8]], 4);
  const brim = ellipse(104, -56, 44, 9);
  const crown = 'M 84 -58 C 82 -90 92 -94 104 -86 C 116 -94 126 -90 124 -58 Z';
  const head = ellipse(104, -34, 27, 22);
  const neck = 'M 58 -6 C 66 -30 82 -42 98 -40 L 100 -18 C 90 -14 84 -4 82 6 Z';
  const rim = rrect(-92, -6, 176, 14, 7);
  const shell = 'M -84 0 C -84 -80 76 -80 76 0 Z';
  const legs = [rrect(34, 2, 28, 34, 12), rrect(-64, 2, 28, 34, 12)];
  const tail = roundPoly([[-88, -2], [-110, 8], [-86, 6]], 3);
  const badge = softStar(-6, -32, 17, 7.5, 5, 2.5);
  const shellR = region(shell);
  const plates = clip(
    'M -50 -6 L -40 -34 L -58 -52 M -40 -34 L -24 -40 M 12 -40 L 28 -34 L 44 -54 M 28 -34 L 38 -6 M -10 -60 L -6 -52 M -26 -10 L -24 -6 M 14 -10 L 12 -6',
    [region(badge)],
  );
  return {
    shapes: [kerchief, brim, crown, head, neck, rim, shell, ...legs, tail],
    lines: [
      badge,
      'M 106 -40 Q 112 -46 118 -40',
      'M 112 -26 Q 121 -19 129 -28',
      clip(plates, [shellR], 'inside'),
    ],
    detail: [
      clip('M 80 -66 L 128 -66', [region(crown)], 'inside'),
      circle(-6, -32, 3),
      'M 42 36 L 42 29 M 50 36 L 50 29 M -56 36 L -56 29 M -48 36 L -48 29',
      'M 126 -37 L 127 -37',
      clip('M -70 -6 L -58 -14 M 60 -6 L 50 -14', [shellR], 'inside'),
    ],
    at: {},
  };
}

/** Template from a placed character plus props: `front` shapes in front of it, `back` shapes behind. */
function scene(fig: Fig, front: string[], back: string[]): { paths: string[]; figLines: string[]; figDetail: string[] } {
  const frontR = front.map((d) => region(d));
  return {
    paths: stack([...front, ...fig.shapes, ...back]),
    figLines: fig.lines.map((d) => (frontR.length ? clip(d, frontR) : d)).filter(Boolean),
    figDetail: fig.detail.map((d) => (frontR.length ? clip(d, frontR) : d)).filter(Boolean),
  };
}

// ---- beginner ---------------------------------------------------------------------------------

function spaceShuttle(): Template {
  const body = 'M 200 48 C 234 78 242 130 242 286 L 158 286 C 158 130 166 78 200 48 Z';
  const wingL = poly([[160, 168], [92, 276], [92, 304], [160, 296]]);
  const wingR = mirrorX(wingL, 200);
  const bells = [poly([[164, 282], [184, 282], [188, 312], [160, 312]]), poly([[190, 282], [210, 282], [214, 316], [186, 316]]), poly([[216, 282], [236, 282], [240, 312], [212, 312]])];
  const flames = [petal(174, 308, 180, 44, 9), petal(200, 312, 180, 56, 10), petal(226, 308, 180, 44, 9)];
  const bodyR = region(body);
  return tpl(
    'space-shuttle',
    'Little space shuttle',
    'beginner',
    ['spaceship', 'space', 'shuttle', 'sci-fi', 'launch', 'kids'],
    [
      ...stack([body, wingL, wingR, ...bells, ...flames]),
      'M 180 112 Q 200 96 220 112 L 216 126 L 184 126 Z',
      clip('M 150 200 L 250 200 M 150 248 L 250 248', [bodyR], 'inside'),
      softStar(70, 80, 20, 9, 5, 3),
      circle(330, 72, 26),
      softStar(330, 330, 16, 7, 5, 2.5),
    ],
    [
      `${circle(200, 160, 7)} ${circle(200, 224, 5)}`,
      'M 112 282 L 156 282',
      'M 244 282 L 288 282',
      'M 316 62 C 324 76 338 82 350 80',
      sparkle(80, 330, 12),
      sparkle(350, 190, 9),
      `${circle(60, 200, 2.5)} ${circle(120, 40, 2.5)} ${circle(280, 30, 2.5)} ${circle(300, 370, 2.5)}`,
    ],
  );
}

function alienPlant(): Template {
  const rim = rrect(118, 250, 164, 28, 10);
  const pot = roundPoly([[132, 270], [268, 270], [250, 372], [150, 372]], 10);
  const head = ellipse(202, 128, 56, 46);
  const leafL = petal(198, 228, -62, 72, 16);
  const leafR = petal(204, 214, 64, 64, 14);
  const stem = 'M 192 254 C 186 220 210 200 196 160 L 208 160 C 222 200 200 220 208 254 Z';
  const knobs = [circle(144, 48, 8), circle(262, 44, 8)];
  return tpl(
    'alien-plant',
    'Alien plant in a pot',
    'beginner',
    ['alien', 'plant', 'space', 'sci-fi', 'potted', 'kids'],
    [
      ...stack([rim, head, leafL, leafR, stem, pot, ...knobs]),
      circle(202, 122, 20),
      circle(206, 124, 8),
      smile(202, 152, 14),
      'M 180 86 C 172 66 158 56 150 52',
      'M 224 86 C 236 64 250 54 256 49',
      softStar(200, 320, 18, 8, 5, 2.5),
    ],
    [
      'M 196 116 A 6 6 0 0 1 202 110',
      clip(`M 198 228 L ${f(polar(198, 228, 60, -62)[0])} ${f(polar(198, 228, 60, -62)[1])} M 204 214 L ${f(polar(204, 214, 54, 64)[0])} ${f(polar(204, 214, 54, 64)[1])}`, [region(stem)]),
      `${circle(160, 296, 3)} ${circle(240, 296, 3)} ${circle(170, 352, 3)} ${circle(230, 352, 3)}`,
      sparkle(80, 120, 12),
      sparkle(330, 200, 10),
      sparkle(320, 70, 7),
    ],
  );
}

function robotBuddy(): Template {
  const ball = circle(200, 38, 9);
  const ant = rrect(197, 40, 6, 34, 3);
  const head = rrect(140, 70, 120, 88, 30);
  const ears = [circle(138, 114, 12), circle(262, 114, 12)];
  const [aL, hL] = limb(146, 206, 70, 22, 40, 14);
  const [aR, hR] = limb(254, 206, 70, 22, -40, 14);
  const neck = rrect(186, 154, 28, 18, 4);
  const body = circle(200, 236, 66);
  const base = rrect(168, 296, 64, 20, 9);
  const wheel = circle(200, 332, 30);
  return tpl(
    'robot-companion',
    'Robot companion on one wheel',
    'beginner',
    ['robot', 'companion', 'sci-fi', 'friendly', 'space', 'kids'],
    [
      ...stack([ball, ant, head, ...ears, hL, aL, hR, aR, neck, body, base, wheel]),
      rrect(158, 88, 84, 54, 16),
      happyEye(182, 116, 10),
      happyEye(218, 116, 10),
      smile(200, 128, 8),
      circle(200, 230, 18),
      circle(200, 332, 10),
    ],
    [
      circle(200, 230, 8),
      'M 200 302 L 200 304 M 178 332 L 190 332 M 210 332 L 222 332',
      'M 120 372 L 280 372',
      clip('M 150 260 Q 200 282 250 260', [region(body)], 'inside'),
      sparkle(80, 80, 12),
      sparkle(330, 70, 10),
      sparkle(340, 300, 9),
    ],
  );
}

function footprint(x: number, y: number, deg: number, s = 1): string {
  return rotate(`${ellipse(x, y - 7 * s, 8 * s, 13 * s)} ${ellipse(x, y + 13 * s, 6.5 * s, 6.5 * s)}`, deg, x, y);
}

function magnifierClues(): Template {
  const lens = circle(170, 170, 82);
  const collar = shift(rotate(rrect(-18, -12, 36, 24, 6), -45, 0, 0), 230, 230);
  const handle = shift(rotate(rrect(-14, -6, 28, 118, 13), -45, 0, 0), 230, 230);
  const lensR = region(lens);
  const inner = circle(170, 170, 68);
  const trail: [number, number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const side = k % 2 ? 9 : -9;
    trail.push([44 + k * 22 + side * 0.7, 380 - k * 32 + side * 0.7, 35]);
  }
  for (let k = 0; k < 4; k++) {
    const side = k % 2 ? 9 : -9;
    trail.push([270 + k * 24 + side * 0.7, 108 - k * 26 + side * 0.7, 42]);
  }
  return tpl(
    'magnifier-footprints',
    'Detective magnifier and footprints',
    'beginner',
    ['detective', 'mystery', 'clue', 'magnifier', 'footprints', 'noir'],
    [
      ...stack([lens, collar, handle]),
      inner,
      clip(footprint(160, 170, 35, 2.4), [region(inner)], 'inside'),
      ...trail.map(([x, y, a]) => clip(footprint(x, y, a, 0.7), [lensR, region(handle)])),
    ],
    [
      'M 124 128 A 62 62 0 0 1 160 106',
      'M 116 150 A 60 60 0 0 1 120 140',
      clip(line(240, 240, 300, 300), [region(handle)], 'inside'),
      sparkle(330, 330, 12),
      sparkle(60, 60, 9),
    ],
  );
}

function sheriffStar(): Template {
  const balls: string[] = [];
  for (let k = 0; k < 6; k++) balls.push(circle(...polar(200, 200, 140, k * 60), 14));
  const starShape = softStar(200, 200, 132, 70, 6, 8);
  let rivets = '';
  for (let k = 0; k < 6; k++) {
    const [x, y] = polar(200, 200, 96, k * 60);
    rivets += ` ${circle(x, y, 4)}`;
  }
  return tpl(
    'sheriff-star',
    'Sheriff star badge',
    'beginner',
    ['sheriff', 'star', 'badge', 'western', 'cowboy', 'wild-west'],
    [...stack([...balls, starShape]), circle(200, 200, 52), softStar(200, 200, 34, 15, 5, 3)],
    [rivets.trim(), circle(200, 200, 44), 'M 132 118 L 150 140', sparkle(56, 340, 12), sparkle(344, 344, 10)],
  );
}

function bootShape(x0: number): string {
  const p = (x: number, y: number): string => `${f(x0 + x)} ${f(y)}`;
  return `M ${p(0, 196)} L ${p(66, 196)} L ${p(64, 296)} C ${p(96, 298)} ${p(126, 312)} ${p(132, 336)} L ${p(132, 346)} L ${p(26, 346)} L ${p(22, 358)} L ${p(2, 358)} L ${p(0, 340)} Z`;
}

function cowboyGear(): Template {
  const crown = 'M 140 142 C 134 84 158 64 200 84 C 242 64 266 84 260 142 Z';
  const brim = 'M 64 128 C 100 156 300 156 336 128 C 330 170 280 180 200 180 C 120 180 70 170 64 128 Z';
  const bootL = bootShape(66);
  const bootR = bootShape(198);
  const stitch = (x0: number): string => `M ${f(x0 + 10)} ${f(232)} C ${f(x0 + 22)} 254 ${f(x0 + 44)} 254 ${f(x0 + 56)} 232`;
  return tpl(
    'cowboy-boots-hat',
    'Cowboy boots and hat',
    'beginner',
    ['cowboy', 'boots', 'hat', 'western', 'wild-west', 'rodeo'],
    [
      ...stack([brim, crown]),
      clip('M 120 126 C 170 136 230 136 280 126', [region(crown)], 'inside'),
      bootL,
      bootR,
      stitch(66),
      stitch(198),
      starPatch(99, 280, 12),
      starPatch(231, 280, 12),
    ],
    [
      clip('M 120 112 C 170 122 230 122 280 112', [region(crown)], 'inside'),
      'M 70 206 L 128 206 M 202 206 L 260 206',
      'M 94 346 L 196 346 M 226 346 L 328 346',
      'M 40 372 L 360 372',
      sparkle(56, 60, 10),
      sparkle(346, 56, 12),
    ],
  );
}

function shipsWheel(): Template {
  const hub = circle(200, 200, 30);
  const rim = circle(200, 200, 108);
  const inner = circle(200, 200, 88);
  const handles: string[][] = [];
  for (let k = 0; k < 8; k++) handles.push([rotate(rrect(192, 46, 16, 50, 8), k * 45, 200, 200), circle(...polar(200, 200, 162, k * 45), 13)]);
  const spokes: string[] = [];
  for (let k = 0; k < 8; k++) spokes.push(clip(clip(rotate(rrect(194, 104, 12, 70, 4), k * 45, 200, 200), [region(hub)]), [region(inner)], 'inside'));
  return tpl(
    'ships-wheel',
    'Pirate ship wheel',
    'beginner',
    ['pirate', 'ship', 'wheel', 'helm', 'sailing', 'captain'],
    [...stack([hub, rim, ...handles]), inner, ...spokes, circle(200, 200, 13)],
    [`${circle(200, 200, 98)}`, sparkle(50, 50, 10), sparkle(352, 352, 12)],
  );
}

function pirateParrot(): Template {
  const beak = 'M 174 116 C 150 112 138 134 146 158 C 154 148 162 144 178 146 Z';
  const bandana = 'M 172 108 C 190 80 236 80 252 108 C 230 98 196 98 172 108 Z';
  const knot = [petal(250, 106, 120, 34, 7), petal(250, 106, 150, 30, 6)];
  const head = circle(210, 132, 42);
  const wing = petal(244, 168, 162, 128, 24);
  const feet = [ellipse(204, 300, 11, 7), ellipse(232, 300, 11, 7)];
  const body = ellipse(222, 222, 52, 78);
  const perch = rotate(rrect(50, 298, 300, 20, 10), -4, 200, 308);
  const tails = [petal(230, 284, 172, 90, 13), petal(246, 284, 154, 84, 12)];
  return tpl(
    'pirate-parrot',
    'Pirate parrot on a perch',
    'beginner',
    ['pirate', 'parrot', 'bandana', 'perch', 'tropical', 'kids'],
    [
      ...stack([beak, bandana, ...knot, head, wing, ...feet, body, perch, ...tails]),
      circle(198, 124, 8),
      circle(196, 124, 3),
      petal(64, 300, -30, 44, 10),
    ],
    [
      clip('M 260 196 C 270 230 276 260 280 280 M 248 200 C 254 232 258 258 262 276', [region(wing)], 'inside'),
      `${circle(198, 96, 2.5)} ${circle(214, 94, 2.5)} ${circle(230, 97, 2.5)}`,
      'M 152 140 C 158 138 164 140 168 144',
      sparkle(80, 120, 12),
      sparkle(340, 80, 10),
    ],
  );
}

function novaWaves(): Template {
  const g = placeFig(nova(20, -135), 1.25, 196, 296);
  return tpl(
    'nova-waves',
    'Nova waves hello',
    'beginner',
    ['cast', 'nova', 'astronaut', 'space', 'sci-fi', 'kids'],
    [...stack(g.shapes), ...g.lines, softStar(66, 90, 20, 9, 5, 3), circle(330, 304, 28), softStar(340, 60, 14, 6, 5, 2.5)],
    [...g.detail, 'M 300 296 C 320 304 344 302 358 292', sparkle(70, 300, 12), sparkle(348, 170, 9), `${circle(110, 40, 2.5)} ${circle(40, 200, 2.5)} ${circle(280, 380, 2.5)}`],
  );
}

function furryMonster(): Template {
  const feet = [ellipse(158, 352, 36, 16), ellipse(242, 352, 36, 16)];
  const arms = [petal(92, 226, -112, 62, 16), petal(308, 226, 112, 62, 16)];
  const body = fuzzy(200, 220, 116, 128, 26, 5);
  const horns = [petal(150, 116, -28, 60, 15), petal(250, 116, 28, 60, 15)];
  const mouth = 'M 140 252 Q 200 318 260 252 Q 200 272 140 252 Z';
  return tpl(
    'furry-monster',
    'Big furry monster',
    'beginner',
    ['monster', 'furry', 'friendly', 'creature', 'horns', 'kids'],
    [
      ...stack([...feet, ...arms, body, ...horns]),
      circle(166, 190, 22),
      circle(234, 190, 22),
      circle(170, 194, 9),
      circle(230, 194, 9),
      mouth,
      clip(`${rrect(176, 254, 16, 18, 4)} ${rrect(208, 254, 16, 18, 4)}`, [region(mouth)], 'inside'),
    ],
    [
      'M 146 156 Q 166 146 184 154 M 216 154 Q 234 146 254 156',
      'M 140 352 L 140 360 M 158 354 L 158 362 M 242 354 L 242 362 M 260 352 L 260 360',
      clip('M 170 320 Q 180 312 190 320 M 210 320 Q 220 312 230 320 M 130 220 Q 136 212 142 220 M 258 220 Q 264 212 270 220', [region(body)], 'inside'),
      sparkle(56, 70, 12),
      sparkle(350, 70, 10),
    ],
  );
}

// ---- intermediate -----------------------------------------------------------------------------

function spaceStation(): Template {
  const sphere = circle(200, 200, 40);
  const modTop = rrect(178, 74, 44, 92, 12);
  const modBot = rrect(178, 234, 44, 92, 12);
  const portTop = rrect(186, 56, 28, 22, 6);
  const portBot = rrect(186, 322, 28, 22, 6);
  const truss = rrect(36, 193, 328, 14, 4);
  const panels = [rrect(50, 118, 100, 64, 5), rrect(50, 218, 100, 64, 5), rrect(250, 118, 100, 64, 5), rrect(250, 218, 100, 64, 5)];
  const dish = 'M 246 40 A 30 30 0 0 0 296 70 Z';
  let grid = '';
  for (const [x, y] of [[50, 118], [50, 218], [250, 118], [250, 218]] as const) {
    for (let k = 1; k < 4; k++) grid += ` M ${x + 25 * k} ${y} L ${x + 25 * k} ${y + 64}`;
    grid += ` M ${x} ${y + 32} L ${x + 100} ${y + 32}`;
  }
  return tpl(
    'space-station',
    'Orbiting space station',
    'intermediate',
    ['space', 'station', 'satellite', 'sci-fi', 'orbit', 'galaxy'],
    [
      ...stack([sphere, portTop, portBot, modTop, modBot, truss, ...panels, dish]),
      'M 222 92 L 262 62',
      circle(200, 200, 14),
      'M 20 340 C 80 300 150 320 170 380',
    ],
    [
      grid.trim(),
      'M 100 182 L 100 193 M 100 207 L 100 218 M 300 182 L 300 193 M 300 207 L 300 218',
      `${circle(200, 100, 6)} ${circle(200, 128, 6)} ${circle(200, 272, 6)} ${circle(200, 300, 6)}`,
      'M 178 150 L 222 150 M 178 250 L 222 250',
      'M 192 192 A 10 10 0 0 1 200 188',
      'M 40 352 C 70 336 110 340 130 360 M 60 372 C 80 362 100 364 112 376',
      softStar(330, 330, 16, 7, 5, 2.5),
      sparkle(60, 60, 12),
      sparkle(350, 110, 9),
      `${circle(120, 40, 2.5)} ${circle(350, 260, 2.5)} ${circle(260, 360, 2.5)} ${circle(30, 160, 2.5)}`,
    ],
  );
}

function hump(cx: number, w: number, h: number, t: number, base = 322): string {
  const k = 1.33;
  return (
    `M ${f(cx - w)} ${f(base)} C ${f(cx - w)} ${f(base - h * k)} ${f(cx + w)} ${f(base - h * k)} ${f(cx + w)} ${f(base)} ` +
    `L ${f(cx + w - t)} ${f(base)} C ${f(cx + w - t)} ${f(base - (h - t) * k)} ${f(cx - w + t)} ${f(base - (h - t) * k)} ${f(cx - w + t)} ${f(base)} Z`
  );
}

function seaSerpent(): Template {
  const waves = waveBand(20, 380, 304, 380, 45, 12);
  const head = ellipse(142, 130, 54, 36);
  const crest = [petal(110, 108, -40, 44, 9), petal(100, 118, -70, 40, 8), petal(96, 132, -100, 34, 7)];
  const neck = 'M 60 330 C 52 240 72 170 112 142 L 150 166 C 112 196 100 260 106 330 Z';
  const h1 = hump(196, 40, 72, 30);
  const h2 = hump(290, 34, 56, 26);
  const tail = 'M 340 320 C 338 270 366 262 372 228 C 386 262 368 296 360 320 Z';
  const fins = [petal(184, 258, -24, 26, 8), petal(208, 258, 20, 24, 7), petal(290, 272, 0, 22, 7)];
  const layers = stack([waves, head, ...crest, neck, h1, h2, ...fins, tail]);
  const front = [region(waves)];
  return tpl(
    'sea-serpent',
    'Sea serpent in the waves',
    'intermediate',
    ['monster', 'sea', 'serpent', 'waves', 'creature', 'adventure'],
    [...layers, circle(150, 120, 8), circle(152, 121, 3), 'M 168 144 Q 180 150 192 140', circle(188, 120, 2.5), circle(320, 70, 30)],
    [
      clip(clip(scaleRows(58, 112, 190, 320, 8), [region(neck)], 'inside'), [...front, region(head)]),
      clip(clip('M 160 296 Q 168 290 176 296 M 216 296 Q 224 290 232 296', [region(h1)], 'inside'), front),
      clip(clip('M 258 300 Q 266 294 274 300 M 306 300 Q 314 294 322 300', [region(h2)], 'inside'), front),
      'M 30 340 Q 50 332 70 340 M 150 350 Q 170 342 190 350 M 260 344 Q 280 336 300 344 M 120 368 Q 140 360 160 368 M 300 366 Q 320 358 340 366',
      'M 120 150 Q 126 154 132 152',
      clip('M 356 300 C 358 280 368 266 372 250', [region(tail)], 'inside'),
      `M 290 70 L 274 70 M 350 70 L 366 70 M 320 40 L 320 24 M 299 49 L 288 38 M 341 49 L 352 38`,
      gull(80, 60, 14),
      gull(230, 50, 11),
    ],
  );
}

function swampCreature(): Template {
  const water = waveBand(20, 380, 322, 380, 40, 8);
  const eyes = [circle(174, 168, 18), circle(226, 168, 18)];
  const moss = 'M 132 204 C 146 118 254 118 268 204 Q 260 218 252 204 Q 244 224 234 206 Q 224 226 214 208 Q 204 228 194 208 Q 184 226 174 206 Q 164 222 156 204 Q 148 218 140 204 Q 136 212 132 204 Z';
  const [aL] = limb(138, 214, 104, 30, 22, 0);
  const [aR] = limb(262, 214, 104, 30, -22, 0);
  const body = 'M 136 340 C 116 260 120 150 200 112 C 280 150 284 260 264 340 Z';
  const reeds: string[] = [];
  const reedHeads: string[] = [];
  for (const [x, top] of [[48, 170], [70, 210], [330, 180], [352, 220]] as const) {
    reeds.push(rrect(x - 2.5, top, 5, 340 - top, 2.5));
    reedHeads.push(rrect(x - 7, top - 30, 14, 40, 7));
  }
  const pads = [ellipse(110, 352, 34, 9), ellipse(296, 356, 30, 8)];
  return tpl(
    'swamp-creature',
    'Friendly swamp creature',
    'intermediate',
    ['monster', 'swamp', 'creature', 'friendly', 'reeds', 'pond'],
    [
      ...stack([...pads, water, ...eyes, moss, aL, aR, body, ...reedHeads, ...reeds]),
      circle(178, 172, 7),
      circle(222, 172, 7),
      'M 170 248 Q 200 276 230 248',
      clip(rrect(206, 254, 10, 12, 3), [], 'outside'),
    ],
    [
      'M 150 140 Q 164 132 180 138 M 220 138 Q 236 132 250 140',
      clip('M 150 270 C 156 290 150 306 158 322 M 250 270 C 244 290 250 306 242 322 M 186 296 C 190 306 186 316 190 326 M 214 300 C 210 310 214 318 210 326', [region(body)], 'inside'),
      clip('M 112 270 L 112 290 M 288 270 L 288 290', [region(aL), region(aR)], 'inside'),
      'M 110 352 L 128 346 M 296 356 L 312 351',
      'M 40 366 Q 60 360 80 366 M 160 372 Q 180 366 200 372 M 320 372 Q 340 366 360 372',
      `${circle(90, 120, 3)} ${circle(316, 110, 3)} ${circle(280, 70, 3)} ${circle(120, 70, 3)}`,
      'M 300 40 A 24 24 0 1 0 330 76 A 30 30 0 0 1 300 40 Z',
    ],
  );
}

function noirLamp(): Template {
  const finial = circle(200, 58, 8);
  const roof = roundPoly([[156, 98], [244, 98], [200, 62]], 6);
  const glass = poly([[168, 98], [232, 98], [220, 152], [180, 152]]);
  const plate = rrect(172, 150, 56, 10, 4);
  const post = rrect(192, 158, 16, 170, 6);
  const base = roundPoly([[168, 352], [232, 352], [222, 322], [178, 322]], 4);
  const catBody = ellipse(282, 330, 26, 24);
  const catHead = circle(282, 296, 16);
  const ears = [poly([[270, 288], [272, 270], [282, 282]]), poly([[294, 288], [292, 270], [282, 282]])];
  const tail = 'M 304 344 C 330 344 336 320 324 306 C 340 318 340 352 304 352 Z';
  const wall = 'M 20 40 L 110 40 L 110 352 L 20 352 Z';
  const objs = stack([finial, roof, glass, plate, post, base, catHead, ...ears, catBody, tail, wall]);
  const hide = [finial, roof, glass, plate, post, base, catHead, ...ears, catBody, tail, wall].map((d) => region(d));
  let rain = '';
  for (let k = 0; k < 34; k++) {
    const x = 30 + ((k * 73) % 350);
    const y = 30 + ((k * 151) % 290);
    rain += ` M ${x} ${y} L ${x - 6} ${y + 16}`;
  }
  let bricks = '';
  for (let r = 0; r < 10; r++) {
    const y = 64 + r * 30;
    bricks += ` M 20 ${y} L 110 ${y}`;
    for (let x = r % 2 ? 50 : 35; x < 110; x += 30) bricks += ` M ${x} ${y} L ${x} ${y + 30}`;
  }
  return tpl(
    'noir-street-lamp',
    'Noir street lamp in the rain',
    'intermediate',
    ['noir', 'detective', 'mystery', 'lamp', 'rain', 'night'],
    [...objs, 'M 20 352 L 380 352', ellipse(270, 368, 80, 10), circle(274, 294, 3), circle(290, 294, 3)],
    [
      clip(bricks.trim(), [region(wall)], 'inside'),
      clip(rain.trim(), hide),
      'M 200 108 L 200 144 M 188 108 L 186 144 M 212 108 L 214 144',
      clip('M 160 170 L 120 230 M 240 170 L 280 230 M 200 172 L 200 190', hide),
      'M 230 368 L 250 368 M 262 364 L 300 364 M 276 372 L 296 372',
      'M 278 302 L 282 306 L 286 302',
      'M 330 66 A 22 22 0 1 0 352 96 A 26 26 0 0 1 330 66 Z',
    ],
  );
}

function treasureIsland(): Template {
  const coins = union([circle(160, 244, 16), circle(186, 236, 16), circle(214, 238, 16), circle(240, 246, 16), circle(200, 222, 14)]);
  const gem = poly([[196, 206], [210, 206], [216, 214], [203, 228], [190, 214]]);
  const lid = 'M 134 254 L 146 186 C 190 172 230 172 274 186 L 266 254 Z';
  const box = rrect(128, 250, 144, 74, 8);
  const lock = rrect(188, 262, 24, 26, 5);
  const trunk = 'M 300 300 C 302 240 290 180 264 128 L 276 124 C 304 176 316 236 316 300 Z';
  const fronds = [petal(270, 124, -80, 74, 14), petal(270, 124, -30, 64, 13), petal(270, 124, 40, 70, 14), petal(270, 124, 90, 76, 13), petal(270, 124, 140, 52, 11)];
  const island = 'M 40 330 C 90 270 320 262 372 330 Z';
  const sea = waveBand(20, 380, 336, 380, 40, 8);
  return tpl(
    'treasure-chest-island',
    'Treasure chest on an island',
    'intermediate',
    ['treasure', 'pirate', 'chest', 'island', 'beach', 'gold'],
    [...stack([gem, coins, lock, box, lid, ...fronds, trunk, sea, island]), circle(70, 80, 30), gull(160, 70, 13), gull(200, 92, 10)],
    [
      clip('M 128 284 L 272 284 M 166 250 L 166 324 M 234 250 L 234 324', [region(box)], 'inside'),
      clip(clip('M 140 220 L 270 220', [region(lid)], 'inside'), [region(coins), region(gem)]),
      circle(200, 274, 4),
      'M 200 278 L 200 282',
      clip('M 304 280 L 314 276 M 300 250 L 310 246 M 294 220 L 304 216 M 286 190 L 296 186 M 276 160 L 286 156', [region(trunk)], 'inside'),
      'M 60 300 Q 66 296 72 300 M 330 310 Q 336 306 342 310 M 100 316 L 104 312',
      'M 40 360 Q 60 352 80 360 M 180 366 Q 200 358 220 366 M 300 360 Q 320 352 340 360',
      'M 70 36 L 70 26 M 104 46 L 112 38 M 36 46 L 28 38 M 114 80 L 124 80 M 26 80 L 16 80',
      `${circle(180, 232, 6)} ${circle(232, 242, 6)}`,
    ],
  );
}

function spyGadgets(): Template {
  const crown = 'M 80 108 C 78 66 98 54 124 66 C 150 54 170 66 168 108 Z';
  const brim = 'M 40 104 C 70 124 178 124 208 104 C 204 132 176 140 124 140 C 72 140 44 132 40 104 Z';
  const lensL = 'M 228 82 L 284 82 C 286 108 276 122 256 122 C 236 122 226 108 228 82 Z';
  const lensR = mirrorX(lensL, 312);
  const bridge = 'M 282 86 Q 312 74 342 86 L 342 94 Q 312 84 282 94 Z';
  const talkie = rrect(56, 196, 66, 150, 14);
  const aerial = rrect(98, 160, 10, 40, 5);
  const band = rrect(182, 160, 40, 170, 12);
  const face = circle(202, 245, 38);
  const pen = rotate(rrect(296, 160, 24, 190, 10), 20, 308, 255);
  const nib = rotate(poly([[300, 350], [316, 350], [308, 376]]), 20, 308, 255);
  const env = rrect(150, 318, 120, 60, 6);
  const seal = circle(210, 346, 12);
  return tpl(
    'spy-gadget-kit',
    'Spy gadget kit',
    'intermediate',
    ['spy', 'gadgets', 'secret', 'agent', 'sunglasses', 'watch'],
    [
      ...stack([brim, crown, lensL, lensR, bridge, aerial, talkie, face, band, nib, pen, seal, env]),
      circle(202, 245, 28),
      rrect(70, 214, 38, 30, 6),
      starPatch(210, 346, 7),
    ],
    [
      clip('M 78 92 C 110 100 140 100 170 92', [region(crown)], 'inside'),
      'M 202 245 L 202 222 M 202 245 L 220 254',
      `${circle(202, 245, 18)} ${circle(212, 236, 2.5)}`,
      'M 72 264 L 106 264 M 72 276 L 106 276 M 72 288 L 106 288 M 72 300 L 106 300',
      `${circle(78, 324, 7)} ${circle(100, 324, 7)}`,
      clip('M 150 318 L 210 352 L 270 318', [region(seal)]),
      'M 238 92 L 250 108 M 322 92 L 334 108',
      clip('M 182 192 L 222 192 M 182 298 L 222 298', [region(face)]),
      sparkle(366, 262, 10),
      sparkle(40, 60, 8),
    ],
  );
}

function novaFlag(): Template {
  const g = placeFig(nova(110, -30), 1.0, 222, 294);
  const [hx, hy] = g.at.handL;
  const pole = rrect(hx - 3, 68, 6, 290 - 68, 3);
  const flag = `M ${f(hx - 3)} 74 C ${f(hx - 33)} 62 ${f(hx - 53)} 88 ${f(hx - 83)} 78 L ${f(hx - 83)} 132 C ${f(hx - 53)} 142 ${f(hx - 33)} 118 ${f(hx - 3)} 128 Z`;
  const ground = 'M 20 330 C 100 306 300 306 380 326 L 380 380 L 20 380 Z';
  const s = scene(g, [], [flag, pole, ground]);
  return tpl(
    'nova-moon-flag',
    'Nova plants a flag on the moon',
    'intermediate',
    ['cast', 'nova', 'astronaut', 'moon', 'flag', 'space'],
    [...s.paths, ...s.figLines, starPatch(hx - 43, 102, 15), circle(326, 74, 30), ellipse(76, 352, 30, 8), ellipse(326, 350, 36, 10)],
    [
      ...s.figDetail,
      'M 290 84 C 310 62 344 62 362 84',
      'M 60 346 A 30 8 0 0 1 104 350',
      'M 304 344 A 36 10 0 0 1 356 346',
      `${circle(150, 360, 3)} ${circle(280, 366, 3)} ${circle(40, 322, 2.5)}`,
      sparkle(330, 170, 11),
      sparkle(40, 210, 9),
      `${circle(220, 40, 2.5)} ${circle(370, 230, 2.5)} ${circle(30, 40, 2.5)}`,
    ],
  );
}

function quillClue(): Template {
  const g = placeFig(quill(100, 140), 1.08, 160, 300);
  const lc = g.at.lens;
  const r = 16 * 1.08;
  const ground = 'M 20 361 L 380 361';
  return tpl(
    'quill-finds-clue',
    'Inspector Quill finds a clue',
    'intermediate',
    ['cast', 'quill', 'detective', 'mystery', 'clue', 'heron'],
    [
      ...stack(g.shapes),
      ...g.lines,
      clip(footprint(lc[0], lc[1], 30, 0.95), [region(circle(lc[0], lc[1], r))], 'inside'),
      clip(ground, g.shapes.map((d) => region(d))),
      footprint(300, 340, 80, 0.75),
      footprint(336, 324, 100, 0.75),
      footprint(372, 336, 80, 0.75),
    ],
    [
      ...g.detail,
      'M 40 372 L 70 372 M 250 374 L 290 374',
      'M 52 120 C 52 100 76 96 78 114 C 80 126 66 128 66 140 M 66 152 L 66 154',
      sparkle(330, 80, 12),
      sparkle(56, 230, 8),
    ],
  );
}

function ottolineSpyglass(): Template {
  const g = placeFig(ottoline(28, -140), 1.12, 186, 302);
  const [hx, hy] = g.at.handR;
  const seg = (d0: number, d1: number, w: number): string => {
    const a = polar(hx, hy, d0, 55);
    return shift(rotate(rrect(-w / 2, -(d1 - d0), w, d1 - d0, 4), 55, 0, 0), a[0], a[1]);
  };
  const tubes = [seg(-20, 16, 13), seg(10, 54, 17), seg(48, 96, 22)];
  const end = polar(hx, hy, 96, 55);
  const sea = 'M 20 250 L 380 250';
  const shapes = [g.shapes[0], g.shapes[1], ...g.shapes.slice(2)];
  const s = scene({ ...g, shapes }, [], []);
  const hand = g.shapes.find((d) => d.length > 0 && d === circle(hx, hy, 13 * 1.12)) ?? '';
  const layers = stack([...(hand ? [hand] : []), ...tubes.slice().reverse(), ...g.shapes]);
  return tpl(
    'ottoline-spyglass',
    'Captain Ottoline with a spyglass',
    'intermediate',
    ['cast', 'ottoline', 'pirate', 'captain', 'spyglass', 'sea'],
    [...(hand ? layers : stack([...tubes.slice().reverse(), ...g.shapes])), ...g.lines, clip(sea, [...g.shapes, ...tubes].map((d) => region(d))), circle(end[0], end[1], 7)],
    [
      ...s.figDetail,
      clip('M 30 270 Q 50 262 70 270 M 290 280 Q 310 272 330 280 M 40 310 Q 60 302 80 310 M 320 330 Q 340 322 360 330', [...g.shapes].map((d) => region(d))),
      'M 300 250 C 310 236 330 232 350 250',
      'M 326 236 L 326 200 M 326 202 C 316 196 306 200 300 206 M 326 202 C 336 194 348 198 352 206',
      gull(70, 90, 13),
      gull(110, 60, 9),
      sparkle(60, 190, 10),
    ],
  );
}

function sageHowdy(): Template {
  const g = placeFig(sage(), 1.4, 186, 300);
  const [cac, ribs] = cactus(64, 340, 170, 26);
  const tumble = circle(330, 336, 22);
  const s = scene(g, [], [cac]);
  return tpl(
    'sage-on-patrol',
    'Sheriff Sage on patrol',
    'intermediate',
    ['cast', 'sage', 'sheriff', 'tortoise', 'western', 'cowboy'],
    [...s.paths, ...s.figLines, tumble, clip('M 20 351 L 380 351', [...g.shapes, cac, tumble].map((d) => region(d))), circle(320, 80, 32)],
    [
      ...s.figDetail,
      clip(ribs, g.shapes.map((d) => region(d))),
      clip(`${spiral(322, 336, 3, 6)} M 312 322 L 344 352 M 346 324 L 314 350`, [region(tumble)], 'inside'),
      'M 320 36 L 320 26 M 356 48 L 364 40 M 284 48 L 276 40 M 364 80 L 376 80 M 276 80 L 264 80',
      'M 40 370 Q 60 366 80 370 M 200 374 Q 220 370 240 374',
      gull(140, 60, 12),
    ],
  );
}

// ---- advanced (full scenes) -------------------------------------------------------------------

function moonBase(): Template {
  const bigDome = 'M 70 268 A 76 66 0 0 1 222 268 Z';
  const tube = rrect(214, 250, 40, 16, 7);
  const smallDome = 'M 246 270 A 40 36 0 0 1 326 270 Z';
  const module = rrect(318, 232, 52, 40, 10);
  const rover = rrect(150, 300, 100, 34, 10);
  const cab = 'M 170 302 L 176 278 L 214 278 L 226 302 Z';
  const wheels = [circle(170, 338, 14), circle(200, 338, 14), circle(230, 338, 14)];
  const mast = rrect(40, 150, 6, 110, 3);
  const dish = 'M 18 150 A 34 34 0 0 0 70 128 Z';
  const ground = 'M 20 262 C 120 248 280 256 380 244 L 380 380 L 20 380 Z';
  const flagPole = rrect(144, 150, 4, 60, 2);
  const flag = 'M 148 152 L 178 160 L 148 170 Z';
  const shapes = [...wheels, cab, rover, flag, flagPole, bigDome, tube, smallDome, module, dish, mast, ground];
  const hide = shapes.map((d) => region(d));
  const domeR = region(bigDome);
  const geo = clip('M 146 202 L 146 268 M 100 222 L 192 222 M 80 246 L 212 246 M 112 212 L 96 268 M 180 212 L 196 268 M 146 222 L 112 268 M 146 222 L 180 268', [domeR], 'inside');
  return tpl(
    'moon-base',
    'Moon base under the stars',
    'advanced',
    ['space', 'moon', 'base', 'sci-fi', 'rover', 'galaxy'],
    [
      ...stack(shapes),
      rrect(126, 240, 40, 28, 6),
      `${circle(276, 254, 7)} ${circle(300, 254, 7)}`,
      clip(circle(300, 80, 44), [region(ellipse(300, 80, 76, 14))].length ? [] : []),
      clip(ellipse(300, 80, 76, 14), [region(circle(300, 80, 44))]),
    ],
    [
      geo,
      'M 132 240 L 132 268 M 146 240 L 146 268 M 160 240 L 160 268',
      clip('M 260 76 C 280 60 320 60 340 80 M 266 100 C 290 112 320 110 336 96', [region(circle(300, 80, 44))], 'inside'),
      `${circle(334, 252, 4)} ${circle(352, 252, 4)}`,
      'M 180 284 L 210 284 M 196 284 L 196 300',
      `${circle(170, 338, 5)} ${circle(200, 338, 5)} ${circle(230, 338, 5)}`,
      'M 44 140 L 44 150',
      clip('M 60 300 A 26 7 0 0 1 112 302 M 280 330 A 34 9 0 0 1 348 332 M 40 352 A 18 5 0 0 1 76 354 M 262 368 A 22 6 0 0 1 306 370', hide.slice(0, 5)),
      clip('M 70 320 A 26 7 0 0 0 102 304 M 290 344 A 34 9 0 0 0 340 336', hide.slice(0, 5)),
      'M 100 360 L 104 356 M 130 372 L 136 368 M 330 300 L 336 296 M 250 360 L 256 356',
      clip(`${softStar(60, 60, 14, 6, 5, 2)} ${sparkle(200, 50, 10)} ${sparkle(110, 110, 8)} ${softStar(370, 170, 10, 4.5, 5, 1.5)}`, hide),
      `${circle(30, 100, 2.5)} ${circle(160, 30, 2.5)} ${circle(230, 120, 2.5)} ${circle(250, 30, 2.5)} ${circle(370, 30, 2.5)} ${circle(220, 190, 2.5)} ${circle(90, 180, 2.5)}`,
      'M 24 214 L 60 196 M 32 222 L 56 210',
    ],
  );
}

function giantLizard(): Template {
  const head = 'M 214 128 C 210 84 260 70 300 80 C 340 88 352 112 344 132 C 336 150 300 160 260 158 C 232 156 216 146 214 128 Z';
  const armL = petal(212, 214, 120, 46, 12);
  const armR = petal(262, 210, 140, 44, 11);
  const body = 'M 140 360 C 130 260 160 170 236 138 L 282 150 C 292 210 282 300 292 360 Z';
  const backC: [P, P, P, P] = [[140, 340], [132, 260], [160, 180], [230, 140]];
  const crest: string[] = [];
  for (let i = 0; i < 6; i++) {
    const t = 0.12 + (0.78 * i) / 5;
    const p = bez(...backC, t);
    const [ux, uy] = tangent(...backC, t);
    const nx = uy;
    const ny = -ux;
    const deg = (Math.atan2(nx, -ny) * 180) / Math.PI;
    crest.push(petal(p[0] - nx * 6, p[1] - ny * 6, deg, 34 - i * 2, 10));
  }
  const tail = 'M 150 340 C 90 344 46 306 54 250 C 66 292 106 314 156 312 Z';
  const house = (x: number, w: number, h: number): string => union([rrect(x, 372 - h, w, h, 3), poly([[x - 6, 374 - h], [x + w / 2, 340 - h], [x + w + 6, 374 - h]])]);
  const houses = [house(40, 54, 50), house(118, 60, 64), house(214, 50, 44), house(300, 62, 58)];
  const trees = [union([circle(200, 316, 16), rrect(197, 326, 6, 46, 3)]), union([circle(282, 322, 13), rrect(279, 330, 6, 42, 3)])];
  const clouds = [union([circle(70, 70, 22), circle(96, 60, 26), circle(124, 72, 20)]), union([circle(330, 40, 16), circle(352, 34, 20), circle(372, 44, 14)])];
  const shapes = [...houses, ...trees, head, armL, armR, body, ...crest, tail, ...clouds];
  const front = [...houses, ...trees].map((d) => region(d));
  let windows = '';
  for (const [x, w, h] of [[40, 54, 50], [118, 60, 64], [214, 50, 44], [300, 62, 58]] as const) {
    windows += ` ${rrect(x + 8, 380 - h, 12, 12, 2)} ${rrect(x + w - 20, 380 - h, 12, 12, 2)} ${rrect(x + w / 2 - 7, 352, 14, 20, 3)}`;
  }
  return tpl(
    'giant-lizard-toy-town',
    'Giant lizard in toy town',
    'advanced',
    ['monster', 'lizard', 'giant', 'town', 'creature', 'friendly'],
    [...stack(shapes), circle(290, 106, 9), circle(292, 106, 3.5), 'M 300 140 Q 318 146 334 134', windows.trim(), 'M 20 372 L 380 372'],
    [
      `${circle(334, 104, 2.5)} ${circle(342, 112, 2.5)}`,
      'M 270 112 Q 278 120 268 126',
      clip(clip('M 240 190 Q 262 196 280 188 M 236 220 Q 260 228 282 220 M 234 252 Q 258 260 284 252 M 234 284 Q 258 292 286 284 M 236 316 Q 260 324 288 316', [region(body)], 'inside'), front),
      clip(clip(`${circle(170, 230, 6)} ${circle(186, 270, 5)} ${circle(160, 300, 7)} ${circle(200, 200, 4)} ${circle(236, 108, 5)}`, [region(body), region(head)].length ? [] : []), [...front, region(armL), region(armR)]),
      clip('M 222 214 L 232 222 M 270 214 L 278 226', [], 'outside'),
      'M 36 324 L 100 324 M 112 310 L 184 310',
      clip('M 206 330 L 196 322 M 284 334 L 290 328', [], 'outside'),
      gull(190, 60, 12),
      gull(230, 40, 9),
      'M 84 60 Q 96 52 108 60 M 342 34 Q 352 28 362 34',
      sparkle(370, 120, 9),
    ],
  );
}

function quillDesk(): Template {
  const g = placeFig(quill(120, 28), 1.0, 146, 292);
  const desk = rrect(24, 262, 352, 20, 6);
  const front = 'M 40 282 L 360 282 L 360 380 L 40 380 Z';
  const lampShade = 'M 300 186 L 356 186 L 344 150 L 312 150 Z';
  const lampArm = rrect(325, 186, 6, 70, 3);
  const lampBase = ellipse(328, 258, 26, 7);
  const cup = rrect(250, 228, 30, 34, 6);
  const handleC = 'M 280 236 C 296 236 296 254 280 254 L 280 248 C 288 248 288 242 280 242 Z';
  const paper = rotate(rrect(70, 240, 90, 22, 2), -3, 115, 251);
  const window = rrect(272, 32, 100, 100, 6);
  const board = rrect(24, 36, 84, 100, 6);
  const props = [lampShade, lampArm, lampBase, cup, handleC, paper, desk, front];
  const frontR = props.map((d) => region(d));
  const s = scene(g, props, [window, board]);
  return tpl(
    'quill-detective-desk',
    "Inspector Quill at the detective desk",
    'advanced',
    ['cast', 'quill', 'detective', 'mystery', 'desk', 'noir'],
    [...s.paths, ...s.figLines, rrect(168, 300, 64, 40, 6), circle(200, 320, 5)],
    [
      ...s.figDetail,
      clip('M 322 32 L 322 132 M 272 82 L 372 82', [...g.shapes.map((d) => region(d))]),
      clip(`${circle(346, 60, 12)} M 290 104 L 284 116 M 304 112 L 298 124 M 352 104 L 346 116 M 284 56 L 278 68`, [...g.shapes.map((d) => region(d))]),
      `${rrect(34, 48, 26, 30, 2)} ${rrect(70, 54, 28, 22, 2)} ${rrect(40, 94, 30, 30, 2)} ${rrect(76, 92, 22, 28, 2)}`,
      `${circle(47, 48, 3)} ${circle(84, 54, 3)} ${circle(55, 94, 3)} ${circle(87, 92, 3)} M 47 48 L 84 54 L 55 94 L 87 92`,
      'M 80 248 L 140 246 M 80 254 L 124 252',
      'M 258 222 C 254 214 262 210 258 202 M 270 222 C 266 214 274 210 270 202',
      clip('M 300 186 L 270 262 M 356 186 L 384 262', [region(lampShade), ...frontR.slice(2), ...g.shapes.map((d) => region(d))]),
      'M 60 300 C 120 296 160 304 220 300 M 250 330 C 290 326 320 334 350 330 M 60 350 C 110 346 150 354 190 350 M 230 362 C 280 358 310 366 350 362',
      'M 186 312 L 214 312',
      'M 40 282 L 360 282',
    ],
  );
}

function sageSundown(): Template {
  const g = placeFig(sage(), 0.95, 140, 340);
  const saloon = 'M 238 140 L 238 120 L 268 120 L 268 104 L 340 104 L 340 120 L 370 120 L 370 140 Z';
  const saloonBody = rrect(238, 138, 132, 168, 2);
  const porch = rrect(228, 230, 152, 10, 3);
  const [c1, r1] = cactus(336, 374, 104, 18);
  const sun = 'M 120 240 A 56 56 0 0 1 232 240 Z';
  const mesa = 'M 20 240 L 34 240 L 50 200 L 112 200 L 126 240 Z';
  const shapes = [c1, ...g.shapes, porch, saloonBody, saloon, mesa, sun];
  const hide = shapes.map((d) => region(d));
  const fore = [c1, ...g.shapes].map((d) => region(d));
  const rider =
    'M 84 200 L 84 194 L 78 192 L 80 186 L 88 182 L 92 186 L 104 186 L 108 182 L 112 184 L 110 190 L 106 194 L 106 200 Z';
  let rays = '';
  for (let k = -3; k <= 3; k++) {
    const a = polar(176, 240, 68, k * 24);
    const b = polar(176, 240, 82, k * 24);
    rays += ` M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}`;
  }
  return tpl(
    'sage-at-sundown',
    'Sheriff Sage at sundown',
    'advanced',
    ['cast', 'sage', 'sheriff', 'western', 'saloon', 'sundown'],
    [
      ...stack(shapes),
      ...g.lines,
      clip('M 20 240 L 380 240', hide),
      clip(`${rrect(252, 150, 26, 34, 3)} ${rrect(330, 150, 26, 34, 3)} ${rrect(286, 248, 36, 58, 3)}`, fore),
      rider,
      'M 94 182 L 96 172 L 100 178',
    ],
    [
      ...g.detail,
      r1,
      clip('M 238 270 L 286 270 M 322 270 L 370 270 M 238 290 L 286 290 M 322 290 L 370 290 M 304 248 L 304 306', fore),
      clip('M 232 240 L 232 306 M 376 240 L 376 306 M 286 112 L 322 112', fore),
      clip(rays.trim(), hide),
      clip('M 140 226 L 212 226 M 150 212 L 202 212', [region(sun)], 'inside'),
      clip('M 60 226 L 100 226 M 70 214 L 96 214', [region(mesa)], 'inside'),
      'M 268 120 L 268 140 M 340 120 L 340 140',
      clip('M 30 270 L 80 270 M 120 256 L 180 256 M 40 300 L 70 300 M 250 340 L 300 340 M 280 372 L 310 372 M 30 384 L 60 384', hide),
      gull(170, 120, 12),
      gull(206, 140, 9),
      clip(`${circle(30, 340, 3)} ${circle(300, 324, 3)} ${circle(240, 368, 2.5)}`, hide),
      'M 50 60 Q 80 44 110 60 Q 140 50 160 64 M 250 50 Q 280 36 310 50',
    ],
  );
}

function ottolineWheel(): Template {
  const g = placeFig(ottoline(25, -25, 64), 1.0, 200, 246);
  const hub = circle(200, 284, 22);
  const rim = circle(200, 284, 72);
  const inner = circle(200, 284, 58);
  const handles: string[][] = [];
  for (let k = 0; k < 8; k++) handles.push([rotate(rrect(195, 194, 10, 22, 5), k * 45, 200, 284), circle(...polar(200, 284, 98, k * 45), 9)]);
  const spokes: string[] = [];
  for (let k = 0; k < 8; k++) spokes.push(clip(clip(rotate(rrect(196, 222, 8, 50, 3), k * 45, 200, 284), [region(hub)]), [region(inner)], 'inside'));
  const rail = rrect(20, 320, 360, 14, 5);
  const posts: string[] = [];
  for (let x = 36; x < 380; x += 34) posts.push(rrect(x, 334, 10, 46, 4));
  const mast = rrect(318, 20, 16, 300, 6);
  const sail = 'M 326 40 C 286 80 270 160 280 250 L 326 240 Z';
  const flag = 'M 334 28 L 376 38 L 334 50 Z';
  const shapes = [g.shapes[6], g.shapes[8], hub, rim, ...handles, rail, ...posts, ...g.shapes, sail, mast, flag];
  const hide = [hub, rim, ...handles.flat(), rail, ...posts, ...g.shapes, sail, mast, flag].map((d) => region(d));
  const front = [hub, rim, ...handles.flat(), rail, ...posts].map((d) => region(d));
  return tpl(
    'ottoline-ships-wheel',
    "Captain Ottoline at the ship's wheel",
    'advanced',
    ['cast', 'ottoline', 'pirate', 'captain', 'ship', 'sailing'],
    [...stack(shapes), ...g.lines.map((d) => clip(d, front)).filter(Boolean), inner, ...spokes, circle(200, 284, 10)],
    [
      ...g.detail.map((d) => clip(d, front)).filter(Boolean),
      circle(200, 284, 65),
      clip('M 290 120 C 300 116 314 116 324 120 M 284 170 C 296 166 312 166 324 170 M 282 220 C 294 216 312 216 324 220', [region(sail)], 'inside'),
      scallop(350, 36, 5)[0],
      clip('M 20 230 L 380 230', hide),
      clip('M 30 250 Q 50 242 70 250 M 90 270 Q 110 262 130 270 M 270 262 Q 290 254 310 262 M 340 280 Q 360 272 380 280 M 40 296 Q 60 288 80 296', hide),
      gull(60, 80, 14),
      gull(100, 50, 10),
      gull(240, 60, 9),
      clip('M 20 327 L 380 327', [...g.shapes, ...posts].map((d) => region(d)).length ? [] : [], 'outside'),
      'M 40 120 Q 60 104 84 116 Q 100 100 120 116 Q 136 112 140 124',
    ],
  );
}

function cinemaMarquee(): Template {
  const pediment = 'M 60 150 L 60 96 Q 200 34 340 96 L 340 150 Z';
  const sign = 'M 30 150 L 370 150 L 350 224 L 50 224 Z';
  const facade = rrect(60, 222, 280, 156, 2);
  const booth = 'M 162 378 L 162 284 Q 200 254 238 284 L 238 378 Z';
  const doorL = rrect(76, 270, 70, 108, 4);
  const doorR = rrect(254, 270, 70, 108, 4);
  const postL = rrect(28, 318, 12, 60, 5);
  const postR = rrect(360, 318, 12, 60, 5);
  const shapes = [postL, postR, booth, sign, pediment, facade];
  let bulbs = '';
  for (let k = 0; k < 17; k++) bulbs += ` ${circle(40 + k * 20, 160, 4)}`;
  for (let k = 0; k < 15; k++) bulbs += ` ${circle(60 + k * 20, 214, 4)}`;
  let letters = '';
  for (let k = 0; k < 9; k++) letters += ` ${rrect(78 + k * 28, 172, 20, 14, 2)}`;
  for (let k = 0; k < 7; k++) letters += ` ${rrect(106 + k * 28, 192, 20, 12, 2)}`;
  return tpl(
    'cinema-marquee',
    'Cinema marquee at night',
    'advanced',
    ['cinema', 'movie', 'marquee', 'theater', 'film', 'night'],
    [
      ...stack(shapes),
      starPatch(200, 104, 22),
      doorL,
      doorR,
      rrect(176, 296, 48, 34, 6),
      'M 40 324 C 90 352 120 300 162 330 M 238 330 C 280 300 310 352 360 324',
      circle(34, 314, 8),
      circle(366, 314, 8),
    ],
    [
      bulbs.trim(),
      letters.trim(),
      `${circle(111, 312, 18)} ${circle(289, 312, 18)}`,
      'M 111 330 L 111 378 M 289 330 L 289 378',
      `${circle(136, 344, 3)} ${circle(264, 344, 3)}`,
      'M 176 344 L 224 344 M 186 354 L 214 354',
      `${sparkle(140, 108, 7)} ${sparkle(260, 108, 7)}`,
      'M 90 126 L 310 126 M 90 138 L 310 138',
      'M 20 378 L 380 378',
      softStar(40, 50, 14, 6, 5, 2),
      softStar(360, 60, 12, 5, 5, 2),
      `${sparkle(120, 40, 9)} ${sparkle(290, 34, 8)}`,
      `${circle(70, 100, 2.5)} ${circle(340, 120, 2.5)} ${circle(200, 24, 2.5)} ${circle(30, 120, 2.5)} ${circle(380, 180, 2.5)}`,
      'M 72 234 L 72 260 M 328 234 L 328 260 M 160 240 L 240 240',
    ],
  );
}

export const movies: Template[] = [
  astronaut(),
  retroRocket(),
  flyingSaucer(),
  ringedPlanet(),
  tRex(),
  longNeck(),
  wizard(),
  dragon(),
  robot(),
  pirateShip(),
  treasureMap(),
  popcornClapper(),
  reelGlasses(),
  jungleExpedition(),
  // fb-1022b B3 (T111)
  spaceShuttle(),
  alienPlant(),
  robotBuddy(),
  magnifierClues(),
  sheriffStar(),
  cowboyGear(),
  shipsWheel(),
  pirateParrot(),
  novaWaves(),
  furryMonster(),
  spaceStation(),
  seaSerpent(),
  swampCreature(),
  noirLamp(),
  treasureIsland(),
  spyGadgets(),
  novaFlag(),
  quillClue(),
  ottolineSpyglass(),
  sageHowdy(),
  moonBase(),
  giantLizard(),
  quillDesk(),
  sageSundown(),
  ottolineWheel(),
  cinemaMarquee(),
];
