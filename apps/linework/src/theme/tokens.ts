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

// Same values as the v2 "Drawing table" palette (DESIGN.md §2), so v1 and v2 screens match.
export const light: Palette = {
  paper: '#F6F2EB',
  card: '#FFFDF9',
  line: '#E2DACE',
  graphite: '#1E1B18',
  muted: '#6B645A',
  ink: '#B23A1F',
  inkSoft: '#F6E3DC',
  ok: '#2C6E4F',
  warn: '#8F540A',
  onInk: '#FFFFFF',
};

export const dark: Palette = {
  paper: '#141210',
  card: '#1D1A17',
  line: '#36312B',
  graphite: '#F2EDE5',
  muted: '#B1A99E',
  ink: '#FF8E6B',
  inkSoft: '#3A221B',
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
export const radius = { sm: 8, md: 10, lg: 12, pill: 999 };
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
