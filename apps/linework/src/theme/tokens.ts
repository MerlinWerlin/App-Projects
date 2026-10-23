// Design tokens from docs/PLAN.md §4. Light + dark.
export type Palette = {
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
};

export const light: Palette = {
  paper: '#F5F1EA',
  card: '#FFFFFF',
  line: '#DDD5C8',
  graphite: '#22201C',
  muted: '#6E675D',
  ink: '#2346A8',
  inkSoft: '#E3E8F7',
  ok: '#2C7A54',
  warn: '#A2620F',
  onInk: '#FFFFFF',
};

export const dark: Palette = {
  paper: '#14130F',
  card: '#1D1B17',
  line: '#34302A',
  graphite: '#EEE8DE',
  muted: '#A39B8F',
  ink: '#8FA8FF',
  inkSoft: '#1E2846',
  ok: '#6CC796',
  warn: '#E5B35A',
  onInk: '#14130F',
};

// Camera-screen control colours live in src/core/cameraGlass.ts (`cameraGlass`; the v1 `glass` token was folded in by T95).

// Brand fonts cover Latin only. Module-level StyleSheets may keep using these; for CJK / Devanagari / Arabic the
// system font and taller lines come from useTypography() (src/theme/typography.ts, docs/I18N.md).
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_600SemiBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };
// Minimum touch target in points (PLAN §4).
export const touch = 48;

// Elevation tokens (docs/POLISH.md rule 6): one shadow scale used everywhere. Android uses `elevation`.
export const elevation = {
  none: {},
  card: { shadowColor: '#22201C', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  raised: { shadowColor: '#22201C', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  overlay: { shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
} as const;

// Tabular figures for numbers that change in place (percentages, timers, counts).
export const tabular = { fontVariant: ['tabular-nums' as const] };
