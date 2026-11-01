import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DIET_FLAGS,
  DIET_IDS,
  entryFlags,
  foldText,
  MENU_LANGS,
  menuCount,
  menuLangFor,
  menuLangForCountry,
  menuProblems,
  menuWord,
  menuWords,
  NON_LATIN_MENU_LANGS,
  normaliseDiets,
  parseMenuLangParam,
  pickMenuLang,
  searchMenu,
  toggleDiet,
  watchedFlags,
  type MenuTable,
} from './menu.ts';
import { hasNonLatin, type PhraseTable } from './phrases.ts';

const table = JSON.parse(readFileSync(new URL('../content/menu.json', import.meta.url), 'utf8')) as MenuTable;
const phrases = JSON.parse(readFileSync(new URL('../content/phrases.json', import.meta.url), 'utf8')) as PhraseTable;

test('menu table: no content problems', () => {
  assert.deepEqual(menuProblems(table), []);
});

test('every entry has English, flags and a local word; every language carries at least 100 words', () => {
  for (const e of table.entries) {
    assert.ok(e.en.trim(), e.id);
    assert.ok(Array.isArray(e.flags), `${e.id} flags`);
    assert.ok(Object.keys(e.words).length > 0, `${e.id} words`);
  }
  for (const lang of MENU_LANGS) {
    assert.ok(menuCount(table, lang) >= 100, `${lang}: ${menuCount(table, lang)}`);
    for (const w of menuWords(table, lang)) {
      assert.ok(w.en.trim() && w.text.trim(), `${lang} ${w.id}`);
      assert.ok(Array.isArray(w.flags));
    }
  }
});

test('romanisation is present (and Latin) for non-Latin scripts and absent for Latin ones', () => {
  for (const lang of MENU_LANGS) {
    const nonLatin = NON_LATIN_MENU_LANGS.includes(lang);
    for (const w of menuWords(table, lang)) {
      if (nonLatin) {
        assert.ok(w.roman && w.roman.trim(), `${lang} ${w.id} roman`);
        assert.equal(hasNonLatin(w.roman), false, `${lang} ${w.id} roman is Latin`);
        assert.equal(hasNonLatin(w.text), true, `${lang} ${w.id} local script`);
      } else {
        assert.equal(w.roman, null);
        assert.equal(hasNonLatin(w.text), false, `${lang} ${w.id} Latin`);
      }
    }
  }
});

test('the allergen and marker words the task names are there', () => {
  for (const id of ['pork', 'beef', 'chicken', 'fish', 'shrimp', 'egg', 'milk', 'peanut', 'nuts', 'sesame', 'soy', 'wheat', 'spicy', 'notSpicy', 'beer', 'vegetarian', 'vegan', 'halal']) {
    for (const lang of MENU_LANGS) assert.ok(menuWord(table, lang, id), `${lang} ${id}`);
  }
});

test('menuProblems catches a missing romanisation, a wrong script, an unknown flag and a duplicate', () => {
  const bad: MenuTable = {
    version: 1,
    languages: [...MENU_LANGS],
    entries: [
      { id: 'a', cat: 'meat', flags: ['pork'], en: 'A', words: { ja: { text: '豚肉' }, fr: { text: '豚' } } },
      { id: 'a', cat: 'nope', flags: ['bacon'], en: '', words: {} },
    ],
  };
  const p = menuProblems(bad);
  assert.ok(p.includes('a ja: no romanisation'));
  assert.ok(p.includes('a fr: Latin language has other script'));
  assert.ok(p.includes('a: duplicate id'));
  assert.ok(p.includes('a: unknown flag bacon'));
  assert.ok(p.includes('a: unknown category nope'));
  assert.ok(p.includes('a: empty English'));
  assert.ok(p.includes('a: no local words'));
});

test('foldText: case, accents, tone marks, full width, half-width katakana and hiragana -> katakana', () => {
  assert.equal(foldText('Crème Fraîche'), 'cremefraiche');
  assert.equal(foldText('thịt heo'), 'thitheo');
  assert.equal(foldText('Đậu phụ'), 'dauphu');
  assert.equal(foldText('zhūròu'), 'zhurou');
  assert.equal(foldText('gyūniku'), 'gyuniku');
  assert.equal(foldText('ＴＯＦＵ'), 'tofu');
  assert.equal(foldText('ﾊﾟﾝ'), 'パン');
  assert.equal(foldText('ぱん'), 'パン');
  assert.equal(foldText('えび'), 'エビ');
  assert.equal(foldText('Schweinefleisch'), 'schweinefleisch');
  assert.equal(foldText('Süß'), 'suss');
  assert.equal(foldText('หมู'), 'หมู');
});

test('search from English finds the local word', () => {
  assert.equal(searchMenu(table, 'ja', 'pork')[0].text, '豚肉');
  assert.equal(searchMenu(table, 'fr', 'PORK')[0].text, 'porc');
  assert.equal(searchMenu(table, 'th', 'fish sauce')[0].text, 'น้ำปลา');
  // extra English words: prawns -> shrimp
  assert.equal(searchMenu(table, 'es', 'prawns')[0].id, 'shrimp');
  assert.equal(searchMenu(table, 'de', 'eggplant')[0].id, 'aubergine');
});

test('search from the local word (or its romanisation) finds the English, accent and width insensitive', () => {
  assert.equal(searchMenu(table, 'ja', '豚肉')[0].en, 'Pork');
  assert.equal(searchMenu(table, 'ja', 'butaniku')[0].id, 'pork');
  assert.equal(searchMenu(table, 'zh-Hans', 'zhurou')[0].id, 'pork');
  assert.equal(searchMenu(table, 'vi', 'thit heo')[0].id, 'pork');
  assert.equal(searchMenu(table, 'vi', 'nuoc mam')[0].id, 'fishSauce');
  assert.equal(searchMenu(table, 'fr', 'oeuf')[0].id, 'egg');
  assert.equal(searchMenu(table, 'fr', 'creme')[0].id, 'cream');
  assert.equal(searchMenu(table, 'es', 'jamon')[0].id, 'ham');
  assert.equal(searchMenu(table, 'de', 'kase')[0].id, 'cheese');
  assert.equal(searchMenu(table, 'ko', '돼지고기')[0].id, 'pork');
  assert.equal(searchMenu(table, 'th', 'กุ้ง')[0].id, 'shrimp');
  assert.equal(searchMenu(table, 'pt', 'camarao')[0].id, 'shrimp');
});

test('katakana / hiragana and full / half width all find the same Japanese word', () => {
  for (const q of ['エビ', 'えび', 'ｴﾋﾞ']) assert.equal(searchMenu(table, 'ja', q)[0].id, 'shrimp', q);
  for (const q of ['たこ', 'タコ', 'ﾀｺ']) assert.equal(searchMenu(table, 'ja', q)[0].id, 'octopus', q);
  assert.equal(searchMenu(table, 'ja', 'ＥＢＩ')[0].id, 'shrimp');
  assert.equal(searchMenu(table, 'ja', 'ぱん')[0].id, 'bread');
});

test('search ranks a whole match before a partial one and an empty query lists everything', () => {
  const r = searchMenu(table, 'en' as never, 'x');
  assert.deepEqual(r, []);
  const all = searchMenu(table, 'it', '  ');
  assert.equal(all.length, menuCount(table, 'it'));
  const egg = searchMenu(table, 'it', 'egg');
  assert.equal(egg[0].id, 'egg');
  assert.ok(egg.some((w) => w.id === 'aubergine'), 'eggplant is an extra word for aubergine');
  assert.deepEqual(searchMenu(table, 'it', 'zzqq'), []);
});

test('flags: pork, beef and poultry imply meat; unknown flags are dropped', () => {
  assert.deepEqual(entryFlags({ flags: ['pork'] }), ['meat', 'pork']);
  assert.deepEqual(entryFlags({ flags: ['poultry', 'bogus'] }), ['meat', 'poultry']);
  assert.deepEqual(entryFlags({ flags: [] }), []);
  const chicken = menuWord(table, 'ja', 'chicken');
  assert.ok(chicken?.flags.includes('meat'));
  assert.ok(menuWord(table, 'fr', 'beer')?.flags.includes('alcohol'));
  assert.ok(menuWord(table, 'ko', 'oysterSauce')?.flags.includes('shellfish'));
  assert.ok(menuWord(table, 'th', 'fishSauce')?.flags.includes('fish'));
  assert.ok(menuWord(table, 'de', 'walnut')?.flags.includes('treeNut'));
  assert.ok(menuWord(table, 'es', 'peanut')?.flags.includes('peanut'));
});

test('diet filter: watched flags per diet, highlighting and only-watch', () => {
  assert.deepEqual(watchedFlags(['vegetarian']), ['meat', 'fish', 'shellfish']);
  assert.deepEqual(watchedFlags(['halalStyle']), ['pork', 'alcohol']);
  assert.deepEqual(watchedFlags(['noPork', 'shellfish']), ['pork', 'shellfish']);
  assert.deepEqual(watchedFlags('junk'), []);
  for (const d of DIET_IDS) assert.ok(DIET_FLAGS[d].length > 0, d);

  const veg = menuWords(table, 'ja', ['vegetarian']);
  assert.deepEqual(veg.find((w) => w.id === 'chicken')?.watch, ['meat']);
  assert.deepEqual(veg.find((w) => w.id === 'fishSauce')?.watch, ['fish']);
  assert.deepEqual(veg.find((w) => w.id === 'tofu')?.watch, []);
  assert.deepEqual(veg.find((w) => w.id === 'milk')?.watch, []);
  const vegan = menuWords(table, 'ja', ['vegan']);
  assert.deepEqual(vegan.find((w) => w.id === 'milk')?.watch, ['dairy']);
  assert.deepEqual(vegan.find((w) => w.id === 'honey')?.watch, ['honey']);
  assert.deepEqual(vegan.find((w) => w.id === 'coconutMilk')?.watch, []);
  const halal = menuWords(table, 'vi', ['halalStyle']);
  assert.deepEqual(halal.find((w) => w.id === 'lard')?.watch, ['pork']);
  assert.deepEqual(halal.find((w) => w.id === 'wine')?.watch, ['alcohol']);
  assert.deepEqual(halal.find((w) => w.id === 'beef')?.watch, []);

  const only = searchMenu(table, 'fr', '', { diets: ['peanut'], onlyWatch: true });
  assert.deepEqual(only.map((w) => w.id), ['peanut']);
  assert.ok(searchMenu(table, 'fr', '', { diets: [], onlyWatch: true }).length === 0);
  const shell = searchMenu(table, 'th', '', { diets: ['shellfish'], onlyWatch: true }).map((w) => w.id);
  for (const id of ['shrimp', 'crab', 'oysterSauce', 'shrimpPaste']) assert.ok(shell.includes(id), id);
  assert.ok(!shell.includes('pork'));
});

test('diet list: normalise and toggle keep known ids in the fixed order', () => {
  assert.deepEqual(normaliseDiets(['egg', 'vegan', 'nope', 'egg']), ['vegan', 'egg']);
  assert.deepEqual(normaliseDiets(null), []);
  assert.deepEqual(toggleDiet(['vegan'], 'noPork'), ['vegan', 'noPork']);
  assert.deepEqual(toggleDiet(['vegan', 'noPork'], 'vegan'), ['noPork']);
  assert.deepEqual(toggleDiet('junk', 'sesame'), ['sesame']);
});

test('language: from the route param, the trip country, the last used, the phone, else Japanese', () => {
  assert.equal(parseMenuLangParam('th'), 'th');
  assert.equal(parseMenuLangParam(['vi', 'ja']), 'vi');
  assert.equal(parseMenuLangParam('zh-Hant'), null);
  assert.equal(menuLangFor('zh-Hant'), null);
  assert.equal(menuLangFor('id'), null);
  assert.equal(menuLangFor('ko'), 'ko');
  assert.equal(menuLangForCountry(phrases, 'TH'), 'th');
  assert.equal(menuLangForCountry(phrases, 'mx'), 'es');
  assert.equal(menuLangForCountry(phrases, 'TW'), null);
  assert.equal(menuLangForCountry(phrases, null), null);
  assert.deepEqual(pickMenuLang(phrases, { tripCountry: 'VN', lastUsed: 'fr' }), { lang: 'vi', from: 'trip' });
  assert.deepEqual(pickMenuLang(phrases, { tripCountry: 'TW', lastUsed: 'fr' }), { lang: 'fr', from: 'last' });
  assert.deepEqual(pickMenuLang(phrases, { lastUsed: 'nope', phoneCountry: 'DE' }), { lang: 'de', from: 'phone' });
  assert.deepEqual(pickMenuLang(phrases, {}), { lang: 'ja', from: 'default' });
});

test('every language of the menu has a phrase-table entry (names and countries come from there)', () => {
  for (const lang of MENU_LANGS) assert.ok(phrases.languages.some((l) => l.code === lang), lang);
});
