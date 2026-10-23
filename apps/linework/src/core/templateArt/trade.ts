// Trade & workshop pack (owner 23 Oct 2026, fb-1023b): exact-angle layout guides for engineers, boilermakers,
// carpenters and makers. Linework Plus only (src/plus/access.ts). Every angle is computed, so it is exact on any
// trace (angles do not depend on scale); lengths are NOT to scale on paper, and the detail sheet says so.
// Original technical line art. Labels are drawn with a tiny single-stroke digit font so they trace cleanly.
import type { Template, TemplateLevel } from '../templates.ts';
import { f, line, poly, type P } from './draw.ts';

const VB = '0 0 400 400';
const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------------------------- geometry helpers

/** Point at `deg` (counter-clockwise from +x, screen y down) and radius r from (cx, cy). */
function at(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.cos(deg * RAD), cy - r * Math.sin(deg * RAD)];
}

/** Circle as two arcs. */
function circle(cx: number, cy: number, r: number): string {
  return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
}

/** Arc from angle a to b (degrees, counter-clockwise) at radius r. */
function arc(cx: number, cy: number, r: number, a: number, b: number): string {
  const [x1, y1] = at(cx, cy, r, a);
  const [x2, y2] = at(cx, cy, r, b);
  const large = Math.abs(b - a) > 180 ? 1 : 0;
  // counter-clockwise in math terms is sweep 0 in SVG (y down)
  return `M ${f(x1)} ${f(y1)} A ${f(r)} ${f(r)} 0 ${large} 0 ${f(x2)} ${f(y2)}`;
}

function ray(cx: number, cy: number, r: number, deg: number, r0 = 0): string {
  const [x0, y0] = at(cx, cy, r0, deg);
  const [x1, y1] = at(cx, cy, r, deg);
  return line(x0, y0, x1, y1);
}

/** Right-angle box marker at a vertex between two perpendicular directions. */
function rightMark(vx: number, vy: number, a: number, b: number, s = 18): string {
  const p1 = at(vx, vy, s, a);
  const p3 = at(vx, vy, s, b);
  const p2: P = [p1[0] + p3[0] - vx, p1[1] + p3[1] - vy];
  return poly([p1, p2, p3], false);
}

// ---------------------------------------------------------------------------------------- single-stroke labels

// Glyphs on a 6 x 10 cell (x right, y down), as polylines.
const GLYPHS: Record<string, readonly (readonly P[])[]> = {
  '0': [[[1, 0], [5, 0], [6, 1], [6, 9], [5, 10], [1, 10], [0, 9], [0, 1], [1, 0]]],
  '1': [[[1.5, 2], [3.5, 0], [3.5, 10]], [[1.5, 10], [5.5, 10]]],
  '2': [[[0, 2], [1, 0], [5, 0], [6, 1.5], [6, 3.5], [0, 10], [6, 10]]],
  '3': [[[0, 0], [6, 0], [3, 4], [5, 4], [6, 5.5], [6, 8.5], [5, 10], [1, 10], [0, 9]]],
  '4': [[[4.5, 10], [4.5, 0], [0, 7], [6, 7]]],
  '5': [[[6, 0], [0.5, 0], [0, 4.5], [4.5, 4], [6, 5.5], [6, 8.5], [5, 10], [1, 10], [0, 9]]],
  '6': [[[5.5, 0], [2, 0], [0, 3], [0, 9], [1, 10], [5, 10], [6, 9], [6, 6], [5, 5], [1, 5], [0, 6]]],
  '7': [[[0, 0], [6, 0], [2, 10]]],
  '8': [[[1, 0], [5, 0], [6, 1], [6, 3.5], [5, 4.6], [1, 4.6], [0, 3.5], [0, 1], [1, 0]], [[1, 4.6], [0, 5.8], [0, 9], [1, 10], [5, 10], [6, 9], [6, 5.8], [5, 4.6]]],
  '9': [[[6, 4], [5, 5], [1, 5], [0, 4], [0, 1], [1, 0], [5, 0], [6, 1], [6, 7], [4, 10], [0.5, 10]]],
  '.': [[[1.8, 7.8], [4.2, 7.8], [4.2, 10], [1.8, 10], [1.8, 7.8]], [[1.8, 8.9], [4.2, 8.9]]],
  ':': [[[1.8, 1.6], [4.2, 1.6], [4.2, 3.8], [1.8, 3.8], [1.8, 1.6]], [[1.8, 2.7], [4.2, 2.7]], [[1.8, 7.8], [4.2, 7.8], [4.2, 10], [1.8, 10], [1.8, 7.8]], [[1.8, 8.9], [4.2, 8.9]]],
  '°': [[[1, 0], [3, 0], [4, 1], [4, 3], [3, 4], [1, 4], [0, 3], [0, 1], [1, 0]]],
  '-': [[[1, 5], [5, 5]]],
};

/** Text as stroked paths. (x, y) is the centre of the label; h is the cap height. */
export function label(text: string, x: number, y: number, h = 18): string[] {
  const k = h / 10;
  const adv = (ch: string) => (ch === '°' ? 5 : ch === '.' || ch === ':' ? 4 : 8) * k;
  const width = [...text].reduce((w, ch) => w + adv(ch), 0) - 2 * k;
  let cx = x - width / 2;
  const top = y - h / 2;
  const out: string[] = [];
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (g) for (const pl of g) out.push(poly(pl.map(([gx, gy]) => [cx + gx * k, top + gy * k] as P), false));
    cx += adv(ch);
  }
  return out;
}

const deg = (a: number) => `${Number.isInteger(a) ? a : a.toFixed(1)}°`;

// ------------------------------------------------------------------------------------------------- the pack

type Spec = { id: string; name: string; level: TemplateLevel; tags: string[]; paths: string[]; detail?: string[] };

/** Sub-category from the id (src/core/tradeSubs.ts). */
function subFor(id: string): string {
  if (/^(angle-|protractor|set-square)/.test(id)) return 'angles';
  if (/^(dovetail|finger-joint|mitre-)/.test(id)) return 'carpentry';
  if (/^(roof-pitch|stair-stringer|square-check)/.test(id)) return 'framing';
  if (/^(weld-|bolt-circle)/.test(id)) return 'metal';
  if (/^pipe-/.test(id)) return 'pipe';
  if (/^(herringbone|chevron)/.test(id)) return 'tiling';
  if (/^grid-iso/.test(id)) return 'drafting';
  return 'layout';
}

function make(s: Spec): Template {
  return {
    id: `trade-${s.id}`,
    name: s.name,
    category: 'trade',
    level: s.level,
    tags: ['trade', 'workshop', 'angle', `sub-${subFor(s.id)}`, ...s.tags],
    viewBox: VB,
    strokeWidth: 3,
    detailWidth: 1.6,
    paths: s.paths,
    ...(s.detail && s.detail.length ? { detail: s.detail } : {}),
  };
}

/** Angle guide: baseline + ray at `a`, arc, label. */
function angleGuide(a: number): Spec {
  const vx = a > 100 ? 250 : 80;
  const vy = 300;
  const r = a > 100 ? 160 : 260;
  const paths = [a > 100 ? line(vx - 110, vy, vx + 110, vy) : ray(vx, vy, r, 0), ray(vx, vy, r, a)];
  const arcR = a > 100 ? 60 : 90;
  const detail = a === 90 ? [rightMark(vx, vy, 0, 90, 26)] : [arc(vx, vy, arcR, 0, a)];
  const mid = at(vx, vy, arcR + 36, a / 2);
  const lab = label(deg(a), mid[0] + (a > 100 ? 0 : 12), mid[1] - (a > 100 ? 8 : 0), 20);
  return {
    id: `angle-${String(a).replace('.', '-')}`,
    name: `${deg(a)} angle guide`,
    level: 'beginner',
    tags: ['angle-guide', 'carpentry', 'metalwork', a === 45 || a === 22.5 ? 'mitre' : 'bevel'],
    paths: [...paths, ...lab],
    detail,
  };
}

function protractorHalf(step: number, id: string, name: string, level: TemplateLevel): Spec {
  const cx = 200, cy = 300, R = 170;
  const paths = [arc(cx, cy, R, 0, 180), line(cx - R, cy, cx + R, cy)];
  const detail: string[] = [];
  for (let a = 0; a <= 180; a += step) {
    const long = a % 30 === 0;
    detail.push(ray(cx, cy, R, a, long ? R - 26 : R - 14));
  }
  for (let a = 0; a <= 180; a += 30) {
    const p = at(cx, cy, R - 44, a);
    paths.push(...label(String(a), p[0], p[1], 12));
  }
  detail.push(ray(cx, cy, 30, 90, 0), circle(cx, cy, 4));
  return { id, name, level, tags: ['protractor', 'measuring', 'degrees'], paths, detail };
}

function fan(step: number, max: number, id: string, name: string, level: TemplateLevel): Spec {
  const vx = 70, vy = 330, R = 270;
  const paths: string[] = [];
  const detail: string[] = [];
  for (let a = 0; a <= max; a += step) {
    (a % 15 === 0 ? paths : detail).push(ray(vx, vy, a % 15 === 0 ? R : R - 30, a));
    if (a % 15 === 0 && a > 0 && a < max) {
      const p = at(vx, vy, R + 2, a);
      paths.push(...label(String(a), p[0] + 14, p[1] - 4, 11));
    }
  }
  detail.push(arc(vx, vy, 60, 0, max), arc(vx, vy, 140, 0, max));
  return { id, name, level, tags: ['angle-fan', 'layout', 'degrees'], paths, detail };
}

function setSquare(kind: '45' | '30-60'): Spec {
  const A: P = [70, 320];
  const base = 260;
  const angB = kind === '45' ? 45 : 30; // angle at the far end of the base
  const height = base * Math.tan(angB * RAD);
  const scale = Math.min(1, 260 / height);
  const bw = base * scale;
  const hh = height * scale;
  const b: P = [A[0] + bw, A[1]];
  const c: P = [A[0], A[1] - hh];
  const paths = [poly([A, b, c]), rightMark(A[0], A[1], 0, 90, 24)];
  // inner cut-out, same angles, like a real set square
  const k = 0.45;
  const ia: P = [A[0] + 26, A[1] - 26];
  const detail = [poly([ia, [ia[0] + bw * k, ia[1]], [ia[0], ia[1] - hh * k]])];
  detail.push(arc(b[0], b[1], 50, 180 - angB, 180));
  const lb = at(b[0], b[1], 86, 180 - angB / 2);
  paths.push(...label(deg(angB), lb[0], lb[1], 16));
  const angC = 90 - angB;
  const lc = at(c[0], c[1], 74, 270 + angC / 2);
  paths.push(...label(deg(angC), lc[0] + 6, lc[1], 16));
  return {
    id: kind === '45' ? 'set-square-45' : 'set-square-30-60',
    name: kind === '45' ? '45° set square' : '30° / 60° set square',
    level: 'beginner',
    tags: ['set-square', 'triangle', 'drafting'],
    paths,
    detail,
  };
}

function pythag(a: number, b: number, c: number, level: TemplateLevel): Spec {
  const s = Math.min(240 / a, 260 / b);
  const A: P = [80, 330];
  const B: P = [80 + b * s, 330];
  const C: P = [80, 330 - a * s];
  const paths = [poly([A, B, C]), rightMark(A[0], A[1], 0, 90, 22)];
  paths.push(...label(String(b), (A[0] + B[0]) / 2, 352, 16));
  paths.push(...label(String(a), 52, (A[1] + C[1]) / 2, 16));
  paths.push(...label(String(c), (B[0] + C[0]) / 2 + 22, (B[1] + C[1]) / 2 - 14, 16));
  const detail: string[] = [];
  for (let i = 1; i < b; i++) detail.push(line(A[0] + i * s, 330, A[0] + i * s, 320));
  for (let i = 1; i < a; i++) detail.push(line(80, 330 - i * s, 90, 330 - i * s));
  return {
    id: `square-check-${a}-${b}-${c}`,
    name: `${a}-${b}-${c} square check`,
    level,
    tags: ['square', 'right-angle', 'set-out', 'carpentry'],
    paths,
    detail,
  };
}

function mitreCorner(a: number, sides: number): Spec {
  // Two frame members meeting at a corner of a regular polygon; the mitre line bisects the corner.
  const interior = 180 - 360 / sides;
  const L = sides >= 8 ? 150 : 190, w = 40;
  // keep both members inside the 400 box: shift the corner right by how far the second member reaches left
  const vx = 40 + Math.max(0, -L * Math.cos(interior * RAD)) + w, vy = 330;
  const u0 = 0, u1 = interior; // member directions from the corner
  const p = (d: number, r: number, off: number): P => {
    const [x, y] = at(vx, vy, r, d);
    const n = d + 90;
    return [x + off * Math.cos(n * RAD), y - off * Math.sin(n * RAD)];
  };
  const inner = (d: number, sign: number) => p(d, L, sign * w);
  const mitreDir = interior / 2;
  const outerCorner = at(vx, vy, w / Math.sin(mitreDir * RAD), mitreDir);
  const paths = [
    poly([[vx, vy], p(u0, L, 0)], false),
    poly([outerCorner, inner(u0, 1)], false),
    poly([[vx, vy], p(u1, L, 0)], false),
    poly([outerCorner, inner(u1, -1)], false),
    line(vx, vy, outerCorner[0], outerCorner[1]),
  ];
  const lab = at(vx, vy, 120, mitreDir);
  paths.push(...label(deg(a), lab[0] + 20, lab[1], 18));
  return {
    id: `mitre-${String(a).replace('.', '-')}-${sides}`,
    name: `${deg(a)} mitre for a ${sides}-sided frame`,
    level: 'intermediate',
    tags: ['mitre', 'frame', 'joinery', 'carpentry'],
    paths,
    detail: [arc(vx, vy, 40, 0, mitreDir)],
  };
}

function circleDivision(n: number, level: TemplateLevel): Spec {
  const cx = 200, cy = 200, R = 160;
  const paths = [circle(cx, cy, R), circle(cx, cy, 5)];
  const detail: string[] = [];
  for (let i = 0; i < n; i++) paths.push(ray(cx, cy, R, 90 + (360 / n) * i, 8));
  detail.push(circle(cx, cy, R * 0.55));
  const p = at(cx, cy, R * 0.32, 90 + 180 / n);
  paths.push(...label(deg(360 / n), p[0], p[1], 14));
  return {
    id: `circle-divide-${n}`,
    name: `Circle divided into ${n}`,
    level,
    tags: ['circle', 'division', 'centre', 'layout'],
    paths,
    detail,
  };
}

function polygon(n: number, nameWord: string): Spec {
  const cx = 200, cy = 205, R = 160;
  const pts: P[] = [];
  for (let i = 0; i < n; i++) pts.push(at(cx, cy, R, 90 + (360 / n) * i));
  const interior = 180 - 360 / n;
  const detail = [circle(cx, cy, R), circle(cx, cy, 4)];
  for (const q of pts) detail.push(line(cx, cy, q[0], q[1]));
  const paths = [poly(pts), ...label(deg(interior), cx, cy + R * 0.42, 16)];
  return {
    id: `layout-${nameWord}`,
    name: `${nameWord[0]!.toUpperCase()}${nameWord.slice(1)} layout`,
    level: n > 6 ? 'intermediate' : 'beginner',
    tags: ['polygon', nameWord, 'layout', 'metalwork'],
    paths,
    detail,
  };
}

function boltCircle(n: number): Spec {
  const cx = 200, cy = 200, R = 170;
  const pcd = n > 6 ? 128 : n > 4 ? 118 : 108;
  const hole = n > 6 ? 11 : n > 4 ? 14 : 19;
  const paths = [circle(cx, cy, R), circle(cx, cy, n > 6 ? 70 : n > 4 ? 52 : 40)];
  if (n > 6) paths.push(circle(cx, cy, 92)); // raised face
  if (n === 4) paths.push(poly([at(cx, cy, 40, 45), at(cx, cy, 40, 135), at(cx, cy, 40, 225), at(cx, cy, 40, 315)]));
  for (let i = 0; i < n; i++) {
    const [x, y] = at(cx, cy, pcd, (n === 4 ? 45 : 90) + (360 / n) * i);
    paths.push(circle(x, y, hole));
  }
  const detail = [circle(cx, cy, pcd)];
  for (let i = 0; i < n; i++) detail.push(ray(cx, cy, R - 6, 90 + (360 / n) * i, 60));
  return {
    id: `bolt-circle-${n}`,
    name: `${n}-hole bolt circle flange`,
    level: n > 6 ? 'advanced' : 'intermediate',
    tags: ['bolt-circle', 'flange', 'holes', 'metalwork'],
    paths,
    detail,
  };
}

function dovetail(ratio: number, tails: number): Spec {
  const slope = Math.atan(1 / ratio) / RAD; // angle of the tail side from the board edge's normal
  const x0 = 50, x1 = 350, top = 110, bot = 250;
  const h = bot - top;
  const dx = h / ratio;
  const pts: P[] = [[x0, bot]];
  const pitch = (x1 - x0) / tails;
  for (let i = 0; i < tails; i++) {
    const c = x0 + pitch * (i + 0.5);
    const half = pitch * 0.28;
    pts.push([c - half, bot], [c - half - dx, top], [c + half + dx, top], [c + half, bot]);
  }
  pts.push([x1, bot]);
  const paths = [poly(pts, false), line(x0, bot, x0, 330), line(x1, bot, x1, 330), line(x0, 330, x1, 330)];
  paths.push(...label(`1:${ratio}`, 200, 60, 20));
  const detail = [line(x0, top, x1, top)];
  const mid = x0 + pitch * 0.5 - pitch * 0.28;
  detail.push(arc(mid, bot, 40, 90, 90 + slope));
  return {
    id: `dovetail-1-${ratio}-${tails}`,
    name: `Dovetail layout 1:${ratio}, ${tails} tails`,
    level: tails > 2 ? 'advanced' : 'intermediate',
    tags: ['dovetail', 'joinery', 'woodwork', 'carpentry'],
    paths,
    detail,
  };
}

function fingerJoint(): Spec {
  const x0 = 50, x1 = 350, y = 200, d = 50, n = 6;
  const w = (x1 - x0) / n;
  const pts: P[] = [[x0, y + 110]];
  for (let i = 0; i < n; i++) {
    const up = i % 2 === 0;
    pts.push([x0 + i * w, up ? y : y + d], [x0 + (i + 1) * w, up ? y : y + d]);
  }
  pts.push([x1, y + 110]);
  return {
    id: 'finger-joint',
    name: 'Finger joint layout',
    level: 'intermediate',
    tags: ['finger-joint', 'box-joint', 'joinery', 'woodwork'],
    paths: [poly(pts, false), line(x0, y + 110, x1, y + 110)],
    detail: [line(x0, y - 30, x1, y - 30)],
  };
}

function roofPitch(a: number): Spec {
  const base = 300, x0 = 50, y0 = 320;
  const h = Math.min(220, (base / 2) * Math.tan(a * RAD));
  const half = h / Math.tan(a * RAD);
  const apex: P = [x0 + half, y0 - h];
  const paths = [poly([[x0, y0], apex, [x0 + 2 * half, y0]], false), line(x0 - 10, y0, x0 + 2 * half + 10, y0)];
  const detail = [line(apex[0], apex[1], apex[0], y0), rightMark(apex[0], y0, 0, 90, 14), arc(x0, y0, 70, 0, a)];
  paths.push(...label(deg(a), x0 + half, y0 + 34, 18));
  return {
    id: `roof-pitch-${String(a).replace('.', '-')}`,
    name: `${deg(a)} roof pitch`,
    level: 'beginner',
    tags: ['roof-pitch', 'rafter', 'framing', 'carpentry'],
    paths,
    detail,
  };
}

function stairStringer(a: number): Spec {
  const steps = 5;
  const run = 52;
  const rise = run * Math.tan(a * RAD);
  const x0 = 50, y0 = 340;
  const pts: P[] = [[x0, y0]];
  for (let i = 0; i < steps; i++) {
    pts.push([x0 + i * run, y0 - (i + 1) * rise], [x0 + (i + 1) * run, y0 - (i + 1) * rise]);
  }
  const end = pts[pts.length - 1]!;
  const paths = [poly(pts, false), line(x0, y0, end[0], end[1] + rise * 0), line(x0, y0, x0 + steps * run, y0)];
  paths.push(...label(deg(a), 300, y0 - 20, 18));
  const detail = [arc(x0, y0, 60, 0, a), line(x0, y0, x0 + steps * run, y0 - steps * rise)];
  return {
    id: `stair-stringer-${a}`,
    name: `Stair stringer at ${deg(a)}`,
    level: 'intermediate',
    tags: ['stairs', 'stringer', 'framing', 'carpentry'],
    paths,
    detail,
  };
}

/** Weld preparation cross-sections (schematic outlines). */
function weld(kind: 'single-v' | 'double-v' | 'single-bevel' | 'j' | 'u' | 'fillet'): Spec {
  const y0 = 150, t = 100, gap = 8, half = 30; // 60-degree included angle => 30 each side
  const L = 130;
  const off = t * Math.tan(half * RAD);
  const cx = 200;
  let paths: string[] = [];
  let name = '';
  if (kind === 'single-v') {
    paths = [
      poly([[cx - gap / 2 - L, y0], [cx - gap / 2 - off, y0], [cx - gap / 2, y0 + t], [cx - gap / 2 - L, y0 + t]]),
      poly([[cx + gap / 2 + L, y0], [cx + gap / 2 + off, y0], [cx + gap / 2, y0 + t], [cx + gap / 2 + L, y0 + t]]),
    ];
    name = 'Single-V butt weld prep (60°)';
  } else if (kind === 'double-v') {
    const o = (t / 2) * Math.tan(half * RAD);
    paths = [
      poly([[cx - gap / 2 - L, y0], [cx - gap / 2 - o, y0], [cx - gap / 2, y0 + t / 2], [cx - gap / 2 - o, y0 + t], [cx - gap / 2 - L, y0 + t]]),
      poly([[cx + gap / 2 + L, y0], [cx + gap / 2 + o, y0], [cx + gap / 2, y0 + t / 2], [cx + gap / 2 + o, y0 + t], [cx + gap / 2 + L, y0 + t]]),
    ];
    name = 'Double-V butt weld prep (60°)';
  } else if (kind === 'single-bevel') {
    const o = t * Math.tan(45 * RAD);
    paths = [
      poly([[cx - gap / 2 - L, y0], [cx - gap / 2, y0], [cx - gap / 2, y0 + t], [cx - gap / 2 - L, y0 + t]]),
      poly([[cx + gap / 2 + L, y0], [cx + gap / 2 + o, y0], [cx + gap / 2, y0 + t], [cx + gap / 2 + L, y0 + t]]),
    ];
    name = 'Single-bevel weld prep (45°)';
  } else if (kind === 'j') {
    const r = 26;
    paths = [
      poly([[cx - gap / 2 - L, y0], [cx - gap / 2, y0], [cx - gap / 2, y0 + t], [cx - gap / 2 - L, y0 + t]]),
      `M ${f(cx + gap / 2 + L)} ${f(y0)} L ${f(cx + gap / 2 + r + 22)} ${f(y0)} L ${f(cx + gap / 2 + r)} ${f(y0 + t - 40)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + gap / 2)} ${f(y0 + t - 14)} L ${f(cx + gap / 2)} ${f(y0 + t)} L ${f(cx + gap / 2 + L)} ${f(y0 + t)} Z`,
    ];
    name = 'J-groove weld prep';
  } else if (kind === 'u') {
    const r = 22;
    const side = (s: number) =>
      `M ${f(cx + s * (gap / 2 + L))} ${f(y0)} L ${f(cx + s * (gap / 2 + r + 18))} ${f(y0)} L ${f(cx + s * (gap / 2 + r))} ${f(y0 + t - 40)} A ${f(r)} ${f(r)} 0 0 ${s > 0 ? 1 : 0} ${f(cx + s * (gap / 2))} ${f(y0 + t - 18)} L ${f(cx + s * (gap / 2))} ${f(y0 + t)} L ${f(cx + s * (gap / 2 + L))} ${f(y0 + t)} Z`;
    paths = [side(-1), side(1)];
    name = 'U-groove weld prep';
  } else {
    paths = [poly([[60, 300], [340, 300], [340, 340], [60, 340]]), poly([[180, 300], [180, 90], [220, 90], [220, 300]])];
    paths.push(poly([[180, 300], [180, 252], [132, 300]]), poly([[220, 300], [220, 252], [268, 300]]));
    name = 'Fillet weld T-joint';
  }
  paths.push(...label(kind === 'single-bevel' ? '45°' : kind === 'fillet' || kind === 'j' || kind === 'u' ? '' : '60°', 200, 100, 18));
  return {
    id: `weld-${kind}`,
    name,
    level: kind === 'fillet' || kind === 'single-v' ? 'beginner' : 'intermediate',
    tags: ['weld', 'welding', 'boilermaker', 'fabrication'],
    paths: paths.filter(Boolean),
    detail: [line(40, y0 + t + 30, 360, y0 + t + 30)],
  };
}

function pipeCut(a: number): Spec {
  // A pipe seen from the side, cut at `a` degrees to its axis; the cut line is exact.
  const x0 = 50, yTop = 150, yBot = 250, D = yBot - yTop;
  const cutRun = D / Math.tan(a * RAD);
  const xEndTop = 300, xEndBot = xEndTop - cutRun;
  const paths = [
    line(x0, yTop, xEndTop, yTop),
    line(x0, yBot, xEndBot, yBot),
    line(xEndTop, yTop, xEndBot, yBot),
    `M ${f(x0)} ${f(yTop)} A 14 ${f(D / 2)} 0 0 0 ${f(x0)} ${f(yBot)}`,
  ];
  paths.push(...label(deg(a), xEndBot + 30, yBot + 40, 18));
  const detail = [line(x0 - 20, (yTop + yBot) / 2, 360, (yTop + yBot) / 2), arc(xEndBot, yBot, 40, 0, a)];
  return {
    id: `pipe-cut-${a}`,
    name: `Pipe end cut at ${deg(a)}`,
    level: 'intermediate',
    tags: ['pipe', 'cut', 'fabrication', 'boilermaker'],
    paths,
    detail,
  };
}

function radiusGauge(): Spec {
  const paths: string[] = [];
  const radii = [20, 40, 60, 80, 100, 120, 140, 160];
  for (const r of radii) paths.push(arc(40, 360, r * 1.9, 0, 90));
  return {
    id: 'radius-arcs',
    name: 'Radius arcs set',
    level: 'beginner',
    tags: ['radius', 'arc', 'corner', 'layout'],
    paths: [...paths, line(40, 360, 380, 360), line(40, 360, 40, 20)],
  };
}

function concentric(): Spec {
  const paths: string[] = [];
  for (let r = 20; r <= 180; r += 20) paths.push(circle(200, 200, r));
  return {
    id: 'concentric-circles',
    name: 'Concentric circle guide',
    level: 'beginner',
    tags: ['circle', 'centre', 'radius', 'layout'],
    paths: [...paths, line(10, 200, 390, 200), line(200, 10, 200, 390)],
  };
}

/** Line clipped to the 0..400 box (Liang-Barsky), or null when it misses. */
function clipped(x1: number, y1: number, x2: number, y2: number): string | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1], [dx, 400 - x1], [-dy, y1], [dy, 400 - y1]] as const) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  if ((t1 - t0) * Math.hypot(dx, dy) < 2) return null;
  return line(x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1);
}

function grid(kind: 'square' | 'iso' | 'dot' | 'diagonal'): Spec {
  const paths: string[] = [];
  const detail: string[] = [];
  const s = 40;
  if (kind === 'square') {
    for (let x = 0; x <= 400; x += s) (x % 200 === 0 ? paths : detail).push(line(x, 0, x, 400));
    for (let y = 0; y <= 400; y += s) (y % 200 === 0 ? paths : detail).push(line(0, y, 400, y));
  } else if (kind === 'iso') {
    const t = Math.tan(30 * RAD);
    for (let c = -400; c <= 800; c += s) {
      for (const l of [clipped(0, c, 400, c - 400 * t), clipped(0, c - 400 * t, 400, c)]) if (l) detail.push(l);
    }
    for (let x = 0; x <= 400; x += s * 2 * Math.cos(30 * RAD)) paths.push(line(x, 0, x, 400));
  } else if (kind === 'dot') {
    for (let x = s / 2; x < 400; x += s) for (let y = s / 2; y < 400; y += s) paths.push(circle(x, y, 2.2));
  } else {
    for (let c = -400; c <= 400; c += s) {
      const l = clipped(0, c, 400, c + 400);
      if (l) detail.push(l);
    }
    for (let c = 0; c <= 800; c += s) {
      const l = clipped(0, c, 400, c - 400);
      if (l) detail.push(l);
    }
    paths.push(line(0, 0, 400, 400), line(0, 400, 400, 0));
  }
  const names = { square: 'Square layout grid', iso: 'Isometric 30° grid', dot: 'Dot grid', diagonal: '45° diagonal grid' };
  return {
    id: `grid-${kind}`,
    name: names[kind],
    level: kind === 'iso' ? 'intermediate' : 'beginner',
    tags: ['grid', 'layout', kind === 'iso' ? 'isometric' : 'drafting'],
    paths: paths.filter((p) => !/NaN/.test(p)),
    detail: detail.filter((p) => !/NaN/.test(p)),
  };
}

function herringbone(chevron: boolean): Spec {
  // Boards at +45 and -45 degrees meeting on a centre seam; herringbone staggers the two sides by half a board.
  const cx = 200, W = 34, step = W * Math.SQRT2;
  const paths: string[] = [];
  const clipLine = (x1: number, y1: number, dx: number, dy: number): string | null => {
    // walk from (x1, y1) in direction (dx, dy) until leaving the 20..380 box
    let t = 0;
    while (t < 600) {
      const x = x1 + dx * t, y = y1 + dy * t;
      if (x < 20 || x > 380 || y < 20 || y > 380) break;
      t += 1;
    }
    if (t < 4) return null;
    return line(x1, y1, x1 + dx * (t - 1), y1 + dy * (t - 1));
  };
  for (let y = -200; y <= 380; y += step) {
    const yr = chevron ? y : y + step / 2;
    if (y >= 20 && y <= 380) {
      const l = clipLine(cx, y, -Math.SQRT1_2, Math.SQRT1_2);
      if (l) paths.push(l);
    }
    if (yr >= 20 && yr <= 380) {
      const r = clipLine(cx, yr, Math.SQRT1_2, Math.SQRT1_2);
      if (r) paths.push(r);
    }
  }
  paths.push(line(cx, 20, cx, 380), poly([[20, 20], [380, 20], [380, 380], [20, 380]]));
  paths.push(...label('45°', 300, 60, 16));
  return {
    id: chevron ? 'chevron-layout' : 'herringbone-layout',
    name: chevron ? 'Chevron 45° floor layout' : 'Herringbone 45° floor layout',
    level: 'advanced',
    tags: [chevron ? 'chevron' : 'herringbone', 'flooring', 'tiling', 'carpentry'],
    paths,
    detail: [line(20, 200, 380, 200)],
  };
}

const SPECS: Spec[] = [
  ...[15, 22.5, 30, 45, 60, 67.5, 75, 90, 105, 120, 135, 150].map(angleGuide),
  protractorHalf(5, 'protractor-180', '180° protractor guide', 'intermediate'),
  protractorHalf(10, 'protractor-180-simple', 'Simple 180° protractor', 'beginner'),
  fan(15, 90, 'angle-fan-15', 'Angle fan in 15° steps', 'beginner'),
  fan(5, 90, 'angle-fan-5', 'Angle fan in 5° steps', 'intermediate'),
  setSquare('45'),
  setSquare('30-60'),
  pythag(3, 4, 5, 'beginner'),
  pythag(5, 12, 13, 'intermediate'),
  mitreCorner(45, 4),
  mitreCorner(30, 6),
  mitreCorner(22.5, 8),
  mitreCorner(15, 12),
  ...[3, 4, 5, 6, 8, 10, 12, 16].map((n) => circleDivision(n, n > 8 ? 'intermediate' : 'beginner')),
  polygon(3, 'triangle'),
  polygon(4, 'square'),
  polygon(5, 'pentagon'),
  polygon(6, 'hexagon'),
  polygon(8, 'octagon'),
  boltCircle(4),
  boltCircle(6),
  boltCircle(8),
  dovetail(6, 2),
  dovetail(8, 4),
  dovetail(6, 3),
  fingerJoint(),
  ...[15, 22.5, 30, 35, 40, 45].map(roofPitch),
  stairStringer(37),
  stairStringer(42),
  weld('single-v'),
  weld('double-v'),
  weld('single-bevel'),
  weld('j'),
  weld('u'),
  weld('fillet'),
  pipeCut(30),
  pipeCut(45),
  pipeCut(60),
  radiusGauge(),
  concentric(),
  grid('square'),
  grid('iso'),
  grid('dot'),
  grid('diagonal'),
  herringbone(false),
  herringbone(true),
];

export const trade: Template[] = SPECS.map(make);

/** Angles each trade template claims (for the exactness test): [vertex, ray end A, ray end B, degrees]. */
export function claimedAngles(): { id: string; deg: number; a: P; v: P; b: P }[] {
  const out: { id: string; deg: number; a: P; v: P; b: P }[] = [];
  for (const a of [15, 22.5, 30, 45, 60, 67.5, 75, 90, 105, 120, 135, 150]) {
    const vx = a > 100 ? 250 : 80;
    const vy = 300;
    const r = a > 100 ? 160 : 260;
    out.push({ id: `trade-angle-${String(a).replace('.', '-')}`, deg: a, v: [vx, vy], a: a > 100 ? [vx + 110, vy] : at(vx, vy, r, 0), b: at(vx, vy, r, a) });
  }
  for (const a of [15, 22.5, 30, 35, 40, 45]) {
    const x0 = 50, y0 = 320;
    const h = Math.min(220, 150 * Math.tan(a * RAD));
    const half = h / Math.tan(a * RAD);
    out.push({ id: `trade-roof-pitch-${String(a).replace('.', '-')}`, deg: a, v: [x0, y0], a: [x0 + 2 * half, y0], b: [x0 + half, y0 - h] });
  }
  return out;
}
