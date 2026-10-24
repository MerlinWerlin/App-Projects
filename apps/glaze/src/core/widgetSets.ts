// Theme-matched widget sets (T58, M4b-core; docs/WIDGETS.md "Widget sets (v2)").
//
// Every theme gets 5 widget kinds (clock, date, photo, quote/countdown, battery) in 3 sizes
// (small, medium, large), generated from the theme's tokens: palette, icon shape (corner radius),
// glyph set / colour, widget surface style and fonts. Every text colour is chosen so it meets
// WCAG AA (4.5:1) against everything it can sit on; graphics (glyph, meter) get 3:1.
//
// User-facing copy is never English here: widget names, sample text and edit issues are i18n keys
// (`widgets.*`, src/i18n/ns/widgets). Dynamic content (time, date, battery level) is a `source`
// the renderer formats with the device locale.
//
// Pure TS (no React Native / Expo) so Node can run and test it directly. Output is deterministic:
// the same theme (or tokens + edits) always yields the same specs.

import { composite, ensureContrast, gradientStops, isHex, minContrast, mix, normalizeHex } from './colour.ts';
import type { Theme } from './themes.ts';
import {
  DEFAULT_WIDGET_THEME,
  parseWidgetTheme,
  serializeWidgetTheme,
  widgetThemeFrom,
  type WidgetFont,
  type WidgetSurfaceStyle,
  type WidgetTheme,
} from './widgetTheme.ts';
import {
  GLOW_HALO_OPACITY,
  backdropFeasible,
  GLOW_RADIUS_PT,
  cleanWallpaperColours,
  glassCandidates,
  glowPalette,
  isWidgetLook,
  paneSamples,
  textMinContrast,
  wallpaperBackdrop,
  wallpaperColoursOf,
  type WidgetLook,
} from './widgetLook.ts';

export type { WidgetLook } from './widgetLook.ts';

// ---------------------------------------------------------------------------------- constants

export const WIDGET_KINDS = Object.freeze(['clock', 'date', 'photo', 'quote', 'battery'] as const);
export const WIDGET_SIZES = Object.freeze(['small', 'medium', 'large'] as const);
export type WidgetKind = (typeof WIDGET_KINDS)[number];
export type WidgetSize = (typeof WIDGET_SIZES)[number];

/** Payload version and App Group key. The v1 theme key (`glaze.theme.v1`) is still written as-is. */
export const WIDGET_SET_VERSION = 2;
export const WIDGET_SET_KEY = 'glaze.widgets.v2';

/** AA thresholds: body text, and non-text graphics (glyph, meter). */
export const TEXT_MIN_CONTRAST = 4.5;
export const GRAPHIC_MIN_CONTRAST = 3;

/** Nominal canvas in points (iPhone-class). Region frames are fractions, so other sizes scale. */
export const WIDGET_SIZE_POINTS: Readonly<Record<WidgetSize, { width: number; height: number }>> = Object.freeze({
  small: { width: 170, height: 170 },
  medium: { width: 364, height: 170 },
  large: { width: 364, height: 382 },
});

/** Corner radius (pt) by the theme's icon shape, so widgets echo the icons. */
export const CORNER_RADIUS_BY_SHAPE: Readonly<Record<string, number>> = Object.freeze({
  squircle: 22,
  circle: 30,
  rounded: 16,
  square: 6,
  blob: 26,
});

const GLASS_OPACITY = 0.82;
const SCRIM_OPACITY = 0.85;
const OPACITY_STEPS = [0.92, 1];
const PHOTO_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.(jpg|jpeg|png|heic)$/i;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** i18n keys (src/i18n/ns/widgets). */
export const widgetKindKey = (kind: WidgetKind): string => `widgets.kind.${kind}`;
export const widgetSizeKey = (size: WidgetSize): string => `widgets.size.${size}`;
export const widgetIssueKey = (code: WidgetEditIssueCode): string => `widgets.issue.${code}`;

// ---------------------------------------------------------------------------------- types

/** Everything a widget set is generated from. Derived from a Theme, or from a v1 WidgetTheme. */
export type WidgetTokens = {
  themeId: string;
  name: string;
  /** 1–2 colours; two = top-to-bottom gradient. */
  bg: string[];
  surface: string;
  accent: string;
  ink: string;
  glyph: string;
  style: WidgetSurfaceStyle;
  font: WidgetFont;
  /** Icon shape id (drives corner radius). */
  shape: string;
  /** The theme's display typeface family (ThemeArt.displayFont), e.g. 'rounded'. */
  typeface: string;
  glyphSet: string;
  motif: string | null;
  /**
   * T65: colours the theme wallpaper can show (widgetLook.wallpaperColoursOf), used to keep the
   * see-through looks readable. Empty when unknown (a v1 theme): panes are then bounded over
   * black and white.
   */
  wallpaper: string[];
};

export type WidgetFill =
  | { kind: 'solid'; colour: string }
  | { kind: 'gradient'; from: string; to: string; angle: number };

export type TextSource =
  /** Static text: an i18n sample key, replaceable by user text when editable. */
  | 'text'
  | 'time'
  | 'weekday'
  | 'date'
  | 'month'
  | 'dayNumber'
  | 'week'
  | 'monthGrid'
  | 'batteryLevel'
  | 'countdown';

export type TextSlot = {
  source: TextSource;
  /** i18n key for the sample / label (always set for 'text'; null for purely dynamic sources). */
  key: string | null;
  /** User text replacing the sample (only when `editable`). */
  userText: string | null;
  editable: boolean;
  maxLength: number;
  font: WidgetFont;
  /** Point size at the nominal canvas. */
  sizePt: number;
  weight: 'regular' | 'medium' | 'bold';
  align: 'start' | 'center' | 'end';
};

export type RegionRole = 'text' | 'glyph' | 'photo' | 'band' | 'scrim' | 'meter';

export type WidgetRegion = {
  id: string;
  role: RegionRole;
  /** Fractions of the widget canvas, 0–1, origin top-start (mirrors in RTL). */
  frame: { x: number; y: number; w: number; h: number };
  /** Region this one is drawn on ('background' = the widget background). */
  on: string;
  /** Own fill for band / scrim / photo placeholder; null otherwise. */
  fill: WidgetFill | null;
  fillOpacity: number;
  /** Foreground colour: text, glyph or meter fill. Null for pure fills. */
  colour: string | null;
  /** Colours the foreground was checked against (gradient samples, translucency bounds). */
  backdrop: string[];
  /** Lowest contrast of `colour` against `backdrop` (0 when no foreground). */
  contrast: number;
  text: TextSlot | null;
  meter: { shape: 'ring' | 'bar'; track: string; sampleLevel: number } | null;
};

export type WidgetColourEdits = {
  /** One colour or two (gradient). null resets to the theme. */
  background?: string | readonly string[] | null;
  accent?: string | null;
  /** Preferred colour for all text; adjusted (with an issue) when it can't reach AA. */
  text?: string | null;
};

export type WidgetEdits = {
  /** Region id → user text. '' or null resets that region to its sample. */
  text?: Readonly<Record<string, string | null>>;
  /** App Group file name of the user's photo (photo widgets only). null clears it. */
  photoRef?: string | null;
  /** Countdown target day, `YYYY-MM-DD` (quote widgets only). null clears it. */
  countdownTo?: string | null;
  colours?: WidgetColourEdits;
  /** T65 look (widgetLook.ts): 'theme' (default), 'clear', 'tinted' or 'glow'. null resets. */
  look?: WidgetLook | null;
};

/** Normalised, applied edits stored on a spec. */
export type AppliedEdits = {
  text: Record<string, string>;
  photoRef: string | null;
  countdownTo: string | null;
  colours: { background: string[] | null; accent: string | null; text: string | null };
  look: WidgetLook;
};

export type WidgetSpec = {
  id: string;
  themeId: string;
  kind: WidgetKind;
  size: WidgetSize;
  nameKey: string;
  width: number;
  height: number;
  cornerRadius: number;
  surface: WidgetSurfaceStyle;
  background: WidgetFill;
  backgroundOpacity: number;
  border: { colour: string; width: number } | null;
  accent: string;
  font: WidgetFont;
  typeface: string;
  glyphSet: string;
  motif: string | null;
  regions: WidgetRegion[];
  editable: { text: boolean; photo: boolean; colours: boolean };
  photoRef: string | null;
  countdownTo: string | null;
  tokens: WidgetTokens;
  edits: AppliedEdits;
  /**
   * T65 look. 'clear' / 'tinted': `background` is the pane tint and `backgroundOpacity` its
   * opacity over the wallpaper (`surface` stays 'glass' so older readers draw glass). 'glow':
   * `surface` 'solid' with a dark base, and `glow` describes the halo around text and glyphs.
   */
  look: WidgetLook;
  glow: { colour: string; opacity: number; radius: number } | null;
};

export type WidgetSet = {
  themeId: string;
  name: string;
  tokens: WidgetTokens;
  /** WIDGET_KINDS × WIDGET_SIZES, kind-major order. */
  specs: WidgetSpec[];
};

export type WidgetEditIssueCode =
  | 'unknownRegion'
  | 'notEditable'
  | 'tooLong'
  | 'emptyText'
  | 'invalidColour'
  | 'invalidPhoto'
  | 'invalidDate'
  | 'notSupported'
  | 'contrastAdjusted';

export type WidgetEditIssue = { field: string; code: WidgetEditIssueCode; messageKey: string };

// ---------------------------------------------------------------------------------- tokens

const STYLES: readonly WidgetSurfaceStyle[] = ['glass', 'solid', 'outline'];
const FONTS: readonly WidgetFont[] = ['display', 'body'];

function hexOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && isHex(v) ? normalizeHex(v) : fallback;
}

function idOr(v: unknown, fallback: string, max = 64): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  return s.length > 0 ? s.slice(0, max) : fallback;
}

const DEFAULT_TOKENS: WidgetTokens = Object.freeze({
  themeId: DEFAULT_WIDGET_THEME.themeId,
  name: DEFAULT_WIDGET_THEME.name,
  bg: [...DEFAULT_WIDGET_THEME.bg],
  surface: DEFAULT_WIDGET_THEME.surface,
  accent: DEFAULT_WIDGET_THEME.accent,
  ink: DEFAULT_WIDGET_THEME.ink,
  glyph: DEFAULT_WIDGET_THEME.accent,
  style: DEFAULT_WIDGET_THEME.style,
  font: DEFAULT_WIDGET_THEME.font,
  shape: 'squircle',
  typeface: 'rounded',
  glyphSet: 'feather',
  motif: null,
  wallpaper: [],
}) as WidgetTokens;

/** Tokens from an app theme. */
export function widgetTokensFrom(theme: Theme): WidgetTokens {
  const wt = widgetThemeFrom(theme, new Date(0));
  return normaliseTokens({
    ...tokensFromWidgetTheme(wt),
    glyph: theme.palette.glyph,
    shape: theme.iconStyle?.shape,
    typeface: theme.art?.displayFont,
    glyphSet: theme.iconStyle?.glyphSet,
    motif: theme.art?.motifs?.[0] ?? null,
    wallpaper: wallpaperColoursOf(theme.wallpaper),
  });
}

/** Tokens from a v1 widget theme (what older payloads carry); shape/glyph details use defaults. */
export function tokensFromWidgetTheme(t: WidgetTheme): WidgetTokens {
  return normaliseTokens({
    themeId: t.themeId,
    name: t.name,
    bg: t.bg,
    surface: t.surface,
    accent: t.accent,
    ink: t.ink,
    glyph: t.accent,
    style: t.style,
    font: t.font,
  });
}

/** Validate tokens from any source; bad or missing fields fall back to the Glaze default theme (plum to coral, T125). */
export function normaliseTokens(raw: unknown): WidgetTokens {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_TOKENS;
  let bg: string[] = [];
  if (Array.isArray(o.bg)) bg = o.bg.filter((c): c is string => typeof c === 'string' && isHex(c)).map(normalizeHex).slice(0, 2);
  else if (typeof o.bg === 'string' && isHex(o.bg)) bg = [normalizeHex(o.bg)];
  if (bg.length === 0) bg = [...d.bg];
  if (bg.length === 2 && bg[0] === bg[1]) bg = [bg[0]];
  const shape = typeof o.shape === 'string' && o.shape in CORNER_RADIUS_BY_SHAPE ? o.shape : d.shape;
  return {
    themeId: idOr(o.themeId, d.themeId),
    name: idOr(o.name, d.name),
    bg,
    surface: hexOr(o.surface, d.surface),
    accent: hexOr(o.accent, d.accent),
    ink: hexOr(o.ink, d.ink),
    glyph: hexOr(o.glyph, hexOr(o.accent, d.glyph)),
    style: typeof o.style === 'string' && (STYLES as readonly string[]).includes(o.style) ? (o.style as WidgetSurfaceStyle) : d.style,
    font: typeof o.font === 'string' && (FONTS as readonly string[]).includes(o.font) ? (o.font as WidgetFont) : d.font,
    shape,
    typeface: idOr(o.typeface, d.typeface, 32),
    glyphSet: idOr(o.glyphSet, d.glyphSet, 32),
    motif: typeof o.motif === 'string' && o.motif.trim() ? o.motif.trim().slice(0, 32) : null,
    wallpaper: cleanWallpaperColours(o.wallpaper),
  };
}

// ---------------------------------------------------------------------------------- layouts

type TextTemplate = {
  source: TextSource;
  key?: string;
  editable?: boolean;
  maxLength?: number;
  font?: 'display' | 'body' | 'theme';
  sizePt: number;
  weight?: TextSlot['weight'];
  align?: TextSlot['align'];
  /** Colour preference: theme ink, accent, or the colour of what it sits on inverted. */
  prefer?: 'ink' | 'accent' | 'bg';
};

type RegionTemplate = {
  id: string;
  role: RegionRole;
  frame: [number, number, number, number];
  on?: string;
  text?: TextTemplate;
  meter?: { shape: 'ring' | 'bar'; sampleLevel: number };
};

const T = (
  id: string,
  frame: [number, number, number, number],
  text: TextTemplate,
  on = 'background',
): RegionTemplate => ({ id, role: 'text', frame, on, text });

const S = 'widgets.sample';

function layout(kind: WidgetKind, size: WidgetSize): RegionTemplate[] {
  const glyph = (frame: [number, number, number, number]): RegionTemplate => ({ id: 'glyph', role: 'glyph', frame });
  switch (kind) {
    case 'clock':
      if (size === 'small')
        return [
          glyph([0.74, 0.08, 0.18, 0.18]),
          T('time', [0.08, 0.32, 0.84, 0.3], { source: 'time', font: 'theme', sizePt: 40, weight: 'bold', align: 'center' }),
          T('weekday', [0.08, 0.66, 0.84, 0.14], { source: 'weekday', sizePt: 14, align: 'center' }),
        ];
      if (size === 'medium')
        return [
          T('time', [0.06, 0.22, 0.56, 0.34], { source: 'time', font: 'theme', sizePt: 48, weight: 'bold' }),
          T('date', [0.06, 0.6, 0.56, 0.16], { source: 'date', sizePt: 15 }),
          glyph([0.7, 0.2, 0.24, 0.6]),
        ];
      return [
        glyph([0.78, 0.06, 0.14, 0.14]),
        T('time', [0.08, 0.24, 0.84, 0.26], { source: 'time', font: 'theme', sizePt: 72, weight: 'bold', align: 'center' }),
        T('date', [0.08, 0.52, 0.84, 0.08], { source: 'date', sizePt: 17, align: 'center' }),
        T('greeting', [0.08, 0.74, 0.84, 0.12], { source: 'text', key: `${S}.greeting`, editable: true, maxLength: 40, sizePt: 16, align: 'center' }),
      ];
    case 'date':
      if (size === 'small')
        return [
          { id: 'band', role: 'band', frame: [0, 0, 1, 0.3] },
          T('month', [0.08, 0.06, 0.84, 0.18], { source: 'month', sizePt: 14, weight: 'bold', align: 'center', prefer: 'bg' }, 'band'),
          T('day', [0.08, 0.34, 0.84, 0.4], { source: 'dayNumber', font: 'theme', sizePt: 56, weight: 'bold', align: 'center' }),
          T('weekday', [0.08, 0.76, 0.84, 0.14], { source: 'weekday', sizePt: 14, align: 'center' }),
        ];
      if (size === 'medium')
        return [
          { id: 'band', role: 'band', frame: [0, 0, 0.34, 1] },
          T('month', [0.03, 0.1, 0.28, 0.14], { source: 'month', sizePt: 14, weight: 'bold', align: 'center', prefer: 'bg' }, 'band'),
          T('day', [0.03, 0.3, 0.28, 0.4], { source: 'dayNumber', font: 'theme', sizePt: 56, weight: 'bold', align: 'center', prefer: 'bg' }, 'band'),
          T('weekday', [0.4, 0.14, 0.54, 0.16], { source: 'weekday', sizePt: 17, weight: 'medium' }),
          T('week', [0.4, 0.42, 0.54, 0.44], { source: 'week', sizePt: 13 }),
        ];
      return [
        { id: 'band', role: 'band', frame: [0, 0, 1, 0.18] },
        T('month', [0.06, 0.04, 0.6, 0.1], { source: 'month', font: 'theme', sizePt: 20, weight: 'bold', prefer: 'bg' }, 'band'),
        T('day', [0.66, 0.04, 0.28, 0.1], { source: 'dayNumber', sizePt: 20, weight: 'bold', align: 'end', prefer: 'bg' }, 'band'),
        T('grid', [0.06, 0.24, 0.88, 0.62], { source: 'monthGrid', sizePt: 14 }),
        T('note', [0.06, 0.88, 0.88, 0.08], { source: 'text', key: `${S}.dateNote`, editable: true, maxLength: 40, sizePt: 13 }),
      ];
    case 'photo': {
      const caption = size === 'small' ? 0.26 : 0.24;
      const regions: RegionTemplate[] = [
        { id: 'photo', role: 'photo', frame: [0, 0, 1, 1] },
        { id: 'scrim', role: 'scrim', frame: [0, 1 - caption, 1, caption], on: 'photo' },
        T('caption', [0.06, 1 - caption + 0.04, size === 'small' ? 0.88 : 0.6, caption - 0.08], {
          source: 'text', key: `${S}.photoCaption`, editable: true, maxLength: size === 'small' ? 24 : 40, sizePt: 14, weight: 'medium',
        }, 'scrim'),
      ];
      if (size !== 'small') regions.push(T('date', [0.68, 1 - caption + 0.04, 0.26, caption - 0.08], { source: 'date', sizePt: 13, align: 'end' }, 'scrim'));
      return regions;
    }
    case 'quote':
      if (size === 'small')
        return [
          glyph([0.08, 0.08, 0.16, 0.16]),
          T('quote', [0.08, 0.3, 0.84, 0.62], { source: 'text', key: `${S}.quote`, editable: true, maxLength: 60, font: 'theme', sizePt: 16, weight: 'medium' }),
        ];
      if (size === 'medium')
        return [
          glyph([0.06, 0.12, 0.08, 0.18]),
          T('quote', [0.06, 0.34, 0.88, 0.42], { source: 'text', key: `${S}.quote`, editable: true, maxLength: 90, font: 'theme', sizePt: 20, weight: 'medium' }),
          T('caption', [0.06, 0.8, 0.88, 0.12], { source: 'text', key: `${S}.quoteCaption`, editable: true, maxLength: 30, sizePt: 13 }),
        ];
      return [
        glyph([0.08, 0.06, 0.12, 0.12]),
        T('quote', [0.08, 0.2, 0.84, 0.36], { source: 'text', key: `${S}.quote`, editable: true, maxLength: 120, font: 'theme', sizePt: 24, weight: 'medium' }),
        T('countdown', [0.08, 0.62, 0.84, 0.18], { source: 'countdown', font: 'theme', sizePt: 48, weight: 'bold' }),
        T('countdownLabel', [0.08, 0.82, 0.84, 0.1], { source: 'text', key: `${S}.countdownLabel`, editable: true, maxLength: 30, sizePt: 15 }),
      ];
    case 'battery':
      if (size === 'small')
        return [
          { id: 'meter', role: 'meter', frame: [0.18, 0.1, 0.64, 0.64], meter: { shape: 'ring', sampleLevel: 0.72 } },
          T('level', [0.18, 0.32, 0.64, 0.2], { source: 'batteryLevel', font: 'theme', sizePt: 24, weight: 'bold', align: 'center' }),
          T('label', [0.08, 0.8, 0.84, 0.12], { source: 'text', key: `${S}.batteryLabel`, editable: true, maxLength: 20, sizePt: 13, align: 'center' }),
        ];
      if (size === 'medium')
        return [
          T('label', [0.06, 0.14, 0.6, 0.14], { source: 'text', key: `${S}.devicePhone`, editable: true, maxLength: 24, sizePt: 15, weight: 'medium' }),
          T('level', [0.66, 0.1, 0.28, 0.22], { source: 'batteryLevel', font: 'theme', sizePt: 28, weight: 'bold', align: 'end' }),
          { id: 'meter', role: 'meter', frame: [0.06, 0.44, 0.88, 0.16], meter: { shape: 'bar', sampleLevel: 0.72 } },
          glyph([0.06, 0.7, 0.12, 0.2]),
        ];
      return [
        T('label', [0.08, 0.08, 0.6, 0.08], { source: 'text', key: `${S}.devicePhone`, editable: true, maxLength: 24, sizePt: 17, weight: 'medium' }),
        T('level', [0.66, 0.06, 0.26, 0.12], { source: 'batteryLevel', font: 'theme', sizePt: 32, weight: 'bold', align: 'end' }),
        { id: 'meter', role: 'meter', frame: [0.08, 0.22, 0.84, 0.08], meter: { shape: 'bar', sampleLevel: 0.72 } },
        T('label2', [0.08, 0.42, 0.6, 0.08], { source: 'text', key: `${S}.deviceAccessory`, editable: true, maxLength: 24, sizePt: 17, weight: 'medium' }),
        T('level2', [0.66, 0.4, 0.26, 0.12], { source: 'batteryLevel', font: 'theme', sizePt: 32, weight: 'bold', align: 'end' }),
        { id: 'meter2', role: 'meter', frame: [0.08, 0.56, 0.84, 0.08], meter: { shape: 'bar', sampleLevel: 0.4 } },
        glyph([0.08, 0.76, 0.14, 0.14]),
      ];
  }
}

// ---------------------------------------------------------------------------------- colour solving

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function fillSamples(fill: WidgetFill, opacity: number): string[] {
  const base = fill.kind === 'solid' ? [fill.colour] : gradientStops([fill.from, fill.to], 5);
  if (opacity >= 1) return dedupe(base);
  // Translucent (glass, photo scrim): what shows through is unknown (wallpaper, photo), so bound
  // it by compositing over black and over white and check text against both.
  return dedupe(base.flatMap((c) => [composite(c, opacity, '#000000'), composite(c, opacity, '#FFFFFF')]));
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}

/** First preference that reaches `min` on `backdrop`, else the nearest adjusted shade, else null. */
function pickColour(prefs: readonly string[], backdrop: readonly string[], min: number): string | null {
  for (const p of prefs) if (minContrast(p, backdrop) >= min) return normalizeHex(p);
  for (const p of prefs) {
    const c = ensureContrast(p, backdrop, min);
    if (c) return c;
  }
  return null;
}

function baseFill(t: WidgetTokens, kind: WidgetKind): { fill: WidgetFill; opacity: number } {
  if (kind === 'quote') {
    return { fill: { kind: 'gradient', from: t.accent, to: mix(t.accent, t.bg[0], 0.35), angle: 160 }, opacity: 1 };
  }
  if (t.style === 'glass') return { fill: { kind: 'solid', colour: t.surface }, opacity: GLASS_OPACITY };
  if (t.style === 'outline' || t.bg.length === 1) return { fill: { kind: 'solid', colour: t.bg[0] }, opacity: 1 };
  return { fill: { kind: 'gradient', from: t.bg[0], to: t.bg[1], angle: 180 }, opacity: 1 };
}

type Solved = { colour: string; backdrop: string[]; contrast: number };

function solveOn(prefs: readonly string[], backdrop: string[], min: number): Solved | null {
  const colour = pickColour(prefs, backdrop, min);
  return colour ? { colour, backdrop, contrast: round3(minContrast(colour, backdrop)) } : null;
}

function emptyEdits(): AppliedEdits {
  return { text: {}, photoRef: null, countdownTo: null, colours: { background: null, accent: null, text: null }, look: 'theme' };
}

/**
 * Build one spec from tokens + applied edits. Colour overrides are folded into the tokens first,
 * so a user's background/accent drives the whole widget exactly like a theme's would.
 * Returns the spec and whether the user's text colour had to be adjusted.
 */
function build(tokens0: WidgetTokens, kind: WidgetKind, size: WidgetSize, edits: AppliedEdits): { spec: WidgetSpec; textAdjusted: boolean } {
  const t: WidgetTokens = {
    ...tokens0,
    bg: edits.colours.background ? [...edits.colours.background] : [...tokens0.bg],
    accent: edits.colours.accent ?? tokens0.accent,
  };
  if (edits.colours.background) t.surface = edits.colours.background[edits.colours.background.length - 1];
  // T65 looks (widgetLook.ts). Glow: a dark base from the accent; its neon drives text, glyphs,
  // meters and the date band. Clear / tinted: a see-through pane solved against the wallpaper.
  const look = edits.look;
  const glass = look === 'clear' || look === 'tinted';
  const paneTint = edits.colours.background ? edits.colours.background[0] : t.accent;
  const glow = look === 'glow' ? glowPalette(t.accent) : null;
  if (glow) {
    t.bg = [...glow.base];
    t.surface = glow.base[1];
    t.ink = glow.neon;
    t.accent = glow.neon;
    t.glyph = glow.neon;
  }
  const wallBackdrop = glass ? wallpaperBackdrop(t.wallpaper) : [];
  const userText = edits.colours.text;
  const pts = WIDGET_SIZE_POINTS[size];
  const templates = layout(kind, size);
  const textFont = (f: TextTemplate['font']): WidgetFont => (f === 'theme' ? t.font : f ?? 'body');

  // Fill candidates for the widget background: as designed, then more opaque, then flat.
  // A see-through look tries its panes first (faintest first, `pane` = composited over the
  // wallpaper), then falls back to the theme's own ladder.
  const designed: { fill: WidgetFill; opacity: number } = glow
    ? { fill: { kind: 'gradient', from: t.bg[0], to: t.bg[1], angle: 180 }, opacity: 1 }
    : baseFill(t, kind);
  const flatColour = designed.fill.kind === 'solid' ? designed.fill.colour : designed.fill.from;
  const bgCandidates: { fill: WidgetFill; opacity: number; pane?: boolean }[] = look === 'clear' || look === 'tinted'
    ? glassCandidates(look, paneTint).map((c) => ({ fill: { kind: 'solid', colour: c.tint } as WidgetFill, opacity: c.opacity, pane: true }))
    : [];
  bgCandidates.push(designed);
  for (const o of OPACITY_STEPS) if (o > designed.opacity) bgCandidates.push({ fill: designed.fill, opacity: o });
  if (designed.fill.kind === 'gradient') {
    const g = designed.fill;
    bgCandidates.push({ fill: { ...g, to: mix(g.from, g.to, 0.5) }, opacity: 1 });
  }
  bgCandidates.push({ fill: { kind: 'solid', colour: flatColour }, opacity: 1 });

  // Own fills for band / scrim / photo placeholder.
  const ownFill = (role: RegionRole): { fill: WidgetFill; opacities: number[] } | null => {
    if (role === 'band') return { fill: { kind: 'solid', colour: t.accent }, opacities: [1] };
    if (role === 'scrim') return { fill: { kind: 'solid', colour: t.bg[0] }, opacities: [SCRIM_OPACITY, ...OPACITY_STEPS] };
    if (role === 'photo') return { fill: { kind: 'gradient', from: t.accent, to: t.surface, angle: 135 }, opacities: [1] };
    return null;
  };

  const prefsFor = (tt: TextTemplate, onColour: string): string[] => {
    const themed = tt.prefer === 'accent' ? [t.accent, t.ink] : tt.prefer === 'bg' ? [t.bg[0], t.surface, t.ink] : [t.ink, t.accent];
    // On the quote gradient (accent), the background colour usually reads better than ink.
    const list = kind === 'quote' ? [t.bg[0], t.surface, t.ink] : themed;
    const inverted = minContrast('#000000', [onColour]) >= minContrast('#FFFFFF', [onColour]) ? '#000000' : '#FFFFFF';
    return [...list, inverted];
  };

  // A user text colour is kept when it passes, else nudged (same hue) before theme colours are tried.
  // 4.5:1, or 3:1 for large numerals under a T65 look (widgetLook.textMinContrast).
  const solveText = (tt: TextTemplate, backdrop: string[], onColour: string): Solved | null => {
    const min = textMinContrast(look, tt.source, tt.sizePt, tt.weight ?? 'regular');
    if (userText) {
      const c = ensureContrast(userText, backdrop, min);
      if (c) return { colour: c, backdrop, contrast: round3(minContrast(c, backdrop)) };
    }
    return solveOn(prefsFor(tt, onColour), backdrop, min);
  };

  let textAdjusted = false;

  const solveAll = (bgFill: WidgetFill, bgOpacity: number, pane: boolean): WidgetRegion[] | null => {
    const surfaces = new Map<string, { backdrop: string[]; first: string }>();
    let bgSamples = pane && bgFill.kind === 'solid' ? paneSamples(bgFill.colour, bgOpacity, wallBackdrop) : fillSamples(bgFill, bgOpacity);
    // Glow: foregrounds are also checked against the base under their own halo.
    if (glow) bgSamples = dedupe([...bgSamples, ...bgSamples.map((b) => composite(glow.neon, GLOW_HALO_OPACITY, b))]);
    surfaces.set('background', { backdrop: bgSamples, first: bgSamples[0] });
    const out: WidgetRegion[] = [];
    for (const r of templates) {
      const [x, y, w, h] = r.frame;
      const own = ownFill(r.role);
      const on = r.on ?? 'background';
      const region: WidgetRegion = {
        id: r.id,
        role: r.role,
        frame: { x, y, w, h },
        on,
        fill: null,
        fillOpacity: 1,
        colour: null,
        backdrop: [],
        contrast: 0,
        text: null,
        meter: null,
      };
      if (own) {
        // A photo can be anything: a scrim over it is bounded over black and white.
        let chosen: { opacity: number; samples: string[] } | null = null;
        for (const o of own.opacities) {
          const samples = fillSamples(own.fill, o);
          chosen = { opacity: o, samples };
          const kids = templates.filter((k) => k.on === r.id && k.text);
          if (kids.every((k) => solveText(k.text!, samples, samples[0]))) break;
        }
        region.fill = own.fill;
        region.fillOpacity = chosen!.opacity;
        surfaces.set(r.id, { backdrop: chosen!.samples, first: chosen!.samples[0] });
      }
      const surface = surfaces.get(on) ?? surfaces.get('background')!;
      if (r.text) {
        const solved = solveText(r.text, surface.backdrop, surface.first);
        if (!solved) return null;
        if (userText && solved.colour !== normalizeHex(userText)) textAdjusted = true;
        region.colour = solved.colour;
        region.backdrop = solved.backdrop;
        region.contrast = solved.contrast;
        const tt = r.text;
        const user = tt.editable ? edits.text[r.id] ?? null : null;
        region.text = {
          source: tt.source,
          key: tt.key ?? null,
          userText: user,
          editable: tt.editable === true,
          maxLength: tt.maxLength ?? 0,
          font: textFont(tt.font),
          sizePt: tt.sizePt,
          weight: tt.weight ?? 'regular',
          align: tt.align ?? 'start',
        };
      } else if (r.role === 'glyph') {
        const solved = solveOn([t.glyph, t.accent, t.ink], surface.backdrop, GRAPHIC_MIN_CONTRAST);
        if (!solved) return null;
        Object.assign(region, solved);
      } else if (r.role === 'meter' && r.meter) {
        const track = mix(surface.first, t.ink, 0.12);
        const solved = solveOn([t.accent, t.ink], [track, ...surface.backdrop], GRAPHIC_MIN_CONTRAST);
        if (!solved) return null;
        Object.assign(region, solved);
        region.meter = { shape: r.meter.shape, track, sampleLevel: r.meter.sampleLevel };
      }
      out.push(region);
    }
    return out;
  };

  // Lowest contrast any text drawn straight on the background needs (for the pane pre-check).
  const bgTextMin = templates
    .filter((r) => r.text && (r.on ?? 'background') === 'background')
    .reduce((m, r) => Math.min(m, textMinContrast(look, r.text!.source, r.text!.sizePt, r.text!.weight ?? 'regular')), Infinity);

  let regions: WidgetRegion[] | null = null;
  let bg = bgCandidates[0];
  for (const c of bgCandidates) {
    // A see-through pane no text colour could read on is skipped without the full solve.
    if (c.pane && c.fill.kind === 'solid' && Number.isFinite(bgTextMin) && !backdropFeasible(paneSamples(c.fill.colour, c.opacity, wallBackdrop), bgTextMin)) continue;
    textAdjusted = false;
    regions = solveAll(c.fill, c.opacity, c.pane === true);
    bg = c;
    if (regions) break;
  }
  if (!regions) throw new Error(`widgetSets: no AA colours for ${t.themeId}/${kind}/${size}`); // unreachable: flat fill + black/white always passes

  const editableText = regions.some((r) => r.text?.editable);
  const spec: WidgetSpec = {
    id: `${t.themeId}:${kind}:${size}`,
    themeId: t.themeId,
    kind,
    size,
    nameKey: widgetKindKey(kind),
    width: pts.width,
    height: pts.height,
    cornerRadius: CORNER_RADIUS_BY_SHAPE[t.shape] ?? CORNER_RADIUS_BY_SHAPE.squircle,
    surface: glass && bg.pane ? 'glass' : glow ? 'solid' : t.style,
    background: bg.fill,
    backgroundOpacity: bg.opacity,
    border: t.style === 'outline' && look === 'theme' ? { colour: pickColour([t.accent, t.ink], fillSamples(bg.fill, bg.opacity), GRAPHIC_MIN_CONTRAST) ?? t.ink, width: 2 } : null,
    accent: t.accent,
    font: t.font,
    typeface: t.typeface,
    glyphSet: t.glyphSet,
    motif: t.motif,
    regions,
    editable: { text: editableText, photo: kind === 'photo', colours: true },
    photoRef: kind === 'photo' ? edits.photoRef : null,
    countdownTo: kind === 'quote' && regions.some((r) => r.text?.source === 'countdown') ? edits.countdownTo : null,
    tokens: { ...tokens0, bg: [...tokens0.bg], wallpaper: [...tokens0.wallpaper] },
    edits: cloneEdits(edits),
    look,
    glow: glow ? { colour: glow.neon, opacity: GLOW_HALO_OPACITY, radius: GLOW_RADIUS_PT } : null,
  };
  return { spec, textAdjusted };
}

function cloneEdits(e: AppliedEdits): AppliedEdits {
  return {
    text: { ...e.text },
    photoRef: e.photoRef,
    countdownTo: e.countdownTo,
    colours: { background: e.colours.background ? [...e.colours.background] : null, accent: e.colours.accent, text: e.colours.text },
    look: e.look,
  };
}

// Shared with the widget catalogue (src/core/widgetKinds.ts) so every widget solves colours the same way.

/** Colours a foreground on `fill` must be checked against (gradient samples; translucency bounded over black and white). */
export const widgetFillSamples = (fill: WidgetFill, opacity: number): string[] => fillSamples(fill, opacity);
/** First preference reaching `min` on every backdrop colour, else the nearest adjusted shade, else null. */
export const pickReadableColour = (prefs: readonly string[], backdrop: readonly string[], min: number): string | null => pickColour(prefs, backdrop, min);
/** A bare App Group image file name a photo widget may reference. */
export const isWidgetPhotoRef = (v: unknown): v is string => typeof v === 'string' && PHOTO_REF.test(v);

// ---------------------------------------------------------------------------------- public API

/** All 15 specs for a set of tokens (kind-major: clock small/medium/large, date …). */
export function generateWidgetSetFromTokens(tokens: WidgetTokens): WidgetSet {
  const t = normaliseTokens(tokens);
  const specs: WidgetSpec[] = [];
  for (const kind of WIDGET_KINDS) for (const size of WIDGET_SIZES) specs.push(build(t, kind, size, emptyEdits()).spec);
  return { themeId: t.themeId, name: t.name, tokens: t, specs };
}

/** The theme's matching widget set: 5 kinds × 3 sizes. Deterministic. */
export function generateWidgetSet(theme: Theme): WidgetSet {
  return generateWidgetSetFromTokens(widgetTokensFrom(theme));
}

/** One spec from a set. */
export function widgetSpecOf(set: WidgetSet, kind: WidgetKind, size: WidgetSize): WidgetSpec | undefined {
  return set.specs.find((s) => s.kind === kind && s.size === size);
}

/** Clean user text: drop control characters, collapse whitespace, trim. */
export function cleanWidgetText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
}

function validDay(s: string): boolean {
  const m = ISO_DAY.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Apply Widget Studio edits to a spec (merged onto the edits it already carries). Invalid edits
 * are dropped with an issue; text is cleaned and clipped to the region's limit; a text colour
 * that can't reach AA on this widget is replaced by the nearest readable shade
 * ('contrastAdjusted'). The returned spec always meets AA. Never throws.
 */
export function applyWidgetEdits(spec: WidgetSpec, edits: WidgetEdits): { spec: WidgetSpec; issues: WidgetEditIssue[] } {
  const issues: WidgetEditIssue[] = [];
  const issue = (field: string, code: WidgetEditIssueCode) => issues.push({ field, code, messageKey: widgetIssueKey(code) });
  const next = cloneEdits(spec.edits);
  const e = edits && typeof edits === 'object' ? edits : {};

  if (e.text && typeof e.text === 'object') {
    for (const [id, value] of Object.entries(e.text)) {
      const field = `text.${id}`;
      const region = spec.regions.find((r) => r.id === id);
      if (!region) { issue(field, 'unknownRegion'); continue; }
      if (!region.text?.editable) { issue(field, 'notEditable'); continue; }
      if (value === null || value === undefined || (typeof value === 'string' && cleanWidgetText(value) === '')) {
        if (typeof value === 'string' && value.length > 0) issue(field, 'emptyText');
        delete next.text[id];
        continue;
      }
      if (typeof value !== 'string') { issue(field, 'notEditable'); continue; }
      let s = cleanWidgetText(value);
      const chars = [...s];
      if (chars.length > region.text.maxLength) {
        s = chars.slice(0, region.text.maxLength).join('').trimEnd();
        issue(field, 'tooLong');
      }
      next.text[id] = s;
    }
  }

  if ('photoRef' in e) {
    if (spec.kind !== 'photo') issue('photoRef', 'notSupported');
    else if (e.photoRef === null || e.photoRef === undefined) next.photoRef = null;
    else if (typeof e.photoRef === 'string' && PHOTO_REF.test(e.photoRef)) next.photoRef = e.photoRef;
    else issue('photoRef', 'invalidPhoto');
  }

  if ('countdownTo' in e) {
    const supported = spec.regions.some((r) => r.text?.source === 'countdown');
    if (!supported) issue('countdownTo', 'notSupported');
    else if (e.countdownTo === null || e.countdownTo === undefined) next.countdownTo = null;
    else if (typeof e.countdownTo === 'string' && validDay(e.countdownTo)) next.countdownTo = e.countdownTo;
    else issue('countdownTo', 'invalidDate');
  }

  const c = e.colours;
  if (c && typeof c === 'object') {
    if ('background' in c) {
      const v = c.background;
      if (v === null || v === undefined) next.colours.background = null;
      else {
        const list = typeof v === 'string' ? [v] : Array.isArray(v) ? v : [];
        const ok = list.length >= 1 && list.length <= 2 && list.every((x) => typeof x === 'string' && isHex(x));
        if (ok) {
          const norm = list.map(normalizeHex);
          next.colours.background = norm.length === 2 && norm[0] === norm[1] ? [norm[0]] : norm;
        } else issue('colours.background', 'invalidColour');
      }
    }
    for (const k of ['accent', 'text'] as const) {
      if (!(k in c)) continue;
      const v = c[k];
      if (v === null || v === undefined) next.colours[k] = null;
      else if (typeof v === 'string' && isHex(v)) next.colours[k] = normalizeHex(v);
      else issue(`colours.${k}`, 'invalidColour');
    }
  }

  if ('look' in e) {
    if (e.look === null || e.look === undefined) next.look = 'theme';
    else if (isWidgetLook(e.look)) next.look = e.look;
    else issue('look', 'notSupported');
  }

  const { spec: out, textAdjusted } = build(spec.tokens, spec.kind, spec.size, next);
  if (textAdjusted && next.colours.text) issue('colours.text', 'contrastAdjusted');
  return { spec: out, issues };
}

/** Rebuild a spec from tokens + raw edits (used by parse; tolerant). */
function rebuild(tokens: WidgetTokens, kind: WidgetKind, size: WidgetSize, raw: unknown): WidgetSpec {
  const base = build(tokens, kind, size, emptyEdits()).spec;
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const colours = o.colours && typeof o.colours === 'object' ? (o.colours as Record<string, unknown>) : {};
  const edits: WidgetEdits = {
    text: o.text && typeof o.text === 'object' && !Array.isArray(o.text) ? (o.text as Record<string, string>) : undefined,
    colours: {
      background: (colours.background ?? null) as WidgetColourEdits['background'],
      accent: (colours.accent ?? null) as string | null,
      text: (colours.text ?? null) as string | null,
    },
  };
  if (kind === 'photo') edits.photoRef = (o.photoRef ?? null) as string | null;
  if (base.regions.some((r) => r.text?.source === 'countdown')) edits.countdownTo = (o.countdownTo ?? null) as string | null;
  // T65: payloads written before looks existed have no `look` (= the theme look).
  if (isWidgetLook(o.look)) edits.look = o.look;
  return applyWidgetEdits(base, edits).spec;
}

// ---------------------------------------------------------------------------------- payload

/** Resolve an i18n key (and the device-language text) for the payload. */
export type WidgetTranslate = (key: string) => string;

export type WidgetSetPayload = {
  v: 2;
  /** The v1 theme block, byte-compatible with `glaze.theme.v1` (older extensions keep working). */
  theme: WidgetTheme;
  set: WidgetSet;
  /** Region text resolved in the app's language at write time: spec id → region id → text. */
  texts: Record<string, Record<string, string>>;
  updatedAt: string;
};

function specJson(s: WidgetSpec): Record<string, unknown> {
  // Fixed key order: stable, diff-friendly JSON.
  return {
    id: s.id,
    kind: s.kind,
    size: s.size,
    nameKey: s.nameKey,
    width: s.width,
    height: s.height,
    cornerRadius: s.cornerRadius,
    surface: s.surface,
    background: s.background,
    backgroundOpacity: s.backgroundOpacity,
    border: s.border,
    accent: s.accent,
    font: s.font,
    typeface: s.typeface,
    glyphSet: s.glyphSet,
    motif: s.motif,
    regions: s.regions,
    editable: s.editable,
    photoRef: s.photoRef,
    countdownTo: s.countdownTo,
    edits: s.edits,
    look: s.look,
    glow: s.glow,
  };
}

/**
 * Serialise a set for the App Group (key WIDGET_SET_KEY). The extension renders `specs` as-is;
 * `theme` is the unchanged v1 block. With `translate`, each text region's display text (user
 * text, else its sample key in the app's language) is included under `texts`.
 */
export function serialiseWidgetSet(set: WidgetSet, opts: { translate?: WidgetTranslate; now?: Date } = {}): string {
  const now = opts.now ?? new Date();
  const theme = parseWidgetTheme({ ...v1ThemeOf(set.tokens), updatedAt: now.toISOString() }) ?? DEFAULT_WIDGET_THEME;
  const texts: Record<string, Record<string, string>> = {};
  for (const s of set.specs) {
    const row: Record<string, string> = {};
    for (const r of s.regions) {
      if (!r.text) continue;
      if (r.text.userText) row[r.id] = r.text.userText;
      else if (r.text.key && opts.translate) row[r.id] = String(opts.translate(r.text.key)).slice(0, 200);
    }
    if (Object.keys(row).length) texts[s.id] = row;
  }
  return JSON.stringify({
    v: WIDGET_SET_VERSION,
    theme: JSON.parse(serializeWidgetTheme(theme)),
    tokens: set.tokens,
    specs: set.specs.map(specJson),
    texts,
    updatedAt: now.toISOString(),
  });
}

function v1ThemeOf(t: WidgetTokens): Record<string, unknown> {
  return { v: 1, themeId: t.themeId, name: t.name, bg: t.bg, surface: t.surface, accent: t.accent, ink: t.ink, style: t.style, font: t.font };
}

/**
 * Tolerant parse of a v2 widget-set payload, or a bare v1 theme payload (upgraded by generating
 * its set). Specs are rebuilt from tokens + edits, so a tampered payload can't produce unreadable
 * colours. Returns null for non-objects and unknown versions. Never throws.
 */
export function parseWidgetSetPayload(input: unknown): WidgetSetPayload | null {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  if (o.v === 1 || (o.v === undefined && !('specs' in o))) {
    const theme = parseWidgetTheme(o);
    if (!theme) return null;
    return { v: 2, theme, set: generateWidgetSetFromTokens(tokensFromWidgetTheme(theme)), texts: {}, updatedAt: theme.updatedAt };
  }
  if (o.v !== WIDGET_SET_VERSION) return null;

  const theme = parseWidgetTheme(o.theme ?? {}) ?? DEFAULT_WIDGET_THEME;
  const tokens = o.tokens ? normaliseTokens(o.tokens) : tokensFromWidgetTheme(theme);
  const byId = new Map<string, Record<string, unknown>>();
  if (Array.isArray(o.specs)) {
    for (const s of o.specs) {
      if (s && typeof s === 'object' && typeof (s as Record<string, unknown>).kind === 'string') {
        const r = s as Record<string, unknown>;
        byId.set(`${r.kind}:${r.size}`, r);
      }
    }
  }
  const specs: WidgetSpec[] = [];
  for (const kind of WIDGET_KINDS) {
    for (const size of WIDGET_SIZES) specs.push(rebuild(tokens, kind, size, byId.get(`${kind}:${size}`)?.edits));
  }
  const texts: Record<string, Record<string, string>> = {};
  if (o.texts && typeof o.texts === 'object' && !Array.isArray(o.texts)) {
    const ids = new Set(specs.map((s) => s.id));
    for (const [sid, row] of Object.entries(o.texts as Record<string, unknown>)) {
      if (!ids.has(sid) || !row || typeof row !== 'object') continue;
      const clean: Record<string, string> = {};
      for (const [rid, v] of Object.entries(row as Record<string, unknown>)) if (typeof v === 'string') clean[rid] = v.slice(0, 200);
      texts[sid] = clean;
    }
  }
  const updatedAt = typeof o.updatedAt === 'string' && !Number.isNaN(Date.parse(o.updatedAt)) ? o.updatedAt : theme.updatedAt;
  return { v: 2, theme, set: { themeId: tokens.themeId, name: tokens.name, tokens, specs }, texts, updatedAt };
}
