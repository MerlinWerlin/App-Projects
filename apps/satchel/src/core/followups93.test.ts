import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { arrivalView, type ArrivalTables } from './arrival.ts';
import { COUNTRY_CURRENCY, COUNTRY_CURRENCY_SOURCE, currenciesOf, currencyForCountry, currencyName, resetCurrencyNames } from './countrycurrency.ts';
import type { EmergencyTable } from './emergency.ts';
import type { EssentialsTable } from './essentials.ts';
import { isSearchPin, SEARCH_PIN_ID, searchPinTap } from './followups93.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import type { PhraseTable } from './phrases.ts';
import { TOILET_FILTERS_KEY, TOILET_RECENT_KEY, TOILET_SAVED_KEY, TOILET_VIEW_KEY } from './toiletplus.ts';
import { toUtc } from './tz.ts';

const root = new URL('../..', import.meta.url).pathname;
const src = (f: string) => readFileSync(`${root}${f}`, 'utf8');
const read = <T>(f: string) => JSON.parse(src(`src/content/${f}`)) as T;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(`${root}${dir}`)) {
    const p = `${dir}/${name}`;
    if (statSync(`${root}${p}`).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// ------------------------------------------------------------------ Toilets storage keys

test('Toilets tab storage keys live in src/core/toiletplus.ts only; the tab and Map search import them', () => {
  assert.equal(TOILET_SAVED_KEY, 'satchel.toiletplus.saved.v1');
  assert.equal(TOILET_RECENT_KEY, 'satchel.toiletplus.recent.v1');
  assert.equal(TOILET_FILTERS_KEY, 'satchel.toiletplus.filters.v1');
  assert.equal(TOILET_VIEW_KEY, 'satchel.toiletplus.view.v1');
  const offenders = [...walk('app'), ...walk('src')].filter((f) => f !== 'src/core/toiletplus.ts' && !f.endsWith('.test.ts') && /['"`]satchel\.toiletplus\./.test(src(f)));
  assert.deepEqual(offenders, []);
  const search = src('src/ui/MapSearch.tsx');
  assert.match(search, /usePersisted<unknown>\(TOILET_SAVED_KEY/);
  assert.match(search, /usePersisted<unknown>\(TOILET_RECENT_KEY/);
  assert.match(search, /TOILET_RECENT_KEY, TOILET_SAVED_KEY \} from '\.\.\/core\/toiletplus\.ts'/);
  const tab = src('app/(tabs)/toilets.tsx');
  for (const k of ['TOILET_FILTERS_KEY', 'TOILET_SAVED_KEY', 'TOILET_RECENT_KEY', 'TOILET_VIEW_KEY']) assert.match(tab, new RegExp(`usePersisted<[^>]+>\\(${k}`));
});

// ------------------------------------------------------------------ search pin

test('tapping the search pin opens its result card; other pins keep their own handling', () => {
  assert.equal(isSearchPin(SEARCH_PIN_ID), true);
  assert.equal(isSearchPin('p:q'), false);
  assert.deepEqual(searchPinTap(SEARCH_PIN_ID, true, 0), { open: 'result', nonce: 1 });
  assert.deepEqual(searchPinTap(SEARCH_PIN_ID, true, 4), { open: 'result', nonce: 5 });
  assert.deepEqual(searchPinTap(SEARCH_PIN_ID, true, Number.NaN), { open: 'result', nonce: 1 });
  assert.deepEqual(searchPinTap(SEARCH_PIN_ID, false, 3), { open: 'other' });
  assert.deepEqual(searchPinTap('b:x', true, 3), { open: 'other' });
  const map = src('app/(tabs)/map.tsx');
  assert.match(map, /id: SEARCH_PIN_ID,/, 'the map draws the search pin with the shared id');
  assert.match(map, /searchPinTap\(id, !!found, reveal\)/, 'the pin handler asks searchPinTap first');
  assert.match(map, /reveal=\{reveal\}/, 'MapSearch is told to reveal its card');
  assert.doesNotMatch(map, /id: 'q'/);
  const search = src('src/ui/MapSearch.tsx');
  assert.match(search, /key=\{`\$\{picked\.key\}:\$\{reveal\}`\}/, 'the result card re-opens on each reveal');
  assert.match(search, /announceForAccessibility\(t\('f93\.pinOpened'/);
});

// ------------------------------------------------------------------ country -> currency

test('every country in emergency_numbers.json has a currency row (or ISO "no universal currency")', () => {
  const em = read<EmergencyTable>('emergency_numbers.json');
  assert.ok(em.countries.length >= 200);
  const missing = em.countries.map((c) => c.iso2).filter((iso) => !Object.prototype.hasOwnProperty.call(COUNTRY_CURRENCY, iso));
  assert.deepEqual(missing, []);
  for (const c of em.countries) {
    const row = currencyForCountry(c.iso2);
    if (c.iso2 === 'PS' || c.iso2 === 'GS') {
      assert.equal(row, null, `${c.iso2}: ISO 4217 lists no universal currency`);
      continue;
    }
    assert.ok(row, `${c.iso2} ${c.country} has a currency`);
    const codes = currenciesOf(row);
    for (const code of codes) assert.match(code, /^[A-Z]{3}$/, `${c.iso2} ${code}`);
    assert.equal(new Set(codes).size, codes.length, `${c.iso2} lists each currency once`);
  }
});

test('currency table: spot checks against ISO 4217 and recent changes; lookups are defensive', () => {
  const main = (iso: string) => currencyForCountry(iso)?.code;
  assert.deepEqual(
    ['JP', 'US', 'GB', 'FR', 'DE', 'CH', 'AU', 'NZ', 'TH', 'KR', 'CN', 'HK', 'MX', 'IN', 'ZA', 'KW', 'IS'].map(main),
    ['JPY', 'USD', 'GBP', 'EUR', 'EUR', 'CHF', 'AUD', 'NZD', 'THB', 'KRW', 'CNY', 'HKD', 'MXN', 'INR', 'ZAR', 'KWD', 'ISK'],
  );
  // Recent ISO 4217 amendments
  assert.equal(main('HR'), 'EUR');
  assert.equal(main('BG'), 'EUR');
  assert.equal(main('SL'), 'SLE');
  assert.equal(main('ZW'), 'ZWG');
  assert.equal(main('CW'), 'XCG');
  assert.equal(main('SX'), 'XCG');
  assert.equal(main('MR'), 'MRU');
  assert.equal(main('ST'), 'STN');
  assert.equal(main('BY'), 'BYN');
  assert.equal(main('VE'), 'VES');
  assert.deepEqual(currencyForCountry('PA'), { code: 'PAB', also: ['USD'] });
  assert.deepEqual(currencyForCountry('XK'), { code: 'EUR', iso: false });
  assert.equal(currencyForCountry(' jp ')?.code, 'JPY');
  for (const bad of ['', 'J', 'JPN', '12', null, undefined, 'ZZ', 'toString', '__proto__']) assert.equal(currencyForCountry(bad as string), null, String(bad));
  assert.equal(COUNTRY_CURRENCY_SOURCE.checked, '2026-10-31');
  assert.match(COUNTRY_CURRENCY_SOURCE.name, /ISO 4217/);
  // Recorded where the owner can see it
  assert.match(src('docs/THIRD_PARTY.md'), /ISO 4217/);
});

test('currency names: Intl when it knows the code, null otherwise (the card shows the code)', () => {
  const I = Intl as unknown as { DisplayNames?: unknown };
  const saved = I.DisplayNames;
  try {
    resetCurrencyNames();
    const yen = currencyName('JPY', 'en');
    if (typeof saved === 'function') assert.match(yen ?? '', /yen/i);
    assert.equal(currencyName('jpy', 'en'), null);
    I.DisplayNames = undefined;
    resetCurrencyNames();
    assert.equal(currencyName('JPY', 'en'), null);
    I.DisplayNames = function () {
      throw new Error('no');
    };
    resetCurrencyNames();
    assert.equal(currencyName('JPY', 'en'), null);
    I.DisplayNames = class {
      of(code: string) {
        return code;
      }
    };
    resetCurrencyNames();
    assert.equal(currencyName('JPY', 'en'), null, 'an echoed code is not a name');
  } finally {
    I.DisplayNames = saved;
    resetCurrencyNames();
  }
});

// ------------------------------------------------------------------ arrival card money

const tables: ArrivalTables = {
  essentials: read<EssentialsTable>('country_essentials.json'),
  emergency: read<EmergencyTable>('emergency_numbers.json'),
  phrases: read<PhraseTable>('phrases.json'),
};
let n = 0;
function item(kind: ItemKind, start: [string, string], end?: [string, string]): Item {
  n++;
  return { id: `i${n}`, tripId: 't', kind, title: `${kind} ${n}`, start: { local: start[0], tz: start[1] }, end: end ? { local: end[0], tz: end[1] } : undefined, attachments: [] };
}
function trip(homeTz: string, items: Item[], extra: Partial<Trip> = {}): Trip {
  return { id: 't1', name: 'Test', startDate: '2026-12-01', endDate: '2026-12-14', homeTz, items, createdAt: '2026-10-01T00:00:00Z', ...extra };
}
const at = (local: string, tz: string) => toUtc({ local, tz });
const SYD = 'Australia/Sydney';
const TYO = 'Asia/Tokyo';
const NYC = 'America/New_York';
const PTY = 'America/Panama';
const PAR = 'Europe/Paris';
const LON = 'Europe/London';
const japan = trip(SYD, [item('flight', ['2026-12-01T09:30', SYD], ['2026-12-01T17:45', TYO]), item('flight', ['2026-12-05T13:00', TYO], ['2026-12-06T00:30', SYD])]);
const inTokyo = { now: at('2026-12-02T09:00', TYO), phoneZone: SYD, tables };

test('arrival card names the local currency from the table, with or without a rate', () => {
  const noHome = arrivalView(japan, inTokyo);
  assert.deepEqual(noHome?.currency, { code: 'JPY', also: [], sameAsHome: false });
  assert.equal(noHome?.moneyMissing, 'home');
  const noRate = arrivalView({ ...japan, budget: { currency: 'AUD' } }, inTokyo);
  assert.equal(noRate?.currency?.code, 'JPY');
  assert.equal(noRate?.money, null);
  assert.equal(noRate?.moneyMissing, 'rate');
});

test('quick amounts use the local currency when its rate is saved, even if the converter starts elsewhere', () => {
  // The traveller's converter / spending lean to THB (an earlier stop), but a JPY rate is saved: Japan shows yen.
  const t = {
    ...japan,
    budget: { currency: 'AUD' },
    rates: { THB: 0.042, JPY: 0.0102 },
    expenses: [{ id: 'e1', amount: 50000, currency: 'THB', category: 'food' as const, day: '2026-12-02' }],
  };
  const v = arrivalView(t, inTokyo);
  assert.equal(v?.money?.local, 'JPY');
  assert.deepEqual(v?.money?.rows, [{ local: 100, home: 102 }, { local: 500, home: 510 }, { local: 1000, home: 1020 }]);
  // Only a THB rate: the card does not pass baht off as Japan's money.
  const thbOnly = arrivalView({ ...t, rates: { THB: 0.042 } }, inTokyo);
  assert.equal(thbOnly?.money, null);
  assert.equal(thbOnly?.moneyMissing, 'rate');
  assert.equal(thbOnly?.currency?.code, 'JPY');
});

test('a second ISO currency with a saved rate is used; the home currency means nothing to convert', () => {
  const panama = trip(NYC, [item('flight', ['2026-12-01T08:00', NYC], ['2026-12-01T12:00', PTY]), item('flight', ['2026-12-05T13:00', PTY], ['2026-12-05T19:00', NYC])]);
  const inPanama = { now: at('2026-12-02T09:00', PTY), phoneZone: NYC, tables };
  const usd = arrivalView({ ...panama, budget: { currency: 'USD' } }, inPanama);
  assert.deepEqual(usd?.currency, { code: 'PAB', also: ['USD'], sameAsHome: true });
  assert.equal(usd?.money, null);
  assert.equal(usd?.moneyMissing, null);
  const gbp = arrivalView({ ...panama, budget: { currency: 'GBP' }, rates: { USD: 0.79 } }, inPanama);
  assert.equal(gbp?.money?.local, 'USD');
  // A euro traveller in France: same currency, no rows, nothing missing.
  const paris = trip(LON, [item('flight', ['2026-12-01T08:00', LON], ['2026-12-01T10:20', PAR]), item('flight', ['2026-12-05T13:00', PAR], ['2026-12-05T13:30', LON])]);
  const eur = arrivalView({ ...paris, budget: { currency: 'EUR' } }, { now: at('2026-12-02T09:00', PAR), phoneZone: LON, tables });
  assert.equal(eur?.currency?.sameAsHome, true);
  assert.equal(eur?.money, null);
  assert.equal(eur?.moneyMissing, null);
});

test('f93 strings: the card copy says general guidance / verify locally', async () => {
  const { followups93 } = await import('../i18n/en/followups93.ts');
  assert.match(followups93['f93.currencyVerify'], /General guidance/);
  assert.match(followups93['f93.currencyVerify'], /Verify locally/);
  for (const k of Object.keys(followups93)) assert.ok(k.startsWith('f93.'), k);
});
