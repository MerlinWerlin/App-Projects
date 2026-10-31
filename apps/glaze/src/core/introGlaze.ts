// Glaze brand mark + opening animation. Pure TypeScript, run directly by Node: the geometry here is the single source
// of truth for the app icon (scripts/brand/build-brand.mjs writes assets/brand/*.svg from it) and for the in-app intro
// (src/ui/IntroGlaze.tsx).
//
// The mark is Prism, the little prism creature (owner-1101 item 8, T190, 1 Nov 2026: "drop the plain diamond prism
// look ... use the cute prism creature", "people get obsessive over cute shit"). It replaced the plain faceted diamond
// of fb-1025 G (kept for reference in docs/mascot/previous-prism-diamond/), which itself replaced the glaze-drip tile
// (docs/mascot/previous-glaze-drip/). Prism is a small upright crystal with soft rounded facets in lilac glass, a
// rainbow sheen inside, big glossy eyes, a tiny smile, blush, two stubby arms and two little feet, standing under a
// soft rainbow arch on a deep indigo ground with two sparkles. One drawing is the app icon and the mascot
// (docs/MASCOT.md).
//
// The intro (≤ 1.6 s): the native splash shows Prism asleep in its tile (eyes closed, no rainbow). The rainbow arch
// fades in, Prism opens its eyes, floats up a few points and settles, a shimmer crosses its glass, it blinks once and
// the sparkles appear; then everything fades to the app. Calm motion only (docs/POLISH.md, fb-1022c, T151): sine
// ease-in-out or linear, no springs, overshoot, squash, scale or bounce.

import { darkV2, lightV2 } from './designV2.ts';
import { durations } from './motion.ts';

// ---------------------------------------------------------------- geometry (1024 × 1024 icon space)

export type Pt = readonly [number, number];

const r1 = (v: number): number => Math.round(v * 10) / 10;
const f1 = (v: number): string => {
  const s = r1(v).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export const polyPath = (pts: readonly Pt[]): string => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')} Z`;

/** A closed polygon with every corner rounded by a quadratic curve (radius = distance cut back along each edge). */
export function roundedPolyPath(pts: readonly Pt[], radii: readonly number[]): string {
  const n = pts.length;
  const cut = (i: number, toward: number): Pt => {
    const [vx, vy] = pts[i]!;
    const [tx, ty] = pts[(toward + n) % n]!;
    const len = Math.hypot(tx - vx, ty - vy) || 1;
    const r = Math.min(radii[i] ?? 0, len / 2);
    return [vx + ((tx - vx) * r) / len, vy + ((ty - vy) * r) / len];
  };
  const parts: string[] = [];
  const b0 = cut(0, 1);
  parts.push(`M${f1(b0[0])} ${f1(b0[1])}`);
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    const a = cut(i, i - 1);
    const b = cut(i, i + 1);
    const [vx, vy] = pts[i]!;
    parts.push(`L${f1(a[0])} ${f1(a[1])} Q${f1(vx)} ${f1(vy)} ${f1(b[0])} ${f1(b[1])}`);
  }
  return `${parts.join(' ')} Z`;
}

/**
 * Prism's body: an upright crystal, point up. A apex, SL / SR shoulders (the crown line), BL / BR the base. Corners are
 * rounded (BODY_RADII) so the crystal reads soft, not sharp.
 */
export const BODY = {
  A: [512, 232],
  SR: [730, 498],
  BR: [668, 790],
  BL: [356, 790],
  SL: [294, 498],
} as const satisfies Record<string, Pt>;
export const BODY_POLY: readonly Pt[] = [BODY.A, BODY.SR, BODY.BR, BODY.BL, BODY.SL];
export const BODY_RADII = [74, 58, 86, 86, 58] as const;
export const BODY_D = roundedPolyPath(BODY_POLY, BODY_RADII);

/** Inner crown points: the crown splits into three soft facets above the face. */
const P1: Pt = [430, 470];
const P2: Pt = [594, 470];

export type Facet = { id: string; pts: readonly Pt[]; fill: string; opacity: number };

/** Soft facets, drawn clipped to the rounded body over its base gradient. */
export const FACETS: readonly Facet[] = [
  { id: 'crownL', pts: [BODY.A, P1, BODY.SL], fill: '#FFFFFF', opacity: 0.5 },
  { id: 'crownM', pts: [BODY.A, P2, P1], fill: '#FFFFFF', opacity: 0.2 },
  { id: 'crownR', pts: [BODY.A, BODY.SR, P2], fill: '#4A36A6', opacity: 0.22 },
  { id: 'sideL', pts: [BODY.SL, P1, [404, 790], BODY.BL], fill: '#FFFFFF', opacity: 0.22 },
  { id: 'sideR', pts: [P2, BODY.SR, BODY.BR, [620, 790]], fill: '#3E2C96', opacity: 0.2 },
];
/** Facet edges, drawn as fine light lines inside the body. */
export const FACET_EDGES: readonly (readonly [Pt, Pt])[] = [
  [BODY.SL, P1], [P1, P2], [P2, BODY.SR], [BODY.A, P1], [BODY.A, P2], [P1, [404, 790]], [P2, [620, 790]],
];
export const FACET_EDGES_D = FACET_EDGES.map(([a, b]) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`).join(' ');

/** Glass colours: base gradient top → bottom, edge light, and the deeper tone for feet and arms. */
export const GLASS = {
  top: '#F6F2FF',
  mid: '#CDBFFF',
  bottom: '#8A74EC',
  limb: ['#A693F5', '#6248C4'] as const,
  ink: '#22184A',
  blush: '#FF8DBE',
} as const;

/** The spectrum, left to right: the app's pastel family pushed a little brighter to glow on ink. */
export const SPECTRUM = ['#9D7BFF', '#76C3FF', '#78E0BE', '#FFE07F', '#FFAE82', '#FF97C4'] as const;

/** The rainbow arch behind Prism: concentric half rings, outermost first (violet outside, rose inside). */
export const ARCH = { cx: 512, cy: 640, outer: 402, band: 22 } as const;
export function archPath(i: number): string {
  const r = ARCH.outer - ARCH.band / 2 - i * ARCH.band;
  return `M${f1(ARCH.cx - r)} ${ARCH.cy} A${f1(r)} ${f1(r)} 0 0 1 ${f1(ARCH.cx + r)} ${ARCH.cy}`;
}

/** Two little clouds where the arch meets the ground (they hide its ends; flat colour, no fade). */
export const CLOUD_FILL = '#EEE8FF';
export function cloudPath(cx: number, cy: number, flip = false): string {
  const k = flip ? -1 : 1;
  const c = (dx: number, dy: number, r: number) =>
    `M${f1(cx + k * dx - r)} ${f1(cy + dy)} a${r} ${r} 0 1 1 ${2 * r} 0 a${r} ${r} 0 1 1 ${-2 * r} 0 Z`;
  return [c(-44, 8, 40), c(4, -14, 54), c(50, 10, 38), `M${f1(cx - 84)} ${f1(cy + 8)} h168 v34 q0 12 -12 12 h-144 q-12 0 -12 -12 Z`].join(' ');
}
export const CLOUDS_D = `${cloudPath(ARCH.cx - (ARCH.outer - 3 * ARCH.band), ARCH.cy - 8)} ${cloudPath(ARCH.cx + (ARCH.outer - 3 * ARCH.band), ARCH.cy - 8, true)}`;

/**
 * Rainbow sheen inside the glass: six thin flat stripes of the spectrum, a diagonal band across the lower body (flat
 * colours, not a gradient, so the icon stays crisp in a small palette PNG).
 */
export const SHEEN_STRIPE = 11;
export function sheenPath(i: number): string {
  const d = i * SHEEN_STRIPE;
  const h = SHEEN_STRIPE;
  return polyPath([[250, 728 + d], [780, 662 + d], [780, 662 + d + h], [250, 728 + d + h]]);
}
export const SHEEN_OPACITY = 0.34;

/** Face. Eyes are tall ovals with two catchlights; closed eyes are soft content arcs (asleep on the splash). */
export const EYES = [
  { cx: 438, cy: 598 },
  { cx: 586, cy: 598 },
] as const;
export const EYE = { rx: 41, ry: 53 } as const;
export const closedEyePath = (cx: number, cy: number): string => `M${cx - 38} ${cy + 4} Q${cx} ${cy + 34} ${cx + 38} ${cy + 4}`;
export const MOUTH_D = 'M490 664 Q512 684 534 664';
export const BLUSH = [
  { cx: 384, cy: 672 },
  { cx: 640, cy: 672 },
] as const;
export const BLUSH_R = { rx: 36, ry: 19 } as const;

/** Stubby arms (rotated ovals tucked behind the body) and little feet. */
export const ARMS = [
  { cx: 292, cy: 624, rot: -30 },
  { cx: 732, cy: 624, rot: 30 },
] as const;
export const ARM = { rx: 46, ry: 30 } as const;
export const FEET = [
  { cx: 442, cy: 806 },
  { cx: 582, cy: 806 },
] as const;
export const FOOT = { rx: 58, ry: 34 } as const;
export const SHADOW = { cx: 512, cy: 846, rx: 210, ry: 26 } as const;

/** Gloss streak on the left crown facet. */
export const GLOSS_STREAK_D = 'M372 428 L446 336';

/** Sparkles (four-point stars). The first is the big one at the upper right. */
export const SPARKLES = [
  { cx: 800, cy: 250, r: 44 },
  { cx: 226, cy: 318, r: 24 },
] as const;
export function sparklePath(cx: number = SPARKLES[0].cx, cy: number = SPARKLES[0].cy, rr: number = SPARKLES[0].r): string {
  const w = rr * 0.2;
  return `M${f1(cx)} ${f1(cy - rr)} Q${f1(cx + w)} ${f1(cy - w)} ${f1(cx + rr)} ${f1(cy)} Q${f1(cx + w)} ${f1(cy + w)} ${f1(cx)} ${f1(cy + rr)} Q${f1(cx - w)} ${f1(cy + w)} ${f1(cx - rr)} ${f1(cy)} Q${f1(cx - w)} ${f1(cy - w)} ${f1(cx)} ${f1(cy - rr)} Z`;
}
export const SPARKLES_D = SPARKLES.map((s) => sparklePath(s.cx, s.cy, s.r)).join(' ');

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

/** Colours (light / dark system appearance). Prism and the rainbow are the same in both; the ground deepens. */
export const BRAND = {
  light: {
    /**
     * Screen background behind the splash / intro. T173 (PREMIUM_UI §3.1): read from the app's `bg` token, never a copy,
     * so the intro's last frame and the Themes tab background are the same colour in light and dark.
     */
    bg: lightV2.bg,
    iconBg: ['#2E2168', '#100C24'] as const,
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

/** The shimmer band: a soft white bar, rotated SHIMMER_ANGLE°, crossing the body from SHIMMER_FROM to SHIMMER_TO (x). */
export const SHIMMER_ANGLE = 24;
export const SHIMMER_BAND_W = 70;
export const SHIMMER_FROM = 200;
export const SHIMMER_TO = 820;

/** How far Prism floats up (icon units; 240 pt intro → about 4 pt). */
export const FLOAT_UNITS = 18;

// ---------------------------------------------------------------- timeline

/** Allowed easing names for every intro tween (calm only). */
export const CALM_EASINGS = ['inOut', 'linear'] as const;
export type CalmEasing = (typeof CALM_EASINGS)[number];

export type Tween = { start: number; duration: number; easing: CalmEasing };

/**
 * Intro timings in ms from the first frame. The arch fades in, Prism wakes (eyes open) and floats up and back down
 * once, a shimmer crosses the glass, one blink, then the sparkles. The fade uses the app's own `slow` motion token.
 */
export const INTRO_MS = {
  arch: { start: 0, duration: 620, easing: 'inOut' } as Tween,
  wake: { start: 260, duration: 280, easing: 'inOut' } as Tween,
  float: { start: 120, duration: 1360, easing: 'linear' } as Tween,
  shimmer: { start: 640, duration: 520, easing: 'linear' } as Tween,
  blink: { start: 1060, duration: 260, easing: 'linear' } as Tween,
  sparkle: { start: 1240, duration: 360, easing: 'inOut' } as Tween,
  /** The animation ends here (the last tween's end). */
  total: 1600,
  /** Pause on the finished logo before fading (only when the app is already ready). */
  settle: 80,
  fadeOut: durations.slow,
  /** Startup never waits longer than this for fonts / languages. */
  maxWait: 3000,
} as const;

/** Every tween in the intro. */
export function allTweens(): Tween[] {
  return [INTRO_MS.arch, INTRO_MS.wake, INTRO_MS.float, INTRO_MS.shimmer, INTRO_MS.blink, INTRO_MS.sparkle];
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

/** A smooth 0 → 1 → 0 hump over progress 0..1 (raised cosine: zero speed at both ends, no overshoot). */
export const hump = (p: number): number => 0.5 - 0.5 * Math.cos(2 * Math.PI * clamp01(p));

export type IntroFrame = {
  arch: number;
  /** 1 = eyes closed (asleep / mid-blink), 0 = open. */
  eyesClosed: number;
  /** Upward float in icon units (0 at rest, FLOAT_UNITS at the top). */
  float: number;
  shimmerX: number;
  shimmerOpacity: number;
  sparkle: number;
};

/** The shimmer band for sweep progress 0..1: its x in the rotated frame and a soft in/out opacity (sine, no flash). */
export function shimmerBandAt(p: number): { x: number; opacity: number } {
  const t = clamp01(p);
  return { x: r1(lerp(SHIMMER_FROM, SHIMMER_TO, t)), opacity: Math.round(Math.sin(Math.PI * t) * 0.7 * 1000) / 1000 };
}

/** Everything the intro shows at time `ms` (the end state after INTRO_MS.total). */
export function frameAt(ms: number): IntroFrame {
  const wake = tweenAt(INTRO_MS.wake, ms);
  const blink = hump(tweenAt(INTRO_MS.blink, ms));
  const sh = shimmerBandAt(tweenAt(INTRO_MS.shimmer, ms));
  return {
    arch: tweenAt(INTRO_MS.arch, ms),
    eyesClosed: Math.round(Math.min(1, 1 - wake + blink) * 1000) / 1000,
    float: Math.round(hump(tweenAt(INTRO_MS.float, ms)) * FLOAT_UNITS * 100) / 100,
    shimmerX: sh.x,
    shimmerOpacity: sh.opacity,
    sparkle: tweenAt(INTRO_MS.sparkle, ms),
  };
}

export type Track = 'arch' | 'eyesClosed' | 'float' | 'shimmerX' | 'shimmerOpacity' | 'sparkle';
export const TRACKS: readonly Track[] = ['arch', 'eyesClosed', 'float', 'shimmerX', 'shimmerOpacity', 'sparkle'];

/** The window (ms) each track moves in. */
function windowFor(track: Track): { start: number; end: number } {
  const w = (tw: Tween) => ({ start: tw.start, end: tw.start + tw.duration });
  if (track === 'arch') return w(INTRO_MS.arch);
  if (track === 'float') return w(INTRO_MS.float);
  if (track === 'shimmerX' || track === 'shimmerOpacity') return w(INTRO_MS.shimmer);
  if (track === 'sparkle') return w(INTRO_MS.sparkle);
  if (track === 'eyesClosed') return { start: INTRO_MS.wake.start, end: INTRO_MS.blink.start + INTRO_MS.blink.duration };
  throw new Error(`unknown track ${String(track)}`);
}

/**
 * `count` samples of one scalar track over a 0..1 clock (clock = ms / INTRO_MS.total), inside its window, so the UI
 * can interpolate it linearly and still follow the calm curves. Values: opacities 0..1, the float in icon units, or
 * the shimmer band x.
 */
export function trackKeyframes(track: Track, count?: number): { t: number[]; v: number[] } {
  const { start, end } = windowFor(track);
  const n = count ?? (track === 'eyesClosed' || track === 'float' ? 33 : 12);
  const t: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    const ms = start + (i / (n - 1)) * (end - start);
    t.push(ms / INTRO_MS.total);
    v.push(frameAt(ms)[track]);
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

function defs(scheme: BrandScheme, id: string, opts: { ground: boolean; tile?: boolean }): string {
  const c = BRAND[scheme];
  const out: string[] = [
    // Prism marker: tests and docs look for this id (the spectrum as one gradient).
    `<linearGradient id="prism" x1="0" y1="0" x2="1" y2="0">${SPECTRUM.map((s, i) => `<stop offset="${f1(i / (SPECTRUM.length - 1))}" stop-color="${s}"/>`).join('')}</linearGradient>`,
    `<linearGradient id="${id}glass" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${GLASS.top}"/><stop offset="0.5" stop-color="${GLASS.mid}"/><stop offset="1" stop-color="${GLASS.bottom}"/></linearGradient>`,
    `<linearGradient id="${id}limb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GLASS.limb[0]}"/><stop offset="1" stop-color="${GLASS.limb[1]}"/></linearGradient>`,
    `<radialGradient id="${id}shadowG" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>`,
    `<clipPath id="${id}body"><path d="${BODY_D}"/></clipPath>`,
  ];
  if (opts.ground) {
    out.push(
      `<linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.iconBg[0]}"/><stop offset="1" stop-color="${c.iconBg[1]}"/></linearGradient>`,
      `<radialGradient id="${id}glow" cx="512" cy="520" r="440" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.glow}" stop-opacity="0.6"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>`,
    );
  }
  if (opts.tile) {
    out.push(
      `<radialGradient id="${id}tshadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c.shadow}" stop-opacity="${scheme === 'light' ? 0.28 : 0.6}"/><stop offset="1" stop-color="${c.shadow}" stop-opacity="0"/></radialGradient>`,
      `<clipPath id="${id}clip"><path d="${squirclePath(0)}"/></clipPath>`,
    );
  }
  return out.join('');
}

const ground = (id: string, shape: string): string => `${shape.replace('/>', ` fill="url(#${id}bg)"/>`)}${shape.replace('/>', ` fill="url(#${id}glow)"/>`)}`;

/** The rainbow arch (behind Prism). */
const arch = (): string =>
  `<g opacity="0.9" fill="none" stroke-width="${ARCH.band + 1}">${SPECTRUM.map((s, i) => `<path d="${archPath(i)}" stroke="${s}"/>`).join('')}</g><path d="${CLOUDS_D}" fill="${CLOUD_FILL}"/>`;

/** Prism itself: shadow, limbs, glass body with facets and sheen, face. `awake` false draws closed eyes. */
function creature(id: string, awake: boolean): string {
  const eyes = awake
    ? EYES.map((e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${EYE.rx}" ry="${EYE.ry}" fill="${GLASS.ink}"/><circle cx="${e.cx + 13}" cy="${e.cy - 20}" r="15" fill="#FFFFFF"/><circle cx="${e.cx - 13}" cy="${e.cy + 21}" r="7" fill="#FFFFFF" fill-opacity="0.8"/>`).join('')
    : `<path d="${EYES.map((e) => closedEyePath(e.cx, e.cy)).join(' ')}" fill="none" stroke="${GLASS.ink}" stroke-width="12" stroke-linecap="round"/>`;
  return [
    `<ellipse cx="${SHADOW.cx}" cy="${SHADOW.cy}" rx="${SHADOW.rx}" ry="${SHADOW.ry}" fill="url(#${id}shadowG)"/>`,
    ...ARMS.map((a) => `<ellipse cx="${a.cx}" cy="${a.cy}" rx="${ARM.rx}" ry="${ARM.ry}" transform="rotate(${a.rot} ${a.cx} ${a.cy})" fill="url(#${id}limb)"/>`),
    ...FEET.map((f) => `<ellipse cx="${f.cx}" cy="${f.cy}" rx="${FOOT.rx}" ry="${FOOT.ry}" fill="url(#${id}limb)"/>`),
    `<path d="${BODY_D}" fill="url(#${id}glass)"/>`,
    `<g clip-path="url(#${id}body)">`,
    ...FACETS.map((fc) => `<path d="${polyPath(fc.pts)}" fill="${fc.fill}" fill-opacity="${fc.opacity}"/>`),
    ...SPECTRUM.map((c, i) => `<path d="${sheenPath(i)}" fill="${c}" fill-opacity="${SHEEN_OPACITY}"/>`),
    `<path d="${FACET_EDGES_D}" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>`,
    `</g>`,
    `<path d="${BODY_D}" fill="none" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="6" stroke-linejoin="round"/>`,
    `<path d="${GLOSS_STREAK_D}" fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" opacity="0.8"/>`,
    ...BLUSH.map((b) => `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${BLUSH_R.rx}" ry="${BLUSH_R.ry}" fill="${GLASS.blush}" fill-opacity="0.6"/>`),
    eyes,
    `<path d="${MOUTH_D}" fill="none" stroke="${GLASS.ink}" stroke-width="10" stroke-linecap="round"/>`,
  ].join('');
}

const sparkles = (): string => `<path d="${SPARKLES_D}" fill="#FFFFFF"/>`;

const svgOpen = (w = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${w}" height="${w}">`;

/** The full awake mark (arch, Prism, sparkles) without ground. */
function mark(id: string): string {
  return `<g id="${id}-mark">${arch()}${creature(id, true)}${sparkles()}</g>`;
}

/** The app icon: full bleed, opaque ground (iOS masks the corners itself). No text. */
export function iconSvg(scheme: BrandScheme = 'light'): string {
  const id = scheme === 'light' ? 'p' : 'pd';
  return `${svgOpen()}<defs>${defs(scheme, id, { ground: true })}</defs>${ground(id, '<rect width="1024" height="1024"/>')}${mark(id)}</svg>\n`;
}

/** The mascot on its own (transparent, no ground), for docs, empty states and the build page. */
export function mascotSvg(): string {
  return `${svgOpen()}<defs>${defs('light', 'm', { ground: false })}</defs>${mark('m')}</svg>\n`;
}

/**
 * The native splash image: the tile with Prism asleep (eyes closed, no arch, no sparkles) on a transparent canvas; the
 * intro wakes it.
 */
export function splashSvg(scheme: BrandScheme): string {
  const id = scheme === 'light' ? 's' : 'sd';
  const c = BRAND[scheme];
  const tile = `<path d="${squirclePath(0)}"/>`;
  return `${svgOpen()}<defs>${defs(scheme, id, { ground: true, tile: true })}</defs><ellipse cx="${TILE.cx}" cy="${TILE.cy + TILE.b + 30}" rx="${TILE.a * 0.86}" ry="34" fill="url(#${id}tshadow)"/><g clip-path="url(#${id}clip)">${ground(id, tile)}${creature(id, false)}</g><path d="${squirclePath(0)}" fill="none" stroke="${c.tileRim}" stroke-width="3"/></svg>\n`;
}

/**
 * Android adaptive icon foreground: the mark scaled into the 66/108 safe zone on transparency (the launcher adds
 * ADAPTIVE_BG and its own mask).
 */
export const ADAPTIVE_SCALE = 0.66;
/** Vertical centre of the mark's visual weight (arch top to feet) in icon space. */
export const MARK_CY = 540;
export const adaptiveTransform = (): string => {
  const s = ADAPTIVE_SCALE;
  return `translate(${f1(512 - 512 * s)} ${f1(512 - MARK_CY * s)}) scale(${s})`;
};
export function adaptiveForegroundSvg(): string {
  return `${svgOpen()}<defs>${defs('light', 'a', { ground: false })}</defs><g transform="${adaptiveTransform()}">${mark('a')}</g></svg>\n`;
}

/**
 * Android 13+ themed (monochrome) icon: Prism's silhouette (body, arms, feet) in white with the face cut out, the arch
 * as faint rings with its clouds, and the sparkles.
 */
export function monochromeSvg(): string {
  const face = [
    ...EYES.map((e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${EYE.rx}" ry="${EYE.ry}" fill="#000000"/>`),
    `<path d="${MOUTH_D}" fill="none" stroke="#000000" stroke-width="10" stroke-linecap="round"/>`,
  ].join('');
  const sil = [
    ...ARMS.map((a) => `<ellipse cx="${a.cx}" cy="${a.cy}" rx="${ARM.rx}" ry="${ARM.ry}" transform="rotate(${a.rot} ${a.cx} ${a.cy})" fill="#FFFFFF"/>`),
    ...FEET.map((f) => `<ellipse cx="${f.cx}" cy="${f.cy}" rx="${FOOT.rx}" ry="${FOOT.ry}" fill="#FFFFFF"/>`),
    `<path d="${BODY_D}" fill="#FFFFFF"/>`,
  ].join('');
  const rings = SPECTRUM.map((_, i) => `<path d="${archPath(i)}" stroke="#FFFFFF" stroke-opacity="${i % 2 === 0 ? 0.55 : 0.3}"/>`).join('');
  return `${svgOpen()}<defs><linearGradient id="prism" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient><mask id="mface" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#FFFFFF"/>${face}</mask></defs><g transform="${adaptiveTransform()}"><g fill="none" stroke-width="${ARCH.band - 4}">${rings}</g><path d="${CLOUDS_D}" fill="#FFFFFF"/><g mask="url(#mface)">${sil}</g>${sparkles()}</g></svg>\n`;
}

/** Android adaptive icon background colour (the icon ground's mid tone). */
export const ADAPTIVE_BG = '#1C1442';
