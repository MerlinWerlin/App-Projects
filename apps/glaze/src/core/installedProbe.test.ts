import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, getById } from './catalogue.ts';
import {
  MAX_QUERY_SCHEMES,
  PROBE_APPS,
  PROBE_APP_IDS,
  autoSelect,
  bareScheme,
  clearUnticked,
  defaultProbeState,
  installedIdsFrom,
  markUnticked,
  parseProbeState,
  probeUrlFor,
  schemesToQuery,
  PROBE_UNVERIFIED_IDS,
  UNVERIFIED_SCHEME_OVERRIDES,
  serializeProbeState,
  withFound,
} from './installedProbe.ts';
import { MAX_SELECTED } from './studio.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('T229: at most 50 schemes, unique, bare (no ":" or "//")', () => {
  const s = schemesToQuery();
  assert.ok(s.length > 0 && s.length <= MAX_QUERY_SCHEMES, `${s.length} schemes`);
  assert.equal(MAX_QUERY_SCHEMES, 50);
  assert.equal(new Set(s).size, s.length);
  for (const x of s) assert.match(x, /^[a-z][a-z0-9+.-]*$/, x);
});

test('T229/T239: verified ids first; then unverified popular apps, all catalogue rows, never System', () => {
  assert.equal(new Set(PROBE_APP_IDS).size, PROBE_APP_IDS.length);
  const verified = PROBE_APPS.filter((a) => a.verified);
  assert.equal(verified.length, PROBE_APP_IDS.length, 'no verified id was dropped');
  assert.deepEqual(PROBE_APPS.slice(0, verified.length).map((a) => a.id), [...PROBE_APP_IDS]);
  for (const a of PROBE_APPS) {
    const e = getById(a.id);
    assert.ok(e, a.id);
    assert.notEqual(e.category, 'System', a.id);
    assert.equal(a.verified, e.verified === true, a.id);
    const raw = e.urlScheme ?? UNVERIFIED_SCHEME_OVERRIDES[a.id];
    assert.ok(raw, a.id);
    assert.equal(bareScheme(raw), a.scheme, a.id);
    if (!a.verified) assert.ok(PROBE_UNVERIFIED_IDS.includes(a.id), a.id);
  }
});

test('T239 (owner-1101g #4): the full 50, with the big unverified apps in it', () => {
  assert.equal(schemesToQuery().length, MAX_QUERY_SCHEMES);
  const ids = new Set(PROBE_APPS.map((a) => a.id));
  for (const id of ['youtube', 'netflix', 'tiktok', 'reddit', 'amazon', 'paypal', 'disney-plus', 'uber-eats']) assert.ok(ids.has(id), id);
});

test('T229: list covers the main categories', () => {
  const cats = new Set(PROBE_APPS.map((a) => getById(a.id)!.category));
  for (const c of ['Social', 'Messaging', 'Music & Audio', 'Video & TV', 'Productivity', 'Travel & Transport', 'Utilities']) {
    assert.ok(cats.has(c as never), c);
  }
});

test('T229: every verified non-System scheme in the catalogue is probed while there is room', () => {
  const eligible = CATALOGUE.filter((e) => e.urlScheme && e.verified && e.category !== 'System');
  if (eligible.length <= MAX_QUERY_SCHEMES) {
    const ids = new Set(PROBE_APP_IDS);
    for (const e of eligible) assert.ok(ids.has(e.id), `${e.id} is eligible but not probed`);
  }
});

test('T229: native-plugins/queryschemes.json equals the core list (node scripts/gen-query-schemes.mjs)', () => {
  const piece = JSON.parse(readFileSync(join(ROOT, 'native-plugins', 'queryschemes.json'), 'utf8'));
  assert.deepEqual(Object.keys(piece), ['infoPlist']);
  assert.deepEqual(Object.keys(piece.infoPlist), ['LSApplicationQueriesSchemes']);
  assert.deepEqual(piece.infoPlist.LSApplicationQueriesSchemes, schemesToQuery());
});

test('T229: the production EAS profile stays native-free', () => {
  const eas = JSON.parse(readFileSync(join(ROOT, 'eas.json'), 'utf8'));
  assert.equal(eas.build.production.env.GLAZE_NATIVE, '0');
});

test('T229: review notes and privacy page state the real list size', () => {
  const n = schemesToQuery().length;
  const notes = readFileSync(join(ROOT, 'docs', 'REVIEW_NOTES.md'), 'utf8');
  const privacy = readFileSync(join(ROOT, 'docs', 'privacy.html'), 'utf8');
  assert.match(notes, new RegExp(`declares ${n} URL schemes`));
  assert.match(notes, /LSApplicationQueriesSchemes/);
  assert.match(privacy, new RegExp(`whether ${n} specific popular apps`));
  assert.match(privacy, /nothing leaves your phone/);
});

test('T229: probeUrlFor', () => {
  assert.equal(probeUrlFor('instagram'), 'instagram://');
  assert.equal(probeUrlFor('instagram://'), 'instagram://');
  assert.equal(probeUrlFor('spotify:'), 'spotify://');
  assert.equal(bareScheme(' FB:// '), 'fb');
});

test('T229: installedIdsFrom maps true answers back to ids in probe order', () => {
  assert.deepEqual(installedIdsFrom({ spotify: true, instagram: true, fb: false, nope: true }), ['instagram', 'spotify']);
  assert.deepEqual(installedIdsFrom({}), []);
});

test('T229: autoSelect adds installed apps, keeps order, never re-adds unticked ones', () => {
  const cur = ['photos', 'instagram'];
  assert.deepEqual(autoSelect(cur, ['instagram', 'spotify', 'gmail'], new Set(['gmail'])), ['photos', 'instagram', 'spotify']);
  assert.deepEqual(autoSelect(cur, ['spotify', 'gmail'], ['spotify']), ['photos', 'instagram', 'gmail']);
  // Nothing new: same array back.
  assert.equal(autoSelect(cur, ['instagram'], []), cur);
  assert.equal(autoSelect(cur, ['spotify'], ['spotify']), cur);
  assert.equal(autoSelect(cur, [], []), cur);
});

test('T229: autoSelect respects MAX_SELECTED', () => {
  const full = Array.from({ length: MAX_SELECTED }, (_, i) => `custom-${i}`);
  assert.equal(autoSelect(full, ['spotify'], []), full);
  const almost = full.slice(1);
  assert.equal(autoSelect(almost, ['spotify', 'gmail'], []).length, MAX_SELECTED);
});

test('T229: probe state parse / serialize / untick round trip', () => {
  assert.deepEqual(parseProbeState(null), defaultProbeState());
  assert.deepEqual(parseProbeState('not json'), defaultProbeState());
  assert.deepEqual(parseProbeState('[1]'), defaultProbeState());
  let s = withFound(defaultProbeState(), ['instagram', 'spotify', 'gmail'], ['photos', 'instagram', 'spotify']);
  assert.deepEqual(s.foundIds, ['instagram', 'spotify'], 'only apps now in the icon set');
  s = markUnticked(s, 'spotify');
  assert.equal(markUnticked(s, 'spotify'), s);
  assert.equal(markUnticked(s, 'photos'), s, 'not probed: ignored');
  assert.deepEqual(s, { unticked: ['spotify'], foundIds: ['instagram'] });
  assert.deepEqual(parseProbeState(serializeProbeState(s)), s);
  assert.deepEqual(withFound(s, ['spotify', 'instagram'], ['spotify', 'instagram']).foundIds, ['instagram'], 'unticked never counted');
  assert.deepEqual(clearUnticked(s, 'spotify').unticked, []);
  assert.equal(clearUnticked(s, 'gmail'), s);
  const odd = parseProbeState(JSON.stringify({ unticked: ['spotify', 3, 'zzz', 'spotify'], foundIds: ['spotify', 'gmail', 'gmail'] }));
  assert.deepEqual(odd, { unticked: ['spotify'], foundIds: ['gmail'] });
});
