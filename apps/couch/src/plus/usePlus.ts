/**
 * React side of Couch Plus (owner decision 7 Nov 2026). One AccessStore for the app (src/plus/accessStore.ts) over
 * AsyncStorage (src/native/kv.ts, guarded) and the expo-iap adapter (src/plus/iapStore.ts). In Expo Go there is no
 * store module: development builds fall back to the local mock store, store builds say purchases are unavailable.
 * Only src/plus reads the entitlement; screens get `access` from usePlus().
 */
import { useCallback, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { MemoryKv } from '../core/store';
import { loadPersistentKv } from '../native/kv';
import { type Access } from './access';
import { AccessStore, type AccessSnapshot } from './accessStore';
import { createMockStore, type PlusStorage } from './entitlement';
import { createIapStore } from './iapStore';

declare const __DEV__: boolean;

let instance: AccessStore | null = null;

/** The app's Couch Plus access store, created and started on first use (app/_layout.tsx calls this at load). */
export function plusAccess(): AccessStore {
  if (!instance) {
    const kv = loadPersistentKv() ?? new MemoryKv();
    const storage: PlusStorage = { get: (k) => kv.getItem(k), set: (k, v) => kv.setItem(k, v) };
    const iap = createIapStore(storage, () => Date.now(), undefined, Platform.OS === 'android' ? 'android' : 'ios');
    const dev = typeof __DEV__ !== 'undefined' && __DEV__;
    instance = new AccessStore({ storage, iap, fallback: iap ? null : dev ? createMockStore(storage) : null });
    void instance.start().catch(() => undefined);
  }
  return instance;
}

export type UsePlus = AccessSnapshot & { access: Access; store: AccessStore };

export function usePlus(): UsePlus {
  const store = plusAccess();
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, access: store.access(), store };
}
