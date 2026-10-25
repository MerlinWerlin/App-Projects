// Design tokens from docs/PLAN.md §5. Screens take every colour from here (no raw colours in app/).
export type Theme = {
  dark: boolean;
  paper: string;
  card: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  sea: string;
  ok: string;
  warn: string;
  danger: string;
  onAccent: string;
  /** Dims the screen behind a bottom sheet (the iPhone date / time sheet); tap it to cancel. */
  scrim: string;
};

export const light: Theme = {
  dark: false,
  paper: '#F4F1EA',
  card: '#FFFFFF',
  line: '#DED8CC',
  ink: '#14213D',
  muted: '#6B7280',
  accent: '#E07A2F',
  accentSoft: '#FBE7D6',
  sea: '#2A6F97',
  ok: '#2C7A54',
  warn: '#A2620F',
  danger: '#B42318',
  onAccent: '#FFFFFF',
  scrim: 'rgba(20, 33, 61, 0.45)',
};

export const dark: Theme = {
  dark: true,
  paper: '#0E1320',
  card: '#161C2C',
  line: '#2A3247',
  ink: '#EEF1F7',
  muted: '#A3ABBD',
  accent: '#F29A5C',
  accentSoft: '#3A2516',
  sea: '#7DB7DA',
  ok: '#5FBF8C',
  warn: '#E0A050',
  danger: '#F07167',
  onAccent: '#14213D',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

/** Low-battery essentials mode: pure black with white text, whatever the theme. */
export const essentials = { bg: '#000000', ink: '#FFFFFF', muted: '#BBBBBB', line: '#333333' } as const;

/**
 * Brand mark (T18): app icon, native splash and the startup overlay. `bg` must equal the splash backgroundColor in
 * app.json (and the theme paper) so there is no white frame. Mirrored in scripts/render-icons.mjs.
 */
export const brand = {
  light: { bg: light.paper, body: light.ink, flap: light.accent, detail: light.paper },
  dark: { bg: dark.paper, body: light.paper, flap: dark.accent, detail: dark.paper },
} as const;

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyBold: 'Inter_600SemiBold',
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 14, l: 20 } as const;
/** Minimum touch target (points). */
export const TOUCH = 48;
