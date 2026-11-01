// Theme art packs (T130, owner brief "themes-1024"): a folder per theme with a full-size wallpaper
// image, three transparent "hero" images for the seamless widgets, a palette and a meta file.
// THE FORMAT IS THE CONTRACT (docs/THEME_PACKS.md, "Art packs (themes-1024)"):
//
//   themes/<id>/wallpaper.png       exactly 1290 x 2796 (iPhone 15 Pro Max screen), 8-bit, no interlace
//   themes/<id>/widget-small.png    transparent hero art, 510 x 510        (3x of the 170 pt small widget)
//   themes/<id>/widget-medium.png   transparent hero art, 1092 x 510       (3x of 364 x 170 pt)
//   themes/<id>/widget-large.png    transparent hero art, 1092 x 1146      (3x of 364 x 382 pt)
//   themes/<id>/palette.json        { bg, tile, glyph, accent, text }  (#RRGGBB)
//   themes/<id>/meta.json           { name, mood, tags[], credits, licence, generator, prompt, addedAt? }
//
// Hero art may be any size with the same aspect ratio (±1 %) that is at least half the reference
// size. Icons are never per-app images: they stay vector glyphs from the icon studio drawn in the
// palette's glyph colour on solid `tile` squircles (no brand logos, ever).
//
// Pure TS (no React Native / Expo): the validator reads PNG headers and decodes IDAT with the
// repo's own inflater (src/core/inflate.ts), so Node tests and scripts/import-theme-packs.mjs run it.

import { iconArtOf, wallpaperArtOf, type ThemeArt } from './artwork.ts';
import { contrastRatio, mix, relativeLuminance } from './colour.ts';
import { inflateRaw } from './inflate.ts';
import type { Theme, ThemeCategoryId } from './themes.ts';
import { parseBrowseCategory, type BrowseCategoryId } from './themeBrowse.ts';

// ------------------------------------------------------------------ format constants

export const ART_PACK_FORMAT = 'glaze-art-pack';
export const ART_PACK_VERSION = 1;
/** Repo folder holding one sub-folder per pack. */
export const ART_PACK_DIR = 'themes';

export const WALLPAPER_FILE = 'wallpaper.png';
export const PALETTE_FILE = 'palette.json';
export const META_FILE = 'meta.json';

export type HeroSize = 'small' | 'medium' | 'large';
export const HERO_SIZES: readonly HeroSize[] = Object.freeze(['small', 'medium', 'large'] as HeroSize[]);
export const HERO_FILES: Readonly<Record<HeroSize, string>> = Object.freeze({
  small: 'widget-small.png',
  medium: 'widget-medium.png',
  large: 'widget-large.png',
});

export type PixelSize = { width: number; height: number };

/** The wallpaper must be exactly this size (iPhone 15 Pro Max / 16 Plus class screen, pixels). */
export const ART_WALLPAPER_SIZE: PixelSize = Object.freeze({ width: 1290, height: 2796 });

/**
 * Reference hero sizes: 3x the point size of the iPhone 15 Pro Max widgets (small 170 x 170,
 * medium 364 x 170, large 364 x 382 pt).
 */
export const HERO_REFERENCE_SIZES: Readonly<Record<HeroSize, PixelSize>> = Object.freeze({
  small: Object.freeze({ width: 510, height: 510 }),
  medium: Object.freeze({ width: 1092, height: 510 }),
  large: Object.freeze({ width: 1092, height: 1146 }),
});

/** Aspect tolerance for hero art that isn't exactly the reference size. */
export const HERO_ASPECT_TOLERANCE = 0.01;
/** Smallest accepted hero art, as a fraction of the reference size. */
export const HERO_MIN_SCALE = 0.5;

/** Every file a pack must have. */
export const ART_PACK_FILES: readonly string[] = Object.freeze([WALLPAPER_FILE, ...HERO_SIZES.map((s) => HERO_FILES[s]), PALETTE_FILE, META_FILE]);

/** Soft file budgets (warnings): the app bundle has a size cap. */
export const ART_BYTE_BUDGET = Object.freeze({ wallpaper: 450_000, hero: 150_000 });
/** Hard limits (errors): far over budget even before quantising. */
export const ART_BYTE_LIMIT = Object.freeze({ wallpaper: 8_000_000, hero: 3_000_000 });

/** A pixel with alpha at or below this counts as transparent. */
export const ALPHA_CLEAR = 8;
/** Hero art must have at least this share of transparent pixels (the art floats on the wallpaper). */
export const HERO_MIN_TRANSPARENT = 0.01;

/** Minimum WCAG contrast for glyph-on-tile and text-on-bg. */
export const ART_MIN_CONTRAST = 4.5;

export type ArtLicence = 'original' | 'CC0-1.0' | 'public-domain' | 'CC-BY-4.0' | 'openai-output-owned';
export const ART_LICENCES: readonly ArtLicence[] = Object.freeze([
  'original',
  'CC0-1.0',
  'public-domain',
  'CC-BY-4.0',
  'openai-output-owned',
] as ArtLicence[]);

/** Display names for the licence ids (data, shown next to the credit). */
export const ART_LICENCE_NAMES: Readonly<Record<ArtLicence, string>> = Object.freeze({
  original: 'Original artwork',
  'CC0-1.0': 'CC0 1.0',
  'public-domain': 'Public domain',
  'CC-BY-4.0': 'CC BY 4.0',
  'openai-output-owned': 'AI-generated, output owned',
});

/** Known generators. Others are accepted with a warning. */
export const ART_GENERATORS: readonly string[] = Object.freeze(['procedural', 'openai-image', 'photo', 'hand-drawn']);
/** Generators that are AI image models (a prompt is expected). */
export const AI_GENERATORS: readonly string[] = Object.freeze(['openai-image']);

export type ArtPalette = { bg: string; tile: string; glyph: string; accent: string; text: string };
export const PALETTE_KEYS: readonly (keyof ArtPalette)[] = Object.freeze(['bg', 'tile', 'glyph', 'accent', 'text'] as (keyof ArtPalette)[]);

export type ArtMeta = {
  name: string;
  mood: string;
  tags: string[];
  credits: string;
  licence: ArtLicence;
  generator: string;
  prompt: string;
  /** Optional ISO date (YYYY-MM-DD) the theme was added; drives the "New" badge. */
  addedAt?: string;
  /**
   * T253: optional Themes front-page category, e.g. "Space & Night" (src/core/themeBrowse.ts,
   * matched tolerantly; missing or unknown files the theme under More).
   */
  category?: string;
};

/** What the app keeps per pack (no image bytes): written to src/core/artPackLibrary.ts. */
export type ArtPackData = {
  id: string;
  palette: ArtPalette;
  meta: ArtMeta;
  wallpaper: PixelSize;
  heroes: Record<HeroSize, PixelSize>;
  /** File sizes in bytes, by file name. */
  bytes: Record<string, number>;
};

export type ArtPackReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** The parsed pack when ok. */
  pack: ArtPackData | null;
};

/** Generated static require() map (src/ui/artPackAssets.ts): Metro needs literal paths. */
export type ArtPackAssetSet = { wallpaper: number } & Record<HeroSize, number>;
export type ArtPackAssetMap = Readonly<Record<string, Readonly<ArtPackAssetSet>>>;

// ------------------------------------------------------------------ small helpers

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Pack ids: lower-case slug, 3–40 characters, used as folder name and theme id. */
export function isArtPackId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(id) && !id.includes('--');
}

/**
 * Brand, franchise and competitor names that never appear in a pack (name, mood, tags, credits,
 * prompt). A block list for the validator only; none of these is ever shown.
 */
export const ART_BANNED_NAMES =
  /\b(themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio|apple logo|iphone logo|google|android logo|samsung|instagram|tiktok|snapchat|facebook|whatsapp|spotify|netflix|youtube|twitter|discord|disney|pixar|dreamworks|marvel|batman|superman|spider-?man|nintendo|super mario|zelda|pok[eé]mon|pikachu|minecraft|fortnite|roblox|star wars|jedi|star trek|harry potter|hogwarts|hello kitty|sanrio|ghibli|totoro|barbie|lego|coca-?cola|nike|adidas|ferrari)\b/i;

/** Space agencies / missions whose imagery needs a credit naming the agency. */
const AGENCY_MENTION = /\b(nasa|esa|jpl|webb|jwst|hubble)\b/i;
/** A credit "names the agency" when it contains one of these. */
const AGENCY_NAME = /\b(nasa|esa|jpl|csa|stsci)\b/i;

function decodeText(b: Uint8Array): string {
  return new TextDecoder('utf-8').decode(b);
}

// ------------------------------------------------------------------ PNG reading

export type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colourType: number;
  interlace: number;
  /** A tRNS chunk is present. */
  hasTrns: boolean;
};

type PngChunks = { header: PngHeader; palette: Uint8Array | null; trns: Uint8Array | null; idat: Uint8Array[] };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const u32 = (b: Uint8Array, o: number): number => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function readChunks(b: Uint8Array): { ok: true; value: PngChunks } | { ok: false; error: string } {
  if (!(b instanceof Uint8Array) || b.length < 8 + 25) return { ok: false, error: 'not a PNG (too short)' };
  for (let i = 0; i < 8; i++) if (b[i] !== PNG_SIGNATURE[i]) return { ok: false, error: 'not a PNG (bad signature)' };
  let p = 8;
  let header: PngHeader | null = null;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let ended = false;
  while (p + 12 <= b.length) {
    const len = u32(b, p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    const start = p + 8;
    const end = start + len;
    if (end + 4 > b.length) return { ok: false, error: `PNG chunk ${type} runs past the end of the file` };
    const data = b.subarray(start, end);
    if (!header && type !== 'IHDR') return { ok: false, error: 'PNG does not start with IHDR' };
    if (type === 'IHDR') {
      if (len !== 13) return { ok: false, error: 'PNG IHDR has the wrong length' };
      header = {
        width: u32(data, 0),
        height: u32(data, 4),
        bitDepth: data[8],
        colourType: data[9],
        interlace: data[12],
        hasTrns: false,
      };
      if (data[10] !== 0 || data[11] !== 0) return { ok: false, error: 'PNG uses an unknown compression or filter method' };
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') {
      ended = true;
      break;
    }
    p = end + 4;
  }
  if (!header) return { ok: false, error: 'PNG has no IHDR' };
  if (!ended) return { ok: false, error: 'PNG is truncated (no IEND)' };
  if (idat.length === 0) return { ok: false, error: 'PNG has no image data (IDAT)' };
  if (header.width < 1 || header.height < 1) return { ok: false, error: 'PNG has a zero width or height' };
  header.hasTrns = trns !== null;
  return { ok: true, value: { header, palette, trns, idat } };
}

/** Read a PNG's IHDR (size, bit depth, colour type, interlace) and whether it has tRNS. */
export function readPngHeader(bytes: Uint8Array): { ok: true; header: PngHeader } | { ok: false; error: string } {
  const r = readChunks(bytes);
  return r.ok ? { ok: true, header: r.value.header } : r;
}

/** Why a PNG can't be read pixel by pixel here (null when it can). */
export function unsupportedPng(h: PngHeader): string | null {
  if (h.bitDepth !== 8) return `PNG bit depth ${h.bitDepth} is not supported: save as 8-bit`;
  if (!(h.colourType in CHANNELS)) return `PNG colour type ${h.colourType} is not valid`;
  if (h.interlace !== 0) return 'interlaced PNG is not supported: save without interlacing';
  return null;
}

/** True when the colour type or a tRNS chunk can express transparency. */
export function pngCanBeTransparent(h: PngHeader): boolean {
  return h.colourType === 4 || h.colourType === 6 || h.hasTrns;
}

export type AlphaStats = { pixels: number; transparent: number; share: number };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Count transparent pixels (alpha ≤ ALPHA_CLEAR) in a non-interlaced 8-bit PNG: inflates IDAT and
 * unfilters every scanline (each needs the one above), counting every `rowStep`-th row.
 */
export function pngAlphaStats(bytes: Uint8Array, rowStep = 1): { ok: true; stats: AlphaStats } | { ok: false; error: string } {
  const r = readChunks(bytes);
  if (!r.ok) return r;
  const { header: h, trns, palette, idat } = r.value;
  const why = unsupportedPng(h);
  if (why) return { ok: false, error: why };
  if (h.colourType === 3 && !palette) return { ok: false, error: 'palette PNG has no PLTE chunk' };
  let total = 0;
  for (const part of idat) total += part.length;
  const z = new Uint8Array(total);
  let o = 0;
  for (const part of idat) {
    z.set(part, o);
    o += part.length;
  }
  if (z.length < 2 || (z[0] & 0x0f) !== 8 || (z[1] & 0x20) !== 0 || ((z[0] << 8) | z[1]) % 31 !== 0) {
    return { ok: false, error: 'PNG image data is not a zlib stream' };
  }
  let raw: Uint8Array;
  try {
    raw = inflateRaw(z, 2).bytes;
  } catch (e) {
    return { ok: false, error: `PNG image data is corrupt (${e instanceof Error ? e.message : 'inflate failed'})` };
  }
  const ch = CHANNELS[h.colourType];
  const stride = h.width * ch;
  if (raw.length < (stride + 1) * h.height) return { ok: false, error: 'PNG image data is shorter than the image' };
  const step = Math.max(1, Math.floor(rowStep));

  // Transparency per colour type.
  const key = (() => {
    if (!trns) return null;
    if (h.colourType === 0 && trns.length >= 2) return [trns[1]];
    if (h.colourType === 2 && trns.length >= 6) return [trns[1], trns[3], trns[5]];
    return null;
  })();

  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  let pixels = 0;
  let clear = 0;
  for (let y = 0; y < h.height; y++) {
    const base = y * (stride + 1);
    const filter = raw[base];
    for (let x = 0; x < stride; x++) {
      const v = raw[base + 1 + x];
      const a = x >= ch ? cur[x - ch] : 0;
      const up = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let out: number;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + up;
      else if (filter === 3) out = v + ((a + up) >> 1);
      else if (filter === 4) out = v + paeth(a, up, c);
      else return { ok: false, error: `PNG row ${y} has an unknown filter ${filter}` };
      cur[x] = out & 0xff;
    }
    if (y % step === 0) {
      for (let i = 0; i < h.width; i++) {
        let alpha = 255;
        if (h.colourType === 6) alpha = cur[i * 4 + 3];
        else if (h.colourType === 4) alpha = cur[i * 2 + 1];
        else if (h.colourType === 3) alpha = trns && cur[i] < trns.length ? trns[cur[i]] : 255;
        else if (key && h.colourType === 0) alpha = cur[i] === key[0] ? 0 : 255;
        else if (key && h.colourType === 2) alpha = cur[i * 3] === key[0] && cur[i * 3 + 1] === key[1] && cur[i * 3 + 2] === key[2] ? 0 : 255;
        pixels++;
        if (alpha <= ALPHA_CLEAR) clear++;
      }
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return { ok: true, stats: { pixels, transparent: clear, share: pixels ? clear / pixels : 0 } };
}

// ------------------------------------------------------------------ size rules

/** Whether hero art of `size` is accepted for a slot (exact, or same aspect ±1 % and ≥ half size). */
export function heroSizeOk(slot: HeroSize, size: PixelSize): boolean {
  const ref = HERO_REFERENCE_SIZES[slot];
  if (size.width === ref.width && size.height === ref.height) return true;
  const want = ref.width / ref.height;
  const got = size.width / size.height;
  if (Math.abs(got - want) / want > HERO_ASPECT_TOLERANCE) return false;
  return size.width >= ref.width * HERO_MIN_SCALE && size.height >= ref.height * HERO_MIN_SCALE;
}

// ------------------------------------------------------------------ palette and meta

export function validatePalette(raw: unknown): { palette: ArtPalette | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { palette: null, errors: [`${PALETTE_FILE} must be an object {bg, tile, glyph, accent, text}`], warnings };
  const out = {} as ArtPalette;
  for (const k of PALETTE_KEYS) {
    const v = raw[k];
    if (typeof v !== 'string' || !HEX6.test(v)) errors.push(`${PALETTE_FILE}: "${k}" must be a #RRGGBB hex colour`);
    else out[k] = v.toUpperCase();
  }
  for (const k of Object.keys(raw)) if (!(PALETTE_KEYS as readonly string[]).includes(k)) warnings.push(`${PALETTE_FILE}: unknown key "${k}" is ignored`);
  if (errors.length) return { palette: null, errors, warnings };
  const glyphTile = contrastRatio(out.glyph, out.tile);
  if (glyphTile < ART_MIN_CONTRAST) errors.push(`${PALETTE_FILE}: glyph on tile contrast ${glyphTile.toFixed(2)}:1 is below ${ART_MIN_CONTRAST}:1`);
  const textBg = contrastRatio(out.text, out.bg);
  if (textBg < ART_MIN_CONTRAST) errors.push(`${PALETTE_FILE}: text on bg contrast ${textBg.toFixed(2)}:1 is below ${ART_MIN_CONTRAST}:1`);
  const accentBg = contrastRatio(out.accent, out.bg);
  if (accentBg < 3) warnings.push(`${PALETTE_FILE}: accent on bg contrast ${accentBg.toFixed(2)}:1 is low (under 3:1)`);
  return { palette: errors.length ? null : out, errors, warnings };
}

const META_KEYS = ['name', 'mood', 'tags', 'credits', 'licence', 'generator', 'prompt', 'addedAt', 'category'];

export function validateMeta(raw: unknown): { meta: ArtMeta | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { meta: null, errors: [`${META_FILE} must be an object`], warnings };
  const str = (k: string, required: boolean, max: number): string => {
    const v = raw[k];
    if (v === undefined && !required) return '';
    if (typeof v !== 'string') {
      errors.push(`${META_FILE}: "${k}" must be a string`);
      return '';
    }
    const s = v.trim();
    if (required && !s) errors.push(`${META_FILE}: "${k}" is required`);
    if (s.length > max) errors.push(`${META_FILE}: "${k}" is longer than ${max} characters`);
    return s;
  };
  const name = str('name', true, 40);
  const mood = str('mood', true, 120);
  const credits = str('credits', false, 400);
  const prompt = str('prompt', false, 4000);
  const generator = str('generator', true, 40);
  if (raw.credits === undefined) errors.push(`${META_FILE}: "credits" is required (it may be empty only for original art)`);
  if (raw.prompt === undefined) errors.push(`${META_FILE}: "prompt" is required (use "" for non-AI art)`);

  let tags: string[] = [];
  if (!Array.isArray(raw.tags)) errors.push(`${META_FILE}: "tags" must be an array of strings`);
  else {
    if (raw.tags.length > 24) errors.push(`${META_FILE}: at most 24 tags`);
    for (const t of raw.tags) {
      if (typeof t !== 'string' || !t.trim()) errors.push(`${META_FILE}: every tag must be a non-empty string`);
      else if (t !== t.toLowerCase().trim()) errors.push(`${META_FILE}: tag "${t}" must be lower case`);
      else tags.push(t);
    }
    tags = [...new Set(tags)];
  }

  const licence = raw.licence;
  if (typeof licence !== 'string' || !(ART_LICENCES as readonly string[]).includes(licence)) {
    errors.push(`${META_FILE}: "licence" must be one of ${ART_LICENCES.join(', ')}`);
  }
  if (generator && !ART_GENERATORS.includes(generator)) warnings.push(`${META_FILE}: unknown generator "${generator}"`);
  if (generator && AI_GENERATORS.includes(generator) && !prompt) warnings.push(`${META_FILE}: AI art without its prompt`);
  if (licence === 'openai-output-owned' && generator && !AI_GENERATORS.includes(generator)) {
    warnings.push(`${META_FILE}: licence openai-output-owned but generator "${generator}" is not an AI image model`);
  }

  let addedAt: string | undefined;
  if (raw.addedAt !== undefined) {
    if (typeof raw.addedAt !== 'string' || !ISO_DATE.test(raw.addedAt) || Number.isNaN(Date.parse(raw.addedAt))) {
      errors.push(`${META_FILE}: "addedAt" must be a YYYY-MM-DD date`);
    } else addedAt = raw.addedAt;
  }
  let category: string | undefined;
  if (raw.category !== undefined) {
    if (typeof raw.category !== 'string' || !raw.category.trim() || raw.category.length > 60) warnings.push(`${META_FILE}: "category" should be a short string such as "Space & Night"; ignored, so the theme is listed under More`);
    else {
      category = raw.category.trim();
      if (parseBrowseCategory(category) === 'more' && category.toLowerCase() !== 'more') warnings.push(`${META_FILE}: category "${category}" is not one of the browse categories, so the theme is listed under More`);
    }
  }
  for (const k of Object.keys(raw)) if (!META_KEYS.includes(k)) warnings.push(`${META_FILE}: unknown key "${k}" is ignored`);

  // Credits: required for CC-BY, and naming the agency whenever a space agency or telescope is mentioned.
  const text = [name, mood, credits, prompt, ...tags].join(' \n ');
  const agency = AGENCY_MENTION.exec(text);
  if (agency) {
    if (!credits) errors.push(`${META_FILE}: mentions ${agency[1]}, so "credits" must name the agency (e.g. NASA/ESA)`);
    else if (!AGENCY_NAME.test(credits)) errors.push(`${META_FILE}: mentions ${agency[1]}, but "credits" does not name the agency (NASA, ESA, JPL, CSA or STScI)`);
  }
  if (licence === 'CC-BY-4.0' && !credits) errors.push(`${META_FILE}: CC-BY-4.0 needs "credits" (the attribution line)`);
  if (licence !== 'original' && licence !== 'openai-output-owned' && typeof licence === 'string' && !credits) {
    warnings.push(`${META_FILE}: "credits" is empty`);
  }
  const banned = ART_BANNED_NAMES.exec(text);
  if (banned) errors.push(`${META_FILE}: brand or competitor name "${banned[1]}" is not allowed`);

  if (errors.length) return { meta: null, errors, warnings };
  const meta: ArtMeta = { name, mood, tags, credits, licence: licence as ArtLicence, generator, prompt };
  if (addedAt) meta.addedAt = addedAt;
  if (category) meta.category = category;
  return { meta, errors, warnings };
}

function parseJsonFile(file: string, bytes: Uint8Array | undefined, errors: string[]): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(decodeText(bytes));
  } catch {
    errors.push(`${file} is not valid JSON`);
    return undefined;
  }
}

// ------------------------------------------------------------------ the validator

export type ArtPackFiles = Readonly<Record<string, Uint8Array | undefined>>;

export type ValidateOptions = {
  /** Count every n-th row when checking hero transparency (default 1 = every row). */
  alphaRowStep?: number;
};

/**
 * Validate one pack folder, given its id (folder name) and its files by name. Never throws.
 * Returns every problem found (errors fail the pack; warnings don't).
 */
export function validateArtPack(id: string, files: ArtPackFiles, opts: ValidateOptions = {}): ArtPackReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (): ArtPackReport => ({ ok: false, errors, warnings, pack: null });
  try {
    if (!isArtPackId(id)) errors.push(`pack id "${id}" must be a lower-case slug (a-z, 0-9, single hyphens, 3–40 characters)`);
    for (const f of ART_PACK_FILES) if (!files[f]) errors.push(`missing ${f}`);
    for (const f of Object.keys(files)) if (!ART_PACK_FILES.includes(f) && !f.startsWith('.')) warnings.push(`extra file ${f} is ignored`);
    const bytes: Record<string, number> = {};
    for (const f of ART_PACK_FILES) if (files[f]) bytes[f] = files[f]!.length;

    // Wallpaper.
    let wallpaper: PixelSize | null = null;
    const wp = files[WALLPAPER_FILE];
    if (wp) {
      const r = readPngHeader(wp);
      if (!r.ok) errors.push(`${WALLPAPER_FILE}: ${r.error}`);
      else {
        const h = r.header;
        const why = unsupportedPng(h);
        if (why) errors.push(`${WALLPAPER_FILE}: ${why}`);
        if (h.width !== ART_WALLPAPER_SIZE.width || h.height !== ART_WALLPAPER_SIZE.height) {
          errors.push(`${WALLPAPER_FILE}: must be exactly ${ART_WALLPAPER_SIZE.width} x ${ART_WALLPAPER_SIZE.height}, is ${h.width} x ${h.height}`);
        } else wallpaper = { width: h.width, height: h.height };
        if (pngCanBeTransparent(h)) warnings.push(`${WALLPAPER_FILE}: has an alpha channel; a wallpaper should be opaque`);
      }
      if (wp.length > ART_BYTE_LIMIT.wallpaper) errors.push(`${WALLPAPER_FILE}: ${wp.length} bytes is over the ${ART_BYTE_LIMIT.wallpaper} byte limit`);
      else if (wp.length > ART_BYTE_BUDGET.wallpaper) warnings.push(`${WALLPAPER_FILE}: ${wp.length} bytes is over the ${ART_BYTE_BUDGET.wallpaper} byte budget (quantise to 256 colours)`);
    }

    // Hero art.
    const heroes = {} as Record<HeroSize, PixelSize>;
    for (const slot of HERO_SIZES) {
      const file = HERO_FILES[slot];
      const b = files[file];
      if (!b) continue;
      const r = readPngHeader(b);
      if (!r.ok) {
        errors.push(`${file}: ${r.error}`);
        continue;
      }
      const h = r.header;
      const why = unsupportedPng(h);
      if (why) {
        errors.push(`${file}: ${why}`);
        continue;
      }
      const ref = HERO_REFERENCE_SIZES[slot];
      if (!heroSizeOk(slot, h)) {
        errors.push(
          `${file}: ${h.width} x ${h.height} must be ${ref.width} x ${ref.height}, or the same aspect ratio (±1 %) at least ${Math.ceil(ref.width * HERO_MIN_SCALE)} x ${Math.ceil(ref.height * HERO_MIN_SCALE)}`,
        );
      } else heroes[slot] = { width: h.width, height: h.height };
      if (h.width > ref.width * 2) warnings.push(`${file}: larger than twice the reference size; downscale to ${ref.width} x ${ref.height}`);
      if (!pngCanBeTransparent(h)) errors.push(`${file}: hero art must have transparency (RGBA, grey + alpha, or a tRNS chunk)`);
      else {
        const a = pngAlphaStats(b, opts.alphaRowStep ?? 1);
        if (!a.ok) errors.push(`${file}: ${a.error}`);
        else if (a.stats.share < HERO_MIN_TRANSPARENT) {
          errors.push(`${file}: no transparent background (${(a.stats.share * 100).toFixed(2)} % of pixels are transparent; cut the art out)`);
        }
      }
      if (b.length > ART_BYTE_LIMIT.hero) errors.push(`${file}: ${b.length} bytes is over the ${ART_BYTE_LIMIT.hero} byte limit`);
      else if (b.length > ART_BYTE_BUDGET.hero) warnings.push(`${file}: ${b.length} bytes is over the ${ART_BYTE_BUDGET.hero} byte budget`);
    }

    const pal = validatePalette(parseJsonFile(PALETTE_FILE, files[PALETTE_FILE], errors));
    if (files[PALETTE_FILE] && errors.every((e) => !e.startsWith(`${PALETTE_FILE} is not`))) {
      errors.push(...pal.errors);
      warnings.push(...pal.warnings);
    }
    const met = validateMeta(parseJsonFile(META_FILE, files[META_FILE], errors));
    if (files[META_FILE] && errors.every((e) => !e.startsWith(`${META_FILE} is not`))) {
      errors.push(...met.errors);
      warnings.push(...met.warnings);
    }

    if (errors.length || !wallpaper || !pal.palette || !met.meta || HERO_SIZES.some((s) => !heroes[s])) return fail();
    return { ok: true, errors, warnings, pack: { id, palette: pal.palette, meta: met.meta, wallpaper, heroes, bytes } };
  } catch (e) {
    errors.push(`could not read the pack (${e instanceof Error ? e.message : String(e)})`);
    return fail();
  }
}

// ------------------------------------------------------------------ pack -> Theme

/** The part of a Theme that tells the UI its wallpaper is an image from an art pack. */
export type ArtPackRef = {
  /** Pack id (= theme id); keys src/ui/artPackAssets.ts. */
  id: string;
  /** The wallpaper is a bundled image (themes/<id>/wallpaper.png); `wallpaper` params are the drawn fallback. */
  wallpaperImage: true;
  /** Hero art keys available for the seamless widgets (artPackHero(id, size)). */
  heroes: readonly HeroSize[];
  credits: string;
  licence: ArtLicence;
  generator: string;
};

/** T253: `browseCategory` is the Themes front-page category (src/core/themeBrowse.ts). */
export type ArtPackTheme = Theme & { plus: false; artPack: ArtPackRef; browseCategory: BrowseCategoryId };

export function isArtPackTheme(t: unknown): t is ArtPackTheme {
  return isObj(t) && isObj(t.artPack) && t.artPack.wallpaperImage === true && typeof t.artPack.id === 'string';
}

/** Date art packs with no addedAt count from (the art-pack launch). */
export const ART_PACK_DEFAULT_ADDED_AT = '2026-10-24';

const CATEGORY_IDS: readonly ThemeCategoryId[] = ['minimal', 'dark', 'pastel', 'nature', 'neon', 'retro', 'anime', 'cute', 'luxury', 'seasonal'];

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return 1000 + (h % 90000);
}

/** Browse categories: tags that are category ids, plus 'dark' for a dark background. */
export function artPackCategories(pack: Pick<ArtPackData, 'palette' | 'meta'>): ThemeCategoryId[] {
  const out = new Set<ThemeCategoryId>();
  if (relativeLuminance(pack.palette.bg) < 0.12) out.add('dark');
  for (const t of pack.meta.tags) if ((CATEGORY_IDS as readonly string[]).includes(t)) out.add(t as ThemeCategoryId);
  if (out.size === 0) out.add('minimal');
  return [...out];
}

/**
 * The app Theme for an art pack. Icons stay vector glyphs from the icon studio on solid `tile`
 * squircles in the `glyph` colour (never per-app images or logos). The `wallpaper` params are a
 * drawn gradient from bg/accent for places that can't show the image; `artPack` tells the UI to
 * show themes/<id>/wallpaper.png instead.
 */
export function artPackTheme(pack: ArtPackData): ArtPackTheme {
  const p = pack.palette;
  const dark = relativeLuminance(p.bg) < 0.2;
  const art: ThemeArt = {
    colours: { primary: p.accent, secondary: p.tile, accent: p.accent, ink: p.bg, light: p.glyph },
    motifs: [],
    frame: 'none',
    frameRole: 'accent',
    texture: 'none',
    textureRole: 'light',
    stickers: [],
    composition: 'none',
    displayFont: 'display',
  };
  const theme: ArtPackTheme = {
    id: pack.id,
    name: pack.meta.name,
    tagline: pack.meta.mood,
    palette: { bg: p.bg, surface: p.tile, accent: p.accent, ink: p.text, glyph: p.glyph },
    iconStyle: {
      shape: 'squircle',
      background: { kind: 'solid', colour: p.tile },
      glyphColour: p.glyph,
      glyphSet: 'feather',
      showLabel: true,
      glyphScale: 0.46,
      art: iconArtOf(art),
    },
    wallpaper: {
      kind: 'gradient',
      colours: [mix(p.bg, '#000000', dark ? 0.25 : 0.05), p.bg, mix(p.bg, p.accent, 0.3)],
      seed: seedOf(pack.id),
      angle: 180,
      grain: 0.06,
      art: wallpaperArtOf(art),
    },
    widget: { style: relativeLuminance(p.tile) < 0.25 ? 'glass' : 'solid', font: 'display', accent: p.accent },
    plus: false,
    art,
    categories: Object.freeze(artPackCategories(pack)),
    tags: Object.freeze(['art', ...pack.meta.tags.filter((t) => t !== 'art')]),
    addedAt: pack.meta.addedAt ?? ART_PACK_DEFAULT_ADDED_AT,
    browseCategory: parseBrowseCategory(pack.meta.category),
    artPack: Object.freeze({
      id: pack.id,
      wallpaperImage: true,
      heroes: Object.freeze(HERO_SIZES.filter((s) => !!pack.heroes[s])),
      credits: pack.meta.credits,
      licence: pack.meta.licence,
      generator: pack.meta.generator,
    }),
  };
  return theme;
}

/** Credit line for the theme detail / save confirmation (credit text is data, never translated). */
export function artPackCreditParams(ref: Pick<ArtPackRef, 'credits' | 'licence'>): { credit: string; licence: string } {
  return { credit: ref.credits, licence: ART_LICENCE_NAMES[ref.licence] ?? ref.licence };
}

// ------------------------------------------------------------------ generated files

export const ART_LIBRARY_PATH = 'src/core/artPackLibrary.ts';
export const ART_ASSETS_PATH = 'src/ui/artPackAssets.ts';

/** How src/ui imports this module (Metro resolves it without the .ts extension). */
const UI_CORE_IMPORT = '../core/artPack';

const GENERATED ='// GENERATED by scripts/import-theme-packs.mjs from themes/<id>/ (T130). Do not edit by hand:';

/** Source of src/core/artPackLibrary.ts: palette + meta per pack (no image bytes), sorted by id. */
export function artPackLibrarySource(packs: readonly ArtPackData[]): string {
  const sorted = [...packs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [
    GENERATED,
    '// run `node scripts/import-theme-packs.mjs <folder>` (or `--regenerate`). A test fails when it is stale.',
    "import type { ArtPackData } from './artPack.ts';",
    '',
    `export const ART_PACK_LIBRARY: readonly ArtPackData[] = Object.freeze(${JSON.stringify(sorted, null, 2)} as ArtPackData[]);`,
    '',
  ].join('\n');
}

/** Source of src/ui/artPackAssets.ts: literal require() paths for Metro, sorted by id. */
export function artPackAssetsSource(ids: readonly string[]): string {
  const sorted = [...ids].sort();
  const lines = [
    GENERATED,
    '// Metro needs literal require() paths, so every themes/<id>/*.png is listed here.',
    `import type { ArtPackAssetMap } from '${UI_CORE_IMPORT}';`,
    '',
    'export const ART_PACK_ASSETS: ArtPackAssetMap = {',
  ];
  // Written as text; built from parts so the import guards don't read it as this module's own require.
  const req = (file: string) => ['require', `('../../${ART_PACK_DIR}/`, file, "')"].join('');
  for (const id of sorted) {
    lines.push(`  '${id}': {`);
    lines.push(`    wallpaper: ${req(`${id}/${WALLPAPER_FILE}`)},`);
    for (const s of HERO_SIZES) lines.push(`    ${s}: ${req(`${id}/${HERO_FILES[s]}`)},`);
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}
