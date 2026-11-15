// Glaze Plus entitlement. ONLY src/plus may read this (ops/CONVENTIONS.md); free features
// never ask.
// T152 / 1.0.41: in an iOS native build that has the StoreKit 2 module (modules/glaze-store) Plus is
// the yearly App Store subscription (sandbox in TestFlight: nothing is charged). Everywhere else
// (Expo Go, Android, the plain `production` profile) it stays a mock persisted on-device; in
// development "purchase" toggles Plus on so locked states can be tested.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { PLUS_SKU } from '../core/iapFlow';
import { glazeStore } from '../native/store';
import { createSubscriptionPlusStore } from './iapStore';

export type PurchaseResult = 'purchased' | 'cancelled' | 'pending' | 'unavailable' | 'failed';

export interface PlusStore {
  isPlus(): Promise<boolean>;
  purchase(): Promise<PurchaseResult>;
  restore(): Promise<boolean>;
  /** True when Unlock opens a real store sheet (T152); false/absent for the mock. */
  purchasable?: boolean;
  /** Real store only: the App Store's localised price, or null until the product loads. */
  displayPrice?(): Promise<string | null>;
  /** Real store only (src/plus/iapStore.ts): store error code of the last 'failed' purchase. */
  lastFailureCode?(): string | null;
}

/** App Store product id of the legacy one-time unlock (sandbox / TestFlight only; still honoured). */
export const PLUS_PRODUCT_ID = PLUS_SKU;
/** 1.0.41: the product Glaze sells, the yearly subscription (store/SUBSCRIPTION.md). */
export { YEARLY_SKU as PLUS_SUBSCRIPTION_ID } from '../core/plusStoreKit';

export const PLUS_MOCK_KEY = 'glaze.plus.mock.v1';
// 1.0.42: no hard-coded price anywhere in the UI. The sheet shows StoreKit's localised displayPrice
// and keeps Subscribe disabled until the product has loaded (usePlusPrice below). The owner's
// App Store Connect price lives in store/SUBSCRIPTION.md only.

function parse(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const v: unknown = JSON.parse(raw);
    return !!v && typeof v === 'object' && (v as { plus?: unknown }).plus === true;
  } catch {
    return false;
  }
}

async function read(): Promise<boolean> {
  try {
    return parse(await AsyncStorage.getItem(PLUS_MOCK_KEY));
  } catch {
    return false;
  }
}

async function write(plus: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PLUS_MOCK_KEY, JSON.stringify({ plus }));
  } catch {
    // Storage failure just means the mock resets; never block the UI.
  }
}

/** Mock store: no network, no payments. Dev builds can toggle Plus for testing. */
export function createMockPlusStore(dev: boolean): PlusStore {
  return {
    isPlus: read,
    async purchase() {
      if (!dev) return 'unavailable';
      await write(true);
      notify(true);
      return 'purchased';
    },
    async restore() {
      const v = await read();
      notify(v);
      return v;
    },
  };
}

const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

/** Real StoreKit purchase where the native module exists, otherwise the honest mock. */
export const plusStore: PlusStore = glazeStore.available()
  ? createSubscriptionPlusStore(glazeStore, (v) => notify(v))
  : createMockPlusStore(DEV);

/** True when Unlock really buys (native build with the store module). */
export const PLUS_PURCHASABLE = plusStore.purchasable === true;

/** Dev-only: turn the mock entitlement off again. */
export async function resetMockPlus(): Promise<void> {
  await write(false);
  notify(false);
}

// ------------------------------------------------------------ hook

let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

function notify(v: boolean) {
  cached = v;
  for (const l of listeners) l(v);
}

export type UsePlus = {
  /** null while loading; treat as not Plus. */
  plus: boolean | null;
  purchase: () => Promise<PurchaseResult>;
  restore: () => Promise<boolean>;
};

let priceCache: string | null = null;

/** 'loading' while StoreKit is asked, 'ready' with its price, 'failed' when it gave none (or there is no store). */
export type PlusPriceState = 'loading' | 'ready' | 'failed';
export type PlusPrice = { price: string | null; state: PlusPriceState; retry: () => void };

/** How long the sheet waits for StoreKit's product before offering Try again. */
export const PRICE_TIMEOUT_MS = 15_000;

/**
 * 1.0.42: the price to show, ONLY from StoreKit's getProduct (localised displayPrice). There is no
 * fallback price: until the product loads `price` is null, the sheet shows no price and Subscribe
 * stays disabled; on a miss it says "Couldn't load the price" with Try again (retry).
 */
export function usePlusPrice(): PlusPrice {
  const canLoad = typeof plusStore.displayPrice === 'function';
  const [price, setPrice] = useState<string | null>(priceCache);
  const [state, setState] = useState<PlusPriceState>(priceCache ? 'ready' : canLoad ? 'loading' : 'failed');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (priceCache) {
      setPrice(priceCache);
      setState('ready');
      return;
    }
    const load = plusStore.displayPrice;
    if (typeof load !== 'function') {
      setState('failed');
      return;
    }
    let live = true;
    setState('loading');
    const timer = setTimeout(() => {
      if (live) setState((s) => (s === 'loading' ? 'failed' : s));
    }, PRICE_TIMEOUT_MS);
    load
      .call(plusStore)
      .then(
        (p) => {
          if (!live) return;
          if (p) {
            priceCache = p;
            setPrice(p);
            setState('ready');
          } else {
            setState('failed');
          }
        },
        () => {
          if (live) setState('failed');
        },
      )
      .finally(() => clearTimeout(timer));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { price, state, retry };
}

export function usePlus(): UsePlus {
  const [plus, setPlus] = useState<boolean | null>(cached);
  useEffect(() => {
    listeners.add(setPlus);
    if (cached === null) {
      plusStore.isPlus().then((v) => notify(v));
    } else {
      setPlus(cached);
    }
    return () => {
      listeners.delete(setPlus);
    };
  }, []);
  const purchase = useCallback(() => plusStore.purchase(), []);
  const restore = useCallback(() => plusStore.restore(), []);
  return { plus, purchase, restore };
}
