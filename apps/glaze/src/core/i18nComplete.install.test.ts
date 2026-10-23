// T43c: the `install` and `wallpaper` namespaces are complete in every shipping locale, with the
// same placeholders as English (kept separate from COMPLETE_NAMESPACES in i18nCatalogue.test.ts
// so parallel migrations never edit the same file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { PLURAL_CATEGORIES, isPluralMessage, lookup, placeholdersOf, type CatalogueTree, type Message } from './i18n.ts';

const NAMESPACES = ['install', 'wallpaper'];
const CJK = new Set(['ja', 'ko', 'zh-Hans']);

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

test('install/wallpaper have English strings', () => {
  assert.ok(enLeaves.length > 100, `only ${enLeaves.length} leaves`);
});

for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
  test(`${locale}: install and wallpaper complete, placeholders kept`, () => {
    for (const [key, src] of enLeaves) {
      const msg = lookup(cat as CatalogueTree, key) as Message | undefined;
      assert.ok(msg !== undefined, `${locale} missing ${key}`);
      assert.equal(typeof msg === 'string', typeof src === 'string', `${locale} ${key}: plural vs string`);
      if (typeof msg === 'string') {
        assert.ok(msg.trim().length > 0, `${locale} ${key}: empty`);
        assert.deepEqual([...namesIn(msg)].sort(), [...namesIn(src)].sort(), `${locale} ${key}: placeholders differ`);
      } else {
        const allowed = new Set([...namesIn(src), 'count']);
        for (const n of namesIn(msg)) assert.ok(allowed.has(n), `${locale} ${key}: unknown {${n}}`);
        // `other` keeps every English placeholder except count (spelled out in some forms).
        for (const n of namesIn(src)) {
          if (n !== 'count') assert.ok(placeholdersOf(msg.other).includes(n), `${locale} ${key}: other drops {${n}}`);
        }
        if (locale === 'ar') for (const c of PLURAL_CATEGORIES) assert.ok(typeof msg[c] === 'string', `ar ${key} lacks ${c}`);
        if (CJK.has(locale)) assert.deepEqual(Object.keys(msg), ['other'], `${locale} ${key}: CJK uses only other`);
      }
    }
  });
}
