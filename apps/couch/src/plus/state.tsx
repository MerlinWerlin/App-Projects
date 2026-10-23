import { useCallback, useSyncExternalStore } from 'react';
import { MemoryKv } from '../core/store';
import { loadPersistentKv } from '../native/kv';
import { EntitlementStore, type EntitlementSnapshot, type PlusFeature } from './entitlement';
import { StubPurchaseProvider, type PurchaseProvider } from './purchases';

/**
 * App-wide Couch Plus state. Persisted with AsyncStorage (src/native/kv.ts, guarded), in-memory when
 * that is unavailable. Lives in src/plus so nothing on a control path can read the entitlement.
 */
let store: EntitlementStore | null = null;
let provider: PurchaseProvider | null = null;

export function plusStore(): EntitlementStore {
  if (!store) {
    store = new EntitlementStore(loadPersistentKv() ?? new MemoryKv());
    void store.load();
  }
  return store;
}

/** Stub only in this build: never charges. */
export function purchaseProvider(): PurchaseProvider {
  if (!provider) provider = new StubPurchaseProvider();
  return provider;
}

export function usePlus(): EntitlementSnapshot & { canUse: (f: PlusFeature) => boolean } {
  const s = plusStore();
  const subscribe = useCallback((cb: () => void) => s.subscribe(cb), [s]);
  const getSnapshot = useCallback(() => s.getSnapshot(), [s]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const canUse = useCallback((f: PlusFeature) => s.canUse(f), [s, snap.tier]);
  return { ...snap, canUse };
}
