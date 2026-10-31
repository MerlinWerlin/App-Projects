// T187 (owner-1101 #5): theme widget options, the "widgets" list of a remote art pack v2
// (docs/THEME_PACKS.md "Remote art pack v2"). Every widget art piece a theme ships becomes one
// option the Widgets tab offers, in every size it suits. Art is FITTED inside the widget (never
// cropped) over a background: the theme colour, a blurred copy of the art, or the matching crop of
// the wallpaper (seamless). v1 packs keep working: their widget-small / medium / large art becomes
// three options, each offered in every Home Screen size (so square art also shows whole in a wide
// medium widget instead of being cut).
//
// Pure TS (no React Native / Expo), Node-tested in widgetOptions.test.ts.

import { CATALOGUE_KIND_SIZES } from './widgetKinds.ts';

/** What an option is. `art` is a picture; the others are pictures for a widget that can also be live. */
export type WidgetOptionKind = 'art' | 'clock' | 'date' | 'calendar' | 'habits' | 'battery' | 'countdown' | 'photo' | 'quote';
export const WIDGET_OPTION_KINDS: readonly WidgetOptionKind[] = Object.freeze([
  'art',
  'clock',
  'date',
  'calendar',
  'countdown',
  'habits',
  'battery',
  'photo',
  'quote',
] as WidgetOptionKind[]);

/** Where an option can go: the three Home Screen sizes and the Lock Screen. */
export type WidgetOptionSize = 'small' | 'medium' | 'large' | 'lock';
export const WIDGET_OPTION_SIZES: readonly WidgetOptionSize[] = Object.freeze(['small', 'medium', 'large', 'lock'] as WidgetOptionSize[]);
export type HomeOptionSize = Exclude<WidgetOptionSize, 'lock'>;

/** `fit`: the whole art inside the widget. `fill`: edge to edge, only when the aspect matches (else fit). */
export type WidgetOptionFit = 'fit' | 'fill';
export const WIDGET_OPTION_FITS: readonly WidgetOptionFit[] = Object.freeze(['fit', 'fill'] as WidgetOptionFit[]);

/** What fills the widget around fitted art. */
export type WidgetOptionBackground = 'theme' | 'blur' | 'wallpaper';
export const WIDGET_OPTION_BACKGROUNDS: readonly WidgetOptionBackground[] = Object.freeze(['theme', 'blur', 'wallpaper'] as WidgetOptionBackground[]);

/** Asset roles an option's image may have. `widget-art` is new in v2; v1 roles stay usable. */
export const WIDGET_IMAGE_ROLES: readonly string[] = Object.freeze(['widget-art', 'widget-small', 'widget-medium', 'widget-large']);

export const MAX_WIDGET_OPTIONS = 32;
export const WIDGET_OPTION_LABEL_MAX = 40;
/** Same inset as the native compositor (GlazeWidgetBridgeModule) and seamlessWidget.heroRect. */
export const WIDGET_ART_PADDING = 0.06;
/** `fill` is honoured only when art and widget aspects differ by at most this (so nothing visible is lost). */
export const FILL_ASPECT_TOLERANCE = 0.02;

export type WidgetOption = {
  /** Unique in the pack: lower case a-z, 0-9 and hyphens, 1-40 characters. */
  id: string;
  kind: WidgetOptionKind;
  /** Asset path (in the pack's `assets`) of the picture. */
  image: string;
  /** Suggested sizes, unique, in the order given. */
  sizes: WidgetOptionSize[];
  fit: WidgetOptionFit;
  background: WidgetOptionBackground;
  /** Short name for the menu, or null (the app then numbers it). */
  label: string | null;
  /** Pixel size of the image (from its asset entry). */
  width: number;
  height: number;
  /** True when the option was derived from v1 fields (not written in the pack). */
  derived: boolean;
};

/** The asset fields the options need. */
export type OptionAsset = { path: string; role: string; width: number; height: number };

export type WidgetOptionsResult = {
  options: WidgetOption[];
  /** One line per dropped option or bad field; empty when everything was valid. */
  errors: string[];
};

const ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function includes<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

/**
 * Parse a v2 `widgets` list against the pack's assets. Lenient for the app: a bad option is
 * dropped (and reported in `errors`), the rest still show. A pack builder should treat any error
 * as a failure (`validateWidgetOptions`).
 */
export function parseWidgetOptions(raw: unknown, assets: readonly OptionAsset[]): WidgetOptionsResult {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { options: [], errors: ['widgets: not a list'] };
  if (raw.length > MAX_WIDGET_OPTIONS) errors.push(`widgets: more than ${MAX_WIDGET_OPTIONS} options (extra ones ignored)`);
  const byPath = new Map(assets.map((a) => [a.path, a] as const));
  const ids = new Set<string>();
  const options: WidgetOption[] = [];
  raw.slice(0, MAX_WIDGET_OPTIONS).forEach((o, i) => {
    const at = `widgets[${i}]`;
    if (!isObj(o)) return void errors.push(`${at}: not an object`);
    if (typeof o.id !== 'string' || !ID.test(o.id)) return void errors.push(`${at}: bad id`);
    if (ids.has(o.id)) return void errors.push(`${at}: duplicate id ${o.id}`);
    if (!includes(WIDGET_OPTION_KINDS, o.kind)) return void errors.push(`${at} (${o.id}): unknown kind ${String(o.kind)}`);
    const asset = typeof o.image === 'string' ? byPath.get(o.image) : undefined;
    if (!asset) return void errors.push(`${at} (${o.id}): image is not an asset of the pack`);
    if (!WIDGET_IMAGE_ROLES.includes(asset.role)) return void errors.push(`${at} (${o.id}): image asset has role ${asset.role}`);
    if (!Array.isArray(o.sizes) || o.sizes.length === 0) return void errors.push(`${at} (${o.id}): sizes missing`);
    const sizes: WidgetOptionSize[] = [];
    for (const s of o.sizes) {
      if (!includes(WIDGET_OPTION_SIZES, s)) return void errors.push(`${at} (${o.id}): unknown size ${String(s)}`);
      if (sizes.includes(s)) return void errors.push(`${at} (${o.id}): size ${s} twice`);
      sizes.push(s);
    }
    if (o.fit !== undefined && !includes(WIDGET_OPTION_FITS, o.fit)) return void errors.push(`${at} (${o.id}): bad fit`);
    if (o.background !== undefined && !includes(WIDGET_OPTION_BACKGROUNDS, o.background)) return void errors.push(`${at} (${o.id}): bad background`);
    let label: string | null = null;
    if (o.label !== undefined && o.label !== null) {
      if (typeof o.label !== 'string' || o.label.trim().length === 0 || o.label.trim().length > WIDGET_OPTION_LABEL_MAX) {
        return void errors.push(`${at} (${o.id}): bad label`);
      }
      label = o.label.trim();
    }
    ids.add(o.id);
    options.push({
      id: o.id,
      kind: o.kind,
      image: asset.path,
      sizes,
      fit: (o.fit as WidgetOptionFit | undefined) ?? 'fit',
      background: (o.background as WidgetOptionBackground | undefined) ?? 'theme',
      label,
      width: asset.width,
      height: asset.height,
      derived: false,
    });
  });
  return { options, errors };
}

/** Strict check for a pack builder: the list parses with no error and has at least one option. */
export function validateWidgetOptions(raw: unknown, assets: readonly OptionAsset[]): string[] {
  const r = parseWidgetOptions(raw, assets);
  if (r.errors.length === 0 && r.options.length === 0) return ['widgets: empty'];
  return r.errors;
}

const V1_ROLES: readonly [string, HomeOptionSize][] = [
  ['widget-small', 'small'],
  ['widget-medium', 'medium'],
  ['widget-large', 'large'],
];

/**
 * v1 → options: each widget-small / medium / large asset becomes one `art` option offered in every
 * Home Screen size (fitted, over the wallpaper like the v1 seamless widget). Its own size comes
 * first in `sizes`.
 */
export function widgetOptionsFromV1(assets: readonly OptionAsset[]): WidgetOption[] {
  const out: WidgetOption[] = [];
  for (const [role, own] of V1_ROLES) {
    const a = assets.find((x) => x.role === role);
    if (!a) continue;
    out.push({
      id: `hero-${own}`,
      kind: 'art',
      image: a.path,
      sizes: [own, ...(['small', 'medium', 'large'] as HomeOptionSize[]).filter((s) => s !== own)],
      fit: 'fit',
      background: 'wallpaper',
      label: null,
      width: a.width,
      height: a.height,
      derived: true,
    });
  }
  return out;
}

/**
 * The options of a pack: the v2 list when there is a valid one, else (v1, or a v2 list with no
 * valid option) the options derived from the v1 widget roles.
 */
export function widgetOptionsOfPack(input: { version: number; widgets?: unknown; assets: readonly OptionAsset[] }): WidgetOption[] {
  if (input.version >= 2) {
    const r = parseWidgetOptions(input.widgets, input.assets);
    if (r.options.length > 0) return r.options;
  }
  return widgetOptionsFromV1(input.assets);
}

// ------------------------------------------------------------------ geometry

export type Box = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Home Screen widget sizes in points (iPhone 15 Pro Max class; the aspect is what matters). */
export const OPTION_SIZE_POINTS: Readonly<Record<HomeOptionSize, Box>> = Object.freeze({
  small: { w: 170, h: 170 },
  medium: { w: 364, h: 170 },
  large: { w: 364, h: 382 },
});

const aspect = (b: Box): number => (b.w > 0 && b.h > 0 ? b.w / b.h : 1);

/** 0-1: how much of the widget fitted art of this aspect covers (1 = same aspect). */
export function aspectMatch(art: Box, box: Box): number {
  const a = aspect(art);
  const b = aspect(box);
  return Math.min(a, b) / Math.max(a, b);
}

export type ArtPlacement = {
  /** What is actually drawn: `fill` only when the aspects match (nothing visible is cut). */
  mode: WidgetOptionFit;
  /** Where the art goes inside the widget box (same units as the box). Always inside the box. */
  rect: Rect;
};

/**
 * Place art in a widget box. `fit` (and `fill` with a different aspect) is contain: the whole art,
 * centred, inset by WIDGET_ART_PADDING of the short side. Never larger than the box, never cropped.
 */
export function placeArt(art: Box, box: Box, fit: WidgetOptionFit = 'fit'): ArtPlacement {
  const W = Math.max(0, box.w);
  const H = Math.max(0, box.h);
  if (fit === 'fill' && 1 - aspectMatch(art, box) <= FILL_ASPECT_TOLERANCE) {
    return { mode: 'fill', rect: { x: 0, y: 0, w: W, h: H } };
  }
  const pad = Math.min(W, H) * WIDGET_ART_PADDING;
  const bw = Math.max(0, W - pad * 2);
  const bh = Math.max(0, H - pad * 2);
  const aw = art.w > 0 ? art.w : 1;
  const ah = art.h > 0 ? art.h : 1;
  const s = Math.min(bw / aw, bh / ah);
  const w = aw * s;
  const h = ah * s;
  return { mode: 'fit', rect: { x: (W - w) / 2, y: (H - h) / 2, w, h } };
}

// ------------------------------------------------------------------ menu

/** The options for one size, in pack order; derived (v1) options put the best-matching art first. */
export function optionsForSize(options: readonly WidgetOption[], size: WidgetOptionSize): WidgetOption[] {
  const list = options.filter((o) => o.sizes.includes(size));
  if (size === 'lock' || !list.every((o) => o.derived)) return list;
  const box = OPTION_SIZE_POINTS[size];
  return list
    .map((o, i) => ({ o, i, m: o.sizes[0] === size ? 2 : aspectMatch({ w: o.width, h: o.height }, box) }))
    .sort((a, b) => b.m - a.m || a.i - b.i)
    .map((x) => x.o);
}

export type WidgetOptionSection = { kind: WidgetOptionKind; options: WidgetOption[] };

/** Menu sections for one size: one per kind that has options, in WIDGET_OPTION_KINDS order. */
export function widgetOptionSections(options: readonly WidgetOption[], size: WidgetOptionSize): WidgetOptionSection[] {
  const list = optionsForSize(options, size);
  return WIDGET_OPTION_KINDS.map((kind) => ({ kind, options: list.filter((o) => o.kind === kind) })).filter((s) => s.options.length > 0);
}

/** The option to show as chosen: the remembered id if it is still offered for this size, else the first. */
export function selectedOption(options: readonly WidgetOption[], size: WidgetOptionSize, id: string | null | undefined): WidgetOption | null {
  const list = optionsForSize(options, size);
  return list.find((o) => o.id === id) ?? list[0] ?? null;
}

/** The catalogue widget (src/core/widgetKinds.ts) that makes an option's kind live, or null. */
export type LiveCatalogueKind = 'analogClock' | 'monthCalendar' | 'countdown' | 'photoAlbum' | 'habitWater';
export function liveKindOf(kind: WidgetOptionKind): LiveCatalogueKind | null {
  switch (kind) {
    case 'clock':
      return 'analogClock';
    case 'date':
    case 'calendar':
      return 'monthCalendar';
    case 'countdown':
      return 'countdown';
    case 'photo':
      return 'photoAlbum';
    case 'habits':
      return 'habitWater';
    default:
      return null;
  }
}

/**
 * Widget Studio link that makes an option live: its catalogue widget in this theme, in this size
 * when that widget comes in it, else its first Home Screen size. null for kinds with no live widget.
 */
export function liveStudioHref(themeId: string, kind: WidgetOptionKind, size: HomeOptionSize): string | null {
  const live = liveKindOf(kind);
  if (!live) return null;
  const sizes = CATALOGUE_KIND_SIZES[live] as readonly string[];
  const s = sizes.includes(size) ? size : (['small', 'medium', 'large'] as const).find((x) => sizes.includes(x));
  if (!s) return null;
  return `/widget-studio?theme=${encodeURIComponent(themeId)}&kind=${encodeURIComponent(live)}&size=${encodeURIComponent(s)}`;
}

/** i18n key of a kind's section title (tabs.widgetsTab.art.kinds.<kind>). */
export function widgetOptionKindKey(kind: WidgetOptionKind): string {
  return `tabs.widgetsTab.art.kinds.${kind}`;
}
