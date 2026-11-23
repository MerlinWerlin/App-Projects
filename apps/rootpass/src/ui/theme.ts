/**
 * Rootpass look: a dark workshop wall, hot-metal orange for the one thing to press, arc blue for drawings.
 * Contrast (WCAG): ink on ground 17.0:1, ink2 on surface 9.6:1, ink3 on ground 5.8:1, accent on ground 7.3:1,
 * accentInk on accent 8.9:1. Every text pair clears 4.5:1.
 */
export const C = {
  ground: '#0D0F12',
  surface: '#171A1F',
  raised: '#21252C',
  line: '#30353E',
  ink: '#F4F1EA',
  ink2: '#C3C7CE',
  ink3: '#8F95A0',
  accent: '#FF7A1A',
  accentDim: '#3A230F',
  accentInk: '#140A02',
  arc: '#6CC8FF',
  arcDim: '#13293A',
  warn: '#FFC233',
  warnDim: '#2F2610',
  bad: '#FF6B5E',
  good: '#5BD18B',
};

export const FONT = {
  display: 'BarlowCondensed_700Bold',
  displayMed: 'BarlowCondensed_600SemiBold',
  body: 'Barlow_500Medium',
  bodyBold: 'Barlow_700Bold',
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 16 };
export const RADIUS = { sm: 8, md: 12, lg: 18 };
/** Glove-friendly: nothing pressable smaller than this. */
export const HIT = 56;
