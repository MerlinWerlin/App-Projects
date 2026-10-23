// Widget theme JSON (docs/WIDGETS.md). The app writes this to the App Group
// (UserDefaults suite `group.com.jared797.glaze`, key `glaze.theme.v1`); the WidgetKit extension
// (targets/widget/ThemeStore.swift) decodes the same shape. Keep both sides in sync.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import { isHex, normalizeHex } from './colour.ts';
import type { Theme } from './themes.ts';

export const WIDGET_THEME_VERSION = 1;
export const WIDGET_APP_GROUP = 'group.com.jared797.glaze';
export const WIDGET_THEME_KEY = 'glaze.theme.v1';
export const WIDGET_PHOTO_FILE = 'widget-photo.jpg';

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

/** Used when nothing (or nothing valid) has been written yet. Matches ThemeStore.swift defaults. */
export const DEFAULT_WIDGET_THEME: WidgetTheme = Object.freeze({
  v: 1,
  themeId: 'porcelain',
  name: 'Porcelain',
  bg: ['#F6F3F5', '#FFFFFF'],
  surface: '#FFFFFF',
  accent: '#7A2E6B',
  ink: '#1E1A1D',
  style: 'solid',
  font: 'display',
  updatedAt: '1970-01-01T00:00:00.000Z',
}) as WidgetTheme;

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
