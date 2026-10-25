// TestFlight readiness of the app config (owner brief 25 Oct 2026: ship straight to TestFlight).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const app = read('app.json').expo;
const eas = read('eas.json');

test('bundle id, owner and version are set for the first store build', () => {
  assert.equal(app.ios.bundleIdentifier, 'com.jared797.satchel');
  assert.equal(app.android.package, 'com.jared797.satchel');
  assert.equal(app.owner, 'jared797');
  assert.match(app.version, /^\d+\.\d+\.\d+$/);
});

test('every iOS permission the linked modules can touch has a purpose string', () => {
  for (const k of ['NSLocationWhenInUseUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription', 'NSFaceIDUsageDescription', 'NSContactsUsageDescription']) {
    assert.ok(typeof app.ios.infoPlist[k] === 'string' && app.ios.infoPlist[k].length > 20, k);
  }
  assert.equal(app.ios.config.usesNonExemptEncryption, false);
});

test('privacy manifest declares no tracking and no collected data', () => {
  const m = app.ios.privacyManifests;
  assert.equal(m.NSPrivacyTracking, false);
  assert.deepEqual(m.NSPrivacyCollectedDataTypes, []);
  assert.ok(m.NSPrivacyAccessedAPITypes.length >= 1);
});

test('eas has production profiles and an iOS submit slot waiting only for the App Store Connect id', () => {
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.ok(eas.build['production-native']);
  assert.ok(eas.submit.production.ios);
  const draft = read('ops/onboarding/RELEASE.draft.json');
  assert.equal(draft.bundleId, app.ios.bundleIdentifier);
  assert.equal(draft.ascAppId, null);
});
