import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookup, type CatalogueTree } from './i18n.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { THEMES } from './themes.ts';
import {
  GRID_COLUMNS,
  INITIAL_TILE_COUNT,
  LIVE_TAB_HREF,
  PHOTO_HREF,
  TILE_PAGE,
  WALLPAPER_SUB_TABS,
  discoverWallpaperTiles,
  discoveryApplies,
  gridTileSize,
  isWallpaperSubTab,
  loopHref,
  pairHalfSize,
  themeWallpaperHref,
  tileFavouriteId,
  tileRows,
  visibleTileCount,
  wallpaperSubTabKey,
  wallpaperTiles,
  wallpaperTilesI18nKeys,
} from './wallpaperTiles.ts';
import { DISCOVERY_TABS, FAVOURITES_KEY, OUR_PICKS, WALLPAPER_FAVOURITES_KEY, discoveryThemes } from './discovery.ts';

const loops = [
  { id: 'old', updatedAt: 100 },
  { id: 'new', updatedAt: 300 },
  { id: 'mid', updatedAt: 200 },
];

test('sub-tabs: Still / Live / Pairs', () => {
  assert.deepEqual([...WALLPAPER_SUB_TABS], ['still', 'live', 'pairs']);
  assert.ok(isWallpaperSubTab('live'));
  assert.ok(!isWallpaperSubTab('video'));
  assert.ok(!isWallpaperSubTab(undefined));
  assert.equal(wallpaperSubTabKey('pairs'), 'tabs.wallpapersTab.sub.pairs');
});

test('still: a photo entry first, then every theme once, none live', () => {
  const tiles = wallpaperTiles('still', { themes: ALL_THEMES, loops });
  assert.equal(tiles[0].kind, 'photo');
  assert.equal(tiles[0].href, PHOTO_HREF);
  const themeTiles = tiles.slice(1);
  assert.deepEqual(themeTiles.map((t) => t.themeId), ALL_THEMES.map((t) => t.id));
  assert.ok(tiles.every((t) => t.live === false), 'no still tile is live');
  assert.ok(themeTiles.every((t) => t.kind === 'theme'));
  assert.equal(new Set(tiles.map((t) => t.id)).size, tiles.length, 'ids unique');
});

test('plus flag follows the theme; Plus themes link to their theme page', () => {
  const tiles = wallpaperTiles('still', { themes: ALL_THEMES, loops: [] }).filter((t) => t.kind === 'theme');
  for (const tile of tiles) {
    const th = ALL_THEMES.find((x) => x.id === tile.themeId)!;
    assert.equal(tile.plus, th.plus);
    assert.equal(tile.href, th.plus ? `/theme/${th.id}` : `/wallpaper?theme=${th.id}`);
  }
  // Starters open the editor (which only opens free themes).
  assert.ok(THEMES.every((t) => !t.plus));
  assert.ok(tiles.some((t) => t.plus), 'catalogue has Plus themes');
});

test('hrefs encode ids', () => {
  assert.equal(themeWallpaperHref({ id: 'a b', plus: false }), '/wallpaper?theme=a%20b');
  assert.equal(themeWallpaperHref({ id: 'x/y', plus: true }), '/theme/x%2Fy');
  assert.equal(loopHref('l 1'), '/live/l%201');
});

test('live: only real loops are live, newest first, then the make tile', () => {
  const tiles = wallpaperTiles('live', { themes: ALL_THEMES, loops });
  assert.deepEqual(tiles.map((t) => t.loopId ?? t.kind), ['new', 'mid', 'old', 'makeLive']);
  const loopTiles = tiles.filter((t) => t.kind === 'loop');
  assert.ok(loopTiles.every((t) => t.live && !t.plus && t.href === loopHref(t.loopId!)));
  const make = tiles[tiles.length - 1];
  assert.equal(make.live, false);
  assert.equal(make.href, LIVE_TAB_HREF);
});

test('live empty state: just the make tile, not live', () => {
  const tiles = wallpaperTiles('live', { themes: ALL_THEMES, loops: [] });
  assert.equal(tiles.length, 1);
  assert.equal(tiles[0].kind, 'makeLive');
  assert.equal(tiles[0].live, false);
});

test('live: duplicate, blank and bad-timestamp loops are handled', () => {
  const tiles = wallpaperTiles('live', {
    themes: [],
    loops: [{ id: 'a', updatedAt: 5 }, { id: 'a', updatedAt: 9 }, { id: '', updatedAt: 1 }, { id: 'b', updatedAt: Number.NaN }],
  });
  assert.deepEqual(tiles.map((t) => t.loopId ?? t.kind), ['a', 'b', 'makeLive']);
});

test('pairs: one per theme, never live, never from loops', () => {
  const tiles = wallpaperTiles('pairs', { themes: ALL_THEMES, loops });
  assert.equal(tiles.length, ALL_THEMES.length);
  assert.ok(tiles.every((t) => t.kind === 'pair' && t.live === false && t.loopId === undefined));
  const dup = wallpaperTiles('pairs', { themes: [{ id: 'q', plus: false }, { id: 'q', plus: false }], loops: [] });
  assert.equal(dup.length, 1);
});

test('LIVE badge count equals saved loop count on every tab', () => {
  for (const tab of WALLPAPER_SUB_TABS) {
    const n = wallpaperTiles(tab, { themes: ALL_THEMES, loops }).filter((t) => t.live).length;
    assert.equal(n, tab === 'live' ? loops.length : 0, tab);
  }
});

test('two-column tile maths fits the row', () => {
  for (const w of [320, 343, 358, 390, 398, 768]) {
    const { tileWidth, tileHeight } = gridTileSize(w, 12);
    assert.ok(tileWidth * GRID_COLUMNS + 12 <= w, `fits ${w}`);
    assert.ok(w - (tileWidth * 2 + 12) < 2, `no wasted space ${w}`);
    assert.equal(tileHeight, Math.round(tileWidth * 2));
    assert.ok(tileWidth >= 48, 'tap target');
  }
  assert.deepEqual(gridTileSize(0, 12), { tileWidth: 0, tileHeight: 0 });
  assert.deepEqual(gridTileSize(Number.NaN, 12), { tileWidth: 0, tileHeight: 0 });
  assert.deepEqual(gridTileSize(100, 0, 1, 1), { tileWidth: 100, tileHeight: 100 });
  const half = pairHalfSize(160, 6);
  assert.equal(half.width, 77);
  assert.ok(half.width * 2 + 6 <= 160);
  assert.equal(pairHalfSize(-5, 6).width, 0);
});

test('paging and rows', () => {
  assert.equal(visibleTileCount(100, 0), INITIAL_TILE_COUNT);
  assert.equal(visibleTileCount(100, 1), INITIAL_TILE_COUNT + TILE_PAGE);
  assert.equal(visibleTileCount(3, 5), 3);
  assert.equal(visibleTileCount(100, -1), INITIAL_TILE_COUNT);
  assert.deepEqual(tileRows([1, 2, 3, 4, 5]), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(tileRows([]), []);
});

test('every locale has the Wallpapers tab strings, placeholders kept', () => {
  const keys = wallpaperTilesI18nKeys();
  for (const tab of WALLPAPER_SUB_TABS) assert.ok(keys.includes(wallpaperSubTabKey(tab)));
  for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
    for (const key of keys) {
      const v = lookup(cat as CatalogueTree, key);
      assert.equal(typeof v, 'string', `${locale} missing ${key}`);
      if (/A11y$/.test(key)) assert.ok(String(v).includes('{name}'), `${locale} ${key} keeps {name}`);
    }
  }
});

// ---------------------------------------------------------------------------------- T77 discovery

const TODAY = '2026-10-18';

test('discovery: All is exactly the plain tiles, on every sub-tab', () => {
  for (const tab of WALLPAPER_SUB_TABS) {
    assert.deepEqual(
      discoverWallpaperTiles(tab, 'all', { themes: ALL_THEMES, loops, today: TODAY, liked: [] }),
      wallpaperTiles(tab, { themes: ALL_THEMES, loops }),
    );
  }
});

test('discovery: Live ignores it (the person’s own loops, never filtered or ranked)', () => {
  assert.ok(!discoveryApplies('live'));
  assert.ok(discoveryApplies('still') && discoveryApplies('pairs'));
  for (const d of DISCOVERY_TABS) {
    assert.deepEqual(
      discoverWallpaperTiles('live', d, { themes: ALL_THEMES, loops, today: TODAY, liked: [] }),
      wallpaperTiles('live', { themes: ALL_THEMES, loops }),
    );
  }
});

test('discovery: New / Our picks / Liked keep their order, drop the photo entry, Still and Pairs agree', () => {
  const liked = [ALL_THEMES[3].id, 'gone', ALL_THEMES[1].id];
  const ctx = { today: TODAY, liked };
  for (const d of ['new', 'picks', 'liked'] as const) {
    const want = discoveryThemes(ALL_THEMES, d, ctx).map((t) => t.id);
    for (const tab of ['still', 'pairs'] as const) {
      const tiles = discoverWallpaperTiles(tab, d, { themes: ALL_THEMES, loops, ...ctx });
      assert.ok(tiles.every((t) => t.kind === (tab === 'still' ? 'theme' : 'pair')), `${tab}/${d}: theme tiles only`);
      assert.deepEqual(tiles.map((t) => t.themeId), want, `${tab}/${d}: order`);
      assert.ok(tiles.every((t) => !t.live));
    }
  }
  assert.deepEqual(
    discoverWallpaperTiles('still', 'picks', { themes: ALL_THEMES, loops, today: TODAY, liked: [] }).map((t) => t.themeId),
    [...OUR_PICKS],
  );
  assert.deepEqual(
    discoverWallpaperTiles('still', 'liked', { themes: ALL_THEMES, loops, today: TODAY, liked }).map((t) => t.themeId),
    [ALL_THEMES[1].id, ALL_THEMES[3].id],
  );
  assert.deepEqual(discoverWallpaperTiles('pairs', 'liked', { themes: ALL_THEMES, loops, today: TODAY, liked: [] }), []);
});

test('hearts: theme and pair tiles like their theme; entry and loop tiles have none', () => {
  const still = wallpaperTiles('still', { themes: ALL_THEMES, loops });
  const pairs = wallpaperTiles('pairs', { themes: ALL_THEMES, loops });
  const live = wallpaperTiles('live', { themes: ALL_THEMES, loops });
  assert.equal(tileFavouriteId(still[0]), undefined, 'photo entry');
  assert.equal(tileFavouriteId(still[1]), ALL_THEMES[0].id);
  assert.equal(tileFavouriteId(pairs[0]), ALL_THEMES[0].id, 'a pair likes the same wallpaper as its still');
  assert.ok(live.length > 0 && live.every((t) => tileFavouriteId(t) === undefined));
  assert.notEqual(WALLPAPER_FAVOURITES_KEY, FAVOURITES_KEY, 'liked wallpapers are their own list');
  assert.match(WALLPAPER_FAVOURITES_KEY, /^glaze\./);
});
