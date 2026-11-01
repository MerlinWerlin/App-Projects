// T112 (run-97 follow-ups, offline parts): stay keys deleted with their booking or trip, the arrival card's stay,
// Wi-Fi from Paste a booking, the gift scroll target, Greek May Day, Matariki to 2035, the Ionicons names used by the
// newest features, and zh-Hant / Indonesian menu words. Every hotel, network and password below is invented.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { arrivalStay, scrollTargetY, stayKeysToDrop } from './followups97.ts';
import { holidaysForYear, orthodoxEaster, shiftDate, weekdayOf } from './holidays.ts';
import { MENU_LANGS, menuLangForCountry, menuProblems, menuWord, menuWords, searchMenu, type MenuTable } from './menu.ts';
import type { PhraseTable } from './phrases.ts';
import type { Item } from './model.ts';
import { parseBookings } from './pasteparse.ts';
import { findWifi, withPastedWifi } from './pastewifi.ts';
import { cleanStay, EMPTY_STAY, stayKey, wifiPayload } from './staydetails.ts';
import { removeItem, removeTrip } from './trips.ts';
import { toUtc } from './tz.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const item = (id: string, kind: Item['kind'], start: string, end: string | null, tz = 'Europe/Paris'): Item => ({
  id,
  tripId: 't',
  kind,
  title: id,
  start: { local: start, tz },
  end: end ? { local: end, tz } : undefined,
  attachments: [],
});

// ----------------------------------------------------------------------------------------------- stay keys

test('stayKeysToDrop: a deleted booking takes its stay key; a deleted trip takes every booking key', () => {
  const h1 = item('h1', 'hotel', '2026-11-10T15:00', '2026-11-12T11:00');
  const h2 = item('h2', 'hotel', '2026-11-12T15:00', '2026-11-14T11:00');
  const f = item('f1', 'flight', '2026-11-10T08:00', '2026-11-10T10:00');
  const trip = { id: 't', name: 'T', startDate: '2026-11-10', endDate: '2026-11-14', homeTz: 'UTC', items: [h1, h2, f] } as unknown as import('./model.ts').Trip;
  const other = { ...trip, id: 'o', items: [item('x', 'hotel', '2026-12-01T15:00', '2026-12-02T11:00')] };
  // One booking deleted: only its key.
  const afterItem = removeItem([trip, other], 't', 'h1');
  assert.deepEqual(stayKeysToDrop([h1], afterItem), [stayKey('h1')]);
  // The whole trip deleted: every booking's key (kind changed later still goes), none of the other trip's.
  const afterTrip = removeTrip([trip, other], 't');
  assert.deepEqual(stayKeysToDrop(trip.items, afterTrip).sort(), [stayKey('f1'), stayKey('h1'), stayKey('h2')].sort());
  assert.ok(!stayKeysToDrop(trip.items, afterTrip).includes(stayKey('x')));
  // A booking with the same id still on the phone keeps the key; empty ids and repeats are ignored.
  assert.deepEqual(stayKeysToDrop([h1, h1, { id: '' }], [{ items: [h1] }]), []);
  assert.deepEqual(stayKeysToDrop([h1, h1], []), [stayKey('h1')]);
});

test('booking and trip deletes call the stay clean-up (wired in the trips store)', () => {
  const src = read('src/state/trips.tsx');
  assert.match(src, /cleanUpTrip\([^)]*\)[\s\S]*forgetStays\(stayKeysToDrop\(trip\.items, remaining\)\)/);
  assert.match(src, /forgetStays\(stayKeysToDrop\(\[item\], remaining\)\)/);
  assert.match(read('src/state/persisted.ts'), /export async function removePersisted/);
});

// ----------------------------------------------------------------------------------------------- arrival stay

test('arrivalStay: the stay you are in, else a check-in within the next 24 hours', () => {
  const a = item('a', 'hotel', '2026-11-10T15:00', '2026-11-12T11:00');
  const b = item('b', 'hotel', '2026-11-12T15:00', '2026-11-14T11:00');
  const later = item('later', 'hotel', '2026-11-20T15:00', '2026-11-21T11:00');
  const trip = { id: 't', items: [later, b, a, item('f', 'flight', '2026-11-12T12:00', '2026-11-12T13:00')] };
  const at = (local: string) => toUtc({ local, tz: 'Europe/Paris' });
  assert.equal(arrivalStay(trip, at('2026-11-11T09:00'))?.item.id, 'a');
  // Between a's check-out and b's check-in: b (today).
  assert.equal(arrivalStay(trip, at('2026-11-12T12:00'))?.item.id, 'b');
  // Landing the evening before a: a is the next check-in within a day.
  assert.equal(arrivalStay(trip, at('2026-11-09T18:00'))?.item.id, 'a');
  // Nothing within a day.
  assert.equal(arrivalStay(trip, at('2026-11-16T09:00')), null);
  assert.equal(arrivalStay({ id: 'e', items: [] }, at('2026-11-11T09:00')), null);
});

// ----------------------------------------------------------------------------------------------- Wi-Fi from a paste

const HOTEL_WITH_WIFI = `Booking confirmation
Your stay at Harbour Lantern Hotel is confirmed.

Harbour Lantern Hotel
1-2-3 Example Street, Shinjuku, Tokyo 160-0022
Tel: +81 3 1234 5678

Check-in: Mon 15 Mar 2027 (from 3:00 PM)
Check-out: Thu 18 Mar 2027 (until 11:00 AM)

Wi-Fi network: Lantern Guest
Wi-Fi password: sea;breeze 42

Your account password: Zq-account-1
Confirmation number: 88412093`;

test('findWifi: labelled network and password lines, in their common shapes', () => {
  assert.deepEqual(findWifi(['Wi-Fi network: Lantern Guest', 'Password: sea;breeze 42']), { name: 'Lantern Guest', password: 'sea;breeze 42' });
  assert.deepEqual(findWifi(['WiFi: Lantern Guest / Password: abc12345']), { name: 'Lantern Guest', password: 'abc12345' });
  assert.deepEqual(findWifi(['WIFI name: "Lantern 5G", password "x y z!"']), { name: 'Lantern 5G', password: 'x y z!' });
  assert.deepEqual(findWifi(['SSID: LanternNet', 'Key: 9988776655']), { name: 'LanternNet', password: '9988776655' });
  assert.deepEqual(findWifi(['Network name (SSID): LanternNet']), { name: 'LanternNet', password: '' });
  assert.deepEqual(findWifi(['WLAN key: k3y-only']), { name: '', password: 'k3y-only' });
  assert.deepEqual(findWifi(['Wireless internet password: pw-1']), { name: '', password: 'pw-1' });
});

test('findWifi: descriptions are not names, and other passwords and codes are not the Wi-Fi password', () => {
  assert.equal(findWifi(['Wi-Fi: free in all rooms', 'Internet: complimentary']), null);
  assert.equal(findWifi(['Your account password: secret123']), null, 'no Wi-Fi word, no network above');
  assert.equal(findWifi(['Door code: 1234', 'Key: collect at reception']), null);
  // A bare password more than two lines below the network is someone else's.
  assert.deepEqual(findWifi(['Wi-Fi network: Lantern', 'Breakfast 7-10', 'Parking: P2', 'Password: account-pw']), { name: 'Lantern', password: '' });
  assert.deepEqual(findWifi(['Wi-Fi: Lantern', 'Password: ask at reception']), { name: 'Lantern', password: '' });
  assert.equal(findWifi([]), null);
  assert.equal(findWifi(['SSID: ' + 'x'.repeat(40)]), null, 'longer than a Wi-Fi name can be');
});

test('Paste a booking: a hotel confirmation offers its Wi-Fi; nothing of it reaches the booking draft', () => {
  const [h] = parseBookings(HOTEL_WITH_WIFI, { now: '2026-11-01', fallbackTz: 'Australia/Sydney' });
  assert.equal(h.kind, 'hotel');
  assert.deepEqual(h.wifi, { name: 'Lantern Guest', password: 'sea;breeze 42' });
  assert.equal(h.draft.title, 'Harbour Lantern Hotel');
  assert.equal(h.draft.ref, '88412093');
  assert.doesNotMatch(JSON.stringify(h.draft), /Lantern Guest|sea;breeze|Zq-account/);
  // Wi-Fi lines above the booking count when there is one hotel; non-hotel bookings never carry Wi-Fi.
  const [top] = parseBookings(`Wi-Fi: TopNet / Password: top-pass\n\n${HOTEL_WITH_WIFI.replace(/Wi-Fi network.*\nWi-Fi password.*\n/, '')}`, { now: '2026-11-01' });
  assert.deepEqual(top.wifi, { name: 'TopNet', password: 'top-pass' });
  const [train] = parseBookings('Your train tickets\nTrain: Hikari 503\nFrom: Tokyo Station To: Kyoto Station\nDate: 18/03/2027 09:00\nWi-Fi: TrainNet', { now: '2026-11-01' });
  assert.equal(train?.wifi, undefined);
});

test('withPastedWifi fills only empty fields and never overwrites a saved network or password', () => {
  const filled = withPastedWifi(EMPTY_STAY, { name: 'Lantern Guest', password: 'sea;breeze' });
  assert.ok(filled);
  assert.equal(filled.wifiName, 'Lantern Guest');
  assert.equal(filled.wifiPassword, 'sea;breeze');
  assert.equal(wifiPayload(cleanStay(filled)), 'WIFI:T:WPA;S:Lantern Guest;P:sea\\;breeze;;');
  const saved = { ...EMPTY_STAY, wifiName: 'Own', wifiPassword: 'mine' };
  assert.equal(withPastedWifi(saved, { name: 'Lantern Guest', password: 'x' }), null);
  // Saved network with no password: the pasted password only if it is for the same network.
  assert.equal(withPastedWifi({ ...EMPTY_STAY, wifiName: 'Own' }, { name: 'Other', password: 'x' }), null);
  assert.equal(withPastedWifi({ ...EMPTY_STAY, wifiName: 'Own' }, { name: 'Own', password: 'x' })?.wifiPassword, 'x');
  assert.equal(withPastedWifi(EMPTY_STAY, { name: '', password: 'only' })?.wifiPassword, 'only');
});

// ----------------------------------------------------------------------------------------------- gift scroll

test('scrollTargetY: the gift lands just below the scroll view top, never above 0', () => {
  assert.equal(scrollTargetY(0, 900, 100, 16), 784);
  assert.equal(scrollTargetY(500, 300, 100, 16), 684);
  assert.equal(scrollTargetY(0, 50, 100, 16), 0);
  assert.equal(scrollTargetY(200, Number.NaN, 100, 16), 200);
});

// ----------------------------------------------------------------------------------------------- holidays

test('Greece: May Day left out only in Holy Week or on Easter Sunday / Monday (moved by ministerial decision)', () => {
  const mayDay = (y: number) => holidaysForYear('GR', y).filter((h) => h.name === 'Labour Day').map((h) => h.date);
  for (let y = 2023; y <= 2035; y++) {
    const e = orthodoxEaster(y);
    const may1 = `${y}-05-01`;
    const moved = may1 >= shiftDate(e, -6) && may1 <= shiftDate(e, 1);
    assert.deepEqual(mayDay(y), moved ? [] : [may1], `${y} (Easter ${e})`);
  }
  // Published Orthodox Easter dates the rule hangs on, and the years it applies to.
  assert.equal(orthodoxEaster(2024), '2024-05-05');
  assert.equal(orthodoxEaster(2027), '2027-05-02');
  assert.equal(orthodoxEaster(2030), '2030-04-28');
  assert.deepEqual(mayDay(2024), []);
  assert.deepEqual(mayDay(2027), []);
  assert.deepEqual(mayDay(2032), []);
  // Bright Wednesday (2030), Easter Tuesday (2035) and Thomas Sunday (2033) keep 1 May, as in 2008 and 2019.
  assert.deepEqual(mayDay(2030), ['2030-05-01']);
  assert.deepEqual(mayDay(2033), ['2033-05-01']);
  assert.deepEqual(mayDay(2035), ['2035-05-01']);
  assert.deepEqual(mayDay(2026), ['2026-05-01']);
});

test('New Zealand: Matariki every covered year, on a Friday near the Pipiri last-quarter moon', () => {
  const expected: Record<number, string> = {
    2031: '2031-07-11',
    2032: '2032-07-02',
    2033: '2033-06-24',
    2034: '2034-07-07',
    2035: '2035-06-29',
  };
  // Mean last-quarter moons from the 6 Jan 2000 new moon (good to about half a day): the Tangaroa nights follow it.
  const SYN = 29.530588853;
  const NM0 = Date.UTC(2000, 0, 6, 18, 14) / 864e5;
  for (let y = 2023; y <= 2035; y++) {
    const m = holidaysForYear('NZ', y).filter((h) => h.name === 'Matariki');
    assert.equal(m.length, 1, `${y}`);
    const date = m[0].date;
    if (expected[y]) assert.equal(date, expected[y]);
    assert.equal(weekdayOf(date), 5, `${y} Friday`);
    assert.ok(date >= `${y}-06-19` && date <= `${y}-07-15`, `${y} in Pipiri`);
    const day = Date.parse(`${date}T00:00:00Z`) / 864e5;
    const k = Math.round((day - NM0 - 0.75 * SYN) / SYN);
    const lq = NM0 + 0.75 * SYN + k * SYN;
    assert.ok(Math.abs(day - lq) <= 4.5, `${y}: ${(day - lq).toFixed(1)} days from last quarter`);
  }
});

// ----------------------------------------------------------------------------------------------- Ionicons names

/**
 * Ionicons 7 glyphs (@expo/vector-icons 15) the newest features use, each checked by hand against the published
 * Ionicons set (no glyph map is in this repo offline: node_modules is absent and the tsc stubs type icon names as
 * string). A new name in these files must be added here only after checking it exists.
 */
const CHECKED_IONICONS = new Set([
  'add', 'airplane', 'alert-circle', 'alert-circle-outline', 'analytics-outline', 'bag-check-outline', 'bag-handle-outline',
  'bar-chart-outline', 'bed-outline', 'train-outline', 'bulb-outline', 'bus-outline', 'calculator-outline', 'call', 'call-outline',
  'camera-outline', 'car-outline', 'card', 'card-outline', 'cash-outline', 'checkbox', 'checkmark', 'checkmark-circle',
  'checkmark-circle-outline', 'chevron-back', 'chevron-forward', 'close', 'copy-outline', 'create-outline', 'cube-outline',
  'document-text-outline', 'ellipsis-horizontal-circle-outline', 'expand-outline', 'eye-off-outline', 'flag-outline',
  'flash-outline', 'gift-outline', 'happy-outline', 'image-outline', 'information-circle-outline', 'key-outline',
  'keypad-outline', 'language-outline', 'locate-outline', 'map-outline', 'medkit-outline', 'nutrition-outline',
  'options-outline', 'people-outline', 'person-add-outline', 'person-outline', 'pie-chart-outline', 'qr-code-outline',
  'receipt-outline', 'restaurant-outline', 'return-down-back-outline', 'search-outline', 'share-outline',
  'shield-checkmark-outline', 'speedometer-outline', 'square-outline', 'swap-horizontal', 'swap-horizontal-outline',
  'ticket-outline', 'time-outline', 'trash-outline', 'wallet', 'wallet-outline', 'wifi-outline', 'male-female-outline',
  'compass-outline', 'chatbubbles-outline', 'calendar-outline', 'lock-closed', 'clipboard-outline', 'checkmark-done',
  'briefcase-outline', 'mail-open-outline', 'add-circle-outline', 'remove-circle-outline', 'remove', 'warning-outline', 'cloud-offline',
]);

const NEWEST_FEATURE_FILES = [
  'app/menu.tsx',
  'app/menu-card.tsx',
  'app/stay/[itemId].tsx',
  'src/ui/stay.tsx',
  'src/ui/slots/EssentialsStay.tsx',
  'app/tipping.tsx',
  'app/holidays/[tripId].tsx',
  'src/ui/HolidaysCard.tsx',
  'app/gifts/[tripId].tsx',
  'src/ui/insights.tsx',
  'src/ui/ArrivalCard.tsx',
  'app/paste-booking.tsx',
];

/** Icon names in a file: name= / icon= props, `icon:` fields and values of *_ICON(S) maps typed as icon names. */
function iconNames(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\b(?:name|icon)=["']([a-z0-9-]+)["']/g)) out.add(m[1]);
  for (const m of src.matchAll(/\b(?:name|icon)=\{[^}]*\}/g)) for (const q of m[0].matchAll(/'([a-z][a-z0-9-]*)'/g)) out.add(q[1]);
  for (const m of src.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) out.add(m[1]);
  for (const m of src.matchAll(/_ICONS?\b[^=]*=\s*\{([^}]*)\}/g)) for (const q of m[1].matchAll(/:\s*'([a-z0-9-]+)'/g)) out.add(q[1]);
  return [...out];
}

test('Ionicons: every glyph name in the newest features is one checked against the Ionicons 7 set', () => {
  let seen = 0;
  const unknown: string[] = [];
  for (const f of NEWEST_FEATURE_FILES) {
    for (const n of iconNames(read(f))) {
      seen += 1;
      if (!CHECKED_IONICONS.has(n)) unknown.push(`${f}: ${n}`);
    }
  }
  assert.deepEqual(unknown, [], 'names not checked against the Ionicons 7 set');
  assert.ok(seen > 40, `found ${seen} names`);
  assert.deepEqual(iconNames(`<Ionicons name="key-outline" /> <X icon={on ? 'checkbox' : 'square-outline'} /> { icon: 'gift-outline' }`).sort(), ['checkbox', 'gift-outline', 'key-outline', 'square-outline']);
});

// ----------------------------------------------------------------------------------------------- menu words

const table = JSON.parse(read('src/content/menu.json')) as MenuTable & { toNativeCheck?: string[] };

/**
 * Words every menu language must carry: the main allergens, meats, diet words, spice level and basics. (Shellfish as a
 * group word and generic noodles are left out: vi / th / it / pt deliberately carry no word for them, see PHRASES.md.)
 */
const CORE_MENU = [
  'pork', 'beef', 'chicken', 'meat', 'fish', 'seafood', 'shrimp', 'crab', 'egg', 'milk', 'cheese', 'butter',
  'peanut', 'nuts', 'sesame', 'soy', 'soySauce', 'tofu', 'wheat', 'gluten', 'flour', 'honey', 'fishSauce', 'oysterSauce',
  'vegetables', 'garlic', 'onion', 'chili', 'rice', 'bread', 'soup', 'fried', 'grilled', 'spicy', 'notSpicy',
  'sugar', 'salt', 'water', 'tea', 'coffee', 'ice', 'noIce', 'beer', 'wine', 'alcohol', 'vegetarian', 'vegan', 'halal',
  'glutenFree', 'noMeat',
];

test('menu: zh-Hant and Indonesian carry words, marked to native-check, with no content problems', () => {
  assert.deepEqual(menuProblems(table), []);
  assert.ok((MENU_LANGS as readonly string[]).includes('zh-Hant'));
  assert.ok((MENU_LANGS as readonly string[]).includes('id'));
  assert.deepEqual([...(table.toNativeCheck ?? [])].sort(), ['id', 'zh-Hant']);
  assert.ok(menuWords(table, 'zh-Hant').length >= 100);
  assert.ok(menuWords(table, 'id').length >= 100);
  assert.equal(menuWord(table, 'zh-Hant', 'pork')?.text, '豬肉');
  assert.equal(menuWord(table, 'zh-Hant', 'pork')?.roman, 'zhūròu');
  assert.equal(menuWord(table, 'id', 'pork')?.text, 'daging babi');
  assert.equal(menuWord(table, 'id', 'pork')?.roman, null);
  // Two-way search works in both new languages.
  assert.equal(searchMenu(table, 'zh-Hant', 'peanut')[0]?.text, '花生');
  assert.equal(searchMenu(table, 'id', 'udang')[0]?.id, 'shrimp');
  assert.equal(searchMenu(table, 'zh-Hant', 'zhuròu')[0]?.id, 'pork');
});

test('menu: every language has the same core entries', () => {
  for (const lang of MENU_LANGS) {
    for (const id of CORE_MENU) assert.ok(menuWord(table, lang, id), `${lang} lacks core word ${id}`);
  }
});

test('menu zh-Hant: Traditional characters only, and Taiwan words where the mainland word means something else', () => {
  const all = menuWords(table, 'zh-Hant').map((w) => w.text).join('');
  // Simplified forms used in the zh-Hans words that must never appear in the Traditional ones.
  for (const ch of [...'猪鸡鸭肠脏汤鱼鲜贝虾龙鱿蛎鳗酱面麦麸荞葱萝饺咸盐气坚无'])
    assert.ok(!all.includes(ch), `simplified ${ch} in zh-Hant`);
  // 土豆 is a peanut in Taiwan: potato must be 馬鈴薯.
  assert.match(menuWord(table, 'zh-Hant', 'potato')?.text ?? '', /馬鈴薯/);
  assert.doesNotMatch(all, /土豆/);
});

test('menu: the new languages open from their countries (Taiwan, Hong Kong, Macau, Indonesia)', () => {
  const phrases = JSON.parse(read('src/content/phrases.json')) as PhraseTable;
  for (const iso of ['TW', 'HK', 'MO']) assert.equal(menuLangForCountry(phrases, iso), 'zh-Hant', iso);
  assert.equal(menuLangForCountry(phrases, 'ID'), 'id');
  assert.equal(menuLangForCountry(phrases, 'CN'), 'zh-Hans');
});

test('T112 strings are in the catalogue', () => {
  for (const k of ['f97.arrival.stay', 'f97.arrival.stayA11y', 'f97.arrival.stayHint', 'f97.paste.wifiTitle', 'f97.paste.wifiSave', 'f97.paste.wifiFilled', 'f97.gift.fromMap'] as const) {
    assert.ok(en[k].trim(), k);
  }
});
