// Design v2 tokens ("bubbly iOS", docs/DESIGN_V2.md §2–§4). Light + dark.
// Pure data with no imports, so node tests (src/core/contrast.test.ts) can load it directly. The React hook is
// `useThemeV2()` in src/theme/useTheme.ts, next to the v1 `useTheme()` (v1 tokens in tokens.ts are untouched).
//
// Contrast: every text-on-fill pair the spec uses is checked ≥ 4.5:1 in src/core/contrast.test.ts. Two values
// differ from the T72 table because they failed that check (noted in DESIGN_V2.md): light `warn` #B4690E → #9C5B0B
// (3.8:1 on paper) and dark `muted` #A8A096 → #B4ACA1 (4.1:1 on the sunny pastel over a card).

export type PaletteV2 = {
  // v1 names (same meaning, v2 values)
  paper: string;
  card: string;
  line: string;
  graphite: string;
  muted: string;
  ink: string;
  inkSoft: string;
  ok: string;
  warn: string;
  onInk: string;
  // v2 additions
  card2: string;
  bubblegum: string;
  sunny: string;
  mint: string;
  lilac: string;
  sky: string;
  /** Category bubble fills, in order: inkSoft, bubblegum, sunny, mint, lilac, sky tints. */
  pastels: readonly string[];
  /** Dark mode 1 px top highlight used instead of shadows (transparent in light). */
  highlight: string;
  /** GlassBar / GlassSheet opaque fallback (92% card) while blur is unavailable. */
  glassFallback: string;
  /** Sheet backdrop dim (30%). */
  scrim: string;
};

export const lightV2: PaletteV2 = {
  paper: '#F7F3EE',
  card: '#FFFFFF',
  card2: '#FBF8F4',
  line: '#E7E0D6',
  graphite: '#1F1D1A',
  muted: '#6F685E',
  ink: '#3B5BDB',
  inkSoft: '#E6EBFC',
  ok: '#2C7A54',
  warn: '#9C5B0B',
  onInk: '#FFFFFF',
  bubblegum: '#FF7AA2',
  sunny: '#FFC94D',
  mint: '#4CC9A0',
  lilac: '#A78BFA',
  sky: '#4DABF7',
  pastels: ['#E6EBFC', '#FFE3EC', '#FFF2CC', '#DDF6EC', '#EEE8FF', '#E3F4FF'],
  highlight: 'transparent',
  glassFallback: 'rgba(255,255,255,0.92)',
  scrim: 'rgba(0,0,0,0.3)',
};

export const darkV2: PaletteV2 = {
  paper: '#121110',
  card: '#1E1C1A',
  card2: '#262320',
  line: '#35312C',
  graphite: '#F1ECE4',
  muted: '#B4ACA1',
  ink: '#91A7FF',
  inkSoft: '#1F2747',
  ok: '#6CC796',
  warn: '#E5B35A',
  onInk: '#121110',
  bubblegum: '#FF8FB1',
  sunny: '#FFD36E',
  mint: '#6ED8B4',
  lilac: '#B9A2FF',
  sky: '#74C0FC',
  // 18% alpha of the matching accent (inkSoft stays opaque, as in the spec)
  pastels: [
    '#1F2747',
    'rgba(255,143,177,0.18)',
    'rgba(255,211,110,0.18)',
    'rgba(110,216,180,0.18)',
    'rgba(185,162,255,0.18)',
    'rgba(116,192,252,0.18)',
  ],
  highlight: 'rgba(255,255,255,0.06)',
  glassFallback: 'rgba(30,28,26,0.92)',
  scrim: 'rgba(0,0,0,0.3)',
};

/** Pastel for category index `i` (wraps around). */
export function pastelAt(p: PaletteV2, i: number): string {
  const n = p.pastels.length;
  const k = Number.isFinite(i) ? ((Math.round(i) % n) + n) % n : 0;
  return p.pastels[k];
}

/** Radii (§4). Use with `borderCurve: 'continuous'` (iOS; ignored elsewhere). */
export const radiusV2 = { xs: 10, sm: 14, md: 20, lg: 28, xl: 36, pill: 999 } as const;

/** 4-pt spacing grid, screen gutter (16; 20 on ≥ 400 pt wide) and section gap (§4). */
export const spaceV2 = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x7: 28, x8: 32, section: 28 } as const;
export function gutterFor(windowWidth: number): number {
  return windowWidth >= 400 ? 20 : 16;
}

/** Component sizes from §6 (minimum heights: content grows with long translations). */
export const sizeV2 = { pill: 50, categoryBubble: 76, iconBubble: 30, row: 48, touch: 44, cameraTouch: 48, bar: 44 } as const;

export type ShadowStyle = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

/**
 * Elevation e1–e3 (§4). iOS draws one shadow per view, so each level uses its dominant layer (spec blur ÷ 2 =
 * shadowRadius); `elevation` is the Android equivalent. In dark mode use `elevationV2(level, true)`, which swaps
 * the shadow for the 1 px top highlight.
 */
export const shadowV2: Record<'e1' | 'e2' | 'e3', ShadowStyle> = {
  e1: { shadowColor: '#1F1D1A', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  e2: { shadowColor: '#1F1D1A', shadowOpacity: 0.1, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  e3: { shadowColor: '#1F1D1A', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
};

export type ElevationLevel = 'none' | 'e1' | 'e2' | 'e3';

export function elevationV2(level: ElevationLevel, isDark: boolean): Partial<ShadowStyle> & { borderTopWidth?: number; borderTopColor?: string } {
  if (level === 'none') return {};
  if (isDark) return { borderTopWidth: 1, borderTopColor: darkV2.highlight };
  return shadowV2[level];
}

/** iOS type scale (§3), system font. Line heights are Latin; scripts with tall marks scale them (useThemeV2). */
export type TypeStyleV2 = { fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' };
export const typeV2 = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const satisfies Record<string, TypeStyleV2>;
export type TypeName = keyof typeof typeV2;

/** Dynamic Type cap for v2 text (matches the v1 screens). */
export const maxFontScaleV2 = 1.4;
