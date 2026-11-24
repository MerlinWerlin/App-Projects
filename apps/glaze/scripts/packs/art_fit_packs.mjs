#!/usr/bin/env node
// Glaze art-fit (owner 24 Nov 2026: "every artwork must belong in its theme's wallpaper world"): new
// versions of EXISTING themes whose small widget art was redrawn, for catalog-v2.json only (1.0.44+).
//
//   node scripts/packs/art_fit_packs.mjs --base <public pack URL> [--fit pack-artwork-fit] [--out dist/art-fit] [--cache dist/art-fit-cache]
//
// pack-artwork-fit/<id>/fit.json names the live base pack (packVersion + the manifest's SHA-256) and the
// widget options it replaces; the new art sits beside it as transparent WebP cutouts (the phone puts them
// on the wallpaper slice under the widget: background "wallpaper", src/core/seamlessWidget.ts). The base
// manifest must be the one catalog-v2.json serves now, and every base file is checked by SHA-256.
// Output: <out>/art/<id>/v<base+1>/... (every kept base file + the new art, manifest written last) and
// <out>/overrides.json, the catalogue fields publish_catalog_v2.mjs --overrides swaps into those entries.
// catalog.json is never read for writing and never written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APP_CATALOG_FILE, manifestPath, packFolder, parseRemoteArtManifest } from '../../src/core/packCatalog.ts';
import { parseWidgetOptions, validateWidgetOptions } from '../../src/core/widgetOptions.ts';
import { webpSize } from './append_artwork.mjs';

process.removeAllListeners('warning');
export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** r2.dev refuses non-browser user agents and rate-limits bursts. */
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' };

export async function fetchBytes(url, fetcher = fetch, attempts = 8) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetcher(url, { headers: UA, signal: AbortSignal.timeout(90_000) });
      if (r.status === 200) return Buffer.from(await r.arrayBuffer());
      last = new Error(`${url}: HTTP ${r.status}`);
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) {
      last = e;
    }
    await sleep(1200 * (i + 1));
  }
  throw last;
}

/** Reads and checks every pack-artwork-fit/<id>/fit.json. */
export function readFits(dir) {
  const fits = [];
  for (const id of readdirSync(dir).sort()) {
    const f = join(dir, id, 'fit.json');
    if (!existsSync(f)) continue;
    const fit = JSON.parse(readFileSync(f, 'utf8'));
    assert.equal(fit.theme, id, `${f}: theme must be the folder name`);
    assert.ok(Number.isInteger(fit.base?.packVersion), `${id}: base.packVersion`);
    assert.match(fit.base?.manifestSha256 ?? '', /^[0-9a-f]{64}$/, `${id}: base.manifestSha256`);
    assert.ok(Array.isArray(fit.replace) && fit.replace.length > 0, `${id}: nothing to replace`);
    const ids = new Set();
    for (const r of fit.replace) {
      assert.match(r.from ?? '', /^[a-z0-9-]+$/, `${id}: replace.from`);
      assert.match(r.id ?? '', /^[a-z0-9-]+$/, `${id}: replace.id`);
      assert.match(r.file ?? '', /^[a-z0-9-]+\.webp$/, `${id}: replace.file`);
      assert.ok(!ids.has(r.id), `${id}: ${r.id} twice`);
      ids.add(r.id);
      assert.ok(existsSync(join(dir, id, r.file)), `${id}: ${r.file} missing`);
    }
    fits.push({ ...fit, dir: join(dir, id) });
  }
  return fits;
}

/**
 * The new manifest and its files for one theme. `base` is the parsed base manifest JSON, `baseFiles`
 * maps asset path -> bytes (already SHA-checked). Pure: returns { manifest, files: Map<path, bytes> }.
 */
export function buildFit(fit, base, baseFiles, readArt = (f) => readFileSync(join(fit.dir, f))) {
  assert.equal(base.packVersion, fit.base.packVersion, `${fit.theme}: base version`);
  const m = structuredClone(base);
  m.packVersion = base.packVersion + 1;
  const files = new Map();
  const newAssets = [];
  for (const r of fit.replace) {
    assert.ok(r.id === r.from || !base.widgets.some((w) => w.id === r.id), `${fit.theme}: new id ${r.id} is already a v${base.packVersion} widget`);
    const i = m.widgets.findIndex((w) => w.id === r.from);
    assert.ok(i >= 0, `${fit.theme}: no widget ${r.from} in v${base.packVersion}`);
    assert.equal(m.widgets[i].kind, 'art', `${fit.theme}/${r.from}: only art is replaced`);
    const bytes = readArt(r.file);
    const { width, height } = webpSize(bytes);
    const hero = r.from === 'hero-small';
    const path = `${hero ? 'widget-small' : `widget-${r.id}`}.${sha256(bytes).slice(0, 8)}.webp`;
    files.set(path, bytes);
    newAssets.push({ path, role: hero ? 'widget-small' : 'widget-art', width, height, bytes: bytes.length, sha256: sha256(bytes), mime: 'image/webp' });
    const old = m.widgets[i];
    m.widgets[i] = { ...old, id: r.id, image: path, fit: 'fit', background: 'wallpaper', ...(r.label ? { label: r.label } : {}) };
    if (hero) m.assets = m.assets.filter((a) => a.role !== 'widget-small');
  }
  assert.equal(new Set(m.widgets.map((w) => w.id)).size, m.widgets.length, `${fit.theme}: duplicate widget id`);
  // Keep every base asset something still uses; drop replaced art.
  const used = new Set(m.widgets.map((w) => w.image).filter(Boolean));
  m.assets = m.assets.filter((a) => a.role !== 'widget-art' || used.has(a.path));
  for (const a of m.assets) {
    const b = baseFiles.get(a.path);
    assert.ok(b, `${fit.theme}: base file ${a.path} missing`);
    files.set(a.path, b);
  }
  m.assets.push(...newAssets);
  m.totalBytes = m.assets.reduce((n, a) => n + a.bytes, 0);
  const parsed = parseRemoteArtManifest(m, m.id);
  assert.ok(parsed.ok, `${fit.theme}: new manifest fails the app parser (${parsed.ok ? '' : parsed.error})`);
  const opts = parseWidgetOptions(m.widgets, m.assets);
  const errs = validateWidgetOptions(m.widgets, m.assets);
  assert.deepEqual(errs, [], `${fit.theme}: widget options: ${errs.join('; ')}`);
  assert.equal(opts.options.length, m.widgets.length, `${fit.theme}: the app parser dropped a widget option`);
  return { manifest: m, files };
}

export async function buildAll({ base, fitDir, outDir, cacheDir, fetcher = fetch, log = console.log }) {
  const fits = readFits(fitDir);
  const v2 = JSON.parse((await fetchBytes(`${base}/${APP_CATALOG_FILE}?artFit=${Date.now()}`, fetcher)).toString('utf8'));
  const overrides = [];
  for (const fit of fits) {
    const entry = v2.packs.find((p) => p.id === fit.theme);
    assert.ok(entry, `${fit.theme}: not in catalog-v2.json`);
    const baseManifest = manifestPath(fit.theme, fit.base.packVersion);
    const target = manifestPath(fit.theme, fit.base.packVersion + 1);
    assert.ok(entry.manifest === baseManifest || entry.manifest === target, `${fit.theme}: catalog-v2.json serves ${entry.manifest}, fit.json expects ${baseManifest}`);
    const cache = (rel) => join(cacheDir, rel);
    const get = async (rel, sha) => {
      const p = cache(rel);
      if (existsSync(p) && (!sha || sha256(readFileSync(p)) === sha)) return readFileSync(p);
      const b = await fetchBytes(`${base}/${rel}`, fetcher);
      if (sha) assert.equal(sha256(b), sha, `${rel}: bytes differ from the manifest`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, b);
      return b;
    };
    const mBytes = await get(baseManifest, fit.base.manifestSha256);
    const bm = JSON.parse(mBytes.toString('utf8'));
    const baseFiles = new Map();
    for (const a of bm.assets) baseFiles.set(a.path, await get(`${packFolder(fit.theme, bm.packVersion)}/${a.path}`, a.sha256));
    const { manifest, files } = buildFit(fit, bm, baseFiles);
    const folder = join(outDir, packFolder(fit.theme, manifest.packVersion));
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    for (const [p, b] of files) writeFileSync(join(folder, p), b);
    writeFileSync(join(outDir, manifestPath(fit.theme, manifest.packVersion)), JSON.stringify(manifest, null, 2) + '\n');
    const thumb = manifest.assets.find((a) => a.role === 'thumb');
    overrides.push({ id: fit.theme, packVersion: manifest.packVersion, bytes: manifest.totalBytes, manifest: manifestPath(fit.theme, manifest.packVersion), thumb: `${packFolder(fit.theme, manifest.packVersion)}/${thumb.path}` });
    log(`${fit.theme}: v${bm.packVersion} -> v${manifest.packVersion} (${fit.replace.map((r) => `${r.from}->${r.id}`).join(', ')})`);
  }
  writeFileSync(join(outDir, 'overrides.json'), JSON.stringify(overrides, null, 2) + '\n');
  return overrides;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const value = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
  try {
    const base = String(value('--base', '')).replace(/\/+$/, '');
    assert.match(base, /^https?:\/\//, '--base <public pack URL> is required');
    const outDir = resolve(value('--out', join(APP_ROOT, 'dist', 'art-fit')));
    mkdirSync(outDir, { recursive: true });
    await buildAll({ base, fitDir: resolve(value('--fit', join(APP_ROOT, 'pack-artwork-fit'))), outDir, cacheDir: resolve(value('--cache', join(APP_ROOT, 'dist', 'art-fit-cache'))) });
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
