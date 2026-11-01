// T213: there is no Live tab any more (T186: the app has 4 tabs; the Live Photo maker is the /live
// stack screen, opened from Wallpapers > Live Photo from a clip, or the hero card on Themes). No
// string in any locale, and no built-in tip, may send the owner to a "Live tab". Also: the non-English
// name of the main install method matches English "Install all at once", not a "bulk install" name.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATALOGUES } from '../i18n/locales/index.ts';
import { isPluralMessage, translate, type Locale } from './i18n.ts';
import { TIPS } from './tips.ts';

function leaves(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]];
  if (isPluralMessage(tree)) return Object.values(tree).filter((x): x is string => typeof x === 'string').map((x) => [prefix, x]);
  if (!tree || typeof tree !== 'object') return [];
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(tree)) out.push(...leaves(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

/** "Live tab" in each of the 11 locales, in the word orders the catalogues used. */
const LIVE_TAB: RegExp[] = [
  /\bLive tab\b/i,
  /Tab „Live“|Live-Tab/,
  /pestaña Live/i,
  /onglet Live/i,
  /scheda Live/i,
  /aba Live/i,
  /Live\s*タブ/,
  /Live\s*탭/,
  /Live\s*标签页/,
  /Live\s*टैब/,
  /تبويب Live/,
];

test('T213: no locale string points to a Live tab', () => {
  const locales = Object.keys(CATALOGUES);
  assert.equal(locales.length, 11);
  for (const loc of locales) {
    const all = leaves((CATALOGUES as Record<string, unknown>)[loc]);
    assert.ok(all.length > 100, `${loc}: only ${all.length} strings`);
    for (const [key, value] of all) {
      for (const re of LIVE_TAB) assert.doesNotMatch(value, re, `${loc} ${key} names a Live tab`);
    }
  }
});

test('T213: built-in tips say Live Photo maker, not Live tab', () => {
  for (const t of TIPS) for (const re of LIVE_TAB) assert.doesNotMatch(t.body, re, t.id);
  const tip = TIPS.find((t) => t.id === 'live-lock');
  assert.match(tip?.body ?? '', /Live Photo maker/);
  assert.match(translate(CATALOGUES, 'en', 'liveUi.hero.hint'), /^Opens the Live Photo maker/);
});

test('T213: every locale names the main install method "all at once", not "bulk install"', () => {
  const BULK = /Sammelinstallation|en bloque|groupée|in blocco|em lote|一括インストール|일괄 설치|批量安装|تثبيت جماعي|^एक साथ इंस्टॉल$/i;
  for (const loc of Object.keys(CATALOGUES) as Locale[]) {
    const name = translate(CATALOGUES, loc, 'install.method.bulk');
    assert.doesNotMatch(name, BULK, `${loc}: install.method.bulk = ${name}`);
    assert.doesNotMatch(translate(CATALOGUES, loc, 'settings.explainer.waysBody'), BULK, `${loc}: waysBody`);
  }
  assert.equal(translate(CATALOGUES, 'en', 'install.method.bulk'), 'Install all at once');
});
