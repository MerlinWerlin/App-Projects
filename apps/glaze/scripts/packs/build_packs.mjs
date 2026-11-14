#!/usr/bin/env node
// T159 (owner-1030 A2): theme folders -> versioned remote art packs + catalog.json for R2.
//
//   node scripts/packs/build_packs.mjs [--themes themes] [--out dist/packs] [--only id,id]
//        [--plus id,id | --plus-file scripts/packs/tiers.json] [--versions scripts/packs/versions.json]
//        [--encoder auto|sharp|pillow|png] [--min-app 1.0.0]
//        [--releases scripts/packs/releases.json] [--release glaze-packs-v<n>]
//
// Every themes/<id>/ art pack (validated with src/core/artPack.ts validateArtPack) becomes
//   <out>/art/<id>/v<packVersion>/<role>[-<longedge>].<sha8>.<ext>   (immutable, content-hashed)
//   <out>/art/<id>/v<packVersion>/manifest.json                      (written LAST in the folder)
// and <out>/catalog.json lists every pack (written LAST overall). The format is the contract in
// src/core/packCatalog.ts; the output is checked with parseRemoteArtManifest / parseCatalog.
//
// Images: wallpaper in three device classes (long edge 2796 = 1290x2796, 2556 = 1179x2556,
// 1334 = 750x1334, centre-cropped), widget-small/medium/large hero art at its source size, and a
// 240x520 thumb. Encoder: `sharp` if installed (WebP q82, effort 4), else python3 + Pillow (WebP q82,
// method 4), else PNG: the original PNGs unresized (one wallpaper class) plus a JS-made PNG thumb.
// ThumbHash (wallpaper, <=100 px downscale) is computed in JS (scripts/packs/thumbhash.mjs).
//
// packVersion: scripts/packs/versions.json maps id -> { packVersion, contentHash }, where
// contentHash is the sha256 of the manifest without packVersion (so it covers every file's sha256,
// the palette, meta, plus flag and minAppVersion). Same hash -> same version; any change -> +1.
// Commit versions.json after a build that you publish. Exit code 1 when any pack failed.
//
// T274 release (GitHub allows 1000 assets per release): scripts/packs/releases.json maps
// id -> release tag ("glaze-packs-v1", "glaze-packs-v2", ...). A pack keeps the tag it has there; a
// pack missing from it is glaze-packs-v1 if versions.json already knows it (built before T274), else
// it gets --release (default glaze-packs-v1). Catalogue entries carry `release` only when it is not
// glaze-packs-v1 (catalog.json itself always lives on glaze-packs-v1). To move a pack, edit
// releases.json and bump nothing: release_assets.mjs uploads its files to the new tag. Commit
// releases.json together with versions.json.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodePng, encodePng, fitInside, resizeRgba } from './png.mjs';
import { rgbaToThumbHash } from './thumbhash.mjs';

// The core is TypeScript in a package without "type": "module"; Node warns once per file. Noise here.
process.removeAllListeners('warning');
const art = await import('../../src/core/artPack.ts');
const cat = await import('../../src/core/packCatalog.ts');
const wopt = await import('../../src/core/widgetOptions.ts');
const host = await import('../../src/core/packHost.ts');

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Wallpaper device classes: long edge -> pixel size. */
export const WALLPAPER_CLASSES = Object.freeze([
  { longEdge: 2796, width: 1290, height: 2796 },
  { longEdge: 2556, width: 1179, height: 2556 },
  { longEdge: 1334, width: 750, height: 1334 },
]);
export const THUMB_SIZE = Object.freeze({ width: 240, height: 520 });
export const WEBP_QUALITY = 82;
export const WEBP_EFFORT = 4;
export const DEFAULT_MIN_APP = '1.0.0';
/** T274: the release catalog.json and every pack without a `release` live on. */
export const DEFAULT_RELEASE = 'glaze-packs-v1';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// ------------------------------------------------------------------ encoders

const PILLOW_SCRIPT = `
import sys, json
from PIL import Image, ImageOps
for j in json.load(sys.stdin):
    im = Image.open(j['src'])
    im = im.convert('RGBA' if j['alpha'] else 'RGB')
    if im.size != (j['w'], j['h']):
        im = ImageOps.fit(im, (j['w'], j['h']), method=Image.LANCZOS, centering=(0.5, 0.5))
    im.save(j['dst'], 'WEBP', quality=j['q'], method=j['m'])
print('ok')
`;

async function trySharp() {
  try {
    const mod = await import('sharp');
    const sharp = mod.default ?? mod;
    let version = '';
    try {
      version = sharp.versions?.sharp ?? '';
    } catch {}
    return { name: `sharp${version ? ' ' + version : ''}`, kind: 'sharp', sharp };
  } catch {
    return null;
  }
}

function tryPillow() {
  for (const command of ['python3', 'python']) {
    const r = spawnSync(command, ['-I', '-c', "import PIL, PIL.features; assert PIL.features.check('webp'); print(PIL.__version__)"], { encoding: 'utf8' });
    if (r.status === 0 && !r.error) return { name: `pillow ${r.stdout.trim()}`, kind: 'pillow', command };
  }
  return null;
}

/** Pick an encoder: 'auto' tries sharp, then Pillow, then PNG. */
export async function pickEncoder(want = 'auto') {
  if (want === 'sharp' || want === 'auto') {
    const s = await trySharp();
    if (s) return s;
    if (want === 'sharp') throw new Error('sharp is not installed (npm i --no-save sharp)');
  }
  if (want === 'pillow' || want === 'auto') {
    const p = tryPillow();
    if (p) return p;
    if (want === 'pillow') throw new Error('python3 with Pillow (WebP support) is not available');
  }
  if (want !== 'png' && want !== 'auto') throw new Error(`unknown encoder ${want}`);
  return { name: 'png (no resizing; install sharp or Pillow for WebP device classes)', kind: 'png' };
}

/** Run jobs [{src, w, h, alpha}] -> Buffers, in order. */
async function encodeWebp(encoder, jobs) {
  if (encoder.kind === 'sharp') {
    const out = [];
    for (const j of jobs) {
      let s = encoder.sharp(j.src).resize(j.w, j.h, { fit: 'cover', position: 'centre', kernel: 'lanczos3' });
      if (!j.alpha) s = s.removeAlpha();
      out.push(await s.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 }).toBuffer());
    }
    return out;
  }
  const tmp = mkdtempSync(join(tmpdir(), 'glaze-packs-'));
  try {
    const list = jobs.map((j, i) => ({ src: j.src, dst: join(tmp, `${i}.webp`), w: j.w, h: j.h, alpha: !!j.alpha, q: WEBP_QUALITY, m: WEBP_EFFORT }));
    const r = spawnSync(encoder.command ?? 'python3', ['-I', '-c', PILLOW_SCRIPT], { input: JSON.stringify(list), encoding: 'utf8', maxBuffer: 1 << 20 });
    if (r.status !== 0 || r.error) throw new Error(`Pillow failed: ${(r.stderr || String(r.error)).trim().slice(-400)}`);
    return list.map((j) => readFileSync(j.dst));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ helpers

function readPackFiles(dir) {
  const files = {};
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isFile()) files[name] = new Uint8Array(readFileSync(p));
  }
  return files;
}

function subfolders(dir) {
  return readdirSync(dir)
    .filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isDirectory())
    .sort();
}

/** Pack id -> folder name (sorted by id); two folders for one id is an error. */
function themeFolders(themesDir) {
  const m = new Map();
  for (const f of subfolders(themesDir)) {
    if (f === REVIEW_CATALOGUE[0]) continue; // the review root's release-simulation/ snapshot
    const id = packIdOfFolder(f);
    if (m.has(id)) throw new Error(`theme folders ${m.get(id)} and ${f} are both pack ${id}`);
    m.set(id, f);
  }
  return new Map([...m].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Plus ids from a tiers file: { "plus": ["id", ...] } or ["id", ...]. */
export function readTiers(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw?.plus;
  if (!Array.isArray(list) || list.some((x) => typeof x !== 'string')) throw new Error(`${path}: expected { "plus": ["id", ...] }`);
  return new Set(list);
}

/** T274: releases.json ({ id: tag }); every value must be glaze-packs-v<n>. Missing file = {}. */
export function readReleases(path) {
  if (!path || !existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${path}: expected { "pack-id": "glaze-packs-v1", ... }`);
  for (const [id, tag] of Object.entries(raw)) if (!host.isPackReleaseTag(tag)) throw new Error(`${path}: ${id}: "${tag}" is not a release tag (glaze-packs-v<n>)`);
  return { ...raw };
}

/** T274: the release a pack goes to: its releases.json tag, else v1 for a pack built before, else the default for new packs. */
export function releaseFor(id, releases, lock, newDefault = DEFAULT_RELEASE) {
  if (releases[id]) return releases[id];
  if (lock && lock[id]) return DEFAULT_RELEASE;
  return newDefault;
}

/** Next packVersion for a pack given the lock entry and the new content hash. */
export function nextVersion(entry, contentHash) {
  if (entry && entry.contentHash === contentHash && Number.isInteger(entry.packVersion) && entry.packVersion > 0) return entry.packVersion;
  return (entry && Number.isInteger(entry.packVersion) ? entry.packVersion : 0) + 1;
}

const assetName = (role, longEdge, bytes, ext) => `${role}${longEdge ? '-' + longEdge : ''}.${sha256(bytes).slice(0, 8)}.${ext}`;

function sortedObject(o) {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

// ------------------------------------------------------------------ widget options (T275)
//
// owner-1102a A3/A4: a theme folder may carry a `widgets/` subfolder with the reviewed exports:
//   widgets/themed-clock-<date>.json     prepare-themed-clocks.mjs profile: { option, source, sourceSha256 }
//   widgets/runtime-options-<date>.json  export-reviewed-themes.mjs clean faces: { widgets: [option + sha256] }
//   widgets/widget-options.json          themes 101-146: [option] or { widgets: [option] } (kind aliases)
// Any of them turns the pack into a remote-art v2 manifest whose `widgets` list is: the themed live
// clock first, then widget-options.json, then the remaining clean runtime faces (the legacy fallback clock
// is excluded), then the v1 hero pieces so nothing the pack had disappears. No `widgets/` folder (or
// none of these files): nothing changes, the manifest stays byte-identical v1.

/** Widget-art long edge cap (as prepare-reviewed-packs.mjs). */
export const WIDGET_ART_MAX = 1024;
/** Fields of a v2 widget option a pack carries (everything else in the export files is dropped). */
const OPTION_FIELDS = ['id', 'kind', 'image', 'sizes', 'fit', 'background', 'label', 'numberFree', 'liveFrame'];

/** A theme folder name -> its pack id: Codex review folders are `NNN-<id>`. */
export function packIdOfFolder(name) {
  return name.replace(/^\d{3}-/, '');
}

const isObj = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const lastFile = (dir, re) =>
  readdirSync(dir)
    .filter((n) => re.test(n))
    .sort()
    .pop();
const baseOf = (p) => String(p).split(/[\\/]/).pop();

function pickOption(raw) {
  const o = {};
  for (const k of OPTION_FIELDS) if (raw[k] !== undefined) o[k] = raw[k];
  return o;
}

/**
 * Read a theme folder's widget exports (no encoding). Returns null when there are none, else
 * { items: [{ option, src }], errors, warnings }. `errors` fail the pack (a builder must not
 * publish an unknown kind); a missing or changed source image is only a warning (that edition is
 * skipped). Kinds are normalised to the canonical names so older app parsers still read them.
 */
export function readWidgetEditions(dir, themesDir) {
  const wdir = join(dir, 'widgets');
  if (!existsSync(wdir) || !statSync(wdir).isDirectory()) return null;
  const profileName = lastFile(wdir, /^themed-clock-\d{8}\.json$/);
  const runtimeName = lastFile(wdir, /^runtime-options-\d{8}\.json$/);
  const listName = existsSync(join(wdir, 'widget-options.json')) ? 'widget-options.json' : undefined;
  if (!profileName && !runtimeName && !listName) return null;
  const errors = [];
  const warnings = [];
  const items = [];
  const seenIds = new Set();
  const seenBytes = new Set();
  const readList = (name) => {
    try {
      return JSON.parse(readFileSync(join(wdir, name), 'utf8'));
    } catch (e) {
      errors.push(`widgets/${name}: not valid JSON (${e instanceof Error ? e.message : e})`);
      return null;
    }
  };
  /** First existing candidate path, or null. */
  const findFile = (candidates) => candidates.find((p) => p && existsSync(p) && statSync(p).isFile()) ?? null;
  const add = (raw, src, where, expectSha, extra = {}) => {
    if (!isObj(raw)) return void errors.push(`${where}: not an object`);
    const nk = wopt.normalizeWidgetKind(raw.kind);
    if (!nk) return void errors.push(`${where} (${raw.id}): unknown kind ${String(raw.kind)}`);
    if (raw.id === wopt.LEGACY_FALLBACK_CLOCK_ID) return;
    const option = { ...pickOption(raw), ...extra, kind: nk.kind };
    if (nk.clockStyle && isObj(option.liveFrame) && option.liveFrame.clockStyle === undefined) {
      option.liveFrame = { ...option.liveFrame, clockStyle: nk.clockStyle };
    }
    if (!src) return void warnings.push(`${where} (${raw.id}): image not found, edition skipped`);
    const bytes = readFileSync(src);
    if (typeof expectSha === 'string' && /^[0-9a-f]{64}$/i.test(expectSha) && sha256(bytes) !== expectSha.toLowerCase()) {
      return void warnings.push(`${where} (${raw.id}): ${baseOf(src)} does not match its sha256, edition skipped`);
    }
    const h = art.readPngHeader(new Uint8Array(bytes));
    if (!h.ok) return void warnings.push(`${where} (${raw.id}): ${baseOf(src)} is not a readable PNG (${h.error}), edition skipped`);
    const digest = sha256(bytes);
    if (seenBytes.has(digest)) return void warnings.push(`${where} (${raw.id}): same image as an earlier option, skipped`);
    if (typeof option.id !== 'string' || seenIds.has(option.id)) return void errors.push(`${where}: duplicate or missing id ${String(option.id)}`);
    seenIds.add(option.id);
    seenBytes.add(digest);
    items.push({ option, src, width: h.header.width, height: h.header.height });
  };

  // 1. The themed live clock (art-preserving edition) goes first.
  if (profileName) {
    const p = readList(profileName);
    const where = `widgets/${profileName}`;
    if (p && isObj(p.option)) {
      const img = p.option.image;
      const src = findFile([
        typeof img === 'string' ? img : null,
        typeof p.source === 'string' ? join(themesDir, p.source) : null,
        typeof p.source === 'string' ? join(dir, ...p.source.split(/[\\/]/).slice(1)) : null,
        typeof img === 'string' ? join(wdir, baseOf(img)) : null,
        typeof p.source === 'string' ? join(wdir, baseOf(p.source)) : null,
        typeof img === 'string' ? join(dir, baseOf(img)) : null,
      ]);
      add(p.option, src, where, p.sourceSha256);
    } else if (p) errors.push(`${where}: no option`);
  }
  // 2. The theme's own list (themes 101-146).
  if (listName) {
    const l = readList(listName);
    const list = Array.isArray(l) ? l : isObj(l) && Array.isArray(l.widgets) ? l.widgets : null;
    if (l && !list) errors.push(`widgets/${listName}: expected [option] or { widgets: [option] }`);
    (list ?? []).forEach((o, i) => {
      const img = isObj(o) ? (o.image ?? o.file) : undefined;
      const src = typeof img === 'string' ? findFile([join(wdir, img), join(dir, img), join(wdir, baseOf(img))]) : null;
      add(o, src, `widgets/${listName}[${i}]`, isObj(o) ? o.sha256 : undefined);
    });
  }
  // 3. Keep other runtime faces; the retired plain fallback clock is not offered.
  if (runtimeName) {
    const r = readList(runtimeName);
    const list = isObj(r) && Array.isArray(r.widgets) ? r.widgets : null;
    if (r && !list) errors.push(`widgets/${runtimeName}: no widgets list`);
    (list ?? []).forEach((o, i) => {
      const img = isObj(o) ? o.image : undefined;
      const src = typeof img === 'string' ? findFile([join(wdir, baseOf(img)), join(dir, baseOf(img))]) : null;
      const isClock = isObj(o) && wopt.normalizeWidgetKind(o.kind)?.kind === 'clock';
      if (isClock) return;
      add(o, src, `widgets/${runtimeName}[${i}]`, isObj(o) ? o.sha256 : undefined, { numberFree: true });
    });
  }
  return { items, errors, warnings };
}

/**
 * Encode the editions as `widget-art` files and return { outs, widgets } where widgets is the
 * manifest list (asset paths filled in), with the v1 hero pieces appended.
 */
export async function encodeWidgetEditions(encoder, editions, heroAssets) {
  const sized = editions.items.map((it) => ({ ...it, size: fitInside(it.width, it.height, WIDGET_ART_MAX) }));
  let bufs;
  if (encoder.kind === 'png') bufs = sized.map((it) => readFileSync(it.src));
  else bufs = await encodeWebp(encoder, sized.map((it) => ({ src: it.src, w: it.size.width, h: it.size.height, alpha: true })));
  const ext = encoder.kind === 'png' ? 'png' : 'webp';
  const outs = sized.map((it, i) => ({
    role: 'widget-art',
    name: `widget-${it.option.id}.${sha256(bufs[i]).slice(0, 8)}.${ext}`,
    width: encoder.kind === 'png' ? it.width : it.size.width,
    height: encoder.kind === 'png' ? it.height : it.size.height,
    bytes: bufs[i],
    ext,
    mime: encoder.kind === 'png' ? 'image/png' : 'image/webp',
  }));
  const widgets = sized.map((it, i) => ({ ...it.option, image: outs[i].name }));
  // Keep the pack's v1 hero art on offer (a v2 list replaces the derived v1 options).
  for (const o of wopt.widgetOptionsFromV1(heroAssets)) {
    if (widgets.some((w) => w.id === o.id)) continue;
    widgets.push({ id: o.id, kind: o.kind, image: o.image, sizes: o.sizes, fit: o.fit, background: o.background });
  }
  return { outs, widgets };
}

// ------------------------------------------------------------------ review layout (T275b)
//
// `--themes <glaze-theme-reviews>` builds Codex's review folders directly, as
// scripts/prepare-reviewed-packs.mjs reads them: a folder with no wallpaper.png but with
// wallpapers/wallpaper.png (+ source-and-prompts.json) takes its palette from
// <root>/release-simulation/catalogue.json (theme background / foreground) unless it has a
// palette.json, and its meta from source-and-prompts.json unless it has a meta.json. Hero files are
// optional; the widget options are the editions above plus every other widgets/*.png as `art`.

export const REVIEW_WALLPAPER = ['wallpapers', 'wallpaper.png'];
export const REVIEW_SOURCE_FILE = 'source-and-prompts.json';
export const REVIEW_CATALOGUE = ['release-simulation', 'catalogue.json'];
export const REVIEW_ADDED_AT = '2026-11-01';
const REVIEW_MOOD = 'Coordinated artwork and native value faces.';

/** True when a theme folder is in Codex's review layout (and not a normal pack folder). */
export function isReviewLayout(dir) {
  return !existsSync(join(dir, art.WALLPAPER_FILE)) && existsSync(join(dir, ...REVIEW_WALLPAPER));
}

/** prepare-reviewed-packs.mjs short(): option id from a widget file name, made a valid id. */
export function reviewOptionId(fileName) {
  return fileName
    .replace(/\.png$/i, '')
    .replace(/^(extra-20261029-|audit-20261101-|production-20261101-)/, '')
    .replace(/-preview$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
}

function reviewCatalogueTheme(themesDir, folder) {
  const c = readJson(join(themesDir, ...REVIEW_CATALOGUE), null);
  return isObj(c) && Array.isArray(c.themes) ? (c.themes.find((t) => isObj(t) && t.id === folder) ?? null) : null;
}

/** meta.json equivalent for a review folder, from source-and-prompts.json (as prepare-reviewed-packs.mjs). */
export function reviewMeta(folder, source) {
  const s = isObj(source) ? source : {};
  const ref = isObj(s.source) ? s.source : {};
  const name = String(s.set ?? folder).replace(/^\d{3}[- ]/, '').replaceAll('-', ' ').trim().slice(0, 40).trim();
  const credits = ref.photographer
    ? `Glaze theme artwork; reference photograph by ${ref.photographer}${ref.page ? ' (' + ref.page + ')' : ''}.`
    : 'Glaze generated theme artwork and original UI geometry.';
  return {
    name,
    mood: REVIEW_MOOD,
    tags: ['review-candidate'],
    credits: credits.slice(0, 400),
    licence: 'openai-output-owned',
    generator: 'openai-image',
    prompt: 'Mixed original theme artwork and code-drawn UI faces. Exact artwork prompts retained in source review folder.',
    addedAt: REVIEW_ADDED_AT,
  };
}

/**
 * validateArtPack's report for a review folder: { ok, errors, warnings, pack, catalogueTheme }.
 * pack.wallpaperFile / pack.heroFiles carry the real paths; heroes present only when the files are.
 */
export function reviewPackReport(id, folder, dir, themesDir) {
  const errors = [];
  const warnings = [];
  const fail = () => ({ ok: false, errors, warnings, pack: null, catalogueTheme: null });
  if (!art.isArtPackId(id)) errors.push(`pack id "${id}" must be a lower-case slug (a-z, 0-9, single hyphens, 3–40 characters)`);
  const wallpaperFile = join(dir, ...REVIEW_WALLPAPER);
  const wb = readFileSync(wallpaperFile);
  const wh = art.readPngHeader(new Uint8Array(wb));
  let wallpaper = null;
  if (!wh.ok) errors.push(`wallpapers/wallpaper.png: ${wh.error}`);
  else {
    const why = art.unsupportedPng(wh.header);
    if (why) errors.push(`wallpapers/wallpaper.png: ${why}`);
    else wallpaper = { width: wh.header.width, height: wh.header.height };
  }
  const t = reviewCatalogueTheme(themesDir, folder);
  let palRaw = readJson(join(dir, art.PALETTE_FILE), undefined);
  if (palRaw === undefined) {
    if (!t) errors.push(`no ${art.PALETTE_FILE} and no ${folder} entry in ${REVIEW_CATALOGUE.join('/')}`);
    else palRaw = { bg: t.background, tile: t.background, glyph: t.foreground, accent: t.foreground, text: t.foreground };
  }
  const pal = palRaw === undefined ? { palette: null, errors: [], warnings: [] } : art.validatePalette(palRaw);
  errors.push(...pal.errors);
  warnings.push(...pal.warnings);
  const metaRaw = readJson(join(dir, art.META_FILE), undefined) ?? reviewMeta(folder, readJson(join(dir, REVIEW_SOURCE_FILE), {}));
  const met = art.validateMeta(metaRaw);
  errors.push(...met.errors);
  warnings.push(...met.warnings);
  const heroes = {};
  const heroFiles = {};
  for (const s of art.HERO_SIZES) {
    const p = join(dir, art.HERO_FILES[s]);
    if (!existsSync(p)) continue;
    const h = art.readPngHeader(new Uint8Array(readFileSync(p)));
    if (!h.ok || !art.heroSizeOk(s, h.header)) errors.push(`${art.HERO_FILES[s]}: ${h.ok ? 'wrong size' : h.error}`);
    else {
      heroes[s] = { width: h.header.width, height: h.header.height };
      heroFiles[s] = p;
    }
  }
  if (errors.length || !wallpaper || !pal.palette || !met.meta) return fail();
  return { ok: true, errors, warnings, catalogueTheme: t, pack: { id, palette: pal.palette, meta: met.meta, wallpaper, heroes, heroFiles, wallpaperFile, bytes: {} } };
}

/**
 * The review folder's decorative widgets/*.png as `art` options, after the editions (same sha
 * dedupe, except that the themed clock's source art is still offered as plain art, as
 * prepare-reviewed-packs.mjs does; a catalogue `widgets[].originalFile` override swaps in its
 * reviewed `file`).
 */
export function addReviewDecorative(editions, dir, themesDir, catalogueTheme) {
  const wdir = join(dir, 'widgets');
  const out = editions ?? { items: [], errors: [], warnings: [] };
  if (!existsSync(wdir)) return out;
  const seenBytes = new Set(out.items.filter((i) => i.option.id !== 'themed-live-clock').map((i) => sha256(readFileSync(i.src))));
  const ids = new Set(out.items.map((i) => i.option.id));
  const hasThemedClock = out.items.some((i) => i.option.id === 'themed-live-clock');
  const overrides = isObj(catalogueTheme) && Array.isArray(catalogueTheme.widgets) ? catalogueTheme.widgets : [];
  for (const name of readdirSync(wdir).filter((n) => /\.png$/i.test(n)).sort()) {
    // The clean runtime faces are live options only; the cleaned clock background is the themed clock's source.
    if (/^native-clock-background-/.test(name) || /^runtime-[a-z]+-face-\d{8}\.png$/.test(name)) continue;
    const original = join(wdir, name);
    const ov = overrides.find((w) => isObj(w) && typeof w.originalFile === 'string' && baseOf(w.originalFile) === name && typeof w.file === 'string');
    const src = ov && existsSync(join(themesDir, ov.file)) ? join(themesDir, ov.file) : original;
    const bytes = readFileSync(src);
    const digest = sha256(bytes);
    if (seenBytes.has(digest)) continue;
    const h = art.readPngHeader(new Uint8Array(bytes));
    if (!h.ok) {
      out.warnings.push(`widgets/${name}: not a readable PNG (${h.error}), skipped`);
      continue;
    }
    // prepare-reviewed-packs.mjs keeps the old painted clock as a static concept beside its live edition.
    let id = hasThemedClock && name === 'constellation-clock-preview.png' ? 'constellation-clock-concept' : reviewOptionId(name);
    if (!id || ids.has(id)) {
      out.warnings.push(`widgets/${name}: option id "${id}" is empty or taken, skipped`);
      continue;
    }
    seenBytes.add(digest);
    ids.add(id);
    out.items.push({ option: { id, kind: 'art', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'theme', label: id.replaceAll('-', ' ').slice(0, 40).trim() }, src, width: h.header.width, height: h.header.height });
  }
  return out;
}

// ------------------------------------------------------------------ one pack

async function buildOne({ id, dir, report, encoder, plus, minAppVersion, editions, lockedClockFace }) {
  const pack = report.pack;
  // T275b: a review folder's report carries its wallpaper / hero paths (heroes may be absent).
  const wallSrc = pack.wallpaperFile ?? join(dir, art.WALLPAPER_FILE);
  const heroSizes = art.HERO_SIZES.filter((s) => pack.heroes[s]);
  const heroFile = (s) => pack.heroFiles?.[s] ?? join(dir, art.HERO_FILES[s]);
  /** [{ role, longEdge?, width, height, bytes: Buffer, ext, mime }] */
  const outs = [];
  if (encoder.kind === 'png') {
    outs.push({ role: 'wallpaper', longEdge: Math.max(pack.wallpaper.width, pack.wallpaper.height), ...pack.wallpaper, bytes: readFileSync(wallSrc), ext: 'png', mime: 'image/png' });
    for (const s of heroSizes) {
      outs.push({ role: `widget-${s}`, ...pack.heroes[s], bytes: readFileSync(heroFile(s)), ext: 'png', mime: 'image/png' });
    }
    const t = resizeRgba(decodePng(readFileSync(wallSrc)), THUMB_SIZE.width, THUMB_SIZE.height);
    outs.push({ role: 'thumb', ...THUMB_SIZE, bytes: encodePng(t.width, t.height, t.rgba), ext: 'png', mime: 'image/png' });
  } else {
    const jobs = [];
    for (const c of WALLPAPER_CLASSES) jobs.push({ role: 'wallpaper', longEdge: c.longEdge, src: wallSrc, w: c.width, h: c.height, alpha: false });
    for (const s of heroSizes) {
      const ref = art.HERO_REFERENCE_SIZES[s];
      const src = pack.heroes[s];
      // Source size, capped at the reference size (art over the reference is just bytes).
      const size = src.width > ref.width ? ref : src;
      jobs.push({ role: `widget-${s}`, src: heroFile(s), w: size.width, h: size.height, alpha: true });
    }
    jobs.push({ role: 'thumb', src: wallSrc, w: THUMB_SIZE.width, h: THUMB_SIZE.height, alpha: false });
    const bufs = await encodeWebp(encoder, jobs);
    jobs.forEach((j, i) => outs.push({ role: j.role, longEdge: j.longEdge, width: j.w, height: j.h, bytes: bufs[i], ext: 'webp', mime: 'image/webp' }));
  }

  // ThumbHash of the wallpaper from a <=100 px downscale.
  const wall = decodePng(readFileSync(wallSrc));
  const small = fitInside(wall.width, wall.height, 100);
  const px = resizeRgba(wall, small.width, small.height);
  const thumbhash = Buffer.from(rgbaToThumbHash(px.width, px.height, px.rgba)).toString('base64');

  // T275: clock editions and other widget exports (null = none: the v1 manifest is unchanged).
  const ed = editions && editions.items.length ? await encodeWidgetEditions(encoder, editions, outs.map((o) => ({ path: assetName(o.role, o.longEdge, o.bytes, o.ext), role: o.role, width: o.width, height: o.height }))) : null;
  if (ed) outs.push(...ed.outs);

  const faceFile = join(dir, 'clock-face.png');
  let clockFaceSha256;
  if (existsSync(faceFile)) {
    const bytes = readFileSync(faceFile);
    const h = art.readPngHeader(bytes);
    if (!h.ok || h.header.width !== h.header.height || h.header.width < 510 || h.header.width > 1024 || bytes.length > 1024 * 1024) {
      throw new Error(`${id}: clock-face.png must be square, 510–1024 px and at most 1 MiB`);
    }
    clockFaceSha256 = sha256(bytes);
    outs.push({ name: `clock-face.${clockFaceSha256.slice(0, 8)}.png`, role: 'widget-art',
      width: h.header.width, height: h.header.height, bytes, ext: 'png', mime: 'image/png' });
  } else if (lockedClockFace) {
    throw new Error(`${id}: restore clock-face.png from the published pack before rebuilding`);
  }

  const assets = outs.map((o) => ({
    path: o.name ?? assetName(o.role, o.longEdge, o.bytes, o.ext),
    role: o.role,
    width: o.width,
    height: o.height,
    bytes: o.bytes.length,
    sha256: sha256(o.bytes),
    mime: o.mime,
  }));
  const totalBytes = assets.reduce((a, b) => a + b.bytes, 0);
  const manifestNoVersion = {
    format: cat.REMOTE_ART_FORMAT,
    version: ed || clockFaceSha256 ? cat.REMOTE_ART_VERSION_2 : cat.REMOTE_ART_VERSION,
    id,
    name: pack.meta.name,
    plus,
    minAppVersion,
    palette: pack.palette,
    meta: pack.meta,
    thumbhash,
    assets,
    totalBytes,
    ...(ed || clockFaceSha256 ? { widgets: ed?.widgets ?? [] } : {}),
  };
  const contentHash = sha256(JSON.stringify(manifestNoVersion));
  return { outs, assets, manifestNoVersion, contentHash, pack, clockFaceSha256 };
}

// ------------------------------------------------------------------ the build

/**
 * Build packs. Returns { catalog, built: [{ id, packVersion, folder }], failed: [id], writes: [relative
 * paths in write order], encoder }. Never touches the network.
 */
export async function buildPacks(opts = {}) {
  if (opts.basePacksDir || opts.addArtDir) {
    if (!opts.basePacksDir || !opts.addArtDir) throw new Error('--base-packs and --add-art must be supplied together');
    const { buildArtworkAdditions } = await import('./append_artwork.mjs');
    return buildArtworkAdditions({ ...opts, outDir: opts.outDir ?? join(APP_ROOT, 'dist', 'artwork-packs'), log: opts.log ?? console.log });
  }
  const themesDir = resolve(opts.themesDir ?? join(APP_ROOT, art.ART_PACK_DIR));
  const outDir = resolve(opts.outDir ?? join(APP_ROOT, 'dist', 'packs'));
  const versionsFile = opts.versionsFile === null ? null : resolve(opts.versionsFile ?? join(APP_ROOT, 'scripts', 'packs', 'versions.json'));
  const plusIds = opts.plus ?? new Set();
  const minAppVersion = opts.minAppVersion ?? DEFAULT_MIN_APP;
  const log = opts.log ?? console.log;
  // Next to versions.json by default (scripts/packs/releases.json); no versions file = no releases file.
  const releasesFile = opts.releasesFile !== undefined ? (opts.releasesFile === null ? null : resolve(opts.releasesFile)) : versionsFile ? join(dirname(versionsFile), 'releases.json') : null;
  const newRelease = opts.release ?? DEFAULT_RELEASE;
  if (!host.isPackReleaseTag(newRelease)) throw new Error(`--release: "${newRelease}" is not a release tag (glaze-packs-v<n>)`);
  const releases = readReleases(releasesFile);
  const encoder = await pickEncoder(opts.encoder ?? 'auto');
  if (encoder.kind === 'png') log('warning: no WebP encoder (sharp or python3 Pillow); shipping original PNGs, one wallpaper class');
  log(`encoder: ${encoder.name}`);

  // T275: theme folders are `<id>` or Codex's review `NNN-<id>`; --only takes either.
  const folderOf = themeFolders(themesDir);
  if (opts.only) opts = { ...opts, only: new Set([...opts.only].map(packIdOfFolder)) };
  let ids = [...folderOf.keys()];
  if (opts.only && opts.only.size) {
    for (const id of opts.only) if (!ids.includes(id)) throw new Error(`--only: no theme folder ${id} in ${themesDir}`);
    ids = ids.filter((id) => opts.only.has(id));
  }
  const lock = versionsFile ? readJson(versionsFile, {}) : {};
  const writes = [];
  const write = (rel, data) => {
    const p = join(outDir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
    writes.push(rel);
  };

  const built = [];
  const failed = [];
  const entries = [];
  for (const id of ids) {
    const dir = join(themesDir, folderOf.get(id));
    // T275b: Codex review folders (wallpapers/wallpaper.png, catalogue palette, generated meta).
    const review = isReviewLayout(dir);
    const report = review ? reviewPackReport(id, folderOf.get(id), dir, themesDir) : art.validateArtPack(id, readPackFiles(dir), { alphaRowStep: 4 });
    let editions = readWidgetEditions(dir, themesDir);
    if (review) {
      editions = addReviewDecorative(editions, dir, themesDir, report.catalogueTheme);
      if (!editions.items.length) editions.errors.push('review folder has no widget option (needs at least one widgets/*.png or export)');
    }
    if (!report.ok || editions?.errors.length) {
      failed.push(id);
      log(`FAILED ${id}`);
      for (const e of [...report.errors, ...(editions?.errors ?? [])]) log(`    error:   ${e}`);
      continue;
    }
    for (const w of editions?.warnings ?? []) log(`    warning: ${id}: ${w}`);
    const b = await buildOne({ id, dir, report, encoder, plus: plusIds.has(id), minAppVersion, editions, lockedClockFace: lock[id]?.clockFaceSha256 });
    if (b.manifestNoVersion.widgets) {
      const errs = wopt.validateWidgetOptions(b.manifestNoVersion.widgets, b.assets);
      if (errs.length) {
        failed.push(id);
        log(`FAILED ${id}`);
        for (const e of errs) log(`    error:   ${e}`);
        continue;
      }
    }
    const release = releaseFor(id, releases, lock, newRelease);
    releases[id] = release;
    const packVersion = nextVersion(lock[id], b.contentHash);
    lock[id] = { packVersion, contentHash: b.contentHash, ...(b.clockFaceSha256 ? { clockFaceSha256: b.clockFaceSha256 } : {}) };
    const { format, version, ...rest } = b.manifestNoVersion;
    const manifest = { format, version, id: rest.id, packVersion, ...rest };
    const parsed = cat.parseRemoteArtManifest(manifest, id);
    if (!parsed.ok) throw new Error(`${id}: built manifest does not parse (${parsed.error})`);
    if (b.manifestNoVersion.thumbhash.length > 64) throw new Error(`${id}: thumbhash too long for the catalog`);

    // Fresh version folder; older version folders of this pack are dropped from dist (they stay on R2).
    const packRoot = join(outDir, 'art', id);
    if (existsSync(packRoot)) for (const v of readdirSync(packRoot)) rmSync(join(packRoot, v), { recursive: true, force: true });
    const folder = cat.packFolder(id, packVersion);
    b.outs.forEach((o, i) => write(`${folder}/${b.assets[i].path}`, o.bytes));
    write(cat.manifestPath(id, packVersion), JSON.stringify(manifest, null, 2) + '\n');

    const thumb = b.assets.find((a) => a.role === 'thumb');
    entries.push({
      id,
      name: b.pack.meta.name,
      packVersion,
      plus: plusIds.has(id),
      bytes: b.manifestNoVersion.totalBytes,
      manifest: cat.manifestPath(id, packVersion),
      thumb: `${folder}/${thumb.path}`,
      thumbhash: b.manifestNoVersion.thumbhash,
      palette: b.pack.palette,
      tags: b.pack.meta.tags,
      mood: b.pack.meta.mood,
      addedAt: b.pack.meta.addedAt ?? art.ART_PACK_DEFAULT_ADDED_AT,
      // T253: front-page category (src/core/themeBrowse.ts); "" (More) when meta.json has none.
      category: b.pack.meta.category ?? '',
      // T274: only packs off the catalogue's own release say where they are.
      ...(release !== DEFAULT_RELEASE ? { release } : {}),
    });
    built.push({ id, packVersion, folder, totalBytes: b.manifestNoVersion.totalBytes, release });
    log(`OK     ${id} v${packVersion} ${release} (${(b.manifestNoVersion.totalBytes / 1000).toFixed(0)} kB, ${b.assets.length} files)`);
  }

  // Catalogue: rebuilt packs + (with --only) the previous catalogue's other packs.
  const catalogPath = join(outDir, cat.CATALOG_FILE);
  const prev = existsSync(catalogPath) ? cat.parseCatalog(readJson(catalogPath, null)) : { ok: false };
  if (opts.only && opts.only.size && prev.ok) {
    for (const p of prev.value.packs) if (!opts.only.has(p.id) && !entries.some((e) => e.id === p.id)) entries.push(p);
  }
  entries.sort((a, b) => (a.addedAt === b.addedAt ? (a.id < b.id ? -1 : 1) : a.addedAt < b.addedAt ? 1 : -1));
  const samePacks = prev.ok && JSON.stringify(prev.value.packs) === JSON.stringify(entries);
  const catalog = {
    format: cat.CATALOG_FORMAT,
    version: cat.CATALOG_VERSION,
    generatedAt: samePacks ? prev.value.generatedAt : (opts.now ?? new Date()).toISOString(),
    packs: entries,
  };
  const pc = cat.parseCatalog(catalog);
  if (!pc.ok || pc.value.packs.length !== entries.length) throw new Error(`built catalog does not parse cleanly (${pc.ok ? 'entries dropped' : pc.error})`);
  const catalogJson = JSON.stringify(catalog, null, 2) + '\n';
  if (Buffer.byteLength(catalogJson) > cat.CATALOG_MAX_BYTES) throw new Error('catalog.json is over CATALOG_MAX_BYTES');
  write(cat.CATALOG_FILE, catalogJson);

  if (versionsFile) {
    mkdirSync(dirname(versionsFile), { recursive: true });
    const text = JSON.stringify(sortedObject(lock), null, 2) + '\n';
    if (!existsSync(versionsFile) || readFileSync(versionsFile, 'utf8') !== text) writeFileSync(versionsFile, text);
  }
  if (releasesFile) {
    mkdirSync(dirname(releasesFile), { recursive: true });
    const text = JSON.stringify(sortedObject(releases), null, 2) + '\n';
    if (!existsSync(releasesFile) || readFileSync(releasesFile, 'utf8') !== text) writeFileSync(releasesFile, text);
  }
  return { catalog, built, failed, writes, encoder: encoder.name };
}

// ------------------------------------------------------------------ CLI

function parseArgs(argv) {
  const o = {};
  const list = (v) => new Set(String(v).split(',').map((s) => s.trim()).filter(Boolean));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => {
      const x = argv[++i];
      if (x === undefined) throw new Error(`${a} needs a value`);
      return x;
    };
    if (a === '--themes') o.themesDir = resolve(v());
    else if (a === '--base-packs') o.basePacksDir = resolve(v());
    else if (a === '--add-art') o.addArtDir = resolve(v());
    else if (a === '--complete') o.complete = true;
    else if (a === '--out') o.outDir = resolve(v());
    else if (a === '--only') o.only = list(v());
    else if (a === '--plus') o.plus = list(v());
    else if (a === '--plus-file') o.plus = readTiers(resolve(v()));
    else if (a === '--versions') o.versionsFile = resolve(v());
    else if (a === '--encoder') o.encoder = v();
    else if (a === '--min-app') o.minAppVersion = v();
    else if (a === '--releases') o.releasesFile = resolve(v());
    else if (a === '--release') o.release = v();
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.help) {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      process.exit(0);
    }
    const r = await buildPacks(o);
    const total = r.built.reduce((a, b) => a + b.totalBytes, 0);
    console.log(`built ${r.built.length} pack(s), ${(total / 1e6).toFixed(2)} MB; catalog lists ${r.catalog.packs.length}; failed ${r.failed.length}`);
    process.exit(r.failed.length ? 1 : 0);
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
