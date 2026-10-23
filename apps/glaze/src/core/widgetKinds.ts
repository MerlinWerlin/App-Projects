// Widget catalogue (T72, L3; docs/WIDGETS.md "Widget catalogue").
//
// Ten more widget kinds on top of the 5 × 3 theme set in widgetSets.ts (which is unchanged):
// analog clock, month calendar, countdown, year / month progress dots, rotating photo album and
// four manual habit trackers (water, mood, sleep, steps). Besides the home sizes they come in
// StandBy and Lock Screen accessory sizes (circular / rectangular / inline).
//
// Colours come from the same theme tokens and the same AA rules as the theme set: text ≥ 4.5:1,
// graphics (glyph, meter, dial, dots, button edge) ≥ 3:1 against everything they can sit on.
// StandBy removes the widget background and shows it on black, so StandBy specs are solved on
// black. Accessory widgets are tinted by the system (monochrome / vibrant on the Lock Screen):
// they carry tint levels (primary / secondary) rather than colours, checked against a modelled
// dark backdrop.
//
// Copy is i18n keys only (`widgets.*`). Interactive buttons are described as App Intent ids in
// `action` regions; the native buttons are T73. Nothing here reads other apps (no weather, no
// now playing, no health data: steps are typed in).
//
// T85: every catalogue kind also comes in the T65 looks (widgetLook.ts). Home sizes take all four
// (theme / clear glass / tinted glass / glow); StandBy, already on black, takes theme or glow;
// Lock Screen accessory sizes are tinted by the system and keep the theme look. Under a look, text
// keeps WCAG AA (4.5:1; 3:1 only for large numerals, widgetLook.textMinContrast) against
// everything it can sit on: for glass, every colour the wallpaper (the theme's, or colours sampled
// from the user's own photo, wallpaperPalette.ts) can show through the pane.
//
// Pure TS, deterministic, no clock reads: time-dependent helpers take `now`.

import { composite, contrastRatio, ensureContrast, isHex, minContrast, mix, normalizeHex } from './colour.ts';
import { dotGrid, isDayKey, localParts, type DayKey } from './calendarMaths.ts';
import { HABIT_DEFS, WIDGET_INTENTS, type HabitKind, type WidgetIntent } from './habits.ts';
import type { Theme } from './themes.ts';
import {
  CORNER_RADIUS_BY_SHAPE,
  GRAPHIC_MIN_CONTRAST,
  TEXT_MIN_CONTRAST,
  WIDGET_KINDS,
  WIDGET_SIZES,
  cleanWidgetText,
  isWidgetPhotoRef,
  normaliseTokens,
  parseWidgetSetPayload,
  pickReadableColour,
  serialiseWidgetSet,
  widgetFillSamples,
  widgetKindKey,
  widgetTokensFrom,
  type TextSlot,
  type TextSource,
  type WidgetColourEdits,
  type WidgetEditIssueCode,
  type WidgetFill,
  type WidgetSet,
  type WidgetSetPayload,
  type WidgetTokens,
  type WidgetTranslate,
} from './widgetSets.ts';
import type { WidgetFont, WidgetSurfaceStyle } from './widgetTheme.ts';
import {
  GLOW_HALO_OPACITY,
  GLOW_RADIUS_PT,
  WIDGET_LOOKS,
  backdropFeasible,
  glassCandidates,
  glowPalette,
  isWidgetLook,
  paneSamples,
  suitsGlow,
  textMinContrast,
  wallpaperBackdrop,
  type WidgetLook,
} from './widgetLook.ts';

// ---------------------------------------------------------------------------------- constants

export const CATALOGUE_KINDS = Object.freeze([
  'analogClock',
  'monthCalendar',
  'countdown',
  'yearProgress',
  'monthProgress',
  'photoAlbum',
  'habitWater',
  'habitMood',
  'habitSleep',
  'habitSteps',
] as const);
export type CatalogueKind = (typeof CATALOGUE_KINDS)[number];

export const CATALOGUE_SIZES = Object.freeze([
  'small',
  'medium',
  'large',
  'standby',
  'accessoryCircular',
  'accessoryRectangular',
  'accessoryInline',
] as const);
export type CatalogueSize = (typeof CATALOGUE_SIZES)[number];
export const ACCESSORY_SIZES = Object.freeze(['accessoryCircular', 'accessoryRectangular', 'accessoryInline'] as const);

export type CatalogueFamily = 'home' | 'standby' | 'accessory';

/** Nominal canvas in points. StandBy shows a small widget scaled up; accessory sizes are iPhone-class. VERIFY on device. */
export const CATALOGUE_SIZE_POINTS: Readonly<Record<CatalogueSize, { width: number; height: number }>> = Object.freeze({
  small: { width: 170, height: 170 },
  medium: { width: 364, height: 170 },
  large: { width: 364, height: 382 },
  standby: { width: 170, height: 170 },
  accessoryCircular: { width: 72, height: 72 },
  accessoryRectangular: { width: 160, height: 72 },
  accessoryInline: { width: 257, height: 26 },
});

/** Which sizes each kind comes in. */
export const CATALOGUE_KIND_SIZES: Readonly<Record<CatalogueKind, readonly CatalogueSize[]>> = Object.freeze({
  analogClock: ['small', 'large', 'standby', 'accessoryCircular'],
  monthCalendar: ['medium', 'large', 'standby'],
  countdown: ['small', 'medium', 'standby', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  yearProgress: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  monthProgress: ['small', 'medium', 'accessoryCircular', 'accessoryInline'],
  photoAlbum: ['small', 'medium', 'large'],
  habitWater: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  habitMood: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular'],
  habitSleep: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  habitSteps: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
} as Record<CatalogueKind, readonly CatalogueSize[]>);

export const HABIT_OF_KIND: Readonly<Partial<Record<CatalogueKind, HabitKind>>> = Object.freeze({
  habitWater: 'water',
  habitMood: 'mood',
  habitSleep: 'sleep',
  habitSteps: 'steps',
});

/** Payload: the catalogue rides in the glaze.widgets.v2 JSON under `catalogue` (older readers ignore it). */
export const WIDGET_CATALOGUE_VERSION = 1;

/** Photo album: rotation intervals offered (minutes) and the photo limit. */
export const ALBUM_INTERVALS = Object.freeze([15, 30, 60, 180, 360, 720, 1440] as const);
export const ALBUM_DEFAULT_INTERVAL = 60;
export const ALBUM_MAX_PHOTOS = 12;

/**
 * Accessory widgets: the system draws content as light, vibrant tint levels over the Lock Screen.
 * Modelled worst case for the material behind them (dark, translucent). VERIFY against a device.
 */
export const ACCESSORY_BACKDROP = Object.freeze(['#000000', '#3A3A3C'] as const);
export const ACCESSORY_TINT_OPACITY: Readonly<Record<'primary' | 'secondary', number>> = Object.freeze({ primary: 1, secondary: 0.7 });
const ACCESSORY_TRACK_OPACITY = 0.25;

const STANDBY_BG = '#000000';
const GLASS_OPACITY = 0.82;
const SCRIM_OPACITY = 0.85;
const OPACITY_STEPS = [0.92, 1];
const S = 'widgets.sample';

export const catalogueKindKey = (kind: CatalogueKind): string => `widgets.kind.${kind}`;
export const catalogueSizeKey = (size: CatalogueSize): string => `widgets.size.${size}`;
export const catalogueIssueKey = (code: CatalogueIssueCode): string => `widgets.issue.${code}`;
export const catalogueActionKey = (id: string): string => `widgets.action.${id}`;

export function familyOf(size: CatalogueSize): CatalogueFamily {
  if (size === 'standby') return 'standby';
  return (ACCESSORY_SIZES as readonly string[]).includes(size) ? 'accessory' : 'home';
}

export function isCatalogueKind(v: unknown): v is CatalogueKind {
  return typeof v === 'string' && (CATALOGUE_KINDS as readonly string[]).includes(v);
}

export function isCatalogueSize(v: unknown): v is CatalogueSize {
  return typeof v === 'string' && (CATALOGUE_SIZES as readonly string[]).includes(v);
}

/**
 * T85: looks a catalogue size can take, in studio order (dark themes get glow right after their
 * own look, as studioLooks does). StandBy has no background to make glass of; accessory sizes are
 * tinted by the system.
 */
export function catalogueLooksFor(family: CatalogueFamily, tokens?: Pick<WidgetTokens, 'bg'>): WidgetLook[] {
  if (family === 'accessory') return ['theme'];
  if (family === 'standby') return ['theme', 'glow'];
  if (tokens && suitsGlow(tokens.bg)) return ['theme', 'glow', 'clear', 'tinted'];
  return [...WIDGET_LOOKS];
}

// ---------------------------------------------------------------------------------- combined list

export type CatalogueGroup = 'classic' | 'time' | 'calendar' | 'progress' | 'photo' | 'habits';

export type CatalogueEntry = {
  kind: string;
  sizes: readonly string[];
  nameKey: string;
  group: CatalogueGroup;
  /** 'set': generated by widgetSets.ts (WidgetSpec); 'catalogue': by this module (CatalogueSpec). */
  module: 'set' | 'catalogue';
};

const GROUP_OF: Record<CatalogueKind, CatalogueGroup> = {
  analogClock: 'time',
  monthCalendar: 'calendar',
  countdown: 'calendar',
  yearProgress: 'progress',
  monthProgress: 'progress',
  photoAlbum: 'photo',
  habitWater: 'habits',
  habitMood: 'habits',
  habitSleep: 'habits',
  habitSteps: 'habits',
};

/** Every widget Glaze offers: the 5 theme-set kinds (3 sizes each) then the catalogue kinds. */
export const WIDGET_CATALOGUE: readonly CatalogueEntry[] = Object.freeze([
  ...WIDGET_KINDS.map((kind): CatalogueEntry => ({ kind, sizes: WIDGET_SIZES, nameKey: widgetKindKey(kind), group: 'classic', module: 'set' })),
  ...CATALOGUE_KINDS.map((kind): CatalogueEntry => ({ kind, sizes: CATALOGUE_KIND_SIZES[kind], nameKey: catalogueKindKey(kind), group: GROUP_OF[kind], module: 'catalogue' })),
]);

// ---------------------------------------------------------------------------------- types

export type CatalogueTextSource =
  | TextSource
  /** "203/365" style day-of-period (renderer formats numbers in the device locale). */
  | 'yearProgress'
  | 'monthProgress'
  /** Percent of the spec's progress binding (year or month). */
  | 'progressPercent'
  /** Today's habit value with its unit; mood shows the level's label. */
  | 'habitValue'
  | 'habitGoal';

export type CatalogueTextSlot = Omit<TextSlot, 'source'> & { source: CatalogueTextSource };

export type CatalogueRegionRole = 'text' | 'glyph' | 'photo' | 'scrim' | 'band' | 'meter' | 'dial' | 'dots' | 'action';

export type Tint = 'primary' | 'secondary';

export type CatalogueRegion = {
  id: string;
  role: CatalogueRegionRole;
  /** Fractions of the canvas, origin top-start (mirrors in RTL). */
  frame: { x: number; y: number; w: number; h: number };
  on: string;
  fill: WidgetFill | null;
  fillOpacity: number;
  /** Foreground: text, glyph, hands, filled dots / meter, button glyph. Accessory: '#FFFFFF' (tinted by the system). */
  colour: string | null;
  backdrop: string[];
  contrast: number;
  text: CatalogueTextSlot | null;
  /** Symbol id the renderer draws: 'theme' (the theme glyph) or a catalogue symbol (water, moon, steps, mood, hourglass, next, plus, minus, mood1–5). */
  symbol: string | null;
  meter: { shape: 'ring' | 'bar'; track: string; sampleLevel: number } | null;
  dial: { numerals: boolean; ticks: 12 | 60; tick: string; hand: string } | null;
  /** Progress dots: `count` is the nominal maximum (366 / 31); the renderer lays out the real total. */
  dots: { source: 'year' | 'month'; count: number; columns: number; rows: number; track: string; today: string } | null;
  /** Month grid: the today marker and its number. */
  grid: { todayFill: string; todayText: string; contrast: number } | null;
  action: { id: string; intent: WidgetIntent; labelKey: string } | null;
  /** Accessory (monochrome) only. */
  tint: Tint | null;
  tintOpacity: number | null;
};

export type CatalogueEdits = {
  text?: Readonly<Record<string, string | null>>;
  colours?: WidgetColourEdits;
  /** Countdown target `YYYY-MM-DD` (countdown widgets). null clears it. */
  countdownTo?: string | null;
  /** App Group file names, in order (photo album). null clears. */
  photoRefs?: readonly string[] | null;
  /** Minutes between photos, one of ALBUM_INTERVALS (photo album). */
  rotateMinutes?: number | null;
  /** T85 look (catalogueLooksFor). null resets to 'theme'. */
  look?: WidgetLook | null;
};

export type CatalogueAppliedEdits = {
  text: Record<string, string>;
  colours: { background: string[] | null; accent: string | null; text: string | null };
  countdownTo: string | null;
  photoRefs: string[];
  rotateMinutes: number;
  look: WidgetLook;
};

export type CatalogueIssueCode = WidgetEditIssueCode | 'invalidInterval' | 'tooManyPhotos';
export type CatalogueIssue = { field: string; code: CatalogueIssueCode; messageKey: string };

export type CatalogueSpec = {
  id: string;
  themeId: string;
  kind: CatalogueKind;
  size: CatalogueSize;
  family: CatalogueFamily;
  nameKey: string;
  sizeKey: string;
  width: number;
  height: number;
  cornerRadius: number;
  /** 'monochrome' for accessory sizes: the system tints; only tint levels are meaningful. */
  rendering: 'fullColour' | 'monochrome';
  surface: WidgetSurfaceStyle;
  /** Null for accessory sizes (system material, see `accessoryBackground`). */
  background: WidgetFill | null;
  backgroundOpacity: number;
  border: { colour: string; width: number } | null;
  /** Theme accent (accessory: a hint for the system's accented mode). */
  accent: string;
  font: WidgetFont;
  typeface: string;
  glyphSet: string;
  motif: string | null;
  /** StandBy drops the container background and tints red at night (system behaviour). */
  standby: { removesBackground: true; nightMode: 'systemRed' } | null;
  /** Draw the system accessory backdrop (circular / rectangular). */
  accessoryBackground: boolean;
  regions: CatalogueRegion[];
  binding: { habit: HabitKind | null; progress: 'year' | 'month' | null };
  countdownTo: DayKey | null;
  photoRefs: string[];
  rotateMinutes: number;
  /** What a tap outside any button does. */
  tap: WidgetIntent;
  editable: { text: boolean; photo: boolean; colours: boolean; countdown: boolean };
  tokens: WidgetTokens;
  edits: CatalogueAppliedEdits;
  /**
   * T85 look (as WidgetSpec.look). 'clear' / 'tinted': `background` is the pane tint and
   * `backgroundOpacity` its opacity over the wallpaper, `surface` 'glass'. 'glow': a dark base
   * (black in StandBy) and `glow` describes the halo around text and graphics.
   */
  look: WidgetLook;
  glow: { colour: string; opacity: number; radius: number } | null;
};

export type WidgetCatalogue = { themeId: string; name: string; tokens: WidgetTokens; specs: CatalogueSpec[] };

// ---------------------------------------------------------------------------------- layouts

type F = [number, number, number, number];

type TextTpl = {
  source: CatalogueTextSource;
  key?: string;
  editable?: boolean;
  maxLength?: number;
  font?: 'display' | 'body' | 'theme';
  sizePt: number;
  weight?: TextSlot['weight'];
  align?: TextSlot['align'];
  prefer?: 'ink' | 'bg';
  tint?: Tint;
};

type Tpl = {
  id: string;
  role: CatalogueRegionRole;
  frame: F;
  on?: string;
  text?: TextTpl;
  symbol?: string;
  meter?: { shape: 'ring' | 'bar'; sampleLevel: number };
  dial?: { numerals: boolean; ticks: 12 | 60 };
  dots?: 'year' | 'month';
  grid?: true;
  action?: { id: string; intent: WidgetIntent };
  tint?: Tint;
};

const tx = (id: string, frame: F, text: TextTpl, on = 'background'): Tpl => ({ id, role: 'text', frame, on, text });
const gl = (frame: F, symbol = 'theme', id = 'glyph', on = 'background'): Tpl => ({ id, role: 'glyph', frame, symbol, on });
const btn = (id: string, frame: F, symbol: string, intent: WidgetIntent, on = 'background'): Tpl => ({ id, role: 'action', frame, symbol, action: { id, intent }, on });

const HABIT_SYMBOL: Record<HabitKind, string> = { water: 'water', mood: 'mood', sleep: 'moon', steps: 'steps' };
const HABIT_SAMPLE: Record<HabitKind, string> = { water: `${S}.habitWater`, mood: `${S}.habitMood`, sleep: `${S}.habitSleep`, steps: `${S}.habitSteps` };

function inc(habit: HabitKind): WidgetIntent {
  return { intent: WIDGET_INTENTS.habitIncrement, params: { habit } };
}
function dec(habit: HabitKind): WidgetIntent {
  return { intent: WIDGET_INTENTS.habitDecrement, params: { habit } };
}

function layout(kind: CatalogueKind, size: CatalogueSize): Tpl[] {
  const habit = HABIT_OF_KIND[kind];
  if (habit) return habitLayout(habit, size);
  switch (kind) {
    case 'analogClock':
      if (size === 'small') return [{ id: 'dial', role: 'dial', frame: [0.08, 0.08, 0.84, 0.84], dial: { numerals: false, ticks: 12 } }];
      if (size === 'large')
        return [
          { id: 'dial', role: 'dial', frame: [0.1, 0.04, 0.8, 0.762], dial: { numerals: true, ticks: 60 } },
          tx('date', [0.08, 0.84, 0.84, 0.1], { source: 'date', sizePt: 17, align: 'center', weight: 'medium' }),
        ];
      if (size === 'standby') return [{ id: 'dial', role: 'dial', frame: [0.04, 0.04, 0.92, 0.92], dial: { numerals: true, ticks: 12 } }];
      return [{ id: 'dial', role: 'dial', frame: [0, 0, 1, 1], dial: { numerals: false, ticks: 12 } }];
    case 'monthCalendar':
      if (size === 'medium')
        return [
          { id: 'band', role: 'band', frame: [0, 0, 0.3, 1] },
          tx('month', [0.02, 0.12, 0.26, 0.14], { source: 'month', sizePt: 14, weight: 'bold', align: 'center', prefer: 'bg' }, 'band'),
          tx('day', [0.02, 0.32, 0.26, 0.4], { source: 'dayNumber', font: 'theme', sizePt: 48, weight: 'bold', align: 'center', prefer: 'bg' }, 'band'),
          { id: 'grid', role: 'text', frame: [0.34, 0.08, 0.62, 0.84], grid: true, text: { source: 'monthGrid', sizePt: 11 } },
        ];
      if (size === 'large')
        return [
          { id: 'band', role: 'band', frame: [0, 0, 1, 0.16] },
          tx('month', [0.06, 0.04, 0.6, 0.09], { source: 'month', font: 'theme', sizePt: 20, weight: 'bold', prefer: 'bg' }, 'band'),
          tx('weekday', [0.66, 0.04, 0.28, 0.09], { source: 'weekday', sizePt: 15, align: 'end', prefer: 'bg' }, 'band'),
          { id: 'grid', role: 'text', frame: [0.06, 0.22, 0.88, 0.62], grid: true, text: { source: 'monthGrid', sizePt: 15 } },
          tx('note', [0.06, 0.88, 0.88, 0.08], { source: 'text', key: `${S}.dateNote`, editable: true, maxLength: 40, sizePt: 13 }),
        ];
      return [
        tx('month', [0.06, 0.04, 0.88, 0.14], { source: 'month', font: 'theme', sizePt: 16, weight: 'bold' }),
        { id: 'grid', role: 'text', frame: [0.04, 0.2, 0.92, 0.76], grid: true, text: { source: 'monthGrid', sizePt: 12 } },
      ];
    case 'countdown': {
      const title = (frame: F, sizePt: number, extra: Partial<TextTpl> = {}): Tpl =>
        tx('title', frame, { source: 'text', key: `${S}.countdownEvent`, editable: true, maxLength: 24, sizePt, weight: 'medium', ...extra });
      const label = (frame: F, sizePt: number, extra: Partial<TextTpl> = {}): Tpl =>
        tx('label', frame, { source: 'text', key: `${S}.countdownLabel`, editable: true, maxLength: 20, sizePt, ...extra });
      if (size === 'small')
        return [
          tx('days', [0.08, 0.16, 0.84, 0.42], { source: 'countdown', font: 'theme', sizePt: 52, weight: 'bold' }),
          label([0.08, 0.6, 0.84, 0.12], 14),
          title([0.08, 0.76, 0.84, 0.14], 15),
        ];
      if (size === 'medium')
        return [
          gl([0.05, 0.14, 0.09, 0.2], 'hourglass'),
          title([0.18, 0.14, 0.76, 0.2], 17),
          tx('days', [0.05, 0.42, 0.5, 0.46], { source: 'countdown', font: 'theme', sizePt: 56, weight: 'bold' }),
          label([0.58, 0.6, 0.36, 0.2], 15),
        ];
      if (size === 'standby')
        return [
          tx('days', [0.06, 0.1, 0.88, 0.52], { source: 'countdown', font: 'theme', sizePt: 72, weight: 'bold', align: 'center' }),
          label([0.06, 0.64, 0.88, 0.12], 15, { align: 'center' }),
          title([0.06, 0.8, 0.88, 0.14], 16, { align: 'center' }),
        ];
      if (size === 'accessoryCircular')
        return [
          tx('days', [0.1, 0.2, 0.8, 0.4], { source: 'countdown', sizePt: 22, weight: 'bold', align: 'center' }),
          label([0.1, 0.62, 0.8, 0.2], 10, { align: 'center', maxLength: 8, tint: 'secondary' }),
        ];
      if (size === 'accessoryRectangular')
        return [
          title([0, 0.04, 1, 0.3], 14, { weight: 'bold' }),
          tx('days', [0, 0.38, 0.45, 0.56], { source: 'countdown', sizePt: 26, weight: 'bold' }),
          label([0.47, 0.52, 0.53, 0.34], 13, { tint: 'secondary' }),
        ];
      return [gl([0, 0.1, 0.08, 0.8], 'hourglass'), tx('days', [0.1, 0, 0.9, 1], { source: 'countdown', sizePt: 15, key: `${S}.countdownLabel` })];
    }
    case 'yearProgress':
    case 'monthProgress': {
      const p: 'year' | 'month' = kind === 'yearProgress' ? 'year' : 'month';
      const src: CatalogueTextSource = p === 'year' ? 'yearProgress' : 'monthProgress';
      if (size === 'small')
        return [
          tx('label', [0.08, 0.06, 0.6, 0.14], { source: src, sizePt: 14, weight: 'bold' }),
          tx('percent', [0.66, 0.06, 0.26, 0.14], { source: 'progressPercent', sizePt: 14, align: 'end' }),
          { id: 'dots', role: 'dots', frame: [0.08, 0.26, 0.84, 0.68], dots: p },
        ];
      if (size === 'medium')
        return [
          tx('label', [0.05, 0.08, 0.5, 0.16], { source: src, font: 'theme', sizePt: 17, weight: 'bold' }),
          tx('percent', [0.55, 0.08, 0.4, 0.16], { source: 'progressPercent', sizePt: 15, align: 'end' }),
          { id: 'dots', role: 'dots', frame: [0.05, 0.3, 0.9, 0.62], dots: p },
        ];
      if (size === 'accessoryCircular')
        return [
          { id: 'meter', role: 'meter', frame: [0, 0, 1, 1], meter: { shape: 'ring', sampleLevel: 0.56 } },
          tx('percent', [0.15, 0.32, 0.7, 0.36], { source: 'progressPercent', sizePt: 16, weight: 'bold', align: 'center' }),
        ];
      if (size === 'accessoryRectangular')
        return [
          tx('label', [0, 0.06, 1, 0.34], { source: src, sizePt: 15, weight: 'bold' }),
          { id: 'meter', role: 'meter', frame: [0, 0.5, 1, 0.16], meter: { shape: 'bar', sampleLevel: 0.56 }, tint: 'primary' },
          tx('percent', [0, 0.72, 1, 0.26], { source: 'progressPercent', sizePt: 12, tint: 'secondary' }),
        ];
      return [tx('label', [0, 0, 1, 1], { source: src, sizePt: 15 })];
    }
    case 'photoAlbum': {
      const caption = size === 'small' ? 0.26 : 0.24;
      const regions: Tpl[] = [
        { id: 'photo', role: 'photo', frame: [0, 0, 1, 1] },
        { id: 'scrim', role: 'scrim', frame: [0, 1 - caption, 1, caption], on: 'photo' },
        tx('caption', [0.06, 1 - caption + 0.04, size === 'small' ? 0.88 : 0.66, caption - 0.08], {
          source: 'text', key: `${S}.albumCaption`, editable: true, maxLength: size === 'small' ? 24 : 40, sizePt: 14, weight: 'medium',
        }, 'scrim'),
      ];
      if (size !== 'small') {
        const h = caption - 0.06;
        const w = (h * CATALOGUE_SIZE_POINTS[size].height) / CATALOGUE_SIZE_POINTS[size].width;
        regions.push(btn('next', [0.94 - w, 1 - caption + 0.03, w, h], 'next', { intent: WIDGET_INTENTS.albumNext, params: {} }, 'scrim'));
      }
      return regions;
    }
  }
  return [];
}

function habitLayout(habit: HabitKind, size: CatalogueSize): Tpl[] {
  const def = HABIT_DEFS[habit];
  const symbol = HABIT_SYMBOL[habit];
  const name = (frame: F, sizePt: number, extra: Partial<TextTpl> = {}): Tpl =>
    tx('name', frame, { source: 'text', key: HABIT_SAMPLE[habit], editable: true, maxLength: 20, sizePt, weight: 'medium', ...extra });
  const value = (frame: F, sizePt: number, extra: Partial<TextTpl> = {}): Tpl =>
    tx('value', frame, { source: 'habitValue', font: 'theme', sizePt, weight: 'bold', ...extra });
  if (def.mode === 'scale') {
    if (size === 'small')
      return [
        name([0.08, 0.06, 0.84, 0.14], 14),
        gl([0.3, 0.24, 0.4, 0.4], 'mood', 'face'),
        btn('down', [0.08, 0.72, 0.38, 0.22], 'minus', dec(habit)),
        btn('up', [0.54, 0.72, 0.38, 0.22], 'plus', inc(habit)),
      ];
    if (size === 'medium') {
      const out: Tpl[] = [name([0.05, 0.08, 0.6, 0.16], 16), value([0.6, 0.08, 0.35, 0.16], 15, { align: 'end', font: 'body' })];
      for (let i = 1; i <= 5; i++) out.push(btn(`mood${i}`, [0.04 + (i - 1) * 0.19, 0.4, 0.16, 0.48], `mood${i}`, { intent: WIDGET_INTENTS.habitSet, params: { habit, value: i } }));
      return out;
    }
    if (size === 'accessoryCircular') return [gl([0.15, 0.15, 0.7, 0.7], 'mood', 'face')];
    return [name([0, 0.06, 0.7, 0.34], 14, { weight: 'bold' }), gl([0.74, 0.08, 0.26, 0.56], 'mood', 'face'), value([0, 0.5, 0.7, 0.4], 14, { font: 'body', tint: 'secondary' })];
  }
  if (size === 'small')
    return [
      gl([0.08, 0.08, 0.16, 0.16], symbol),
      name([0.3, 0.08, 0.62, 0.16], 14),
      value([0.08, 0.3, 0.84, 0.26], 34),
      tx('goal', [0.08, 0.56, 0.84, 0.12], { source: 'habitGoal', sizePt: 13 }),
      btn('minus', [0.08, 0.72, 0.38, 0.22], 'minus', dec(habit)),
      btn('plus', [0.54, 0.72, 0.38, 0.22], 'plus', inc(habit)),
    ];
  if (size === 'medium')
    return [
      { id: 'meter', role: 'meter', frame: [0.04, 0.1, 0.374, 0.8], meter: { shape: 'ring', sampleLevel: 0.6 } },
      value([0.06, 0.38, 0.334, 0.24], 26, { align: 'center' }),
      name([0.45, 0.1, 0.5, 0.16], 17),
      tx('goal', [0.45, 0.3, 0.5, 0.14], { source: 'habitGoal', sizePt: 14 }),
      btn('minus', [0.45, 0.56, 0.22, 0.34], 'minus', dec(habit)),
      btn('plus', [0.73, 0.56, 0.22, 0.34], 'plus', inc(habit)),
    ];
  if (size === 'accessoryCircular')
    return [
      { id: 'meter', role: 'meter', frame: [0, 0, 1, 1], meter: { shape: 'ring', sampleLevel: 0.6 } },
      value([0.15, 0.32, 0.7, 0.36], 16, { align: 'center', font: 'body' }),
    ];
  if (size === 'accessoryRectangular')
    return [
      name([0, 0.04, 0.8, 0.3], 14, { weight: 'bold' }),
      gl([0.84, 0.04, 0.16, 0.3], symbol),
      value([0, 0.36, 1, 0.34], 18, { font: 'body' }),
      { id: 'meter', role: 'meter', frame: [0, 0.78, 1, 0.14], meter: { shape: 'bar', sampleLevel: 0.6 } },
    ];
  return [gl([0, 0.1, 0.08, 0.8], symbol), value([0.1, 0, 0.9, 1], 15, { font: 'body', weight: 'regular' })];
}

// ---------------------------------------------------------------------------------- colour solving

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const inverted = (on: string): string => (contrastRatio('#000000', on) >= contrastRatio('#FFFFFF', on) ? '#000000' : '#FFFFFF');

type Solved = { colour: string; backdrop: string[]; contrast: number };

function solveOn(prefs: readonly string[], backdrop: string[], min: number): Solved | null {
  const colour = pickReadableColour(prefs, backdrop, min);
  return colour ? { colour, backdrop, contrast: round3(minContrast(colour, backdrop)) } : null;
}

function emptyEdits(): CatalogueAppliedEdits {
  return { text: {}, colours: { background: null, accent: null, text: null }, countdownTo: null, photoRefs: [], rotateMinutes: ALBUM_DEFAULT_INTERVAL, look: 'theme' };
}

function cloneEdits(e: CatalogueAppliedEdits): CatalogueAppliedEdits {
  return {
    text: { ...e.text },
    colours: { background: e.colours.background ? [...e.colours.background] : null, accent: e.colours.accent, text: e.colours.text },
    countdownTo: e.countdownTo,
    photoRefs: [...e.photoRefs],
    rotateMinutes: e.rotateMinutes,
    look: e.look,
  };
}

function blankRegion(r: Tpl): CatalogueRegion {
  const [x, y, w, h] = r.frame;
  return {
    id: r.id, role: r.role, frame: { x, y, w, h }, on: r.on ?? 'background', fill: null, fillOpacity: 1, colour: null, backdrop: [], contrast: 0,
    text: null, symbol: r.symbol ?? null, meter: null, dial: null, dots: null, grid: null, action: null, tint: null, tintOpacity: null,
  };
}

function slotOf(tt: TextTpl, font: WidgetFont): CatalogueTextSlot {
  return {
    source: tt.source,
    key: tt.key ?? null,
    userText: null,
    editable: tt.editable === true,
    maxLength: tt.maxLength ?? 0,
    font: tt.font === 'theme' ? font : tt.font ?? 'body',
    sizePt: tt.sizePt,
    weight: tt.weight ?? 'regular',
    align: tt.align ?? 'start',
  };
}

function dotsShape(source: 'year' | 'month', frame: F, size: CatalogueSize): { count: number; columns: number; rows: number } {
  const count = source === 'year' ? 366 : 31;
  const pts = CATALOGUE_SIZE_POINTS[size];
  const aspect = (frame[2] * pts.width) / (frame[3] * pts.height);
  return { count, ...dotGrid(count, aspect) };
}

/** Monochrome (accessory) regions: white at a tint level, checked over the modelled backdrop. */
function solveMonochrome(templates: Tpl[], edits: CatalogueAppliedEdits, font: WidgetFont): CatalogueRegion[] {
  const backdrop = [...ACCESSORY_BACKDROP];
  const eff = (tint: Tint, under: string): string => composite('#FFFFFF', ACCESSORY_TINT_OPACITY[tint], under);
  const contrastOf = (tint: Tint): number => Math.min(...backdrop.map((b) => contrastRatio(eff(tint, b), b)));
  const levelFor = (want: Tint, min: number): Tint => (contrastOf(want) >= min ? want : 'primary');
  return templates.map((r) => {
    const region = blankRegion(r);
    const min = r.role === 'text' ? TEXT_MIN_CONTRAST : GRAPHIC_MIN_CONTRAST;
    const tint = levelFor(r.text?.tint ?? r.tint ?? (r.role === 'text' || r.role === 'meter' ? 'primary' : 'secondary'), min);
    region.colour = '#FFFFFF';
    region.tint = tint;
    region.tintOpacity = ACCESSORY_TINT_OPACITY[tint];
    region.backdrop = backdrop;
    region.contrast = round3(contrastOf(tint));
    if (r.text) {
      region.text = slotOf(r.text, font);
      region.text.userText = region.text.editable ? edits.text[r.id] ?? null : null;
    }
    if (r.meter) {
      const track = composite('#FFFFFF', ACCESSORY_TRACK_OPACITY, ACCESSORY_BACKDROP[1]);
      region.meter = { shape: r.meter.shape, track, sampleLevel: r.meter.sampleLevel };
      region.contrast = round3(Math.min(region.contrast, contrastRatio(eff(tint, ACCESSORY_BACKDROP[1]), track)));
    }
    if (r.dial) region.dial = { numerals: r.dial.numerals, ticks: r.dial.ticks, tick: '#FFFFFF', hand: '#FFFFFF' };
    return region;
  });
}

function baseFill(t: WidgetTokens, kind: CatalogueKind, family: CatalogueFamily): { fill: WidgetFill; opacity: number } {
  if (family === 'standby') return { fill: { kind: 'solid', colour: STANDBY_BG }, opacity: 1 };
  if (kind === 'countdown') return { fill: { kind: 'gradient', from: t.accent, to: mix(t.accent, t.bg[0], 0.35), angle: 160 }, opacity: 1 };
  if (t.style === 'glass') return { fill: { kind: 'solid', colour: t.surface }, opacity: GLASS_OPACITY };
  if (t.style === 'outline' || t.bg.length === 1) return { fill: { kind: 'solid', colour: t.bg[0] }, opacity: 1 };
  return { fill: { kind: 'gradient', from: t.bg[0], to: t.bg[1], angle: 180 }, opacity: 1 };
}

type Built = { spec: CatalogueSpec; textAdjusted: boolean };

function build(tokens0: WidgetTokens, kind: CatalogueKind, size: CatalogueSize, edits: CatalogueAppliedEdits): Built {
  const family = familyOf(size);
  const t: WidgetTokens = {
    ...tokens0,
    bg: edits.colours.background ? [...edits.colours.background] : [...tokens0.bg],
    accent: edits.colours.accent ?? tokens0.accent,
  };
  if (edits.colours.background) t.surface = edits.colours.background[edits.colours.background.length - 1];
  // T85 looks (widgetLook.ts), as widgetSets does. A look the size can't take falls back to 'theme'.
  const look: WidgetLook = catalogueLooksFor(family).includes(edits.look) ? edits.look : 'theme';
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
  const templates = layout(kind, size);
  const userText = family === 'accessory' ? null : edits.colours.text;
  let textAdjusted = false;
  let regions: CatalogueRegion[] | null = null;
  let bg: { fill: WidgetFill; opacity: number; pane?: boolean } | null = null;

  if (family === 'accessory') {
    regions = solveMonochrome(templates, edits, t.font);
  } else {
    // Glow: the dark base gradient (StandBy keeps its black). Glass: panes first, faintest first.
    const designed: { fill: WidgetFill; opacity: number } =
      glow && family === 'home' ? { fill: { kind: 'gradient', from: t.bg[0], to: t.bg[1], angle: 180 }, opacity: 1 } : baseFill(t, kind, family);
    const candidates: { fill: WidgetFill; opacity: number; pane?: boolean }[] = glass
      ? glassCandidates(look as 'clear' | 'tinted', paneTint).map((c) => ({ fill: { kind: 'solid', colour: c.tint } as WidgetFill, opacity: c.opacity, pane: true }))
      : [];
    candidates.push(designed);
    if (family === 'home') {
      for (const o of OPACITY_STEPS) if (o > designed.opacity) candidates.push({ fill: designed.fill, opacity: o });
      if (designed.fill.kind === 'gradient') candidates.push({ fill: { ...designed.fill, to: mix(designed.fill.from, designed.fill.to, 0.5) }, opacity: 1 });
      candidates.push({ fill: { kind: 'solid', colour: designed.fill.kind === 'solid' ? designed.fill.colour : designed.fill.from }, opacity: 1 });
    }
    // On black (StandBy) prefer the theme's lighter accents; on the countdown gradient prefer the background.
    const textPrefs = (tt: TextTpl, on: string): string[] => {
      const list =
        family === 'standby' ? [t.accent, t.glyph, t.surface, t.bg[0], t.ink]
        : kind === 'countdown' ? [t.bg[0], t.surface, t.ink]
        : tt.prefer === 'bg' ? [t.bg[0], t.surface, t.ink]
        : [t.ink, t.accent];
      return [...list, inverted(on)];
    };
    const graphicPrefs = family === 'standby' ? [t.accent, t.glyph, t.surface, t.bg[0], t.ink] : [t.glyph, t.accent, t.ink];
    const solveText = (tt: TextTpl, backdrop: string[], on: string): Solved | null => {
      // 4.5:1, or 3:1 for large numerals under a look (widgetLook.textMinContrast).
      const min = textMinContrast(look, tt.source, tt.sizePt, tt.weight ?? 'regular');
      if (userText) {
        const c = ensureContrast(userText, backdrop, min);
        if (c) return { colour: c, backdrop, contrast: round3(minContrast(c, backdrop)) };
      }
      return solveOn(textPrefs(tt, on), backdrop, min);
    };

    const solveAll = (bgFill: WidgetFill, bgOpacity: number, pane: boolean): CatalogueRegion[] | null => {
      const surfaces = new Map<string, string[]>();
      let bgSamples = pane && bgFill.kind === 'solid' ? paneSamples(bgFill.colour, bgOpacity, wallBackdrop) : widgetFillSamples(bgFill, bgOpacity);
      // Glow: foregrounds are also checked against the base under their own halo.
      if (glow) bgSamples = [...new Set([...bgSamples, ...bgSamples.map((b) => composite(glow.neon, GLOW_HALO_OPACITY, b))])];
      surfaces.set('background', bgSamples);
      const out: CatalogueRegion[] = [];
      for (const r of templates) {
        const region = blankRegion(r);
        const under = surfaces.get(region.on) ?? surfaces.get('background')!;
        if (r.role === 'band' || r.role === 'scrim' || r.role === 'photo') {
          const fill: WidgetFill =
            r.role === 'band' ? { kind: 'solid', colour: t.accent }
            : r.role === 'scrim' ? { kind: 'solid', colour: t.bg[0] }
            : { kind: 'gradient', from: t.accent, to: t.surface, angle: 135 };
          const opacities = r.role === 'scrim' ? [SCRIM_OPACITY, ...OPACITY_STEPS] : [1];
          const kids = templates.filter((k) => k.on === r.id);
          let samples = widgetFillSamples(fill, opacities[0]);
          let opacity = opacities[0];
          for (const o of opacities) {
            samples = widgetFillSamples(fill, o);
            opacity = o;
            if (kids.every((k) => (k.text ? solveText(k.text, samples, samples[0]) : true))) break;
          }
          region.fill = fill;
          region.fillOpacity = opacity;
          surfaces.set(r.id, samples);
        } else if (r.role === 'text' && r.text) {
          const solved = solveText(r.text, under, under[0]);
          if (!solved) return null;
          if (userText && solved.colour !== normalizeHex(userText)) textAdjusted = true;
          Object.assign(region, solved);
          region.text = slotOf(r.text, t.font);
          region.text.userText = region.text.editable ? edits.text[r.id] ?? null : null;
          if (r.grid) {
            const todayFill = pickReadableColour([t.accent, t.ink], under, GRAPHIC_MIN_CONTRAST);
            if (!todayFill) return null;
            const todayText = solveOn([t.bg[0], t.surface, t.ink, inverted(todayFill)], [todayFill], TEXT_MIN_CONTRAST);
            if (!todayText) return null;
            region.grid = { todayFill, todayText: todayText.colour, contrast: todayText.contrast };
          }
        } else if (r.role === 'glyph') {
          const solved = solveOn(graphicPrefs, under, GRAPHIC_MIN_CONTRAST);
          if (!solved) return null;
          Object.assign(region, solved);
        } else if (r.role === 'meter' && r.meter) {
          const track = mix(under[0], family === 'standby' ? '#FFFFFF' : t.ink, 0.14);
          const solved = solveOn([t.accent, t.ink, ...graphicPrefs], [track, ...under], GRAPHIC_MIN_CONTRAST);
          if (!solved) return null;
          Object.assign(region, solved);
          region.meter = { shape: r.meter.shape, track, sampleLevel: r.meter.sampleLevel };
        } else if (r.role === 'dial' && r.dial) {
          // Hands carry the time; numerals are text, so hands get the text threshold when numerals show.
          const hand = solveOn([t.ink, ...graphicPrefs], under, r.dial.numerals ? TEXT_MIN_CONTRAST : GRAPHIC_MIN_CONTRAST);
          const tick = solveOn(graphicPrefs, under, GRAPHIC_MIN_CONTRAST);
          if (!hand || !tick) return null;
          Object.assign(region, hand);
          region.dial = { numerals: r.dial.numerals, ticks: r.dial.ticks, tick: tick.colour, hand: hand.colour };
        } else if (r.role === 'dots' && r.dots) {
          const track = mix(under[0], family === 'standby' ? '#FFFFFF' : t.ink, 0.14);
          const filled = solveOn([t.accent, t.ink, ...graphicPrefs], [track, ...under], GRAPHIC_MIN_CONTRAST);
          if (!filled) return null;
          const today = pickReadableColour([t.ink, t.glyph, t.accent], [track, ...under], GRAPHIC_MIN_CONTRAST) ?? filled.colour;
          Object.assign(region, filled);
          region.dots = { source: r.dots, ...dotsShape(r.dots, r.frame, size), track, today };
        } else if (r.role === 'action' && r.action) {
          // Button: its edge reaches 3:1 on what it sits on; its symbol reaches 4.5:1 on the button.
          const fillColour = pickReadableColour([t.accent, t.ink, t.glyph], under, GRAPHIC_MIN_CONTRAST);
          if (!fillColour) return null;
          const symbol = solveOn([t.bg[0], t.surface, t.ink, inverted(fillColour)], [fillColour], TEXT_MIN_CONTRAST);
          if (!symbol) return null;
          region.fill = { kind: 'solid', colour: fillColour };
          Object.assign(region, symbol);
          region.action = { id: r.action.id, intent: r.action.intent, labelKey: catalogueActionKey(r.action.id) };
        }
        out.push(region);
      }
      return out;
    };

    // Lowest contrast any text drawn straight on the background needs (for the pane pre-check).
    const bgTextMin = templates
      .filter((r) => r.text && (r.on ?? 'background') === 'background')
      .reduce((m, r) => Math.min(m, textMinContrast(look, r.text!.source, r.text!.sizePt, r.text!.weight ?? 'regular')), GRAPHIC_MIN_CONTRAST);

    for (const c of candidates) {
      // A see-through pane nothing could read on is skipped without the full solve.
      if (c.pane && c.fill.kind === 'solid' && !backdropFeasible(paneSamples(c.fill.colour, c.opacity, wallBackdrop), bgTextMin)) continue;
      textAdjusted = false;
      regions = solveAll(c.fill, c.opacity, c.pane === true);
      bg = c;
      if (regions) break;
    }
    if (!regions) throw new Error(`widgetKinds: no AA colours for ${t.themeId}/${kind}/${size}`); // unreachable: flat fill + black/white
  }

  const pts = CATALOGUE_SIZE_POINTS[size];
  const habit = HABIT_OF_KIND[kind] ?? null;
  const editableText = regions.some((r) => r.text?.editable);
  const bgSamples = bg ? widgetFillSamples(bg.fill, bg.opacity) : [];
  const usedPane = glass && bg?.pane === true;
  const spec: CatalogueSpec = {
    id: `${t.themeId}:${kind}:${size}`,
    themeId: t.themeId,
    kind,
    size,
    family,
    nameKey: catalogueKindKey(kind),
    sizeKey: catalogueSizeKey(size),
    width: pts.width,
    height: pts.height,
    cornerRadius: family === 'accessory' ? 0 : CORNER_RADIUS_BY_SHAPE[t.shape] ?? CORNER_RADIUS_BY_SHAPE.squircle,
    rendering: family === 'accessory' ? 'monochrome' : 'fullColour',
    surface: usedPane ? 'glass' : glow && family === 'home' ? 'solid' : t.style,
    background: bg ? bg.fill : null,
    backgroundOpacity: bg ? bg.opacity : 0,
    border: family === 'home' && t.style === 'outline' && look === 'theme' && bg ? { colour: pickReadableColour([t.accent, t.ink], bgSamples, GRAPHIC_MIN_CONTRAST) ?? t.ink, width: 2 } : null,
    accent: t.accent,
    font: t.font,
    typeface: t.typeface,
    glyphSet: t.glyphSet,
    motif: t.motif,
    standby: family === 'standby' ? { removesBackground: true, nightMode: 'systemRed' } : null,
    accessoryBackground: size === 'accessoryCircular' || size === 'accessoryRectangular',
    regions,
    binding: { habit, progress: kind === 'yearProgress' ? 'year' : kind === 'monthProgress' ? 'month' : null },
    countdownTo: kind === 'countdown' ? edits.countdownTo : null,
    photoRefs: kind === 'photoAlbum' ? [...edits.photoRefs] : [],
    rotateMinutes: kind === 'photoAlbum' ? edits.rotateMinutes : ALBUM_DEFAULT_INTERVAL,
    tap: { intent: WIDGET_INTENTS.open, params: habit ? { habit } : {} },
    editable: { text: editableText, photo: kind === 'photoAlbum', colours: family !== 'accessory', countdown: kind === 'countdown' },
    tokens: { ...tokens0, bg: [...tokens0.bg], wallpaper: [...tokens0.wallpaper] },
    edits: { ...cloneEdits(edits), look },
    look,
    glow: glow ? { colour: glow.neon, opacity: GLOW_HALO_OPACITY, radius: GLOW_RADIUS_PT } : null,
  };
  return { spec, textAdjusted };
}

// ---------------------------------------------------------------------------------- public API

/** One catalogue spec. Throws for a kind / size pair that doesn't exist (see CATALOGUE_KIND_SIZES). */
export function buildCatalogueSpec(tokens: WidgetTokens, kind: CatalogueKind, size: CatalogueSize): CatalogueSpec {
  if (!CATALOGUE_KIND_SIZES[kind]?.includes(size)) throw new Error(`widgetKinds: ${kind} has no ${size} size`);
  return build(normaliseTokens(tokens), kind, size, emptyEdits()).spec;
}

/** Every catalogue kind in every size it supports, kind-major. Deterministic. */
export function generateWidgetCatalogueFromTokens(tokens: WidgetTokens): WidgetCatalogue {
  const t = normaliseTokens(tokens);
  const specs: CatalogueSpec[] = [];
  for (const kind of CATALOGUE_KINDS) for (const size of CATALOGUE_KIND_SIZES[kind]) specs.push(build(t, kind, size, emptyEdits()).spec);
  return { themeId: t.themeId, name: t.name, tokens: t, specs };
}

export function generateWidgetCatalogue(theme: Theme): WidgetCatalogue {
  return generateWidgetCatalogueFromTokens(widgetTokensFrom(theme));
}

export function catalogueSpecOf(cat: WidgetCatalogue, kind: CatalogueKind, size: CatalogueSize): CatalogueSpec | undefined {
  return cat.specs.find((s) => s.kind === kind && s.size === size);
}

/**
 * Apply Widget Studio edits (merged onto the spec's current edits). Same rules as
 * applyWidgetEdits: invalid edits are dropped with an issue, text is cleaned and clipped, a text
 * colour that can't reach AA is adjusted. Accessory sizes are tinted by the system, so colour
 * edits there are 'notSupported'. Never throws.
 */
export function applyCatalogueEdits(spec: CatalogueSpec, edits: CatalogueEdits): { spec: CatalogueSpec; issues: CatalogueIssue[] } {
  const issues: CatalogueIssue[] = [];
  const issue = (field: string, code: CatalogueIssueCode) => issues.push({ field, code, messageKey: catalogueIssueKey(code) });
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

  if ('countdownTo' in e) {
    if (spec.kind !== 'countdown') issue('countdownTo', 'notSupported');
    else if (e.countdownTo === null || e.countdownTo === undefined) next.countdownTo = null;
    else if (isDayKey(e.countdownTo)) next.countdownTo = e.countdownTo;
    else issue('countdownTo', 'invalidDate');
  }

  if ('photoRefs' in e) {
    if (spec.kind !== 'photoAlbum') issue('photoRefs', 'notSupported');
    else if (e.photoRefs === null || e.photoRefs === undefined) next.photoRefs = [];
    else if (!Array.isArray(e.photoRefs)) issue('photoRefs', 'invalidPhoto');
    else {
      const valid = [...new Set(e.photoRefs.filter(isWidgetPhotoRef))];
      if (valid.length < e.photoRefs.length) issue('photoRefs', 'invalidPhoto');
      if (valid.length > ALBUM_MAX_PHOTOS) issue('photoRefs', 'tooManyPhotos');
      next.photoRefs = valid.slice(0, ALBUM_MAX_PHOTOS);
    }
  }

  if ('rotateMinutes' in e) {
    if (spec.kind !== 'photoAlbum') issue('rotateMinutes', 'notSupported');
    else if (e.rotateMinutes === null || e.rotateMinutes === undefined) next.rotateMinutes = ALBUM_DEFAULT_INTERVAL;
    else if ((ALBUM_INTERVALS as readonly number[]).includes(e.rotateMinutes)) next.rotateMinutes = e.rotateMinutes;
    else issue('rotateMinutes', 'invalidInterval');
  }

  if ('look' in e) {
    if (e.look === null || e.look === undefined) next.look = 'theme';
    else if (isWidgetLook(e.look) && catalogueLooksFor(spec.family).includes(e.look)) next.look = e.look;
    else issue('look', 'notSupported');
  }

  const c = e.colours;
  if (c && typeof c === 'object' && Object.keys(c).length > 0) {
    if (spec.family === 'accessory') issue('colours', 'notSupported');
    else {
      if ('background' in c) {
        const v = c.background;
        if (v === null || v === undefined) next.colours.background = null;
        else {
          const list = typeof v === 'string' ? [v] : Array.isArray(v) ? v : [];
          if (list.length >= 1 && list.length <= 2 && list.every((x) => typeof x === 'string' && isHex(x))) {
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
  }

  const { spec: out, textAdjusted } = build(spec.tokens, spec.kind, spec.size, next);
  if (textAdjusted && next.colours.text) issue('colours.text', 'contrastAdjusted');
  return { spec: out, issues };
}

// ---------------------------------------------------------------------------------- photo album

/** Which photo shows at `now`: changes every `rotateMinutes` on local clock boundaries. -1 when empty. */
export function albumIndexAt(count: number, rotateMinutes: number, now: Date, utcOffsetMinutes?: number): number {
  if (!(count > 0)) return -1;
  const step = rotateMinutes > 0 ? Math.floor(rotateMinutes) : ALBUM_DEFAULT_INTERVAL;
  const p = localParts(now, utcOffsetMinutes);
  const minutes = Math.floor(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 60_000);
  return Math.floor(minutes / step) % Math.floor(count);
}

/** The next `entries` timeline entries for an album spec (first one is `now`). Empty without photos. */
export function albumTimeline(spec: Pick<CatalogueSpec, 'photoRefs' | 'rotateMinutes'>, now: Date, entries: number, utcOffsetMinutes?: number): { at: Date; photoRef: string }[] {
  const refs = spec.photoRefs;
  if (!refs.length) return [];
  const step = spec.rotateMinutes > 0 ? spec.rotateMinutes : ALBUM_DEFAULT_INTERVAL;
  const p = localParts(now, utcOffsetMinutes);
  const localMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const delta = now.getTime() - (localMs + (now.getTime() % 1000));
  const out: { at: Date; photoRef: string }[] = [{ at: now, photoRef: refs[albumIndexAt(refs.length, step, now, utcOffsetMinutes)] }];
  let boundary = (Math.floor(localMs / 60_000 / step) + 1) * step;
  while (out.length < Math.max(1, entries)) {
    const at = new Date(boundary * 60_000 + delta);
    out.push({ at, photoRef: refs[albumIndexAt(refs.length, step, at, utcOffsetMinutes)] });
    boundary += step;
  }
  return out;
}

// ---------------------------------------------------------------------------------- i18n keys

/** Every i18n key the catalogue can emit (for locale files; the core never holds English). */
export function catalogueI18nKeys(): string[] {
  const keys = new Set<string>();
  for (const k of CATALOGUE_KINDS) keys.add(catalogueKindKey(k));
  for (const s of CATALOGUE_SIZES) keys.add(catalogueSizeKey(s));
  for (const c of ['invalidInterval', 'tooManyPhotos'] as const) keys.add(catalogueIssueKey(c));
  for (const d of Object.values(HABIT_DEFS)) keys.add(d.unitKey);
  for (let i = 1; i <= 5; i++) keys.add(`widgets.mood.${i}`);
  for (const k of ['water', 'mood', 'sleep', 'steps']) keys.add(`widgets.habit.${k}`);
  const cat = generateWidgetCatalogueFromTokens(normaliseTokens({}));
  for (const s of cat.specs) for (const r of s.regions) {
    if (r.text?.key) keys.add(r.text.key);
    if (r.action) keys.add(r.action.labelKey);
  }
  return [...keys].sort();
}

// ---------------------------------------------------------------------------------- payload

function specJson(s: CatalogueSpec): Record<string, unknown> {
  return {
    id: s.id, kind: s.kind, size: s.size, family: s.family, nameKey: s.nameKey, sizeKey: s.sizeKey, width: s.width, height: s.height,
    cornerRadius: s.cornerRadius, rendering: s.rendering, surface: s.surface, background: s.background, backgroundOpacity: s.backgroundOpacity,
    border: s.border, accent: s.accent, font: s.font, typeface: s.typeface, glyphSet: s.glyphSet, motif: s.motif, standby: s.standby,
    accessoryBackground: s.accessoryBackground, regions: s.regions, binding: s.binding, countdownTo: s.countdownTo, photoRefs: s.photoRefs,
    rotateMinutes: s.rotateMinutes, tap: s.tap, editable: s.editable, edits: s.edits, look: s.look, glow: s.glow,
  };
}

function textsOf(specs: readonly CatalogueSpec[], translate?: WidgetTranslate): Record<string, Record<string, string>> {
  const texts: Record<string, Record<string, string>> = {};
  for (const s of specs) {
    const row: Record<string, string> = {};
    for (const r of s.regions) {
      if (r.text?.userText) row[r.id] = r.text.userText;
      else if (r.text?.key && translate) row[r.id] = String(translate(r.text.key)).slice(0, 200);
      if (r.action && translate) row[`${r.id}.label`] = String(translate(r.action.labelKey)).slice(0, 200);
    }
    if (Object.keys(row).length) texts[s.id] = row;
  }
  return texts;
}

/**
 * The glaze.widgets.v2 payload (exactly what serialiseWidgetSet writes) plus a `catalogue` block:
 * `{ v: 1, specs, texts }`. Readers that only know the theme set ignore the extra key.
 */
export function serialiseWidgetCatalogue(set: WidgetSet, catalogue: WidgetCatalogue, opts: { translate?: WidgetTranslate; now?: Date } = {}): string {
  const base = JSON.parse(serialiseWidgetSet(set, opts)) as Record<string, unknown>;
  return JSON.stringify({
    v: base.v,
    theme: base.theme,
    tokens: base.tokens,
    specs: base.specs,
    texts: base.texts,
    catalogue: { v: WIDGET_CATALOGUE_VERSION, specs: catalogue.specs.map(specJson), texts: textsOf(catalogue.specs, opts.translate) },
    updatedAt: base.updatedAt,
  });
}

export type WidgetCataloguePayload = {
  set: WidgetSetPayload;
  catalogue: WidgetCatalogue;
  /** Catalogue region text in the app language: spec id → region id → text. */
  texts: Record<string, Record<string, string>>;
};

function rebuild(tokens: WidgetTokens, kind: CatalogueKind, size: CatalogueSize, raw: unknown): CatalogueSpec {
  const base = build(tokens, kind, size, emptyEdits()).spec;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const colours = o.colours && typeof o.colours === 'object' ? (o.colours as Record<string, unknown>) : {};
  const edits: CatalogueEdits = {
    text: o.text && typeof o.text === 'object' && !Array.isArray(o.text) ? (o.text as Record<string, string>) : undefined,
  };
  if (base.family !== 'accessory') {
    edits.colours = {
      background: (colours.background ?? null) as WidgetColourEdits['background'],
      accent: (colours.accent ?? null) as string | null,
      text: (colours.text ?? null) as string | null,
    };
  }
  if (kind === 'countdown') edits.countdownTo = (o.countdownTo ?? null) as string | null;
  if (kind === 'photoAlbum') {
    edits.photoRefs = Array.isArray(o.photoRefs) ? (o.photoRefs as string[]) : null;
    edits.rotateMinutes = typeof o.rotateMinutes === 'number' ? o.rotateMinutes : null;
  }
  // T85: payloads written before looks existed have no `look` (= the theme look).
  if (isWidgetLook(o.look) && catalogueLooksFor(base.family).includes(o.look)) edits.look = o.look;
  return applyCatalogueEdits(base, edits).spec;
}

/**
 * Tolerant parse of a glaze.widgets.v2 payload with or without a `catalogue` block (or a bare v1
 * theme). Catalogue specs are rebuilt from the set's tokens + stored edits, so they stay AA even
 * if the JSON was tampered with. Returns null when the set payload itself is rejected. Never throws.
 */
export function parseWidgetCatalogue(input: unknown): WidgetCataloguePayload | null {
  const set = parseWidgetSetPayload(input);
  if (!set) return null;
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      raw = null;
    }
  }
  const block = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).catalogue : undefined;
  const byKey = new Map<string, unknown>();
  let rawTexts: unknown = null;
  if (block && typeof block === 'object' && !Array.isArray(block) && (block as Record<string, unknown>).v === WIDGET_CATALOGUE_VERSION) {
    const b = block as Record<string, unknown>;
    if (Array.isArray(b.specs)) {
      for (const s of b.specs) {
        if (s && typeof s === 'object' && typeof (s as Record<string, unknown>).kind === 'string') {
          const r = s as Record<string, unknown>;
          byKey.set(`${r.kind}:${r.size}`, r.edits);
        }
      }
    }
    rawTexts = b.texts;
  }
  const tokens = set.set.tokens;
  const specs: CatalogueSpec[] = [];
  for (const kind of CATALOGUE_KINDS) for (const size of CATALOGUE_KIND_SIZES[kind]) specs.push(rebuild(tokens, kind, size, byKey.get(`${kind}:${size}`)));
  const texts: Record<string, Record<string, string>> = {};
  if (rawTexts && typeof rawTexts === 'object' && !Array.isArray(rawTexts)) {
    const ids = new Set(specs.map((s) => s.id));
    for (const [sid, row] of Object.entries(rawTexts as Record<string, unknown>)) {
      if (!ids.has(sid) || !row || typeof row !== 'object') continue;
      const clean: Record<string, string> = {};
      for (const [rid, v] of Object.entries(row as Record<string, unknown>)) if (typeof v === 'string') clean[rid] = v.slice(0, 200);
      texts[sid] = clean;
    }
  }
  return { set, catalogue: { themeId: tokens.themeId, name: tokens.name, tokens, specs }, texts };
}
