// Liquidline design tokens. The look borrows the manifold gauge set every tech carries: BLUE is always the low side
// (suction, superheat, evaporator) and RED always the high side (liquid, subcooling, condenser). Amber is reserved for
// safety notes. Big condensed numerals read like a digital gauge at arm's length; everything else is the system font.
// Light and dark values for every colour; contrast is checked in contrast.test.ts (WCAG AA, 4.5:1 for text).
export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  text: string;
  text2: string;
  text3: string;
  low: string;
  lowSoft: string;
  onLow: string;
  high: string;
  highSoft: string;
  onHigh: string;
  accent: string;
  onAccent: string;
  warn: string;
  warnSoft: string;
  onWarnSoft: string;
  ok: string;
  okSoft: string;
};

export const LIGHT: Palette = {
  bg: '#F2F1EC',
  surface: '#FFFFFF',
  surface2: '#E8E7E1',
  line: '#D5D3CB',
  text: '#15181C',
  text2: '#4A5058',
  text3: '#646A72',
  low: '#1559C9',
  lowSoft: '#DCE7FB',
  onLow: '#FFFFFF',
  high: '#B52419',
  highSoft: '#F9DEDA',
  onHigh: '#FFFFFF',
  accent: '#15181C',
  onAccent: '#FFFFFF',
  warn: '#8A5A00',
  warnSoft: '#FFF1CC',
  onWarnSoft: '#5C3C00',
  ok: '#17703A',
  okSoft: '#D8F0E0',
};

export const DARK: Palette = {
  bg: '#0E1013',
  surface: '#181B20',
  surface2: '#22262C',
  line: '#30353D',
  text: '#F2F3F5',
  text2: '#B5BBC4',
  text3: '#9199A3',
  low: '#5B9BFF',
  lowSoft: '#16294A',
  onLow: '#06101F',
  high: '#FF6B5E',
  highSoft: '#4A1A16',
  onHigh: '#1F0603',
  accent: '#F2F3F5',
  onAccent: '#0E1013',
  warn: '#FFC547',
  warnSoft: '#3A2C0A',
  onWarnSoft: '#FFE3A1',
  ok: '#5FD68B',
  okSoft: '#12301E',
};
