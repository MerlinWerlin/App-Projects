import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  auditSources,
  cardStatus,
  confidenceOf,
  doubtedFields,
  flagFields,
  sourceProblems,
  cleanCard,
  countryForZone,
  displayRow,
  findCountry,
  guessCountry,
  hasErrors,
  lineLabelServices,
  normaliseCard,
  pickPhone,
  sameCard,
  searchCountries,
  sourceOf,
  telUri,
  urlHost,
  validateCard,
  ZONE_COUNTRY,
  type EmergencyRow,
  type EmergencyTable,
} from './emergency.ts';
import { toUtc } from './tz.ts';

const table = JSON.parse(readFileSync(new URL('../content/emergency_numbers.json', import.meta.url), 'utf8')) as EmergencyTable;

const row = (over: Partial<EmergencyRow>): EmergencyRow => ({
  iso2: 'ZZ',
  country: 'Testland',
  general: null,
  police: null,
  ambulance: null,
  fire: null,
  tourist_police: null,
  notes: null,
  source_url: null,
  source_checked: null,
  confidence: 'low',
  ...over,
});

test('lookup by iso2 is case-insensitive; unknown codes are null', () => {
  assert.equal(findCountry(table, 'jp')?.country, 'Japan');
  assert.equal(findCountry(table, ' AU ')?.general, '000');
  assert.equal(findCountry(table, 'QQ'), null);
  assert.equal(findCountry(table, null), null);
});

test('display: numbers come from the table unchanged and shared numbers merge (Japan 119 = ambulance + fire)', () => {
  const jp = displayRow(findCountry(table, 'JP')!);
  const src = findCountry(table, 'JP')!;
  for (const l of jp.lines) for (const s of l.services) assert.equal(src[s], l.number);
  const n119 = jp.lines.find((l) => l.number === '119');
  assert.ok(n119 && n119.services.includes('ambulance') && n119.services.includes('fire'));
  assert.equal(new Set(jp.lines.map((l) => l.number)).size, jp.lines.length);
  assert.equal(jp.verifyLocally, true);
  const us = displayRow(findCountry(table, 'US')!);
  assert.equal(us.lines[0].number, '911');
  assert.deepEqual(lineLabelServices(us.lines[0]), ['general']);
});

test('every bundled row: verify locally, numbers untouched, and source pending until a URL AND a date exist', () => {
  for (const r of table.countries) {
    const d = displayRow(r);
    assert.equal(d.verifyLocally, true);
    const fromTable = new Set([r.general, r.police, r.ambulance, r.fire, r.tourist_police].filter((x): x is string => !!x));
    assert.deepEqual(new Set(d.lines.map((l) => l.number)), fromTable, r.iso2);
    assert.equal(d.noNumber, fromTable.size === 0, r.iso2);
    if (!(r.source_url && r.source_checked)) assert.deepEqual(d.source, { kind: 'pending' }, r.iso2);
  }
});

test('row with no confirmed number shows the no-number state, not a guess', () => {
  const d = displayRow(row({ notes: 'Emergency numbers could not be confirmed.' }));
  assert.equal(d.noNumber, true);
  assert.deepEqual(d.lines, []);
  assert.equal(d.notes, 'Emergency numbers could not be confirmed.');
  const af = findCountry(table, 'AF');
  if (af && !af.general && !af.police && !af.ambulance && !af.fire) assert.equal(displayRow(af).noNumber, true);
});

test('source: needs both an https URL and a real date; host shown without www', () => {
  assert.deepEqual(sourceOf({ source_url: 'https://www.gov.example/emergency?x=1', source_checked: '2026-10-01' }), {
    kind: 'checked',
    host: 'gov.example',
    date: '2026-10-01',
  });
  assert.deepEqual(sourceOf({ source_url: 'https://gov.example', source_checked: null }), { kind: 'pending' });
  assert.deepEqual(sourceOf({ source_url: null, source_checked: '2026-10-01' }), { kind: 'pending' });
  assert.deepEqual(sourceOf({ source_url: 'http://gov.example', source_checked: '2026-10-01' }), { kind: 'pending' });
  assert.deepEqual(sourceOf({ source_url: 'https://gov.example', source_checked: '2026-02-30' }), { kind: 'pending' });
  assert.equal(urlHost('https://Police.GOV.example:443/a'), 'police.gov.example');
  assert.equal(urlHost('javascript:alert(1)'), null);
  assert.equal(displayRow(row({ police: '110', source_url: 'https://a.example/x', source_checked: '2026-09-09' })).source.kind, 'checked');
});

test('whole table: a row shows a source only with an https URL AND an ISO checked date; every other row is pending', () => {
  const audit = auditSources(table);
  assert.equal(audit.sourced.length + audit.pending.length, table.countries.length);
  for (const r of table.countries) {
    const src = sourceOf(r);
    if (src.kind === 'checked') {
      assert.ok(audit.sourced.includes(r.iso2), r.iso2);
      assert.match(String(r.source_checked).trim(), /^\d{4}-\d{2}-\d{2}$/, `${r.iso2} sourced row must carry a checked date`);
      assert.match(String(r.source_url).trim(), /^https:\/\//, `${r.iso2} sourced row must carry an https URL`);
      assert.deepEqual(sourceProblems(r), [], r.iso2);
    } else {
      assert.ok(audit.pending.includes(r.iso2), r.iso2);
      assert.equal(displayRow(r).source.kind, 'pending', r.iso2);
    }
  }
  // Every row that claims a source but cannot show one is listed with a reason.
  for (const r of table.countries) {
    const claims = !!(r.source_url?.trim() || r.source_checked?.trim());
    const listed = audit.problems.some((p) => p.iso2 === r.iso2);
    assert.equal(listed, claims && sourceOf(r).kind !== 'checked', r.iso2);
  }
  // Today's bundled table (import 2026-10-24): URLs without dates (the EU 112 page) stay "source pending".
  for (const p of audit.problems) assert.ok(p.problems.length > 0, p.iso2);
});

test('source problems name what is missing', () => {
  assert.deepEqual(sourceProblems({ source_url: null, source_checked: null }), []);
  assert.deepEqual(sourceProblems({ source_url: 'https://gov.example/x', source_checked: '2026-10-01' }), []);
  assert.deepEqual(sourceProblems({ source_url: 'https://gov.example/x', source_checked: null }), ['url-without-date']);
  assert.deepEqual(sourceProblems({ source_url: '  ', source_checked: '2026-10-01' }), ['date-without-url']);
  assert.deepEqual(sourceProblems({ source_url: 'http://gov.example', source_checked: '2026-10-01' }), ['url-not-https']);
  assert.deepEqual(sourceProblems({ source_url: 'https://gov.example', source_checked: '1 Oct 2026' }), ['date-not-iso']);
  assert.deepEqual(sourceProblems({ source_url: 'https://gov.example', source_checked: '2026-13-01' }), ['date-not-iso']);
});

test('guard flags: fields parse (incl. "police / ambulance / fire"), unknown names doubt the whole entry', () => {
  assert.deepEqual(flagFields({ field: 'police' }), ['police']);
  assert.deepEqual(flagFields({ field: 'police / ambulance / fire' }), ['police', 'ambulance', 'fire']);
  assert.deepEqual(flagFields({ field: 'Tourist police' }), ['tourist_police']);
  assert.deepEqual(flagFields({ field: 'notes' }), ['notes']);
  assert.deepEqual(flagFields({ field: 'country' }), ['entry']);
  assert.deepEqual(flagFields({ field: '' }), ['entry']);
  assert.deepEqual(doubtedFields({ guard_flags: [{ field: 'fire' }, { field: 'general' }, { field: 'fire' }] }), ['general', 'fire']);
  assert.deepEqual(doubtedFields({ guard_flags: null }), []);
  assert.deepEqual(doubtedFields({}), []);
});

test('doubted numbers: line flagged, number unchanged; blank services and the note reported separately', () => {
  const d = displayRow(
    row({
      police: '110',
      ambulance: '119',
      fire: '119',
      notes: 'A note.',
      guard_flags: [{ field: 'fire', given: '119' }, { field: 'general', given: 'null' }, { field: 'notes' }],
    }),
  );
  const l119 = d.lines.find((l) => l.number === '119')!;
  assert.equal(l119.doubted, true);
  assert.equal(d.lines.find((l) => l.number === '110')!.doubted, false);
  assert.deepEqual(d.doubted, ['general', 'fire', 'notes']);
  assert.deepEqual(d.doubtedElsewhere, ['general']);
  assert.equal(d.notesDoubted, true);
  const clean = displayRow(row({ police: '110' }));
  assert.deepEqual([clean.doubted, clean.doubtedElsewhere, clean.notesDoubted, clean.lines[0].doubted], [[], [], false, false]);
});

test('whole table: the 39 GUARD-flagged rows show doubts on exactly their flagged fields, numbers untouched', () => {
  const flagged = table.countries.filter((r) => Array.isArray(r.guard_flags) && r.guard_flags.length > 0);
  assert.equal(flagged.length, 39);
  for (const r of table.countries) {
    const d = displayRow(r);
    const fields = doubtedFields(r);
    assert.equal(fields.length > 0, flagged.includes(r), r.iso2);
    for (const l of d.lines) {
      assert.equal(l.doubted, l.services.some((s) => fields.includes(s)), `${r.iso2} ${l.number}`);
      for (const s of l.services) assert.equal(r[s]?.trim(), l.number, r.iso2);
    }
    // Each doubted field is shown somewhere: on its number, by the note, or in the "also doubted" line.
    for (const f of fields) {
      const shown = d.lines.some((l) => (l.services as string[]).includes(f)) || (f === 'notes' ? d.notesDoubted || !d.notes : d.doubtedElsewhere.includes(f));
      assert.ok(shown, `${r.iso2} ${f}`);
    }
  }
});

test('confidence: high/medium/low pass through, anything else is unknown; every bundled row has one', () => {
  assert.equal(confidenceOf('High'), 'high');
  assert.equal(confidenceOf('low'), 'low');
  assert.equal(confidenceOf('certain'), 'unknown');
  assert.equal(confidenceOf(undefined), 'unknown');
  for (const r of table.countries) assert.notEqual(displayRow(r).confidence, 'unknown', r.iso2);
  for (const r of table.countries) if (r.guard_flags?.length) assert.equal(displayRow(r).confidence, 'low', r.iso2);
});

test('tel: URIs keep digits and a leading + only', () => {
  assert.equal(telUri('000'), 'tel:000');
  assert.equal(telUri('+61 (2) 9999-0000'), 'tel:+61299990000');
  assert.equal(telUri('1-800-FLOWERS'), 'tel:1800');
  assert.equal(telUri('*#06#'), 'tel:06');
  assert.equal(telUri('12+34'), 'tel:1234');
  assert.equal(telUri('1'), null);
  assert.equal(telUri(''), null);
  assert.equal(telUri(null), null);
  assert.equal(telUri('call me'), null);
});

test('country search: iso code, name prefix, word prefix, accents ignored', () => {
  assert.equal(searchCountries(table, 'jp')[0].iso2, 'JP');
  assert.equal(searchCountries(table, 'japan')[0].iso2, 'JP');
  assert.equal(searchCountries(table, 'new z')[0].iso2, 'NZ');
  assert.ok(searchCountries(table, 'kingdom').some((r) => r.iso2 === 'GB'));
  const ci = table.countries.find((r) => r.iso2 === 'CI');
  if (ci && /ô/.test(ci.country)) assert.equal(searchCountries(table, 'cote')[0].iso2, 'CI');
  assert.equal(searchCountries(table, '').length, table.countries.length);
  assert.deepEqual(searchCountries(table, 'zzzzqq'), []);
});

test('zone map: ~80+ common travel zones, every code exists in the table, unknown zones are null', () => {
  assert.ok(Object.keys(ZONE_COUNTRY).length >= 80);
  for (const [zone, iso2] of Object.entries(ZONE_COUNTRY)) assert.ok(findCountry(table, iso2), `${zone} -> ${iso2} missing from table`);
  assert.equal(countryForZone('Asia/Tokyo'), 'JP');
  assert.equal(countryForZone('Australia/Sydney'), 'AU');
  assert.equal(countryForZone('Europe/Paris'), 'FR');
  assert.equal(countryForZone('Antarctica/Troll'), null);
  assert.equal(countryForZone('UTC'), null);
  assert.equal(countryForZone(undefined), null);
});

test('guess: from the current/next item of an active trip, else the phone zone, else null', () => {
  const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
  const sorted = [...trip.items].sort((a, b) => toUtc(a.start) - toUtc(b.start));
  const first = sorted[0];
  // Before the first item, on the trip's first day: the next item starts where you are.
  const before = toUtc(first.start) - 60 * 60_000;
  const g1 = guessCountry([trip], before, trip.startDate, 'Europe/Paris');
  assert.deepEqual(g1, { iso2: countryForZone(first.start.tz), zone: first.start.tz, from: 'trip' });
  // During a journey with an end: where you are heading.
  const moving = sorted.find((i) => i.kind !== 'hotel' && i.end && i.end.tz !== i.start.tz);
  if (moving && moving.end) {
    const mid = (toUtc(moving.start) + toUtc(moving.end)) / 2;
    const g = guessCountry([trip], mid, moving.start.local.slice(0, 10), null);
    assert.equal(g?.zone, moving.end.tz);
  }
  // Trip not on today: phone zone wins; unknown phone zone: null.
  assert.deepEqual(guessCountry([trip], before, '2026-01-01', 'Europe/Paris'), { iso2: 'FR', zone: 'Europe/Paris', from: 'phone' });
  assert.equal(guessCountry([trip], before, '2026-01-01', 'Antarctica/Troll'), null);
  assert.equal(guessCountry([], Date.now(), '2026-10-24', null), null);
});

test('card completeness: missing insurer, policy, phone, contacts; medical notes optional', () => {
  assert.deepEqual(cardStatus({ contacts: [] }), { missing: ['insurer', 'policy', 'insurerPhone', 'contacts'], filled: [], empty: true, complete: false });
  const full = { insurer: 'Acme Cover', policy: 'P-1', insurerPhone: '+61 2 0000 0000', contacts: [{ id: 'c1', name: 'Sam', phone: '0400 000 000' }] };
  assert.equal(cardStatus(full).complete, true);
  assert.equal(cardStatus({ ...full, contacts: [{ id: 'c1', name: 'Sam', phone: 'x' }] }).missing.includes('contacts'), true);
  assert.deepEqual(cardStatus({ contacts: [], medicalNotes: 'Penicillin allergy' }).filled, ['medicalNotes']);
  assert.equal(cardStatus(null).empty, true);
});

test('validate + clean: blank contacts dropped, half-filled ones flagged, strings trimmed', () => {
  const card = {
    insurer: '  Acme  ',
    policy: '',
    insurerPhone: 'abc',
    contacts: [
      { id: 'a', name: '', phone: '', relation: '' },
      { id: 'b', name: 'Sam', phone: '' },
      { id: 'c', name: '', phone: '0400 000 000' },
      { id: 'd', name: ' Alex ', phone: ' +44 20 0000 0000 ', relation: ' Sister ' },
    ],
  };
  const e = validateCard(card);
  assert.equal(e.insurerPhone, 'phone');
  assert.deepEqual(e.contacts, { b: ['phone'], c: ['name'] });
  assert.equal(hasErrors(e), true);
  assert.equal(hasErrors(validateCard({ contacts: [{ id: 'a', name: '', phone: '' }] })), false);
  const clean = cleanCard({ ...card, insurerPhone: ' 1300 000 000 ', contacts: [card.contacts[0], card.contacts[3]] });
  assert.deepEqual(clean, { insurer: 'Acme', insurerPhone: '1300 000 000', contacts: [{ id: 'd', name: 'Alex', phone: '+44 20 0000 0000', relation: 'Sister' }] });
  assert.equal(sameCard({ contacts: [], insurer: ' ' }, { contacts: [{ id: 'z', name: '', phone: '' }] }), true);
  assert.equal(sameCard({ contacts: [], insurer: 'A' }, { contacts: [] }), false);
});

test('normalise: tolerates junk and partial stored shapes', () => {
  assert.deepEqual(normaliseCard(null), { contacts: [] });
  assert.deepEqual(normaliseCard('x'), { contacts: [] });
  assert.deepEqual(normaliseCard({ insurer: 5, contacts: [null, { name: 'Sam', phone: '1' }] }), { contacts: [{ id: 'contact_0', name: 'Sam', phone: '1' }] });
  assert.deepEqual(normaliseCard({ medicalNotes: 'n', contacts: 'bad' }), { contacts: [], medicalNotes: 'n' });
});

test('pickPhone prefers a mobile number with digits', () => {
  assert.equal(pickPhone([{ number: '02 0000 0000', label: 'home' }, { number: '0400 000 000', label: 'mobile' }]), '0400 000 000');
  assert.equal(pickPhone([{ number: 'n/a', label: 'mobile' }, { number: '02 0000 0000', label: 'work' }]), '02 0000 0000');
  assert.equal(pickPhone([]), null);
  assert.equal(pickPhone(undefined), null);
});
