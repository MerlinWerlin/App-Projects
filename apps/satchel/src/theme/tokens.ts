// Design tokens from docs/PLAN.md §5. Screens take every colour from here (no raw colours in app/).
import type { CoverPaint } from '../core/coverArt.ts';
import type { CoverId } from '../core/covers.ts';
import type { CardColour } from '../core/loyalty.ts';
import type { StampInk } from '../core/stamps.ts';
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
  // T91: src/theme/contrast.test.ts checks every pair screens use, in both themes. `accent` is for icons, borders and
  // fills only (3:1); never put text in it or onAccent text on it (use accentInk / accentStrong).
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
  /** Translucent white wash for shapes drawn on top of a hero gradient (art and icon circles, not behind text). */
  heroWash: string;
  /** T91: translucent dark glass for text pills on a hero gradient (heroInk / heroMuted on it are AA over every stop). */
  heroChip: string;
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
  muted: '#5F6675',
  accent: '#CC6A26',
  accentSoft: '#FBE7D6',
  sea: '#2A6F97',
  ok: '#28714E',
  warn: '#8F560B',
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
  heroChip: 'rgba(8, 16, 36, 0.24)',
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
  heroChip: 'rgba(0, 0, 0, 0.28)',
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
  // The flap keeps the original logo orange (the owner likes the logo); light.accent was deepened in T91 for contrast.
  light: { bg: light.paper, body: light.ink, flap: '#E07A2F', detail: light.paper },
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

// ---- T83 trip covers ----
// One palette per illustrated scene (src/core/coverArt.ts): a day version for light mode and a dusk / night version
// for dark mode. Slots: sky0 (top of the sky) -> sky1 (horizon), glow (sun, moon, stars, glints), far / mid / near
// (layers back to front), accent (sea, roofs, pines), detail (windows, snow caps, wave lines).
export type CoverPalette = Record<CoverPaint, string>;

export const coverPalettes: { light: Record<CoverId, CoverPalette>; dark: Record<CoverId, CoverPalette> } = {
  light: {
    city: { sky0: '#8EC3E6', sky1: '#FBE3C4', glow: '#FFD27A', far: '#A9BED6', mid: '#3F5F86', near: '#22395A', accent: '#9CC3E0', detail: '#FFE9B8' },
    mountains: { sky0: '#7DB9E8', sky1: '#E6F2F8', glow: '#FFE19A', far: '#9DB8D3', mid: '#4F7398', near: '#3C7A55', accent: '#1E4D3A', detail: '#FFFFFF' },
    coast: { sky0: '#6FB6E3', sky1: '#FFE2BC', glow: '#FFD27A', far: '#7FA7C4', mid: '#C98B5A', near: '#F1D3A1', accent: '#2E86B5', detail: '#FFFFFF' },
    oldtown: { sky0: '#9CCBEA', sky1: '#FCE8CF', glow: '#FFD27A', far: '#A9C29A', mid: '#F3E2C4', near: '#6B4A3A', accent: '#C4573A', detail: '#4A5B78' },
    countryside: { sky0: '#8FC6EC', sky1: '#FDF0D2', glow: '#FFD27A', far: '#A8CBA0', mid: '#6FAE6A', near: '#3E7D4B', accent: '#C4573A', detail: '#FFF6E0' },
    snow: { sky0: '#A7D3F2', sky1: '#EEF6FB', glow: '#FFE9A8', far: '#7F9DC2', mid: '#E3EEF7', near: '#FFFFFF', accent: '#2F5E4E', detail: '#FFFFFF' },
    desert: { sky0: '#79B8E0', sky1: '#FCE3B5', glow: '#FFE08A', far: '#E3B884', mid: '#E6A55E', near: '#D08440', accent: '#3F6B3A', detail: '#FBE0B0' },
    island: { sky0: '#6CC0EA', sky1: '#E8F7FA', glow: '#FFE08A', far: '#7FD8D0', mid: '#3E9A5A', near: '#F4DCA8', accent: '#1F8FBF', detail: '#2E5A3A' },
  },
  dark: {
    city: { sky0: '#0A1430', sky1: '#3B2F5E', glow: '#F6E7C1', far: '#2B3866', mid: '#18224A', near: '#0C1330', accent: '#5A6FA8', detail: '#FFC864' },
    mountains: { sky0: '#101A3A', sky1: '#4A3F6E', glow: '#F3E6C4', far: '#34406C', mid: '#222C52', near: '#14302A', accent: '#0B1F1B', detail: '#C9D4EC' },
    coast: { sky0: '#1B2350', sky1: '#D9826A', glow: '#FFC27A', far: '#3A3F6E', mid: '#3E2C48', near: '#7A5E66', accent: '#24406E', detail: '#F6D9C2' },
    oldtown: { sky0: '#0E1736', sky1: '#3E3466', glow: '#F4E6C2', far: '#2C3760', mid: '#5A4E6E', near: '#1E1A2E', accent: '#8E3E3A', detail: '#FFC864' },
    countryside: { sky0: '#0F1A3A', sky1: '#3A4470', glow: '#F3E6C4', far: '#2F4A55', mid: '#22413F', near: '#142B28', accent: '#8E3E3A', detail: '#E8D9A8' },
    snow: { sky0: '#0B1533', sky1: '#2E4470', glow: '#FFD58A', far: '#3A4C78', mid: '#8C9EC4', near: '#B8C6E2', accent: '#102A2A', detail: '#E6ECF8' },
    desert: { sky0: '#1A1842', sky1: '#8A4A5E', glow: '#FFB870', far: '#5A3A5A', mid: '#7A4A50', near: '#5A3440', accent: '#20262A', detail: '#C88A6A' },
    island: { sky0: '#0D1840', sky1: '#3D3A72', glow: '#F3E6C4', far: '#1E5866', mid: '#173A30', near: '#8A7466', accent: '#14305A', detail: '#0C1E1A' },
  },
};

/** The palette for a scene in the current theme. */
export const coverPalette = (theme: Theme, id: CoverId): CoverPalette => (theme.dark ? coverPalettes.dark : coverPalettes.light)[id];

/**
 * Scrim behind text laid over a cover (top-down gradient over the lower part: clear -> half -> deep navy). heroInk / heroMuted text on the
 * bottom stop is AA in both themes whatever the scene underneath.
 */
export const coverScrim = {
  light: { from: 'rgba(12, 20, 40, 0)', mid: 'rgba(12, 20, 40, 0.5)', to: 'rgba(12, 20, 40, 0.84)' },
  dark: { from: 'rgba(4, 8, 20, 0)', mid: 'rgba(4, 8, 20, 0.55)', to: 'rgba(4, 8, 20, 0.86)' },
} as const;

// ---- T87 loyalty cards ----
// Card paints the user picks from (src/core/loyalty.ts CARD_COLOURS). `ink` and `muted` text are AA (4.5:1) on every
// fill in both themes (src/theme/cardPaints.test.ts); dark mode uses deeper fills so a card doesn't glare at night.
// `wash` is for decorative shapes drawn on the card. The barcode panel is always black on white, in both themes,
// because scanners need dark bars on a light ground with a clear quiet zone.
export type CardPaint = { fill: string; ink: string; muted: string; wash: string };
export const cardPaints: { light: Record<CardColour, CardPaint>; dark: Record<CardColour, CardPaint> } = {
  light: {
    navy: { fill: '#1F3A68', ink: '#FFFFFF', muted: '#E3E9F4', wash: 'rgba(255, 255, 255, 0.12)' },
    sea: { fill: '#1F5F86', ink: '#FFFFFF', muted: '#E6EFF5', wash: 'rgba(255, 255, 255, 0.12)' },
    teal: { fill: '#12655F', ink: '#FFFFFF', muted: '#E3F1EE', wash: 'rgba(255, 255, 255, 0.12)' },
    forest: { fill: '#2E6B45', ink: '#FFFFFF', muted: '#E6F1EA', wash: 'rgba(255, 255, 255, 0.12)' },
    amber: { fill: '#8A5A0B', ink: '#FFFFFF', muted: '#FBEFD9', wash: 'rgba(255, 255, 255, 0.12)' },
    rust: { fill: '#9A3F1C', ink: '#FFFFFF', muted: '#FBE7DC', wash: 'rgba(255, 255, 255, 0.12)' },
    plum: { fill: '#5E3A78', ink: '#FFFFFF', muted: '#EEE6F4', wash: 'rgba(255, 255, 255, 0.12)' },
    slate: { fill: '#3F4A5C', ink: '#FFFFFF', muted: '#E7EAF0', wash: 'rgba(255, 255, 255, 0.12)' },
  },
  dark: {
    navy: { fill: '#1A2F55', ink: '#FFFFFF', muted: '#C9D3E6', wash: 'rgba(255, 255, 255, 0.08)' },
    sea: { fill: '#184C6B', ink: '#FFFFFF', muted: '#CBDCE8', wash: 'rgba(255, 255, 255, 0.08)' },
    teal: { fill: '#0F524D', ink: '#FFFFFF', muted: '#C8E2DD', wash: 'rgba(255, 255, 255, 0.08)' },
    forest: { fill: '#24553A', ink: '#FFFFFF', muted: '#CDE2D4', wash: 'rgba(255, 255, 255, 0.08)' },
    amber: { fill: '#6E4808', ink: '#FFFFFF', muted: '#F1DEBD', wash: 'rgba(255, 255, 255, 0.08)' },
    rust: { fill: '#7C3216', ink: '#FFFFFF', muted: '#EFD2C4', wash: 'rgba(255, 255, 255, 0.08)' },
    plum: { fill: '#4B2E60', ink: '#FFFFFF', muted: '#DCCDE8', wash: 'rgba(255, 255, 255, 0.08)' },
    slate: { fill: '#333C4B', ink: '#FFFFFF', muted: '#D2D7E0', wash: 'rgba(255, 255, 255, 0.08)' },
  },
};
export const cardPaint = (theme: Theme, c: CardColour): CardPaint => (theme.dark ? cardPaints.dark : cardPaints.light)[c] ?? cardPaints.light.slate;
/** Scannable barcode panel, the same in light and dark mode. */
export const barcodePanel = { bg: '#FFFFFF', ink: '#000000' } as const;

// ---- T103 passport stamps ----
// The Passport's paper pages (drawn as a pure SVG pattern: `grain` dots and `fibre` hairlines on `paper`, `edge` for
// the page border and the gutter rule) and the stamp inks (src/core/stamps.ts STAMP_INKS). Every ink is AA (4.5:1) on
// `paper` and on `grain` in its theme, so stamp text stays readable wherever a speck of grain sits under it
// (src/theme/contrast.test.ts). Dark mode is a night-blue page with pale inks.
export type StampPaper = { paper: string; grain: string; fibre: string; edge: string };
export const stampPapers: { light: StampPaper; dark: StampPaper } = {
  light: { paper: '#F6EFDD', grain: '#E4D9BF', fibre: '#EADFC6', edge: '#D3C6A6' },
  dark: { paper: '#1D2232', grain: '#2A3044', fibre: '#242A3C', edge: '#3A4258' },
};
export const stampInks: { light: Record<StampInk, string>; dark: Record<StampInk, string> } = {
  light: { navy: '#1F3A68', rust: '#9A3F1C', forest: '#2E6B45', plum: '#6A3A82', teal: '#12655F', crimson: '#A32B22' },
  dark: { navy: '#9DBDF0', rust: '#F2A27A', forest: '#8ED1A6', plum: '#CDA8EE', teal: '#6FD3C6', crimson: '#F5928B' },
};
export const stampPaper = (theme: Theme): StampPaper => (theme.dark ? stampPapers.dark : stampPapers.light);
export const stampInk = (theme: Theme, ink: StampInk): string => (theme.dark ? stampInks.dark : stampInks.light)[ink] ?? (theme.dark ? stampInks.dark.navy : stampInks.light.navy);
