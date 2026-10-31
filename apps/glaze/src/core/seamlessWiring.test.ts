// T133 source guard: the theme detail shows the Seamless widget card for art-pack themes only,
// writes through widgets.setSeamless only from the button's press handler, and every key it uses
// exists in English.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/ns/ui/en.ts';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');
const detail = read('app/theme/[id].tsx');

test('theme detail imports the Seamless preview and controls', () => {
  assert.match(detail, /import \{ SeamlessWidgetPreview \} from '[./]*src\/ui\/SeamlessWidgetPreview'/);
  assert.match(detail, /import \{ SeamlessWidgetControls, type SeamlessControlsStrings \} from '[./]*src\/ui\/SeamlessWidgetControls'/);
  assert.match(detail, /<SeamlessWidgetPreview[\s\S]*?outline/);
  assert.match(detail, /<SeamlessWidgetControls[\s\S]*?strings=\{strings\}/);
});

test('the Seamless card shows for art-pack themes only', () => {
  // T168: remote art packs pass their downloaded wallpaper / hero files too.
  assert.match(detail, /\{artPack \? <SeamlessCard artPackId=\{artPack\.artPack\.id\} theme=\{theme\} wallpaperUri=\{remoteWallpaperUri\} heroUris=\{remoteHeroUris\} \/> : null\}/);
  assert.equal((detail.match(/<SeamlessCard\b/g) ?? []).length, 1);
});

test('widgets.setSeamless is called once, inside the onUse press handler', () => {
  const calls = [...detail.matchAll(/widgets\.setSeamless\(/g)];
  assert.equal(calls.length, 1);
  const start = detail.indexOf('const onUse = async () => {');
  assert.ok(start > 0, 'onUse handler');
  const end = detail.indexOf('\n  };', start);
  const at = calls[0].index ?? -1;
  assert.ok(at > start && at < end, 'setSeamless sits inside onUse');
  assert.match(detail, /onPress=\{onUse\}/);
  // Checks the bridge first (Expo Go: nothing downloaded) and resolves local files.
  const body = detail.slice(start, end);
  assert.match(body, /widgets\.isAvailable\(\)/);
  assert.match(body, /localAssetUri\(wallpaperSrc\.module,/);
  assert.match(body, /seamlessCrop\(/);
});

test('every ui.seamless.* key used by the theme detail exists in English', () => {
  const used = new Set([...detail.matchAll(/'ui\.seamless\.([\w.-]+)'/g)].map((m) => m[1]));
  assert.ok(used.size >= 20, `expected the card's keys, found ${used.size}`);
  for (const path of used) {
    let node: unknown = en.seamless;
    for (const part of path.split('.')) node = (node as Record<string, unknown>)?.[part];
    assert.equal(typeof node, 'string', `ui.seamless.${path} missing from ns/ui/en.ts`);
  }
});

test('local asset helper downloads only http(s) URIs, through the fs adapter', () => {
  const src = read('src/ui/seamlessSetup.ts');
  assert.match(src, /import \* as fs from '[./]*native\/fs'/);
  assert.match(src, /startsWith\('file:\/\/'\)/);
  assert.match(src, /fs\.downloadAsync\(/);
  assert.doesNotMatch(src, /expo-file-system/);
});
