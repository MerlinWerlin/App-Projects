const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../apps/backspin/app.json').expo;
const profiles = require('../../apps/backspin/eas.json');
const variant = require('../../apps/backspin/ops/play-variant.cjs');

test('default configuration preserves the existing iOS submission', () => {
  assert.equal(variant(app, {}), app);
  assert.equal(app.ios.bundleIdentifier, 'com.jared797.backspin');
  assert.equal(profiles.build.production.channel, 'production');
  assert.equal(profiles.submit.production.ios, undefined);
});

test('standalone preview has separate storage identity and embedded code', () => {
  const c = variant(app, { PLAY_VARIANT: 'preview', EAS_BUILD_PLATFORM: 'android' });
  assert.equal(c.android.package, 'com.jared797.backspin.playtest');
  assert.equal(c.updates.enabled, false);
  assert.equal(c.scheme, 'backspin-play-test');
  assert.equal(profiles.build['play-preview'].android.buildType, 'apk');
});

test('production keeps the stable package and uses the AAB profile', () => {
  const c = variant(app, { PLAY_VARIANT: 'production', EAS_BUILD_PLATFORM: 'android' });
  assert.equal(c.android.package, 'com.jared797.backspin');
  assert.equal(c.name, 'Backspin');
  assert.equal(c.android.versionCode, 3);
  assert.equal(c.updates.enabled, false);
  assert.deepEqual(c.platforms, ['android']);
  assert.equal(profiles.build['play-production'].android.buildType, 'app-bundle');
  assert.equal(profiles.build['play-production'].distribution, 'store');
  assert.equal(profiles.build['play-production'].autoIncrement, true);
  for (const p of ['SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'FOREGROUND_SERVICE']) {
    assert.ok(c.android.blockedPermissions.includes('android.permission.' + p));
  }
});

test('invalid profile/platform combinations stop before a build', () => {
  assert.throws(() => variant(app, { PLAY_VARIANT: 'unknown' }));
  assert.throws(() => variant(app, { PLAY_VARIANT: 'production', EAS_BUILD_PLATFORM: 'ios' }));
  assert.throws(() => variant(app, { PLAY_VARIANT: 'production', EXPO_GO_PREVIEW: '1' }));
});

test('Play audio configuration excludes unused background services without altering iOS', () => {
  const configure = require('../../apps/backspin/app.config.js');
  const previous = process.env.PLAY_VARIANT;
  try {
    delete process.env.PLAY_VARIANT;
    assert.equal(configure({ config: app }), app);
    process.env.PLAY_VARIANT = 'production';
    const c = configure({ config: app });
    const audio = c.plugins.find(p => Array.isArray(p) && p[0] === 'expo-audio')[1];
    assert.equal(audio.enableBackgroundPlayback, false);
    assert.equal(audio.enableBackgroundRecording, false);
    assert.equal(app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-audio')[1].enableBackgroundPlayback, undefined);
  } finally {
    if (previous === undefined) delete process.env.PLAY_VARIANT;
    else process.env.PLAY_VARIANT = previous;
  }
});
