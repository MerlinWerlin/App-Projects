#!/usr/bin/env node
// T169: a built pack set (dist/packs from build_packs.mjs) -> flat GitHub Release assets.
//
//   node scripts/packs/release_assets.mjs [--dir dist/packs] [--out dist/release] [--existing assets.json]
//
// Release assets have no folders, so every file gets its flat name from src/core/packHost.ts
// (the app uses the same function to build URLs):  art/<id>/v<n>/<file> -> art__<id>__v<n>__<file>,
// catalog.json stays catalog.json. Writes
//   <out>/assets/<flat name>   a copy of every file (the folder `gh release upload` takes)
//   <out>/plan.json            { tag-independent upload plan: name, path, size, sha256, kind, upload }
//   <out>/upload-order.txt     names to upload, pack files first, then manifests, catalog.json LAST
//   <out>/upload-{1-files,2-manifests,3-catalog}.txt   the same, as the three batches to upload in turn
// Order matters: a phone must never see a catalogue entry or manifest whose files are missing.
// --existing takes the release's current assets (`gh release view <tag> --json assets`, or a JSON
// array of names / {name,size}); files already there with the same size are skipped (names carry a
// content hash or a version), catalog.json is always uploaded, and a versioned manifest that is
// already on the release with a different size is an error (bump the pack version instead).
// Refuses names GitHub would rewrite (only letters, digits, . - _), duplicates after flattening, and
// more than 1000 assets (GitHub's per-release limit). No network calls.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.removeAllListeners('warning');
const host = await import('../../src/core/packHost.ts');
const cat = await import('../../src/core/packCatalog.ts');

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** GitHub allows at most this many assets on one release. */
export const MAX_RELEASE_ASSETS = 1000;
/** Warn when a release gets this full (old pack versions stay until pruned). */
export const WARN_RELEASE_ASSETS = 800;

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Names (and sizes when known) of a release's current assets, from gh JSON or a plain list. */
export function parseExisting(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.assets) ? raw.assets : null;
  if (!list) throw new Error('--existing: expected a JSON array or { "assets": [...] }');
  const out = new Map();
  for (const a of list) {
    if (typeof a === 'string') out.set(a, null);
    else if (a && typeof a.name === 'string') out.set(a.name, Number.isFinite(a.size) ? a.size : null);
  }
  return out;
}

/**
 * The flat asset list for a built pack folder, in upload order (files, manifests, catalog.json),
 * with `upload` false for files the release already has.
 */
export function planRelease(dir, existing = new Map()) {
  const root = resolve(dir);
  if (!existsSync(join(root, cat.CATALOG_FILE))) throw new Error(`${root}/catalog.json not found: run scripts/packs/build_packs.mjs first`);
  const catalog = cat.parseCatalog(JSON.parse(readFileSync(join(root, cat.CATALOG_FILE), 'utf8')));
  if (!catalog.ok) throw new Error(`catalog.json does not parse: ${catalog.error}`);
  const files = [];
  const manifests = [];
  for (const p of existsSync(join(root, 'art')) ? walk(join(root, 'art')) : []) {
    const rel = relative(root, p).split(sep).join('/');
    (rel.endsWith('/' + cat.REMOTE_ART_MANIFEST) ? manifests : files).push(rel);
  }
  const seen = new Map();
  const entry = (rel, kind) => {
    const name = host.flatAssetName(rel);
    if (!host.isValidFlatAssetName(name)) throw new Error(`${rel}: "${name}" is not a valid release asset name (letters, digits, . - _ only)`);
    if (seen.has(name)) throw new Error(`${rel} and ${seen.get(name)} both flatten to ${name}`);
    seen.set(name, rel);
    const buf = readFileSync(join(root, rel));
    const had = existing.has(name);
    const hadSize = existing.get(name);
    if (kind === 'manifest' && had && hadSize !== null && hadSize !== buf.length) {
      throw new Error(`${name} is already on the release with different content: bump the pack version (scripts/packs/versions.json)`);
    }
    const upload = kind === 'catalog' || !had || (hadSize !== null && hadSize !== buf.length);
    return { name, path: rel, size: buf.length, sha256: sha256(buf), kind, upload };
  };
  const plan = [...files.map((r) => entry(r, 'file')), ...manifests.map((r) => entry(r, 'manifest')), entry(cat.CATALOG_FILE, 'catalog')];
  // Every pack the catalogue lists must have its manifest and thumb in this set (or already on the release).
  for (const p of catalog.value.packs) {
    for (const rel of [p.manifest, p.thumb]) {
      const name = host.flatAssetName(rel);
      if (!seen.has(name) && !existing.has(name)) throw new Error(`catalog lists ${rel} but it is neither built nor on the release`);
    }
  }
  const total = new Set([...existing.keys(), ...plan.map((e) => e.name)]).size;
  if (total > MAX_RELEASE_ASSETS) throw new Error(`the release would hold ${total} assets; GitHub allows ${MAX_RELEASE_ASSETS}: prune old pack versions or start a new tag`);
  const stale = [...existing.keys()].filter((n) => !seen.has(n)).sort();
  return { plan, stale, totalAssets: total, catalog: catalog.value };
}

/** Write <out>/assets/<flat name> copies, plan.json and upload-order.txt. */
export function writeReleaseAssets({ dir, outDir, existing = new Map(), log = console.log }) {
  const root = resolve(dir);
  const out = resolve(outDir);
  const r = planRelease(root, existing);
  rmSync(out, { recursive: true, force: true });
  const assets = join(out, 'assets');
  mkdirSync(assets, { recursive: true });
  for (const e of r.plan) copyFileSync(join(root, e.path), join(assets, e.name));
  writeFileSync(join(out, 'plan.json'), JSON.stringify({ assets: r.plan, stale: r.stale, totalAssets: r.totalAssets }, null, 2) + '\n');
  const order = r.plan.filter((e) => e.upload).map((e) => e.name);
  const lines = (xs) => (xs.length ? xs.join('\n') + '\n' : '');
  writeFileSync(join(out, 'upload-order.txt'), lines(order));
  // The same order split into the three batches the workflow uploads one after another.
  for (const [file, kind] of [['upload-1-files.txt', 'file'], ['upload-2-manifests.txt', 'manifest'], ['upload-3-catalog.txt', 'catalog']]) {
    writeFileSync(join(out, file), lines(r.plan.filter((e) => e.upload && e.kind === kind).map((e) => e.name)));
  }
  const bytes = r.plan.filter((e) => e.upload).reduce((n, e) => n + e.size, 0);
  log(`${r.plan.length} asset(s) for ${r.catalog.packs.length} pack(s); ${order.length} to upload (${(bytes / 1e6).toFixed(2)} MB), catalog.json last`);
  if (r.stale.length) log(`${r.stale.length} asset(s) on the release are not in this build (older pack versions); kept`);
  if (r.totalAssets > WARN_RELEASE_ASSETS) log(`warning: the release will hold ${r.totalAssets} of ${MAX_RELEASE_ASSETS} allowed assets`);
  return { ...r, outDir: out, assetsDir: assets, order };
}

// ------------------------------------------------------------------ CLI

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => {
      const x = argv[++i];
      if (x === undefined) throw new Error(`${a} needs a value`);
      return x;
    };
    if (a === '--dir') o.dir = resolve(v());
    else if (a === '--out') o.outDir = resolve(v());
    else if (a === '--existing') o.existingFile = resolve(v());
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
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      process.exit(0);
    }
    const existing = o.existingFile ? parseExisting(JSON.parse(readFileSync(o.existingFile, 'utf8'))) : new Map();
    writeReleaseAssets({ dir: o.dir ?? join(APP_ROOT, 'dist', 'packs'), outDir: o.outDir ?? join(APP_ROOT, 'dist', 'release'), existing });
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
