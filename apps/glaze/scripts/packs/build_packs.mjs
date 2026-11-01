#!/usr/bin/env node
// T159 (owner-1030 A2): theme folders -> versioned remote art packs + catalog.json for R2.
//
//   node scripts/packs/build_packs.mjs [--themes themes] [--out dist/packs] [--only id,id]
//        [--plus id,id | --plus-file scripts/packs/tiers.json] [--versions scripts/packs/versions.json]
//        [--encoder auto|sharp|pillow|png] [--min-app 1.0.0]
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
  const r = spawnSync('python3', ['-I', '-c', "import PIL, PIL.features; assert PIL.features.check('webp'); print(PIL.__version__)"], { encoding: 'utf8' });
  if (r.status !== 0 || r.error) return null;
  return { name: `pillow ${r.stdout.trim()}`, kind: 'pillow' };
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
    const r = spawnSync('python3', ['-I', '-c', PILLOW_SCRIPT], { input: JSON.stringify(list), encoding: 'utf8', maxBuffer: 1 << 20 });
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

/** Next packVersion for a pack given the lock entry and the new content hash. */
export function nextVersion(entry, contentHash) {
  if (entry && entry.contentHash === contentHash && Number.isInteger(entry.packVersion) && entry.packVersion > 0) return entry.packVersion;
  return (entry && Number.isInteger(entry.packVersion) ? entry.packVersion : 0) + 1;
}

const assetName = (role, longEdge, bytes, ext) => `${role}${longEdge ? '-' + longEdge : ''}.${sha256(bytes).slice(0, 8)}.${ext}`;

function sortedObject(o) {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

// ------------------------------------------------------------------ one pack

async function buildOne({ id, dir, report, encoder, plus, minAppVersion }) {
  const pack = report.pack;
  const wallSrc = join(dir, art.WALLPAPER_FILE);
  /** [{ role, longEdge?, width, height, bytes: Buffer, ext, mime }] */
  const outs = [];
  if (encoder.kind === 'png') {
    outs.push({ role: 'wallpaper', longEdge: Math.max(pack.wallpaper.width, pack.wallpaper.height), ...pack.wallpaper, bytes: readFileSync(wallSrc), ext: 'png', mime: 'image/png' });
    for (const s of art.HERO_SIZES) {
      outs.push({ role: `widget-${s}`, ...pack.heroes[s], bytes: readFileSync(join(dir, art.HERO_FILES[s])), ext: 'png', mime: 'image/png' });
    }
    const t = resizeRgba(decodePng(readFileSync(wallSrc)), THUMB_SIZE.width, THUMB_SIZE.height);
    outs.push({ role: 'thumb', ...THUMB_SIZE, bytes: encodePng(t.width, t.height, t.rgba), ext: 'png', mime: 'image/png' });
  } else {
    const jobs = [];
    for (const c of WALLPAPER_CLASSES) jobs.push({ role: 'wallpaper', longEdge: c.longEdge, src: wallSrc, w: c.width, h: c.height, alpha: false });
    for (const s of art.HERO_SIZES) {
      const ref = art.HERO_REFERENCE_SIZES[s];
      const src = pack.heroes[s];
      // Source size, capped at the reference size (art over the reference is just bytes).
      const size = src.width > ref.width ? ref : src;
      jobs.push({ role: `widget-${s}`, src: join(dir, art.HERO_FILES[s]), w: size.width, h: size.height, alpha: true });
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

  const assets = outs.map((o) => ({
    path: assetName(o.role, o.longEdge, o.bytes, o.ext),
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
    version: cat.REMOTE_ART_VERSION,
    id,
    name: pack.meta.name,
    plus,
    minAppVersion,
    palette: pack.palette,
    meta: pack.meta,
    thumbhash,
    assets,
    totalBytes,
  };
  const contentHash = sha256(JSON.stringify(manifestNoVersion));
  return { outs, assets, manifestNoVersion, contentHash, pack };
}

// ------------------------------------------------------------------ the build

/**
 * Build packs. Returns { catalog, built: [{ id, packVersion, folder }], failed: [id], writes: [relative
 * paths in write order], encoder }. Never touches the network.
 */
export async function buildPacks(opts = {}) {
  const themesDir = resolve(opts.themesDir ?? join(APP_ROOT, art.ART_PACK_DIR));
  const outDir = resolve(opts.outDir ?? join(APP_ROOT, 'dist', 'packs'));
  const versionsFile = opts.versionsFile === null ? null : resolve(opts.versionsFile ?? join(APP_ROOT, 'scripts', 'packs', 'versions.json'));
  const plusIds = opts.plus ?? new Set();
  const minAppVersion = opts.minAppVersion ?? DEFAULT_MIN_APP;
  const log = opts.log ?? console.log;
  const encoder = await pickEncoder(opts.encoder ?? 'auto');
  if (encoder.kind === 'png') log('warning: no WebP encoder (sharp or python3 Pillow); shipping original PNGs, one wallpaper class');
  log(`encoder: ${encoder.name}`);

  let ids = subfolders(themesDir);
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
    const dir = join(themesDir, id);
    const report = art.validateArtPack(id, readPackFiles(dir), { alphaRowStep: 4 });
    if (!report.ok) {
      failed.push(id);
      log(`FAILED ${id}`);
      for (const e of report.errors) log(`    error:   ${e}`);
      continue;
    }
    const b = await buildOne({ id, dir, report, encoder, plus: plusIds.has(id), minAppVersion });
    const packVersion = nextVersion(lock[id], b.contentHash);
    lock[id] = { packVersion, contentHash: b.contentHash };
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
    });
    built.push({ id, packVersion, folder, totalBytes: b.manifestNoVersion.totalBytes });
    log(`OK     ${id} v${packVersion} (${(b.manifestNoVersion.totalBytes / 1000).toFixed(0)} kB, ${b.assets.length} files)`);
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
    else if (a === '--out') o.outDir = resolve(v());
    else if (a === '--only') o.only = list(v());
    else if (a === '--plus') o.plus = list(v());
    else if (a === '--plus-file') o.plus = readTiers(resolve(v()));
    else if (a === '--versions') o.versionsFile = resolve(v());
    else if (a === '--encoder') o.encoder = v();
    else if (a === '--min-app') o.minAppVersion = v();
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
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
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
