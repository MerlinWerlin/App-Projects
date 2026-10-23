// T90: glyph picker count line and Monogram letters field visibility.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { glyphCountLine, showMonogramLetters } from './glyphPicker.ts';
import { matchesMonogramQuery } from './monogramSearch.ts';

test('only the Monogram cell matches: "1 match", not "0 symbols" or "no symbols"', () => {
  assert.deepEqual(glyphCountLine({ glyphCount: 0, monogramShown: true, limit: 120 }), { kind: 'matches', count: 1 });
});

test('nothing matches: the no-symbols line', () => {
  assert.deepEqual(glyphCountLine({ glyphCount: 0, monogramShown: false, limit: 120 }), { kind: 'none' });
});

test('glyphs match: symbol count, with or without the Monogram cell', () => {
  assert.deepEqual(glyphCountLine({ glyphCount: 1, monogramShown: false, limit: 120 }), { kind: 'symbols', count: 1 });
  assert.deepEqual(glyphCountLine({ glyphCount: 12, monogramShown: true, limit: 120 }), { kind: 'symbols', count: 12 });
  assert.deepEqual(glyphCountLine({ glyphCount: 120, monogramShown: true, limit: 120 }), { kind: 'symbols', count: 120 });
});

test('more glyphs than the grid holds: "Showing N of M"', () => {
  assert.deepEqual(glyphCountLine({ glyphCount: 480, monogramShown: true, limit: 120 }), {
    kind: 'showing',
    shown: 120,
    total: 480,
  });
  assert.deepEqual(glyphCountLine({ glyphCount: 121, monogramShown: false, limit: 120 }), {
    kind: 'showing',
    shown: 120,
    total: 121,
  });
});

test('bad counts are clamped', () => {
  assert.deepEqual(glyphCountLine({ glyphCount: -3, monogramShown: true, limit: 120 }), { kind: 'matches', count: 1 });
  assert.deepEqual(glyphCountLine({ glyphCount: 2.7, monogramShown: false, limit: 120 }), { kind: 'symbols', count: 2 });
});

test('letters field: shown for a selected Monogram the search keeps', () => {
  assert.equal(showMonogramLetters({ monogramOn: true, hasOverrideImage: false, monogramShown: true }), true);
});

test('letters field: hidden when the search filters the selected Monogram out', () => {
  assert.equal(showMonogramLetters({ monogramOn: true, hasOverrideImage: false, monogramShown: false }), false);
});

test('letters field: hidden when the Monogram is not selected or a photo covers it', () => {
  assert.equal(showMonogramLetters({ monogramOn: false, hasOverrideImage: false, monogramShown: true }), false);
  assert.equal(showMonogramLetters({ monogramOn: true, hasOverrideImage: true, monogramShown: true }), false);
  assert.equal(showMonogramLetters({ monogramOn: false, hasOverrideImage: true, monogramShown: false }), false);
});

test('end to end with the T87 search: "camera" hides the letters field, clearing brings it back', () => {
  const field = (q: string) =>
    showMonogramLetters({ monogramOn: true, hasOverrideImage: false, monogramShown: matchesMonogramQuery(q) });
  assert.equal(field(''), true);
  assert.equal(field('camera'), false);
  assert.equal(field('mono'), true);
});

test('every locale has iconsUi.matchCount with an `other` form using {count}', () => {
  const tables = { en, ...TRANSLATIONS };
  for (const [locale, cat] of Object.entries(tables)) {
    const ui = (cat as { iconsUi?: { matchCount?: Record<string, string>; symbolCount?: Record<string, string> } }).iconsUi;
    const m = ui?.matchCount;
    assert.ok(m, `${locale}: iconsUi.matchCount`);
    assert.ok(m.other?.includes('{count}'), `${locale}: matchCount.other uses {count}`);
    // Same plural categories as the neighbouring symbolCount line.
    assert.deepEqual(Object.keys(m).sort(), Object.keys(ui?.symbolCount ?? {}).sort(), `${locale}: categories`);
  }
});
