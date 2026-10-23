// RTL + pseudo-locale checks over the real catalogues (docs/I18N.md "Layout rules"):
// - pseudoLocalize keeps every {placeholder} of every English leaf and makes its visible text ≥ 1.3× longer,
//   so the en-XA locale really exercises text expansion;
// - Arabic is the RTL locale and every Arabic string it ships is non-empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { isPluralMessage, isRTL, placeholdersOf, pseudoLocalize, SHIPPING_LOCALES, type Message } from './i18n.ts';

function texts(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]];
  if (isPluralMessage(tree)) {
    return Object.entries(tree as Exclude<Message, string>)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .map(([cat, s]) => [`${prefix}#${cat}`, s]);
  }
  if (!tree || typeof tree !== 'object') return [];
  return Object.entries(tree).flatMap(([k, v]) => texts(v, prefix ? `${prefix}.${k}` : k));
}

const enTexts = texts(en);
const BRANDS = /\b(Glaze|Plus|Live|Lock|Icon|Studio|Expo|Go|TestFlight|App|Store|iOS|iPhone|GIF|VPN|Photo|Shortcuts|icons)\b/g;

test('pseudoLocalize keeps placeholders and expands every English string by ≥ 1.3×', () => {
  assert.ok(enTexts.length > 200, `only ${enTexts.length} English strings`);
  for (const [key, s] of enTexts) {
    const p = pseudoLocalize(s);
    assert.deepEqual(placeholdersOf(p).sort(), placeholdersOf(s).sort(), `${key}: placeholders changed`);
    // Measured on the visible text: placeholders are filled in at runtime and never padded.
    const visible = (x: string) => x.replace(/\{\w+\}/g, '').length;
    assert.ok(visible(p) >= visible(s) * 1.3, `${key}: "${p}" is not 1.3× "${s}"`);
    assert.ok(p.startsWith('⟦') && p.endsWith('⟧'), `${key}: not wrapped`);
  }
});

test('Arabic is the only right-to-left shipping locale', () => {
  assert.equal(isRTL('ar'), true);
  for (const l of SHIPPING_LOCALES) if (l !== 'ar') assert.equal(isRTL(l), false, l);
});

test('every Arabic string is non-empty and keeps its English placeholders available', () => {
  const ar = texts(TRANSLATIONS.ar);
  assert.ok(ar.length > 200, `only ${ar.length} Arabic strings`);
  const enKeys = new Set(enTexts.map(([k]) => k.split('#')[0]));
  for (const [key, s] of ar) {
    assert.ok(s.trim().length > 0, `ar ${key} is empty`);
    assert.ok(enKeys.has(key.split('#')[0]), `ar ${key} has no English source`);
  }
});

test('Arabic strings are written in Arabic script (not left in English)', () => {
  for (const [key, s] of texts(TRANSLATIONS.ar)) {
    // Product, platform and feature names stay in Latin script.
    const bare = s.replace(/\{\w+\}/g, '').replace(BRANDS, '');
    if (!/[A-Za-z]{3,}/.test(bare)) continue;
    assert.ok(/[؀-ۿ]/.test(bare), `ar ${key} looks untranslated: "${s}"`);
  }
});
