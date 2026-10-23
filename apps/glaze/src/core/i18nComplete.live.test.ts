// T43d: the `live` and `liveUi` namespaces are complete in every locale, with the same placeholders
// as English (kept here instead of COMPLETE_NAMESPACES so parallel migrations never edit one file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { CATALOGUES, TRANSLATIONS } from '../i18n/locales/index.ts';
import { PLURAL_CATEGORIES, isPluralMessage, lookup, placeholdersOf, translate, type CatalogueTree, type Locale, type Message } from './i18n.ts';
import { formatSeconds, nextLoopName } from './loop.ts';

const NAMESPACES = ['live', 'liveUi'];

test('T48: seconds unit and default loop name follow the app language', () => {
  const secs = (l: Locale) => formatSeconds(4500, (value) => translate(CATALOGUES, l, 'live.seconds', { value }));
  assert.equal(secs('en'), '4.5 s');
  assert.equal(secs('de'), '4,5 s');
  assert.equal(secs('ja'), '4.5秒');
  const name = (l: Locale, taken: string[]) => nextLoopName(taken, (number) => translate(CATALOGUES, l, 'live.defaultName', { number }));
  assert.equal(name('en', ['Loop 1']), 'Loop 2');
  assert.equal(name('fr', ['boucle 1']), 'Boucle 2');
  assert.equal(name('es', []), 'Bucle 1');
  for (const l of Object.keys(TRANSLATIONS) as Locale[]) {
    for (const k of ['big', 'long', 'bigAndLong'] as const) {
      const text = translate(CATALOGUES, l, `live.editor.largeSource.${k}`);
      assert.notEqual(text, translate(CATALOGUES, 'en', `live.editor.largeSource.${k}`), `${l} ${k} is English`);
    }
  }
});

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

test('live/liveUi English catalogue is not empty', () => {
  assert.ok(enLeaves.length > 150, `only ${enLeaves.length} leaves`);
});

for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
  test(`${locale}: live and liveUi complete, placeholders match English`, () => {
    for (const [key, src] of enLeaves) {
      const msg = lookup(cat as CatalogueTree, key) as Message | undefined;
      assert.ok(msg !== undefined, `${locale} missing ${key}`);
      assert.equal(typeof msg === 'string', typeof src === 'string', `${locale} ${key}: plural vs string mismatch`);
      if (typeof src === 'string' && typeof msg === 'string') {
        assert.deepEqual([...namesIn(msg)].sort(), [...namesIn(src)].sort(), `${locale} ${key}: placeholders differ`);
      } else if (typeof msg !== 'string') {
        const allowed = new Set([...namesIn(src), 'count']);
        for (const n of namesIn(msg)) assert.ok(allowed.has(n), `${locale} ${key}: unknown placeholder {${n}}`);
        assert.ok(msg.other.includes('{count}') || namesIn(src).size === 0 || msg.other.length > 0, `${locale} ${key}: empty other`);
        if (locale === 'ar') for (const c of PLURAL_CATEGORIES) assert.ok(typeof msg[c] === 'string', `ar ${key} lacks ${c}`);
      }
    }
  });
}
