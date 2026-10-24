/** Design tokens. App chrome follows light/dark; the prompter has its own high-legibility colour sets. */
import type { PrompterColors } from '../core/prefs';

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  ink: string;
  sub: string;
  line: string;
  accent: string;
  accentInk: string;
  danger: string;
  chip: string;
}

export const LIGHT: Theme = {
  dark: false,
  bg: '#F6F4EF',
  card: '#FFFFFF',
  ink: '#1A1A1C',
  sub: '#6B6A70',
  line: '#E3E0D8',
  accent: '#E8552B',
  accentInk: '#FFFFFF',
  danger: '#C62E2E',
  chip: '#EFECE5',
};

export const DARK: Theme = {
  dark: true,
  bg: '#0F0F11',
  card: '#1B1B1F',
  ink: '#F3F2EE',
  sub: '#9C9AA3',
  line: '#2C2C31',
  accent: '#FF6A3D',
  accentInk: '#140A06',
  danger: '#FF5A5A',
  chip: '#26262B',
};

export interface PrompterPalette {
  bg: string;
  ink: string;
  emph: string;
  dim: string;
  cue: string;
  band: string;
}

export const PROMPTER: Record<PrompterColors, PrompterPalette> = {
  classic: { bg: '#000000', ink: '#FFFFFF', emph: '#FFB347', dim: '#7A7A80', cue: '#FF6A3D', band: 'rgba(255,255,255,0.08)' },
  paper: { bg: '#F4EFE4', ink: '#1C1A17', emph: '#B5401C', dim: '#8C857A', cue: '#B5401C', band: 'rgba(0,0,0,0.06)' },
  night: { bg: '#000000', ink: '#FF4B3A', emph: '#FFB0A6', dim: '#6E2620', cue: '#FFB0A6', band: 'rgba(255,75,58,0.10)' },
  contrast: { bg: '#000000', ink: '#FFFF00', emph: '#FFFFFF', dim: '#B3B300', cue: '#00FFFF', band: 'rgba(255,255,0,0.12)' },
};

export const RADIUS = 14;
export const SPACE = 16;
