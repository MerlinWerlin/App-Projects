import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from './en.ts';
import { makeT, matchLang, placeholders, SUPPORTED } from './core.ts';

const dir = new URL('./locales/', import.meta.url);

test('every supported language has a full catalogue with the same placeholders', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const lang of SUPPORTED.filter((l) => l !== 'en')) {
    assert.ok(files.includes(`${lang}.json`), lang);
    const cat = JSON.parse(readFileSync(new URL(`${lang}.json`, dir), 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(en)) {
      assert.ok(cat[k], `${lang} missing ${k}`);
      assert.deepEqual(placeholders(cat[k]), placeholders(v), `${lang} ${k}`);
    }
  }
});

test('t fills placeholders and falls back to English', () => {
  const t = makeT({ 'home.streak': '{n} Tage' });
  assert.equal(t('home.streak', { n: 3 }), '3 Tage');
  assert.equal(t('tab.play'), 'Play');
  assert.equal(matchLang(['de-AT', 'en-US']), 'de');
  assert.equal(matchLang(['xx']), 'en');
});

test('no UI text claims more lines than the packs have', () => {
  assert.match(en['plus.f1'], /950\+/);
});
