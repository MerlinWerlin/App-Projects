// T115: checks on src/content/customs.json (the local customs guide). General guidance written by the build on
// 2026-11-01; see ops/DECISIONS.md and docs/THIRD_PARTY.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rowProblems, SECTION_ORDER, TEXT_SECTIONS, type CustomsTable } from '../core/customs.ts';
import { TIPPING } from '../core/tipping.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const data = load('./customs.json') as CustomsTable;
const essentials = new Map((load('./country_essentials.json') as { countries: { iso2: string; country: string }[] }).countries.map((c) => [c.iso2, c.country]));

/** Other travel apps, booking and ride brands, and guidebook names: never in Satchel's content. */
const BRANDS = /\b(tripit|wanderlog|tripadvisor|lonely planet|rick steves|culture trip|rome2rio|google|apple maps|maps\.me|citymapper|airbnb|booking\.com|expedia|kayak|skyscanner|hopper|uber|lyft|grab|didi|bolt|wise|revolut|starbucks|mcdonald|coca|wikipedia|wikitravel|polarsteps|tripcase|kayak|sygic|moovit)\b/i;

const texts = (r: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const id of [...TEXT_SECTIONS, 'water_note', 'country']) if (typeof r[id] === 'string') out.push(r[id] as string);
  if (Array.isArray(r.good_to_know)) out.push(...(r.good_to_know as string[]));
  return out;
};

test('customs: rule says verify locally and not legal advice; sections listed in screen order', () => {
  assert.match(data.rule, /verify locally/);
  assert.match(data.rule, /[Nn]ot legal advice/);
  assert.equal(data.checked, '2026-11-01');
  assert.deepEqual([...(data.sections ?? [])].sort(), [...SECTION_ORDER].sort());
});

test('customs: at least 60 countries, one row each, valid iso2 present in country_essentials, names match', () => {
  assert.ok(data.countries.length >= 60, `${data.countries.length}`);
  const seen = new Set<string>();
  for (const r of data.countries) {
    assert.match(r.iso2, /^[A-Z]{2}$/);
    assert.ok(!seen.has(r.iso2), `duplicate ${r.iso2}`);
    seen.add(r.iso2);
    assert.ok(essentials.has(r.iso2), `${r.iso2} not in country_essentials.json`);
    assert.equal(r.country, essentials.get(r.iso2), r.iso2);
  }
});

test('customs: every country with a tipping row has a customs row', () => {
  const have = new Set(data.countries.map((r) => r.iso2));
  assert.deepEqual(
    TIPPING.map((r) => r.iso2).filter((c) => !have.has(c)),
    [],
  );
});

test('customs: every row has every section (text or an explicit null), water yes/no/varies, 2-4 good-to-know lines', () => {
  for (const r of data.countries) {
    assert.deepEqual(rowProblems(r), [], r.iso2);
    for (const id of [...TEXT_SECTIONS, 'water', 'water_note', 'good_to_know']) assert.ok(id in r, `${r.iso2} ${id}`);
  }
  // Most rows are fully written; nulls are the exception, not the rule.
  const nulls = data.countries.flatMap((r) => [...TEXT_SECTIONS, 'water', 'good_to_know'].filter((id) => (r as Record<string, unknown>)[id] === null));
  assert.ok(nulls.length < data.countries.length, `${nulls.length} unsure sections`);
});

test('customs: dated 2026-11-01, https sources (a government page on every row but the UK), some rows marked to re-check', () => {
  for (const r of data.countries) {
    assert.equal(r.checked, '2026-11-01', r.iso2);
    assert.ok(r.sources.length >= 2, r.iso2);
    for (const u of r.sources) assert.match(u, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/, `${r.iso2} ${u}`);
    if (r.iso2 !== 'GB') assert.ok(r.sources.some((u) => u.startsWith('https://www.gov.uk/foreign-travel-advice/')), r.iso2);
    assert.equal(typeof r.recheck, 'boolean');
  }
  const unsure = data.countries.filter((r) => r.recheck).length;
  assert.ok(unsure > 0 && unsure < data.countries.length, `${unsure}`);
});

test('customs: no competitor or brand names, no legal-advice wording, short practical lines', () => {
  for (const r of data.countries) {
    for (const s of texts(r as unknown as Record<string, unknown>)) {
      assert.doesNotMatch(s, BRANDS, `${r.iso2}: ${s}`);
      assert.doesNotMatch(s, /\b(illegal|lawyer|legal advice|you will be arrested)\b/i, `${r.iso2}: ${s}`);
      assert.ok(s.length <= 220, `${r.iso2} too long: ${s}`);
      assert.doesNotMatch(s, /\s{2,}|^\s|\s$/, `${r.iso2} spacing: ${s}`);
    }
  }
});
