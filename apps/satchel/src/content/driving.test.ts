// T122: checks on src/content/driving.json (the driving abroad guide). General guidance written by the build on
// 2026-11-01; see ops/DECISIONS.md and docs/THIRD_PARTY.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rowProblems, type DrivingTable } from '../core/driving.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const data = load('./driving.json') as DrivingTable;
const customs = load('./customs.json') as { countries: { iso2: string; country: string }[] };
const essentials = new Map((load('./country_essentials.json') as { countries: { iso2: string; driving: string | null }[] }).countries.map((c) => [c.iso2, c.driving]));

/** Car-rental, fuel, travel-app and map brands: never in Satchel's content. */
const BRANDS =
  /\b(hertz|avis|europcar|sixt|enterprise|budget|thrifty|dollar|alamo|national car|rentalcars|discover cars|turo|getaround|zipcar|shell|bp|esso|exxon|mobil|chevron|texaco|total|petronas|caltex|pertamina|touch 'n go|tripit|google|apple maps|waze|uber|lyft|grab|didi|bolt|booking\.com|expedia|kayak|wikipedia|aa\b|rac\b)\b/i;

test('driving: rule says verify locally and not legal advice; dated', () => {
  assert.match(data.rule, /verify locally/);
  assert.match(data.rule, /Not legal advice/);
  assert.equal(data.checked, '2026-11-01');
});

test('driving: the same countries as the customs guide, one row each, names match', () => {
  const want = new Map(customs.countries.map((r) => [r.iso2, r.country]));
  assert.equal(data.countries.length, want.size);
  const seen = new Set<string>();
  for (const r of data.countries) {
    assert.ok(!seen.has(r.iso2), `duplicate ${r.iso2}`);
    seen.add(r.iso2);
    assert.equal(r.country, want.get(r.iso2), r.iso2);
  }
});

test('driving: every row has side + speed unit + an https source, a checked date and a recheck flag', () => {
  for (const r of data.countries) {
    assert.deepEqual(rowProblems(r), [], r.iso2);
    assert.ok(r.side === 'left' || r.side === 'right', r.iso2);
    assert.ok(r.speed === 'kmh' || r.speed === 'mph', r.iso2);
    assert.ok(r.sources.length >= 1, r.iso2);
    assert.ok(r.sources.some((u) => u.startsWith('https://www.gov.uk/')), `${r.iso2} has a government page`);
    assert.equal(r.checked, '2026-11-01', r.iso2);
  }
  const unsure = data.countries.filter((r) => r.recheck).length;
  assert.ok(unsure > 0 && unsure < data.countries.length, `${unsure}`);
  // An unsure IDP answer is always marked to re-check.
  for (const r of data.countries) if (r.idp === null || r.tolls === null) assert.equal(r.recheck, true, r.iso2);
});

test('driving: side of the road agrees with country_essentials.json; the left-driving list', () => {
  for (const r of data.countries) assert.equal(r.side, essentials.get(r.iso2), r.iso2);
  const left = data.countries.filter((r) => r.side === 'left').map((r) => r.iso2).sort();
  assert.deepEqual(left, ['AU', 'CY', 'FJ', 'GB', 'HK', 'ID', 'IE', 'IN', 'JM', 'JP', 'KE', 'LK', 'MT', 'MY', 'NP', 'NZ', 'SG', 'TH', 'TZ', 'ZA']);
});

test('driving: mph only in the UK and the US', () => {
  assert.deepEqual(data.countries.filter((r) => r.speed === 'mph').map((r) => r.iso2).sort(), ['GB', 'US']);
});

test('driving: motorway vignette countries say so', () => {
  for (const iso of ['AT', 'CH', 'CZ', 'SK', 'SI', 'HU', 'RO', 'BG']) {
    const r = data.countries.find((x) => x.iso2 === iso);
    assert.match(r?.tolls ?? '', /vignette/i, iso);
  }
});

test('driving: no brand names, no legal-advice wording, short lines', () => {
  for (const r of data.countries) {
    const texts = [r.seatbelts, r.phone, r.tolls, r.note, r.fuel?.petrol, r.fuel?.diesel].filter((x): x is string => typeof x === 'string');
    for (const s of texts) {
      assert.doesNotMatch(s, BRANDS, `${r.iso2}: ${s}`);
      assert.doesNotMatch(s, /\b(illegal|lawyer|legal advice|you will be arrested)\b/i, `${r.iso2}: ${s}`);
      assert.ok(s.length <= 200, `${r.iso2} too long: ${s}`);
      assert.doesNotMatch(s, /\s{2,}|^\s|\s$/, `${r.iso2} spacing: ${s}`);
    }
  }
});
