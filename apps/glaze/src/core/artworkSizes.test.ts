// Owner 2026-11-27 ("2 of each [medium and large] for each theme ... make the number scheme for the
// galary increase and possibly custom for large and medium as well"): Artwork 6-7 (medium) and 8-9
// (large) from the pack's own medium / large art, Custom 6-9 beside them, and a 1.0.45 update that
// keeps every small widget and Custom 1-5 picture as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { artworkListOf, artworkPieces } from './artworkSlots.ts';
import { ARTWORK_ONLY_SIZES, THEME_PACK_ART_SIZES, commitThemeArt, planThemePieces } from './themeArtSync.ts';
import { emptyLibrary, parseLibrary, serializeLibrary, type WidgetArtIndex } from './widgetArtLibrary.ts';

const R = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8').replace(/\r\n/g, '\n');

const opt = (id: string, sizes: string[], w: number, h: number, kind = 'art') => ({ id, kind, image: `${id}.webp`, sizes, width: w, height: h, fit: 'fit', background: 'wallpaper' }) as never;
const OPTIONS = [
  opt('moon', ['small', 'medium', 'large'], 1024, 1024),
  opt('owl', ['small'], 1024, 1024),
  opt('medium-comet', ['medium'], 1092, 510),
  opt('medium-meteor', ['medium'], 1092, 510),
  opt('large-nebula', ['large'], 1092, 1146),
  opt('large-pleiades', ['large'], 1092, 1146),
  opt('clock-m', ['medium'], 1092, 510, 'clock'),
];
const plan = () => planThemePieces({ themeId: 'alpine', themeName: 'Alpine', options: OPTIONS, name: () => 'x', sizes: THEME_PACK_ART_SIZES, artworkOnly: ARTWORK_ONLY_SIZES });

test('a theme with 2 medium + 2 large art pieces plans Artwork 6-7 and 8-9 from exactly those', () => {
  const planned = plan();
  const by = (size: string) => planned.filter((p) => p.size === size && p.artwork).map((p) => p.optionId);
  assert.deepEqual(by('small'), ['moon', 'owl']);
  assert.deepEqual(by('medium'), ['medium-comet', 'medium-meteor']);
  assert.deepEqual(by('large'), ['large-nebula', 'large-pleiades']);
  // No clock / live picture and no square small piece in medium / large.
  assert.ok(!planned.some((p) => p.size !== 'small' && (p.optionId === 'clock-m' || p.optionId === 'moon')));
});

test('the commit writes one ordered list per size; the index keeps them through a save and read', () => {
  const planned = plan();
  const { lib } = commitThemeArt(emptyLibrary(), 'alpine', planned, planned.map((p) => p.id), 1000);
  assert.deepEqual(lib.artwork, ['t-alpine-moon-small', 't-alpine-owl-small']);
  assert.deepEqual(lib.artworkMedium, ['t-alpine-medium-comet-medium', 't-alpine-medium-meteor-medium']);
  assert.deepEqual(lib.artworkLarge, ['t-alpine-large-nebula-large', 't-alpine-large-pleiades-large']);
  const back = parseLibrary(serializeLibrary(lib));
  for (const size of ['small', 'medium', 'large'] as const) {
    assert.deepEqual(artworkListOf(back, size), artworkListOf(lib, size));
    assert.equal(artworkPieces(back.pieces, 'alpine', artworkListOf(back, size), size).length, 2);
  }
  // A theme without medium / large art drops the old lists (no stale Artwork 6-9 from the last theme).
  const small = planThemePieces({ themeId: 'plain', themeName: 'P', options: [OPTIONS[1]], name: () => 'x', sizes: THEME_PACK_ART_SIZES, artworkOnly: ARTWORK_ONLY_SIZES });
  const next = commitThemeArt(lib, 'plain', small, small.map((p) => p.id), 2000).lib;
  assert.equal(next.artworkMedium, undefined);
  assert.equal(next.artworkLarge, undefined);
});

test('an index from 1.0.44 (no medium / large lists) still reads: small Artwork unchanged, 6-9 fall back', () => {
  const old: WidgetArtIndex = parseLibrary(JSON.stringify({
    v: 1, currentThemeId: 'alpine', artwork: ['t-alpine-moon-small'],
    pieces: [{ id: 't-alpine-moon-small', name: 'Moon', file: 't-alpine-moon-small.jpg', created: 1, size: 'small', themeId: 'alpine', source: 'theme', slot: 0 }],
  }));
  assert.deepEqual(old.artwork, ['t-alpine-moon-small']);
  assert.equal(artworkListOf(old, 'medium'), null);
  assert.deepEqual(artworkPieces(old.pieces, 'alpine', null, 'medium'), []);
});

test('the 1.0.45 update: one additive sync, never a reset; Custom pictures are a separate store', () => {
  const rec = R('src', 'store', 'widgetArtRecovery.ts');
  assert.match(rec, /export const ARTWORK_SIZES_KEY = 'glaze\.widgetArt\.sizes1045\.v1';/);
  const add = rec.slice(rec.indexOf('async function addArtworkSizes'), rec.indexOf('export function prepareWidgetArtRecovery'));
  assert.doesNotMatch(add, /resetArtForRecovery/);
  assert.match(add, /syncThemeWidgetArt\(theme\)/);
  assert.match(add, /remoteArtOnDevice\(id\)/, 'never syncs a theme whose pack is missing');
  assert.match(rec, /if \(await AsyncStorage\.getItem\(RECOVERY_KEY\) === 'complete'\) return await addArtworkSizes\(\);/);
  // Custom slots keep their "1".."5" keys and files: the store is only widened.
  const bridge = R('modules', 'glaze-widget-bridge', 'ios', 'CustomArtSlots.swift');
  assert.match(bridge, /let name = "\\\(slot\)-\\\(UUID\(\)\.uuidString\.lowercased\(\)\)\.jpg"/);
  assert.match(bridge, /\(1\.\.\.slotCount\)\.contains\(n\)/);
});
