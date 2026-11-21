/**
 * Cue design tokens: "Signal" (2026-11-21). The single source for colour, type, spacing, radius and motion.
 * Read apps/cue/DESIGN.md before changing anything here.
 *
 * - Built like airport wayfinding: yellow means "your eyes go here next" and nothing else. It paints the
 *   reading line, the next script, and the one action that moves you forward. Everything else is black,
 *   white and grey.
 * - One humanist face, Atkinson Hyperlegible, for everything, set big. Read times are set like gate numbers.
 * - Full-width bands, square-ish corners, no shadows and no gradients.
 */
import type { TextStyle } from 'react-native';
import type { PrompterColors } from '../core/prefs';

export const FONT = {
  script: 'AtkinsonHyperlegible_400Regular',
  scriptBold: 'AtkinsonHyperlegible_700Bold',
} as const;

/** The sign colour. Same in both appearances; text on it is always SIGN_INK. */
export const SIGN = '#FFCC00';
export const SIGN_INK = '#0A0A0A';

export interface Theme {
  dark: boolean;
  /** Screen ground. */
  ground: string;
  /** Grouped rows and panels. */
  sheet: string;
  /** Inputs, plain buttons, chips, segmented track. */
  field: string;
  /** Pressed row / chip. */
  pressed: string;
  ink: string;
  ink2: string;
  /** Faintest text allowed: 4.5:1 on ground, sheet and field. */
  ink3: string;
  rule: string;
  /** Sign yellow fill (bands, the forward action, switch tracks). */
  sign: string;
  /** Sign yellow as text or a glyph on the ground (darkened in light mode for contrast). */
  signText: string;
  /** Text and glyphs on a sign fill. */
  onSign: string;
  /** Solid "ink" button: the strongest neutral fill (white in dark, black in light). */
  inkFill: string;
  onInkFill: string;
  /** Recording only (and the iOS destructive role). */
  onAir: string;
  danger: string;
  material: 'light' | 'dark';
}

export const LIGHT: Theme = {
  dark: false,
  ground: '#EDEDE9',
  sheet: '#FFFFFF',
  field: '#E0E0DB',
  pressed: '#D8D8D2',
  ink: '#0A0A0A',
  ink2: '#4C4C47',
  ink3: '#5F5F59',
  rule: '#D3D3CD',
  sign: SIGN,
  signText: '#6B5000',
  onSign: SIGN_INK,
  inkFill: '#0A0A0A',
  onInkFill: '#FFFFFF',
  onAir: '#E5383B',
  danger: '#C42B2E',
  material: 'light',
};

export const DARK: Theme = {
  dark: true,
  ground: '#0A0A0A',
  sheet: '#161616',
  field: '#232323',
  pressed: '#2C2C2C',
  ink: '#F5F5F0',
  ink2: '#ABABA5',
  ink3: '#8E8E88',
  rule: '#2A2A2A',
  sign: SIGN,
  signText: SIGN,
  onSign: SIGN_INK,
  inkFill: '#F5F5F0',
  onInkFill: '#0A0A0A',
  onAir: '#E5383B',
  danger: '#FF6961',
  material: 'dark',
};

/** Prompter and camera chrome: always dark, one palette in both appearances. */
export const STAGE = {
  ground: '#0A0A0A',
  panel: '#151515',
  ink: '#F5F5F0',
  ink2: '#B4B4AE',
  dim: '#6E6E6A',
  sign: SIGN,
  onSign: SIGN_INK,
  onAir: '#E5383B',
  /** RGB of the script box behind the words on the camera screen (alpha comes from the user's setting). */
  scrim: '7,7,8',
  hairline: 'rgba(255,255,255,0.12)',
} as const;

export interface PrompterPalette {
  bg: string;
  ink: string;
  emph: string;
  dim: string;
  /** Section names, pause marks and the reading-line arrows. */
  cue: string;
  /** Reading-line band: a flat fill with hard edges. */
  band: string;
}

export const PROMPTER: Record<PrompterColors, PrompterPalette> = {
  classic: { bg: '#0A0A0A', ink: '#F5F3EC', emph: '#FFE27A', dim: '#77777A', cue: SIGN, band: 'rgba(255,204,0,0.10)' },
  paper: { bg: '#F6F6F2', ink: '#0A0A0A', emph: '#6B5000', dim: '#8A8A84', cue: '#6B5000', band: 'rgba(255,204,0,0.28)' },
  night: { bg: '#000000', ink: '#FF5A47', emph: '#FFB3A8', dim: '#6E2620', cue: '#FFB3A8', band: 'rgba(255,90,71,0.10)' },
  contrast: { bg: '#000000', ink: '#FFFF00', emph: '#FFFFFF', dim: '#B3B300', cue: '#00FFFF', band: 'rgba(255,255,0,0.12)' },
};

/** Signage corners: small and square-ish. Round only for the shutter and the recording dot. */
export const RADIUS = { panel: 6, control: 6, chip: 4, round: 999 } as const;

/** 4 pt spacing scale. `gutter` is the screen edge; `touch` the minimum target. */
export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, gutter: 20, touch: 44 } as const;

/** Motion: short ease-out; under Reduce Motion only opacity changes (or nothing). */
export const MOTION = { press: 0.97, in: 180, out: 240, flap: 220 } as const;

type TypeKey =
  | 'monument'
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'scriptBody'
  | 'time'
  | 'timeLarge';

/** One face throughout. Sizes scale with Dynamic Type; dense chrome caps its multiplier at the call site. */
export const TYPE: Record<TypeKey, TextStyle> = {
  /** Read times set like gate numbers. */
  monument: { fontFamily: FONT.scriptBold, fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
  display: { fontFamily: FONT.scriptBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: FONT.scriptBold, fontSize: 26, lineHeight: 31, letterSpacing: -0.3 },
  headline: { fontFamily: FONT.scriptBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: FONT.script, fontSize: 17, lineHeight: 23 },
  subhead: { fontFamily: FONT.script, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: FONT.script, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONT.script, fontSize: 12, lineHeight: 16 },
  scriptBody: { fontFamily: FONT.script, fontSize: 20, lineHeight: 30 },
  time: { fontFamily: FONT.scriptBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  timeLarge: { fontFamily: FONT.scriptBold, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
};
