// Release configuration guards: the things that broke other App Factory releases.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TRIAL_PRODUCT_ID } from './plus/trial.ts';
import { UNLOCK_AUSTRALIA_PRICE, UNLOCK_PRODUCT_ID } from './plus/entitlement.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const app = json('../app.json').expo;
const pkg = json('../package.json');
const eas = json('../eas.json');
const listing = json('../store/listing.json');
const release = json('../RELEASE.json');

test('bundle id, encryption answer and no over-the-air updates (Guideline 5.6)', () => {
  assert.equal(app.ios.bundleIdentifier, 'com.jared797.rootpass');
  assert.equal(app.ios.infoPlist.ITSAppUsesNonExemptEncryption, false);
  assert.equal(pkg.dependencies['expo-updates'], undefined);
  assert.equal(app.updates, undefined);
  assert.equal(app.runtimeVersion, undefined);
  assert.ok(app.plugins.includes('../../scripts/expo-plugins/withSceneLifecycle.js'), 'UIScene life cycle (iOS 27)');
});

test('expo-iap pinned to an exact version', () => {
  assert.match(pkg.dependencies['expo-iap'], /^\d+\.\d+\.\d+$/);
});

test('store capture flag never reaches a build profile', () => {
  assert.ok(!JSON.stringify(eas).includes('ROOTPASS_CAPTURE'));
});

test('purchase ids and price match the listing', () => {
  const ids = listing.inAppPurchases.map((i: { productId: string }) => i.productId);
  assert.deepEqual(ids, [UNLOCK_PRODUCT_ID, TRIAL_PRODUCT_ID]);
  assert.equal(`A$${listing.inAppPurchases[0].price.amount}`, UNLOCK_AUSTRALIA_PRICE);
  assert.equal(listing.inAppPurchases[1].price.amount, '0.00');
  assert.equal(listing.inAppPurchases[1].displayName, '7-day Trial');
});

test('App Store Connect id in step everywhere; version matches', () => {
  assert.equal(release.ascAppId, eas.submit.production.ios.ascAppId);
  assert.equal(listing.version, app.version);
});
