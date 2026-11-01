// T189: the extra "find apps" rows (catalogueExtra.ts) and their merge into the catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTRA_ROWS } from './catalogueExtra.ts';
import { CATALOGUE, CATEGORIES, EXTRA_IDS, bundleIdFor, findByName, getById, normalize, search, support } from './catalogue.ts';
import { FEATHER_BRAND_GLYPHS, isKnownGlyph, resolveGlyph } from './glyphnames.ts';

const rot13 = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const COMPETITORS = ['gurzvsl', 'vpba gurzre', 'zlfperra', 'fperraxvg', 'jvqtrgfzvgu', 'vagbyvir', 'ybbcl', 'ybpxvb'].map(rot13);
const BUNDLE_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

test('extra rows: unique, well-formed ids and names', () => {
  assert.ok(EXTRA_ROWS.length >= 386, `${EXTRA_ROWS.length} rows`); // T196: 81 + 71; T211: +115; T215: +119
  const ids = EXTRA_ROWS.map((r) => r[0]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id);
  const names = EXTRA_ROWS.map((r) => normalize(r[1]));
  assert.equal(new Set(names).size, names.length, 'duplicate names');
  for (const r of EXTRA_ROWS) {
    assert.equal(r.length, 6, r[0]);
    assert.ok(r[1].trim().length > 0, r[0]);
    assert.ok(Array.isArray(r[5]), r[0]);
  }
});

test('extra rows: reverse-DNS bundle ids, unique (case-insensitive)', () => {
  const seen = new Set<string>();
  for (const [id, , , bundleId] of EXTRA_ROWS) {
    assert.match(bundleId, BUNDLE_RE, `${id}: ${bundleId}`);
    assert.ok(bundleId.length <= 155, id);
    assert.ok(!seen.has(bundleId.toLowerCase()), `${id}: duplicate bundle id ${bundleId}`);
    seen.add(bundleId.toLowerCase());
  }
});

test('extra rows: valid categories and generic glyphs that draw', () => {
  const cats = new Set<string>(CATEGORIES);
  for (const [id, , category, , glyph] of EXTRA_ROWS) {
    assert.ok(cats.has(category), `${id}: ${category}`);
    assert.ok(isKnownGlyph(glyph), `${id}: ${glyph}`);
    assert.ok(!FEATHER_BRAND_GLYPHS.includes(glyph), `${id}: brand glyph`);
    assert.equal(resolveGlyph(glyph).fallback, false, `${id}: fallback glyph`);
  }
});

test('no competitor names in the extra rows', () => {
  const blob = normalize(JSON.stringify(EXTRA_ROWS));
  for (const c of COMPETITORS) assert.ok(!blob.includes(c), c);
});

test('merge: every extra row is in the catalogue, no scheme, unverified, Shortcuts install', () => {
  assert.equal(EXTRA_IDS.length, EXTRA_ROWS.length, 'an extra row was skipped as a duplicate');
  assert.ok(CATALOGUE.length >= 597 + EXTRA_IDS.length, `${CATALOGUE.length}`);
  for (const [id, name, category, bundleId] of EXTRA_ROWS) {
    const e = getById(id);
    assert.ok(e, id);
    assert.equal(e.name, name);
    assert.equal(e.category, category);
    assert.equal(e.urlScheme, null, id);
    assert.equal(e.verified, false, id);
    assert.equal(support(e), 'shortcuts', id);
    assert.equal(bundleIdFor(id), bundleId, id);
  }
  assert.equal(bundleIdFor('nope'), null);
});

test('merge: ids, names and known bundle ids are unique across the whole catalogue', () => {
  const ids = CATALOGUE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = CATALOGUE.map((e) => normalize(e.name));
  assert.equal(new Set(names).size, names.length);
  const bundles = CATALOGUE.map((e) => bundleIdFor(e.id)).filter((b): b is string => b !== null);
  assert.ok(bundles.length >= EXTRA_ROWS.length);
  for (const b of bundles) assert.match(b, BUNDLE_RE, b);
  const lower = bundles.map((b) => b.toLowerCase());
  assert.equal(new Set(lower).size, lower.length, 'duplicate bundle id');
});

test('search finds extra apps by name and alias', () => {
  assert.equal(search('testflight')[0].id, 'testflight');
  assert.equal(search('Steam')[0].id, 'steam');
  assert.equal(search('xiaohongshu')[0].id, 'rednote');
  assert.equal(search('tutanota')[0].id, 'tuta-mail');
  assert.equal(search('1.1.1.1')[0].id, 'cloudflare-warp');
  assert.ok(search('wireguard').some((e) => e.id === 'wireguard'));
  assert.equal(findByName('Super Mario Run')?.id, 'super-mario-run');
  // T196 batch.
  assert.equal(search('Home Assistant')[0].id, 'home-assistant');
  assert.equal(search('le chat')[0].id, 'vibe-mistral');
  assert.equal(findByName('Dumb Ways to Die')?.id, 'dumb-ways-to-die');
  assert.equal(bundleIdFor('kanopy'), 'com.kanopy.Kanopy');
  // T211 batch (incl. run 205 retries now verified).
  assert.equal(search('family link')[0].id, 'google-family-link');
  assert.equal(bundleIdFor('fotmob'), 'com.mobilefootie.fotmobpro');
  assert.equal(findByName('Hill Climb Racing 2')?.id, 'hill-climb-racing-2');
  assert.equal(findByName('Hill Climb Racing')?.id, 'hill-climb-racing');
  assert.equal(bundleIdFor('carsales'), 'com.carsales.Carsales');
  assert.equal(search('midomi')[0].id, 'soundhound');
  // T215 batch (incl. developer-id lookups) and the main rows it filled.
  assert.equal(search('notebooklm')[0].id, 'gemini-notebook');
  assert.equal(bundleIdFor('homescapes'), 'com.playrix.gardenscapes-sweethome');
  assert.equal(findByName('My Talking Tom')?.id, 'my-talking-tom');
  assert.equal(findByName('My Talking Tom 2')?.id, 'my-talking-tom-2');
  const filled: Record<string, string> = {
    'hill-climb-racing': 'com.fingersoft.hillclimbracing',
    'my-talking-tom-2': 'com.outfit7.mytalkingtom2',
    'ea-sports-fc-mobile': 'com.ea.ios.fifamobile',
    'ludo-king': 'com.gametion.ludo',
    township: 'com.playrix.township-ios',
    facetune: 'com.lightricks.Facetune2',
  };
  for (const [id, b] of Object.entries(filled)) assert.equal(getById(id)?.bundleId, b, id);
  assert.equal(CATALOGUE.length, 983);
  // The hand-written rows still win their own names.
  assert.equal(search('spotify')[0].id, 'spotify');
  assert.equal(findByName('Temple Run 2')?.id, 'temple-run-2');
});

test('search stays fast on the bigger catalogue (200 searches < 1 s)', () => {
  const queries = ['sp', 'goo', 'maps', 'bank', 'mail', 'steam', 'wirgeuard', 'xyzq', 'netflx', 'ytm'];
  search('warm up');
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) search(queries[i % queries.length]);
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
});
