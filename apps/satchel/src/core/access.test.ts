// 1.0.0 free trial + one-time unlock: the trial-days maths, the entitlement states, the read-only rules after the
// trial, and the wiring that keeps viewing and received trip files open.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import {
  ACCESS_SKUS,
  accessOf,
  ALWAYS_ALLOWED,
  DAY_MS,
  fromTransactions,
  mergeEntitlements,
  parseAccessCache,
  TRIAL_DAYS,
  TRIAL_SKU,
  trialDaysLeft,
  UNLOCK_SKU,
  unlockButton,
} from './access.ts';
import { isTransientKey } from './backup.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const T0 = Date.UTC(2026, 10, 15, 9, 0);
const HOUR = 60 * 60 * 1000;

test('product ids match store/IAP.md and the Swift module takes them from JS', () => {
  assert.equal(TRIAL_SKU, 'com.jared797.satchel.trial7');
  assert.equal(UNLOCK_SKU, 'com.jared797.satchel.unlock');
  assert.deepEqual([...ACCESS_SKUS], [TRIAL_SKU, UNLOCK_SKU]);
  const iap = read('store/IAP.md');
  assert.match(iap, /com\.jared797\.satchel\.trial7/);
  assert.match(iap, /com\.jared797\.satchel\.unlock/);
  const swiftCode = read('modules/satchel-store/ios/SatchelStoreModule.swift')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join(' ');
  assert.doesNotMatch(swiftCode, /com\.jared797/);
});

test('trial days: 7 minus whole days since the trial started, clamped to 0..7', () => {
  assert.equal(TRIAL_DAYS, 7);
  assert.equal(trialDaysLeft(T0, T0), 7);
  assert.equal(trialDaysLeft(T0, T0 + 23 * HOUR), 7);
  assert.equal(trialDaysLeft(T0, T0 + DAY_MS), 6);
  assert.equal(trialDaysLeft(T0, T0 + 6 * DAY_MS + 23 * HOUR), 1);
  assert.equal(trialDaysLeft(T0, T0 + 7 * DAY_MS), 0);
  assert.equal(trialDaysLeft(T0, T0 + 400 * DAY_MS), 0);
  // a clock set back before the start never gives more than 7
  assert.equal(trialDaysLeft(T0, T0 - 3 * DAY_MS), 7);
  // no start, or nonsense, is no trial
  assert.equal(trialDaysLeft(null, T0), 0);
  assert.equal(trialDaysLeft(Number.NaN, T0), 0);
});

test('the trial start comes from the trial transaction, so a reinstall never resets it', () => {
  const e = fromTransactions([{ productId: TRIAL_SKU, purchaseDate: T0, revoked: false }]);
  assert.deepEqual(e, { unlocked: false, trialStart: T0 });
  // a fresh install reads the same transaction: same start, same days left
  const later = T0 + 3 * DAY_MS;
  assert.equal(accessOf('store', fromTransactions([{ productId: TRIAL_SKU, purchaseDate: T0 }]), later).daysLeft, 4);
  // the earliest trial transaction wins
  assert.equal(fromTransactions([{ productId: TRIAL_SKU, purchaseDate: T0 + DAY_MS }, { productId: TRIAL_SKU, purchaseDate: T0 }]).trialStart, T0);
});

test('entitlements: revoked (refunded) items never count; junk never throws', () => {
  assert.deepEqual(fromTransactions([{ productId: UNLOCK_SKU, purchaseDate: T0, revoked: true }]), { unlocked: false, trialStart: null });
  assert.deepEqual(fromTransactions([{ productId: UNLOCK_SKU, purchaseDate: T0 }, { productId: 'other', purchaseDate: 1 }]), { unlocked: true, trialStart: null });
  for (const junk of [null, undefined, 'x', 3, {}, [null, 1, 'a', { productId: TRIAL_SKU, purchaseDate: 'soon' }]]) {
    assert.deepEqual(fromTransactions(junk), { unlocked: false, trialStart: null });
  }
});

test('states: new, trial active, trial expired, unlocked, and a build without StoreKit', () => {
  const none = { unlocked: false, trialStart: null };
  assert.deepEqual(accessOf('store', none, T0), { state: 'new', daysLeft: 7, canEdit: false, canShare: false });
  assert.deepEqual(accessOf('store', { unlocked: false, trialStart: T0 }, T0 + 2 * DAY_MS), { state: 'trial', daysLeft: 5, canEdit: true, canShare: true });
  assert.deepEqual(accessOf('store', { unlocked: false, trialStart: T0 }, T0 + 7 * DAY_MS), { state: 'expired', daysLeft: 0, canEdit: false, canShare: false });
  assert.deepEqual(accessOf('store', { unlocked: true, trialStart: T0 }, T0 + 90 * DAY_MS), { state: 'unlocked', daysLeft: 0, canEdit: true, canShare: true });
  assert.deepEqual(accessOf('store', { unlocked: true, trialStart: null }, T0), { state: 'unlocked', daysLeft: 0, canEdit: true, canShare: true });
  assert.equal(accessOf('stub', none, T0).canEdit, true);
});

test('read-only after the trial: viewing, received trip files and backups always stay open', () => {
  assert.deepEqual({ ...ALWAYS_ALLOWED }, { view: true, openReceivedTrip: true, backup: true });
  // the trip file import path (Open in -> app/openin -> importTripText) is never wrapped by the paywall
  const openin = read('app/openin/index.tsx');
  assert.match(openin, /importTripText/);
  assert.doesNotMatch(openin, /RequireUnlock|useAccess|useShareGate/);
  assert.doesNotMatch(read('src/state/tripTransfer.ts'), /RequireUnlock|useAccess/);
  // viewing screens are never gated
  for (const f of ['app/(tabs)/index.tsx', 'app/(tabs)/schedule.tsx', 'app/(tabs)/wallet.tsx', 'app/(tabs)/emergency.tsx', 'app/(tabs)/map.tsx', 'app/trip/[id].tsx', 'app/ticket/[id].tsx', 'app/vault.tsx', 'app/backup.tsx']) {
    assert.doesNotMatch(read(f), /RequireUnlock/, f);
  }
});

test('read-only after the trial: every create / edit screen is wrapped, and sharing out asks first', () => {
  for (const f of ['app/trip-edit.tsx', 'app/item-edit.tsx', 'app/plan-edit.tsx', 'app/itinerary.tsx', 'app/paste-booking.tsx', 'app/openin/add.tsx']) {
    const src = read(f);
    assert.match(src, /export default function Gated\w+\(\) \{\n {2}return \(\n {4}<RequireUnlock>/, f);
    assert.equal((src.match(/export default/g) ?? []).length, 1, f);
  }
  assert.match(read('src/ui/ShareItinerary.tsx'), /const show = \(\) => \{\n {4}if \(!shareOk\(\)\) return;/);
  assert.match(read('src/ui/TripExport.tsx'), /if \(!shareOk\(\)\) return;/);
  const gate = read('src/ui/RequireUnlock.tsx');
  assert.match(gate, /a\.canEdit/);
  assert.match(gate, /a\.canShare/);
});

test('paywall: StoreKit displayPrice only, no hard-coded price; one-time wording, restore and privacy link', () => {
  assert.deepEqual(unlockButton('A$2.99'), { enabled: true, price: 'A$2.99' });
  assert.deepEqual(unlockButton(null), { enabled: false, price: null });
  assert.deepEqual(unlockButton('  '), { enabled: false, price: null });
  const strings = Object.entries(en).filter(([k]) => k.startsWith('access.'));
  for (const [k, v] of strings) assert.doesNotMatch(String(v), /\$\s?\d|\d[.,]\d\d|AUD|USD/, k);
  assert.equal(en['access.oneTime'], 'One-time purchase. No subscription.');
  const pw = read('src/ui/Paywall.tsx');
  assert.match(pw, /displayPrice/);
  assert.match(pw, /access\.tryAgain/);
  assert.match(pw, /restorePurchases/);
  assert.match(pw, /PRIVACY_URL/);
  assert.match(pw, /access\.oneTime/);
  // the trial is started by the person, never automatically
  assert.doesNotMatch(read('src/state/access.ts'), /buy\(TRIAL_SKU\)|purchase\(TRIAL_SKU\)/);
});

test('cache: StoreKit wins; offline the last answer stands; the cache is never put in a backup', () => {
  const cache = parseAccessCache(JSON.stringify({ unlocked: false, trialStart: T0, checkedAt: T0 }));
  assert.deepEqual(cache, { unlocked: false, trialStart: T0, checkedAt: T0 });
  assert.deepEqual(mergeEntitlements(null, cache), { unlocked: false, trialStart: T0 });
  assert.deepEqual(mergeEntitlements({ unlocked: true, trialStart: null }, cache), { unlocked: true, trialStart: null });
  assert.deepEqual(mergeEntitlements(null, null), { unlocked: false, trialStart: null });
  for (const bad of [null, '', '{', '[]', '{"unlocked":"yes"}']) assert.equal(parseAccessCache(bad), null);
  assert.equal(isTransientKey('satchel.access.v1'), true);
});

test('the store module is autolinked in store builds (package.json does not turn local modules off)', () => {
  const pkg = JSON.parse(read('package.json')) as { expo?: { autolinking?: { nativeModulesDir?: string } } };
  const dir = pkg.expo?.autolinking?.nativeModulesDir ?? './modules';
  assert.equal(dir, './modules');
  assert.match(read('modules/satchel-store/expo-module.config.json'), /SatchelStoreModule/);
  assert.match(read('modules/satchel-store/ios/SatchelStoreModule.swift'), /Name\("SatchelStore"\)/);
  assert.doesNotMatch(read('modules/satchel-store/ios/SatchelStoreModule.swift'), /[^.]\bTransaction\.(updates|currentEntitlements|all)\b/);
});

test('the capture-only flag is never set by a store build profile', () => {
  assert.doesNotMatch(read('eas.json'), /SATCHEL_CAPTURE/);
  assert.doesNotMatch(read('app.json'), /SATCHEL_CAPTURE/);
  assert.match(read('src/native/store.ts'), /process\.env\.EXPO_PUBLIC_SATCHEL_CAPTURE === '1'/);
});
