// Glaze 1.0.39 (owner TestFlight 1.0.37: "It needs to just use everything straight away when you hit a new
// theme"; "when I first selected a new theme, there was no widget until I put one down on the home
// screen"): widget art follows the chosen theme on every path, never waiting for "Use everything" or a
// Home Screen widget. Source checks of the wiring (the stores need the native bridge to run).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('choosing a theme marks its art Preparing and queues the art sync; a pack theme downloads first', () => {
  const store = read('src', 'store', 'activeTheme.ts');
  const apply = store.slice(store.indexOf('export async function applyThemeEverywhere'), store.indexOf('async function themeArtStep'));
  assert.match(apply, /markThemeArtPending\(theme\.id\);\s*requestDeferred\(DEFERRED_STEPS\.widgetTheme\);\s*requestDeferred\(DEFERRED_STEPS\.themeArt\);/);
  const page = read('app', 'theme', '[id].tsx');
  const select = page.slice(page.indexOf('const selectTheme = async'), page.indexOf('const ensureSelected'));
  assert.ok(select.indexOf('await pack.download()') > 0 && select.indexOf('await pack.download()') < select.indexOf('applyThemeEverywhere(theme)'), 'download before apply');
});

test('a pack that finishes installing for the theme in use makes its art at once', () => {
  const packs = read('src', 'native', 'packs.ts');
  assert.match(packs, /saveIndex\(cacheIndexAdd\(state\.index, remoteArtCacheEntry\(r\.manifest, new Date\(\)\)\)\);[\s\S]{0,300}packInstalledListener\?\.\(id\);/);
  const store = read('src', 'store', 'activeTheme.ts');
  assert.match(store, /setPackInstalledListener\(\(id\) => \{[\s\S]*?if \(active !== id\) return;\s*markThemeArtPending\(id\);\s*requestDeferred\(DEFERRED_STEPS\.themeArt\);/);
});

test('launch makes the art of the theme in use when My widget art has none of it (fresh install)', () => {
  const store = read('src', 'store', 'activeTheme.ts');
  assert.match(store, /if \(lib\.pieces\.some\(\(p\) => p\.source !== 'photo' && p\.themeId === id\)\) return;\s*requestDeferred\(DEFERRED_STEPS\.themeArt\);/);
  assert.match(read('src', 'store', 'launchWork.ts'), /await ensureActiveThemeArt\(\);/);
});

test('Preparing clears itself: the sync ends it, and a safety timer if no sync ever starts', () => {
  const art = read('src', 'store', 'themeWidgetArt.ts');
  assert.match(art, /export function markThemeArtPending\(themeId: string\): void \{\s*setSyncStatus\(themeId, false\);/);
  assert.match(art, /if \(syncStatus\.syncing === themeId\) setSyncStatus\(null, true\);\s*\}, 60_000\);/);
  assert.match(read('src', 'ui', 'WidgetArtLibraryList.tsx'), /const preparing = stale \|\| \(sync\.syncing !== null && list\.length < g\.count\);/);
});

// 1.0.39 (owner 2026-11-15): each artwork in My widget art has Save to Photos and Add to Custom 1-5,
// and the theme page / chooser say every theme comes with its own five artworks.
test('artwork menu: Save to Photos (add-only) and Add to Custom 1-5, confirming before a replace', () => {
  const actions = read('src', 'ui', 'artworkActions.ts');
  assert.match(actions, /const options = \[t\('ui\.seamless\.library\.savePhotos'\), \.\.\.custom, t\('ui\.seamless\.library\.cancel'\)\];/);
  assert.match(actions, /await saveFileToPhotos\(uri\)/);
  assert.match(actions, /if \(now\?\.\[slot - 1\]\) \{\s*Alert\.alert\(t\('ui\.seamless\.library\.replaceTitle'/);
  assert.match(actions, /const ok = await customArt\.set\(slot, uri\);/);
  const list = read('src', 'ui', 'WidgetArtLibraryList.tsx');
  assert.match(list, /accessibilityActions=\{dir \? \[\{ name: 'more', label: t\('ui\.seamless\.library\.actions', \{ n \}\) \}\] : undefined\}/);
  assert.match(list, /onPress=\{\(\) => openArtworkActions|onPress=\{\(\) => openActions\(n, `\$\{base\}\$\{p\.file\}`\)\}/);
  assert.match(read('src', 'native', 'customArt.ts'), /if \(ok\) emitChanged\(\);/);
  assert.match(read('src', 'ui', 'CustomArtSlots.tsx'), /customArt\.subscribe\(/);
});

test('the five-artworks note is on the theme page and in the theme chooser', () => {
  const page = read('app', 'theme', '[id].tsx');
  assert.match(page, /\{overview \? <ArtworkNote style=\{styles\.artworkNote\} \/> : null\}/);
  const sheet = page.slice(page.indexOf('<Sheet visible={themeChoiceOpen}'));
  assert.ok(sheet.indexOf('<ArtworkNote />') > 0 && sheet.indexOf('<ArtworkNote />') < sheet.indexOf('</Sheet>'));
  const en = read('src', 'i18n', 'ns', 'theme', 'en.ts');
  assert.match(en, /artNoteTitle: 'Every theme comes with its own 5 widget artworks'/);
  assert.match(en, /artNoteBody: 'Like a piece from another theme\? Add it to one of your Custom widgets\.'/);
});

test('the Home Screen widget never repeats a piece: past the count it draws the theme design', () => {
  const swift = read('targets', 'widget', 'ThemeArtWidgets.swift');
  assert.match(swift, /guard slot >= 1, slot <= list\.count else \{ return nil \}/);
  assert.match(swift, /ThemedFallbackArt\(theme: entry\.theme, variant: entry\.sample\)/);
});

// 1.0.39 (owner's flow, TestFlight build 88): "Use this theme?" -> accept -> a short checklist.
test('theme sheet: the "Use this theme?" prompt, then next steps (wallpaper only until saved, icons, widgets)', () => {
  const page = read('app', 'theme', '[id].tsx');
  const sheet = page.slice(page.indexOf('<Sheet visible={themeChoiceOpen}'), page.indexOf('</Sheet>', page.indexOf('<Sheet visible={themeChoiceOpen}')));
  assert.match(sheet, /title=\{inUse \? t\('theme\.use\.nextTitle'\) : t\('theme\.use\.prompt'\)\}/);
  assert.match(sheet, /\{savedBefore \|\| saveState === 'saved' \? null : \(\s*<PillButton label=\{t\('theme\.use\.addWallpaper'\)\}/);
  assert.match(sheet, /t\('theme\.use\.viewIcons'\)[\s\S]*void openIconSetup\(\);/);
  assert.match(sheet, /t\('theme\.use\.viewWidgets'\)[\s\S]*onPress=\{\(\) => void openWidgetsTab\(\)\}/);
  assert.match(sheet, /t\('theme\.use\.yes'\)[\s\S]*onPress=\{\(\) => void putInUse\(\)\}/);
  assert.doesNotMatch(sheet, /theme\.use\.useEverything/, 'no separate "Use everything" button');
  assert.match(page, /inUse \? t\('theme\.use\.inUse'\) : t\('theme\.use\.prompt'\)/);
  // Accepting applies the theme and opens the checklist; it no longer saves the wallpaper or jumps to icons.
  const put = page.slice(page.indexOf('const putInUse = async'), page.indexOf('const openIconSetup = async'));
  assert.match(put, /if \(await selectTheme\(focus\) && themeFocus\.current === focus\) setThemeChoiceOpen\(true\);/);
  assert.doesNotMatch(put, /onSaveWallpaper|openIconSetup\(\)/);
});
