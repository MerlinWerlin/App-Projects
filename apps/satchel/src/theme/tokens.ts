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
  // T50 richer travel look. Every pair below was checked for WCAG AA (4.5:1 text, 3:1 icons) in both themes.
  /** Warm text that reads on paper, card and accentSoft (accent itself is for fills and icons). */
  accentInk: string;
  /** Fill for primary buttons: onAccent text on it is AA (accent itself is only 3:1 with white in light mode). */
  accentStrong: string;
  /** Tinted surfaces: ink text on them is AA; the matching strong colour (sea, ok, danger, warn, teal) is AA on them for icons and bold labels. */
  seaSoft: string;
  okSoft: string;
  dangerSoft: string;
  warnSoft: string;
  teal: string;
  tealSoft: string;
  /** Elevated card surface (one step above card in dark mode, white in light). */
  cardRaised: string;
  /** Shadow colour for elevated cards. */
  shadow: string;
  /** Text on every hero gradient (title) and the softer subtitle text; both AA on every gradient stop. */
  heroInk: string;
  heroMuted: string;
  /** Warm highlight for hero illustrations and large display numbers only. */
  heroAccent: string;
  /** Translucent white wash for shapes drawn on top of a hero gradient. */
  heroWash: string;
  /** Hero gradients per tab: [top-left, bottom-right]. */
  hero: Record<HeroTone, readonly [string, string]>;
};

/** Which hero gradient a screen uses. */
export type HeroTone = 'trips' | 'wallet' | 'map' | 'emergency' | 'toilets';

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
  accentInk: '#9A4A14',
  accentStrong: '#B4561C',
  seaSoft: '#E3EEF5',
  okSoft: '#E2F1E8',
  dangerSoft: '#FBE4E1',
  warnSoft: '#FBEFD9',
  teal: '#17766F',
  tealSoft: '#DDF0EC',
  cardRaised: '#FFFFFF',
  shadow: '#14213D',
  heroInk: '#FFFFFF',
  heroMuted: '#EEF3F8',
  heroAccent: '#FFC796',
  heroWash: 'rgba(255, 255, 255, 0.14)',
  hero: {
    trips: ['#14213D', '#2A6F97'],
    wallet: ['#7A3A10', '#A34D18'],
    map: ['#1F5F86', '#17766F'],
    emergency: ['#7A160E', '#B42318'],
    toilets: ['#0F6A63', '#17766F'],
  },
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
  accentInk: '#F29A5C',
  accentStrong: '#F29A5C',
  seaSoft: '#13293A',
  okSoft: '#12291E',
  dangerSoft: '#3A1614',
  warnSoft: '#33240F',
  teal: '#5CC8B8',
  tealSoft: '#0F2A27',
  cardRaised: '#1C2336',
  shadow: '#000000',
  heroInk: '#FFFFFF',
  heroMuted: '#C9D3E0',
  heroAccent: '#F29A5C',
  heroWash: 'rgba(255, 255, 255, 0.10)',
  hero: {
    trips: ['#0B1428', '#1B4A66'],
    wallet: ['#3A1C08', '#8A4214'],
    map: ['#0E2C40', '#11534D'],
    emergency: ['#3D0C08', '#8E1B12'],
    toilets: ['#06302C', '#11554D'],
  },
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

/**
 * Type scale (T50). Spread into a Text style and add a colour: `style={[typeScale.displayL, { color: theme.ink }]}`.
 * Display sizes use Space Grotesk with slightly tight tracking; captions are spaced out for small caps labels.
 */
export const typeScale = {
  displayXL: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  displayL: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  displayM: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  title: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, letterSpacing: 0 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;

/** Elevated card shadows (iOS shadow* + Android elevation). Pair with theme.shadow as shadowColor. */
export const elevation = {
  low: { shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  mid: { shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  high: { shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
} as const;
/** Shadow style for a level in the current theme (dark mode leans on the lighter cardRaised surface, so it shadows less). */
export const shadowOf = (theme: Theme, level: keyof typeof elevation) => ({
  ...elevation[level],
  shadowColor: theme.shadow,
  shadowOpacity: theme.dark ? elevation[level].shadowOpacity * 2 : elevation[level].shadowOpacity,
});

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 14, l: 20, xl: 28, pill: 999 } as const;
/** Minimum touch target (points). */
export const TOUCH = 48;
