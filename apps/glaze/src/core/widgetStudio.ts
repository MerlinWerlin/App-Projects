// Widget Studio edit state (T59, M4b-ui; docs/WIDGETS.md "Widget Studio").
//
// The studio edits one widget of a theme's matching set (src/core/widgetSets.ts) at a time: text,
// background (theme art, colour, gradient or the user's photo), accent and text colours, font and
// a text-size slider. This module holds the pure logic the screen needs: draft state per widget,
// mapping a draft onto `applyWidgetEdits`, the font / size restyle, swatch presets, the payload for
// the App Group key `glaze.widgets.v2`, and tolerant parsing for on-device persistence.
//
// T78: it also edits the catalogue kinds of widgetKinds.ts (see "catalogue kinds" at the end),
// whose payload goes through serialiseWidgetCatalogue.
//
// It only consumes widgetSets' / widgetKinds' exported API (kinds and sizes come from the generated set, so new
// widget kinds show up in the studio automatically). Pure TS, no React Native, Node-testable.
// User-facing copy stays in the catalogue: this file returns i18n keys, never English.

import { isHex, mix, normalizeHex } from './colour.ts';
import { DISPLAY_FONTS, type DisplayFont } from './artwork.ts';
import {
  applyWidgetEdits,
  cleanWidgetText,
  serialiseWidgetSet,
  widgetSpecOf,
  type WidgetEditIssue,
  type WidgetEdits,
  type WidgetKind,
  type WidgetSet,
  type WidgetSize,
  type WidgetSpec,
  type WidgetTokens,
  type WidgetTranslate,
} from './widgetSets.ts';
import {
  ALBUM_INTERVALS,
  CATALOGUE_KINDS,
  CATALOGUE_KIND_SIZES,
  applyCatalogueEdits,
  catalogueLooksFor,
  catalogueSpecOf,
  generateWidgetCatalogueFromTokens,
  isCatalogueKind,
  isCatalogueSize,
  serialiseWidgetCatalogue,
  type CatalogueEdits,
  type CatalogueIssue,
  type CatalogueKind,
  type CatalogueSize,
  type CatalogueSpec,
  type WidgetCatalogue,
} from './widgetKinds.ts';
import { WIDGET_LOOKS, isWidgetLook, suitsGlow, type WidgetLook } from './widgetLook.ts';

// ---------------------------------------------------------------------------------- constants

/** Text size slider: percent of the designed size. */
export const STUDIO_SCALE_MIN = 70;
export const STUDIO_SCALE_MAX = 130;
export const STUDIO_SCALE_STEP = 5;
export const STUDIO_SCALE_DEFAULT = 100;
/** Smallest point size any text is drawn at after scaling. */
export const STUDIO_MIN_POINT_SIZE = 9;
/** Line box per point of type, used to keep scaled text inside its region. */
const LINE_BOX = 1.15;

/** File name the native bridge writes the widget photo to (GlazeWidgetBridgeModule.setPhoto). */
export const WIDGET_PHOTO_FILE = 'widget-photo.jpg';

/** On-device storage key for studio drafts (AsyncStorage, this phone only). */
export const STUDIO_STORAGE_KEY = 'glaze.widgetStudio.v1';
export const STUDIO_STATE_VERSION = 1;

/** 'theme' keeps the theme's own typeface; the rest override it for every text line. */
export type StudioFont = 'theme' | DisplayFont;
export const STUDIO_FONTS: readonly StudioFont[] = Object.freeze(['theme', ...DISPLAY_FONTS] as StudioFont[]);

export type StudioBackgroundKind = 'theme' | 'colour' | 'gradient' | 'photo';

export type StudioBackground =
  | { kind: 'theme' }
  | { kind: 'colour'; colour: string }
  | { kind: 'gradient'; from: string; to: string }
  /** `uri`: the private on-device copy used for the in-app preview (never leaves the phone). */
  | { kind: 'photo'; uri: string };

/** One widget's draft. Everything optional resets to the theme. */
export type StudioSpecDraft = {
  text: Record<string, string>;
  background: StudioBackground;
  accent: string | null;
  textColour: string | null;
  font: StudioFont;
  scalePct: number;
  countdownTo: string | null;
  /** T65 look (widgetLook.ts). Optional in saved drafts from before T65 (= 'theme'). */
  look?: WidgetLook;
};

/** The studio for one theme: which widget is open and the drafts of every widget touched. */
export type StudioState = {
  v: 1;
  themeId: string;
  kind: WidgetKind;
  size: WidgetSize;
  /** spec id → draft. */
  drafts: Record<string, StudioSpecDraft>;
  /** T78: the open catalogue widget (widgetKinds.ts). Absent / null: the theme-set widget above is open. */
  catalogue?: { kind: CatalogueKind; size: CatalogueSize } | null;
  /** T78: catalogue spec id → draft. */
  catalogueDrafts?: Record<string, CatalogueDraft>;
};

// ---------------------------------------------------------------------------------- kinds / sizes

/** Kinds present in the set, in set order (data-driven: new kinds appear automatically). */
export function studioKinds(set: WidgetSet): WidgetKind[] {
  const out: WidgetKind[] = [];
  for (const s of set.specs) if (!out.includes(s.kind)) out.push(s.kind);
  return out;
}

/** Sizes a kind comes in, in set order. */
export function studioSizes(set: WidgetSet, kind: WidgetKind): WidgetSize[] {
  const out: WidgetSize[] = [];
  for (const s of set.specs) if (s.kind === kind && !out.includes(s.size)) out.push(s.size);
  return out;
}

/** Background options a widget offers (photo only where the widget has a photo area). */
export function backgroundOptions(spec: WidgetSpec): StudioBackgroundKind[] {
  const out: StudioBackgroundKind[] = [];
  if (spec.editable.photo) out.push('photo');
  if (spec.editable.colours) out.push('colour', 'gradient');
  out.push('theme');
  return out;
}

/** Text regions the user can retype, in drawing order. */
export function editableRegions(spec: WidgetSpec): { id: string; key: string | null; maxLength: number }[] {
  return spec.regions
    .filter((r) => r.text?.editable)
    .map((r) => ({ id: r.id, key: r.text!.key, maxLength: r.text!.maxLength }));
}

/** True when the widget shows a countdown (its target day is editable). */
export function hasCountdown(spec: WidgetSpec): boolean {
  return spec.regions.some((r) => r.text?.source === 'countdown');
}

// ---------------------------------------------------------------------------------- drafts

export function emptyDraft(): StudioSpecDraft {
  return { text: {}, background: { kind: 'theme' }, accent: null, textColour: null, font: 'theme', scalePct: STUDIO_SCALE_DEFAULT, countdownTo: null, look: 'theme' };
}

/** Fresh studio for a set, opened on `kind`/`size` when the set has them (else its first widget). */
export function initialStudioState(set: WidgetSet, kind?: string | null, size?: string | null): StudioState {
  if (isCatalogueKind(kind)) {
    const base = initialStudioState(set);
    return selectCatalogueWidget(base, kind, isCatalogueSize(size) ? size : undefined);
  }
  const kinds = studioKinds(set);
  const k = (kinds as string[]).includes(kind ?? '') ? (kind as WidgetKind) : kinds[0];
  const sizes = studioSizes(set, k);
  const s = (sizes as string[]).includes(size ?? '') ? (size as WidgetSize) : sizes.includes('small' as WidgetSize) ? ('small' as WidgetSize) : sizes[0];
  return { v: 1, themeId: set.themeId, kind: k, size: s, drafts: {} };
}

/** Switch widget; keeps the drafts. A kind's size is kept when that kind has it. */
export function selectWidget(set: WidgetSet, state: StudioState, kind: WidgetKind, size?: WidgetSize): StudioState {
  const kinds = studioKinds(set);
  if (!kinds.includes(kind)) return state;
  const sizes = studioSizes(set, kind);
  const want = size ?? state.size;
  const { catalogue: _open, ...rest } = state;
  return { ...rest, kind, size: sizes.includes(want) ? want : sizes[0] };
}

export function currentSpecId(set: WidgetSet, state: StudioState): string | null {
  return widgetSpecOf(set, state.kind, state.size)?.id ?? null;
}

/** The open widget's draft (empty when untouched). */
export function currentDraft(set: WidgetSet, state: StudioState): StudioSpecDraft {
  const id = currentSpecId(set, state);
  return (id && state.drafts[id]) || emptyDraft();
}

/** Change the open widget's draft. */
export function updateDraft(
  set: WidgetSet,
  state: StudioState,
  patch: Partial<StudioSpecDraft> | ((d: StudioSpecDraft) => Partial<StudioSpecDraft>),
): StudioState {
  const id = currentSpecId(set, state);
  if (!id) return state;
  const prev = state.drafts[id] ?? emptyDraft();
  const p = typeof patch === 'function' ? patch(prev) : patch;
  const next: StudioSpecDraft = { ...prev, ...p, text: { ...(p.text ?? prev.text) } };
  next.scalePct = clampScale(next.scalePct);
  return { ...state, drafts: { ...state.drafts, [id]: next } };
}

/** Set (or with '' reset) one text line of the open widget. */
export function setDraftText(set: WidgetSet, state: StudioState, regionId: string, value: string): StudioState {
  return updateDraft(set, state, (d) => {
    const text = { ...d.text };
    if (value === '') delete text[regionId];
    else text[regionId] = value;
    return { text };
  });
}

/** Back to the theme's design for the open widget. */
export function resetDraft(set: WidgetSet, state: StudioState): StudioState {
  const id = currentSpecId(set, state);
  if (!id || !state.drafts[id]) return state;
  const drafts = { ...state.drafts };
  delete drafts[id];
  return { ...state, drafts };
}

export function isDraftEmpty(d: StudioSpecDraft): boolean {
  return (
    Object.keys(d.text).length === 0 &&
    d.background.kind === 'theme' &&
    d.accent === null &&
    d.textColour === null &&
    d.font === 'theme' &&
    d.scalePct === STUDIO_SCALE_DEFAULT &&
    d.countdownTo === null &&
    (d.look ?? 'theme') === 'theme'
  );
}

/**
 * T65: looks offered in the studio, in order. Dark themes get the glow look right after their
 * own; light themes after clear and tinted.
 */
export function studioLooks(tokens: Pick<WidgetTokens, 'bg'>): WidgetLook[] {
  if (suitsGlow(tokens.bg)) return ['theme', 'glow', 'clear', 'tinted'];
  return [...WIDGET_LOOKS];
}

// ---------------------------------------------------------------------------------- size slider

/** Clamp and snap a slider value to the 5 % steps between 70 % and 130 %. */
export function clampScale(pct: unknown): number {
  const n = typeof pct === 'number' && Number.isFinite(pct) ? pct : STUDIO_SCALE_DEFAULT;
  const snapped = Math.round(n / STUDIO_SCALE_STEP) * STUDIO_SCALE_STEP;
  return Math.min(STUDIO_SCALE_MAX, Math.max(STUDIO_SCALE_MIN, snapped));
}

/** Slider value from a position along the track (0 = start, 1 = end). */
export function scaleFromFraction(f: number): number {
  const x = Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0.5;
  return clampScale(STUDIO_SCALE_MIN + x * (STUDIO_SCALE_MAX - STUDIO_SCALE_MIN));
}

/** Track position (0–1) of a slider value. */
export function fractionOfScale(pct: number): number {
  return (clampScale(pct) - STUDIO_SCALE_MIN) / (STUDIO_SCALE_MAX - STUDIO_SCALE_MIN);
}

/** One step up (+1) or down (-1). */
export function stepScale(pct: number, dir: 1 | -1): number {
  return clampScale(clampScale(pct) + dir * STUDIO_SCALE_STEP);
}

/** Point size after scaling: never below the minimum, never taller than the region (unless the design already is). */
export function scaledPointSize(sizePt: number, scalePct: number, regionHeightPt: number): number {
  const scaled = sizePt * (clampScale(scalePct) / 100);
  const fit = regionHeightPt / LINE_BOX;
  const capped = scaled > sizePt ? Math.min(scaled, Math.max(sizePt, fit)) : scaled;
  return Math.round(Math.max(STUDIO_MIN_POINT_SIZE, capped) * 10) / 10;
}

// ---------------------------------------------------------------------------------- spec

/** The draft as widgetSets edits. */
export function draftEdits(spec: WidgetSpec, d: StudioSpecDraft): WidgetEdits {
  const text: Record<string, string | null> = {};
  for (const r of editableRegions(spec)) text[r.id] = d.text[r.id] ?? null;
  const bg = d.background;
  const edits: WidgetEdits = {
    text,
    colours: {
      background: bg.kind === 'colour' ? bg.colour : bg.kind === 'gradient' ? [bg.from, bg.to] : null,
      accent: d.accent,
      text: d.textColour,
    },
  };
  if (spec.editable.photo) edits.photoRef = bg.kind === 'photo' ? WIDGET_PHOTO_FILE : null;
  if (hasCountdown(spec)) edits.countdownTo = d.countdownTo;
  if (d.look && d.look !== 'theme') edits.look = d.look;
  return edits;
}

/** Font and text-size restyle on top of an edited spec. Colours and contrast are untouched. */
export function restyleSpec(spec: WidgetSpec, d: Pick<StudioSpecDraft, 'font' | 'scalePct'>): WidgetSpec {
  const scale = clampScale(d.scalePct);
  if (d.font === 'theme' && scale === STUDIO_SCALE_DEFAULT) return spec;
  return {
    ...spec,
    typeface: d.font === 'theme' ? spec.typeface : d.font,
    regions: spec.regions.map((r) => {
      if (!r.text) return r;
      return {
        ...r,
        text: {
          ...r.text,
          font: d.font === 'theme' ? r.text.font : 'display',
          sizePt: scale === STUDIO_SCALE_DEFAULT ? r.text.sizePt : scaledPointSize(r.text.sizePt, scale, r.frame.h * spec.height),
        },
      };
    }),
  };
}

/** One widget with its draft applied. Issues use `widgets.issue.*` keys. Never throws. */
export function studioSpec(spec: WidgetSpec, d: StudioSpecDraft): { spec: WidgetSpec; issues: WidgetEditIssue[] } {
  const { spec: edited, issues } = applyWidgetEdits(spec, draftEdits(spec, d));
  return { spec: restyleSpec(edited, d), issues };
}

/** The open widget, edited. */
export function currentStudioSpec(set: WidgetSet, state: StudioState): { spec: WidgetSpec; issues: WidgetEditIssue[] } | null {
  const base = widgetSpecOf(set, state.kind, state.size);
  return base ? studioSpec(base, currentDraft(set, state)) : null;
}

/** The whole set with every draft applied. */
export function studioSet(set: WidgetSet, state: StudioState): WidgetSet {
  return { ...set, specs: set.specs.map((s) => (state.drafts[s.id] ? studioSpec(s, state.drafts[s.id]).spec : s)) };
}

/** T80: one preview on the theme page, with the person's saved studio edits applied. */
export type StudioPreview = { spec: WidgetSpec; photoUri: string | null; edited: boolean };

/**
 * T80: the theme page's "Matching widgets" row: one widget per kind, drawn with the drafts saved
 * in Widget Studio (text, colours, font, size, look, photo). Per kind it shows the size the person
 * edited (first edited size in the set's order), else small, else the first size. `state` may be
 * null (not loaded yet) or belong to another theme: then the plain set is shown. Never throws.
 */
export function studioPreviews(set: WidgetSet, state: StudioState | null): StudioPreview[] {
  const drafts = state && state.themeId === set.themeId ? state.drafts : {};
  const editedDraft = (id: string): StudioSpecDraft | null => {
    const d = drafts[id];
    return d && !isDraftEmpty(d) ? d : null;
  };
  return studioKinds(set).flatMap((kind): StudioPreview[] => {
    const sizes = studioSizes(set, kind);
    const specs = sizes.map((s) => widgetSpecOf(set, kind, s)).filter((s): s is WidgetSpec => !!s);
    const base = specs.find((s) => editedDraft(s.id)) ?? specs.find((s) => s.size === 'small') ?? specs[0];
    if (!base) return [];
    const d = editedDraft(base.id);
    if (!d) return [{ spec: base, photoUri: null, edited: false }];
    let spec = base;
    try {
      spec = studioSpec(base, d).spec;
    } catch {
      spec = base;
    }
    const photoUri = base.editable.photo && d.background.kind === 'photo' ? d.background.uri : null;
    return [{ spec, photoUri, edited: true }];
  });
}

// ---------------------------------------------------------------------------------- swatches

export type StudioSwatch = { hex: string; hex2?: string; nameKey: string; index?: number };

const PRESET_COLOURS = ['#FFFFFF', '#1D1A21', '#FFD3EA', '#E3D9FF', '#C9F1DE', '#FFEDB0', '#FFDCCB', '#CFE7FF', '#A2337F', '#22784F'];
const PRESET_GRADIENTS: [string, string][] = [
  ['#F7A8D8', '#FFC9A3'],
  ['#E3D9FF', '#CFE7FF'],
  ['#C9F1DE', '#FFEDB0'],
  ['#1D1A21', '#4B2F9A'],
  ['#FFDCCB', '#A2337F'],
];

function uniq(list: StudioSwatch[]): StudioSwatch[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.hex}|${s.hex2 ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Colour circles: the theme's own colours first, then original presets. */
export function colourSwatches(tokens: WidgetTokens): StudioSwatch[] {
  const theme: StudioSwatch[] = [
    { hex: normalizeHex(tokens.bg[0]), nameKey: 'themeUi.widgetStudio.colour.background' },
    { hex: normalizeHex(tokens.surface), nameKey: 'themeUi.widgetStudio.colour.surface' },
    { hex: normalizeHex(tokens.accent), nameKey: 'themeUi.widgetStudio.colour.accent' },
    { hex: normalizeHex(tokens.ink), nameKey: 'themeUi.widgetStudio.colour.text' },
  ];
  const presets = PRESET_COLOURS.map((hex, i) => ({ hex, nameKey: 'themeUi.widgetStudio.colour.preset', index: i + 1 }));
  return uniq([...theme, ...presets]);
}

/** Gradient circles: the theme's own pair first, then original presets. */
export function gradientSwatches(tokens: WidgetTokens): StudioSwatch[] {
  const a = normalizeHex(tokens.bg[0]);
  const b = normalizeHex(tokens.bg[1] ?? mix(tokens.bg[0], tokens.accent, 0.45));
  const theme: StudioSwatch[] = [{ hex: a, hex2: b === a ? normalizeHex(mix(a, tokens.accent, 0.45)) : b, nameKey: 'themeUi.widgetStudio.colour.themeGradient' }];
  const presets = PRESET_GRADIENTS.map(([x, y], i) => ({ hex: x, hex2: y, nameKey: 'themeUi.widgetStudio.colour.gradientPreset', index: i + 1 }));
  return uniq([...theme, ...presets]);
}

/** Value used by the swatch row for a gradient (one string per circle). */
export function gradientValue(from: string, to: string): string {
  return `${normalizeHex(from)}>${normalizeHex(to)}`;
}

export function parseGradientValue(v: string): { from: string; to: string } | null {
  const [a, b] = v.split('>');
  return a && b && isHex(a) && isHex(b) ? { from: normalizeHex(a), to: normalizeHex(b) } : null;
}

// ---------------------------------------------------------------------------------- countdown

/** Whole days from `today` (local calendar day) to `YYYY-MM-DD`; null when not a date. */
export function daysUntil(day: string | null, today: Date): number | null {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86400000);
}

// ---------------------------------------------------------------------------------- payload

export type StudioPayloadMeta = {
  /** The widget the user just added (spec id). */
  selected: string;
  /** Per spec: font and size the specs were restyled with (the v2 parser rebuilds from edits). */
  styles: Record<string, { font: StudioFont; scalePct: number }>;
};

/**
 * JSON for App Group key `glaze.widgets.v2`: the set with every draft applied (specs carry the
 * restyled regions as drawn), plus a `studio` block naming the widget just added. Photo widgets
 * reference `WIDGET_PHOTO_FILE`, which the native bridge writes separately; the preview `uri` is
 * never included.
 */
export function studioPayload(set: WidgetSet, state: StudioState, opts: { translate?: WidgetTranslate; now?: Date } = {}): string {
  const edited = studioSet(set, state);
  const out = JSON.parse(serialiseWidgetSet(edited, opts)) as Record<string, unknown>;
  const styles: StudioPayloadMeta['styles'] = {};
  for (const [id, d] of Object.entries(state.drafts)) {
    if (d.font !== 'theme' || d.scalePct !== STUDIO_SCALE_DEFAULT) styles[id] = { font: d.font, scalePct: clampScale(d.scalePct) };
  }
  const meta: StudioPayloadMeta = { selected: currentSpecId(set, state) ?? '', styles };
  out.studio = meta;
  return JSON.stringify(out);
}

/** True when the open widget uses the user's photo (the bridge must copy it first). */
export function needsPhotoCopy(set: WidgetSet, state: StudioState): string | null {
  const spec = widgetSpecOf(set, state.kind, state.size);
  const d = currentDraft(set, state);
  return spec?.editable.photo && d.background.kind === 'photo' ? d.background.uri : null;
}

// ---------------------------------------------------------------------------------- persistence

function parseBackground(raw: unknown): StudioBackground {
  if (!raw || typeof raw !== 'object') return { kind: 'theme' };
  const o = raw as Record<string, unknown>;
  if (o.kind === 'colour' && typeof o.colour === 'string' && isHex(o.colour)) return { kind: 'colour', colour: normalizeHex(o.colour) };
  if (o.kind === 'gradient' && typeof o.from === 'string' && typeof o.to === 'string' && isHex(o.from) && isHex(o.to)) {
    return { kind: 'gradient', from: normalizeHex(o.from), to: normalizeHex(o.to) };
  }
  // Only our own documents-folder copies (file:// URIs) are accepted.
  if (o.kind === 'photo' && typeof o.uri === 'string' && /^file:\/\//.test(o.uri) && o.uri.length < 1024) return { kind: 'photo', uri: o.uri };
  return { kind: 'theme' };
}

function hexOrNull(v: unknown): string | null {
  return typeof v === 'string' && isHex(v) ? normalizeHex(v) : null;
}

function parseDraft(raw: unknown): StudioSpecDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const text: Record<string, string> = {};
  if (o.text && typeof o.text === 'object' && !Array.isArray(o.text)) {
    for (const [k, v] of Object.entries(o.text as Record<string, unknown>)) {
      if (typeof v === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(k)) {
        const s = cleanWidgetText(v).slice(0, 200);
        if (s) text[k] = s;
      }
    }
  }
  const font = (STUDIO_FONTS as readonly string[]).includes(String(o.font)) ? (o.font as StudioFont) : 'theme';
  const countdownTo = typeof o.countdownTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.countdownTo) ? o.countdownTo : null;
  return {
    text,
    background: parseBackground(o.background),
    accent: hexOrNull(o.accent),
    textColour: hexOrNull(o.textColour),
    font,
    scalePct: clampScale(o.scalePct),
    countdownTo,
    look: isWidgetLook(o.look) ? o.look : 'theme',
  };
}

/** Tolerant parse of a saved studio for `set`; falls back to a fresh studio. Never throws. */
export function parseStudioState(input: unknown, set: WidgetSet): StudioState {
  const fresh = initialStudioState(set);
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return fresh;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fresh;
  const o = raw as Record<string, unknown>;
  if (o.v !== STUDIO_STATE_VERSION || o.themeId !== set.themeId) return fresh;
  const base = initialStudioState(set, typeof o.kind === 'string' ? o.kind : null, typeof o.size === 'string' ? o.size : null);
  const ids = new Set(set.specs.map((s) => s.id));
  const drafts: Record<string, StudioSpecDraft> = {};
  if (o.drafts && typeof o.drafts === 'object' && !Array.isArray(o.drafts)) {
    for (const [id, d] of Object.entries(o.drafts as Record<string, unknown>)) {
      if (!ids.has(id)) continue;
      const parsed = parseDraft(d);
      if (parsed && !isDraftEmpty(parsed)) drafts[id] = parsed;
    }
  }
  let out: StudioState = { ...base, drafts };
  const open = o.catalogue && typeof o.catalogue === 'object' ? (o.catalogue as Record<string, unknown>) : null;
  if (open && isCatalogueKind(open.kind)) out = selectCatalogueWidget(out, open.kind, isCatalogueSize(open.size) ? open.size : undefined);
  if (o.catalogueDrafts && typeof o.catalogueDrafts === 'object' && !Array.isArray(o.catalogueDrafts)) {
    const catIds = new Set(catalogueSpecIds(set.themeId));
    const cat: Record<string, CatalogueDraft> = {};
    for (const [id, d] of Object.entries(o.catalogueDrafts as Record<string, unknown>)) {
      if (!catIds.has(id)) continue;
      const parsed = parseCatalogueDraft(d);
      if (parsed && !isCatalogueDraftEmpty(parsed)) cat[id] = parsed;
    }
    if (Object.keys(cat).length) out = { ...out, catalogueDrafts: cat };
  }
  return out;
}

/** Compact JSON for storage (empty drafts dropped). */
export function serialiseStudioState(state: StudioState): string {
  const drafts: Record<string, StudioSpecDraft> = {};
  for (const [id, d] of Object.entries(state.drafts)) if (!isDraftEmpty(d)) drafts[id] = d;
  const out: Record<string, unknown> = { v: STUDIO_STATE_VERSION, themeId: state.themeId, kind: state.kind, size: state.size, drafts };
  if (state.catalogue) out.catalogue = state.catalogue;
  const cat: Record<string, CatalogueDraft> = {};
  for (const [id, d] of Object.entries(state.catalogueDrafts ?? {})) if (!isCatalogueDraftEmpty(d)) cat[id] = d;
  if (Object.keys(cat).length) out.catalogueDrafts = cat;
  return JSON.stringify(out);
}

/** All themes' studios in one stored map: themeId → serialised state. */
export function parseStudioStore(input: unknown): Record<string, unknown> {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof k === 'string' && k.length <= 64) out[k] = v;
  return out;
}

// ---------------------------------------------------------------------------------- catalogue kinds (T78)
//
// The studio also edits the catalogue kinds of widgetKinds.ts (analog clock, month calendar,
// countdown, progress dots, photo album, habit trackers) through `applyCatalogueEdits`: text,
// background / accent / text colours (not on Lock Screen sizes: iOS tints those), the countdown day
// and the album's rotation interval. Album photos aren't picked in the app yet. Font and text size
// apply to theme-set widgets only. Drafts live next to the set drafts in StudioState.

/** Catalogue background options: no photo (the album's photos are a separate list). */
export type CatalogueBackground = Exclude<StudioBackground, { kind: 'photo' }>;

export type CatalogueDraft = {
  text: Record<string, string>;
  background: CatalogueBackground;
  accent: string | null;
  textColour: string | null;
  countdownTo: string | null;
  /** Photo album: minutes between photos (one of ALBUM_INTERVALS); null = the default. */
  rotateMinutes: number | null;
  /** T85 look (catalogueLooksFor). Optional in saved drafts from before T85 (= 'theme'). */
  look?: WidgetLook;
};

/** Every catalogue kind is editable in the studio. */
export function catalogueStudioKinds(): CatalogueKind[] {
  return [...CATALOGUE_KINDS];
}

export function catalogueStudioSizes(kind: CatalogueKind): CatalogueSize[] {
  return [...(CATALOGUE_KIND_SIZES[kind] ?? [])];
}

/** Album rotation choices in minutes. */
export function rotateOptions(): number[] {
  return [...ALBUM_INTERVALS];
}

/** Spec ids of every catalogue widget for a theme (`theme:kind:size`). */
export function catalogueSpecIds(themeId: string): string[] {
  const out: string[] = [];
  for (const kind of CATALOGUE_KINDS) for (const size of CATALOGUE_KIND_SIZES[kind]) out.push(`${themeId}:${kind}:${size}`);
  return out;
}

/** The theme's catalogue (unedited), from the same tokens as its widget set. */
export function studioCatalogue(set: WidgetSet): WidgetCatalogue {
  return generateWidgetCatalogueFromTokens(set.tokens);
}

/** Open a catalogue widget; keeps every draft. A kind's size is kept when it has it, else small, else its first. */
export function selectCatalogueWidget(state: StudioState, kind: CatalogueKind, size?: CatalogueSize): StudioState {
  if (!isCatalogueKind(kind)) return state;
  const sizes = catalogueStudioSizes(kind);
  const want: string = size ?? state.catalogue?.size ?? state.size;
  const s: CatalogueSize = (sizes as string[]).includes(want) ? (want as CatalogueSize) : sizes.includes('small') ? 'small' : sizes[0];
  return { ...state, catalogue: { kind, size: s } };
}

export function isCatalogueOpen(state: StudioState): boolean {
  return !!state.catalogue;
}

export function emptyCatalogueDraft(): CatalogueDraft {
  return { text: {}, background: { kind: 'theme' }, accent: null, textColour: null, countdownTo: null, rotateMinutes: null, look: 'theme' };
}

export function isCatalogueDraftEmpty(d: CatalogueDraft): boolean {
  return (
    Object.keys(d.text).length === 0 &&
    d.background.kind === 'theme' &&
    d.accent === null &&
    d.textColour === null &&
    d.countdownTo === null &&
    d.rotateMinutes === null &&
    (d.look ?? 'theme') === 'theme'
  );
}

export function currentCatalogueSpecId(state: StudioState): string | null {
  return state.catalogue ? `${state.themeId}:${state.catalogue.kind}:${state.catalogue.size}` : null;
}

export function currentCatalogueDraft(state: StudioState): CatalogueDraft {
  const id = currentCatalogueSpecId(state);
  return (id && state.catalogueDrafts?.[id]) || emptyCatalogueDraft();
}

/** Change the open catalogue widget's draft (no-op when a theme-set widget is open). */
export function updateCatalogueDraft(
  state: StudioState,
  patch: Partial<CatalogueDraft> | ((d: CatalogueDraft) => Partial<CatalogueDraft>),
): StudioState {
  const id = currentCatalogueSpecId(state);
  if (!id) return state;
  const prev = state.catalogueDrafts?.[id] ?? emptyCatalogueDraft();
  const p = typeof patch === 'function' ? patch(prev) : patch;
  const next: CatalogueDraft = { ...prev, ...p, text: { ...(p.text ?? prev.text) } };
  if (next.rotateMinutes !== null && !(ALBUM_INTERVALS as readonly number[]).includes(next.rotateMinutes)) next.rotateMinutes = null;
  return { ...state, catalogueDrafts: { ...(state.catalogueDrafts ?? {}), [id]: next } };
}

/** Set (or with '' reset) one text line of the open catalogue widget. */
export function setCatalogueDraftText(state: StudioState, regionId: string, value: string): StudioState {
  return updateCatalogueDraft(state, (d) => {
    const text = { ...d.text };
    if (value === '') delete text[regionId];
    else text[regionId] = value;
    return { text };
  });
}

export function resetCatalogueDraft(state: StudioState): StudioState {
  const id = currentCatalogueSpecId(state);
  if (!id || !state.catalogueDrafts?.[id]) return state;
  const catalogueDrafts = { ...state.catalogueDrafts };
  delete catalogueDrafts[id];
  return { ...state, catalogueDrafts };
}

/** Text regions of a catalogue widget the user can retype, in drawing order. */
export function catalogueEditableRegions(spec: CatalogueSpec): { id: string; key: string | null; maxLength: number }[] {
  return spec.regions.filter((r) => r.text?.editable).map((r) => ({ id: r.id, key: r.text!.key, maxLength: r.text!.maxLength }));
}

/** True when the widget draws buttons (habit trackers, album "next"): the in-app preview can't press them. */
export function catalogueHasButtons(spec: CatalogueSpec): boolean {
  return spec.regions.some((r) => r.role === 'action');
}

/** The draft as widgetKinds edits (only the parts this widget supports). */
export function catalogueDraftEdits(spec: CatalogueSpec, d: CatalogueDraft): CatalogueEdits {
  const text: Record<string, string | null> = {};
  for (const r of catalogueEditableRegions(spec)) text[r.id] = d.text[r.id] ?? null;
  const edits: CatalogueEdits = { text };
  if (spec.editable.colours) {
    const bg = d.background;
    edits.colours = {
      background: bg.kind === 'colour' ? bg.colour : bg.kind === 'gradient' ? [bg.from, bg.to] : null,
      accent: d.accent,
      text: d.textColour,
    };
  }
  if (spec.editable.countdown) edits.countdownTo = d.countdownTo;
  if (spec.kind === 'photoAlbum') edits.rotateMinutes = d.rotateMinutes;
  if (d.look && d.look !== 'theme' && catalogueLooksFor(spec.family).includes(d.look)) edits.look = d.look;
  return edits;
}

/** One catalogue widget with its draft applied. Issues use `widgets.issue.*` keys. Never throws. */
export function catalogueStudioSpec(spec: CatalogueSpec, d: CatalogueDraft): { spec: CatalogueSpec; issues: CatalogueIssue[] } {
  return applyCatalogueEdits(spec, catalogueDraftEdits(spec, d));
}

/** The open catalogue widget, edited; null when a theme-set widget is open. */
export function currentCatalogueStudioSpec(cat: WidgetCatalogue, state: StudioState): { spec: CatalogueSpec; issues: CatalogueIssue[] } | null {
  if (!state.catalogue) return null;
  const base = catalogueSpecOf(cat, state.catalogue.kind, state.catalogue.size);
  return base ? catalogueStudioSpec(base, currentCatalogueDraft(state)) : null;
}

/** The whole catalogue with every catalogue draft applied. */
export function studioCatalogueEdited(cat: WidgetCatalogue, state: StudioState): WidgetCatalogue {
  const drafts = state.catalogueDrafts ?? {};
  return { ...cat, specs: cat.specs.map((s) => (drafts[s.id] ? catalogueStudioSpec(s, drafts[s.id]).spec : s)) };
}

/**
 * JSON for App Group key `glaze.widgets.v2` with the catalogue block: the edited set (as
 * studioPayload) plus the edited catalogue via serialiseWidgetCatalogue, and the `studio` block
 * naming the widget just added (a catalogue spec id when one is open).
 */
export function studioCataloguePayload(
  set: WidgetSet,
  cat: WidgetCatalogue,
  state: StudioState,
  opts: { translate?: WidgetTranslate; now?: Date } = {},
): string {
  const out = JSON.parse(serialiseWidgetCatalogue(studioSet(set, state), studioCatalogueEdited(cat, state), opts)) as Record<string, unknown>;
  const styles: StudioPayloadMeta['styles'] = {};
  for (const [id, d] of Object.entries(state.drafts)) {
    if (d.font !== 'theme' || d.scalePct !== STUDIO_SCALE_DEFAULT) styles[id] = { font: d.font, scalePct: clampScale(d.scalePct) };
  }
  const meta: StudioPayloadMeta = { selected: currentCatalogueSpecId(state) ?? currentSpecId(set, state) ?? '', styles };
  out.studio = meta;
  return JSON.stringify(out);
}

function parseCatalogueDraft(raw: unknown): CatalogueDraft | null {
  const base = parseDraft(raw);
  if (!base) return null;
  const o = raw as Record<string, unknown>;
  const rotate = typeof o.rotateMinutes === 'number' && (ALBUM_INTERVALS as readonly number[]).includes(o.rotateMinutes) ? o.rotateMinutes : null;
  return {
    text: base.text,
    background: base.background.kind === 'photo' ? { kind: 'theme' } : base.background,
    accent: base.accent,
    textColour: base.textColour,
    countdownTo: base.countdownTo,
    rotateMinutes: rotate,
    look: base.look ?? 'theme',
  };
}

// ---------------------------------------------------------------------------------- looks for every kind (T85)

/** Looks the studio offers for a catalogue widget (StandBy: theme / glow; Lock Screen: theme only). */
export function catalogueStudioLooks(spec: Pick<CatalogueSpec, 'family' | 'tokens'>): WidgetLook[] {
  return catalogueLooksFor(spec.family, spec.tokens);
}

/**
 * Looks the Widgets tab offers as a preview filter (the same order as the studio). Widgets that
 * can't take the chosen look (Lock Screen, StandBy glass) keep their theme look.
 */
export function previewLooks(tokens: Pick<WidgetTokens, 'bg'>): WidgetLook[] {
  return studioLooks(tokens);
}

/** A theme-set widget drawn in `look` (unedited otherwise). Never throws. */
export function setSpecInLook(spec: WidgetSpec, look: WidgetLook): WidgetSpec {
  if (look === spec.look) return spec;
  return applyWidgetEdits(spec, { look }).spec;
}

/** A catalogue widget drawn in `look`, or unchanged when its size can't take that look. Never throws. */
export function catalogueSpecInLook(spec: CatalogueSpec, look: WidgetLook): CatalogueSpec {
  if (look === spec.look || !catalogueLooksFor(spec.family).includes(look)) return spec;
  return applyCatalogueEdits(spec, { look }).spec;
}

// ---------------------------------------------------------------------------------- photo copies (T80)
//
// A photo picked in the studio is a private copy in documents/backgrounds/ (store/background
// keepPhotoCopy). When a later pick, a reset or another background replaces it, the old copy is
// no longer referenced by any theme's studio and can be deleted. The widget on the Home Screen
// keeps working: the native bridge copied the photo into the App Group when it was added.

/** Every studio photo URI one stored theme entry (raw, any theme) still points at. Never throws. */
export function studioPhotoUris(entry: unknown): string[] {
  let raw: unknown = entry;
  if (typeof entry === 'string') {
    try {
      raw = JSON.parse(entry);
    } catch {
      return [];
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const drafts = (raw as Record<string, unknown>).drafts;
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) return [];
  const out = new Set<string>();
  for (const d of Object.values(drafts as Record<string, unknown>)) {
    const bg = d && typeof d === 'object' ? parseBackground((d as Record<string, unknown>).background) : null;
    if (bg && bg.kind === 'photo') out.add(bg.uri);
  }
  return [...out];
}

/**
 * Studio photo copies `prev` (the whole stored map, themeId → entry) used that neither `next`
 * nor `keep` (e.g. the wallpaper backgrounds' photos) references any more. Only our own
 * documents-folder copies (`…/backgrounds/<file>`) are ever returned.
 */
export function orphanedStudioPhotos(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keep: Iterable<string> = [],
): string[] {
  const used = new Set<string>(keep);
  for (const e of Object.values(next)) for (const u of studioPhotoUris(e)) used.add(u);
  const out = new Set<string>();
  for (const e of Object.values(prev)) {
    for (const u of studioPhotoUris(e)) if (!used.has(u) && /\/backgrounds\/[^/]+$/.test(u)) out.add(u);
  }
  return [...out];
}
