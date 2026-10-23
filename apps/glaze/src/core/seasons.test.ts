import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUES } from '../i18n/locales/index.ts';
import { lookup } from './i18n.ts';
import { ALL_THEMES } from './plusThemes.ts';
import {
  COLLECTION_IDS,
  DIWALI,
  EASTER,
  LOOKUP_FIRST_YEAR,
  LOOKUP_LAST_YEAR,
  LUNAR_NEW_YEAR,
  RAMADAN,
  SEASONAL_COLLECTIONS,
  activeCollections,
  activeEvents,
  collectionThemes,
  easterSunday,
  formatDay,
  hemisphereOf,
  parseDay,
  regionFromLocaleTag,
  seasonOf,
  type CollectionId,
} from './seasons.ts';
import type { Theme } from './themes.ts';

const on = (iso: string) => activeEvents(parseDay(iso)).map((w) => w.id);
const has = (iso: string, id: string) => on(iso).includes(id as never);

/** Assert the window for `id` is open on firstIso..lastIso and closed the day either side. */
function windowIs(id: string, beforeIso: string, firstIso: string, lastIso: string, afterIso: string) {
  assert.equal(has(beforeIso, id), false, `${id} closed on ${beforeIso}`);
  assert.equal(has(firstIso, id), true, `${id} open on ${firstIso}`);
  assert.equal(has(lastIso, id), true, `${id} open on ${lastIso}`);
  assert.equal(has(afterIso, id), false, `${id} closed on ${afterIso}`);
}

test('Easter table matches the anonymous Gregorian algorithm', () => {
  for (let y = LOOKUP_FIRST_YEAR; y <= LOOKUP_LAST_YEAR; y++) assert.equal(EASTER[y], formatDay(easterSunday(y)), String(y));
  assert.equal(formatDay(easterSunday(2019)), '2019-04-21');
  assert.equal(formatDay(easterSunday(2024)), '2024-03-31');
  assert.equal(formatDay(easterSunday(2025)), '2025-04-20');
});

test('lookup tables cover every year 2026–2031', () => {
  for (let y = LOOKUP_FIRST_YEAR; y <= LOOKUP_LAST_YEAR; y++) {
    for (const table of [EASTER, LUNAR_NEW_YEAR, DIWALI]) {
      assert.ok(table[y]?.startsWith(`${y}-`), String(y));
    }
    assert.ok(RAMADAN.some((r) => r.start.startsWith(`${y}-`)), `Ramadan ${y}`);
  }
  for (const r of RAMADAN) {
    const days = (Date.parse(r.eid) - Date.parse(r.start)) / 86400000;
    assert.ok(days === 29 || days === 30, `${r.start} → ${r.eid}: ${days}`);
  }
});

test('fixed windows open and close on the right days', () => {
  windowIs('christmas', '2026-11-30', '2026-12-01', '2026-12-26', '2026-12-27');
  windowIs('halloween', '2026-10-09', '2026-10-10', '2026-11-01', '2026-11-02');
  windowIs('valentines', '2027-01-31', '2027-02-01', '2027-02-15', '2027-02-16');
});

test('New Year wraps the year end', () => {
  windowIs('new-year', '2026-12-26', '2026-12-27', '2027-01-03', '2027-01-04');
  assert.ok(has('2026-12-31', 'new-year'));
  assert.ok(has('2027-01-01', 'new-year'));
  // Works outside the lookup years too (fixed date).
  assert.ok(has('2040-01-02', 'new-year'));
  assert.ok(has('2039-12-30', 'new-year'));
});

test('moving windows for every lookup year', () => {
  const shift = (iso: string, n: number) => formatDay((() => {
    const t = new Date(Date.parse(iso) + n * 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  })());
  for (let y = LOOKUP_FIRST_YEAR; y <= LOOKUP_LAST_YEAR; y++) {
    const e = EASTER[y];
    windowIs('easter', shift(e, -15), shift(e, -14), shift(e, 1), shift(e, 2));
    const l = LUNAR_NEW_YEAR[y];
    windowIs('lunar-new-year', shift(l, -11), shift(l, -10), shift(l, 15), shift(l, 16));
    const d = DIWALI[y];
    windowIs('diwali', shift(d, -11), shift(d, -10), shift(d, 3), shift(d, 4));
  }
  for (const r of RAMADAN) {
    windowIs('ramadan', shift(r.start, -1), r.start, shift(r.eid, -2), shift(r.eid, -1));
    windowIs('eid-al-fitr', shift(r.eid, -2), shift(r.eid, -1), shift(r.eid, 3), shift(r.eid, 4));
  }
});

test('2030 has two Ramadans, the second running into 2031', () => {
  assert.equal(RAMADAN.filter((r) => r.start.startsWith('2030-')).length, 2);
  assert.ok(has('2030-01-20', 'ramadan'));
  assert.ok(!has('2030-06-01', 'ramadan'));
  assert.ok(has('2030-12-28', 'ramadan'));
  assert.ok(has('2031-01-10', 'ramadan')); // window anchored to 2030 reaching into 2031
  assert.ok(has('2031-01-25', 'eid-al-fitr'));
  assert.ok(has('2031-12-20', 'ramadan'));
  assert.ok(has('2032-01-15', 'eid-al-fitr'));
});

test('outside the lookup years moving events are skipped; Easter is computed', () => {
  assert.ok(!on('2035-02-08').includes('lunar-new-year'));
  assert.ok(!on('2035-11-01').includes('diwali'));
  assert.doesNotThrow(() => activeCollections({ y: 2050, m: 3, d: 1 }, 'AU'));
  const e = easterSunday(2035); // 2035-03-25
  assert.ok(has(formatDay(e), 'easter'));
  assert.ok(has('2025-12-25', 'christmas'));
});

test('hemisphere by region', () => {
  for (const r of ['AU', 'NZ', 'ZA', 'AR', 'CL', 'BR', 'au', ' nz ']) assert.equal(hemisphereOf(r), 'south', r);
  for (const r of ['US', 'GB', 'JP', 'IN', 'DE', 'XX', '', null, undefined]) assert.equal(hemisphereOf(r), 'north', String(r));
  assert.equal(regionFromLocaleTag('en-AU'), 'AU');
  assert.equal(regionFromLocaleTag('zh-Hans-CN'), 'CN');
  assert.equal(regionFromLocaleTag('pt_BR'), 'BR');
  assert.equal(regionFromLocaleTag('es-419'), null);
  assert.equal(regionFromLocaleTag('en'), null);
  assert.equal(regionFromLocaleTag(null), null);
});

test('seasons: AU vs US', () => {
  const months: [number, string, string][] = [
    [1, 'summer', 'winter'], [2, 'summer', 'winter'], [3, 'autumn', 'spring'], [4, 'autumn', 'spring'],
    [5, 'autumn', 'spring'], [6, 'winter', 'summer'], [7, 'winter', 'summer'], [8, 'winter', 'summer'],
    [9, 'spring', 'autumn'], [10, 'spring', 'autumn'], [11, 'spring', 'autumn'], [12, 'summer', 'winter'],
  ];
  for (const [m, au, us] of months) {
    assert.equal(seasonOf({ y: 2027, m, d: 15 }, hemisphereOf('AU')), au, `AU ${m}`);
    assert.equal(seasonOf({ y: 2027, m, d: 15 }, hemisphereOf('US')), us, `US ${m}`);
  }
  // Boundaries: 1 Dec is AU summer, 30 Nov is AU spring.
  assert.equal(seasonOf({ y: 2026, m: 12, d: 1 }, 'south'), 'summer');
  assert.equal(seasonOf({ y: 2026, m: 11, d: 30 }, 'south'), 'spring');
});

test('activeCollections: events first, then the season', () => {
  assert.deepEqual(activeCollections({ y: 2026, m: 10, d: 16 }, 'US'), ['halloween', 'autumn']);
  assert.deepEqual(activeCollections({ y: 2026, m: 10, d: 16 }, 'AU'), ['halloween', 'spring']);
  assert.deepEqual(activeCollections({ y: 2026, m: 12, d: 25 }, 'AU'), ['christmas', 'summer']);
  assert.deepEqual(activeCollections({ y: 2026, m: 12, d: 30 }, null), ['new-year', 'winter']);
  assert.deepEqual(activeCollections({ y: 2026, m: 7, d: 1 }, 'GB'), ['summer']);
  // 2028: Diwali (17 Oct, window from 7 Oct) opens before Halloween (10 Oct).
  assert.deepEqual(activeCollections({ y: 2028, m: 10, d: 12 }, 'IN'), ['diwali', 'halloween', 'autumn']);
  // 2026: Lunar New Year (17 Feb) and Ramadan (18 Feb) overlap, Valentine's opened first.
  assert.deepEqual(activeCollections({ y: 2026, m: 2, d: 14 }, 'AU'), ['valentines', 'lunar-new-year', 'summer']);
  assert.deepEqual(activeCollections({ y: 2026, m: 2, d: 20 }, 'AU'), ['lunar-new-year', 'ramadan', 'summer']);
  // A Date is read by its local calendar day.
  assert.deepEqual(activeCollections(new Date(2026, 11, 1, 0, 5), 'AU'), ['christmas', 'summer']);
});

test('every collection has a label and curated themes that exist', () => {
  const ids = new Set(ALL_THEMES.map((t) => t.id));
  for (const id of COLLECTION_IDS) {
    assert.ok(lookup(CATALOGUES.en, `themes.season.${id}`), `label for ${id}`);
    assert.ok(SEASONAL_COLLECTIONS[id].length >= 3, id);
    for (const tid of SEASONAL_COLLECTIONS[id]) assert.ok(ids.has(tid), `${id}: ${tid}`);
    assert.ok(collectionThemes(id, ALL_THEMES).length >= 3, id);
  }
});

test('collectionThemes: curated first, then any theme tagged with the collection id', () => {
  const extra = { ...ALL_THEMES[0], id: 'future-snow', tags: ['christmas', 'snow'] } as Theme;
  const out = collectionThemes('christmas' as CollectionId, [...ALL_THEMES, extra]).map((t) => t.id);
  assert.deepEqual(out.slice(0, SEASONAL_COLLECTIONS.christmas.length), [...SEASONAL_COLLECTIONS.christmas]);
  assert.ok(out.includes('future-snow'));
  assert.equal(new Set(out).size, out.length);
  // Curated ids missing from the catalogue are skipped.
  assert.deepEqual(collectionThemes('halloween', []), []);
});
