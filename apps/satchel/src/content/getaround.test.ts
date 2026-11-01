// T132: checks on src/content/getaround.json (the getting-around guide). Written by the build on 2026-11-01 from
// official operator, government and tourism board pages; see ops/DECISIONS.md and docs/THIRD_PARTY.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rowProblems, TEXT_SECTIONS, type GetaroundTable } from '../core/getaround.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const data = load('./getaround.json') as GetaroundTable;
const essentials = new Map((load('./country_essentials.json') as { countries: { iso2: string; country: string }[] }).countries.map((c) => [c.iso2, c.country]));

/** The 40 countries the backlog asked for (T132), in its order. */
const WANTED = 'JP AU NZ GB IE US CA FR IT ES DE NL PT GR TH VN ID SG MY KR CN HK TW AE TR MX BR AR CL ZA EG MA IN PH CH AT CZ HR IS NO'.split(' ');

/** Ride-hailing and taxi app brands: never named in the guide (generic "app-based rides" only). */
const RIDE_BRANDS =
  /\b(uber|lyft|grab|gojek|go-jek|didi|bolt|ola|careem|cabify|indrive|indriver|yandex|kakao ?t|kakaotaxi|go taxi|s\.ride|japantaxi|freenow|free now|mytaxi|blablacar|gett|taxify|maxim|rapido|lalamove|bitaksi|easy taxi|99 ?taxis|99app|blacklane|cabcharge|zoomcar|tada|ryde)\b/i;
/** Other travel apps, booking and map brands. */
const OTHER_BRANDS = /\b(google|apple|citymapper|moovit|rome2rio|tripadvisor|lonely planet|wikipedia|booking\.com|expedia|airbnb|samsung)\b/i;
/** Money figures: no fares or prices in the guide. */
const MONEY = /([$€£¥₩₹฿]|\b(usd|eur|gbp|jpy|aud|nzd|cad|chf|nok|isk|czk|hkd|sgd|myr|thb|aed|inr|ars|clp|zar|yen|euros?|dollars?|pounds?|baht|rupees?|pesos?|rand|kroner|krona|ringgit|dirhams?)\b|\bRM ?\d)/i;

const texts = (r: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const id of [...TEXT_SECTIONS, 'contactless_note', 'recheck_reason', 'country', 'area']) if (typeof r[id] === 'string') out.push(r[id] as string);
  if (Array.isArray(r.tickets)) out.push(...(r.tickets as string[]));
  return out;
};

test('getaround: rule names the checked date, official sources, no fares and verify locally', () => {
  assert.equal(data.checked, '2026-11-01');
  assert.match(data.rule, /2026-11-01/);
  assert.match(data.rule, /official/);
  assert.match(data.rule, /No fares/);
  assert.match(data.rule, /verify locally/);
});

test('getaround: at least 20 countries covered; every wanted country is either covered or listed as not yet covered', () => {
  assert.ok(data.countries.length >= 20, `${data.countries.length}`);
  const covered = new Set(data.countries.map((r) => r.iso2));
  const notCovered = new Set((data.not_covered ?? []).map((r) => r.iso2));
  for (const c of WANTED) assert.ok(covered.has(c) !== notCovered.has(c), `${c}: covered ${covered.has(c)}, not covered ${notCovered.has(c)}`);
  for (const c of covered) assert.ok(WANTED.includes(c), `${c} not in the backlog list`);
  for (const e of data.not_covered ?? []) {
    assert.ok(e.reason.trim().length > 0, e.iso2);
    assert.equal(e.country, essentials.get(e.iso2), e.iso2);
  }
});

test('getaround: one row per country, valid iso2 present in country_essentials, names match', () => {
  const seen = new Set<string>();
  for (const r of data.countries) {
    assert.match(r.iso2, /^[A-Z]{2}$/);
    assert.ok(!seen.has(r.iso2), `duplicate ${r.iso2}`);
    seen.add(r.iso2);
    assert.ok(essentials.has(r.iso2), `${r.iso2} not in country_essentials.json`);
    assert.equal(r.country, essentials.get(r.iso2), r.iso2);
  }
});

test('getaround: every row passes rowProblems (fields present or explicit null, gaps marked to re-check)', () => {
  for (const r of data.countries) assert.deepEqual(rowProblems(r), [], r.iso2);
  // Each row says how transit works; that is the guide's point.
  for (const r of data.countries) assert.ok(r.transit, r.iso2);
});

test('getaround: every row has https source URLs and the ISO checked date 2026-11-01; re-check rows give a reason', () => {
  for (const r of data.countries) {
    assert.equal(r.checked, '2026-11-01', r.iso2);
    assert.ok(r.sources.length >= 1, r.iso2);
    for (const u of r.sources) {
      assert.match(u, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/, `${r.iso2} ${u}`);
      assert.doesNotMatch(u, /\s/, `${r.iso2} ${u}`);
      assert.doesNotMatch(u, /wikipedia|tripadvisor|lonelyplanet|blog/i, `${r.iso2} ${u}`);
    }
    if (r.recheck) assert.ok(r.recheck_reason && r.recheck_reason.length > 10, r.iso2);
    else assert.equal(r.recheck_reason, null, r.iso2);
  }
  const unsure = data.countries.filter((r) => r.recheck).length;
  assert.ok(unsure > 0 && unsure < data.countries.length, `${unsure}`);
});

test('getaround: no ride-hailing app brands (rides are generic only), no other app brands, no fares or prices', () => {
  for (const r of data.countries) {
    assert.ok(r.rides === null || r.rides === 'available', r.iso2);
    for (const s of texts(r as unknown as Record<string, unknown>)) {
      assert.doesNotMatch(s, RIDE_BRANDS, `${r.iso2}: ${s}`);
      assert.doesNotMatch(s, OTHER_BRANDS, `${r.iso2}: ${s}`);
      assert.doesNotMatch(s, MONEY, `${r.iso2}: ${s}`);
    }
  }
  // The brand check itself catches what it should.
  for (const s of ['Book an Uber', 'Grab is common', 'use DiDi', 'Bolt and Lyft', 'call Careem']) assert.match(s, RIDE_BRANDS, s);
  assert.doesNotMatch('Bolton station', RIDE_BRANDS);
  for (const s of ['about $3', '2.90 EUR', 'RM4 per entry', '1,50 euros']) assert.match(s, MONEY, s);
});

test('getaround: short practical lines with clean spacing', () => {
  for (const r of data.countries) {
    for (const s of texts(r as unknown as Record<string, unknown>)) {
      assert.ok(s.length <= 260, `${r.iso2} too long (${s.length}): ${s}`);
      assert.doesNotMatch(s, /\s{2,}|^\s|\s$/, `${r.iso2} spacing: ${s}`);
    }
  }
});
