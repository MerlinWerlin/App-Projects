const { test } = require('node:test');
const assert = require('node:assert/strict');
const withPlayVariant = require('../ops/play-variant.cjs');
const withoutScanners = require('../ops/with-play-camera.cjs');
const base = () => ({ name: 'Cue', version: '1.0.0', android: { package: 'com.jared797.cue' }, plugins: [['expo-camera', { recordAudioAndroid: true }]], updates: { enabled: true } });

test('ordinary profiles retain the exact original object and iOS Play builds fail closed', () => {
  const config = base();
  assert.strictEqual(withPlayVariant(config, {}), config);
  assert.throws(() => withPlayVariant(config, { PLAY_VARIANT: 'production', EAS_BUILD_PLATFORM: 'ios' }));
});
test('both Play profiles exclude unused scanners while preserving camera/audio and input config', async () => {
  for (const variant of ['preview', 'production']) {
    const config = base(), before = JSON.stringify(config);
    const result = withPlayVariant(config, { PLAY_VARIANT: variant, EAS_BUILD_PLATFORM: 'android' });
    assert.deepEqual(result.plugins[0], ['expo-camera', { recordAudioAndroid: true, barcodeScannerEnabled: false }]);
    assert.ok(result.plugins.includes('./ops/with-play-camera.cjs'));
    const modified = withoutScanners({ ...result });
    const props = await modified.mods.android.gradleProperties({ ...modified, modResults: [
      { type: 'property', key: 'unrelated.setting', value: 'keep' },
      { type: 'property', key: 'expo.camera.document-scanner-enabled', value: 'true' },
    ], modRequest: { introspect: true } });
    assert.deepEqual(props.modResults, [
      { type: 'property', key: 'unrelated.setting', value: 'keep' },
      { type: 'property', key: 'expo.camera.document-scanner-enabled', value: 'false' },
    ]);
    assert.equal(JSON.stringify(config), before);
  }
});
