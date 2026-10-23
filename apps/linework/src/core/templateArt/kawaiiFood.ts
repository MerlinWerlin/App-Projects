// kawaiiFood template batch (fb-1022b, 22 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Kawaii food, sweets, plants and weather with little faces: round chubby shapes, dot eyes and blush ovals, all of
// our own design (no existing characters, mascots or brands). Overlaps are drawn with occlude.ts so lines behind a
// shape are hidden. The advanced pieces are small scenes that reuse some of the single pieces at a smaller size.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, petal, poly, polar, rotate, rrect, type P } from './draw.ts';
import { clip, outline, region, roundPoly, samplePath, stack, union, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

type Art = { p: string[]; d: string[] };

// ---- helpers --------------------------------------------------------------------------------------------------

type Eyes = 'dot' | 'happy' | 'sleepy' | 'wink' | 'shine';
type Mouth = 'smile' | 'open' | 'cat' | 'o' | 'flat' | 'wavy';
type FaceOpts = { eyes?: Eyes; mouth?: Mouth; r?: number; blush?: boolean };

/** Kawaii face centred between the eyes at (cx, cy); w = half the eye spacing. */
function face(cx: number, cy: number, w: number, o: FaceOpts = {}): Art {
  const eyes = o.eyes ?? 'dot';
  const mouth = o.mouth ?? 'smile';
  const r = o.r ?? Math.max(2.2, Math.min(4, w * 0.12));
  const p: string[] = [];
  const d: string[] = [];
  const arcUp = (x: number) => `M ${f(x - w * 0.28)} ${f(cy + w * 0.08)} Q ${f(x)} ${f(cy - w * 0.3)} ${f(x + w * 0.28)} ${f(cy + w * 0.08)}`;
  const arcDown = (x: number) => `M ${f(x - w * 0.28)} ${f(cy - w * 0.06)} Q ${f(x)} ${f(cy + w * 0.28)} ${f(x + w * 0.28)} ${f(cy - w * 0.06)}`;
  [cx - w, cx + w].forEach((x, i) => {
    if (eyes === 'dot') p.push(circle(x, cy, r));
    else if (eyes === 'happy') p.push(arcUp(x));
    else if (eyes === 'sleepy') p.push(arcDown(x));
    else if (eyes === 'wink') p.push(i === 0 ? circle(x, cy, r) : arcUp(x));
    else p.push(`${ellipse(x, cy, w * 0.2, w * 0.26)} ${circle(x + w * 0.06, cy - w * 0.1, Math.max(1.6, w * 0.05))}`);
  });
  const my = cy + w * 0.42;
  const mw = w * 0.3;
  if (mouth === 'smile') p.push(`M ${f(cx - mw)} ${f(my)} Q ${f(cx)} ${f(my + mw * 1.1)} ${f(cx + mw)} ${f(my)}`);
  else if (mouth === 'open') p.push(`M ${f(cx - mw)} ${f(my)} Q ${f(cx)} ${f(my + mw * 1.8)} ${f(cx + mw)} ${f(my)} Z`);
  else if (mouth === 'cat')
    p.push(`M ${f(cx - mw)} ${f(my)} Q ${f(cx - mw / 2)} ${f(my + mw)} ${f(cx)} ${f(my)} Q ${f(cx + mw / 2)} ${f(my + mw)} ${f(cx + mw)} ${f(my)}`);
  else if (mouth === 'o') p.push(ellipse(cx, my + mw * 0.3, mw * 0.4, mw * 0.5));
  else if (mouth === 'flat') p.push(line(cx - mw * 0.6, my + mw * 0.3, cx + mw * 0.6, my + mw * 0.3));
  else p.push(`M ${f(cx - mw)} ${f(my + mw * 0.3)} Q ${f(cx - mw / 2)} ${f(my - mw * 0.2)} ${f(cx)} ${f(my + mw * 0.3)} Q ${f(cx + mw / 2)} ${f(my + mw * 0.8)} ${f(cx + mw)} ${f(my + mw * 0.3)}`);
  if (o.blush !== false) d.push(`${ellipse(cx - w * 1.6, cy + w * 0.42, w * 0.3, w * 0.18)} ${ellipse(cx + w * 1.6, cy + w * 0.42, w * 0.3, w * 0.18)}`);
  return { p, d };
}

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

/** Teardrop pointing up, tip at (x, y). */
const drop = (x: number, y: number, h: number): string =>
  `M ${f(x)} ${f(y)} C ${f(x + h * 0.45)} ${f(y + h * 0.5)} ${f(x + h * 0.45)} ${f(y + h)} ${f(x)} ${f(y + h)} ` +
  `C ${f(x - h * 0.45)} ${f(y + h)} ${f(x - h * 0.45)} ${f(y + h * 0.5)} ${f(x)} ${f(y)} Z`;

/** Smooth closed curve through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: readonly P[], closed = true): string {
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

/** Closed wobbly round shape: radius r(angle) sampled at n points. */
function blob(cx: number, cy: number, n: number, r: (deg: number) => number, sx = 1): string {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (360 * i) / n;
    const [x, y] = polar(cx, cy, r(a), a);
    pts.push([cx + (x - cx) * sx, y]);
  }
  return smooth(pts);
}

/** Scale a path about (cx, cy). */
const scaleAbout = (d: string, s: number, cx: number, cy: number): string =>
  mapPath(d, { map: (x, y) => [cx + (x - cx) * s, cy + (y - cy) * s], scale: s, rotate: 0, flip: false });

/** Fluffy cloud: overlapping circles on a rounded base (an array layer, drawn as its merged outline). */
function cloud(cx: number, cy: number, w: number, puffs: readonly [number, number, number][] = [[-52, -8, 38], [4, -30, 50], [58, -4, 36]]): string[] {
  const s = w / 200;
  return [rrect(cx - 100 * s, cy - 12 * s, 200 * s, 54 * s, 27 * s), ...puffs.map(([x, y, r]) => circle(cx + x * s, cy + y * s, r * s))];
}

/** Cut bites out of a closed shape: its outline outside the bites plus the bite arcs inside it. */
function bitten(shape: string, bites: readonly string[]): string {
  const b = bites.map(region);
  return `${clip(shape, b)} ${clip(union([...bites]), [region(shape)], 'inside')}`.trim();
}

/** Short tick lines (sprinkles) at [x, y, angle]. */
const ticks = (list: readonly number[][], len = 12): string =>
  list.map(([x, y, a]) => rotate(line(x - len / 2, y, x + len / 2, y), a, x, y)).join(' ');

/** A layered item: a closed silhouette (for hiding what is behind it) and its own lines. */
type Item = { sil: Layer; p?: string[]; d?: string[] };

/** An item with no silhouette of its own (lines only, drawn behind everything listed before it). */
const NONE = '';

/** Draw items front to back: each item's outline and lines are clipped by every item in front of it. */
function layered(items: readonly Item[]): Art {
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (regs.length ? clip(s, regs) : s);
  for (const it of items) {
    for (const s of [it.sil === NONE ? '' : outline(it.sil), ...(it.p ?? [])]) {
      const c = s ? cut(s) : '';
      if (c) p.push(c);
    }
    for (const s of it.d ?? []) {
      const c = s ? cut(s) : '';
      if (c) d.push(c);
    }
    if (it.sil !== NONE) regs.push(region(it.sil));
  }
  return { p, d };
}

const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });

/** Bounding box of an art's main lines. */
function bbox(a: Art): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const d of a.p)
    for (const sub of samplePath(d, 6))
      for (const [x, y] of sub.pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return [x0, y0, x1, y1];
}

/** Scale and move an art so its main lines fit the box (x0, y0)–(x1, y1), centred; anchor 'bottom' sits it on y1. */
function fit(a: Art, x0: number, y0: number, x1: number, y1: number, anchor: 'centre' | 'bottom' = 'centre'): Art {
  const [bx0, by0, bx1, by1] = bbox(a);
  const s = Math.min((x1 - x0) / (bx1 - bx0), (y1 - y0) / (by1 - by0));
  const tx = (x0 + x1) / 2 - ((bx0 + bx1) / 2) * s;
  const ty = anchor === 'bottom' ? y1 - by1 * s : (y0 + y1) / 2 - ((by0 + by1) / 2) * s;
  const m = (d: string) => mapPath(d, { map: (x, y) => [tx + x * s, ty + y * s], scale: s, rotate: 0, flip: false });
  return { p: a.p.map(m), d: a.d.map(m) };
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `kawaii-${id}`,
    name,
    category: 'cute',
    level,
    tags: ['cute', 'kawaii', ...tags],
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- beginner: single food, sweets, plants and weather ---------------------------------------------------------

function peachArt(): Art {
  const body = 'M 200 120 C 150 74 64 112 68 210 C 72 294 136 346 200 346 C 264 346 328 294 332 210 C 336 112 250 74 200 120 Z';
  const leafR = petal(208, 112, 62, 100, 24, 0.5);
  const leafL = petal(194, 114, -58, 70, 17, 0.5);
  const stem = rotate(rrect(194, 84, 12, 38, 6), 8, 200, 112);
  const fc = face(200, 236, 36);
  return join(
    {
      p: stack([leafR, leafL, stem, body]),
      d: [clip(`${line(208, 112, ...polar(208, 112, 82, 62))} ${line(194, 114, ...polar(194, 114, 56, -58))}`, []), 'M 202 126 C 216 150 222 176 216 202'],
    },
    fc,
    { p: [], d: [sparkle(70, 80, 13), sparkle(336, 330, 10), sparkle(60, 330, 8)] },
  );
}

function avocadoArt(): Art {
  const skin = 'M 200 52 C 250 52 272 116 292 176 C 322 262 304 356 200 356 C 96 356 78 262 108 176 C 128 116 150 52 200 52 Z';
  const flesh = scaleAbout(skin, 0.84, 200, 222);
  const pit = circle(200, 262, 52);
  const fc = face(200, 258, 22, { r: 3.4 });
  return join(
    { p: stack([pit, flesh, skin]), d: ['M 166 238 Q 170 222 186 216'] },
    fc,
    { p: [], d: [sparkle(76, 100, 12), sparkle(334, 120, 9), 'M 170 120 Q 176 104 190 100'] },
  );
}

function friedEggArt(): Art {
  const radii = [150, 132, 146, 126, 140, 152, 130, 142, 150, 136, 128, 144];
  const white = blob(200, 210, 12, (a) => radii[Math.round(a / 30) % 12] * 0.92);
  const yolk = circle(214, 200, 62);
  const fc = face(214, 204, 24, { eyes: 'sleepy' });
  const z = (x: number, y: number, s: number) => poly([[x, y], [x + s, y], [x, y + s], [x + s, y + s]], false);
  return join({ p: stack([yolk, white]), d: ['M 178 172 Q 186 152 206 148'] }, fc, {
    p: [z(296, 70, 22), z(330, 44, 15)],
    d: [sparkle(70, 70, 12)],
  });
}

function toastArt(): Art {
  const bread =
    'M 108 334 L 108 176 C 66 168 62 84 136 78 C 166 60 234 60 264 78 C 338 84 334 168 292 176 L 292 334 ' +
    'Q 292 350 276 350 L 124 350 Q 108 350 108 334 Z';
  const crust = scaleAbout(bread, 0.86, 200, 214);
  const butter = rotate(rrect(166, 116, 68, 42, 9), -8, 200, 137);
  const fc = face(200, 246, 34);
  return join(
    { p: stack([butter, crust, bread]), d: [rotate('M 176 128 L 196 128', -8, 200, 137)] },
    fc,
    { p: [], d: [sparkle(52, 60, 12), sparkle(346, 320, 10), sparkle(344, 120, 8)] },
  );
}

function donutArt(): Art {
  const base = circle(200, 206, 138);
  const icing = blob(200, 206, 54, (a) => 112 + 9 * Math.cos(((a + 10) * 9 * Math.PI) / 180));
  const hole = circle(200, 206, 40);
  const icingHole = circle(200, 206, 54);
  const sprinkles = ticks([
    [138, 132, 30], [176, 112, -40], [228, 110, 20], [266, 140, -60], [290, 186, 80], [116, 186, 70], [104, 238, -30],
    [124, 282, 40], [282, 232, 60], [272, 280, -20], [240, 118, 120], [150, 160, 0], [250, 170, 45],
  ]);
  const fc = face(200, 286, 22);
  return join({ p: [base, icing, icingHole, hole], d: [sprinkles, 'M 92 160 Q 104 118 140 96'] }, fc);
}

function macaronArt(): Art {
  const top = 'M 70 190 C 70 96 330 96 330 190 Q 330 206 314 206 L 86 206 Q 70 206 70 190 Z';
  const bottom = 'M 86 244 L 314 244 Q 330 244 330 260 C 330 330 70 330 70 260 Q 70 244 86 244 Z';
  const cream = rrect(58, 198, 284, 54, 27);
  const ruffle = (y: number) => {
    let d = `M 84 ${y}`;
    for (let x = 84; x < 316; x += 12) d += ` Q ${x + 6} ${y + 6} ${x + 12} ${y}`;
    return d;
  };
  const fc = face(200, 156, 40);
  return join(
    {
      p: stack([top, bottom, cream]),
      d: [clip(ruffle(194), [region(top)], 'inside'), clip(ruffle(252), [region(bottom)], 'inside'), 'M 110 176 Q 116 158 132 146'],
    },
    fc,
    { p: [heart(200, 356, 26)], d: [sparkle(60, 80, 12), sparkle(344, 70, 10)] },
  );
}

function lollipopArt(): Art {
  const candy = circle(200, 152, 106);
  const centre = circle(200, 152, 46);
  const stick = rrect(191, 250, 18, 122, 9);
  const bowL = petal(200, 272, -72, 52, 17, 0.6);
  const bowR = petal(200, 272, 72, 52, 17, 0.6);
  const tailL = petal(198, 278, -150, 44, 9, 0.5);
  const tailR = petal(202, 278, 150, 44, 9, 0.5);
  const knot = circle(200, 272, 10);
  const swirl = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45;
    const [a0, a1, a2, a3] = [polar(200, 152, 46, a), polar(200, 152, 68, a + 22), polar(200, 152, 90, a + 40), polar(200, 152, 105, a + 62)];
    return `M ${f(a0[0])} ${f(a0[1])} C ${f(a1[0])} ${f(a1[1])} ${f(a2[0])} ${f(a2[1])} ${f(a3[0])} ${f(a3[1])}`;
  }).join(' ');
  const fc = face(200, 148, 20, { r: 3.2 });
  return join({ p: [...stack([knot, bowL, bowR, tailL, tailR, candy, stick]), centre, swirl], d: [] }, fc, {
    p: [],
    d: [sparkle(70, 70, 12), sparkle(334, 250, 10), sparkle(70, 300, 8)],
  });
}

function iceLollyArt(): Art {
  const body = 'M 128 156 A 72 72 0 0 1 272 156 L 272 270 Q 272 286 256 286 L 144 286 Q 128 286 128 270 Z';
  const bites = [circle(270, 100, 20), circle(280, 132, 17)];
  const stick = rrect(182, 272, 36, 92, 18);
  const dip =
    'M 124 150 C 140 164 158 164 168 152 C 176 142 186 150 186 164 C 186 180 202 180 202 164 C 202 150 216 146 226 156 ' +
    'C 236 166 254 164 276 148';
  const fc = face(200, 218, 30);
  const reg = [region(body)];
  return join(
    {
      p: [bitten(body, bites), clip(stick, reg), clip(clip(dip, reg, 'inside'), bites.map(region))],
      d: ['M 150 120 Q 160 102 178 96'],
    },
    fc,
    { p: [], d: [sparkle(70, 70, 12), sparkle(336, 220, 10), sparkle(76, 310, 9), circle(306, 96, 3), circle(318, 118, 2.5)] },
  );
}

function puddingArt(): Art {
  const body = roundPoly([[138, 148], [262, 148], [300, 304], [100, 304]], 18);
  const cream = [circle(176, 146, 20), circle(224, 146, 20), circle(200, 128, 24)];
  const cherry = circle(200, 96, 15);
  const plate = ellipse(200, 306, 160, 30);
  const caramel =
    'M 110 192 C 130 202 140 202 150 192 C 158 184 166 192 166 204 C 166 220 182 220 182 204 C 182 190 196 188 206 196 ' +
    'C 216 204 230 206 240 196 C 248 188 256 192 256 202 C 256 214 270 214 270 202 C 270 192 280 188 294 192';
  const fc = face(200, 244, 32);
  return join(
    {
      p: [...stack([cherry, cream, body, plate]), clip(caramel, [region(body)], 'inside'), 'M 200 81 C 200 66 206 56 218 50'],
      d: [clip(ellipse(200, 306, 132, 18), [region(body)]), circle(195, 91, 3.5)],
    },
    fc,
    { p: [], d: [sparkle(70, 90, 12), sparkle(330, 100, 10)] },
  );
}

function sproutArt(): Art {
  const rim = rrect(118, 232, 164, 34, 11);
  const pot = 'M 134 266 L 152 352 Q 154 362 164 362 L 236 362 Q 246 362 248 352 L 266 266 Z';
  const leafL = petal(200, 152, -62, 100, 28, 0.55);
  const leafR = petal(200, 150, 58, 116, 32, 0.55);
  const stem = 'M 200 244 C 200 206 194 184 200 150';
  const fc = face(200, 306, 24);
  return join(
    {
      p: stack([leafL, leafR, rim, pot, stem]),
      d: [line(200, 152, ...polar(200, 152, 80, -62)), line(200, 150, ...polar(200, 150, 94, 58)), 'M 150 232 Q 176 220 200 226 Q 226 220 250 232'],
    },
    fc,
    { p: [], d: [sparkle(70, 250, 12), sparkle(330, 220, 10), sparkle(330, 330, 8)] },
  );
}

function snowflakeArt(): Art {
  const c = 200;
  const centre = circle(c, c, 56);
  const parts: string[] = [];
  for (let k = 0; k < 6; k++) {
    parts.push(rotate(rrect(189, 34, 22, 134, 11), 60 * k, c, c));
    parts.push(rotate(rotate(rrect(194, 60, 12, 48, 6), 42, 200, 104), 60 * k, c, c));
    parts.push(rotate(rotate(rrect(194, 60, 12, 48, 6), -42, 200, 104), 60 * k, c, c));
  }
  const fc = face(c, c - 4, 22);
  const dots = Array.from({ length: 6 }, (_, k) => circle(...polar(c, c, 150, 30 + 60 * k), 4)).join(' ');
  return join({ p: stack([centre, parts]), d: [dots] }, fc, { p: [], d: [sparkle(52, 52, 11), sparkle(350, 352, 10)] });
}

function cookieArt(): Art {
  const cookie = blob(200, 206, 20, (a) => 142 + 5 * Math.sin((a * 5 * Math.PI) / 180) + 3 * Math.cos((a * 3 * Math.PI) / 180));
  const bites = [circle(304, 98, 30), circle(330, 132, 26), circle(276, 76, 22)];
  const chip = (x: number, y: number, a: number) =>
    roundPoly([polar(x, y, 13, a), polar(x, y, 13, a + 120), polar(x, y, 13, a + 240)], 5);
  const chips = [[128, 150, 10], [200, 112, 40], [104, 236, 70], [146, 304, 20], [250, 304, 50], [296, 226, 0], [246, 158, 80], [200, 330, 30]]
    .map(([x, y, a]) => chip(x, y, a))
    .join(' ');
  const fc = face(200, 214, 34);
  return join(
    { p: [bitten(cookie, bites), chips], d: [circle(352, 92, 4), circle(364, 112, 3), circle(340, 70, 3)] },
    fc,
    { p: [], d: ['M 100 140 Q 110 112 136 96', circle(160, 250, 2), circle(250, 260, 2), circle(230, 140, 2), circle(170, 150, 2)] },
  );
}

function thundercloudArt(): Art {
  const cl = cloud(200, 186, 250, [[-58, -16, 44], [6, -40, 58], [64, -10, 42]]);
  const bolt = roundPoly([[214, 226], [172, 300], [204, 300], [184, 366], [244, 280], [212, 280], [236, 226]], 4);
  const fc = face(200, 196, 30, { mouth: 'wavy' });
  return join(
    { p: stack([cl, bolt]), d: [] },
    fc,
    {
      p: [`M 158 176 L 180 184 M 242 176 L 220 184`, drop(112, 262, 28), drop(290, 256, 28), drop(132, 322, 22), drop(306, 316, 22)],
      d: [sparkle(60, 70, 10), sparkle(344, 70, 12)],
    },
  );
}

function umbrellaArt(): Art {
  const xs = [330, 286.7, 243.3, 200, 156.7, 113.3, 70];
  let canopy = 'M 70 200 C 70 112 136 62 200 62 C 264 62 330 112 330 200';
  for (let i = 1; i < xs.length; i++) canopy += ` Q ${f((xs[i - 1] + xs[i]) / 2)} 180 ${f(xs[i])} 200`;
  canopy += ' Z';
  const seams = 'M 113.3 200 C 116 140 150 84 200 63 M 286.7 200 C 284 140 250 84 200 63';
  const fc = face(200, 140, 28);
  const handle = 'M 200 200 L 200 322 A 22 22 0 0 1 156 322';
  return join(
    { p: [canopy, handle, line(200, 62, 200, 44), circle(200, 39, 5)], d: [clip(seams, [region(ellipse(200, 152, 66, 40))])] },
    fc,
    {
      p: [drop(60, 236, 26), drop(330, 236, 26), drop(96, 300, 22), drop(300, 300, 22)],
      d: ['M 100 360 Q 200 344 300 360', 'M 140 372 Q 200 364 260 372', sparkle(60, 80, 10), sparkle(344, 84, 10)],
    },
  );
}

// ---- intermediate ---------------------------------------------------------------------------------------------

function sushiRollsArt(): Art {
  const maki = (x: number, y: number, r: number, ry: number, h: number, eyes: Eyes): Item => {
    const sil = `M ${f(x - r)} ${f(y)} L ${f(x - r)} ${f(y + h)} A ${f(r)} ${f(ry)} 0 0 0 ${f(x + r)} ${f(y + h)} L ${f(x + r)} ${f(y)} A ${f(r)} ${f(ry)} 0 0 0 ${f(x - r)} ${f(y)} Z`;
    const fc = face(x, y + h * 0.5, r * 0.3, { eyes, r: 3.2 });
    const grains = [[-0.6, 0], [0.6, 0.05], [0, -0.62], [0.05, 0.6], [-0.42, -0.42], [0.44, -0.38], [-0.4, 0.42], [0.42, 0.4]]
      .map(([u, v]) => {
        const gx = x + u * r * 0.97;
        const gy = y + v * ry * 0.97;
        return rotate(`M ${f(gx - 4)} ${f(gy)} Q ${f(gx)} ${f(gy - 3)} ${f(gx + 4)} ${f(gy)}`, u * 40, gx, gy);
      })
      .join(' ');
    return {
      sil,
      p: [`M ${f(x - r)} ${f(y)} A ${f(r)} ${f(ry)} 0 0 0 ${f(x + r)} ${f(y)}`, ellipse(x, y, r * 0.84, ry * 0.8), ellipse(x, y, r * 0.34, ry * 0.4), ...fc.p],
      d: [grains, `M ${f(x - r * 0.12)} ${f(y - ry * 0.15)} L ${f(x + r * 0.14)} ${f(y + ry * 0.12)}`, ...fc.d],
    };
  };
  const board = rrect(36, 262, 328, 52, 14);
  const legs = [rrect(70, 312, 44, 28, 6), rrect(286, 312, 44, 28, 6)];
  const chop = [rotate(rrect(40, 80, 230, 10, 5), -14, 155, 85), rotate(rrect(60, 100, 230, 10, 5), -10, 175, 105)];
  const art = layered([
    maki(200, 210, 64, 24, 64, 'dot'),
    maki(118, 150, 60, 22, 60, 'happy'),
    maki(282, 150, 60, 22, 60, 'wink'),
    { sil: board, d: ['M 52 296 L 348 296'] },
    { sil: legs[0] },
    { sil: legs[1] },
    { sil: chop[0] },
    { sil: chop[1] },
  ]);
  return join(art, { p: [], d: [sparkle(356, 50, 10), sparkle(44, 200, 9), circle(352, 196, 3)] });
}

function dumplingsArt(): Art {
  const dumpling = (x: number, y: number, w: number, eyes: Eyes): Item => {
    const sil =
      `M ${f(x - w)} ${f(y)} C ${f(x - w * 1.05)} ${f(y - w * 0.9)} ${f(x - w * 0.5)} ${f(y - w * 1.35)} ${f(x)} ${f(y - w * 1.35)} ` +
      `C ${f(x + w * 0.5)} ${f(y - w * 1.35)} ${f(x + w * 1.05)} ${f(y - w * 0.9)} ${f(x + w)} ${f(y)} Q ${f(x)} ${f(y + w * 0.25)} ${f(x - w)} ${f(y)} Z`;
    const top = y - w * 1.33;
    const pleats = [-0.42, -0.18, 0.18, 0.42]
      .map((u) => `M ${f(x + u * w * 0.3)} ${f(top + 2)} Q ${f(x + u * w * 0.9)} ${f(top + w * 0.2)} ${f(x + u * w * 1.1)} ${f(top + w * 0.42)}`)
      .join(' ');
    const fc = face(x, y - w * 0.5, w * 0.32, { eyes, r: 3.2 });
    return { sil, p: fc.p, d: [pleats, ...fc.d] };
  };
  const band = 'M 60 252 A 140 36 0 0 0 340 252 L 328 326 A 128 30 0 0 1 72 326 Z';
  const rimBack = 'M 60 252 A 140 36 0 0 1 340 252';
  const rimInner = 'M 74 252 A 126 26 0 0 1 326 252';
  const d1 = dumpling(140, 272, 58, 'dot');
  const d2 = dumpling(262, 270, 58, 'happy');
  const d3 = dumpling(200, 244, 60, 'sleepy');
  const art = layered([
    { sil: band, d: [clip('M 66 286 A 134 34 0 0 0 334 286', [region(band)], 'inside'), clip('M 70 306 A 130 32 0 0 0 330 306', [region(band)], 'inside')] },
    d1,
    d2,
    d3,
    { sil: NONE, p: [rimBack, rimInner] },
  ]);
  const steam = 'M 150 116 C 140 100 160 92 150 74 M 200 96 C 190 80 210 72 200 54 M 250 116 C 240 100 260 92 250 74';
  return join(art, { p: [], d: [steam, sparkle(60, 120, 12), sparkle(344, 110, 10), 'M 30 362 L 370 362'] });
}

function noodleBowlArt(): Art {
  const bowl = 'M 48 206 L 352 206 C 352 296 290 344 200 344 C 110 344 48 296 48 206 Z';
  const foot = rrect(140, 334, 120, 26, 8);
  const mound = 'M 64 216 C 74 150 140 126 200 128 C 260 126 326 150 336 216 Z';
  const egg = rotate(ellipse(124, 168, 42, 32), -14, 124, 168);
  const yolk = rotate(ellipse(128, 168, 20, 15), -14, 124, 168);
  const nori = rotate(rrect(250, 80, 56, 80, 6), 12, 278, 120);
  const chop = [rotate(rrect(228, 30, 12, 190, 6), 24, 234, 125), rotate(rrect(256, 34, 12, 190, 6), 30, 262, 129)];
  let noodles = '';
  for (const y of [150, 170, 190, 210]) {
    noodles += ` M 60 ${y}`;
    for (let x = 60; x < 340; x += 28) noodles += ` Q ${x + 7} ${y - 8} ${x + 14} ${y} Q ${x + 21} ${y + 8} ${x + 28} ${y}`;
  }
  const onions = [[180, 146], [204, 158], [226, 144], [168, 176]].map(([x, y]) => `${circle(x, y, 7)} ${circle(x, y, 2.5)}`).join(' ');
  const fc = face(200, 262, 32);
  const art = layered([
    { sil: bowl, d: [clip('M 48 226 L 352 226', [region(bowl)], 'inside'), ...fc.d], p: fc.p },
    { sil: egg, p: [yolk] },
    { sil: chop[0] },
    { sil: chop[1] },
    { sil: nori, d: [line(266, 92, 256, 150)] },
    { sil: mound, d: [clip(noodles.trim(), [region(mound)], 'inside'), onions] },
    { sil: foot },
  ]);
  const steam = 'M 70 110 C 60 94 80 86 70 68 M 100 96 C 90 80 110 72 100 54 M 340 100 C 330 84 350 76 340 58';
  return join(art, { p: [], d: [steam, circle(110, 300, 4), circle(290, 300, 4), circle(200, 320, 4)] });
}

function pizzaArt(): Art {
  const slice = roundPoly([[90, 112], [310, 112], [200, 362]], 14);
  const crust = rrect(74, 84, 252, 48, 24);
  const pep = (x: number, y: number, r: number) => [circle(x, y, r), `${circle(x - r * 0.35, y - r * 0.2, 1.8)} ${circle(x + r * 0.3, y + r * 0.3, 1.8)}`];
  const peps = [pep(130, 158, 17), pep(270, 160, 17), pep(200, 270, 15)];
  const fc = face(200, 188, 28);
  const sil = slice;
  const art = layered([
    { sil: crust, d: ['M 110 104 L 124 100 M 160 98 L 176 96 M 222 96 L 238 98 M 276 100 L 290 104'] },
    { sil, p: [...peps.map((x) => x[0]), ...fc.p], d: [...peps.map((x) => x[1]), ...fc.d] },
  ]);
  const olives = `${circle(158, 236, 8)} ${circle(158, 236, 3)} ${circle(232, 224, 8)} ${circle(232, 224, 3)}`;
  return join(art, {
    p: [olives],
    d: [sparkle(52, 200, 11), sparkle(346, 220, 10), sparkle(330, 330, 8), `${circle(176, 300, 4)} ${circle(214, 318, 3)} ${circle(236, 220, 3)}`],
  });
}

function watermelonArt(): Art {
  const half = 'M 60 150 A 140 140 0 0 0 340 150 Z';
  const wedge = 'M 100 222 L 170 343.2 A 140 140 0 0 1 30 343.2 Z';
  const seed = (x: number, y: number, a: number) => rotate(drop(x, y - 6, 12), a, x, y);
  const seedsHalf = [[110, 176, 20], [290, 176, -20], [130, 232, 30], [270, 232, -30], [200, 262, 0], [160, 166, 10], [240, 166, -10]]
    .map(([x, y, a]) => seed(x, y, a))
    .join(' ');
  const seedsWedge = [[84, 276, 10], [116, 274, -10], [76, 322, 0], [124, 320, 0]].map(([x, y, a]) => seed(x, y, a)).join(' ');
  const fh = face(200, 196, 30, { eyes: 'happy', mouth: 'open' });
  const fw = face(100, 300, 15, { r: 3 });
  const art = layered([
    { sil: wedge, p: ['M 160 325.9 A 120 120 0 0 1 40 325.9', seedsWedge, ...fw.p], d: fw.d },
    { sil: half, p: ['M 78 150 A 122 122 0 0 0 322 150', seedsHalf, ...fh.p], d: fh.d },
  ]);
  return join(art, { p: [], d: [sparkle(340, 60, 12), sparkle(60, 70, 10), sparkle(330, 320, 11)] });
}

function chocolateArt(): Art {
  const bites = [circle(282, 60, 26), circle(258, 44, 18)];
  const choc = rrect(116, 56, 168, 300, 18);
  const squares = [[132, 72], [208, 72], [132, 142], [208, 142], [132, 212], [208, 212]].map(([x, y]) => rrect(x, y, 60, 56, 8)).join(' ');
  const zig: P[] = [];
  for (let i = 0; i <= 8; i++) zig.push([106 + i * 23.5, i % 2 === 0 ? 232 : 244]);
  const wrapper = roundPoly([...zig, [294, 362], [106, 362]], 4);
  const fc = face(200, 296, 30);
  const art = layered([
    { sil: wrapper, p: fc.p, d: [...fc.d, clip('M 106 340 L 294 340', [region(wrapper)], 'inside'), heart(200, 254, 18)] },
    { sil: NONE, p: [clip(bitten(choc, bites), []), clip(squares, bites.map(region))], d: ['M 142 90 L 142 112'] },
  ]);
  return join(art, { p: [], d: [sparkle(70, 80, 12), sparkle(334, 160, 10), sparkle(70, 290, 9), circle(318, 60, 3), circle(300, 30, 2.5)] });
}

function veggiePalsArt(): Art {
  const carrot = 'M 72 162 Q 130 128 188 162 Q 176 270 136 358 Q 130 370 124 358 Q 84 270 72 162 Z';
  const cLeaves = [-28, 0, 28].map((a) => petal(130, 150, a, 84, 15, 0.5));
  const radish =
    'M 272 182 C 332 182 354 238 338 282 C 326 314 298 332 278 348 L 272 374 L 266 348 C 246 332 218 314 206 282 C 190 238 212 182 272 182 Z';
  const rLeaves = [petal(266, 190, -26, 96, 24), petal(280, 190, 20, 92, 22)];
  const fcC = face(130, 208, 22, { eyes: 'happy' });
  const fcR = face(272, 256, 24);
  const art = layered([
    { sil: carrot, p: fcC.p, d: [...fcC.d, 'M 92 252 L 106 250 M 152 282 L 164 280 M 100 300 L 112 302 M 150 320 L 140 318'] },
    { sil: radish, p: fcR.p, d: [...fcR.d, 'M 230 300 Q 240 306 250 304 M 296 316 Q 306 312 312 306'] },
    ...cLeaves.map((l) => ({ sil: l })),
    ...rLeaves.map((l) => ({ sil: l, d: [] })),
  ]);
  return join(art, {
    p: [heart(200, 110, 30)],
    d: [line(266, 190, ...polar(266, 190, 76, -26)), line(280, 190, ...polar(280, 190, 72, 20)), sparkle(40, 120, 10), sparkle(360, 120, 10), sparkle(200, 50, 8)],
  });
}

function coinPlantArt(): Art {
  const rim = rrect(112, 238, 176, 34, 12);
  const pot = 'M 128 272 L 146 356 Q 148 366 158 366 L 242 366 Q 252 366 254 356 L 272 272 Z';
  const leaves: [number, number, number][] = [[200, 176, 30], [118, 160, 36], [284, 150, 38], [162, 96, 32], [246, 78, 34], [80, 228, 24], [322, 222, 26]];
  const items: Item[] = [
    { sil: rim },
    { sil: pot },
    ...leaves.map(([x, y, r]) => {
      const [vx, vy] = [x - 200, y - 240];
      const len = Math.hypot(vx, vy);
      const [ux, uy] = [vx / len, vy / len];
      const deg = (Math.atan2(ux, -uy) * 180) / Math.PI;
      const bx = x - ux * r;
      const by = y - uy * r;
      return { sil: petal(bx, by, deg, r * 2, r * 0.78, 0.75), d: [line(bx, by, x + ux * r * 0.6, y + uy * r * 0.6)] };
    }),
    { sil: NONE, p: leaves.map(([x, y, r]) => { const l = Math.hypot(x - 200, y - 240); const ex = x - ((x - 200) / l) * r; const ey = y - ((y - 240) / l) * r; return `M 200 246 Q ${f((200 + ex) / 2 + (x < 200 ? -10 : x > 200 ? 10 : 0))} ${f((240 + ey) / 2 + 10)} ${f(ex)} ${f(ey)}`; }) },
  ];
  const fc = face(200, 312, 28);
  return join(layered(items), fc, { p: [], d: [sparkle(48, 80, 11), sparkle(350, 330, 9), sparkle(48, 330, 8)] });
}

function coolSunArt(): Art {
  const c: P = [200, 206];
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = i * 36;
    return roundPoly([polar(c[0], c[1], 112, a - 13), polar(c[0], c[1], 168, a), polar(c[0], c[1], 112, a + 13)], 6);
  });
  const disc = circle(c[0], c[1], 110);
  const lensL = rrect(122, 166, 70, 46, 20);
  const lensR = rrect(208, 166, 70, 46, 20);
  const art = layered([
    { sil: lensL, d: ['M 140 178 L 152 172 M 140 192 L 162 176'] },
    { sil: lensR, d: ['M 226 178 L 238 172 M 226 192 L 248 176'] },
    {
      sil: disc,
      p: ['M 192 182 Q 200 174 208 182', clip('M 122 180 L 92 172 M 278 180 L 308 172', [region(disc)], 'inside'), 'M 160 246 Q 200 290 240 246 Z'],
      d: [`${ellipse(142, 236, 12, 7)} ${ellipse(258, 236, 12, 7)}`, 'M 186 262 Q 200 274 214 262'],
    },
    { sil: rays },
  ]);
  return join(art, { p: [], d: [sparkle(42, 42, 10), sparkle(362, 46, 9), sparkle(360, 360, 10)] });
}

function rainbowArt(): Art {
  const cx = 200;
  const cy = 276;
  const radii = [150, 124, 98, 72];
  const arcs = radii.map((r) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`).join(' ');
  const cl = cloud(98, 286, 150);
  const cr = cloud(302, 286, 150, [[-58, -4, 36], [-4, -30, 50], [52, -8, 38]]);
  const fl = face(96, 290, 18, { eyes: 'happy' });
  const fr = face(302, 290, 18, { eyes: 'wink', mouth: 'open' });
  const art = layered([
    { sil: cl, p: fl.p, d: fl.d },
    { sil: cr, p: fr.p, d: fr.d },
    { sil: NONE, p: [arcs, `M ${cx - 150} ${cy} L ${cx - 72} ${cy} M ${cx + 72} ${cy} L ${cx + 150} ${cy}`] },
  ]);
  return join(art, {
    p: [heart(200, 236, 30)],
    d: [sparkle(60, 90, 12), sparkle(340, 92, 10), sparkle(200, 70, 9), drop(80, 340, 16), drop(118, 352, 14), drop(286, 344, 16), drop(324, 350, 14)],
  });
}

function iceCreamArt(): Art {
  const cone = roundPoly([[132, 226], [268, 226], [200, 374]], 10);
  const lower = [circle(200, 200, 70), circle(150, 238, 20), circle(186, 248, 22), circle(226, 246, 21), circle(258, 234, 18)];
  const upper = [circle(200, 124, 56), circle(166, 160, 16), circle(234, 158, 16)];
  const cherry = circle(208, 64, 15);
  let waffle = '';
  for (let k = -5; k <= 6; k++) waffle += ` M ${f(120 + k * 26)} 220 L ${f(220 + k * 26)} 380 M ${f(280 - k * 26)} 220 L ${f(180 - k * 26)} 380`;
  const fl = face(200, 204, 28);
  const fu = face(200, 120, 22, { eyes: 'happy', mouth: 'cat' });
  const art = layered([
    { sil: cherry, d: [circle(203, 59, 3.5)] },
    { sil: upper, p: fu.p, d: [...fu.d, ticks([[160, 98, 30], [238, 96, -40], [214, 82, 70], [176, 140, -20], [244, 136, 50]], 10)] },
    { sil: lower, p: fl.p, d: fl.d },
    { sil: cone, d: [clip(waffle.trim(), [region(cone)], 'inside')] },
  ]);
  return join(art, { p: ['M 208 49 C 208 38 214 30 224 26'], d: [sparkle(70, 80, 12), sparkle(334, 120, 10), sparkle(320, 320, 9), sparkle(78, 300, 8)] });
}

// ---- advanced: little scenes -----------------------------------------------------------------------------------

function bentoArt(): Art {
  const box = rrect(28, 64, 344, 264, 30);
  const inner = rrect(44, 80, 312, 232, 20);
  const dividers = 'M 164 80 L 164 312 M 176 80 L 176 312 M 176 190 L 356 190 M 176 202 L 356 202';
  // rice with a face and a pickled plum
  const plum = circle(104, 124, 15);
  const fRice = face(104, 196, 26, { eyes: 'happy', mouth: 'open' });
  const grains = [[62, 100], [140, 100], [70, 160], [140, 150], [60, 250], [148, 260], [80, 292], [130, 296], [104, 270], [66, 210], [146, 214], [120, 160]]
    .map(([x, y], i) => rotate(`M ${x - 5} ${y} Q ${x} ${y - 4} ${x + 5} ${y}`, (i * 37) % 90 - 45, x, y))
    .join(' ');
  // rolled egg slices with a separator leaf
  const roll = (x: number): Item => {
    const sil = rrect(x, 96, 48, 80, 12);
    return { sil, p: [rrect(x + 8, 106, 32, 60, 8)], d: [rrect(x + 16, 118, 16, 36, 6)] };
  };
  const leafSep = roundPoly([[332, 92], [348, 110], [340, 116], [348, 134], [340, 140], [348, 158], [340, 164], [348, 182], [324, 182], [322, 92]], 3);
  const fRoll = face(212, 132, 9, { r: 2.4, blush: false });
  // broccoli, tomatoes and a sausage
  const broc = [circle(214, 236, 18), circle(240, 226, 20), circle(264, 240, 17), circle(236, 250, 18)];
  const brocStem = 'M 226 262 L 220 296 Q 236 302 252 296 L 246 262 Z';
  const tomato = (x: number, y: number, eyes: Eyes): Item => {
    const fc = face(x, y + 4, 10, { eyes, r: 2.6 });
    return { sil: circle(x, y, 26), p: [poly([polar(x, y - 22, 9, 0), polar(x, y - 22, 3, 60), polar(x, y - 22, 9, 120), polar(x, y - 22, 3, 180), polar(x, y - 22, 9, 240), polar(x, y - 22, 3, 300)]), ...fc.p], d: fc.d };
  };
  const sausage = rotate(rrect(276, 268, 74, 32, 16), -12, 313, 284);
  const sausageCuts = rotate('M 296 272 L 290 296 M 312 270 L 306 298 M 328 272 L 322 296', -12, 313, 284);
  const art = layered([
    roll(186),
    roll(232),
    roll(278),
    { sil: leafSep, d: ['M 330 100 L 330 176'] },
    tomato(312, 234, 'dot'),
    tomato(204, 286, 'happy'),
    { sil: sausage, d: [sausageCuts] },
    { sil: broc, d: ['M 226 232 Q 232 226 238 232 M 246 244 Q 252 238 258 244'] },
    { sil: brocStem },
    { sil: plum, d: ['M 98 116 Q 104 110 110 116'] },
    { sil: inner, p: [dividers], d: [grains] },
    { sil: box },
  ]);
  const chop = `${rrect(52, 346, 300, 10, 5)} ${rrect(64, 364, 300, 10, 5)}`;
  return join(art, fRice, fRoll, {
    p: [chop],
    d: [sparkle(40, 36, 10), sparkle(360, 36, 10), sparkle(200, 30, 8), heart(104, 290, 18)],
  });
}

function dessertPartyArt(): Art {
  const tier1 = rrect(146, 238, 108, 92, 14);
  const tier2 = rrect(164, 180, 72, 62, 12);
  const drips1 = 'M 146 262 C 156 270 162 270 166 262 C 170 254 176 266 180 276 C 186 286 194 276 196 264 C 200 256 206 268 214 270 C 224 272 228 258 234 262 C 240 268 246 270 254 262';
  const drips2 = 'M 164 202 C 172 210 178 210 182 202 C 186 196 192 208 198 212 C 206 216 210 202 216 204 C 222 206 228 212 236 202';
  const candle = rrect(193, 140, 14, 42, 4);
  const flame = 'M 200 108 C 212 122 212 136 200 138 C 188 136 188 122 200 108 Z';
  const fc = face(200, 290, 22);
  const cake = layered([
    { sil: flame },
    { sil: candle, d: ['M 193 156 L 207 150 M 193 170 L 207 164'] },
    { sil: tier2, p: [clip(drips2, [region(tier2)], 'inside')] },
    { sil: tier1, p: [clip(drips1, [region(tier1)], 'inside'), ...fc.p], d: fc.d },
  ]);
  const cone = fit(iceCreamArt(), 54, 150, 144, 330, 'bottom');
  const pud = fit(puddingArt(), 262, 210, 374, 330, 'bottom');
  // bunting and a table with a scalloped cloth
  const sag = (x: number) => 46 + 40 * Math.sin((Math.PI * (x - 20)) / 360);
  const flags: string[] = [];
  for (let x = 44; x <= 356; x += 39) {
    const y = sag(x);
    flags.push(roundPoly([[x - 13, sag(x - 13)], [x + 13, sag(x + 13)], [x, y + 30]], 3));
  }
  const string = `M 20 ${f(sag(20))} Q 200 ${f(sag(200) * 2 - (sag(20) + sag(380)) / 2)} 380 ${f(sag(380))}`;
  let cloth = 'M 20 334';
  for (let x = 20; x < 380; x += 40) cloth += ` Q ${x + 20} 366 ${x + 40} 334`;
  return join(cone, pud, cake, {
    p: [line(20, 332, 380, 332), cloth, string, ...flags],
    d: [
      flags.filter((_, i) => i % 2 === 0).map((_, i) => circle(44 + i * 78, sag(44 + i * 78) + 12, 3)).join(' '),
      sparkle(130, 120, 10),
      sparkle(268, 140, 9),
      sparkle(330, 170, 8),
      heart(250, 188, 16),
      circle(150, 160, 3),
      'M 40 352 L 40 380 M 360 352 L 360 380',
    ],
  });
}

function veggieGardenArt(): Art {
  const sun = circle(326, 74, 30);
  const sunRays = Array.from({ length: 8 }, (_, i) => line(...polar(326, 74, 38, i * 45), ...polar(326, 74, 50, i * 45))).join(' ');
  const fSun = face(326, 72, 11, { eyes: 'happy', r: 2.6 });
  const cl = cloud(84, 72, 110);
  const fence: Item[] = [];
  for (let x = 40; x <= 360; x += 40) fence.push({ sil: roundPoly([[x - 14, 240], [x - 14, 150], [x, 134], [x + 14, 150], [x + 14, 240]], 4) });
  const rails = 'M 20 170 L 380 170 M 20 212 L 380 212';
  const backSoil = 'M 20 250 Q 110 228 200 246 Q 290 228 380 250 L 380 300 L 20 300 Z';
  const frontSoil = 'M 20 330 C 80 304 140 304 200 316 C 260 304 320 304 380 330 L 380 380 L 20 380 Z';
  const carrotTop = (x: number, gy: number, eyes: Eyes): Item[] => {
    const fc = face(x, gy - 16, 10, { eyes, r: 2.6 });
    return [
      { sil: `M ${x - 25} ${gy + 12} C ${x - 27} ${gy - 62} ${x + 27} ${gy - 62} ${x + 25} ${gy + 12} Z`, p: fc.p, d: fc.d },
      ...[-26, 0, 26].map((a) => ({ sil: petal(x, gy - 42, a, 48, 9, 0.5) })),
    ];
  };
  const radishTop = (x: number, gy: number): Item[] => {
    const fc = face(x, gy - 22, 11, { mouth: 'cat', r: 2.6 });
    return [
      { sil: circle(x, gy - 18, 32), p: fc.p, d: fc.d },
      { sil: petal(x - 4, gy - 48, -22, 56, 14) },
      { sil: petal(x + 6, gy - 48, 24, 52, 13) },
    ];
  };
  const pumpkin = [ellipse(296, 330, 44, 36), ellipse(264, 332, 30, 32), ellipse(328, 332, 30, 32)];
  const fPump = face(296, 330, 14, { eyes: 'happy', mouth: 'open' });
  const sproutAt = (x: number, gy: number): string =>
    `M ${x} ${gy} C ${x} ${gy - 10} ${x - 2} ${gy - 16} ${x} ${gy - 24} ${petal(x, gy - 22, -60, 22, 7)} ${petal(x, gy - 22, 60, 24, 7)}`;
  const art = layered([
    { sil: pumpkin, p: [...fPump.p, 'M 296 296 C 294 284 300 276 308 272'], d: [...fPump.d, clip('M 280 302 Q 272 330 280 360 M 312 302 Q 320 330 312 360', [region(ellipse(296, 330, 44, 36))], 'inside')] },
    { sil: frontSoil, d: ['M 60 350 L 70 350 M 120 360 L 132 360 M 200 346 L 210 346 M 160 372 L 170 372'] },
    ...carrotTop(70, 300, 'dot'),
    ...radishTop(150, 300),
    ...carrotTop(228, 300, 'sleepy'),
    { sil: backSoil, p: [sproutAt(40, 250), sproutAt(196, 244), sproutAt(250, 238)], d: ['M 40 270 L 52 270 M 120 280 L 130 280 M 300 276 L 312 276 M 200 266 L 210 266'] },
    ...radishTop(310, 240),
    ...fence,
    { sil: NONE, p: [rails] },
  ]);
  return join(art, { p: [sun, sunRays, outline(cl)], d: [] }, fSun, { p: [], d: [sparkle(190, 60, 10), sparkle(250, 100, 8), sparkle(150, 110, 7)] });
}

function weatherFriendsArt(): Art {
  return join(
    fit(coolSunArt(), 30, 30, 176, 176),
    fit(thundercloudArt(), 206, 30, 370, 176),
    fit(snowflakeArt(), 150, 150, 230, 230),
    fit(rainbowArt(), 22, 226, 226, 366),
    fit(umbrellaArt(), 236, 200, 368, 364),
    { p: [], d: [sparkle(192, 40, 8), sparkle(34, 200, 7), sparkle(370, 186, 7), circle(250, 200, 3), 'M 24 380 L 376 380'] },
  );
}

function appleTreeArt(): Art {
  const canopy = [circle(200, 132, 92), circle(116, 168, 66), circle(284, 168, 66), circle(150, 96, 60), circle(250, 96, 60), circle(200, 196, 70)];
  const trunk = 'M 172 236 L 168 312 C 166 326 150 334 136 338 L 264 338 C 250 334 234 326 232 312 L 228 236 Z';
  const fTree = face(200, 152, 30, { eyes: 'happy', mouth: 'open' });
  const apple = (x: number, y: number, r: number, eyes: Eyes): Item => {
    const sil = `M ${f(x)} ${f(y - r * 0.7)} C ${f(x + r * 0.5)} ${f(y - r * 1.1)} ${f(x + r * 1.15)} ${f(y - r * 0.8)} ${f(x + r)} ${f(y + r * 0.1)} C ${f(x + r * 0.9)} ${f(y + r * 0.9)} ${f(x + r * 0.3)} ${f(y + r * 1.05)} ${f(x)} ${f(y + r * 0.85)} C ${f(x - r * 0.3)} ${f(y + r * 1.05)} ${f(x - r * 0.9)} ${f(y + r * 0.9)} ${f(x - r)} ${f(y + r * 0.1)} C ${f(x - r * 1.15)} ${f(y - r * 0.8)} ${f(x - r * 0.5)} ${f(y - r * 1.1)} ${f(x)} ${f(y - r * 0.7)} Z`;
    const fc = face(x, y + r * 0.05, r * 0.36, { eyes, r: 2.4, blush: r > 18 });
    return { sil, p: [`M ${f(x)} ${f(y - r * 0.7)} L ${f(x + 2)} ${f(y - r * 1.15)}`, ...fc.p], d: [petal(x + 3, y - r * 1.0, 60, r * 0.8, r * 0.25), ...fc.d] };
  };
  const basket = 'M 270 316 L 360 316 L 350 368 Q 348 374 342 374 L 288 374 Q 282 374 280 368 Z';
  const art = layered([
    apple(108, 206, 18, 'dot'),
    apple(290, 210, 18, 'wink'),
    apple(150, 70, 16, 'happy'),
    apple(258, 64, 16, 'dot'),
    apple(320, 132, 16, 'sleepy'),
    apple(78, 136, 16, 'happy'),
    apple(200, 236, 16, 'dot'),
    { sil: basket, d: [clip('M 274 336 L 356 336 M 278 354 L 352 354 M 296 316 L 294 374 M 316 316 L 316 374 M 336 316 L 338 374', [region(basket)], 'inside')] },
    apple(296, 306, 16, 'happy'),
    apple(332, 304, 16, 'dot'),
    apple(70, 350, 20, 'sleepy'),
    { sil: canopy, p: fTree.p, d: [...fTree.d, 'M 110 130 Q 120 116 136 112 M 270 200 Q 286 196 296 184'] },
    { sil: trunk, d: ['M 190 268 Q 196 280 192 296 M 212 250 Q 206 262 210 276'] },
  ]);
  const tufts = [30, 120, 236, 370]
    .map((x) => `M ${x - 8} 340 Q ${x - 6} 330 ${x - 10} 322 M ${x} 340 L ${x} 318 M ${x + 8} 340 Q ${x + 6} 330 ${x + 10} 322`)
    .join(' ');
  const daisy = (x: number, y: number) => `${circle(x, y, 5)} ${[0, 72, 144, 216, 288].map((a) => petal(...polar(x, y, 5, a), a, 10, 4)).join(' ')}`;
  return join(art, {
    p: [clip('M 20 340 L 380 340', [region(trunk), region(basket), region(apple(70, 350, 20, 'dot').sil as string)])],
    d: [tufts, daisy(160, 362), daisy(240, 366), daisy(100, 366), sparkle(40, 40, 10), sparkle(360, 40, 9), sparkle(366, 230, 8)],
  });
}

// ---- catalogue ------------------------------------------------------------------------------------------------

export const kawaiiFood: Template[] = [
  // beginner
  tpl('peach', 'Happy little peach', 'beginner', ['peach', 'fruit', 'food', 'summer', 'sweet'], peachArt()),
  tpl('avocado', 'Smiling avocado half', 'beginner', ['avocado', 'fruit', 'food', 'veg', 'healthy'], avocadoArt()),
  tpl('fried-egg', 'Sleepy fried egg', 'beginner', ['egg', 'breakfast', 'food', 'sleepy', 'kitchen'], friedEggArt()),
  tpl('toast', 'Happy buttered toast', 'beginner', ['toast', 'bread', 'butter', 'breakfast', 'food'], toastArt()),
  tpl('donut', 'Sweet sprinkle donut', 'beginner', ['donut', 'doughnut', 'sprinkles', 'sweets', 'food', 'sweet'], donutArt()),
  tpl('macaron', 'Smiling macaron', 'beginner', ['macaron', 'biscuit', 'sweets', 'dessert', 'food', 'love'], macaronArt()),
  tpl('lollipop', 'Happy swirl lollipop', 'beginner', ['lollipop', 'candy', 'sweets', 'bow', 'party', 'birthday'], lollipopArt()),
  tpl('ice-lolly', 'Chubby ice lolly', 'beginner', ['ice-lolly', 'popsicle', 'ice-cream', 'summer', 'sweets'], iceLollyArt()),
  tpl('pudding', 'Little caramel pudding', 'beginner', ['pudding', 'flan', 'caramel', 'dessert', 'sweets', 'cherry'], puddingArt()),
  tpl('sprout', 'Baby sprout in a pot', 'beginner', ['sprout', 'seedling', 'plant', 'pot', 'garden', 'spring', 'baby'], sproutArt()),
  tpl('snowflake', 'Smiling snowflake', 'beginner', ['snowflake', 'snow', 'winter', 'weather', 'christmas'], snowflakeArt()),
  tpl('cookie', 'Happy choc chip cookie', 'beginner', ['cookie', 'biscuit', 'chocolate', 'sweets', 'snack'], cookieArt()),
  tpl('thundercloud', 'Grumpy little thundercloud', 'beginner', ['cloud', 'thunder', 'lightning', 'storm', 'weather', 'rain'], thundercloudArt()),
  tpl('umbrella', 'Little umbrella in the rain', 'beginner', ['umbrella', 'rain', 'raindrops', 'weather', 'autumn'], umbrellaArt()),
  // intermediate
  tpl('sushi-rolls', 'Little sushi roll trio', 'intermediate', ['sushi', 'rolls', 'rice', 'food', 'lunch', 'japanese'], sushiRollsArt()),
  tpl('dumplings', 'Happy dumpling basket', 'intermediate', ['dumplings', 'steamer', 'basket', 'food', 'lunch'], dumplingsArt()),
  tpl('noodle-bowl', 'Smiling noodle bowl', 'intermediate', ['noodles', 'ramen', 'bowl', 'egg', 'food', 'dinner'], noodleBowlArt()),
  tpl('pizza-slice', 'Happy pizza slice', 'intermediate', ['pizza', 'slice', 'cheese', 'food', 'party'], pizzaArt()),
  tpl('watermelon', 'Sweet watermelon slices', 'intermediate', ['watermelon', 'melon', 'fruit', 'summer', 'food'], watermelonArt()),
  tpl('chocolate-bar', 'Chubby chocolate bar', 'intermediate', ['chocolate', 'candy', 'sweets', 'gift', 'love'], chocolateArt()),
  tpl('veggie-pals', 'Little carrot and radish', 'intermediate', ['carrot', 'radish', 'vegetables', 'veg', 'food', 'garden'], veggiePalsArt()),
  tpl('coin-plant', 'Smiling coin plant', 'intermediate', ['plant', 'houseplant', 'pot', 'leaves', 'garden'], coinPlantArt()),
  tpl('cool-sun', 'Happy sun in sunglasses', 'intermediate', ['sun', 'sunglasses', 'summer', 'weather', 'sky'], coolSunArt()),
  tpl('rainbow-clouds', 'Smiling rainbow with clouds', 'intermediate', ['rainbow', 'cloud', 'weather', 'sky', 'baby', 'love'], rainbowArt()),
  tpl('ice-cream', 'Happy ice cream cone', 'intermediate', ['ice-cream', 'cone', 'cherry', 'summer', 'sweets', 'dessert'], iceCreamArt()),
  // advanced
  tpl('bento', 'Kawaii bento box', 'advanced', ['bento', 'lunch', 'rice', 'egg', 'tomato', 'food', 'japanese'], bentoArt()),
  tpl('dessert-party', 'Sweet dessert party', 'advanced', ['cake', 'dessert', 'party', 'birthday', 'sweets', 'bunting'], dessertPartyArt()),
  tpl('veggie-garden', 'Happy veggie garden', 'advanced', ['garden', 'vegetables', 'carrot', 'pumpkin', 'plant', 'fence'], veggieGardenArt()),
  tpl('weather-friends', 'Little weather friends', 'advanced', ['weather', 'sun', 'cloud', 'snowflake', 'rainbow', 'umbrella'], weatherFriendsArt()),
  tpl('apple-tree', 'Smiling apple tree', 'advanced', ['tree', 'apple', 'fruit', 'plant', 'garden', 'autumn', 'basket'], appleTreeArt()),
];
