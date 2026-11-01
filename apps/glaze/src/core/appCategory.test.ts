// T231: app category families (keyword rules + App Store genres), their glyphs, and the optional
// online refinement with a mocked fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_FAMILIES, FAMILY_GLYPHS, OTHER_FAMILY, categorizeAppName, familyFromGenre, familyGlyph, isAppFamily } from './appCategory.ts';
import {
  CATEGORY_MISS_TTL_MS,
  CATEGORY_TTL_MS,
  appStoreSearchUrl,
  cacheKey,
  freshEntry,
  genreFromSearch,
  keywordFamilies,
  namesMatch,
  parseCategoryCache,
  refineFamilies,
  serializeCategoryCache,
  type FetchJson,
} from './appCategoryOnline.ts';
import { FEATHER_GLYPHS, isKnownGlyph } from './glyphnames.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

// ---------------------------------------------------------------- families + glyphs

test('every family has a distinct, shipped Feather glyph', () => {
  assert.equal(APP_FAMILIES.length, 19);
  const glyphs = APP_FAMILIES.map((f) => FAMILY_GLYPHS[f]);
  assert.equal(new Set(glyphs).size, glyphs.length, 'distinct');
  for (const g of glyphs) {
    assert.ok(FEATHER_GLYPHS.includes(g), g);
    assert.ok(isKnownGlyph(g), g);
  }
  assert.equal(familyGlyph('Finance'), 'credit-card');
  assert.equal(familyGlyph('Weather'), 'cloud');
  assert.equal(familyGlyph('nonsense' as never), FAMILY_GLYPHS[OTHER_FAMILY]);
  assert.equal(familyGlyph(null), FAMILY_GLYPHS[OTHER_FAMILY]);
  assert.ok(isAppFamily('Kids') && !isAppFamily('kids') && !isAppFamily(3));
});

test('keyword rules put common unknown names in the right family', () => {
  const cases: [string, string][] = [
    ['Bendigo Bank', 'Finance'],
    ['Bankwest', 'Finance'],
    ['Up Money', 'Finance'],
    ['Crypto Wallet', 'Finance'],
    ['Joe’s Pizza', 'Food'],
    ['Local Coffee Club', 'Food'],
    ['Recipe Box', 'Food'],
    ['Flight Tracker', 'Travel'],
    ['Sydney Trains', 'Travel'],
    ['Park Smart Parking', 'Travel'],
    ['Friends Chat', 'Social'],
    ['Gym Pass', 'Health'],
    ['Sleep Cycle Tracker', 'Health'],
    ['Solitaire Classic', 'Games'],
    ['Word Puzzle Saga', 'Games'],
    ['Radio FM', 'Music'],
    ['Guitar Tuner', 'Music'],
    ['Deals Shop', 'Shopping'],
    ['QR Scanner', 'Utilities'],
    ['Stopwatch', 'Utilities'],
    ['Photo Collage Maker', 'Photo'],
    ['Daily Herald', 'News'],
    ['Learn Spanish', 'Education'],
    ['Maths Tutor', 'Education'],
    ['Todo Planner', 'Productivity'],
    ['Kids Drawing', 'Kids'],
    ['Rain Radar', 'Weather'],
    ['Cricket Live Scores', 'Sports'],
    ['Movie Tickets', 'Entertainment'],
    ['Payroll Portal for Business', 'Business'],
    ['Café Délice', 'Food'],
  ];
  for (const [name, family] of cases) assert.equal(categorizeAppName(name).family, family, name);
});

test('no rule fits: the generic family, never a throw', () => {
  for (const n of ['Zyxwv', '', '   ', '123', null as unknown as string]) {
    assert.deepEqual(categorizeAppName(n), { family: OTHER_FAMILY, keyword: null }, String(n));
  }
  assert.equal(categorizeAppName('Bendigo Bank').keyword, 'bank');
});

test('App Store genres map to families; broad genres say nothing', () => {
  const cases: [string, string][] = [
    ['Finance', 'Finance'],
    ['Food & Drink', 'Food'],
    ['Travel', 'Travel'],
    ['Navigation', 'Travel'],
    ['Social Networking', 'Social'],
    ['Health & Fitness', 'Health'],
    ['Medical', 'Health'],
    ['Games', 'Games'],
    ['Music', 'Music'],
    ['Shopping', 'Shopping'],
    ['Utilities', 'Utilities'],
    ['Developer Tools', 'Utilities'],
    ['Photo & Video', 'Photo'],
    ['Graphics & Design', 'Photo'],
    ['News', 'News'],
    ['Magazines & Newspapers', 'News'],
    ['Education', 'Education'],
    ['Book', 'Education'],
    ['Reference', 'Education'],
    ['Productivity', 'Productivity'],
    ['Kids', 'Kids'],
    ['Weather', 'Weather'],
    ['Sports', 'Sports'],
    ['Entertainment', 'Entertainment'],
    ['Business', 'Business'],
    ['food & drink', 'Food'],
    ['Puzzle Games', 'Games'],
  ];
  for (const [g, f] of cases) assert.equal(familyFromGenre(g), f, g);
  assert.equal(familyFromGenre('Lifestyle'), null);
  assert.equal(familyFromGenre('Something New'), null);
  assert.equal(familyFromGenre(undefined), null);
});

// ---------------------------------------------------------------- App Store search (pure parts)

test('search URL: encoded term, software, one result, the device store or au', () => {
  assert.equal(
    appStoreSearchUrl('Joe’s Pizza & Co', 'GB'),
    'https://itunes.apple.com/search?term=Joe%E2%80%99s%20Pizza%20%26%20Co&entity=software&limit=1&country=gb',
  );
  assert.match(appStoreSearchUrl('X', null), /&country=au$/);
  assert.match(appStoreSearchUrl('X', 'nope'), /&country=au$/);
});

test('a result counts only when its name closely matches (subtitles allowed)', () => {
  assert.ok(namesMatch('Bendigo Bank', 'Bendigo Bank'));
  assert.ok(namesMatch('Bendigo Bank', 'Bendigo Bank: Banking & Money'));
  assert.ok(namesMatch('Joe Pizza', 'Joe Pizza - Food Delivery'));
  assert.ok(namesMatch('Instagrarn', 'Instagram'), 'one OCR slip');
  assert.ok(!namesMatch('Bendigo Bank', 'Banking Made Easy'));
  assert.ok(!namesMatch('My Gym', 'Gymnastics Superstar Game'));
  assert.ok(!namesMatch('', 'x'));
  const json = { resultCount: 1, results: [{ trackName: 'Bendigo Bank: Banking & Money', primaryGenreName: 'Finance' }] };
  assert.equal(genreFromSearch(json, 'Bendigo Bank'), 'Finance');
  assert.equal(genreFromSearch(json, 'Totally Different'), null);
  for (const bad of [null, 'x', {}, { results: [] }, { results: [null] }, { results: [{ trackName: 'Bendigo Bank' }] }]) {
    assert.equal(genreFromSearch(bad, 'Bendigo Bank'), null);
  }
});

test('cache: parse tolerates junk, keeps the newest, fresh within the TTL', () => {
  assert.deepEqual(parseCategoryCache(null), {});
  assert.deepEqual(parseCategoryCache('{oops'), {});
  assert.deepEqual(parseCategoryCache('[1,2]'), {});
  const c = parseCategoryCache(JSON.stringify({ a: { genre: 'Finance', at: 5 }, b: { genre: null, at: 6 }, c: { genre: 3, at: 1 }, d: { genre: 'x' } }));
  assert.deepEqual(c, { a: { genre: 'Finance', at: 5 }, b: { genre: null, at: 6 } });
  assert.deepEqual(parseCategoryCache(serializeCategoryCache(c)), c);
  const now = 1_000_000_000_000;
  const cache = { [cacheKey('Bendigo Bank')]: { genre: 'Finance', at: now - CATEGORY_TTL_MS + 1 }, [cacheKey('Nope')]: { genre: null, at: now - CATEGORY_MISS_TTL_MS } };
  assert.equal(freshEntry(cache, 'bendigo  bank', now)?.genre, 'Finance');
  assert.equal(freshEntry(cache, 'Nope', now), undefined, 'a miss expires sooner');
  assert.equal(freshEntry(cache, 'Bendigo Bank', now + 2), undefined);
  const big = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, { genre: null, at: i }]));
  const kept = parseCategoryCache(serializeCategoryCache(big));
  assert.equal(Object.keys(kept).length, 400);
  assert.ok(kept.k499 && !kept.k0, 'oldest dropped');
});

// ---------------------------------------------------------------- refinement (mock fetch)

const STORE: Record<string, { trackName: string; primaryGenreName: string }> = {
  'Bendigo Bank': { trackName: 'Bendigo Bank', primaryGenreName: 'Finance' },
  'Zebra Hop': { trackName: 'Zebra Hop: Endless Runner', primaryGenreName: 'Games' },
  'Moodboard': { trackName: 'Moodboard', primaryGenreName: 'Lifestyle' },
  'Qantas Wrong': { trackName: 'Something Else Entirely', primaryGenreName: 'Travel' },
};

function mockFetch(log: string[], fail: ReadonlySet<string> = new Set()): FetchJson {
  return async (url, timeoutMs) => {
    assert.ok(timeoutMs > 0 && timeoutMs <= 10000);
    log.push(url);
    const term = decodeURIComponent(/term=([^&]*)/.exec(url)![1]);
    if (fail.has(term)) throw new Error('offline');
    const hit = STORE[term];
    return { resultCount: hit ? 1 : 0, results: hit ? [hit] : [] };
  };
}

test('refine: App Store genre wins when the name matches; keyword family otherwise', async () => {
  const log: string[] = [];
  const now = 1_700_000_000_000;
  const r = await refineFamilies(['Bendigo Bank', 'Zebra Hop', 'Moodboard', 'Qantas Wrong', 'Pizza Palace'], { fetchJson: mockFetch(log), country: 'NZ', now });
  assert.deepEqual(r.families, {
    'Bendigo Bank': 'Finance',
    'Zebra Hop': 'Games', // keywords alone say nothing
    Moodboard: 'Other', // Lifestyle is too broad: keyword (none) stands
    'Qantas Wrong': 'Other', // result name doesn't match: ignored
    'Pizza Palace': 'Food', // no result: keyword
  });
  assert.equal(log.length, 5);
  assert.ok(log.every((u) => u.startsWith('https://itunes.apple.com/search?term=') && u.endsWith('&entity=software&limit=1&country=nz')));
  assert.equal(r.changed, true);
  assert.equal(r.cache[cacheKey('Zebra Hop')].genre, 'Games');
  assert.equal(r.cache[cacheKey('Pizza Palace')].genre, null);

  // Second scan: everything is cached, no requests.
  const log2: string[] = [];
  const again = await refineFamilies(['Zebra Hop', 'Bendigo Bank'], { fetchJson: mockFetch(log2), now: now + 1000, cache: r.cache });
  assert.equal(log2.length, 0);
  assert.equal(again.families['Zebra Hop'], 'Games');
  assert.equal(again.changed, false);
});

test('refine: offline / throwing / slow fetch never throws and caches nothing', async () => {
  const log: string[] = [];
  const r = await refineFamilies(['Bendigo Bank', 'Zebra Hop'], { fetchJson: mockFetch(log, new Set(['Bendigo Bank', 'Zebra Hop'])), now: 1 });
  assert.deepEqual(r.families, { 'Bendigo Bank': 'Finance', 'Zebra Hop': 'Other' });
  assert.deepEqual(r.cache, {});
  assert.equal(r.changed, false);
  const weird = await refineFamilies(['Bendigo Bank'], { fetchJson: async () => 'not json', now: 1 });
  assert.equal(weird.families['Bendigo Bank'], 'Finance');
  const capped = await refineFamilies(['A1 App', 'B2 App', 'C3 App'], { fetchJson: mockFetch([]), now: 1, maxLookups: 1 });
  assert.equal(Object.keys(capped.cache).length, 1);
  assert.deepEqual(keywordFamilies(['Rain Radar']), { 'Rain Radar': 'Weather' });
});

// ---------------------------------------------------------------- wiring (source guards)

test('adapter: fetch with a timeout, AsyncStorage cache, everything caught; screen never awaits it', () => {
  const a = read('src/native/appCategory.ts');
  assert.match(a, /AsyncStorage/);
  assert.match(a, /CATEGORY_CACHE_KEY/);
  assert.match(a, /setTimeout/);
  assert.match(a, /deviceRegionCode\(\)/);
  assert.match(a, /catch/);
  const screen = read('app/home-scan.tsx');
  assert.match(screen, /refineAppFamilies\(found\.unmatched\)\s*\.then/);
  assert.doesNotMatch(screen, /await refineAppFamilies/);
  assert.match(screen, /glyphForScannedName\(/);
  assert.match(screen, /families\s*\}\)/, 'Add passes the families on to applyScan');
  assert.match(screen, /addApp\.scan\.categoryNote/);
  // The core stays pure: the network only through the injected fetch.
  assert.doesNotMatch(read('src/core/appCategoryOnline.ts'), /\bfetch\(|XMLHttpRequest|from 'react/);
  assert.doesNotMatch(read('src/core/appCategory.ts'), /\bfetch\(|https?:\/\//);
});
