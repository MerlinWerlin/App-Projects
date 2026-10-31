// T179 (owner-1031): the theme page of a remote catalogue theme (the free Codex art packs). Pure
// logic of src/core/remoteThemePage.ts against the real glaze-packs-v1 catalogue copy, plus source
// guards on app/theme/[id].tsx: an art-led hero (catalogue thumb, then the downloaded wallpaper),
// one primary Download pill with the size in the glass bar, a determinate progress bar, calm Try
// again copy (never the raw error), Apply end to end (wallpaper file, widget art, glyph icons) and
// lookups that fall back to the remote theme (Widget Studio, wallpaper maker, Your look, Icons).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCatalog, type Catalog } from './packCatalog.ts';
import { remoteArtDetailView, remoteArtTheme, remoteArtThemes } from './remoteCatalog.ts';
import { remoteHeroArt, remotePrimary, resolveAnyTheme, themePageState } from './remoteThemePage.ts';
import { formatBytes } from './themePack.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];
const BASE = 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1';
// Competitor names (ops/CONVENTIONS.md), ROT13-encoded so the names never appear in the repo (as catalogue.test.ts).
const rot13 = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const COMPETITORS = ['gurzvsl', 'vpba gurzre', 'zlfperra', 'fperraxvg', 'jvqtrgfzvgu', 'vagbyvir', 'ybbcl', 'ybpxvb'].map(rot13);

function catalog(): Catalog {
  const r = parseCatalog(JSON.parse(read('src', 'core', 'fixtures', 'catalog-glaze-packs-v1.json')));
  assert.ok(r.ok, 'fixture parses');
  return r.value;
}

const access = (state: 'free' | 'locked' | 'ready' | 'disabled' | 'not-downloaded' | 'downloading' | 'error', progress = 0, error: string | null = null) => ({ state, progress, error });

test('remote theme page: Download carries the catalogue size, then progress, then Apply', () => {
  const pack = catalog().packs.find((p) => p.id === 'firefly-grove') ?? catalog().packs[0];
  const theme = remoteArtTheme(pack, BASE);
  const dl = remotePrimary(remoteArtDetailView(access('not-downloaded')), theme.remoteArt.bytes);
  assert.deepEqual(dl, { kind: 'download', bytes: pack.bytes });
  assert.ok(formatBytes(pack.bytes, 'en').length > 0, 'size formats for the pill');
  const mid = remotePrimary(remoteArtDetailView(access('downloading', 0.42)), theme.remoteArt.bytes);
  assert.deepEqual(mid, { kind: 'downloading', progress: 0.42, percent: 42 });
  const full = remotePrimary(remoteArtDetailView(access('downloading', 1)), theme.remoteArt.bytes);
  assert.equal(full.kind === 'downloading' && full.percent, 99, 'never 100 % before verification');
  assert.deepEqual(remotePrimary(remoteArtDetailView(access('ready')), theme.remoteArt.bytes), { kind: 'apply' });
  assert.deepEqual(remotePrimary(remoteArtDetailView(access('locked')), theme.remoteArt.bytes), { kind: 'unlock' });
  assert.deepEqual(remotePrimary({ kind: 'download' }, 0), { kind: 'download', bytes: null }, 'no size: plain Download');
  assert.deepEqual(remotePrimary({ kind: 'download' }, Number.NaN), { kind: 'download', bytes: null });
});

test('remote theme page: offline, a 404 or a damaged file all read as the calm Try again', () => {
  const APP = 'This pack needs a newer version of Glaze.';
  for (const msg of ['Couldn’t reach the pack. Check your connection and try again.', 'HTTP 404', '', null]) {
    assert.deepEqual(remotePrimary(remoteArtDetailView(access('error', 0, msg)), 1, APP), { kind: 'retry', reason: 'offline' }, String(msg));
  }
  assert.deepEqual(remotePrimary(remoteArtDetailView(access('disabled', 0, 'x')), 1, APP), { kind: 'retry', reason: 'offline' });
  assert.deepEqual(remotePrimary(remoteArtDetailView(access('error', 0, APP)), 1, APP), { kind: 'retry', reason: 'app-version' });
});

test('remote theme page: the hero shows the catalogue thumb, then the downloaded wallpaper', () => {
  const theme = remoteArtTheme(catalog().packs[0], BASE);
  assert.ok(theme.remoteArt.thumbUrl && theme.remoteArt.thumbUrl.endsWith('.webp'), 'catalogue thumb is a remote .webp');
  assert.ok(theme.remoteArt.thumbhash.length > 0, 'thumbhash placeholder');
  assert.deepEqual(remoteHeroArt({ wallpaperUri: null, thumbUrl: theme.remoteArt.thumbUrl }), { stage: 'preview', uri: theme.remoteArt.thumbUrl });
  const local = 'file:///doc/packs/alpine-starlight/wallpaper-1290.webp';
  assert.deepEqual(remoteHeroArt({ wallpaperUri: local, thumbUrl: theme.remoteArt.thumbUrl }), { stage: 'downloaded', uri: local });
  assert.deepEqual(remoteHeroArt({ wallpaperUri: ' ', thumbUrl: null }), { stage: 'placeholder', uri: null });
});

test('remote themes: lookups fall back to the catalogue, bundled ids win, the page waits for the catalogue', () => {
  const remote = remoteArtThemes(catalog(), BASE, []);
  assert.equal(remote.length, 10);
  const bundled = new Map([['deep-sea', { id: 'deep-sea', name: 'Deep Sea (bundled)' }]]);
  const lookup = (id: string) => bundled.get(id);
  const list = [...remote.map((t) => ({ id: t.id, name: t.name })), { id: 'deep-sea', name: 'remote copy' }];
  assert.equal(resolveAnyTheme('firefly-grove', lookup, list)?.name, 'Firefly Grove');
  assert.equal(resolveAnyTheme('deep-sea', lookup, list)?.name, 'Deep Sea (bundled)');
  assert.equal(resolveAnyTheme('nope', lookup, list), undefined);
  assert.equal(resolveAnyTheme(null, lookup, list), undefined);
  assert.equal(themePageState({ found: true, packsEnabled: true, catalogSettled: false }), 'show');
  assert.equal(themePageState({ found: false, packsEnabled: true, catalogSettled: false }), 'wait');
  assert.equal(themePageState({ found: false, packsEnabled: true, catalogSettled: true }), 'missing');
  assert.equal(themePageState({ found: false, packsEnabled: false, catalogSettled: false }), 'missing');
});

test('remote theme icons are glyphs in the theme palette (no per-app icon art needed)', () => {
  for (const p of catalog().packs) {
    const t = remoteArtTheme(p, BASE);
    assert.equal(t.iconStyle.background.kind, 'solid');
    assert.equal(t.iconStyle.background.kind === 'solid' && t.iconStyle.background.colour, p.palette.tile, p.id);
    assert.equal(t.iconStyle.glyphColour, p.palette.glyph, p.id);
    assert.ok(t.iconStyle.glyphSet === 'feather' || t.iconStyle.glyphSet === 'glaze', p.id);
  }
});

test('theme page source: one Download pill in its own glass bar, determinate progress, calm copy, no raw error', () => {
  const d = strip(read('app', 'theme', '[id].tsx'));
  const at = d.indexOf('function RemoteDownloadBar(');
  assert.ok(at > 0, 'RemoteDownloadBar');
  const bar = d.slice(at, d.indexOf('\nfunction ', at + 10));
  assert.ok(bar.includes('<GlassBar material="chrome"'), 'its own chrome glass bar');
  const pills = [...bar.matchAll(/<PillButton\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(pills.length >= 1 && pills.every((p) => !/variant=/.test(p)), 'each state has one filled pill');
  assert.ok(bar.includes("t('theme.remote.downloadSize', { size: formatBytes(primary.bytes, locale) })"), 'Download pill shows the size');
  assert.ok(bar.includes('<ProgressBar progress={primary.percent / 100}'), 'determinate progress bar');
  assert.ok(bar.includes("t('theme.remote.offline')"), 'calm offline copy');
  assert.doesNotMatch(bar, /view\.message|\.error\b|c\.warn/, 'never the raw error or warning colour');
  // The Apply bar stays the first chrome glass bar (premiumThemeDetail guard), and hides until downloaded.
  assert.ok(d.indexOf('<GlassBar material="chrome"') < at);
  // T185: the bar ("Use this theme") shows on the overview only; the Wallpaper / Icons screens have none.
  assert.match(d, /const showBar = overview && canApply && \(!primary \|\| primary\.kind === 'apply'\);/);
  assert.match(d, /!remoteArt && showsPackCard\(packView\) \? <PackCard/, 'the old pack card is not shown for remote themes');
  assert.doesNotMatch(d, /withSpring|ActivityIndicator/);
});

test('theme page source: hero art, Apply end to end, success haptic only at the end', () => {
  const d = strip(read('app', 'theme', '[id].tsx'));
  assert.ok(d.includes('<RemoteArtImage theme={remoteArt} localUri={remoteWallpaperUri}'), 'hero: catalogue thumb, then the downloaded wallpaper');
  assert.ok(d.includes("t('theme.remote.heroDownloaded')") && d.includes("t('theme.remote.heroPreview')"));
  // Wallpaper step: the downloaded file (read now if needed), never the drawn fallback for a remote pack.
  assert.ok(d.includes('await downloadedRemoteWallpaper(remoteArt.id)'));
  assert.ok(d.includes("remoteMissing\n      ? { ok: false, why: 'unreadable' }"));
  // Widget step: the downloaded widget art in the seamless card, and applyWidgetTheme.
  assert.ok(d.includes('wallpaperUri={remoteWallpaperUri} heroUris={remoteHeroUris}'));
  assert.ok(d.includes('void applyWidgetTheme(theme)'));
  // Icons step: glyph icons in the palette, with a note for art packs.
  assert.ok(d.includes("t('theme.remote.iconsNote')"));
  assert.equal((d.match(/haptic\('success'\)/g) ?? []).length, 1, 'only the end-of-flow moment (a finished download is light)');
  // Skeleton while the cached catalogue is read.
  assert.ok(d.includes("if (pageState === 'wait') return <ThemePageSkeleton />;"));
  const tags = [...d.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(tags.filter((t) => !/maxFontSizeMultiplier=/.test(t)), [], 'Dynamic Type caps');
});

test('remote theme lookups: Widget Studio, wallpaper maker, Your look and Icons fall back to the remote theme', () => {
  for (const f of [['app', 'widget-studio.tsx'], ['app', 'wallpaper.tsx'], ['src', 'ui', 'YourLookPanel.tsx'], ['app', '(tabs)', 'icons.tsx']]) {
    const src = strip(read(...f));
    assert.ok(src.includes('useAnyTheme('), `${f.join('/')} uses useAnyTheme`);
    assert.doesNotMatch(src, /getAnyTheme\(/, `${f.join('/')}: no bundled-only lookup left`);
  }
  const hook = strip(read('src', 'native', 'useAnyTheme.ts'));
  assert.ok(hook.includes('getAnyTheme(key)') && hook.includes('useRemoteArtTheme('), 'bundled first, then remote');
});

test('every locale has the remote theme page strings, no competitor names', () => {
  const keys = ['heroPreview', 'heroDownloaded', 'download', 'downloadSize', 'downloadA11y', 'downloadHint', 'includes', 'downloading', 'offline', 'unlock', 'iconsNote', 'loadingA11y'];
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'theme', `${loc}.ts`);
    const block = /\n {2}remote: \{\n([\s\S]*?)\n {2}\},\n/.exec(src)?.[1] ?? '';
    for (const k of keys) assert.ok(block.includes(`    ${k}: '`), `${loc}: theme.remote.${k}`);
    assert.ok(block.includes('{size}'), `${loc}: size placeholder`);
    for (const name of COMPETITORS) assert.ok(!block.toLowerCase().includes(name), `${loc}: competitor name`);
  }
});
