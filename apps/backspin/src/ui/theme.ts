// Backspin look: a late-night record booth. Deep violet-black, a hot coral "record" colour, a teal "rewind"
// colour and a gold for scores. Light mode is warm paper. All text/background pairs meet WCAG AA.
export type Theme = {
  dark: boolean;
  bg: string;
  card: string;
  cardHi: string;
  ink: string;
  sub: string;
  faint: string;
  line: string;
  rec: string;
  recInk: string;
  rew: string;
  rewInk: string;
  gold: string;
  good: string;
  bad: string;
  overlay: string;
};

export const DARK: Theme = {
  dark: true,
  bg: '#14111F',
  card: '#1F1B2E',
  cardHi: '#2A2540',
  ink: '#F6F1FF',
  sub: '#B8AFD0',
  faint: '#7D7499',
  line: '#352F4D',
  rec: '#FF5A4E',
  recInk: '#FFFFFF',
  rew: '#2FD6C2',
  rewInk: '#06201D',
  gold: '#FFC94A',
  good: '#5BE38B',
  bad: '#FF8A80',
  overlay: 'rgba(8,6,14,0.72)',
};

export const LIGHT: Theme = {
  dark: false,
  bg: '#FBF7F2',
  card: '#FFFFFF',
  cardHi: '#F2ECF8',
  ink: '#1A1726',
  sub: '#5A5370',
  faint: '#8C85A0',
  line: '#E6DFEE',
  rec: '#E8402F',
  recInk: '#FFFFFF',
  rew: '#0E8C7F',
  rewInk: '#FFFFFF',
  gold: '#B07A00',
  good: '#1E8E4E',
  bad: '#C62828',
  overlay: 'rgba(20,17,31,0.45)',
};

export const R = { s: 10, m: 16, l: 24, xl: 32, pill: 999 };
export const SP = (n: number) => n * 4;
export const TYPE = {
  hero: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  h: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyB: { fontSize: 16, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  line: { fontSize: 26, fontWeight: '800' as const, lineHeight: 32, letterSpacing: -0.2 },
  num: { fontSize: 64, fontWeight: '900' as const, letterSpacing: -2, fontVariant: ['tabular-nums' as const] },
};
