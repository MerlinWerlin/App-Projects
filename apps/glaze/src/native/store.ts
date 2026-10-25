// App Store adapter (T152). The native module `GlazeStore` (modules/glaze-store, StoreKit 2) buys
// and restores Glaze Plus. It only exists in iOS native builds (development, preview,
// production-native). Everywhere else (Expo Go, Android, the plain `production` profile, builds
// made before the module existed) this adapter reports "unavailable" and src/plus keeps the mock
// store. Nothing here ever throws. It knows nothing about the Plus entitlement itself.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import {
  STORE_EVENT,
  STORE_MODULE,
  errorCodeOf,
  parseEntitlementEvent,
  parseProduct,
  parsePurchase,
  type StoreProduct,
  type StorePurchase,
  type StoreRestore,
} from '../core/plusStoreKit';

type NativeStore = {
  isAvailable?(): Promise<unknown>;
  getProduct(id: string): Promise<unknown>;
  purchase(id: string): Promise<unknown>;
  isOwned(id: string): Promise<unknown>;
  restore(id: string): Promise<unknown>;
  addListener?(event: string, cb: (e: unknown) => void): { remove(): void } | undefined;
};

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeStore | null | undefined;

function loadNative(): NativeStore | null {
  if (cached !== undefined) return cached;
  let found: NativeStore | null = null;
  try {
    if (Platform.OS === 'ios' && !isExpoGo()) {
      const mod =
        typeof requireOptionalNativeModule === 'function' ? requireOptionalNativeModule<NativeStore>(STORE_MODULE) : null;
      found =
        mod &&
        typeof mod.getProduct === 'function' &&
        typeof mod.purchase === 'function' &&
        typeof mod.isOwned === 'function' &&
        typeof mod.restore === 'function'
          ? mod
          : null;
    }
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

/** Synchronous: true only in an iOS native build that has the StoreKit module. */
function available(): boolean {
  try {
    return loadNative() !== null;
  } catch {
    return false;
  }
}

async function getProduct(id: string): Promise<StoreProduct | null> {
  try {
    const mod = loadNative();
    return mod ? parseProduct(await mod.getProduct(id), id) : null;
  } catch {
    return null;
  }
}

async function purchase(id: string): Promise<StorePurchase> {
  const mod = loadNative();
  if (!mod) return { status: 'failed', code: 'store-unavailable' };
  try {
    return parsePurchase(await mod.purchase(id));
  } catch (e) {
    return { status: 'failed', code: errorCodeOf(e, 'native-error') };
  }
}

/** true/false from Transaction.currentEntitlements; null when it couldn't be asked. */
async function isOwned(id: string): Promise<boolean | null> {
  try {
    const mod = loadNative();
    if (!mod) return null;
    const v = await mod.isOwned(id);
    return typeof v === 'boolean' ? v : null;
  } catch {
    return null;
  }
}

async function restore(id: string): Promise<StoreRestore> {
  const mod = loadNative();
  if (!mod) return { ok: false, code: 'store-unavailable' };
  try {
    const v = await mod.restore(id);
    return { ok: true, owned: v === true };
  } catch (e) {
    return { ok: false, code: errorCodeOf(e, 'restore-error') };
  }
}

/** Transactions finished outside a purchase (Ask to Buy approved, refunds). Returns unsubscribe. */
function onEntitlementChange(id: string, cb: (owned: boolean) => void): () => void {
  try {
    const mod = loadNative();
    if (!mod || typeof mod.addListener !== 'function') return () => {};
    const sub = mod.addListener(STORE_EVENT, (e) => {
      const owned = parseEntitlementEvent(e, id);
      if (owned !== null) cb(owned);
    });
    return () => {
      try {
        sub?.remove();
      } catch {
        // already gone
      }
    };
  } catch {
    return () => {};
  }
}

export type GlazeStoreAdapter = {
  available(): boolean;
  getProduct(id: string): Promise<StoreProduct | null>;
  purchase(id: string): Promise<StorePurchase>;
  isOwned(id: string): Promise<boolean | null>;
  restore(id: string): Promise<StoreRestore>;
  onEntitlementChange(id: string, cb: (owned: boolean) => void): () => void;
};

export const glazeStore: GlazeStoreAdapter = { available, getProduct, purchase, isOwned, restore, onEntitlementChange };
