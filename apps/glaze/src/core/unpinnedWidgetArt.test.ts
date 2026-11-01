// T259: a Seamless widget with no piece chosen ("unpinned") follows the theme after a swap (the new
// theme's first piece for its size, else the theme's plain background) instead of the last applied
// image (possibly the old theme's art). A piece picked in Edit Widget is kept (T252 remap if removed).
// The app writes `unpinned` into index.json; the widget extension mirrors unpinnedChoice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commitThemeArt, piecesToCompose, planThemePieces } from './themeArtSync.ts';
import {
  addPiece,
  emptyLibrary,
  followTheme,
  migrateLibrary,
  parseLibrary,
  pinLastApplied,
  removeMany,
  replaceThemeArt,
  resolveWidgetPiece,
  serializeLibrary,
  themePieceId,
  unpinnedChoice,
  unpinnedPlan,
  type WidgetArtIndex,
} from './widgetArtLibrary.ts';
import type { WidgetOption } from './widgetOptions.ts';

const read = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');

const opt = (id: string, sizes: WidgetOption['sizes']): WidgetOption => ({
  id,
  kind: 'art',
  image: `${id}.png`,
  sizes,
  fit: 'fit',
  background: 'theme',
  label: id,
  width: sizes[0] === 'medium' ? 1092 : 510,
  height: 510,
  derived: false,
});

const apply = (lib: WidgetArtIndex, themeId: string, options: WidgetOption[], now: number): WidgetArtIndex => {
  const planned = planThemePieces({ themeId, themeName: themeId, options, name: (o, s) => `${o.id} · ${s}` });
  const todo = piecesToCompose(lib, planned);
  return commitThemeArt(lib, themeId, planned, todo.map((p) => p.id), now).lib;
};

// Theme A has small + medium art; theme B has small art only (no medium piece).
const A = [opt('moon', ['small', 'medium']), opt('owl', ['small'])];
const B = [opt('sun', ['small']), opt('wave', ['small'])];

test('swap: every size of an unpinned widget follows the new theme (first piece, else plain background)', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  // First apply from no theme is a swap too: unpinned widgets follow theme A.
  assert.deepEqual(a.unpinned, { small: themePieceId('a', 'moon', 'small'), medium: themePieceId('a', 'moon', 'medium'), large: null });
  const b = apply(a, 'b', B, 2000);
  assert.deepEqual(b.unpinned, { small: themePieceId('b', 'sun', 'small'), medium: null, large: null });
  assert.deepEqual(unpinnedChoice(b, 'small'), { show: 'piece', id: themePieceId('b', 'sun', 'small') });
  // B has no medium: the plain background, never A's medium (the old theme's last applied image).
  assert.deepEqual(unpinnedChoice(b, 'medium'), { show: 'background' });
  assert.deepEqual(unpinnedChoice(b, 'large'), { show: 'background' });
});

test('a piece picked in Edit Widget keeps its pick; a removed pick uses the T252 remap, not unpinned', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  const owl = themePieceId('a', 'owl', 'small');
  const b = apply(a, 'b', B, 2000);
  // Picked owl (slot 1, small) was removed by the swap: same slot of B (wave), not B's first (sun).
  assert.equal(resolveWidgetPiece(b, owl, 'small'), themePieceId('b', 'wave', 'small'));
  // A pick that is still in the library (own photo) stays.
  const withPhoto = addPiece(b, { id: 'p-1', name: 'Me', themeName: '', themeId: null, source: 'photo', created: 3000, aspect: 1, size: null }).lib;
  assert.equal(resolveWidgetPiece(withPhoto, 'p-1', 'small'), 'p-1');
});

test('same theme re-applied / resumed: following sizes refreshed, sizes showing the last applied image kept', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  // "Use on my widget" wrote seamless-medium.png: medium shows that image again.
  const pinned = pinLastApplied(a, 'medium');
  assert.ok(pinned);
  assert.deepEqual(pinned.unpinned, { small: themePieceId('a', 'moon', 'small'), large: null });
  assert.deepEqual(unpinnedChoice(pinned, 'medium'), { show: 'lastApplied' });
  const again = apply(pinned, 'a', A, 5000);
  assert.deepEqual(again.unpinned, pinned.unpinned, 'a re-apply is not a swap');
  // Nothing to change = no index write.
  assert.equal(pinLastApplied(again, 'medium'), null);
  assert.equal(pinLastApplied(emptyLibrary(), 'small'), null);
  assert.equal(pinLastApplied(again, null), null);
  // A later swap makes medium follow again.
  assert.deepEqual(apply(again, 'b', B, 6000).unpinned?.medium, null);
  assert.deepEqual(unpinnedChoice(apply(again, 'b', B, 6000), 'medium'), { show: 'background' });
});

test('an interrupted first run (piece not made) shows the background, the completing run follows the piece', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  const planned = planThemePieces({ themeId: 'b', themeName: 'b', options: B, name: (o, s) => `${o.id} · ${s}` });
  const partial = commitThemeArt(a, 'b', planned, [], 2000).lib; // nothing composed
  assert.deepEqual(partial.unpinned, { small: null, medium: null, large: null });
  assert.deepEqual(unpinnedChoice(partial, 'small'), { show: 'background' });
  const done = apply(partial, 'b', B, 3000);
  assert.deepEqual(done.unpinned?.small, themePieceId('b', 'sun', 'small'));
});

test('legacy index (no unpinned): last applied image, as before; clean-up migration does not start following', () => {
  const legacy = parseLibrary(JSON.stringify({ v: 1, pieces: [], currentThemeId: 'a' }));
  assert.equal(legacy.unpinned, undefined);
  assert.deepEqual(unpinnedChoice(legacy, 'small'), { show: 'lastApplied' });
  const m = migrateLibrary(parseLibrary(JSON.stringify({ v: 1, pieces: [] })), 'a');
  assert.ok(m.ran);
  assert.equal(m.lib.unpinned, undefined);
});

test('T238 replace path (replaceThemeArt) follows the theme on a swap too', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  const r = replaceThemeArt(a, 'b').lib; // B's pieces not made yet
  assert.deepEqual(r.unpinned, { small: null, medium: null, large: null });
  const same = replaceThemeArt(a, 'a').lib;
  assert.deepEqual(same.unpinned, a.unpinned);
});

test('a followed piece removed by Manage resolves to the theme’s same size, else the background', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  const moonS = themePieceId('a', 'moon', 'small');
  const r = removeMany(a, [moonS]).lib;
  assert.deepEqual(unpinnedChoice(r, 'small'), { show: 'piece', id: themePieceId('a', 'owl', 'small') });
  const none = removeMany(a, a.pieces.map((p) => p.id)).lib;
  assert.deepEqual(unpinnedChoice(none, 'small'), { show: 'background' });
});

test('unpinned round-trips through index.json; junk is dropped', () => {
  const a = apply(emptyLibrary(), 'a', A, 1000);
  assert.deepEqual(parseLibrary(serializeLibrary(a)).unpinned, a.unpinned);
  const raw = JSON.stringify({ v: 1, pieces: [], unpinned: { small: 'ok-id', medium: 'bad id!', large: null, xl: 'x' } });
  assert.deepEqual(parseLibrary(raw).unpinned, { small: 'ok-id', large: null });
  assert.equal(parseLibrary(JSON.stringify({ v: 1, pieces: [], unpinned: [1] })).unpinned, undefined);
  assert.equal(JSON.parse(serializeLibrary(emptyLibrary())).unpinned, undefined);
});

test('unpinnedPlan / followTheme basics', () => {
  assert.deepEqual(unpinnedPlan(emptyLibrary()), { small: null, medium: null, large: null });
  // No current theme before or after, nothing following: nothing written.
  assert.equal(followTheme(emptyLibrary(), emptyLibrary()).unpinned, undefined);
});

test('wiring: adapter pins the last applied image on every seamless write; the extension mirrors unpinnedChoice', () => {
  const adapter = strip(read('src', 'native', 'widgets.ts'));
  // setSeamless + setWidgetArt (Use on my widget, Seamless setup) → unpinned widgets show that file.
  assert.equal(adapter.match(/if \(res\.ok\) await showLastApplied\(input\.size\);/g)?.length, 2);
  assert.match(adapter, /editArtIndex\(\(lib\) => pinLastApplied\(lib, size\)\)/);
  assert.match(adapter, /pinLastApplied\(next\.lib, size\)/);

  const lib = strip(read('targets', 'widget', 'WidgetArtLibrary.swift'));
  assert.match(lib, /root\["unpinned"\] as\? \[String: Any\]/);
  assert.match(lib, /value is NSNull/);
  assert.match(lib, /func unpinnedChoice\(_ size: String\?\) -> UnpinnedChoice \{/);
  assert.match(lib, /if let id = resolve\(want, preferSize: size\) \{ return \.piece\(id\) \}/);
  // No chosen piece: the timeline uses the followed piece.
  assert.match(lib, /guard id != nil else \{\s*if case \.piece\(let follow\) = snapshot\(\)\.unpinnedChoice\(size\) \{ return follow \}/);
  const seamless = strip(read('targets', 'widget', 'SeamlessWidget.swift'));
  assert.equal(seamless.match(/if WidgetArtStore\.unpinnedShowsBackground\(family\) \{ return nil \}/g)?.length, 2, 'load + loadArt');
  const live = strip(read('targets', 'widget', 'LiveArtOverlay.swift'));
  assert.match(live, /if WidgetArtStore\.unpinnedShowsBackground\(family\) \{ return nil \}/);
  // Swift rules: no force unwraps / try! / fatalError in the touched extension files.
  for (const src of [lib, seamless, live]) {
    assert.doesNotMatch(src, /try!|fatalError\(/);
  }
});
