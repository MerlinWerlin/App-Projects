// Owner 2026-11-12 ("singular themes need to be like art work 1 art work 2 etc. ... just be all small
// arts"): the theme art widgets are "Artwork 1" to "Artwork 5", small only. Artwork n is the current
// theme's n-th small plain art piece, cycling when the theme has fewer, so no slot is ever blank.
// The Add Widget gallery stays generic (galleryGenericPreviews.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const W = (f: string) => readFileSync(join(process.cwd(), 'targets', 'widget', f), 'utf8').replace(/\r\n/g, '\n');
const slots = W('ThemeArtWidgets.swift');
const code = slots.replace(/^\s*\/\/.*$/gm, '');

// Owner 2026-11-27: the numbers go on up through the sizes: 1-5 small, 6-7 medium, 8-9 large.
test('Artwork widgets: numbered names 1-9, small 1-5, medium 6-7, large 8-9, all in the gallery', () => {
  // Owner 2026-11-13: six fixed localised names, never an interpolated display name.
  assert.ok(code.includes('.configurationDisplayName(displayName(slot: slot))'), 'Artwork n name');
  assert.ok(!code.includes('configurationDisplayName("Artwork \\('), 'no interpolated display name');
  for (let n = 1; n <= 9; n++) {
    assert.ok(code.includes(`return "Artwork ${n}"`), `Artwork ${n}`);
    for (const lang of ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans']) {
      assert.ok(W(`${lang}.lproj/Localizable.strings`).split(/\r?\n/).some((l) => l.startsWith(`"Artwork ${n}" = "`)), `${lang} Artwork ${n}`);
    }
  }
  assert.match(code, /\.supportedFamilies\(\[family\]\)/);
  assert.match(code, /if legacy \|\| slot <= 5 \{ return \(\.systemSmall, slot\) \}\s*if slot <= 7 \{ return \(\.systemMedium, slot - 5\) \}\s*return \(\.systemLarge, slot - 7\)/);
  assert.match(code, /static let gallerySmallSlots = 5/);
  // The same table as the app.
  assert.deepEqual(ARTWORK_GROUPS.map((g) => [g.size, g.first, g.count]), [['small', 1, 5], ['medium', 6, 2], ['large', 8, 2]]);
  assert.deepEqual([1, 5, 6, 7, 8, 9, 10].map(sizeOfArtworkNumber), ['small', 'small', 'medium', 'medium', 'large', 'large', null]);
  assert.deepEqual(artworkNumbersOf('medium'), [6, 7]);
  assert.deepEqual(artworkNumbersOf('large'), [8, 9]);
  for (const lang of ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans']) {
    assert.match(W(`${lang}.lproj/Localizable.strings`), /^"Artwork %lld" = ".*%lld.*";$/m, lang);
  }
});

test('Artwork n: plain art of its size (no live pictures, no designs); past the count the theme design, never a repeat', () => {
  const pieces = code.slice(code.indexOf('static func pieces(family:'), code.indexOf('static func piece(slot:'));
  assert.match(pieces, /snap\.artworkList\(size: size\)/);
  assert.match(pieces, /\$0\.size == size && !\$0\.design/);
  assert.match(pieces, /mine\.filter \{ !\$0\.live \}/);
  assert.match(pieces, /\(art\.isEmpty \? mine : art\)/);
  const piece = code.slice(code.indexOf('static func piece(slot:'), code.indexOf('struct ThemeArtEntry'));
  // 1.0.39: no cycling; nil draws ThemedFallbackArt in the theme's colours.
  assert.match(piece, /guard slot >= 1, slot <= list\.count else \{ return nil \}\s*return list\[slot - 1\]/);
  assert.doesNotMatch(piece, /% list\.count/);
  assert.match(W('WidgetArtLibrary.swift'), /live: LiveArtSpec\.parse\(p\["live"\]\) != nil/);
});

test('slot model (1.0.39): slot n shows piece n once; slots past the count show the theme design (nil)', () => {
  const piece = (slot: number, list: string[]) => (slot >= 1 && slot <= list.length ? list[slot - 1] : null);
  for (let n = 0; n <= 5; n++) {
    const list = Array.from({ length: n }, (_, i) => `p${i + 1}`);
    const shown = [1, 2, 3, 4, 5].map((s) => piece(s, list));
    assert.deepEqual(shown, [1, 2, 3, 4, 5].map((s) => (s <= n ? `p${s}` : null)));
    const real = shown.filter(Boolean);
    assert.equal(new Set(real).size, real.length, 'never the same piece twice');
  }
});

// Owner 2026-11-12 ("like colour code them"): one colour per slot, the same in the widget and the app.
import { ARTWORK_GROUPS, ARTWORK_SLOT_COLOURS, artworkNumbers, artworkNumbersOf, artworkSlotColour, sizeOfArtworkNumber } from './artworkSlots.ts';
import type { WidgetArtPiece } from './widgetArtLibrary.ts';

test('slot colours: the widget table equals the app table, nine distinct colours', () => {
  const swift = [...slots.matchAll(/\("(#[0-9A-F]{6})", "(#[0-9A-F]{6})"\)/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(swift, ARTWORK_SLOT_COLOURS.map((c) => [c.fill, c.ink]));
  assert.equal(new Set(ARTWORK_SLOT_COLOURS.map((c) => c.fill)).size, 9);
  assert.equal(artworkSlotColour(1).name, 'coral');
  assert.equal(artworkSlotColour(4).name, 'blue');
});

test('slot colours: the number on each colour is readable (contrast >= 3:1, large bold text)', () => {
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  for (const c of ARTWORK_SLOT_COLOURS) {
    const [a, b] = [lum(c.fill), lum(c.ink)].sort((x, y) => y - x);
    assert.ok((a + 0.05) / (b + 0.05) >= 3, `${c.name} ${((a + 0.05) / (b + 0.05)).toFixed(2)}`);
  }
});

test('gallery Artwork tiles: the slot colour and a big number, never theme art', () => {
  const view = code.slice(code.indexOf('struct ThemeArtSlotView'), code.indexOf('enum ThemeArtKind'));
  assert.match(view, /if entry\.preview \{\n\s*ArtworkSlotTile\(slot: entry\.sample \+ 1\)/);
  const tile = code.slice(code.indexOf('struct ArtworkSlotTile'), code.indexOf('struct ThemeArtEntry'));
  assert.ok(tile.includes('Text(verbatim: "\\(slot)")'));
  assert.doesNotMatch(tile, /ThemeStore|WidgetArtStore|UIImage/);
});

test('app numbering matches the widget: current theme, small plain art in shelf order, one slot each', () => {
  const p = (id: string, o: Partial<WidgetArtPiece>): WidgetArtPiece => ({ id, name: id, themeName: 'T', themeId: 't', source: 'theme', file: `${id}.jpg`, created: 1, aspect: 1, size: 'small', ...o });
  const pieces = [
    p('b', { slot: 1 }), p('a', { slot: 0 }), p('clock', { slot: 2, live: { kind: 'clock' } as never }),
    p('large', { size: 'large', slot: 0 }), p('other', { themeId: 'x', slot: 0 }), p('photo', { source: 'photo', themeId: null }),
  ];
  const n = artworkNumbers(pieces, 't');
  assert.deepEqual(Object.fromEntries(n), { a: [1], b: [2] });
  assert.equal(artworkNumbers(pieces, null).size, 0);
  // No plain art: the other small pictures fill the slots.
  assert.deepEqual(Object.fromEntries(artworkNumbers([pieces[2]], 't')), { clock: [1] });
  // The art list shows the badges.
  const list = readFileSync(join(process.cwd(), 'src', 'ui', 'WidgetArtLibraryList.tsx'), 'utf8');
  assert.match(list, /artworkPieces\(pieces, activeThemeId, artwork\[g\.size\], g\.size\)/);
  assert.match(list, /backgroundColor: col\.fill/);
  assert.match(list, /t\('ui\.seamless\.library\.artworkA11y', \{ n \}\)/);
});

// Owner 2026-11-13 (build 74: the gallery tiles "do not correspsone"): iOS kept the older gallery
// previews of the GlazeThemeArt kinds, so Artwork 1-5 are fresh kinds with no stored preview.
test('gallery Artwork 1-5 are fresh kinds; the old GlazeThemeArt kinds stay registered but leave the gallery', () => {
  assert.ok(code.includes('legacy ? "GlazeThemeArt\\(slot)" : "GlazeArtwork\\(slot)"'), 'kind names');
  assert.match(code, /\.disfavoredLocations\(\[\.homeScreen\], for: legacy \? \[\.systemSmall\] : galleryHidden\(slot: slot\)\)/);
  for (let i = 1; i <= 9; i++) assert.ok(code.includes(`struct ArtworkWidget${i}: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: ${i}) } }`), `ArtworkWidget${i}`);
  for (let i = 1; i <= 6; i++) assert.ok(code.includes(`struct ThemeArtWidget${i}: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: ${i}, legacy: true) } }`), `ThemeArtWidget${i}`);
  const art = code.slice(code.indexOf('struct GlazeThemeArtBundle'));
  assert.deepEqual([...art.matchAll(/(ArtworkWidget\d)\(\)/g)].map((m) => m[1]), [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `ArtworkWidget${i}`));
  assert.doesNotMatch(art, /WidgetBundle \{[^}]*\.body/, 'Artwork 1-9 listed directly (9 entries)');
  const legacy = W('GlazeWidgetsBundle.swift');
  for (let i = 1; i <= 6; i++) assert.ok(legacy.split(/\r?\n/).some((l) => l.trim() === `ThemeArtWidget${i}()`), `legacy ThemeArtWidget${i}`);
});
