// Checks on the content imported from the OpenAI lanes (data, judged by the build run; see ops/DECISIONS.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));

type Row = { iso2: string; country: string; general: string | null; police: string | null; ambulance: string | null; fire: string | null; tourist_police: string | null; source_url: string | null; source_checked: string | null; confidence: string };

test('emergency numbers: one row per country, digits only, sources are https (a row counts as sourced only with a date)', () => {
  const data = load('./emergency_numbers.json') as { countries: Row[]; rule: string };
  assert.match(data.rule, /verify locally/);
  const seen = new Set<string>();
  for (const r of data.countries) {
    assert.match(r.iso2, /^[A-Z]{2}$/);
    assert.ok(!seen.has(r.iso2), `duplicate ${r.iso2}`);
    seen.add(r.iso2);
    for (const n of [r.general, r.police, r.ambulance, r.fire, r.tourist_police]) if (n !== null) assert.match(n, /^\d{2,6}$/, r.iso2);
    if (r.source_url) assert.match(r.source_url, /^https:\/\//, r.iso2);
    if (r.source_checked) assert.match(r.source_checked, /^\d{4}-\d{2}-\d{2}$/, r.iso2);
    assert.ok(['high', 'medium', 'low'].includes(r.confidence));
  }
  assert.ok(data.countries.length > 150);
});

test('emergency numbers: spot checks for the demo trip and common destinations', () => {
  const by = new Map((load('./emergency_numbers.json') as { countries: Row[] }).countries.map((r) => [r.iso2, r]));
  assert.equal(by.get('JP')?.police, '110');
  assert.equal(by.get('JP')?.ambulance, '119');
  assert.equal(by.get('AU')?.general, '000');
  assert.equal(by.get('NZ')?.general, '111');
  assert.equal(by.get('GB')?.general, '999');
  assert.equal(by.get('US')?.general, '911');
  assert.equal(by.get('FR')?.general, '112');
});

test('packing templates: unique ids, labels present', () => {
  const p = load('./packing_templates.json') as { templates: { id: string; name: string; items: { id: string; label: string }[] }[] };
  const ids = new Set<string>();
  for (const t of p.templates) {
    assert.ok(t.name && t.items.length >= 5, t.id);
    for (const i of t.items) {
      assert.ok(i.label.trim(), i.id);
      assert.ok(!ids.has(i.id), `duplicate item id ${i.id}`);
      ids.add(i.id);
    }
  }
});

test('OSM POI tags cover the PLAN categories', () => {
  const d = load('./osm_poi_tags.json') as { categories: { id: string; tags: { key: string; value: string }[] }[] };
  const tags = new Set(d.categories.flatMap((c) => c.tags.map((t) => `${t.key}=${t.value}`)));
  for (const need of ['amenity=toilets', 'amenity=drinking_water', 'amenity=fuel', 'amenity=restaurant', 'amenity=cafe', 'amenity=fast_food', 'amenity=pharmacy', 'amenity=hospital', 'amenity=atm']) {
    assert.ok(tags.has(need), need);
  }
});
