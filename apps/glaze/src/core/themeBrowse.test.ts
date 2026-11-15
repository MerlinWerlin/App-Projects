// T253 / T254 (owner-1101h #4-5): the Themes front page's categories, All themes and fast listing
// with 80-100+ remote packs. Pure logic in src/core/themeBrowse.ts, catalogue caching in
// src/core/remoteCatalog.ts + src/core/packDownloader.ts; screen guards at the end.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateMeta } from './artPack.ts';
import { ART_PACK_THEMES } from './artPackThemes.ts';
import { galleryStarters } from './gallery.ts';
import { cleanEtag, fetchCatalogConditional, PackError, type ConditionalResponse, type RangeResponse, type Transport } from './packDownloader.ts';
import { CATALOG_MAX_BYTES, parseCatalog } from './packCatalog.ts';
import {
  catalogRequestEtag,
  decideCatalog,
  parseCatalogCache,
  parseCatalogText,
  remoteArtThemes,
  serializeCatalogCache,
  type CatalogCache,
  type RemoteArtTheme,
} from './remoteCatalog.ts';
import {
  BROWSE_CATEGORIES,
  BROWSE_CATEGORY_IDS,
  BROWSE_CATEGORY_LABEL_KEYS,
  MORE_CATEGORY,
  RAIL_MAX,
  browseCategoryKey,
  browseCategoryLabelKey,
  browseCategoryOf,
  browseChips,
  browseEmptyReason,
  browseGridRows,
  browseGridThemes,
  browseHomeRows,
  browseMode,
  browseThemes,
  gridColumns,
  gridGeometry,
  gridItemLayout,
  gridWindow,
  groupByCategory,
  nextBrowseView,
  parseBrowseCategory,
  railCardWidth,
  railItemLayout,
  searchBrowse,
  type BrowseCategoryId,
} from './themeBrowse.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { CATALOGUES } from '../i18n/locales/index.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const BASE = 'https://github.com/example/glaze/releases/download/glaze-packs-v1/';
const REAL = JSON.parse(read('src', 'core', 'fixtures', 'catalog-glaze-packs-v1.json')) as { packs: Record<string, unknown>[] } & Record<string, unknown>;

/** How publishers may spell each category (case, ampersand, spacing, ids). */
const SPELLINGS: readonly string[] = [
  'Space & Night', 'nature', 'OCEAN & WATER', 'cute-cosy', 'Sweets and Treats', ' Dreamy  &  Pastel ', 'moody-dark', 'Abstract&Art', 'Seasonal', 'City & Retro',
  'Cute & Cozy', 'space night', '', 'Underwater Disco', 'ocean-water',
];

/** A 100-entry catalogue (80-100 packs are coming): clones of a real entry with new ids and categories. */
function bigCatalog(n = 100): Record<string, unknown> {
  const proto = REAL.packs[0];
  const packs = Array.from({ length: n }, (_, i) => {
    const id = `pack-${String(i).padStart(3, '0')}`;
    const entry: Record<string, unknown> = {
      ...proto,
      id,
      name: `Theme ${i}`,
      manifest: `art/${id}/v1/manifest.json`,
      thumb: `art/${id}/v1/thumb.0a1b2c3d.webp`,
      mood: `Mood line ${i}`,
      // Future fields a publisher may add: ignored, never hide a pack.
      artist: 'studio',
      sortKey: i,
      colours: { extra: true },
    };
    if (i % 7 !== 6) entry.category = SPELLINGS[i % SPELLINGS.length];
    return entry;
  });
  return { ...REAL, packs, promo: { banner: 'new' }, schemaNote: 'v1 + category' };
}

const BIG_TEXT = JSON.stringify(bigCatalog());
const BIG = parseCatalogText(BIG_TEXT);
const REMOTE: RemoteArtTheme[] = remoteArtThemes(BIG, BASE, []);
const STARTERS = galleryStarters();
const ALL = browseThemes(REMOTE, STARTERS);

// ------------------------------------------------------------------ category parsing

test('category names match tolerantly: case, ampersand / "and", spacing, punctuation, ids', () => {
  for (const c of BROWSE_CATEGORIES) {
    assert.equal(parseBrowseCategory(c.name), c.id, c.name);
    assert.equal(parseBrowseCategory(c.id), c.id, c.id);
    assert.equal(parseBrowseCategory(c.name.toUpperCase()), c.id);
    assert.equal(parseBrowseCategory(`  ${c.name.replace('&', 'and')}  `), c.id);
    assert.equal(parseBrowseCategory(c.name.replace(' & ', '&')), c.id);
  }
  assert.equal(parseBrowseCategory('Cute & Cozy'), 'cute-cosy');
  assert.equal(parseBrowseCategory('space/night'), 'space-night');
  assert.equal(parseBrowseCategory('Sweet & Treat'), 'sweets-treats');
  assert.equal(browseCategoryKey('Space & Night'), browseCategoryKey('space-night'));
});

test('missing, empty, unknown or junk categories file under More; never throws', () => {
  for (const x of [undefined, null, '', '   ', 'Underwater Disco', 42, {}, [], [7], true, 'x'.repeat(5000)]) {
    assert.equal(parseBrowseCategory(x), MORE_CATEGORY, String(x).slice(0, 20));
  }
  assert.equal(parseBrowseCategory(['Nature', 'Seasonal']), 'nature', 'a list uses its first string');
  assert.equal(parseBrowseCategory('More'), 'more');
  assert.equal(browseCategoryOf({ id: 'x' }), 'more');
  assert.equal(browseCategoryOf({ id: 'x', category: 'Ocean & Water' }), 'ocean-water');
  assert.equal(browseCategoryOf({ id: 'x', browseCategory: 'seasonal', category: 'Nature' }), 'seasonal', 'parsed id wins');
  assert.equal(browseCategoryOf({ id: 'x', browseCategory: 'bogus', category: 'Nature' }), 'nature');
});

test('the fixed order is the owner\'s, with More last', () => {
  assert.deepEqual(
    BROWSE_CATEGORIES.map((c) => c.name),
    ['Space & Night', 'Nature', 'Ocean & Water', 'Cute & Cosy', 'Sweets & Treats', 'Dreamy & Pastel', 'Moody & Dark', 'Abstract & Art', 'Seasonal', 'City & Retro'],
  );
  assert.equal(BROWSE_CATEGORY_IDS[BROWSE_CATEGORY_IDS.length - 1], 'more');
  assert.equal(BROWSE_CATEGORY_IDS.length, 11);
  for (const id of BROWSE_CATEGORY_IDS) assert.match(id, /^[a-z]+(-[a-z]+)?$/);
});

test('bundled themes carry a sensible category in their data (themes/<id>/meta.json)', () => {
  const want: Record<string, BrowseCategoryId> = { 'deep-sea': 'ocean-water', 'starry-night': 'space-night', 'sunset-dunes': 'nature' };
  for (const t of ART_PACK_THEMES) {
    assert.ok(t.browseCategory !== 'more', `${t.id} has a category`);
    if (want[t.id]) assert.equal(t.browseCategory, want[t.id], t.id);
    const meta = JSON.parse(read('themes', t.id, 'meta.json')) as { category?: string };
    assert.equal(parseBrowseCategory(meta.category), t.browseCategory, `${t.id}: meta.json category`);
  }
});

test('meta.json: category is optional, kept when valid, a warning (not an error) when odd', () => {
  const base = { name: 'X', mood: 'Calm.', tags: ['calm'], credits: '', licence: 'original', generator: 'procedural', prompt: '' };
  const ok = validateMeta({ ...base, category: 'Space & Night' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.meta?.category, 'Space & Night');
  assert.ok(!ok.warnings.some((w) => w.includes('unknown key')), 'category is a known key');
  const none = validateMeta(base);
  assert.equal(none.meta?.category, undefined);
  const odd = validateMeta({ ...base, category: 'Underwater Disco' });
  assert.ok(odd.meta, 'unknown category still validates');
  assert.ok(odd.warnings.some((w) => w.includes('More')));
  const junk = validateMeta({ ...base, category: 7 });
  assert.ok(junk.meta && junk.meta.category === undefined);
  assert.ok(junk.warnings.some((w) => w.includes('category')));
});

// ------------------------------------------------------------------ grouping (100+ themes)

test('100-pack catalogue + starters: every theme once, grouped in the fixed order, More last, input order kept', () => {
  assert.equal(REMOTE.length, 100);
  assert.equal(ALL.length, 103);
  assert.equal(new Set(ALL.map((t) => t.id)).size, ALL.length);
  const sections = groupByCategory(ALL);
  const order = sections.map((s) => BROWSE_CATEGORY_IDS.indexOf(s.id));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'fixed order');
  assert.equal(sections[sections.length - 1].id, 'more', 'More last');
  assert.equal(sections.reduce((n, s) => n + s.themes.length, 0), ALL.length, 'nothing lost');
  for (const s of sections) {
    assert.ok(s.themes.length > 0, `${s.id} not empty`);
    const pos = s.themes.map((t) => ALL.indexOf(t));
    assert.deepEqual(pos, [...pos].sort((a, b) => a - b), `${s.id}: input order`);
    for (const t of s.themes) assert.equal(browseCategoryOf(t), s.id);
  }
  // Unknown ("Underwater Disco"), empty and missing categories are all More.
  const more = sections.find((s) => s.id === 'more')!;
  assert.ok(more.themes.some((t) => t.id === 'pack-013') && more.themes.some((t) => t.id === 'pack-012') && more.themes.some((t) => t.id === 'pack-006'));
  // Stable: same input, same output.
  assert.deepEqual(groupByCategory(ALL).map((s) => [s.id, s.themes.map((t) => t.id)]), sections.map((s) => [s.id, s.themes.map((t) => t.id)]));
});

test('empty categories are hidden (no section, no chip)', () => {
  const few = ALL.filter((t) => ['nature', 'more'].includes(browseCategoryOf(t)));
  const sections = groupByCategory(few);
  assert.deepEqual(sections.map((s) => s.id), ['nature', 'more']);
  assert.deepEqual(browseChips(sections, few.length).map((c) => c.id), ['all', 'nature', 'more']);
  assert.deepEqual(groupByCategory([]), []);
});

test('a bundled theme also in the catalogue is listed once, as the bundled one', () => {
  const dup = { ...REMOTE[0], id: STARTERS[0].id };
  const list = browseThemes([dup, ...REMOTE.slice(1)], STARTERS);
  assert.equal(list.filter((t) => t.id === STARTERS[0].id).length, 1);
  assert.equal(list[0], STARTERS[0], 'at its catalogue place, bundled wins');
});

// ------------------------------------------------------------------ rows, grid, search

test('home rows: per category a head + one rail capped at RAIL_MAX, then All themes with every theme', () => {
  const rows = browseHomeRows({ themes: ALL, columns: 3 });
  const keys = rows.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, 'stable unique keys');
  const sections = groupByCategory(ALL);
  const rails = rows.filter((r) => r.kind === 'rail');
  assert.equal(rails.length, sections.length);
  for (const r of rails) if (r.kind === 'rail') assert.ok(r.themes.length <= RAIL_MAX && r.themes.length > 0);
  const heads = rows.filter((r) => r.kind === 'head');
  for (const s of sections) {
    const h = heads.find((x) => x.kind === 'head' && x.section === s.id);
    assert.ok(h && h.kind === 'head' && h.count === s.themes.length, `${s.id} head carries the full count for See all`);
  }
  const allHead = rows.findIndex((r) => r.kind === 'head' && r.section === 'all');
  assert.ok(allHead > rows.findIndex((r) => r.kind === 'rail'), 'All themes after the categories');
  const grid = rows.slice(allHead + 1).flatMap((r) => (r.kind === 'cards' ? r.themes.map((t) => t.id) : []));
  assert.deepEqual(grid, ALL.map((t) => t.id), 'All themes lists every theme in order');
  for (const r of rows) if (r.kind === 'cards') assert.ok(r.themes.length <= 3);
  assert.ok(!rows.some((r) => r.kind === 'skeleton'));
  assert.ok(browseHomeRows({ themes: STARTERS, columns: 3, waiting: true }).some((r) => r.kind === 'skeleton'), 'skeleton while loading');
  assert.deepEqual(browseHomeRows({ themes: [], columns: 3 }), []);
});

test('grid rows: fixed rows of `columns` thumbnails, stable keys, every theme once', () => {
  const rows = browseGridRows(ALL, 3);
  assert.equal(rows.length, Math.ceil(ALL.length / 3));
  assert.deepEqual(rows.flatMap((r) => (r.kind === 'cards' ? r.themes.map((t) => t.id) : [])), ALL.map((t) => t.id));
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  assert.ok(rows.every((r) => r.kind === 'cards' && r.themes.length <= 3));
  assert.deepEqual(browseGridRows([], 3), []);
});

test('chips: All themes first, then each non-empty category; the selected chip again goes home', () => {
  const chips = browseChips(groupByCategory(ALL), ALL.length);
  assert.equal(chips[0].id, 'all');
  assert.equal(chips[0].count, ALL.length);
  assert.equal(chips[chips.length - 1].id, 'more');
  assert.equal(nextBrowseView('home', 'nature'), 'nature');
  assert.equal(nextBrowseView('nature', 'nature'), 'home');
  assert.equal(nextBrowseView('nature', 'all'), 'all');
  assert.equal(browseMode('home', '', 'all'), 'home');
  assert.equal(browseMode('home', 'moon', 'all'), 'grid');
  assert.equal(browseMode('home', '', 'liked'), 'grid');
  assert.equal(browseMode('nature', '', 'all'), 'grid');
});

test('grid: a category, Liked and search narrow in order; search covers every theme incl. the category name', () => {
  const nature = browseGridThemes({ themes: ALL, view: 'nature' });
  assert.ok(nature.length > 0 && nature.every((t) => browseCategoryOf(t) === 'nature'));
  assert.equal(browseGridThemes({ themes: ALL, view: 'all' }).length, ALL.length);
  const liked = browseGridThemes({ themes: ALL, view: 'all', filter: 'liked', liked: ['pack-050', 'deep-sea'] });
  assert.deepEqual(liked.map((t) => t.id), ['pack-050', 'deep-sea']);
  assert.deepEqual(browseGridThemes({ themes: ALL, view: 'all', query: 'Theme 42' }).map((t) => t.id), ['pack-042']);
  // "ocean" finds every Ocean & Water theme through its category name (plus any tag / name match).
  const ocean = searchBrowse(ALL, 'ocean');
  for (const t of ALL) if (browseCategoryOf(t) === 'ocean-water') assert.ok(ocean.includes(t), t.id);
  assert.equal(searchBrowse(ALL, '').length, ALL.length);
  assert.deepEqual(searchBrowse(ALL, 'zzzz-nothing'), []);
  assert.equal(browseEmptyReason('', 'liked'), 'noLiked');
  assert.equal(browseEmptyReason('moon', 'liked'), 'noMatches');
});

test('grouping, rows and search over 100+ themes stay fast (sanity)', () => {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) {
    browseHomeRows({ themes: ALL, columns: 3 });
    browseGridThemes({ themes: ALL, view: 'all', query: 'star night' });
  }
  const per = (performance.now() - t0) / 20;
  assert.ok(per < 25, `${per.toFixed(2)} ms per build`);
});

// ------------------------------------------------------------------ geometry (virtualisation)

test('grid geometry is fixed per screen, so getItemLayout offsets are exact', () => {
  for (const w of [320, 375, 393, 430, 820]) {
    const columns = gridColumns(w);
    const g = gridGeometry({ width: w, columns, gutter: 16, gap: 16, aspect: 874 / 402, labelHeight: 48 });
    assert.ok(g.cardWidth * columns + 16 * (columns - 1) <= w - 32, `${w}: row fits`);
    assert.equal(g.cardHeight, g.artHeight + 48);
    assert.equal(g.rowHeight, g.cardHeight + 16);
    assert.deepEqual(gridItemLayout(g.rowHeight, 300, 0), { length: g.rowHeight, offset: 300, index: 0 });
    assert.deepEqual(gridItemLayout(g.rowHeight, 300, 10), { length: g.rowHeight, offset: 300 + g.rowHeight * 10, index: 10 });
  }
  assert.equal(gridColumns(393), 3, 'thumbnails: three per phone row');
  assert.equal(gridColumns(Number.NaN), 2);
  assert.equal(gridItemLayout(100, Number.NaN, 2).offset, 200);
  assert.deepEqual(railItemLayout(150, 16, 3), { length: 166, offset: 498, index: 3 });
  const rail = railCardWidth(393, 16, 16);
  assert.ok(rail > 100 && rail * 2 + 32 < 393, 'two cards and a cut third visible');
  assert.ok(railCardWidth(2000, 16, 16) <= 260);
});

test('progressive rendering: about a screen of grid rows first, small batches and window', () => {
  const g = gridGeometry({ width: 393, columns: 3, gutter: 16, gap: 16, aspect: 874 / 402, labelHeight: 48 });
  const w = gridWindow(852, g.rowHeight);
  assert.ok(w.initialNumToRender >= 2 && w.initialNumToRender <= 8);
  assert.equal(w.maxToRenderPerBatch, w.initialNumToRender);
  assert.ok(w.windowSize <= 7);
  assert.equal(gridWindow(852, 0).initialNumToRender, 4);
  // 100 themes = 34 rows; the first render mounts at most 8 rows (24 thumbnails).
  assert.ok(w.initialNumToRender * 3 <= 24);
});

test('category labels are translated in all 11 locales', () => {
  const keys = [...Object.values(BROWSE_CATEGORY_LABEL_KEYS), 'themes.browse.allThemes', 'themes.browse.seeAll', 'themes.browse.chipsLabel', 'themes.browse.backHome'];
  assert.equal(Object.keys(CATALOGUES).length, 11);
  for (const [l, cat] of Object.entries(CATALOGUES)) {
    for (const k of keys) {
      const v = lookup(cat as CatalogueTree, k);
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${l}: ${k}`);
    }
  }
  for (const id of BROWSE_CATEGORY_IDS) assert.equal(browseCategoryLabelKey(id), BROWSE_CATEGORY_LABEL_KEYS[id]);
  assert.equal(lookup(CATALOGUES.en as CatalogueTree, browseCategoryLabelKey('space-night')), 'Space & Night');
});

// ------------------------------------------------------------------ T254: catalogue parsing

test('T254: a 100-entry catalogue parses fast and tolerates new fields', () => {
  assert.ok(BIG && BIG.packs.length === 100);
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) parseCatalogText(BIG_TEXT);
  const per = (performance.now() - t0) / 10;
  assert.ok(per < 50, `${per.toFixed(2)} ms per parse`);
  assert.ok(BIG_TEXT.length < CATALOG_MAX_BYTES / 4, `${BIG_TEXT.length} bytes leaves room for growth`);
  // Unknown keys don't leak into the parsed entry; category is kept as served (trimmed).
  const p = BIG.packs[5];
  assert.equal('artist' in p, false);
  assert.equal(p.category, 'Dreamy & Pastel');
  assert.equal(BIG.packs[6].category, '', 'missing category reads as empty (More)');
  // Odd category values never hide a pack.
  const raw = bigCatalog(3) as { packs: Record<string, unknown>[] };
  raw.packs[0].category = 42;
  raw.packs[1].category = ['City & Retro', 'x'];
  raw.packs[2].category = { nested: true };
  const r = parseCatalog(raw);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.packs.map((x) => x.category), ['', 'City & Retro', '']);
    assert.equal(r.value.packs.length, 3);
  }
  // One broken entry hides only itself.
  const broken = bigCatalog(4) as { packs: Record<string, unknown>[] };
  broken.packs[2].thumbhash = '!!';
  const rb = parseCatalog(broken);
  assert.ok(rb.ok && rb.value.packs.length === 3);
});

test('T254: remote themes carry the parsed category and list from the thumbnail URL only', () => {
  const byId = new Map(REMOTE.map((t) => [t.id, t]));
  assert.equal(byId.get('pack-000')?.browseCategory, 'space-night');
  assert.equal(byId.get('pack-003')?.browseCategory, 'cute-cosy');
  assert.equal(byId.get('pack-013')?.browseCategory, 'more', 'unknown → More');
  for (const t of REMOTE) {
    assert.ok(t.remoteArt.thumbUrl?.startsWith(BASE), t.id);
    assert.match(t.remoteArt.thumbUrl ?? '', /thumb\.[0-9a-f]{8}\.webp$/);
    assert.doesNotMatch(t.remoteArt.thumbUrl ?? '', /manifest|wallpaper/);
  }
});

// ------------------------------------------------------------------ T254: cached catalogue + ETag

type Call = { url: string; etag: string | null; kind: 'conditional' | 'range' };

function fakeTransport(serve: (url: string, etag: string | null) => ConditionalResponse, conditional = true): { t: Transport; calls: Call[] } {
  const calls: Call[] = [];
  const t: Transport = {
    async fetchRange(url: string): Promise<RangeResponse> {
      calls.push({ url, etag: null, kind: 'range' });
      const r = serve(url, null);
      const bytes = new TextEncoder().encode(r.status === 200 ? r.text : '');
      return {
        offset: 0,
        chunks: (async function* () {
          yield bytes;
        })(),
      };
    },
    async writeAppend() {
      throw new Error('listing never writes pack files');
    },
    async readFile() {
      return null;
    },
    async remove() {},
  };
  if (conditional) {
    t.fetchConditional = async (url, etag) => {
      calls.push({ url, etag, kind: 'conditional' });
      return serve(url, etag);
    };
  }
  return { t, calls };
}

test('T254: catalog.json is fetched with If-None-Match; a 304 keeps the cached copy and restarts the TTL', async () => {
  const ETAG = '"abc123"';
  const { t, calls } = fakeTransport((_url, etag) => (etag === ETAG ? { status: 304 } : { status: 200, text: BIG_TEXT, etag: ETAG }));
  const first = await fetchCatalogConditional(t, BASE, null);
  assert.equal(first.notModified, false);
  const d1 = decideCatalog(null, first.notModified ? { ok: true, notModified: true } : { ok: true, text: first.text, etag: first.etag }, 1000, 'stamp');
  assert.ok(d1.save && d1.cache && d1.catalog?.packs.length === 100);
  assert.equal(d1.cache.etag, ETAG);
  const cache = parseCatalogCache(serializeCatalogCache(d1.cache)) as CatalogCache;
  assert.equal(cache.etag, ETAG, 'the ETag survives the cache file');

  const etag = catalogRequestEtag(cache, 'stamp');
  assert.equal(etag, ETAG);
  const second = await fetchCatalogConditional(t, BASE, etag);
  assert.deepEqual(second, { notModified: true });
  const d2 = decideCatalog(cache, { ok: true, notModified: true }, 5000, 'stamp');
  assert.equal(d2.unchanged, true);
  assert.equal(d2.save, true);
  assert.equal(d2.cache?.savedAt, 5000, 'TTL restarts');
  assert.equal(d2.cache?.text, cache.text);
  assert.equal(d2.cache?.etag, ETAG);
  assert.equal(d2.catalog?.packs.length, 100);
  // Same URL both times (no new endpoint), only catalog.json.
  assert.deepEqual(calls.map((c) => [c.kind, c.etag]), [['conditional', null], ['conditional', ETAG]]);
  assert.ok(calls.every((c) => c.url === `${BASE}catalog.json`));
});

test('T254: no ETag for a copy saved under another build (T178 refetch), none without a cache', () => {
  const cache: CatalogCache = { savedAt: 1, text: BIG_TEXT, stamp: 'old', etag: '"x"' };
  assert.equal(catalogRequestEtag(cache, 'new'), null);
  assert.equal(catalogRequestEtag(cache, 'old'), '"x"');
  assert.equal(catalogRequestEtag(null, 'old'), null);
  assert.equal(catalogRequestEtag({ savedAt: 1, text: BIG_TEXT, stamp: 'old' }, 'old'), null);
  // A 304 with nothing cached keeps nothing and reports it; never throws.
  const d = decideCatalog(null, { ok: true, notModified: true }, 1);
  assert.equal(d.catalog, null);
  assert.equal(d.save, false);
  // The same text served again is unchanged too (the list is not rebuilt).
  const same = decideCatalog(cache, { ok: true, text: BIG_TEXT, etag: '"x"' }, 9, 'old');
  assert.equal(same.unchanged, true);
});

test('T254: transports without header support fall back to the full fetch; bad responses are network errors', async () => {
  const { t, calls } = fakeTransport(() => ({ status: 200, text: BIG_TEXT, etag: '"y"' }), false);
  const r = await fetchCatalogConditional(t, BASE, '"y"');
  assert.equal(r.notModified, false);
  assert.equal(calls[0].kind, 'range');
  // A 304 to a request without an ETag is not trusted.
  const weird = fakeTransport(() => ({ status: 304 }));
  await assert.rejects(fetchCatalogConditional(weird.t, BASE, null), (e: unknown) => e instanceof PackError && e.code === 'network');
  // Too large.
  const big = fakeTransport(() => ({ status: 200, text: 'x'.repeat(CATALOG_MAX_BYTES + 1), etag: null }));
  await assert.rejects(fetchCatalogConditional(big.t, BASE, null), (e: unknown) => e instanceof PackError && e.code === 'network');
  // Disabled: no request at all.
  const off = fakeTransport(() => ({ status: 200, text: BIG_TEXT, etag: null }));
  await assert.rejects(fetchCatalogConditional(off.t, '', null), (e: unknown) => e instanceof PackError && e.code === 'disabled');
  assert.equal(off.calls.length, 0);
  // ETags are single-line printable values.
  assert.equal(cleanEtag(' W/"a1" '), 'W/"a1"');
  assert.equal(cleanEtag('a\nb'), null);
  assert.equal(cleanEtag(''), null);
  assert.equal(cleanEtag(7), null);
  assert.equal(cleanEtag('x'.repeat(201)), null);
});

// ------------------------------------------------------------------ T254: listing never downloads packs

test('T254: the listing path requests catalog.json only (no manifest, no pack file)', async () => {
  const { t, calls } = fakeTransport(() => ({ status: 200, text: BIG_TEXT, etag: '"z"' }));
  const r = await fetchCatalogConditional(t, BASE, null);
  assert.equal(r.notModified, false);
  const catalog = r.notModified ? null : parseCatalogText(r.text);
  const themes = browseThemes(remoteArtThemes(catalog, BASE, []), STARTERS);
  browseHomeRows({ themes, columns: 3 });
  for (const s of groupByCategory(themes)) browseGridThemes({ themes, view: s.id });
  browseGridThemes({ themes, view: 'all', query: 'theme' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${BASE}catalog.json`);
  assert.ok(!calls.some((c) => /manifest|\.webp|\.png/.test(c.url)));
});

test('T254: no screen or component on the listing path calls a pack download', () => {
  const DOWNLOADS = /\b(downloadPackToDevice|downloadRemoteArtToDevice|downloadRemoteArtPack|downloadPack|fetchRemoteArtManifest|fetchManifest|remoteArtOnDevice|useRemoteArtTheme|usePackAccess|updatePackNow)\b/;
  for (const f of [
    ['app', '(tabs)', 'themes.tsx'],
    ['src', 'ui', 'ThemeThumbCard.tsx'],
    ['src', 'ui', 'GalleryArtCard.tsx'],
    ['src', 'ui', 'CategoryChipRow.tsx'],
    ['src', 'ui', 'RemoteArtImage.tsx'],
    ['src', 'core', 'themeBrowse.ts'],
  ]) {
    assert.doesNotMatch(strip(read(...f)), DOWNLOADS, f.join('/'));
  }
  // The listing hook only reads the cached catalogue and refreshes it.
  const hook = strip(read('src', 'native', 'useRemoteCatalog.ts'));
  const list = hook.slice(hook.indexOf('export function useRemoteArtThemes'), hook.indexOf('const getStatus'));
  assert.ok(list.length > 0);
  assert.doesNotMatch(list, DOWNLOADS);
  assert.match(list, /refreshCatalog\(false\)/);
  // Cards draw the catalogue thumbnail (lazy: only mounted cells load) with the ThumbHash placeholder.
  const img = read('src', 'ui', 'RemoteArtImage.tsx');
  assert.match(img, /theme\.remoteArt\.thumbUrl/);
  assert.match(img, /cachePolicy="memory-disk"/);
});

test('T253: the front page renders categories, See all, chips and a virtualised All themes grid', () => {
  const screen = strip(read('app', '(tabs)', 'themes.tsx'));
  assert.match(screen, /<CategoryChipRow\b/);
  assert.match(screen, /const CategoryRail = memo\(/);
  const rail = screen.slice(screen.indexOf('const CategoryRail = memo('), screen.indexOf('const GalleryCardRow = memo('));
  assert.match(rail, /<FlatList\b[\s\S]*?horizontal[\s\S]*?getItemLayout=\{getItemLayout\}|getItemLayout=\{getItemLayout\}[\s\S]*?horizontal/);
  assert.match(rail, /\{\.\.\.RAIL_WINDOW\}/);
  // One list for both views (the search field in its header keeps focus); the grid view is
  // fixed-height rows of thumbnails with exact getItemLayout and the progressive window.
  assert.equal((screen.match(/<Animated\.FlatList\b/g) ?? []).length, 1);
  const list = screen.slice(screen.indexOf('<Animated.FlatList'));
  assert.match(list, /data=\{rows\}/);
  assert.match(list, /\{\.\.\.\(mode === 'grid' \? gridWin : NO_PROPS\)\}/);
  assert.match(list, /getItemLayout=\{mode === 'grid' \? getGridLayout : undefined\}/);
  assert.match(list, /ListEmptyComponent=\{mode === 'grid' \? gridEmpty : null\}/);
  assert.match(screen, /browseGridRows<GalleryTheme>\(gridThemes, columns\)/);
  assert.match(screen, /listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/, 'a chip / See all opens its grid at the top');
  // Fixed-height thumbnail card: art + one fixed name row.
  const thumb = strip(read('src', 'ui', 'ThemeThumbCard.tsx'));
  assert.match(thumb, /export const THUMB_LABEL_HEIGHT = sizeV2\.touch;/);
  assert.match(thumb, /label: \{ height: THUMB_LABEL_HEIGHT/);
  assert.match(thumb, /numberOfLines=\{1\}/);
  assert.match(thumb, /<HeartButton\b/);
  assert.match(thumb, /accessibilityRole="button"/);
  // Chips: ≥ 48 pt, labelled with the count, hint, selected state.
  const chips = strip(read('src', 'ui', 'CategoryChipRow.tsx'));
  assert.match(chips, /minHeight: sizeV2\.touch/);
  assert.match(chips, /accessibilityLabel=\{t\('themes\.browse\.chipA11y', \{ label, count: chip\.count \}\)\}/);
  assert.match(chips, /accessibilityHint=\{t\('themes\.browse\.chipHint'\)\}/);
  assert.match(chips, /accessibilityState=\{\{ selected \}\}/);
  for (const src of [thumb, chips]) {
    const tags = [...src.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length > 0);
    assert.deepEqual(tags.filter((x) => !/maxFontSizeMultiplier=/.test(x)), [], 'Dynamic Type caps');
  }
});
