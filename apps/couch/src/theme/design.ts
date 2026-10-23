/**
 * Design v2 tokens (market-1018 M3, docs/DESIGN_V2.md): the iOS-native (Apple HIG) look.
 * Pure TypeScript, no React Native import, so every value and every contrast promise is tested in Node.
 *
 * - DesignPalette: semantic colours (grouped background, cell, label tiers, tint, materials) for light
 *   and dark, plus remoteDesignPalette() which derives the same roles from a remote theme so sheets and
 *   cards opened from the remote keep the chosen theme (owner-1017 section F).
 * - typeScale: the HIG text styles. System font (SF on iOS, Roboto on Android) for UI text; the brand
 *   display font (Sora) only for large titles and titles; JetBrains Mono for changing numbers.
 * - radii (always drawn with borderCurve 'continuous'), space, layered shadows, blur materials.
 *
 * v1 tokens (src/theme/tokens.ts) stay until every screen is migrated (T68).
 */
import { spring as motionSpring } from './motion';
import { contrastRatio, luminance, type RemoteTheme } from './remoteThemes';
import { fonts, minTarget } from './tokens';

// ---- Palette ----------------------------------------------------------------------------------

export type Scheme = 'light' | 'dark';

export interface DesignPalette {
  scheme: Scheme;
  /** Screen background behind inset-grouped lists (iOS systemGroupedBackground). */
  background: string;
  /** Cell / grouped-row background (secondarySystemGroupedBackground). */
  surface: string;
  /** Cell background while pressed. */
  surfacePressed: string;
  /** Card background (raised content: TV cards, Plus card). */
  card: string;
  /** Hairline edge drawn on cards where shadows are invisible (dark). 'transparent' for none. */
  cardEdge: string;
  /** Primary text. */
  label: string;
  /** Secondary text (subtitles, section headers, values): AA on surface and background. */
  secondaryLabel: string;
  /** Non-text glyphs only (chevrons, placeholder icons): 3:1 on surface. */
  tertiaryLabel: string;
  /** Row separators and hairlines (decorative). */
  separator: string;
  /** Neutral fill: plain pill pressed state, switch off track, segmented track. */
  fill: string;
  /** Accent: filled pill background, switch on track, selected states (non-text 3:1). */
  tint: string;
  /** Text and icons on the tint (filled pill label). */
  tintInk: string;
  /** Tinted pill background. */
  tintedFill: string;
  /** Text on tintedFill (the tinted pill label). */
  tintedLabel: string;
  /** Tint-coloured text on surface/background (plain pill, links, Row "detail"). */
  tintLabel: string;
  destructive: string;
  success: string;
  warning: string;
}

export const designLight: DesignPalette = {
  scheme: 'light',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfacePressed: '#E5E5EA',
  card: '#FFFFFF',
  cardEdge: 'transparent',
  label: '#111418',
  secondaryLabel: '#5C5F66',
  tertiaryLabel: '#8A8A8F',
  separator: '#C6C6C8',
  fill: '#E9E9EE',
  tint: '#2F5BD3',
  tintInk: '#FFFFFF',
  tintedFill: '#E3EAFB',
  tintedLabel: '#2448B0',
  tintLabel: '#2F5BD3',
  destructive: '#B83434',
  success: '#2C7A54',
  warning: '#8A5E10',
};

export const designDark: DesignPalette = {
  scheme: 'dark',
  background: '#000000',
  surface: '#1C1C1E',
  surfacePressed: '#2C2C2E',
  card: '#1C1C1E',
  cardEdge: '#2C2C2E',
  label: '#F5F5F7',
  secondaryLabel: '#AEAEB2',
  tertiaryLabel: '#7C7C80',
  separator: '#38383A',
  fill: '#2C2C2E',
  tint: '#86A6FF',
  tintInk: '#0B1020',
  tintedFill: '#1E2A47',
  tintedLabel: '#A9C0FF',
  tintLabel: '#86A6FF',
  destructive: '#FF7A72',
  success: '#6CC796',
  warning: '#E5B35A',
};

/** Accepts any ColorSchemeName ('unspecified' and null fall back to light). */
export function designPalette(scheme: string | null | undefined): DesignPalette {
  return scheme === 'dark' ? designDark : designLight;
}

/** First candidate with at least `min` contrast on `bg`, else the most readable one. */
export function pickReadable(candidates: readonly string[], bg: string, min = 4.5): string {
  let best = candidates[0] ?? '#000000';
  let bestRatio = -1;
  for (const c of candidates) {
    const r = contrastRatio(c, bg);
    if (r >= min) return c;
    if (r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }
  return best;
}

/**
 * The v2 roles derived from a remote theme (owner-1017 section F): anything drawn on or opened from
 * the remote (sheets, its cards and pills) uses this palette, so themes keep working after the
 * redesign. Roles whose natural colour is not AA on the theme fall back to the theme's ink.
 */
export function remoteDesignPalette(t: RemoteTheme): DesignPalette {
  // Materials and shadows follow the surface's own lightness (Retro Wood: dark status bar, cream body).
  const scheme: Scheme = luminance(t.body) >= 0.18 ? 'light' : 'dark';
  return {
    scheme,
    // Retro's stage-dark bg under a cream body: lists then sit on the body colour instead.
    background: contrastRatio(t.ink, t.bg) >= 4.5 && contrastRatio(t.muted, t.bg) >= 4.5 ? t.bg : t.body,
    surface: t.body,
    surfacePressed: t.accentSoft,
    card: t.body,
    cardEdge: scheme === 'dark' ? t.keyEdge : 'transparent',
    label: t.ink,
    secondaryLabel: pickReadable([t.muted, t.ink], t.body),
    tertiaryLabel: pickReadable([t.muted, t.ink], t.body, 3),
    separator: t.keyEdge,
    fill: t.key,
    tint: t.accent,
    tintInk: t.accentInk,
    tintedFill: t.accentSoft,
    tintedLabel: pickReadable([t.accent, t.ink], t.accentSoft),
    tintLabel: pickReadable([t.accent, t.ink], t.body),
    destructive: pickReadable([t.power, t.ink], t.body),
    success: t.ok,
    warning: pickReadable([t.warn, t.ink], t.body),
  };
}

/** Every text/background pair v2 components draw, with its WCAG AA minimum (tests prove them). */
export function designPairs(p: DesignPalette): { what: string; fg: string; bg: string; min: number }[] {
  return [
    { what: 'label on surface', fg: p.label, bg: p.surface, min: 4.5 },
    { what: 'label on background', fg: p.label, bg: p.background, min: 4.5 },
    { what: 'label on pressed cell', fg: p.label, bg: p.surfacePressed, min: 4.5 },
    { what: 'label on card', fg: p.label, bg: p.card, min: 4.5 },
    { what: 'secondary on surface', fg: p.secondaryLabel, bg: p.surface, min: 4.5 },
    { what: 'secondary on background (section headers)', fg: p.secondaryLabel, bg: p.background, min: 4.5 },
    { what: 'chevron on surface (non-text)', fg: p.tertiaryLabel, bg: p.surface, min: 3 },
    { what: 'filled pill label', fg: p.tintInk, bg: p.tint, min: 4.5 },
    { what: 'tinted pill label', fg: p.tintedLabel, bg: p.tintedFill, min: 4.5 },
    { what: 'plain pill / link on surface', fg: p.tintLabel, bg: p.surface, min: 4.5 },
    { what: 'tint on surface (switch on, non-text)', fg: p.tint, bg: p.surface, min: 3 },
    { what: 'destructive on surface', fg: p.destructive, bg: p.surface, min: 4.5 },
    { what: 'warning on surface', fg: p.warning, bg: p.surface, min: 4.5 },
    { what: 'success on surface (non-text dot)', fg: p.success, bg: p.surface, min: 3 },
  ];
}

// ---- Type --------------------------------------------------------------------------------------

export type TypeRole =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subheadline'
  | 'footnote'
  | 'caption1'
  | 'caption2'
  | 'navTitle'
  | 'button'
  | 'numeric';

export type TypeFamily = 'system' | 'display' | 'mono';

export interface TypeSpec {
  size: number;
  line: number;
  weight: '400' | '500' | '600' | '700';
  family: TypeFamily;
  /** Cap for Dynamic Type (maxFontSizeMultiplier); undefined = no cap. Text still wraps. */
  maxScale?: number;
}

/** Apple HIG default (Large) sizes. */
export const typeScale: Record<TypeRole, TypeSpec> = {
  largeTitle: { size: 34, line: 41, weight: '700', family: 'display', maxScale: 2 },
  title1: { size: 28, line: 34, weight: '700', family: 'display', maxScale: 2 },
  title2: { size: 22, line: 28, weight: '700', family: 'display' },
  title3: { size: 20, line: 25, weight: '600', family: 'system' },
  headline: { size: 17, line: 22, weight: '600', family: 'system' },
  body: { size: 17, line: 22, weight: '400', family: 'system' },
  callout: { size: 16, line: 21, weight: '400', family: 'system' },
  subheadline: { size: 15, line: 20, weight: '400', family: 'system' },
  footnote: { size: 13, line: 18, weight: '400', family: 'system' },
  caption1: { size: 12, line: 16, weight: '400', family: 'system' },
  caption2: { size: 11, line: 13, weight: '400', family: 'system' },
  /** Inline navigation title in a fixed-height bar: capped so the bar never clips it. */
  navTitle: { size: 17, line: 22, weight: '600', family: 'system', maxScale: 1.4 },
  button: { size: 17, line: 22, weight: '600', family: 'system' },
  numeric: { size: 17, line: 22, weight: '400', family: 'mono' },
};

export interface TextStyleSpec {
  fontSize: number;
  lineHeight: number;
  fontWeight?: '400' | '500' | '600' | '700';
  fontFamily?: string;
  fontVariant?: 'tabular-nums'[];
}

/**
 * A plain style object for a role. System text leaves fontFamily unset (the platform font: SF on iOS)
 * and sets the weight; brand families carry their weight in the font file, so no fontWeight (Android
 * would otherwise synthesise bold). src/ui/Text swaps brand families for the system font in
 * CJK / Devanagari / Arabic.
 */
export function textStyle(role: TypeRole): TextStyleSpec {
  const s = typeScale[role];
  if (s.family === 'display') return { fontSize: s.size, lineHeight: s.line, fontFamily: s.weight === '700' ? fonts.displayBold : fonts.display };
  if (s.family === 'mono') return { fontSize: s.size, lineHeight: s.line, fontFamily: fonts.mono, fontVariant: ['tabular-nums'] };
  return { fontSize: s.size, lineHeight: s.line, fontWeight: s.weight };
}

// ---- Shape and spacing ---------------------------------------------------------------------------

/** Corner radii. Always paired with `continuous` (borderCurve) so corners are squircles on iOS. */
export const radii = { xs: 6, sm: 10, md: 14, group: 16, card: 22, sheet: 28, pill: 999 } as const;
export const continuous = { borderCurve: 'continuous' } as const;

/** 4-pt spacing grid. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Inset-grouped list metrics. */
export const list = {
  /** Distance from the screen edge to the group (the inset). */
  inset: 16,
  /** Row padding on the start/end side. */
  rowPadding: 16,
  /** Row vertical padding (rows still grow with Dynamic Type). */
  rowPaddingV: 11,
  /** Minimum row height: the app's 48pt touch target (HIG asks for 44). */
  rowMinHeight: minTarget,
  /** Leading icon tile size and the gap after it. */
  icon: 30,
  iconGap: 12,
  /** Gap between groups. */
  groupGap: 28,
} as const;

/** Where a row separator starts: under the text, not under the icon (iOS inset separators). */
export function separatorInset(hasIcon: boolean): number {
  return list.rowPadding + (hasIcon ? list.icon + list.iconGap : 0);
}

/**
 * Dynamic Type layout for a row's value/detail text: beside the title normally, below it at the
 * accessibility sizes (fontScale >= 1.6, about iOS AX1) so neither ever truncates. Switches and
 * chevrons always stay at the end.
 */
export const STACK_AT_SCALE = 1.6;
export function accessoryPlacement(fontScale: number, kind: 'value' | 'detail' | 'switch' | 'chevron' | 'check' | 'none'): 'end' | 'below' {
  if ((kind === 'value' || kind === 'detail') && Number.isFinite(fontScale) && fontScale >= STACK_AT_SCALE) return 'below';
  return 'end';
}

/** Navigation bar metrics (iOS). */
export const navBar = { height: 44, largeTitleTop: 4, largeTitleBottom: 8, buttonMin: minTarget } as const;

// ---- Elevation -----------------------------------------------------------------------------------

export interface ShadowLayer {
  y: number;
  blur: number;
  opacity: number;
}

export type ShadowLevel = 'low' | 'mid' | 'high';

/** Layered shadows: a tight contact shadow plus a soft ambient one (light scheme values). */
export const shadowLayers: Record<ShadowLevel, readonly ShadowLayer[]> = {
  low: [
    { y: 1, blur: 2, opacity: 0.06 },
    { y: 4, blur: 12, opacity: 0.06 },
  ],
  mid: [
    { y: 2, blur: 4, opacity: 0.06 },
    { y: 8, blur: 24, opacity: 0.1 },
  ],
  high: [
    { y: 4, blur: 8, opacity: 0.08 },
    { y: 16, blur: 40, opacity: 0.16 },
  ],
};

/** Dark surfaces separate by lightness and a hairline edge; shadows are kept but stronger to show at all. */
const DARK_SHADOW_FACTOR = 2.5;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** CSS-style box-shadow string (React Native 0.76+ `boxShadow`, new architecture: iOS and Android). */
export function boxShadow(level: ShadowLevel, scheme: Scheme): string {
  const f = scheme === 'dark' ? DARK_SHADOW_FACTOR : 1;
  return shadowLayers[level].map((l) => `0px ${l.y}px ${l.blur}px 0px rgba(0, 0, 0, ${round3(Math.min(1, l.opacity * f))})`).join(', ');
}

/** Single-shadow fallback (the ambient layer) for renderers without boxShadow. */
export function legacyShadow(level: ShadowLevel, scheme: Scheme): {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
} {
  const layers = shadowLayers[level];
  const l = layers[layers.length - 1]!;
  const f = scheme === 'dark' ? DARK_SHADOW_FACTOR : 1;
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: l.y },
    shadowOpacity: round3(Math.min(1, l.opacity * f)),
    shadowRadius: l.blur / 2,
    elevation: level === 'low' ? 2 : level === 'mid' ? 6 : 12,
  };
}

// ---- Materials -----------------------------------------------------------------------------------

export type Material = 'thin' | 'regular' | 'thick' | 'chrome';

export interface MaterialSpec {
  /** expo-blur intensity (0-100). */
  intensity: number;
  /** Opacity of the tint overlay drawn on top of the blur. It alone guarantees contrast. */
  alpha: number;
}

export const materials: Record<Material, MaterialSpec> = {
  thin: { intensity: 40, alpha: 0.66 },
  regular: { intensity: 60, alpha: 0.78 },
  thick: { intensity: 80, alpha: 0.9 },
  /** Navigation bars and tab bars. */
  chrome: { intensity: 70, alpha: 0.9 },
};

/** Overlay colour per scheme; also the solid fallback (Reduce Transparency, no blur available). */
export const materialTint: Record<Scheme, string> = { light: '#FAFAFC', dark: '#1C1C1E' };

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: readonly number[]): string {
  return '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** `fg` at `alpha` painted over an opaque `backdrop`. */
export function compositeOver(fg: string, alpha: number, backdrop: string): string {
  const a = Math.max(0, Math.min(1, alpha));
  const f = hexToRgb(fg);
  const b = hexToRgb(backdrop);
  return toHex(f.map((c, i) => c * a + (b[i] ?? 0) * (1 - a)));
}

/** rgba() string for the material's overlay. */
export function materialOverlay(material: Material, scheme: Scheme): string {
  const [r, g, b] = hexToRgb(materialTint[scheme]);
  return `rgba(${r}, ${g}, ${b}, ${materials[material].alpha})`;
}

/**
 * Worst-case contrast of `fg` on a material: the overlay composited over pure white and pure black
 * (the blur only averages what is behind, so it can never be worse than these extremes).
 */
export function materialContrast(material: Material, scheme: Scheme, fg: string): number {
  const tint = materialTint[scheme];
  const a = materials[material].alpha;
  return Math.min(contrastRatio(fg, compositeOver(tint, a, '#FFFFFF')), contrastRatio(fg, compositeOver(tint, a, '#000000')));
}

/**
 * Which text roles a material carries at WCAG AA over any backdrop. Thin and regular carry primary
 * labels only; secondary text needs thick or chrome.
 */
export function materialAllows(material: Material, p: DesignPalette, role: 'label' | 'secondaryLabel' | 'tintLabel'): boolean {
  return materialContrast(material, p.scheme, p[role]) >= 4.5;
}

/**
 * Blur or a solid fill: solid with Reduce Transparency, when no blur view is available (expo-blur not
 * installed), and on Android (expo-blur's Android blur is experimental and costly) unless allowed.
 */
export function materialMode(opts: { reduceTransparency: boolean; hasBlur: boolean; platform: string; allowAndroidBlur?: boolean }): 'blur' | 'solid' {
  if (opts.reduceTransparency || !opts.hasBlur) return 'solid';
  if (opts.platform === 'android' && !opts.allowAndroidBlur) return 'solid';
  return 'blur';
}

// ---- Motion ----------------------------------------------------------------------------------------

/** v2 reuses the one spring preset (docs/POLISH.md rule 1); pills dip slightly deeper than rows. */
export const press = { spring: motionSpring, pillScale: 0.96, cardScale: 0.98 } as const;
