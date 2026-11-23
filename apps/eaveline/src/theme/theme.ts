/**
 * Eaveline look: site-signage contrast. Warm paper ground, near-black ink, hi-vis yellow answer panels
 * (black on yellow is the most legible pairing in direct sun), galvanised-steel greys for structure.
 * Fonts: Archivo Narrow (condensed, signage) for titles and big numbers; Atkinson Hyperlegible for everything you read.
 */
import { Platform, type TextStyle } from 'react-native';

export interface Theme {
  dark: boolean;
  ground: string;
  sheet: string;
  sheet2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string; // hi-vis yellow
  onAccent: string;
  steel: string;
  danger: string;
  ok: string;
  field: string;
  fieldLine: string;
}

export const LIGHT: Theme = {
  dark: false,
  ground: '#F4F1EA',
  sheet: '#FFFFFF',
  sheet2: '#E9E5DC',
  ink: '#121417',
  ink2: '#3D434B',
  ink3: '#636A73',
  line: '#D6D1C6',
  accent: '#FFD21F',
  onAccent: '#121417',
  steel: '#2F3A45',
  danger: '#B3261E',
  ok: '#1E6B3A',
  field: '#FFFFFF',
  fieldLine: '#8E949B',
};

export const DARK: Theme = {
  dark: true,
  ground: '#121417',
  sheet: '#1D2025',
  sheet2: '#272B31',
  ink: '#F4F1EA',
  ink2: '#C9CDD2',
  ink3: '#9BA2AA',
  line: '#363B42',
  accent: '#FFD21F',
  onAccent: '#121417',
  steel: '#AFC0CF',
  danger: '#FF8A80',
  ok: '#7CD69A',
  field: '#1D2025',
  fieldLine: '#5F666E',
};

/** Sunlight: maximum contrast for bright sites. Pure white, pure black, heavier lines. */
export const SUN: Theme = {
  ...LIGHT,
  ground: '#FFFFFF',
  sheet: '#FFFFFF',
  sheet2: '#F0F0F0',
  ink: '#000000',
  ink2: '#1A1A1A',
  ink3: '#333333',
  line: '#000000',
  fieldLine: '#000000',
};

export const FONT = {
  display: 'ArchivoNarrow_700Bold',
  displayMid: 'ArchivoNarrow_600SemiBold',
  body: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
};

export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, gutter: 20 };
export const RADIUS = { s: 10, m: 14, l: 20 };
/** Glove-friendly: 56 pt for primary controls, never under 48. */
export const TOUCH = { min: 48, big: 56, huge: 64 };

const t = (fontFamily: string, fontSize: number, lineHeight: number, extra: TextStyle = {}): TextStyle => ({ fontFamily, fontSize, lineHeight, ...extra });

export const TYPE = {
  hero: t(FONT.display, 56, 60, { letterSpacing: -0.5 }),
  display: t(FONT.display, 40, 44),
  title: t(FONT.display, 28, 32),
  title2: t(FONT.display, 22, 26),
  headline: t(FONT.bold, 17, 22),
  body: t(FONT.body, 17, 24),
  callout: t(FONT.body, 16, 22),
  subhead: t(FONT.body, 15, 20),
  footnote: t(FONT.body, 13, 18),
  label: t(FONT.displayMid, 14, 18, { letterSpacing: 0.6, textTransform: 'uppercase' }),
  mono: t(Platform.select({ ios: 'Menlo', default: 'monospace' })!, 15, 20),
};
