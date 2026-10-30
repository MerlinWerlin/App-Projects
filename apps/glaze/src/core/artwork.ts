// Theme artwork: an original motif library (vector paths drawn in-house for Glaze), icon frames,
// textures and corner stickers, and wallpaper compositions. Everything here returns plain layout
// primitives (`ArtPath`: a path string with a fill or stroke colour), with transforms already
// baked into the path numbers, so src/render only has to draw <Path> elements.
// Pure TS (no React Native / Expo) so Node can run and test it directly. Deterministic per seed.

import { isHex, normalizeHex, seededRandom } from './colour.ts';
import type { IconShape } from './iconspec.ts';
import { blobPoints, fmt, hashSeed, superellipsePoints, ROUNDED_RADIUS, SQUARE_RADIUS, SQUIRCLE_N, type Point } from './shapes.ts';
import { hasPackMotif, packMotifLayers } from './packMotifs.ts';

// ---------------------------------------------------------------- types

/** Colour roles a motif layer can use; a theme supplies one hex colour per role. */
export type FillRole = 'primary' | 'secondary' | 'accent' | 'ink' | 'light';
export const FILL_ROLES: readonly FillRole[] = Object.freeze(['primary', 'secondary', 'accent', 'ink', 'light'] as FillRole[]);
export type ArtColours = Record<FillRole, string>;

export type MotifLayer = { d: string; role: FillRole; opacity?: number };
export type Motif = { id: MotifId; name: string; layers: readonly MotifLayer[] };

export const MOTIF_IDS = Object.freeze([
  'strawberry',
  'cream',
  'daisy',
  'tulip',
  'leaf-sprig',
  'leaf',
  'mushroom',
  'acorn',
  'moon',
  'star',
  'sparkle',
  'planet',
  'cloud',
  'heart',
  'bow',
  'doily',
  'shell',
  'starfish',
  'blossom',
  'petal',
  'pumpkin',
  'candy',
  'lollipop',
  'teacup',
  'cherry',
  'ice-cream',
  'butterfly',
  'droplet',
  'sun',
  // T46 (theme packs, Oct 2026): original vector motifs for the new categories.
  'speed-lines',
  'starry-eye',
  'ghost',
  'bat',
  'gem',
  'lightning',
  'snowflake',
  // T104 (owner feedback 22 Oct, G5 b–d): original motifs for game-inspired, movie-night and
  // storybook themes. Moods and styles only: every shape is Glaze's own, never a known character.
  'pixel-critter',
  'pixel-heart',
  'pixel-coin',
  'neon-grid',
  'sword-shield',
  'potion',
  'wheat',
  'barn',
  'chequered-flag',
  'speed-stripes',
  'trophy',
  'rocket',
  'rain-window',
  'blinds',
  'monster',
  'popcorn',
  'hero-emblem',
  'comic-burst',
  'castle',
  'crown',
  'gown',
  'dragon',
  'fox-face',
  'owl-face',
  'hedgehog',
] as const);
export type MotifId = (typeof MOTIF_IDS)[number];

export type FrameKind = 'none' | 'scalloped' | 'lace' | 'stitched' | 'ribbon' | 'double';
export const FRAME_KINDS: readonly FrameKind[] = Object.freeze(['none', 'scalloped', 'lace', 'stitched', 'ribbon', 'double'] as FrameKind[]);

export type TextureKind = 'none' | 'gingham' | 'polka' | 'speckle' | 'linen' | 'starfield' | 'wash' | 'stripes';
export const TEXTURE_KINDS: readonly TextureKind[] = Object.freeze([
  'none',
  'gingham',
  'polka',
  'speckle',
  'linen',
  'starfield',
  'wash',
  'stripes',
] as TextureKind[]);

export type CompositionKind =
  | 'none'
  | 'scatter'
  | 'garland'
  | 'sky'
  | 'picnic'
  | 'tiled'
  | 'bouquet'
  | 'petals'
  | 'corners'
  | 'phases'
  | 'ground';
export const COMPOSITION_KINDS: readonly CompositionKind[] = Object.freeze([
  'none',
  'scatter',
  'garland',
  'sky',
  'picnic',
  'tiled',
  'bouquet',
  'petals',
  'corners',
  'phases',
  'ground',
] as CompositionKind[]);

export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export const CORNERS: readonly Corner[] = Object.freeze(['tl', 'tr', 'bl', 'br'] as Corner[]);

/** A small motif tucked into a corner of every icon. */
export type Sticker = { motif: MotifId; corner: Corner; /** Fraction of the icon edge, 0.12..0.4. */ scale: number; rotation: number };
export const MAX_STICKERS = 2;

/** Hint for the theme's display type; the UI maps it to a font it has. */
export type DisplayFont = 'rounded' | 'serif' | 'script' | 'display' | 'mono';
export const DISPLAY_FONTS: readonly DisplayFont[] = Object.freeze(['rounded', 'serif', 'script', 'display', 'mono'] as DisplayFont[]);

/** Artwork carried by an icon style (and so by every IconSpec it resolves to). */
export type IconArt = {
  colours: ArtColours;
  frame: FrameKind;
  frameRole: FillRole;
  texture: TextureKind;
  textureRole: FillRole;
  stickers: Sticker[];
  /** T170: the theme's display type, so monograms letter in the theme's face. Absent = system face. */
  displayFont?: DisplayFont;
};

/** Artwork carried by wallpaper params: a composition of motifs over the generated base. */
export type WallpaperArt = {
  colours: ArtColours;
  motifs: MotifId[];
  composition: CompositionKind;
};

/** A theme's whole artwork identity. */
export type ThemeArt = IconArt & {
  motifs: MotifId[];
  composition: CompositionKind;
  displayFont: DisplayFont;
};

/** One drawable path. Transforms are already applied to `d`. */
export type ArtPath = {
  d: string;
  fill: string | null;
  opacity: number;
  stroke?: string;
  strokeWidth?: number;
  /** Round caps/joins for strokes (stitches, vines). */
  round?: boolean;
};

export type IconArtLayout = { texture: ArtPath[]; stickers: ArtPath[]; frame: ArtPath[] };

// ---------------------------------------------------------------- path maths

/** Motifs are drawn in a 0..100 box. */
export const MOTIF_BOX = 100;

type Seg = { c: string; n: number[] };

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 };

/** Parse an absolute-command path (M L H V C Q A Z). Throws on anything else. */
export function parsePath(d: string): Seg[] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: Seg[] = [];
  let i = 0;
  while (i < tokens.length) {
    const c = tokens[i++];
    if (!(c in ARITY)) throw new Error(`unsupported path command ${c}`);
    const k = ARITY[c];
    if (k === 0) {
      out.push({ c, n: [] });
      continue;
    }
    // Implicit repeats (e.g. "L1 2 3 4") are allowed.
    do {
      const n: number[] = [];
      for (let j = 0; j < k; j++) {
        const t = tokens[i++];
        const v = Number(t);
        if (t === undefined || !Number.isFinite(v)) throw new Error(`bad number in path near ${c}`);
        n.push(v);
      }
      out.push({ c, n });
    } while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]));
  }
  return out;
}

/** Every number in a path string (for finiteness tests). */
export function pathNumbers(d: string): number[] {
  return (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?|NaN|Infinity/g) ?? []).map(Number);
}

/** Similarity transform: the point (ox, oy) moves to (x, y), scaled by s, rotated by `rot` degrees. */
export type Xf = { x: number; y: number; s: number; rot: number; ox?: number; oy?: number };

function xfPoint(t: Xf, px: number, py: number): [number, number] {
  const a = (t.rot * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = (px - (t.ox ?? 50)) * t.s;
  const dy = (py - (t.oy ?? 50)) * t.s;
  return [t.x + dx * cos - dy * sin, t.y + dx * sin + dy * cos];
}

/** Apply a similarity transform to a path (arcs keep their shape: radii scale, axis rotates). */
export function transformPath(d: string, t: Xf): string {
  let out = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const P = (x: number, y: number) => {
    const [a, b] = xfPoint(t, x, y);
    return `${fmt(a)} ${fmt(b)}`;
  };
  for (const { c, n } of parsePath(d)) {
    switch (c) {
      case 'M':
        out += `M${P(n[0], n[1])}`;
        cx = sx = n[0];
        cy = sy = n[1];
        break;
      case 'L':
        out += `L${P(n[0], n[1])}`;
        cx = n[0];
        cy = n[1];
        break;
      case 'H':
        out += `L${P(n[0], cy)}`;
        cx = n[0];
        break;
      case 'V':
        out += `L${P(cx, n[0])}`;
        cy = n[0];
        break;
      case 'C':
        out += `C${P(n[0], n[1])} ${P(n[2], n[3])} ${P(n[4], n[5])}`;
        cx = n[4];
        cy = n[5];
        break;
      case 'Q':
        out += `Q${P(n[0], n[1])} ${P(n[2], n[3])}`;
        cx = n[2];
        cy = n[3];
        break;
      case 'A':
        out += `A${fmt(Math.abs(n[0] * t.s))} ${fmt(Math.abs(n[1] * t.s))} ${fmt(n[2] + t.rot)} ${n[3] ? 1 : 0} ${n[4] ? 1 : 0} ${P(n[5], n[6])}`;
        cx = n[5];
        cy = n[6];
        break;
      case 'Z':
        out += 'Z';
        cx = sx;
        cy = sy;
        break;
    }
  }
  return out;
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Points on an SVG arc (endpoint parameterisation → centre, per the SVG spec F.6.5). */
function arcSamples(x1: number, y1: number, n: number[], steps: number): Point[] {
  let rx = Math.abs(n[0]);
  let ry = Math.abs(n[1]);
  const phi = (n[2] * Math.PI) / 180;
  const fa = n[3] ? 1 : 0;
  const fs = n[4] ? 1 : 0;
  const x2 = n[5];
  const y2 = n[6];
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ x: x2, y: y2 }];
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (fa === fs) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const ccx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const ccy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = t1 + (dt * i) / steps;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push({ x: ccx + cos * ex - sin * ey, y: ccy + sin * ex + cos * ey });
  }
  return out;
}

/** Conservative bounds: end points, Bézier control points and sampled arcs. */
export function pathBounds(d: string): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: number, y: number) => {
    if (x < b.minX) b.minX = x;
    if (y < b.minY) b.minY = y;
    if (x > b.maxX) b.maxX = x;
    if (y > b.maxY) b.maxY = y;
  };
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { c, n } of parsePath(d)) {
    if (c === 'Z') {
      cx = sx;
      cy = sy;
      continue;
    }
    if (c === 'A') {
      for (const p of arcSamples(cx, cy, n, 24)) add(p.x, p.y);
      cx = n[5];
      cy = n[6];
      continue;
    }
    if (c === 'H') {
      cx = n[0];
      add(cx, cy);
      continue;
    }
    if (c === 'V') {
      cy = n[0];
      add(cx, cy);
      continue;
    }
    for (let i = 0; i < n.length; i += 2) add(n[i], n[i + 1]);
    cx = n[n.length - 2];
    cy = n[n.length - 1];
    if (c === 'M') {
      sx = cx;
      sy = cy;
    }
  }
  return b;
}

/** Flatten a path into closed polylines (one per subpath); curves sampled `steps` times. */
export function flattenPath(d: string, steps = 12): Point[][] {
  const out: Point[][] = [];
  let cur: Point[] = [];
  let cx = 0;
  let cy = 0;
  const flush = () => {
    if (cur.length > 1) out.push(cur);
    cur = [];
  };
  for (const { c, n } of parsePath(d)) {
    if (c === 'M') {
      flush();
      cx = n[0];
      cy = n[1];
      cur.push({ x: cx, y: cy });
    } else if (c === 'L' || c === 'H' || c === 'V') {
      if (c === 'L') {
        cx = n[0];
        cy = n[1];
      } else if (c === 'H') cx = n[0];
      else cy = n[0];
      cur.push({ x: cx, y: cy });
    } else if (c === 'C' || c === 'Q') {
      const x0 = cx;
      const y0 = cy;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        if (c === 'C') {
          cur.push({
            x: u * u * u * x0 + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t * t * t * n[4],
            y: u * u * u * y0 + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t * t * t * n[5],
          });
        } else {
          cur.push({ x: u * u * x0 + 2 * u * t * n[0] + t * t * n[2], y: u * u * y0 + 2 * u * t * n[1] + t * t * n[3] });
        }
      }
      cx = n[n.length - 2];
      cy = n[n.length - 1];
    } else if (c === 'A') {
      cur.push(...arcSamples(cx, cy, n, steps * 2));
      cx = n[5];
      cy = n[6];
    } else if (c === 'Z') {
      const first = cur[0];
      flush();
      if (first) {
        cx = first.x;
        cy = first.y;
      }
    }
  }
  flush();
  return out;
}

function unionBounds(list: Bounds[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const x of list) {
    b.minX = Math.min(b.minX, x.minX);
    b.minY = Math.min(b.minY, x.minY);
    b.maxX = Math.max(b.maxX, x.maxX);
    b.maxY = Math.max(b.maxY, x.maxY);
  }
  return b;
}

// ---------------------------------------------------------------- path builders (motif units)

const rad = (deg: number) => (deg * Math.PI) / 180;

function circ(cx: number, cy: number, r: number): string {
  const R = fmt(r);
  return `M${fmt(cx - r)} ${fmt(cy)}A${R} ${R} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}A${R} ${R} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}Z`;
}

function ell(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
  const dx = rx * Math.cos(rad(rot));
  const dy = rx * Math.sin(rad(rot));
  const a = `A${fmt(rx)} ${fmt(ry)} ${fmt(rot)} 1 0`;
  return `M${fmt(cx - dx)} ${fmt(cy - dy)}${a} ${fmt(cx + dx)} ${fmt(cy + dy)}${a} ${fmt(cx - dx)} ${fmt(cy - dy)}Z`;
}

/** Map local (along, across) coordinates from a base point and heading to motif units. */
function local(cx: number, cy: number, angDeg: number): (a: number, b: number) => string {
  const c = Math.cos(rad(angDeg));
  const s = Math.sin(rad(angDeg));
  return (a, b) => `${fmt(cx + a * c - b * s)} ${fmt(cy + a * s + b * c)}`;
}

/** Leaf pointed at both ends, from (cx, cy) heading `ang` degrees. */
function leafShape(cx: number, cy: number, ang: number, len: number, w: number): string {
  const p = local(cx, cy, ang);
  return `M${p(0, 0)}C${p(len * 0.25, w)} ${p(len * 0.7, w)} ${p(len, 0)}C${p(len * 0.7, -w)} ${p(len * 0.25, -w)} ${p(0, 0)}Z`;
}

/** Rounded petal with a notch at the tip (cherry blossom), starting r0 from the centre. */
function notchedPetal(cx: number, cy: number, ang: number, r0: number, L: number, W: number): string {
  const p = local(cx, cy, ang);
  const a = (v: number) => r0 + v * L;
  return (
    `M${p(a(0), 0)}C${p(a(0.35), 0.75 * W)} ${p(a(0.9), 0.85 * W)} ${p(a(1), 0.3 * W)}` +
    `L${p(a(0.86), 0)}L${p(a(1), -0.3 * W)}C${p(a(0.9), -0.85 * W)} ${p(a(0.35), -0.75 * W)} ${p(a(0), 0)}Z`
  );
}

function poly(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`).join('') + 'Z';
}

function starPts(cx: number, cy: number, R: number, r: number, n: number, rotDeg = -90): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 === 0 ? R : r;
    const a = rad(rotDeg + (i * 180) / n);
    out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return out;
}

function sparklePath(cx: number, cy: number, R: number): string {
  const c = `${fmt(cx)} ${fmt(cy)}`;
  return (
    `M${fmt(cx)} ${fmt(cy - R)}Q${c} ${fmt(cx + R)} ${fmt(cy)}Q${c} ${fmt(cx)} ${fmt(cy + R)}` +
    `Q${c} ${fmt(cx - R)} ${fmt(cy)}Q${c} ${fmt(cx)} ${fmt(cy - R)}Z`
  );
}

const HEART = 'M50 86C16 62 6 40 20 26C32 14 46 20 50 32C54 20 68 14 80 26C94 40 84 62 50 86Z';

function ring(n: number, radius: number, r: number, cx = 50, cy = 50, start = -90): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rad(start + (i * 360) / n);
    d += circ(cx + radius * Math.cos(a), cy + radius * Math.sin(a), r);
  }
  return d;
}

/** Phase 0 = new, 0.5 = full, 1 = new again; lit on the right while waxing. */
export function moonPhasePath(cx: number, cy: number, r: number, phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  const rx = Math.abs(r * Math.cos(2 * Math.PI * p));
  const top = `${fmt(cx)} ${fmt(cy - r)}`;
  const bottom = `${fmt(cx)} ${fmt(cy + r)}`;
  const R = fmt(r);
  if (p <= 0.5) {
    const sweep = p < 0.25 ? 0 : 1;
    return `M${top}A${R} ${R} 0 0 1 ${bottom}A${fmt(rx)} ${R} 0 0 ${sweep} ${top}Z`;
  }
  const sweep = p > 0.75 ? 1 : 0;
  return `M${top}A${R} ${R} 0 0 0 ${bottom}A${fmt(rx)} ${R} 0 0 ${sweep} ${top}Z`;
}

// ---------------------------------------------------------------- the motif library

function L(d: string, role: FillRole, opacity?: number): MotifLayer {
  return opacity === undefined ? { d, role } : { d, role, opacity };
}

function buildMotifs(): Record<MotifId, Motif> {
  const m = {} as Record<MotifId, Motif>;
  const add = (id: MotifId, name: string, layers: MotifLayer[]) => {
    m[id] = { id, name, layers: Object.freeze(layers) };
  };

  const seeds: [number, number][] = [
    [35, 46], [50, 44], [65, 46], [28, 58], [42, 58], [58, 58], [72, 58], [36, 70], [50, 72], [64, 70], [44, 82], [56, 82],
  ];
  add('strawberry', 'Strawberry', [
    L('M50 92C30 88 14 66 16 46C18 32 32 28 50 30C68 28 82 32 84 46C86 66 70 88 50 92Z', 'primary'),
    L(seeds.map(([x, y]) => ell(x, y, 1.8, 3, (x - 50) * 0.8)).join(''), 'light'),
    L([165, 125, 90, 55, 15].map((a) => leafShape(50, 31, a, 18, 8)).join('') + 'M48 32L47 12C47 9 53 9 53 12L52 32Z', 'secondary'),
  ]);

  add('cream', 'Cream swirl', [
    L('M12 84C6 72 18 62 30 66C24 54 36 44 46 50C42 38 50 30 58 18C62 30 70 40 62 50C74 46 82 58 72 66C84 62 96 72 88 84C84 92 16 92 12 84Z', 'light'),
    L('M20 74C34 82 66 82 82 74C70 86 30 86 20 74ZM34 58C44 64 58 64 68 58C58 70 42 70 34 58ZM46 44C52 46 56 44 58 40C56 50 48 50 46 44Z', 'secondary', 0.5),
  ]);

  let petals = '';
  for (let i = 0; i < 8; i++) {
    const a = i * 45;
    petals += ell(50 + 24 * Math.cos(rad(a)), 50 + 24 * Math.sin(rad(a)), 17, 8, a);
  }
  add('daisy', 'Daisy', [L(petals, 'light'), L(circ(50, 50, 13), 'accent')]);

  add('tulip', 'Tulip', [
    L('M48 62L52 62L52 94L48 94ZM50 90C36 86 28 74 30 62C40 66 48 76 50 90ZM50 92C64 88 74 76 72 64C62 68 52 78 50 92Z', 'secondary'),
    L('M28 26L40 40L50 22L60 40L72 26C76 48 70 64 50 66C30 64 24 48 28 26Z', 'primary'),
  ]);

  add('leaf-sprig', 'Leaf sprig', [
    L(
      'M49 95C47 72 50 42 55 8L58 9C53 42 51 72 52 95Z' +
        leafShape(50, 80, 200, 22, 9) +
        leafShape(51, 64, -25, 22, 9) +
        leafShape(52, 48, 205, 20, 8) +
        leafShape(53, 33, -30, 19, 8) +
        leafShape(56, 16, 215, 14, 6),
      'secondary',
    ),
  ]);

  add('leaf', 'Leaf', [
    L(leafShape(14, 86, -45, 100, 30) + 'M14 86L7 93L9 95L16 88Z', 'secondary'),
    L(leafShape(20, 80, -45, 78, 1.6), 'light', 0.7),
  ]);

  add('mushroom', 'Mushroom', [
    L('M38 56C36 70 34 84 38 90C44 94 56 94 62 90C66 84 64 70 62 56Z', 'light'),
    L('M10 56C10 28 30 12 50 12C70 12 90 28 90 56C70 62 30 62 10 56Z', 'primary'),
    L(circ(30, 38, 6) + circ(52, 26, 5) + circ(70, 40, 6) + circ(48, 47, 4), 'light'),
  ]);

  add('acorn', 'Acorn', [
    L('M30 42L70 42C70 66 60 84 50 92C40 84 30 66 30 42Z', 'accent'),
    L('M20 44C20 26 34 18 50 18C66 18 80 26 80 44ZM47 20L47 8L53 8L53 20Z', 'ink', 0.85),
  ]);

  add('moon', 'Crescent moon', [L('M60 14.7A38 38 0 1 0 60 85.3A37.3 37.3 0 0 1 60 14.7Z', 'accent')]);

  add('star', 'Star', [L(poly(starPts(50, 54, 46, 20, 5)), 'accent')]);

  add('sparkle', 'Sparkle', [L(sparklePath(46, 54, 40) + sparklePath(82, 18, 12), 'light')]);

  const tilt = { x: 50, y: 50, s: 1, rot: -18 };
  const ringD = transformPath('M6 52A44 14 0 0 0 94 52L84 52A34 7 0 0 1 16 52Z', tilt);
  const ringBack = transformPath('M6 52A44 14 0 0 1 94 52L84 52A34 7 0 0 0 16 52Z', tilt);
  add('planet', 'Ringed planet', [
    L(ringBack, 'accent', 0.75),
    L(circ(50, 50, 25), 'primary'),
    L(ell(50, 42, 20, 3), 'secondary', 0.6),
    L(ringD, 'accent'),
    L(circ(86, 16, 5), 'light'),
  ]);

  add('cloud', 'Cloud', [
    L(circ(32, 60, 15) + circ(50, 48, 20) + circ(68, 58, 15) + 'M22 78L78 78A10 10 0 0 0 78 58L22 58A10 10 0 0 0 22 78Z', 'light'),
  ]);

  add('heart', 'Heart', [L(HEART, 'primary'), L(ell(30, 34, 6, 3.5, -45), 'light', 0.7)]);

  add('bow', 'Bow', [
    L(
      'M50 50C40 30 14 24 12 40C10 56 30 64 50 50ZM50 50C60 30 86 24 88 40C90 56 70 64 50 50Z' +
        'M46 52L32 84L41 80L46 88L50 54ZM54 52L68 84L59 80L54 88L50 54Z',
      'primary',
    ),
    L(circ(50, 50, 8), 'accent'),
  ]);

  add('doily', 'Lace doily', [
    L(ring(14, 36, 9) + circ(50, 50, 37), 'light'),
    L(ring(14, 30, 2.8, 50, 50, -77) + ring(8, 18, 2.2), 'secondary', 0.7),
    L(circ(50, 50, 7), 'accent'),
  ]);

  {
    // Scallop shell: a fan of five bumps over a hinge, with ribs.
    const pts: [number, number][] = [];
    for (let k = 0; k <= 5; k++) pts.push([50 + 40 * Math.cos(rad(180 + 36 * k)), 62 + 40 * Math.sin(rad(180 + 36 * k))]);
    let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
    for (let k = 0; k < 5; k++) {
      const a = rad(180 + 36 * k + 18);
      d += `Q${fmt(50 + 50 * Math.cos(a))} ${fmt(62 + 50 * Math.sin(a))} ${fmt(pts[k + 1][0])} ${fmt(pts[k + 1][1])}`;
    }
    d += 'L58 86L42 86ZM40 82L60 82L64 94L36 94Z';
    let ribs = '';
    for (let k = 1; k <= 4; k++) {
      const [x, y] = pts[k];
      ribs += poly([[49, 84], [51, 84], [x + 1.6, y + 2], [x - 1.6, y + 2]]);
    }
    add('shell', 'Scallop shell', [L(d, 'primary'), L(ribs, 'light', 0.55)]);
  }

  {
    let dots = '';
    for (let i = 0; i < 5; i++) {
      const a = rad(-90 + i * 72);
      dots += circ(50 + 16 * Math.cos(a), 52 + 16 * Math.sin(a), 2.4) + circ(50 + 29 * Math.cos(a), 52 + 29 * Math.sin(a), 2);
    }
    add('starfish', 'Starfish', [L(poly(starPts(50, 52, 46, 20, 5)), 'primary'), L(dots, 'light', 0.8)]);
  }

  {
    let p = '';
    let st = '';
    for (let k = 0; k < 5; k++) {
      const a = -90 + 72 * k;
      p += notchedPetal(50, 50, a, 3, 44, 20);
      st += circ(50 + 14 * Math.cos(rad(a + 36)), 50 + 14 * Math.sin(rad(a + 36)), 2.2);
    }
    add('blossom', 'Cherry blossom', [L(p, 'primary'), L(circ(50, 50, 8) + st, 'accent')]);
  }

  add('petal', 'Petal', [L(notchedPetal(44, 86, -72, 0, 72, 40), 'primary'), L(ell(52, 52, 4, 12, 18), 'light', 0.45)]);

  add('pumpkin', 'Pumpkin', [
    L(ell(30, 60, 22, 28) + ell(70, 60, 22, 28) + ell(50, 60, 22, 30), 'primary'),
    L(ell(39, 61, 3, 22) + ell(61, 61, 3, 22), 'accent', 0.6),
    L('M46 34C45 26 47 18 53 12L57 15C52 21 51 27 52 34Z' + leafShape(55, 22, -15, 26, 9), 'secondary'),
  ]);

  add('candy', 'Wrapped sweet', [
    L(circ(50, 50, 18) + 'M34 50L10 34L15 50L10 66ZM66 50L90 34L85 50L90 66Z', 'primary'),
    L('M40 36Q50 50 40 64L45 66Q55 50 45 34ZM55 34Q65 50 55 66L60 64Q68 50 60 36Z', 'light', 0.85),
  ]);

  add('lollipop', 'Lollipop', [
    L('M47 60L53 60L53 96L47 96Z', 'light'),
    L(circ(50, 36, 30), 'primary'),
    L('M50 14A22 22 0 0 1 72 36L64 36A14 14 0 0 0 50 22ZM50 58A22 22 0 0 1 28 36L36 36A14 14 0 0 0 50 50Z' + circ(50, 36, 5), 'light'),
  ]);

  add('teacup', 'Teacup', [
    L(ell(50, 82, 38, 7), 'accent'),
    L('M20 40L80 40C80 62 68 78 50 78C32 78 20 62 20 40ZM78 46C94 44 94 66 75 66L75 60C86 60 86 51 79 52Z', 'light'),
    L(ell(50, 40, 30, 5) + transformPath(HEART, { x: 50, y: 58, s: 0.18, rot: 0 }), 'primary'),
    L('M42 32C36 24 48 20 42 8L45 8C51 20 39 24 45 32ZM56 32C50 24 62 20 56 8L59 8C65 20 53 24 59 32Z', 'light', 0.7),
  ]);

  add('cherry', 'Cherries', [
    L('M34 70C38 50 46 30 58 14L61 16C50 32 42 50 37 70ZM66 66C64 48 62 30 58 14L61 14C66 30 68 48 69 66Z' + leafShape(60, 15, -20, 26, 9), 'secondary'),
    L(circ(34, 74, 16) + circ(67, 70, 16), 'primary'),
    L(circ(28, 68, 4) + circ(61, 64, 4), 'light', 0.8),
  ]);

  add('ice-cream', 'Ice cream cone', [
    L('M30 52L70 52L50 95Z', 'accent'),
    L('M27 54C21 42 30 24 50 24C70 24 79 42 73 54C67 50 63 58 57 54C51 60 46 52 40 56C35 51 31 58 27 54Z', 'light'),
    L(ell(38, 40, 3, 1.2, 30) + ell(52, 34, 3, 1.2, -20) + ell(62, 44, 3, 1.2, 60) + ell(46, 48, 3, 1.2, -50), 'secondary'),
    L(circ(50, 18, 7), 'primary'),
  ]);

  add('butterfly', 'Butterfly', [
    L(ell(32, 38, 18, 13, -30) + ell(68, 38, 18, 13, 30) + ell(37, 64, 12, 9, 30) + ell(63, 64, 12, 9, -30), 'primary'),
    L(circ(30, 36, 5) + circ(70, 36, 5) + circ(37, 64, 3) + circ(63, 64, 3), 'light', 0.85),
    L('M47 32C47 28 53 28 53 32L53 76C53 80 47 80 47 76ZM49 32C46 22 42 17 37 14L38 12C44 15 49 21 51 31ZM51 32C54 22 58 17 63 14L62 12C56 15 51 21 49 31Z', 'ink'),
  ]);

  add('droplet', 'Droplet', [
    L('M50 8C60 30 78 46 78 64C78 80 66 92 50 92C34 92 22 80 22 64C22 46 40 30 50 8Z', 'accent'),
    L(ell(38, 64, 4, 9, 20), 'light', 0.7),
  ]);

  {
    const rays: [number, number][][] = [];
    for (let i = 0; i < 10; i++) {
      const a = rad(i * 36);
      const b = rad(i * 36 + 90);
      const ax = Math.cos(a);
      const ay = Math.sin(a);
      const bx = Math.cos(b) * 5;
      const by = Math.sin(b) * 5;
      rays.push([[50 + 27 * ax + bx, 50 + 27 * ay + by], [50 + 44 * ax, 50 + 44 * ay], [50 + 27 * ax - bx, 50 + 27 * ay - by]]);
    }
    add('sun', 'Sun', [L(circ(50, 50, 21) + rays.map(poly).join(''), 'accent')]);
  }

  // ---- T46 motifs (all original vector shapes inside the 100-unit box)
  {
    // Focus lines converging on the centre, drawn as thin wedges (comic / anime-style energy).
    const wedges: string[] = [];
    for (let i = 0; i < 14; i++) {
      const a = i * (360 / 14) + (i % 2 === 0 ? 0 : 6);
      const r0 = i % 2 === 0 ? 20 : 28;
      const p = local(50, 50, a);
      wedges.push(`M${p(r0, 0)}L${p(46, -2.6)}L${p(46, 2.6)}Z`);
    }
    add('speed-lines', 'Speed lines', [L(wedges.join(''), 'primary'), L(sparklePath(50, 50, 12), 'accent')]);
  }

  add('starry-eye', 'Starry eye', [
    L(ell(50, 52, 30, 40), 'ink'),
    L(ell(50, 60, 22, 28), 'primary'),
    L(poly(starPts(40, 38, 13, 5, 4)) + circ(62, 70, 5), 'light'),
    L(sparklePath(66, 44, 6), 'accent', 0.9),
  ]);

  add('ghost', 'Little ghost', [
    L('M28 90L28 42C28 22 38 10 50 10C62 10 72 22 72 42L72 90L64 82L57 90L50 82L43 90L36 82Z', 'light'),
    L(ell(42, 42, 4, 6) + ell(58, 42, 4, 6), 'ink'),
    L(circ(36, 54, 3.5) + circ(64, 54, 3.5), 'primary', 0.6),
  ]);

  add('bat', 'Bat', [
    L(
      ell(50, 54, 8, 12) +
        poly([[44, 44], [45, 32], [49, 42]]) +
        poly([[56, 44], [55, 32], [51, 42]]) +
        'M44 50C34 38 20 36 6 44C14 48 16 54 14 62C22 56 28 58 32 66C36 58 40 58 44 62Z' +
        'M56 50C66 38 80 36 94 44C86 48 84 54 86 62C78 56 72 58 68 66C64 58 60 58 56 62Z',
      'ink',
    ),
    L(circ(46.5, 49, 1.6) + circ(53.5, 49, 1.6), 'light'),
  ]);

  add('gem', 'Cut gem', [
    L(poly([[30, 30], [70, 30], [88, 46], [50, 90], [12, 46]]), 'primary'),
    L(poly([[30, 30], [42, 46], [58, 46], [70, 30]]), 'light', 0.5),
    L(poly([[12, 46], [42, 46], [50, 90]]), 'secondary', 0.55),
    L(sparklePath(80, 18, 10), 'light'),
  ]);

  add('lightning', 'Lightning bolt', [
    L(poly([[58, 6], [24, 56], [46, 56], [38, 94], [78, 40], [55, 40], [68, 6]]), 'accent'),
    L(poly([[58, 12], [34, 50], [40, 50]]), 'light', 0.6),
  ]);

  {
    const arms: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 60 - 90;
      const p = local(50, 50, a);
      arms.push(`M${p(0, -2.4)}L${p(40, -2.4)}L${p(40, 2.4)}L${p(0, 2.4)}Z`);
      const c = Math.cos(rad(a));
      const s = Math.sin(rad(a));
      for (const along of [18, 29]) {
        const bx = 50 + along * c;
        const by = 50 + along * s;
        arms.push(leafShape(bx, by, a + 45, 11, 2.2), leafShape(bx, by, a - 45, 11, 2.2));
      }
    }
    add('snowflake', 'Snowflake', [L(arms.join(''), 'light'), L(circ(50, 50, 7), 'accent')]);
  }

  addT104Motifs(add);

  return m;
}

// ---- T104 motifs (owner feedback 22 Oct, G5 b–d): game-inspired, movie-night and storybook.
// Original shapes in the 100-unit box. Shapes that overlap inside one layer share a winding
// (`solid` turns polygons the same way as `circ` / `ell`), so the default non-zero fill never
// punches holes.

/** Axis-aligned rectangle, wound like `circ`. */
function rect(x0: number, y0: number, x1: number, y1: number): string {
  return `M${fmt(x0)} ${fmt(y0)}L${fmt(x0)} ${fmt(y1)}L${fmt(x1)} ${fmt(y1)}L${fmt(x1)} ${fmt(y0)}Z`;
}

/** Closed polygon wound like `circ` (negative shoelace area in y-down units). */
function solid(pts: [number, number][]): string {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return poly(s > 0 ? [...pts].reverse() : pts);
}

/** Pixel art: one rectangle per horizontal run of `ch` in `rows`. */
function pixelRuns(rows: readonly string[], ch: string, x0: number, y0: number, cell: number): string {
  let d = '';
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (row[c] !== ch) {
        c++;
        continue;
      }
      let e = c;
      while (e < row.length && row[e] === ch) e++;
      d += rect(x0 + c * cell, y0 + r * cell, x0 + e * cell, y0 + (r + 1) * cell);
      c = e;
    }
  });
  return d;
}

function addT104Motifs(add: (id: MotifId, name: string, layers: MotifLayer[]) => void): void {
  // ---- game-inspired

  {
    // A round little bean sprite with a sprout: Glaze's own pixel critter.
    const rows = [
      '......AA....',
      '.....AA.....',
      '...PPPPPP...',
      '..PPLPPPPP..',
      '.PPLPPPPPPP.',
      '.PPIIPPIIPP.',
      '.PPIIPPIIPP.',
      '.PAPPPPPPAP.',
      '.PPPPIIPPPP.',
      '..PPPPPPPP..',
      '..PP....PP..',
    ];
    const px = (ch: string) => pixelRuns(rows, ch, 8, 12, 7);
    add('pixel-critter', 'Pixel critter', [L(px('P'), 'primary'), L(px('L'), 'light'), L(px('I'), 'ink'), L(px('A'), 'accent')]);
  }

  {
    const rows = [
      '.PPP...PPP.',
      'PPLLP.PPPPP',
      'PLLPPPPPPPP',
      'PPPPPPPPPPP',
      '.PPPPPPPPP.',
      '..PPPPPPP..',
      '...PPPPP...',
      '....PPP....',
      '.....P.....',
    ];
    add('pixel-heart', 'Pixel heart', [L(pixelRuns(rows, 'P', 6, 14, 8), 'primary'), L(pixelRuns(rows, 'L', 6, 14, 8), 'light')]);
  }

  {
    const rows = [
      '...AAAA...',
      '.AAAAAAAA.',
      '.ALAASAAA.',
      'AALAASAAAA',
      'AALAASAAAA',
      'AAAAASAAAA',
      'AAAAASAAAA',
      '.AAAASAAA.',
      '.AAAAAAAA.',
      '...AAAA...',
    ];
    const px = (ch: string) => pixelRuns(rows, ch, 10, 10, 8);
    add('pixel-coin', 'Pixel coin', [L(px('A'), 'accent'), L(px('S'), 'secondary'), L(px('L'), 'light')]);
  }

  {
    // Striped sun on a perspective grid.
    const R = 26;
    const cy = 48;
    const half = (y: number) => Math.sqrt(Math.max(0, R * R - (cy - y) * (cy - y)));
    let sun = '';
    for (const [y1, y2] of [[22, 34], [35.6, 40.2], [41.6, 44.4], [45.6, 47.6]] as [number, number][]) {
      const w1 = half(y1);
      const w2 = half(y2);
      sun +=
        `M${fmt(50 - w1)} ${fmt(y1)}L${fmt(50 + w1)} ${fmt(y1)}A${R} ${R} 0 0 1 ${fmt(50 + w2)} ${fmt(y2)}` +
        `L${fmt(50 - w2)} ${fmt(y2)}A${R} ${R} 0 0 1 ${fmt(50 - w1)} ${fmt(y1)}Z`;
    }
    let grid = '';
    for (let k = -4; k <= 4; k++) {
      const top = 50 + k * 2.2;
      const bot = 50 + k * 11;
      grid += solid([[top - 0.55, 50], [top + 0.55, 50], [bot + 1.4, 94], [bot - 1.4, 94]]);
    }
    for (const t of [0.18, 0.36, 0.56, 0.78, 1]) {
      const y = 50 + 44 * t * t;
      const w = 8.8 + (44 - 8.8) * ((y - 50) / 44);
      const th = 0.9 + 1.5 * t;
      grid += rect(50 - w, y - th / 2, 50 + w, y + th / 2);
    }
    add('neon-grid', 'Neon grid', [L(sun, 'accent'), L(grid, 'primary'), L(rect(4, 48.6, 96, 50.4), 'light', 0.9)]);
  }

  {
    // Two crossed swords behind a shield with a star of our own.
    const blade = (bx: number, by: number, ang: number) => {
      const p = local(bx, by, ang);
      return {
        steel: `M${p(13, -2.6)}L${p(84, -2.6)}L${p(92, 0)}L${p(84, 2.6)}L${p(13, 2.6)}Z`,
        hilt: `M${p(10, -8)}L${p(13, -8)}L${p(13, 8)}L${p(10, 8)}Z` + `M${p(0, -1.8)}L${p(10, -1.8)}L${p(10, 1.8)}L${p(0, 1.8)}Z` + circ(...pt(p(0, 0)), 3),
      };
    };
    const pt = (s: string): [number, number] => {
      const [x, y] = s.split(' ').map(Number);
      return [x, y];
    };
    const S = (d: string) => transformPath(d, { x: 50, y: 56, s: 0.74, rot: 0, ox: 50, oy: 52 });
    const a = blade(12, 12, 45);
    const b = blade(88, 12, 135);
    add('sword-shield', 'Sword and shield crest', [
      L(a.steel + b.steel, 'light'),
      L(a.hilt + b.hilt, 'accent'),
      L(S('M50 14L82 24C82 56 70 76 50 90C30 76 18 56 18 24Z'), 'primary'),
      L(S('M50 22L74 30C74 56 64 72 50 82C36 72 26 56 26 30Z'), 'secondary'),
      L(S(poly(starPts(50, 50, 13, 5.5, 5))), 'accent'),
    ]);
  }

  add('potion', 'Potion flask', [
    L(circ(50, 62, 28) + rect(42, 16, 58, 38), 'light', 0.55),
    L('M22.29 58A28 28 0 1 0 77.71 58Z', 'primary'),
    L(rect(39, 8, 61, 17), 'accent'),
    L(ell(36, 56, 3.5, 8, 20) + circ(58, 72, 3) + circ(48, 80, 2) + circ(64, 64, 1.6), 'light', 0.85),
  ]);

  {
    const stalk = (ang: number, len: number) => {
      const p = local(50, 96, ang);
      return `M${p(0, -1.3)}L${p(len, -0.9)}L${p(len, 0.9)}L${p(0, 1.3)}Z`;
    };
    const grains = (ang: number, len: number) => {
      const c = Math.cos(rad(ang));
      const s = Math.sin(rad(ang));
      let d = '';
      for (let k = 0; k < 4; k++) {
        const a = len * 0.42 + k * len * 0.13;
        const x = 50 + a * c;
        const y = 96 + a * s;
        d += leafShape(x, y, ang - 32, len * 0.2, 3.6) + leafShape(x, y, ang + 32, len * 0.2, 3.6);
      }
      return d + leafShape(50 + len * 0.92 * c, 96 + len * 0.92 * s, ang, len * 0.18, 3.4);
    };
    const set: [number, number][] = [[-90, 76], [-106, 66], [-74, 66]];
    add('wheat', 'Wheat sheaf', [
      L(set.map(([a, l]) => stalk(a, l)).join('') + leafShape(50, 86, -150, 22, 5) + leafShape(50, 82, -30, 22, 5), 'secondary'),
      L(set.map(([a, l]) => grains(a, l)).join(''), 'accent'),
    ]);
  }

  add('barn', 'Little barn', [
    L(ell(50, 92, 44, 4), 'secondary', 0.5),
    L(solid([[18, 48], [30, 30], [50, 20], [70, 30], [82, 48], [82, 90], [18, 90]]), 'primary'),
    L(solid([[13, 50], [27, 28], [50, 15], [73, 28], [87, 50], [82, 52], [70, 33], [50, 23], [30, 33], [18, 52]]), 'light'),
    L(rect(37, 60, 63, 90) + rect(44, 36, 56, 47), 'light'),
    L(
      solid([[37, 60], [40, 60], [63, 87], [63, 90], [60, 90], [37, 63]]) +
        solid([[63, 60], [60, 60], [37, 87], [37, 90], [40, 90], [63, 63]]) +
        rect(49.2, 36, 50.8, 47) +
        rect(44, 40.8, 56, 42.2),
      'secondary',
    ),
  ]);

  {
    const x0 = 20;
    const x1 = 88;
    const y0 = 12;
    const cw = (x1 - x0) / 6;
    const ch = 11.5;
    const wave = (x: number) => 4 * Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 2);
    let dark = '';
    let lite = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const xa = x0 + c * cw;
        const xb = xa + cw;
        const ya = y0 + r * ch;
        const q = solid([[xa, ya + wave(xa)], [xa, ya + ch + wave(xa)], [xb, ya + ch + wave(xb)], [xb, ya + wave(xb)]]);
        if ((r + c) % 2 === 0) lite += q;
        else dark += q;
      }
    }
    add('chequered-flag', 'Chequered flag', [L(rect(14, 10, 19, 95), 'secondary'), L(circ(16.5, 9, 4.5), 'accent'), L(lite, 'light'), L(dark, 'ink')]);
  }

  {
    const bar = (y: number, xa: number, xb: number, h: number): string => {
      const r = h / 2;
      return solid([[xa + 6, y], [xb - r, y], [xb, y + r], [xb - r, y + h], [xa, y + h]]);
    };
    add('speed-stripes', 'Speed stripes', [
      L(bar(20, 30, 94, 11) + bar(62, 18, 84, 11), 'primary'),
      L(bar(41, 8, 90, 11), 'accent'),
      L(bar(35, 54, 82, 2.6) + bar(56, 40, 72, 2.6) + bar(77, 34, 62, 2.6), 'light', 0.8),
    ]);
  }

  add('trophy', 'Trophy cup', [
    L('M30 22C12 22 12 48 34 48L35 43C20 42 19 27 30 27Z' + 'M70 22C88 22 88 48 66 48L65 43C80 42 81 27 70 27Z', 'accent'),
    L('M28 16C28 44 38 58 50 60C62 58 72 44 72 16Z' + rect(46, 58, 54, 73), 'accent'),
    L(rect(33, 72, 67, 80) + rect(26, 80, 74, 90), 'secondary'),
    L(ell(38, 30, 3, 9, -10) + poly(starPts(52, 34, 8, 3.5, 5)), 'light', 0.8),
  ]);

  // ---- movie night

  {
    const tilt: Xf = { x: 50, y: 50, s: 0.86, rot: 35 };
    const T = (d: string) => transformPath(d, tilt);
    add('rocket', 'Rocket', [
      L(T('M38 66L62 66C62 78 57 86 50 96C43 86 38 78 38 66Z'), 'accent'),
      L(T('M50 6C66 18 70 40 68 66L32 66C30 40 34 18 50 6Z'), 'light'),
      L(T('M50 6C58 12 62 20 64 28L36 28C38 20 42 12 50 6Z' + 'M33 50L18 68L18 82L34 70Z' + 'M67 50L82 68L82 82L66 70Z'), 'primary'),
      L(T(circ(50, 44, 9.5)), 'secondary'),
      L(T(circ(50, 44, 6)), 'ink', 0.85),
    ]);
  }

  {
    const drops: [number, number][] = [[22, 22], [38, 32], [62, 20], [78, 42], [27, 40], [72, 62], [40, 64], [62, 78], [24, 79], [80, 80], [45, 84]];
    let rain = '';
    for (const [x, y] of drops) rain += solid([[x - 0.4, y - 8], [x + 0.4, y - 8], [x + 1.1, y], [x - 1.1, y]]) + circ(x, y + 0.6, 1.9);
    add('rain-window', 'Rain on the window', [
      L(rect(10, 8, 90, 92), 'secondary'),
      L(rect(15, 13, 47, 47) + rect(53, 13, 85, 47) + rect(15, 53, 47, 87) + rect(53, 53, 85, 87), 'primary'),
      L(circ(68, 30, 9) + circ(30, 68, 4.5), 'accent', 0.85),
      L(rain, 'light', 0.8),
    ]);
  }

  {
    let bands = '';
    for (let i = 0; i < 7; i++) {
      const y = 12 + i * 12;
      bands += solid([[6, y + 8], [94, y - 4], [94, y + 2], [6, y + 14]]);
    }
    add('blinds', 'Blind-slat shadows', [L(bands, 'light', 0.85), L(solid([[60, 2], [64, 2], [56, 98], [52, 98]]), 'ink', 0.55)]);
  }

  add('monster', 'Round monster', [
    L(solid([[26, 34], [22, 8], [42, 26]]) + solid([[74, 34], [78, 8], [58, 26]]), 'accent'),
    L(circ(50, 56, 36), 'primary'),
    L(circ(37, 50, 9.5) + circ(63, 50, 9.5), 'light'),
    L(circ(39, 52, 4.6) + circ(65, 52, 4.6) + 'M34 68Q50 82 66 68Q50 76 34 68Z', 'ink'),
    L(solid([[46, 71.4], [54, 71.4], [50, 78.5]]) + circ(40.5, 50.5, 1.5) + circ(66.5, 50.5, 1.5), 'light'),
  ]);

  {
    let stripes = '';
    for (const i of [0, 2, 4]) {
      stripes += solid([[24 + i * 10.4, 48], [24 + (i + 1) * 10.4, 48], [32 + (i + 1) * 7.2, 94], [32 + i * 7.2, 94]]);
    }
    const puffs: [number, number, number][] = [[30, 42, 9], [44, 36, 10], [58, 37, 10], [70, 43, 8], [50, 24, 9], [36, 27, 7.5], [64, 26, 7.5]];
    add('popcorn', 'Popcorn', [
      L(puffs.map(([x, y, r]) => circ(x, y, r)).join(''), 'accent'),
      L(puffs.map(([x, y, r]) => circ(x - r * 0.3, y - r * 0.3, r * 0.28)).join(''), 'light', 0.7),
      L(solid([[24, 48], [76, 48], [68, 94], [32, 94]]), 'light'),
      L(stripes + rect(22, 44, 78, 50), 'primary'),
    ]);
  }

  {
    // An original winged-badge emblem with a bolt: no existing hero's mark.
    const wingL: [number, number][][] = [
      [[30, 40], [6, 33], [10, 42], [30, 48]],
      [[30, 50], [8, 48], [13, 56], [30, 58]],
      [[31, 60], [12, 63], [18, 69], [33, 67]],
    ];
    const wings = wingL.map((w) => solid(w) + solid(w.map(([x, y]) => [100 - x, y] as [number, number]))).join('');
    add('hero-emblem', 'Winged bolt emblem', [
      L(wings, 'light'),
      L(circ(50, 52, 24), 'accent'),
      L(circ(50, 52, 19), 'primary'),
      L(poly([[54, 34], [40, 55], [49, 55], [45, 70], [60, 48], [51, 48], [56, 34]]), 'light'),
    ]);
  }

  {
    const outer = [47, 44, 48, 43, 46, 45, 48, 42];
    const burst = (scale: number): string => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 16; i++) {
        const r = (i % 2 === 0 ? outer[i / 2] : 31) * scale;
        const a = rad(-90 + (i * 360) / 16);
        pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
      }
      return solid(pts);
    };
    let dots = '';
    for (let gx = -3; gx <= 3; gx++) {
      for (let gy = -3; gy <= 3; gy++) {
        const x = gx * 7;
        const y = gy * 7;
        const dist = Math.hypot(x, y);
        if (dist < 24) dots += circ(50 + x, 50 + y, Math.max(0.7, 2.6 * (1 - dist / 30)));
      }
    }
    add('comic-burst', 'Comic burst', [L(burst(1), 'primary'), L(burst(0.72), 'accent'), L(dots, 'light', 0.55)]);
  }

  // ---- storybook

  {
    const merlons = [32, 40, 48, 56, 64].map((x) => rect(x, 46, x + 4, 50)).join('');
    const win = (x: number, y: number) => `M${x - 3} ${y + 4}L${x - 3} ${y}A3 3 0 0 1 ${x + 3} ${y}L${x + 3} ${y + 4}Z`;
    const flag = (x: number, y: number) => rect(x - 0.6, y - 8, x + 0.6, y) + solid([[x, y - 8], [x + 8, y - 5.5], [x, y - 3]]);
    add('castle', 'Storybook castle', [
      L(rect(14, 40, 30, 92) + rect(70, 40, 86, 92) + rect(32, 50, 68, 92) + rect(42, 30, 58, 50) + merlons, 'light'),
      L(solid([[11, 41], [22, 14], [33, 41]]) + solid([[67, 41], [78, 14], [89, 41]]) + solid([[39, 31], [50, 8], [61, 31]]), 'primary'),
      L(flag(22, 14) + flag(78, 14) + flag(50, 8), 'accent'),
      L('M43 92L43 77A7 7 0 0 1 57 77L57 92Z' + win(22, 54) + win(78, 54) + win(50, 38) + win(22, 70) + win(78, 70), 'secondary'),
    ]);
  }

  add('crown', 'Crown', [
    L(solid([[14, 74], [18, 32], [34, 52], [50, 24], [66, 52], [82, 32], [86, 74]]), 'accent'),
    L(rect(14, 72, 86, 86), 'primary'),
    L(circ(18, 29, 4.5) + circ(50, 20, 5.5) + circ(82, 29, 4.5) + circ(26, 79, 2.2) + circ(74, 79, 2.2), 'light'),
    L(solid([[50, 73], [55, 79], [50, 85], [45, 79]]) + solid([[38, 75.5], [41.5, 79], [38, 82.5], [34.5, 79]]) + solid([[62, 75.5], [65.5, 79], [62, 82.5], [58.5, 79]]), 'secondary'),
  ]);

  add('gown', 'Ball gown', [
    L('M40 16L42 40L58 40L60 16C56 21 44 21 40 16Z' + 'M42 40C34 56 20 72 12 92L88 92C80 72 66 56 58 40Z', 'primary'),
    L(ell(36, 19, 6, 5) + ell(64, 19, 6, 5), 'secondary'),
    L(solid([[46, 43], [47.5, 43], [30, 92], [25, 92]]) + solid([[54, 43], [52.5, 43], [70, 92], [75, 92]]) + solid([[49.4, 43], [50.6, 43], [52, 92], [48, 92]]), 'light', 0.35),
    L([16, 24, 32, 40, 48, 56, 64, 72, 80].map((x) => circ(x + 2, 92, 4.4)).join(''), 'light', 0.9),
    L(ell(50, 40, 10, 3.2) + sparklePath(50, 28, 5), 'accent'),
  ]);

  add('dragon', 'Little dragon', [
    L('M60 46C66 26 84 20 92 26C86 30 88 36 82 40C86 46 80 52 72 52Z', 'secondary'),
    L(
      'M72 84C86 86 96 78 96 62L97 50L90 56C92 66 88 76 74 76Z' +
        ell(54, 64, 26, 22) +
        circ(36, 38, 18) +
        ell(24, 44, 12, 9) +
        ell(42, 86, 8, 5) +
        ell(64, 86, 8, 5),
      'primary',
    ),
    L(ell(50, 70, 14, 13) + solid([[28, 23], [31, 11], [37, 21]]) + solid([[39, 20.5], [45, 10], [47, 23]]) + solid([[56, 43], [62, 33], [66, 45]]) + solid([[68, 47], [76, 40], [76, 53]]), 'accent'),
    L(circ(40, 36, 4.2) + circ(19, 42, 1.6) + 'M20 50Q27 55 34 50Q27 53 20 50Z', 'ink'),
    L(circ(41.5, 34.5, 1.5), 'light'),
  ]);

  add('fox-face', 'Fox face', [
    L('M50 90C34 86 18 72 16 54L14 12L38 30C46 28 54 28 62 30L86 12L84 54C82 72 66 86 50 90Z', 'primary'),
    L(solid([[20, 22], [33, 32], [21, 44]]) + solid([[80, 22], [67, 32], [79, 44]]) + 'M50 90C42 88 30 80 26 66C36 60 46 62 50 70C54 62 64 60 74 66C70 80 58 88 50 90Z', 'light'),
    L(ell(37, 52, 3.6, 4.6) + ell(63, 52, 3.6, 4.6) + ell(50, 84, 5, 3.6), 'ink'),
    L(circ(29, 64, 4) + circ(71, 64, 4), 'accent', 0.6),
  ]);

  add('owl-face', 'Owl', [
    L(solid([[22, 32], [20, 8], [40, 24]]) + solid([[78, 32], [80, 8], [60, 24]]), 'secondary'),
    L(ell(50, 58, 34, 36), 'primary'),
    L(circ(36, 46, 13.5) + circ(64, 46, 13.5), 'light'),
    L(circ(37, 47, 6) + circ(63, 47, 6), 'ink'),
    L(
      solid([[46, 58], [54, 58], [50, 67]]) +
        [[40, 76], [50, 76], [60, 76], [45, 84], [55, 84]]
          .map(([x, y]) => solid([[x - 4, y], [x, y + 3.5], [x + 4, y], [x + 4, y + 2.6], [x, y + 6], [x - 4, y + 2.6]]))
          .join(''),
      'accent',
    ),
  ]);

  {
    const spikes: [number, number][] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const a = rad(170 + (i * 200) / N);
      const r = i % 2 === 0 ? 40 : 31;
      spikes.push([56 + r * Math.cos(a), 64 + r * Math.sin(a)]);
    }
    spikes.push([56, 72]);
    add('hedgehog', 'Hedgehog', [
      L(solid(spikes), 'secondary'),
      L(ell(58, 68, 30, 20), 'primary'),
      L('M16 72C18 60 30 54 42 58L48 84C36 86 20 82 16 72Z', 'light'),
      L(circ(32, 66, 2.8) + circ(14, 72, 3.2) + ell(42, 88, 6, 3.5) + ell(70, 88, 6, 3.5), 'ink'),
      L(circ(30, 75, 3.2), 'accent', 0.7),
    ]);
  }
}

export const MOTIFS: Readonly<Record<MotifId, Motif>> = Object.freeze(buildMotifs());

export function isMotifId(v: unknown): v is MotifId {
  return typeof v === 'string' && (MOTIF_IDS as readonly string[]).includes(v);
}

export function getMotif(id: string): Motif | undefined {
  return isMotifId(id) ? MOTIFS[id] : undefined;
}

/**
 * True for a built-in motif or one a downloaded pack registered (T47, src/core/packMotifs.ts).
 * Pack-only ids travel in art typed as MotifId; this is the check the layout functions use.
 */
export function isDrawableMotif(id: unknown): id is MotifId {
  return isMotifId(id) || (typeof id === 'string' && hasPackMotif(id));
}

function motifLayers(id: string): readonly MotifLayer[] | undefined {
  return isMotifId(id) ? MOTIFS[id].layers : packMotifLayers(id);
}

// ---------------------------------------------------------------- placing motifs

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Place a motif: its box (100 units) centred on (x, y), drawn `size` wide, rotated `rotation` degrees. */
export function placeMotif(
  id: MotifId | (string & {}),
  colours: ArtColours,
  x: number,
  y: number,
  size: number,
  rotation = 0,
  opacity = 1,
): ArtPath[] {
  const layers = motifLayers(id);
  if (!layers) return [];
  const t: Xf = { x, y, s: size / MOTIF_BOX, rot: rotation };
  return layers.map((l) => ({
    d: transformPath(l.d, t),
    fill: colours[l.role],
    opacity: clamp01((l.opacity ?? 1) * opacity),
  }));
}

export function artBounds(paths: ArtPath[]): Bounds {
  return unionBounds(
    paths.map((p) => {
      const b = pathBounds(p.d);
      const w = (p.strokeWidth ?? 0) / 2;
      return { minX: b.minX - w, minY: b.minY - w, maxX: b.maxX + w, maxY: b.maxY + w };
    }),
  );
}

// ---------------------------------------------------------------- icon geometry

function resample(poly: Point[], n: number): Point[] {
  const m = poly.length;
  const cum = [0];
  for (let i = 0; i < m; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % m];
    cum.push(cum[i] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cum[m];
  const out: Point[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (j < m - 1 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / seg;
    const a = poly[j];
    const b = poly[(j + 1) % m];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

function perimeter(poly: Point[]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

/** Dense outline of an icon shape (matches shapes.ts), clockwise from the top. */
function denseOutline(shape: IconShape, size: number, seed: number | string): Point[] {
  const c = size / 2;
  if (shape === 'circle') {
    const out: Point[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      out.push({ x: c + c * Math.cos(a), y: c + c * Math.sin(a) });
    }
    return out;
  }
  if (shape === 'rounded' || shape === 'square') {
    // Rounded and square are the same rounded rect with different corner radii (see shapes.ts).
    const r = (shape === 'square' ? SQUARE_RADIUS : ROUNDED_RADIUS) * size;
    const centres: Point[] = [
      { x: size - r, y: r },
      { x: size - r, y: size - r },
      { x: r, y: size - r },
      { x: r, y: r },
    ];
    const out: Point[] = [];
    centres.forEach((p, q) => {
      for (let i = 0; i <= 12; i++) {
        const a = -Math.PI / 2 + (q * Math.PI) / 2 + (i / 12) * (Math.PI / 2);
        out.push({ x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a) });
      }
    });
    return out;
  }
  if (shape === 'blob') {
    const pts = blobPoints(size, seed);
    const n = pts.length;
    const out: Point[] = [];
    const k = 1 / 6;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
      const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
      for (let s = 0; s < 16; s++) {
        const t = s / 16;
        const u = 1 - t;
        out.push({
          x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
          y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
        });
      }
    }
    return out;
  }
  return superellipsePoints(size, SQUIRCLE_N, 256);
}

/** `count` evenly spaced points along the shape's edge, shrunk towards the centre by `inset` (1 = on the edge). */
export function outlinePoints(shape: IconShape, size: number, seed: number | string, count: number, inset = 1): Point[] {
  const c = size / 2;
  return resample(denseOutline(shape, size, seed), Math.max(3, Math.round(count))).map((p) => ({
    x: c + (p.x - c) * inset,
    y: c + (p.y - c) * inset,
  }));
}

function closedPolyline(pts: Point[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join('') + 'Z';
}

// ---------------------------------------------------------------- frames

/**
 * Frame along the inside of the icon edge. Drawn inside the shape's clip, so circles centred on
 * the edge show as scallops. Every frame is at most 3 paths.
 */
export function frameLayers(kind: FrameKind, colour: string, shape: IconShape, size: number, seed: number | string = 0): ArtPath[] {
  const s = size;
  const dense = denseOutline(shape, s, seed);
  const per = perimeter(dense);
  const inner = (k: number, n: number) => outlinePoints(shape, s, seed, n, k);
  switch (kind) {
    case 'scalloped': {
      const n = Math.max(12, Math.round(per / (0.085 * s)));
      const r = (per / n) * 0.56;
      return [{ d: resample(dense, n).map((p) => circ(p.x, p.y, r)).join(''), fill: colour, opacity: 1 }];
    }
    case 'lace': {
      const n = Math.max(16, Math.round(per / (0.06 * s)));
      const r = (per / n) * 0.6;
      const k = 1 - (2.4 * r) / (s / 2);
      const dots = inner(k, Math.round(n * k)).map((p) => circ(p.x, p.y, s * 0.012)).join('');
      return [
        { d: resample(dense, n).map((p) => circ(p.x, p.y, r)).join(''), fill: colour, opacity: 0.95 },
        { d: dots, fill: colour, opacity: 0.9 },
        { d: closedPolyline(inner(k - 0.06, 72)), fill: null, stroke: colour, strokeWidth: s * 0.008, opacity: 0.7 },
      ];
    }
    case 'stitched': {
      const k = 0.87;
      const n = Math.max(16, Math.round((per * k) / (0.065 * s)));
      const pts = inner(k, n);
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        d += `M${fmt(a.x)} ${fmt(a.y)}L${fmt(a.x + (b.x - a.x) * 0.55)} ${fmt(a.y + (b.y - a.y) * 0.55)}`;
      }
      return [{ d, fill: null, stroke: colour, strokeWidth: s * 0.022, round: true, opacity: 0.95 }];
    }
    case 'double':
      return [
        { d: closedPolyline(inner(0.93, 96)), fill: null, stroke: colour, strokeWidth: s * 0.03, opacity: 1 },
        { d: closedPolyline(inner(0.84, 96)), fill: null, stroke: colour, strokeWidth: s * 0.012, opacity: 0.9 },
      ];
    case 'ribbon': {
      const y0 = s * 0.79;
      const y1 = s * 0.9;
      return [
        { d: `M0 ${fmt(y0)}L${fmt(s)} ${fmt(y0)}L${fmt(s)} ${fmt(y1)}L0 ${fmt(y1)}Z`, fill: colour, opacity: 0.95 },
        {
          d: `M0 ${fmt(y0 + s * 0.015)}L${fmt(s)} ${fmt(y0 + s * 0.015)}M0 ${fmt(y1 - s * 0.015)}L${fmt(s)} ${fmt(y1 - s * 0.015)}`,
          fill: null,
          stroke: '#FFFFFF',
          strokeWidth: s * 0.006,
          opacity: 0.55,
        },
      ];
    }
    case 'none':
    default:
      return [];
  }
}

// ---------------------------------------------------------------- textures

/** Opacity of each texture's marks. */
export const TEXTURE_OPACITY: Readonly<Record<TextureKind, number>> = Object.freeze({
  none: 0,
  gingham: 0.14,
  polka: 0.28,
  speckle: 0.45,
  linen: 0.14,
  starfield: 0.85,
  wash: 0.16,
  stripes: 0.15,
});

/**
 * Worst local tint a texture lays over the icon background where a glyph stroke might sit
 * (overlaps counted; sparse dot textures count as a light tint). Used by the contrast tests.
 */
export const TEXTURE_TINT: Readonly<Record<TextureKind, number>> = Object.freeze({
  none: 0,
  gingham: 1 - (1 - 0.14) * (1 - 0.14),
  polka: 0.28,
  speckle: 0.12,
  linen: 1 - (1 - 0.14) * (1 - 0.14),
  starfield: 0.12,
  wash: 1 - (1 - 0.16) * (1 - 0.16),
  stripes: 0.15,
});

/** Texture over the whole icon square (the shape clip trims it). At most 3 paths. */
export function textureLayers(kind: TextureKind, colour: string, size: number, seed: number): ArtPath[] {
  const s = size;
  const op = TEXTURE_OPACITY[kind] ?? 0;
  const rnd = seededRandom(seed >>> 0);
  const rect = (x: number, y: number, w: number, h: number) =>
    `M${fmt(x)} ${fmt(y)}L${fmt(x + w)} ${fmt(y)}L${fmt(x + w)} ${fmt(y + h)}L${fmt(x)} ${fmt(y + h)}Z`;
  switch (kind) {
    case 'gingham': {
      const w = s / 8;
      let v = '';
      let h = '';
      for (let i = 0; i < 8; i += 2) {
        v += rect(i * w + w / 2, 0, w, s);
        h += rect(0, i * w + w / 2, s, w);
      }
      return [
        { d: v, fill: colour, opacity: op },
        { d: h, fill: colour, opacity: op },
      ];
    }
    case 'polka': {
      const g = s / 4.5;
      let d = '';
      for (let row = 0; row * g <= s + g; row++) {
        for (let col = 0; col * g <= s + g; col++) {
          const x = col * g + (row % 2 ? g / 2 : 0);
          const y = row * g;
          if (x <= s + g / 2) d += circ(x, y, s * 0.04);
        }
      }
      return [{ d, fill: colour, opacity: op }];
    }
    case 'speckle': {
      let d = '';
      for (let i = 0; i < 36; i++) d += circ(rnd() * s, rnd() * s, s * (0.005 + rnd() * 0.008));
      return [{ d, fill: colour, opacity: op }];
    }
    case 'linen': {
      const g = s / 18;
      let v = '';
      let h = '';
      for (let i = 1; i < 18; i++) {
        v += `M${fmt(i * g)} 0L${fmt(i * g)} ${fmt(s)}`;
        h += `M0 ${fmt(i * g)}L${fmt(s)} ${fmt(i * g)}`;
      }
      return [
        { d: v, fill: null, stroke: colour, strokeWidth: s * 0.007, opacity: op },
        { d: h, fill: null, stroke: colour, strokeWidth: s * 0.007, opacity: op },
      ];
    }
    case 'starfield': {
      let dots = '';
      for (let i = 0; i < 16; i++) dots += circ(rnd() * s, rnd() * s, s * (0.005 + rnd() * 0.01));
      const stars = sparklePath(s * 0.16, s * 0.82, s * 0.05) + sparklePath(s * 0.86, s * 0.6, s * 0.035);
      return [
        { d: dots, fill: colour, opacity: op * 0.8 },
        { d: stars, fill: colour, opacity: op },
      ];
    }
    case 'wash': {
      const out: ArtPath[] = [];
      for (let b = 0; b < 2; b++) {
        const cx = s * (b === 0 ? 0.2 + rnd() * 0.2 : 0.6 + rnd() * 0.2);
        const cy = s * (b === 0 ? 0.65 + rnd() * 0.2 : 0.15 + rnd() * 0.2);
        const pts: Point[] = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const r = s * (0.24 + rnd() * 0.12);
          pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        out.push({ d: smoothPath(pts), fill: colour, opacity: op });
      }
      return out;
    }
    case 'stripes': {
      const period = s / 5;
      const w = period / 2;
      let d = '';
      for (let k = -1; k * period < 2 * s; k++) {
        const x0 = k * period - s;
        d += poly([[x0, 0], [x0 + w, 0], [x0 + w + s, s], [x0 + s, s]]);
      }
      return [{ d, fill: colour, opacity: op }];
    }
    case 'none':
    default:
      return [];
  }
}

function smoothPath(pts: Point[]): string {
  const n = pts.length;
  const k = 1 / 6;
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${fmt(p1.x + (p2.x - p0.x) * k)} ${fmt(p1.y + (p2.y - p0.y) * k)} ${fmt(p2.x - (p3.x - p1.x) * k)} ${fmt(
      p2.y - (p3.y - p1.y) * k,
    )} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d + 'Z';
}

// ---------------------------------------------------------------- stickers

/** Centre of a corner sticker as a fraction of the icon edge (circles pull in to stay visible). */
export function stickerCentre(corner: Corner, shape: IconShape): Point {
  // Squircle, rounded and square share 0.2: iOS's own rounded-square mask (≈22% corners) trims
  // the very corners anyway, so stickers stay just inside it on every square-ish shape.
  const k = shape === 'circle' ? 0.25 : shape === 'blob' ? 0.23 : 0.2;
  const x = corner === 'tl' || corner === 'bl' ? k : 1 - k;
  const y = corner === 'tl' || corner === 'tr' ? k : 1 - k;
  return { x, y };
}

export function stickerLayers(stickers: readonly Sticker[], colours: ArtColours, shape: IconShape, size: number): ArtPath[] {
  const out: ArtPath[] = [];
  for (const st of stickers.slice(0, MAX_STICKERS)) {
    if (!isDrawableMotif(st.motif)) continue;
    const c = stickerCentre(st.corner, shape);
    out.push(...placeMotif(st.motif, colours, c.x * size, c.y * size, clamp(st.scale, 0.12, 0.4) * size, st.rotation));
  }
  return out;
}

// ---------------------------------------------------------------- icon art

/** Everything an icon draws for its artwork, in layer order: texture (under the glyph), then stickers and frame (over it). */
export function iconArtLayout(art: IconArt, shape: IconShape, size: number, seed: number | string = 0): IconArtLayout {
  const s = Math.max(1, size);
  const numSeed = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return {
    texture: textureLayers(art.texture, art.colours[art.textureRole], s, numSeed),
    stickers: stickerLayers(art.stickers, art.colours, shape, s),
    frame: frameLayers(art.frame, art.colours[art.frameRole], shape, s, seed),
  };
}

export function iconArtOf(a: ThemeArt): IconArt {
  return {
    colours: { ...a.colours },
    frame: a.frame,
    frameRole: a.frameRole,
    texture: a.texture,
    textureRole: a.textureRole,
    stickers: a.stickers.map((s) => ({ ...s })),
    ...(isDisplayFont(a.displayFont) ? { displayFont: a.displayFont } : {}),
  };
}

function isDisplayFont(v: unknown): v is DisplayFont {
  return typeof v === 'string' && (DISPLAY_FONTS as readonly string[]).includes(v);
}

export function wallpaperArtOf(a: ThemeArt): WallpaperArt {
  return { colours: { ...a.colours }, motifs: [...a.motifs], composition: a.composition };
}

// ---------------------------------------------------------------- sanitizers (persisted state)

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeColours(raw: unknown): ArtColours | null {
  if (!isObj(raw)) return null;
  const out = {} as ArtColours;
  for (const r of FILL_ROLES) {
    const v = raw[r];
    if (typeof v !== 'string' || !isHex(v)) return null;
    out[r] = normalizeHex(v);
  }
  return out;
}

function isRole(v: unknown): v is FillRole {
  return typeof v === 'string' && (FILL_ROLES as readonly string[]).includes(v);
}

/**
 * Valid IconArt from untrusted input, or null. `extraMotifs` also allows those ids (a pack's own
 * motifs, whose layers arrive in the same art asset).
 */
export function sanitizeIconArt(raw: unknown, extraMotifs?: ReadonlySet<string>): IconArt | null {
  const okMotif = (m: unknown): m is MotifId => isMotifId(m) || (typeof m === 'string' && !!extraMotifs?.has(m));
  if (!isObj(raw)) return null;
  const colours = sanitizeColours(raw.colours);
  if (!colours) return null;
  const stickers: Sticker[] = [];
  if (Array.isArray(raw.stickers)) {
    for (const s of raw.stickers) {
      if (stickers.length >= MAX_STICKERS) break;
      if (!isObj(s) || !okMotif(s.motif)) continue;
      if (typeof s.corner !== 'string' || !(CORNERS as readonly string[]).includes(s.corner)) continue;
      const scale = typeof s.scale === 'number' && Number.isFinite(s.scale) ? clamp(s.scale, 0.12, 0.4) : 0.28;
      const rotation = typeof s.rotation === 'number' && Number.isFinite(s.rotation) ? clamp(s.rotation, -180, 180) : 0;
      stickers.push({ motif: s.motif, corner: s.corner as Corner, scale, rotation });
    }
  }
  return {
    colours,
    frame: typeof raw.frame === 'string' && (FRAME_KINDS as readonly string[]).includes(raw.frame) ? (raw.frame as FrameKind) : 'none',
    frameRole: isRole(raw.frameRole) ? raw.frameRole : 'accent',
    texture:
      typeof raw.texture === 'string' && (TEXTURE_KINDS as readonly string[]).includes(raw.texture) ? (raw.texture as TextureKind) : 'none',
    textureRole: isRole(raw.textureRole) ? raw.textureRole : 'light',
    stickers,
    ...(isDisplayFont(raw.displayFont) ? { displayFont: raw.displayFont } : {}),
  };
}

/** Valid WallpaperArt from untrusted input, or null. `extraMotifs` as for sanitizeIconArt. */
export function sanitizeWallpaperArt(raw: unknown, extraMotifs?: ReadonlySet<string>): WallpaperArt | null {
  if (!isObj(raw)) return null;
  const colours = sanitizeColours(raw.colours);
  if (!colours) return null;
  const okMotif = (m: unknown): m is MotifId => isMotifId(m) || (typeof m === 'string' && !!extraMotifs?.has(m));
  const motifs = Array.isArray(raw.motifs) ? raw.motifs.filter(okMotif).slice(0, 8) : [];
  const composition =
    typeof raw.composition === 'string' && (COMPOSITION_KINDS as readonly string[]).includes(raw.composition)
      ? (raw.composition as CompositionKind)
      : 'none';
  if (motifs.length === 0 && composition !== 'none' && composition !== 'phases') return null;
  return { colours, motifs, composition };
}

// ---------------------------------------------------------------- wallpaper compositions

export const MAX_ART_PATHS = 600;

const SKY: readonly MotifId[] = ['moon', 'star', 'sparkle', 'cloud', 'planet', 'sun'];

type Ctx = {
  W: number;
  H: number;
  /** One normalised unit = W / 100 points. */
  u: number;
  /** Canvas height in normalised units. */
  h: number;
  colours: ArtColours;
  rnd: () => number;
  out: ArtPath[];
};

/** Place a motif in normalised units, nudged so it stays inside the canvas. */
function put(ctx: Ctx, id: MotifId, x: number, y: number, size: number, rot = 0, opacity = 1): void {
  const { u, W, H } = ctx;
  let px = x * u;
  let py = y * u;
  const sz = size * u;
  let paths = placeMotif(id, ctx.colours, px, py, sz, rot, opacity);
  const b = artBounds(paths);
  let dx = 0;
  let dy = 0;
  if (b.maxX - b.minX <= W) dx = b.minX < 0 ? -b.minX : b.maxX > W ? W - b.maxX : 0;
  if (b.maxY - b.minY <= H) dy = b.minY < 0 ? -b.minY : b.maxY > H ? H - b.maxY : 0;
  if (dx !== 0 || dy !== 0) {
    px += dx;
    py += dy;
    paths = placeMotif(id, ctx.colours, px, py, sz, rot, opacity);
  }
  ctx.out.push(...paths);
}

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

function scatter(ctx: Ctx, ids: readonly MotifId[], opts: { size: number; spacing: number; max: number; top?: number; bottom?: number; rot?: number; opacity?: number }): void {
  const placed: Point[] = [];
  const top = opts.top ?? 0;
  const bottom = opts.bottom ?? ctx.h;
  const area = 100 * (bottom - top);
  const target = Math.min(opts.max, Math.round(area / (opts.spacing * opts.spacing * 1.25)));
  for (let tries = 0; tries < 500 && placed.length < target; tries++) {
    const p = { x: 4 + ctx.rnd() * 92, y: top + 3 + ctx.rnd() * Math.max(1, bottom - top - 6) };
    if (placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < opts.spacing)) continue;
    placed.push(p);
    const size = opts.size * (0.75 + ctx.rnd() * 0.5);
    const rot = (ctx.rnd() - 0.5) * 2 * (opts.rot ?? 25);
    put(ctx, ids[placed.length % ids.length], p.x, p.y, size, rot, opts.opacity ?? 0.95);
  }
}

function tiles(ctx: Ctx, ids: readonly MotifId[], cell: number, size: number): void {
  let i = 0;
  for (let row = 0; row * cell * 0.86 <= ctx.h + cell; row++) {
    for (let col = 0; col * cell <= 100 + cell; col++) {
      const x = col * cell + (row % 2 ? cell / 2 : 0);
      const y = row * cell * 0.86 + cell * 0.3;
      if (x > 100 + cell / 2 || y > ctx.h + cell / 2) continue;
      const rot = [0, 14, -14][(row + col) % 3];
      put(ctx, ids[i++ % ids.length], x, y, size, rot, 0.95);
    }
  }
}

function strokePath(ctx: Ctx, pts: Point[], colour: string, width: number, opacity = 1): void {
  const u = ctx.u;
  let d = `M${fmt(pts[0].x * u)} ${fmt(pts[0].y * u)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    d += `Q${fmt(a.x * u)} ${fmt(a.y * u)} ${fmt(((a.x + b.x) / 2) * u)} ${fmt(((a.y + b.y) / 2) * u)}`;
  }
  const last = pts[pts.length - 1];
  d += `L${fmt(last.x * u)} ${fmt(last.y * u)}`;
  ctx.out.push({ d, fill: null, stroke: colour, strokeWidth: width * u, round: true, opacity });
}

/**
 * Lay out a wallpaper composition at width×height points. Positions are computed in units of
 * width/100 so a preview and the full-resolution export match. Deterministic per seed.
 */
export function compositionLayout(art: WallpaperArt | null | undefined, width: number, height: number, seed: number): ArtPath[] {
  if (!art || art.composition === 'none') return [];
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const ctx: Ctx = { W, H, u: W / 100, h: (H / W) * 100, colours: art.colours, rnd: seededRandom((seed >>> 0) ^ 0x5eed), out: [] };
  const motifs = art.motifs.filter(isDrawableMotif);
  const ids: MotifId[] = motifs.length > 0 ? motifs : ['sparkle'];
  const h = ctx.h;
  const c = art.colours;

  switch (art.composition) {
    case 'scatter':
      scatter(ctx, ids, { size: 16, spacing: 21, max: 30 });
      break;

    case 'garland': {
      for (const y of [8, h - 8]) {
        const vine: Point[] = [];
        for (let x = -2; x <= 102; x += 8) vine.push({ x: clamp(x, 1, 99), y: y + Math.sin(x / 7) * 2.2 });
        strokePath(ctx, vine, c.secondary, 0.7, 0.8);
        for (let k = 0; k < 9; k++) {
          const x = 6 + k * 11;
          put(ctx, ids[(k + (y > 50 ? 1 : 0)) % ids.length], x, y + Math.sin(x / 7) * 2.2, k % 2 ? 10.5 : 13.5, k % 2 ? 12 : -12, 1);
        }
      }
      scatter(ctx, ['sparkle'], { size: 4, spacing: 18, max: 8, top: 16, bottom: h - 16, rot: 10, opacity: 0.6 });
      break;
    }

    case 'sky': {
      const hero = ids[0];
      put(ctx, hero, 72, 17, 34, -8, 1);
      const smalls = ids.filter((m) => m !== hero && m !== 'cloud');
      scatter(ctx, smalls.length ? smalls : ['sparkle', 'star'], { size: 5.5, spacing: 10, max: 26, top: 2, bottom: h * 0.62, rot: 30 });
      if (ids.includes('cloud') || hero === 'cloud') {
        put(ctx, 'cloud', 18, h * 0.62, 30, 0, 0.92);
        put(ctx, 'cloud', 82, h * 0.74, 36, 0, 0.92);
        put(ctx, 'cloud', 36, h * 0.9, 26, 0, 0.85);
      }
      break;
    }

    case 'picnic': {
      const w = 8;
      let v = '';
      let hz = '';
      const u = ctx.u;
      for (let x = 0; x <= 100; x += 2 * w) v += `M${fmt(x * u)} 0L${fmt((x + w) * u)} 0L${fmt((x + w) * u)} ${fmt(H)}L${fmt(x * u)} ${fmt(H)}Z`;
      for (let y = 0; y <= h; y += 2 * w) hz += `M0 ${fmt(y * u)}L${fmt(W)} ${fmt(y * u)}L${fmt(W)} ${fmt((y + w) * u)}L0 ${fmt((y + w) * u)}Z`;
      // Clip the last stripes to the canvas.
      ctx.out.push({ d: clipRects(v, W, H), fill: c.light, opacity: 0.22 }, { d: clipRects(hz, W, H), fill: c.light, opacity: 0.22 });
      tiles(ctx, ids, 30, 14);
      break;
    }

    case 'tiled':
      tiles(ctx, ids, 26, 13);
      break;

    case 'bouquet': {
      const leafy = ids.find((m) => m === 'leaf-sprig' || m === 'leaf') ?? 'leaf-sprig';
      for (let k = 0; k < 6; k++) {
        const a = -55 + k * 22;
        put(ctx, leafy, 50 + 30 * Math.sin(rad(a)), h - 18 - 18 * Math.cos(rad(a)), 30, a, 0.95);
      }
      const flowers = ids.filter((m) => m !== leafy);
      const fl = flowers.length ? flowers : ids;
      for (let k = 0; k < 7; k++) {
        const a = -66 + k * 22;
        const r = k % 2 ? 22 : 28;
        put(ctx, fl[k % fl.length], 50 + r * Math.sin(rad(a)), h - 14 - r * Math.cos(rad(a)) * 0.9, k % 2 ? 16 : 19, a * 0.4, 1);
      }
      put(ctx, fl[0], 34, h - 9, 14, -10, 1);
      put(ctx, fl[fl.length > 1 ? 1 : 0], 66, h - 9, 14, 10, 1);
      scatter(ctx, ['sparkle'], { size: 4, spacing: 16, max: 10, top: 4, bottom: h * 0.45, rot: 10, opacity: 0.55 });
      break;
    }

    case 'petals': {
      const branch: Point[] = [{ x: 1, y: 8 }, { x: 16, y: 13 }, { x: 34, y: 12 }, { x: 52, y: 19 }, { x: 66, y: 18 }];
      const twig: Point[] = [{ x: 24, y: 12.5 }, { x: 32, y: 22 }, { x: 40, y: 27 }];
      strokePath(ctx, branch, c.secondary, 1.8, 1);
      strokePath(ctx, twig, c.secondary, 1, 1);
      const bloom = ids[0];
      const fall = ids.length > 1 ? ids.slice(1) : ids;
      for (const [x, y, s] of [[14, 12, 11], [30, 9, 9], [44, 15, 12], [62, 17, 10], [36, 25, 9], [6, 6, 8]] as [number, number, number][]) {
        put(ctx, bloom, x, y, s, ctx.rnd() * 70, 1);
      }
      let n = 0;
      for (let tries = 0; tries < 300 && n < 28; tries++) {
        const y = 22 + Math.pow(ctx.rnd(), 1.4) * (h - 26);
        const x = 4 + ctx.rnd() * 92;
        put(ctx, fall[n % fall.length], x, y, 3.5 + ctx.rnd() * 3, ctx.rnd() * 360, 0.8 + ctx.rnd() * 0.2);
        n++;
      }
      break;
    }

    case 'corners': {
      const big = ids[0];
      const mid = ids[1] ?? ids[0];
      const small = ids[2] ?? ids[0];
      const spots: [number, number, number][] = [
        [1, 1, -1],
        [-1, 1, 1],
        [1, -1, 1],
        [-1, -1, -1],
      ];
      for (const [sx, sy, sr] of spots) {
        const cx = sx > 0 ? 0 : 100;
        const cy = sy > 0 ? 0 : h;
        put(ctx, big, cx + sx * 14, cy + sy * 14, 30, sr * 15, 1);
        put(ctx, mid, cx + sx * 34, cy + sy * 8, 14, sr * -12, 1);
        put(ctx, small, cx + sx * 8, cy + sy * 34, 11, sr * 10, 1);
      }
      scatter(ctx, ['sparkle'], { size: 3.5, spacing: 20, max: 8, top: 30, bottom: h - 30, rot: 10, opacity: 0.5 });
      break;
    }

    case 'phases': {
      const u = ctx.u;
      const phases = [0.07, 0.18, 0.32, 0.5, 0.68, 0.82, 0.93];
      phases.forEach((p, i) => {
        const x = (11 + i * 13) * u;
        const y = 15 * u;
        const r = 4.6 * u;
        ctx.out.push({ d: circ(x, y, r), fill: c.secondary, opacity: 0.35 });
        ctx.out.push({ d: moonPhasePath(x, y, r, p), fill: c.light, opacity: 1 });
      });
      const smalls = ids.filter((m) => m === 'star' || m === 'sparkle');
      scatter(ctx, smalls.length ? smalls : ['sparkle'], { size: 4.5, spacing: 12, max: 16, top: 24, bottom: h * 0.7, rot: 25, opacity: 0.85 });
      if (ids.includes('moon')) put(ctx, 'moon', 78, h * 0.78, 30, -20, 1);
      if (ids.includes('cloud')) {
        put(ctx, 'cloud', 24, h * 0.84, 30, 0, 0.9);
        put(ctx, 'cloud', 60, h * 0.92, 24, 0, 0.8);
      }
      break;
    }

    case 'ground': {
      const gy = h - 16;
      const u = ctx.u;
      let d = `M0 ${fmt(gy * u)}`;
      for (let x = 0; x < 100; x += 20) {
        d += `Q${fmt((x + 10) * u)} ${fmt((gy - 3 + ctx.rnd() * 2) * u)} ${fmt((x + 20) * u)} ${fmt((gy + (ctx.rnd() - 0.5) * 2) * u)}`;
      }
      d += `L${fmt(W)} ${fmt(H)}L0 ${fmt(H)}Z`;
      ctx.out.push({ d, fill: c.secondary, opacity: 0.9 });
      const sky = ids.filter((m) => SKY.includes(m));
      const standing = ids.filter((m) => !SKY.includes(m));
      const st = standing.length ? standing : ids;
      const xs = [10, 26, 42, 58, 74, 90];
      xs.forEach((x, i) => {
        const size = i % 2 ? 14 : 20;
        put(ctx, st[i % st.length], x + (ctx.rnd() - 0.5) * 4, gy - size * 0.38, size, (ctx.rnd() - 0.5) * 10, 1);
      });
      for (const x of [18, 50, 82]) put(ctx, st[Math.floor(x / 16) % st.length], x, h - 6, 10, (ctx.rnd() - 0.5) * 20, 0.9);
      if (sky.length) scatter(ctx, sky, { size: 5, spacing: 14, max: 14, top: 4, bottom: h * 0.55, rot: 20, opacity: 0.85 });
      break;
    }
  }
  return ctx.out.slice(0, MAX_ART_PATHS);
}

/** Clip axis-aligned rectangle subpaths (M x y L … Z, four corners) to the canvas. */
function clipRects(d: string, W: number, H: number): string {
  const nums = pathNumbers(d);
  let out = '';
  for (let i = 0; i + 7 < nums.length; i += 8) {
    const xs = [nums[i], nums[i + 2], nums[i + 4], nums[i + 6]];
    const ys = [nums[i + 1], nums[i + 3], nums[i + 5], nums[i + 7]];
    const x0 = clamp(Math.min(...xs), 0, W);
    const x1 = clamp(Math.max(...xs), 0, W);
    const y0 = clamp(Math.min(...ys), 0, H);
    const y1 = clamp(Math.max(...ys), 0, H);
    if (x1 - x0 > 0 && y1 - y0 > 0) out += `M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}L${fmt(x0)} ${fmt(y1)}Z`;
  }
  return out;
}
