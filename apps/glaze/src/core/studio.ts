// Icon Studio state: which apps are selected (in order), user-added apps, the whole-set
// style, per-app overrides keyed by theme (v2), the user's own image library, the applied
// theme and the wallpaper colour.
// Pure TS (no React Native / Expo): parsing of stored JSON, defaults and the selection /
// ordering logic live here so they are unit-tested. src/store/studio.ts persists it.

import { sanitizeIconArt } from './artwork.ts';
import { packMotifIds } from './packMotifs.ts';
import { CATALOGUE, getById, search, type CatalogueEntry } from './catalogue.ts';
import { isHex, lighten, mix, normalizeHex } from './colour.ts';
import { MONOGRAM_GLYPH, cleanMonogramText } from './monogram.ts';
import { DEFAULT_ICON_LOOK, iconStyleForLook, isIconLook, type IconLook, type LookTheme } from './iconLook.ts';
import {
  resolveSpecs,
  type IconApp,
  type IconBackground,
  type IconOverride,
  type IconShape,
  type IconSpec,
  type IconStyle,
} from './iconspec.ts';

export const STUDIO_STORE_VERSION = 2;

/** themeOverrides key for "all themes" (explicit opt-in; a theme's own override still wins). */
export const ALL_THEMES_KEY = '*';
/** themeOverrides key used while no theme is applied (the user's own Icon Studio style). */
export const NO_THEME_KEY = 'custom';
export const MAX_THEME_KEY_LENGTH = 64;
export const MAX_LIBRARY_IMAGES = 300;
export const MAX_IMAGE_LABEL_LENGTH = 40;
export const MAX_THEME_SHAPES = 200;

/** One of the user's own images, kept on the device so it can be re-applied to any app/theme. */
export type CustomImage = { id: string; uri: string; addedAt: number; label?: string };

export type CustomApp = { id: string; name: string; urlScheme: string | null; glyph: string };

export type StudioState = {
  /** App ids (catalogue or custom) in Home Screen order. */
  selected: string[];
  /** User-added apps not in the catalogue; ids start with 'custom-'. */
  customApps: CustomApp[];
  style: IconStyle;
  /**
   * Per-app overrides keyed by theme: themeOverrides[themeKey][appId]. themeKey is a theme id,
   * NO_THEME_KEY while no theme is applied, or ALL_THEMES_KEY for "use in all themes".
   * Precedence in theme T: themeOverrides[T][app] > themeOverrides['*'][app] > the theme's style.
   */
  themeOverrides: Record<string, Record<string, IconOverride>>;
  /** The user's own images (deduped by uri). Every overrideImage in use is also listed here. */
  images: CustomImage[];
  themeId: string | null;
  /**
   * The icon shape the user chose for each theme (theme id -> shape). Applying a theme uses its
   * chosen shape, so it is baked into the exported icons. Missing = the theme's own shape.
   * Added in Oct 2026 without a version bump: older stored state simply has none.
   */
  themeShapes: Record<string, IconShape>;
  /**
   * T240: the icon look the user picked for each theme (theme id -> look). Missing = the default,
   * 'themed' (T241). Added without a version bump: older stored state simply has none.
   */
  themeLooks: Record<string, IconLook>;
  /**
   * T241: true once a stored theme style from before looks existed has been moved to 'themed'
   * (only when the user had not changed it in Icon Studio). New installs start migrated.
   */
  looksMigrated: boolean;
  /** Average wallpaper colour: icon backdrop + preview background. */
  wallpaperColour: string | null;
};

export const CUSTOM_PREFIX = 'custom-';
/** T66: custom apps start with their own monogram (was 'star'; stored apps keep their glyph). */
export const CUSTOM_DEFAULT_GLYPH = MONOGRAM_GLYPH;
export const MAX_LABEL_LENGTH = 40;
export const MAX_SELECTED = 200;

const SHAPES: readonly IconShape[] = ['squircle', 'circle', 'rounded', 'square', 'blob'];

/** Plum glaze look from the design tokens (glaze-a -> a deepened glaze-b so white glyphs stay ≥ 3:1). */
export const DEFAULT_STYLE: IconStyle = Object.freeze({
  shape: 'squircle',
  background: Object.freeze({ kind: 'gradient', from: '#7A2E6B', to: '#C4573E', angle: 135 }) as IconBackground,
  glyphColour: '#FFFFFF',
  glyphSet: 'feather',
  showLabel: true,
  glyphScale: 0.55,
}) as IconStyle;

/** Glyph size steps offered by the studio. */
export const GLYPH_SIZES: readonly { key: 'S' | 'M' | 'L'; label: string; scale: number }[] = Object.freeze([
  { key: 'S', label: 'Small', scale: 0.45 },
  { key: 'M', label: 'Medium', scale: 0.55 },
  { key: 'L', label: 'Large', scale: 0.65 },
]);

/** Curated background palette (12). */
export const STYLE_PALETTE: readonly { name: string; hex: string }[] = Object.freeze([
  { name: 'Plum', hex: '#7A2E6B' },
  { name: 'Terracotta', hex: '#C4573E' },
  { name: 'Clay', hex: '#E0794F' },
  { name: 'Honey', hex: '#E3A72F' },
  { name: 'Sage', hex: '#7E9C7A' },
  { name: 'Forest', hex: '#2C5A43' },
  { name: 'Teal', hex: '#1F7A80' },
  { name: 'Ocean', hex: '#2D4F8C' },
  { name: 'Lilac', hex: '#B79BD8' },
  { name: 'Blush', hex: '#F2C4CE' },
  { name: 'Porcelain', hex: '#F6F3F5' },
  { name: 'Ink', hex: '#1E1A1D' },
]);

/** Glyph colour choices. */
export const GLYPH_PALETTE: readonly { name: string; hex: string }[] = Object.freeze([
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Porcelain', hex: '#F6F3F5' },
  { name: 'Ink', hex: '#1E1A1D' },
  { name: 'Plum', hex: '#7A2E6B' },
  { name: 'Clay', hex: '#E0794F' },
  { name: 'Honey', hex: '#E3A72F' },
  { name: 'Forest', hex: '#2C5A43' },
  { name: 'Ocean', hex: '#2D4F8C' },
]);

/** Common apps for the "Add popular apps" quick start (all in the catalogue). */
export const POPULAR_APP_IDS: readonly string[] = Object.freeze([
  'messages', 'phone', 'camera', 'photos', 'safari', 'mail', 'maps', 'music',
  'calendar', 'settings', 'whatsapp', 'instagram', 'spotify', 'youtube', 'notes', 'weather',
]);

export function defaultStudioState(): StudioState {
  return {
    selected: [],
    customApps: [],
    style: cloneStyle(DEFAULT_STYLE),
    themeOverrides: {},
    images: [],
    themeId: null,
    themeShapes: {},
    themeLooks: {},
    looksMigrated: true,
    wallpaperColour: null,
  };
}

function cloneStyle(s: IconStyle): IconStyle {
  return { ...s, background: { ...s.background } };
}

// ---------------------------------------------------------------- sanitizers

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function hexOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && isHex(v) ? normalizeHex(v) : fallback;
}

function hexOrNull(v: unknown): string | null {
  return typeof v === 'string' && isHex(v) ? normalizeHex(v) : null;
}

function finiteIn(v: unknown, lo: number, hi: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;
}

function isShape(v: unknown): v is IconShape {
  return typeof v === 'string' && (SHAPES as readonly string[]).includes(v);
}

export function sanitizeBackground(raw: unknown): IconBackground | null {
  if (!isObj(raw)) return null;
  if (raw.kind === 'solid') {
    const colour = hexOrNull(raw.colour);
    return colour ? { kind: 'solid', colour } : null;
  }
  if (raw.kind === 'gradient') {
    const from = hexOrNull(raw.from);
    const to = hexOrNull(raw.to);
    if (!from || !to) return null;
    const angle = finiteIn(raw.angle, -360, 360) ?? 135;
    return { kind: 'gradient', from, to, angle };
  }
  if (raw.kind === 'glass') {
    const tint = hexOrNull(raw.tint);
    if (!tint) return null;
    return { kind: 'glass', tint, opacity: finiteIn(raw.opacity, 0, 1) ?? 0.55 };
  }
  return null;
}

/** Any malformed field falls back to DEFAULT_STYLE's value. */
export function sanitizeStyle(raw: unknown): IconStyle {
  const d = DEFAULT_STYLE;
  if (!isObj(raw)) return cloneStyle(d);
  const style: IconStyle = {
    shape: isShape(raw.shape) ? raw.shape : d.shape,
    background: sanitizeBackground(raw.background) ?? { ...d.background },
    glyphColour: hexOr(raw.glyphColour, d.glyphColour),
    glyphSet: typeof raw.glyphSet === 'string' && raw.glyphSet.trim() ? raw.glyphSet.trim() : d.glyphSet,
    showLabel: typeof raw.showLabel === 'boolean' ? raw.showLabel : d.showLabel,
    glyphScale: finiteIn(raw.glyphScale, 0.2, 0.9) ?? d.glyphScale,
  };
  // Theme artwork (T24) is kept when valid; a style without it draws plain icons. Motifs from
  // downloaded packs are kept too, so restorePackMotifs must run before the saved state is read (T50).
  const art = sanitizeIconArt(raw.art, packMotifIds());
  if (art) style.art = art;
  return style;
}

/** Keeps only valid fields; returns null when nothing is left. */
export function sanitizeOverride(raw: unknown): IconOverride | null {
  if (!isObj(raw)) return null;
  const o: IconOverride = {};
  if (typeof raw.label === 'string' && raw.label.trim()) o.label = raw.label.trim().slice(0, MAX_LABEL_LENGTH);
  if (typeof raw.glyph === 'string' && raw.glyph.trim()) o.glyph = raw.glyph.trim();
  const gc = hexOrNull(raw.glyphColour);
  if (gc) o.glyphColour = gc;
  const bg = sanitizeBackground(raw.background);
  if (bg) o.background = bg;
  if (isShape(raw.shape)) o.shape = raw.shape;
  if (typeof raw.showLabel === 'boolean') o.showLabel = raw.showLabel;
  const gs = finiteIn(raw.glyphScale, 0.2, 0.9);
  if (gs !== null) o.glyphScale = gs;
  if (typeof raw.overrideImage === 'string' && raw.overrideImage.trim()) o.overrideImage = raw.overrideImage.trim();
  const mt = cleanMonogramText(raw.monogramText);
  if (mt) o.monogramText = mt;
  return Object.keys(o).length > 0 ? o : null;
}

/**
 * Normalise a user-typed URL scheme. Empty -> null (Shortcuts path). "spotify" -> "spotify://".
 * Returns undefined when the text is not a usable scheme.
 */
export function normalizeUrlScheme(input: string | null | undefined): string | null | undefined {
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s) return null;
  if (/\s/.test(s)) return undefined;
  const withColon = s.includes(':') ? s : `${s}://`;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(withColon)) return undefined;
  return withColon;
}

function sanitizeCustomApp(raw: unknown): CustomApp | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_LABEL_LENGTH) : '';
  if (!id.startsWith(CUSTOM_PREFIX) || id.length <= CUSTOM_PREFIX.length || !name) return null;
  const scheme = normalizeUrlScheme(typeof raw.urlScheme === 'string' ? raw.urlScheme : null);
  const glyph = typeof raw.glyph === 'string' && raw.glyph.trim() ? raw.glyph.trim() : CUSTOM_DEFAULT_GLYPH;
  return { id, name, urlScheme: scheme ?? null, glyph };
}

/** Repair any partially valid state (unknown ids dropped, duplicates removed, bad fields defaulted). */
export function sanitizeStudioState(raw: unknown): StudioState {
  const out = defaultStudioState();
  if (!isObj(raw)) return out;
  const customs: CustomApp[] = [];
  const customIds = new Set<string>();
  for (const item of Array.isArray(raw.customApps) ? raw.customApps : []) {
    const c = sanitizeCustomApp(item);
    if (c && !customIds.has(c.id)) {
      customIds.add(c.id);
      customs.push(c);
    }
  }
  out.customApps = customs;
  const known = (id: string) => customIds.has(id) || getById(id) !== undefined;
  const seen = new Set<string>();
  for (const id of Array.isArray(raw.selected) ? raw.selected : []) {
    if (typeof id === 'string' && known(id) && !seen.has(id) && out.selected.length < MAX_SELECTED) {
      seen.add(id);
      out.selected.push(id);
    }
  }
  out.style = sanitizeStyle(raw.style);
  out.themeId = typeof raw.themeId === 'string' && raw.themeId.trim() ? raw.themeId.trim() : null;
  out.wallpaperColour = hexOrNull(raw.wallpaperColour);
  if (isObj(raw.themeShapes)) {
    for (const [k, v] of Object.entries(raw.themeShapes)) {
      const key = cleanThemeKey(k);
      if (key && key !== ALL_THEMES_KEY && isShape(v) && Object.keys(out.themeShapes).length < MAX_THEME_SHAPES) {
        out.themeShapes[key] = v;
      }
    }
  }
  if (isObj(raw.themeLooks)) {
    for (const [k, v] of Object.entries(raw.themeLooks)) {
      const key = cleanThemeKey(k);
      if (key && key !== ALL_THEMES_KEY && isIconLook(v) && Object.keys(out.themeLooks).length < MAX_THEME_SHAPES) {
        out.themeLooks[key] = v;
      }
    }
  }
  // Stored state from before T241 has no flag: it still needs the themed-default migration.
  out.looksMigrated = raw.looksMigrated === true;
  const sanitizeMap = (m: unknown): Record<string, IconOverride> => {
    const res: Record<string, IconOverride> = {};
    if (!isObj(m)) return res;
    for (const [id, v] of Object.entries(m)) {
      if (!known(id)) continue;
      const o = sanitizeOverride(v);
      if (o) res[id] = o;
    }
    return res;
  };
  if (isObj(raw.themeOverrides)) {
    for (const [k, m] of Object.entries(raw.themeOverrides)) {
      const key = cleanThemeKey(k);
      if (!key) continue;
      const map = { ...(out.themeOverrides[key] ?? {}), ...sanitizeMap(m) };
      if (Object.keys(map).length > 0) out.themeOverrides[key] = map;
    }
  }
  // v1 migration: per-app overrides belonged to whatever theme was applied (or none).
  if (isObj(raw.overrides)) {
    const key = activeThemeKey(out);
    const legacy = sanitizeMap(raw.overrides);
    const map = { ...legacy, ...(out.themeOverrides[key] ?? {}) };
    if (Object.keys(map).length > 0) out.themeOverrides[key] = map;
  }
  for (const item of Array.isArray(raw.images) ? raw.images : []) {
    if (out.images.length >= MAX_LIBRARY_IMAGES) break;
    const img = sanitizeImage(item);
    if (img) out.images = addImageEntry(out.images, img);
  }
  // Invariant: every image an override uses is in the library (v1 photos are migrated here).
  for (const uri of overrideImageUris(out)) {
    if (!out.images.some((i) => i.uri === uri)) {
      out.images = addImageEntry(out.images, { id: '', uri, addedAt: timeFromUri(uri) });
    }
  }
  return out;
}

export function serializeStudioState(s: StudioState): string {
  return JSON.stringify({ version: STUDIO_STORE_VERSION, ...s });
}

/** Parse stored JSON; corrupt, missing or newer-version data gives the default state. */
export function parseStudioState(json: string | null | undefined): StudioState {
  if (!json) return defaultStudioState();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return defaultStudioState();
  }
  if (isObj(raw) && typeof raw.version === 'number' && raw.version > STUDIO_STORE_VERSION) return defaultStudioState();
  return sanitizeStudioState(raw);
}

// ---------------------------------------------------------------- apps + specs

/** Look up a selectable app (catalogue or custom) by id. */
export function findApp(s: StudioState, id: string): IconApp | null {
  const custom = s.customApps.find((c) => c.id === id);
  if (custom) return { id: custom.id, name: custom.name, urlScheme: custom.urlScheme, glyph: custom.glyph };
  const e = getById(id);
  return e ? { id: e.id, name: e.name, urlScheme: e.urlScheme, glyph: e.glyph } : null;
}

/** Selected apps (catalogue + custom) in selected order; unknown ids are skipped. */
export function studioApps(s: StudioState): IconApp[] {
  const out: IconApp[] = [];
  for (const id of s.selected) {
    const a = findApp(s, id);
    if (a) out.push(a);
  }
  return out;
}

/** One IconSpec per selected app, in order, with the active theme's overrides. */
export function studioSpecs(s: StudioState): IconSpec[] {
  return resolveSpecs(studioApps(s), s.style, effectiveOverrides(s, activeThemeKey(s)));
}

/** Selected apps resolved for any theme key with that theme's icon style (e.g. a theme detail page). */
export function specsForTheme(s: StudioState, themeKey: string, style: IconStyle): IconSpec[] {
  return resolveSpecs(studioApps(s), style, effectiveOverrides(s, themeKey));
}

// ---------------------------------------------------------------- edits (pure, return new state)

export function isSelected(s: StudioState, id: string): boolean {
  return s.selected.includes(id);
}

export function toggleApp(s: StudioState, id: string): StudioState {
  if (s.selected.includes(id)) return { ...s, selected: s.selected.filter((x) => x !== id) };
  if (!findApp(s, id) || s.selected.length >= MAX_SELECTED) return s;
  return { ...s, selected: [...s.selected, id] };
}

export function removeApp(s: StudioState, id: string): StudioState {
  return { ...s, selected: s.selected.filter((x) => x !== id) };
}

/** Add apps that are not selected yet (keeps order, skips unknown ids). */
export function addApps(s: StudioState, ids: readonly string[]): StudioState {
  const selected = [...s.selected];
  for (const id of ids) {
    if (selected.length >= MAX_SELECTED) break;
    if (!selected.includes(id) && findApp(s, id)) selected.push(id);
  }
  return { ...s, selected };
}

export function addPopularApps(s: StudioState): StudioState {
  return addApps(s, POPULAR_APP_IDS);
}

export function moveApp(s: StudioState, from: number, to: number): StudioState {
  if (from < 0 || from >= s.selected.length) return s;
  const t = Math.max(0, Math.min(s.selected.length - 1, to));
  if (t === from) return s;
  const selected = [...s.selected];
  const [x] = selected.splice(from, 1);
  selected.splice(t, 0, x);
  return { ...s, selected };
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'app';
}

/** A new unique custom id for `name`. */
export function customAppId(s: StudioState, name: string): string {
  const base = `${CUSTOM_PREFIX}${slug(name)}`;
  const taken = new Set(s.customApps.map((c) => c.id));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export type AddCustomResult = { ok: true; state: StudioState; id: string } | { ok: false; error: string };

/** Add a user's own app (and select it). Without a scheme it installs via Shortcuts. */
export function addCustomApp(
  s: StudioState,
  input: { name: string; urlScheme?: string | null; glyph?: string },
): AddCustomResult {
  const name = (input.name ?? '').trim().slice(0, MAX_LABEL_LENGTH);
  if (!name) return { ok: false, error: 'Give the app a name.' };
  const scheme = normalizeUrlScheme(input.urlScheme ?? null);
  if (scheme === undefined) return { ok: false, error: 'That URL scheme does not look right. It should look like appname:// (no spaces).' };
  const id = customAppId(s, name);
  const app: CustomApp = {
    id,
    name,
    urlScheme: scheme,
    glyph: input.glyph && input.glyph.trim() ? input.glyph.trim() : CUSTOM_DEFAULT_GLYPH,
  };
  const next: StudioState = { ...s, customApps: [...s.customApps, app] };
  return { ok: true, id, state: addApps(next, [id]) };
}

/** Forget a custom app entirely (selection + its overrides in every theme). Its images stay in the library. */
export function deleteCustomApp(s: StudioState, id: string): StudioState {
  const themeOverrides: StudioState['themeOverrides'] = {};
  for (const [k, m] of Object.entries(s.themeOverrides)) {
    const map = { ...m };
    delete map[id];
    if (Object.keys(map).length > 0) themeOverrides[k] = map;
  }
  return {
    ...s,
    customApps: s.customApps.filter((c) => c.id !== id),
    selected: s.selected.filter((x) => x !== id),
    themeOverrides,
  };
}

/**
 * Set or clear an app's override where it is edited for the active theme
 * (the "all themes" override if that is what the app uses there). Empty overrides are removed.
 */
export function setOverride(s: StudioState, id: string, override: IconOverride | null, now: number = Date.now()): StudioState {
  const key = activeThemeKey(s);
  return setThemeOverride(s, overrideTargetKey(s, key, id), id, override, now);
}

/** Change the whole-set style. A shape change is also remembered for the applied theme. */
export function setStyle(s: StudioState, patch: Partial<IconStyle>): StudioState {
  const style = sanitizeStyle({ ...s.style, ...patch });
  if (patch.shape !== undefined && isShape(patch.shape) && s.themeId) {
    return { ...s, style, themeShapes: { ...s.themeShapes, [s.themeId]: style.shape } };
  }
  return { ...s, style };
}

// ---------------------------------------------------------------- shape per theme

/** The shape to use for `themeId`: the user's choice, else the theme's own shape. */
export function themeShapeFor(s: Pick<StudioState, 'themeShapes'>, themeId: string, themeDefault: IconShape): IconShape {
  const chosen = s.themeShapes[themeId];
  return isShape(chosen) ? chosen : themeDefault;
}

/**
 * Remember the user's shape for a theme. If that theme is the applied one, the studio style
 * changes too, so studioSpecs (and so the exported icons) use the new shape straight away.
 */
export function setThemeShape(s: StudioState, themeId: string, shape: IconShape): StudioState {
  const key = cleanThemeKey(themeId);
  if (!key || key === ALL_THEMES_KEY || !isShape(shape)) return s;
  const themeShapes = { ...s.themeShapes, [key]: shape };
  if (s.themeId === key) return { ...s, themeShapes, style: sanitizeStyle({ ...s.style, shape }) };
  return { ...s, themeShapes };
}

/** Forget the user's shape for a theme (back to the theme's own). The applied style is left as is. */
export function clearThemeShape(s: StudioState, themeId: string): StudioState {
  if (!(themeId in s.themeShapes)) return s;
  const themeShapes = { ...s.themeShapes };
  delete themeShapes[themeId];
  return { ...s, themeShapes };
}

/** A theme's icon style with the user's chosen shape for it (for previews and applying). */
export function themeStyleWithShape(s: Pick<StudioState, 'themeShapes'>, themeId: string, style: IconStyle): IconStyle {
  return { ...style, shape: themeShapeFor(s, themeId, style.shape) };
}

// ---------------------------------------------------------------- icon look per theme (T240 / T241)

/** The look to use for `themeId`: the user's pick, else 'themed'. */
export function themeLookFor(s: Pick<StudioState, 'themeLooks'>, themeId: string): IconLook {
  const chosen = s.themeLooks?.[themeId];
  return isIconLook(chosen) ? chosen : DEFAULT_ICON_LOOK;
}

/** A theme's icon style in the user's look for it, with the user's shape (previews + applying). */
export function themeIconStyle(s: Pick<StudioState, 'themeShapes' | 'themeLooks'>, theme: LookTheme, key: string = theme.id): IconStyle {
  return themeStyleWithShape(s, key, iconStyleForLook(theme, themeLookFor(s, key)));
}

/**
 * Remember the user's look for a theme. If that theme is the applied one, the studio style
 * changes too (keeping the shape), so the exported icons use the new look straight away.
 */
export function setThemeLook(s: StudioState, theme: LookTheme, look: IconLook, themeKey: string = theme.id): StudioState {
  const key = cleanThemeKey(themeKey);
  if (!key || key === ALL_THEMES_KEY || !isIconLook(look)) return s;
  const themeLooks = { ...s.themeLooks, [key]: look };
  if (s.themeId === key) {
    return { ...s, themeLooks, style: sanitizeStyle({ ...iconStyleForLook(theme, look), shape: s.style.shape }) };
  }
  return { ...s, themeLooks };
}

function sameBackground(a: IconBackground, b: IconBackground): boolean {
  return JSON.stringify(sanitizeBackground(a)) === JSON.stringify(sanitizeBackground(b));
}

/**
 * T241 migration: stored state from before looks has the applied theme's old flat style. Move it
 * to the themed look unless the user had changed the background or glyph colour in Icon Studio
 * (an explicit pick, kept). `theme` is the applied theme (undefined while it is not available,
 * e.g. a pack not restored yet: the state is returned unchanged and the migration retries later).
 */
export function migrateThemedLook(s: StudioState, theme: LookTheme | undefined): StudioState {
  if (s.looksMigrated) return s;
  if (!s.themeId) return { ...s, looksMigrated: true };
  if (!theme || theme.id !== s.themeId) return s;
  const untouched =
    sameBackground(s.style.background, theme.iconStyle.background) &&
    normalizeHex(s.style.glyphColour) === normalizeHex(theme.iconStyle.glyphColour) &&
    s.themeLooks[theme.id] === undefined;
  if (!untouched) return { ...s, looksMigrated: true };
  return { ...s, looksMigrated: true, style: sanitizeStyle({ ...iconStyleForLook(theme, DEFAULT_ICON_LOOK), shape: s.style.shape }) };
}

/**
 * Apply a theme's whole-set style (the theme detail's Apply flow): the theme's style with the
 * user's chosen shape for it, the theme id and (optionally) the wallpaper colour. Keeps
 * selection, overrides, images and every theme's shape choice.
 */
export function applyThemeStyle(
  s: StudioState,
  style: IconStyle,
  themeId: string | null,
  wallpaperColour?: string | null,
): StudioState {
  const id = themeId ? cleanThemeKey(themeId) : null;
  const next: StudioState = {
    ...s,
    style: sanitizeStyle(id ? themeStyleWithShape(s, id, style) : style),
    themeId: id,
    wallpaperColour: wallpaperColour === undefined ? s.wallpaperColour : hexOrNull(wallpaperColour),
  };
  return next;
}

// ---------------------------------------------------------------- background helpers

export type BackgroundKind = IconBackground['kind'];

/** The main colour of a background (solid colour, gradient start, glass tint). */
export function backgroundBase(bg: IconBackground): string {
  return bg.kind === 'solid' ? bg.colour : bg.kind === 'gradient' ? bg.from : bg.tint;
}

/** Build a background of `kind` from one base colour. Gradients run base -> a lighter, warmer partner. */
export function makeBackground(kind: BackgroundKind, base: string, prev?: IconBackground): IconBackground {
  const c = isHex(base) ? normalizeHex(base) : '#7A2E6B';
  if (kind === 'solid') return { kind: 'solid', colour: c };
  if (kind === 'glass') return { kind: 'glass', tint: c, opacity: prev && prev.kind === 'glass' ? prev.opacity : 0.55 };
  const angle = prev && prev.kind === 'gradient' ? prev.angle : 135;
  return { kind: 'gradient', from: c, to: gradientPartner(c), angle };
}

/** Partner colour for a one-colour gradient: shift toward clay and lighten a touch. */
export function gradientPartner(base: string): string {
  return lighten(mix(base, '#E0794F', 0.45), 0.04);
}

// ---------------------------------------------------------------- picker

export type PickerRow = { id: string; name: string; category: string; urlScheme: string | null; glyph: string; custom: boolean };

function rowOf(e: CatalogueEntry): PickerRow {
  return { id: e.id, name: e.name, category: e.category, urlScheme: e.urlScheme, glyph: e.glyph, custom: false };
}

export const MY_APPS_CATEGORY = 'My apps';

/**
 * Rows for the "Add apps" list: custom apps that match first, then catalogue search() results,
 * optionally filtered to one category (or MY_APPS_CATEGORY for custom apps only).
 */
export function pickerResults(s: StudioState, query: string, category: string | null, limit: number = 60): PickerRow[] {
  const q = (query ?? '').trim().toLowerCase();
  const customs: PickerRow[] = s.customApps
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .map((c) => ({ id: c.id, name: c.name, category: MY_APPS_CATEGORY, urlScheme: c.urlScheme, glyph: c.glyph, custom: true }));
  if (category === MY_APPS_CATEGORY) return customs.slice(0, limit);
  const cat = category
    ? (q ? search(q) : [...CATALOGUE].sort((a, b) => a.name.localeCompare(b.name))).filter((e) => e.category === category)
    : search(q);
  const rows = cat.map(rowOf);
  return [...(category ? [] : customs), ...rows].slice(0, limit);
}

// ---------------------------------------------------------------- overrides by app + theme (v2)

/** A usable themeOverrides key (trimmed, bounded), or null. */
export function cleanThemeKey(k: unknown): string | null {
  if (typeof k !== 'string') return null;
  const t = k.trim();
  return t && t.length <= MAX_THEME_KEY_LENGTH ? t : null;
}

/** The key overrides use for the applied theme: its id, or NO_THEME_KEY when none is applied. */
export function activeThemeKey(s: { themeId: string | null }): string {
  return s.themeId ?? NO_THEME_KEY;
}

/** The override an app uses in `themeKey` (its own, else the "all themes" one), or undefined. */
export function effectiveOverride(s: StudioState, themeKey: string, appId: string): IconOverride | undefined {
  const own = s.themeOverrides[themeKey]?.[appId];
  if (own) return own;
  return s.themeOverrides[ALL_THEMES_KEY]?.[appId];
}

/** All apps' effective overrides in `themeKey` (the theme's own win over "all themes"). */
export function effectiveOverrides(s: StudioState, themeKey: string): Record<string, IconOverride> {
  const own = themeKey === ALL_THEMES_KEY ? {} : s.themeOverrides[themeKey] ?? {};
  return { ...(s.themeOverrides[ALL_THEMES_KEY] ?? {}), ...own };
}

/** True when the app has its own override in `themeKey` or an "all themes" override. */
export function isCustomised(s: StudioState, themeKey: string, appId: string): boolean {
  return effectiveOverride(s, themeKey, appId) !== undefined;
}

/** App ids customised in `themeKey` (for badges). */
export function customisedAppIds(s: StudioState, themeKey: string): Set<string> {
  return new Set(Object.keys(effectiveOverrides(s, themeKey)));
}

/** True when the app shows its "all themes" override in `themeKey` (no theme-specific one). */
export function usesAllThemes(s: StudioState, themeKey: string, appId: string): boolean {
  return !s.themeOverrides[themeKey]?.[appId] && !!s.themeOverrides[ALL_THEMES_KEY]?.[appId];
}

/** Where an edit made while viewing `themeKey` should go: the override the app shows there. */
export function overrideTargetKey(s: StudioState, themeKey: string, appId: string): string {
  return usesAllThemes(s, themeKey, appId) ? ALL_THEMES_KEY : themeKey;
}

function withMap(s: StudioState, key: string, appId: string, o: IconOverride | null): StudioState {
  const themeOverrides = { ...s.themeOverrides };
  const map = { ...(themeOverrides[key] ?? {}) };
  if (o) map[appId] = o;
  else delete map[appId];
  if (Object.keys(map).length > 0) themeOverrides[key] = map;
  else delete themeOverrides[key];
  return { ...s, themeOverrides };
}

/**
 * Set (replace) or clear the override for one app in one theme key. An override image is also
 * added to the library so it is kept after a restore. Empty overrides clear it; a bad key is a no-op.
 */
export function setThemeOverride(
  s: StudioState,
  themeKey: string,
  appId: string,
  override: IconOverride | null,
  now: number = Date.now(),
): StudioState {
  const key = cleanThemeKey(themeKey);
  if (!key) return s;
  const clean = override ? sanitizeOverride(override) : null;
  let next = withMap(s, key, appId, clean);
  if (clean?.overrideImage) next = addImage(next, clean.overrideImage, now).state;
  return next;
}

/**
 * Back to the theme's own artwork for this app in `themeKey`: removes its override there and,
 * if the app was using an "all themes" override, that one too (otherwise it would still show).
 * Images are never removed: they stay in the library for re-use.
 */
export function restoreThemeArtwork(s: StudioState, themeKey: string, appId: string): StudioState {
  let next = withMap(s, themeKey, appId, null);
  if (themeKey !== ALL_THEMES_KEY && next.themeOverrides[ALL_THEMES_KEY]?.[appId]) {
    next = withMap(next, ALL_THEMES_KEY, appId, null);
  }
  return next;
}

/**
 * "Use in all themes": the override becomes the app's "all themes" override and any
 * theme-specific overrides for the app are removed so it really shows everywhere.
 * Null clears the "all themes" override only. Images stay in the library.
 */
export function applyToAllThemes(
  s: StudioState,
  appId: string,
  override: IconOverride | null,
  now: number = Date.now(),
): StudioState {
  let next = setThemeOverride(s, ALL_THEMES_KEY, appId, override, now);
  if (!next.themeOverrides[ALL_THEMES_KEY]?.[appId]) return next;
  for (const k of Object.keys(next.themeOverrides)) {
    if (k !== ALL_THEMES_KEY && next.themeOverrides[k][appId]) next = withMap(next, k, appId, null);
  }
  return next;
}

/** Turn "use in all themes" off from `themeKey`: the override stays only in that theme. */
export function keepOnlyInTheme(s: StudioState, themeKey: string, appId: string): StudioState {
  const all = s.themeOverrides[ALL_THEMES_KEY]?.[appId];
  const key = cleanThemeKey(themeKey);
  if (!all || !key || key === ALL_THEMES_KEY) return s;
  return withMap(withMap(s, ALL_THEMES_KEY, appId, null), key, appId, s.themeOverrides[key]?.[appId] ?? all);
}

// ---------------------------------------------------------------- custom-image library

function hashUri(uri: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < uri.length; i++) {
    h ^= uri.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Millisecond timestamp in our copied file names (app-1712345678901.jpg), else 0. */
function timeFromUri(uri: string): number {
  const m = /(\d{13})(?:\.[a-z0-9]+)?(?:[?#].*)?$/i.exec(uri);
  return m ? Number(m[1]) : 0;
}

function sanitizeImage(raw: unknown): CustomImage | null {
  if (!isObj(raw)) return null;
  const uri = typeof raw.uri === 'string' ? raw.uri.trim() : '';
  if (!uri || uri.length > 2048) return null;
  const addedAt = raw.addedAt;
  const img: CustomImage = {
    id: typeof raw.id === 'string' ? raw.id.trim().slice(0, 64) : '',
    uri,
    addedAt: typeof addedAt === 'number' && Number.isFinite(addedAt) && addedAt >= 0 ? Math.floor(addedAt) : 0,
  };
  if (typeof raw.label === 'string' && raw.label.trim()) img.label = raw.label.trim().slice(0, MAX_IMAGE_LABEL_LENGTH);
  return img;
}

/** Add an entry unless its uri is already there; gives it a unique id when missing or taken. */
function addImageEntry(list: CustomImage[], img: CustomImage): CustomImage[] {
  if (list.some((i) => i.uri === img.uri)) return list;
  const taken = new Set(list.map((i) => i.id));
  const base = `img-${hashUri(img.uri)}`;
  let id = img.id && !taken.has(img.id) ? img.id : base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return [...list, { ...img, id }];
}

/** Uris used by any override in any theme. */
export function overrideImageUris(s: StudioState): Set<string> {
  const out = new Set<string>();
  for (const m of Object.values(s.themeOverrides)) {
    for (const o of Object.values(m)) if (o.overrideImage) out.add(o.overrideImage);
  }
  return out;
}

/** Add an image to the library (deduped by uri). Returns the existing entry if it was there. */
export function addImage(
  s: StudioState,
  uri: string,
  now: number = Date.now(),
  label?: string,
): { state: StudioState; image: CustomImage | null } {
  const u = typeof uri === 'string' ? uri.trim() : '';
  const existing = s.images.find((i) => i.uri === u);
  if (existing) return { state: s, image: existing };
  const img = sanitizeImage({ uri: u, addedAt: now, label });
  if (!img) return { state: s, image: null };
  const images = addImageEntry(s.images, img);
  return { state: { ...s, images }, image: images[images.length - 1] };
}

/** Library newest first (for the "Choose from my images" grid). */
export function libraryImages(s: StudioState): CustomImage[] {
  return [...s.images].sort((a, b) => b.addedAt - a.addedAt);
}

/** Every uri the state still references (library + overrides). The store never deletes these files. */
export function imagesInUse(s: StudioState): Set<string> {
  const out = overrideImageUris(s);
  for (const i of s.images) out.add(i.uri);
  return out;
}

/**
 * Explicit "Delete from my images": removes the library entry and clears it from every override
 * that uses it (overrides left empty are removed). The caller may then delete the file when
 * imagesInUse(result) no longer has the uri.
 */
export function deleteImage(s: StudioState, imageId: string): { state: StudioState; uri: string | null } {
  const img = s.images.find((i) => i.id === imageId);
  if (!img) return { state: s, uri: null };
  const themeOverrides: StudioState['themeOverrides'] = {};
  for (const [k, m] of Object.entries(s.themeOverrides)) {
    const map: Record<string, IconOverride> = {};
    for (const [app, o] of Object.entries(m)) {
      if (o.overrideImage !== img.uri) {
        map[app] = o;
        continue;
      }
      const rest: IconOverride = { ...o };
      delete rest.overrideImage;
      const clean = sanitizeOverride(rest);
      if (clean) map[app] = clean;
    }
    if (Object.keys(map).length > 0) themeOverrides[k] = map;
  }
  return { state: { ...s, themeOverrides, images: s.images.filter((i) => i.id !== imageId) }, uri: img.uri };
}

/** Re-point every stored image uri (e.g. after iOS moved the app container), then re-sanitise. */
export function mapImageUris(s: StudioState, fn: (uri: string) => string): StudioState {
  const themeOverrides: StudioState['themeOverrides'] = {};
  for (const [k, m] of Object.entries(s.themeOverrides)) {
    const map: Record<string, IconOverride> = {};
    for (const [app, o] of Object.entries(m)) map[app] = o.overrideImage ? { ...o, overrideImage: fn(o.overrideImage) } : o;
    themeOverrides[k] = map;
  }
  const images = s.images.map((i) => ({ ...i, uri: fn(i.uri) }));
  return sanitizeStudioState({ ...s, themeOverrides, images });
}
