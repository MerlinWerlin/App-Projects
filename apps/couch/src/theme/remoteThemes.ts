/**
 * Remote themes (owner-1017 T1/T2). Pure TypeScript, no React Native, so the same tokens drive the
 * app, tests, the prototype mirror (prototype/index.html) and the store screenshot kit.
 *
 * A RemoteTheme is a superset of the app Palette, so remote components swap useTheme() for
 * useRemoteTheme() without other changes. Themes change colours, texture, glow, corner radius and
 * press feel ONLY: never what a button does, never which controls show, never the d-pad geometry
 * (that is src/core/dpadGeometry.ts, shared by every theme).
 *
 * Textures are generated (gradients / SVG noise / stripes), never photos or anyone else's artwork.
 * Free: Charcoal & Gold (default since 24 Oct 2026: matches the app icon and opening animation), Midnight,
 * Daylight, OLED Black. The rest are Couch Plus (one-time purchase), each
 * with a "Try it" preview that works without buying. Every TV control stays free in every theme.
 */
import type { Palette } from './tokens';

export const REMOTE_THEME_IDS = [
  'charcoal',
  'midnight',
  'daylight',
  'oled',
  'cinema',
  'aluminium',
  'retro',
  'walnut',
  'neon',
  'candy',
  'forest',
  'aurora',
] as const;
export type RemoteThemeId = (typeof REMOTE_THEME_IDS)[number];

export const DEFAULT_REMOTE_THEME: RemoteThemeId = 'charcoal';
export const FREE_REMOTE_THEMES: readonly RemoteThemeId[] = ['charcoal', 'midnight', 'daylight', 'oled'];

/** How a key press feels: haptic weight and how far the key dips. */
export type PressStyle = 'soft' | 'firm' | 'click';
export const PRESS_SCALE: Record<PressStyle, number> = { soft: 0.97, firm: 0.95, click: 0.93 };

export type TextureKind = 'none' | 'glass' | 'paper' | 'velvet' | 'brushed' | 'woodgrain' | 'neon' | 'candy' | 'brass' | 'aurora';

export interface RemoteTexture {
  kind: TextureKind;
  /** Colours the generator blends (gradient stops / stripe colours). */
  colors: readonly string[];
  /** Overlay strength 0..1 (kept low so labels keep their contrast). */
  opacity: number;
  /** Animated (Aurora): drifts slowly, paused when idle, still under Reduce Motion. */
  animated?: boolean;
}

export interface RemoteTheme extends Palette {
  id: RemoteThemeId;
  /** i18n key of the theme's name, e.g. ui.themes.name.midnight. */
  nameKey: `ui.themes.name.${RemoteThemeId}`;
  tier: 'free' | 'plus';
  /** Status bar / system UI style on the remote. */
  scheme: 'light' | 'dark';
  /** Backdrop behind the remote card (the "stage"). */
  stage: string;
  /** Text and icons drawn on the accent colour (OK key label, selected segment). */
  accentInk: string;
  /** D-pad pad face and lit inner-ring arc. */
  ring: string;
  ringLit: string;
  /** Arrows on the d-pad face when it differs from `muted` (a light metal pad needs dark arrows). */
  ringInk?: string;
  /** Cinema glow colour behind the remote, or null for none. */
  glow: string | null;
  press: PressStyle;
  /** Corner radius of rectangular keys (pt). Round keys stay round. */
  radius: number;
  /** Optional generated texture on the remote card. */
  texture: RemoteTexture;
}

/** Status colours on light remote bodies (and Retro Wood's cream body): AA as text on the body. */
const base = { ok: '#23633F', warn: '#7A520A' };
const darkStatus = { ok: '#6CC796', warn: '#E5B35A' };

export const REMOTE_THEMES: Record<RemoteThemeId, RemoteTheme> = {
  charcoal: {
    // owner 24 Oct 2026: "the main theme needs to match the start-up animation and the logo remote".
    // Matte charcoal body and keys, brushed-gold d-pad face and OK key with dark arrows, the intro's
    // background (#0E0E0F, src/core/introRemote.ts INTRO_BG) so the opening animation fades straight in.
    id: 'charcoal', nameKey: 'ui.themes.name.charcoal', tier: 'free', scheme: 'dark',
    bg: '#0E0E0F', stage: '#080809', body: '#1C1C1D', key: '#2B2B2C', keyEdge: '#060606',
    ink: '#F4EEE3', muted: '#BDB5A8', accent: '#D2AB72', accentSoft: '#5C4626', accentInk: '#1A1208',
    power: '#FF9C8F', ring: '#C9A26C', ringLit: '#2A1A08', ringInk: '#2A1D0C', glow: '#C9A26C',
    press: 'firm', radius: 14, ...darkStatus,
    texture: { kind: 'brushed', colors: ['#2A2A2B', '#1C1C1D'], opacity: 0.35 },
  },
  midnight: {
    id: 'midnight', nameKey: 'ui.themes.name.midnight', tier: 'free', scheme: 'dark',
    bg: '#0B1020', stage: '#070A14', body: '#141B2E', key: '#1E2740', keyEdge: '#05070D',
    ink: '#E8EDF7', muted: '#A3AECB', accent: '#4062E8', accentSoft: '#26346A', accentInk: '#FFFFFF',
    power: '#FF8A80', ring: '#1E2740', ringLit: '#8FA6FF', glow: '#4D6BFF',
    press: 'firm', radius: 14, ...darkStatus,
    texture: { kind: 'glass', colors: ['#2A3760', '#141B2E'], opacity: 0.35 },
  },
  daylight: {
    id: 'daylight', nameKey: 'ui.themes.name.daylight', tier: 'free', scheme: 'light',
    bg: '#ECE8E1', stage: '#E2DDD4', body: '#F8F5EF', key: '#FFFFFF', keyEdge: '#D3CCC0',
    ink: '#1F232A', muted: '#5C6470', accent: '#2F5BD3', accentSoft: '#DCE5FB', accentInk: '#FFFFFF',
    power: '#B83232', ring: '#FFFFFF', ringLit: '#2F5BD3', glow: null,
    press: 'soft', radius: 14, ...base,
    texture: { kind: 'paper', colors: ['#F8F5EF', '#EFEAE0'], opacity: 0.5 },
  },
  oled: {
    id: 'oled', nameKey: 'ui.themes.name.oled', tier: 'free', scheme: 'dark',
    bg: '#000000', stage: '#000000', body: '#000000', key: '#121212', keyEdge: '#000000',
    ink: '#F2F2F2', muted: '#A6A6A6', accent: '#2A63E0', accentSoft: '#0F2148', accentInk: '#FFFFFF',
    power: '#FF6B6B', ring: '#121212', ringLit: '#6E9BFF', glow: null,
    press: 'click', radius: 12, ...darkStatus,
    texture: { kind: 'none', colors: [], opacity: 0 },
  },
  cinema: {
    id: 'cinema', nameKey: 'ui.themes.name.cinema', tier: 'plus', scheme: 'dark',
    bg: '#16070A', stage: '#0E0406', body: '#2A0D13', key: '#3B121B', keyEdge: '#0C0305',
    ink: '#FBEDEA', muted: '#E0B3AE', accent: '#E8B04A', accentSoft: '#5A3A12', accentInk: '#2A1606',
    power: '#FF9C8F', ring: '#3B121B', ringLit: '#F2C46A', glow: '#FF8A3D',
    press: 'soft', radius: 16, ...darkStatus,
    texture: { kind: 'velvet', colors: ['#4A1621', '#2A0D13'], opacity: 0.6 },
  },
  aluminium: {
    id: 'aluminium', nameKey: 'ui.themes.name.aluminium', tier: 'plus', scheme: 'light',
    bg: '#C9CDD2', stage: '#B8BDC3', body: '#DCDFE3', key: '#EEF0F2', keyEdge: '#9AA1A9',
    ink: '#1B1F24', muted: '#4A525B', accent: '#1F6FB2', accentSoft: '#CFE0EF', accentInk: '#FFFFFF',
    power: '#A82828', ring: '#E6E9EC', ringLit: '#1F6FB2', glow: null,
    press: 'click', radius: 10, ...base,
    texture: { kind: 'brushed', colors: ['#E4E7EA', '#CDD1D6'], opacity: 0.55 },
  },
  retro: {
    id: 'retro', nameKey: 'ui.themes.name.retro', tier: 'plus', scheme: 'dark',
    bg: '#2B1A10', stage: '#1E120B', body: '#D9BC92', key: '#F4EBD8', keyEdge: '#6B4428',
    ink: '#2A1C10', muted: '#55402C', accent: '#A8401A', accentSoft: '#E9C7A8', accentInk: '#FFFFFF',
    power: '#A3271B', ring: '#F4EBD8', ringLit: '#A8401A', glow: '#FFB25E',
    press: 'firm', radius: 8, ok: '#1F5636', warn: '#5E3F06',
    texture: { kind: 'woodgrain', colors: ['#D9BC92', '#C9A577', '#E3C9A2'], opacity: 0.6 },
  },
  walnut: {
    // owner-1022: a rich natural-wood remote. Dark walnut body and keys, cream labels, brass OK key.
    id: 'walnut', nameKey: 'ui.themes.name.walnut', tier: 'plus', scheme: 'dark',
    bg: '#1C110A', stage: '#130B06', body: '#4B2E1B', key: '#5E3B24', keyEdge: '#24140A',
    ink: '#FBF1E1', muted: '#E6CFAE', accent: '#D4A85A', accentSoft: '#7A5232', accentInk: '#2A1906',
    power: '#FFB4A0', ring: '#5E3B24', ringLit: '#F0C878', glow: '#E8A657',
    press: 'firm', radius: 12, ok: '#8FD9A8', warn: '#F2C66B',
    texture: { kind: 'woodgrain', colors: ['#4B2E1B', '#3B2213', '#5C3A22'], opacity: 0.7 },
  },
  neon: {
    id: 'neon', nameKey: 'ui.themes.name.neon', tier: 'plus', scheme: 'dark',
    bg: '#07040F', stage: '#040209', body: '#120A24', key: '#1B1033', keyEdge: '#FF3EA5',
    ink: '#F4EEFF', muted: '#B9A8E0', accent: '#FF3EA5', accentSoft: '#4A1240', accentInk: '#14060F',
    power: '#FF7AB8', ring: '#1B1033', ringLit: '#3EF2FF', glow: '#3EF2FF',
    press: 'click', radius: 14, ...darkStatus,
    texture: { kind: 'neon', colors: ['#FF3EA5', '#3EF2FF'], opacity: 0.35 },
  },
  candy: {
    id: 'candy', nameKey: 'ui.themes.name.candy', tier: 'plus', scheme: 'light',
    bg: '#FBE7F0', stage: '#F6DCE8', body: '#FFF4F8', key: '#FFFFFF', keyEdge: '#F0C4D7',
    ink: '#3A2340', muted: '#6E5378', accent: '#8A4FD8', accentSoft: '#EADCFB', accentInk: '#FFFFFF',
    power: '#C2336A', ring: '#FFFFFF', ringLit: '#8A4FD8', glow: null,
    press: 'soft', radius: 20, ...base,
    texture: { kind: 'candy', colors: ['#FFE3EE', '#E3F4FF', '#FFF6D9'], opacity: 0.6 },
  },
  forest: {
    id: 'forest', nameKey: 'ui.themes.name.forest', tier: 'plus', scheme: 'dark',
    bg: '#0B1A12', stage: '#06110B', body: '#13291D', key: '#1C3828', keyEdge: '#040C07',
    ink: '#EEF3E6', muted: '#B5C7A8', accent: '#C9A15A', accentSoft: '#4A3A1A', accentInk: '#1C1405',
    power: '#FF9B85', ring: '#1C3828', ringLit: '#D9B46E', glow: '#8FBF5A',
    press: 'firm', radius: 14, ...darkStatus,
    texture: { kind: 'brass', colors: ['#24432F', '#13291D'], opacity: 0.4 },
  },
  aurora: {
    id: 'aurora', nameKey: 'ui.themes.name.aurora', tier: 'plus', scheme: 'dark',
    bg: '#060B18', stage: '#03060F', body: '#0E1628', key: '#18233B', keyEdge: '#02040A',
    ink: '#EAF6F4', muted: '#A2BFC4', accent: '#3FD6A8', accentSoft: '#12463C', accentInk: '#04201A',
    power: '#FF8F9E', ring: '#18233B', ringLit: '#7CF0D0', glow: '#7A5CFF',
    press: 'soft', radius: 16, ...darkStatus,
    texture: { kind: 'aurora', colors: ['#3FD6A8', '#7A5CFF', '#2FA8FF'], opacity: 0.45, animated: true },
  },
};

export function isRemoteThemeId(v: unknown): v is RemoteThemeId {
  return typeof v === 'string' && (REMOTE_THEME_IDS as readonly string[]).includes(v);
}

export function remoteTheme(id: string | null | undefined): RemoteTheme {
  return REMOTE_THEMES[isRemoteThemeId(id) ? id : DEFAULT_REMOTE_THEME];
}

export function isFreeRemoteTheme(id: RemoteThemeId): boolean {
  return FREE_REMOTE_THEMES.includes(id);
}

/**
 * Which theme the remote actually shows. A Plus theme shows when the person owns Plus or is trying
 * it right now ("Try it"); otherwise the remote falls back to the default free theme, never locked.
 */
export function effectiveRemoteTheme(chosen: RemoteThemeId, opts: { plus: boolean; trying?: RemoteThemeId | null }): RemoteTheme {
  if (opts.trying && isRemoteThemeId(opts.trying)) return REMOTE_THEMES[opts.trying];
  if (isFreeRemoteTheme(chosen) || opts.plus) return REMOTE_THEMES[chosen];
  return REMOTE_THEMES[DEFAULT_REMOTE_THEME];
}

// ---- WCAG contrast ------------------------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Every label/background pair a theme draws on the remote, with its WCAG AA minimum. */
export function labelPairs(t: RemoteTheme): { what: string; fg: string; bg: string; min: number }[] {
  return [
    { what: 'key label on key', fg: t.ink, bg: t.key, min: 4.5 },
    { what: 'secondary label / arrows on key', fg: t.muted, bg: t.key, min: 4.5 },
    { what: 'power on key', fg: t.power, bg: t.key, min: 4.5 },
    { what: 'OK label on accent', fg: t.accentInk, bg: t.accent, min: 4.5 },
    { what: 'arrows on d-pad face', fg: t.ringInk ?? t.muted, bg: t.ring, min: 4.5 },
    { what: 'lit arc on d-pad face (non-text)', fg: t.ringLit, bg: t.ring, min: 3 },
    { what: 'text on remote body', fg: t.ink, bg: t.body, min: 4.5 },
    { what: 'muted text on remote body', fg: t.muted, bg: t.body, min: 4.5 },
    { what: 'selected accent on body (non-text)', fg: t.accent, bg: t.body, min: 3 },
    { what: 'warning text on body / sheet', fg: t.warn, bg: t.body, min: 4.5 },
    { what: 'ok status on body (non-text dot)', fg: t.ok, bg: t.body, min: 3 },
    { what: 'label on pressed key', fg: t.ink, bg: t.accentSoft, min: 4.5 },
  ];
}
