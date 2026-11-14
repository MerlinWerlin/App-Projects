#!/usr/bin/env node
// T169: a built pack set (dist/packs from build_packs.mjs) -> flat GitHub Release assets.
//
//   node scripts/packs/release_assets.mjs [--dir dist/packs] [--out dist/release] [--existing-dir <dir>]
//        [--existing assets.json] [--single | --tag <tag>]
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
//
// T274 (more than one release): packs are grouped by their catalogue `release` (missing =
// glaze-packs-v1). The default layout is one folder per tag:
//   <out>/<tag>/assets/, plan.json, upload-order.txt, upload-{1,2,3}-*.txt   (as above, per release)
//   <out>/tags.txt   the tags to publish, glaze-packs-v1 LAST (it alone holds catalog.json)
// --existing-dir <dir> reads <dir>/<tag>.json per tag (gh release view <tag> --json assets); --existing
// is glaze-packs-v1's. A warning is printed per tag past 800 assets.
// --single: the old layout (<out>/assets ...), every pack in one release, `release` ignored (the
//   staging release, which the app reads for every pack: src/core/packHost.ts packReleaseBase).
// --tag <tag>: the old layout for that tag's packs only (catalog.json too when it is glaze-packs-v1).

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
/** T274: the release catalog.json and every pack without a `release` live on. */
export const DEFAULT_RELEASE = 'glaze-packs-v1';

/** The release a catalogue pack's files go to. */
export const packTag = (p) => p.release ?? DEFAULT_RELEASE;

/** Tags in publish order: glaze-packs-v2, -v3, ... (by number), then glaze-packs-v1 last (catalog.json). */
export function tagOrder(tags, catalogTag = DEFAULT_RELEASE) {
  const num = (t) => Number(/^glaze-packs-v(\d+)$/.exec(t)?.[1] ?? 0);
  return [...new Set(tags)].filter((t) => t !== catalogTag).sort((a, b) => num(a) - num(b) || (a < b ? -1 : 1)).concat(catalogTag);
}

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
 * with `upload` false for files the release already has. No `tag`: one release holds everything
 * (`release` ignored). With `tag` (T274): only the packs of that release, plus catalog.json when the
 * tag is glaze-packs-v1; a built folder of a pack the catalogue doesn't list counts as glaze-packs-v1.
 */
export function planRelease(dir, existing = new Map(), { tag = null, catalogTag = DEFAULT_RELEASE } = {}) {
  const root = resolve(dir);
  if (!existsSync(join(root, cat.CATALOG_FILE))) throw new Error(`${root}/catalog.json not found: run scripts/packs/build_packs.mjs first`);
  const catalog = cat.parseCatalog(JSON.parse(readFileSync(join(root, cat.CATALOG_FILE), 'utf8')));
  if (!catalog.ok) throw new Error(`catalog.json does not parse: ${catalog.error}`);
  const tagOf = new Map(catalog.value.packs.map((p) => [p.id, packTag(p)]));
  const mine = (id) => tag === null || (tagOf.get(id) ?? DEFAULT_RELEASE) === tag;
  const withCatalog = tag === null || tag === catalogTag;
  const files = [];
  const manifests = [];
  for (const p of existsSync(join(root, 'art')) ? walk(join(root, 'art')) : []) {
    const rel = relative(root, p).split(sep).join('/');
    if (!mine(rel.split('/')[1])) continue;
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
  const plan = [...files.map((r) => entry(r, 'file')), ...manifests.map((r) => entry(r, 'manifest')), ...(withCatalog ? [entry(cat.CATALOG_FILE, 'catalog')] : [])];
  // Every pack the catalogue lists (for this release) must have its manifest and thumb in this set (or already on the release).
  for (const p of catalog.value.packs) {
    if (!mine(p.id)) continue;
    for (const rel of [p.manifest, p.thumb]) {
      const name = host.flatAssetName(rel);
      if (!seen.has(name) && !existing.has(name)) throw new Error(`catalog lists ${rel} but it is neither built nor on the release${tag ? ` ${tag}` : ''}`);
    }
  }
  const total = new Set([...existing.keys(), ...plan.map((e) => e.name)]).size;
  if (total > MAX_RELEASE_ASSETS) throw new Error(`${tag ? `${tag}: ` : ''}the release would hold ${total} assets; GitHub allows ${MAX_RELEASE_ASSETS}: prune old pack versions or start a new tag`);
  const stale = [...existing.keys()].filter((n) => !seen.has(n)).sort();
  const packs = catalog.value.packs.filter((p) => mine(p.id)).length;
  return { plan, stale, totalAssets: total, catalog: catalog.value, tag, packs };
}

/** T274: one plan per release tag the catalogue uses (glaze-packs-v1 always, last). */
export function planReleases(dir, existingByTag = new Map(), { catalogTag = DEFAULT_RELEASE } = {}) {
  const root = resolve(dir);
  if (!existsSync(join(root, cat.CATALOG_FILE))) throw new Error(`${root}/catalog.json not found: run scripts/packs/build_packs.mjs first`);
  const catalog = cat.parseCatalog(JSON.parse(readFileSync(join(root, cat.CATALOG_FILE), 'utf8')));
  if (!catalog.ok) throw new Error(`catalog.json does not parse: ${catalog.error}`);
  return tagOrder(catalog.value.packs.map(packTag), catalogTag).map((tag) => planRelease(root, existingByTag.get(tag) ?? new Map(), { tag, catalogTag }));
}

/** Write <out>/assets/<flat name> copies, plan.json and upload-order.txt (one release; `tag` as in planRelease). */
export function writeReleaseAssets({ dir, outDir, existing = new Map(), log = console.log, tag = null, catalogTag = DEFAULT_RELEASE }) {
  const root = resolve(dir);
  const out = resolve(outDir);
  const r = planRelease(root, existing, { tag, catalogTag });
  writeOne(root, out, r, log);
  return { ...r, outDir: out, assetsDir: join(out, 'assets'), order: r.plan.filter((e) => e.upload).map((e) => e.name) };
}

/**
 * T274: <out>/<tag>/... for every release the catalogue uses, and <out>/tags.txt (publish order,
 * glaze-packs-v1 last). `existingByTag`: Map tag -> parseExisting() result.
 */
export function writeReleaseSets({ dir, outDir, existingByTag = new Map(), log = console.log, catalogTag = DEFAULT_RELEASE }) {
  const root = resolve(dir);
  const out = resolve(outDir);
  const plans = planReleases(root, existingByTag, { catalogTag });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const sets = plans.map((r) => {
    const tagOut = join(out, r.tag);
    writeOne(root, tagOut, r, (m) => log(`${r.tag}: ${m}`));
    return { ...r, outDir: tagOut, assetsDir: join(tagOut, 'assets'), order: r.plan.filter((e) => e.upload).map((e) => e.name) };
  });
  writeFileSync(join(out, 'tags.txt'), sets.map((s) => s.tag).join('\n') + '\n');
  log(`${sets.length} release(s): ${sets.map((s) => s.tag).join(', ')} (catalog.json goes to ${catalogTag}, uploaded last)`);
  return { outDir: out, sets };
}

function writeOne(root, out, r, log) {
  rmSync(out, { recursive: true, force: true });
  const assets = join(out, 'assets');
  mkdirSync(assets, { recursive: true });
  for (const e of r.plan) copyFileSync(join(root, e.path), join(assets, e.name));
  writeFileSync(join(out, 'plan.json'), JSON.stringify({ ...(r.tag ? { tag: r.tag } : {}), assets: r.plan, stale: r.stale, totalAssets: r.totalAssets }, null, 2) + '\n');
  const order = r.plan.filter((e) => e.upload).map((e) => e.name);
  const lines = (xs) => (xs.length ? xs.join('\n') + '\n' : '');
  writeFileSync(join(out, 'upload-order.txt'), lines(order));
  // The same order split into the three batches the workflow uploads one after another.
  for (const [file, kind] of [['upload-1-files.txt', 'file'], ['upload-2-manifests.txt', 'manifest'], ['upload-3-catalog.txt', 'catalog']]) {
    writeFileSync(join(out, file), lines(r.plan.filter((e) => e.upload && e.kind === kind).map((e) => e.name)));
  }
  const bytes = r.plan.filter((e) => e.upload).reduce((n, e) => n + e.size, 0);
  const hasCatalog = r.plan.some((e) => e.kind === 'catalog');
  log(`${r.plan.length} asset(s) for ${r.packs} pack(s); ${order.length} to upload (${(bytes / 1e6).toFixed(2)} MB)${hasCatalog ? ', catalog.json last' : ''}`);
  if (r.stale.length) log(`${r.stale.length} asset(s) on the release are not in this build (older pack versions); kept`);
  if (r.totalAssets > WARN_RELEASE_ASSETS) {
    log(`warning: ${r.tag ? `${r.tag} ` : 'the release '}will hold ${r.totalAssets} of ${MAX_RELEASE_ASSETS} allowed assets: put new packs on the next tag (build_packs.mjs --release)`);
  }
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
    else if (a === '--existing-dir') o.existingDir = resolve(v());
    else if (a === '--single') o.single = true;
    else if (a === '--tag') o.tag = v();
    else if (a === '--catalog-tag') o.catalogTag = v();
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
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 32).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      process.exit(0);
    }
    const readEx = (f) => parseExisting(JSON.parse(readFileSync(f, 'utf8')));
    const existing = o.existingFile ? readEx(o.existingFile) : new Map();
    const dir = o.dir ?? join(APP_ROOT, 'dist', 'packs');
    const outDir = o.outDir ?? join(APP_ROOT, 'dist', 'release');
    if (o.single && o.tag) throw new Error('--single and --tag are exclusive');
    if (o.tag !== undefined && !host.isPackReleaseTag(o.tag)) throw new Error(`--tag: "${o.tag}" is not a release tag (glaze-packs-v<n>)`);
    if (o.catalogTag !== undefined && !host.isPackReleaseTag(o.catalogTag)) throw new Error('--catalog-tag must be glaze-packs-v<n>');
    if (o.single || o.tag) {
      writeReleaseAssets({ dir, outDir, existing, tag: o.tag ?? null, catalogTag: o.catalogTag });
    } else {
      const existingByTag = new Map();
      if (o.existingDir && existsSync(o.existingDir)) {
        for (const f of readdirSync(o.existingDir)) if (f.endsWith('.json')) existingByTag.set(f.slice(0, -5), readEx(join(o.existingDir, f)));
      }
      if (o.existingFile) existingByTag.set(DEFAULT_RELEASE, existing);
      writeReleaseSets({ dir, outDir, existingByTag, catalogTag: o.catalogTag });
    }
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
