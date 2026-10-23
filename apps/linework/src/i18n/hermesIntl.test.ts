// fb-1017 F1: Hermes (Expo Go + release builds) has no Intl.PluralRules. pluralCategory must work without it,
// and no app code may construct Intl APIs that Hermes lacks except through guarded helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pluralCategory, clearPluralCache, fallbackRule, translate } from './core.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function withoutPluralRules(fn: () => void): void {
  const intl = globalThis.Intl as unknown as Record<string, unknown>;
  const saved = intl.PluralRules;
  delete intl.PluralRules;
  clearPluralCache();
  try {
    fn();
  } finally {
    intl.PluralRules = saved;
    clearPluralCache();
  }
}

test('F1: pluralCategory works with Intl.PluralRules deleted (Hermes)', () => {
  withoutPluralRules(() => {
    assert.equal(typeof (globalThis.Intl as unknown as Record<string, unknown>).PluralRules, 'undefined');
    assert.equal(pluralCategory('en', 1), 'one');
    assert.equal(pluralCategory('en', 2), 'other');
    assert.equal(pluralCategory('ar', 0), 'zero');
    assert.equal(pluralCategory('ar', 3), 'few');
    assert.equal(pluralCategory('ar', 11), 'many');
    assert.equal(pluralCategory('fr', 0), 'one');
    assert.equal(pluralCategory('ja', 5), 'other');
    const cat = { 'x.n': { one: '{count} photo', other: '{count} photos' } };
    assert.match(translate('en', cat, cat, 'x.n', { count: 3 }), /photos/);
  });
});

test('F1: Intl.PluralRules that is not a constructor falls back too', () => {
  const intl = globalThis.Intl as unknown as Record<string, unknown>;
  const saved = intl.PluralRules;
  intl.PluralRules = {} as unknown;
  clearPluralCache();
  try {
    assert.equal(pluralCategory('de', 1), 'one');
    assert.equal(pluralCategory('hi', 1.5), 'one');
  } finally {
    intl.PluralRules = saved;
    clearPluralCache();
  }
});

test('F1: fallback table agrees with Intl.PluralRules for integers 0..120', () => {
  for (const loc of ['en', 'es', 'fr', 'de', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar']) {
    const real = new Intl.PluralRules(loc);
    const fb = fallbackRule(loc);
    for (let n = 0; n <= 120; n++) {
      // es/it/pt add a "many" form for 1e6 multiples only; not reachable here.
      assert.equal(fb(n), real.select(n), `${loc} ${n}`);
    }
  }
});

test('F1: no unguarded use of Intl APIs Hermes lacks in app/ or src/', () => {
  const bad = /new\s+Intl\s*\.\s*(PluralRules|RelativeTimeFormat|ListFormat|Segmenter|DisplayNames)\b|\bIntl\s*\.\s*(PluralRules|RelativeTimeFormat|ListFormat|Segmenter|DisplayNames)\s*\(/;
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) {
        readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
          if (bad.test(l) && !/^\s*(\/\/|\*)/.test(l)) hits.push(`${p}:${i + 1}`);
        });
      }
    }
  };
  walk(join(root, 'app'));
  walk(join(root, 'src'));
  assert.deepEqual(hits, []);
});
