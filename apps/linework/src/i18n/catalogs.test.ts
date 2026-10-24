// Catalogue integrity: every translation uses only English keys, keeps the same placeholders, and gives every
// plural category its language needs. Languages listed in COMPLETE must also cover every English key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS, EN } from './catalogs.ts';
import { isPlural, LOCALES, placeholders, type LocaleCode } from './core.ts';

/** Languages whose catalogue is finished (T41 adds all ten). */
const COMPLETE: readonly LocaleCode[] = [
  'es',
  'pt-BR',
  'fr',
  'it',
  'de',
  'hi',
  'ja',
  'ko',
  'zh-Hans',
  'ar',
];

const enKeys = Object.keys(EN);

test('English keys are prefixed with an area', () => {
  for (const k of enKeys) assert.match(k, /^(common|home|templates|settings|plus|prepare|trace|lightbox|drawings|workshop|feedback)\.[\w.-]+$/, k);
});

for (const { code } of LOCALES) {
  if (code === 'en') continue;
  const cat = CATALOGS[code];
  test(`${code}: only English keys, same placeholders, plural forms`, () => {
    const rules = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const [k, m] of Object.entries(cat)) {
      const src = EN[k];
      assert.ok(src !== undefined, `${code} has unknown key ${k}`);
      assert.deepEqual(placeholders(m), placeholders(src), `${code} ${k} placeholders`);
      assert.equal(isPlural(m), isPlural(src), `${code} ${k} plural shape`);
      if (isPlural(m)) for (const r of rules) assert.ok(m[r] !== undefined, `${code} ${k} missing plural form ${r}`);
      if (typeof m === 'string') assert.ok(m.trim().length > 0, `${code} ${k} empty`);
    }
  });
  if (COMPLETE.includes(code)) {
    test(`${code}: covers every English key`, () => {
      const missing = enKeys.filter((k) => cat[k] === undefined);
      assert.deepEqual(missing, [], `${code} missing ${missing.length} keys`);
    });
  }
}
