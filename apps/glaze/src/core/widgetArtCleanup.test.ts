// T238 (owner-1101g #6): "My widget art" clean-up: replace on theme apply, one-time migration,
// Manage (delete selected / clear all), widget fallback. Logic in widgetArtLibrary.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  WIDGET_ART_MIGRATION,
  clearAll,
  emptyLibrary,
  fallbackPiece,
  listPieces,
  migrateLibrary,
  parseLibrary,
  removeMany,
  removePiece,
  replaceThemeArt,
  serializeLibrary,
  addPiece,
  type WidgetArtIndex,
  type WidgetArtPiece,
} from './widgetArtLibrary.ts';

const read = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');

const p = (id: string, created: number, extra: Partial<WidgetArtPiece> = {}): WidgetArtPiece => ({
  id,
  name: id,
  themeName: 'T',
  themeId: 'a',
  source: 'theme',
  file: `${id}.jpg`,
  created,
  aspect: 1,
  size: 'small',
  ...extra,
});

const lib = (...pieces: WidgetArtPiece[]): WidgetArtIndex => ({ v: 1, pieces });
const ids = (l: WidgetArtIndex): string[] => listPieces(l).map((x) => x.id);

test('replaceThemeArt keeps own photos + the new theme, removes other auto-added art', () => {
  const l = lib(
    p('a1', 1),
    p('b1', 2, { themeId: 'b' }),
    p('b2', 3, { themeId: 'b', size: 'medium' }),
    p('photo', 4, { source: 'photo', themeId: null, themeName: '', size: null }),
    p('old', 0, { themeId: null }),
  );
  const r = replaceThemeArt(l, 'b');
  assert.deepEqual(ids(r.lib), ['photo', 'b2', 'b1']);
  assert.deepEqual([...r.remove].sort(), ['a1', 'old']);
  assert.deepEqual([...r.keep].sort(), ['b1', 'b2', 'photo']);
  assert.equal(r.lib.currentThemeId, 'b');
});

test('replaceThemeArt with no theme drops every auto-added piece but never a photo', () => {
  const r = replaceThemeArt(lib(p('a1', 1), p('ph', 2, { source: 'photo', themeId: null })), null);
  assert.deepEqual(ids(r.lib), ['ph']);
  assert.equal(r.lib.currentThemeId, undefined);
});

test('index from an older version (no source) counts as auto-added', () => {
  const parsed = parseLibrary(JSON.stringify({ v: 1, pieces: [{ id: 'x', created: 1 }, { id: 'y', created: 2, source: 'photo' }] }));
  const r = migrateLibrary(parsed, 'cur');
  assert.deepEqual(ids(r.lib), ['y']);
  assert.deepEqual(r.remove, ['x']);
});

test('migrateLibrary runs once (flag in index.json survives a round trip)', () => {
  const l = lib(p('a1', 1), p('b1', 2, { themeId: 'b' }), p('ph', 3, { source: 'photo', themeId: null }));
  const first = migrateLibrary(l, 'a');
  assert.equal(first.ran, true);
  assert.deepEqual(ids(first.lib), ['ph', 'a1']);
  assert.equal(first.lib.migrated, WIDGET_ART_MIGRATION);
  const back = parseLibrary(serializeLibrary(first.lib));
  assert.equal(back.migrated, WIDGET_ART_MIGRATION);
  assert.equal(back.currentThemeId, 'a');
  // Later art from another theme is NOT swept by the migration again (replace handles it).
  const later = addPiece(back, { ...p('b9', 9, { themeId: 'b' }) }).lib;
  const second = migrateLibrary(later, 'a');
  assert.equal(second.ran, false);
  assert.deepEqual(second.remove, []);
  assert.deepEqual(ids(second.lib), ids(later));
});

test('migrateLibrary without a known theme keeps the newest auto-added theme', () => {
  const l = lib(p('a1', 1), p('b1', 5, { themeId: 'b' }), p('ph', 9, { source: 'photo', themeId: null }));
  assert.deepEqual(ids(migrateLibrary(l, null).lib), ['ph', 'b1']);
  // An index that already names its current theme uses it.
  assert.deepEqual(ids(migrateLibrary({ ...l, currentThemeId: 'a' }, null).lib), ['ph', 'a1']);
  // Fresh install: nothing to remove, flag still set.
  const empty = migrateLibrary(emptyLibrary(), null);
  assert.equal(empty.ran, true);
  assert.equal(empty.lib.migrated, WIDGET_ART_MIGRATION);
});

test('removeMany / clearAll / removePiece keep the index metadata', () => {
  const l: WidgetArtIndex = { ...lib(p('a', 1), p('b', 2), p('c', 3)), currentThemeId: 'a', migrated: WIDGET_ART_MIGRATION };
  const r = removeMany(l, ['a', 'c', 'nope']);
  assert.deepEqual(ids(r.lib), ['b']);
  assert.deepEqual(r.remove, ['a', 'c']);
  assert.equal(r.lib.currentThemeId, 'a');
  const c = clearAll(l);
  assert.deepEqual(c.lib.pieces, []);
  assert.deepEqual([...c.remove].sort(), ['a', 'b', 'c']);
  assert.equal(c.lib.migrated, WIDGET_ART_MIGRATION);
  assert.equal(removePiece(l, 'a').migrated, WIDGET_ART_MIGRATION);
  assert.equal(addPiece(l, p('d', 4)).lib.currentThemeId, 'a');
});

test('serializeLibrary only writes valid metadata', () => {
  const out = JSON.parse(serializeLibrary({ v: 1, pieces: [], currentThemeId: null, migrated: 0 }));
  assert.deepEqual(Object.keys(out).sort(), ['pieces', 'v']);
  const bad = parseLibrary(JSON.stringify({ v: 1, pieces: [], currentThemeId: 7, migrated: 'x' }));
  assert.equal(bad.currentThemeId, undefined);
  assert.equal(bad.migrated, undefined);
});

test('fallbackPiece: current theme newest piece, preferring the widget size', () => {
  const l: WidgetArtIndex = {
    ...lib(p('a-s', 1), p('a-m', 2, { size: 'medium' }), p('b', 5, { themeId: 'b' }), p('ph', 9, { source: 'photo', themeId: 'a' })),
    currentThemeId: 'a',
  };
  assert.equal(fallbackPiece(l)?.id, 'a-m');
  assert.equal(fallbackPiece(l, 'small')?.id, 'a-s');
  assert.equal(fallbackPiece(l, 'large')?.id, 'a-m');
  assert.equal(fallbackPiece({ ...l, currentThemeId: undefined }), null);
});

test('wiring: adapter, theme apply, widget fallback and Manage UI', () => {
  const adapter = read('src', 'native', 'widgets.ts');
  assert.match(adapter, /replaceThemeArt\(/);
  assert.match(adapter, /migrateLibrary\(/);
  assert.match(adapter, /removeManyFromArtLibrary/);
  assert.match(adapter, /clearArtLibrary/);
  const apply = read('src', 'store', 'activeTheme.ts');
  // T252: the apply now adds ALL the theme's art and replaces the previous theme's in one write.
  assert.match(apply, /syncThemeWidgetArt\(theme\)/);
  const swift = read('targets', 'widget', 'WidgetArtLibrary.swift');
  assert.match(swift, /"currentThemeId"/);
  assert.match(swift, /fallbackID\(/);
  const ui = read('src', 'ui', 'WidgetArtLibraryList.tsx');
  assert.match(ui, /Alert\.alert/);
  assert.match(ui, /accessibilityRole="checkbox"/);
  assert.match(ui, /clearArtLibrary\(\)/);
});
