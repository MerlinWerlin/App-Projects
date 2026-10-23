// Catalogue integrity (docs/I18N.md): every locale file only uses English keys, keeps the same
// placeholders, uses valid plural shapes, and fully covers the namespaces translated so far.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { CATALOGUES, TRANSLATIONS } from '../i18n/locales/index.ts';
import {
  PLURAL_CATEGORIES,
  SHIPPING_LOCALES,
  isPluralMessage,
  lookup,
  placeholdersOf,
  translate,
  type CatalogueTree,
  type Message,
} from './i18n.ts';

/** Namespaces that must be complete in every locale (grow this as screens migrate). */
const COMPLETE_NAMESPACES = ['common', 'tabs', 'settings.language'];

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

const enLeaves = new Map(leaves(en));
const pluralCats = new Set<string>(PLURAL_CATEGORIES);

test('every shipping locale except en has a catalogue', () => {
  for (const l of SHIPPING_LOCALES) if (l !== 'en') assert.ok(CATALOGUES[l], l);
  assert.equal(Object.keys(TRANSLATIONS).length, 10);
});

test('English leaves are strings or plural messages; no key uses a plural category name', () => {
  for (const [key] of enLeaves) {
    for (const part of key.split('.')) assert.ok(!pluralCats.has(part), `${key}: "${part}" is reserved`);
  }
});

for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
  test(`${locale}: only English keys, same kind, placeholders a subset of English`, () => {
    for (const [key, msg] of leaves(cat)) {
      const src = enLeaves.get(key);
      assert.ok(src !== undefined, `${locale} has unknown key ${key}`);
      assert.equal(typeof msg === 'string', typeof src === 'string', `${locale} ${key}: plural vs string mismatch`);
      const allowed = namesIn(src);
      if (typeof src !== 'string') allowed.add('count');
      for (const n of namesIn(msg)) assert.ok(allowed.has(n), `${locale} ${key}: unknown placeholder {${n}}`);
      if (typeof msg === 'string') {
        for (const n of namesIn(src)) assert.ok(namesIn(msg).has(n), `${locale} ${key}: drops {${n}}`);
      } else {
        assert.ok(msg.other.length > 0, `${locale} ${key}: empty other`);
      }
    }
  });

  test(`${locale}: complete for ${COMPLETE_NAMESPACES.join(', ')}`, () => {
    for (const [key] of enLeaves) {
      if (!COMPLETE_NAMESPACES.some((ns) => key === ns || key.startsWith(`${ns}.`))) continue;
      assert.ok(lookup(cat as CatalogueTree, key) !== undefined, `${locale} missing ${key}`);
    }
  });
}

test('Arabic plurals provide all six categories', () => {
  for (const [key, msg] of leaves(TRANSLATIONS.ar)) {
    if (typeof msg === 'string') continue;
    for (const c of PLURAL_CATEGORIES) assert.ok(typeof msg[c] === 'string', `ar ${key} lacks ${c}`);
  }
});

test('real catalogues translate end to end with fallbacks', () => {
  assert.equal(translate(CATALOGUES, 'de', 'tabs.settings'), 'Einstellungen');
  assert.equal(translate(CATALOGUES, 'ar', 'common.itemCount', { count: 2 }), 'عنصران');
  assert.equal(translate(CATALOGUES, 'ja', 'settings.language.systemDefaultHint', { language: '日本語' }), 'スマートフォンの設定に従う（日本語）');
  assert.equal(translate(CATALOGUES, 'en', 'common.itemCount', { count: 3 }), '3 items');
  assert.ok(translate(CATALOGUES, 'en-XA', 'tabs.themes').startsWith('⟦Ţĥéɱéš'));
});
