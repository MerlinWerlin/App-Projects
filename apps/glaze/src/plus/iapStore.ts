// T140 prep (D143-1): a PlusStore backed by the real store, built from an injected expo-iap-shaped
// client. NOT wired in yet: entitlement.ts keeps the mock until the native build that adds the
// pinned expo-iap package (D130-2: one native change per TestFlight build). Wiring then is:
//   import every export of the expo-iap package as ExpoIap, then
//   export const plusStore = createIapPlusStore(ExpoIap as unknown as IapClient, onChange);
// This file must not import expo-iap itself (guarded by src/core/iapFlow.test.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { purchasePlus, restorePlus, type IapClient } from '../core/iapFlow';
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

export function createIapPlusStore(client: IapClient, onChange: (plus: boolean) => void): IapPlusStore {
  let lastCode: string | null = null;
  return {
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
