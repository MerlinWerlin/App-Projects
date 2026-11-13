// Owner 2026-11-13 (1.0.27, Aurora): "the first artwork in My widget art is the DATE one ... It should
// be an artwork ... When I put down Artwork 1 it shows the mushroom. When I put down Artwork 5 it showed
// the date artwork (said October)". One ordered Artwork list of pure illustrations, written by the app
// at theme apply and read by both the app list and the widget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commitThemeArt, planThemePieces } from './themeArtSync.ts';
import { parseLibrary, serializeLibrary, type WidgetArtIndex } from './widgetArtLibrary.ts';
import { artworkPieces } from './artworkSlots.ts';

const opt = (id: string, kind: string) => ({ id, kind, image: `${id}.webp`, sizes: ['small', 'medium', 'large'], width: 1024, height: 1024 }) as never;

test('only kind "art" pieces with no live value are Artwork; date / calendar / clock / focus never', () => {
  const planned = planThemePieces({
    themeId: 'aurora-haven', themeName: 'Aurora', name: () => 'x', sizes: ['small'],
    options: [opt('aurora-date', 'calendar'), opt('snow-mushrooms', 'art'), opt('live-focus', 'focus'), opt('hero-small', 'art'), opt('live-clock', 'clock')],
  });
  assert.deepEqual(planned.filter((p) => p.artwork).map((p) => p.optionId), ['snow-mushrooms', 'hero-small']);
});

test('commitThemeArt writes the ordered artwork list; it survives a write and read; the app reads the same list', () => {
  const planned = planThemePieces({
    themeId: 'aurora-haven', themeName: 'Aurora', name: () => 'x', sizes: ['small'],
    options: [opt('aurora-date', 'calendar'), opt('snow-mushrooms', 'art'), opt('hero-small', 'art')],
  });
  const empty: WidgetArtIndex = { v: 1, pieces: [] };
  const { lib } = commitThemeArt(empty, 'aurora-haven', planned, planned.map((p) => p.id), 1000);
  const ids = planned.filter((p) => p.artwork).map((p) => p.id);
  assert.deepEqual(lib.artwork, ids);
  assert.ok(lib.pieces.every((p) => !('artwork' in p)), 'no stray flag on pieces');
  const back = parseLibrary(serializeLibrary(lib));
  assert.deepEqual(back.artwork, ids);
  assert.deepEqual(artworkPieces(back.pieces, 'aurora-haven', back.artwork ?? null).map((p) => p.id), ids);
});

test('the widget reads the same list (index.json artwork) before any fallback; one-time rebuild v6', () => {
  const W = (f: string) => readFileSync(join(process.cwd(), 'targets', 'widget', f), 'utf8');
  assert.match(W('WidgetArtLibrary.swift'), /let artwork = \(root\["artwork"\] as\? \[Any\]\)/);
  assert.match(W('ThemeArtWidgets.swift'), /if let list = snap\.artwork \{ return list\.filter \{ snap\.has\(\$0\) \} \}/);
  assert.match(readFileSync(join(process.cwd(), 'src', 'store', 'widgetArtRecovery.ts'), 'utf8'), /glaze\.widgetArt\.recovered106\.v6/);
});
