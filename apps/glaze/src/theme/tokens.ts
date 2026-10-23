// Design tokens from docs/PLAN.md §5. Pure data: safe to import from anywhere.

export type Palette = {
  porcelain: string;
  card: string;
  line: string;
  ink: string;
  muted: string;
  plum: string;
  plumSoft: string;
  glazeA: string;
  glazeB: string;
  ok: string;
  warn: string;
  onAccent: string;
};

export const light: Palette = {
  porcelain: '#F6F3F5',
  card: '#FFFFFF',
  line: '#E2DAE0',
  ink: '#1E1A1D',
  muted: '#6F6570',
  plum: '#7A2E6B',
  plumSoft: '#F1E1EC',
  glazeA: '#7A2E6B',
  glazeB: '#E0794F',
  ok: '#2C7A54',
  warn: '#A2620F',
  onAccent: '#FFFFFF',
};

export const dark: Palette = {
  porcelain: '#121013',
  card: '#1B181B',
  line: '#332D32',
  ink: '#F1ECEF',
  muted: '#A89DA6',
  plum: '#E59AD3',
  plumSoft: '#3A1F35',
  glazeA: '#7A2E6B',
  glazeB: '#E0794F',
  ok: '#6CC796',
  warn: '#E5B35A',
  onAccent: '#121013',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;
/** Minimum touch target in points (PLAN §5). */
export const touch = 48;

export const fonts = {
  display: 'Unbounded_700Bold',
  displayMedium: 'Unbounded_500Medium',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20 },
} as const;

/** Elevation tokens (POLISH rule 6): one shadow scale for cards, sheets and toasts. */
export const elevation = {
  none: {},
  card: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  raised: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  overlay: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
} as const;

/** Tabular figures for numbers that change (clock, timings, percentages, counts). */
export const tabular = { fontVariant: ['tabular-nums' as const] };

/** Dimmed backdrop behind sheets. */
export const backdrop = 'rgba(0,0,0,0.42)';
