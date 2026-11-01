// The one place screens get Satchel Plus from (T16): a module-level store shared without a Provider. Ownership is
// cached on this phone (AsyncStorage) so Plus works offline in flight mode; the App Store is asked once per launch.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { plusUnlocked, type PlusAvailability } from './entitlement.ts';
import { createStore, type BuyResult, type PlusStore, type RestoreResult, type Storage } from './store.ts';

export type PlusSnapshot = { availability: PlusAvailability; owned: boolean; unlocked: boolean; price: string | null; loaded: boolean };

const storage: Storage = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
};

let store: PlusStore | null = null;
const getStore = () => (store ??= createStore(storage));

let snap: PlusSnapshot | null = null;
const listeners = new Set<() => void>();
const current = (): PlusSnapshot => {
  if (!snap) {
    const availability = getStore().kind;
    snap = { availability, owned: false, unlocked: plusUnlocked({ availability, owned: false }), price: null, loaded: false };
  }
  return snap;
};
const update = (p: Partial<PlusSnapshot>) => {
  const next = { ...current(), ...p };
  next.unlocked = plusUnlocked(next);
  snap = next;
  listeners.forEach((l) => l());
};

let started = false;
function start() {
  if (started) return;
  started = true;
  const s = getStore();
  s.owned()
    .then((owned) => update({ owned, loaded: true }))
    .catch(() => update({ loaded: true }));
  if (s.kind === 'store') s.price().then((price) => update({ price })).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function usePlus(): PlusSnapshot {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, current, current);
}

export async function buyPlus(): Promise<BuyResult> {
  const r = await getStore().buy();
  if (r.status === 'owned') update({ owned: true });
  return r;
}

export async function restorePlus(): Promise<RestoreResult> {
  const r = await getStore().restore();
  if (r.status === 'owned') update({ owned: true });
  return r;
}

/** Ask the store for the price again (Settings opening after the first try was offline). */
export function refreshPlusPrice() {
  const s = getStore();
  if (s.kind === 'store' && !current().price) s.price().then((price) => update({ price })).catch(() => {});
}
