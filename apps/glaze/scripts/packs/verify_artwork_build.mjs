#!/usr/bin/env node
// Independently audit staged pack output. Reads bytes only; never publishes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyArtworkCorrections, checkedPath, digest, loadBaseline } from './append_artwork.mjs';
import { parseWidgetOptions } from '../../src/core/widgetOptions.ts';
import { plannedArtworkOptionIds } from '../../src/core/artworkCoverage.ts';

const here = dirname(fileURLToPath(import.meta.url));
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const artwork = (manifest) => plannedArtworkOptionIds(manifest.id, parseWidgetOptions(manifest.widgets, manifest.assets).options);

export function verifyArtworkBuild({ dir, baselineDir = join(here, 'artwork-baseline'), corrections = json(join(here, 'artwork-corrections.json')), complete = false }) {
  const baseline = loadBaseline(baselineDir), catalog = json(join(dir, 'catalog.json'));
  const build = json(join(dir, 'artwork-build.json'));
  assert.equal(build.baselineCatalogSha256, baseline.lock.catalogSha256, 'build uses a different baseline');
  assert.deepEqual(build.correctedFunctionalOptions, corrections, 'unexpected functional corrections');
  assert.deepEqual(omit(catalog, ['packs', 'generatedAt']), omit(baseline.catalog, ['packs', 'generatedAt']), 'catalogue metadata changed');
  assert.deepEqual(catalog.packs.map((p) => p.id), baseline.catalog.packs.map((p) => p.id), 'catalogue theme order or membership changed');
  const pending = [], perTheme = [];
  let originalAssetsPreserved = 0, newAssetsVerified = 0;
  for (const [index, entry] of catalog.packs.entries()) {
    const baseEntry = baseline.catalog.packs[index], base = baseline.manifests.get(entry.id);
    const path = checkedPath(dir, entry.manifest), manifest = json(path), folder = dirname(path);
    const changed = entry.packVersion !== base.packVersion;
    assert.equal(manifest.id, entry.id, `${entry.id}: manifest id changed`);
    assert.equal(manifest.packVersion, entry.packVersion, `${entry.id}: catalogue version mismatch`);
    assert.deepEqual(readdirSync(checkedPath(dir, `art/${entry.id}`)), [`v${entry.packVersion}`], `${entry.id}: stale generated version folder`);
    assert.deepEqual(omit(entry, ['packVersion', 'bytes', 'manifest', 'thumb', 'release']), omit(baseEntry, ['packVersion', 'bytes', 'manifest', 'thumb', 'release']), `${entry.id}: catalogue fields changed`);
    assert.deepEqual(omit(manifest, ['packVersion', 'assets', 'widgets', 'totalBytes', 'release']), omit(base, ['packVersion', 'assets', 'widgets', 'totalBytes', 'release']), `${entry.id}: manifest fields changed`);
    const corrected = changed ? applyArtworkCorrections(base, corrections) : base;
    assert.deepEqual(manifest.widgets.slice(0, base.widgets.length), corrected.widgets, `${entry.id}: original options changed`);
    assert.deepEqual(manifest.assets.slice(0, base.assets.length), base.assets, `${entry.id}: original asset metadata changed`);
    assert.equal(manifest.totalBytes, manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0), `${entry.id}: incorrect total bytes`);
    assert.equal(entry.bytes, manifest.totalBytes, `${entry.id}: incorrect catalogue bytes`);
    for (const [assetIndex, asset] of manifest.assets.entries()) {
      const bytes = readFileSync(checkedPath(folder, asset.path));
      assert.equal(bytes.length, asset.bytes, `${entry.id}/${asset.path}: output byte length changed`);
      assert.equal(digest(bytes), asset.sha256, `${entry.id}/${asset.path}: output hash changed`);
      if (assetIndex < base.assets.length) originalAssetsPreserved++; else newAssetsVerified++;
    }
    const ids = artwork(manifest), before = artwork(applyArtworkCorrections(base, corrections));
    if (changed) {
      assert.equal(entry.packVersion, base.packVersion + 1, `${entry.id}: incorrect version increment`);
      assert.equal(entry.manifest, `art/${entry.id}/v${entry.packVersion}/manifest.json`, `${entry.id}: incorrect manifest path`);
      assert.equal(ids.length, 5, `${entry.id}: expected five artwork pieces`);
      assert.equal(new Set(ids).size, 5, `${entry.id}: repeated artwork id`);
      assert.deepEqual(ids.slice(0, before.length), before, `${entry.id}: original artwork order changed`);
      assert.equal(manifest.assets.length - base.assets.length, 5 - before.length, `${entry.id}: incorrect appended asset count`);
      assert.equal(manifest.widgets.length - base.widgets.length, 5 - before.length, `${entry.id}: incorrect appended option count`);
    } else {
      assert.deepEqual(entry, baseEntry, `${entry.id}: untouched catalogue entry changed`);
      assert.equal(digest(readFileSync(path)), baseline.records.get(entry.id).sha256, `${entry.id}: untouched manifest bytes changed`);
    }
    if ((changed ? ids : before).length !== 5) pending.push(entry.id);
    perTheme.push({ id: entry.id, packVersion: manifest.packVersion, changed, artwork: ids });
  }
  const changed = perTheme.filter((p) => p.changed).map((p) => p.id);
  assert.deepEqual(build.built.map((p) => p.id), changed, 'build report differs from actual changed themes');
  assert.deepEqual(build.pending, pending, 'build report differs from actual remaining work');
  assert.equal(build.complete, pending.length === 0, 'incorrect build completion flag');
  if (complete) assert.equal(pending.length, 0, 'final build is incomplete');
  return { baselineCatalogSha256: baseline.lock.catalogSha256, themes: perTheme.length, rebuilt: changed.length, originalAssetsPreserved, newAssetsVerified, unchangedManifests: perTheme.length - changed.length, pending, allChecksPassed: true, perTheme };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const value = (name) => args[args.indexOf(name) + 1];
    if (!args.includes('--dir')) throw Error('usage: --dir <staged-pack-dir> [--baseline <pinned-baseline>] [--complete] [--output <report.json>]');
    const report = verifyArtworkBuild({ dir: value('--dir'), baselineDir: args.includes('--baseline') ? value('--baseline') : undefined, complete: args.includes('--complete') });
    if (args.includes('--output')) { const output = resolve(value('--output')); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
    console.log(JSON.stringify({ ...report, perTheme: undefined, pending: report.pending.length }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
