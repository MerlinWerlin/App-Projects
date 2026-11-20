/**
 * Cue design tokens: "Running order" (2026-11-21). The single source for colour, type, spacing, radius and
 * motion. Read apps/cue/DESIGN.md before changing anything here.
 *
 * - The script (titles, body, preview, prompter) is set in Atkinson Hyperlegible; everything that operates
 *   the app is set in the system face (San Francisco), so it follows Dynamic Type.
 * - Three working colours, from the stage cue light: go (green) for the primary action and "listening",
 *   standby (amber) for paused / waiting, on air (red) for recording only. Everything else is neutral.
 * - Flat: no shadows, no gradients. Depth comes from grouping, hairline rules and the system bar material.
 */
import type { TextStyle } from 'react-native';
import type { PrompterColors } from '../core/prefs';

export const FONT = {
  /** Script face (Atkinson Hyperlegible): built for reading at a distance. */
  script: 'AtkinsonHyperlegible_400Regular',
  scriptBold: 'AtkinsonHyperlegible_700Bold',
} as const;

export interface Theme {
  dark: boolean;
  /** Screen ground. */
  ground: string;
  /** Grouped rows, bars, the editor sheet. */
  sheet: string;
  /** Inputs, segmented track, plain buttons, chips. */
  field: string;
  /** Pressed row / chip. */
  pressed: string;
  ink: string;
  /** Secondary text. */
  ink2: string;
  /** Faintest text allowed (captions, placeholders): 4.5:1 on ground, sheet and field. */
  ink3: string;
  /** Hairline rules and separators. */
  rule: string;
  /** Go: primary fill, switch track, selection, navigation tint. */
  go: string;
  /** Go as text or an icon on ground / sheet. */
  goText: string;
  /** Label colour on a go fill. */
  onGo: string;
  /** Standby: paused, waiting, countdown. Text-safe on ground and sheet. */
  standby: string;
  /** On air: recording only (and the iOS destructive role). */
  onAir: string;
  /** Error and destructive text. */
  danger: string;
  material: 'light' | 'dark';
}

export const LIGHT: Theme = {
  dark: false,
  ground: '#F2F2EF',
  sheet: '#FFFFFF',
  field: '#E7E7E3',
  pressed: '#E2E2DD',
  ink: '#141414',
  ink2: '#55554F',
  ink3: '#63635C',
  rule: '#D9D9D3',
  go: '#17804A',
  goText: '#136B3E',
  onGo: '#FFFFFF',
  standby: '#955600',
  onAir: '#E5383B',
  danger: '#C42B2E',
  material: 'light',
};

export const DARK: Theme = {
  dark: true,
  ground: '#0C0C0C',
  sheet: '#18181A',
  field: '#242427',
  pressed: '#2A2A2D',
  ink: '#F2F2EE',
  ink2: '#A9A9A3',
  ink3: '#8E8E88',
  rule: '#2C2C2F',
  go: '#3CCB7F',
  goText: '#4ED18B',
  onGo: '#07140C',
  standby: '#F2B544',
  onAir: '#E5383B',
  danger: '#FF6961',
  material: 'dark',
};

/**
 * Prompter and camera chrome. These screens are always dark (the words sit on black or on the camera),
 * so their chrome has one fixed palette in both appearances.
 */
export const STAGE = {
  ink: '#F2F2EE',
  ink2: '#B4B4AE',
  dim: '#77777A',
  go: '#3CCB7F',
  onGo: '#07140C',
  standby: '#F2B544',
  onAir: '#E5383B',
  /** Active toggle (mirror, flip): a white fill with a dark glyph. */
  activeFill: '#F2F2EE',
  activeInk: '#0C0C0C',
  /** RGB of the script box behind the words on the camera screen (alpha comes from the user's setting). */
  scrim: '7,7,8',
  hairline: 'rgba(255,255,255,0.10)',
} as const;

export interface PrompterPalette {
  bg: string;
  ink: string;
  emph: string;
  dim: string;
  cue: string;
  /** Reading-line band: a flat fill with hard edges. */
  band: string;
}

export const PROMPTER: Record<PrompterColors, PrompterPalette> = {
  classic: { bg: '#080808', ink: '#F4F2EC', emph: '#FFE3A3', dim: '#77777A', cue: '#F2B544', band: 'rgba(255,255,255,0.075)' },
  paper: { bg: '#F6F6F2', ink: '#141414', emph: '#7A4500', dim: '#8A8A84', cue: '#955600', band: 'rgba(20,20,20,0.06)' },
  night: { bg: '#000000', ink: '#FF5A47', emph: '#FFB3A8', dim: '#6E2620', cue: '#FFB3A8', band: 'rgba(255,90,71,0.10)' },
  contrast: { bg: '#000000', ink: '#FFFF00', emph: '#FFFFFF', dim: '#B3B300', cue: '#00FFFF', band: 'rgba(255,255,0,0.12)' },
};

/** Radius: controls and grouped lists 12, chips 8, round only for the play button, shutter and icon buttons. */
export const RADIUS = { control: 12, group: 12, field: 10, chip: 8, dock: 24, round: 999 } as const;

/** 4 pt spacing scale. `gutter` is the screen edge; `touch` the minimum target. */
export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, gutter: 16, touch: 44 } as const;

/** Motion: short and ease-out; under Reduce Motion only opacity changes. */
export const MOTION = { press: 0.97, in: 180, out: 240 } as const;

type TypeKey =
  | 'largeTitle'
  | 'scriptTitle'
  | 'scriptHeading'
  | 'scriptBody'
  | 'headline'
  | 'body'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'time'
  | 'timeLarge';

/**
 * Type scale. `script*` and `largeTitle` use Atkinson; the rest leave fontFamily unset so iOS uses
 * San Francisco and scales it with Dynamic Type.
 */
export const TYPE: Record<TypeKey, TextStyle> = {
  largeTitle: { fontFamily: FONT.scriptBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.3 },
  scriptTitle: { fontFamily: FONT.scriptBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.2 },
  scriptHeading: { fontFamily: FONT.scriptBold, fontSize: 17, lineHeight: 22 },
  scriptBody: { fontFamily: FONT.script, fontSize: 19, lineHeight: 29 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22 },
  subhead: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  time: { fontSize: 17, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  timeLarge: { fontSize: 28, lineHeight: 32, fontWeight: '600', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
};
