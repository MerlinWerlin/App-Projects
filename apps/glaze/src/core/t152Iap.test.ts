// T152 (owner, 25 Oct): Glaze Plus is purchasable at A$2.99 one-time in the TestFlight build through
// a local StoreKit 2 Expo module. Behaviour tests for the pure flow plus source guards (the cloud
// can't compile Swift).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLUS_SKU,
  STORE_MODULE,
  buyPlus,
  parseEntitlementEvent,
  parseProduct,
  parsePurchase,
  priceText,
  resolveOwned,
  shortCode,
  type StoreKitLike,
  type StorePurchase,
} from './plusStoreKit.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const SWIFT = join('modules', 'glaze-store', 'ios', 'GlazeStoreModule.swift');
/** Swift without // comments, so guards match code, not prose. */
const swift = () => read(SWIFT).replace(/\/\/[^\n]*/g, '');

test('T152: one product id, non-consumable, used by JS and the docs', () => {
  assert.equal(PLUS_SKU, 'com.jared797.glaze.plus');
  assert.match(read('src', 'plus', 'entitlement.ts'), /export const PLUS_PRODUCT_ID = PLUS_SKU;/);
  const doc = read('docs', 'IAP_SANDBOX.md');
  assert.ok(doc.includes(`\`${PLUS_SKU}\``) && doc.includes(`**${PLUS_SKU}**`), 'doc names the id');
  assert.match(doc, /Non-Consumable/);
  assert.match(doc, /A\$2\.99/);
  assert.match(doc, /Paid Applications Agreement/);
  assert.match(doc, /https:\/\/developer\.apple\.com\//);
  // Swift never hard-codes a product id: JS passes PLUS_SKU in.
  assert.doesNotMatch(swift(), /com\.jared797/);
  // No other product id string anywhere in app code.
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'app'))].filter((f) => !/\.test\.ts$/.test(f));
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/com\.jared797\.glaze\.[\w.]+/g)) {
      assert.ok(m[0] === PLUS_SKU || !/plus/i.test(m[0]), `${f}: ${m[0]}`);
    }
  }
});

test('T152: the module is a StoreKit 2 Expo module of its own', () => {
  const cfg = JSON.parse(read('modules', 'glaze-store', 'expo-module.config.json')) as { platforms: string[]; apple: { modules: string[] } };
  assert.deepEqual(cfg.platforms, ['apple']);
  assert.deepEqual(cfg.apple.modules, ['GlazeStoreModule']);
  const spec = read('modules', 'glaze-store', 'ios', 'GlazeStore.podspec');
  assert.match(spec, /s\.name\s*=\s*'GlazeStore'/);
  assert.match(spec, /s\.platforms\s*=\s*\{ :ios => '15\.1' \}/, 'iOS 15.1 like the app (StoreKit 2 needs 15.0)');
  assert.match(spec, /s\.frameworks = 'StoreKit'/);
  assert.equal((spec.match(/s\.dependency/g) ?? []).length, 1);
  assert.match(spec, /s\.dependency 'ExpoModulesCore'/);
  const src = swift();
  assert.match(src, /public class GlazeStoreModule: Module \{/);
  assert.match(src, new RegExp(`Name\\("${STORE_MODULE}"\\)`));
  assert.doesNotMatch(src, /(class|struct|enum)\s+GlazeStore\s*[{:]/, 'no type named like the module');
  assert.match(src, /import StoreKit/);
  assert.doesNotMatch(src, /SKPaymentQueue|SKProductsRequest|appStoreReceiptURL/, 'StoreKit 2 only');
  for (const [what, re] of [
    ['Product.products', /try await Product\.products\(for: \[id\]\)/],
    ['purchase()', /try await product\.purchase\(\)/],
    ['finish()', /await transaction\.finish\(\)/],
    ['currentEntitlements', /for await entitlement in Transaction\.currentEntitlements/],
    ['AppStore.sync', /try await AppStore\.sync\(\)/],
    ['Transaction.updates', /for await update in Transaction\.updates/],
    ['verified only', /case \.verified\(let transaction\)/],
    ['revocation', /revocationDate == nil/],
    ['userCancelled', /case \.userCancelled:/],
    ['pending', /case \.pending:/],
    ['event', /Events\("onEntitlementChange"\)/],
    ['listener on create', /OnCreate \{\s*self\.startUpdatesListener\(\)/],
  ] as const) {
    assert.match(src, re, what);
  }
  for (const fn of ['isAvailable', 'getProduct', 'purchase', 'isOwned', 'restore']) {
    assert.match(src, new RegExp(`AsyncFunction\\("${fn}"\\)`), fn);
  }
  // Every promise-taking function settles from inside a Task (never left hanging).
  for (const m of src.matchAll(/AsyncFunction\("(\w+)"\) \{ \(id: String, promise: Promise\) in\s*\n\s*Task \{/g)) assert.ok(m[1]);
  assert.equal((src.match(/promise: Promise\) in\s*\n\s*Task \{/g) ?? []).length, 4);
  // No Android implementation: the adapter reports unavailable there.
  assert.ok(!existsSync(join(root, 'modules', 'glaze-store', 'android')));
});

test('T152: adapter loads the module optionally, iOS only, and never throws', () => {
  const a = read('src', 'native', 'store.ts');
  // (pattern split so src/core's "no Expo imports" guard doesn't read this test as an import)
  assert.match(a, new RegExp(`import \\{ requireOptionalNativeModule \\} from '${'ex' + 'po'}';`));
  assert.match(a, /requireOptionalNativeModule<NativeStore>\(STORE_MODULE\)/);
  assert.match(a, /Platform\.OS === 'ios' && !isExpoGo\(\)/);
  assert.doesNotMatch(a, /throw /);
  assert.doesNotMatch(a, /(^|\/)plus(\/|')/m, 'src/native knows nothing about the entitlement');
  assert.doesNotMatch(a, /fetch\(|XMLHttpRequest|analytics/i);
});

test('T152: Plus uses the real store where the module exists, the mock elsewhere', () => {
  const ent = read('src', 'plus', 'entitlement.ts');
  assert.match(ent, /glazeStore\.available\(\)\s*\?\s*createStoreKitPlusStore\(glazeStore, \(v\) => notify\(v\), PLUS_PRODUCT_ID\)\s*:\s*createMockPlusStore\(DEV\)/);
  const store = read('src', 'plus', 'iapStore.ts');
  assert.match(store, /export function createStoreKitPlusStore\(/);
  assert.match(store, /purchasable: true/);
  assert.match(store, /if \(!r\.ok\) throw new Error\(r\.code\)/, 'restore failure reaches restoreFailed');
});

test('T152: a native build with the store never shows the test-version line', () => {
  const sheet = read('src', 'plus', 'PlusLockSheet.tsx');
  // The only branches that show plus.lock.unavailable are the mock result and the catch for the mock.
  assert.match(sheet, /if \(PLUS_PURCHASABLE\) \{[\s\S]*?showFailed\('unknown'\);[\s\S]*?\} else \{\s*setMessage\(t\('plus\.lock\.unavailable'\)\)/);
  assert.match(sheet, /else if \(res === 'unavailable'\)/);
  // The mock is the only store that returns 'unavailable'.
  assert.doesNotMatch(read('src', 'plus', 'iapStore.ts'), /'unavailable'/);
  assert.match(sheet, /PLUS_PURCHASABLE \? t\('plus\.lock\.unlockBuy', \{ price \}\) : t\('plus\.lock\.unlock'\)/);
  assert.match(sheet, /PLUS_PURCHASABLE \? t\('plus\.lock\.buyHint'\) : t\('plus\.lock\.unlockHint'\)/);
  assert.match(sheet, /t\('plus\.lock\.price', \{ price \}\)/);
  assert.match(sheet, /res === 'pending'/);
  // Cancel stays silent: no branch for it.
  assert.doesNotMatch(sheet, /res === 'cancelled'/);
  const en = read('src', 'i18n', 'ns', 'plus', 'en.ts');
  for (const k of ['unlockBuy', 'buyHint', 'pending']) assert.match(en, new RegExp(`\\b${k}: `), k);
  for (const p of ['src/plus/iapStore.ts', 'src/native/store.ts', 'src/core/plusStoreKit.ts', SWIFT]) {
    assert.doesNotMatch(read(p), /arrives with the store release|Buying opens with the App Store release/, p);
  }
});

test('T152: no npm IAP package, and the photo permission talks about Live Photos', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const n of ['expo-iap', 'react-native-iap', 'react-native-purchases', 'expo-in-app-purchases']) assert.equal(n in deps, false, n);
  const app = read('app.json');
  assert.doesNotMatch(app, /lock screen loops/);
  assert.match(app, /"NSPhotoLibraryUsageDescription": "[^"]*Live Photos/);
  assert.doesNotMatch(read('app.config.ts'), /lock screen loops/);
});

// ------------------------------------------------------------------ pure flow

test('parsePurchase and parseProduct normalise whatever the module returns', () => {
  assert.deepEqual(parsePurchase({ status: 'purchased' }), { status: 'purchased' });
  assert.deepEqual(parsePurchase({ status: 'cancelled' }), { status: 'cancelled' });
  assert.deepEqual(parsePurchase({ status: 'pending' }), { status: 'pending' });
  assert.deepEqual(parsePurchase({ status: 'failed', code: 'product-not-found', message: 'm' }), {
    status: 'failed',
    code: 'product-not-found',
    message: 'm',
  });
  assert.deepEqual(parsePurchase(null), { status: 'failed', code: 'bad-result' });
  assert.deepEqual(parsePurchase({ status: 'weird' }), { status: 'failed', code: 'bad-result' });
  assert.equal(shortCode('a b<c>'), 'a-b-c-');
  assert.equal(shortCode(''), 'unknown');
  assert.equal(shortCode('x'.repeat(99)).length, 40);
  const p = parseProduct({ id: PLUS_SKU, displayPrice: 'A$2.99', displayName: 'Glaze Plus' }, PLUS_SKU);
  assert.deepEqual(p, { id: PLUS_SKU, displayPrice: 'A$2.99', displayName: 'Glaze Plus' });
  assert.equal(parseProduct({ id: 'other', displayPrice: '$1' }, PLUS_SKU), null);
  assert.equal(parseProduct({ id: PLUS_SKU }, PLUS_SKU), null);
  assert.equal(parseProduct(null, PLUS_SKU), null);
  assert.equal(priceText(null, 'A$2.99'), 'A$2.99');
  assert.equal(priceText({ id: PLUS_SKU, displayPrice: '2,99 €', displayName: '' }, 'A$2.99'), '2,99 €');
});

function fake(result: StorePurchase | Error, owned: boolean | null): StoreKitLike & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async purchase(id) {
      calls.push(`purchase:${id}`);
      if (result instanceof Error) throw result;
      return result;
    },
    async isOwned(id) {
      calls.push(`owned:${id}`);
      return owned;
    },
  };
}

test('buyPlus: success, cancel and pending pass through without a re-check', async () => {
  for (const s of ['purchased', 'cancelled', 'pending'] as const) {
    const f = fake({ status: s }, true);
    assert.deepEqual(await buyPlus(f, PLUS_SKU), { status: s });
    assert.deepEqual(f.calls, [`purchase:${PLUS_SKU}`]);
  }
});

test('buyPlus: a failure is re-checked; already owned unlocks, otherwise the store code stays', async () => {
  const owned = fake({ status: 'failed', code: 'purchase-error' }, true);
  assert.deepEqual(await buyPlus(owned, PLUS_SKU), { status: 'purchased' });
  const not = fake({ status: 'failed', code: 'product-not-found' }, false);
  assert.deepEqual(await buyPlus(not, PLUS_SKU), { status: 'failed', code: 'product-not-found' });
  const thrown = fake(Object.assign(new Error('x'), { code: 'ERR_BRIDGE' }), null);
  assert.deepEqual(await buyPlus(thrown, PLUS_SKU), { status: 'failed', code: 'ERR_BRIDGE' });
});

test('resolveOwned: StoreKit wins, the cache only fills in when StoreKit cannot be asked', () => {
  assert.equal(resolveOwned(true, false), true);
  assert.equal(resolveOwned(false, true), false);
  assert.equal(resolveOwned(null, true), true);
  assert.equal(resolveOwned(null, false), false);
});

test('entitlement events only count for the Plus product', () => {
  assert.equal(parseEntitlementEvent({ productId: PLUS_SKU, owned: true }, PLUS_SKU), true);
  assert.equal(parseEntitlementEvent({ productId: PLUS_SKU, owned: false }, PLUS_SKU), false);
  assert.equal(parseEntitlementEvent({ productId: 'tip.small', owned: true }, PLUS_SKU), null);
  assert.equal(parseEntitlementEvent({ productId: PLUS_SKU }, PLUS_SKU), null);
  assert.equal(parseEntitlementEvent(null, PLUS_SKU), null);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}
