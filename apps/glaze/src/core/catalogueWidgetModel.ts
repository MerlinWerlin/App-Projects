// What CatalogueWidgetPreview draws for one catalogue spec (T92, D79-2), as plain data.
//
// The component (src/ui/CatalogueWidgetPreview.tsx) used to work all of this out inline while it
// rendered, so the only way to check a kind × look combination was to render React. Here it is
// pure TS: sizes and scale, the see-through pane and what shows behind it, the glow halo, the
// frame, and per region what to draw (`draw`), where, in which colour and opacity, with its text
// already resolved. The component only turns this into views, so every catalogue kind in every
// look is tested in Node (catalogueWidgetModel.test.ts) without a renderer.
//
// Pure TS (no React Native / Expo), Node-testable, deterministic for a given `now`.

import { countdownTo, localParts, monthGrid, monthProgress, yearProgress, type Progress } from './calendarMaths.ts';
import { HABIT_DEFS, type HabitDef } from './habits.ts';
import type { DateOptions, NumberOptions } from './i18n.ts';
import { ACCESSORY_BACKDROP, type CatalogueRegion, type CatalogueRegionRole, type CatalogueSpec } from './widgetKinds.ts';
import type { WidgetFill } from './widgetSets.ts';

/** Locale helpers the preview formats with (useT in the app; core i18n in tests). */
export type CatalogueWidgetFormat = {
  /** Untyped key lookup (keys carried in data). */
  t: (key: string) => string;
  formatNumber: (n: number, options?: NumberOptions) => string;
  formatDate: (date: Date, options?: DateOptions) => string;
};

export type CatalogueWidgetModelInput = {
  spec: CatalogueSpec;
  /** Drawn width in points; height follows the widget's aspect. */
  width: number;
  /** Device time to draw. */
  now: Date;
  /** Today's value the user logged for this habit. Omitted: nothing logged. */
  habitValue?: number;
  /** The person's daily goal for this habit. Omitted: the tracker's default. */
  habitGoal?: number;
  /** The user's wallpaper photo, drawn behind clear / tinted glass. */
  wallpaperUri?: string | null;
  /** Platform hairline width (StyleSheet.hairlineWidth); the glass rim is two of these. */
  hairline: number;
  format: CatalogueWidgetFormat;
};

/** How a region is drawn. Every CatalogueRegionRole maps to one of these (regionDraw). */
export const CATALOGUE_REGION_DRAWS = Object.freeze(['fill', 'glyph', 'meter', 'dial', 'dots', 'action', 'text', 'grid', 'none'] as const);
export type CatalogueRegionDraw = (typeof CATALOGUE_REGION_DRAWS)[number];

export type CatalogueGridModel = {
  /** Weekday initials, Monday first. */
  heads: string[];
  /** Weeks of cells; `label` is '' for padding cells. */
  weeks: { label: string; today: boolean }[][];
  marker: { todayFill: string; todayText: string } | null;
};

export type CatalogueRegionModel = {
  region: CatalogueRegion;
  draw: CatalogueRegionDraw;
  /** Position in points inside the drawn widget (origin top-start). */
  box: { start: number; top: number; width: number; height: number };
  /** Photo, band and scrim regions clip their fill. */
  clip: boolean;
  colour: string;
  opacity: number;
  /** Glow halo on this region: text and glyphs drawn straight on the widget background (not bands or buttons). */
  halo: boolean;
  /** Resolved text ('text' draws). */
  text: string;
  /** Font size and line height in points (text and grid draws). */
  textSize: number;
  lineHeight: number;
  /** Symbol id for glyph / action draws (the mood glyph follows the logged level: mood1–5). */
  symbol: string | null;
  /** Meter fill 0–1 (meter draws). */
  level: number;
  grid: CatalogueGridModel | null;
};

export type CatalogueWidgetModel = {
  mono: boolean;
  /** Lock Screen stage padding around accessory previews (0 otherwise). */
  pad: number;
  drawW: number;
  height: number;
  scale: number;
  /** A clear / tinted see-through pane over the wallpaper. */
  pane: boolean;
  /** What shows behind the pane. */
  wallpaper: { kind: 'photo'; uri: string } | { kind: 'colours'; colours: readonly string[] } | null;
  /** Text shadow halo for glow (rgba colour, radius in points). */
  glow: { colour: string; radius: number } | null;
  /** Full-colour frame (ignored when mono). */
  frame: { width: number; height: number; borderRadius: number; borderWidth: number; borderColour: string };
  background: { fill: WidgetFill; opacity: number } | null;
  /** Accessory (mono) stage and system material. */
  stage: { colour: string; material: { colour: string; opacity: number; borderRadius: number } | null } | null;
  regions: CatalogueRegionModel[];
};

/** Lock Screen backdrop drawn behind accessory previews (modelled, see widgetKinds ACCESSORY_BACKDROP). */
export const LOCK_STAGE = ACCESSORY_BACKDROP[0];
export const ACCESSORY_MATERIAL = ACCESSORY_BACKDROP[1];
/** Glass: a faint light rim, as on the system's own glass. */
export const GLASS_RIM = 'rgba(255, 255, 255, 0.45)';

/** Halo colour: the glow colour at its halo strength, as rgba. */
export function haloColour(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(1, opacity * 2.4).toFixed(2)})`;
}

/** How a region is drawn (exhaustive over roles; a role missing its data draws nothing). */
export function regionDraw(r: CatalogueRegion): CatalogueRegionDraw {
  const role: CatalogueRegionRole = r.role;
  switch (role) {
    case 'photo':
    case 'band':
    case 'scrim':
      // Album photos aren't picked in the app yet: the photo area shows its theme fill.
      return r.fill ? 'fill' : 'none';
    case 'glyph':
      return 'glyph';
    case 'meter':
      return r.meter ? 'meter' : 'none';
    case 'dial':
      return r.dial ? 'dial' : 'none';
    case 'dots':
      return r.dots ? 'dots' : 'none';
    case 'action':
      return 'action';
    case 'text':
      if (!r.text) return 'none';
      return r.grid || r.text.source === 'monthGrid' ? 'grid' : 'text';
    default: {
      const unknown: never = role;
      void unknown;
      return 'none';
    }
  }
}

export function catalogueWidgetModel(input: CatalogueWidgetModelInput): CatalogueWidgetModel {
  const { spec, width, now: date, habitValue, habitGoal, wallpaperUri, hairline } = input;
  const { t, formatNumber, formatDate } = input.format;
  const mono = spec.rendering === 'monochrome';
  // Accessory previews sit inside a dark Lock Screen stage: `pad` around, the widget in `drawW`.
  const pad = mono ? Math.max(4, Math.round(width * 0.06)) : 0;
  const drawW = Math.max(8, width - pad * 2);
  const scale = drawW / spec.width;
  const height = Math.max(8, Math.round(spec.height * scale));

  const habitDef: HabitDef | null = spec.binding.habit ? HABIT_DEFS[spec.binding.habit] : null;
  const logged = typeof habitValue === 'number' && Number.isFinite(habitValue) ? habitValue : 0;
  const progress: Progress | null = spec.binding.progress === 'year' ? yearProgress(date) : spec.binding.progress === 'month' ? monthProgress(date) : null;
  const goal = habitDef && habitDef.mode === 'count' ? (typeof habitGoal === 'number' && Number.isFinite(habitGoal) && habitGoal > 0 ? habitGoal : habitDef.defaultGoal) : null;
  /** Meter fill: real progress for year/month, the logged habit value against its goal, else the spec's sample. */
  const meterLevel = (r: CatalogueRegion): number => {
    if (progress) return progress.fraction;
    if (habitDef) return goal ? Math.min(1, logged / goal) : 0;
    return r.meter?.sampleLevel ?? 0;
  };

  const pane = !mono && (spec.look === 'clear' || spec.look === 'tinted') && spec.surface === 'glass';
  const glow = spec.glow && !mono ? { colour: haloColour(spec.glow.colour, spec.glow.opacity), radius: Math.max(2, spec.glow.radius * scale) } : null;

  const habitText = (): string => {
    if (!habitDef) return '';
    if (habitDef.mode === 'scale') return logged >= 1 ? t(`widgets.mood.${Math.round(logged)}`) : '–';
    const n = formatNumber(logged, { maximumFractionDigits: habitDef.decimals });
    return spec.family === 'accessory' && spec.size !== 'accessoryCircular' ? `${n} ${t(habitDef.unitKey)}` : n;
  };

  const textFor = (r: CatalogueRegion): string => {
    const slot = r.text;
    if (!slot) return '';
    switch (slot.source) {
      case 'text':
        return slot.userText ?? (slot.key ? t(slot.key) : '');
      case 'date':
        return formatDate(date, { day: 'numeric', month: 'long' });
      case 'weekday':
        return formatDate(date, { weekday: 'long' });
      case 'month':
        return formatDate(date, { month: 'long' });
      case 'dayNumber':
        return formatDate(date, { day: 'numeric' });
      case 'countdown': {
        const cd = spec.countdownTo ? countdownTo(spec.countdownTo, date) : null;
        // No target picked yet: the sample count the theme set uses too.
        const n = formatNumber(cd ? Math.max(0, cd.days) : 12);
        return slot.key ? `${n} ${slot.userText ?? t(slot.key)}` : n;
      }
      case 'yearProgress':
      case 'monthProgress': {
        const p = slot.source === 'yearProgress' ? yearProgress(date) : monthProgress(date);
        return `${formatNumber(p.day)}/${formatNumber(p.total)}`;
      }
      case 'progressPercent':
        return formatNumber((progress?.percent ?? 0) / 100, { style: 'percent' });
      case 'habitValue':
        return habitText();
      case 'habitGoal':
        return goal !== null && habitDef ? `${formatNumber(goal, { maximumFractionDigits: habitDef.decimals })} ${t(habitDef.unitKey)}` : '';
      default:
        return '';
    }
  };

  const gridFor = (r: CatalogueRegion): CatalogueGridModel => {
    const p = localParts(date);
    // Weekday initials for a Monday-first week (2024-01-01 was a Monday).
    const heads = Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 1 + i), { weekday: 'narrow' }));
    const weeks = monthGrid(p.year, p.month, 1).map((week) => week.map((d) => ({ label: d > 0 ? formatNumber(d) : '', today: d === p.day })));
    return { heads, weeks, marker: r.grid ? { todayFill: r.grid.todayFill, todayText: r.grid.todayText } : null };
  };

  const symbolFor = (r: CatalogueRegion, draw: CatalogueRegionDraw): string | null => {
    if (draw === 'action') return r.symbol ?? 'plus';
    if (draw !== 'glyph') return null;
    const level = Math.round(logged);
    // The face follows the logged mood (0 = not logged keeps the plain mood symbol).
    if (r.symbol === 'mood' && habitDef?.mode === 'scale' && level >= 1 && level <= 5) return `mood${level}`;
    return r.symbol ?? 'theme';
  };

  const regions = spec.regions.map((r): CatalogueRegionModel => {
    const draw = regionDraw(r);
    const textSize = r.text ? Math.max(6, r.text.sizePt * scale) : 0;
    return {
      region: r,
      draw,
      box: { start: r.frame.x * drawW, top: r.frame.y * height, width: r.frame.w * drawW, height: r.frame.h * height },
      clip: r.role === 'photo' || r.role === 'band' || r.role === 'scrim',
      colour: r.colour ?? '#000000',
      opacity: mono ? r.tintOpacity ?? 1 : 1,
      halo: !!glow && r.on === 'background' && (draw === 'text' || draw === 'grid' || draw === 'glyph'),
      text: draw === 'text' ? textFor(r) : '',
      textSize,
      lineHeight: Math.round(textSize * 1.2),
      symbol: symbolFor(r, draw),
      level: draw === 'meter' ? meterLevel(r) : 0,
      grid: draw === 'grid' ? gridFor(r) : null,
    };
  });

  // Behind a see-through pane: the user's photo when it is their wallpaper, else the theme wallpaper.
  const wallpaper: CatalogueWidgetModel['wallpaper'] =
    pane && wallpaperUri ? { kind: 'photo', uri: wallpaperUri } : pane && spec.tokens.wallpaper.length ? { kind: 'colours', colours: spec.tokens.wallpaper } : null;

  const circular = spec.size === 'accessoryCircular';
  return {
    mono,
    pad,
    drawW,
    height,
    scale,
    pane,
    wallpaper,
    glow,
    frame: {
      width,
      height,
      borderRadius: spec.cornerRadius * scale,
      borderWidth: spec.border ? Math.max(1, spec.border.width * scale) : pane ? hairline * 2 : 0,
      borderColour: spec.border?.colour ?? (pane ? GLASS_RIM : 'transparent'),
    },
    background: spec.background ? { fill: spec.background, opacity: spec.backgroundOpacity } : null,
    stage: mono
      ? {
          colour: LOCK_STAGE,
          material: spec.accessoryBackground ? { colour: ACCESSORY_MATERIAL, opacity: 0.6, borderRadius: circular ? 999 : Math.max(6, height * 0.18) } : null,
        }
      : null,
    regions,
  };
}
