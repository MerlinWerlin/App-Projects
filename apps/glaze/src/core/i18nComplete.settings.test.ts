// T43e: the namespaces migrated with Settings, Feedback, Tips, shared UI and Plus are complete in
// every shipping locale, with the same placeholders as English (a separate file so screen migrations
// never edit the shared COMPLETE_NAMESPACES list at the same time).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { PLURAL_CATEGORIES, isPluralMessage, lookup, placeholdersOf, type CatalogueTree, type Message } from './i18n.ts';

const NAMESPACES = ['settings', 'feedback', 'tips', 'ui', 'plus', 'common', 'tabs'];
const CJK = new Set(['ja', 'ko', 'zh-Hans']);

function leaves(tree: unknown, prefix = ''): [string, Message][] {
  if (typeof tree === 'string' || isPluralMessage(tree)) return [[prefix, tree]];
  if (!tree || typeof tree !== 'object') return [];
  return Object.entries(tree).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

function names(m: Message): string[] {
  const t = typeof m === 'string' ? [m] : Object.values(m).filter((x): x is string => typeof x === 'string');
  return [...new Set(t.flatMap(placeholdersOf))].filter((n) => n !== 'count').sort();
}

const enLeaves = leaves(en).filter(([k]) => NAMESPACES.includes(k.split('.')[0]));

test('the T43e namespaces have English strings', () => {
  for (const ns of NAMESPACES) assert.ok(enLeaves.some(([k]) => k.startsWith(`${ns}.`)), ns);
});

for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
  test(`${locale}: ${NAMESPACES.join(', ')} complete with matching placeholders`, () => {
    for (const [key, src] of enLeaves) {
      const msg = lookup(cat as CatalogueTree, key);
      assert.ok(msg !== undefined, `${locale} missing ${key}`);
      assert.equal(typeof msg, typeof src, `${locale} ${key}: plural vs string mismatch`);
      if (typeof msg === 'string') {
        assert.ok(msg.length > 0, `${locale} ${key} is empty`);
        assert.deepEqual(names(msg), names(src), `${locale} ${key}: placeholders differ`);
      } else {
        // Plural forms may drop {count} (e.g. Arabic "two"), but other names must survive in `other`.
        assert.deepEqual(names(msg.other), names(src), `${locale} ${key}: placeholders differ in other`);
        if (CJK.has(locale)) {
          // Only `other` (plus the optional explicit-none `zero`, docs/I18N.md).
          for (const c of Object.keys(msg)) assert.ok(c === 'other' || c === 'zero', `${locale} ${key}: unexpected ${c}`);
        }
        if (locale === 'ar') for (const c of PLURAL_CATEGORIES) assert.ok(typeof msg[c] === 'string', `ar ${key} lacks ${c}`);
      }
    }
  });
}
