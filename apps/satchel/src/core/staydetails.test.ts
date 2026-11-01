import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { encodeQr } from './qr.ts';
import {
  appleMapsAddressUrl,
  cleanStay,
  currentStay,
  dialable,
  EMPTY_STAY,
  escapeWifi,
  essentialsRows,
  isEmptyStay,
  isStayKey,
  MASK,
  maskCode,
  mayReveal,
  shownCode,
  stayKey,
  staySummary,
  wifiPayload,
  wifiQr,
} from './staydetails.ts';
import { buildTripFile } from './tripfile.ts';
import { toUtc } from './tz.ts';

const wifi = (o: Partial<typeof EMPTY_STAY>) => ({ ...EMPTY_STAY, ...o });

// ----------------------------------------------------------------------------------------------- Wi-Fi QR payload

test('Wi-Fi payload: WPA network', () => {
  assert.equal(wifiPayload(wifi({ wifiName: 'Hotel Guest', wifiPassword: 'seabreeze1' })), 'WIFI:T:WPA;S:Hotel Guest;P:seabreeze1;;');
  assert.equal(wifiPayload(wifi({ wifiName: 'Old', wifiPassword: 'abc12', wifiSecurity: 'WEP' })), 'WIFI:T:WEP;S:Old;P:abc12;;');
});

test('Wi-Fi payload escapes \\ ; , : and "', () => {
  assert.equal(escapeWifi('a\\b;c,d:e"f'), 'a\\\\b\\;c\\,d\\:e\\"f');
  assert.equal(escapeWifi('plain name'), 'plain name');
  assert.equal(
    wifiPayload(wifi({ wifiName: 'Café;5G', wifiPassword: 'p:w,"x"\\y' })),
    'WIFI:T:WPA;S:Café\\;5G;P:p\\:w\\,\\"x\\"\\\\y;;',
  );
});

test('Wi-Fi payload: hidden networks add H:true', () => {
  assert.equal(wifiPayload(wifi({ wifiName: 'Back room', wifiPassword: 'secret99', wifiHidden: true })), 'WIFI:T:WPA;S:Back room;P:secret99;H:true;;');
  assert.equal(wifiPayload(wifi({ wifiName: 'Lobby', wifiSecurity: 'nopass', wifiHidden: true })), 'WIFI:T:nopass;S:Lobby;H:true;;');
});

test('Wi-Fi payload: open networks have no password, even one typed earlier', () => {
  assert.equal(wifiPayload(wifi({ wifiName: 'Free Lobby', wifiSecurity: 'nopass' })), 'WIFI:T:nopass;S:Free Lobby;;');
  assert.equal(wifiPayload(wifi({ wifiName: 'Free Lobby', wifiSecurity: 'nopass', wifiPassword: 'left over' })), 'WIFI:T:nopass;S:Free Lobby;;');
});

test('Wi-Fi payload: nothing to join gives null', () => {
  assert.equal(wifiPayload(EMPTY_STAY), null);
  assert.equal(wifiPayload(wifi({ wifiPassword: 'pw123456' })), null);
  assert.equal(wifiPayload(wifi({ wifiName: 'Secured' })), null);
  assert.equal(wifiQr(EMPTY_STAY), null);
});

test('the longest network and password fit the offline QR encoder; an over-long escaped one falls back', () => {
  const long = cleanStay({ wifiName: 'N'.repeat(80), wifiPassword: 'p'.repeat(80), wifiHidden: true });
  assert.equal(long.wifiName.length, 32);
  assert.equal(long.wifiPassword.length, 63);
  const q = wifiQr(long);
  assert.ok(q);
  assert.equal(q.drawable, true);
  assert.ok(encodeQr(q.payload));
  // Every character escaped doubles the length: past what version 10 holds, so the screen shows the text instead.
  const worst = wifiQr(cleanStay({ wifiName: ';'.repeat(32), wifiPassword: '"'.repeat(63), wifiHidden: true }));
  assert.ok(worst);
  assert.equal(worst.drawable, false);
});

// ----------------------------------------------------------------------------------------------- masking

test('codes are masked with a fixed-length mask until revealed', () => {
  assert.equal(maskCode('1234'), MASK);
  assert.equal(maskCode('987654321'), MASK);
  assert.equal(maskCode(''), '');
  assert.equal(shownCode('4821#', false), MASK);
  assert.equal(shownCode('4821#', true), '4821#');
  assert.doesNotMatch(MASK, /\d/);
});

test('Face ID is optional: reveal rules', () => {
  assert.equal(mayReveal(false, null), true);
  assert.equal(mayReveal(true, null), false);
  assert.equal(mayReveal(true, { ok: true }), true);
  assert.equal(mayReveal(true, { ok: false, cannotLock: false }), false); // cancelled: stays hidden
  assert.equal(mayReveal(true, { ok: false, cannotLock: true }), true); // phone can't lock: never locked out
});

test('essentials rows keep every code and the Wi-Fi password masked', () => {
  const s = cleanStay({ room: '412', doorCode: '1357', keyboxCode: '2468', gateCode: '9090', wifiName: 'Guest', wifiPassword: 'hunter22' });
  const rows = essentialsRows(s);
  assert.deepEqual(
    rows.map((r) => r.field),
    ['room', 'doorCode', 'keyboxCode', 'gateCode', 'wifiName', 'wifiPassword'],
  );
  const text = JSON.stringify(rows);
  for (const secret of ['1357', '2468', '9090', 'hunter22']) assert.ok(!text.includes(secret), secret);
  assert.ok(text.includes('412'));
  assert.ok(text.includes('Guest'));
  assert.deepEqual(essentialsRows(EMPTY_STAY), []);
});

// ----------------------------------------------------------------------------------------------- cleaning

test('cleanStay survives junk and trims', () => {
  assert.deepEqual(cleanStay(null), EMPTY_STAY);
  assert.deepEqual(cleanStay('x'), EMPTY_STAY);
  assert.deepEqual(cleanStay([1, 2]), EMPTY_STAY);
  const s = cleanStay({ room: '  12B ', wifiSecurity: 'WPA3?', wifiHidden: 'yes', lockCodes: true, phone: 42, rules: 'x'.repeat(900) });
  assert.equal(s.room, '12B');
  assert.equal(s.wifiSecurity, 'WPA');
  assert.equal(s.wifiHidden, false);
  assert.equal(s.lockCodes, true);
  assert.equal(s.phone, '');
  assert.equal(s.rules.length, 600);
  assert.equal(isEmptyStay(cleanStay({ lockCodes: true })), true);
  assert.equal(isEmptyStay(cleanStay({ bins: 'Tuesday' })), false);
  // Passwords keep their spaces (they can be part of it).
  assert.equal(cleanStay({ wifiPassword: ' a b ' }).wifiPassword, ' a b ');
});

test('summary never carries a code', () => {
  const s = cleanStay({ room: '7', doorCode: '1111', gateCode: '2222', wifiName: 'W', phone: '+44 20', parking: 'Bay 3' });
  assert.deepEqual(staySummary(s), { room: '7', codes: 2, wifi: true, phone: true, notes: 1 });
  assert.ok(!JSON.stringify(staySummary(s)).includes('1111'));
});

test('links: Apple Maps by address and dialable phone numbers', () => {
  assert.equal(appleMapsAddressUrl({ id: 'p', name: 'Hotel Sea', address: '1 Main St, Kyoto' }), 'https://maps.apple.com/?address=1%20Main%20St%2C%20Kyoto&q=Hotel%20Sea');
  assert.equal(appleMapsAddressUrl({ id: 'p', name: ' ', localAddress: '京都' }), 'https://maps.apple.com/?address=%E4%BA%AC%E9%83%BD');
  assert.equal(appleMapsAddressUrl({ id: 'p', name: 'No address' }), null);
  assert.equal(appleMapsAddressUrl(undefined), null);
  assert.equal(dialable('+81 (75) 123-4567'), '+81751234567');
  assert.equal(dialable('020 7946 0000'), '02079460000');
  assert.equal(dialable('ext'), null);
});

// ----------------------------------------------------------------------------------------------- current stay

const hotel = (id: string, start: string, startTz: string, end: string | null, endTz = startTz): Item => ({
  id,
  tripId: 't',
  kind: 'hotel',
  title: id,
  start: { local: start, tz: startTz },
  end: end ? { local: end, tz: endTz } : undefined,
  attachments: [],
});

test('current stay is picked across zones by real instants', () => {
  const tokyo = hotel('tokyo', '2026-11-10T15:00', 'Asia/Tokyo', '2026-11-13T11:00');
  const london = hotel('london', '2026-11-13T15:00', 'Europe/London', '2026-11-16T11:00');
  const trip = { id: 't', items: [london, tokyo] };
  // 13 Nov 10:00 Tokyo = 01:00 London: still in Tokyo before its check-out.
  assert.equal(currentStay([trip], toUtc({ local: '2026-11-13T10:00', tz: 'Asia/Tokyo' }))?.item.id, 'tokyo');
  // 13 Nov 11:30 Tokyo: checked out; London check-in (15:00 London) hasn't come yet.
  assert.equal(currentStay([trip], toUtc({ local: '2026-11-13T11:30', tz: 'Asia/Tokyo' })), null);
  // Same wall clock "16:00" differs by zone: 16:00 London is in the London stay.
  assert.equal(currentStay([trip], toUtc({ local: '2026-11-13T16:00', tz: 'Europe/London' }))?.item.id, 'london');
  assert.equal(currentStay([trip], toUtc({ local: '2026-11-16T12:00', tz: 'Europe/London' })), null);
});

test('current stay: overlaps take the latest check-in; open-ended, unreadable and other kinds are skipped', () => {
  const a = hotel('a', '2026-11-10T15:00', 'Europe/Paris', '2026-11-12T12:00');
  const b = hotel('b', '2026-11-12T10:00', 'Europe/Paris', '2026-11-14T11:00');
  const open = hotel('open', '2026-11-11T09:00', 'Europe/Paris', null);
  const bad = hotel('bad', '2026-11-12T11:00', 'Mars/Olympus', '2026-11-13T11:00');
  const flight: Item = { ...hotel('f', '2026-11-12T10:30', 'Europe/Paris', '2026-11-12T13:00'), kind: 'flight' };
  const trips: Pick<Trip, 'id' | 'items'>[] = [{ id: 't1', items: [a, open, bad] }, { id: 't2', items: [b, flight] }];
  const pick = currentStay(trips, toUtc({ local: '2026-11-12T11:00', tz: 'Europe/Paris' }));
  assert.equal(pick?.item.id, 'b');
  assert.equal(pick?.tripId, 't2');
  assert.equal(currentStay(trips, toUtc({ local: '2026-11-11T10:00', tz: 'Europe/Paris' }))?.item.id, 'a');
  assert.equal(currentStay([], 0), null);
});

// ----------------------------------------------------------------------------------------------- phone-only guard

test('stay details stay on this phone: own key per booking, never in .satchel trip files', () => {
  assert.equal(stayKey('item-1'), 'satchel.stay.v1.item-1');
  assert.notEqual(stayKey('a'), stayKey('b'));
  assert.equal(isStayKey(stayKey('x')), true);
  assert.equal(isStayKey('satchel.stay.v1.'), false);
  assert.equal(isStayKey('satchel.trips.v1'), false);
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts']) {
    assert.doesNotMatch(read(p), /staydetails|stayKey|satchel\.stay|wifi|doorCode|keyboxCode|gateCode/i, p);
  }
  // The key prefix is declared once, in this module.
  assert.equal((read('src/core/staydetails.ts').match(/'satchel\.stay\.v1\.'/g) ?? []).length, 1);
  // A trip file built from a trip whose hotels have stay details saved carries none of them.
  const trip = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const hotels = trip.items.filter((i) => i.kind === 'hotel');
  assert.ok(hotels.length > 0);
  const saved = new Map(hotels.map((h) => [stayKey(h.id), cleanStay({ room: 'Zq412', doorCode: 'Zq1357', wifiName: 'ZqNet', wifiPassword: 'ZqPass' })]));
  assert.equal(saved.size, hotels.length);
  const file = JSON.stringify(buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z' }).file);
  assert.doesNotMatch(file, /satchel\.stay|Zq412|Zq1357|ZqNet|ZqPass|wifi|doorCode/i);
});
