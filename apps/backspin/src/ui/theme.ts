// Backspin looks ("skins"). Same layout, different finish: colours, fonts, corner radii, card finish,
// gradients, glow and the vinyl disc. "Booth" is the original; the others were designed by StarNet
// (gpt-6.1-sol / gpt-6-luna, ops/luna/skins_*.txt), checked for contrast by skins.test.ts.
import { GENERATED_SKINS } from './skins.ts';

export type Palette = {
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
  bgGradient: string[];
  recGradient: string[];
  glow: string;
  cardBorder: string;
  shadow: string;
  discBody: string;
  discGroove: string;
  labelForward: string;
  labelBack: string;
  score: string;
};

export type Skin = {
  id: string;
  name: string;
  vibe: string;
  font: { heading: string; body: string; number: string; headingWeight: '600' | '700' | '800' | '900'; headingTracking: number };
  radius: { s: number; m: number; l: number };
  card: { borderWidth: number; shadowOpacity: number; shadowRadius: number };
  dark: Palette;
  light: Palette;
};

export type Theme = Palette & {
  dark: boolean;
  skin: string;
  font: Skin['font'];
  radius: Skin['radius'];
  cardFinish: Skin['card'];
};

export const BOOTH: Skin = {
  id: 'booth',
  name: 'Booth',
  vibe: 'The original late-night record booth.',
  font: { heading: 'System', body: 'System', number: 'System', headingWeight: '800', headingTracking: -0.4 },
  radius: { s: 10, m: 16, l: 24 },
  card: { borderWidth: 0.5, shadowOpacity: 0, shadowRadius: 0 },
  dark: {
    bg: '#14111F', card: '#1F1B2E', cardHi: '#2A2540', ink: '#F6F1FF', sub: '#B8AFD0', faint: '#7D7499', line: '#352F4D',
    rec: '#D63A2F', recInk: '#FFFFFF', rew: '#2FD6C2', rewInk: '#06201D', gold: '#FFC94A', good: '#5BE38B', bad: '#FF8A80',
    overlay: 'rgba(8,6,14,0.72)', bgGradient: ['#14111F', '#14111F'], recGradient: ['#E5483C', '#C8321F'], glow: '#FF5A4E',
    cardBorder: '#352F4D', shadow: '#000000', discBody: '#0B0912', discGroove: '#26213A', labelForward: '#FF5A4E', labelBack: '#2FD6C2', score: '#FFC94A',
  },
  light: {
    bg: '#FBF7F2', card: '#FFFFFF', cardHi: '#F2ECF8', ink: '#1A1726', sub: '#5A5370', faint: '#8C85A0', line: '#E6DFEE',
    rec: '#CC3A2A', recInk: '#FFFFFF', rew: '#0B7A6F', rewInk: '#FFFFFF', gold: '#B07A00', good: '#1E8E4E', bad: '#C62828',
    overlay: 'rgba(20,17,31,0.45)', bgGradient: ['#FBF7F2', '#FBF7F2'], recGradient: ['#D63A2F', '#BA2F1E'], glow: '#E8402F',
    cardBorder: '#E6DFEE', shadow: '#1A1726', discBody: '#211C30', discGroove: '#3A3350', labelForward: '#E8402F', labelBack: '#0E8C7F', score: '#B07A00',
  },
};

export const SKINS: Skin[] = [BOOTH, ...GENERATED_SKINS];

export function makeTheme(skinId: string, dark: boolean): Theme {
  const s = SKINS.find((k) => k.id === skinId) ?? BOOTH;
  return { ...(dark ? s.dark : s.light), dark, skin: s.id, font: s.font, radius: s.radius, cardFinish: s.card };
}

export const DARK: Theme = makeTheme('booth', true);
export const LIGHT: Theme = makeTheme('booth', false);

/** React Native font family for a skin font name ('System' = the default San Francisco). */
export const fam = (f: string) => (f === 'System' ? undefined : f);

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
export const HEADING_KINDS = new Set<keyof typeof TYPE>(['hero', 'title', 'h', 'line']);
