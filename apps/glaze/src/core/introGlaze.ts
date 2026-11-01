// Glaze brand mark + opening animation. Pure TypeScript, run directly by Node: the geometry here is the single source
// of truth for the native splash image (scripts/brand/build-brand.mjs writes assets/brand/splash-icon*.svg from it)
// and for the in-app intro (src/ui/IntroGlaze.tsx).
//
// The mark is the Prism diamond (fb-1025 G, 25 Oct): a gem-cut crystal seen slightly from above, point down, with a
// beam of light splitting into a fan of six glaze colours. T199 (owner-1101d #2, 1 Nov): the cute prism creature of
// T190 was rejected ("doesn't go towards the male audience"), so the app icon went back to this diamond (the icon
// SVGs are the 25 Oct files in docs/mascot/previous-prism-diamond/, copied verbatim into assets/brand/) and the intro
// became a full-screen light-beam scene instead of the icon inside a small tile.
//
// The intro (≤ 1.5 s including the fade): a dark screen with the small diamond in the middle, unlit (= the native
// splash). A thin beam of light sweeps in from the upper left and settles on the diamond, the diamond lights up, the
// light leaves its point as six soft colour bands fanning down to the bottom of the screen, a glint appears, then
// everything fades to the Themes tab. Calm motion only (docs/POLISH.md, fb-1022c, T151): sine ease-in-out or linear,
// no springs, overshoot, bounce or size change. Reduce Motion: the finished frame at once, then the short fade.

import { darkV2, lightV2 } from './designV2.ts';
import { durations } from './motion.ts';

// ---------------------------------------------------------------- the diamond (1024 × 1024 icon space)

export type Pt = readonly [number, number];

const r1 = (v: number): number => Math.round(v * 10) / 10;
const f1 = (v: number): string => {
  const s = r1(v).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export const polyPath = (pts: readonly Pt[]): string => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')} Z`;

/**
 * The gem: table T1-T2 with its front point C, girdle L-R, the pavilion's inner points PL / M / PR and the TIP (point
 * down, where the light leaves). Identical to docs/mascot/previous-prism-diamond/icon.svg (introGlaze.test.ts checks).
 */
export const GEM = {
  T1: [330, 280],
  T2: [694, 280],
  L: [188, 318],
  R: [836, 318],
  C: [512, 362],
  M: [512, 462],
  PL: [350, 390],
  PR: [674, 390],
  TIP: [512, 580],
} as const satisfies Record<string, Pt>;

export type GemFacet = {
  id: string;
  pts: readonly Pt[];
  /** Gradient stops (top → bottom) when the light is through the gem. */
  lit: readonly [string, string];
  /** Gradient stops before the light arrives (the native splash and the intro's first frame). */
  dim: readonly [string, string];
};

/** Pavilion first (back), then the crown, then the table, as drawn in the icon. */
export const GEM_FACETS: readonly GemFacet[] = [
  { id: 'pvLo', pts: [GEM.L, GEM.PL, GEM.TIP], lit: ['#9C8CF2', '#3C2C93'], dim: ['#4A3F86', '#211A47'] },
  { id: 'pvLi', pts: [GEM.PL, GEM.M, GEM.TIP], lit: ['#BFE0FF', '#5A78DA'], dim: ['#4F5C9C', '#232650'] },
  { id: 'pvRi', pts: [GEM.M, GEM.PR, GEM.TIP], lit: ['#FFE6B6', '#D9789E'], dim: ['#6A557F', '#2E2145'] },
  { id: 'pvRo', pts: [GEM.PR, GEM.R, GEM.TIP], lit: ['#C9A8F2', '#57308F'], dim: ['#4E3B7E', '#231844'] },
  { id: 'crB', pts: [GEM.T1, GEM.T2, GEM.R, GEM.L], lit: ['#D8D0FF', '#A99DEB'], dim: ['#5F5596', '#3A3270'] },
  { id: 'crL', pts: [GEM.T1, GEM.C, GEM.M, GEM.L], lit: ['#F2EEFF', '#AFA4F0'], dim: ['#6A61A3', '#3B3474'] },
  { id: 'crR', pts: [GEM.C, GEM.T2, GEM.R, GEM.M], lit: ['#D9D1FC', '#8B7EDD'], dim: ['#5A5193', '#2F2965'] },
  { id: 'tbl', pts: [GEM.T1, GEM.T2, GEM.C], lit: ['#FFFFFF', '#E1DBFF'], dim: ['#7A72B4', '#5A5296'] },
];

/** Facet edges (fine light lines) and the outline. */
export const GEM_EDGES_D =
  'M330 280 L694 280 M694 280 L512 362 M512 362 L330 280 M330 280 L188 318 M694 280 L836 318 M512 362 L512 462 M188 318 L512 462 M512 462 L836 318 M350 390 L512 580 M512 462 L512 580 M674 390 L512 580';
export const GEM_OUTLINE_D = 'M188 318 L330 280 L694 280 L836 318 L512 580 Z';
/** Stroke opacities: [edges, outline], lit and dim. */
export const GEM_STROKE = { lit: [0.55, 0.7], dim: [0.28, 0.3] } as const;
/** The glow where the light leaves the point, the gloss on the crown and the glint (four-point star). */
export const GEM_TIP_GLOW = { cx: 512, cy: 580, r: 90 } as const;
export const GEM_GLOSS_D = 'M352 292 L434 322';
export const GEM_GLINT_D = 'M708 228 Q716.4 261.6 750 270 Q716.4 278.4 708 312 Q699.6 278.4 666 270 Q699.6 261.6 708 228 Z';

/** The six glaze colours, left to right (the icon's fan). */
export const SPECTRUM = ['#9D7BFF', '#76C3FF', '#78E0BE', '#FFE07F', '#FFAE82', '#FF97C4'] as const;

/** Where the beam enters the table (icon space). */
export const BEAM_ENTRY: Pt = [479, 318];

/**
 * T220 (owner-1101e 11:39 #1): the intro shows the Prism figure Jared picked (assets/brand/prism-figure.png, cut out of
 * docs/mascot/picked-1025/glaze-prism.jpg by scripts/brand/picked-icon.py) instead of the diamond. Points in the same
 * 1024 canvas: the beam enters the top of its head, the colour fan pours from under its feet, the glint sits just off
 * the head's upper-left corner.
 */
export const FIGURE = {
  ENTRY: [468, 150],
  TIP: [505, 872],
} as const satisfies Record<string, Pt>;
export const FIGURE_GLINT_D = 'M408 58 Q414.3 83.2 440 90 Q414.3 96.8 408 122 Q401.7 96.8 376 90 Q401.7 83.2 408 58 Z';

/** Android adaptive icon background colour (the icon ground's mid tone). */
export const ADAPTIVE_BG = '#1C1442';

/** Colours. */
export const BRAND = {
  /**
   * The intro and the native splash sit on the dark app background in both appearances (T199: the first frame is a
   * dark screen), read from the `bg` token so the splash → intro hand-over is one colour.
   */
  introBg: darkV2.bg,
  /** The soft violet bloom behind the diamond once it is lit. */
  glow: '#4E36A0',
  /** The app background the intro fades to (the Themes tab paints the same token). */
  light: { bg: lightV2.bg },
  dark: { bg: darkV2.bg },
} as const;

/** Native splash image width in points (app.json expo-splash-screen imageWidth; the intro draws the gem the same). */
export const SPLASH_SIZE = 240;

// ---------------------------------------------------------------- full-screen layout (points)

/** The beam's final tilt from vertical (coming from the upper left), and where its sweep starts (extra degrees). */
export const BEAM_TILT_DEG = 14;
export const SWEEP_FROM_DEG = -34;
/** The colour fan below the point: from FAN_FROM to FAN_TO degrees from vertical (downward), split into six bands. */
export const FAN_FROM_DEG = -30;
export const FAN_TO_DEG = 30;
/** Peak opacity of a band at the point (soft, never solid). */
export const BAND_OPACITY = 0.62;

export type IntroBand = { color: string; d: string; x2: number; y2: number };
export type IntroLayout = {
  /** The 1024 canvas drawn at `size` points, centred: same place as the native splash image. */
  size: number;
  ox: number;
  oy: number;
  entry: Pt;
  tip: Pt;
  /** Beam length (reaches past every screen edge whatever the sweep angle). */
  len: number;
  /** The beam line inside its own 2·len square centred on `entry` (rotated there for the sweep). */
  beam: { x1: number; y1: number; x2: number; y2: number };
  bands: IntroBand[];
};

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Screen geometry of the intro for a window of `w` × `h` points. */
export function introLayout(w: number, h: number): IntroLayout {
  const W = Number.isFinite(w) && w > 0 ? w : 1;
  const H = Number.isFinite(h) && h > 0 ? h : 1;
  const size = Math.max(1, Math.min(SPLASH_SIZE, W - 32, H - 32));
  const k = size / 1024;
  const ox = (W - size) / 2;
  const oy = (H - size) / 2;
  const at = (p: Pt): Pt => [r1(ox + p[0] * k), r1(oy + p[1] * k)];
  const entry = at(FIGURE.ENTRY);
  const tip = at(FIGURE.TIP);
  const len = Math.ceil(Math.hypot(W, H));
  const t = rad(BEAM_TILT_DEG);
  const beam = { x1: len, y1: len, x2: r1(len - len * Math.sin(t)), y2: r1(len - len * Math.cos(t)) };
  const step = (FAN_TO_DEG - FAN_FROM_DEG) / SPECTRUM.length;
  const ray = (deg: number, l: number): Pt => [r1(tip[0] + l * Math.sin(rad(deg))), r1(tip[1] + l * Math.cos(rad(deg)))];
  const bands = SPECTRUM.map((color, i) => {
    const a0 = FAN_FROM_DEG + i * step;
    const a1 = a0 + step;
    const mid = ray(a0 + step / 2, len * 0.8);
    return { color, d: polyPath([tip, ray(a0, len), ray(a1, len)]), x2: mid[0], y2: mid[1] };
  });
  return { size, ox: r1(ox), oy: r1(oy), entry, tip, len, beam, bands };
}

// ---------------------------------------------------------------- timeline

/** Allowed easing names for every intro tween (calm only). */
export const CALM_EASINGS = ['inOut', 'linear'] as const;
export type CalmEasing = (typeof CALM_EASINGS)[number];

export type Tween = { start: number; duration: number; easing: CalmEasing };

/** Band i starts BAND_STAGGER ms after band i - 1 (violet first, rose last). */
export const BAND_STAGGER = 50;

/**
 * Intro timings in ms from the first frame. The beam fades in while it sweeps onto the diamond, the diamond lights,
 * the six bands bloom out of the point one after another, then the glint. The fade uses the app's `slow` token.
 */
export const INTRO_MS = {
  beam: { start: 0, duration: 320, easing: 'inOut' } as Tween,
  sweep: { start: 0, duration: 600, easing: 'inOut' } as Tween,
  ignite: { start: 440, duration: 300, easing: 'inOut' } as Tween,
  band: { start: 520, duration: 320, easing: 'inOut' } as Tween,
  glint: { start: 860, duration: 240, easing: 'inOut' } as Tween,
  /** The animation ends here (the last tween's end). */
  total: 1100,
  /** Pause on the finished frame before fading (only when the app is already ready). */
  settle: 80,
  fadeOut: durations.slow,
  /** Startup never waits longer than this for fonts / languages. */
  maxWait: 3000,
} as const;

/** Band i's tween. */
export function bandTween(i: number): Tween {
  return { ...INTRO_MS.band, start: INTRO_MS.band.start + i * BAND_STAGGER };
}

/** Every tween in the intro. */
export function allTweens(): Tween[] {
  return [INTRO_MS.beam, INTRO_MS.sweep, INTRO_MS.ignite, ...SPECTRUM.map((_, i) => bandTween(i)), INTRO_MS.glint];
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

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export type IntroFrame = {
  /** Beam opacity 0..1. */
  beam: number;
  /** Beam rotation in degrees (SWEEP_FROM_DEG → 0). */
  sweep: number;
  /** Lit diamond opacity over the dim one. */
  ignite: number;
  /** Opacity 0..1 of each colour band (multiplied by BAND_OPACITY when drawn). */
  bands: number[];
  glint: number;
};

/** Everything the intro shows at time `ms` (the end state after INTRO_MS.total). */
export function frameAt(ms: number): IntroFrame {
  return {
    beam: r3(tweenAt(INTRO_MS.beam, ms)),
    sweep: r3(SWEEP_FROM_DEG * (1 - tweenAt(INTRO_MS.sweep, ms))) || 0,
    ignite: r3(tweenAt(INTRO_MS.ignite, ms)),
    bands: SPECTRUM.map((_, i) => r3(tweenAt(bandTween(i), ms))),
    glint: r3(tweenAt(INTRO_MS.glint, ms)),
  };
}

export type Track = 'beam' | 'sweep' | 'ignite' | 'glint' | `band${0 | 1 | 2 | 3 | 4 | 5}`;
export const TRACKS: readonly Track[] = ['beam', 'sweep', 'ignite', 'glint', 'band0', 'band1', 'band2', 'band3', 'band4', 'band5'];

function tweenFor(track: Track): Tween {
  if (track === 'beam') return INTRO_MS.beam;
  if (track === 'sweep') return INTRO_MS.sweep;
  if (track === 'ignite') return INTRO_MS.ignite;
  if (track === 'glint') return INTRO_MS.glint;
  const m = /^band([0-5])$/.exec(String(track));
  if (m) return bandTween(Number(m[1]));
  throw new Error(`unknown track ${String(track)}`);
}

function valueAt(track: Track, ms: number): number {
  const f = frameAt(ms);
  if (track === 'beam' || track === 'sweep' || track === 'ignite' || track === 'glint') return f[track];
  return f.bands[Number(track.slice(4))]!;
}

/**
 * `count` samples of one track over a 0..1 clock (clock = ms / INTRO_MS.total), inside its tween, so the UI can
 * interpolate one linear clock and still follow the calm curve. Values: opacities 0..1, or the sweep in degrees.
 */
export function trackKeyframes(track: Track, count = 12): { t: number[]; v: number[] } {
  const tw = tweenFor(track);
  const t: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < count; i++) {
    const ms = tw.start + (i / (count - 1)) * tw.duration;
    t.push(ms / INTRO_MS.total);
    v.push(valueAt(track, ms));
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

/** The intro starts fading when the animation has played (or motion is reduced) and startup is ready. */
export function canFade(played: boolean, ready: boolean): boolean {
  return played && ready;
}

// ---------------------------------------------------------------- native splash image

/** The gem's facets, edges and outline in `mode` (lit or dim), with gradient ids prefixed by `id`. */
export function gemSvg(id: string, mode: 'lit' | 'dim'): { defs: string; body: string } {
  const defs = GEM_FACETS.map(
    (fc) => `<linearGradient id="${id}${mode}-${fc.id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${fc[mode][0]}"/><stop offset="1" stop-color="${fc[mode][1]}"/></linearGradient>`,
  ).join('');
  const [edge, outline] = GEM_STROKE[mode];
  const body = [
    ...GEM_FACETS.map((fc) => `<path d="${polyPath(fc.pts)}" fill="url(#${id}${mode}-${fc.id})"/>`),
    `<path d="${GEM_EDGES_D}" fill="none" stroke="#FFFFFF" stroke-opacity="${edge}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="${GEM_OUTLINE_D}" fill="none" stroke="#FFFFFF" stroke-opacity="${outline}" stroke-width="5" stroke-linejoin="round"/>`,
  ].join('');
  return { defs, body };
}

/**
 * The native splash image (light and dark are the same file content: the splash background is the dark intro
 * background in both): the unlit diamond alone on a transparent canvas, no tile, no beam. The intro's first frame
 * draws exactly this at the same size and place, then lights it.
 */
export function splashSvg(): string {
  const g = gemSvg('s', 'dim');
  const marker = `<linearGradient id="prism" x1="0" y1="0" x2="1" y2="0">${SPECTRUM.map((s, i) => `<stop offset="${f1(i / (SPECTRUM.length - 1))}" stop-color="${s}"/>`).join('')}</linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${marker}${g.defs}</defs>${g.body}</svg>\n`;
}

/** The intro's lit diamond (drawn over the splash one as the light arrives): lit facets, the glow at the point, gloss. */
export function litGemSvg(): string {
  const g = gemSvg('i', 'lit');
  const { cx, cy, r } = GEM_TIP_GLOW;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${g.defs}<radialGradient id="itip" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>${g.body}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#itip)"/><path d="${GEM_GLOSS_D}" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.75"/></svg>\n`;
}

/** The glint (four-point star) at the gem's upper right, last to appear. */
export function glintSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><path d="${GEM_GLINT_D}" fill="#FFFFFF"/></svg>\n`;
}
