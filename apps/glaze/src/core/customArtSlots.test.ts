// Owner 2026-11-15 ("make your own theme, be creative"): Your artwork + the Custom 1-5 widgets.
// No Xcode here, so the Swift rules are checked as source text (like artworkSlots.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CUSTOM_ART_MAX_PIXELS, CUSTOM_ART_SLOT_COUNT, EMPTY_CUSTOM_ART, isCustomArtSlot, normaliseCustomArtList } from './customArtSlots.ts';

const R = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const widget = R('targets', 'widget', 'CustomArtWidgets.swift');
const bridge = R('modules', 'glaze-widget-bridge', 'ios', 'CustomArtSlots.swift');
const LANGS = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans'];

test('five slots; the bridge answer is normalised to five file:// URIs or null', () => {
  assert.equal(CUSTOM_ART_SLOT_COUNT, 5);
  assert.deepEqual(EMPTY_CUSTOM_ART, [null, null, null, null, null]);
  assert.deepEqual(normaliseCustomArtList(null), EMPTY_CUSTOM_ART);
  assert.deepEqual(normaliseCustomArtList(['file:///a/1-x.jpg', '', 'https://x/y.jpg', 7]), ['file:///a/1-x.jpg', null, null, null, null]);
  assert.equal(normaliseCustomArtList(Array(9).fill('file:///z.jpg')).length, 5);
  assert.ok(isCustomArtSlot(1) && isCustomArtSlot(5));
  assert.ok(!isCustomArtSlot(0) && !isCustomArtSlot(6) && !isCustomArtSlot(1.5));
});

test('app, bridge and widget agree on slot count, size and folder', () => {
  for (const src of [widget, bridge]) {
    assert.match(src, new RegExp(`static let slotCount = ${CUSTOM_ART_SLOT_COUNT}\\b`));
    assert.match(src, new RegExp(`static let maxPixels = ${CUSTOM_ART_MAX_PIXELS}\\b`));
    assert.match(src, /static let folder = "custom-art"/);
    assert.match(src, /static let manifest = "slots\.json"/);
  }
  // Memory-safe decode in the widget: ImageIO thumbnail capped at maxPixels, never UIImage(contentsOfFile:).
  assert.match(widget, /kCGImageSourceThumbnailMaxPixelSize: maxPixels/);
  assert.doesNotMatch(widget, /UIImage\(contentsOfFile/);
});

test('Custom 1-5: fixed written-out names and kinds, never interpolated, small only', () => {
  assert.ok(widget.includes('.configurationDisplayName(displayName(slot: slot))'));
  assert.doesNotMatch(widget, /configurationDisplayName\("[^"]*\\\(/, 'no interpolated display name');
  assert.doesNotMatch(widget, /\.description\("[^"]*\\\(/, 'no interpolated description');
  assert.doesNotMatch(widget, /return "GlazeCustom\\\(/, 'no interpolated kind');
  for (let n = 1; n <= 5; n++) {
    assert.ok(widget.includes(`return "Custom ${n}"`), `Custom ${n} name`);
    assert.ok(widget.includes(`return "GlazeCustom${n}"`), `GlazeCustom${n} kind`);
    assert.ok(widget.includes(`struct CustomArtWidget${n}: Widget`), `CustomArtWidget${n} declared`);
  }
  assert.match(widget, /\.supportedFamilies\(\[\.systemSmall\]\)/);
  assert.doesNotMatch(widget, /systemMedium|systemLarge/);
  // Registered in the personal widgets bundle (the @main block is at its 9-entry limit); Artwork untouched.
  const bundle = R('targets', 'widget', 'GlazeWidgetsBundle.swift');
  const personal = bundle.slice(bundle.indexOf('struct GlazePersonalWidgetsBundle'));
  for (let n = 1; n <= 5; n++) assert.match(personal, new RegExp(`\\n\\s*CustomArtWidget${n}\\(\\)\\n`), `Custom ${n} in GlazePersonalWidgetsBundle`);
  assert.doesNotMatch(R('targets', 'widget', 'ThemeArtWidgets.swift'), /Custom/);
});

test('the widget strings exist in every language', () => {
  const keys = ['Custom 1', 'Custom 2', 'Custom 3', 'Custom 4', 'Custom 5', 'Your own picture, added in Glaze.', 'Add a picture in Glaze', 'Your picture'];
  for (const lang of LANGS) {
    const lines = R('targets', 'widget', `${lang}.lproj`, 'Localizable.strings').split(/\r?\n/);
    for (const k of keys) assert.ok(lines.some((l) => l.startsWith(`"${k}" = "`)), `${lang} ${k}`);
  }
});

test('the gallery tile reads no file and an empty slot is never a grey tile', () => {
  const tile = widget.slice(widget.indexOf('struct CustomSlotTile'), widget.indexOf('struct CustomArtSlotView'));
  assert.doesNotMatch(tile, /CustomArtStore|ThemeStore|UIImage/);
  const view = widget.slice(widget.indexOf('struct CustomArtSlotView'), widget.indexOf('enum CustomArtKind'));
  assert.match(view, /if entry\.preview \{\s*CustomSlotTile/);
  assert.match(view, /Text\("Add a picture in Glaze"\)/);
  assert.match(view, /GlazeBackground\(theme: t\)/);
});

test('the app section: system picker with a square crop, Replace and Remove, the Watch how video', () => {
  const pick = R('src', 'ui', 'pickCustomArtPhoto.ts');
  assert.match(pick, /launchImageLibraryAsync/);
  assert.match(pick, /allowsEditing: true/);
  assert.match(pick, /aspect: \[1, 1\]/);
  assert.doesNotMatch(pick, /request\w*PermissionsAsync/, 'no new permission request');
  const ui = R('src', 'ui', 'CustomArtSlots.tsx');
  for (const k of ['replace', 'remove', 'add', 'makeItYours', 'privacy']) assert.ok(ui.includes(`tabs.widgetsTab.custom.${k}`), k);
  assert.match(ui, /<WatchHowButton onPress=\{onWatchHow\}/);
  const tab = R('app', '(tabs)', 'widgets.tsx');
  assert.match(tab, /size === 'small' \? <CustomArtSlots onWatchHow=\{how\.open\}/);
});

test('copy names no third-party brand or character', () => {
  const banned = /godzilla|nintendo|mario|pokemon|pokémon|disney|marvel|pixar|sanrio|hello kitty|zelda/i;
  for (const lang of LANGS) {
    const strings = R('targets', 'widget', `${lang}.lproj`, 'Localizable.strings');
    const block = strings.slice(strings.indexOf('Custom 1-5'));
    assert.doesNotMatch(block, banned, lang);
    const ts = R('src', 'i18n', 'ns', 'tabs', `${lang}.ts`);
    const custom = ts.slice(ts.indexOf('custom: {'), ts.indexOf('},', ts.indexOf('custom: {')));
    assert.ok(custom.length > 50, `${lang} custom block`);
    assert.doesNotMatch(custom, banned, lang);
  }
});
