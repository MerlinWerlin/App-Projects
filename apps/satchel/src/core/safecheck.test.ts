import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  addContact,
  appleMapsPinUrl,
  cleanContacts,
  cleanPhone,
  clockStamp,
  composeMessage,
  dmsPart,
  encodeOlc,
  fillTemplate,
  formatDecimal,
  formatDms,
  MAX_CONTACTS,
  nearCandidates,
  nearestPlace,
  OLC_ALPHABET,
  removeContact,
  roundAccuracy,
  SAFE_CONTACTS_KEY,
  smsUrl,
  spellCode,
  validOlcLength,
  type MessageStrings,
} from './safecheck.ts';
import { en } from '../i18n/en.ts';

// ---------------------------------------------------------------------------------- Open Location Code: encode

// Published OLC encoding test vectors (open-location-code test_data/encoding.csv): latitude, longitude, length, code.
const PUBLISHED: [number, number, number, string][] = [
  [20.375, 2.775, 6, '7FG49Q00+'],
  [20.3700625, 2.7821875, 10, '7FG49QCJ+2V'],
  [20.3701125, 2.782234375, 11, '7FG49QCJ+2VX'],
  [20.3701135, 2.78223535156, 13, '7FG49QCJ+2VXGJ'],
  [47.0000625, 8.0000625, 10, '8FVC2222+22'],
  [-41.2730625, 174.7859375, 10, '4VCPPQGP+Q9'],
  [0.5, -179.5, 4, '62G20000+'],
  [-89.5, -179.5, 4, '22220000+'],
  [20.5, 2.5, 4, '7FG40000+'],
  [-89.9999375, -179.9999375, 10, '22222222+22'],
  [0.5, 179.5, 4, '6VGX0000+'],
  [1, 1, 11, '6FH32222+222'],
  // North pole and beyond: latitude 90 (and anything clipped to it) falls in the top cell.
  [90, 1, 4, 'CFX30000+'],
  [92, 1, 4, 'CFX30000+'],
  // Antimeridian: 180 wraps to -180, 181 to -179.
  [1, 180, 4, '62H20000+'],
  [1, 181, 4, '62H30000+'],
];

test('OLC: encodes the published test vectors', () => {
  for (const [lat, lon, len, code] of PUBLISHED) assert.equal(encodeOlc(lat, lon, len), code, `${lat},${lon},${len}`);
});

test('OLC: poles and antimeridian at the default 10 digits stay valid and inside the world', () => {
  // Worked by hand from the spec: top row X... at 90, bottom row 2... at -90; lon 180 == -180.
  assert.equal(encodeOlc(90, 180, 4), 'C2X20000+');
  assert.equal(encodeOlc(-90, 0, 4), '2F220000+');
  assert.equal(encodeOlc(0, 180), encodeOlc(0, -180));
  assert.equal(encodeOlc(10, 540), encodeOlc(10, 180));
  assert.equal(encodeOlc(10, -181), encodeOlc(10, 179));
  for (const [lat, lon] of [[90, 0], [-90, 0], [89.99999, 179.99999], [-90, -180], [0, 179.9999999]] as const) {
    const area = decodeOlc(encodeOlc(lat, lon));
    assert.ok(area.latLo >= -90 && area.latHi <= 90 + 1e-9, `${lat},${lon}`);
    assert.ok(area.lngLo >= -180 && area.lngHi <= 180 + 1e-9, `${lat},${lon}`);
  }
});

test('OLC: lengths the spec forbids throw, odd lengths only from 11', () => {
  assert.equal(validOlcLength(10), true);
  assert.equal(validOlcLength(11), true);
  assert.equal(validOlcLength(15), true);
  for (const bad of [0, 1, 3, 9, 16, 10.5]) {
    assert.equal(validOlcLength(bad), false, String(bad));
    assert.throws(() => encodeOlc(1, 1, bad), RangeError);
  }
  assert.throws(() => encodeOlc(Number.NaN, 1), RangeError);
  assert.throws(() => encodeOlc(1, Number.POSITIVE_INFINITY), RangeError);
  assert.equal(encodeOlc(1, 1, 2), '6F000000+');
  assert.equal(encodeOlc(1, 1, 8), '6FH32222+');
});

// A decoder written here only to check the encoder (the app never decodes): code -> cell bounds.
function decodeOlc(code: string): { latLo: number; latHi: number; lngLo: number; lngHi: number } {
  const clean = code.replace('+', '').replace(/0+$/, '');
  let lat = 0;
  let lng = 0;
  let latRes = 400;
  let lngRes = 400;
  for (let i = 0; i < Math.min(clean.length, 10); i += 2) {
    latRes /= 20;
    lngRes /= 20;
    lat += OLC_ALPHABET.indexOf(clean[i]) * latRes;
    lng += OLC_ALPHABET.indexOf(clean[i + 1]) * lngRes;
  }
  for (let i = 10; i < clean.length; i++) {
    const n = OLC_ALPHABET.indexOf(clean[i]);
    latRes /= 5;
    lngRes /= 4;
    lat += Math.floor(n / 4) * latRes;
    lng += (n % 4) * lngRes;
  }
  return { latLo: lat - 90, latHi: lat - 90 + latRes, lngLo: lng - 180, lngHi: lng - 180 + lngRes };
}

test('OLC: decoder round-trip (the cell holds the point and its centre encodes to the same code)', () => {
  // The decoder agrees with the published vectors' cells.
  const v = decodeOlc('7FG49QCJ+2V');
  assert.ok(Math.abs(v.latLo - 20.37) < 1e-9 && Math.abs(v.lngLo - 2.782125) < 1e-9 && Math.abs(v.latHi - 20.370125) < 1e-9);
  let seed = 97;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 400; i++) {
    const lat = rnd() * 179.8 - 89.9;
    const lon = rnd() * 359.8 - 179.9;
    for (const len of [4, 8, 10, 11, 12, 15]) {
      const code = encodeOlc(lat, lon, len);
      assert.match(code, /^[23456789CFGHJMPQRVWX0]{8}\+[23456789CFGHJMPQRVWX]*$/);
      const a = decodeOlc(code);
      const eps = 1e-9;
      assert.ok(lat >= a.latLo - eps && lat < a.latHi + eps, `${code} lat ${lat}`);
      assert.ok(lon >= a.lngLo - eps && lon < a.lngHi + eps, `${code} lon ${lon}`);
      assert.equal(encodeOlc((a.latLo + a.latHi) / 2, (a.lngLo + a.lngHi) / 2, len), code);
    }
  }
});

test('OLC: spelled out one character at a time for reading aloud', () => {
  assert.equal(spellCode('8FVC2222+22'), '8 F V C 2 2 2 2 + 2 2');
});

// ---------------------------------------------------------------------------------------- coordinates

test('decimal degrees: 5 places, latitude first, no negative zero', () => {
  assert.equal(formatDecimal(48.8583701, 2.2944813), '48.85837, 2.29448');
  assert.equal(formatDecimal(-33.8567844, 151.213108), '-33.85678, 151.21311');
  assert.equal(formatDecimal(-0.000001, -0.000001), '0.00000, 0.00000');
});

test('DMS: hemispheres, zero-padded minutes and seconds, 60″ carries into the next minute and degree', () => {
  assert.equal(formatDms(48.8583701, 2.2944813), '48°51′30.1″N 2°17′40.1″E');
  assert.equal(formatDms(-33.8567844, 151.213108), '33°51′24.4″S 151°12′47.2″E');
  assert.equal(formatDms(40.7128, -74.006), '40°42′46.1″N 74°00′21.6″W');
  assert.deepEqual(dmsPart(10.99999, true), { deg: 11, min: 0, sec: 0, hemi: 'N' });
  assert.deepEqual(dmsPart(-0.5, false), { deg: 0, min: 30, sec: 0, hemi: 'W' });
  assert.equal(formatDms(0, 0), '0°00′00.0″N 0°00′00.0″E');
  assert.equal(formatDms(-90, -180), '90°00′00.0″S 180°00′00.0″W');
  assert.equal(formatDms(1, -1, { n: 'n', s: 's', e: 'o', w: 'w' }), '1°00′00.0″n 1°00′00.0″w');
});

test('accuracy: whole metres under 100, tens beyond, null when unknown', () => {
  assert.equal(roundAccuracy(4.6), 5);
  assert.equal(roundAccuracy(0.3), 1);
  assert.equal(roundAccuracy(143), 140);
  for (const bad of [null, undefined, 0, -5, Number.NaN]) assert.equal(roundAccuracy(bad), null);
});

test('Apple Maps pin link: https, 6 places, encoded label', () => {
  assert.equal(appleMapsPinUrl(48.8583701, 2.2944813), 'https://maps.apple.com/?ll=48.858370,2.294481');
  assert.equal(appleMapsPinUrl(1, 2, 'Me & you'), 'https://maps.apple.com/?ll=1.000000,2.000000&q=Me%20%26%20you');
});

test('clock stamp: phone time with its UTC offset', () => {
  const ms = Date.UTC(2026, 10, 1, 5, 5);
  assert.equal(clockStamp(ms, 540), '14:05 (UTC+9)');
  assert.equal(clockStamp(ms, 330), '10:35 (UTC+5:30)');
  assert.equal(clockStamp(ms, -210), '01:35 (UTC-3:30)');
  assert.equal(clockStamp(ms, 0), '05:05 (UTC)');
});

// ------------------------------------------------------------------------------------------- near a place

const NOW = '2026-10-31T00:00:00Z';
const hotel = (id: string, name: string, lat?: number, lon?: number): Item =>
  ({ id, kind: 'hotel', title: `Stay at ${name}`, start: { local: '2026-11-01T15:00', tz: 'Europe/Paris' }, place: { id: `p${id}`, name, lat, lon } }) as Item;
const trip = (items: Item[], places: Trip['places'] = []): Trip => ({ id: 't', name: 'T', startDate: '2026-11-01', endDate: '2026-11-05', homeTz: 'Europe/Paris', items, places, createdAt: NOW });

test('nearest saved place within 300 m: hotels and saved places, not sample points or unlocated ones', () => {
  const at = { lat: 48.8584, lon: 2.2945 };
  const trips = [
    trip(
      [hotel('h1', 'Hôtel Lumière', 48.8600, 2.2945), hotel('h2', 'No coords'), hotel('h3', 'Far hotel', 48.9, 2.3)],
      [
        { id: 's1', name: 'Café corner', lat: 48.8590, lon: 2.2945, savedAt: NOW },
        { id: 's2', name: 'Sample tower', lat: 48.8584, lon: 2.2945, sample: true, savedAt: NOW },
      ],
    ),
  ];
  const cands = nearCandidates(trips);
  assert.deepEqual(cands.map((c) => c.name), ['Hôtel Lumière', 'Far hotel', 'Café corner']);
  const near = nearestPlace(at, cands);
  assert.equal(near?.name, 'Café corner');
  assert.ok(near && near.meters > 60 && near.meters < 70);
  // 178 m away: still near. Past 300 m: nothing.
  assert.equal(nearestPlace(at, cands.filter((c) => c.kind === 'hotel'))?.name, 'Hôtel Lumière');
  assert.equal(nearestPlace({ lat: 48.8584, lon: 2.2985 }, cands), null);
  assert.equal(nearestPlace({ lat: 48.8584, lon: 2.2985 }, cands, 400)?.name, 'Café corner');
  assert.equal(nearestPlace({ lat: Number.NaN, lon: 0 }, cands), null);
});

test('nearest: a tie goes to the hotel; the same place on two trips is one candidate', () => {
  const p = { id: 's', name: 'Spot', lat: 1, lon: 1, savedAt: NOW };
  const cands = nearCandidates([trip([], [p]), trip([hotel('h', 'Inn', 1, 1)], [p])]);
  assert.equal(cands.length, 2);
  assert.equal(nearestPlace({ lat: 1, lon: 1 }, cands)?.kind, 'hotel');
});

// ---------------------------------------------------------------------------------------------- templates

test('fillTemplate fills placeholders and drops a line whose value is missing or blank', () => {
  assert.equal(fillTemplate('Sent at {time}.', { time: '14:05' }), 'Sent at 14:05.');
  assert.equal(fillTemplate('{a} and {b}', { a: 1, b: 'x' }), '1 and x');
  assert.equal(fillTemplate('My hotel: {hotel}', {}), null);
  assert.equal(fillTemplate('My hotel: {hotel}', { hotel: '  ' }), null);
  assert.equal(fillTemplate('No placeholders', {}), 'No placeholders');
});

const strings = (head: string): MessageStrings => ({
  head,
  time: en['safe.msg.time'],
  near: en['safe.msg.near'],
  coords: en['safe.msg.coords'],
  accuracy: en['safe.msg.accuracy'],
  plus: en['safe.msg.plus'],
  map: en['safe.msg.map'],
  noFix: en['safe.msg.noFix'],
  hotel: en['safe.msg.hotel'],
});

test('composeMessage: every template with time, coordinates, Plus Code, map link, near and hotel', () => {
  for (const k of ['safe', 'landed', 'late', 'help'] as const) {
    const head = en[`safe.tpl.${k}.message`];
    const msg = composeMessage(strings(head), {
      time: '14:05 (UTC+1)',
      position: { lat: 48.8583701, lon: 2.2944813, accuracy: 12.4 },
      near: 'Hôtel Lumière',
      hotel: 'Hôtel Lumière, 1 Rue X, Paris',
    });
    const lines = msg.split('\n');
    assert.equal(lines[0], head);
    assert.ok(msg.includes('14:05 (UTC+1)'));
    assert.ok(msg.includes('48.85837, 2.29448'));
    assert.ok(msg.includes('12 m'));
    assert.ok(msg.includes(encodeOlc(48.8583701, 2.2944813)));
    assert.ok(msg.includes('https://maps.apple.com/?ll=48.858370,2.294481'));
    assert.ok(msg.includes('near Hôtel Lumière'));
    assert.ok(msg.includes('1 Rue X, Paris'));
    assert.ok(!msg.includes('{') && !msg.includes('}'), msg);
    assert.ok(!msg.includes(en['safe.msg.noFix']));
  }
});

test('composeMessage without a location says so and leaves the location lines out', () => {
  const msg = composeMessage(strings(en['safe.tpl.help.message']), { time: '09:00 (UTC)', position: null, hotel: null });
  assert.ok(msg.includes(en['safe.msg.noFix']));
  assert.ok(!msg.includes('maps.apple.com') && !msg.includes('Plus Code'));
  assert.equal(msg.split('\n').length, 3);
  // Unknown accuracy only drops the accuracy line.
  const m2 = composeMessage(strings('Hi'), { time: 't', position: { lat: 1, lon: 1, accuracy: null } });
  assert.ok(m2.includes('1.00000, 1.00000') && !m2.includes(' m.'));
});

// --------------------------------------------------------------------------------------------------- sms:

test('cleanPhone keeps digits and a leading +', () => {
  assert.equal(cleanPhone(' +44 (0)20 7946-0958 '), '+4402079460958');
  assert.equal(cleanPhone('020.7946.0958'), '02079460958');
  for (const bad of ['', '12', 'call me', '+1+2', '1-800-FLOWERS', null, 42]) assert.equal(cleanPhone(bad), null, String(bad));
});

test('sms: URL for iOS with no, one and several recipients; body fully encoded', () => {
  const body = "I'm safe & OK\nMap: https://maps.apple.com/?ll=1.000000,2.000000&q=x #1 +2 ü";
  const enc = encodeURIComponent(body);
  assert.ok(!enc.includes('&') && !enc.includes('#') && !enc.includes('\n') && !enc.includes(' ') && !enc.includes('+'));
  assert.equal(smsUrl([], body), `sms:&body=${enc}`);
  assert.equal(smsUrl(['+44 7700 900123'], body), `sms:+447700900123&body=${enc}`);
  assert.equal(smsUrl(['+44 7700 900123', '0412 345 678', 'bad', '+447700900123'], body), `sms:/open?addresses=%2B447700900123,0412345678&body=${enc}`);
  assert.equal(smsUrl(['+1 555 0100', '555 0101'], 'Hi there', 'android'), 'sms:%2B15550100,5550101?body=Hi%20there');
  assert.equal(decodeURIComponent(smsUrl([], body).slice('sms:&body='.length)), body);
});

// ------------------------------------------------------------------------------------------ trusted contacts

test('trusted contacts: clean, at most five, no duplicate numbers, typed numbers validated', () => {
  assert.deepEqual(cleanContacts(null), []);
  assert.deepEqual(cleanContacts([{ id: 'a', name: '  Sam  ', phone: '+61 412 345 678' }, { id: 'b', name: 'Dup', phone: '+61412345678' }, { id: '', phone: '123' }, 'x']), [
    { id: 'a', name: 'Sam', phone: '+61412345678' },
  ]);
  let list: ReturnType<typeof cleanContacts> = [];
  for (let i = 0; i < MAX_CONTACTS; i++) {
    const r = addContact(list, { name: `P${i}`, phone: `0400 000 00${i}` }, `id${i}`);
    assert.ok(r.ok);
    if (r.ok) list = r.list;
  }
  assert.equal(list.length, 5);
  assert.deepEqual(addContact(list, { phone: '0400 999 999' }, 'x'), { ok: false, reason: 'full' });
  assert.deepEqual(addContact(list, { phone: '0400000001' }, 'x'), { ok: false, reason: 'duplicate' });
  assert.deepEqual(addContact([], { phone: 'nope' }, 'x'), { ok: false, reason: 'phone' });
  assert.equal(addContact([], { name: null, phone: '112233' }, 'n').ok, true);
  assert.deepEqual(removeContact(list, 'id0').map((c) => c.id), ['id1', 'id2', 'id3', 'id4']);
  assert.equal(cleanContacts([...list, { id: 'z', name: 'Six', phone: '0499 999 999' }]).length, 5);
});

test('trusted contacts stay on this phone: never in .satchel trip files', () => {
  assert.equal(SAFE_CONTACTS_KEY, 'satchel.safeContacts.v1');
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts']) {
    assert.doesNotMatch(read(p), /safeContacts|safecheck|SAFE_CONTACTS/i, p);
  }
});

// ----------------------------------------------------------------------------------------------- strings

test('every safe.* string is plain text with no battery claims and the templates exist for every kind', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('safe.'));
  assert.ok(keys.length > 40);
  for (const k of ['safe', 'landed', 'late', 'help']) {
    assert.ok(`safe.tpl.${k}.label` in en && `safe.tpl.${k}.message` in en, k);
  }
  assert.match(en['safe.verify'], /verify/i);
});
