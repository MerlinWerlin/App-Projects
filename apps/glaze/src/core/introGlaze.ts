// Glaze brand mark + opening animation. Pure TypeScript, run directly by Node: the geometry here is the single source
// of truth for the app icon (scripts/brand/build-brand.mjs writes assets/brand/*.svg from it) and for the in-app intro
// (src/ui/IntroGlaze.tsx).
//
// The mark is "Prism" (owner decision fb-1025 G, 25 Oct 2026; it replaced the glaze-drip tile, kept for reference in
// docs/mascot/previous-glaze-drip/). A gem-cut triangular crystal seen slightly from above, point down, on a deep
// indigo-to-ink ground. A thin beam of light falls into its table from the upper left and leaves the point as a soft fan
// of glaze colours (violet, sky, mint, butter, peach, rose) spreading downward. Clean facets, glossy edge light and one
// small sparkle. Gender-neutral and calm on purpose (docs/MASCOT.md).
//
// The intro: the native splash shows the tile with the crystal unlit; the beam fades in, the crystal lights up, the
// spectrum fans out ray by ray, a gloss highlight sweeps across the crystal and the sparkle appears, then everything
// fades to the app. Calm motion only (docs/POLISH.md, fb-1022c): sine ease-in-out or linear, no springs, overshoot,
// squash or bounce.

import { darkV2, lightV2 } from './designV2.ts';
import { durations } from './motion.ts';

// ---------------------------------------------------------------- geometry (1024 × 1024 icon space)

export type Pt = readonly [number, number];

/**
 * The crystal. Girdle (the widest outline): back-left L, back-right R, front F (nearest the viewer, so lowest on
 * screen). Table (the flat top, inset and raised): l, r, f. Pavilion point T. M1 / M2: pavilion ridges' upper ends.
 */
export const GEM = {
  L: [188, 318],
  R: [836, 318],
  F: [512, 462],
  l: [330, 280],
  r: [694, 280],
  f: [512, 362],
  T: [512, 580],
  M1: [350, 390],
  M2: [674, 390],
} as const satisfies Record<string, Pt>;

export type Facet = {
  id: string;
  pts: readonly Pt[];
  /** Lit glass gradient (top → bottom of the facet). */
  lit: readonly [string, string];
  /** Unlit (splash) glass gradient. */
  dim: readonly [string, string];
};

const { L, R, F, l, r, f, T, M1, M2 } = GEM;

/**
 * Facets back to front. The pavilion carries faint spectral tints (the light splitting inside the glass) that continue
 * into the fan below.
 */
export const FACETS: readonly Facet[] = [
  { id: 'pvLo', pts: [L, M1, T], lit: ['#9C8CF2', '#3C2C93'], dim: ['#4A3F86', '#211A47'] },
  { id: 'pvLi', pts: [M1, F, T], lit: ['#BFE0FF', '#5A78DA'], dim: ['#4F5C9C', '#232650'] },
  { id: 'pvRi', pts: [F, M2, T], lit: ['#FFE6B6', '#D9789E'], dim: ['#6A557F', '#2E2145'] },
  { id: 'pvRo', pts: [M2, R, T], lit: ['#C9A8F2', '#57308F'], dim: ['#4E3B7E', '#231844'] },
  { id: 'crB', pts: [l, r, R, L], lit: ['#D8D0FF', '#A99DEB'], dim: ['#5F5596', '#3A3270'] },
  { id: 'crL', pts: [l, f, F, L], lit: ['#F2EEFF', '#AFA4F0'], dim: ['#6A61A3', '#3B3474'] },
  { id: 'crR', pts: [f, r, R, F], lit: ['#D9D1FC', '#8B7EDD'], dim: ['#5A5193', '#2F2965'] },
  { id: 'tbl', pts: [l, r, f], lit: ['#FFFFFF', '#E1DBFF'], dim: ['#7A72B4', '#5A5296'] },
];

/** The crystal's outline (girdle + point), for clips and the outer edge light. */
export const GEM_OUTLINE: readonly Pt[] = [L, l, r, R, T];
/** Inner facet edges (drawn as fine light lines). */
export const GEM_EDGES: readonly (readonly [Pt, Pt])[] = [
  [l, r], [r, f], [f, l], [l, L], [r, R], [f, F], [L, F], [F, R], [M1, T], [F, T], [M2, T],
];

/** The spectrum, left to right on screen: the app's pastel family pushed a little brighter to glow on ink. */
export const SPECTRUM = ['#9D7BFF', '#76C3FF', '#78E0BE', '#FFE07F', '#FFAE82', '#FF97C4'] as const;

/** The fan leaves the point between these angles (degrees, screen space: 90 = straight down). */
export const FAN = { from: 122, to: 44, length: 460 } as const;

const r1 = (v: number): number => Math.round(v * 10) / 10;
const f1 = (v: number): string => {
  const s = r1(v).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export const polyPath = (pts: readonly Pt[]): string => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')} Z`;

/**
 * Ray i of the fan as a wedge from the point. Rays are opaque and overlap their right-hand neighbour a little (no
 * hairline seams); the whole fan fades with distance through one radial mask.
 */
export function rayPath(i: number): string {
  const n = SPECTRUM.length;
  const step = (FAN.to - FAN.from) / n;
  const a0 = ((FAN.from + step * i) * Math.PI) / 180;
  const a1 = ((FAN.from + step * (i + 1) + (i < n - 1 ? step * 0.15 : 0)) * Math.PI) / 180;
  const [tx, ty] = T;
  const p = (a: number): Pt => [tx + FAN.length * Math.cos(a), ty + FAN.length * Math.sin(a)];
  return polyPath([[tx, ty - 6], p(a0), p(a1)]);
}

/** The incoming beam (a narrow wedge falling into the table) and its soft halo. */
export const BEAM_D = polyPath([[384, -10], [422, -10], [486, 318], [472, 320]]);
export const BEAM_HALO_D = polyPath([[352, -10], [454, -10], [497, 318], [459, 322]]);

/** Gloss along the table's front-left edge, and the sparkle (a four-point star) at its right corner. */
export const GLOSS_STREAK_D = `M${l[0] + 22} ${l[1] + 12} L${l[0] + 104} ${l[1] + 42}`;
export const SPARKLE = { cx: 708, cy: 270, r: 42 } as const;
export function sparklePath(cx: number = SPARKLE.cx, cy: number = SPARKLE.cy, rr: number = SPARKLE.r): string {
  const w = rr * 0.2;
  return `M${f1(cx)} ${f1(cy - rr)} Q${f1(cx + w)} ${f1(cy - w)} ${f1(cx + rr)} ${f1(cy)} Q${f1(cx + w)} ${f1(cy + w)} ${f1(cx)} ${f1(cy + rr)} Q${f1(cx - w)} ${f1(cy + w)} ${f1(cx - rr)} ${f1(cy)} Q${f1(cx - w)} ${f1(cy - w)} ${f1(cx)} ${f1(cy - rr)} Z`;
}

/** The splash / intro tile: a squircle holding the icon composition at its own coordinates (no transform). */
export const TILE = { cx: 512, cy: 492, a: 420, b: 420, n: 5 } as const;

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
    pts.push(`${i === 0 ? 'M' : 'L'}${f1(x)} ${f1(y)}`);
  }
  return `${pts.join(' ')} Z`;
}

/** Colours (light / dark system appearance). The crystal and spectrum are the same in both; the ground deepens. */
export const BRAND = {
  light: {
    /**
     * Screen background behind the splash / intro. T173 (PREMIUM_UI §3.1): read from the app's `bg` token, never a copy,
     * so the intro's last frame and the Themes tab background are the same colour in light and dark.
     */
    bg: lightV2.bg,
    iconBg: ['#30226A', '#0E0B1E'] as const,
    glow: '#6A4BC4',
    tileRim: '#3E3279',
    shadow: '#2A1B4F',
  },
  dark: {
    bg: darkV2.bg,
    iconBg: ['#1E1646', '#07060D'] as const,
    glow: '#4E36A0',
    tileRim: '#2C2552',
    shadow: '#000000',
  },
} as const;

/** The gloss sweep band: a soft white bar, rotated GLOSS_ANGLE°, travelling from GLOSS_FROM to GLOSS_TO (band x). */
export const GLOSS_ANGLE = 24;
export const GLOSS_BAND_W = 80;
export const GLOSS_FROM = 160;
export const GLOSS_TO = 860;

// ---------------------------------------------------------------- timeline

/** Allowed easing names for every intro tween (calm only). */
export const CALM_EASINGS = ['inOut', 'linear'] as const;
export type CalmEasing = (typeof CALM_EASINGS)[number];

export type Tween = { start: number; duration: number; easing: CalmEasing };

/**
 * Intro timings in ms from the first frame. The beam arrives, the crystal lights, the spectrum fans out left to right,
 * then the gloss sweeps and the sparkle settles. The fade uses the app's own `slow` motion token.
 */
export const INTRO_MS = {
  beam: { start: 0, duration: 520, easing: 'inOut' } as Tween,
  lit: { start: 340, duration: 620, easing: 'inOut' } as Tween,
  rays: SPECTRUM.map((_, i) => ({ start: 820 + i * 80, duration: 460, easing: 'inOut' })) as readonly Tween[],
  gloss: { start: 1580, duration: 420, easing: 'linear' } as Tween,
  sparkle: { start: 1760, duration: 240, easing: 'inOut' } as Tween,
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
  return [INTRO_MS.beam, INTRO_MS.lit, ...INTRO_MS.rays, INTRO_MS.gloss, INTRO_MS.sparkle];
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

export type IntroFrame = { beam: number; lit: number; rays: number[]; gloss: number; sparkle: number };

/** Everything the intro shows at time `ms` (clamped to the end state after INTRO_MS.total). */
export function frameAt(ms: number): IntroFrame {
  return {
    beam: tweenAt(INTRO_MS.beam, ms),
    lit: tweenAt(INTRO_MS.lit, ms),
    rays: INTRO_MS.rays.map((tw) => tweenAt(tw, ms)),
    gloss: tweenAt(INTRO_MS.gloss, ms),
    sparkle: tweenAt(INTRO_MS.sparkle, ms),
  };
}

/** The gloss band for sweep progress 0..1: its x in the rotated frame and a soft in/out opacity (sine, no flash). */
export function glossBandAt(p: number): { x: number; opacity: number } {
  const t = clamp01(p);
  return { x: r1(lerp(GLOSS_FROM, GLOSS_TO, t)), opacity: Math.round(Math.sin(Math.PI * t) * 0.8 * 1000) / 1000 };
}

export type Track = 'beam' | 'lit' | 'glossX' | 'glossOpacity' | 'sparkle' | `ray${number}`;

function tweenFor(track: Track): Tween {
  if (track === 'beam') return INTRO_MS.beam;
  if (track === 'lit') return INTRO_MS.lit;
  if (track === 'sparkle') return INTRO_MS.sparkle;
  if (track === 'glossX' || track === 'glossOpacity') return INTRO_MS.gloss;
  const i = Number(track.slice(3));
  const tw = INTRO_MS.rays[i];
  if (!tw) throw new Error(`unknown track ${track}`);
  return tw;
}

/**
 * `count` samples of one scalar track over a 0..1 clock (clock = ms / INTRO_MS.total), inside its tween's window, so
 * the UI can interpolate it linearly and still follow the calm easing. Values: opacities 0..1, or the gloss band x.
 */
export function trackKeyframes(track: Track, count = 12): { t: number[]; v: number[] } {
  const tw = tweenFor(track);
  const t: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < count; i++) {
    const ms = tw.start + (i / (count - 1)) * tw.duration;
    const p = tweenAt(tw, ms);
    t.push(ms / INTRO_MS.total);
    if (track === 'glossX') v.push(glossBandAt(p).x);
    else if (track === 'glossOpacity') v.push(glossBandAt(p).opacity);
    else v.push(Math.round(p * 1000) / 1000);
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
export function canFade(pourDone: boolean, ready: boolean): boolean {
  return pourDone && ready;
}

// ---------------------------------------------------------------- static SVG compositions (brand assets)

export type BrandScheme = 'light' | 'dark';

const facetGradient = (id: string, fc: Facet, which: 'lit' | 'dim'): string =>
  `<linearGradient id="${id}${which}-${fc.id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${fc[which][0]}"/><stop offset="1" stop-color="${fc[which][1]}"/></linearGradient>`;

function defs(scheme: BrandScheme, id: string, opts: { ground: boolean; lit: boolean; dim: boolean }): string {
  const c = BRAND[scheme];
  const [tx, ty] = T;
  const out: string[] = [
    // Prism marker: tests and docs look for this id.
    `<linearGradient id="prism" x1="0" y1="0" x2="1" y2="0">${SPECTRUM.map((s, i) => `<stop offset="${f1(i / (SPECTRUM.length - 1))}" stop-color="${s}"/>`).join('')}</linearGradient>`,
    `<linearGradient id="${id}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.95"/></linearGradient>`,
    `<radialGradient id="${id}tip" cx="${tx}" cy="${ty}" r="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id}fadeG" cx="${tx}" cy="${ty}" r="${FAN.length}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#B4B4B4"/><stop offset="1" stop-color="#000000"/></radialGradient>`,
    `<mask id="${id}fade" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="url(#${id}fadeG)"/></mask>`,
  ];
  if (opts.ground) {
    out.push(
      `<linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.iconBg[0]}"/><stop offset="1" stop-color="${c.iconBg[1]}"/></linearGradient>`,
      `<radialGradient id="${id}glow" cx="512" cy="430" r="430" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>`,
    );
  }
  if (opts.lit) out.push(...FACETS.map((fc) => facetGradient(id, fc, 'lit')));
  if (opts.dim) out.push(...FACETS.map((fc) => facetGradient(id, fc, 'dim')));
  return out.join('');
}

const ground = (id: string, shape: string): string => `${shape.replace('/>', ` fill="url(#${id}bg)"/>`)}${shape.replace('/>', ` fill="url(#${id}glow)"/>`)}`;

function crystal(id: string, which: 'lit' | 'dim'): string {
  const edgeOp = which === 'lit' ? 0.55 : 0.28;
  return [
    ...FACETS.map((fc) => `<path d="${polyPath(fc.pts)}" fill="url(#${id}${which}-${fc.id})"/>`),
    `<path d="${GEM_EDGES.map(([a, b]) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`).join(' ')}" fill="none" stroke="#FFFFFF" stroke-opacity="${edgeOp}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="${polyPath(GEM_OUTLINE)}" fill="none" stroke="#FFFFFF" stroke-opacity="${which === 'lit' ? 0.7 : 0.3}" stroke-width="5" stroke-linejoin="round"/>`,
  ].join('');
}

function light(id: string): string {
  return [
    `<path d="${BEAM_HALO_D}" fill="url(#${id}beam)" opacity="0.22"/>`,
    `<path d="${BEAM_D}" fill="url(#${id}beam)"/>`,
    `<g mask="url(#${id}fade)" opacity="0.92">${SPECTRUM.map((c, i) => `<path d="${rayPath(i)}" fill="${c}"/>`).join('')}</g>`,
  ].join('');
}

function finish(id: string): string {
  const [tx, ty] = T;
  return [
    `<circle cx="${tx}" cy="${ty}" r="90" fill="url(#${id}tip)"/>`,
    `<path d="${GLOSS_STREAK_D}" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.75"/>`,
    `<path d="${sparklePath()}" fill="#FFFFFF"/>`,
  ].join('');
}

const svgOpen = (w = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${w}" height="${w}">`;

/** The full lit mark (beam, spectrum, crystal, gloss) without ground. */
function mark(id: string): string {
  return `<g id="${id}-mark">${light(id)}${crystal(id, 'lit')}${finish(id)}</g>`;
}

/** The app icon: full bleed, opaque ground (iOS masks the corners itself). */
export function iconSvg(scheme: BrandScheme = 'light'): string {
  const id = scheme === 'light' ? 'p' : 'pd';
  return `${svgOpen()}<defs>${defs(scheme, id, { ground: true, lit: true, dim: false })}</defs>${ground(id, '<rect width="1024" height="1024"/>')}${mark(id)}</svg>\n`;
}

/** The splash tile's soft floor shadow and the tile itself (clip for its contents). */
function tileOpen(id: string, scheme: BrandScheme): string {
  const c = BRAND[scheme];
  return [
    `<radialGradient id="${id}shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c.shadow}" stop-opacity="${scheme === 'light' ? 0.28 : 0.6}"/><stop offset="1" stop-color="${c.shadow}" stop-opacity="0"/></radialGradient>`,
    `<clipPath id="${id}clip"><path d="${squirclePath(0)}"/></clipPath>`,
  ].join('');
}

/**
 * The native splash image: the tile with the crystal unlit (no beam, no spectrum) on a transparent canvas; the intro
 * lights it.
 */
export function splashSvg(scheme: BrandScheme): string {
  const id = scheme === 'light' ? 's' : 'sd';
  const c = BRAND[scheme];
  const tile = `<path d="${squirclePath(0)}"/>`;
  return `${svgOpen()}<defs>${defs(scheme, id, { ground: true, lit: false, dim: true })}${tileOpen(id, scheme)}</defs><ellipse cx="${TILE.cx}" cy="${TILE.cy + TILE.b + 30}" rx="${TILE.a * 0.86}" ry="34" fill="url(#${id}shadow)"/><g clip-path="url(#${id}clip)">${ground(id, tile)}${crystal(id, 'dim')}</g><path d="${squirclePath(0)}" fill="none" stroke="${c.tileRim}" stroke-width="3"/></svg>\n`;
}

/**
 * Android adaptive icon foreground: the mark scaled into the 66/108 safe zone on transparency (the launcher adds
 * ADAPTIVE_BG and its own mask).
 */
export const ADAPTIVE_SCALE = 0.66;
/** Vertical centre of the mark's visual weight (crystal + upper fan) in icon space. */
const MARK_CY = 520;
const adaptiveTransform = (): string => {
  const s = ADAPTIVE_SCALE;
  return `translate(${f1(512 - 512 * s)} ${f1(512 - MARK_CY * s)}) scale(${s})`;
};
export function adaptiveForegroundSvg(): string {
  return `${svgOpen()}<defs>${defs('light', 'a', { ground: false, lit: true, dim: false })}</defs><g transform="${adaptiveTransform()}">${mark('a')}</g></svg>\n`;
}

/** Android 13+ themed (monochrome) icon: the crystal's facets in stepped opacities, the fan as three soft wedges. */
export function monochromeSvg(): string {
  const ops = [0.55, 0.8, 0.7, 0.5, 0.75, 1, 0.85, 1];
  const facets = FACETS.map((fc, i) => `<path d="${polyPath(fc.pts)}" fill="#FFFFFF" fill-opacity="${ops[i]}"/>`).join('');
  const [tx, ty] = T;
  const fan = SPECTRUM.map((_, i) => `<path d="${rayPath(i)}" fill="url(#mfan)" opacity="${i % 2 === 0 ? 0.75 : 0.45}"/>`).join('');
  return `${svgOpen()}<defs><linearGradient id="prism" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient><radialGradient id="mfan" cx="${tx}" cy="${ty}" r="${FAN.length}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs><g transform="${adaptiveTransform()}"><path d="${BEAM_D}" fill="#FFFFFF" opacity="0.8"/>${fan}${facets}</g></svg>\n`;
}

/** Android adaptive icon background colour (the icon ground's mid tone). */
export const ADAPTIVE_BG = '#1C1442';
