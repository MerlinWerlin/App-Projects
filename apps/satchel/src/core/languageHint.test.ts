import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLanguagePref, languageHintVisible, languageName, languageOptions, resolveLang, shippedLangs } from './languageHint.ts';
import { normaliseAppPrefs } from './settings.ts';

test('shipped languages are English plus languages with a non-empty catalogue', () => {
  assert.deepEqual(shippedLangs({}), ['en']);
  assert.deepEqual(shippedLangs({ fr: {}, ja: { 'app.name': 'x' } }), ['en', 'ja']);
  assert.deepEqual(shippedLangs({ ja: { a: 'x' }, es: { a: 'x' } }), ['en', 'es', 'ja']);
});

test('picker offers the phone default first, then each shipped language', () => {
  assert.deepEqual(languageOptions(['en']), ['system', 'en']);
  assert.deepEqual(languageOptions(['en', 'de']), ['system', 'en', 'de']);
});

test('a saved shipped language wins over the phone', () => {
  assert.equal(resolveLang('de', ['ja-JP'], ['en', 'de', 'ja']), 'de');
  assert.equal(resolveLang('en', ['ja-JP'], ['en', 'ja']), 'en');
});

test('system follows the first shipped phone language, else English', () => {
  assert.equal(resolveLang('system', ['pt-BR', 'fr_CA', 'en'], ['en', 'fr']), 'fr');
  assert.equal(resolveLang('system', ['ja-JP'], ['en']), 'en');
  assert.equal(resolveLang('system', [], ['en']), 'en');
});

test('a saved language that no longer ships, or junk, falls back to the phone', () => {
  assert.equal(resolveLang('ja', ['de-AT'], ['en', 'de']), 'de');
  assert.equal(resolveLang('klingon', ['de'], ['en', 'de']), 'de');
  assert.equal(resolveLang(42, ['xx'], ['en']), 'en');
});

test('language prefs validate and persist through normaliseAppPrefs', () => {
  assert.ok(isLanguagePref('system'));
  assert.ok(isLanguagePref('ja'));
  assert.ok(!isLanguagePref('pt'));
  assert.ok(!isLanguagePref(null));
  assert.equal(normaliseAppPrefs({ language: 'fr' }).language, 'fr');
  assert.equal(normaliseAppPrefs({ language: 'pt' }).language, 'system');
  assert.equal(normaliseAppPrefs({ languageHintSeen: true }).languageHintSeen, true);
  assert.equal(normaliseAppPrefs({ languageHintSeen: 'yes' }).languageHintSeen, false);
  assert.equal(normaliseAppPrefs({}).languageHintSeen, false);
});

test('the line shows once: first session only, hidden once tapped, never before prefs load', () => {
  assert.equal(languageHintVisible({ loaded: false, seenBefore: false, tappedThisSession: false }), false);
  assert.equal(languageHintVisible({ loaded: true, seenBefore: false, tappedThisSession: false }), true);
  assert.equal(languageHintVisible({ loaded: true, seenBefore: false, tappedThisSession: true }), false);
  assert.equal(languageHintVisible({ loaded: true, seenBefore: true, tappedThisSession: false }), false);
});

test('language names are each language in its own words', () => {
  assert.equal(languageName('en'), 'English');
  assert.equal(languageName('ja'), '日本語');
});
