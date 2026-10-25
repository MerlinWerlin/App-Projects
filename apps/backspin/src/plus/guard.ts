// Release standard §2: no "test mode" text and no pretend unlock in a store build. createStore() falls back to the
// Expo Go test store whenever expo-iap can't be loaded; outside Expo Go that would hand out Plus for free and show
// "Test mode" on the paywall. Outside Expo Go we swap it for a store that says the App Store isn't reachable.
import { PLUS_KEY, type PlusStore, type Storage } from './store.ts';

export function guardTestStore(store: PlusStore, storage: Storage, isExpoGo: boolean): PlusStore {
  if (store.kind !== 'test' || isExpoGo) return store;
  return {
    kind: 'store',
    // Someone who already owns Plus on this phone keeps it.
    owned: async () => (await storage.get(PLUS_KEY).catch(() => null)) === '1',
    price: async () => null,
    buy: async () => ({ status: 'unavailable' }),
    restore: async () => false,
  };
}
