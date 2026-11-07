import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WIDGET_ART_MIGRATION, migrateLibrary } from '../src/core/widgetArtLibrary.ts';
import { commitThemeArt } from '../src/core/themeArtSync.ts';

// Opening the real library during recovery invokes this original cleanup. It must leave
// the clean index without a current theme until the original art commit publishes it.
const resetSource = readFileSync(new URL('../modules/glaze-widget-bridge/ios/WidgetArtRecovery.swift', import.meta.url), 'utf8');
const nativeVersion = Number(resetSource.match(/"migrated": (\d+)/)?.[1]);
assert.equal(nativeVersion, WIDGET_ART_MIGRATION);
const photo = { id: 'p-personal', name: 'Mine', themeName: '', source: 'photo', file: 'p-personal.jpg', created: 1, aspect: 1 };
const reset = { v: 1, pieces: [photo], migrated: nativeVersion };
const duringPreview = migrateLibrary(reset, 'alpine-starlight');
assert.equal(duringPreview.ran, false);
assert.equal(duringPreview.lib.currentThemeId, undefined);
const planned = ['small', 'medium', 'large'].map(size => ({
  id: `t-alpine-starlight-silver-moon-${size}`, optionId: 'silver-moon',
  name: `Silver moon ${size}`, themeName: 'Alpine Starlight', themeId: 'alpine-starlight',
  source: 'theme', aspect: 1, size, slot: 0,
}));
const committed = commitThemeArt(duringPreview.lib, 'alpine-starlight', planned, planned.map(piece => piece.id), 100);
assert.equal(committed.lib.currentThemeId, 'alpine-starlight');
assert.deepEqual(committed.lib.pieces.find(piece => piece.id === photo.id), photo);
for (const piece of planned) assert.equal(committed.lib.unpinned[piece.size], piece.id);
console.log('GLAZE_RECOVERY_PREVIEW_MIGRATION_ORDER_VERIFIED');
