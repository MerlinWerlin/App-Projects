import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeWidgetSupported, requiredNativeWidgetVersion} from './widgetDelivery.ts';
import {CATALOGUE_KIND_SIZES} from './widgetKinds.ts';

test('habit native sizes match the editor, including only the supported Lock Screen formats', () => {
  for (const kind of ['habitWater', 'habitSleep', 'habitSteps', 'habitMood'] as const) {
    for (const size of CATALOGUE_KIND_SIZES[kind]) assert.ok(nativeWidgetSupported(kind, size), `${kind}/${size}`);
    assert.equal(nativeWidgetSupported(kind, 'large'), false);
    assert.equal(nativeWidgetSupported(kind, 'standby'), false);
  }
  assert.equal(nativeWidgetSupported('habitMood', 'accessoryInline'), false);
  assert.equal(nativeWidgetSupported('photoAlbum', 'small'), true);
});

test('older v2 builds keep Home Screen habits but require an update for new Lock Screen readouts', () => {
  for (const kind of ['habitWater', 'habitSleep', 'habitSteps', 'habitMood'] as const) {
    for (const size of CATALOGUE_KIND_SIZES[kind]) {
      const required = requiredNativeWidgetVersion(kind, size);
      assert.equal(2 >= required, !size.startsWith('accessory'), `${kind}/${size}: v2`);
      assert.ok(3 >= required, `${kind}/${size}: v3`);
    }
  }
  assert.equal(requiredNativeWidgetVersion('clock', 'small'), 2);
  const bridge = readFileSync('modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift', 'utf8');
  assert.match(bridge, /AsyncFunction\("widgetDesignVersion"\)\s*\{\s*\(\)\s*->\s*Int\s+in\s+5\s*\}/);
  const studio = readFileSync('app/widget-studio.tsx', 'utf8');
  assert.match(studio, /await widgets\.designVersion\(\) < Math.max\(requiredNativeWidgetVersion\(/);
});

test('Lock Screen habits expose readouts and the app logging link without embedded tap buttons', () => {
  const src = readFileSync('targets/widget/HabitAccessory.swift', 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /Button\s*\(/);
  // Check the URL before stripping // comments, because a scheme contains two slashes.
  assert.ok(readFileSync('targets/widget/HabitAccessory.swift', 'utf8').includes('glaze://widgets'));
  assert.match(src, /\.accessibilityValue\(Text\(spokenValue\)\)/);
});
