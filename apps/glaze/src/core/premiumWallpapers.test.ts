// T176 premium UI, Wallpapers slice (docs/PREMIUM_UI.md §3.9): wallpaper groups on the Wallpapers
// tab (src/core/wallpaperGroups.ts), and source guards for the tab and the wallpaper maker
// (/wallpaper): editorial headers, 16-pt rhythm, skeletons not spinners, surfaces not hairlines in
// dark mode, Dynamic Type caps, tokens only, strings in every locale, Save to Photos untouched.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as tabsNs from '../i18n/ns/tabs/index.ts';
import * as wallpaperNs from '../i18n/ns/wallpaper/index.ts';
import { DISCOVERY_TABS } from './discovery.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { WALLPAPER_GROUPS, wallpaperGroupKeys, wallpaperGroupOf, wallpaperGroupRows, wallpaperViewGrouped } from './wallpaperGroups.ts';
import { WALLPAPER_SUB_TABS, discoverWallpaperTiles, tileRows } from './wallpaperTiles.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const TAB = ['app', '(tabs)', 'wallpapers.tsx'];
const EDITOR = ['app', 'wallpaper.tsx'];
const TILE = ['src', 'ui', 'WallpaperTile.tsx'];
const PAIR = ['src', 'ui', 'WallpaperPairCard.tsx'];
const PATH = [TAB, EDITOR, TILE, PAIR, ['src', 'ui', 'Switch.tsx'], ['src', 'ui', 'ContextTip.tsx']];

const LOOPS = [
  { id: 'a', updatedAt: 2 },
  { id: 'b', updatedAt: 1 },
];
const tilesFor = (tab: (typeof WALLPAPER_SUB_TABS)[number], discovery: (typeof DISCOVERY_TABS)[number], liked: string[] = []) =>
  discoverWallpaperTiles(tab, discovery, { themes: ALL_THEMES, loops: LOOPS, today: '2026-10-30', liked });

test('groups: your own photos and loops, free theme wallpapers, Plus theme wallpapers', () => {
  assert.deepEqual([...WALLPAPER_GROUPS], ['yours', 'free', 'plus']);
  for (const kind of ['photo', 'loop', 'makeLive'] as const) assert.equal(wallpaperGroupOf({ kind, plus: false }), 'yours');
  for (const kind of ['theme', 'pair'] as const) {
    assert.equal(wallpaperGroupOf({ kind, plus: false }), 'free');
    assert.equal(wallpaperGroupOf({ kind, plus: true }), 'plus');
  }
  assert.equal(wallpaperViewGrouped('live', 'liked'), true, 'Live ignores discovery and is grouped');
  for (const tab of ['still', 'pairs'] as const) {
    assert.equal(wallpaperViewGrouped(tab, 'all'), true);
    for (const d of DISCOVERY_TABS.filter((x) => x !== 'all')) assert.equal(wallpaperViewGrouped(tab, d), false, `${tab}/${d} keeps its own order`);
  }
});

test('grouped rows keep every tile once, in order, never mix groups in a row, one header per group', () => {
  for (const tab of WALLPAPER_SUB_TABS) {
    const tiles = tilesFor(tab, 'all');
    for (const shown of [1, 3, 8, tiles.length]) {
      const visible = tiles.slice(0, shown);
      const { rows, headers } = wallpaperGroupRows(visible, true);
      assert.deepEqual(rows.flat().map((x) => x.id), visible.map((x) => x.id), `${tab}/${shown}: same tiles, same order`);
      for (const r of rows) {
        assert.ok(r.length >= 1 && r.length <= 2);
        assert.equal(new Set(r.map(wallpaperGroupOf)).size, 1, `${tab}: a row is one group`);
      }
      const opened = [...headers.entries()].sort((a, b) => a[0] - b[0]);
      assert.deepEqual(opened.map(([, g]) => g), [...new Set(visible.map(wallpaperGroupOf))], `${tab}/${shown}: one header per group present`);
      for (const [i, g] of opened) assert.equal(wallpaperGroupOf(rows[i][0]), g, `${tab}: header ${g} opens its own first row`);
      assert.equal(new Set(rows.map((r) => r.map((x) => x.id).join('|'))).size, rows.length, `${tab}: stable unique row keys`);
    }
  }
  // Still opens with your own photo, then the free themes, then Plus; Pairs has no "yours"; Live is all yours.
  const still = wallpaperGroupRows(tilesFor('still', 'all'), true).headers;
  assert.deepEqual([...still.values()], ['yours', 'free', 'plus']);
  assert.deepEqual([...wallpaperGroupRows(tilesFor('pairs', 'all'), true).headers.values()], ['free', 'plus']);
  assert.deepEqual([...wallpaperGroupRows(tilesFor('live', 'all'), true).headers.values()], ['yours']);
  assert.deepEqual(wallpaperGroupRows([], true), { rows: [], headers: new Map() });
});

test('filtered views (New / Our picks / Liked) keep their own order and have no headers', () => {
  const liked = [ALL_THEMES[40].id, ALL_THEMES[2].id, ALL_THEMES[30].id];
  for (const tab of ['still', 'pairs'] as const) {
    for (const d of DISCOVERY_TABS.filter((x) => x !== 'all')) {
      const tiles = tilesFor(tab, d, liked);
      const out = wallpaperGroupRows(tiles, wallpaperViewGrouped(tab, d));
      assert.deepEqual(out.rows, tileRows(tiles), `${tab}/${d}`);
      assert.equal(out.headers.size, 0);
    }
  }
});

test('every locale has the group headers, the Live loading label and the preview loading label', () => {
  const tabs = Object.entries(tabsNs) as [string, { wallpapersTab?: Record<string, unknown> }][];
  const walls = Object.entries(wallpaperNs) as [string, { preview?: Record<string, unknown> }][];
  assert.equal(tabs.length, 11);
  assert.equal(walls.length, 11);
  for (const [loc, msgs] of tabs) {
    const wt = msgs.wallpapersTab ?? {};
    const groups = (wt.groups ?? {}) as Record<string, Record<string, string>>;
    for (const g of WALLPAPER_GROUPS) {
      const keys = wallpaperGroupKeys(g);
      for (const part of ['eyebrow', 'title', 'body'] as const) {
        assert.ok(keys[part].endsWith(`wallpapersTab.groups.${g}.${part}`));
        assert.ok(typeof groups[g]?.[part] === 'string' && groups[g][part].length > 0, `${loc}: groups.${g}.${part}`);
      }
    }
    assert.ok(typeof wt.loading === 'string' && (wt.loading as string).length > 0, `${loc}: wallpapersTab.loading`);
  }
  for (const [loc, msgs] of walls) {
    assert.ok(typeof msgs.preview?.loadingA11y === 'string' && (msgs.preview.loadingA11y as string).length > 0, `${loc}: wallpaper.preview.loadingA11y`);
  }
});

test('Wallpapers tab: editorial group headers, 16-pt rhythm, Live skeleton, still one virtualised list', () => {
  const tab = strip(read(...TAB));
  assert.match(tab, /<SectionHeader\b/);
  assert.match(tab, /wallpaperGroupKeys\(group\)/);
  assert.match(tab, /const GAP = editorialV2\.cardGap;/);
  assert.match(tab, /wallpaperGroupRows\(visible, grouped\)/);
  assert.match(tab, /group=\{headers\.get\(index\)\}/);
  assert.match(tab, /flushTop=\{firstSection\}/);
  assert.match(tab, /sectionAfterRow: \{ paddingTop: editorialV2\.sectionTop - editorialV2\.cardGap \}/);
  // The Live view waits for the saved loops as tile-shaped skeletons, never a false "no clips yet".
  assert.match(tab, /const liveLoading = tab === 'live' && !loopsLoaded;/);
  assert.match(tab, /const liveEmpty = tab === 'live' && loopsLoaded && loops\.length === 0;/);
  assert.match(tab, /<Skeleton width=\{tileWidth\} height=\{tileHeight\} radius=\{chromeRadiusV2\.card\} \/>/);
  assert.match(tab, /<LargeTitleFlatList\b/);
  assert.match(tab, /const TileRow = memo\(/);
});

test('Wallpaper tiles and the pair card lift by surface in dark mode, without hairlines', () => {
  const tile = strip(read(...TILE));
  assert.match(tile, /backgroundColor: scheme === 'dark' \? c\.surfaceRaised : c\.surface/);
  assert.match(tile, /scheme === 'dark' \? null : \[styles\.pairFrameLine/);
  assert.doesNotMatch(tile, /pairFrame: \{[^}]*borderWidth/);
  const pair = strip(read(...PAIR));
  assert.match(pair, /backgroundColor: scheme === 'dark' \? c\.surfaceRaised : c\.surface/);
  assert.doesNotMatch(pair, /scheme === 'dark' \? \{ borderColor/);
});

test('Wallpaper maker: raised cards without hairlines, group headers, skeleton waits in the final shape', () => {
  const ed = strip(read(...EDITOR));
  assert.match(ed, /const cardStyle = \[styles\.card, shadowV2\('card', scheme\), \{ backgroundColor: scheme === 'dark' \? c\.surfaceRaised : c\.surface \}\];/);
  assert.doesNotMatch(ed, /styles\.card, \{ backgroundColor: c\.surface, borderColor/);
  assert.doesNotMatch(ed, /card: \{[^}]*borderWidth/);
  assert.doesNotMatch(ed, /toast: \{[^}]*borderWidth/s);
  assert.ok((ed.match(/<View style=\{cardStyle\}>/g) ?? []).length >= 4, 'every editor card is a raised surface');
  assert.ok((ed.match(/<SectionHeader level="group" flushTop\b/g) ?? []).length >= 3);
  assert.ok((ed.match(/<SectionHeader\s+level="group"\s+flushTop\b/g) ?? []).length >= 4, 'photo touches card too');
  assert.doesNotMatch(ed, /accessibilityRole="header"/, 'headings come from SectionHeader');
  // Waits: the preview while the saved background loads; a phone-shaped image while a save renders.
  assert.match(ed, /\{!bgLoaded \? \([\s\S]*?<Skeleton width=\{PREVIEW_W\} height=\{previewH\} radius=\{chromeRadiusV2\.card\} \/>/);
  assert.match(ed, /<Skeleton width=\{SAVE_THUMB_W\} height=\{Math\.round\(\(SAVE_THUMB_W \* size\.height\) \/ size\.width\)\}/);
  assert.match(strip(read(...PAIR)), /busy=\{saving\}/, 'the pair pill keeps its in-button busy state');
});

test('Save to Photos is unchanged: the same saver hooks and the legacy media-library import', () => {
  const ed = strip(read(...EDITOR));
  assert.match(ed, /const saver = useWallpaperSaver\(\);/);
  assert.match(ed, /await photoSaver\.save\(photoData, size\) : await saver\.save\(params, size\)/);
  assert.match(ed, /const res = await homeSaver\.save\(homeData, size\);/);
  assert.match(read('src', 'render', 'saveWallpaper.ts'), /expo-media-library\/legacy/);
});

test('no spinners and no springs on the Wallpapers path', () => {
  for (const f of PATH) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /ActivityIndicator/, f.join('/'));
    assert.doesNotMatch(src, /\bwithSpring\b|Animated\.spring|\.springify\(|\bBounceIn\b|Easing\.bounce|Easing\.elastic/, f.join('/'));
  }
});

test('every Text and TextInput on the Wallpapers path carries a Dynamic Type cap', () => {
  for (const f of PATH) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[\s\S]*?(?=\/?>)/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});

test('tokens only: the tab and the maker have no raw radii, colours or font sizes', () => {
  for (const f of [TAB, EDITOR]) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius\s*[:=]\s*\{?\s*\d/, f.join('/'));
    assert.doesNotMatch(src, /(?<![\w&])#[0-9a-fA-F]{3,8}\b|\brgba?\(/, f.join('/'));
    assert.doesNotMatch(src, /\bfontSize\s*[:=]\s*[{'"]?\s*\d/, f.join('/'));
  }
  assert.ok(!/'app\/wallpaper\.tsx'/.test(read('src', 'core', 'designGuard.test.ts')), 'design guard entry removed');
});
