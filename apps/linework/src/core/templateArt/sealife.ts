// Sea life (fb-1022b, 22 Oct 2026): original sea-creature line art on a 400×400 canvas, authored here as hand-placed
// control points (smooth Catmull-Rom outlines, tapered tubes for arms, tusks and kelp) — see docs/TEMPLATES.md.
// Three levels: bold single animals (beginner), animals with internal detail (intermediate) and full scenes with
// hundreds of strokes (advanced). Every piece is a generic animal of our own design: no characters, mascots or
// lookalikes of any animated fish. Overlaps are drawn with occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { bez, circle, ellipse, f, line, mapPath, polar, type P } from './draw.ts';
import { clip, region, roundPoly, stack, union, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

/** Control point; a third value of 1 makes it a sharp corner. */
type Q = readonly [number, number] | readonly [number, number, number];

/** A drawing: outlines, fine detail and the closed silhouettes that hide what is behind it. */
type Art = { paths: string[]; detail: string[]; sil: Layer[] };

// ---- kit --------------------------------------------------------------------------------------

function tangents(pts: readonly Q[], closed: boolean, k: number): P[] {
  const n = pts.length;
  return pts.map((p, i) => {
    if (p[2]) return [0, 0] as P;
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    return [((b[0] - a[0]) * k) / 6, ((b[1] - a[1]) * k) / 6] as P;
  });
}

/** Smooth curve through points (closed shape or open stroke). */
function cr(pts: readonly Q[], closed = true, k = 1): string {
  const t = tangents(pts, closed, k);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    const [a, b] = [pts[i], pts[j]];
    d += ` C ${f(a[0] + t[i][0])} ${f(a[1] + t[i][1])} ${f(b[0] - t[j][0])} ${f(b[1] - t[j][1])} ${f(b[0])} ${f(b[1])}`;
  }
  return closed ? `${d} Z` : d;
}
const open = (pts: readonly Q[], k = 1): string => cr(pts, false, k);

/** Closed outline symmetric about x = ax, from the top point on the axis down the right side to the bottom point. */
function sym(right: readonly Q[], ax = 200): string {
  const left = right.slice(1, -1).reverse().map((p) => [2 * ax - p[0], p[1], p[2] ?? 0] as Q);
  return cr([...right, ...left]);
}
const mirror = (pts: readonly Q[], ax = 200): Q[] => pts.map((p) => [2 * ax - p[0], p[1], p[2] ?? 0] as Q);

/** Points along a smooth open curve. */
function sampleCurve(pts: readonly Q[], per = 8): P[] {
  const t = tangents(pts.map((p) => [p[0], p[1]] as Q), false, 1);
  const out: P[] = [[pts[0][0], pts[0][1]]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a: P = [pts[i][0], pts[i][1]];
    const b: P = [pts[i + 1][0], pts[i + 1][1]];
    const c1: P = [a[0] + t[i][0], a[1] + t[i][1]];
    const c2: P = [b[0] - t[i + 1][0], b[1] - t[i + 1][1]];
    for (let s = 1; s <= per; s++) out.push(bez(a, c1, c2, b, s / per));
  }
  return out;
}

/** Tapered tube around a centre line (arm, tentacle, tusk, kelp stipe): width w0 at the start, w1 at the end. */
function tube(center: readonly Q[], w0: number, w1: number, n = 12, roundTip = true): string {
  const pts = sampleCurve(center, 10);
  const L: Q[] = [];
  const R: Q[] = [];
  for (let i = 0; i <= n; i++) {
    const idx = Math.round((i / n) * (pts.length - 1));
    const p = pts[idx];
    const a = pts[Math.max(0, idx - 1)];
    const b = pts[Math.min(pts.length - 1, idx + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = (w0 + (w1 - w0) * (i / n)) / 2;
    const c = i === 0 ? 1 : 0;
    L.push([p[0] + nx * w, p[1] + ny * w, c]);
    R.push([p[0] - nx * w, p[1] - ny * w, c]);
  }
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
  const tip: Q = roundTip ? [end[0] + ((end[0] - prev[0]) / len) * w1 * 0.5, end[1] + ((end[1] - prev[1]) / len) * w1 * 0.5] : [end[0], end[1], 1];
  return cr([...L, tip, ...R.reverse()]);
}

/** Wavy horizontal line. */
function wave(x0: number, x1: number, y: number, a: number, w: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  w = (x1 - x0) / Math.max(1, Math.round((x1 - x0) / w));
  for (let x = x0; x < x1 - 0.1; x += w) {
    d += ` Q ${f(x + w / 4)} ${f(y - a)} ${f(x + w / 2)} ${f(y)} Q ${f(x + (3 * w) / 4)} ${f(y + a)} ${f(x + w)} ${f(y)}`;
  }
  return d;
}

/** Rolling sea surface with crests. */
function swell(x0: number, x1: number, y: number, a: number, w: number): string {
  let d = `M ${f(x0)} ${f(y)}`;
  w = (x1 - x0) / Math.max(1, Math.round((x1 - x0) / w));
  for (let x = x0; x < x1 - 0.1; x += w) d += ` C ${f(x + w * 0.3)} ${f(y - a)} ${f(x + w * 0.6)} ${f(y - a)} ${f(x + w)} ${f(y)}`;
  return d;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bubble cluster. */
function bubbles(list: readonly [number, number, number][]): string[] {
  return list.map(([x, y, r]) => circle(x, y, r));
}

const eye = (x: number, y: number, r: number): string[] => [circle(x, y, r), circle(x + r * 0.2, y - r * 0.1, Math.max(1.6, r * 0.38))];

const inside = (d: string, layer: Layer): string => clip(d, [region(layer)], 'inside');
const hide = (d: string, layers: readonly Layer[]): string => clip(d, layers.map(region));

/** Scale s about (cx, cy), optionally mirror, rotate by deg (clockwise), then put (cx, cy) at (x, y). */
type Place = { s?: number; deg?: number; x?: number; y?: number; flip?: boolean; cx?: number; cy?: number };
function mapD(d: string, o: Place): string {
  const s = o.s ?? 1;
  const cx = o.cx ?? 200;
  const cy = o.cy ?? 200;
  const a = ((o.deg ?? 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const x0 = o.x ?? cx;
  const y0 = o.y ?? cy;
  return mapPath(d, {
    map: (x, y) => {
      const u = (o.flip ? cx - x : x - cx) * s;
      const v = (y - cy) * s;
      return [x0 + u * c - v * sn, y0 + u * sn + v * c];
    },
    scale: s,
    rotate: o.deg ?? 0,
    flip: !!o.flip,
  });
}
function place(a: Art, o: Place): Art {
  const m = (d: string) => mapD(d, o);
  return { paths: a.paths.map(m), detail: a.detail.map(m), sil: a.sil.map((l) => (typeof l === 'string' ? m(l) : l.map(m))) };
}

/** Layer whole drawings front to back: each is hidden behind the silhouettes of those before it. */
function compose(items: readonly Art[]): Art {
  const regions: Region[] = [];
  const paths: string[] = [];
  const detail: string[] = [];
  const sil: Layer[] = [];
  for (const it of items) {
    for (const d of it.paths) paths.push(regions.length ? clip(d, regions) : d);
    for (const d of it.detail) detail.push(regions.length ? clip(d, regions) : d);
    regions.push(...it.sil.map(region));
    sil.push(...it.sil);
  }
  return { paths: paths.filter(Boolean), detail: detail.filter(Boolean), sil };
}

/** Art from front-to-back outline layers plus detail kept inside the union of the layers. */
function art(layers: readonly string[], detail: readonly string[] = [], free: readonly string[] = []): Art {
  return { paths: [...stack(layers), ...free], detail: detail.filter(Boolean) as string[], sil: [...layers] };
}

/** Douglas-Peucker on clipped polylines (subpaths made only of L commands) to keep the path data lean. */
function dp(pts: P[], tol: number): P[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  let best = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
    if (d > best) [best, idx] = [d, i];
  }
  if (best <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}
function lean(d: string, tol = 0.45): string {
  return d
    .split(/(?=M)/)
    .map((part) => {
      const t = part.trim();
      if (!/^M[-\d. L]*$/.test(t)) return t;
      const nums = (t.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const pts: P[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      if (pts.length < 4) return t;
      return dp(pts, tol).map((p, k) => `${k ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ');
    })
    .join(' ');
}

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], a: Art, extra: string[] = [], extraDetail: string[] = []): Template {
  const paths = [...a.paths, ...extra].filter(Boolean).map((d) => lean(d));
  const detail = [...a.detail, ...extraDetail].filter(Boolean).map((d) => lean(d));
  return {
    id: `sea-${id}`,
    name,
    category: 'sealife',
    level,
    tags: ['sea', 'ocean', ...tags],
    viewBox: VB,
    paths,
    ...(detail.length ? { detail } : {}),
  };
}

// ---- shared parts -----------------------------------------------------------------------------

/** Two-finger pincer pointing up, centred near (0, 0), about 56 wide and 96 tall. */
const PINCER: Q[] = [[-16, 42], [-28, 14], [-27, -16], [-16, -40], [-6, -52, 1], [-4, -30], [-1, -14, 1], [8, -30], [16, -46, 1], [24, -28], [25, -4], [19, 22], [14, 42]];
const pincer = (x: number, y: number, s: number, deg: number, flip = false): string =>
  mapD(cr(PINCER), { s, deg, flip, cx: 0, cy: 0, x, y });

/** Small generic fish facing right, about 120 × 70 around (200, 200). */
function fish(kind = 0): Art {
  const body = kind === 1
    ? cr([[262, 200], [240, 172], [200, 160], [160, 172], [146, 190, 1], [146, 210, 1], [160, 228], [200, 240], [240, 228]])
    : cr([[266, 202], [244, 182], [206, 172], [168, 182], [148, 196, 1], [148, 208, 1], [168, 220], [206, 230], [244, 222]]);
  const tail = cr([[156, 202, 1], [130, 178, 1], [138, 202], [130, 226, 1]]);
  const fin = cr([[196, 176, 1], [214, 156, 1], [230, 180, 1]]);
  const a = art([body, tail, fin], [
    inside(open([[230, 180], [222, 202], [230, 222]]), body),
    ...(kind === 1 ? [inside(open([[198, 162], [192, 200], [198, 238]]), body)] : []),
  ], eye(246, 196, 4));
  return a;
}

/** Five-armed sea star. */
function seaStar(cx: number, cy: number, R: number, rot = 0, dots = 3): Art {
  const pts: P[] = [];
  for (let i = 0; i < 10; i++) pts.push(polar(cx, cy, i % 2 === 0 ? R : R * 0.42, rot + i * 36));
  const outline = roundPoly(pts, R * 0.12);
  const detail: string[] = [];
  for (let i = 0; i < 5; i++) for (let k = 1; k <= dots; k++) {
    const [x, y] = polar(cx, cy, (R * 0.82 * k) / (dots + 0.6), rot + i * 72);
    detail.push(circle(x, y, Math.max(1.6, R * 0.05 * (1.2 - k / (dots + 1)))));
  }
  detail.push(circle(cx, cy, R * 0.09));
  return { paths: [outline], detail, sil: [outline] };
}

/** Scallop fan shell with its hinge at (x, y), radius R. */
function scallop(x: number, y: number, R: number, ribs = 11, deg = 0, rings = 0): Art {
  const span = 132;
  const a0 = -span / 2;
  let d = '';
  const [ex, ey] = polar(x, y, R * 0.98, a0);
  const hl: P = [x - R * 0.13, y - R * 0.02];
  const hr: P = [x + R * 0.13, y - R * 0.02];
  d = `M ${f(hl[0])} ${f(hl[1])} L ${f(ex)} ${f(ey)}`;
  const step = span / ribs;
  for (let i = 0; i < ribs; i++) {
    const am = a0 + step * (i + 0.5);
    const [qx, qy] = polar(x, y, R * 1.12, am);
    const [bx, by] = polar(x, y, R * 0.98, a0 + step * (i + 1));
    d += ` Q ${f(qx)} ${f(qy)} ${f(bx)} ${f(by)}`;
  }
  d += ` L ${f(hr[0])} ${f(hr[1])} Z`;
  const ears = cr([[x - R * 0.36, y - R * 0.12, 1], [x + R * 0.36, y - R * 0.12, 1], [x + R * 0.3, y + R * 0.1, 1], [x - R * 0.3, y + R * 0.1, 1]]);
  const detail: string[] = [];
  for (let i = 1; i < ribs; i++) {
    const [ax, ay] = polar(x, y, R * 0.22, a0 + step * i);
    const [bx, by] = polar(x, y, R * 0.97, a0 + step * i);
    detail.push(line(ax, ay, bx, by));
  }
  for (let k = 1; k <= rings; k++) {
    const r = R * (0.3 + (0.62 * k) / (rings + 1));
    const [p1x, p1y] = polar(x, y, r, a0 + 3);
    const [p2x, p2y] = polar(x, y, r, -a0 - 3);
    detail.push(inside(`M ${f(p1x)} ${f(p1y)} A ${f(r)} ${f(r)} 0 0 1 ${f(p2x)} ${f(p2y)}`, d));
  }
  const a = art([d, ears], detail.map((s) => inside(s, d)));
  return deg ? place(a, { deg, cx: x, cy: y }) : a;
}

/** Wavy seaweed ribbon rooted at (x, y) of height h. */
function weed(x: number, y: number, h: number, w: number, sway: number, seed: number): string {
  const c: Q[] = [];
  for (let i = 0; i <= 5; i++) c.push([x + Math.sin(seed + i * 1.3) * sway * (i / 5), y - (h * i) / 5]);
  return tube(c, w, w * 0.35, 14);
}

/** Small round rock. */
function rock(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const r = rng(seed);
  const pts: Q[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const k = 0.86 + r() * 0.2;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return cr(pts);
}

/** Sand speckle inside a box. */
function speckle(x0: number, y0: number, x1: number, y1: number, n: number, seed: number, keepOut: readonly Layer[] = []): string[] {
  const r = rng(seed);
  const out: string[] = [];
  const regs = keepOut.map(region);
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const d = circle(x, y, 1.6 + r() * 1.2);
    if (regs.length && clip(d, regs) !== d) continue;
    out.push(d);
  }
  return out;
}

// ---- beginner ---------------------------------------------------------------------------------

function simpleTurtle(): Template {
  const shell = cr([[96, 232, 1], [118, 176], [160, 142], [210, 134], [258, 146], [292, 182], [306, 232, 1], [200, 244]]);
  const head = cr([[290, 214], [312, 190], [344, 184], [370, 198], [372, 222], [350, 238], [310, 238]]);
  const front = cr([[238, 236], [280, 258], [312, 288], [300, 300], [262, 286], [226, 250]]);
  const back = cr([[134, 236], [116, 270], [92, 290], [80, 280], [96, 252], [112, 234]]);
  const tail = cr([[104, 228], [72, 236, 1], [106, 244]]);
  const rim = open([[100, 230], [150, 222], [200, 220], [250, 222], [302, 230]]);
  const hex = cr([[200, 162, 1], [236, 178, 1], [234, 208, 1], [200, 218, 1], [166, 208, 1], [164, 178, 1]]);
  const a = art([shell, head, front, back, tail], [
    inside(rim, shell), hex,
    line(200, 162, 200, 140), line(236, 178, 270, 160), line(164, 178, 130, 160),
    line(234, 208, 280, 224), line(166, 208, 120, 224),
  ], [...eye(346, 204, 6), open([[352, 222], [362, 220], [368, 214]])]);
  return tpl('simple-turtle', 'Simple turtle', 'beginner', ['turtle', 'kids', 'cute', 'stylized'], a, [wave(30, 370, 340, 8, 40), wave(70, 330, 368, 6, 40)]);
}

function starfish(): Template {
  const s = seaStar(200, 210, 172, 8, 3);
  return tpl('starfish', 'Starfish', 'beginner', ['starfish', 'sea-star', 'beach', 'kids', 'stylized'], s);
}

function jellyfish(): Template {
  let bell = 'M 92 186 C 92 70 308 70 308 186';
  const n = 8;
  for (let i = 0; i < n; i++) {
    const xa = 308 - (216 * i) / n;
    const xb = 308 - (216 * (i + 1)) / n;
    bell += ` Q ${f((xa + xb) / 2)} ${f(206)} ${f(xb)} ${f(186)}`;
  }
  bell += ' Z';
  const arms: string[] = [];
  const xs = [150, 186, 214, 250];
  xs.forEach((x, i) => {
    const c: Q[] = [];
    for (let k = 0; k <= 6; k++) c.push([x + Math.sin(k * 1.2 + i) * 14, 196 + k * 28]);
    arms.push(tube(c, 16, 6, 14));
  });
  const thin: string[] = [];
  [112, 132, 168, 232, 268, 288].forEach((x, i) => {
    const c: Q[] = [];
    for (let k = 0; k <= 5; k++) c.push([x + Math.sin(k * 1.4 + i * 2) * 10, 196 + k * 30 - (i % 2) * 6]);
    thin.push(open(c));
  });
  const a = art([bell, ...arms], [inside(open([[118, 150], [150, 108], [200, 98], [250, 108], [282, 150]]), bell)], thin.map((d) => hide(d, [bell, ...arms])));
  return tpl('jellyfish', 'Jellyfish', 'beginner', ['jellyfish', 'kids', 'stylized', 'glow'], a, bubbles([[330, 90, 8], [348, 60, 5], [60, 120, 6]]));
}

function crab(): Template {
  const body = cr([[110, 250], [130, 206], [200, 190], [270, 206], [290, 250], [262, 290], [200, 300], [138, 290]]);
  const legs: string[] = [];
  for (let i = 0; i < 3; i++) {
    const y = 250 + i * 18;
    legs.push(tube([[150, y], [100, y + 6 + i * 4], [74, y + 44 + i * 6]], 14, 6, 8));
    legs.push(tube([[250, y], [300, y + 6 + i * 4], [326, y + 44 + i * 6]], 14, 6, 8));
  }
  const armL = tube([[148, 222], [110, 196], [96, 168]], 18, 14, 6);
  const armR = tube([[252, 222], [290, 196], [304, 168]], 18, 14, 6);
  const clawL = pincer(92, 120, 1.05, -14);
  const clawR = pincer(308, 120, 1.05, 14, true);
  const stalks = [open([[182, 196], [176, 160]]), open([[218, 196], [224, 160]])];
  const eyes = [circle(175, 150, 11), circle(225, 150, 11)];
  const a = art([body, clawL, clawR, ...eyes, armL, armR, ...legs], [open([[170, 262], [200, 274], [230, 262]])], stalks.map((d) => hide(d, [body, ...eyes])));
  return tpl('crab', 'Beach crab', 'beginner', ['crab', 'beach', 'kids', 'stylized'], a, [circle(176, 152, 3.5), circle(224, 152, 3.5), wave(40, 360, 350, 6, 40)]);
}

function bandedFish(): Template {
  const body = cr([[340, 214], [318, 168], [262, 132], [196, 128], [144, 150], [110, 186, 1], [110, 226, 1], [144, 262], [196, 286], [262, 280], [318, 254]]);
  const tail = cr([[126, 206, 1], [62, 140], [44, 150, 1], [70, 206], [44, 262, 1], [62, 272], [126, 210, 1]]);
  const dorsal = cr([[176, 138, 1], [198, 92], [244, 90], [280, 140, 1]]);
  const anal = cr([[190, 278, 1], [212, 316], [250, 312], [268, 276, 1]]);
  const pect = cr([[262, 214, 1], [236, 236], [222, 256, 1], [252, 246], [272, 226, 1]]);
  const band = (x: number, tilt: number, w: number) => [
    inside(open([[x + tilt, 110], [x, 210], [x + tilt, 300]]), body),
    inside(open([[x + tilt + w, 110], [x + w, 210], [x + tilt + w, 300]]), body),
  ];
  const a = art([pect, body, tail, dorsal, anal], [
    ...band(286, -16, 16), ...band(200, -14, 22), ...band(140, -10, 16),
    inside(open([[200, 100], [222, 96], [244, 98]]), dorsal),
  ], [...eye(306, 188, 9), open([[338, 220], [330, 226]])]);
  return tpl('banded-fish', 'Banded reef fish', 'beginner', ['fish', 'reef', 'tropical', 'kids', 'stylized'], a, bubbles([[364, 150, 7], [372, 118, 5], [356, 92, 4]]));
}

function pufferfish(): Template {
  const body = circle(206, 206, 118);
  const tail = cr([[96, 206, 1], [44, 162], [34, 178, 1], [52, 206], [34, 234, 1], [44, 250]]);
  const fin = cr([[176, 244, 1], [146, 262], [126, 290, 1], [164, 290], [194, 262, 1]]);
  const spikes: string[] = [];
  for (let i = 0; i < 26; i++) {
    const a = i * (360 / 26) + 4;
    if (a > 248 && a < 292) continue;
    const [x1, y1] = polar(206, 206, 118, a - 3);
    const [x2, y2] = polar(206, 206, 136, a);
    const [x3, y3] = polar(206, 206, 118, a + 3);
    spikes.push(`M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)} L ${f(x3)} ${f(y3)}`);
  }
  const a = art([fin, body, tail], [], [...eye(262, 170, 16), ellipse(318, 214, 8, 10)]);
  const dots: string[] = [];
  for (const [x, y] of [[170, 140], [140, 190], [200, 110], [150, 250], [190, 290], [240, 300], [280, 270], [126, 222]] as const) dots.push(circle(x, y, 3));
  return tpl('pufferfish', 'Pufferfish', 'beginner', ['pufferfish', 'fish', 'kids', 'stylized', 'tropical'], a, spikes, dots.map((d) => hide(d, [fin])));
}

function simpleOctopus(): Template {
  const head = cr([[200, 40], [262, 58], [292, 120], [280, 190], [240, 222], [160, 222], [120, 190], [108, 120], [138, 58]]);
  const arms: string[] = [];
  const spec: Q[][] = [
    [[150, 200], [100, 240], [70, 300], [96, 330], [116, 306]],
    [[176, 210], [150, 270], [146, 340], [176, 356], [182, 330]],
    [[224, 210], [250, 270], [254, 340], [224, 356], [218, 330]],
    [[250, 200], [300, 240], [330, 300], [304, 330], [284, 306]],
  ];
  for (const c of spec) arms.push(tube(c, 40, 10, 16));
  const back = [tube([[130, 190], [70, 210], [36, 250], [52, 274]], 30, 8, 12), tube([[270, 190], [330, 210], [364, 250], [348, 274]], 30, 8, 12)];
  const a = art([head, ...arms, ...back], [], [...eye(170, 140, 12), ...eye(230, 140, 12), open([[186, 176], [200, 186], [214, 176]])]);
  return tpl('simple-octopus', 'Simple octopus', 'beginner', ['octopus', 'kids', 'cute', 'stylized'], a, bubbles([[330, 70, 9], [352, 40, 6], [70, 80, 7]]));
}

function scallopShell(): Template {
  const s = scallop(200, 318, 176, 11, 0, 2);
  return tpl('scallop', 'Scallop shell', 'beginner', ['shell', 'scallop', 'beach', 'kids', 'stylized'], s, [wave(40, 360, 372, 5, 40)]);
}

function dolphinArt(): Art {
  const body = cr([[372, 207, 1], [350, 200], [336, 194], [324, 180], [300, 169], [244, 164], [182, 170], [130, 185], [92, 202], [72, 211, 1], [44, 184, 1], [60, 216, 1], [42, 248, 1], [76, 224, 1], [112, 230], [172, 238], [240, 236], [300, 224], [340, 213], [358, 211]]);
  const dorsal = cr([[192, 172, 1], [204, 146], [196, 120, 1], [232, 140], [248, 168, 1]]);
  const pect = cr([[282, 222, 1], [262, 248], [246, 262, 1], [258, 232], [262, 224, 1]]);
  return art([pect, body, dorsal], [open([[370, 208], [336, 206]]), inside(open([[330, 214], [270, 214], [200, 222], [140, 218]]), body)], [circle(318, 194, 4)]);
}

function jumpingDolphin(): Template {
  const d = place(dolphinArt(), { deg: -28, x: 224, y: 150 });
  const sea: string[] = [swell(20, 380, 320, 14, 60), wave(40, 360, 350, 6, 40), wave(80, 320, 374, 5, 40)];
  const splash = [open([[60, 318], [50, 296], [36, 286]]), open([[76, 314], [80, 292], [74, 276]]), open([[92, 316], [104, 298], [114, 292]]), circle(40, 270, 4), circle(66, 262, 3), circle(120, 278, 3.5)];
  return tpl('jumping-dolphin', 'Jumping dolphin', 'beginner', ['dolphin', 'kids', 'stylized', 'summer'], d, [...sea.map((s) => hide(s, d.sil)), ...splash]);
}

function shrimp(): Template {
  const c: Q[] = [[300, 150], [310, 220], [270, 290], [200, 318], [140, 300]];
  const body = tube(c, 82, 34, 14);
  const head = cr([[262, 128], [310, 108], [352, 126], [356, 160], [330, 182], [286, 176]]);
  const fan = cr([[150, 296, 1], [96, 262], [80, 290], [96, 330], [150, 318, 1]]);
  const pts = sampleCurve(c, 10);
  const segs: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const idx = Math.round((i / 7) * (pts.length - 1));
    const [x, y] = pts[idx];
    const [ax, ay] = pts[idx - 1];
    const [bx, by] = pts[idx + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const w = 50 - i * 5;
    segs.push(inside(open([[x + nx * w, y + ny * w], [x + nx * 2 + (bx - ax) * 0.4, y + ny * 2 + (by - ay) * 0.4], [x - nx * w, y - ny * w]]), body));
  }
  const legs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, y] = pts[Math.round(((i + 1) / 8) * (pts.length - 1))];
    legs.push(open([[x - 20, y - 6], [x - 44, y + 4 - i * 6], [x - 54, y + 20 - i * 6]]));
  }
  const ant = [open([[346, 124], [330, 70], [260, 40], [190, 46]]), open([[350, 130], [372, 80], [360, 34]])];
  const a = art([head, body, fan], [...segs, line(116, 300, 92, 292), line(118, 306, 92, 312)], [...eye(326, 140, 7), ...ant.map((d) => hide(d, [head])), ...legs.map((d) => hide(d, [head, body]))]);
  return tpl('shrimp', 'Curled shrimp', 'beginner', ['shrimp', 'prawn', 'kids', 'stylized'], a);
}

// ---- intermediate -----------------------------------------------------------------------------

function orca(): Template {
  const body = cr([[366, 212], [356, 190], [330, 174], [280, 164], [220, 164], [160, 174], [112, 190], [80, 206, 1], [52, 182, 1], [64, 216, 1], [50, 250, 1], [84, 226, 1], [124, 238], [190, 250], [262, 250], [320, 240], [352, 228]]);
  const dorsal = cr([[196, 188, 1], [212, 112], [220, 60, 1], [242, 118], [264, 186, 1]]);
  const pect = cr([[290, 238, 1], [282, 270], [266, 296], [246, 292], [256, 262], [268, 240, 1]]);
  const patch = ellipse(300, 192, 24, 9);
  const belly = open([[354, 226], [320, 232], [270, 236], [228, 228], [198, 214], [168, 218], [150, 236]]);
  const saddle = open([[180, 172], [196, 184], [236, 186], [270, 172]]);
  const a = art([pect, body, dorsal], [
    inside(mapD(patch, { deg: -10, cx: 300, cy: 192 }), body), inside(belly, body), inside(saddle, body),
    open([[364, 214], [344, 216], [326, 214]]),
  ], [circle(328, 202, 4)]);
  const b = place(a, { flip: true });
  return tpl('orca', 'Orca', 'intermediate', ['orca', 'whale', 'killer-whale', 'realistic'], b, [hide(swell(20, 380, 330, 10, 48), b.sil), wave(60, 340, 358, 5, 40)], bubbles([[40, 160, 6], [54, 132, 4], [30, 108, 5]]));
}

function shark(): Template {
  const body = cr([[376, 200], [352, 184], [312, 172], [252, 168], [190, 172], [140, 182], [100, 192], [82, 198, 1], [36, 126, 1], [66, 210, 1], [44, 252, 1], [88, 214, 1], [130, 224], [200, 234], [270, 232], [322, 222], [354, 210]]);
  const dorsal = cr([[200, 172, 1], [222, 130], [234, 96, 1], [248, 134], [268, 170, 1]]);
  const dorsal2 = cr([[110, 190, 1], [118, 172], [122, 164, 1], [130, 174], [138, 186, 1]]);
  const pect = cr([[290, 222, 1], [262, 262], [236, 290, 1], [254, 252], [270, 226, 1]]);
  const pelvic = cr([[158, 228, 1], [146, 250, 1], [176, 234, 1]]);
  const gills: string[] = [];
  for (let i = 0; i < 5; i++) gills.push(inside(open([[318 - i * 9, 186], [314 - i * 9, 200], [318 - i * 9, 214]]), body));
  const a = art([pect, body, dorsal, dorsal2, pelvic], [
    ...gills, open([[356, 210], [340, 216], [322, 214]]),
    inside(open([[350, 206], [300, 222], [230, 226], [150, 216], [96, 204]]), body),
  ], eye(340, 190, 4.5));
  const b = place(a, { deg: 8, y: 190 });
  return tpl('shark', 'Great shark', 'intermediate', ['shark', 'fish', 'realistic'], b, [], [...bubbles([[50, 300, 6], [70, 330, 4], [40, 350, 5]]), wave(20, 380, 30, 4, 40)]);
}

function hammerhead(): Template {
  const R: Q[] = [[200, 76], [240, 78], [282, 84], [300, 96], [298, 112], [262, 116], [228, 126], [232, 162], [238, 204], [234, 252], [222, 300], [210, 336], [204, 372, 1], [200, 380, 1]];
  const body = sym(R);
  const pr: Q[] = [[234, 182, 1], [290, 214], [312, 244, 1], [272, 236], [238, 222, 1]];
  const pectR = cr(pr);
  const pectL = cr(mirror(pr));
  const pelR = cr([[226, 290, 1], [252, 306], [256, 318, 1], [222, 308, 1]]);
  const pelL = mapD(pelR, { flip: true });
  const dorsal = cr([[200, 170, 1], [208, 196], [204, 236], [200, 250, 1], [196, 236], [192, 196]]);
  const tailFin = cr([[204, 344, 1], [238, 374, 1], [216, 352], [202, 372, 1]]);
  const a = art([body, pectR, pectL, pelR, pelL, tailFin], [
    dorsal, inside(open([[150, 104], [200, 98], [250, 104]]), body),
    open([[232, 150], [222, 210], [216, 280], [206, 330]]), open([[168, 150], [178, 210], [184, 280], [194, 330]]),
  ], [circle(292, 104, 5), circle(108, 104, 5)]);
  const b = place(a, { deg: 28, s: 0.92, x: 200, y: 210, cy: 228 });
  return tpl('hammerhead', 'Hammerhead shark', 'intermediate', ['shark', 'hammerhead', 'realistic'], b, [], bubbles([[330, 330, 7], [350, 300, 5], [336, 272, 4], [60, 80, 6]]));
}

function manta(): Template {
  const R: Q[] = [[200, 150], [222, 146], [230, 124], [236, 100, 1], [250, 124], [254, 148], [292, 150], [334, 164], [374, 192, 1], [340, 206], [300, 226], [262, 252], [238, 282], [220, 302], [206, 308], [200, 310]];
  const disc = sym(R);
  const tail = tube([[200, 306], [204, 340], [198, 362]], 8, 2, 8);
  const a = art([disc, tail], [
    inside(open([[222, 150], [236, 200], [228, 258], [208, 300]]), disc),
    inside(open([[178, 150], [164, 200], [172, 258], [192, 300]]), disc),
    inside(open([[254, 162], [300, 176], [348, 196]]), disc), inside(open([[146, 162], [100, 176], [52, 196]]), disc),
    inside(open([[238, 236], [280, 216], [320, 204]]), disc), inside(open([[162, 236], [120, 216], [80, 204]]), disc),
    ...[[200, 196], [200, 226], [210, 256], [190, 256]].map(([x, y]) => circle(x, y, 3)),
    line(206, 156, 194, 156),
  ], [circle(242, 158, 4), circle(158, 158, 4)]);
  const b = place(a, { deg: -12, y: 214 });
  const rays = [line(60, 20, 120, 120), line(110, 20, 150, 90), line(300, 20, 270, 80), line(350, 20, 320, 90)];
  return tpl('manta-ray', 'Manta ray', 'intermediate', ['manta', 'ray', 'realistic'], b, [], [...rays.map((d) => hide(d, b.sil)), ...bubbles([[340, 330, 6], [360, 306, 4], [50, 330, 5]])]);
}

function seahorse(): Template {
  const body = cr([[92, 124, 1], [130, 118], [150, 106], [160, 88], [164, 66, 1], [178, 76], [190, 62, 1], [198, 84], [212, 102], [216, 128], [222, 150], [238, 180], [246, 216], [242, 252], [230, 282], [214, 304], [184, 304], [164, 284], [152, 252], [150, 216], [158, 186], [170, 162], [164, 146], [140, 142], [92, 138, 1]]);
  const tail = tube([[214, 284], [216, 324], [204, 352], [216, 374], [244, 374], [254, 352], [238, 340]], 34, 8, 18);
  const fin = cr([[240, 192, 1], [272, 196], [286, 222], [272, 248], [244, 254, 1]]);
  const ridges: string[] = [];
  for (let i = 0; i < 8; i++) {
    const y = 176 + i * 16;
    ridges.push(inside(open([[140, y + 4], [196, y - 2], [260, y - 10]]), body));
  }
  const finRays = [0, 1, 2, 3].map((i) => inside(line(244, 198 + i * 15, 280, 200 + i * 15), fin));
  const tailRings: string[] = [];
  const tp = sampleCurve([[214, 284], [216, 324], [204, 352], [216, 374], [244, 374]], 6);
  for (let i = 2; i < tp.length - 2; i += 3) {
    const [x, y] = tp[i];
    const [ax, ay] = tp[i - 1];
    const [bx, by] = tp[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    tailRings.push(inside(line(x + nx * 18, y + ny * 18, x - nx * 18, y - ny * 18), tail));
  }
  const pec = cr([[206, 132, 1], [222, 120], [228, 136], [212, 146, 1]]);
  const a = art([body, pec, tail, fin], [...ridges, ...finRays, ...tailRings, inside(open([[152, 112], [170, 98], [196, 98]]), body)], eye(180, 112, 7));
  const b = place(a, { x: 220, y: 190, s: 1.05 });
  return tpl('seahorse', 'Seahorse', 'intermediate', ['seahorse', 'reef', 'stylized'], b, [], [...bubbles([[96, 70, 7], [74, 44, 5], [120, 40, 4]]), weed(330, 384, 150, 20, 26, 1), weed(360, 384, 110, 16, 20, 3)].map((d) => hide(d, b.sil)));
}

function turtleTop(): Art {
  const shell = cr([[200, 108], [252, 118], [284, 160], [290, 214], [274, 268], [236, 310], [200, 324, 1], [164, 310], [126, 268], [110, 214], [116, 160], [148, 118]]);
  const head = cr([[200, 46], [226, 58], [234, 90], [222, 122], [178, 122], [166, 90], [174, 58]]);
  const fr: Q[] = [[262, 136, 1], [304, 118], [348, 120], [378, 146, 1], [342, 156], [304, 168], [276, 180, 1]];
  const rr: Q[] = [[256, 284, 1], [292, 300], [304, 330, 1], [272, 326], [244, 306, 1]];
  const tail = cr([[188, 316, 1], [200, 346, 1], [212, 316, 1]]);
  const scutes = [
    cr([[200, 138, 1], [226, 148, 1], [226, 176, 1], [200, 186, 1], [174, 176, 1], [174, 148, 1]]),
    cr([[200, 186, 1], [226, 176, 1], [230, 214, 1], [200, 226, 1], [170, 214, 1], [174, 176, 1]]),
    cr([[200, 226, 1], [230, 214, 1], [228, 254, 1], [200, 268, 1], [172, 254, 1], [170, 214, 1]]),
    cr([[200, 268, 1], [228, 254, 1], [222, 286, 1], [200, 300, 1], [178, 286, 1], [172, 254, 1]]),
  ];
  const lat = [line(226, 148, 258, 140), line(226, 176, 274, 176), line(230, 214, 280, 216), line(228, 254, 270, 262), line(222, 286, 244, 300),
    line(174, 148, 142, 140), line(174, 176, 126, 176), line(170, 214, 120, 216), line(172, 254, 130, 262), line(178, 286, 156, 300)];
  const rim = open([[156, 132], [130, 170], [126, 214], [140, 262], [172, 298], [200, 308], [228, 298], [260, 262], [274, 214], [270, 170], [244, 132]]);
  const flipLines = [open([[290, 136], [330, 132], [362, 144]]), open([[110, 136], [70, 132], [38, 144]])];
  return art([shell, head, cr(fr), cr(mirror(fr)), cr(rr), cr(mirror(rr)), tail],
    [...scutes, ...lat.map((d) => inside(d, shell)), inside(rim, shell), ...flipLines, open([[188, 104], [200, 110], [212, 104]])],
    [circle(184, 76, 4.5), circle(216, 76, 4.5)]);
}

function seaTurtle(): Template {
  const t = place(turtleTop(), { deg: 18, y: 204 });
  return tpl('sea-turtle', 'Sea turtle', 'intermediate', ['turtle', 'sea-turtle', 'realistic'], t, [], bubbles([[60, 330, 7], [80, 356, 5], [44, 300, 4], [340, 50, 6]]));
}

function angelfish(): Template {
  const body = cr([[92, 205, 1], [130, 170], [165, 140], [205, 100], [250, 56], [300, 30, 1], [282, 80], [270, 130], [264, 168], [270, 182, 1], [304, 160], [338, 148, 1], [326, 202], [338, 256, 1], [302, 242], [270, 222, 1], [264, 240], [272, 290], [292, 348], [300, 374, 1], [250, 344], [205, 300], [165, 262], [130, 236], [100, 214]]);
  const pelvic = [tube([[160, 244], [166, 290], [176, 340]], 8, 3, 8), tube([[172, 248], [184, 290], [196, 330]], 8, 3, 8)];
  const stripes = [[150, -26], [200, -34], [244, -40]].map(([x, t]) => inside(open([[x - t, 40], [x, 205], [x - t, 380]]), body));
  const rays: string[] = [];
  for (let i = 0; i < 5; i++) rays.push(inside(line(196 + i * 18, 108 - i * 10, 262, 168), body));
  for (let i = 0; i < 5; i++) rays.push(inside(line(196 + i * 18, 302 + i * 10, 262, 238), body));
  const tailRays = [0, 1, 2].map((i) => inside(line(274, 202, 330, 168 + i * 34), body));
  const a = art([body, ...pelvic], [...stripes, ...rays, ...tailRays, inside(open([[150, 178], [140, 204], [150, 230]]), body)], [...eye(122, 196, 9), line(92, 206, 102, 208)]);
  return tpl('angelfish', 'Angelfish', 'intermediate', ['angelfish', 'fish', 'tropical', 'reef', 'stylized'], a, [], bubbles([[60, 140, 6], [48, 110, 4], [70, 84, 5]]));
}

function lobster(): Template {
  const cara = sym([[200, 92, 1], [208, 112], [230, 124], [242, 160], [240, 208], [228, 238], [200, 246]]);
  const segs: string[] = [];
  const widths = [64, 60, 56, 50, 44, 38];
  widths.forEach((w, i) => segs.push(cr([[200 - w / 2, 238 + i * 17, 1], [200 + w / 2, 238 + i * 17, 1], [200 + w / 2 - 2, 258 + i * 17], [200, 262 + i * 17], [200 - w / 2 + 2, 258 + i * 17]])));
  const fanY = 340;
  const fan = [
    cr([[190, fanY, 1], [210, fanY, 1], [214, 380], [200, 386], [186, 380]]),
    cr([[212, fanY, 1], [236, 362], [236, 380], [216, 382]]),
    cr([[188, fanY, 1], [164, 362], [164, 380], [184, 382]]),
  ];
  const armR = tube([[226, 132], [262, 108], [282, 88]], 18, 14, 6);
  const armL = tube([[174, 132], [138, 108], [118, 88]], 18, 14, 6);
  const clawR = pincer(294, 64, 0.9, 24, true);
  const clawL = pincer(106, 64, 0.9, -24);
  const legs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const y = 170 + i * 18;
    legs.push(open([[236, y], [272, y + 8], [292, y + 34]]), open([[164, y], [128, y + 8], [108, y + 34]]));
  }
  const ant = [open([[194, 100], [150, 60], [70, 40], [24, 60]]), open([[206, 100], [250, 60], [330, 40], [376, 60]])];
  const parts = [...fan, clawR, clawL, armR, armL];
  const a = art([cara, ...segs.slice().reverse(), ...parts], [
    inside(open([[180, 140], [200, 150], [220, 140]]), cara), inside(open([[176, 190], [200, 198], [224, 190]]), cara),
    line(200, 340, 200, 380),
  ], [circle(188, 108, 4.5), circle(212, 108, 4.5), ...ant.map((d) => hide(d, [cara, clawL, clawR])), ...legs.map((d) => hide(d, [cara]))]);
  return tpl('lobster', 'Lobster', 'intermediate', ['lobster', 'realistic'], a);
}

function squid(): Template {
  const mantle = sym([[200, 26, 1], [216, 46], [262, 80, 1], [242, 108], [230, 120], [234, 164], [234, 212], [230, 240], [200, 244]]);
  const head = ellipse(200, 262, 38, 26);
  const arms: string[] = [];
  const xs = [-30, -18, -6, 6, 18, 30];
  xs.forEach((dx, i) => arms.push(tube([[200 + dx * 0.8, 276], [200 + dx * 1.6, 310], [200 + dx * 2 + Math.sin(i) * 6, 340]], 14, 3, 8)));
  const tent = [tube([[192, 280], [170, 330], [140, 366], [126, 372]], 7, 6, 10), tube([[208, 280], [230, 330], [262, 362], [276, 368]], 7, 6, 10)];
  const clubs = [ellipse(120, 372, 12, 7), ellipse(282, 366, 12, 7)];
  const spots: string[] = [];
  const r = rng(7);
  for (let i = 0; i < 18; i++) spots.push(circle(178 + r() * 44, 120 + r() * 110, 2 + r() * 2));
  const a = art([head, mantle, ...clubs, ...tent, ...arms], [
    ...spots.map((d) => inside(d, mantle)), inside(open([[200, 40], [200, 236]]), mantle),
    inside(open([[220, 60], [226, 100]]), mantle), inside(open([[180, 60], [174, 100]]), mantle),
  ], [...eye(176, 262, 9), ...eye(224, 262, 9)]);
  const b = place(a, { deg: 20, y: 190 });
  return tpl('squid', 'Squid', 'intermediate', ['squid', 'realistic'], b, [], bubbles([[60, 60, 6], [80, 90, 4], [330, 330, 6]]));
}

function seal(): Template {
  const body = cr([[62, 238, 1], [86, 234], [120, 226], [170, 212], [215, 194], [250, 174], [266, 150], [274, 124], [294, 106], [326, 106], [346, 120], [358, 140], [350, 152], [330, 158], [310, 168], [300, 192], [290, 216], [270, 244], [220, 262], [160, 266], [110, 262], [82, 258], [58, 264, 1], [74, 250]]);
  const flipper = cr([[256, 236], [286, 262], [276, 274, 1], [248, 256]]);
  const rockS = cr([[30, 270], [60, 250], [120, 256], [200, 252], [280, 244], [330, 240], [366, 270], [372, 330], [340, 352], [60, 352], [28, 320]]);
  const spots: string[] = [];
  const r = rng(3);
  for (let i = 0; i < 16; i++) spots.push(ellipse(100 + r() * 180, 210 + r() * 40, 3 + r() * 3, 2 + r() * 2));
  const a = art([flipper, body, rockS], [
    ...spots.map((d) => inside(d, body)),
    inside(open([[60, 300], [100, 290], [150, 300]]), rockS), inside(open([[250, 290], [300, 280], [340, 300]]), rockS),
    inside(open([[180, 320], [220, 310], [250, 330]]), rockS),
    open([[334, 146], [340, 152], [350, 150]]),
  ], [...eye(322, 126, 6), ellipse(352, 138, 4, 3), line(338, 146, 372, 140), line(338, 150, 370, 154), line(334, 150, 360, 164)]);
  return tpl('seal-rock', 'Seal on a rock', 'intermediate', ['seal', 'harbor-seal', 'coast', 'realistic'], a, [hide(swell(20, 380, 352, 8, 45), [rockS]), wave(40, 360, 376, 5, 40)]);
}

function narwhal(): Template {
  const body = cr([[344, 222], [334, 196], [310, 182], [260, 176], [200, 184], [150, 198], [110, 214], [82, 228, 1], [54, 204, 1], [70, 238, 1], [54, 272, 1], [88, 248, 1], [130, 260], [200, 270], [270, 266], [318, 252], [340, 238]]);
  const tusk = tube([[334, 198], [356, 130], [376, 60]], 10, 3, 6, false);
  const pect = cr([[282, 260, 1], [266, 290], [250, 284], [262, 258, 1]]);
  const ticks: string[] = [];
  const tp = sampleCurve([[334, 198], [356, 130], [376, 60]], 8);
  for (let i = 1; i < tp.length - 1; i += 1) ticks.push(line(tp[i][0] - 5, tp[i][1] + 1, tp[i][0] + 4, tp[i][1] - 5));
  const spots: string[] = [];
  const r = rng(11);
  for (let i = 0; i < 26; i++) spots.push(ellipse(110 + r() * 190, 190 + r() * 34, 3 + r() * 4, 2 + r() * 2));
  const a = art([pect, tusk, body], [
    ...ticks.map((d) => inside(d, tusk)), ...spots.map((d) => inside(d, body)),
    inside(open([[340, 236], [300, 246], [240, 252], [160, 244]]), body), open([[344, 224], [326, 228]]),
  ], [circle(314, 212, 4)]);
  return tpl('narwhal', 'Narwhal', 'intermediate', ['narwhal', 'whale', 'arctic', 'realistic'], a, [], [...bubbles([[40, 120, 6], [60, 96, 4], [30, 80, 5]]), wave(20, 380, 340, 4, 40), wave(60, 340, 366, 4, 40)]);
}

function walrus(): Template {
  const body = cr([[82, 176], [80, 148], [100, 124], [134, 108], [170, 112], [204, 124], [260, 140], [318, 170], [352, 214], [364, 258], [374, 292, 1], [344, 300], [320, 314], [260, 318], [190, 318], [136, 302], [108, 260], [96, 222]]);
  const muzzle = cr([[64, 186], [70, 160], [98, 150], [126, 162], [130, 190], [112, 210], [80, 210]]);
  const tusks = [tube([[86, 204], [84, 250], [92, 296]], 13, 5, 6, false), tube([[110, 206], [112, 252], [122, 294]], 13, 5, 6, false)];
  const flipper = cr([[168, 286], [146, 330, 1], [200, 334, 1], [196, 290]]);
  const headW = cr([[58, 172], [68, 128], [108, 102], [150, 108], [176, 140], [172, 188], [142, 216], [96, 218]]);
  const ice = cr([[24, 324, 1], [376, 316, 1], [380, 350, 1], [26, 360, 1]]);
  const r = rng(5);
  const dots: string[] = [];
  for (let i = 0; i < 12; i++) dots.push(circle(78 + r() * 44, 166 + r() * 34, 1.8));
  const wr = [open([[150, 130], [160, 170], [150, 210]]), open([[180, 140], [188, 180], [182, 230]]), open([[250, 160], [256, 210], [246, 260]]), open([[300, 190], [306, 230], [300, 270]])];
  const whisk = [line(64, 182, 30, 176), line(64, 190, 28, 194), line(66, 198, 34, 212)];
  const a = art([muzzle, ...tusks, headW, flipper, body, ice], [
    ...dots.map((d) => inside(d, muzzle)), ...wr.map((d) => hide(inside(d, body), [headW])), inside(open([[150, 196], [160, 170], [162, 140]]), headW),
    inside(line(60, 340, 140, 338), ice), inside(line(240, 336, 330, 334), ice),
  ], [...eye(132, 136, 5), ...whisk, open([[78, 160], [84, 156], [90, 160]])]);
  return tpl('walrus', 'Walrus on the ice', 'intermediate', ['walrus', 'arctic', 'realistic'], a, [wave(20, 380, 376, 5, 40)]);
}

function otter(): Template {
  const head = cr([[54, 196], [62, 152], [100, 130], [142, 138], [166, 172], [162, 212], [130, 236], [84, 234]]);
  const earL = circle(76, 146, 10);
  const earR = circle(128, 136, 10);
  const body = cr([[130, 214], [168, 188], [230, 178], [292, 182], [334, 200], [348, 236], [320, 266], [240, 272], [170, 266], [136, 246]]);
  const feet = [cr([[300, 196], [294, 164], [304, 144, 1], [318, 150, 1], [332, 146, 1], [336, 170], [330, 198]]), cr([[326, 206], [334, 174], [348, 160, 1], [360, 170, 1], [372, 168, 1], [368, 192], [352, 214]])];
  const tail = tube([[340, 230], [362, 232], [378, 222]], 22, 10, 6);
  const shell = scallop(206, 196, 30, 7, 180);
  const paws = [ellipse(186, 186, 12, 9), ellipse(226, 188, 12, 9)];
  const water = cr([[20, 250, 1], [380, 250, 1], [380, 384, 1], [20, 384, 1]]);
  const fur: string[] = [];
  for (let i = 0; i < 9; i++) fur.push(line(176 + i * 16, 216 + (i % 2) * 6, 182 + i * 16, 226 + (i % 2) * 6));
  const otterArt = art([...paws, shell.sil[0] as string, shell.sil[1] as string, head, earL, earR, ...feet, body, tail], [
    ...shell.detail, ...fur.map((d) => inside(d, body)),
    inside(cr([[84, 196], [104, 182], [124, 196], [104, 212]]), head),
  ], [circle(92, 176, 4), circle(122, 172, 4), cr([[100, 190, 1], [112, 190, 1], [106, 198, 1]]), open([[106, 198], [100, 206], [92, 204]]), open([[106, 198], [112, 206], [120, 204]]),
    line(84, 196, 56, 190), line(84, 202, 56, 206), line(128, 192, 156, 184)]);
  const clipped: Art = { paths: otterArt.paths.map((d) => hide(d, [water])), detail: otterArt.detail.map((d) => hide(d, [water])), sil: otterArt.sil };
  const sea = [swell(20, 380, 252, 6, 40), wave(40, 360, 284, 5, 36), wave(80, 320, 312, 5, 36), wave(30, 200, 340, 4, 36), wave(220, 370, 360, 4, 36)];
  const ripples = [open([[150, 264], [200, 270], [250, 266]]), open([[270, 270], [310, 274], [340, 268]]), line(312, 160, 314, 176), line(322, 158, 324, 176), line(356, 176, 356, 190), line(364, 176, 362, 192)];
  return tpl('sea-otter', 'Floating sea otter', 'intermediate', ['otter', 'sea-otter', 'cute', 'stylized'], clipped, sea, ripples);
}

function anglerfish(): Template {
  const body = cr([[338, 168, 1], [304, 120], [244, 96], [182, 102], [132, 128], [100, 166], [80, 200, 1], [40, 168, 1], [52, 206], [40, 246, 1], [82, 226, 1], [118, 268], [188, 296], [262, 288], [346, 252, 1], [274, 212, 1]]);
  const fin = cr([[180, 220, 1], [150, 244], [140, 270, 1], [176, 258], [196, 232, 1]]);
  const teeth: string[] = [];
  const jaw = (a: P, b: P, n: number, dir: number) => {
    for (let i = 0; i < n; i++) {
      const t0 = (i + 0.15) / n;
      const t1 = (i + 0.85) / n;
      const p0: P = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const p1: P = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const m: P = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = (-(b[1] - a[1]) / len) * dir;
      const ny = ((b[0] - a[0]) / len) * dir;
      const h = i % 2 ? 12 : 18;
      teeth.push(`M ${f(p0[0])} ${f(p0[1])} L ${f(m[0] + nx * h)} ${f(m[1] + ny * h)} L ${f(p1[0])} ${f(p1[1])}`);
    }
  };
  jaw([338, 168], [274, 212], 5, -1);
  jaw([346, 252], [274, 212], 6, 1);
  const lure = open([[250, 100], [262, 56], [300, 30], [334, 40], [340, 58]]);
  const bulb = circle(340, 68, 10);
  const glow = [line(354, 60, 366, 54), line(356, 72, 370, 76), line(342, 84, 346, 98), line(326, 76, 316, 86)];
  const spines = [open([[200, 100], [196, 80]]), open([[176, 104], [168, 86]]), open([[154, 114], [144, 98]])];
  const r = rng(9);
  const speck: string[] = [];
  for (let i = 0; i < 20; i++) speck.push(circle(120 + r() * 150, 130 + r() * 130, 1.8));
  const a = art([bulb, fin, body], [...speck.map((d) => hide(inside(d, body), [fin])), ...glow, open([[240, 120], [222, 160], [228, 200]]),
    inside(line(50, 206, 82, 210), body), inside(line(56, 186, 84, 204), body), inside(line(56, 228, 84, 216), body)],
  [...eye(262, 146, 8), hide(lure, [bulb]), ...teeth, ...spines]);
  return tpl('anglerfish', 'Deep-sea anglerfish', 'intermediate', ['anglerfish', 'fish', 'deep-sea', 'stylized'], a, [], bubbles([[340, 330, 6], [360, 306, 4], [320, 300, 3]]));
}

// ---- advanced ---------------------------------------------------------------------------------

function humpback(): Template {
  const body = cr([[376, 206], [362, 192], [330, 184], [290, 180], [240, 178], [180, 182], [120, 192], [60, 206], [10, 216], [10, 252], [70, 252], [130, 258], [200, 264], [270, 258], [320, 246], [352, 232], [372, 216]]);
  const finPts: Q[] = [[286, 240], [262, 250]];
  for (let i = 0; i < 6; i++) finPts.push([236 - i * 22, 236 - i * 18 + (i % 2) * 5]);
  finPts.push([96, 112, 1], [138, 132], [180, 166], [222, 198], [256, 220], [278, 230]);
  const fin = cr(finPts);
  const grooves: string[] = [];
  for (let i = 0; i < 7; i++) grooves.push(inside(open([[368, 214 + i * 1.6], [330, 224 + i * 4], [270, 232 + i * 4], [200, 240 + i * 3.4]]), body));
  const tub: string[] = [];
  for (let i = 0; i < 11; i++) tub.push(circle(366 - i * 7, 196 - i * 1.3 + (i % 2) * 5, 2.6));
  const barn: string[] = [];
  const r = rng(21);
  for (let i = 0; i < 16; i++) barn.push(circle(130 + r() * 110, 150 + r() * 70, 1.6 + r() * 1.4));
  const knobs: string[] = [];
  for (let i = 0; i < 6; i++) knobs.push(circle(232 - i * 22, 230 - i * 18, 2.2));
  const whale = art([fin, body], [
    ...grooves, ...tub, ...barn.map((d) => inside(d, fin)), ...knobs.map((d) => inside(d, fin)),
    open([[372, 210], [330, 214], [282, 220]]),
    inside(open([[150, 196], [200, 204], [240, 200]]), body), inside(open([[90, 210], [130, 214], [170, 210]]), body),
  ], [circle(296, 214, 4)]);
  const w = place(whale, { deg: -48, x: 226, y: 168, s: 0.95 });
  const sea = cr([[0, 300, 1], [400, 300, 1], [400, 400, 1], [0, 400, 1]]);
  const clipped: Art = { paths: w.paths.map((d) => hide(d, [sea])), detail: w.detail.map((d) => hide(d, [sea])), sil: w.sil };
  // splash crown where the whale leaves the water: rounded lobes, tallest by the body
  const rs = rng(4);
  let splash = 'M 60 300';
  for (let i = 0; i < 10; i++) {
    const x = 60 + i * 26;
    const h = 18 + Math.sin((i / 9) * Math.PI) * 34 + rs() * 10;
    splash += ` C ${f(x + 4)} ${f(300 - h)} ${f(x + 14)} ${f(300 - h)} ${f(x + 18)} ${f(292 - rs() * 6)} Q ${f(x + 22)} ${f(296)} ${f(x + 26)} ${f(300)}`;
  }
  const drops: string[] = [];
  for (let i = 0; i < 40; i++) drops.push(circle(40 + rs() * 320, 150 + rs() * 120, 1.6 + rs() * 2.6));
  const keep = drops.filter((d) => hide(d, [...w.sil, sea]) === d && hide(d, [cr([[60, 300, 1], [320, 300, 1], [320, 230, 1], [60, 230, 1]])]) === d);
  const waves: string[] = [];
  for (let k = 0; k < 6; k++) waves.push(wave(20 + (k % 2) * 20, 380 - (k % 2) * 20, 314 + k * 12, 3 + (k % 3), 30 + k * 2));
  const spray: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 70 + i * 34;
    spray.push(open([[x, 276], [x - 6 + rs() * 12, 258 - rs() * 16], [x - 10 + rs() * 20, 244 - rs() * 20]]));
  }
  const ripple = [ellipse(200, 316, 150, 10), ellipse(200, 326, 178, 14)];
  return tpl('humpback-breach', 'Humpback whale breaching', 'advanced', ['whale', 'humpback', 'realistic'], clipped,
    [swell(20, 380, 300, 6, 40), splash],
    [...keep, ...waves, ...spray.map((d) => hide(d, w.sil)), ...ripple.map((d) => inside(hide(d, w.sil), sea))]);
}

/** Branching coral grown as a union of tubes from (x, y). */
function branchCoral(x: number, y: number, h: number, seed: number, depth = 3): string {
  const r = rng(seed);
  const tubes: string[] = [];
  const grow = (x0: number, y0: number, ang: number, len: number, w: number, d: number) => {
    const [x1, y1] = polar(x0, y0, len, ang);
    const [mx, my] = polar(x0, y0, len * 0.5, ang + (r() - 0.5) * 16);
    tubes.push(tube([[x0, y0], [mx, my], [x1, y1]], w, w * 0.78, 6));
    if (d <= 1) return;
    grow(x1, y1, ang - 18 - r() * 16, len * 0.72, w * 0.78, d - 1);
    grow(x1, y1, ang + 18 + r() * 16, len * 0.72, w * 0.78, d - 1);
  };
  grow(x, y, 0, h * 0.42, h * 0.16, depth);
  return union(tubes);
}

/** Brain coral dome with meandering grooves. */
function brainCoral(cx: number, base: number, rx: number, ry: number, seed: number): Art {
  const dome = cr([[cx - rx, base, 1], [cx - rx * 0.9, base - ry * 0.6], [cx - rx * 0.5, base - ry], [cx + rx * 0.5, base - ry], [cx + rx * 0.9, base - ry * 0.6], [cx + rx, base, 1]]);
  const r = rng(seed);
  const det: string[] = [];
  for (let k = 1; k <= 4; k++) {
    const yy = base - (ry * k) / 5;
    const half = rx * Math.sqrt(1 - Math.pow(k / 5.2, 2));
    let d = `M ${f(cx - half)} ${f(yy)}`;
    const n = 6 + k;
    for (let i = 0; i < n; i++) {
      const xa = cx - half + ((2 * half) * (i + 1)) / n;
      d += ` Q ${f(xa - half / n)} ${f(yy + (i % 2 ? -1 : 1) * (5 + r() * 4))} ${f(xa)} ${f(yy)}`;
    }
    det.push(inside(d, dome));
  }
  return { paths: [dome], detail: det, sil: [dome] };
}

/** Sea fan: fan outline on a stem with a lattice. */
function seaFan(x: number, y: number, s: number, seed: number): Art {
  const r = rng(seed);
  const crown: Q[] = [[x - 6 * s, y, 1], [x - 10 * s, y - 30 * s], [x - 50 * s, y - 60 * s], [x - 74 * s, y - 100 * s, 1]];
  for (let i = 1; i <= 6; i++) {
    const a = -62 + i * 18;
    const [px, py] = polar(x, y - 40 * s, (104 + r() * 14) * s, a - 9);
    const [qx, qy] = polar(x, y - 40 * s, 88 * s, a);
    crown.push([px, py], [qx, qy, 1]);
  }
  crown.push([x + 74 * s, y - 100 * s, 1], [x + 50 * s, y - 60 * s], [x + 10 * s, y - 30 * s], [x + 6 * s, y, 1]);
  const fan = cr(crown);
  const det: string[] = [];
  for (let i = -3; i <= 3; i++) {
    const [ex, ey] = polar(x, y - 40 * s, 100 * s, i * 18);
    const [mx, my] = polar(x, y - 40 * s, 50 * s, i * 16);
    det.push(inside(open([[x, y - 10 * s], [mx, my], [ex, ey]]), fan));
    const [bx, by] = polar(mx, my, 40 * s, i * 18 + 22);
    const [cx2, cy2] = polar(mx, my, 40 * s, i * 18 - 22);
    det.push(inside(line(mx, my, bx, by), fan), inside(line(mx, my, cx2, cy2), fan));
  }
  return { paths: [fan], detail: det, sil: [fan] };
}

/** Anemone: column with wavy tentacles on top. */
function anemone(x: number, y: number, s: number, seed: number): Art {
  const col = cr([[x - 22 * s, y, 1], [x - 18 * s, y - 30 * s], [x - 26 * s, y - 44 * s, 1], [x + 26 * s, y - 44 * s, 1], [x + 18 * s, y - 30 * s], [x + 22 * s, y, 1]]);
  const r = rng(seed);
  const tent: string[] = [];
  for (let i = 0; i < 9; i++) {
    const bx = x - 24 * s + i * 6 * s;
    const a = -60 + i * 15;
    const [mx, my] = polar(bx, y - 44 * s, 20 * s, a + (r() - 0.5) * 20);
    const [ex, ey] = polar(bx, y - 44 * s, 38 * s, a + (r() - 0.5) * 30);
    tent.push(tube([[bx, y - 44 * s], [mx, my], [ex, ey]], 7 * s, 3 * s, 6));
  }
  const all = [col, ...tent];
  return { paths: stack(all), detail: [inside(open([[x - 18 * s, y - 14 * s], [x, y - 10 * s], [x + 18 * s, y - 14 * s]]), col)], sil: all };
}

/** Tube sponge cluster. */
function sponge(x: number, y: number, s: number): Art {
  const tubes = [[0, 90], [-26, 66], [26, 74]].map(([dx, h]) => cr([[x + dx * s - 12 * s, y, 1], [x + dx * s - 14 * s, y - h * s, 1], [x + dx * s + 14 * s, y - h * s, 1], [x + dx * s + 12 * s, y, 1]]));
  const rims = [[0, 90], [-26, 66], [26, 74]].map(([dx, h]) => ellipse(x + dx * s, y - h * s, 14 * s, 5 * s));
  return { paths: stack([...rims, ...tubes]), detail: [], sil: [...rims, ...tubes] };
}

function reefFloor(seed: number): { sand: string; dots: string[] } {
  return { sand: swell(20, 380, 340, 8, 90), dots: speckle(24, 348, 376, 380, 46, seed) };
}

function coralReef(): Template {
  const f1 = place(fish(1), { s: 0.55, x: 110, y: 90 });
  const f2 = place(fish(0), { s: 0.5, x: 280, y: 70, flip: true });
  const f3 = place(fish(0), { s: 0.42, x: 330, y: 150, flip: true });
  const f4 = place(fish(1), { s: 0.4, x: 60, y: 170 });
  const brain = brainCoral(210, 352, 70, 56, 2);
  const an = anemone(310, 350, 1.1, 5);
  const fan = seaFan(110, 350, 1.05, 3);
  const br1 = branchCoral(250, 300, 160, 8, 3);
  const br2 = branchCoral(64, 352, 112, 13, 3);
  const sp = sponge(346, 352, 0.85);
  const star = seaStar(150, 362, 18, 10, 2);
  const brA: Art = { paths: [br1], detail: [], sil: [br1] };
  const brB: Art = { paths: [br2], detail: [], sil: [br2] };
  const scene = compose([f1, f2, f3, f4, star, brain, an, sp, fan, brA, brB]);
  const floor = reefFloor(14);
  const rocks = [rock(270, 352, 40, 18, 2), rock(70, 360, 30, 14, 5)];
  const back = compose([scene, { paths: rocks, detail: [], sil: rocks }]);
  const bub = bubbles([[200, 40, 7], [214, 64, 5], [196, 90, 4], [150, 140, 5], [160, 120, 3], [300, 210, 4], [320, 236, 6]]);
  const rays = [line(40, 20, 90, 140), line(140, 20, 170, 120), line(260, 20, 240, 110), line(360, 20, 320, 120)];
  return tpl('coral-reef', 'Coral reef scene', 'advanced', ['coral', 'reef', 'fish', 'tropical', 'scene', 'realistic'],
    back, [hide(floor.sand, back.sil)], [...floor.dots.map((d) => hide(d, back.sil)), ...bub.map((d) => hide(d, back.sil)), ...rays.map((d) => hide(d, back.sil))]);
}

function kelpForest(): Template {
  const stipes: Art[] = [];
  const xs = [64, 156, 250, 344];
  xs.forEach((x, k) => {
    const c: Q[] = [];
    for (let i = 0; i <= 6; i++) c.push([x + Math.sin(i * 0.9 + k * 2) * 18, 380 - i * 58]);
    const st = tube(c, 9, 6, 16);
    const pts = sampleCurve(c, 10);
    const blades: string[] = [];
    const det: string[] = [];
    for (let i = 5; i < pts.length - 2; i += 8) {
      const [px, py] = pts[i];
      const side = px < 120 ? 1 : px > 280 ? -1 : Math.round((i - 5) / 8) % 2 ? 1 : -1;
      const len = 52 + ((i * 7 + k * 13) % 20);
      const tip: P = [px + side * len, py - 30];
      const bl = cr([[px, py, 1], [px + side * len * 0.4, py - 22], [tip[0], tip[1], 1], [px + side * len * 0.55, py - 4]]);
      blades.push(bl);
      det.push(inside(open([[px, py], [px + side * len * 0.5, py - 16], [tip[0] - side * 6, tip[1] + 3]]), bl));
      det.push(circle(px + side * 7, py - 2, 4));
    }
    const all = [...blades, st];
    stipes.push({ paths: stack(all), detail: det, sil: all });
  });
  const school: Art[] = [];
  const rs = rng(6);
  for (let i = 0; i < 6; i++) school.push(place(fish(i % 2), { s: 0.26 + rs() * 0.06, x: 160 + (i % 3) * 36 + rs() * 10, y: 120 + Math.floor(i / 3) * 26 + rs() * 8 }));
  const seaS = place(sealSwim(), { s: 0.55, x: 270, y: 230, deg: -10 });
  const rocks = [rock(96, 366, 70, 18, 3), rock(250, 368, 86, 16, 8), rock(352, 366, 30, 16, 4)];
  const star = seaStar(244, 352, 14, 4, 1);
  const scene = compose([...school, seaS, star, stipes[1], stipes[2], stipes[0], stipes[3], { paths: rocks, detail: [], sil: rocks }]);
  const rays = [line(30, 20, 80, 160), line(100, 20, 140, 180), line(200, 20, 210, 150), line(300, 20, 270, 170), line(370, 20, 340, 150)];
  const bub = bubbles([[110, 60, 5], [118, 82, 3], [104, 96, 4], [330, 70, 5], [320, 96, 3]]);
  return tpl('kelp-forest', 'Kelp forest', 'advanced', ['kelp', 'seaweed', 'fish', 'seal', 'scene', 'realistic'], scene, [hide(wave(20, 380, 26, 4, 40), scene.sil)],
    [...rays.map((d) => hide(d, scene.sil)), ...bub.map((d) => hide(d, scene.sil)), ...speckle(24, 360, 376, 384, 30, 4, scene.sil)]);
}

/** Swimming seal facing right (for scenes). */
function sealSwim(): Art {
  const body = cr([[340, 196], [326, 178], [300, 172], [250, 176], [190, 186], [130, 200], [90, 210, 1], [60, 190, 1], [72, 214, 1], [58, 238, 1], [92, 222, 1], [140, 226], [200, 228], [260, 222], [310, 214], [336, 206]]);
  const flip = cr([[250, 218, 1], [232, 252], [218, 248, 1], [232, 220, 1]]);
  return art([flip, body], [inside(open([[150, 196], [200, 192], [250, 186]]), body)], [circle(318, 188, 4), line(336, 200, 360, 196), line(336, 204, 358, 210)]);
}

function tidePool(): Template {
  const rs = rng(31);
  const rim: string[] = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    const rx = 140 + rs() * 10;
    const ry = 136 + rs() * 10;
    rim.push(rock(200 + Math.cos(a) * rx, 200 + Math.sin(a) * ry, 32 + rs() * 8, 26 + rs() * 8, 40 + i));
  }
  const s1 = seaStar(130, 150, 42, 20, 3);
  const s2 = seaStar(268, 268, 34, -12, 2);
  const urch: string[] = [];
  const uc: P = [280, 128];
  const urchin = circle(uc[0], uc[1], 18);
  for (let i = 0; i < 22; i++) {
    const [x1, y1] = polar(uc[0], uc[1], 18, i * (360 / 22));
    const [x2, y2] = polar(uc[0], uc[1], 32, i * (360 / 22));
    urch.push(line(x1, y1, x2, y2));
  }
  const anem = (cx: number, cy: number, r: number, n: number): Art => {
    const disc = circle(cx, cy, r);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 360) / n;
      const [bx, by] = polar(cx, cy, r, a);
      const [mx, my] = polar(cx, cy, r * 1.5, a + 8);
      const [ex, ey] = polar(cx, cy, r * 1.9, a + 2);
      out.push(tube([[bx, by], [mx, my], [ex, ey]], 7, 3, 5));
    }
    return { paths: stack([disc, ...out]), detail: [circle(cx, cy, r * 0.35), ...[0, 1, 2, 3, 4, 5].map((i) => line(...polar(cx, cy, r * 0.45, i * 60), ...polar(cx, cy, r * 0.85, i * 60)))], sil: [disc, ...out] };
  };
  const a1 = anem(190, 250, 18, 11);
  const a2 = anem(118, 260, 13, 9);
  const crabA = place(crabSmall(), { s: 0.42, x: 236, y: 176, deg: 18 });
  const shells = [scallop(160, 316, 26, 7, 160), scallop(300, 200, 22, 7, -110)];
  const fishA = place(fish(0), { s: 0.35, x: 210, y: 120, deg: -15 });
  const fishB = place(fish(1), { s: 0.3, x: 98, y: 200, deg: 25 });
  const urchinArt: Art = { paths: [urchin], detail: urch, sil: [circle(uc[0], uc[1], 32)] };
  const pebbles: string[] = [];
  for (let i = 0; i < 14; i++) {
    const x = 90 + rs() * 220;
    const y = 90 + rs() * 220;
    pebbles.push(ellipse(x, y, 3 + rs() * 4, 2 + rs() * 3));
  }
  const life = compose([s1, s2, urchinArt, a1, a2, crabA, ...shells, fishA, fishB]);
  const rimArt: Art = { paths: rim, detail: [], sil: rim };
  const scene = compose([rimArt, life]);
  const rimDet: string[] = [];
  rim.forEach((d, i) => {
    const a = (i / 13) * Math.PI * 2;
    const cx = 200 + Math.cos(a) * 145;
    const cy = 200 + Math.sin(a) * 141;
    const k = i % 2 ? 1 : -1;
    if (i % 3 === 1) return;
    rimDet.push(inside(`M ${f(cx - 14 * k)} ${f(cy - 12)} L ${f(cx - 2 * k)} ${f(cy - 2)} L ${f(cx + 2 * k)} ${f(cy + 12)} M ${f(cx - 2 * k)} ${f(cy - 2)} L ${f(cx + 12 * k)} ${f(cy - 4)}`, d));
  });
  const water = [0, 1, 2, 3, 4].map((k) => open([[110 + k * 40, 100 + k * 46], [130 + k * 40, 96 + k * 46], [150 + k * 40, 100 + k * 46]]));
  return tpl('tide-pool', 'Rock pool life', 'advanced', ['tide-pool', 'starfish', 'anemone', 'crab', 'shell', 'coast', 'scene', 'realistic'], scene, [],
    [...rimDet, ...pebbles.map((d) => hide(d, scene.sil)), ...water.map((d) => hide(d, scene.sil))]);
}

/** Small crab from above, for scenes. */
function crabSmall(): Art {
  const body = ellipse(200, 220, 70, 46);
  const claws = [pincer(110, 150, 0.8, -30), pincer(290, 150, 0.8, 30, true)];
  const arms = [tube([[150, 200], [120, 180], [112, 172]], 16, 12, 5), tube([[250, 200], [280, 180], [288, 172]], 16, 12, 5)];
  const legs: string[] = [];
  for (let i = 0; i < 3; i++) {
    legs.push(tube([[150, 226 + i * 12], [104, 240 + i * 14], [90, 270 + i * 12]], 10, 5, 6));
    legs.push(tube([[250, 226 + i * 12], [296, 240 + i * 14], [310, 270 + i * 12]], 10, 5, 6));
  }
  const all = [body, ...claws, ...arms, ...legs];
  return { paths: [...stack(all), circle(182, 186, 6), circle(218, 186, 6)], detail: [inside(open([[160, 230], [200, 244], [240, 230]]), body)], sil: all };
}

function octopusArt(): Art {
  const head = cr([[200, 60], [254, 76], [280, 128], [270, 186], [236, 214], [164, 214], [130, 186], [120, 128], [146, 76]]);
  const spec: Q[][] = [
    [[146, 196], [96, 222], [56, 270], [60, 320], [92, 330], [100, 304]],
    [[170, 206], [146, 260], [132, 320], [150, 360], [178, 352]],
    [[200, 210], [204, 270], [196, 330], [214, 366], [238, 350]],
    [[230, 206], [262, 254], [294, 300], [330, 316], [340, 290]],
    [[254, 196], [304, 210], [346, 240], [372, 230], [362, 204]],
  ];
  const arms = spec.map((c) => tube(c, 40, 8, 18));
  const suck: string[] = [];
  spec.forEach((c, k) => {
    const pts = sampleCurve(c, 8);
    for (let i = 6; i < pts.length - 4; i += 3) suck.push(circle(pts[i][0] + (k % 2 ? 4 : -4), pts[i][1] + 3, Math.max(2, 6 - i * 0.12)));
  });
  const spots: string[] = [];
  const r = rng(12);
  for (let i = 0; i < 14; i++) spots.push(circle(150 + r() * 100, 80 + r() * 70, 2 + r() * 3));
  const all = [head, ...arms];
  return { paths: [...stack(all), ...eye(176, 150, 11), ...eye(224, 150, 11)], detail: [...spots.map((d) => inside(d, head)), ...suck.map((d) => hide(d, [head]))], sil: all };
}

function underwater(): Template {
  const oct = place(octopusArt(), { s: 0.6, x: 120, y: 278 });
  const jelly = (x: number, y: number, s: number): Art => {
    let bell = `M ${f(x - 30 * s)} ${f(y)} C ${f(x - 30 * s)} ${f(y - 44 * s)} ${f(x + 30 * s)} ${f(y - 44 * s)} ${f(x + 30 * s)} ${f(y)}`;
    for (let i = 0; i < 5; i++) {
      const xa = x + 30 * s - (60 * s * i) / 5;
      const xb = x + 30 * s - (60 * s * (i + 1)) / 5;
      bell += ` Q ${f((xa + xb) / 2)} ${f(y + 8 * s)} ${f(xb)} ${f(y)}`;
    }
    bell += ' Z';
    const ten: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c: Q[] = [];
      for (let k = 0; k <= 4; k++) c.push([x - 20 * s + i * 10 * s + Math.sin(k * 1.4 + i) * 5 * s, y + 4 * s + k * 18 * s]);
      ten.push(open(c));
    }
    return { paths: [bell], detail: [...ten, inside(open([[x - 18 * s, y - 12 * s], [x, y - 24 * s], [x + 18 * s, y - 12 * s]]), bell)], sil: [bell] };
  };
  const jellies = [jelly(300, 80, 1.2), jelly(350, 150, 0.8), jelly(250, 150, 0.7)];
  const school: Art[] = [];
  const rs = rng(17);
  for (let i = 0; i < 8; i++) school.push(place(fish(i % 2), { s: 0.28, flip: true, x: 90 + i * 22 + rs() * 8, y: 96 + (i % 3) * 22 + rs() * 6 }));
  const big = place(fish(1), { s: 0.62, x: 316, y: 250, flip: true });
  const crabU = place(crabSmall(), { s: 0.3, x: 300, y: 340 });
  const rocks = [rock(116, 362, 88, 20, 22), rock(300, 366, 80, 16, 23)];
  const weeds = [weed(240, 378, 110, 16, 22, 2), weed(262, 378, 80, 14, 16, 5), weed(356, 378, 120, 16, 26, 8), weed(46, 378, 90, 14, 18, 1)];
  const weedArt: Art = { paths: stack(weeds), detail: [], sil: weeds };
  const scene = compose([oct, crabU, ...jellies, big, ...school, weedArt, { paths: rocks, detail: [], sil: rocks }]);
  const surface = [swell(20, 380, 24, 5, 40), wave(30, 370, 40, 3, 30)];
  const rays = [line(60, 46, 110, 200), line(150, 46, 170, 180), line(220, 46, 214, 170)];
  const bub = bubbles([[120, 220, 5], [128, 196, 4], [116, 176, 3], [130, 156, 2.5], [200, 260, 4], [206, 240, 3]]);
  return tpl('underwater', 'Underwater world', 'advanced', ['octopus', 'jellyfish', 'crab', 'fish', 'kelp', 'scene', 'stylized'], scene, surface.map((d) => hide(d, scene.sil)),
    [...rays.map((d) => hide(d, scene.sil)), ...bub.map((d) => hide(d, scene.sil)), ...speckle(30, 366, 370, 380, 20, 9, scene.sil)]);
}

function turtleReef(): Template {
  const t = place(turtleTop(), { s: 0.62, deg: 62, x: 236, y: 132 });
  const extra: string[] = [];
  const rs = rng(40);
  const brain = brainCoral(278, 356, 58, 48, 7);
  const fanA = seaFan(88, 358, 0.76, 6);
  const br = branchCoral(180, 362, 130, 22, 3);
  const an = anemone(334, 362, 0.7, 9);
  const sp = sponge(122, 360, 0.75);
  const f1 = place(fish(1), { s: 0.38, x: 70, y: 120 });
  const f2 = place(fish(0), { s: 0.34, x: 110, y: 160 });
  const f3 = place(fish(0), { s: 0.3, x: 330, y: 250, flip: true });
  const scene = compose([t, f1, f2, f3, brain, an, sp, fanA, { paths: [br], detail: [], sil: [br] }]);
  for (let i = 0; i < 30; i++) extra.push(circle(30 + rs() * 340, 30 + rs() * 220, 1.6 + rs() * 1.8));
  const sand = speckle(24, 362, 376, 384, 36, 41, scene.sil);
  const tex: string[] = [];
  for (let i = 0; i < 40; i++) tex.push(circle(160 + rs() * 150, 70 + rs() * 130, 1.6));
  return tpl('turtle-reef', 'Sea turtle over the reef', 'advanced', ['turtle', 'sea-turtle', 'coral', 'reef', 'fish', 'scene', 'realistic'], scene,
    [hide(swell(20, 380, 352, 6, 90), scene.sil)],
    [...extra.filter((d) => hide(d, scene.sil) === d), ...sand, ...tex.map((d) => inside(d, t.sil[2] as string)).filter(Boolean), ...tex.slice(0, 20).map((d) => inside(d, t.sil[3] as string)).filter(Boolean)]);
}

function shellCollection(): Template {
  const sc = scallop(110, 168, 88, 13, 0, 4);
  // turret shell: stacked whorls narrowing to a point
  const turret: string[] = [];
  const tdet: string[] = [];
  for (let i = 0; i < 6; i++) {
    const y = 42 + i * 22;
    const w = 8 + i * 9;
    turret.push(cr([[300 - w, y + 22, 1], [300 - w - 4, y + 10], [300 - w * 0.6, y, 1], [300 + w * 0.6, y, 1], [300 + w + 4, y + 10], [300 + w, y + 22, 1]]));
  }
  const tAll = turret.slice().reverse();
  const tAperture = ellipse(300, 196, 30, 16);
  for (let i = 0; i < 6; i++) for (let k = -2; k <= 2; k++) tdet.push(line(300 + k * (4 + i * 3), 46 + i * 22, 300 + k * (5 + i * 3.6), 62 + i * 22));
  const turretArt: Art = { paths: stack([tAperture, ...tAll]), detail: tdet.map((d) => inside(d, union(turret))).filter(Boolean), sil: [tAperture, ...turret] };
  // cowrie: glossy oval with toothed slit
  const cow = ellipse(96, 300, 64, 40);
  const slit = open([[40, 300], [70, 296], [100, 304], [130, 296], [154, 300]]);
  const teeth: string[] = [];
  for (let i = 0; i < 9; i++) teeth.push(line(52 + i * 12, 292, 54 + i * 12, 284), line(52 + i * 12, 308, 54 + i * 12, 316));
  const spotsC: string[] = [];
  const r = rng(51);
  for (let i = 0; i < 14; i++) spotsC.push(circle(56 + r() * 80, 270 + r() * 14, 2 + r() * 2));
  const cowArt: Art = { paths: [cow], detail: [slit, ...teeth.map((d) => inside(d, cow)), ...spotsC.map((d) => inside(d, cow))], sil: [cow] };
  // sand dollar: disc with five-petal flower
  const dollar = circle(212, 300, 50);
  const pet: string[] = [];
  for (let i = 0; i < 5; i++) {
    const [tx, ty] = polar(212, 300, 34, i * 72);
    const [lx, ly] = polar(212, 300, 18, i * 72 - 16);
    const [rx2, ry2] = polar(212, 300, 18, i * 72 + 16);
    pet.push(cr([[212, 300, 1], [lx, ly], [tx, ty, 1], [rx2, ry2]]));
    for (let k = 1; k <= 3; k++) {
      const [ax, ay] = polar(212, 300, 8 + k * 7, i * 72 - 10);
      const [bx, by] = polar(212, 300, 8 + k * 7, i * 72 + 10);
      pet.push(line(ax, ay, bx, by));
    }
  }
  for (let i = 0; i < 18; i++) {
    const [x, y] = polar(212, 300, 42, i * 20 + 10);
    pet.push(circle(x, y, 1.6));
  }
  const dollarArt: Art = { paths: [dollar], detail: pet, sil: [dollar] };
  // spiral whelk seen from the top
  const whelk = cr([[326, 252], [362, 266], [372, 304], [350, 342], [310, 352], [276, 330], [272, 292], [292, 262]]);
  const whelkD: string[] = [];
  let sp = 'M 320 300';
  for (let k = 1; k <= 7; k++) {
    const rr = k * 5.6;
    const ang = k * 180;
    const [x, y] = polar(320, 300, rr, ang);
    sp += ` A ${f(rr * 0.75)} ${f(rr * 0.75)} 0 0 1 ${f(x)} ${f(y)}`;
  }
  whelkD.push(inside(sp, whelk));
  for (let i = 0; i < 16; i++) {
    const [ax, ay] = polar(320, 300, 14, i * 22.5);
    const [bx, by] = polar(320, 300, 44, i * 22.5 + 14);
    whelkD.push(inside(line(ax, ay, bx, by), whelk));
  }
  const whelkArt: Art = { paths: [whelk], detail: whelkD, sil: [whelk] };
  // clam with growth rings
  const clam = cr([[150, 220], [176, 206], [210, 210], [236, 230], [232, 254], [192, 262], [150, 254], [140, 236]]);
  const rings: string[] = [];
  for (let k = 1; k <= 5; k++) rings.push(inside(open([[150 + k * 3, 222 + k * 5], [190, 214 + k * 7], [232 - k * 3, 232 + k * 4]]), clam));
  const clamArt: Art = { paths: [clam], detail: rings, sil: [clam] };
  const scene = compose([sc, turretArt, cowArt, dollarArt, whelkArt, clamArt]);
  const sand = speckle(24, 24, 376, 376, 70, 52, scene.sil);
  return tpl('shell-collection', 'Seashell collection', 'advanced', ['shell', 'seashell', 'beach', 'scallop', 'vintage', 'realistic'], scene, [], sand);
}

export const sealife: Template[] = [
  simpleTurtle(), starfish(), jellyfish(), crab(), bandedFish(), pufferfish(), simpleOctopus(), scallopShell(), jumpingDolphin(), shrimp(),
  orca(), shark(), hammerhead(), manta(), seahorse(), seaTurtle(), angelfish(), lobster(), squid(), seal(), narwhal(), walrus(), otter(), anglerfish(),
  humpback(), turtleReef(), coralReef(), kelpForest(), tidePool(), underwater(), shellCollection(),
];
