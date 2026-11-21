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
  /** The record red for text and links: the first of rec / glow / labelForward that reads at 4.5:1 on cards, else ink. */
  recText: string;
  dark: boolean;
  skin: string;
  font: Skin['font'];
  radius: Skin['radius'];
  cardFinish: Skin['card'];
  /** Where the forwards ink (rec) and the backwards ink (rew) overprint: the "match" colour. */
  overprint: string;
  /** How the two inks combine when printed over each other: multiply on paper, screen on black stock. */
  blend: 'multiply' | 'screen';
  /** Light tints of each ink, for selected rows and quiet fills (a riso screen tint, never a gradient). */
  recTint: string;
  rewTint: string;
};

/**
 * The default look, "Print" (id stays 'booth' so saved settings carry over). Two spot inks on paper, the way a
 * risograph party flyer is printed: fluoro pink is your voice going forwards, blue is it played backwards, and where
 * the two overprint they make the deep violet "match" colour. Flat inks only: no gradients, no glow. See DESIGN.md.
 */
export const BOOTH: Skin = {
  id: 'booth',
  name: 'Print',
  vibe: 'Two inks on paper: pink for your voice, blue for it backwards.',
  font: { heading: 'BackspinDisplay', body: 'System', number: 'BackspinDisplay', headingWeight: '800', headingTracking: 0 },
  radius: { s: 8, m: 14, l: 20 },
  card: { borderWidth: 0, shadowOpacity: 0, shadowRadius: 0 },
  dark: {
    bg: '#131217', card: '#1D1B22', cardHi: '#27252D', ink: '#F3F1EB', sub: '#B4AFBD', faint: '#7E7987', line: '#34313B',
    rec: '#FF5FB1', recInk: '#131217', rew: '#7A97F0', rewInk: '#131217', gold: '#FF5FB1', good: '#4FD08A', bad: '#FF7A73',
    overlay: 'rgba(8,7,10,0.72)', bgGradient: ['#131217', '#131217'], recGradient: ['#FF5FB1', '#FF5FB1'], glow: '#FF5FB1',
    cardBorder: '#34313B', shadow: '#000000', discBody: '#F3F1EB', discGroove: '#131217', labelForward: '#FF5FB1', labelBack: '#7A97F0', score: '#F3F1EB',
  },
  light: {
    bg: '#F3F1EB', card: '#E8E5DC', cardHi: '#DDD9CD', ink: '#17151C', sub: '#55515E', faint: '#8A8693', line: '#D3CFC4',
    rec: '#FF4FA8', recInk: '#17151C', rew: '#3255A4', rewInk: '#FFFFFF', gold: '#D81F7F', good: '#0B6A3B', bad: '#C2272D',
    overlay: 'rgba(23,21,28,0.45)', bgGradient: ['#F3F1EB', '#F3F1EB'], recGradient: ['#FF4FA8', '#FF4FA8'], glow: '#FF4FA8',
    cardBorder: '#D3CFC4', shadow: '#17151C', discBody: '#17151C', discGroove: '#F3F1EB', labelForward: '#FF4FA8', labelBack: '#3255A4', score: '#17151C',
  },
};

export const SKINS: Skin[] = [BOOTH, ...GENERATED_SKINS];

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
/** WCAG contrast ratio of two #RRGGBB colours. */
export const contrastRatio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const mix = (a: string, b: string, t: number) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(a) || !/^#[0-9a-fA-F]{6}$/.test(b)) return a;
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
};

/** Two inks printed over each other: multiply on paper (light), screen on black stock (dark). */
export function overprint(a: string, b: string, dark: boolean): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(a) || !/^#[0-9a-fA-F]{6}$/.test(b)) return a;
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((sh) => {
    const p = ((x >> sh) & 255) / 255, q = ((y >> sh) & 255) / 255;
    return Math.round((dark ? 1 - (1 - p) * (1 - q) : p * q) * 255);
  });
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Record red that is readable as small text on bg, card and cardHi (the red fill itself is often only ~3.5:1). */
export function readableRec(p: Palette): string {
  const ok = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c) && [p.bg, p.card, p.cardHi].every((b) => contrastRatio(c, b) >= 4.5);
  // Last resorts before plain ink: the red nudged towards ink (darker in light mode, lighter in dark mode).
  return [p.rec, p.glow, p.labelForward, mix(p.rec, p.ink, 0.2), mix(p.rec, p.ink, 0.35), mix(p.rec, p.ink, 0.5)].find(ok) ?? p.ink;
}

export function makeTheme(skinId: string, dark: boolean): Theme {
  const s = SKINS.find((k) => k.id === skinId) ?? BOOTH;
  const p = dark ? s.dark : s.light;
  return {
    ...p, recText: readableRec(p), dark, skin: s.id, font: s.font, radius: s.radius, cardFinish: s.card,
    overprint: overprint(p.rec, p.rew, dark), blend: dark ? 'screen' : 'multiply',
    recTint: mix(p.rec, p.bg, dark ? 0.8 : 0.78), rewTint: mix(p.rew, p.bg, dark ? 0.8 : 0.82),
  };
}

export const DARK: Theme = makeTheme('booth', true);
export const LIGHT: Theme = makeTheme('booth', false);

/** React Native font family for a skin font name ('System' = the default San Francisco). */
export const fam = (f: string) => (f === 'System' ? undefined : f);

/** Corner radii: slips of paper are gently rounded; controls are pills. */
export const R = { s: 8, m: 14, l: 20, xl: 28, pill: 999 };
/** 4-point spacing grid. */
export const SP = (n: number) => n * 4;
/**
 * Type. Display sizes (hero, title, h, line, num) use the skin's heading face (Print: Backspin Display, a condensed
 * extra-bold grotesque); body sizes follow iOS text styles in the system face. Tracking tightens as size grows.
 */
export const TYPE = {
  hero: { fontSize: 40, fontWeight: '800' as const, lineHeight: 43, letterSpacing: -0.6 },
  title: { fontSize: 30, fontWeight: '800' as const, lineHeight: 32, letterSpacing: -0.3 },
  h: { fontSize: 22, fontWeight: '800' as const, lineHeight: 26, letterSpacing: -0.1 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  bodyB: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  small: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  line: { fontSize: 36, fontWeight: '800' as const, lineHeight: 39, letterSpacing: -0.4 },
  num: { fontSize: 104, fontWeight: '800' as const, lineHeight: 104, letterSpacing: -2, fontVariant: ['tabular-nums' as const] },
};
export const HEADING_KINDS = new Set<keyof typeof TYPE>(['hero', 'title', 'h', 'line']);

/** Motion tokens (ms). Press feedback is instant-feeling; nothing UI-level runs past 300 ms except the flip reveal. */
export const MOTION = { press: 120, quick: 180, base: 240, reveal: 420 };
