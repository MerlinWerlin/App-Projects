// 1.0.0: no data-pipeline jargon on screen; a short friendly source line instead.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { checkedDate, sourceName, travellerNote } from './sourceline.ts';

test('source line: Wikipedia by name, a readable checked date', () => {
  assert.equal(sourceName('en.wikipedia.org'), 'Wikipedia');
  assert.equal(sourceName('www.smartraveller.gov.au'), 'smartraveller.gov.au');
  assert.equal(checkedDate('2026-10-31'), '31 Oct 2026');
  assert.equal(checkedDate('2026-01-05'), '5 Jan 2026');
  assert.equal(checkedDate('soon'), 'soon');
  assert.equal(en['emergency.sourceChecked'].replace('{host}', sourceName('en.wikipedia.org')).replace('{date}', checkedDate('2026-10-31')), 'Source: Wikipedia, checked 31 Oct 2026');
});

test('table notes keep only the useful sentences', () => {
  assert.equal(travellerNote('119 serves ambulance and fire; 110 is police. Source: public list, not an official national source.'), '119 serves ambulance and fire; 110 is police.');
  assert.equal(travellerNote('Source: public list, not an official national source.'), '');
  assert.equal(travellerNote(null), '');
  const rows = (JSON.parse(readFileSync(new URL('../content/emergency_numbers.json', import.meta.url), 'utf8')) as { countries: { notes?: string | null }[] }).countries;
  for (const r of rows) assert.doesNotMatch(travellerNote(r.notes), /public list|official national source|bundled/i, String(r.notes));
});

test('no import ratings, bundled-table or currency-list wording anywhere in the English UI', () => {
  const banned = /confidence|bundled|import’s own|import's own|public list|ISO 4217|second review|Not live/i;
  for (const [k, v] of Object.entries(en)) assert.doesNotMatch(String(v), banned, k);
  const card = readFileSync(new URL('../ui/EmergencyCardView.tsx', import.meta.url), 'utf8');
  assert.match(card, /travellerNote\(row\.notes\)/);
  assert.match(card, /sourceName\(row\.source\.host\)/);
});
