// T162 (owner 30 Oct C, "smooth and light"): perf-budget source guards. The cloud can't mount
// React Native, so these read the source: the gallery tabs scroll a virtualised list (no vertical
// ScrollView with its cards mapped inside), images go through expo-image (cached, downscaled), and
// the tab screens keep their styles in StyleSheet instead of new inline objects every render.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** The gallery tabs and the virtualised list each must scroll. */
const LIST_TABS: Record<string, RegExp> = {
  'app/(tabs)/themes.tsx': /<Animated\.FlatList\b/,
  'app/(tabs)/widgets.tsx': /<LargeTitleFlatList\b/,
  'app/(tabs)/wallpapers.tsx': /<LargeTitleFlatList\b/,
  // T166: the Icon Studio's search results are the rows of a virtualised list (form = footer).
  'app/(tabs)/icons.tsx': /<Animated\.FlatList\b/,
};

/** Opening tags of every ScrollView in a source (plain or Animated). */
function scrollViewTags(src: string): string[] {
  return [...src.matchAll(/<(?:Animated\.)?ScrollView\b[^>]*>/g)].map((m) => m[0]);
}

test('gallery tabs scroll a virtualised list; any other ScrollView in them is a horizontal chip row', () => {
  for (const [file, list] of Object.entries(LIST_TABS)) {
    const src = strip(read(file));
    assert.match(src, list, `${file} scrolls a virtualised list`);
    assert.doesNotMatch(src, /<LargeTitleScrollView\b/, `${file}: no LargeTitleScrollView`);
    for (const tag of scrollViewTags(src)) assert.match(tag, /\bhorizontal\b/, `${file}: vertical ScrollView ${tag.slice(0, 60)}`);
  }
});

/** Source of every `<ScrollView …>…</ScrollView>` (plain or Animated) in a file. */
function scrollViewBodies(src: string): string[] {
  return [...src.matchAll(/<((?:Animated\.)?ScrollView)\b[\s\S]*?<\/\1>/g)].map((m) => m[0]);
}

test('T166: the Icons tab is a virtualised list of memoised rows, with no large array mapped in a ScrollView', () => {
  const src = strip(read('app/(tabs)/icons.tsx'));
  assert.match(src, /<(?:Animated\.)?(?:FlatList|SectionList)\b/, 'icons.tsx scrolls a FlatList / SectionList');
  const list = src.slice(src.search(/<(?:Animated\.)?(?:FlatList|SectionList)\b/));
  assert.match(list, /\{\.\.\.LIST_WINDOW\}/);
  assert.match(list, /bounces=\{false\}/);
  assert.match(list, /overScrollMode="never"/);
  assert.match(list, /keyExtractor=\{resultKey\}/);
  assert.match(list, /renderItem=\{renderResult\}/);
  assert.match(list, /ListHeaderComponent=\{listHeader\}/);
  assert.match(src, /const renderResult: ListRenderItem<ResultItem> = useCallback\(/);
  for (const row of ['PickRow', 'MissingRow', 'NoMatchRow', 'AppChip']) {
    assert.match(src, new RegExp(`const ${row} = memo\\(`), `${row} is memoised`);
  }
  // Results stay capped (the list renders them lazily, but the cap bounds the work per keystroke).
  const limit = Number(/const RESULT_LIMIT = (\d+);/.exec(src)?.[1]);
  assert.ok(limit > 0 && limit <= 60, `RESULT_LIMIT ${limit} <= 60`);
  // Any ScrollView left is a horizontal chip row, and the only thing mapped in it is the category chips.
  for (const body of scrollViewBodies(src)) {
    const tag = /^<[^>]*>/.exec(body)?.[0] ?? '';
    assert.match(tag, /\bhorizontal\b/, `vertical ScrollView in icons.tsx: ${tag.slice(0, 60)}`);
    const maps = [...body.matchAll(/([\w.\]\[ ,]+)\)?\.map\(/g)].map((m) => m[1].trim());
    for (const m of maps) assert.match(m, /categoryChips\]?$/, `only category chips are mapped in a ScrollView (found ${m})`);
    assert.doesNotMatch(body, /\b(?:results|specs|items)\b[^\n]*\.map\(/, 'no results / specs mapped inside a ScrollView');
  }
});

test('list windows are small and lists never bounce', () => {
  const header = strip(read('src/ui/LargeTitleHeader.tsx'));
  const win = /export const LIST_WINDOW = \{([\s\S]*?)\} as const;/.exec(header)?.[1] ?? '';
  const num = (k: string) => Number(new RegExp(`${k}: (\\d+)`).exec(win)?.[1]);
  assert.ok(num('initialNumToRender') <= 8, 'initialNumToRender');
  assert.ok(num('maxToRenderPerBatch') <= 8, 'maxToRenderPerBatch');
  assert.ok(num('windowSize') <= 7, 'windowSize');
  assert.match(win, /removeClippedSubviews: Platform\.OS === 'android'/);
  const flat = header.slice(header.indexOf('export function LargeTitleFlatList'));
  assert.match(flat, /bounces=\{false\}/);
  assert.match(flat, /overScrollMode="never"/);
  assert.match(flat, /\{\.\.\.LIST_WINDOW\}/);
  const themes = strip(read('app/(tabs)/themes.tsx'));
  const list = themes.slice(themes.indexOf('<Animated.FlatList'));
  assert.match(list, /\{\.\.\.LIST_WINDOW\}/);
  // T177 (owner-1031 pull to refresh): the Themes list allows the iOS overscroll only while it rests
  // at the very top (pulling to refresh needs it); everywhere else it never bounces.
  assert.match(list, /bounces=\{atTop\}/);
  assert.match(themes, /const top = e\.contentOffset\.y <= TOP_SLOP \? 1 : 0;/);
  assert.match(list, /overScrollMode="never"/);
});

test('list rows are memoised with stable keys and render callbacks', () => {
  const themes = strip(read('app/(tabs)/themes.tsx'));
  // T177: gallery rows (src/core/gallery.ts) replace T162's pack rows.
  assert.match(themes, /const GalleryCardRow = memo\(/);
  assert.match(themes, /const renderRow: ListRenderItem<Row> = useCallback\(/);
  assert.match(themes, /keyExtractor=\{rowKey\}/);
  const widgets = strip(read('app/(tabs)/widgets.tsx'));
  assert.match(widgets, /const WidgetRow = memo\(/);
  // T173: items are per-family rows (FamilyRow, src/core/widgetFamilies.ts) with a precomputed key.
  assert.match(widgets, /const renderRow: ListRenderItem<FamilyRow<WidgetTabCard>> = useCallback\(/);
  assert.match(widgets, /keyExtractor=\{rowKey\}/);
  const walls = strip(read('app/(tabs)/wallpapers.tsx'));
  // T186 (owner 1 Nov): the gallery tile grid became My wallpapers' thumbnail rows.
  assert.match(walls, /const ThumbRow = memo\(/);
  assert.match(walls, /const renderRow: ListRenderItem<MyWallpaper\[\]> = useCallback\(/);
  assert.match(walls, /keyExtractor=\{rowKey\}/);
  for (const [f, name] of [
    ['src/ui/WidgetPreview.tsx', 'WidgetPreview'],
    ['src/ui/CatalogueWidgetPreview.tsx', 'CatalogueWidgetPreview'],
    ['src/ui/HomeMock.tsx', 'HomeMock'],
    ['src/ui/LockMock.tsx', 'LockMock'],
    ['src/ui/ThemeWallpaper.tsx', 'ThemeWallpaper'],
  ]) {
    assert.match(read(f), new RegExp(`export const ${name} = memo\\(`), `${name} is memoised`);
  }
});

/**
 * Files still drawing with React Native's Image, with the reason. Everything else uses expo-image
 * (memory-disk cache, decoded at view size). Shrink this list; never grow it without a reason.
 */
const RN_IMAGE_OK: Record<string, string> = {
  'src/ui/artPackSources.ts': 'Image.resolveAssetSource only (bundled asset URI), draws nothing',
  'src/ui/seamlessSetup.ts': 'Image.resolveAssetSource only, draws nothing',
  'src/render/CollageView.tsx': 'captured by react-native-view-shot for Save; sync layout matters, not in a list',
  'src/render/PhotoWallpaperView.tsx': 'captured by react-native-view-shot for Save; not in a list',
  'src/render/HomeWallpaperView.tsx': 'captured by react-native-view-shot for Save; not in a list',
  'app/theme/[id].tsx': 'theme detail uses Image.getSize as well; one screen, not a list (T162 follow-up)',
  // T166: SeamlessWidgetPreview, app/live/[id].tsx, app/feedback.tsx and IconOverrideSheet moved to expo-image.
};

function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const rel = join(dir, n);
    if (statSync(join(root, rel)).isDirectory()) return sources(rel);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [rel.split('\\').join('/')] : [];
  });
}

test('no screen or UI file imports the React Native Image (except the allowlist, with reasons)', () => {
  const files = [...sources('app'), ...sources('src')];
  assert.ok(files.length > 50);
  const users = files.filter((f) => /import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*'react-native'/.test(read(f)));
  const unexpected = users.filter((f) => !(f in RN_IMAGE_OK));
  assert.deepEqual(unexpected, [], 'use expo-image (cachePolicy "memory-disk", fixed size, contentFit)');
  for (const f of Object.keys(RN_IMAGE_OK)) assert.ok(users.includes(f), `${f} no longer uses RN Image: drop it from the allowlist`);
});

/** Inline `style={{` budget per tab file (T162 moved them to StyleSheet; keep it that way). */
const INLINE_STYLE_BUDGET: Record<string, number> = {
  'app/(tabs)/themes.tsx': 0,
  'app/(tabs)/icons.tsx': 0,
  'app/(tabs)/widgets.tsx': 0,
  'app/(tabs)/wallpapers.tsx': 0,
};

test('tab screens stay within their inline style object budget', () => {
  for (const [f, max] of Object.entries(INLINE_STYLE_BUDGET)) {
    const n = (strip(read(f)).match(/style=\{\{/g) ?? []).length;
    assert.ok(n <= max, `${f}: ${n} inline style={{ }} objects (budget ${max})`);
  }
});
