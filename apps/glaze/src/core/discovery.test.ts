import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { isNew, searchThemes, themesInCategory } from './categories.ts';
import {
  DISCOVERY_TABS,
  FAVOURITES_KEY,
  MAX_FAVOURITES,
  OUR_PICKS,
  discoveryI18nKeys,
  discoveryTabKey,
  discoveryThemes,
  isDiscoveryTab,
  isFavourite,
  likedThemes,
  newestThemes,
  parseFavourites,
  pickedThemes,
  serializeFavourites,
  toggleFavourite,
} from './discovery.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { THEMES, type Theme } from './themes.ts';

const root = process.cwd();
const TODAY = '2026-10-18';

const fake = (id: string, addedAt: string, base: Theme = THEMES[0]): Theme => ({ ...base, id, addedAt });

test('sub-tabs: All / New / Our picks / Liked, with keys in the themes namespace', () => {
  assert.deepEqual([...DISCOVERY_TABS], ['all', 'new', 'picks', 'liked']);
  assert.equal(discoveryTabKey('picks'), 'themes.discover.picks');
  assert.ok(isDiscoveryTab('liked'));
  assert.ok(!isDiscoveryTab('popular'));
});

test('New: only themes flagged new, newest first, ties keep catalogue order', () => {
  const list = [fake('a', '2026-10-10'), fake('b', '2026-10-16'), fake('c', '2026-10-17'), fake('d', '2026-10-16'), fake('old', '2020-01-01')];
  const got = newestThemes(list, TODAY).map((t) => t.id);
  assert.deepEqual(got, ['c', 'b', 'd', 'a'].filter((id) => isNew(list.find((t) => t.id === id)!, TODAY)));
  assert.ok(!got.includes('old'));
  // Real catalogue: every result is flagged new, and dates never go up.
  const real = newestThemes(ALL_THEMES, TODAY);
  assert.ok(real.every((t) => isNew(t, TODAY)));
  for (let i = 1; i < real.length; i++) assert.ok((real[i - 1].addedAt ?? '') >= (real[i].addedAt ?? ''));
  assert.equal(real.length, ALL_THEMES.filter((t) => isNew(t, TODAY)).length);
});

test('Our picks: a fixed editorial list of real, unique theme ids, in that order', () => {
  assert.ok(OUR_PICKS.length >= 6);
  assert.equal(new Set(OUR_PICKS).size, OUR_PICKS.length);
  const ids = new Set(ALL_THEMES.map((t) => t.id));
  for (const id of OUR_PICKS) assert.ok(ids.has(id), `unknown pick ${id}`);
  assert.deepEqual(pickedThemes(ALL_THEMES).map((t) => t.id), [...OUR_PICKS]);
  // Picks missing from the list (e.g. filtered away) are skipped, order kept.
  assert.deepEqual(pickedThemes(ALL_THEMES.filter((t) => t.id !== OUR_PICKS[0])).map((t) => t.id), OUR_PICKS.slice(1));
  // The order never depends on likes: it is the same with any favourites.
  const ctx = { today: TODAY, liked: [OUR_PICKS[3], OUR_PICKS[3], 'x'] };
  assert.deepEqual(discoveryThemes(ALL_THEMES, 'picks', ctx).map((t) => t.id), [...OUR_PICKS]);
});

test('Liked: most recent like first, unknown ids skipped', () => {
  const liked = [ALL_THEMES[2].id, 'gone', ALL_THEMES[0].id, ALL_THEMES[5].id];
  assert.deepEqual(likedThemes(ALL_THEMES, liked).map((t) => t.id), [ALL_THEMES[5].id, ALL_THEMES[0].id, ALL_THEMES[2].id]);
  assert.deepEqual(likedThemes(ALL_THEMES, []), []);
});

test('All returns the catalogue unchanged', () => {
  assert.deepEqual(discoveryThemes(ALL_THEMES, 'all', { today: TODAY, liked: [] }), [...ALL_THEMES]);
});

test('a sub-tab composes with the category and search, keeping its own order', () => {
  const ctx = { today: TODAY, liked: [...ALL_THEMES.map((t) => t.id)] };
  for (const tab of DISCOVERY_TABS) {
    const list = discoveryThemes(ALL_THEMES, tab, ctx);
    const cat = ALL_THEMES.find((t) => (t.categories ?? []).length > 0)!.categories![0];
    const inCat = themesInCategory(list, cat);
    assert.ok(inCat.every((t) => (t.categories ?? []).includes(cat)));
    assert.deepEqual(inCat, list.filter((t) => (t.categories ?? []).includes(cat)), `${tab}: order kept`);
    const q = searchThemes(inCat, list[0]?.name ?? '');
    assert.deepEqual(q, inCat.filter((t) => q.includes(t)));
  }
  // Liked composes: order is most-recent-first even after filtering.
  const liked = discoveryThemes(ALL_THEMES, 'liked', ctx);
  assert.equal(liked[0].id, ALL_THEMES[ALL_THEMES.length - 1].id);
});

test('favourites: device-local key, toggle, parse and serialise round-trip', () => {
  assert.equal(FAVOURITES_KEY, 'glaze.favourites.v1');
  let liked: string[] = [];
  liked = toggleFavourite(liked, 'a');
  liked = toggleFavourite(liked, 'b');
  assert.ok(isFavourite(liked, 'a'));
  assert.deepEqual(liked, ['a', 'b']);
  liked = toggleFavourite(liked, 'a');
  assert.deepEqual(liked, ['b']);
  liked = toggleFavourite(liked, 'a');
  assert.deepEqual(liked, ['b', 'a'], 'liking again makes it the newest like');
  assert.deepEqual(parseFavourites(serializeFavourites(liked)), liked);
  for (const bad of [null, '', 'nope', '[]', '{"liked":3}', '{}']) assert.deepEqual(parseFavourites(bad), []);
  assert.deepEqual(parseFavourites('{"liked":["a",1,"a","",null,"b"]}'), ['a', 'b']);
  const many = Array.from({ length: MAX_FAVOURITES + 10 }, (_, i) => `t${i}`);
  assert.equal(parseFavourites(serializeFavourites(many)).length, MAX_FAVOURITES);
  assert.equal(toggleFavourite(many.slice(0, MAX_FAVOURITES), 'new').length, MAX_FAVOURITES);
});

test('discovery and heart copy is in every locale', () => {
  for (const key of discoveryI18nKeys()) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en missing ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} missing ${key}`);
    }
  }
});

test('the picks tab is labelled Picks (owner fb-1023), never as popularity, counts or ranks', () => {
  const label = lookup(en as unknown as CatalogueTree, 'themes.discover.picks');
  assert.equal(label, 'Picks');
  const keys = discoveryI18nKeys();
  for (const [locale, cat] of [['en', en], ...Object.entries(TRANSLATIONS)] as const) {
    for (const key of keys) {
      const s = String(lookup(cat as unknown as CatalogueTree, key));
      assert.ok(!/popular|\d/i.test(s), `${locale} ${key}: "${s}" implies user data or a number`);
    }
  }
});

test('the heart is device-local, labelled, ≥48 pt and never shows a count (source check)', () => {
  const store = readFileSync(join(root, 'src', 'store', 'favourites.ts'), 'utf8');
  assert.match(store, /FAVOURITES_KEY/);
  assert.match(store, /AsyncStorage/);
  assert.doesNotMatch(store, /fetch\(|https?:\/\//, 'favourites never leave the device');
  // T193: the liked-wallpapers list went with the old Wallpapers gallery; one list of liked themes.
  assert.doesNotMatch(store, /WALLPAPER_FAVOURITES_KEY|useWallpaperFavourites|wallpaperFavourites/);
  const heart = readFileSync(join(root, 'src', 'ui', 'HeartButton.tsx'), 'utf8');
  for (const key of ['themes.like.add', 'themes.like.remove', 'themes.like.hint']) {
    assert.ok(heart.includes(`'${key}'`), `heart uses ${key}`);
  }
  assert.doesNotMatch(heart, /wallpapersTab|kind === 'wallpaper'/, 'the heart has one copy: liking a theme');
  assert.match(heart, /accessibilityState=\{\{ selected: liked \}\}/);
  assert.match(heart, /accessibilityRole="button"/);
  assert.match(heart, /haptic\(/);
  assert.match(heart, /heart: \{[^}]*width: sizeV2\.touch[^}]*height: sizeV2\.touch/);
  // Every card that shows a heart uses the shared button.
  const users = [
    join(root, 'src', 'ui', 'ShowcaseGrid.tsx'),
    join(root, 'src', 'ui', 'ThemeCard.tsx'),
    join(root, 'src', 'ui', 'GalleryArtCard.tsx'),
  ];
  for (const f of users) assert.match(readFileSync(f, 'utf8'), /<HeartButton\b/, `${f} uses HeartButton`);
  // T177 (owner-1031): the Themes tab keeps only All / Liked (src/core/gallery.ts); every gallery card
  // (src/ui/GalleryArtCard.tsx) carries the shared heart, so Liked covers the whole gallery.
  const screen = readFileSync(join(root, 'app', '(tabs)', 'themes.tsx'), 'utf8');
  assert.match(screen, /galleryRows<[^>]*>\(\{[^}]*filter[^}]*liked/);
  assert.match(screen, /<GalleryArtCard[\s\S]*?onToggleLike=\{onToggleLike\}/);
  assert.match(readFileSync(join(root, 'src', 'ui', 'GalleryArtCard.tsx'), 'utf8'), /<HeartButton\b/);
  // T186 (owner-1101 #4 supersedes T77 here): the Wallpapers tab no longer shows the wallpaper
  // gallery, so it has no hearts or discovery filters; Liked stays on Themes.
  const walls = readFileSync(join(root, 'app', '(tabs)', 'wallpapers.tsx'), 'utf8');
  assert.doesNotMatch(walls, /discoverWallpaperTiles\(|useWallpaperFavourites\(|<HeartButton\b/);
});

test('no invented counts or ranks anywhere discovery or hearts are drawn (source check)', () => {
  const files = [
    ['src', 'ui', 'HeartButton.tsx'],
    ['src', 'ui', 'ShowcaseGrid.tsx'],
    ['src', 'ui', 'ThemeCard.tsx'],
    ['src', 'ui', 'GalleryArtCard.tsx'],
    ['app', '(tabs)', 'themes.tsx'],
    ['app', '(tabs)', 'wallpapers.tsx'],
    ['src', 'store', 'favourites.ts'],
  ];
  const fake = /\b(likes?|hearts?|favourites?|favorites?|fans?|downloads?|installs?|views?)Count\b|\b(rank|ranking|popularity|trendingScore)\b|\{count\}|\.like\.[a-z]+', \{[^}]*count|\bliked\.length\b/i;
  for (const parts of files) {
    const src = readFileSync(join(root, ...parts), 'utf8');
    assert.doesNotMatch(src, fake, `${parts.join('/')} shows or computes a count/rank`);
  }
  // The copy: no "popular", "trending", "top", "most", "#", or numbers in any discovery/heart string.
  const keys = discoveryI18nKeys();
  assert.ok(keys.includes('themes.like.add') && keys.includes('themes.discover.label'), 'covers the heart and sub-tab copy');
  assert.ok(!keys.some((k) => k.startsWith('tabs.wallpapersTab.')), 'T193: no Wallpapers gallery copy left');
  for (const [locale, cat] of [['en', en], ...Object.entries(TRANSLATIONS)] as const) {
    for (const key of keys) {
      const s = String(lookup(cat as unknown as CatalogueTree, key));
      assert.ok(!/popular|trending|\btop\b|\bmost\b|#|\d/i.test(s), `${locale} ${key}: "${s}" implies a count or rank`);
    }
  }
});
