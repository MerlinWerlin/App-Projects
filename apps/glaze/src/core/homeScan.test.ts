// T171 "Scan my Home Screen": OCR text -> catalogue apps. Most cases run against a small fixture
// catalogue (the real one is being widened in parallel); a few smoke tests use the real CATALOGUE
// with long-standing system apps. Source guards cover the native module, adapter and screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueEntry } from './catalogue.ts';
import {
  MATCH_THRESHOLD,
  MAX_SCREENSHOTS,
  applyScan,
  cleanDisplayName,
  compactLabel,
  filterByLayout,
  isJunkLine,
  isPlausibleLabel,
  labelsFromPage,
  matchLabel,
  mergeAdjacent,
  normalizeLabel,
  scanHomeScreens,
  segmentWords,
  splitOnGaps,
  stringSimilarity,
  stripEllipsis,
  tokenSimilarity,
  type OcrObservation,
} from './homeScan.ts';
import { defaultStudioState, findApp } from './studio.ts';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const e = (id: string, name: string, aliases: string[] = [], glyph = 'box'): CatalogueEntry => ({
  id,
  name,
  category: 'Utilities',
  urlScheme: null,
  verified: false,
  glyph,
  aliases,
});

const CAT: readonly CatalogueEntry[] = Object.freeze([
  e('photos', 'Photos', ['gallery']),
  e('camera', 'Camera'),
  e('mail', 'Mail', ['email']),
  e('maps', 'Maps'),
  e('clock', 'Clock'),
  e('settings', 'Settings'),
  e('weather', 'Weather'),
  e('photoshop', 'Photoshop Express'),
  e('google-maps', 'Google Maps', ['gmaps']),
  e('google', 'Google'),
  e('uber', 'Uber'),
  e('uber-eats', 'Uber Eats'),
  e('youtube', 'YouTube', ['yt']),
  e('youtube-music', 'YouTube Music'),
  e('whatsapp', 'WhatsApp', ['whats app']),
  e('x', 'X', ['twitter']),
  e('cafe', 'Café Finder'),
  e('instagram', 'Instagram', ['insta']),
  e('spotify', 'Spotify'),
  e('commbank', 'CommBank'),
  e('commsec', 'CommSec'),
]);

const lines = (...t: string[]): OcrObservation[] => t.map((text) => ({ text, confidence: 0.9 }));

// ---------------------------------------------------------------- normalise

test('normalise: case, diacritics, quotes and spaces', () => {
  assert.equal(normalizeLabel('  Café   Finder '), 'cafe finder');
  assert.equal(normalizeLabel('Señor’s'), "senor's");
  assert.equal(compactLabel('You Tube'), 'youtube');
  assert.equal(compactLabel('Uber-Eats'), 'ubereats');
});

test('ellipsis-truncated labels are detected and stripped', () => {
  assert.deepEqual(stripEllipsis('Photosh…'), { text: 'Photosh', truncated: true });
  assert.deepEqual(stripEllipsis('Photosh...'), { text: 'Photosh', truncated: true });
  assert.deepEqual(stripEllipsis('Photosh..'), { text: 'Photosh', truncated: true });
  assert.deepEqual(stripEllipsis('Photos'), { text: 'Photos', truncated: false });
  assert.deepEqual(stripEllipsis('…'), { text: '', truncated: false });
  assert.equal(cleanDisplayName('  My  Bank…'), 'My Bank');
  assert.equal(cleanDisplayName('• Disney+'), 'Disney+');
  assert.ok(cleanDisplayName('A'.repeat(80)).length <= 40);
});

// ---------------------------------------------------------------- clean

test('status-bar text is junk: times, battery, carrier, network', () => {
  for (const t of ['9:41', '09:41', '12:05 PM', '9.41am', '100%', '87 %', 'Telstra', 'Vodafone', 'AT&T', 'SOS', '5G', 'LTE', 'Telstra 5G', 'SOS LTE', 'EE', 'Wi-Fi']) {
    assert.ok(isJunkLine(t), t);
  }
});

test('widget, page-dot and chrome text is junk', () => {
  for (const t of [
    '',
    '   ',
    '• • •',
    '...',
    '○ ● ○',
    '3',
    '12',
    'Search',
    'Q Search',
    '23°',
    'H:25° L:14°',
    'Mostly Sunny',
    'Monday 3',
    'Tuesday, 14',
    'Oct 30',
    '30 October',
    'No events today',
    'Tomorrow',
    'Up Next',
    'www.example.com',
  ]) {
    assert.ok(isJunkLine(t), JSON.stringify(t));
  }
});

test('real app labels are not junk', () => {
  for (const t of ['Photos', 'Weather', 'Clock', 'Settings', 'Uber Eats', 'X', 'Photosh…', 'Café Finder', 'Three Kingdoms', 'Skype']) {
    assert.ok(!isJunkLine(t), t);
  }
});

test('plausible labels are short; widget sentences are not', () => {
  assert.ok(isPlausibleLabel('My Bank'));
  assert.ok(isPlausibleLabel('X'));
  assert.ok(isPlausibleLabel('Photosh…'));
  assert.ok(!isPlausibleLabel('Pick up the kids from school at four'));
  assert.ok(!isPlausibleLabel('Meeting moved. Call me'));
  assert.ok(!isPlausibleLabel('ThisLabelIsFarTooLongToBeAnAppLabel'));
  assert.ok(!isPlausibleLabel('12'));
});

// ---------------------------------------------------------------- matching

test('exact names match with confidence 1, ignoring case, diacritics and spacing', () => {
  assert.deepEqual(matchLabel('photos', CAT), { entry: CAT[0], confidence: 1 });
  assert.equal(matchLabel('CAFE FINDER', CAT)?.entry.id, 'cafe');
  assert.equal(matchLabel('You Tube', CAT)?.entry.id, 'youtube');
  assert.equal(matchLabel('Whats App', CAT)?.entry.id, 'whatsapp');
  assert.equal(matchLabel('X', CAT)?.entry.id, 'x');
});

test('truncated labels match by prefix; ambiguity lowers confidence and prefers the shortest', () => {
  const p = matchLabel('Photosh…', CAT);
  assert.equal(p?.entry.id, 'photoshop');
  assert.equal(p?.confidence, 0.9);
  const y = matchLabel('YouTube M…', CAT);
  assert.equal(y?.entry.id, 'youtube-music');
  const c = matchLabel('Comm…', CAT);
  assert.equal(c?.entry.id, 'commsec', 'CommBank and CommSec both start "comm": the shortest name wins');
  assert.ok(c!.confidence < 0.9 && c!.confidence >= MATCH_THRESHOLD);
  assert.equal(matchLabel('Uber Ea…', CAT)?.entry.id, 'uber-eats');
});

test('aliases match below exact names; two-letter aliases never do', () => {
  assert.equal(matchLabel('Twitter', CAT)?.entry.id, 'x');
  assert.equal(matchLabel('Twitter', CAT)?.confidence, 0.85);
  assert.equal(matchLabel('YT', CAT), null);
});

test('fuzzy: one OCR slip in a longer name still matches; short names need an exact match', () => {
  assert.equal(matchLabel('Instagrarn', CAT)?.entry.id, 'instagram');
  assert.equal(matchLabel('Spotifv', CAT)?.entry.id, 'spotify');
  assert.equal(matchLabel('Settinqs', CAT)?.entry.id, 'settings');
  assert.equal(matchLabel('Mali', CAT), null, 'four letters: no fuzzy');
  assert.equal(matchLabel('Maps', CAT)?.entry.id, 'maps');
  assert.equal(matchLabel('My Bank', CAT), null);
  assert.equal(matchLabel('Zzzzzz', CAT), null);
  assert.equal(matchLabel('', CAT), null);
});

test('untruncated long labels match the start of exactly one name', () => {
  assert.equal(matchLabel('Photoshop', CAT)?.entry.id, 'photoshop');
  assert.equal(matchLabel('Photoshop', CAT)?.confidence, 0.8);
  assert.equal(matchLabel('Google', CAT)?.entry.id, 'google', 'an exact name beats a prefix');
});

test('similarity helpers', () => {
  assert.equal(stringSimilarity('Mail', 'mail'), 1);
  assert.ok(stringSimilarity('Instagrarn', 'Instagram') >= 0.8);
  assert.equal(stringSimilarity('', 'x'), 0);
  assert.equal(tokenSimilarity('Google Maps', 'maps google'), 1);
  assert.ok(Math.abs(tokenSimilarity('Google Maps', 'Maps') - 2 / 3) < 1e-9);
  assert.equal(tokenSimilarity('', 'Maps'), 0);
});

// ---------------------------------------------------------------- split / merge

test('split: wide gaps and runs of catalogue names', () => {
  assert.deepEqual(splitOnGaps('Photos   Camera\tMail'), ['Photos', 'Camera', 'Mail']);
  assert.deepEqual(splitOnGaps('Uber Eats'), ['Uber Eats']);
  assert.deepEqual(segmentWords('Photos Camera Mail Clock', CAT), ['Photos', 'Camera', 'Mail', 'Clock']);
  assert.deepEqual(segmentWords('Google Maps Uber Eats', CAT), ['Google Maps', 'Uber Eats']);
  assert.equal(segmentWords('Photos Unknownapp', CAT), null, 'every word must be covered');
  assert.equal(segmentWords('Photos', CAT), null);
});

test('merge: two boxes on one row with a word gap become one label; neighbours stay apart', () => {
  const h = 0.012;
  const out = mergeAdjacent([
    { text: 'Tube', x: 0.12, y: 0.2, w: 0.05, h },
    { text: 'You', x: 0.08, y: 0.2, w: 0.035, h },
    { text: 'Mail', x: 0.33, y: 0.201, w: 0.05, h },
    { text: 'Clock', x: 0.08, y: 0.32, w: 0.06, h },
    { text: 'loose' },
  ]);
  assert.deepEqual(
    out.map((o) => o.text),
    ['You Tube', 'Mail', 'Clock', 'loose'],
  );
});

test('layout: the status-bar band and oversized widget text are dropped when boxes are known', () => {
  const label = (text: string, x: number, y: number): OcrObservation => ({ text, x, y, w: 0.1, h: 0.012, confidence: 0.9 });
  const kept = filterByLayout([
    { text: 'Optus', x: 0.05, y: 0.01, w: 0.1, h: 0.015 },
    { text: 'Sydney', x: 0.1, y: 0.1, w: 0.3, h: 0.04 },
    label('Photos', 0.1, 0.2),
    label('Camera', 0.3, 0.2),
    label('Mail', 0.5, 0.2),
    { text: 'no box' },
  ]);
  assert.deepEqual(
    kept.map((o) => o.text),
    ['Photos', 'Camera', 'Mail', 'no box'],
  );
});

// ---------------------------------------------------------------- whole scan

test('one page: junk dropped, apps matched, unknown labels kept as names', () => {
  const page = lines('9:41', '87%', 'Telstra 5G', 'Photos', 'Camera   Mail', 'Photosh…', 'My Bank', '• • •', 'Q Search', '3', 'Pick up the kids from school at four');
  assert.deepEqual(labelsFromPage(page, CAT), ['Photos', 'Camera', 'Mail', 'Photosh…', 'My Bank']);
  const r = scanHomeScreens([page], CAT);
  assert.deepEqual(
    r.matched.map((m) => [m.catalogueId, m.name]),
    [
      ['photos', 'Photos'],
      ['camera', 'Camera'],
      ['mail', 'Mail'],
      ['photoshop', 'Photoshop Express'],
    ],
  );
  assert.equal(r.matched[3].label, 'Photosh…');
  assert.deepEqual(r.unmatched, ['My Bank']);
});

test('low-confidence OCR lines and malformed input are ignored', () => {
  const r = scanHomeScreens([[{ text: 'Photos', confidence: 0.1 }, { text: 'Camera', confidence: 0.95 }, null as unknown as OcrObservation, { text: 5 as unknown as string }]], CAT);
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['camera']);
  assert.deepEqual(scanHomeScreens([], CAT), { matched: [], unmatched: [] });
  assert.deepEqual(scanHomeScreens(null as unknown as OcrObservation[][], CAT), { matched: [], unmatched: [] });
});

test('de-duplicates across screenshots; keeps first-seen order and the most confident reading', () => {
  const r = scanHomeScreens(
    [lines('Photos', 'Photosh…', 'My Bank', 'Spotifv'), lines('photos', 'Photoshop Express', 'MY BANK', 'Spotify', 'Clock')],
    CAT,
  );
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['photos', 'photoshop', 'spotify', 'clock']);
  assert.equal(r.matched[1].confidence, 1, 'the whole name on page 2 beats the truncated one');
  assert.equal(r.matched[1].label, 'Photoshop Express');
  assert.equal(r.matched[2].confidence, 1);
  assert.deepEqual(r.unmatched, ['My Bank']);
});

test('an unmatched truncated label that is a matched app seen whole elsewhere is dropped', () => {
  // "Spoti" (no ellipsis read) doesn't match on its own, but Spotify is found on page 2.
  const r = scanHomeScreens([lines('Spoti'), lines('Spotify')], CAT);
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['spotify']);
  assert.deepEqual(r.unmatched, []);
});

test('at most MAX_SCREENSHOTS pages are read', () => {
  const pages = Array.from({ length: MAX_SCREENSHOTS + 3 }, (_, i) => lines(i === MAX_SCREENSHOTS + 1 ? 'Clock' : 'Photos'));
  assert.deepEqual(scanHomeScreens(pages, CAT).matched.map((m) => m.catalogueId), ['photos']);
});

test('boxes: a realistic page with a weather widget, labels in rows and the dock-less Search pill', () => {
  const h = 0.011;
  const page: OcrObservation[] = [
    { text: '9:41', x: 0.08, y: 0.015, w: 0.1, h: 0.018, confidence: 1 },
    { text: '100%', x: 0.8, y: 0.015, w: 0.1, h: 0.015, confidence: 1 },
    { text: 'Sydney', x: 0.08, y: 0.08, w: 0.3, h: 0.03, confidence: 0.99 },
    { text: '23°', x: 0.08, y: 0.12, w: 0.2, h: 0.06, confidence: 0.99 },
    { text: 'Weather', x: 0.2, y: 0.26, w: 0.12, h, confidence: 0.98 },
    { text: 'Calendar', x: 0.66, y: 0.26, w: 0.14, h, confidence: 0.98 },
    { text: 'You', x: 0.08, y: 0.4, w: 0.04, h, confidence: 0.9 },
    { text: 'Tube', x: 0.125, y: 0.4, w: 0.05, h, confidence: 0.9 },
    { text: 'Uber Ea…', x: 0.3, y: 0.4, w: 0.12, h, confidence: 0.9 },
    { text: 'My Bank', x: 0.55, y: 0.4, w: 0.12, h, confidence: 0.9 },
    { text: 'Q Search', x: 0.42, y: 0.86, w: 0.16, h: 0.014, confidence: 0.9 },
  ];
  const r = scanHomeScreens([page], CAT);
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['weather', 'youtube', 'uber-eats']);
  assert.deepEqual(r.unmatched, ['Calendar', 'My Bank'], 'Calendar is not in the fixture catalogue');
});

test('smoke: the real catalogue matches common system apps', () => {
  const r = scanHomeScreens([lines('9:41', 'Photos', 'Camera', 'Settings', 'Clock', 'Weather', 'Mail', 'Search')]);
  assert.deepEqual(r.matched.map((m) => m.catalogueId), ['photos', 'camera', 'settings', 'clock', 'weather', 'mail']);
  assert.ok(r.matched.every((m) => m.confidence === 1));
  assert.deepEqual(r.unmatched, []);
});

// ---------------------------------------------------------------- applying

test('applyScan selects catalogue apps and adds names as monogram custom apps, in order, once', () => {
  const s0 = defaultStudioState();
  const r = applyScan(s0, { catalogueIds: ['photos', 'camera', 'photos', 'not-a-real-id'], customNames: ['My Bank', 'my bank', '  ', 'Gym Pass…'] });
  assert.equal(r.addedCatalogue, 2);
  assert.equal(r.addedCustom, 2);
  assert.deepEqual(r.state.selected.slice(0, 2), ['photos', 'camera']);
  assert.equal(r.state.customApps.length, 2);
  assert.deepEqual(r.state.customApps.map((c) => c.name), ['My Bank', 'Gym Pass']);
  const bank = findApp(r.state, r.state.customApps[0].id);
  assert.equal(bank?.glyph, 'monogram', 'custom apps draw their initials');
  assert.ok(r.state.selected.includes(r.state.customApps[1].id));
  // Running the same scan again adds nothing new and makes no duplicate custom apps.
  const again = applyScan(r.state, { catalogueIds: ['photos'], customNames: ['MY BANK'] });
  assert.equal(again.addedCatalogue, 0);
  assert.equal(again.addedCustom, 0);
  assert.equal(again.state.customApps.length, 2);
  assert.equal(s0.selected.length, 0, 'input state is not mutated');
});

// ---------------------------------------------------------------- native module + wiring (source guards)

test('native module: Expo module config, podspec and Vision text recognition (iOS only)', () => {
  const dir = 'modules/glaze-home-scan';
  const cfg = JSON.parse(read(`${dir}/expo-module.config.json`)) as { platforms: string[]; apple: { modules: string[] } };
  assert.deepEqual(cfg.platforms, ['apple']);
  assert.deepEqual(cfg.apple.modules, ['GlazeHomeScanModule']);
  assert.ok(!existsSync(join(root, dir, 'android')));
  const spec = read(`${dir}/ios/GlazeHomeScan.podspec`);
  assert.match(spec, /s\.name\s+= 'GlazeHomeScan'/);
  assert.match(spec, /'Vision'/);
  assert.match(spec, /dependency 'ExpoModulesCore'/);
  const swift = read(`${dir}/ios/GlazeHomeScanModule.swift`);
  assert.match(swift, /Name\("GlazeHomeScan"\)/);
  assert.match(swift, /AsyncFunction\("recognizeText"\)/);
  assert.match(swift, /VNRecognizeTextRequest/);
  assert.match(swift, /recognitionLevel = \.accurate/);
  assert.match(swift, /usesLanguageCorrection = false/);
  assert.match(swift, /UIImage\(contentsOfFile:/);
  // On device only: no networking, no Photos library access (the picker hands over a file).
  assert.doesNotMatch(swift, /URLSession|import Photos|PHPhotoLibrary|UIBackgroundModes/);
  assert.match(read(`${dir}/index.ts`), /requireOptionalNativeModule<[^>]+>\('GlazeHomeScan'\)/);
});

test('native module links only in the native build: package.json keeps modules-off', () => {
  const pkg = JSON.parse(read('package.json')) as { expo?: { autolinking?: { nativeModulesDir?: string } }; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  assert.equal(pkg.expo?.autolinking?.nativeModulesDir, './modules-off');
  assert.ok(!existsSync(join(root, 'modules-off', 'glaze-home-scan')));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  assert.ok(!('@bacons/apple-targets' in deps) && !('expo-dev-client' in deps));
});

test('adapter never crashes Expo Go / Android / web and the screen uses it', () => {
  const adapter = read('src/native/homeScan.ts');
  assert.match(adapter, /requireOptionalNativeModule/);
  assert.match(adapter, /Platform\.OS !== 'ios'/);
  assert.match(adapter, /isExpoGo\(\)/);
  assert.match(adapter, /catch/);
  assert.doesNotMatch(adapter, /from '\.\.\/\.\.\/modules\//, 'app code reaches the module through requireOptionalNativeModule only');
  const screen = read('app/home-scan.tsx');
  assert.match(screen, /from '\.\.\/src\/native\/homeScan'/);
  assert.match(screen, /from '\.\.\/src\/core\/homeScan'/);
  assert.match(screen, /allowsMultipleSelection: true/);
  assert.match(screen, /applyScan\(/);
  assert.match(screen, /\/add-app/, 'manual fallback links to add-app');
  assert.match(read('app/add-app.tsx'), /\/home-scan/, 'add-app offers the scan');
  assert.match(read('app/_layout.tsx'), /name="home-scan"/);
});

test('privacy: review note and photo library usage string exist', () => {
  assert.match(read('docs/REVIEW_NOTES.md'), /Scan my Home Screen/);
  assert.match(read('docs/REVIEW_NOTES.md'), /never uploaded|not uploaded|nothing is uploaded/i);
  const app = JSON.parse(read('app.json')) as { expo: { ios: { infoPlist: Record<string, string> } } };
  assert.ok((app.expo.ios.infoPlist.NSPhotoLibraryUsageDescription ?? '').length > 20);
});
