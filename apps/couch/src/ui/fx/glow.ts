/**
 * Cinema glow (premium polish P1): palettes, per-TV colour hashing, gradient layout, timings and the
 * contrast maths that proves screen-level text stays WCAG AA over the near-black stage + glow.
 * Pure TS (no React Native import); CinemaGlow.tsx and Marquee.tsx turn this into SVG + Animated.
 */
import type { GlowPref } from '../../core/prefs';
import type { RemoteTheme } from '../../theme/remoteThemes';

/** Near-black stage behind the remote while the glow is on (both themes). */
export const BACKDROP = '#0A0B0E';

/**
 * Light ink for text drawn directly on the stage (FreePromise / demo note copies on the remote screen).
 * Same value as the dark palette's ink; AA is proven in glow.test.ts against the brightest glow point.
 */
export const STAGE_INK = '#E6EAEF';

/** Named glow colours: low-saturation "LED strip behind a TV" tones, never neon. */
export const GLOW_COLORS = {
  amber: '#D4A373',
  blue: '#86A5D4',
  violet: '#A795D0',
} as const;

/**
 * Curated hues for Match TV: each saved TV gets one of these, chosen by a stable hash of its id.
 * All low saturation and similar lightness so no TV gets a garish glow.
 */
export const TV_GLOW_COLORS: readonly string[] = [
  GLOW_COLORS.amber,
  GLOW_COLORS.blue,
  GLOW_COLORS.violet,
  '#7FBFB4', // teal
  '#CF97A6', // rose
  '#A9C08C', // sage
  '#C9A98A', // sand
];

/** The power key's warm swell is always this colour, whatever the glow setting. */
export const SWELL_COLOR = '#DDAF84';

/** FNV-1a 32-bit hash: deterministic across runs and platforms. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Match TV colour for a saved TV id; no TV (or demo) gets amber. */
export function tvGlowColor(tvId: string | null | undefined): string {
  if (!tvId) return GLOW_COLORS.amber;
  return TV_GLOW_COLORS[hashId(tvId) % TV_GLOW_COLORS.length] ?? GLOW_COLORS.amber;
}

/**
 * Resolve the glow setting to a colour, or null for Off (today's look, no stage).
 * `tvId` is the active saved TV's id; pass null in demo mode or with no TV.
 * `themeGlow` is the remote theme's glow (owner-1017): used by 'theme' (the default); a theme
 * without a glow (null) means no glow. Omitted (no theme known) 'theme' falls back to amber.
 */
export function glowColor(pref: GlowPref, tvId: string | null | undefined, themeGlow?: string | null): string | null {
  switch (pref) {
    case 'off':
      return null;
    case 'theme':
      return themeGlow === undefined ? GLOW_COLORS.amber : themeGlow;
    case 'tv':
      return tvGlowColor(tvId);
    case 'blue':
      return GLOW_COLORS.blue;
    case 'violet':
      return GLOW_COLORS.violet;
    case 'amber':
    default:
      return GLOW_COLORS.amber;
  }
}

/* ---------- layout + falloff ---------- */

export interface GlowStop {
  /** 0..1 along the radius. */
  offset: number;
  /** Stop opacity 0..1. */
  opacity: number;
}

/**
 * Many-stop falloff from `peak` at the centre to 0 at the edge (a smooth gaussian-like curve),
 * which reads as a soft blurred light without a blur filter.
 */
export function falloffStops(peak: number, count = 9): GlowStop[] {
  const n = Math.max(3, Math.floor(count));
  const p = Math.max(0, Math.min(1, peak));
  const out: GlowStop[] = [];
  for (let i = 0; i < n; i++) {
    const offset = i / (n - 1);
    // exp(-k t^2), rescaled so it reaches exactly 0 at the edge.
    const k = 3.2;
    const g = (Math.exp(-k * offset * offset) - Math.exp(-k)) / (1 - Math.exp(-k));
    out.push({ offset: round3(offset), opacity: round3(p * g) });
  }
  return out;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** One ellipse of light, in fractions of the glow box (objectBoundingBox units). */
export interface GlowLobe {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  peak: number;
}

/** Three lobes: a wide one behind the whole remote and two strips spilling out top and bottom. */
export const GLOW_LOBES: readonly GlowLobe[] = [
  { id: 'wide', cx: 0.5, cy: 0.5, rx: 0.62, ry: 0.56, peak: 0.16 },
  { id: 'top', cx: 0.5, cy: 0.16, rx: 0.58, ry: 0.24, peak: 0.1 },
  { id: 'bottom', cx: 0.5, cy: 0.86, rx: 0.58, ry: 0.22, peak: 0.08 },
];

/** Directional press pulse layer: centre offset toward the pressed key. */
export const PULSE_LOBE = { rx: 0.42, ry: 0.3, peak: 0.1, reach: { x: 0.4, y: 0.42 } } as const;
/** Power swell layer: one big warm ellipse. */
export const SWELL_LOBE = { cx: 0.5, cy: 0.5, rx: 0.7, ry: 0.62, peak: 0.1 } as const;

/** Where the pulse gradient is centred for a key direction (x, y in -1..1). */
export function pulseCenter(dir: { x: number; y: number }): { cx: number; cy: number } {
  const c = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  return {
    cx: round3(0.5 + c(dir.x) * PULSE_LOBE.reach.x),
    cy: round3(0.5 + c(dir.y) * PULSE_LOBE.reach.y),
  };
}

/* ---------- timing ---------- */

/** Idle breathing of the base glow (whole cycle = period ms). */
export const BREATH = { min: 0.55, max: 0.8, period: 7000 } as const;
/** Reduce Motion: no breathing, a still glow at this opacity. */
export const STATIC_OPACITY = 0.65;
/** Slow drift of the glow layer, a few px around a loop. */
export const DRIFT = { px: 4, period: 14000 } as const;
/** Key press pulse: quick spike then fade (~150 ms). */
export const PULSE = { in: 40, out: 150, reduceOpacity: 0.3 } as const;
/** Power key: one slow warm swell (~1.2 s). */
export const SWELL = { in: 480, out: 720, scaleFrom: 0.96, scaleTo: 1.04, reduceOpacity: 0.35 } as const;
/**
 * Backlight halo (owner 24 Oct 2026: "the glow behind it didn't really work"). The remote card fills
 * almost the whole width, so the stage lobes mostly sit behind it and barely show. The halo is a soft
 * shadow in the glow colour hugging the card's edge, like an LED strip behind a TV. It sits on the card
 * outline, not under stage text, so the stage AA proof above is unchanged. iOS draws coloured shadows;
 * Android falls back to the stage lobes.
 */
export const HALO = { opacity: 0.6, radius: 18 } as const;

/** Card style for the halo in `color` (none when the glow is off). */
export function haloStyle(color: string | null): {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
} | null {
  if (!color) return null;
  return { shadowColor: color, shadowOpacity: HALO.opacity, shadowRadius: HALO.radius, shadowOffset: { width: 0, height: 0 } };
}

/** Marquee dots: count, resting opacity, ripple stagger per dot. */
export const MARQUEE = { dots: 15, rest: 0.22, peak: 0.85, stagger: 45, up: 140, down: 420 } as const;

/**
 * Worst-case glow alpha at any one point of the stage: every lobe overlapping at full peak,
 * the base layer at the top of its breath, plus a press pulse and a power swell
 * at the same instant. Deliberately conservative for the AA proof.
 */
export function maxStageAlpha(): number {
  const base = GLOW_LOBES.reduce((s, l) => s + l.peak, 0) * BREATH.max;
  return Math.min(1, base + PULSE_LOBE.peak + SWELL_LOBE.peak);
}

/* ---------- colour maths ---------- */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const x = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`.toUpperCase();
}

/** Source-over blend of `fg` at `alpha` onto opaque `bg` (sRGB, as the compositor does). */
export function blend(fg: string, bg: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return rgbToHex({ r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a) });
}

/** WCAG 2.1 relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** HSL saturation and lightness (0..1) of a hex colour. */
export function hsl(hex: string): { s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * The brightest the stage gets under `color`: the backdrop blended at maxStageAlpha() with whichever
 * is lighter, the glow colour or the power swell colour (conservative: as if all light were that one).
 */
export function brightestStage(color: string, backdrop: string = BACKDROP): string {
  const light = luminance(SWELL_COLOR) > luminance(color) ? SWELL_COLOR : color;
  return blend(light, backdrop, maxStageAlpha());
}

/** Lowest contrast of `ink` over the stage, between bare backdrop and the brightest glow point. */
export function stageContrast(ink: string, color: string, backdrop: string = BACKDROP): number {
  return Math.min(contrast(ink, backdrop), contrast(ink, brightestStage(color, backdrop)));
}

/**
 * The remote screen's stage (owner-1017): background behind the remote card and the ink for text
 * drawn straight on it (free promise, demo note).
 * - Glow on: the theme's own dark stage (light themes use the near-black BACKDROP) with STAGE_INK;
 *   AA over the brightest glow point is proven per theme in glow.test.ts.
 * - Glow off: the theme's stage with its muted ink, or whichever of ink / STAGE_INK reads (AA).
 */
export function remoteStage(theme: RemoteTheme, glow: string | null): { bg: string; ink: string } {
  if (glow) return { bg: theme.scheme === 'dark' ? theme.stage : BACKDROP, ink: STAGE_INK };
  if (contrast(theme.muted, theme.stage) >= 4.5) return { bg: theme.stage, ink: theme.muted };
  const ink = contrast(theme.ink, theme.stage) >= contrast(STAGE_INK, theme.stage) ? theme.ink : STAGE_INK;
  return { bg: theme.stage, ink };
}
