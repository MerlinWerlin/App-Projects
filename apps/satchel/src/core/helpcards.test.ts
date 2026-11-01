import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  CARD_KINDS,
  cardsOf,
  cleanPeople,
  cleanPerson,
  companionsWithoutCard,
  draftForCompanion,
  EMPTY_DRAFT,
  HELPCARDS_KEY,
  helpLine,
  helpTableProblems,
  hotelForCards,
  hotelText,
  LINE_IDS,
  lostView,
  MAX_PEOPLE,
  NEED_IDS,
  needsView,
  normaliseNeeds,
  parseIdParam,
  parseKindParam,
  pickHelpLang,
  removePerson,
  savePerson,
  shareText,
  toggleNeed,
  bigSize,
  type HelpPerson,
  type HelpTable,
} from './helpcards.ts';
import type { Trip } from './model.ts';
import { PHRASE_LANGS, tripCountry, type PhraseTable } from './phrases.ts';
import { toUtc } from './tz.ts';
import { buildTripFile } from './tripfile.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const help = JSON.parse(read('src/content/helpcards.json')) as HelpTable;
const phrases = JSON.parse(read('src/content/phrases.json')) as PhraseTable;

const person = (over: Partial<HelpPerson> = {}): HelpPerson => ({
  id: 'p1',
  name: 'Mia',
  callName: 'Mum',
  callPhone: '+61 400 111 222',
  meetingPoint: 'The big clock at the station',
  needs: [],
  otherNeeds: '',
  ...over,
});

// ----------------------------------------------------------------------------------------------- content

test('content: every phrase language has every sentence, non-empty and marked for a native-speaker check', () => {
  assert.deepEqual(helpTableProblems(help), []);
  assert.equal(help.languages.length, PHRASE_LANGS.length);
  for (const code of PHRASE_LANGS) {
    const l = help.languages.find((x) => x.code === code);
    assert.ok(l, code);
    for (const id of LINE_IDS) {
      assert.ok(l.lines[id]?.text.trim(), `${code} ${id}`);
      assert.equal(l.lines[id].check, true, `${code} ${id}`);
      // A translated line is never the English left in place.
      assert.notEqual(l.lines[id].text, help.sentences.find((s) => s.id === id)?.en, `${code} ${id}`);
    }
  }
  assert.deepEqual(
    help.sentences.map((s) => s.id),
    [...LINE_IDS],
  );
});

test('content check catches a missing line, an unmarked line and an unknown id', () => {
  const broken: HelpTable = JSON.parse(JSON.stringify(help));
  delete broken.languages[0].lines.sit;
  broken.languages[1].lines.deaf.check = false;
  broken.languages[2].lines.extra = { text: 'x', check: true };
  const p = helpTableProblems(broken);
  assert.ok(p.includes(`${broken.languages[0].code} sit: missing`));
  assert.ok(p.includes(`${broken.languages[1].code} deaf: not marked for a native-speaker check`));
  assert.ok(p.includes(`${broken.languages[2].code} extra: unknown line`));
  broken.languages.pop();
  assert.ok(helpTableProblems(broken).some((x) => x.startsWith('language ') && x.endsWith(': missing')));
});

// ----------------------------------------------------------------------------------------------- model

test('people are cleaned on read: bad rows, repeats and overflow dropped; text trimmed and cut', () => {
  assert.deepEqual(cleanPeople(null), []);
  assert.deepEqual(cleanPeople({ people: 'x' }), []);
  const rows = [
    { id: 'a', name: '  Mia  ', callPhone: ' +61 4 ', needs: ['sit', 'deaf', 'deaf', 'fly'], otherNeeds: 'x'.repeat(400), photoUri: ' file:///a.jpg ' },
    { id: 'a', name: 'Again' },
    { id: 'b', name: '   ' },
    { name: 'No id' },
    42,
  ];
  const list = cleanPeople({ people: rows });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Mia');
  assert.deepEqual(list[0].needs, ['deaf', 'sit']);
  assert.equal(list[0].otherNeeds.length, 300);
  assert.equal(list[0].photoUri, 'file:///a.jpg');
  assert.equal(cleanPerson({ id: 'x', name: 'Sam' })?.callPhone, '');
  const many = Array.from({ length: MAX_PEOPLE + 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  assert.equal(cleanPeople(many).length, MAX_PEOPLE);
});

test('needs keep a fixed order and toggle on and off', () => {
  assert.deepEqual(normaliseNeeds(['sit', 'wheelchair', 'nope']), ['wheelchair', 'sit']);
  assert.deepEqual(toggleNeed(['sit'], 'wheelchair'), ['wheelchair', 'sit']);
  assert.deepEqual(toggleNeed(['sit', 'wheelchair'], 'sit'), ['wheelchair']);
  assert.deepEqual(toggleNeed('junk', 'deaf'), ['deaf']);
  assert.equal(NEED_IDS.length, 6);
});

test('save: name required, a typed number must be dialable, replace keeps the place, list is capped', () => {
  assert.deepEqual(savePerson([], { ...EMPTY_DRAFT, name: '  ' }, 'x'), { ok: false, reason: 'name' });
  assert.deepEqual(savePerson([], { ...EMPTY_DRAFT, name: 'Mia', callPhone: 'mum' }, 'x'), { ok: false, reason: 'phone' });
  const a = savePerson([], { ...EMPTY_DRAFT, name: 'Mia', callPhone: '+61 400 111 222' }, 'a');
  assert.ok(a.ok);
  const b = savePerson(a.list, { ...EMPTY_DRAFT, name: 'Leo' }, 'b');
  assert.ok(b.ok);
  const a2 = savePerson(b.list, { ...EMPTY_DRAFT, name: 'Mia R' }, 'a');
  assert.ok(a2.ok);
  assert.deepEqual(
    a2.list.map((p) => p.name),
    ['Mia R', 'Leo'],
  );
  const full = Array.from({ length: MAX_PEOPLE }, (_, i) => person({ id: `p${i}`, name: `P${i}` }));
  assert.deepEqual(savePerson(full, { ...EMPTY_DRAFT, name: 'One more' }, 'new'), { ok: false, reason: 'full' });
  assert.ok(savePerson(full, { ...EMPTY_DRAFT, name: 'Renamed' }, 'p3').ok);
});

test('remove hands back the photo to delete', () => {
  const list = [person({ photoUri: 'file:///docs/attachments/hc1-mia.jpg' }), person({ id: 'p2', name: 'Leo' })];
  const r = removePerson(list, 'p1');
  assert.deepEqual(
    r.list.map((p) => p.id),
    ['p2'],
  );
  assert.equal(r.photo, 'file:///docs/attachments/hc1-mia.jpg');
  assert.equal(removePerson(list, 'p2').photo, null);
});

test('companions without a card are offered once (by id or the same name)', () => {
  const trip: Pick<Trip, 'companions'> = {
    companions: [
      { id: 'c1', name: 'Mia' },
      { id: 'c2', name: 'Leo' },
      { id: 'c3', name: 'Ana' },
    ],
  };
  const list = [person({ id: 'x', name: 'Someone', companionId: 'c2' }), person({ id: 'y', name: 'ana' })];
  assert.deepEqual(
    companionsWithoutCard(trip, list).map((c) => c.id),
    ['c1'],
  );
  assert.deepEqual(companionsWithoutCard(null, list), []);
  assert.deepEqual(draftForCompanion({ id: 'c1', name: '  Mia  ' }), { ...EMPTY_DRAFT, name: 'Mia', companionId: 'c1' });
});

test('cards: the lost card always, the needs card once a need is ticked or written', () => {
  assert.deepEqual(cardsOf(person()), ['lost']);
  assert.deepEqual(cardsOf(person({ needs: ['sit'] })), ['lost', 'needs']);
  assert.deepEqual(cardsOf(person({ otherNeeds: 'Diabetic' })), ['lost', 'needs']);
  assert.deepEqual([...CARD_KINDS], ['lost', 'needs']);
});

// ----------------------------------------------------------------------------------------------- language

test('language comes from the trip country, the same way as the phrase screen', () => {
  const trip = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const now = toUtc({ local: '2026-11-03T12:00', tz: 'Asia/Tokyo' });
  const country = tripCountry([trip], now, '2026-11-03');
  assert.equal(country, 'JP');
  assert.deepEqual(pickHelpLang(phrases, help, { tripCountry: country }), { lang: 'ja', from: 'trip' });
  assert.equal(pickHelpLang(phrases, help, { tripCountry: 'TW' }).lang, 'zh-Hant');
  assert.equal(pickHelpLang(phrases, help, { tripCountry: 'BR' }).lang, 'pt');
  assert.equal(pickHelpLang(phrases, help, { tripCountry: 'GB', lastUsed: 'fr' }).lang, 'fr');
  assert.deepEqual(pickHelpLang(phrases, help, { tripCountry: null }), { lang: 'ja', from: 'default' });
  // A language the help table doesn't carry falls back to one it does.
  const thin: HelpTable = { ...help, languages: help.languages.filter((l) => l.code === 'de') };
  assert.deepEqual(pickHelpLang(phrases, thin, { tripCountry: 'JP' }), { lang: 'de', from: 'default' });
});

test('helpLine: local text with English; English when a language lacks the line', () => {
  const l = helpLine(help, 'ja', 'wheelchair');
  assert.equal(l.en, 'I use a wheelchair.');
  assert.equal(l.local, '私は車いすを使っています。');
  const thin: HelpTable = { ...help, languages: [] };
  assert.equal(helpLine(thin, 'ja', 'sit').local, 'I need to sit down. Is there a seat?');
});

// ----------------------------------------------------------------------------------------------- hotel

test('hotel: the stay you are in now, else the next one, local address first', () => {
  const trip = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const inTokyo = hotelForCards([trip], toUtc({ local: '2026-11-03T12:00', tz: 'Asia/Tokyo' }));
  assert.equal(inTokyo?.name, 'Hotel Asakusa Lantern (demo)');
  assert.equal(inTokyo?.state, 'now');
  assert.equal(hotelText(inTokyo!), 'Hotel Asakusa Lantern (demo)\n東京都台東区浅草2-1\n2-1 Asakusa, Taito City, Tokyo');
  const before = hotelForCards([trip], toUtc({ local: '2026-11-01T12:00', tz: 'Australia/Sydney' }));
  assert.equal(before?.state, 'next');
  assert.equal(hotelForCards([], 0), null);
  assert.equal(hotelText({ name: 'H', address: 'A', localAddress: 'A', phone: '', state: 'now' }), 'H\nA');
});

// ----------------------------------------------------------------------------------------------- views + share

test('lost card: rows only for what is known, call button only for a dialable number', () => {
  const hotel = { name: 'Gion Garden Inn', address: '570 Gionmachi, Kyoto', localAddress: '京都府京都市東山区祇園町570', phone: '+81 75 000 0000', state: 'now' as const };
  const v = lostView(help, 'ja', person(), hotel);
  assert.equal(v.title.local, '迷子になりました。助けてください。');
  assert.equal(v.title.en, 'I am lost. Please help me.');
  assert.deepEqual(
    v.rows.map((r) => r.label.id),
    ['labelName', 'labelCall', 'labelHotel', 'labelMeet'],
  );
  assert.equal(v.rows[1].value, 'Mum\n+61 400 111 222');
  assert.equal(v.rows[1].dial, '+61400111222');
  assert.equal(v.rows[2].dial, '+81750000000');
  assert.deepEqual(
    v.lines.map((l) => l.id),
    ['lostCall', 'lostStay'],
  );
  const bare = lostView(help, 'de', person({ callName: '', callPhone: '', meetingPoint: '' }), null);
  assert.deepEqual(
    bare.rows.map((r) => r.label.id),
    ['labelName'],
  );
  assert.deepEqual(
    bare.lines.map((l) => l.id),
    ['lostStay'],
  );
  assert.equal(bare.photoUri, null);
});

test('needs card lists ticked needs in fixed order, then the typed text as typed', () => {
  const v = needsView(help, 'fr', person({ needs: ['sit', 'wheelchair'], otherNeeds: 'Diabetic' }));
  assert.deepEqual(
    v.needs.map((n) => n.id),
    ['wheelchair', 'sit'],
  );
  assert.equal(v.needs[0].local, "J'utilise un fauteuil roulant.");
  assert.equal(v.other?.value, 'Diabetic');
  assert.equal(v.other?.label.local, 'Autres besoins');
  assert.equal(needsView(help, 'fr', person()).other, null);
});

test('share text: local language first with English under it, every row, no photo path', () => {
  const v = lostView(help, 'ja', person({ photoUri: 'file:///docs/attachments/hc-photo.jpg' }), null);
  const s = shareText(v);
  assert.ok(s.startsWith('迷子になりました。助けてください。\nI am lost. Please help me.\n\n'));
  assert.match(s, /私の名前 \/ My name:\nMia/);
  assert.match(s, /連絡先 \/ Who to call:\nMum\n\+61 400 111 222/);
  assert.match(s, /待ち合わせ場所 \/ Our meeting point:\nThe big clock at the station/);
  assert.doesNotMatch(s, /hc-photo|file:/);
  const n = shareText(needsView(help, 'es', person({ needs: ['serviceDog'], otherNeeds: 'Peanut allergy' })));
  assert.match(n, /Este es mi perro de asistencia\. Debe quedarse conmigo\.\nThis is my assistance dog\. It must stay with me\./);
  assert.match(n, /Otras necesidades \/ Other needs:\nPeanut allergy/);
});

test('params and big type size', () => {
  assert.equal(parseKindParam('needs'), 'needs');
  assert.equal(parseKindParam(['needs']), 'needs');
  assert.equal(parseKindParam('x'), 'lost');
  assert.equal(parseIdParam(['p1']), 'p1');
  assert.equal(parseIdParam(''), null);
  assert.ok(bigSize('短い') > bigSize('A much longer sentence that wraps over several lines on a phone.'));
});

// ----------------------------------------------------------------------------------------------- phone-only guard

test('help cards stay on this phone: one key, never in .satchel trip files', () => {
  assert.equal(HELPCARDS_KEY, 'satchel.helpcards.v1');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts']) {
    assert.doesNotMatch(read(p), /helpcard|HELPCARDS|satchel\.helpcards|meetingPoint|otherNeeds/i, p);
  }
  // The key is declared once, in this module, and the storage hook imports it from here.
  assert.equal((read('src/core/helpcards.ts').match(/'satchel\.helpcards\.v1'/g) ?? []).length, 1);
  assert.match(read('src/state/helpcards.ts'), /HELPCARDS_KEY/);
  assert.doesNotMatch(read('src/state/helpcards.ts'), /'satchel\.helpcards/);
  // A trip file built while cards are saved for the trip's companions carries none of them.
  const trip: Trip = { ...demoTrip('2026-11-02', '2026-10-01T00:00:00Z'), companions: [{ id: 'c1', name: 'Zq Mia' }] };
  const saved = savePerson([], { ...draftForCompanion(trip.companions![0]), callName: 'Zq Mum', callPhone: '+61 400 987 654', meetingPoint: 'Zq clock', photoUri: 'file:///docs/attachments/zqphoto.jpg', needs: ['sit'], otherNeeds: 'Zq other' }, 'hc1');
  assert.ok(saved.ok);
  const file = JSON.stringify(buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z' }).file);
  assert.match(file, /Zq Mia/); // the companion's name travels as before (T82)
  assert.doesNotMatch(file, /satchel\.helpcards|Zq Mum|61400987654|400 987 654|Zq clock|zqphoto|Zq other|meetingPoint|otherNeeds/i);
});

// ----------------------------------------------------------------------------------------------- Ionicons names

/** Ionicons 7 glyphs (@expo/vector-icons 15) the help card screens use, each checked by hand against the set. */
const CHECKED_IONICONS = new Set([
  'help-buoy-outline', 'accessibility-outline', 'person-outline', 'person-add-outline', 'add-outline', 'create-outline',
  'language-outline', 'people-outline', 'image-outline', 'camera-outline', 'trash-outline', 'checkmark', 'checkbox',
  'square-outline', 'call', 'share-outline', 'chevron-forward',
]);

test('Ionicons: the help card screens use only checked Ionicons 7 names', () => {
  const files = ['app/helpcards.tsx', 'app/helpcard-edit.tsx', 'app/helpcard.tsx', 'src/ui/HelpCardsCard.tsx'];
  const unknown: string[] = [];
  let seen = 0;
  for (const f of files) {
    const src = read(f);
    const names = new Set<string>();
    for (const m of src.matchAll(/\b(?:name|icon)=["']([a-z0-9-]+)["']/g)) names.add(m[1]);
    for (const m of src.matchAll(/\b(?:name|icon)=\{[^}]*\}/g)) for (const q of m[0].matchAll(/'([a-z][a-z0-9-]*)'/g)) names.add(q[1]);
    for (const m of src.matchAll(/_ICONS?\b[^=]*=\s*\{([^}]*)\}/g)) for (const q of m[1].matchAll(/:\s*'([a-z0-9-]+)'/g)) names.add(q[1]);
    for (const n of names) {
      seen++;
      if (!CHECKED_IONICONS.has(n)) unknown.push(`${f}: ${n}`);
    }
  }
  assert.deepEqual(unknown, []);
  assert.ok(seen >= 12, `found ${seen} names`);
});
