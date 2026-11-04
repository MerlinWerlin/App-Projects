// T158: the store listing in docs/STORE.md stays inside every App Store / Google Play limit, keeps brand names and
// banned claims out of the paste-ready copy, and docs/SCREENSHOTS.md uses the same captions in the same order.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chars, parseStore, REQUIRED, screenshotCaptions, storeCaptions, storeProblems, type StoreField } from '../../tools/store/limits.mjs';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const STORE = read('docs/STORE.md');
const fields = parseStore(STORE);
const get = (key: string): StoreField => {
  const f = fields.find((x) => `${x.store}:${x.field}` === key);
  assert.ok(f, key);
  return f;
};

test('store listing: every required field is there, inside its limit, with no banned word or claim', () => {
  assert.deepEqual(Object.keys(REQUIRED).filter((k) => !fields.some((f) => `${f.store}:${f.field}` === k)), []);
  assert.deepEqual(storeProblems(fields), []);
});

test('store listing: keywords are comma-separated, no spaces, none already in the name or subtitle', () => {
  const kw = get('ios:Keywords').text;
  assert.ok(chars(kw) <= 100);
  assert.doesNotMatch(kw, /\s/);
  for (const w of ['satchel', 'offline', 'travel', 'wallet', 'trip', 'trips', 'tickets', 'flight', 'mode']) assert.ok(!kw.split(',').includes(w), w);
});

test('store listing: the copy says no ads, no tracking, no account, and says verify locally for emergency numbers', () => {
  for (const key of ['ios:Description', 'play:Full description']) {
    const t = get(key).text;
    assert.match(t, /No account/);
    assert.match(t, /No ads/);
    assert.match(t, /No tracking/);
    assert.match(t, /emergency numbers \(verify locally\)/);
  }
});

test('store listing: offline city maps and Satchel Plus only appear under "Add when shipped"', () => {
  const add = STORE.slice(STORE.indexOf('## Add when shipped'));
  assert.ok(add.length > 100);
  assert.match(add, /downloaded cities when available/);
  assert.match(add, /satchel-maps-v1/);
  assert.match(add, /Satchel Plus/);
  assert.match(add, /one-time purchase/);
});

test('store checker catches what it should', () => {
  const bad = parseStore(
    [
      '## App Store (iOS)',
      '| Field | Text | Chars / limit |',
      '|---|---|---|',
      '| Name | Satchel: Offline Travel Wallet and more | 30 / 30 |',
      '| Subtitle | Trips & tickets | 15 / 30 |',
      '### Keywords (100 limit)',
      '```text',
      'itinerary, travel,map,map',
      '```',
      '### Description (4000 limit)',
      '```text',
      'Better than TripIt. Saves battery: 20% less drain. Download your city map. Works on your phone. Emergency numbers included. Satchel Plus unlocks it.',
      '```',
      '## Notes',
      '### Ignored (10 limit)',
      '```text',
      'This section is not copy and is never read.',
      '```',
    ].join('\n'),
  );
  assert.equal(fields.length >= 9, true);
  assert.deepEqual(
    bad.map((f) => f.field),
    ['Name', 'Subtitle', 'Keywords', 'Description'],
  );
  const p = storeProblems(bad).join('\n');
  for (const want of [
    'ios:Name: 39 characters, limit 30',
    'ios:Name: table says 30 characters, text has 39',
    'ios:Keywords: contains a space',
    'ios:Keywords: "map" twice',
    'ios:Keywords: "travel" is already in the name or subtitle',
    'brand or competitor name "TripIt"',
    'battery-life number',
    'offline maps (not live yet)',
    'works-on-your-phone claim',
    'mentions emergency numbers without "verify locally"',
    'Satchel Plus',
    'play:Full description: missing',
  ])
    assert.ok(p.includes(want), `${want}\n---\n${p}`);
});

test('screenshots: SCREENSHOTS.md uses the STORE.md captions in order, six to eight shots', () => {
  const store = storeCaptions(STORE);
  const shots = screenshotCaptions(read('docs/SCREENSHOTS.md'));
  assert.ok(store.length >= 6 && store.length <= 8, `${store.length}`);
  assert.deepEqual(shots, store);
  assert.match(read('docs/SCREENSHOTS.md'), /\| App Store \| 6\.9" iPhone \| 1320 x 2868 \|/);
});
