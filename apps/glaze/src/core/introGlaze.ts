// Glaze brand mark + opening animation (owner, 23 Oct night: "each app ... their own little logo and animation on
// start up"). Pure TypeScript, run directly by Node: the geometry here is the single source of truth for the app icon
// (scripts/brand/build-brand.ts writes assets/brand/*.svg from it) and for the in-app intro (src/ui/IntroGlaze.tsx).
//
// The mark: a soft porcelain squircle tile with a glossy pink → peach glaze poured over its top edge, running down in
// three uneven drips, a darker under-edge for depth, a bead at the longest drip's tip and a white gloss streak.
// Faceless on purpose: the mascot choice (docs/MASCOT.md) stays open for the owner.
//
// The intro: the native splash shows the empty tile; the glaze pours over the top edge and runs down (the longest drip
// slowest), a bead forms at its tip, a gloss highlight sweeps across, then everything fades to the app.
// Calm motion only (docs/POLISH.md, fb-1022c): sine ease-in-out or linear, no springs, overshoot, squash or bounce.

import { durations } from './motion.ts';

// ---------------------------------------------------------------- geometry (1024 × 1024 icon space)

/** The porcelain tile: a superellipse centred at (cx, cy) with half-sizes a × b and exponent n. */
export const TILE = { cx: 512, cy: 484, a: 318, b: 326, n: 5 } as const;
/** The glaze sits a little proud of the tile (it was poured over it). */
export const GLAZE_PROUD = 7;
/** Under-edge offset: the darker copy of the glaze peeks out below it for depth. */
export const UNDER_DY = 10;

export const TILE_TOP = TILE.cy - TILE.b;
export const TILE_LEFT = TILE.cx - TILE.a;
export const TILE_RIGHT = TILE.cx + TILE.a;

/** Glaze base line (the cap's lower edge) as an offset below the tile top, before drips. */
const BASE_DEPTH = 212;
const BASE_WAVE = 14;
/** How far down the tile's sides the glaze runs (offset below the tile top). */
const EDGE_DEPTH = { left: 282, right: 246 } as const;

export type Drip = { x: number; w: number; len: number };
/**
 * Three uneven drips, left to right: x = centre, w = half-width at the root, len = length below the base line.
 * The middle one is the longest (it runs slowest in the intro and grows the bead).
 */
export const DRIPS: readonly Drip[] = [
  { x: 314, w: 34, len: 122 },
  { x: 550, w: 42, len: 258 },
  { x: 728, w: 30, len: 70 },
];
export const LONGEST = 1;

/** Colours (light / dark). The glaze gradient is the app's `glaze` token (src/core/designV2.ts). */
export const BRAND = {
  light: {
    bg: '#F4F1F7',
    iconBg: ['#F5F0FC', '#D6C6F8'] as const,
    tile: ['#FFFFFF', '#EFE6F2'] as const,
    tileRim: '#DDD0E8',
    glaze: ['#F7A8D8', '#FFC9A3'] as const,
    under: '#E07BB4',
    shadow: '#4B2F6A',
  },
  dark: {
    bg: '#0F0D12',
    iconBg: ['#2A2140', '#151219'] as const,
    tile: ['#36303F', '#221E28'] as const,
    tileRim: '#463E52',
    glaze: ['#B8488F', '#E07D55'] as const,
    under: '#7A2E6B',
    shadow: '#000000',
  },
} as const;

const r1 = (v: number): number => Math.round(v * 10) / 10;
const f = (v: number): string => {
  const s = r1(v).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Superellipse outline (closed path) with half-sizes grown by `grow`. */
export function squirclePath(grow = 0, steps = 160, cx: number = TILE.cx, cy: number = TILE.cy, a: number = TILE.a, b: number = TILE.b): string {
  const A = a + grow;
  const B = b + grow;
  const e = 2 / TILE.n;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const x = cx + A * Math.sign(c) * Math.abs(c) ** e;
    const y = cy + B * Math.sign(s) * Math.abs(s) ** e;
    pts.push(`${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`);
  }
  return `${pts.join(' ')} Z`;
}

/** Final base line y at x (gentle uneven wave). */
function baseFinal(x: number): number {
  const u = (x - TILE_LEFT) / (TILE_RIGHT - TILE_LEFT);
  return TILE_TOP + BASE_DEPTH + BASE_WAVE * Math.sin(u * Math.PI * 2 * 1.25 + 0.5) + 6 * Math.sin(u * Math.PI * 5.3 + 1.7);
}

/** Where the pour starts: just above the glaze's top edge, so cap progress 0 shows no glaze. */
const POUR_FROM = TILE_TOP - GLAZE_PROUD - UNDER_DY - 8;

export type GlazeState = {
  /** Cap pour progress 0..1 (the base line descends from above the tile to its final wave). */
  cap: number;
  /** Per-drip progress 0..1. */
  drips: readonly number[];
};

export const FINAL_STATE: GlazeState = { cap: 1, drips: DRIPS.map(() => 1) };

/**
 * The glaze shape for a state, clipped by the caller to squirclePath(GLAZE_PROUD). Fixed command structure for every
 * state (M, L×3, then C segments, Z) so Animated can interpolate between frames number by number.
 */
export function glazePath(state: GlazeState): string {
  const cap = clamp01(state.cap);
  // While it pours, the front edge is a little more uneven (a slow ripple that settles to the final wave by cap = 1).
  const ripple = 9 * Math.sin(Math.PI * cap);
  const yb = (x: number): number =>
    lerp(POUR_FROM, baseFinal(x), cap) + ripple * Math.sin(((x - TILE_LEFT) / (TILE_RIGHT - TILE_LEFT)) * Math.PI * 3.1 + 0.3);
  const yEdgeL = lerp(POUR_FROM, TILE_TOP + EDGE_DEPTH.left, cap);
  const yEdgeR = lerp(POUR_FROM, TILE_TOP + EDGE_DEPTH.right, cap);
  const xl = TILE_LEFT - 40;
  const xr = TILE_RIGHT + 40;
  const top = TILE_TOP - 80;
  const out: string[] = [`M${f(xl)} ${f(top)}`, `L${f(xr)} ${f(top)}`, `L${f(xr)} ${f(yEdgeR)}`];
  const C = (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) =>
    out.push(`C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x)} ${f(y)}`);

  // Right to left: edge → drips (right first) → edge.
  let px = xr;
  let py = yEdgeR;
  let first = true;
  for (let i = DRIPS.length - 1; i >= 0; i--) {
    const d = DRIPS[i]!;
    const L = d.len * clamp01(state.drips[i] ?? 0);
    const r = Math.min(d.w * 0.8, L * 0.5);
    const fil = d.w * 0.95;
    const ax = d.x + d.w + fil;
    const ay = yb(ax);
    // Along the base (or down off the right edge) to the drip's right shoulder.
    if (first) C(px - 46, py, ax + 70, yb(ax + 70), ax, ay);
    else C(lerp(px, ax, 1 / 3), yb(lerp(px, ax, 1 / 3)), lerp(px, ax, 2 / 3), yb(lerp(px, ax, 2 / 3)), ax, ay);
    first = false;
    const root = yb(d.x);
    const sideY = root + L - r;
    // Concave fillet into the right side, then down to the tip's shoulder.
    C(d.x + d.w + fil * 0.25, ay + (root - ay) * 0.4, d.x + r * 1.02, root + (sideY - root) * 0.3, d.x + r, sideY);
    // Round tip (two quarter arcs).
    const k = 0.5523 * r;
    C(d.x + r, sideY + k, d.x + k, sideY + r, d.x, sideY + r);
    C(d.x - k, sideY + r, d.x - r, sideY + k, d.x - r, sideY);
    // Up the left side and out through the fillet to the left shoulder.
    const ex = d.x - d.w - fil;
    const ey = yb(ex);
    C(d.x - r * 1.02, root + (sideY - root) * 0.3, d.x - d.w - fil * 0.25, ey + (root - ey) * 0.4, ex, ey);
    px = ex;
    py = ey;
  }
  C(px - 70, yb(px - 70), xl + 46, yEdgeL, xl, yEdgeL);
  out.push('Z');
  return out.join(' ');
}

/** The bead at the longest drip's tip, for bead progress 0..1 (radius 0 = not formed). */
export function beadCircle(progress: number): { cx: number; cy: number; r: number } {
  const d = DRIPS[LONGEST]!;
  const tipR = Math.min(d.w * 0.8, d.len * 0.5);
  const tipY = baseFinal(d.x) + d.len;
  const p = clamp01(progress);
  return { cx: d.x, cy: r1(tipY - tipR * 0.95), r: r1(tipR * 1.16 * p) };
}

/** The static gloss streak (along the glaze's top-left shoulder) and its little dot. */
export const GLOSS_STREAK_D = `M${TILE_LEFT + 68} ${TILE_TOP + 108} Q${TILE_LEFT + 100} ${TILE_TOP + 52} ${TILE_LEFT + 184} ${TILE_TOP + 45}`;
export const GLOSS_DOT = { cx: TILE_LEFT + 226, cy: TILE_TOP + 44, r: 12 } as const;
/** A short highlight running down the longest drip. */
export const DRIP_GLINT_D = `M${DRIPS[LONGEST]!.x - 19} ${TILE_TOP + BASE_DEPTH + 34} L${DRIPS[LONGEST]!.x - 19} ${TILE_TOP + BASE_DEPTH + 130}`;

/** The gloss sweep band: a soft white bar, rotated GLOSS_ANGLE°, travelling from GLOSS_FROM to GLOSS_TO (band x). */
export const GLOSS_ANGLE = 28;
export const GLOSS_BAND_W = 90;
export const GLOSS_FROM = 40;
export const GLOSS_TO = 940;

// ---------------------------------------------------------------- timeline

/** Allowed easing names for every intro tween (calm only). */
export const CALM_EASINGS = ['inOut', 'linear'] as const;
export type CalmEasing = (typeof CALM_EASINGS)[number];

export type Tween = { start: number; duration: number; easing: CalmEasing };

/**
 * Intro timings in ms from the first frame. The longest drip runs a little slower than the others; the bead forms as
 * it settles; the gloss sweeps once the glaze is still. The fade uses the app's own `slow` motion token.
 */
export const INTRO_MS = {
  cap: { start: 0, duration: 680, easing: 'inOut' } as Tween,
  drips: [
    { start: 470, duration: 640, easing: 'inOut' },
    { start: 520, duration: 900, easing: 'inOut' },
    { start: 440, duration: 520, easing: 'inOut' },
  ] as readonly Tween[],
  bead: { start: 1380, duration: 300, easing: 'inOut' } as Tween,
  gloss: { start: 1580, duration: 420, easing: 'linear' } as Tween,
  streak: { start: 1760, duration: 240, easing: 'inOut' } as Tween,
  /** The animation ends here (the last tween's end). */
  total: 2000,
  /** Pause on the finished logo before fading (only when the app is already ready). */
  settle: 80,
  fadeOut: durations.slow,
  /** Startup never waits longer than this for fonts / languages. */
  maxWait: 3000,
} as const;

/** Every tween in the intro. */
export function allTweens(): Tween[] {
  return [INTRO_MS.cap, ...INTRO_MS.drips, INTRO_MS.bead, INTRO_MS.gloss, INTRO_MS.streak];
}

/** Sine ease-in-out (no overshoot) or linear. */
export function ease(name: CalmEasing, x: number): number {
  const t = clamp01(x);
  return name === 'linear' ? t : 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** A tween's eased progress 0..1 at time `ms`. */
export function tweenAt(tw: Tween, ms: number): number {
  if (!(tw.duration > 0)) return ms >= tw.start ? 1 : 0;
  return ease(tw.easing, (ms - tw.start) / tw.duration);
}

export type IntroFrame = GlazeState & { bead: number; gloss: number; streak: number };

/** Everything the intro shows at time `ms` (clamped to the end state after INTRO_MS.total). */
export function frameAt(ms: number): IntroFrame {
  return {
    cap: tweenAt(INTRO_MS.cap, ms),
    drips: INTRO_MS.drips.map((tw) => tweenAt(tw, ms)),
    bead: tweenAt(INTRO_MS.bead, ms),
    gloss: tweenAt(INTRO_MS.gloss, ms),
    streak: tweenAt(INTRO_MS.streak, ms),
  };
}

/**
 * Keyframes for the glaze shape: `count` evenly spaced times across the pour (0 → the longest drip's end), as
 * Animated interpolation stops over a 0..1 clock. Linear interpolation between neighbours is invisible at 32 frames.
 */
export function glazeKeyframes(count = 32): { t: number[]; d: string[] } {
  const end = Math.max(INTRO_MS.cap.start + INTRO_MS.cap.duration, ...INTRO_MS.drips.map((tw) => tw.start + tw.duration));
  const t: number[] = [];
  const d: string[] = [];
  for (let i = 0; i < count; i++) {
    const ms = (i / (count - 1)) * end;
    t.push(ms / INTRO_MS.total);
    d.push(glazePath(frameAt(ms)));
  }
  return { t, d };
}

/** The gloss band for sweep progress 0..1: its x in the rotated frame and a soft in/out opacity (sine, no flash). */
export function glossBandAt(p: number): { x: number; opacity: number } {
  const t = clamp01(p);
  return { x: r1(lerp(GLOSS_FROM, GLOSS_TO, t)), opacity: Math.round(Math.sin(Math.PI * t) * 0.85 * 1000) / 1000 };
}

export type Track = 'bead' | 'glossX' | 'glossOpacity' | 'streak';

/**
 * `count` samples of one scalar track over a 0..1 clock (clock = ms / INTRO_MS.total), inside its tween's window, so
 * the UI can interpolate it linearly and still follow the calm easing. Values: bead radius, gloss band x / opacity,
 * streak opacity.
 */
export function trackKeyframes(track: Track, count = 12): { t: number[]; v: number[] } {
  const tw = track === 'bead' ? INTRO_MS.bead : track === 'streak' ? INTRO_MS.streak : INTRO_MS.gloss;
  const t: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < count; i++) {
    const ms = tw.start + (i / (count - 1)) * tw.duration;
    const p = tweenAt(tw, ms);
    t.push(ms / INTRO_MS.total);
    if (track === 'bead') v.push(beadCircle(p).r);
    else if (track === 'streak') v.push(Math.round(p * 1000) / 1000);
    else if (track === 'glossX') v.push(glossBandAt(p).x);
    else v.push(glossBandAt(p).opacity);
  }
  return { t, v };
}

/**
 * The app (and the intro's fade) go ahead when fonts and languages are loaded, or after INTRO_MS.maxWait from launch
 * even if they are not (system fonts / the default language until they arrive), so a slow device never sees an
 * endless splash.
 */
export function startupReady(fontsDone: boolean, i18nDone: boolean, elapsedMs: number): boolean {
  return (fontsDone && i18nDone) || elapsedMs >= INTRO_MS.maxWait;
}

/** The intro starts fading when the pour has played (or motion is reduced) and startup is ready. */
export function canFade(pourDone: boolean, ready: boolean): boolean {
  return pourDone && ready;
}

// ---------------------------------------------------------------- static SVG compositions (brand assets)

export type BrandScheme = 'light' | 'dark';

function defs(scheme: BrandScheme, id: string): string {
  const c = BRAND[scheme];
  return [
    `<linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.iconBg[0]}"/><stop offset="1" stop-color="${c.iconBg[1]}"/></linearGradient>`,
    `<linearGradient id="${id}tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.tile[0]}"/><stop offset="1" stop-color="${c.tile[1]}"/></linearGradient>`,
    `<linearGradient id="${id}glaze" x1="${TILE_LEFT}" y1="${TILE_TOP}" x2="${TILE_RIGHT}" y2="${TILE_TOP + 460}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.glaze[0]}"/><stop offset="1" stop-color="${c.glaze[1]}"/></linearGradient>`,
    `<linearGradient id="${id}sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`,
    `<radialGradient id="${id}shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c.shadow}" stop-opacity="${scheme === 'light' ? 0.22 : 0.5}"/><stop offset="1" stop-color="${c.shadow}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${id}base" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="${c.shadow}" stop-opacity="0"/><stop offset="1" stop-color="${c.shadow}" stop-opacity="${scheme === 'light' ? 0.07 : 0.25}"/></linearGradient>`,
    `<clipPath id="${id}clip"><path d="${squirclePath(GLAZE_PROUD)}"/></clipPath>`,
  ].join('');
}

/** Tile with its soft floor shadow (no glaze): the native splash image and the intro's first frame. */
function tileMarkup(id: string, scheme: BrandScheme): string {
  const c = BRAND[scheme];
  return [
    `<ellipse cx="${TILE.cx}" cy="${TILE.cy + TILE.b + 34}" rx="${TILE.a * 0.92}" ry="44" fill="url(#${id}shadow)"/>`,
    `<path d="${squirclePath(0)}" fill="url(#${id}tile)" stroke="${c.tileRim}" stroke-width="3"/>`,
    `<path d="${squirclePath(0)}" fill="url(#${id}base)"/>`,
  ].join('');
}

function glazeMarkup(id: string, scheme: BrandScheme): string {
  const c = BRAND[scheme];
  const d = glazePath(FINAL_STATE);
  const b = beadCircle(1);
  return [
    `<g clip-path="url(#${id}clip)">`,
    `<g transform="translate(0 ${UNDER_DY})"><path d="${d}" fill="${c.under}"/><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${c.under}"/></g>`,
    `<path d="${d}" fill="url(#${id}glaze)"/><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="url(#${id}glaze)"/>`,
    `<path d="${d}" fill="url(#${id}sheen)"/>`,
    `</g>`,
    `<path d="${GLOSS_STREAK_D}" fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" opacity="0.85"/>`,
    `<circle cx="${GLOSS_DOT.cx}" cy="${GLOSS_DOT.cy}" r="${GLOSS_DOT.r}" fill="#FFFFFF" opacity="0.85"/>`,
    `<path d="${DRIP_GLINT_D}" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" opacity="0.45"/>`,
    `<circle cx="${b.cx - b.r * 0.38}" cy="${b.cy - b.r * 0.32}" r="${r1(b.r * 0.2)}" fill="#FFFFFF" opacity="0.7"/>`,
  ].join('');
}

const svgOpen = (w = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${w}" height="${w}">`;

/** The app icon: full bleed, opaque background (iOS masks the corners itself). */
export function iconSvg(scheme: BrandScheme = 'light'): string {
  const id = scheme === 'light' ? 'g' : 'gd';
  return `${svgOpen()}<defs>${defs(scheme, id)}</defs><rect width="1024" height="1024" fill="url(#${id}bg)"/>${tileMarkup(id, scheme)}${glazeMarkup(id, scheme)}</svg>\n`;
}

/** The native splash image: the empty tile on a transparent canvas (the intro pours the glaze). */
export function splashSvg(scheme: BrandScheme): string {
  const id = scheme === 'light' ? 's' : 'sd';
  return `${svgOpen()}<defs>${defs(scheme, id)}</defs>${tileMarkup(id, scheme)}</svg>\n`;
}

/**
 * Android adaptive icon foreground: the logo scaled into the 66/108 safe zone on transparency (the launcher adds the
 * background colour and its own mask).
 */
export const ADAPTIVE_SCALE = 0.66;
export function adaptiveForegroundSvg(): string {
  const s = ADAPTIVE_SCALE;
  const tx = 512 - 512 * s;
  const ty = 512 - (TILE.cy + 20) * s;
  return `${svgOpen()}<defs>${defs('light', 'a')}</defs><g transform="translate(${f(tx)} ${f(ty)}) scale(${s})">${tileMarkup('a', 'light')}${glazeMarkup('a', 'light')}</g></svg>\n`;
}

/** Android 13+ themed (monochrome) icon: tile outline + glaze silhouette in one colour. */
export function monochromeSvg(): string {
  const s = ADAPTIVE_SCALE;
  const tx = 512 - 512 * s;
  const ty = 512 - (TILE.cy + 20) * s;
  const b = beadCircle(1);
  return `${svgOpen()}<defs><clipPath id="m"><path d="${squirclePath(GLAZE_PROUD)}"/></clipPath></defs><g transform="translate(${f(tx)} ${f(ty)}) scale(${s})"><path d="${squirclePath(0)}" fill="none" stroke="#FFFFFF" stroke-width="34"/><g clip-path="url(#m)"><path d="${glazePath(FINAL_STATE)}" fill="#FFFFFF"/><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="#FFFFFF"/></g></g></svg>\n`;
}

/** Android adaptive icon background colour (the light icon background's mid tone). */
export const ADAPTIVE_BG = '#E9E0FB';
