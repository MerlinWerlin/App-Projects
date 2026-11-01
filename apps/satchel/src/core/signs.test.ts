import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { signs as en } from '../i18n/en/signs.ts';
import { PHRASE_LANGS, type PhraseTable } from './phrases.ts';
import {
  foldSign,
  parseSignParam,
  searchSigns,
  SIGN_CATEGORIES,
  SIGN_IDS,
  signCard,
  signCards,
  signFontSize,
  signLangOrder,
  signProblems,
  type SignNames,
  type SignTable,
} from './signs.ts';

const table = JSON.parse(readFileSync(new URL('../content/signs.json', import.meta.url), 'utf8')) as SignTable;
const phrases = JSON.parse(readFileSync(new URL('../content/phrases.json', import.meta.url), 'utf8')) as PhraseTable;
const names = Object.fromEntries(SIGN_IDS.map((id) => [id, en[`signs.sign.${id}` as keyof typeof en]])) as SignNames;
const ids = (q: string, langs?: readonly (typeof PHRASE_LANGS)[number][]) => searchSigns(table, q, { names, langs }).map((h) => h.id);

test('signs: the bundled table has no problems', () => {
  assert.deepEqual(signProblems(table), []);
});

test('signs: every sign has every language as a line or an explicit null, never an empty string', () => {
  assert.equal(table.languages.length, PHRASE_LANGS.length);
  for (const code of PHRASE_LANGS) {
    const l: SignTable['languages'][number] | undefined = table.languages.find((x) => x.code === code);
    if (!l) throw new Error(`no ${code}`);
    for (const id of SIGN_IDS) {
      assert.ok(Object.prototype.hasOwnProperty.call(l.lines, id), `${code} ${id}`);
      const line: SignTable['languages'][number]['lines'][string] = l.lines[id];
      if (line === null) continue;
      assert.ok(line.text.trim().length > 0, `${code} ${id} empty`);
      if (line.roman !== undefined) assert.ok(line.roman.trim().length > 0, `${code} ${id} empty roman`);
      if (!l.latin) assert.ok(line.roman, `${code} ${id} reading`);
    }
  }
  // Raw JSON check too: no "" anywhere in a line.
  assert.ok(!/"text":\s*""|"roman":\s*""/.test(readFileSync(new URL('../content/signs.json', import.meta.url), 'utf8')));
});

test('signs: every translated line is marked native_check, and cards say so', () => {
  let lines = 0;
  for (const l of table.languages) {
    for (const id of SIGN_IDS) {
      const line = l.lines[id];
      if (!line) continue;
      lines++;
      assert.equal(line.native_check, true, `${l.code} ${id}`);
    }
  }
  assert.ok(lines > SIGN_IDS.length * 11, `${lines} lines`);
  for (const lang of PHRASE_LANGS) for (const c of signCards(table, lang)) assert.equal(c.needsCheck, c.text !== null);
  const broken: SignTable = { ...table, languages: table.languages.map((l) => (l.code === 'fr' ? { ...l, lines: { ...l.lines, exit: { text: 'Sortie' } } } : l)) };
  assert.ok(signProblems(broken).includes('fr exit: not marked native_check'));
});

test('signs: content check catches empty strings, missing keys and missing readings', () => {
  const swap = (code: string, id: string, v: unknown): SignTable => ({
    ...table,
    languages: table.languages.map((l) => (l.code === code ? { ...l, lines: { ...l.lines, [id]: v } } : l)) as SignTable['languages'],
  });
  assert.ok(signProblems(swap('de', 'exit', { text: '  ', native_check: true })).includes('de exit: empty text'));
  assert.ok(signProblems(swap('ja', 'exit', { text: '出口', native_check: true })).includes('ja exit: no romanisation'));
  const dropped: SignTable = { ...table, languages: table.languages.map((l) => (l.code === 'it' ? { ...l, lines: Object.fromEntries(Object.entries(l.lines).filter(([k]) => k !== 'taxi')) } : l)) };
  assert.ok(signProblems(dropped).some((p) => p.startsWith('it taxi: missing')));
  // An explicit null is fine and shows as "not written yet".
  assert.deepEqual(signProblems(swap('de', 'exit', null)), []);
  assert.equal(signCard(swap('de', 'exit', null), 'de', 'exit').text, null);
});

test('signs: every sign has an English name, a meaning and a known category', () => {
  for (const id of SIGN_IDS) {
    assert.ok(en[`signs.sign.${id}` as keyof typeof en], id);
    assert.ok(en[`signs.meaning.${id}` as keyof typeof en], id);
    assert.ok((SIGN_CATEGORIES as readonly string[]).includes(table.signs.find((s) => s.id === id)?.category ?? ''), id);
  }
  for (const c of SIGN_CATEGORIES) assert.ok(en[`signs.category.${c}` as keyof typeof en], c);
  for (const c of SIGN_CATEGORIES) assert.ok(signCards(table, 'ja', c).length > 0, c);
  assert.equal(signCards(table, 'ja').length, SIGN_IDS.length);
});

test('signs: folding handles case, accents, full-width and kana', () => {
  assert.equal(foldSign('  Éxit! '), 'exit');
  assert.equal(foldSign('ＥＸＩＴ'), 'exit');
  assert.equal(foldSign('Lối ra'), 'loira');
  assert.equal(foldSign('Đẩy'), 'day');
  assert.equal(foldSign('Schließfächer'), 'schliessfacher');
  assert.equal(foldSign('ﾄｲﾚ'), 'といれ');
  assert.equal(foldSign('トイレ'), 'といれ');
  assert.equal(foldSign('バス停'), 'ばす停');
  assert.equal(foldSign('영업 중'), foldSign('영업중'));
  assert.equal(foldSign('Vietato l’accesso'), 'vietatolaccesso');
});

test('signs: search by English name and extra English words', () => {
  assert.equal(ids('exit')[0], 'exit');
  assert.ok(ids('exit').includes('emergencyExit'));
  assert.equal(ids('elevator')[0], 'lift');
  assert.equal(ids('restroom')[0], 'toilets');
  assert.equal(ids('TOILET')[0], 'toilets');
  assert.equal(ids('wet')[0], 'wetFloor');
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('  ?! '), []);
  assert.deepEqual(ids('zzzz'), []);
  const hit = searchSigns(table, 'taxi', { names })[0];
  assert.equal(hit.match, 'english');
  assert.equal(hit.lang, null);
});

test('signs: search by local text, with accents, full-width and kana normalised', () => {
  assert.equal(ids('出口')[0], 'exit');
  assert.equal(ids('非常口')[0], 'emergencyExit');
  assert.equal(ids('ﾄｲﾚ')[0], 'toilets'); // half-width katakana
  assert.equal(ids('といれ')[0], 'toilets'); // typed in hiragana
  assert.equal(ids('ＳＡＬＩＤＡ')[0], 'exit'); // full-width Latin
  assert.equal(ids('sortie de secours')[0], 'emergencyExit');
  assert.equal(ids('Geoffnet')[0], 'open'); // no umlaut typed
  assert.equal(ids('loi thoat hiem')[0], 'emergencyExit'); // Vietnamese without marks
  assert.equal(ids('출구')[0], 'exit');
  assert.equal(ids('ทางออก')[0], 'exit');
  assert.equal(ids('禁止吸菸')[0], 'noSmoking');
  const local = searchSigns(table, 'Ausgang', { names })[0];
  assert.deepEqual([local.id, local.match, local.lang], ['exit', 'local', 'de']);
  // Romanised readings work too.
  const roman = searchSigns(table, 'deguchi', { names })[0];
  assert.deepEqual([roman.id, roman.match, roman.lang], ['exit', 'roman', 'ja']);
  assert.equal(ids('kinen')[0], 'noSmoking'); // kin'en with the apostrophe left out
});

test('signs: a local text shared by two languages lands on the trip language first', () => {
  // 出口 is the same in Japanese and Chinese.
  assert.equal(searchSigns(table, '出口', { names })[0].lang, 'ja');
  assert.equal(searchSigns(table, '出口', { names, langs: ['zh-Hant'] })[0].lang, 'zh-Hant');
  // "Farmacia" is Spanish and Italian.
  assert.equal(searchSigns(table, 'Farmacia', { names, langs: ['it'] })[0].lang, 'it');
});

test('signs: category filter narrows search and lists', () => {
  assert.deepEqual(
    searchSigns(table, 'exit', { names, category: 'safety' }).map((h) => h.id),
    ['emergencyExit'],
  );
  assert.ok(signCards(table, 'fr', 'toilets').every((c) => c.category === 'toilets'));
});

test('signs: trip-country languages come first, in trip order, then the rest', () => {
  const o = signLangOrder(phrases, ['TH', 'JP', 'TH', 'GB', null, 'MX']);
  assert.deepEqual(o.tripLangs, ['th', 'ja', 'es']);
  assert.deepEqual(o.langs.slice(0, 3), ['th', 'ja', 'es']);
  assert.equal(o.langs.length, PHRASE_LANGS.length);
  assert.equal(new Set(o.langs).size, PHRASE_LANGS.length);
  assert.deepEqual(signLangOrder(phrases, []).langs, [...PHRASE_LANGS]);
  assert.deepEqual(signLangOrder(phrases, ['TW', 'HK']).tripLangs, ['zh-Hant']);
});

test('signs: cards carry readings only for non-Latin scripts and nulls show as missing', () => {
  const ja = signCard(table, 'ja', 'exit');
  assert.equal(ja.text, '出口');
  assert.equal(ja.roman, 'deguchi');
  const fr = signCard(table, 'fr', 'exit');
  assert.equal(fr.roman, null);
  const anyNull = table.languages.flatMap((l) => SIGN_IDS.filter((id) => l.lines[id] === null).map((id) => ({ code: l.code, id })));
  for (const n of anyNull) {
    const c = signCard(table, n.code as (typeof PHRASE_LANGS)[number], n.id);
    assert.equal(c.text, null);
    assert.equal(c.needsCheck, false);
  }
});

test('signs: route param and font size helpers', () => {
  assert.equal(parseSignParam('exit'), 'exit');
  assert.equal(parseSignParam(['lift', 'x']), 'lift');
  assert.equal(parseSignParam('nope'), null);
  assert.ok(signFontSize('出口') > signFontSize('Salida de emergencia'));
});
