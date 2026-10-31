// T186 (owner-1101 #4): "My wallpapers" rules, copy in every locale, and source guards that the
// collage, wallpaper-maker and Live Photo still saves add entries, and the tab lists them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import {
  MY_WALLPAPERS_MAX,
  addMyWallpaper,
  myWallpaperFile,
  myWallpaperId,
  myWallpapersDir,
  myWallpapersI18nKeys,
  parseMyWallpapers,
  removeMyWallpaper,
  serializeMyWallpapers,
  type MyWallpaper,
} from './myWallpapers.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const item = (id: string, createdAt: number, extra: Partial<MyWallpaper> = {}): MyWallpaper => ({
  id,
  kind: 'collage',
  uri: `file:///docs/my-wallpapers/${id}.png`,
  width: 1179,
  height: 2556,
  createdAt,
  ...extra,
});

test('folder, file names and ids are safe', () => {
  assert.equal(myWallpapersDir(null), null);
  assert.equal(myWallpapersDir('file:///docs/'), 'file:///docs/my-wallpapers/');
  assert.equal(myWallpapersDir('file:///docs'), 'file:///docs/my-wallpapers/');
  assert.equal(myWallpaperFile('file:///d/', 'a/../b'), 'file:///d/ab.png');
  assert.match(myWallpaperId(1730000000000, '0.x!y'), /^[a-z0-9]+-[a-z0-9]+$/);
});

test('parse: bad JSON or entries are dropped, duplicates once, newest first; round-trips', () => {
  assert.deepEqual(parseMyWallpapers(null), { items: [] });
  assert.deepEqual(parseMyWallpapers('{oops'), { items: [] });
  const raw = JSON.stringify({
    items: [
      item('old', 1),
      { id: 'bad-kind', kind: 'gallery', uri: 'x', width: 1, height: 1, createdAt: 3 },
      { id: 'no-size', kind: 'theme', uri: 'x', width: 0, height: 10, createdAt: 3 },
      item('new', 5, { kind: 'live', loopId: 'loop1' }),
      item('old', 9),
    ],
  });
  const s = parseMyWallpapers(raw);
  assert.deepEqual(s.items.map((x) => x.id), ['new', 'old']);
  assert.equal(s.items[0].loopId, 'loop1');
  assert.deepEqual(parseMyWallpapers(serializeMyWallpapers(s)), s);
});

test('add puts the newest first, replaces the same id and drops past the cap', () => {
  let s = { items: [] as MyWallpaper[] };
  for (let i = 0; i < MY_WALLPAPERS_MAX; i++) s = addMyWallpaper(s, item(`w${i}`, i)).state;
  assert.equal(s.items.length, MY_WALLPAPERS_MAX);
  assert.equal(s.items[0].id, `w${MY_WALLPAPERS_MAX - 1}`);
  const out = addMyWallpaper(s, item('fresh', 10_000));
  assert.equal(out.state.items.length, MY_WALLPAPERS_MAX);
  assert.equal(out.state.items[0].id, 'fresh');
  assert.deepEqual(out.dropped.map((x) => x.id), ['w0'], 'the oldest copy is handed back for deletion');
  const again = addMyWallpaper(out.state, item('fresh', 10_001, { kind: 'theme' }));
  assert.equal(again.state.items.filter((x) => x.id === 'fresh').length, 1);
  assert.equal(again.state.items[0].kind, 'theme');
});

test('remove returns the removed entry, and nothing for an unknown id', () => {
  const s = { items: [item('a', 2), item('b', 1)] };
  const out = removeMyWallpaper(s, 'a');
  assert.equal(out.removed?.id, 'a');
  assert.deepEqual(out.state.items.map((x) => x.id), ['b']);
  const none = removeMyWallpaper(s, 'zzz');
  assert.equal(none.removed, null);
  assert.equal(none.state, s);
});

test('My wallpapers and the new tab copy are in every locale', () => {
  const keys = myWallpapersI18nKeys();
  assert.ok(keys.length > 20);
  for (const key of keys) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en missing ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} missing ${key}`);
    }
  }
});

test('saves add entries: collage, wallpaper maker (single and pair), Live Photo still', () => {
  assert.match(read('app', 'collage.tsx'), /rememberWallpaper\(\{ kind: 'collage', uri: res\.uri/);
  const wp = read('app', 'wallpaper.tsx');
  assert.match(wp, /rememberWallpaper\(\{ kind: 'theme', uri: res\.uri/);
  assert.match(wp, /rememberWallpaper\(\{ kind: 'theme', uri: lock\.uri/);
  assert.match(read('src', 'ui', 'LiveSaveToPhotos.tsx'), /rememberWallpaper\(\{ kind: 'live', uri: res\.uri[^}]*loopId: p\.id/);
  // Kept on this device only: the store copies into documents and never touches the network.
  const store = read('src', 'store', 'myWallpapers.ts');
  assert.match(store, /myWallpapersDir\(FileSystem\.documentDirectory\)/);
  assert.doesNotMatch(store, /\bfetch\(|downloadAsync|https?:\/\//);
});

test('Wallpapers tab: Live Photo from a clip, collage maker, My wallpapers; old gallery gone', () => {
  const tab = read('app', '(tabs)', 'wallpapers.tsx');
  assert.match(tab, /router\.push\(LIVE_MAKER_HREF\)/);
  assert.match(tab, /router\.push\('\/collage'\)/);
  assert.match(tab, /useMyWallpapers\(\)/);
  assert.match(tab, /saveWallpaperAgain\(open\)/);
  assert.match(tab, /forgetWallpaper\(target\.id\)/);
  assert.match(tab, /<LargeTitleFlatList\b/);
  assert.match(tab, /const ThumbRow = memo\(/);
  for (const gone of ['discoverWallpaperTiles', 'WallpaperTileView', 'wallpaperGroupRows', 'useWallpaperFavourites', 'ALL_THEMES']) {
    assert.doesNotMatch(tab, new RegExp(`\\b${gone}\\b`), `${gone} left the tab`);
  }
  // Calm motion, no spinners.
  assert.doesNotMatch(tab, /ActivityIndicator|\bwithSpring\b|springify|BounceIn|Easing\.bounce/);
});
