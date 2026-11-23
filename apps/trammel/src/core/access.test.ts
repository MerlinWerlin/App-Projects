// Free trial + one-time unlock (pattern from Satchel): trial maths, states, and the product ids staying in sync with
// store/IAP.md, store/listing.json and the Swift module (which takes the ids from JS).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ACCESS_SKUS, accessOf, DAY_MS, fromTransactions, mergeEntitlements, parseAccessCache, TRIAL_DAYS, TRIAL_SKU, trialDaysLeft, UNLOCK_SKU, unlockButton } from './access.ts';
import { TOOLS } from './tools.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const T0 = Date.UTC(2026, 10, 23, 9, 0);

test('product ids match the listing and IAP notes; Swift has none hard-coded', () => {
  assert.equal(TRIAL_SKU, 'com.jared797.trammel.trial7');
  assert.equal(UNLOCK_SKU, 'com.jared797.trammel.unlock');
  assert.deepEqual([...ACCESS_SKUS], [TRIAL_SKU, UNLOCK_SKU]);
  const listing = JSON.parse(read('store/listing.json'));
  assert.deepEqual(listing.inAppPurchases.map((p: { productId: string }) => p.productId), [TRIAL_SKU, UNLOCK_SKU]);
  assert.match(read('store/IAP.md'), /com\.jared797\.trammel\.unlock/);
  const swift = read('modules/trammel-store/ios/TrammelStoreModule.swift').split('\n').filter((l) => !l.trim().startsWith('//')).join(' ');
  assert.doesNotMatch(swift, /com\.jared797/);
});

test('trial days count down from 7 and never go negative', () => {
  assert.equal(TRIAL_DAYS, 7);
  assert.equal(trialDaysLeft(T0, T0), 7);
  assert.equal(trialDaysLeft(T0, T0 + DAY_MS), 6);
  assert.equal(trialDaysLeft(T0, T0 + 7 * DAY_MS), 0);
  assert.equal(trialDaysLeft(T0, T0 - 3 * DAY_MS), 7);
  assert.equal(trialDaysLeft(null, T0), 0);
});

test('states: stub, new, trial, expired, unlocked; refunds never count', () => {
  assert.equal(accessOf('stub', { unlocked: false, trialStart: null }, T0).canEdit, true);
  assert.equal(accessOf('store', { unlocked: false, trialStart: null }, T0).state, 'new');
  assert.equal(accessOf('store', { unlocked: false, trialStart: T0 }, T0 + DAY_MS).state, 'trial');
  assert.equal(accessOf('store', { unlocked: false, trialStart: T0 }, T0 + 8 * DAY_MS).canEdit, false);
  assert.equal(accessOf('store', { unlocked: true, trialStart: null }, T0).state, 'unlocked');
  const e = fromTransactions([{ productId: UNLOCK_SKU, purchaseDate: T0, revoked: true }, { productId: TRIAL_SKU, purchaseDate: T0 }]);
  assert.deepEqual(e, { unlocked: false, trialStart: T0 });
  assert.deepEqual(mergeEntitlements(null, parseAccessCache(JSON.stringify({ unlocked: true, trialStart: null, checkedAt: 1 }))), { unlocked: true, trialStart: null });
  assert.equal(parseAccessCache('{bad'), null);
  assert.deepEqual(unlockButton(' A$4.99 '), { enabled: true, price: 'A$4.99' });
  assert.deepEqual(unlockButton(''), { enabled: false, price: null });
});

test('the always-free tools are the ones the paywall copy promises', () => {
  assert.deepEqual(TOOLS.filter((t) => t.free).map((t) => t.id).sort(), ['convert', 'mitre', 'pitch', 'square']);
});

test('no build profile turns on the capture-only store stub', () => {
  assert.doesNotMatch(read('eas.json'), /EXPO_PUBLIC_TRAMMEL_CAPTURE/);
  assert.doesNotMatch(read('app.json'), /EXPO_PUBLIC_TRAMMEL_CAPTURE/);
});
