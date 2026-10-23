// T43a: the `themes`, `theme` and `themeUi` namespaces (Themes tab, Theme detail, shared theme
// components) are complete in every shipping locale, keep English placeholders, and use the
// plural categories their language needs. Kept separate from i18nCatalogue.test.ts so parallel
// migrations don't edit the same COMPLETE_NAMESPACES list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { isPluralMessage, lookup, placeholdersOf, translate, type CatalogueTree, type Message } from './i18n.ts';
import { CATALOGUES } from '../i18n/locales/index.ts';

const NAMESPACES = ['themes', 'theme', 'themeUi'];

function leaves(tree: unknown, prefix = ''): [string, Message][] {
  if (typeof tree === 'string' || isPluralMessage(tree)) return [[prefix, tree]];
  if (!tree || typeof tree !== 'object') return [];
  const out: [string, Message][] = [];
  for (const [k, v] of Object.entries(tree)) out.push(...leaves(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

function namesIn(m: Message): Set<string> {
  const texts = typeof m === 'string' ? [m] : Object.values(m).filter((x): x is string => typeof x === 'string');
  return new Set(texts.flatMap(placeholdersOf));
}

const enLeaves = leaves(en).filter(([k]) => NAMESPACES.some((ns) => k.startsWith(`${ns}.`)));

test('the theme namespaces have English strings', () => {
  for (const ns of NAMESPACES) assert.ok(enLeaves.some(([k]) => k.startsWith(`${ns}.`)), ns);
});

for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
  test(`${locale}: ${NAMESPACES.join(', ')} complete, placeholders match English`, () => {
    for (const [key, src] of enLeaves) {
      const msg = lookup(cat as CatalogueTree, key);
      assert.ok(msg !== undefined, `${locale} missing ${key}`);
      assert.equal(typeof msg === 'string', typeof src === 'string', `${locale} ${key}: plural vs string mismatch`);
      const want = namesIn(src);
      if (typeof msg === 'string') {
        assert.deepEqual([...namesIn(msg)].sort(), [...want].sort(), `${locale} ${key}: placeholders differ`);
      } else {
        want.add('count');
        for (const n of namesIn(msg)) assert.ok(want.has(n), `${locale} ${key}: unknown {${n}}`);
        // Every non-count placeholder survives in the `other` form.
        for (const n of namesIn(src)) {
          if (n !== 'count') assert.ok(placeholdersOf(msg.other).includes(n), `${locale} ${key}: other drops {${n}}`);
        }
        if (locale === 'ja' || locale === 'ko' || locale === 'zh-Hans') {
          assert.deepEqual(Object.keys(msg), ['other'], `${locale} ${key}: only "other"`);
        } else if (locale !== 'ar') {
          assert.ok(typeof msg.one === 'string', `${locale} ${key}: lacks "one"`);
        }
      }
    }
  });
}

test('theme strings translate end to end', () => {
  assert.equal(translate(CATALOGUES, 'en', 'themes.search.results', { count: 1 }), '1 matching theme');
  assert.equal(translate(CATALOGUES, 'de', 'themes.category.a11y', { label: 'Dunkel', count: 3 }), 'Dunkel, 3 Themes');
  assert.equal(translate(CATALOGUES, 'ar', 'themeUi.override.count', { count: 2, name: 'X' }), 'أيقونتان مخصّصتان في X');
  assert.equal(translate(CATALOGUES, 'fr', 'theme.steps.progress', { step: 1, total: 4 }), 'Étape 1 sur 4');
});
