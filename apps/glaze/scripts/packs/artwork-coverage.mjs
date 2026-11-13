#!/usr/bin/env node
// Owner 2026-11-14: proves every published theme pack fills the Artwork 1-5 widgets with real pieces.
// For each pack in scripts/packs/releases.json it reads the LATEST manifest and works out Artwork 1-5
// exactly as the app does on a theme apply (src/core/artworkCoverage.ts). Writes the per-theme result
// to scripts/packs/artwork-coverage.json (checked by src/core/artworkCoverage.test.ts) and exits 1
// when any pack has NO pure artwork (its widgets would show only the fallback scene).
//
//   node scripts/packs/artwork-coverage.mjs --manifests <dir>   # <dir>/<release tag>/*manifest.json
//   node scripts/packs/artwork-coverage.mjs --download          # fetch them with `gh release download`
//   add --check to compare against the committed artwork-coverage.json instead of rewriting it.
import { execFileSync } from 'node:child_process';
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
let dir = value('--manifests');
if (!dir && flag('--download')) {
  dir = mkdtempSync(join(tmpdir(), 'glaze-manifests-'));
  for (const tag of [...new Set(Object.values(releases))]) {
    mkdirSync(join(dir, tag), { recursive: true });
    execFileSync('gh', ['release', 'download', tag, '-p', '*manifest.json', '-D', join(dir, tag), '--skip-existing'], { stdio: 'inherit' });
  }
}
if (!dir) { console.error('Pass --manifests <dir> or --download'); process.exit(2); }

const version = (f) => Number(f.slice(0, -'__manifest.json'.length).split('__v').pop());
const themes = {};
const problems = [];
for (const [id, tag] of Object.entries(releases).sort(([a], [b]) => a.localeCompare(b))) {
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

const counts = {};
for (const t of Object.values(themes)) counts[t.artwork.length] = (counts[t.artwork.length] ?? 0) + 1;
const report = { generated: 'scripts/packs/artwork-coverage.mjs', themes: Object.keys(themes).length, byArtworkCount: counts, problems, perTheme: Object.fromEntries(Object.entries(themes).map(([k, v]) => [k, { manifest: v.manifest, artwork: v.artwork }])) };

if (flag('--check')) {
  const saved = JSON.parse(readFileSync(OUT, 'utf8'));
  if (JSON.stringify(saved.perTheme) !== JSON.stringify(report.perTheme)) {
    console.error('artwork-coverage.json is out of date: run node scripts/packs/artwork-coverage.mjs --download and commit it.');
    problems.push('artwork-coverage.json out of date');
  }
} else {
  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
}
console.log(`themes ${report.themes}; pure artwork per theme ${JSON.stringify(counts)}`);
for (const p of problems) console.log(`PROBLEM ${p}`);
process.exit(problems.length ? 1 : 0);
