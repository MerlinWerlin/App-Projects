// 1.0.35 (owner TestFlight 2026-11-14 03:58-04:03 UTC): the how-to video in the top-right corner of the Icons,
// Widgets and Wallpapers tabs (filled, "highlighted"), and the wallpapers of downloaded themes on the Wallpapers tab.
// Source checks (React can't be rendered here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tabsNs from '../i18n/ns/tabs/index.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('Icons, Widgets and Wallpapers tabs have Watch how in the top-right corner, with its sheet', () => {
  for (const [file, category] of [['icons.tsx', 'icons'], ['widgets.tsx', 'widgets'], ['wallpapers.tsx', 'wallpaper']] as const) {
    const src = read('app', '(tabs)', file);
    assert.match(src, new RegExp(`const how = useHowTo\\('${category}'\\);`), file);
    assert.match(src, /trailing=\{<WatchHowButton onPress=\{how\.open\} compact \/>\}/, file);
    assert.match(src, /\{how\.sheet\}/, file);
  }
  // The corner button is the filled tint pill ("highlighted"); the full-width one stays quiet.
  assert.match(read('src', 'ui', 'HowToSheet.tsx'), /variant=\{compact \? 'filled' : 'soft'\}/);
});

test('the Wallpapers tab shows downloaded theme wallpapers as a grid you can save from', () => {
  const src = read('app', '(tabs)', 'wallpapers.tsx');
  assert.match(src, /const themeWalls = useDownloadedThemeWallpapers\(\);/);
  assert.match(src, /<View style=\{styles\.themeGrid\}>/);
  assert.match(src, /themeGrid: \{ flexDirection: 'row', flexWrap: 'wrap'/);
  // Tap one: a sheet with Save to Photos (the same add-only save as My wallpapers) and Open the theme.
  assert.match(src, /setOpenTheme\(w\);/);
  assert.match(src, /const res = await saveFileToPhotos\(openTheme\.uri\);/);
  assert.match(src, /t\('tabs\.wallpapersTab\.themes\.save'\)/);
  assert.match(src, /router\.push\(\{ pathname: '\/theme\/\[id\]', params: \{ id, step: 'wallpaper' \} \}\)/);
  assert.match(read('src', 'store', 'myWallpapers.ts'), /export async function saveWallpaperAgain\(item: MyWallpaper\): Promise<SaveAgainResult> \{\s*return saveFileToPhotos\(item\.uri\);/);
  assert.match(src, /t\('tabs\.wallpapersTab\.themes\.empty'\)/);
  assert.ok(src.indexOf("tabs.wallpapersTab.themes.title") < src.indexOf("tabs.wallpapersTab.mine.title"), 'theme wallpapers come before My wallpapers');
  const hook = read('src', 'native', 'useDownloadedThemeWallpapers.ts');
  assert.match(hook, /store\.index\.packs/);
  assert.match(hook, /remoteArtOnDevice\(t\.id\)/);
  assert.doesNotMatch(hook, /downloadPackToDevice|downloadRemoteArtToDevice/, 'never downloads anything');
});

test('every locale has the theme wallpaper strings', () => {
  for (const [lang, ns] of Object.entries(tabsNs) as [string, { wallpapersTab?: { themes?: Record<string, string> } }][]) {
    if (!ns || typeof ns !== 'object' || !('wallpapersTab' in ns)) continue;
    const th = ns.wallpapersTab?.themes;
    assert.ok(th, `${lang}: wallpapersTab.themes`);
    for (const k of ['eyebrow', 'title', 'body', 'empty', 'itemA11y']) assert.equal(typeof th[k], 'string', `${lang}: ${k}`);
    assert.match(th.itemA11y, /\{name\}/, `${lang}: itemA11y keeps {name}`);
  }
});

// Owner TestFlight 04:02 ("This menus confusing we should just have an option which takes them to icons or widgets and
// just shows how"): a theme's flow opens the install screen on two choices; Icons continues into the same install.
test('install: a theme flow opens on Icons / Widgets first; the Icons tab and auto start skip it', () => {
  const src = read('app', 'install.tsx');
  assert.match(src, /const \[chooser, setChooser\] = useState<boolean>\(\(\) => !!requestedThemeId && auto !== '1'\);/);
  assert.match(src, /<AddChooser onIcons=\{\(\) => setChooser\(false\)\} onWidgets=\{\(\) => router\.navigate\('\/widgets'\)\} \/>/);
  assert.ok(src.indexOf('if (chooser) {') < src.indexOf('if (!studio || !install.loaded) {'), 'chooser before the install itself');
  const chooser = read('src', 'ui', 'AddChooser.tsx');
  assert.match(chooser, /HOW_TO_CLIPS\[choice\]\.poster/);
  assert.match(chooser, /accessibilityRole="button"/);
  for (const k of ['title', 'body']) assert.ok(chooser.includes(`t('install.chooser.${k}')`), k);
});
