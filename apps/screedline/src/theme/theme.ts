/**
 * "Screed" design tokens: concrete greys, charcoal and one hi-vis amber. Big, high-contrast, glove-friendly.
 * Every colour has a light, dark and Sun (maximum contrast for direct sunlight) value. See DESIGN.md.
 */
export type Appearance = 'system' | 'light' | 'dark' | 'sun';
export type ThemeName = 'light' | 'dark' | 'sun';

export interface Theme {
  name: ThemeName;
  dark: boolean;
  ground: string; // screen background
  card: string;
  cardAlt: string;
  ink: string; // primary text
  ink2: string; // secondary text (≥ 4.5:1 on ground and card)
  line: string; // hairlines and field borders
  fieldLine: string;
  amber: string; // the one accent: primary buttons, focus, the screed line
  onAmber: string;
  slab: string; // result slab background (always dark)
  onSlab: string;
  onSlab2: string;
  danger: string;
  good: string;
  warn: string;
  borderWidth: number;
}

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    name: 'light', dark: false,
    ground: '#EEECE6', card: '#FFFFFF', cardAlt: '#F6F5F1',
    ink: '#15171A', ink2: '#4B4F56', line: '#D6D2C7', fieldLine: '#A9A498',
    amber: '#FFB300', onAmber: '#15171A',
    slab: '#15171A', onSlab: '#FFFFFF', onSlab2: '#C9C5BA',
    danger: '#B3261E', good: '#1E6B3A', warn: '#8A5A00',
    borderWidth: 1.5,
  },
  dark: {
    name: 'dark', dark: true,
    ground: '#0E1012', card: '#191C20', cardAlt: '#22262B',
    ink: '#F3F1EA', ink2: '#B7BBC2', line: '#2F343A', fieldLine: '#4A5058',
    amber: '#FFC233', onAmber: '#15171A',
    slab: '#000000', onSlab: '#FFFFFF', onSlab2: '#C9C5BA',
    danger: '#FF8A80', good: '#7FD69B', warn: '#FFC233',
    borderWidth: 1.5,
  },
  sun: {
    name: 'sun', dark: false,
    ground: '#FFFFFF', card: '#FFFFFF', cardAlt: '#F2F2F2',
    ink: '#000000', ink2: '#1F1F1F', line: '#000000', fieldLine: '#000000',
    amber: '#FFB300', onAmber: '#000000',
    slab: '#000000', onSlab: '#FFFFFF', onSlab2: '#FFFFFF',
    danger: '#9E0000', good: '#005A1F', warn: '#6B4500',
    borderWidth: 2.5,
  },
};

export function resolveTheme(appearance: Appearance, system: 'light' | 'dark' | null | undefined): Theme {
  if (appearance === 'system') return THEMES[system === 'dark' ? 'dark' : 'light'];
  return THEMES[appearance];
}

export const FONT = {
  body: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  num: 'BarlowCondensed_600SemiBold',
  numBold: 'BarlowCondensed_700Bold',
} as const;

export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { s: 8, m: 14, l: 20 } as const;
/** Glove-friendly minimum target. Apple's minimum is 44 pt; gloves need more. */
export const TARGET = 56;
export const MOTION = { fast: 120, base: 200 } as const;
