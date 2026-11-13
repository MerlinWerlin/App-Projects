// Owner 2026-11-13 (build 74 TestFlight screenshot after a reinstall: all five Artwork badges on one
// piece, Alpine Starlight has five): the Artwork pieces (small plain art) are made first and saved as
// soon as they are all ready, so Artwork 1-5 fill before the designs and other sizes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeOrder, isArtworkPiece, type PlannedThemePiece } from './themeArtSync.ts';

const piece = (id: string, size: 'small' | 'medium' | 'large', live?: object): PlannedThemePiece =>
  ({ id, name: id, themeName: 'T', themeId: 't', source: 'theme', aspect: 1, size, slot: 0, optionId: id, ...(live ? { live } : {}), ...(size === 'small' && !live && id.startsWith('a') ? { artwork: true } : {}) }) as PlannedThemePiece;

test('composeOrder: small plain art first, everything else after, plan order kept in each group', () => {
  const todo = [piece('clock-s', 'small', { design: {} }), piece('art-l', 'large'), piece('a1', 'small'), piece('date-s', 'small', { kind: 'date' }), piece('a2', 'small'), piece('art-m', 'medium')];
  assert.deepEqual(composeOrder(todo).map((p) => p.id), ['a1', 'a2', 'clock-s', 'art-l', 'date-s', 'art-m']);
  assert.equal(todo.filter(isArtworkPiece).length, 2);
});

test('theme sync composes in composeOrder and saves once every Artwork piece is ready', () => {
  const src = readFileSync(join(process.cwd(), 'src', 'store', 'themeWidgetArt.ts'), 'utf8');
  assert.match(src, /const todo = composeOrder\(piecesToCompose\(lib, planned\)\);/);
  assert.match(src, /ready\.length === artworkCount/);
});

test('My widget art: Artwork 1-5 in order, a big number in the slot colour, no Remove', () => {
  // Owner 2026-11-13: "the numbers need to be larger and more clear and there needs to be no remove
  // options just the native art works to the theme".
  const list = readFileSync(join(process.cwd(), 'src', 'ui', 'WidgetArtLibraryList.tsx'), 'utf8');
  assert.match(list, /Array\.from\(\{ length: ARTWORK_SLOT_COUNT \}, \(_, i\) => \(\{ n: i \+ 1, p: list\[i % list\.length\] \}\)\)/);
  assert.match(list, /number: \{ width: NUMBER, height: NUMBER/);
  assert.match(list, /const THUMB = 132;/);
  assert.match(list, /numberText: \{ \.\.\.textV2\.largeTitle, fontWeight: '800' \}/);
  assert.doesNotMatch(list, /PillButton|ui\.seamless\.library\.remove|position: 'absolute'/);
});


// Owner 2026-11-13 ("remove them unless its the native ones"): the theme's pack art is small only.
import { THEME_PACK_ART_SIZES, planThemePieces } from './themeArtSync.ts';

test('theme pack art is planned in small only; the app art menu shows on the Small tab only', () => {
  assert.deepEqual([...THEME_PACK_ART_SIZES], ['small']);
  const option = { id: 'moon', kind: 'art', image: 'moon.webp', sizes: ['small', 'medium', 'large'], width: 1024, height: 1024 } as never;
  const planned = planThemePieces({ themeId: 't', themeName: 'T', options: [option], name: () => 'Moon', sizes: THEME_PACK_ART_SIZES });
  assert.deepEqual([...new Set(planned.map((p) => p.size))], ['small']);
  const store = readFileSync(join(process.cwd(), 'src', 'store', 'themeWidgetArt.ts'), 'utf8');
  assert.match(store, /sizes: THEME_PACK_ART_SIZES,/);
  const menu = readFileSync(join(process.cwd(), 'src', 'ui', 'ThemeWidgetArt.tsx'), 'utf8');
  assert.match(menu, /if \(!home \|\| home !== 'small'\) return null;/);
});
