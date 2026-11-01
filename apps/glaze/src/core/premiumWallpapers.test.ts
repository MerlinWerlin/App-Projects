// T176 premium UI, Wallpapers slice (docs/PREMIUM_UI.md §3.9): source guards for the Wallpapers
// tab and the wallpaper maker (/wallpaper): editorial headers, 16-pt rhythm, skeletons not
// spinners, surfaces not hairlines in dark mode, Dynamic Type caps, tokens only, strings in every
// locale, Save to Photos untouched. T193: the old wallpaper gallery (tiles, groups, sub-tabs) is
// gone; its guards became the "old gallery stays gone" checks below.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as tabsNs from '../i18n/ns/tabs/index.ts';
import * as wallpaperNs from '../i18n/ns/wallpaper/index.ts';
import { myWallpapersI18nKeys } from './myWallpapers.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const TAB = ['app', '(tabs)', 'wallpapers.tsx'];
const EDITOR = ['app', 'wallpaper.tsx'];
const PAIR = ['src', 'ui', 'WallpaperPairCard.tsx'];
const PATH = [TAB, EDITOR, PAIR, ['src', 'ui', 'Switch.tsx'], ['src', 'ui', 'ContextTip.tsx']];

/** Keys of the T77/T176 gallery that T186 replaced; T193 removed them. */
const OLD_GALLERY_KEYS = [
  'subTabs', 'sub', 'liveBadge', 'photoTile', 'photoTileHint', 'themeTileA11y', 'themeTileHint', 'plusTileHint',
  'loopTileA11y', 'loopTileHint', 'makeLiveTile', 'makeLiveHint', 'pairTileA11y', 'pairLock', 'pairHome',
  'liveEmpty', 'showMore', 'groups', 'loading', 'discover', 'like',
];

test('old wallpaper gallery stays gone: no tile, tile model or group code, no gallery copy', () => {
  for (const f of [['src', 'ui', 'WallpaperTile.tsx'], ['src', 'core', 'wallpaperTiles.ts'], ['src', 'core', 'wallpaperGroups.ts']]) {
    assert.ok(!existsSync(join(root, ...f)), `${f.join('/')} was removed in T193`);
  }
  const tabs = Object.entries(tabsNs) as [string, { wallpapersTab?: Record<string, unknown> }][];
  assert.equal(tabs.length, 11);
  for (const [loc, msgs] of tabs) {
    const wt = msgs.wallpapersTab ?? {};
    for (const k of OLD_GALLERY_KEYS) assert.ok(!(k in wt), `${loc}: tabs.wallpapersTab.${k} is dead gallery copy`);
  }
});

test('every locale has the Wallpapers tab section strings and the preview loading label', () => {
  const tabs = Object.entries(tabsNs) as [string, Record<string, unknown>][];
  const walls = Object.entries(wallpaperNs) as [string, { preview?: Record<string, unknown> }][];
  assert.equal(walls.length, 11);
  const keys = myWallpapersI18nKeys().filter((k) => k.startsWith('tabs.wallpapersTab.'));
  assert.ok(keys.includes('tabs.wallpapersTab.liveEntry.title') && keys.includes('tabs.wallpapersTab.mine.title'));
  for (const [loc, msgs] of tabs) {
    for (const key of keys) {
      let v: unknown = msgs;
      for (const part of key.split('.').slice(1)) v = (v as Record<string, unknown> | undefined)?.[part];
      assert.ok(typeof v === 'string' && v.length > 0, `${loc}: ${key}`);
    }
  }
  for (const [loc, msgs] of walls) {
    assert.ok(typeof msgs.preview?.loadingA11y === 'string' && (msgs.preview.loadingA11y as string).length > 0, `${loc}: wallpaper.preview.loadingA11y`);
  }
});

// T186 (owner-1101 #4 supersedes the T176 gallery layout here): editorial sections for Live Photo
// from a clip, the collage maker and My wallpapers; 16-pt rhythm; My wallpapers waits as
// thumbnail-shaped skeletons (never a false "nothing yet"); still one virtualised list.
test('Wallpapers tab: editorial sections, 16-pt rhythm, skeleton wait, still one virtualised list', () => {
  const tab = strip(read(...TAB));
  assert.ok((tab.match(/<SectionHeader\b/g) ?? []).length >= 3);
  assert.match(tab, /const GAP = editorialV2\.cardGap;/);
  assert.match(tab, /const mineWait = loaded \? null :/);
  assert.match(tab, /loaded && items\.length === 0 \?/);
  assert.match(tab, /<Skeleton key=\{i\} width=\{thumbW\} height=\{thumbH\} radius=\{chromeRadiusV2\.card\} \/>/);
  assert.match(tab, /<LargeTitleFlatList\b/);
  assert.match(tab, /const ThumbRow = memo\(/);
});

test('the pair card lifts by surface in dark mode, without hairlines', () => {
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
