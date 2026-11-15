#!/usr/bin/env node
// Owner 2026-11-14: proves every published theme pack fills the Artwork 1-5 widgets with real pieces.
// For each pack in scripts/packs/releases.json it reads the LATEST manifest and works out Artwork 1-5
// exactly as the app does on a theme apply (src/core/artworkCoverage.ts). Writes the per-theme result
// to scripts/packs/artwork-coverage.json (checked by src/core/artworkCoverage.test.ts) and exits 1
// when a staged or bundled theme lacks five different pure artwork images.
//
//   node scripts/packs/artwork-coverage.mjs --staged <built-pack-dir> --bundled [--check]
//   node scripts/packs/artwork-coverage.mjs --manifests <dir>   # <dir>/<release tag>/*manifest.json
//   node scripts/packs/artwork-coverage.mjs --download          # fetch them with `gh release download`
//   add --check to compare against the committed artwork-coverage.json instead of rewriting it.
// The staged mode is used before publication; legacy --download inspects published release files.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');
const OUT = join(HERE, 'artwork-coverage.json');
const { parseWidgetOptions } = await import(new URL('../../src/core/widgetOptions.ts', import.meta.url).href);
const { plannedArtworkOptionIds, artworkSlotSources, ARTWORK_SLOTS } = await import(new URL('../../src/core/artworkCoverage.ts', import.meta.url).href);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const releases = JSON.parse(readFileSync(join(HERE, 'releases.json'), 'utf8'));
const staged = value('--staged');
let dir = value('--manifests');
if (!dir && flag('--download')) {
  dir = mkdtempSync(join(tmpdir(), 'glaze-manifests-'));
  for (const tag of [...new Set(Object.values(releases))]) {
    mkdirSync(join(dir, tag), { recursive: true });
    execFileSync('gh', ['release', 'download', tag, '-p', '*manifest.json', '-D', join(dir, tag), '--skip-existing'], { stdio: 'inherit' });
  }
}
if (!dir && !staged) { console.error('Pass --staged <built-pack-dir>, --manifests <dir> or --download'); process.exit(2); }

const version = (f) => Number(f.slice(0, -'__manifest.json'.length).split('__v').pop());
const themes = {};
const problems = [];
for (const [id, tag] of Object.entries(releases).sort(([a], [b]) => a.localeCompare(b))) {
  if (staged) break;
  const folder = join(dir, tag);
  const files = existsSync(folder) ? readdirSync(folder).filter((f) => f.startsWith(`art__${id}__v`) && f.endsWith('__manifest.json')) : [];
  if (!files.length) { problems.push(`${id}: no manifest in ${tag}`); themes[id] = { manifest: null, artwork: [], slots: artworkSlotSources([]) }; continue; }
  files.sort((a, b) => version(b) - version(a));
  const m = JSON.parse(readFileSync(join(folder, files[0]), 'utf8'));
  const parsed = parseWidgetOptions(m.widgets ?? null, m.assets ?? []);
  const options = parsed.options ?? parsed;
  const artwork = plannedArtworkOptionIds(id, options);
  const slots = artworkSlotSources(artwork);
  if (artwork.length === 0) problems.push(`${id}: no pure artwork (Artwork 1-${ARTWORK_SLOTS} would show only the fallback scene)`);
  themes[id] = { manifest: `${tag}/${files[0]}`, artwork, slots };
}

if (staged) {
  const catalog = JSON.parse(readFileSync(join(staged, 'catalog.json'), 'utf8'));
  for (const entry of catalog.packs) {
    const m = JSON.parse(readFileSync(join(staged, entry.manifest), 'utf8'));
    const parsed = parseWidgetOptions(m.widgets, m.assets);
    problems.push(...parsed.errors.map((e) => `${entry.id}: ${e}`));
    const artwork = plannedArtworkOptionIds(entry.id, parsed.options);
    const images = artwork.map((id) => parsed.options.find((o) => o.id === id)?.image);
    const hashes = images.map((image) => m.assets.find((a) => a.path === image)?.sha256);
    if (artwork.length !== ARTWORK_SLOTS || new Set(images).size !== ARTWORK_SLOTS || new Set(hashes).size !== ARTWORK_SLOTS || hashes.some((h) => !h)) problems.push(`${entry.id}: expected five distinct pure artwork images`);
    themes[entry.id] = { manifest: entry.manifest, artwork, images, hashes, slots: artworkSlotSources(artwork) };
  }
}

const counts = {};
for (const t of Object.values(themes)) counts[t.artwork.length] = (counts[t.artwork.length] ?? 0) + 1;
const report = { generated: 'scripts/packs/artwork-coverage.mjs', themes: Object.keys(themes).length, byArtworkCount: counts, problems, perTheme: Object.fromEntries(Object.entries(themes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { manifest: v.manifest, artwork: v.artwork, ...(v.images ? { images: v.images, hashes: v.hashes } : {}) }])) };
if (flag('--bundled')) {
  const { ART_PACK_LIBRARY } = await import('../../src/core/artPackLibrary.ts');
  const { artPackWidgetOptions } = await import('../../src/core/artPack.ts');
  report.bundled = {};
  for (const pack of ART_PACK_LIBRARY) {
    const options = artPackWidgetOptions(pack), artwork = plannedArtworkOptionIds(pack.id, options);
    const images = artwork.map((id) => options.find((o) => o.id === id).image);
    const hashes = images.map((image) => createHash('sha256').update(readFileSync(join(APP, 'themes', pack.id, image))).digest('hex'));
    if (artwork.length !== 5 || new Set(hashes).size !== 5) problems.push(`${pack.id}: expected five distinct bundled artworks`);
    report.bundled[pack.id] = { artwork, images, hashes };
  }
  if (ART_PACK_LIBRARY.length !== 3) problems.push('expected all three bundled themes');
  report.galleryThemes = report.themes + ART_PACK_LIBRARY.length;
}

if (flag('--check')) {
  const saved = JSON.parse(readFileSync(OUT, 'utf8'));
  if (JSON.stringify(saved.perTheme) !== JSON.stringify(report.perTheme) || (flag('--bundled') && JSON.stringify(saved.bundled) !== JSON.stringify(report.bundled))) {
    console.error('artwork-coverage.json is out of date: run node scripts/packs/artwork-coverage.mjs --staged <built-pack-dir> --bundled and commit it.');
    problems.push('artwork-coverage.json out of date');
  }
} else {
  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
}
console.log(`themes ${report.themes}; pure artwork per theme ${JSON.stringify(counts)}`);
for (const p of problems) console.log(`PROBLEM ${p}`);
process.exit(problems.length ? 1 : 0);
