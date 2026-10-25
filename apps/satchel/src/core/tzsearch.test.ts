import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidZone } from './tz.ts';
import { canonicalZone, formatOffset, normalize, parseOffset, searchZones, zoneInfo, zoneList } from './tzsearch.ts';
import { ZONE_TABLE } from './tzzones.ts';

// Northern winter / southern summer, and northern summer.
const JAN = Date.parse('2026-01-15T00:00:00Z');
const JUL = Date.parse('2026-07-15T00:00:00Z');
const top = (q: string, now = JAN) => searchZones(q, { now })[0]?.tz;
const tzs = (q: string, now = JAN) => searchZones(q, { now }).map((z) => z.tz);

test('every zone in the bundled table is a real zone on this engine', () => {
  for (const line of ZONE_TABLE.split('\n').filter((l) => l.trim())) {
    const tz = line.split('|')[0];
    assert.ok(isValidZone(tz), tz);
  }
});

test('zone list: engine names, merged with the bundled table, old aliases folded, no Etc/ zones', () => {
  const list = zoneList();
  assert.ok(list.length > 300, `got ${list.length}`);
  assert.ok(list.includes('Asia/Kolkata'));
  assert.ok(!list.includes('Asia/Calcutta'));
  assert.ok(list.includes('Europe/Kyiv') && !list.includes('Europe/Kiev'));
  assert.ok(list.includes('UTC'));
  assert.ok(!list.some((z) => z.startsWith('Etc/')));
  assert.equal(new Set(list).size, list.length);
  assert.deepEqual([...list].sort(), list);
});

test('zone list falls back to the bundled table without Intl.supportedValuesOf', () => {
  const empty = zoneList(() => []);
  const throws = zoneList(() => {
    throw new Error('no Intl.supportedValuesOf');
  });
  assert.deepEqual(empty, throws);
  assert.ok(empty.length > 150);
  assert.ok(empty.includes('Asia/Tokyo') && empty.includes('America/Sao_Paulo') && empty.includes('UTC'));
  // Unknown names from a source are dropped rather than offered.
  assert.ok(!zoneList(() => ['Mars/Olympus_Mons']).includes('Mars/Olympus_Mons'));
});

test('finds a zone by city, without case or accents', () => {
  assert.equal(top('Tokyo'), 'Asia/Tokyo');
  assert.equal(top('tok'), 'Asia/Tokyo');
  assert.equal(top('são paulo'), 'America/Sao_Paulo');
  assert.equal(top('sao_paulo'), 'America/Sao_Paulo');
  assert.equal(top('ho chi minh'), 'Asia/Ho_Chi_Minh');
  assert.equal(top('LOS ANGELES'), 'America/Los_Angeles');
  assert.equal(top('reykjavík'), 'Atlantic/Reykjavik');
});

test('finds a zone by country or a place that uses it', () => {
  assert.equal(top('Japan'), 'Asia/Tokyo');
  assert.equal(top('kyoto'), 'Asia/Tokyo');
  assert.equal(top('bali'), 'Asia/Makassar');
  assert.equal(top('india'), 'Asia/Kolkata');
  assert.equal(top('mumbai'), 'Asia/Kolkata');
  assert.equal(top('calcutta'), 'Asia/Kolkata');
  assert.equal(top('kiev'), 'Europe/Kyiv');
  assert.equal(top('UK'), 'Europe/London');
  assert.equal(top('canberra'), 'Australia/Sydney');
  assert.equal(top('hawaii'), 'Pacific/Honolulu');
  // A country with several zones lists them all.
  const au = tzs('australia');
  for (const z of ['Australia/Sydney', 'Australia/Perth', 'Australia/Brisbane', 'Australia/Adelaide']) assert.ok(au.includes(z), z);
  const us = tzs('united states');
  for (const z of ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']) assert.ok(us.includes(z), z);
});

test('several words in any order', () => {
  assert.ok(tzs('australia queensland').includes('Australia/Brisbane'));
  assert.equal(top('south africa'), 'Africa/Johannesburg');
  assert.equal(top('new york'), 'America/New_York');
});

test('finds a zone by its IANA name, including one not in the list', () => {
  assert.equal(top('Asia/Tok'), 'Asia/Tokyo');
  assert.equal(top('america/argentina'), 'America/Argentina/Buenos_Aires');
  assert.equal(searchZones('Asia/Tokyo', { now: JAN, zones: ['Europe/Paris'] })[0].tz, 'Asia/Tokyo');
  assert.equal(top('Asia/Calcutta'), 'Asia/Kolkata');
});

test('offset text', () => {
  assert.equal(parseOffset('UTC+9'), 540);
  assert.equal(parseOffset('utc +9'), 540);
  assert.equal(parseOffset('GMT-3'), -180);
  assert.equal(parseOffset('UTC−3:30'), -210);
  assert.equal(parseOffset('+5:30'), 330);
  assert.equal(parseOffset('+0545'), 345);
  assert.equal(parseOffset('-10'), -600);
  assert.equal(parseOffset('utc'), 0);
  assert.equal(parseOffset('UTC+15'), null);
  assert.equal(parseOffset('UTC+5:75'), null);
  assert.equal(parseOffset('tokyo'), null);
  assert.equal(formatOffset(540), 'UTC+9');
  assert.equal(formatOffset(330), 'UTC+5:30');
  assert.equal(formatOffset(-210), 'UTC−3:30');
  assert.equal(formatOffset(0), 'UTC+0');
  assert.equal(parseOffset(formatOffset(-210)), -210);
  assert.equal(parseOffset(formatOffset(345)), 345);
});

test('finds zones by UTC offset, respecting daylight saving on the date', () => {
  const nine = searchZones('UTC+9', { now: JAN });
  assert.ok(nine.length > 3);
  assert.ok(nine.every((z) => z.offset === 540 && z.offsetLabel === 'UTC+9'));
  assert.ok(nine.some((z) => z.tz === 'Asia/Tokyo') && nine.some((z) => z.tz === 'Asia/Seoul'));
  assert.ok(tzs('+5:30').includes('Asia/Kolkata'));
  assert.ok(tzs('UTC+5:45').includes('Asia/Kathmandu'));
  // Sydney is UTC+11 in January (daylight saving) and UTC+10 in July.
  assert.ok(tzs('UTC+11', JAN).includes('Australia/Sydney'));
  assert.ok(tzs('UTC+10', JUL).includes('Australia/Sydney'));
  assert.ok(!tzs('UTC+10', JAN).includes('Australia/Sydney'));
  assert.ok(tzs('utc', JAN).includes('Europe/London'));
  assert.ok(tzs('UTC+1', JUL).includes('Europe/London'));
});

test('an empty query lists every zone west to east; nonsense finds nothing', () => {
  const all = searchZones('', { now: JAN });
  assert.equal(all.length, zoneList().length);
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].offset <= all[i].offset);
  assert.deepEqual(searchZones('zzqx', { now: JAN }), []);
  assert.deepEqual(searchZones('  -- ', { now: JAN }), []);
  assert.ok(searchZones('a', { now: JAN, limit: 5 }).length <= 5);
});

test('zone info and helpers', () => {
  assert.deepEqual(zoneInfo('America/Argentina/Buenos_Aires'), { tz: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires', region: 'America', country: 'Argentina' });
  assert.deepEqual(zoneInfo('UTC'), { tz: 'UTC', city: 'UTC', region: '', country: 'Coordinated Universal Time' });
  assert.equal(zoneInfo('Asia/Calcutta').country, 'India');
  assert.equal(zoneInfo('Antarctica/Troll').country, '');
  assert.equal(canonicalZone('Asia/Saigon'), 'Asia/Ho_Chi_Minh');
  assert.equal(canonicalZone('Asia/Tokyo'), 'Asia/Tokyo');
  assert.equal(normalize('  São_Paulo / Brazil '), 'sao paulo brazil');
  const tokyo = searchZones('tokyo', { now: JAN })[0];
  assert.equal(tokyo.offsetLabel, 'UTC+9');
});
