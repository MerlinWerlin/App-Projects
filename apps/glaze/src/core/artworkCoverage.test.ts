// Owner 2026-11-14 ("that cant happen on other themes as well"): every published pack fills Artwork
// 1-5 with real pieces. scripts/packs/artwork-coverage.json is written by
// scripts/packs/artwork-coverage.mjs from each pack's latest manifest (CI re-checks it when packs change).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTWORK_SLOTS, artworkSlotSources, plannedArtworkOptionIds } from './artworkCoverage.ts';
import { parseWidgetOptions } from './widgetOptions.ts';

const coverage = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'packs', 'artwork-coverage.json'), 'utf8'));
const releases = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'packs', 'releases.json'), 'utf8'));

test('every published pack is checked and has at least one pure artwork', () => {
  assert.deepEqual(Object.keys(coverage.perTheme).sort(), Object.keys(releases).sort());
  assert.deepEqual(coverage.problems, []);
  for (const [id, t] of Object.entries(coverage.perTheme) as [string, { manifest: string | null; artwork: string[] }][]) {
    assert.ok(t.manifest, `${id}: manifest found`);
    assert.ok(t.artwork.length >= 1, `${id}: has pure artwork`);
    assert.equal(new Set(t.artwork).size, t.artwork.length, `${id}: no duplicate pieces`);
  }
});

test('Artwork 1-5 always resolve to a real piece for every pack (repeats only when a pack has fewer)', () => {
  for (const [id, t] of Object.entries(coverage.perTheme) as [string, { artwork: string[] }][]) {
    const slots = artworkSlotSources(t.artwork);
    assert.equal(slots.length, ARTWORK_SLOTS);
    for (const s of slots) assert.ok(s.piece && s.source !== 'fallback', `${id} Artwork ${s.slot}`);
  }
});

test('a theme with no artwork (or a pack still downloading) gets the fallback scene, never a blank', () => {
  assert.deepEqual(artworkSlotSources([]).map((s) => s.source), ['fallback', 'fallback', 'fallback', 'fallback', 'fallback']);
  const swift = readFileSync(join(process.cwd(), 'targets', 'widget', 'ThemeArtWidgets.swift'), 'utf8');
  assert.match(swift, /ThemedFallbackArt\(theme: entry\.theme, variant: entry\.sample\)/);
});

test('the pure-artwork rule on an Aurora-style pack: illustrations only, never date / focus / clock pictures', () => {
  const asset = (path: string) => ({ path, role: 'widget-art', width: 1024, height: 1024 });
  const widgets = [
    { id: 'aurora-date', kind: 'calendar', image: 'd.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur' },
    { id: 'snow-mushrooms', kind: 'art', image: 's.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur' },
    { id: 'live-focus', kind: 'focus', image: 'f.webp', sizes: ['small'], fit: 'fit', background: 'theme', numberFree: true, liveFrame: { rect: [0.2, 0.2, 0.6, 0.6], shape: 'circle' } },
    { id: 'live-clock', kind: 'clock', image: 'c.webp', sizes: ['small'], fit: 'fit', background: 'theme', numberFree: true, liveFrame: { rect: [0.18, 0.18, 0.64, 0.64], shape: 'circle' } },
  ];
  const parsed = parseWidgetOptions(widgets, ['d.webp', 's.webp', 'f.webp', 'c.webp'].map(asset));
  const options = (parsed as { options?: unknown }).options ?? parsed;
  assert.deepEqual(plannedArtworkOptionIds('aurora-haven', options as never), ['snow-mushrooms']);
});
