// T168: Seamless widget card picture resolution (bundled vs downloaded file vs fallback), plus
// source guards that the card and preview use it and stay JS-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEAMLESS_FALLBACK,
  isBundledModule,
  isLocalFileUri,
  resolveSeamlessArt,
  seamlessCardSources,
  seamlessImageSource,
  seamlessSourceKey,
} from './seamlessSource.ts';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');
const FILE = 'file:///var/mobile/Containers/Data/Application/X/Documents/packs/art/deep-sea/wallpaper-2796.1a2b.webp';
const HERO = 'file:///var/mobile/Containers/Data/Application/X/Documents/packs/art/deep-sea/widget-small.9f.webp';

test('isBundledModule accepts Metro module ids only', () => {
  assert.equal(isBundledModule(0), true);
  assert.equal(isBundledModule(42), true);
  for (const v of [-1, 1.5, NaN, Infinity, '3', null, undefined, { uri: FILE }]) assert.equal(isBundledModule(v), false, String(v));
});

test('isLocalFileUri accepts file:// URIs and absolute paths only', () => {
  assert.equal(isLocalFileUri(FILE), true);
  assert.equal(isLocalFileUri('/private/var/x/hero.png'), true);
  for (const v of [
    '',
    ' file:///a.png',
    'file://',
    'file:///',
    'file://relative/a.png',
    '//cdn.example.com/a.png',
    'https://github.com/x/releases/download/t/a.png',
    'http://localhost:8081/assets/a.png',
    'data:image/png;base64,AAAA',
    'content://media/1',
    'ph://ABC',
    'assets/a.png',
    'file:///var/x/../../etc/a.png',
    '/var/dir/',
    null,
    undefined,
    7,
  ]) {
    assert.equal(isLocalFileUri(v), false, String(v));
  }
});

test('resolveSeamlessArt: bundled wins, then a local file, then the fallback', () => {
  assert.deepEqual(resolveSeamlessArt({ bundled: 12, fileUri: FILE }), { kind: 'bundled', module: 12 });
  assert.deepEqual(resolveSeamlessArt({ bundled: null, fileUri: FILE }), { kind: 'file', uri: FILE });
  assert.deepEqual(resolveSeamlessArt({ fileUri: 'https://example.com/a.png' }), SEAMLESS_FALLBACK);
  assert.deepEqual(resolveSeamlessArt({}), SEAMLESS_FALLBACK);
  assert.deepEqual(resolveSeamlessArt(null), SEAMLESS_FALLBACK);
  assert.deepEqual(resolveSeamlessArt(undefined), SEAMLESS_FALLBACK);
});

test('resolveSeamlessArt skips sources that failed to load', () => {
  const file = { kind: 'file', uri: FILE } as const;
  assert.deepEqual(resolveSeamlessArt({ fileUri: FILE, failed: [seamlessSourceKey(file)] }), SEAMLESS_FALLBACK);
  // A failed bundled image falls through to the downloaded file.
  assert.deepEqual(resolveSeamlessArt({ bundled: 3, fileUri: FILE, failed: new Set(['bundled:3']) }), file);
  // Failures of other files don't matter.
  assert.deepEqual(resolveSeamlessArt({ fileUri: FILE, failed: [`file:${HERO}`] }), file);
});

test('seamlessSourceKey is distinct per source', () => {
  const keys = [
    seamlessSourceKey({ kind: 'bundled', module: 1 }),
    seamlessSourceKey({ kind: 'bundled', module: 2 }),
    seamlessSourceKey({ kind: 'file', uri: FILE }),
    seamlessSourceKey({ kind: 'file', uri: HERO }),
    seamlessSourceKey(SEAMLESS_FALLBACK),
  ];
  assert.equal(new Set(keys).size, keys.length);
});

test('seamlessCardSources: bundled pack (unchanged behaviour)', () => {
  const s = seamlessCardSources({ bundledWallpaper: 5, bundledHero: 6 });
  assert.deepEqual(s, { wallpaper: { kind: 'bundled', module: 5 }, hero: { kind: 'bundled', module: 6 }, show: true, canWrite: true });
});

test('seamlessCardSources: downloaded remote pack uses its files', () => {
  const s = seamlessCardSources({ wallpaperUri: FILE, heroUri: HERO });
  assert.deepEqual(s.wallpaper, { kind: 'file', uri: FILE });
  assert.deepEqual(s.hero, { kind: 'file', uri: HERO });
  assert.equal(s.show, true);
  assert.equal(s.canWrite, true);
});

test('seamlessCardSources: missing hero file leaves the wallpaper crop only', () => {
  const noHero = seamlessCardSources({ wallpaperUri: FILE, heroUri: null });
  assert.deepEqual(noHero.hero, SEAMLESS_FALLBACK);
  assert.equal(noHero.canWrite, true);
  const brokenHero = seamlessCardSources({ wallpaperUri: FILE, heroUri: HERO, failed: [`file:${HERO}`] });
  assert.deepEqual(brokenHero.hero, SEAMLESS_FALLBACK);
  assert.equal(brokenHero.canWrite, true);
});

test('seamlessCardSources: missing wallpaper file shows the gradient and cannot write', () => {
  const s = seamlessCardSources({ wallpaperUri: FILE, heroUri: HERO, failed: [`file:${FILE}`] });
  assert.deepEqual(s.wallpaper, SEAMLESS_FALLBACK);
  assert.deepEqual(s.hero, { kind: 'file', uri: HERO });
  assert.equal(s.show, true);
  assert.equal(s.canWrite, false);
});

test('seamlessCardSources: a pack that is neither bundled nor downloaded hides the card', () => {
  for (const input of [null, undefined, {}, { wallpaperUri: null, heroUri: null }, { wallpaperUri: 'https://example.com/w.webp' }]) {
    const s = seamlessCardSources(input);
    assert.equal(s.show, false);
    assert.equal(s.canWrite, false);
    assert.deepEqual(s.wallpaper, SEAMLESS_FALLBACK);
  }
});

test('seamlessImageSource maps to expo-image sources', () => {
  assert.equal(seamlessImageSource({ kind: 'bundled', module: 9 }), 9);
  assert.deepEqual(seamlessImageSource({ kind: 'file', uri: FILE }), { uri: FILE });
  assert.equal(seamlessImageSource(SEAMLESS_FALLBACK), null);
});

test('the Seamless card resolves pictures through seamlessCardSources and passes remote files', () => {
  const detail = read('app/theme/[id].tsx');
  assert.match(detail, /seamlessCardSources\(/);
  assert.match(detail, /<SeamlessCard artPackId=\{artPack\.artPack\.id\}[^>]*wallpaperUri=\{remoteWallpaperUri\}[^>]*heroUris=\{remoteHeroUris\}/);
  // The bridge gets the downloaded file directly; bundled art still goes through localAssetUri.
  const start = detail.indexOf('const onUse = async () => {');
  const body = detail.slice(start, detail.indexOf('\n  };', start));
  assert.match(body, /existingLocalFile\(/);
});

test('the preview draws a fallback wallpaper and reports image errors', () => {
  const src = read('src/ui/SeamlessWidgetPreview.tsx');
  assert.match(src, /fallbackWallpaper/);
  assert.match(src, /onWallpaperError/);
  assert.match(src, /onHeroError/);
  assert.match(src, /onError=/);
});

test('remote hero files come from the downloaded manifest', () => {
  const hook = read('src/native/useRemoteCatalog.ts');
  assert.match(hook, /heroUris/);
  assert.match(hook, /files\.heroes\[/);
});
