/**
 * Cue design tokens ("Studio" look, 2026-10-24).
 * Stage ink and velvet in the dark, cool studio grey in the light, one brass accent (stage hardware).
 * Tally red is reserved for "recording". Titles: Bricolage Grotesque. Body and prompter text:
 * Atkinson Hyperlegible (built for legibility at a distance, which is the job of a teleprompter).
 */
import type { TextStyle, ViewStyle } from 'react-native';
import type { PrompterColors } from '../core/prefs';

export const FONT = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
} as const;

export interface Theme {
  dark: boolean;
  bg: string;
  /** Raised surfaces (cards, grouped lists). */
  card: string;
  /** Second-level surfaces (fields, chips, segmented track). */
  chip: string;
  ink: string;
  sub: string;
  faint: string;
  line: string;
  /** Brass: the one accent. */
  accent: string;
  /** Text/icons drawn on a brass fill. */
  accentInk: string;
  /** Brass used as text on the background (meets contrast in both modes). */
  accentText: string;
  /** Soft brass wash for selected states. */
  accentWash: string;
  tally: string;
  danger: string;
  shadow: ViewStyle;
  blurTint: 'light' | 'dark';
}

export const LIGHT: Theme = {
  dark: false,
  bg: '#ECEEF2',
  card: '#FFFFFF',
  chip: '#E1E4EA',
  ink: '#151A26',
  sub: '#5B6273',
  faint: '#8C93A3',
  line: '#D6DAE2',
  accent: '#C9973F',
  accentInk: '#1A1408',
  accentText: '#8A5F1C',
  accentWash: 'rgba(201,151,63,0.14)',
  tally: '#E2463B',
  danger: '#C2362C',
  shadow: { shadowColor: '#1B2236', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  blurTint: 'light',
};

export const DARK: Theme = {
  dark: true,
  bg: '#10131C',
  card: '#1A1F2D',
  chip: '#242A3A',
  ink: '#F1EEE6',
  sub: '#A3A8B6',
  faint: '#6E7486',
  line: '#2A3042',
  accent: '#C9973F',
  accentInk: '#1A1408',
  accentText: '#D9AD5E',
  accentWash: 'rgba(201,151,63,0.16)',
  tally: '#E2463B',
  danger: '#FF6B5E',
  shadow: { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  blurTint: 'dark',
};

export interface PrompterPalette {
  bg: string;
  ink: string;
  emph: string;
  dim: string;
  cue: string;
  /** Reading-line band colour (drawn as a soft glow). */
  band: string;
}

export const PROMPTER: Record<PrompterColors, PrompterPalette> = {
  classic: { bg: '#07080C', ink: '#F4F1EA', emph: '#E7BC6A', dim: '#6F7586', cue: '#D9AD5E', band: 'rgba(201,151,63,0.13)' },
  paper: { bg: '#F2F0EB', ink: '#151A26', emph: '#8A5F1C', dim: '#8C93A3', cue: '#8A5F1C', band: 'rgba(138,95,28,0.10)' },
  night: { bg: '#000000', ink: '#FF5A47', emph: '#FFB3A8', dim: '#6E2620', cue: '#FFB3A8', band: 'rgba(255,90,71,0.10)' },
  contrast: { bg: '#000000', ink: '#FFFF00', emph: '#FFFFFF', dim: '#B3B300', cue: '#00FFFF', band: 'rgba(255,255,0,0.12)' },
};

/** Radius hierarchy: sheets/cards are soft, controls are pill-shaped, chips are tight. */
export const RADIUS = { card: 22, control: 16, chip: 12, pill: 999 } as const;
export const SPACE = 16;

export const TYPE: Record<'largeTitle' | 'title' | 'headline' | 'body' | 'callout' | 'caption' | 'numeral', TextStyle> = {
  largeTitle: { fontFamily: FONT.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: FONT.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  headline: { fontFamily: FONT.displaySemi, fontSize: 18, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 16 },
  numeral: { fontFamily: FONT.display, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
};
