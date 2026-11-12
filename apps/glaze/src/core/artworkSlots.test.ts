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

test('Artwork widgets: numbered names, small only, five in the gallery', () => {
  assert.ok(code.includes('.configurationDisplayName("Artwork \\(slot)")'), 'Artwork n name');
  assert.match(code, /\.supportedFamilies\(\[\.systemSmall\]\)/);
  assert.doesNotMatch(code, /systemMedium|systemLarge/);
  assert.match(code, /static let gallerySmallSlots = 5/);
  assert.match(code, /slot > gallerySmallSlots \? \[\.systemSmall\] : \[\]/);
  for (const lang of ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans']) {
    assert.match(W(`${lang}.lproj/Localizable.strings`), /^"Artwork %lld" = ".*%lld.*";$/m, lang);
  }
});

test('Artwork n: small plain art (no live pictures, no designs), cycling so no slot is blank', () => {
  const pieces = code.slice(code.indexOf('static func pieces(family:'), code.indexOf('static func piece(slot:'));
  assert.match(pieces, /\$0\.size == "small" && !\$0\.design/);
  assert.match(pieces, /small\.filter \{ !\$0\.live \}/);
  assert.match(pieces, /\(art\.isEmpty \? small : art\)/);
  const piece = code.slice(code.indexOf('static func piece(slot:'), code.indexOf('struct ThemeArtEntry'));
  assert.match(piece, /list\[\(slot - 1\) % list\.count\]/);
  assert.match(W('WidgetArtLibrary.swift'), /live: LiveArtSpec\.parse\(p\["live"\]\) != nil/);
});

test('cycling model: every slot 1-5 gets a piece for any theme with 1-5 pieces', () => {
  const piece = (slot: number, list: string[]) => (slot >= 1 && list.length ? list[(slot - 1) % list.length] : null);
  for (let n = 1; n <= 5; n++) {
    const list = Array.from({ length: n }, (_, i) => `p${i + 1}`);
    for (let s = 1; s <= 5; s++) assert.equal(piece(s, list), `p${((s - 1) % n) + 1}`);
  }
  assert.equal(piece(1, []), null);
});
