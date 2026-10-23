import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCALE_NAMES,
  LRI,
  PDI,
  SHIPPING_LOCALES,
  SUPPORTED_LOCALES,
  brandFontSupports,
  fallbackPluralCategory,
  formatClock,
  formatDate,
  formatNumber,
  interpolate,
  isPluralMessage,
  isRTL,
  isSupportedLocale,
  lineHeightScale,
  lookup,
  matchLocale,
  parseTag,
  placeholdersOf,
  pluralCategory,
  pseudoLocalize,
  resolveLocale,
  scriptOf,
  selectPlural,
  translate,
  uses24HourClock,
  type CatalogueSet,
} from './i18n.ts';

test('supported locales: 11 shipping plus the en-XA pseudo-locale, each with an endonym', () => {
  assert.equal(SUPPORTED_LOCALES.length, 12);
  assert.equal(SHIPPING_LOCALES.length, 11);
  assert.ok(!SHIPPING_LOCALES.includes('en-XA'));
  for (const l of SUPPORTED_LOCALES) assert.ok(LOCALE_NAMES[l].length > 0, l);
  assert.equal(LOCALE_NAMES['pt-BR'], 'Português (Brasil)');
  assert.equal(LOCALE_NAMES.ar, 'العربية');
  assert.ok(isSupportedLocale('zh-Hans'));
  assert.ok(!isSupportedLocale('zh'));
  assert.ok(!isSupportedLocale(42));
});

test('parseTag handles case, underscores, script and region', () => {
  assert.deepEqual(parseTag('zh_hans_cn'), { lang: 'zh', script: 'Hans', region: 'CN' });
  assert.deepEqual(parseTag('pt-BR'), { lang: 'pt', script: null, region: 'BR' });
  assert.deepEqual(parseTag('es-419'), { lang: 'es', script: null, region: '419' });
});

test('matchLocale maps device tags onto shipping locales', () => {
  assert.equal(matchLocale('en-AU'), 'en');
  assert.equal(matchLocale('es-MX'), 'es');
  assert.equal(matchLocale('fr-CA'), 'fr');
  assert.equal(matchLocale('de-CH'), 'de');
  assert.equal(matchLocale('it-IT'), 'it');
  assert.equal(matchLocale('ja-JP'), 'ja');
  assert.equal(matchLocale('ko-KR'), 'ko');
  assert.equal(matchLocale('hi-IN'), 'hi');
  assert.equal(matchLocale('ar-SA'), 'ar');
  assert.equal(matchLocale('ar-EG'), 'ar');
  for (const t of ['pt', 'pt-BR', 'pt-PT', 'pt_AO']) assert.equal(matchLocale(t), 'pt-BR', t);
  for (const t of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN', 'zh-Hans-HK']) assert.equal(matchLocale(t), 'zh-Hans', t);
  for (const t of ['zh-TW', 'zh-HK', 'zh-Hant', 'zh-Hant-TW']) assert.equal(matchLocale(t), null, t);
  assert.equal(matchLocale('nl-NL'), null);
  assert.equal(matchLocale('en-XA'), 'en', 'pseudo is never picked from the device');
  assert.equal(matchLocale(''), null);
});

test('resolveLocale: override, then first matching device tag, then English', () => {
  assert.equal(resolveLocale(['de-DE', 'en-US'], null), 'de');
  assert.equal(resolveLocale(['nl-NL', 'zh-TW', 'fr-BE'], null), 'fr');
  assert.equal(resolveLocale(['nl-NL'], null), 'en');
  assert.equal(resolveLocale([], null), 'en');
  assert.equal(resolveLocale(['de-DE'], 'ja'), 'ja');
  assert.equal(resolveLocale(['de-DE'], 'en-XA'), 'en-XA');
  assert.equal(resolveLocale(['de-DE'], 'klingon'), 'de', 'unknown override is ignored');
  assert.equal(resolveLocale(['zh-CN'], ''), 'zh-Hans');
});

test('isRTL is true only for right-to-left languages', () => {
  assert.equal(isRTL('ar'), true);
  assert.equal(isRTL('ar-EG'), true);
  assert.equal(isRTL('he-IL'), true);
  for (const l of SUPPORTED_LOCALES.filter((x) => x !== 'ar')) assert.equal(isRTL(l), false, l);
});

test('scriptOf and lineHeightScale', () => {
  assert.equal(scriptOf('en'), 'latin');
  assert.equal(scriptOf('pt-BR'), 'latin');
  assert.equal(scriptOf('en-XA'), 'latin');
  assert.equal(scriptOf('ja'), 'cjk');
  assert.equal(scriptOf('ko'), 'cjk');
  assert.equal(scriptOf('zh-Hans'), 'cjk');
  assert.equal(scriptOf('hi'), 'devanagari');
  assert.equal(scriptOf('ar'), 'arabic');
  assert.equal(lineHeightScale('latin'), 1);
  assert.equal(lineHeightScale('cjk'), 1.15);
  assert.equal(lineHeightScale('devanagari'), 1.3);
  assert.equal(lineHeightScale('arabic'), 1.25);
  assert.equal(brandFontSupports('latin'), true);
  for (const s of ['cjk', 'devanagari', 'arabic'] as const) assert.equal(brandFontSupports(s), false);
});

test('interpolate replaces {name} and leaves unknown placeholders visible', () => {
  assert.equal(interpolate('Hi {name}, {n} new', { name: 'Ana', n: 3 }), 'Hi Ana, 3 new');
  assert.equal(interpolate('Hi {name}', {}), 'Hi {name}');
  assert.equal(interpolate('Hi {name}'), 'Hi {name}');
  assert.equal(interpolate('{a}{a}', { a: 'x' }), 'xx');
  assert.deepEqual(placeholdersOf('{a} and {b} and {a}'), ['a', 'b']);
});

test('isPluralMessage recognises only the ICU-lite shape', () => {
  assert.ok(isPluralMessage({ one: 'x', other: 'y' }));
  assert.ok(isPluralMessage({ other: 'y' }));
  assert.ok(!isPluralMessage({ one: 'x' }));
  assert.ok(!isPluralMessage({ title: 'x', other: 'y' }));
  assert.ok(!isPluralMessage('x'));
  assert.ok(!isPluralMessage({}));
});

test('Arabic plural categories: zero, one, two, few, many, other (Intl and fallback agree)', () => {
  const cases: [number, string][] = [
    [0, 'zero'], [1, 'one'], [2, 'two'], [3, 'few'], [10, 'few'], [11, 'many'], [99, 'many'],
    [100, 'other'], [101, 'other'], [102, 'other'], [103, 'few'], [111, 'many'], [1000, 'other'],
  ];
  for (const [n, cat] of cases) {
    assert.equal(pluralCategory('ar', n), cat, `Intl ar ${n}`);
    assert.equal(fallbackPluralCategory('ar', n), cat, `fallback ar ${n}`);
  }
});

test('fallback plural rules match Intl.PluralRules for every shipping language', () => {
  const ns = [0, 1, 2, 3, 5, 11, 21, 100, 1000000, 1.5];
  for (const l of SHIPPING_LOCALES) {
    const pr = new Intl.PluralRules(l);
    for (const n of ns) assert.equal(fallbackPluralCategory(l, n), pr.select(n), `${l} ${n}`);
  }
});

test('selectPlural: per-locale categories, explicit zero, missing category falls back to other', () => {
  const ar = { zero: 'z', one: 'o', two: 't', few: 'f', many: 'm', other: 'x' };
  assert.deepEqual([0, 1, 2, 5, 12, 100].map((n) => selectPlural(ar, 'ar', n)), ['z', 'o', 't', 'f', 'm', 'x']);
  const en = { zero: 'none', one: 'one', other: 'many' };
  assert.equal(selectPlural(en, 'en', 0), 'none');
  assert.equal(selectPlural(en, 'en', 1), 'one');
  assert.equal(selectPlural(en, 'en', 7), 'many');
  assert.equal(selectPlural({ one: 'un', other: 'des' }, 'fr', 0), 'un', 'French 0 is singular');
  assert.equal(selectPlural({ other: '{count}件' }, 'ja', 1), '{count}件');
  assert.equal(selectPlural({ one: 'o', other: 'x' }, 'ar', 2), 'x', 'missing two falls back to other');
});

const CATS: CatalogueSet = {
  en: {
    common: { ok: 'OK', items: { zero: 'No items', one: '{count} item', other: '{count} items' } },
    greet: { hello: 'Hello {name}' },
    onlyEn: { x: 'English only' },
  },
  de: { common: { ok: 'OK', items: { one: '{count} Element', other: '{count} Elemente' } }, greet: { hello: 'Hallo {name}' } },
  ar: {
    common: {
      ok: 'حسنًا',
      items: { zero: 'لا عناصر', one: 'عنصر واحد', two: 'عنصران', few: '{count} عناصر', many: '{count} عنصرًا', other: '{count} عنصر' },
    },
  },
};

test('lookup walks dotted keys and refuses namespaces', () => {
  assert.equal(lookup(CATS.en, 'greet.hello'), 'Hello {name}');
  assert.equal(lookup(CATS.en, 'greet'), undefined);
  assert.equal(lookup(CATS.en, 'common.items.one'), undefined, 'cannot index into a plural');
  assert.ok(isPluralMessage(lookup(CATS.en, 'common.items')));
  assert.equal(lookup(undefined, 'a.b'), undefined);
});

test('translate: locale, then English, then the key', () => {
  assert.equal(translate(CATS, 'de', 'greet.hello', { name: 'Jo' }), 'Hallo Jo');
  assert.equal(translate(CATS, 'de', 'onlyEn.x'), 'English only');
  assert.equal(translate(CATS, 'fr', 'greet.hello', { name: 'Jo' }), 'Hello Jo', 'no fr catalogue');
  assert.equal(translate(CATS, 'de', 'missing.key'), 'missing.key');
});

test('translate plurals with Arabic categories and Intl-formatted counts', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 11, 100].map((count) => translate(CATS, 'ar', 'common.items', { count })),
    ['لا عناصر', 'عنصر واحد', 'عنصران', `${formatNumber(3, 'ar')} عناصر`, `${formatNumber(11, 'ar')} عنصرًا`, `${formatNumber(100, 'ar')} عنصر`],
  );
  assert.equal(translate(CATS, 'en', 'common.items', { count: 0 }), 'No items');
  assert.equal(translate(CATS, 'en', 'common.items', { count: 1 }), '1 item');
  assert.equal(translate(CATS, 'en', 'common.items', { count: 1200 }), '1,200 items');
  assert.equal(translate(CATS, 'de', 'common.items', { count: 1200 }), '1.200 Elemente');
  assert.equal(translate(CATS, 'de', 'common.items', { count: 0 }), '0 Elemente', 'German has no zero form here');
  assert.equal(translate(CATS, 'en', 'common.items'), '{count} items', 'no count: other form');
});

test('pseudoLocalize accents, pads ~40%, keeps placeholders, wraps in brackets', () => {
  const src = 'Install {count} icons';
  const out = pseudoLocalize(src);
  assert.ok(out.startsWith('⟦') && out.endsWith('⟧'));
  assert.ok(out.includes('{count}'));
  assert.ok(!/[A-Za-z]{3,}/.test(out.replace('{count}', '')), `unaccented letters left: ${out}`);
  const visible = src.replace('{count}', '').length;
  const outVisible = out.replace('{count}', '').length - 2;
  assert.ok(outVisible >= visible * 1.35, `expanded: ${outVisible} vs ${visible}`);
  assert.equal(pseudoLocalize(''), '⟦⟧');
  assert.ok(pseudoLocalize('{a}{b}').includes('{a}{b}'));
});

test('translate in en-XA renders English through pseudoLocalize, then interpolates', () => {
  const out = translate(CATS, 'en-XA', 'greet.hello', { name: 'Jo' });
  assert.ok(out.startsWith('⟦Ĥéļļö Jo'), out);
  assert.ok(out.endsWith('⟧'));
  assert.ok(translate(CATS, 'en-XA', 'common.items', { count: 1 }).startsWith('⟦1 íţéɱ'));
});

test('formatNumber and formatDate wrap Intl, with an optional Latin-digit mode', () => {
  assert.equal(formatNumber(1234.5, 'de'), '1.234,5');
  assert.equal(formatNumber(1234.5, 'en'), '1,234.5');
  assert.equal(formatNumber(1234.5, 'en-XA'), '1,234.5');
  assert.match(formatNumber(1234, 'ar', { latinDigits: true }), /^[0-9.,٬‏؜ ]+$/);
  assert.equal(formatNumber(0.5, 'fr', { style: 'percent' }).replace(/\s/g, ' '), '50 %');
  const d = new Date(2026, 9, 16, 9, 41);
  assert.match(formatDate(d, 'de', { day: 'numeric', month: 'long' }), /16\. Oktober/);
  assert.match(formatDate(d, 'ja', { month: 'long', day: 'numeric' }), /10月16日/);
  assert.match(formatDate(d, 'ar', { day: 'numeric', latinDigits: true }), /16/);
});

test('formatClock: LTR isolates, Latin digits, locale 12/24h preference, device override', () => {
  const d = new Date(2026, 9, 16, 21, 5);
  const am = new Date(2026, 9, 16, 9, 41);
  assert.equal(formatClock(d, 'en'), `${LRI}9:05${PDI}`);
  assert.equal(formatClock(d, 'de'), `${LRI}21:05${PDI}`);
  assert.equal(formatClock(am, 'fr'), `${LRI}09:41${PDI}`);
  assert.equal(formatClock(d, 'ar'), `${LRI}9:05${PDI}`, 'Arabic stays Latin digits');
  assert.equal(formatClock(new Date(2026, 0, 1, 0, 7), 'en'), `${LRI}12:07${PDI}`);
  assert.equal(formatClock(d, 'en', true), `${LRI}21:05${PDI}`);
  assert.equal(formatClock(d, 'de', false), `${LRI}9:05${PDI}`);
  for (const l of SUPPORTED_LOCALES) assert.match(formatClock(d, l), /^⁦\d{1,2}:\d{2}⁩$/, l);
  assert.equal(uses24HourClock('en'), false);
  assert.equal(uses24HourClock('ja'), true);
  assert.equal(uses24HourClock('ko'), false);
});
