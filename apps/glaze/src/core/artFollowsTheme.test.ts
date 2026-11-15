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
  assert.match(read('src', 'ui', 'WidgetArtLibraryList.tsx'), /const preparing = stale \|\| \(sync\.syncing !== null && list\.length < ARTWORK_SLOT_COUNT\);/);
});
