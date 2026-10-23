// T87: the glyph picker's search finds the Monogram cell, in English and in every shipped language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { MONOGRAM_SEARCH_TERMS, matchesMonogramQuery, normalizeSearchText } from './monogramSearch.ts';

test('normalizeSearchText: case, accents, spaces and hyphens', () => {
  assert.equal(normalizeSearchText('  Létters  '), 'letters');
  assert.equal(normalizeSearchText('mono-gram__letters'), 'mono gram letters');
  assert.equal(normalizeSearchText('ＭＯＮＯ'), 'mono');
  assert.equal(normalizeSearchText('モノグラム'), 'モノグラム');
  assert.equal(normalizeSearchText('मोनोग्राम'), 'मोनोग्राम');
});

test('empty query shows the Monogram cell', () => {
  assert.equal(matchesMonogramQuery(''), true);
  assert.equal(matchesMonogramQuery('   '), true);
});

test('English words find it, case-insensitively and as prefixes', () => {
  for (const q of ['monogram', 'Monogram', 'MONO', 'letters', 'letter', 'initials', 'Initial', 'init']) {
    assert.equal(matchesMonogramQuery(q), true, q);
  }
  assert.deepEqual([...MONOGRAM_SEARCH_TERMS], ['monogram', 'letters', 'initials']);
});

test('multi-word queries match when every word fits a term', () => {
  assert.equal(matchesMonogramQuery('monogram letters'), true);
  assert.equal(matchesMonogramQuery('initials-monogram'), true);
  assert.equal(matchesMonogramQuery('monogram camera'), false);
});

test('unrelated searches hide it', () => {
  for (const q of ['camera', 'heart', 'star', 'xyz', 'monograms!']) {
    assert.equal(matchesMonogramQuery(q), false, q);
  }
});

test('local terms add the language’s own words', () => {
  assert.equal(matchesMonogramQuery('モノ'), false);
  assert.equal(matchesMonogramQuery('モノ', ['モノグラム']), true);
  assert.equal(matchesMonogramQuery('lettres', ['Monogramme', 'Lettres du monogramme']), true);
  assert.equal(matchesMonogramQuery('Monogramm', ['Monogramm', 'Monogramm-Buchstaben']), true);
  assert.equal(matchesMonogramQuery('buchstaben', ['Monogramm', 'Monogramm-Buchstaben']), true);
  assert.equal(matchesMonogramQuery('kamera', ['Monogramm']), false);
});

test('every locale: its iconsUi.monogram / monogramLetters strings find the cell', () => {
  const tables = { en, ...TRANSLATIONS };
  for (const [locale, cat] of Object.entries(tables)) {
    const ui = (cat as { iconsUi?: { monogram?: string; monogramLetters?: string } }).iconsUi;
    assert.ok(ui?.monogram, `${locale}: iconsUi.monogram`);
    assert.ok(ui?.monogramLetters, `${locale}: iconsUi.monogramLetters`);
    const terms = [ui.monogram, ui.monogramLetters];
    assert.equal(matchesMonogramQuery(ui.monogram, terms), true, `${locale}: ${ui.monogram}`);
    assert.equal(matchesMonogramQuery(ui.monogramLetters, terms), true, `${locale}: ${ui.monogramLetters}`);
    // English always works on top of the local words.
    assert.equal(matchesMonogramQuery('initials', terms), true, `${locale}: initials`);
    assert.equal(matchesMonogramQuery('camera', terms), false, `${locale}: camera`);
  }
});
