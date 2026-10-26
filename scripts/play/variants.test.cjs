const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const apps = ['linework','couch','glaze','cue','backspin','crochet','satchel'];
const packages = new Set();
for (const app of apps) {
  const folder = path.join(root, 'apps', app);
  const base = JSON.parse(fs.readFileSync(path.join(folder, 'app.json'))).expo;
  const eas = JSON.parse(fs.readFileSync(path.join(folder, 'eas.json')));
  const overlay = require(path.join(folder, 'ops/play-variant.cjs'));
  test(app + ': existing configuration stays identical without the Play flag', () => {
    assert.equal(overlay(base, {}), base);
    assert.equal(overlay(base, { EAS_BUILD_PLATFORM: 'ios' }), base);
  });
  test(app + ': preview and store installs have distinct identities; iOS identity survives', () => {
    const before = JSON.stringify(base);
    const preview = overlay(base, { PLAY_VARIANT: 'preview', EAS_BUILD_PLATFORM: 'android' });
    const store = overlay(base, { PLAY_VARIANT: 'production', EAS_BUILD_PLATFORM: 'android' });
    for (const c of [preview, store]) {
      assert.match(c.android.package, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
      assert.ok(!packages.has(c.android.package), 'duplicate package: '+c.android.package);
      packages.add(c.android.package);
      assert.deepEqual(c.ios, base.ios);
      assert.deepEqual(c.android.adaptiveIcon, base.android.adaptiveIcon);
      assert.deepEqual(c.plugins, base.plugins);
      assert.deepEqual(c.platforms, ['android']);
      assert.equal(c.updates.enabled, false);
      assert.equal(c.extra.eas?.projectId, base.extra?.eas?.projectId);
    }
    assert.equal(store.android.package, base.android.package);
    assert.equal(preview.android.package, base.android.package+'.playtest');
    assert.notEqual(preview.name, store.name);
    assert.notEqual(preview.scheme, store.scheme);
    assert.equal(JSON.stringify(base), before, 'overlay mutated the iOS/base config');
  });
  test(app + ': wrong platform, unknown variant and Expo Go cannot silently enter a Play build', () => {
    assert.throws(() => overlay(base, {PLAY_VARIANT:'prod'}), /Unknown/);
    assert.throws(() => overlay(base, {PLAY_VARIANT:'preview',EAS_BUILD_PLATFORM:'ios'}), /Android-only/);
    assert.throws(() => overlay(base, {PLAY_VARIANT:'preview',EXPO_GO_PREVIEW:'1'}), /EXPO_GO_PREVIEW/);
  });
  test(app + ': APK and AAB profiles select explicit variants, channels and environments', () => {
    for (const v of ['preview','production']) {
      const p = eas.build['play-'+v];
      assert.equal(p.env.PLAY_VARIANT, v);
      assert.equal(p.channel, 'play-'+v);
      assert.equal(p.environment, v);
      assert.equal(p.android.buildType, v==='preview' ? 'apk' : 'app-bundle');
      assert.equal(overlay(base,p.env).updates.requestHeaders['expo-channel-name'], p.channel);
      assert.equal(p.ios, undefined);
      assert.equal(eas.submit?.['play-'+v], undefined);
    }
    assert.equal(eas.build['play-production'].autoIncrement, true);
  });
  test(app + ': draft store text respects Play text limits and is not marked released', () => {
    const listing=JSON.parse(fs.readFileSync(path.join(folder,'store/play-listing.json')));
    assert.equal(listing.status,'draft_not_uploaded');
    assert.ok(listing.title.length<=30);
    assert.ok(listing.shortDescription.length<=80);
    assert.ok(listing.fullDescription.length<=4000);
    assert.ok(listing.releaseBlockers.length>0);
  });
}
test('Glaze Android native hook exits without installing Apple build tooling', () => {
  const result=spawnSync(process.execPath, [path.join(root,'apps/glaze/scripts/eas-native-deps.js')], {
    env:{...process.env,GLAZE_NATIVE:'1',PLAY_VARIANT:'preview',EAS_BUILD_PLATFORM:'android'},encoding:'utf8'
  });
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Apple widget tooling is not required/);
});
