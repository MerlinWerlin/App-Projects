import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  formatPercent,
  interpolate,
  lineHeightScale,
  localeInfo,
  placeholders,
  pseudoText,
  resolveLocale,
  translate,
  usesSystemFont,
} from './core.ts';
import { configure, getLocale, t, tDynamic } from './store.ts';

const LRI = '⁦';
const PDI = '⁩';

test('resolveLocale picks the closest shipped language', () => {
  assert.equal(resolveLocale(['de-AT', 'en-AU']), 'de');
  assert.equal(resolveLocale(['pt-PT']), 'pt-BR');
  assert.equal(resolveLocale(['zh-Hant-TW']), 'zh-Hans');
  assert.equal(resolveLocale(['zh_CN']), 'zh-Hans');
  assert.equal(resolveLocale(['sw', 'ar-EG']), 'ar');
  assert.equal(resolveLocale(['xx']), 'en');
  assert.equal(resolveLocale([]), 'en');
});

test('direction and script metadata', () => {
  assert.equal(localeInfo('ar').dir, 'rtl');
  assert.equal(localeInfo('ja').dir, 'ltr');
  assert.ok(lineHeightScale('devanagari') > lineHeightScale('latin'));
  assert.ok(usesSystemFont('cjk'));
  assert.ok(!usesSystemFont('latin'));
});

test('interpolate fills placeholders and leaves unknown ones visible', () => {
  assert.equal(interpolate('Hi {name}', { name: 'Ana' }), 'Hi Ana');
  assert.equal(interpolate('Hi {name}', {}), 'Hi {name}');
  assert.equal(interpolate('{n} items', { n: 1200 }, 'de'), '1.200 items');
});

test('translate: plurals per language, fallback to English, then key', () => {
  const en = { 'x.photos': { one: '{count} photo', other: '{count} photos' }, 'x.only': 'Only English' };
  const ar = { 'x.photos': { zero: 'لا صور', one: 'صورة واحدة', two: 'صورتان', few: '{count} صور', many: '{count} صورة', other: '{count} صورة' } };
  assert.equal(translate('en', en, en, 'x.photos', { count: 1 }), '1 photo');
  assert.equal(translate('en', en, en, 'x.photos', { count: 3 }), '3 photos');
  assert.equal(translate('ar', ar, en, 'x.photos', { count: 2 }), 'صورتان');
  assert.equal(translate('ar', ar, en, 'x.photos', { count: 0 }), 'لا صور');
  assert.equal(translate('ar', ar, en, 'x.only'), 'Only English');
  assert.equal(translate('ar', ar, en, 'x.missing'), 'x.missing');
});

test('percent and timers stay left-to-right and use locale digits rules', () => {
  const p = formatPercent(0.5, 'fr');
  assert.ok(p.startsWith(LRI) && p.endsWith(PDI));
  assert.match(p, /50/);
  assert.equal(formatDuration(65, 'en'), `${LRI}1:05${PDI}`);
});

test('pseudo text is accented, keeps placeholders and is at least 40% longer', () => {
  const src = 'Lock {name} now';
  const out = pseudoText(src);
  assert.ok(out.includes('{name}'));
  assert.ok(out.length >= src.length * 1.4);
  assert.doesNotMatch(out.replace('{name}', ''), /[a-z]{3}/);
  assert.deepEqual(placeholders(out), ['name']);
});

test('store follows the phone, honours the override and the pseudo locale', () => {
  configure('system', ['fr-CA']);
  assert.equal(getLocale(), 'fr');
  configure('ja', ['fr-CA']);
  assert.equal(getLocale(), 'ja');
  configure('pseudo', ['fr-CA']);
  assert.notEqual(t('common.tryAgain'), 'Try again');
  configure('system', ['en-US']);
  assert.equal(t('common.tryAgain'), 'Try again');
  assert.equal(tDynamic('nope.key', 'Fallback'), 'Fallback');
});
