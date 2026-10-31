import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  DEFAULT_PHRASE_LANG,
  cardFontSize,
  PHRASE_IDS,
  PHRASE_LANGS,
  hasNonLatin,
  languageForCountry,
  parseLangParam,
  parsePhraseParam,
  phraseCard,
  phraseCards,
  phraseProblems,
  pickPhraseLang,
  tripCountry,
  type PhraseTable,
} from './phrases.ts';

const table = JSON.parse(readFileSync(new URL('../content/phrases.json', import.meta.url), 'utf8')) as PhraseTable;

test('phrase table: no content problems', () => {
  assert.deepEqual(phraseProblems(table), []);
});

test('every language has every phrase id, non-empty', () => {
  assert.ok(PHRASE_LANGS.length >= 10);
  assert.ok(PHRASE_IDS.length >= 16);
  for (const code of PHRASE_LANGS) {
    const lang = table.languages.find((l) => l.code === code);
    assert.ok(lang, `language ${code}`);
    for (const id of PHRASE_IDS) assert.ok(lang.phrases[id]?.text.trim(), `${code} ${id}`);
    assert.equal(phraseCards(table, code).length, PHRASE_IDS.length, code);
  }
  assert.equal(table.phrases[0].en, 'Where is the toilet?');
  assert.equal(phraseCards(table, 'ja')[0].id, 'toilet');
});

test('non-Latin scripts carry a romanisation; Latin ones do not need one and contain no other script', () => {
  for (const l of table.languages) {
    const nonLatin = Object.values(l.phrases).some((p) => hasNonLatin(p.text));
    assert.equal(!l.latin, nonLatin, `${l.code} latin flag`);
    for (const id of PHRASE_IDS) {
      const card = phraseCard(table, l.code as (typeof PHRASE_LANGS)[number], id);
      assert.ok(card);
      if (l.latin) assert.equal(card.roman, null);
      else {
        assert.ok(card.roman && card.roman.length > 0, `${l.code} ${id} roman`);
        assert.equal(hasNonLatin(card.roman), false, `${l.code} ${id} roman is Latin`);
      }
    }
  }
  assert.equal(hasNonLatin('Nhà vệ sinh ở đâu ạ?'), false);
  assert.equal(hasNonLatin('Qǐngwèn xǐshǒujiān zài nǎlǐ?'), false);
  assert.equal(hasNonLatin('トイレ'), true);
});

test('phraseProblems catches a missing line, a missing romanisation and a wrong Latin flag', () => {
  const broken = JSON.parse(JSON.stringify(table)) as PhraseTable;
  const ja = broken.languages.find((l) => l.code === 'ja')!;
  delete ja.phrases.water;
  ja.phrases.hello = { text: 'こんにちは' };
  const de = broken.languages.find((l) => l.code === 'de')!;
  de.phrases.help = { text: '  ' };
  const ko = broken.languages.find((l) => l.code === 'ko')!;
  ko.latin = true;
  const p = phraseProblems(broken);
  assert.ok(p.includes('ja water: missing'));
  assert.ok(p.includes('ja hello: no romanisation'));
  assert.ok(p.includes('de help: missing'));
  assert.ok(p.some((x) => x.startsWith('ko ') && x.includes('marked Latin')));
});

test('language from a country code', () => {
  assert.equal(languageForCountry(table, 'JP'), 'ja');
  assert.equal(languageForCountry(table, 'jp'), 'ja');
  assert.equal(languageForCountry(table, 'CN'), 'zh-Hans');
  assert.equal(languageForCountry(table, 'KR'), 'ko');
  assert.equal(languageForCountry(table, 'TH'), 'th');
  assert.equal(languageForCountry(table, 'VN'), 'vi');
  assert.equal(languageForCountry(table, 'MX'), 'es');
  assert.equal(languageForCountry(table, 'FR'), 'fr');
  assert.equal(languageForCountry(table, 'AT'), 'de');
  assert.equal(languageForCountry(table, 'IT'), 'it');
  assert.equal(languageForCountry(table, 'BR'), 'pt');
  assert.equal(languageForCountry(table, 'ID'), 'id');
  assert.equal(languageForCountry(table, 'AU'), null);
  assert.equal(languageForCountry(table, ''), null);
  assert.equal(languageForCountry(table, null), null);
});

test('picking the language: trip country, then last used, then phone, then Japanese', () => {
  assert.deepEqual(pickPhraseLang(table, { tripCountry: 'TH', lastUsed: 'fr', phoneCountry: 'DE' }), { lang: 'th', from: 'trip' });
  assert.deepEqual(pickPhraseLang(table, { tripCountry: 'AU', lastUsed: 'fr', phoneCountry: 'DE' }), { lang: 'fr', from: 'last' });
  assert.deepEqual(pickPhraseLang(table, { tripCountry: null, lastUsed: 'xx', phoneCountry: 'DE' }), { lang: 'de', from: 'phone' });
  assert.deepEqual(pickPhraseLang(table, {}), { lang: DEFAULT_PHRASE_LANG, from: 'default' });
  assert.equal(DEFAULT_PHRASE_LANG, 'ja');
});

test('trip country: the demo trip (Sydney -> Tokyo -> Kyoto) picks Japan before and during the trip', () => {
  const trip = demoTrip('2026-11-10');
  // Before the trip: the destination of the trip coming up.
  const before = Date.parse('2026-11-01T00:00:00Z');
  assert.equal(tripCountry([trip], before, '2026-11-01'), 'JP');
  assert.equal(pickPhraseLang(table, { tripCountry: tripCountry([trip], before, '2026-11-01') }).lang, 'ja');
  // During the trip: the country of the current / next booking.
  assert.equal(tripCountry([trip], Date.parse('2026-11-12T03:00:00Z'), '2026-11-12'), 'JP');
  // No trips: nothing to go on.
  assert.equal(tripCountry([], before, '2026-11-01'), null);
  // A trip already over: nothing.
  assert.equal(tripCountry([trip], Date.parse('2027-06-01T00:00:00Z'), '2027-06-01'), null);
});

test('route params', () => {
  assert.equal(parseLangParam('ko'), 'ko');
  assert.equal(parseLangParam(['zh-Hans']), 'zh-Hans');
  assert.equal(parseLangParam('en'), null);
  assert.equal(parseLangParam(undefined), null);
  assert.equal(parsePhraseParam('toilet'), 'toilet');
  assert.equal(parsePhraseParam('nope'), null);
});

test('card font size: short lines bigger, never below 32', () => {
  assert.equal(cardFontSize('Hola'), 52);
  assert.ok(cardFontSize('トイレはどこですか？') >= cardFontSize('Bitte bringen Sie mich zu dieser Adresse.'));
  for (const l of table.languages) for (const p of Object.values(l.phrases)) assert.ok(cardFontSize(p.text) >= 32);
});
