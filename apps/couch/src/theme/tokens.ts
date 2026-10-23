/**
 * Design tokens copied from prototype/index.html :root (light) and the dark override.
 * Keep in sync with the prototype; it is the source of truth for look and copy.
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
  bg: '#E4E8EC',
  body: '#F6F7F9',
  key: '#FFFFFF',
  keyEdge: '#CDD3DA',
  ink: '#1C232B',
  muted: '#5D6873',
  accent: '#2F5BD3',
  accentSoft: '#E3EAFB',
  power: '#C43D3D',
  ok: '#2C7A54',
  warn: '#9B6A12',
};

export const dark: Palette = {
  bg: '#0E1115',
  body: '#171B21',
  key: '#222831',
  keyEdge: '#0A0C0F',
  ink: '#E6EAEF',
  muted: '#98A3AF',
  accent: '#86A6FF',
  accentSoft: '#1E2A47',
  power: '#FF7A72',
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
  key: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 2 },
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
