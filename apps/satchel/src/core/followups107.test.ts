// T151 run-107 follow-ups: Postcards on Your day on a free afternoon, the Plan this trip again "Coming along"
// summary, copying the children list, the check-out Calendar reminder, Macau sign wording and casual number forms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Item, Trip } from './model.ts';
import {
  afternoon,
  busySpan,
  casualNumber,
  casualPrice,
  CHECKOUT_REMIND_MIN,
  checkoutRemindAt,
  checkoutReminderIcs,
  copyKids,
  copySummary,
  isFreeAfternoon,
  namesShort,
  postcardsBrief,
  SUMMARY_ORDER,
} from './followups107.ts';
import { cleanKids, kidsForFile } from './kids.ts';
import type { PostcardBook } from './postcards.ts';
import { setOut } from './checkin.ts';
import { signCard, signProblems, signRegionFor, type SignTable } from './signs.ts';
import { spellNumber, speakPrice } from './numbers.ts';
import { toUtc } from './tz.ts';
import { followups107 } from '../i18n/en/followups107.ts';
import { followups104 } from '../i18n/en/followups104.ts';

const TOKYO = 'Asia/Tokyo';
const item = (id: string, kind: Item['kind'], start: string, end?: string, tz = TOKYO, extra: Partial<Item> = {}): Item => ({
  id,
  tripId: 't1',
  kind,
  title: id,
  start: { local: start, tz },
  ...(end ? { end: { local: end, tz } } : {}),
  attachments: [],
  ...extra,
});
const trip = (items: Item[]): Trip => ({ id: 't1', name: 'Japan', startDate: '2027-04-01', endDate: '2027-04-07', homeTz: 'Australia/Sydney', items, createdAt: '2027-01-01T00:00:00.000Z' });
const at = (local: string, tz = TOKYO) => toUtc({ local, tz });
const book = (sent: boolean[]): PostcardBook => ({
  people: sent.map((s, i) => ({ id: `p${i}`, name: `P${i}`, lines: [], country: '', sent: s ? { at: '2027-04-02T03:00:00.000Z', date: '2027-04-02', place: 'Tokyo', tz: TOKYO } : null })),
});

// ---- (1) Postcards on a free afternoon ----

test('free afternoon: only timed journeys / activities between 12:00 and 18:00 on the zone clock count', () => {
  const day = '2027-04-03';
  assert.equal(isFreeAfternoon(trip([]), day, TOKYO), true);
  // A morning museum and an evening dinner leave the afternoon free.
  assert.equal(isFreeAfternoon(trip([item('m', 'activity', `${day}T09:00`, `${day}T11:30`), item('d', 'activity', `${day}T18:00`, `${day}T20:00`)]), day, TOKYO), true);
  // A tour ending at 12:30 overlaps.
  assert.equal(isFreeAfternoon(trip([item('t', 'activity', `${day}T10:00`, `${day}T12:30`)]), day, TOKYO), false);
  // No end: an hour (11:30 start runs into 12:30).
  assert.equal(isFreeAfternoon(trip([item('n', 'activity', `${day}T11:30`)]), day, TOKYO), false);
  assert.equal(isFreeAfternoon(trip([item('n', 'activity', `${day}T11:00`)]), day, TOKYO), true);
  // Stays, hire cars, notes and date-only bookings never make it busy.
  assert.equal(isFreeAfternoon(trip([item('h', 'hotel', `${day}T15:00`, '2027-04-05T11:00'), item('c', 'car', `${day}T13:00`, '2027-04-04T13:00'), item('x', 'note', `${day}T14:00`), item('z', 'activity', day)]), day, TOKYO), true);
  assert.equal(busySpan(item('h', 'hotel', `${day}T15:00`)), null);
});

test('free afternoon: judged on real instants (a train in another zone, an overnight flight still under way)', () => {
  const day = '2027-04-03';
  // 11:00 in Seoul is 11:00 Tokyo (same offset): ends 13:00 Seoul = 13:00 Tokyo, busy.
  assert.equal(isFreeAfternoon(trip([item('k', 'train', `${day}T11:00`, `${day}T13:00`, 'Asia/Seoul')]), day, TOKYO), false);
  // A 10:00-11:00 Shanghai train is 11:00-12:00 Tokyo: ends exactly at 12:00, still free.
  assert.equal(isFreeAfternoon(trip([item('s', 'train', `${day}T10:00`, `${day}T11:00`, 'Asia/Shanghai')]), day, TOKYO), true);
  // Overnight flight from Sydney 22:00 the day before landing 14:00 Tokyo: busy.
  const f = item('f', 'flight', '2027-04-02T22:00', `${day}T14:00`, 'Australia/Sydney', { end: { local: `${day}T14:00`, tz: TOKYO } });
  assert.equal(isFreeAfternoon(trip([f]), day, TOKYO), false);
  const a = afternoon(day, TOKYO);
  assert.ok(a && a.to - a.from === 6 * 3600_000);
});

test('free afternoon on a clock-change day: 12:00-18:00 on that zone\'s wall clock', () => {
  // London clocks go forward 01:00 on 28 Mar 2027; the afternoon is still six real hours, judged in London.
  const a = afternoon('2027-03-28', 'Europe/London');
  assert.ok(a);
  assert.equal(a.from, toUtc({ local: '2027-03-28T12:00', tz: 'Europe/London' }));
  assert.equal(a.from, Date.UTC(2027, 2, 28, 11, 0));
});

test('postcards brief: someone still to write to, a free afternoon, until 18:00', () => {
  const day = '2027-04-03';
  const free = trip([item('m', 'activity', `${day}T09:00`, `${day}T11:00`)]);
  assert.deepEqual(postcardsBrief(free, book([false, true, false]), day, TOKYO, at(`${day}T08:00`)), { open: 2, total: 3 });
  assert.deepEqual(postcardsBrief(free, book([false]), day, TOKYO, at(`${day}T17:59`)), { open: 1, total: 1 });
  assert.equal(postcardsBrief(free, book([false]), day, TOKYO, at(`${day}T18:00`)), null, 'over at 18:00');
  assert.equal(postcardsBrief(free, book([true, true]), day, TOKYO, at(`${day}T08:00`)), null, 'all sent');
  assert.equal(postcardsBrief(free, { people: [] }, day, TOKYO, at(`${day}T08:00`)), null, 'nobody listed');
  const busy = trip([item('b', 'bus', `${day}T13:00`, `${day}T15:00`)]);
  assert.equal(postcardsBrief(busy, book([false]), day, TOKYO, at(`${day}T08:00`)), null, 'busy afternoon');
});

// ---- (2) summary ----

test('Plan this trip again summary: chosen parts in a fixed order, Postcards and Children included', () => {
  assert.deepEqual(copySummary({ kids: true, bookings: true, postcards: true, budget: false }), ['bookings', 'postcards', 'kids']);
  assert.deepEqual(copySummary({}), []);
  assert.ok(SUMMARY_ORDER.includes('postcards') && SUMMARY_ORDER.includes('kids'));
  for (const p of SUMMARY_ORDER) assert.ok(`f107.summary.${p}` in followups107, `summary word for ${p}`);
});

// ---- (3) kids ----

test('copyKids: names and bands with new ids, parent and switch kept, kid-friendly marks dropped', () => {
  const data = cleanKids({ children: [{ id: 'k1', name: 'Mia', band: 'child' }, { id: 'k2', name: 'Leo', band: 'toddler' }], parentName: 'Sam', parentPhone: '+61 400 000 000', exportNames: false, kidFriendly: ['i1'] });
  let n = 0;
  const out = copyKids(data, (p) => `${p}-${++n}`);
  assert.deepEqual(out.children, [{ id: 'kid-1', name: 'Mia', band: 'child' }, { id: 'kid-2', name: 'Leo', band: 'toddler' }]);
  assert.equal(out.parentName, 'Sam');
  assert.equal(out.parentPhone, '+61 400 000 000');
  assert.deepEqual(out.kidFriendly, []);
  assert.equal(out.exportNames, false);
  // The copy stays phone-only: with the switch off, a trip file still carries no names.
  assert.equal(kidsForFile(out), undefined);
  assert.deepEqual(copyKids(cleanKids(null), () => 'x').children, []);
});

test('namesShort: up to three names then a count', () => {
  assert.deepEqual(namesShort(['Mia', ' Leo ', '']), { shown: ['Mia', 'Leo'], more: 0 });
  assert.deepEqual(namesShort(['A', 'B', 'C', 'D', 'E']), { shown: ['A', 'B', 'C'], more: 2 });
});

// ---- (4) check-out reminder ----

const words = { summary: 'Check out of Hotel Gracery by 11:00', description: 'Usual time, check your booking.' };

test('check-out reminder: an hour before check-out on the hotel clock, via the check-in ics path', () => {
  const h = item('h1', 'hotel', '2027-04-01T15:00', '2027-04-04T11:00');
  const before = at('2027-04-02T09:00');
  const r = checkoutRemindAt(h, before);
  assert.ok(r);
  assert.equal(r.local, '2027-04-04T10:00');
  assert.equal(r.utc, at('2027-04-04T11:00') - CHECKOUT_REMIND_MIN * 60_000);
  const ics = checkoutReminderIcs(h, words, before);
  assert.ok(ics);
  assert.equal(ics.at, r.utc);
  assert.match(ics.text, /DTSTART:20270404T010000Z/);
  assert.match(ics.text, /DTEND:20270404T013000Z/, 'a half-hour event, as for check-in reminders');
  assert.match(ics.text, /BEGIN:VALARM\r\nACTION:DISPLAY/);
  assert.match(ics.text, /UID:checkin-stayOut-h1@satchel\.trip/);
  assert.match(ics.text, /SUMMARY:Check out of Hotel Gracery by 11:00/);
});

test('check-out reminder: date-only stay uses 10:00 usual, none once passed, ticked or not a stay', () => {
  const d = item('h2', 'hotel', '2027-04-01', '2027-04-04');
  assert.equal(checkoutRemindAt(d, at('2027-04-01T12:00'))?.local, '2027-04-04T09:00');
  const h = item('h1', 'hotel', '2027-04-01T15:00', '2027-04-04T11:00');
  assert.equal(checkoutRemindAt(h, at('2027-04-04T10:00')), null, 'reminder moment reached');
  assert.equal(checkoutReminderIcs(h, words, at('2027-04-04T10:30')), null);
  assert.equal(checkoutRemindAt(setOut(h, true, at('2027-04-04T08:00')), at('2027-04-03T08:00')), null, 'ticked checked out');
  assert.equal(checkoutRemindAt(item('a', 'activity', '2027-04-01T15:00', '2027-04-04T11:00'), at('2027-04-01T12:00')), null);
});

test('check-out reminder: a phone in another zone gets the same instant (London hotel, spring forward between)', () => {
  const h = item('h3', 'hotel', '2027-03-26T15:00', '2027-03-29T11:00', 'Europe/London');
  const r = checkoutRemindAt(h, Date.UTC(2027, 2, 26, 0, 0));
  assert.ok(r);
  assert.equal(r.local, '2027-03-29T10:00');
  assert.equal(r.utc, Date.UTC(2027, 2, 29, 9, 0), 'BST: 10:00 London is 09:00 UTC');
});

// ---- (5) Macau signs ----

const SIGNS = JSON.parse(readFileSync(new URL('../content/signs.json', import.meta.url), 'utf8')) as SignTable;

test('signs: Macau wording (shared Hong Kong lines), native_check, table still clean', () => {
  assert.deepEqual(signProblems(SIGNS), []);
  const zh = SIGNS.languages.find((l) => l.code === 'zh-Hant');
  const mo = zh?.regional?.MO;
  assert.ok(mo);
  assert.equal(mo.roman, 'jyutping');
  for (const [id, line] of Object.entries(mo.lines)) {
    assert.equal(line.native_check, true, id);
    assert.deepEqual(line, zh?.regional?.HK?.lines[id], `${id} matches the Hong Kong line`);
  }
  assert.equal(signRegionFor(SIGNS, 'zh-Hant', ['MO']), 'MO');
  assert.equal(signRegionFor(SIGNS, 'zh-Hant', ['JP', 'MO', 'HK']), 'MO');
  const taxi = signCard(SIGNS, 'zh-Hant', 'taxi', 'MO');
  assert.equal(taxi.text, '的士');
  assert.equal(taxi.region, 'MO');
  assert.equal(taxi.romanSystem, 'jyutping');
  assert.equal(taxi.alt?.region, 'TW');
  assert.equal(taxi.alt?.text, '計程車');
  // 離港 / 抵港 name Hong Kong: not offered as Macau's own wording.
  assert.equal(mo.lines.departures, undefined);
  assert.equal(signCard(SIGNS, 'zh-Hant', 'departures', 'MO').text, '出發');
  // A Taiwan trip still shows Hong Kong as the other wording.
  assert.equal(signCard(SIGNS, 'zh-Hant', 'lift', 'TW').alt?.region, 'HK');
  assert.ok('f107.signs.region.MO' in followups107);
});

// ---- (6) casual numbers ----

test('casual prices: Chinese 块 / 塊 and 毛, closing 毛 dropped', () => {
  assert.deepEqual(
    [casualPrice('zh-Hans', 1250, 'CNY')?.text, casualPrice('zh-Hans', 1250, 'CNY')?.roman],
    ['十二块五', "shí'èr kuài wǔ"],
  );
  assert.equal(casualPrice('zh-Hans', 200, 'CNY')?.text, '两块');
  assert.equal(casualPrice('zh-Hans', 220, 'CNY')?.text, '两块二');
  assert.equal(casualPrice('zh-Hans', 220, 'CNY')?.roman, 'liǎng kuài èr');
  assert.equal(casualPrice('zh-Hans', 50, 'CNY')?.text, '五毛', 'no yuan: the 毛 stays');
  assert.equal(casualPrice('zh-Hans', 1205, 'CNY')?.text, '十二块零五分');
  assert.equal(casualPrice('zh-Hant', 10000, 'TWD')?.text, '一百塊');
  assert.equal(casualPrice('zh-Hant', 10000, 'TWD')?.rule, 'zhKuai');
  assert.equal(casualPrice('zh-Hant', 1250, 'HKD'), null, 'Hong Kong dollars: not offered');
  assert.equal(casualPrice('ja', 120000, 'JPY'), null);
  // The formal reading is untouched.
  assert.equal(speakPrice('zh-Hans', 1250, 'CNY')?.text, '十二元五角');
});

test('casual: Thai ร้อย / พัน without หนึ่ง; Vietnamese ngàn and prices without đồng', () => {
  assert.deepEqual([casualNumber('th', 100)?.text, casualNumber('th', 100)?.roman], ['ร้อย', 'roi']);
  assert.equal(casualNumber('th', 1500)?.text, 'พันห้าร้อย');
  assert.equal(casualNumber('th', 1), null);
  assert.equal(casualNumber('th', 250000), null, 'no leading หนึ่ง');
  assert.equal(casualPrice('th', 12550, 'THB')?.text, 'ร้อยยี่สิบห้าบาทห้าสิบสตางค์');
  assert.equal(casualNumber('vi', 1000)?.text, 'một ngàn');
  assert.equal(casualNumber('vi', 999), null);
  assert.equal(casualPrice('vi', 50000, 'VND')?.text, 'năm mươi ngàn');
  assert.equal(casualPrice('vi', 500, 'VND')?.text ?? null, null, 'under a thousand: nothing casual');
  assert.equal(casualNumber('ko', 100), null);
  for (const r of [casualNumber('th', 100), casualPrice('vi', 50000, 'VND'), casualPrice('zh-Hans', 1250, 'CNY')]) assert.equal(r?.needsCheck, true);
  assert.equal(spellNumber('vi', 1000)?.text, 'một nghìn', 'the main line keeps nghìn');
});

test('catalogue: f107 keys; the never-copied line keeps everything f104 named, adds postcard ticks; screen uses it', () => {
  for (const k of Object.keys(followups107)) assert.ok(k.startsWith('f107.'), k);
  const old = followups104['f104.copy.neverBody'].replace(/ stay with this trip\.$/, '').split(/, | and /);
  for (const w of old) assert.ok(followups107['f107.copy.neverBody'].includes(w.trim()), w);
  assert.match(followups107['f107.copy.neverBody'], /postcard sent ticks/);
  const screen = readFileSync(new URL('../../app/trip-again/[tripId].tsx', import.meta.url), 'utf8');
  assert.ok(screen.includes("t('f107.copy.neverBody')") && !screen.includes("t('f104.copy.neverBody')"));
  assert.ok(screen.includes('copyKidsList(') && screen.includes("t('f107.summary.title')"));
  const brief = readFileSync(new URL('../ui/DayBriefCard.tsx', import.meta.url), 'utf8');
  assert.ok(brief.includes('<PostcardsBriefRow'));
});
