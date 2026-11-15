// Real-store PlusStores.
//
// T152 (active): createStoreKitPlusStore buys Glaze Plus through the local StoreKit 2 module
// (modules/glaze-store via src/native/store.ts). entitlement.ts picks it whenever that module is
// built in (iOS native builds); Expo Go, Android and the plain `production` profile keep the mock.
//
// T140 prep (kept, not wired): createIapPlusStore takes an injected expo-iap-shaped client
// (src/core/iapFlow.ts). Superseded by T152 because no npm package can be added offline; it stays
// for Android later. This file must not import expo-iap itself (guarded by src/core/iapFlow.test.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLUS_SKU, purchasePlus, restorePlus, type IapClient } from '../core/iapFlow';
import { ENTITLEMENT_SKUS, YEARLY_SKU, buyPlus, combineOwned, parsePlusCache, resolveOwned, resolveSubscribed } from '../core/plusStoreKit';
import type { GlazeStoreAdapter } from '../native/store';
import type { PlusStore, PurchaseResult } from './entitlement';

export const PLUS_IAP_CACHE_KEY = 'glaze.plus.iap.v1';

export type IapPlusStore = PlusStore & {
  /** Store error code of the last failed purchase (for the "nothing was charged" line). */
  lastFailureCode(): string | null;
};

async function cache(plus: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PLUS_IAP_CACHE_KEY, JSON.stringify({ plus, checkedAt: Date.now() }));
  } catch {
    // cache only; the store stays the source of truth
  }
}

async function cached(): Promise<boolean> {
  try {
    return parsePlusCache(await AsyncStorage.getItem(PLUS_IAP_CACHE_KEY))?.plus === true;
  } catch {
    return false;
  }
}

async function cachedEntry() {
  try {
    return parsePlusCache(await AsyncStorage.getItem(PLUS_IAP_CACHE_KEY));
  } catch {
    return null;
  }
}

/**
 * Glaze 1.0.41: the yearly subscription. Buying sells YEARLY_SKU; Glaze Plus is on while ANY of
 * ENTITLEMENT_SKUS is active (the subscription, or the legacy sandbox-only one-time unlock). StoreKit
 * already drops expired / refunded subscriptions; the cache only bridges a short offline gap
 * (resolveSubscribed, 7 days since the last confirmed answer).
 */
export function createSubscriptionPlusStore(store: GlazeStoreAdapter, onChange: (plus: boolean) => void): IapPlusStore {
  let lastCode: string | null = null;
  let price: Promise<string | null> | null = null;
  const check = async (): Promise<boolean> => {
    const answers: (boolean | null)[] = [];
    for (const id of ENTITLEMENT_SKUS) answers.push(await store.isOwned(id));
    const v = resolveSubscribed(combineOwned(answers), await cachedEntry(), Date.now());
    // Only a real StoreKit answer refreshes the cache's time stamp.
    if (combineOwned(answers) !== null) await cache(v);
    return v;
  };
  // A renewal, expiry, refund or Ask to Buy approval for either product: re-check both.
  for (const id of ENTITLEMENT_SKUS) {
    store.onEntitlementChange(id, () => {
      void check().then(onChange, () => undefined);
    });
  }
  return {
    purchasable: true,
    lastFailureCode: () => lastCode,
    displayPrice() {
      if (!price) {
        price = store.getProduct(YEARLY_SKU).then((p) => {
          if (!p) price = null;
          return p ? p.displayPrice : null;
        });
      }
      return price;
    },
    isPlus: check,
    async purchase(): Promise<PurchaseResult> {
      lastCode = null;
      const r = await buyPlus(store, YEARLY_SKU);
      if (r.status === 'purchased') {
        await cache(true);
        onChange(true);
        return 'purchased';
      }
      if (r.status === 'cancelled') return 'cancelled';
      if (r.status === 'pending') return 'pending';
      lastCode = r.code;
      return 'failed';
    },
    async restore() {
      const r = await store.restore(YEARLY_SKU);
      // Throwing makes RestorePurchases say "Couldn't restore right now" (plus.lock.restoreFailed).
      if (!r.ok) throw new Error(r.code);
      const owned = r.owned || (await check());
      await cache(owned);
      onChange(owned);
      return owned;
    },
  };
}

/**
 * T152: Glaze Plus through StoreKit 2 (one product; kept for its tests, superseded by
 * createSubscriptionPlusStore in 1.0.41). Unlock shows Apple's sheet (sandbox in TestFlight, nothing
 * charged); success unlocks and persists; cancel is silent; pending (Ask to Buy) says so and
 * unlocks later through the Transaction.updates event; failure keeps the store code.
 */
export function createStoreKitPlusStore(
  store: GlazeStoreAdapter,
  onChange: (plus: boolean) => void,
  productId: string = PLUS_SKU,
): IapPlusStore {
  let lastCode: string | null = null;
  let price: Promise<string | null> | null = null;

  store.onEntitlementChange(productId, (owned) => {
    void cache(owned);
    onChange(owned);
  });

  return {
    purchasable: true,
    lastFailureCode: () => lastCode,
    displayPrice() {
      // One lookup per launch; a miss (no product yet) is retried next time the sheet opens.
      if (!price) {
        price = store.getProduct(productId).then((p) => {
          if (!p) price = null;
          return p ? p.displayPrice : null;
        });
      }
      return price;
    },
    async isPlus() {
      const v = resolveOwned(await store.isOwned(productId), await cached());
      await cache(v);
      return v;
    },
    async purchase(): Promise<PurchaseResult> {
      lastCode = null;
      const r = await buyPlus(store, productId);
      if (r.status === 'purchased') {
        await cache(true);
        onChange(true);
        return 'purchased';
      }
      if (r.status === 'cancelled') return 'cancelled';
      if (r.status === 'pending') return 'pending';
      lastCode = r.code;
      return 'failed';
    },
    async restore() {
      const r = await store.restore(productId);
      // Throwing makes RestorePurchases say "Couldn't restore right now" (plus.lock.restoreFailed).
      if (!r.ok) throw new Error(r.code);
      await cache(r.owned);
      onChange(r.owned);
      return r.owned;
    },
  };
}

export function createIapPlusStore(client: IapClient, onChange: (plus: boolean) => void): IapPlusStore {
  let lastCode: string | null = null;
  return {
    purchasable: true,
    lastFailureCode: () => lastCode,
    async isPlus() {
      if (await cached()) return true;
      try {
        const v = await restorePlus({ client });
        if (v) await cache(true);
        return v;
      } catch {
        return false;
      }
    },
    async purchase(): Promise<PurchaseResult> {
      lastCode = null;
      const r = await purchasePlus({ client });
      if (r.kind === 'purchased') {
        await cache(true);
        onChange(true);
        return 'purchased';
      }
      if (r.kind === 'cancelled') return 'cancelled';
      lastCode = r.code;
      return 'failed';
    },
    async restore() {
      const v = await restorePlus({ client });
      if (v) await cache(true);
      onChange(v);
      return v;
    },
  };
}
