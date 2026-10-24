// Widget theme JSON (docs/WIDGETS.md). The app writes this to the App Group
// (UserDefaults suite `group.com.jared797.glaze`, key `glaze.theme.v1`); the WidgetKit extension
// (targets/widget/ThemeStore.swift) decodes the same shape. Keep both sides in sync.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import { isHex, mix, normalizeHex, relativeLuminance } from './colour.ts';
import type { Theme } from './themes.ts';

export const WIDGET_THEME_VERSION = 1;
export const WIDGET_APP_GROUP = 'group.com.jared797.glaze';
export const WIDGET_THEME_KEY = 'glaze.theme.v1';
export const WIDGET_PHOTO_FILE = 'widget-photo.jpg';
/** T125: the same JSON as a file in the App Group container (backup read path for the extension). */
export const WIDGET_THEME_FILE = 'theme.json';
/** T125: AsyncStorage key holding the last widget theme the app applied (serialised WidgetTheme). */
export const ACTIVE_WIDGET_THEME_KEY = 'glaze.activeWidgetTheme.v1';

export type WidgetSurfaceStyle = 'glass' | 'solid' | 'outline';
export type WidgetFont = 'display' | 'body';

export type WidgetTheme = {
  v: 1;
  themeId: string;
  name: string;
  /** Background: one colour (flat) or two (top-to-bottom gradient). `#RRGGBB`. */
  bg: string[];
  surface: string;
  accent: string;
  ink: string;
  style: WidgetSurfaceStyle;
  font: WidgetFont;
  /** ISO-8601 timestamp of when the app wrote this theme. */
  updatedAt: string;
};

/**
 * Used when nothing (or nothing valid) has been written yet. Matches ThemeStore.swift defaults.
 * T125: a plum-to-coral Glaze gradient with light ink, so an unthemed widget still looks like Glaze
 * (never near-white). `surface` is a deep plum, used for text on accent fills (the Date "today" dot).
 */
export const DEFAULT_WIDGET_THEME: WidgetTheme = Object.freeze({
  v: 1,
  themeId: 'glaze',
  name: 'Glaze',
  bg: ['#7A2E6B', '#E0794F'],
  surface: '#4A1A42',
  accent: '#FFC9A8',
  ink: '#FFF7F2',
  style: 'solid',
  font: 'display',
  updatedAt: '1970-01-01T00:00:00.000Z',
}) as WidgetTheme;

/** T125: a background stop at or above this WCAG luminance counts as pale. Mirrored in ThemeStore.swift. */
export const PALE_BG_LUMINANCE = 0.8;
/** T125: how far the last stop of a pale background is pulled toward the accent. Mirrored in Swift. */
export const PALE_ACCENT_MIX = 0.35;

/**
 * T125: the gradient stops a widget paints. Pale pastel themes (every stop pale) would read as plain
 * white, so their last stop is mixed toward the accent; the result is always two stops.
 * ThemeStore.swift `WidgetTheme.backgroundHexes` implements the same rule.
 */
export function widgetBackgroundStops(t: Pick<WidgetTheme, 'bg' | 'accent'>): string[] {
  const stops = t.bg.length > 0 ? t.bg.slice(0, 2) : [...DEFAULT_WIDGET_THEME.bg];
  const first = stops[0];
  const last = stops[stops.length - 1];
  const pale = stops.every((c) => relativeLuminance(c) >= PALE_BG_LUMINANCE);
  return [first, pale ? mix(last, t.accent, PALE_ACCENT_MIX) : last];
}

const STYLES: readonly WidgetSurfaceStyle[] = ['glass', 'solid', 'outline'];
const FONTS: readonly WidgetFont[] = ['display', 'body'];

function hexOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && isHex(value) ? normalizeHex(value) : fallback;
}

function textOr(value: unknown, fallback: string, max = 64): string {
  if (typeof value !== 'string') return fallback;
  const s = value.trim();
  return s.length > 0 ? s.slice(0, max) : fallback;
}

/** Build the widget theme from an app theme. `now` is injectable for tests. */
export function widgetThemeFrom(theme: Theme, now: Date = new Date()): WidgetTheme {
  const d = DEFAULT_WIDGET_THEME;
  const bg = [hexOr(theme.palette.bg, d.bg[0])];
  if (isHex(theme.palette.surface) && normalizeHex(theme.palette.surface) !== bg[0]) {
    bg.push(normalizeHex(theme.palette.surface));
  }
  return {
    v: 1,
    themeId: textOr(theme.id, d.themeId),
    name: textOr(theme.name, d.name),
    bg,
    surface: hexOr(theme.palette.surface, d.surface),
    accent: hexOr(theme.widget.accent, hexOr(theme.palette.accent, d.accent)),
    ink: hexOr(theme.palette.ink, d.ink),
    style: STYLES.includes(theme.widget.style) ? theme.widget.style : d.style,
    font: FONTS.includes(theme.widget.font) ? theme.widget.font : d.font,
    updatedAt: now.toISOString(),
  };
}

export function serializeWidgetTheme(t: WidgetTheme): string {
  // Fixed key order so the JSON is stable (and diff-friendly in tests).
  return JSON.stringify({
    v: t.v,
    themeId: t.themeId,
    name: t.name,
    bg: t.bg,
    surface: t.surface,
    accent: t.accent,
    ink: t.ink,
    style: t.style,
    font: t.font,
    updatedAt: t.updatedAt,
  });
}

/**
 * Tolerant parse: accepts a JSON string or an object, never throws. Invalid or missing
 * fields fall back to DEFAULT_WIDGET_THEME; colours are validated and normalised to `#RRGGBB`.
 * Returns null only when the input is not an object at all or has an unknown version.
 */
export function parseWidgetTheme(input: unknown): WidgetTheme | null {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== undefined && o.v !== WIDGET_THEME_VERSION) return null;
  const d = DEFAULT_WIDGET_THEME;

  let bg: string[] = [];
  if (Array.isArray(o.bg)) {
    bg = o.bg.filter((c): c is string => typeof c === 'string' && isHex(c)).map(normalizeHex).slice(0, 2);
  } else if (typeof o.bg === 'string' && isHex(o.bg)) {
    bg = [normalizeHex(o.bg)];
  }
  if (bg.length === 0) bg = [...d.bg];

  const style = typeof o.style === 'string' && (STYLES as readonly string[]).includes(o.style) ? (o.style as WidgetSurfaceStyle) : d.style;
  const font = typeof o.font === 'string' && (FONTS as readonly string[]).includes(o.font) ? (o.font as WidgetFont) : d.font;
  const updatedAt = typeof o.updatedAt === 'string' && !Number.isNaN(Date.parse(o.updatedAt)) ? o.updatedAt : d.updatedAt;

  return {
    v: 1,
    themeId: textOr(o.themeId, d.themeId),
    name: textOr(o.name, d.name),
    bg,
    surface: hexOr(o.surface, d.surface),
    accent: hexOr(o.accent, d.accent),
    ink: hexOr(o.ink, d.ink),
    style,
    font,
    updatedAt,
  };
}

/**
 * T125: the widget theme to (re)write at app launch. Prefers a fresh build from the applied theme's id
 * (so colour fixes in app updates reach the widgets), then the stored JSON as written, then the theme
 * the Icon Studio last used. Null when nothing was ever chosen (the extension shows its default).
 */
export function launchWidgetTheme<T extends Theme>(
  storedRaw: string | null,
  lookup: (id: string) => T | undefined,
  studioThemeId: string | null,
  now: Date = new Date(),
): WidgetTheme | null {
  const stored = storedRaw ? parseWidgetTheme(storedRaw) : null;
  if (stored) {
    const theme = lookup(stored.themeId);
    return theme ? widgetThemeFrom(theme, now) : stored;
  }
  if (studioThemeId) {
    const theme = lookup(studioThemeId);
    if (theme) return widgetThemeFrom(theme, now);
  }
  return null;
}
