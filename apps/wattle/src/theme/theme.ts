/**
 * Wattle design tokens. Hi-vis job-site look: wattle gold on switchboard black, with a Sunlight mode
 * (pure white, black ink, heavy borders) for reading outside. Text contrast ≥ 4.5:1 in every mode;
 * big numbers and controls are sized for gloves (≥ 56 pt targets).
 */
export type ThemeName = 'dark' | 'light' | 'sunlight';

export interface Theme {
  name: ThemeName;
  dark: boolean;
  ground: string;
  card: string;
  card2: string;
  line: string;
  /** Border width for cards and fields. Sunlight uses a heavier rule. */
  rule: number;
  ink: string;
  ink2: string;
  accent: string;
  onAccent: string;
  /** Accent colour safe for text on `ground`. */
  accentText: string;
  pass: string;
  fail: string;
  warn: string;
  field: string;
  tabBar: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark', dark: true,
    ground: '#0E0F12', card: '#17191E', card2: '#20232A', line: '#2D3139', rule: 1,
    ink: '#F4F1EA', ink2: '#A9ADB5', accent: '#FFC21A', onAccent: '#15120A', accentText: '#FFC94A',
    pass: '#3DD68C', fail: '#FF6B5E', warn: '#FFB547', field: '#0B0C0F', tabBar: '#121318',
  },
  light: {
    name: 'light', dark: false,
    ground: '#F2F0EA', card: '#FFFFFF', card2: '#ECE9E1', line: '#D7D3C8', rule: 1,
    ink: '#111215', ink2: '#4C515A', accent: '#FFC21A', onAccent: '#15120A', accentText: '#7A5200',
    pass: '#0B7A3E', fail: '#B8261A', warn: '#8A5300', field: '#FAF9F6', tabBar: '#FFFFFF',
  },
  sunlight: {
    name: 'sunlight', dark: false,
    ground: '#FFFFFF', card: '#FFFFFF', card2: '#F1F1F1', line: '#000000', rule: 2,
    ink: '#000000', ink2: '#1F1F1F', accent: '#FFD000', onAccent: '#000000', accentText: '#000000',
    pass: '#00662F', fail: '#A30F00', warn: '#6B3F00', field: '#FFFFFF', tabBar: '#FFFFFF',
  },
};

/** Australian conductor colours (AS/NZS 3000): active, neutral, earth. Used as the brand stripe. */
export const PHASE = { active: '#9A5B2E', neutral: '#2B6FD6', earth: '#2E9E4F', earthStripe: '#F2C200' };

export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 };
export const RADIUS = { sm: 10, md: 16, lg: 22, pill: 999 };
export const TARGET = 56;

export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '500' as const },
  subhead: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  /** Big answer numbers. */
  answer: { fontSize: 46, fontWeight: '800' as const, letterSpacing: -1, fontVariant: ['tabular-nums' as const] },
  answerSm: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, fontVariant: ['tabular-nums' as const] },
  input: { fontSize: 28, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
};
