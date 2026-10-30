// Design v2 ("bubbly", docs/DESIGN_V2.md): pure data + maths for the iOS-native redesign.
// Palette (light + dark), type scale, radii, spacing, layered elevation, glass materials,
// large-title collapse interpolation and WCAG AA checks of the palette. Pure TS so Node tests it;
// src/theme/tokensV2.ts adapts it for React Native and src/ui consumes that.
import { contrastRatio, mix, normalizeHex } from './colour.ts';

// ---------------------------------------------------------------- palette

/** One pastel accent: a soft `fill` for tiles/chips/bubbles and an `ink` readable on that fill. */
export type Pastel = { fill: string; ink: string };

export const PASTEL_NAMES = ['berry', 'lilac', 'mint', 'butter', 'peach', 'sky'] as const;
export type PastelName = (typeof PASTEL_NAMES)[number];

export type PaletteV2 = {
  /** Screen background behind inset-grouped lists (iOS "grouped background"). */
  bg: string;
  /** Cards, inset groups, sheets. */
  surface: string;
  /** Raised surfaces on top of `surface` (popovers, a selected tile). */
  surfaceRaised: string;
  /** Quiet filled controls: secondary chips, search field, segmented track. */
  fill: string;
  /** Hairline separators inside inset groups. */
  separator: string;
  /** Primary text. */
  ink: string;
  /** Secondary text (subtitles, values, footers). */
  inkSecondary: string;
  /** Tertiary text and placeholder; large text / icons only (≥ 3:1). */
  inkTertiary: string;
  /** The accent for tinted text, icons, links and the primary pill. */
  tint: string;
  /** Text/icons on a `tint` fill. */
  onTint: string;
  /** Soft accent fill for secondary pills and selected rows. */
  tintSoft: string;
  /** Text on `tintSoft`. */
  onTintSoft: string;
  ok: string;
  warn: string;
  danger: string;
  /** Text on a `danger` fill (destructive pill). */
  onDanger: string;
  /** Six cheerful pastel accents for icon tiles, category bubbles and badges. */
  pastels: Record<PastelName, Pastel>;
  /** Glossy gradient used sparingly (hero card, CTA sheen): from -> to. */
  glaze: [string, string];
};

export const lightV2: PaletteV2 = {
  bg: '#F4F1F7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  fill: '#ECE7F1',
  separator: '#E2DBE8',
  ink: '#1D1A21',
  inkSecondary: '#5E5766',
  inkTertiary: '#8A8292',
  tint: '#A2337F',
  onTint: '#FFFFFF',
  tintSoft: '#FBE1F1',
  onTintSoft: '#7A1F5E',
  ok: '#22784F',
  warn: '#9A5B06',
  danger: '#C2273D',
  onDanger: '#FFFFFF',
  pastels: {
    berry: { fill: '#FFD3EA', ink: '#7A1F5E' },
    lilac: { fill: '#E3D9FF', ink: '#4B2F9A' },
    mint: { fill: '#C9F1DE', ink: '#16633F' },
    butter: { fill: '#FFEDB0', ink: '#6E4D00' },
    peach: { fill: '#FFDCCB', ink: '#8A3413' },
    sky: { fill: '#CFE7FF', ink: '#174D86' },
  },
  glaze: ['#F7A8D8', '#FFC9A3'],
};

export const darkV2: PaletteV2 = {
  bg: '#0F0D12',
  surface: '#1C1A20',
  surfaceRaised: '#27242C',
  fill: '#2F2B35',
  separator: '#3A3541',
  ink: '#F5F0F7',
  inkSecondary: '#B3AABB',
  inkTertiary: '#857D8E',
  tint: '#F5A3DA',
  onTint: '#2B0E22',
  tintSoft: '#4A2140',
  onTintSoft: '#FFD6EF',
  ok: '#72D3A0',
  warn: '#F0BE62',
  danger: '#FF8A98',
  onDanger: '#2A0B10',
  pastels: {
    berry: { fill: '#4E2343', ink: '#FFD3EA' },
    lilac: { fill: '#352B5C', ink: '#E3D9FF' },
    mint: { fill: '#1D4636', ink: '#C9F1DE' },
    butter: { fill: '#4A3B12', ink: '#FFEDB0' },
    peach: { fill: '#52291A', ink: '#FFDCCB' },
    sky: { fill: '#1C3A5A', ink: '#CFE7FF' },
  },
  glaze: ['#B8488F', '#E07D55'],
};

export function paletteV2(scheme: 'light' | 'dark' | null | undefined): PaletteV2 {
  return scheme === 'dark' ? darkV2 : lightV2;
}

// ---------------------------------------------------------------- type scale

/** System font (SF Pro on iOS, Roboto on Android): fontFamily is left undefined by the theme layer. */
export type FontWeightV2 = '400' | '500' | '600' | '700' | '800';
export type TypeStyleV2 = { fontSize: number; lineHeight: number; fontWeight: FontWeightV2; letterSpacing: number };

/** iOS Dynamic Type "Large" sizes with matching weights and tracking (points). */
export const typeV2 = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '500', letterSpacing: 0.06 },
  /** Pill and button labels. */
  button: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  /** Inline (collapsed) navigation bar title. */
  navTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
} as const satisfies Record<string, TypeStyleV2>;

export type TypeRoleV2 = keyof typeof typeV2;

// ---------------------------------------------------------------- shape + space

/** Corner radii. Every rounded rect is drawn with continuous (squircle) corners. */
export const radiusV2 = {
  /** Small chips, badges, text fields. */
  control: 14,
  /** Inset-grouped list sections. */
  group: 22,
  /** Default card. */
  card: 24,
  /** Hero / showcase cards and category bubbles. */
  cardLarge: 28,
  /** Bottom sheets (top corners). */
  sheet: 32,
  /** Capsules: pill buttons, segmented thumbs, search fields. */
  pill: 999,
} as const;

/** iOS app icons are a superellipse whose corner is ~22.37% of the side. */
export const ICON_TILE_RATIO = 0.2237;

/** Corner radius for a square icon tile of `size` points (rounded to 0.5 pt). */
export function iconTileRadius(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.round(size * ICON_TILE_RATIO * 2) / 2;
}

/**
 * The three chrome radii (T163, owner-1030 B). New UI chrome uses only these names: `card` for
 * cards and panels, `control` for chips, badges and fields, `pill` for every button and capsule.
 * `radiusV2.group` / `cardLarge` / `sheet` stay as legacy aliases with their own values (folding
 * them into `card` would change how screens look; that is a design decision, not a refactor).
 */
export const chromeRadiusV2 = { card: radiusV2.card, control: radiusV2.control, pill: radiusV2.pill } as const;

/**
 * Shape radii, kept apart from chrome: `iconTileRadius(size)` for superellipse icon tiles and
 * `circleRadius(size)` for round dots, discs and badges (half the side, so the shape is a circle
 * or, on a wider box, a capsule).
 */
export function circleRadius(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return size / 2;
}

/** 4-pt spacing grid; `inset` is the side margin of inset-grouped lists. */
export const spaceV2 = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, inset: 20, xl: 24, xxl: 32, xxxl: 44 } as const;

/** Sizes of v2 controls (all touch targets ≥ 48 pt; PLAN §5). */
export const sizeV2 = {
  touch: 48,
  rowMin: 52,
  pill: 52,
  pillSmall: 48,
  rowIcon: 30,
  navBar: 52,
  largeTitleBlock: 52,
  tabBar: 56,
} as const;

// ---------------------------------------------------------------- artwork (not chrome)

/**
 * Brand fonts for artwork only: the phone mocks (HomeMock, LockMock, PhoneFrame, WidgetPreview,
 * CatalogueWidgetPreview) and store art. UI chrome uses the system font through `typeV2`.
 * Moved unchanged from the retired v1 tokens.ts `fonts` (T163).
 */
export const artFontsV2 = {
  display: 'Unbounded_700Bold',
  displayMedium: 'Unbounded_500Medium',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

/** The v1 brand glaze gradient the home mock paints when a theme has no wallpaper (v1 light.glazeA/B). */
export const brandGlazeV2 = { from: '#7A2E6B', to: '#E0794F' } as const;

/**
 * Ink drawn over photos, wallpapers and artwork: the same in light and dark mode, because the
 * backdrop is the art (always behind a scrim), not the app surface.
 */
export const onArtV2 = { ink: '#FFFFFF', black: '#000000' } as const;

// ---------------------------------------------------------------- elevation

/** One shadow layer (CSS box-shadow semantics; React Native 0.76+ `boxShadow` accepts a list). */
export type ShadowLayer = { x: number; y: number; blur: number; spread: number; color: string; opacity: number };

export const ELEVATION_LEVELS = ['flat', 'card', 'raised', 'floating', 'overlay'] as const;
export type ElevationLevel = (typeof ELEVATION_LEVELS)[number];

/**
 * Soft layered shadows: a tight contact layer plus a wide ambient layer, warm-tinted (never pure
 * black) in light mode. Dark mode leans on lighter surfaces instead, so its shadows are fainter
 * in feel but higher in opacity (they sit on a near-black background).
 */
export const elevationV2: Record<'light' | 'dark', Record<ElevationLevel, ShadowLayer[]>> = {
  light: {
    flat: [],
    card: [
      { x: 0, y: 1, blur: 2, spread: 0, color: '#3B1F38', opacity: 0.06 },
      { x: 0, y: 6, blur: 16, spread: -2, color: '#3B1F38', opacity: 0.08 },
    ],
    raised: [
      { x: 0, y: 2, blur: 4, spread: 0, color: '#3B1F38', opacity: 0.07 },
      { x: 0, y: 12, blur: 28, spread: -4, color: '#3B1F38', opacity: 0.12 },
    ],
    floating: [
      { x: 0, y: 4, blur: 8, spread: 0, color: '#3B1F38', opacity: 0.08 },
      { x: 0, y: 18, blur: 40, spread: -6, color: '#3B1F38', opacity: 0.16 },
    ],
    overlay: [
      { x: 0, y: 6, blur: 12, spread: 0, color: '#3B1F38', opacity: 0.1 },
      { x: 0, y: 28, blur: 64, spread: -8, color: '#3B1F38', opacity: 0.22 },
    ],
  },
  dark: {
    flat: [],
    card: [
      { x: 0, y: 1, blur: 2, spread: 0, color: '#000000', opacity: 0.3 },
      { x: 0, y: 6, blur: 16, spread: -2, color: '#000000', opacity: 0.28 },
    ],
    raised: [
      { x: 0, y: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.34 },
      { x: 0, y: 12, blur: 28, spread: -4, color: '#000000', opacity: 0.36 },
    ],
    floating: [
      { x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 0.38 },
      { x: 0, y: 18, blur: 40, spread: -6, color: '#000000', opacity: 0.42 },
    ],
    overlay: [
      { x: 0, y: 6, blur: 12, spread: 0, color: '#000000', opacity: 0.42 },
      { x: 0, y: 28, blur: 64, spread: -8, color: '#000000', opacity: 0.5 },
    ],
  },
};

function rgba(hex: string, opacity: number): string {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** CSS `box-shadow` list for a level, e.g. "0px 1px 2px 0px rgba(59, 31, 56, 0.06), ...". */
export function boxShadowFor(level: ElevationLevel, scheme: 'light' | 'dark'): string {
  return elevationV2[scheme][level]
    .map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${rgba(l.color, l.opacity)}`)
    .join(', ');
}

/** Android `elevation` equivalent (dp) for platforms that ignore box-shadow. */
export const androidElevationV2: Record<ElevationLevel, number> = { flat: 0, card: 2, raised: 6, floating: 10, overlay: 16 };

// ---------------------------------------------------------------- materials

/**
 * Translucent "glass" materials for bars and sheets. `tint` is laid over a blur (when the blur view
 * is available) or straight over content (solid fallback). `alpha` is chosen so text on the
 * material stays WCAG AA even over the worst-case backdrop (pure black or pure white) — see
 * materialContrast(). `fallback` is the opaque colour used when transparency is off.
 */
export type Material = { tint: string; alpha: number; blurIntensity: number; fallback: string };
export const MATERIAL_NAMES = ['bar', 'thick', 'chrome'] as const;
export type MaterialName = (typeof MATERIAL_NAMES)[number];

export const materialsV2: Record<'light' | 'dark', Record<MaterialName, Material>> = {
  light: {
    /** Navigation / tab bars once content scrolls under them. */
    bar: { tint: '#F8F6FA', alpha: 0.9, blurIntensity: 60, fallback: '#F8F6FA' },
    /** Sheets and popovers. */
    thick: { tint: '#FFFFFF', alpha: 0.92, blurIntensity: 80, fallback: '#FFFFFF' },
    /** Floating controls over photos/wallpapers (a pill bar over a preview). */
    chrome: { tint: '#FFFFFF', alpha: 0.88, blurIntensity: 50, fallback: '#FFFFFF' },
  },
  dark: {
    bar: { tint: '#1C1A20', alpha: 0.9, blurIntensity: 60, fallback: '#1C1A20' },
    thick: { tint: '#27242C', alpha: 0.92, blurIntensity: 80, fallback: '#27242C' },
    chrome: { tint: '#1C1A20', alpha: 0.88, blurIntensity: 50, fallback: '#1C1A20' },
  },
};

/** Colour of a translucent `tint` at `alpha` composited over an opaque `backdrop`. */
export function compositeOver(tint: string, alpha: number, backdrop: string): string {
  return mix(backdrop, tint, alpha);
}

/**
 * Worst-case contrast of `text` on a material: the minimum over a pure black and a pure white
 * backdrop (a blur only averages the backdrop, so it can never be worse than these two).
 */
export function materialContrast(text: string, m: Material): number {
  return Math.min(
    contrastRatio(text, compositeOver(m.tint, m.alpha, '#000000')),
    contrastRatio(text, compositeOver(m.tint, m.alpha, '#FFFFFF')),
  );
}

/** rgba() string for a material's tint layer. */
export function materialColour(m: Material): string {
  return rgba(m.tint, m.alpha);
}

/**
 * Dimmed scrim behind sheets and modal overlays: warm plum ink in light mode (like the shadows),
 * near-black in dark mode, so the content behind recedes without looking grey.
 */
export const scrimV2: Record<'light' | 'dark', { tint: string; alpha: number }> = {
  light: { tint: '#3B1F38', alpha: 0.4 },
  dark: { tint: '#000000', alpha: 0.6 },
};

/** rgba() string for the sheet scrim in a scheme. */
export function scrimColour(scheme: 'light' | 'dark'): string {
  const s = scrimV2[scheme];
  return rgba(s.tint, s.alpha);
}

// ---------------------------------------------------------------- contrast audit

export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

export type ContrastCheck = { name: string; fg: string; bg: string; min: number; ratio: number; ok: boolean };

/** Every foreground/background pairing the v2 components use, with its WCAG AA minimum. */
export function paletteChecks(p: PaletteV2): ContrastCheck[] {
  const pairs: [string, string, string, number][] = [
    ['ink/bg', p.ink, p.bg, AA_TEXT],
    ['ink/surface', p.ink, p.surface, AA_TEXT],
    ['ink/surfaceRaised', p.ink, p.surfaceRaised, AA_TEXT],
    ['ink/fill', p.ink, p.fill, AA_TEXT],
    ['inkSecondary/bg', p.inkSecondary, p.bg, AA_TEXT],
    ['inkSecondary/surface', p.inkSecondary, p.surface, AA_TEXT],
    ['inkSecondary/fill', p.inkSecondary, p.fill, AA_TEXT],
    ['inkTertiary/surface', p.inkTertiary, p.surface, AA_LARGE],
    ['inkTertiary/bg', p.inkTertiary, p.bg, AA_LARGE],
    ['tint/bg', p.tint, p.bg, AA_TEXT],
    ['tint/surface', p.tint, p.surface, AA_TEXT],
    ['onTint/tint', p.onTint, p.tint, AA_TEXT],
    ['onTintSoft/tintSoft', p.onTintSoft, p.tintSoft, AA_TEXT],
    ['ok/surface', p.ok, p.surface, AA_TEXT],
    ['warn/surface', p.warn, p.surface, AA_TEXT],
    ['danger/surface', p.danger, p.surface, AA_TEXT],
    ['onDanger/danger', p.onDanger, p.danger, AA_TEXT],
  ];
  for (const n of PASTEL_NAMES) pairs.push([`pastel.${n}`, p.pastels[n].ink, p.pastels[n].fill, AA_TEXT]);
  return pairs.map(([name, fg, bg, min]) => {
    const ratio = contrastRatio(fg, bg);
    return { name, fg, bg, min, ratio, ok: ratio >= min };
  });
}

/** Text on every material, worst-case backdrop. */
export function materialChecks(p: PaletteV2, scheme: 'light' | 'dark'): ContrastCheck[] {
  const out: ContrastCheck[] = [];
  for (const name of MATERIAL_NAMES) {
    const m = materialsV2[scheme][name];
    for (const [label, fg, min] of [
      ['ink', p.ink, AA_TEXT],
      ['inkSecondary', p.inkSecondary, AA_TEXT],
      ['tint', p.tint, AA_TEXT],
    ] as const) {
      const ratio = materialContrast(fg, m);
      out.push({ name: `${label}/${name}`, fg, bg: materialColour(m), min, ratio, ok: ratio >= min });
    }
  }
  return out;
}

// ---------------------------------------------------------------- large title collapse

/** Piecewise-linear interpolation with clamping (same semantics as reanimated's CLAMP). */
export function interpolateClamp(x: number, input: readonly number[], output: readonly number[]): number {
  if (input.length !== output.length || input.length === 0) throw new Error('interpolateClamp: bad ranges');
  if (!Number.isFinite(x)) return output[0];
  if (x <= input[0]) return output[0];
  const last = input.length - 1;
  if (x >= input[last]) return output[last];
  for (let i = 1; i <= last; i++) {
    if (x <= input[i]) {
      const span = input[i] - input[i - 1];
      const t = span === 0 ? 1 : (x - input[i - 1]) / span;
      return output[i - 1] + (output[i] - output[i - 1]) * t;
    }
  }
  return output[last];
}

export type Range = { input: number[]; output: number[] };

/**
 * Interpolation ranges for an iOS-style large title of block height `h` (points), driven by the
 * scroll offset `y` (negative = pulled down):
 * - largeOpacity: 1 until half-way, 0 once fully scrolled under the bar;
 * - largeScale: grows up to 1.08 on overscroll (pull-down), 1 otherwise (the title block lives
 *   inside the scroll content, so it already moves with the scroll; no translate is needed);
 * - inlineOpacity: the small centred bar title fades in over the last 30% of the collapse;
 * - barOpacity: the glass material + hairline under the bar appear once content passes under it.
 * The ranges are plain arrays so a reanimated `interpolate(y, r.input, r.output, CLAMP)` on the UI
 * thread gives exactly largeTitleFrame()'s numbers.
 */
export function largeTitleRanges(h: number = sizeV2.largeTitleBlock): Record<keyof LargeTitleFrame, Range> {
  const H = Math.max(1, h);
  return {
    largeOpacity: { input: [0, H * 0.5, H], output: [1, 1, 0] },
    largeScale: { input: [-H * 2, 0], output: [1.08, 1] },
    inlineOpacity: { input: [H * 0.7, H], output: [0, 1] },
    barOpacity: { input: [H * 0.85, H * 1.15], output: [0, 1] },
  };
}

export type LargeTitleFrame = {
  largeOpacity: number;
  largeScale: number;
  inlineOpacity: number;
  barOpacity: number;
};

/** Reference implementation of the collapse at scroll offset `y` (tested; the UI uses the ranges). */
export function largeTitleFrame(y: number, h: number = sizeV2.largeTitleBlock): LargeTitleFrame {
  const r = largeTitleRanges(h);
  return {
    largeOpacity: interpolateClamp(y, r.largeOpacity.input, r.largeOpacity.output),
    largeScale: interpolateClamp(y, r.largeScale.input, r.largeScale.output),
    inlineOpacity: interpolateClamp(y, r.inlineOpacity.input, r.inlineOpacity.output),
    barOpacity: interpolateClamp(y, r.barOpacity.input, r.barOpacity.output),
  };
}

/**
 * With Reduce Motion the title does not scale or slide: it scrolls away with the content and the
 * bar title/material switch at the half-way point with a short fade (done by the component).
 */
export function largeTitleSnapAt(h: number = sizeV2.largeTitleBlock): number {
  return Math.max(1, h) * 0.6;
}

/** True once the reduced-motion header has switched to its collapsed state. */
export function largeTitleSnapped(y: number, h: number = sizeV2.largeTitleBlock): boolean {
  return y >= largeTitleSnapAt(h);
}

// ---------------------------------------------------------------- inset groups

export type RowPosition = 'only' | 'first' | 'middle' | 'last';

/** Where a row sits in its inset group (decides corner rounding and separators). */
export function rowPosition(index: number, count: number): RowPosition {
  if (count <= 1) return 'only';
  if (index <= 0) return 'first';
  if (index >= count - 1) return 'last';
  return 'middle';
}

/** True when a hairline separator is drawn under the row (all rows but the last). */
export function hasSeparator(pos: RowPosition): boolean {
  return pos === 'first' || pos === 'middle';
}

/**
 * Leading inset of a row separator: iOS starts it at the title, not the cell edge, so it lines up
 * with the text after an icon tile.
 */
export function separatorInset(hasIcon: boolean): number {
  return hasIcon ? spaceV2.lg + sizeV2.rowIcon + spaceV2.md : spaceV2.lg;
}

// ---------------------------------------------------------------- selection motion

/** Press and selection scales for v2 shapes (springs come from src/core/motion.ts). */
export const pressV2 = { pill: 0.96, card: 0.97, tile: 0.92, selectedPop: 1.04 } as const;
