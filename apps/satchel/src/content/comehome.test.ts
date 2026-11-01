// T128: checks on src/content/comehome.json (the duty-free and customs reminder for the home country). Each row links
// one official page read by the build on 2026-11-01; see ops/DECISIONS.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { allowanceProblems, type AllowanceTable } from '../core/comehome.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const data = load('./comehome.json') as AllowanceTable;
const essentials = new Set((load('./country_essentials.json') as { countries: { iso2: string }[] }).countries.map((c) => c.iso2));

const BRANDS = /\b(tripit|wanderlog|tripadvisor|lonely planet|google|airbnb|booking\.com|expedia|kayak|skyscanner|wikipedia|polarsteps)\b/i;
/** The 27 EU members (ISO 3166 alpha-2). */
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

/** The official authority's host for each row: a government page, never a third party. */
const HOSTS: Record<string, RegExp> = {
  AU: /^https:\/\/www\.abf\.gov\.au\//,
  NZ: /^https:\/\/www\.customs\.govt\.nz\//,
  GB: /^https:\/\/www\.gov\.uk\//,
  IE: /^https:\/\/www\.revenue\.ie\//,
  US: /^https:\/\/www\.cbp\.gov\//,
  CA: /^https:\/\/www\.cbsa-asfc\.gc\.ca\//,
  EU: /^https:\/\/europa\.eu\/youreurope\//,
};

test('comehome: rule says verify before you fly and not legal advice; checked 2026-11-01', () => {
  assert.match(data.rule, /verify before you fly/);
  assert.match(data.rule, /not legal advice/);
  assert.equal(data.checked, '2026-11-01');
  assert.equal(data.version, 1);
});

test('comehome: rows for AU, NZ, GB, IE, US, CA and the EU general page, each on its official host', () => {
  assert.deepEqual(data.allowances.map((r) => r.id).sort(), Object.keys(HOSTS).sort());
  for (const r of data.allowances) assert.match(r.url, HOSTS[r.id], r.id);
});

test('comehome: every row has an https source, an ISO checked date, verify: true and a short summary', () => {
  for (const r of data.allowances) {
    assert.deepEqual(allowanceProblems(r), [], r.id);
    assert.equal(r.checked, '2026-11-01', r.id);
    assert.equal(r.verify, true, r.id);
  }
});

test('comehome: each country once, all known to country_essentials; the EU row is the EU minus Ireland', () => {
  const seen = new Set<string>();
  for (const r of data.allowances) {
    for (const c of r.countries) {
      assert.ok(!seen.has(c), `duplicate ${c}`);
      seen.add(c);
      assert.ok(essentials.has(c), `${c} not in country_essentials.json`);
    }
  }
  const eu = data.allowances.find((r) => r.id === 'EU')!;
  assert.deepEqual([...eu.countries].sort(), EU.filter((c) => c !== 'IE').sort());
});

test('comehome: generic wording, no allowance figures, no brand names, tidy spacing', () => {
  for (const r of data.allowances) {
    for (const s of [r.summary, r.authority]) {
      assert.doesNotMatch(s, BRANDS, `${r.id}: ${s}`);
      assert.doesNotMatch(s, /\d/, `${r.id} has a figure: ${s}`);
      assert.doesNotMatch(s, /\s{2,}|^\s|\s$/, `${r.id} spacing: ${s}`);
    }
  }
});
