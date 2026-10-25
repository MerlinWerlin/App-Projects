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
import { buyPlus, resolveOwned } from '../core/plusStoreKit';
import type { GlazeStoreAdapter } from '../native/store';
import type { PlusStore, PurchaseResult } from './entitlement';

export const PLUS_IAP_CACHE_KEY = 'glaze.plus.iap.v1';

export type IapPlusStore = PlusStore & {
  /** Store error code of the last failed purchase (for the "nothing was charged" line). */
  lastFailureCode(): string | null;
};

async function cache(plus: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PLUS_IAP_CACHE_KEY, JSON.stringify({ plus }));
  } catch {
    // cache only; the store stays the source of truth
  }
}

async function cached(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PLUS_IAP_CACHE_KEY);
    return !!raw && JSON.parse(raw)?.plus === true;
  } catch {
    return false;
  }
}

/**
 * T152: Glaze Plus through StoreKit 2. Unlock shows Apple's sheet (sandbox in TestFlight, nothing
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
