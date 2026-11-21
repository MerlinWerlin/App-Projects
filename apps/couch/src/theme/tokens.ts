/**
 * App palette (light and dark) for screens that read useTheme(). Same values as the v2 roles in design.ts
 * (DESIGN.md, Nov 2026 overhaul); the prototype no longer sets the app's look.
 */
export interface Palette {
  bg: string;
  body: string;
  key: string;
  keyEdge: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  power: string;
  ok: string;
  warn: string;
}

export const light: Palette = {
  bg: '#ECEAE5',
  body: '#FBFAF8',
  key: '#FFFFFF',
  keyEdge: '#D6D2CA',
  ink: '#1A1917',
  muted: '#5C5850',
  accent: '#7E5518',
  accentSoft: '#F0E5D1',
  power: '#B0382C',
  ok: '#2C7A54',
  warn: '#8A5E10',
};

export const dark: Palette = {
  bg: '#0E0E0F',
  body: '#1C1C1B',
  key: '#292927',
  keyEdge: '#060606',
  ink: '#F4EEE3',
  muted: '#B3ACA0',
  accent: '#D2AB72',
  accentSoft: '#3A2E1C',
  power: '#FF8A7E',
  ok: '#6CC796',
  warn: '#E5B35A',
};

/** Font family names as registered with expo-font (see app/_layout.tsx). */
export const fonts = {
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  text: 'Manrope_400Regular',
  textSemi: 'Manrope_600SemiBold',
  textBold: 'Manrope_700Bold',
  mono: 'JetBrainsMono_400Regular',
} as const;

export const radius = { key: 14, panel: 16, remote: 28, tabs: 12, tab: 9 } as const;
export const space = { gutter: 16, gap: 14, rowGap: 18 } as const;
/** Minimum touch target (prototype .key min-height/min-width). */
export const minTarget = 48;

/**
 * Elevation tokens (premium polish rule 6). Use with the palette's keyEdge as shadowColor.
 * key: remote keys (crisp 2 px edge, as the prototype); card: TV/app cards; sheet: bottom sheets; hud: floating HUD/toasts.
 */
export const elevation = {
  key: { shadowOffset: { width: 0, height: 1.5 }, shadowOpacity: 0.55, shadowRadius: 1.5, elevation: 2 },
  card: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  sheet: { shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 12 },
  hud: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 16 },
} as const;

/** Tabular figures for any number that changes in place (volume, channel, counts, codes). */
export const tabular = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] } as const;

/** Sheet backdrop dim (rule 2): black at this opacity. */
export const backdropOpacity = 0.45;

/** Accepts any ColorSchemeName (newer RN versions may return 'unspecified'). */
export function palette(scheme: string | null | undefined): Palette {
  return scheme === 'dark' ? dark : light;
}
