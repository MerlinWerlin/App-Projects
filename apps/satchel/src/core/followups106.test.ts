// T146 run-106 follow-ups: saved-place / idea Photo light lines joined across local midnight (spotWindows, like the
// day card's dayWindows), a stay's check-out reminder on its last morning with its own "checked out" tick (on
// Item.checkin, kept in .satchel, dropped by Plan this trip again), and Hong Kong sign wording beside Taiwan's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Item, Trip } from './model.ts';
import { dayWindows, photoDay, spotLight, spotWindows } from './photolight.ts';
import { briefCheckout, isDone, isOut, itemStatus, readCheckin, setDone, setOut, tripStatus, windowState, windowsFor } from './checkin.ts';
import { CHECKIN_RULES, copyTrip } from './tripcopy.ts';
import { buildTripFile, parseTripFileText } from './tripfile.ts';
import { searchSigns, SIGN_IDS, signCard, signCards, signProblems, signRegionFor, type SignNames, type SignTable } from './signs.ts';
import { signs as enSigns } from '../i18n/en/signs.ts';
import { followups106 } from '../i18n/en/followups106.ts';
import { localDate, toUtc } from './tz.ts';


// ---- (1) Photo light line on a saved place / idea ----

const REYKJAVIK = { lat: 64.1466, lon: -21.9426 };
const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Iceland',
  startDate: '2027-07-24',
  endDate: '2027-07-28',
  homeTz: 'Australia/Sydney',
  items: [
    {
      id: 'h1',
      tripId: 't1',
      kind: 'hotel',
      title: 'Harbour guesthouse',
      start: { local: '2027-07-24T15:00', tz: 'Atlantic/Reykjavik' },
      end: { local: '2027-07-28T11:00', tz: 'Atlantic/Reykjavik' },
      place: { id: 'p1', name: 'Harbour guesthouse', ...REYKJAVIK },
      attachments: [],
    },
  ],
  createdAt: '2027-01-01T00:00:00.000Z',
  ...extra,
});

test('photo light spot line: windows over midnight are joined (real times), split by kind, same as the day card', () => {
  const t = trip();
  const d = spotLight(t, REYKJAVIK, '2027-07-25', toUtc({ local: '2027-07-20T12:00', tz: 'Atlantic/Reykjavik' }));
  assert.ok(d);
  assert.equal(d.tz, 'Atlantic/Reykjavik');
  const sw = spotWindows(d);
  const all = dayWindows(d);
  assert.deepEqual([...sw.golden, ...sw.blue].map((w) => w.startUtc).sort(), all.map((w) => w.startUtc).sort());
  assert.ok(sw.golden.every((w) => w.kind === 'golden') && sw.blue.every((w) => w.kind === 'blue'));
  // Late July: the evening blue hour runs over midnight; the line now has its real end, not "from 23:5x".
  const blue = sw.blue.find((w) => w.spills);
  assert.ok(blue, 'blue hour over midnight');
  assert.equal(localDate(blue.start), '2027-07-25');
  assert.equal(localDate(blue.end), '2027-07-26');
  assert.equal(blue.toMidnight, false);
  assert.ok(d.windows.some((w) => w.kind === 'blue' && w.toMidnight), 'the clipped list still cut it');
  // The next day sees the same window, marked as carried from the night before.
  const next = photoDay(REYKJAVIK.lat, REYKJAVIK.lon, '2027-07-26', 'Atlantic/Reykjavik');
  assert.ok(next);
  const carried = spotWindows(next).blue.find((w) => w.carried);
  assert.ok(carried);
  assert.equal(carried.startUtc, blue.startUtc);
  assert.equal(carried.endUtc, blue.endUtc);
});

test('photo light spot line: an ordinary day is unchanged', () => {
  const d = photoDay(51.5074, -0.1278, '2027-04-10', 'Europe/London');
  assert.ok(d);
  const sw = spotWindows(d);
  assert.deepEqual(
    [...sw.golden, ...sw.blue].map((w) => [w.kind, w.startUtc, w.endUtc, w.carried, w.spills]).sort(),
    d.windows.map((w) => [w.kind, w.startUtc, w.endUtc, false, false]).sort(),
  );
});

// ---- (2) check-out reminder and tick ----

const TOKYO = 'Asia/Tokyo';
const stay = (over: Partial<Item> = {}): Item => ({
  id: 'h1',
  tripId: 't1',
  kind: 'hotel',
  title: 'Hotel Gracery',
  start: { local: '2027-04-01T15:00', tz: TOKYO },
  end: { local: '2027-04-04T11:00', tz: TOKYO },
  attachments: [],
  ...over,
});
const tk = (local: string) => toUtc({ local, tz: TOKYO });

test('check-out: Your day row on the last morning (hotel clock), until the time or the tick', () => {
  const h = stay();
  const t = { items: [h] };
  assert.equal(briefCheckout(t, tk('2027-04-03T09:00')), null, 'not the day before');
  const b = briefCheckout(t, tk('2027-04-04T07:30'));
  assert.ok(b);
  assert.equal(b.item.id, 'h1');
  assert.equal(b.status.window.kind, 'stayOut');
  assert.equal(b.status.window.closes?.local, '2027-04-04T11:00');
  assert.equal(b.status.minutes, 210);
  assert.equal(briefCheckout(t, tk('2027-04-04T00:00')) !== null, true, 'from 00:00 on the day');
  assert.equal(briefCheckout(t, tk('2027-04-04T11:00')), null, 'gone at the check-out time');
  // Ticked: no row, and the window reads done; the check-in tick alone doesn't cover it.
  const inOnly = setDone(h, true, tk('2027-04-01T15:10'));
  assert.ok(briefCheckout({ items: [inOnly] }, tk('2027-04-04T07:30')));
  const out = setOut(inOnly, true, tk('2027-04-04T08:00'));
  assert.ok(isOut(out) && isDone(out));
  assert.equal(briefCheckout({ items: [out] }, tk('2027-04-04T07:30')), null);
  assert.deepEqual(itemStatus(out, tk('2027-04-04T07:30')).map((s) => [s.window.kind, s.state]), [['stayIn', 'done'], ['stayOut', 'done']]);
  assert.equal(tripStatus({ items: [out] }, tk('2027-04-04T07:30')).some((s) => s.state === 'open'), false);
  // Untick: back again; the check-in tick stays.
  const back = setOut(out, false, tk('2027-04-04T08:05'));
  assert.equal(isOut(back), false);
  assert.equal(isDone(back), true);
  assert.ok(briefCheckout({ items: [back] }, tk('2027-04-04T08:10')));
  // windowState: outDone covers only check-out.
  const [ci, co] = windowsFor(h);
  assert.equal(windowState(co, tk('2027-04-04T08:00'), false, true).state, 'done');
  assert.equal(windowState(ci, tk('2027-04-02T08:00'), false, true).state, 'open');
});

test('check-out: date-only stay uses the usual 10:00; two stays ending the same morning give the earliest; non-stays ignored', () => {
  const a = stay({ id: 'a', end: { local: '2027-04-04', tz: TOKYO } });
  const b = stay({ id: 'b', title: 'Ryokan', end: { local: '2027-04-04T12:00', tz: TOKYO } });
  const f: Item = { id: 'f', tripId: 't1', kind: 'flight', title: 'EA 25', start: { local: '2027-04-04T18:00', tz: TOKYO }, attachments: [] };
  const r = briefCheckout({ items: [b, f, a] }, tk('2027-04-04T06:00'));
  assert.ok(r);
  assert.equal(r.item.id, 'a');
  assert.equal(r.status.window.usual, true);
  assert.equal(r.status.window.closes?.local, '2027-04-04T10:00');
  assert.equal(briefCheckout({ items: [b, f, a] }, tk('2027-04-04T10:30'))?.item.id, 'b');
  // On the hotel's own clock: a phone in Sydney sees the same instant.
  assert.equal(briefCheckout({ items: [stay({ end: { local: '2027-04-04T11:00', tz: 'Europe/Paris' } })] }, toUtc({ local: '2027-04-04T10:59', tz: 'Europe/Paris' }))?.status.minutes, 1);
});

test('check-out tick: read safely, kept in .satchel, dropped by Plan this trip again', () => {
  assert.deepEqual(readCheckin({ outAt: 'nope', doneAt: 3 }), undefined);
  assert.deepEqual(readCheckin({ outAt: '2027-04-04T08:00:00.000Z' }), { outAt: '2027-04-04T08:00:00.000Z' });
  assert.equal(CHECKIN_RULES.outAt, 'drop');
  const h = setOut(stay({ checkin: { closesMin: 30 } }), true, tk('2027-04-04T08:00'));
  const t: Trip = { id: 't1', name: 'Tokyo', startDate: '2027-04-01', endDate: '2027-04-04', homeTz: 'Australia/Sydney', items: [h], createdAt: '2027-01-01T00:00:00.000Z' };
  const built = buildTripFile(t, {}, { packing: null, now: '2027-03-10T00:00:00.000Z' });
  const ok = parseTripFileText(JSON.stringify(built.file));
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.file.items[0].checkin?.outAt, h.checkin?.outAt);
  let n = 0;
  const copy = copyTrip(t, null, { name: 'Tokyo again', startDate: '2028-04-01', parts: { bookings: true, packing: false, bags: false, ideas: false, todos: false, companions: false, budget: false }, newId: (p) => `${p}_${++n}`, now: '2028-01-01T00:00:00.000Z' });
  const c = copy.trip.items[0].checkin;
  assert.equal(c?.outAt, undefined);
  assert.equal(c?.closesMin, 30);
});

// ---- (3) signs: Hong Kong wording, filled lines ----

const table = JSON.parse(readFileSync(new URL('../content/signs.json', import.meta.url), 'utf8')) as SignTable;
const names = Object.fromEntries(SIGN_IDS.map((id) => [id, enSigns[`signs.sign.${id}` as keyof typeof enSigns]])) as SignNames;

test('signs: the table (with Hong Kong wording) has no problems; the 3 nulls are filled and to native-check', () => {
  assert.deepEqual(signProblems(table), []);
  for (const [lang, id] of [['th', 'ticketOffice'], ['th', 'lockers'], ['pt', 'lockers']] as const) {
    const c = signCard(table, lang, id);
    assert.ok(c.text, `${lang} ${id}`);
    assert.equal(c.needsCheck, true);
    if (lang === 'th') assert.ok(c.roman);
  }
  const hk = table.languages.find((l) => l.code === 'zh-Hant')?.regional?.HK;
  assert.ok(hk);
  for (const line of Object.values(hk.lines)) assert.equal(line.native_check, true);
});

test('signs: a Hong Kong trip shows 升降機 with Taiwan 電梯 as the other wording; elsewhere the reverse', () => {
  assert.equal(signRegionFor(table, 'zh-Hant', ['JP', 'hk']), 'HK');
  assert.equal(signRegionFor(table, 'zh-Hant', ['TW', 'HK']), 'TW');
  assert.equal(signRegionFor(table, 'zh-Hant', ['JP']), null);
  assert.equal(signRegionFor(table, 'ja', ['HK']), null);

  const hk = signCard(table, 'zh-Hant', 'lift', 'HK');
  assert.equal(hk.text, '升降機');
  assert.equal(hk.region, 'HK');
  assert.equal(hk.romanSystem, 'jyutping');
  assert.equal(hk.roman, 'sing1 gong3 gei1');
  assert.equal(hk.needsCheck, true);
  assert.deepEqual(hk.alt, { region: 'TW', text: '電梯', roman: 'diàntī', romanSystem: null });

  const tw = signCard(table, 'zh-Hant', 'lift');
  assert.equal(tw.text, '電梯');
  assert.equal(tw.region, 'TW');
  assert.equal(tw.alt?.region, 'HK');
  assert.equal(tw.alt?.text, '升降機');

  // A sign worded the same in both: no alt, the shared line either way.
  const exit = signCard(table, 'zh-Hant', 'exit', 'HK');
  assert.equal(exit.text, '出口');
  assert.equal(exit.alt, null);
  assert.equal(exit.romanSystem, null);
  // Other languages are untouched.
  assert.deepEqual(signCard(table, 'ja', 'lift', 'HK'), signCard(table, 'ja', 'lift'));
  assert.equal(signCard(table, 'ja', 'lift').region, null);
  // The list follows the region.
  assert.equal(signCards(table, 'zh-Hant', 'transport', 'HK').find((c) => c.id === 'taxi')?.text, '的士');
});

test('signs: Hong Kong words are found by search on Traditional Chinese', () => {
  const hits = searchSigns(table, '的士', { names, langs: ['zh-Hant'] });
  assert.equal(hits[0]?.id, 'taxi');
  assert.equal(hits[0]?.lang, 'zh-Hant');
  assert.equal(searchSigns(table, '升降機', { names })[0]?.id, 'lift');
});

test('signs: bad regional wording is reported', () => {
  const broken = structuredClone(table);
  const zh = broken.languages.find((l) => l.code === 'zh-Hant');
  assert.ok(zh?.regional);
  zh.regional.HK.lines.exit = { text: '出口', roman: 'ceot1 hau2', native_check: true };
  zh.regional.HK.lines.stairs = { text: '樓梯', native_check: false };
  const p = signProblems(broken);
  assert.ok(p.includes('zh-Hant-HK exit: same as the main wording'));
  assert.ok(p.includes('zh-Hant-HK stairs: not marked native_check'));
  assert.ok(p.includes('zh-Hant-HK stairs: no romanisation'));
});

test('f106 strings: present and non-empty', () => {
  for (const [k, v] of Object.entries(followups106)) {
    assert.ok(k.startsWith('f106.'), k);
    assert.ok(typeof v === 'string' && v.trim().length > 0, k);
  }
  assert.ok(Object.keys(followups106).length >= 10);
});
