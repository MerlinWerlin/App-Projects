// T118 (fb-1024 B, owner 24 Oct: "a little laggy moving around the UI"): guards for the tab
// performance work on Themes, Wallpapers and Widgets. The pure helpers (core/perfCache,
// core/perfReveal) are tested directly; the UI wiring is checked from the source, since the cloud
// can't mount React Native.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REVEAL_FIRST, nextReveal } from './categorySwitch.ts';
import { boundedCache, keepIfSame, reuseEqual, sameJson, sameListBy, weakKeyedCache, weakMemo } from './perfCache.ts';
import {
  PACK_REVEAL_BATCH,
  TILE_REVEAL_BATCH,
  TILE_REVEAL_FIRST,
  WIDGET_ROWS_BATCH,
  WIDGET_ROWS_FIRST,
  firstReveal,
  isMounted,
  keptAcrossSwap,
  revealSchedule,
  revealStep,
  sectionLimit,
} from './perfReveal.ts';
import { ALL_THEMES, PLUS_PACKS } from './plusThemes.ts';
import { SPACE_THEMES } from './spacePack.ts';
import { THEMES } from './themes.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const THEMES_TAB = strip(read('app', '(tabs)', 'themes.tsx'));
const WALLPAPERS_TAB = strip(read('app', '(tabs)', 'wallpapers.tsx'));
const WIDGETS_TAB = strip(read('app', '(tabs)', 'widgets.tsx'));
const SHOWCASE = strip(read('src', 'ui', 'ShowcaseGrid.tsx'));
const THEME_CARD = strip(read('src', 'ui', 'ThemeCard.tsx'));
const HOME_MOCK = strip(read('src', 'ui', 'HomeMock.tsx'));
const TILE = strip(read('src', 'ui', 'WallpaperTile.tsx'));
const HEART = strip(read('src', 'ui', 'HeartButton.tsx'));
const SQUIRCLE = strip(read('src', 'ui', 'SquircleCard.tsx'));
const PALETTE = strip(read('src', 'ui', 'useWallpaperPalette.tsx'));
const WALLPAPER_VIEW = strip(read('src', 'render', 'WallpaperView.tsx'));

// --- Pure helpers ---

test('weakKeyedCache: one computation per object and sub-key, bounded per object', () => {
  const cache = weakKeyedCache<object, number>(2);
  const a = {};
  let calls = 0;
  const make = () => ++calls;
  assert.equal(cache.get(a, '10x20', make), 1);
  assert.equal(cache.get(a, '10x20', make), 1, 'a hit does not recompute');
  assert.equal(cache.get(a, '30x40', make), 2);
  assert.equal(cache.get(a, '50x60', make), 3);
  assert.equal(cache.sizeFor(a), 2, 'the oldest sub-key is dropped');
  assert.equal(cache.get(a, '10x20', make), 4, 'the dropped entry is computed again');
  assert.equal(cache.get({}, '10x20', make), 5, 'a different object has its own entries');
});

test('weakMemo and boundedCache memoise by identity / key', () => {
  let calls = 0;
  const f = weakMemo((xs: number[]) => {
    calls++;
    return xs.map((x) => x * 2);
  });
  const xs = [1, 2];
  assert.equal(f(xs), f(xs));
  assert.equal(calls, 1);
  assert.notEqual(f([1, 2]), f(xs));
  const b = boundedCache<string>(2);
  assert.equal(b.get('a', () => 'A'), 'A');
  assert.equal(b.get('a', () => 'X'), 'A');
  b.get('b', () => 'B');
  b.get('c', () => 'C');
  assert.equal(b.size(), 2);
  assert.equal(b.get('a', () => 'A2'), 'A2', 'oldest evicted');
});

test('keepIfSame / reuseEqual keep identities when nothing changed (no re-render on focus)', () => {
  const prev = [{ id: 'a', n: 1 }];
  assert.equal(keepIfSame(prev, [{ id: 'a', n: 1 }], sameJson), prev);
  const next = [{ id: 'a', n: 2 }];
  assert.equal(keepIfSame(prev, next, sameJson), next);
  assert.ok(sameListBy([{ id: 'a' }], [{ id: 'a' }], (x) => x.id));
  assert.ok(!sameListBy([{ id: 'a' }], [{ id: 'b' }], (x) => x.id));
  const p1 = { id: 'x', v: 1 };
  const p2 = { id: 'y', v: 1 };
  const out = reuseEqual([p1, p2], [{ id: 'y', v: 1 }, { id: 'x', v: 9 }, { id: 'z', v: 0 }], (x) => x.id, (a, b) => a.v === b.v);
  assert.equal(out[0], p2, 'unchanged item keeps its object');
  assert.notEqual(out[1], p1, 'a changed item is the new object');
  assert.equal(out.length, 3);
});

test('progressive mount: schedules, sections and kept ids across a swap', () => {
  assert.deepEqual(revealSchedule(24, REVEAL_FIRST, 4), [4, 8, 12, 16, 20, 24]);
  assert.deepEqual(revealSchedule(0, 4, 4), [0]);
  assert.equal(firstReveal(3, TILE_REVEAL_FIRST), 3);
  assert.equal(revealStep(7, 8, TILE_REVEAL_BATCH), 8);
  assert.equal(revealStep(0, 5, 0), 1, 'always progresses');
  assert.ok(WIDGET_ROWS_FIRST >= 1 && WIDGET_ROWS_BATCH >= 1);
  // Sections of a flattened reveal: [space 8][pack 8][pack 8] with 10 revealed.
  assert.equal(sectionLimit(0, 8, 10), 8);
  assert.equal(sectionLimit(8, 8, 10), 2);
  assert.equal(sectionLimit(16, 8, 10), 0);
  // A search keystroke keeps the cards that stay in the list mounted.
  const before = ['a', 'b', 'c', 'd', 'e', 'f'];
  const kept = keptAcrossSwap(before, 4, new Set(), ['f', 'c', 'x', 'a']);
  assert.deepEqual([...kept].sort(), ['a', 'c'], 'only ids mounted before (a..d) and still listed');
  assert.ok(isMounted(9, 0, kept, 'a'));
  assert.ok(!isMounted(9, 0, kept, 'x'));
  // Kept ids carry over a second swap.
  const kept2 = keptAcrossSwap(['f', 'c', 'x', 'a'], 1, kept, ['a', 'c', 'f']);
  assert.deepEqual([...kept2].sort(), ['a', 'c', 'f']);
});

test('opening the Themes tab: cards mounted in the first frame, before vs after (model)', () => {
  const showcase = THEMES.length;
  const packs = SPACE_THEMES.length + PLUS_PACKS.reduce((n, p) => n + p.themes.length, 0);
  // Before T118: the whole showcase and every pack card mounted in the tab's first commit.
  const before = showcase + packs;
  // After: REVEAL_FIRST showcase cards, no pack card (packs start after the first paint).
  const after = Math.min(showcase, REVEAL_FIRST);
  assert.ok(before >= 60, `before: ${before} cards`);
  assert.equal(after, 4);
  // Packs then mount PACK_REVEAL_BATCH per frame; showcase 4 per frame.
  assert.ok(PACK_REVEAL_BATCH >= 1 && PACK_REVEAL_BATCH <= 4);
  assert.equal(revealSchedule(showcase, REVEAL_FIRST, 4).at(-1), showcase);
  assert.equal(nextReveal(4, showcase), 8);
  assert.ok(ALL_THEMES.length >= showcase);
});

// --- UI wiring (source guards) ---

test('heavy cards and previews are memoised', () => {
  assert.match(THEME_CARD, /export const ThemeCard = memo\(/);
  assert.match(SHOWCASE, /export const ShowcaseGrid = memo\(/);
  assert.match(SHOWCASE, /const ShowcaseCard = memo\(/);
  assert.match(TILE, /export const WallpaperTileView = memo\(/);
  assert.match(TILE, /const PairArt = memo\(/);
  assert.match(HEART, /export const HeartButton = memo\(/);
  assert.match(THEMES_TAB, /const ThemeGrid = memo\(/);
  assert.match(THEMES_TAB, /const PackSections = memo\(/);
  assert.match(THEMES_TAB, /const PackSection = memo\(/);
  assert.match(WALLPAPERS_TAB, /const TileGrid = memo\(/);
  assert.match(WIDGETS_TAB, /const WidgetCell = memo\(/);
  assert.match(WIDGETS_TAB, /const WidgetGrid = memo\(/);
});

test('gallery previews are still Home Screens with cached specs and cached wallpaper geometry', () => {
  assert.match(HOME_MOCK, /still\?: boolean/);
  assert.match(HOME_MOCK, /const Cell = still \? StillCell : PopCell;/);
  assert.match(HOME_MOCK, /const StillCell = memo\(/);
  assert.match(HOME_MOCK, /morph=\{!still\}/);
  assert.match(HOME_MOCK, /monogramSpecs\(rawSpecs\)/);
  assert.match(SHOWCASE, /\n\s*still\n/);
  assert.match(THEME_CARD, /still=\{popKey === 0\}/);
  for (const src of [SHOWCASE, THEME_CARD]) {
    assert.match(src, /cachedPreviewSpecs\(theme, \d+\)/);
    assert.doesNotMatch(src, /previewSpecs\(theme/);
  }
  assert.match(WALLPAPER_VIEW, /LAYOUTS\.get\(params, `\$\{width\}x\$\{height\}`/);
  assert.match(WALLPAPER_VIEW, /ARTS\.get\(params, `\$\{width\}x\$\{height\}`/);
  assert.match(TILE, /const homeFor = weakMemo\(/);
});

test('Themes tab: progressive showcase, deferred pack sections, no layout setState cascade', () => {
  // Showcase: progressive from the first mount; cards mounted before a swap stay mounted.
  assert.match(SHOWCASE, /useState\(\(\) => Math\.min\(themes\.length, REVEAL_FIRST\)\)/);
  assert.match(SHOWCASE, /keptAcrossSwap\(/);
  assert.match(SHOWCASE, /isMounted\(i, revealed, kept, theme\.id\)/);
  // Pack sections: start after the first paint and mount PACK_REVEAL_BATCH cards per frame.
  assert.match(THEMES_TAB, /setStarted\(true\)/);
  assert.match(THEMES_TAB, /revealStep\(n, total, PACK_REVEAL_BATCH\)/);
  assert.match(THEMES_TAB, /limit=\{sectionLimit\(/);
  assert.match(THEMES_TAB, /<PackSections visible=\{showPacks\}/);
  // Positions are shared values: a layout change never re-renders the screen or the cards.
  assert.doesNotMatch(THEMES_TAB, /setInnerY|setPacksY|setSpaceY|setPackY|onCentre/);
  assert.match(THEMES_TAB, /const innerY = useSharedValue\(0\)/);
  assert.match(THEMES_TAB, /useDerivedValue\(\(\) => parentY\.value \+ gridY\.value\)/);
  assert.match(THEMES_TAB, /baseY=\{baseY\}/);
  assert.match(THEME_CARD, /centre\.value \+ \(baseY \? baseY\.value : 0\)/);
  // Stable props for the memoised children.
  assert.match(THEMES_TAB, /const gridShared: GridShared = useMemo\(/);
  assert.match(THEMES_TAB, /const showcaseEmpty: ReactNode = useMemo\(/);
  assert.match(THEMES_TAB, /const tabOptions: PillTabOption<DiscoveryTab>\[\] = useMemo\(/);
  // No screen maps the whole theme list straight into cards.
  for (const src of [THEMES_TAB, WALLPAPERS_TAB, WIDGETS_TAB]) {
    assert.doesNotMatch(src, /(ALL_THEMES|SPACE_THEMES|PLUS_PACKS)\.map\(\([^)]*\) => \(?\s*<(ThemeCard|WallpaperTileView|ShowcaseCard)/);
  }
  assert.doesNotMatch(THEMES_TAB, /packs\.map\(\(pack\) => \(\s*<View/);
});

test('Wallpapers tab: no re-render on focus, stable tiles, progressive grid', () => {
  assert.match(WALLPAPERS_TAB, /setLoops\(\(prev\) => keepIfSame\(prev, s\.projects, sameJson\)\)/);
  assert.match(WALLPAPERS_TAB, /reuseEqual\(lastTiles\.current/);
  assert.match(WALLPAPERS_TAB, /revealStep\(n, tiles\.length, TILE_REVEAL_BATCH\)/);
  assert.match(WALLPAPERS_TAB, /keptAcrossSwap\(/);
  assert.match(WALLPAPERS_TAB, /<TileGrid\b/);
  assert.match(WALLPAPERS_TAB, /onPress=\{showMore\}/);
  assert.match(TILE, /onPress=\{open\}/);
});

test('Widgets tab: specs solved once per change, memoised cells, deferred previews, clock only in focus', () => {
  assert.match(WIDGETS_TAB, /const models: ReadonlyMap<string, CardModel> = useMemo\(/);
  assert.doesNotMatch(WIDGETS_TAB, /catSpecFor|const renderCard =/);
  assert.match(WIDGETS_TAB, /SET_LOOKS\.get\(spec, look/);
  assert.match(WIDGETS_TAB, /CAT_LOOKS\.get\(spec, look/);
  assert.match(WIDGETS_TAB, /const setForTheme = weakMemo\(/);
  assert.match(WIDGETS_TAB, /const themeSwatch = weakMemo\(/);
  assert.match(WIDGETS_TAB, /useDeferredValue\(theme\)/);
  assert.match(WIDGETS_TAB, /useDeferredValue\(look\)/);
  assert.match(WIDGETS_TAB, /habits=\{m\.habit \? habits : undefined\}/);
  assert.match(WIDGETS_TAB, /revealStep\(n, rowIds\.length, WIDGET_ROWS_BATCH\)/);
  // The minute clock runs only while the tab is focused and never sets an unchanged minute.
  assert.match(WIDGETS_TAB, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*const tick/);
  assert.doesNotMatch(WIDGETS_TAB, /useEffect\(\(\) => \{\s*const id = setInterval/);
  // Stable handlers for the memoised cells.
  for (const h of ['logHabit', 'undoHabit', 'onOpen', 'onGoals']) assert.match(WIDGETS_TAB, new RegExp(`const ${h} = useCallback\\(`));
  // A focus reload of the same background keeps the state object.
  assert.match(PALETTE, /setBg\(\(prev\) => keepIfSame\(prev, b, sameJson\)\)/);
});

test('animations stay on the UI thread and calm (no JS driver, no springs in the touched code)', () => {
  const touched = [THEMES_TAB, WALLPAPERS_TAB, WIDGETS_TAB, SHOWCASE, THEME_CARD, HOME_MOCK, TILE, HEART, SQUIRCLE, PALETTE];
  for (const src of touched) assert.doesNotMatch(src, /useNativeDriver:\s*false/);
  for (const src of [THEMES_TAB, WALLPAPERS_TAB, WIDGETS_TAB, SHOWCASE, THEME_CARD, TILE, HEART, SQUIRCLE]) {
    assert.doesNotMatch(src, /\bwithSpring\b|\.springify\(|\bZoomIn\b|\bBounceIn\b|\bLinearTransition\b/);
  }
  // A card that mounts at rest starts no animation.
  assert.match(SQUIRCLE, /if \(first && target === 1\) return;/);
});
