// T58 (run 85) tests: home country in Settings, the allergen slot, Traditional Chinese for TW/HK/MO and the demo
// trip's sample spending.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { DEMO_TRIP_ID, isSampleExpense, SAMPLE_BUDGET, SAMPLE_EXPENSE_IDS, withSampleSpending } from './demoExtras.ts';
import { adapterHint, findEssentials, HOME_COUNTRY_KEY as CARD_KEY, normaliseHome, type EssentialsTable } from './essentials.ts';
import {
  ALLERGEN_IDS,
  ALLERGENS_KEY,
  allergenLines,
  hasNonLatin,
  isAllergenId,
  languageForCountry,
  normaliseAllergens,
  PHRASE_IDS,
  PHRASE_LANG_KEY,
  PHRASE_LANGS,
  phraseCard,
  phraseCards,
  phraseProblems,
  pickPhraseLang,
  toggleAllergen,
  type PhraseTable,
} from './phrases.ts';
import { HOME_COUNTRY_KEY, homeCountry, homeCountryToStore } from './settings.ts';
import { budgetStatus, isExpense, readSpending, total, totalsByCategory } from './spending.ts';
import { checkFileSpending } from './spending.ts';

const essentials = JSON.parse(readFileSync(new URL('../content/country_essentials.json', import.meta.url), 'utf8')) as EssentialsTable;
const phrases = JSON.parse(readFileSync(new URL('../content/phrases.json', import.meta.url), 'utf8')) as PhraseTable;

// ------------------------------------------------------------------ home country in Settings

test('home country: Settings and the essentials card share one stored key', () => {
  assert.equal(HOME_COUNTRY_KEY, CARD_KEY);
  assert.equal(HOME_COUNTRY_KEY, 'satchel.homeCountry.v1');
});

test('home country: what Settings stores is the value the card reads', () => {
  const au = homeCountryToStore(essentials, 'au');
  assert.equal(au, 'AU');
  assert.equal(normaliseHome(essentials, au), 'AU');
  assert.deepEqual(homeCountry(essentials, au), { iso2: 'AU', country: findEssentials(essentials, 'AU')!.country });
  // Set in Settings, the card's adapter hint for Japan works straight away (AU plug I does not fit JP sockets).
  const hint = adapterHint(findEssentials(essentials, 'JP')!, findEssentials(essentials, au)!);
  assert.equal(hint.verdict, 'adapter');
});

test('home country: clearing, unknown codes and junk storage all mean "not set"', () => {
  assert.equal(homeCountryToStore(essentials, null), null);
  assert.equal(homeCountryToStore(essentials, 'ZZ'), null);
  assert.equal(homeCountryToStore(essentials, 42), null);
  assert.equal(homeCountry(essentials, null), null);
  assert.equal(homeCountry(essentials, 'ZZ'), null);
  assert.equal(homeCountry(essentials, { iso2: 'AU' }), null);
  assert.equal(homeCountry(essentials, ' jp ')?.iso2, 'JP');
});

// ------------------------------------------------------------------ allergen slot

test('allergens: the nine common allergens, stored once under their own key', () => {
  assert.deepEqual([...ALLERGEN_IDS], ['peanuts', 'treeNuts', 'shellfish', 'fish', 'milk', 'egg', 'wheat', 'soy', 'sesame']);
  assert.notEqual(ALLERGENS_KEY, PHRASE_LANG_KEY);
  assert.ok(ALLERGEN_IDS.every(isAllergenId));
  assert.equal(isAllergenId('gluten'), false);
});

test('allergens: stored lists are cleaned and kept in a fixed order', () => {
  assert.deepEqual(normaliseAllergens(['sesame', 'peanuts', 'peanuts', 'nope', 3]), ['peanuts', 'sesame']);
  assert.deepEqual(normaliseAllergens('peanuts'), []);
  assert.deepEqual(normaliseAllergens(null), []);
  assert.deepEqual(toggleAllergen([], 'egg'), ['egg']);
  assert.deepEqual(toggleAllergen(['egg'], 'peanuts'), ['peanuts', 'egg']);
  assert.deepEqual(toggleAllergen(['peanuts', 'egg'], 'peanuts'), ['egg']);
  assert.deepEqual(toggleAllergen('junk', 'soy'), ['soy']);
});

test('allergens: every language carries every allergen, romanised where the script is not Latin', () => {
  assert.deepEqual(phraseProblems(phrases), []);
  for (const code of PHRASE_LANGS) {
    const lines = allergenLines(phrases, code, ALLERGEN_IDS);
    assert.equal(lines.length, ALLERGEN_IDS.length, code);
    const latin = phrases.languages.find((l) => l.code === code)!.latin;
    for (const l of lines) {
      assert.ok(l.text.trim(), `${code} ${l.id}`);
      if (latin) assert.equal(l.roman, null);
      else assert.ok(l.roman && !hasNonLatin(l.roman), `${code} ${l.id} roman`);
    }
  }
});

test('allergens: the allergy card content lists the picked ones in the card language', () => {
  const card = phraseCard(phrases, 'ja', 'allergy');
  assert.equal(card?.text, 'アレルギーがあります。');
  assert.deepEqual(
    allergenLines(phrases, 'ja', ['sesame', 'peanuts']).map((l) => l.text),
    ['ピーナッツ（落花生）', 'ごま'],
  );
  assert.deepEqual(
    allergenLines(phrases, 'ja', ['shellfish']).map((l) => l.roman),
    ['Ebi, kani, kairui'],
  );
  assert.deepEqual(allergenLines(phrases, 'de', ['milk', 'egg']), [
    { id: 'milk', text: 'Milch', roman: null },
    { id: 'egg', text: 'Eier', roman: null },
  ]);
  assert.deepEqual(allergenLines(phrases, 'ko', []), []);
  assert.deepEqual(allergenLines(phrases, 'ko', 'junk'), []);
});

test('allergens: phraseProblems catches a missing allergen and an unknown one', () => {
  const broken = JSON.parse(JSON.stringify(phrases)) as PhraseTable;
  const th = broken.languages.find((l) => l.code === 'th')!;
  delete th.allergens!.sesame;
  th.allergens!.lupin = { text: 'x', roman: 'x' };
  const fr = broken.languages.find((l) => l.code === 'fr')!;
  fr.allergens!.fish = { text: '魚' };
  const p = phraseProblems(broken);
  assert.ok(p.includes('th allergen sesame: missing'));
  assert.ok(p.includes('th allergen lupin: unknown allergen'));
  assert.ok(p.includes('fr allergen fish: marked Latin but has other script'));
});

// ------------------------------------------------------------------ Traditional Chinese

test('zh-Hant: Taiwan, Hong Kong and Macau open Traditional Chinese; mainland China stays Simplified', () => {
  assert.ok((PHRASE_LANGS as readonly string[]).includes('zh-Hant'));
  for (const c of ['TW', 'HK', 'MO', 'tw']) assert.equal(languageForCountry(phrases, c), 'zh-Hant', c);
  assert.equal(languageForCountry(phrases, 'CN'), 'zh-Hans');
  assert.deepEqual(pickPhraseLang(phrases, { tripCountry: 'HK', lastUsed: 'ja' }), { lang: 'zh-Hant', from: 'trip' });
  assert.deepEqual(pickPhraseLang(phrases, { tripCountry: null, phoneCountry: 'TW' }), { lang: 'zh-Hant', from: 'phone' });
});

test('zh-Hant: a full card set in Traditional characters, with no Simplified-only forms', () => {
  const hant = phrases.languages.find((l) => l.code === 'zh-Hant')!;
  assert.equal(hant.native, '繁體中文');
  assert.equal(hant.latin, false);
  assert.equal(phraseCards(phrases, 'zh-Hant').length, PHRASE_IDS.length);
  assert.equal(phraseCard(phrases, 'zh-Hant', 'toilet')?.text, '請問洗手間在哪裡？');
  // Simplified forms used on the zh-Hans card (and in its allergens) that must never appear on the Traditional one.
  const simplifiedOnly = [...'请谢这钱医过帮结账车说会语给带间里鸡虾贝鱼坚麦麸质制黄'];
  const all = [...Object.values(hant.phrases), ...Object.values(hant.allergens ?? {})].map((p) => p.text).join('');
  for (const ch of simplifiedOnly) assert.ok(!all.includes(ch), `simplified ${ch} on the zh-Hant card`);
  // And the matching Traditional forms are there.
  for (const ch of [...'請謝這錢醫過幫結帳車說會給帶間裡雞蝦貝魚堅麥麩質製黃']) assert.ok(all.includes(ch), `traditional ${ch}`);
});

// ------------------------------------------------------------------ demo spending

test('demo spending: a fresh demo seed gets an AUD budget, a JPY rate and sample yen expenses', () => {
  const trip = withSampleSpending(demoTrip('2026-11-10'), '2026-11-07T00:00:00.000Z');
  assert.equal(trip.id, DEMO_TRIP_ID);
  assert.deepEqual(trip.budget, SAMPLE_BUDGET);
  assert.deepEqual(trip.rates, { JPY: 0.0102 });
  const s = readSpending(trip);
  assert.equal(s.expenses.length, SAMPLE_EXPENSE_IDS.length);
  assert.ok(s.expenses.every(isExpense));
  assert.ok(s.expenses.every((e) => e.currency === 'JPY' && isSampleExpense(e) && /\(sample\)$/.test(e.note ?? '')));
  assert.ok(s.expenses.every((e) => e.day >= trip.startDate && e.day <= trip.endDate));
  assert.equal(checkFileSpending(trip as unknown as Record<string, unknown>), true);
});

test('demo spending: totals add up in yen and in the home currency', () => {
  const trip = withSampleSpending(demoTrip('2026-11-10'));
  const s = readSpending(trip);
  const t = total(s.expenses, 'AUD', s.rates);
  assert.deepEqual(t.perCurrency, [{ currency: 'JPY', amount: 11900 }]);
  assert.equal(t.home, 12138); // ¥11,900 × 0.0102 = A$121.38
  assert.deepEqual(t.missing, []);
  const byCat = Object.fromEntries(totalsByCategory(s.expenses, 'AUD', s.rates).map((c) => [c.category, c.home]));
  assert.deepEqual(byCat, { food: 6120, transport: 3672, activities: 510, shopping: 1836 });
  const b = budgetStatus(s)!;
  assert.equal(b.budget, 250000);
  assert.equal(b.spent, 12138);
  assert.equal(b.left, 250000 - 12138);
  assert.equal(b.over, false);
  assert.equal(b.near, false);
  assert.equal(b.partial, false);
});

test('demo spending: never added to other trips or to a demo trip that already has spending', () => {
  const plain = { ...demoTrip('2026-11-10'), id: 'mine', demo: false };
  assert.equal(withSampleSpending(plain), plain);
  const own = { ...demoTrip('2026-11-10'), budget: { currency: 'USD', amount: 100 } };
  assert.equal(withSampleSpending(own), own);
  const seeded = withSampleSpending(demoTrip('2026-11-10'));
  assert.equal(withSampleSpending(seeded), seeded);
  // The demo trip itself (as already stored on phones) is unchanged by T58.
  assert.equal(demoTrip('2026-11-10').expenses, undefined);
  assert.equal(demoTrip('2026-11-10').budget, undefined);
});
