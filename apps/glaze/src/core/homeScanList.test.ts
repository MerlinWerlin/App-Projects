// T230: "Scan my Home Screen" also reads App Library LIST-VIEW screenshots (pull down in the App
// Library: one app per row, A–Z section letters, an index down the right edge, the "App Library"
// search field on top), and everything found starts ticked. T231: unknown names get their
// category family's glyph. Synthetic OcrObservation arrays stand in for Vision's output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogueEntry } from './catalogue.ts';
import {
  applyScan,
  glyphForScannedName,
  isJunkLine,
  isListViewPage,
  isPlausibleLabel,
  labelsFromPage,
  pickedFromScan,
  scanHomeScreens,
  type OcrObservation,
} from './homeScan.ts';
import { MONOGRAM_GLYPH } from './monogram.ts';
import { defaultStudioState } from './studio.ts';

const e = (id: string, name: string, aliases: string[] = []): CatalogueEntry => ({
  id,
  name,
  category: 'Utilities',
  urlScheme: null,
  verified: false,
  glyph: 'box',
  aliases,
  bundleId: null,
});

const CAT: readonly CatalogueEntry[] = Object.freeze([
  e('photos', 'Photos'),
  e('camera', 'Camera'),
  e('clock', 'Clock'),
  e('google', 'Google'),
  e('google-maps', 'Google Maps'),
  e('mail', 'Mail'),
  e('photoshop', 'Photoshop Express'),
  e('spotify', 'Spotify'),
  e('uber-eats', 'Uber Eats'),
  e('x', 'X', ['twitter']),
  e('authenticator', 'Microsoft Authenticator'),
  e('commbank', 'Commonwealth Bank Australia'),
]);

const ROW_X = 0.2;
const ROW_H = 0.018;

/** One synthetic list-view screenshot: status bar, search field, section letters, rows, A–Z index. */
function listPage(sections: [string, string[]][], opts: { search?: string; index?: boolean } = {}): OcrObservation[] {
  const obs: OcrObservation[] = [
    { text: '9:41', x: 0.08, y: 0.015, w: 0.1, h: 0.018, confidence: 1 },
    { text: '87%', x: 0.82, y: 0.015, w: 0.08, h: 0.015, confidence: 1 },
  ];
  if (opts.search !== '') obs.push({ text: opts.search ?? 'App Library', x: 0.12, y: 0.07, w: 0.3, h: 0.02, confidence: 0.95 });
  obs.push({ text: 'Cancel', x: 0.82, y: 0.07, w: 0.12, h: 0.02, confidence: 0.95 });
  let y = 0.12;
  for (const [letter, names] of sections) {
    obs.push({ text: letter, x: 0.06, y, w: 0.03, h: 0.022, confidence: 0.9 });
    y += 0.04;
    for (const name of names) {
      obs.push({ text: name, x: ROW_X, y, w: Math.min(0.7, 0.025 * name.length), h: ROW_H, confidence: 0.95 });
      y += 0.06;
    }
  }
  if (opts.index !== false) {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').forEach((l, i) => obs.push({ text: l, x: 0.955, y: 0.15 + i * 0.026, w: 0.02, h: 0.012, confidence: 0.6 }));
  }
  return obs;
}

const PAGE_1 = listPage([
  ['A', ['Authenticator Plus']],
  ['B', ['Bendigo Bank Business Banking', 'Brightside Kids Learning Games']],
  ['C', ['Camera', 'Clock', 'Commonwealth Bank Australia']],
  ['G', ['Google', 'Google Maps', 'Google Photos']],
]);
const PAGE_2 = listPage(
  [
    ['M', ['Mail', 'Microsoft Authenticator', 'My Local Pizza Delivery']],
    ['P', ['Photos', 'Photoshop Express']],
    ['S', ['Spotify']],
    ['U', ['Uber Eats']],
    ['X', ['X']],
  ],
  { search: '' },
);

// ---------------------------------------------------------------- detection

test('list view is detected from the search field, the section letters or the row layout', () => {
  assert.equal(isListViewPage(PAGE_1), true);
  assert.equal(isListViewPage(PAGE_2), true, 'scrolled down: no search field, letters and rows still say list');
  const rowsOnly = listPage([['A', ['Alpha One', 'Alpha Two', 'Bravo Three', 'Charlie Four', 'Delta Five']]], { search: '', index: false });
  assert.equal(isListViewPage(rowsOnly.filter((o) => o.text !== 'A')), true, 'five left-aligned rows, one per row');
  // Localised search placeholders.
  for (const s of ['App-Mediathek', 'Biblioteca de Apps', 'Appライブラリ', 'Q App Library']) {
    assert.equal(isListViewPage([{ text: s }]), true, s);
  }
});

test('a Home Screen page is not list view, even with a calendar widget’s weekday initials', () => {
  const h = 0.011;
  const home: OcrObservation[] = [
    ...'MTWTFSS'.split('').map((l, i) => ({ text: l, x: 0.08 + i * 0.05, y: 0.1, w: 0.02, h, confidence: 0.9 })),
    { text: 'Photos', x: 0.08, y: 0.3, w: 0.1, h },
    { text: 'Camera', x: 0.32, y: 0.3, w: 0.1, h },
    { text: 'X', x: 0.56, y: 0.3, w: 0.03, h },
    { text: 'Mail', x: 0.8, y: 0.3, w: 0.08, h },
    { text: 'Clock', x: 0.08, y: 0.42, w: 0.1, h },
    { text: 'Spotify', x: 0.32, y: 0.42, w: 0.1, h },
  ];
  assert.equal(isListViewPage(home), false);
  assert.ok(scanHomeScreens([home], CAT).matched.some((m) => m.catalogueId === 'x'), 'the X app on a Home Screen still counts');
});

// ---------------------------------------------------------------- junk + plausibility

test('list chrome is junk: search field (any locale), single letters, Cancel', () => {
  for (const t of ['App Library', 'Q App Library', 'App-Mediathek', 'Bibliothèque d’apps', 'Libreria app', '앱 보관함']) assert.ok(isJunkLine(t), t);
  assert.deepEqual(labelsFromPage(PAGE_1, CAT).filter((l) => l.length === 1 || l === 'Cancel' || l === 'App Library'), []);
});

test('list rows keep long names whole; Home Screen labels stay short', () => {
  assert.equal(isPlausibleLabel('Bendigo Bank Business Banking'), false, 'too long for a Home Screen label');
  assert.equal(isPlausibleLabel('Bendigo Bank Business Banking', { list: true }), true);
  assert.equal(isPlausibleLabel('A', { list: true }), false, 'section letter');
  assert.equal(isPlausibleLabel('Pick up the kids. Then call', { list: true }), false);
});

// ---------------------------------------------------------------- whole scan

test('two list-view screenshots: every row read, matched in order, unknown names whole and untruncated', () => {
  assert.deepEqual(labelsFromPage(PAGE_1, CAT), [
    'Authenticator Plus',
    'Bendigo Bank Business Banking',
    'Brightside Kids Learning Games',
    'Camera',
    'Clock',
    'Commonwealth Bank Australia',
    'Google',
    'Google Maps',
    'Google Photos',
  ]);
  const r = scanHomeScreens([PAGE_1, PAGE_2], CAT);
  assert.deepEqual(r.matched.map((m) => m.catalogueId), [
    'camera',
    'clock',
    'commbank',
    'google',
    'google-maps',
    'mail',
    'authenticator',
    'photos',
    'photoshop',
    'spotify',
    'uber-eats',
    'x',
  ]);
  assert.ok(r.matched.every((m) => m.confidence === 1), 'list view shows whole names: exact matches');
  assert.deepEqual(r.unmatched, [
    'Authenticator Plus',
    'Bendigo Bank Business Banking',
    'Brightside Kids Learning Games',
    'Google Photos',
    'My Local Pizza Delivery',
  ]);
  assert.ok(r.unmatched.every((n) => !/…|\.\.\./.test(n)));
});

test('a list row is one app: never split into several catalogue names', () => {
  const r = scanHomeScreens([listPage([['G', ['Google Photos', 'Google', 'Photos', 'Mail', 'Clock']]])], CAT);
  assert.ok(r.unmatched.includes('Google Photos'));
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['google', 'photos', 'mail', 'clock']);
});

test('list view without boxes (plain lines) still drops letters and chrome', () => {
  const lines = ['App Library', 'Cancel', 'A', 'Authenticator Plus', 'B', 'Bendigo Bank Business Banking', 'C', 'Camera', 'Clock'].map((text) => ({ text }));
  const r = scanHomeScreens([lines], CAT);
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['camera', 'clock']);
  assert.deepEqual(r.unmatched, ['Authenticator Plus', 'Bendigo Bank Business Banking']);
});

// ---------------------------------------------------------------- confirm: everything starts ticked

test('confirm: every match (and unknown name) starts ticked; unticking leaves it out', () => {
  const r = scanHomeScreens([PAGE_1, PAGE_2], CAT);
  const all = pickedFromScan(r);
  assert.deepEqual(all.catalogueIds, r.matched.map((m) => m.catalogueId));
  assert.deepEqual(all.customNames, r.unmatched);
  const some = pickedFromScan(r, { ids: new Set(['clock']), names: new Set(['Google Photos']) });
  assert.ok(!some.catalogueIds.includes('clock') && some.catalogueIds.length === all.catalogueIds.length - 1);
  assert.ok(!some.customNames.includes('Google Photos'));
  assert.deepEqual(pickedFromScan({ matched: [], unmatched: [] }), { catalogueIds: [], customNames: [] });
});

test('one tap adds everything: catalogue apps selected, unknown names get family glyphs', () => {
  const r = scanHomeScreens([PAGE_1, PAGE_2], CAT);
  const s0 = defaultStudioState();
  // (applyScan selects ids from the real catalogue; this test is about the unknown names.)
  const out = applyScan(s0, { ...pickedFromScan(r), families: { 'Google Photos': 'Photo' } });
  assert.equal(out.addedCustom, r.unmatched.length);
  const glyphOf = (n: string) => out.state.customApps.find((c) => c.name === n)?.glyph;
  assert.equal(glyphOf('Bendigo Bank Business Banking'), 'credit-card');
  assert.equal(glyphOf('Brightside Kids Learning Games'), 'smile', 'Kids rules win over Games/Education');
  assert.equal(glyphOf('My Local Pizza Delivery'), 'coffee');
  assert.equal(glyphOf('Google Photos'), 'camera', 'a refined family passed in wins');
  assert.ok(out.state.customApps.every((c) => c.glyph !== MONOGRAM_GLYPH), 'never just letters');
});

test('re-scanning upgrades an existing monogram custom app to its family glyph', () => {
  const s0 = defaultStudioState();
  const first = applyScan(s0, { catalogueIds: [], customNames: ['Zed Weather Radar'] });
  const legacy = { ...first.state, customApps: first.state.customApps.map((c) => ({ ...c, glyph: MONOGRAM_GLYPH })) };
  const again = applyScan(legacy, { catalogueIds: [], customNames: ['ZED WEATHER RADAR'] });
  assert.equal(again.state.customApps.length, 1);
  assert.equal(again.state.customApps[0].glyph, 'cloud');
});

test('glyphForScannedName: family glyph, generic fallback, never a monogram for a known family', () => {
  assert.equal(glyphForScannedName('Qwzx'), 'grid');
  assert.equal(glyphForScannedName('Qwzx', 'Music'), 'music');
  assert.notEqual(glyphForScannedName(''), MONOGRAM_GLYPH);
});
