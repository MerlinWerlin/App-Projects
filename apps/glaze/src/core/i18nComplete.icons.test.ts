// T43b: the `icons`, `iconsUi` and `addApp` namespaces are complete in every locale, with the same
// placeholders as English (kept out of the shared COMPLETE_NAMESPACES list in i18nCatalogue.test.ts
// so parallel screen migrations never edit the same file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { PLURAL_CATEGORIES, isPluralMessage, lookup, placeholdersOf, type CatalogueTree, type Message } from './i18n.ts';

const NAMESPACES = ['icons', 'iconsUi', 'addApp'];

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

const owned = leaves(en).filter(([k]) => NAMESPACES.some((ns) => k === ns || k.startsWith(`${ns}.`)));

test('the owned namespaces have English strings', () => {
  for (const ns of NAMESPACES) assert.ok(owned.some(([k]) => k.startsWith(`${ns}.`)), ns);
  assert.ok(owned.length > 150, `only ${owned.length} strings`);
});

for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
  test(`${locale}: ${NAMESPACES.join(', ')} complete with matching placeholders`, () => {
    for (const [key, src] of owned) {
      const msg = lookup(cat as CatalogueTree, key) as Message | undefined;
      assert.ok(msg !== undefined, `${locale} missing ${key}`);
      assert.equal(typeof msg === 'string', typeof src === 'string', `${locale} ${key}: plural vs string mismatch`);
      if (typeof msg === 'string') {
        assert.deepEqual([...namesIn(msg)].sort(), [...namesIn(src)].sort(), `${locale} ${key}: placeholders differ`);
      } else {
        // Every plural form keeps the English placeholders other than {count}.
        const need = [...namesIn(src)].filter((n) => n !== 'count');
        for (const c of PLURAL_CATEGORIES) {
          const form: unknown = msg[c];
          if (typeof form !== 'string') continue;
          for (const n of need) assert.ok(placeholdersOf(form).includes(n), `${locale} ${key}.${c} drops {${n}}`);
        }
        assert.ok(msg.other.includes('{count}'), `${locale} ${key}.other lacks {count}`);
        if (locale === 'ar') for (const c of PLURAL_CATEGORIES) assert.ok(typeof msg[c] === 'string', `ar ${key} lacks ${c}`);
        if (locale === 'ja' || locale === 'ko' || locale === 'zh-Hans') {
          assert.deepEqual(Object.keys(msg), ['other'], `${locale} ${key}: only "other"`);
        }
      }
    }
  });
}
