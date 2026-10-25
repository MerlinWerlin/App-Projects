// Glaze Plus entitlement. ONLY src/plus may read this (ops/CONVENTIONS.md); free features
// never ask.
// T152: in an iOS native build that has the StoreKit 2 module (modules/glaze-store) Plus is a real
// one-time App Store purchase (sandbox in TestFlight: nothing is charged). Everywhere else (Expo
// Go, Android, the plain `production` profile) it stays a mock persisted on-device; in
// development "purchase" toggles Plus on so locked states can be tested.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { PLUS_SKU } from '../core/iapFlow';
import { glazeStore } from '../native/store';
import { createStoreKitPlusStore } from './iapStore';

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

/** App Store product id of Glaze Plus (non-consumable). One id everywhere: docs/IAP_SANDBOX.md. */
export const PLUS_PRODUCT_ID = PLUS_SKU;

export const PLUS_MOCK_KEY = 'glaze.plus.mock.v1';
/** English source of plus.lock.unavailable (UI shows the catalogue string). */
export const PLUS_UNAVAILABLE_MESSAGE = "You can't buy Glaze Plus in this test version";
/** Owner's price A$2.99 one-time (D145-1). Fallback text: the store's localised displayPrice replaces it once loaded (T152). */
export const PLUS_PRICE = 'A$2.99'; // i18n-ignore
export const PLUS_PRICE_HINT = `One-time ${PLUS_PRICE}`;

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
  ? createStoreKitPlusStore(glazeStore, (v) => notify(v), PLUS_PRODUCT_ID)
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

/** The price to show: the App Store's localised displayPrice once loaded, else PLUS_PRICE. */
export function usePlusPrice(): string {
  const [price, setPrice] = useState<string>(priceCache ?? PLUS_PRICE);
  useEffect(() => {
    if (priceCache || typeof plusStore.displayPrice !== 'function') return;
    let live = true;
    plusStore
      .displayPrice()
      .then((p) => {
        if (!p) return;
        priceCache = p;
        if (live) setPrice(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return price;
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
