import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from './en.ts';
import { makeT, matchLang, placeholders } from './core.ts';

const dir = new URL('./locales/', import.meta.url);

test('every bundled catalogue uses English keys with the same placeholders', () => {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  for (const f of files) {
    const cat = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(cat)) {
      assert.ok(k in en, `${f} has unknown key ${k}`);
      assert.deepEqual(placeholders(v), placeholders((en as Record<string, string>)[k]), `${f} ${k}`);
    }
  }
});

test('t fills placeholders and falls back to English', () => {
  const t = makeT({ 'settings.version': 'Versión {v}' });
  assert.equal(t('settings.version', { v: '0.1' }), 'Versión 0.1');
  assert.equal(t('tab.trips'), 'Trips');
  assert.equal(matchLang(['de-AT', 'en-US']), 'de');
  assert.equal(matchLang(['xx']), 'en');
});

test('no English string quotes battery numbers (never claim them before the owner measures)', () => {
  for (const [k, v] of Object.entries(en)) {
    assert.doesNotMatch(v, /\d+\s?%/, k);
    assert.doesNotMatch(v, /\d+\s?(hours?|hrs?)\s+(more|longer|of battery)/i, k);
  }
});
