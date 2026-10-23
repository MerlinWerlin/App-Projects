// Faces & figures batch (fb-1022b T121, 22 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Generic people of our own design for learners: front, three-quarter and profile heads with classic proportions
// (eyes halfway down the head, nose halfway between eyes and chin, ears between brow and nose), feature studies,
// hand poses and simple full figures. No real people, characters or lookalikes. Overlaps use occlude.ts so the
// lines behind a shape are hidden; limbs are tapered capsules merged into one clean outline.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, mirrorX, rotate, rrect, shift, type P } from './draw.ts';
import { clip, outline, region, union, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

export type Art = { p: string[]; d: string[] };

export const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });

/** A layered item: a closed silhouette (hides what is behind it) and its own lines. sil '' = lines only. */
export type Item = { sil: Layer; p?: string[]; d?: string[]; draw?: boolean };

/** Draw items front to back: each item's outline and lines are clipped by every item listed before it. */
export function layered(items: readonly Item[]): Art {
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (regs.length ? clip(s, regs) : s);
  for (const it of items) {
    for (const s of [it.sil === '' || it.draw === false ? '' : outline(it.sil), ...(it.p ?? [])]) {
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

/** Smooth curve through points (Catmull-Rom as cubic Béziers). */
export function smooth(pts: readonly P[], closed = true): string {
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

/** Tapered capsule from a (radius ra) to b (radius rb): one limb segment or finger. */
export function limb(a: P, b: P, ra: number, rb: number): string {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / L;
  const ny = (b[0] - a[0]) / L;
  return (
    `M ${f(a[0] + nx * ra)} ${f(a[1] + ny * ra)} L ${f(b[0] + nx * rb)} ${f(b[1] + ny * rb)} ` +
    `A ${f(rb)} ${f(rb)} 0 0 0 ${f(b[0] - nx * rb)} ${f(b[1] - ny * rb)} L ${f(a[0] - nx * ra)} ${f(a[1] - ny * ra)} ` +
    `A ${f(ra)} ${f(ra)} 0 0 0 ${f(a[0] + nx * ra)} ${f(a[1] + ny * ra)} Z`
  );
}

/** A chain of capsules through joints with radii (one merged limb). */
const chain = (pts: readonly P[], r: readonly number[]): string[] => pts.slice(1).map((p, i) => limb(pts[i], p, r[i], r[i + 1]));

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `fig-${id}`,
    name,
    category: 'faces',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- facial features ---------------------------------------------------------------------------------------------

type EyeO = { w?: number; h?: number; iris?: number; lashes?: boolean; crease?: boolean };

/** Left eye on screen (inner corner on the right) centred on (x, y), with iris clipped by the lids. */
function eyeL(x: number, y: number, o: EyeO = {}): Art {
  const w = o.w ?? 36;
  const h = o.h ?? 11;
  const shape =
    `M ${f(x - w / 2)} ${f(y)} C ${f(x - w / 4)} ${f(y - h * 1.1)} ${f(x + w / 5)} ${f(y - h * 1.15)} ${f(x + w / 2)} ${f(y + h * 0.15)} ` +
    `C ${f(x + w / 5)} ${f(y + h * 0.75)} ${f(x - w / 4)} ${f(y + h * 0.7)} ${f(x - w / 2)} ${f(y)} Z`;
  const ir = o.iris ?? h * 0.72;
  const reg = [region(shape)];
  const p = [shape, clip(circle(x + 1, y - 1, ir), reg, 'inside'), circle(x + 1, y - 1, ir * 0.38)];
  const d: string[] = [];
  if (o.crease !== false) d.push(`M ${f(x - w * 0.42)} ${f(y - h * 0.6)} C ${f(x - w * 0.2)} ${f(y - h * 1.55)} ${f(x + w * 0.22)} ${f(y - h * 1.6)} ${f(x + w * 0.44)} ${f(y - h * 0.5)}`);
  if (o.lashes) {
    for (let i = 0; i < 6; i++) {
      const t = 0.08 + i * 0.13;
      const u = 1 - t;
      const bx = u * u * u * (x - w / 2) + 3 * u * u * t * (x - w / 4) + 3 * u * t * t * (x + w / 5) + t * t * t * (x + w / 2);
      const by = u * u * u * y + 3 * u * u * t * (y - h * 1.1) + 3 * u * t * t * (y - h * 1.15) + t * t * t * (y + h * 0.15);
      const lean = (0.5 - t) * 10;
      d.push(`M ${f(bx)} ${f(by)} Q ${f(bx - lean * 0.4)} ${f(by - 6)} ${f(bx - lean)} ${f(by - 9)}`);
    }
  }
  return { p, d };
}

/** Left eyebrow (thicker inner end on the right). */
function browL(x: number, y: number, w = 40, lift = 0): string {
  return (
    `M ${f(x - w / 2)} ${f(y + 4)} C ${f(x - w / 4)} ${f(y - 8 - lift)} ${f(x + w / 6)} ${f(y - 9 - lift)} ${f(x + w / 2)} ${f(y - 4)} ` +
    `L ${f(x + w / 2)} ${f(y + 3)} C ${f(x + w / 6)} ${f(y - 2 - lift)} ${f(x - w / 4)} ${f(y - 1 - lift)} ${f(x - w / 2)} ${f(y + 4)} Z`
  );
}

const mirrorArt = (a: Art, axis = 200): Art => ({ p: a.p.map((d) => mirrorX(d, axis)), d: a.d.map((d) => mirrorX(d, axis)) });

/** Front nose: bridge hint, two wings and the tip. Bottom at y. */
function noseFront(x: number, y: number, s = 1): Art {
  return {
    p: [
      `M ${f(x - 13 * s)} ${f(y - 14 * s)} C ${f(x - 22 * s)} ${f(y - 6 * s)} ${f(x - 16 * s)} ${f(y + 4 * s)} ${f(x - 6 * s)} ${f(y + 1 * s)}`,
      `M ${f(x + 13 * s)} ${f(y - 14 * s)} C ${f(x + 22 * s)} ${f(y - 6 * s)} ${f(x + 16 * s)} ${f(y + 4 * s)} ${f(x + 6 * s)} ${f(y + 1 * s)}`,
      `M ${f(x - 6 * s)} ${f(y + 1 * s)} Q ${f(x)} ${f(y + 6 * s)} ${f(x + 6 * s)} ${f(y + 1 * s)}`,
    ],
    d: [`M ${f(x - 6 * s)} ${f(y - 52 * s)} C ${f(x - 8 * s)} ${f(y - 36 * s)} ${f(x - 10 * s)} ${f(y - 24 * s)} ${f(x - 12 * s)} ${f(y - 16 * s)}`],
  };
}

/** Front lips centred at (x, y) = mouth line; w = half width; smile lifts the corners. */
function lipsFront(x: number, y: number, w = 24, full = 1, smile = 0): Art {
  const up = 7 * full;
  const lo = 13 * full;
  const cy = y - smile;
  const shape =
    `M ${f(x - w)} ${f(cy)} C ${f(x - w * 0.55)} ${f(y - up)} ${f(x - w * 0.25)} ${f(y - up - 2)} ${f(x)} ${f(y - up * 0.55)} ` +
    `C ${f(x + w * 0.25)} ${f(y - up - 2)} ${f(x + w * 0.55)} ${f(y - up)} ${f(x + w)} ${f(cy)} ` +
    `C ${f(x + w * 0.55)} ${f(y + lo)} ${f(x - w * 0.55)} ${f(y + lo)} ${f(x - w)} ${f(cy)} Z`;
  const mid = `M ${f(x - w)} ${f(cy)} C ${f(x - w * 0.4)} ${f(y + 2 + smile * 0.4)} ${f(x + w * 0.4)} ${f(y + 2 + smile * 0.4)} ${f(x + w)} ${f(cy)}`;
  return { p: [shape, mid], d: [] };
}

/** Simple ear (left side of a front face) as a closed shape plus inner fold. */
function earL(x: number, y: number, h = 50): Art {
  const s = h / 50;
  return {
    p: [`M ${f(x + 4 * s)} ${f(y)} C ${f(x - 14 * s)} ${f(y - 10 * s)} ${f(x - 22 * s)} ${f(y + 12 * s)} ${f(x - 16 * s)} ${f(y + 28 * s)} C ${f(x - 12 * s)} ${f(y + 42 * s)} ${f(x - 2 * s)} ${f(y + 52 * s)} ${f(x + 8 * s)} ${f(y + 46 * s)} Z`],
    d: [`M ${f(x - 2 * s)} ${f(y + 8 * s)} C ${f(x - 12 * s)} ${f(y + 8 * s)} ${f(x - 14 * s)} ${f(y + 24 * s)} ${f(x - 6 * s)} ${f(y + 34 * s)}`],
  };
}

const HEAD_ADULT = 'M 200 78 C 252 78 284 114 284 180 C 284 220 274 250 256 274 C 238 296 220 306 200 306 C 180 306 162 296 144 274 C 126 250 116 220 116 180 C 116 114 148 78 200 78 Z';
const HEAD_CHILD = 'M 200 88 C 262 88 294 132 294 196 C 294 256 252 300 200 300 C 148 300 106 256 106 196 C 106 132 138 88 200 88 Z';

/** Eyes, brows, nose and lips of an adult front face (eye line y = 188). */
function adultFeatures(o: { lashes?: boolean; smile?: number; full?: number; lipW?: number; brow?: number } = {}): Art {
  const eye = eyeL(160, 190, { lashes: o.lashes });
  const brow = { p: [browL(158, 164, 42, o.brow ?? 0)], d: [] };
  return join(eye, mirrorArt(eye), brow, mirrorArt(brow), noseFront(200, 238), lipsFront(200, 266, o.lipW ?? 24, o.full ?? 1, o.smile ?? 0));
}

/** Neck and shoulders, drawn last so the head and hair hide them. */
const SHOULDERS = 'M 40 384 C 46 344 92 330 150 322 C 166 318 172 306 172 290 M 228 290 C 228 306 234 318 250 322 C 308 330 354 344 360 384';
const COLLAR_V = 'M 150 322 L 200 372 L 250 322';

// ---- front faces -----------------------------------------------------------------------------------------------

function womanLongHair(): Art {
  const hairBack = 'M 200 60 C 284 60 312 132 306 214 C 302 268 318 316 336 352 C 300 368 252 356 236 330 L 164 330 C 148 356 100 368 64 352 C 82 316 98 268 94 214 C 88 132 116 60 200 60 Z';
  const fringe = 'M 112 200 C 100 116 144 66 200 66 C 262 66 300 116 288 200 C 282 158 266 128 240 112 C 220 136 168 150 126 150 C 118 166 114 182 112 200 Z';
  const strands = [
    'M 200 70 C 180 90 160 118 132 140', 'M 214 72 C 232 82 248 96 260 116', 'M 108 230 C 106 270 110 306 126 336',
    'M 292 230 C 294 272 292 306 280 336', 'M 120 120 C 104 160 100 200 102 240', 'M 280 120 C 296 160 300 200 298 240',
    'M 224 110 C 196 132 160 142 136 144',
  ];
  return join(
    layered([{ sil: fringe }, { sil: HEAD_ADULT }, { sil: hairBack, d: strands }, { sil: '', p: [SHOULDERS], d: ['M 160 330 Q 200 352 240 330'] }]),
    adultFeatures({ lashes: true, smile: 2, full: 1.15 }),
  );
}

function manBeard(): Art {
  const hair = 'M 114 176 C 106 104 146 68 200 68 C 256 68 296 104 286 176 C 280 150 276 132 266 120 C 236 128 196 122 168 104 C 152 124 132 140 114 176 Z';
  const beard =
    'M 118 196 C 120 262 152 318 200 322 C 248 318 280 262 282 196 C 278 226 266 246 246 250 C 230 244 214 244 200 248 C 186 244 170 244 154 250 C 134 246 122 226 118 196 Z ' +
    ellipse(200, 268, 22, 9);
  const earLA = earL(118, 182);
  const ears = [...earLA.p, mirrorX(earLA.p[0], 200)];
  const f0 = adultFeatures({ lipW: 20, full: 0.7, brow: -2 });
  const feats = { p: f0.p.slice(0, -2), d: f0.d };
  return join(
    layered([
      { sil: hair, d: ['M 168 104 C 190 112 220 116 252 114'] },
      { sil: beard, d: ['M 200 284 L 200 300', 'M 176 290 Q 178 302 172 312', 'M 224 290 Q 222 302 228 312', 'M 140 266 Q 150 284 160 292', 'M 260 266 Q 250 284 240 292'] },
      { sil: HEAD_ADULT },
      { sil: ears, d: [...earLA.d, ...earLA.d.map((d) => mirrorX(d, 200))] },
      { sil: '', p: [SHOULDERS, COLLAR_V] },
    ]),
    feats,
    { p: [line(184, 268, 216, 268)], d: [] },
  );
}

function grandmaGlasses(): Art {
  const cap = 'M 112 186 C 98 108 146 70 200 70 C 254 70 302 108 288 186 C 280 150 262 122 226 112 C 210 118 190 118 174 112 C 138 122 120 150 112 186 Z';
  const bun = circle(200, 58, 34);
  const earLA = earL(118, 186);
  const ears = [...earLA.p, mirrorX(earLA.p[0], 200)];
  const lens = (x: number) => rrect(x - 30, 170, 60, 42, 16);
  const glasses = [lens(160), lens(240), 'M 190 184 Q 200 176 210 184', 'M 130 184 L 116 180', 'M 270 184 L 284 180'];
  const wrinkles = [
    'M 116 196 Q 124 202 128 200', 'M 284 196 Q 276 202 272 200', 'M 172 222 C 168 230 166 236 168 240', 'M 228 222 C 232 230 234 236 232 240',
    'M 174 250 C 166 262 166 274 172 284', 'M 226 250 C 234 262 234 274 228 284', 'M 168 128 Q 200 120 232 128', 'M 176 138 Q 200 132 224 138',
    'M 178 300 Q 200 310 222 300',
  ];
  const strands = ['M 200 74 C 180 84 160 100 146 120', 'M 200 74 C 220 84 240 100 254 120', 'M 184 40 C 196 50 206 56 222 58', 'M 176 62 C 192 70 212 72 230 66'];
  const eye = eyeL(160, 190, { w: 32, h: 9 });
  const brow = { p: [browL(158, 164, 40, -3)], d: [] };
  return join(
    layered([
      { sil: '', p: glasses },
      { sil: cap, d: strands.slice(0, 2) },
      { sil: bun, d: strands.slice(2) },
      { sil: HEAD_ADULT, d: wrinkles },
      { sil: ears, d: [...earLA.d, ...earLA.d.map((d) => mirrorX(d, 200))] },
      { sil: '', p: [SHOULDERS, 'M 150 322 Q 200 346 250 322'], d: ['M 160 330 Q 200 356 240 330'] },
    ]),
    eye,
    mirrorArt(eye),
    brow,
    mirrorArt(brow),
    noseFront(200, 240),
    lipsFront(200, 268, 22, 0.75, 3),
  );
}

function childCurls(): Art {
  const curls: string[] = [];
  const pts: [number, number, number][] = [[118, 170, 24], [122, 132, 26], [146, 102, 26], [180, 86, 26], [220, 86, 26], [254, 102, 26], [278, 132, 26], [282, 170, 24], [200, 104, 30], [160, 120, 24], [240, 120, 24]];
  for (const [x, y, r] of pts) curls.push(circle(x, y, r));
  const eye = eyeL(156, 206, { w: 40, h: 14, crease: false });
  const brow = { p: [browL(156, 178, 34, 2)], d: [] };
  const earLA = earL(108, 198, 44);
  const ears = [...earLA.p, mirrorX(earLA.p[0], 200)];
  return join(
    layered([
      { sil: curls },
      { sil: HEAD_CHILD },
      { sil: ears },
      { sil: '', p: ['M 70 384 C 76 352 112 340 160 334 C 172 330 176 320 176 290 M 224 290 C 224 320 228 330 240 334 C 288 340 324 352 330 384'] },
    ]),
    eye,
    mirrorArt(eye),
    brow,
    mirrorArt(brow),
    { p: ['M 192 246 Q 200 252 208 246'], d: [] },
    { p: ['M 180 268 Q 200 284 220 268'], d: [] },
  );
}

function manBeanie(): Art {
  const beanie = 'M 110 158 C 104 82 150 48 200 48 C 250 48 296 82 290 158 Z';
  const cuff = rrect(104, 132, 192, 40, 14);
  const pom = circle(200, 42, 20);
  const earLA = earL(118, 186);
  const ears = [...earLA.p, mirrorX(earLA.p[0], 200)];
  const ribs = [130, 152, 174, 196, 218, 240, 262].map((x) => line(x, 138, x, 166));
  return join(
    layered([{ sil: cuff, p: ribs }, { sil: pom }, { sil: beanie }, { sil: HEAD_ADULT }, { sil: ears }, { sil: '', p: [SHOULDERS, 'M 150 322 Q 200 352 250 322'] }]),
    adultFeatures({ lipW: 22, full: 0.75, smile: 4 }),
  );
}

function womanSunHat(): Art {
  const brim = ellipse(200, 132, 170, 40);
  const crown = 'M 128 130 C 126 56 274 56 272 130 Z';
  const band = 'M 130 112 C 170 120 230 120 270 112 L 271 128 C 230 136 170 136 129 128 Z';
  const hairBack = 'M 120 150 C 98 210 104 280 90 330 C 130 346 156 330 166 312 L 234 312 C 244 330 270 346 310 330 C 296 280 302 210 280 150 Z';
  const strands = ['M 112 200 C 108 240 106 280 100 316', 'M 288 200 C 292 240 294 280 300 316', 'M 124 170 C 118 210 120 250 116 290'];
  return join(
    layered([
      { sil: band },
      { sil: crown, d: ['M 168 78 Q 200 70 232 78'] },
      { sil: brim, d: ['M 60 134 C 120 156 280 156 340 134'] },
      { sil: HEAD_ADULT },
      { sil: hairBack, d: strands },
      { sil: '', p: [SHOULDERS], d: ['M 150 322 Q 200 360 250 322'] },
    ]),
    adultFeatures({ lashes: true, full: 1.1, smile: 3 }),
  );
}

// ---- three-quarter and profile ---------------------------------------------------------------------------------

/** Three-quarter head turned to the viewer's right. */
const HEAD_3Q = 'M 196 76 C 252 74 292 108 294 160 C 295 172 288 180 286 192 C 285 200 292 210 292 222 C 292 240 284 256 274 270 C 262 290 246 306 226 308 C 202 310 176 296 156 276 C 134 254 118 228 114 196 C 108 120 140 78 196 76 Z';

function threeQuarterFeatures(): Art {
  const near = eyeL(184, 190, { w: 34, h: 10.5 });
  const farShape = 'M 244 192 C 252 182 266 182 276 188 C 268 196 254 198 244 192 Z';
  const far: Art = {
    p: [farShape, clip(circle(261, 189, 6.5), [region(farShape)], 'inside')],
    d: ['M 246 183 C 254 176 266 176 274 181'],
  };
  const brows = [browL(182, 164, 40, 0), 'M 240 166 C 252 158 266 158 280 166 L 280 170 C 266 164 252 164 241 171 Z'];
  const nose = ['M 262 230 C 272 238 270 250 258 249', 'M 246 240 C 236 240 236 252 248 252 Q 254 253 258 249'];
  const mouth = 'M 214 272 C 224 264 236 264 244 268 C 250 264 258 266 264 272 C 254 284 228 286 214 272 Z';
  const mouthLine = 'M 214 272 C 228 276 248 276 264 272';
  return join(near, far, { p: [...brows, ...nose, mouth, mouthLine], d: ['M 238 196 C 246 208 256 220 262 230', 'M 224 292 Q 234 296 244 292'] });
}

const EAR_3Q = ['M 150 194 C 130 182 120 204 126 222 C 130 236 140 244 152 240'];
const NECK_3Q = 'M 170 286 C 172 304 170 318 158 330 C 118 340 80 356 70 384 M 252 300 C 250 318 256 330 272 338 C 310 348 340 360 346 384';

function threeQuarterWoman(): Art {
  const fringe = 'M 124 214 C 102 130 140 66 200 62 C 262 58 306 100 300 168 C 292 150 280 132 262 118 C 230 136 186 140 160 136 C 140 156 130 186 124 214 Z';
  const back = 'M 200 60 C 120 60 92 130 96 200 C 98 260 84 310 64 344 C 110 362 160 350 176 316 L 176 260 L 300 170 C 306 110 262 60 200 60 Z';
  const strands = [
    'M 262 118 C 232 98 200 88 168 94', 'M 280 132 C 270 104 244 82 214 74', 'M 160 136 C 150 120 148 100 160 80',
    'M 108 220 C 106 270 96 310 80 338', 'M 126 250 C 126 290 120 320 108 346', 'M 144 270 C 146 300 146 324 140 346',
  ];
  return join(
    layered([
      { sil: fringe, d: strands.slice(0, 3) },
      { sil: HEAD_3Q, p: EAR_3Q, d: ['M 140 206 C 136 214 138 224 144 228'] },
      { sil: back, d: strands.slice(3) },
      { sil: '', p: [NECK_3Q], d: ['M 190 340 Q 220 356 250 338'] },
    ]),
    threeQuarterFeatures(),
    { p: [], d: ['M 172 202 C 180 206 190 206 198 202', 'M 166 182 L 160 176 M 172 179 L 168 172 M 178 178 L 176 171'] },
  );
}

function threeQuarterMan(): Art {
  const hair = 'M 116 190 C 104 112 146 64 200 62 C 262 60 302 104 294 160 C 286 140 274 124 260 116 C 232 122 196 118 172 108 C 150 128 132 150 116 190 Z';
  return join(
    layered([
      { sil: hair, d: ['M 172 108 C 200 100 236 98 264 84', 'M 150 90 C 170 80 196 72 226 70'] },
      { sil: HEAD_3Q, p: EAR_3Q, d: ['M 140 206 C 136 214 138 224 144 228', 'M 272 222 C 276 236 276 248 272 256'] },
      { sil: '', p: [NECK_3Q, 'M 174 326 L 220 368 L 272 336'] },
    ]),
    threeQuarterFeatures(),
  );
}

/** Side-view face contour (facing right): forehead, nose, lips, chin, then the front of the neck. n = nose length. */
function profileContour(n: number): string {
  return (
    `M 196 70 C 248 68 284 100 290 148 C 292 164 290 174 296 188 C ${f(300 + n * 0.3)} 204 ${f(306 + n)} 216 ${f(310 + n)} 228 ` +
    `C ${f(312 + n)} 236 ${f(306 + n * 0.5)} 240 298 240 C 294 242 293 246 295 250 L 299 258 C 301 262 297 264 291 266 ` +
    'C 297 270 299 276 293 280 C 287 284 285 288 289 296 C 293 306 281 314 261 314 C 247 314 237 320 235 336 L 235 352'
  );
}

const PROFILE_EYE = 'M 284 190 C 276 180 266 180 261 186 C 268 193 276 195 284 190 Z';

function profileMan(): Art {
  const hair = 'M 104 176 C 98 112 142 64 200 62 C 252 60 290 92 294 140 C 280 128 262 120 240 120 C 228 132 216 140 200 140 C 194 158 176 172 160 176 C 148 196 138 220 128 248 C 112 236 104 206 104 176 Z';
  const back = 'M 196 70 C 148 72 110 110 106 172 C 104 210 112 244 134 268 C 150 286 158 300 156 330';
  return join(
    layered([
      { sil: hair, d: ['M 120 140 C 150 112 190 98 240 98'] },
      { sil: '', p: [profileContour(6), back, 'M 235 352 C 255 358 284 364 304 384 M 156 330 C 130 346 100 360 84 384'] },
    ]),
    {
      p: [
        PROFILE_EYE,
        'M 254 166 C 266 158 280 160 290 166',
        'M 176 196 C 160 186 150 206 156 222 C 160 236 170 242 180 238',
        'M 291 266 L 278 268',
        'M 290 230 C 281 231 280 243 292 245',
        'M 256 312 C 230 304 206 284 192 250',
      ],
      d: ['M 172 206 C 166 212 168 222 174 226', 'M 279 184 C 275 186 275 190 278 192'],
    },
  );
}

function profileWomanPonytail(): Art {
  const hair = 'M 120 210 C 106 130 150 72 206 70 C 254 68 290 100 292 150 C 272 128 246 116 220 118 C 200 140 176 150 168 160 C 156 176 150 196 150 220 C 140 226 128 222 120 210 Z';
  const back = 'M 196 70 C 148 72 112 110 110 172 C 108 214 120 240 140 262 C 152 280 158 304 150 330';
  const tie = rrect(108, 128, 24, 32, 10);
  const tail = 'M 116 136 C 76 132 62 180 70 230 C 76 270 64 300 50 320 C 92 316 108 280 108 240 C 108 200 116 170 124 150 Z';
  return join(
    layered([
      { sil: tie },
      { sil: hair, d: ['M 220 76 C 190 88 160 108 140 140', 'M 250 84 C 216 94 186 114 166 140', 'M 286 140 C 270 120 246 106 222 102'] },
      { sil: tail, d: ['M 108 150 C 88 180 84 230 80 270', 'M 116 156 C 100 200 98 250 76 300'] },
      { sil: '', p: [profileContour(0), back, 'M 235 352 C 255 358 282 362 302 384 M 150 330 C 126 344 100 360 86 384'] },
    ]),
    {
      p: [
        PROFILE_EYE,
        'M 254 168 C 264 160 278 162 288 168',
        'M 186 206 C 170 196 160 216 166 232 C 170 246 180 252 190 248',
        'M 291 266 L 280 268',
        'M 286 230 C 278 231 277 243 289 245',
        'M 256 312 C 232 304 212 286 200 256',
      ],
      d: ['M 263 184 L 257 179 M 267 182 L 263 175 M 272 181 L 270 174', 'M 182 216 C 176 222 178 232 184 236', circle(186, 258, 5), 'M 279 184 C 275 186 275 190 278 192'],
    },
  );
}


// ---- feature studies ---------------------------------------------------------------------------------------------

function eyesPair(): Art {
  const eye = eyeL(130, 210, { w: 96, h: 30, lashes: true });
  const brow = { p: [browL(124, 140, 120, 6)], d: [] };
  const browHairs: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 74 + i * 12;
    browHairs.push(`M ${x} ${f(146 - Math.sin((i / 8) * Math.PI) * 10)} L ${x + 8} ${f(138 - Math.sin((i / 8) * Math.PI) * 12)}`);
  }
  const nose = ['M 182 180 C 188 210 186 240 178 262', 'M 218 180 C 212 210 214 240 222 262'];
  const under = ['M 90 244 C 110 254 150 254 172 240'];
  const irisRings = [circle(131, 209, 14), circle(131, 209, 18)].map((d) => clip(d, [region(eye.p[0])], 'inside'));
  const all = join(eye, brow, { p: [], d: [...browHairs, ...under, ...irisRings] });
  return join(all, mirrorArt(all), { p: [], d: nose });
}

function lipsStudy(): Art {
  const l = lipsFront(200, 200, 116, 7.5, 6);
  return join(l, {
    p: [],
    d: ['M 200 200 L 200 186', 'M 168 152 Q 200 140 232 152', 'M 200 236 C 196 246 196 256 200 262', 'M 74 214 Q 80 220 74 228', 'M 326 214 Q 320 220 326 228'],
  });
}

function noseStudy(): Art {
  return {
    p: [
      'M 176 60 C 174 120 160 180 140 230 C 126 262 124 286 150 296',
      'M 224 60 C 226 120 240 180 260 230 C 274 262 276 286 250 296',
      'M 150 296 C 158 316 180 318 186 302 Q 200 320 214 302 C 220 318 242 316 250 296',
    ],
    d: ['M 170 300 C 176 292 184 292 186 302', 'M 230 300 C 224 292 216 292 214 302', 'M 186 250 Q 200 236 214 250', 'M 120 250 C 112 270 116 296 134 312', 'M 280 250 C 288 270 284 296 266 312'],
  };
}

function earStudy(): Art {
  const outer = 'M 214 64 C 288 64 314 130 300 186 C 290 226 266 246 258 278 C 252 304 240 340 204 342 C 170 344 150 320 146 300 C 140 272 156 260 156 236 C 156 196 132 160 136 122 C 140 86 172 64 214 64 Z';
  return {
    p: [
      outer,
      'M 166 130 C 172 98 214 88 248 102 C 276 116 284 160 270 192 C 258 220 236 230 226 260',
      'M 200 200 C 180 192 172 214 186 226 C 196 236 214 232 226 260 C 232 280 226 300 210 304',
      'M 174 288 C 186 296 200 300 210 304',
    ],
    d: ['M 190 128 C 214 118 242 130 248 156 C 252 176 240 192 226 200', 'M 186 160 C 200 150 222 158 224 176'],
  };
}

// ---- hands -------------------------------------------------------------------------------------------------------

function handOpen(): Art {
  const palm = smooth([[150, 214], [250, 206], [262, 270], [244, 330], [214, 354], [174, 352], [146, 322], [140, 270]]);
  const wrist = 'M 168 346 L 166 384 M 226 346 L 230 384';
  const fingers = [
    chain([[160, 222], [138, 160], [130, 116]], [16, 14, 12]),
    chain([[186, 214], [178, 140], [176, 84]], [17, 15, 13]),
    chain([[214, 212], [220, 138], [224 , 88]], [17, 15, 13]),
    chain([[240, 220], [258, 164], [270, 128]], [15, 13, 11]),
  ].flat();
  const thumb = chain([[244, 300], [292, 258], [318, 220]], [22, 16, 13]);
  const nails = [[130, 116, -12], [176, 84, -3], [224, 88, 4], [270, 128, 18], [318, 220, 40]].map(([x, y, a]) => rotate(rrect(x - 7, y - 9, 14, 16, 6), a, x, y));
  const creases = [
    'M 128 162 Q 138 168 148 160', 'M 168 140 Q 178 146 188 140', 'M 210 140 Q 220 146 230 140', 'M 250 162 Q 258 170 268 166',
    'M 160 250 C 190 240 220 238 250 248', 'M 150 278 C 180 262 210 262 240 272', 'M 230 230 C 210 270 196 310 192 344', 'M 286 270 Q 290 262 300 260',
  ];
  return join({ p: [union([palm, ...fingers, ...thumb]), wrist], d: [...nails, ...creases] });
}

function handPointing(): Art {
  const fist = smooth([[160, 192], [246, 190], [266, 232], [262, 300], [236, 334], [176, 336], [152, 302], [148, 242]]);
  const index = limb([178, 206], [150, 70], 19, 15);
  const curled = [limb([196, 220], [256, 220], 15, 15), limb([196, 250], [258, 250], 15, 15), limb([196, 280], [252, 280], 14, 14)];
  const thumb = chain([[160, 304], [196, 268], [226, 246]], [18, 16, 13]);
  return join(
    layered([{ sil: thumb }, { sil: curled[0] }, { sil: curled[1] }, { sil: curled[2] }, { sil: [fist, index] }, { sil: '', p: ['M 178 334 L 176 384 M 236 330 L 242 384'] }]),
    { p: [], d: [rotate(rrect(142, 66, 16, 20, 7), -12, 150, 76), 'M 152 140 Q 164 146 176 140', rotate(rrect(216, 236, 14, 14, 5), -40, 223, 243)] },
  );
}

function handPencil(): Art {
  const pen = (d: string) => shift(rotate(d, -46, 60, 200), 40, 140);
  const cone = pen('M 60 200 L 100 187 L 100 213 Z');
  const body = pen(rrect(100, 187, 230, 26, 3));
  const lead = pen('M 60 200 L 72 196 L 72 204 Z');
  const hand = smooth([[226, 204], [276, 172], [330, 172], [366, 204], [372, 258], [344, 298], [286, 306], [244, 290], [222, 252]]);
  const index = chain([[262, 198], [210, 228], [170, 266]], [18, 15, 12]);
  const thumb = chain([[276, 284], [226, 286], [190, 268]], [19, 16, 13]);
  const middle = chain([[250, 262], [208, 302], [178, 304]], [17, 14, 12]);
  const sleeve = 'M 344 170 C 334 220 338 270 352 308 L 384 318 L 384 156 Z';
  return join(
    layered([
      { sil: sleeve, draw: false, p: ['M 344 170 C 334 220 338 270 352 308', 'M 344 170 L 384 156', 'M 352 308 L 384 318'] },
      { sil: index, d: [rotate(rrect(160, 256, 14, 16, 6), 45, 167, 264), 'M 214 220 Q 222 232 232 228'] },
      { sil: thumb, d: [rotate(rrect(184, 260, 14, 16, 6), 70, 191, 268)] },
      { sil: [hand, ...middle], d: ['M 270 206 C 290 196 310 200 326 214', 'M 262 246 C 282 240 302 250 316 266', 'M 214 296 Q 220 306 230 304'] },
      { sil: [cone, body], d: [pen('M 100 200 L 330 200'), pen('M 304 187 L 304 213 M 314 187 L 314 213')] },
    ]),
    { p: [lead], d: ['M 100 352 C 120 348 140 352 160 346'] },
  );
}


// ---- figures -----------------------------------------------------------------------------------------------------

function standing(): Art {
  const head = ellipse(200, 70, 26, 32);
  const hair = 'M 172 72 C 168 36 190 30 200 30 C 216 30 232 38 228 72 C 220 54 206 48 190 56 C 182 60 176 66 172 72 Z';
  const torso = smooth([[160, 118], [240, 118], [250, 170], [244, 230], [156, 230], [150, 170]]);
  const armL = chain([[164, 126], [144, 186], [140, 244]], [15, 12, 10]);
  const armR = chain([[236, 126], [256, 186], [260, 244]], [15, 12, 10]);
  const legs = [...chain([[178, 224], [172, 296], [170, 352]], [22, 15, 12]), ...chain([[222, 224], [228, 296], [230, 352]], [22, 15, 12])];
  const shoes = [ellipse(162, 360, 20, 10), ellipse(238, 360, 20, 10)];
  const neck = rrect(188, 96, 24, 26, 8);
  return join(
    layered([{ sil: hair }, { sil: head }, { sil: shoes }, { sil: torso, p: ['M 184 118 Q 200 132 216 118'] }, { sil: armL }, { sil: armR }, { sil: neck }, { sil: legs, p: ['M 200 236 L 200 260'] }]),
    { p: [circle(140, 252, 10), circle(260, 252, 10)], d: [] },
  );
}

function sitting(): Art {
  const chairSeat = rrect(120, 236, 160, 18, 6);
  const chairBack = rrect(116, 110, 18, 150, 6);
  const chairLegs = ['M 130 254 L 126 370', 'M 270 254 L 274 370'];
  const head = ellipse(196, 66, 26, 30);
  const hair = 'M 168 70 C 164 34 186 26 200 28 C 222 30 230 50 222 64 C 210 54 190 50 176 60 Z';
  const torso = smooth([[166, 104], [214, 104], [228, 160], [226, 236], [160, 236], [156, 160]]);
  const thigh = limb([190, 226], [300, 226], 22, 18);
  const shin = limb([300, 226], [304, 340], 17, 12);
  const foot = ellipse(318, 350, 26, 11);
  const arm = chain([[196, 116], [210, 176], [262, 204]], [14, 12, 10]);
  const hand = circle(268, 206, 11);
  return join(
    layered([
      { sil: hair },
      { sil: head },
      { sil: hand },
      { sil: arm },
      { sil: foot },
      { sil: [thigh, shin, torso] },
      { sil: chairSeat },
      { sil: chairBack },
      { sil: '', p: chairLegs },
    ]),
  );
}

function walking(): Art {
  const head = ellipse(212, 64, 25, 30);
  const hair = 'M 188 66 C 184 32 206 26 218 28 C 238 32 244 50 236 62 C 222 54 204 52 194 62 Z';
  const torso = smooth([[184, 104], [232, 104], [244, 160], [236, 222], [182, 222], [176, 160]]);
  const legF = chain([[214, 214], [256, 282], [252, 352]], [20, 14, 11]);
  const legB = chain([[196, 214], [174, 286], [128, 340]], [20, 14, 11]);
  const shoeF = ellipse(268, 360, 24, 10);
  const shoeB = rotate(ellipse(126, 352, 22, 10), 30, 126, 352);
  const armF = chain([[214, 116], [242, 168], [262, 210]], [13, 11, 9]);
  const armB = chain([[198, 116], [176, 168], [160, 204]], [13, 11, 9]);
  return join(
    layered([
      { sil: hair },
      { sil: head },
      { sil: [...armF, circle(266, 218, 10)] },
      { sil: [torso] , p: ['M 196 104 Q 208 116 220 104'] },
      { sil: shoeF },
      { sil: legF },
      { sil: shoeB },
      { sil: legB },
      { sil: [...armB, circle(156, 210, 10)] },
      { sil: '', p: [rrect(200, 88, 22, 22, 6)] },
    ]),
    { p: [], d: ['M 90 370 L 320 370'] },
  );
}

function mannequin(): Art {
  const head = ellipse(214, 62, 24, 30);
  const neck = limb([206, 92], [204, 112], 8, 8);
  const chest = rotate(ellipse(200, 152, 40, 46), -6, 200, 152);
  const waist = limb([198, 196], [196, 214], 12, 12);
  const pelvis = ellipse(196, 232, 34, 22);
  const j = (x: number, y: number, r = 9) => circle(x, y, r);
  const segs: Layer[] = [
    j(160, 124), j(240, 116), j(138, 186, 8), j(282, 92, 8), j(176, 248, 10), j(220, 250, 10), j(150, 300, 9), j(256, 310, 9), j(124, 228, 7), j(318, 70, 7),
  ];
  const limbsL: string[] = [
    limb([160, 124], [138, 186], 11, 9), limb([138, 186], [124, 228], 9, 7), limb([240, 116], [282, 92], 11, 9), limb([282, 92], [318, 70], 9, 7),
    limb([176, 248], [150, 300], 14, 11), limb([150, 300], [134, 356], 11, 8), limb([220, 250], [256, 310], 14, 11), limb([256, 310], [262, 358], 11, 8),
  ];
  const hands = [ellipse(116, 244, 8, 13), rotate(ellipse(330, 62, 8, 13), 60, 330, 62)];
  const feet = [ellipse(124, 364, 18, 8), ellipse(272, 364, 18, 8)];
  return join(
    layered([
      { sil: head },
      ...segs.map((s) => ({ sil: s })),
      { sil: neck },
      { sil: chest },
      { sil: waist },
      { sil: pelvis },
      ...hands.map((s) => ({ sil: s })),
      ...feet.map((s) => ({ sil: s })),
      ...limbsL.map((s) => ({ sil: s })),
    ]),
    { p: [], d: ['M 190 66 C 200 72 222 74 238 66', 'M 214 32 L 214 92', 'M 170 140 C 186 150 214 150 230 136', 'M 200 106 L 200 198'] },
  );
}

function dancer(): Art {
  const head = ellipse(210, 70, 22, 27);
  const hair = 'M 186 64 C 186 36 212 34 226 42 C 240 50 244 66 234 76 C 228 62 214 56 196 64 Z';
  const bunHair = circle(184, 52, 14);
  const torso = smooth([[192, 98], [226, 100], [230, 150], [214, 196], [190, 196], [186, 150]]);
  const armUp = chain([[222, 108], [272, 72], [318, 44]], [11, 9, 7]);
  const armOut = chain([[196, 110], [146, 126], [92, 112]], [11, 9, 7]);
  const skirt = 'M 190 184 C 172 210 146 232 120 252 C 160 264 196 258 212 244 C 236 260 280 262 312 246 C 284 230 250 210 224 182 Z';
  const legStand = chain([[206, 224], [206, 296], [208, 360]], [17, 13, 9]);
  const legBack = chain([[214, 224], [268, 256], [334, 276]], [15, 11, 8]);
  const foot = ellipse(212, 366, 16, 7);
  return join(
    layered([
      { sil: hair },
      { sil: head },
      { sil: bunHair },
      { sil: [torso, ...armUp, ...armOut, circle(320, 42, 8), circle(88, 112, 8)] },
      { sil: skirt, d: ['M 200 196 C 186 220 166 238 146 252', 'M 214 198 C 226 222 252 240 284 250'] },
      { sil: [...legStand, ...legBack, foot] },
    ]),
    { p: [], d: ['M 150 378 Q 210 372 270 378'] },
  );
}

function childReading(): Art {
  const head = HEAD_CHILD;
  const s = (d: string) => mapPath2(d, 0.5, 200, 30);
  const childHead = s(head);
  const hair = s('M 108 210 C 92 120 140 76 200 76 C 266 76 314 122 292 210 C 284 170 270 146 246 132 C 220 150 170 156 140 148 C 124 166 114 186 108 210 Z');
  const eyes = ['M 172 157 Q 178 162 184 157', 'M 216 157 Q 222 162 228 157'];
  const mouth = 'M 192 176 Q 200 181 208 176';
  const book =
    'M 200 234 C 176 222 140 222 112 232 L 112 312 C 140 302 176 302 200 314 C 224 302 260 302 288 312 L 288 232 C 260 222 224 222 200 234 Z';
  const torso = smooth([[150, 198], [250, 198], [272, 260], [270, 320], [130, 320], [128, 260]]);
  const legs = 'M 80 346 C 90 314 150 304 200 318 C 250 304 310 314 320 346 C 300 362 250 366 200 352 C 150 366 100 362 80 346 Z';
  const hands = [ellipse(112, 270, 14, 18), ellipse(288, 270, 14, 18)];
  const pages = [
    'M 128 246 C 150 240 172 240 190 248', 'M 128 262 C 150 256 172 256 190 264', 'M 128 278 C 150 272 172 272 190 280', 'M 128 294 C 150 288 172 288 190 296',
    'M 210 248 C 228 240 250 240 272 246', 'M 210 264 C 228 256 250 256 272 262', 'M 210 280 C 228 272 250 272 272 278', 'M 210 296 C 228 288 250 288 272 294',
  ];
  const curls = ['M 156 108 C 166 96 182 94 192 102', 'M 210 100 C 222 92 238 96 246 108', 'M 120 340 C 140 334 160 336 176 344', 'M 224 344 C 240 336 262 334 282 340'];
  return join(
    layered([
      { sil: hands },
      { sil: book, p: ['M 200 234 L 200 314'], d: pages },
      { sil: hair, d: curls.slice(0, 2) },
      { sil: childHead, p: [...eyes, mouth], d: ['M 166 168 Q 170 172 174 168', 'M 226 168 Q 230 172 234 168'] },
      { sil: torso, d: ['M 176 198 Q 200 214 224 198'] },
      { sil: legs, d: curls.slice(2) },
    ]),
    { p: [], d: ['M 60 370 L 340 370'] },
  );
}

/** Scale a path by s about (cx, 0) then move it down by dy. */
function mapPath2(d: string, s: number, cx: number, dy: number): string {
  return mapPath(d, { map: (x, y) => [cx + (x - cx) * s, y * s + dy], scale: s, rotate: 0, flip: false });
}

// ---- catalogue -----------------------------------------------------------------------------------------------

export const figures: Template[] = [
  tpl('woman-long-hair', 'Woman with long flowing hair', 'advanced', ['portrait', 'face', 'woman', 'hair', 'realistic', 'front'], womanLongHair()),
  tpl('man-beard', 'Bearded man portrait', 'intermediate', ['portrait', 'face', 'man', 'beard', 'realistic', 'front'], manBeard()),
  tpl('grandma-glasses', 'Grandmother with glasses and a bun', 'advanced', ['portrait', 'face', 'woman', 'glasses', 'elderly', 'realistic'], grandmaGlasses()),
  tpl('child-curls', 'Curly-haired child face', 'beginner', ['portrait', 'face', 'child', 'curly', 'simple', 'front'], childCurls()),
  tpl('man-beanie', 'Man in a knitted beanie', 'beginner', ['portrait', 'face', 'man', 'hat', 'winter', 'simple'], manBeanie()),
  tpl('woman-sun-hat', 'Woman in a wide sun hat', 'intermediate', ['portrait', 'face', 'woman', 'hat', 'summer', 'stylized'], womanSunHat()),
  tpl('three-quarter-woman', 'Woman in three-quarter view', 'advanced', ['portrait', 'face', 'woman', 'three-quarter', 'hair', 'realistic'], threeQuarterWoman()),
  tpl('three-quarter-man', 'Man in three-quarter view', 'intermediate', ['portrait', 'face', 'man', 'three-quarter', 'realistic', 'study'], threeQuarterMan()),
  tpl('profile-man', 'Man in side profile', 'beginner', ['profile', 'face', 'man', 'side', 'simple', 'study'], profileMan()),
  tpl('profile-ponytail', 'Woman in profile with a ponytail', 'intermediate', ['profile', 'face', 'woman', 'ponytail', 'side', 'stylized'], profileWomanPonytail()),
  tpl('eyes-pair', 'Pair of eyes with brows', 'advanced', ['eye', 'eyes', 'study', 'lashes', 'anatomy', 'realistic'], eyesPair()),
  tpl('lips', 'Lips study', 'beginner', ['lips', 'mouth', 'study', 'anatomy', 'simple', 'face'], lipsStudy()),
  tpl('nose', 'Nose study, front view', 'beginner', ['nose', 'study', 'anatomy', 'simple', 'face', 'front'], noseStudy()),
  tpl('ear', 'Ear study', 'beginner', ['ear', 'study', 'anatomy', 'simple', 'face', 'side'], earStudy()),
  tpl('hand-open', 'Open hand, palm up', 'intermediate', ['hand', 'palm', 'study', 'anatomy', 'fingers', 'realistic'], handOpen()),
  tpl('hand-pointing', 'Pointing hand', 'beginner', ['hand', 'pointing', 'gesture', 'simple', 'fingers', 'study'], handPointing()),
  tpl('hand-pencil', 'Hand holding a pencil', 'advanced', ['hand', 'pencil', 'drawing', 'study', 'fingers', 'realistic'], handPencil()),
  tpl('standing', 'Standing figure', 'beginner', ['figure', 'person', 'standing', 'body', 'simple', 'pose'], standing()),
  tpl('sitting', 'Figure sitting on a chair', 'beginner', ['figure', 'person', 'sitting', 'chair', 'simple', 'pose'], sitting()),
  tpl('walking', 'Walking figure', 'beginner', ['figure', 'person', 'walking', 'movement', 'simple', 'pose'], walking()),
  tpl('mannequin', 'Wooden drawing mannequin', 'intermediate', ['figure', 'mannequin', 'pose', 'anatomy', 'study', 'art'], mannequin()),
  tpl('dancer', 'Modern dancer balancing on one leg', 'intermediate', ['figure', 'dancer', 'dance', 'movement', 'pose', 'stylized'], dancer()),
  tpl('child-reading', 'Child reading a book', 'advanced', ['figure', 'child', 'reading', 'book', 'cosy', 'cute'], childReading()),
];
