// The one place screens get the trial / unlock state (1.0.0). A module-level store shared without a Provider, like
// src/state/persisted.ts. The last answer is cached on the phone so Trammel opens in the right state offline;
// StoreKit is asked at launch, on any transaction update, and after every purchase or restore.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { ACCESS_CACHE_KEY, accessOf, mergeEntitlements, parseAccessCache, type Access, type Entitlements } from '../core/access.ts';
import { loadProducts, onEntitlementChange, purchase, readEntitlements, restore, storeKind, type PurchaseResult, type StoreProduct } from '../native/store.ts';

export type AccessSnapshot = Access & { loaded: boolean; products: Record<string, StoreProduct>; productsLoaded: boolean };

let ent: Entitlements = { unlocked: false, trialStart: null };
let loaded = storeKind === 'stub';
let products: Record<string, StoreProduct> = {};
let productsLoaded = false;
let snap: AccessSnapshot | null = null;
const listeners = new Set<() => void>();

const build = (): AccessSnapshot => ({ ...accessOf(storeKind, ent, Date.now()), loaded, products, productsLoaded });
const emit = () => {
  snap = build();
  listeners.forEach((l) => l());
};
const current = () => (snap ??= build());

async function save(e: Entitlements) {
  try {
    await AsyncStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify({ ...e, checkedAt: Date.now() }));
  } catch {
    // kept in memory for this session
  }
}

/** Asks StoreKit again (falls back to the cached answer when it can't be asked). */
export async function refreshAccess(): Promise<void> {
  if (storeKind === 'stub') return;
  const cache = parseAccessCache(await AsyncStorage.getItem(ACCESS_CACHE_KEY).catch(() => null));
  if (!loaded && cache) {
    ent = mergeEntitlements(null, cache);
    loaded = true;
    emit();
  }
  const store = await readEntitlements();
  ent = mergeEntitlements(store, cache);
  loaded = true;
  if (store) await save(store);
  emit();
}

export async function refreshProducts(): Promise<void> {
  if (storeKind === 'stub') return;
  products = await loadProducts();
  productsLoaded = true;
  emit();
}

let started = false;
function start() {
  if (started) return;
  started = true;
  void refreshAccess();
  void refreshProducts();
  onEntitlementChange(() => void refreshAccess());
  // iOS often resumes the app without relaunching it: re-read the clock (and StoreKit) when it comes back, and
  // re-check once a minute while it's open, so a trial ends on time even if the app never restarts.
  AppState.addEventListener('change', (st) => {
    if (st === 'active') {
      emit();
      void refreshAccess();
    }
  });
  setInterval(() => {
    const before = current().state;
    const now = build();
    if (now.state !== before || now.daysLeft !== current().daysLeft) emit();
  }, 60_000);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useAccess(): AccessSnapshot {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, current, current);
}

/** Starts the trial or buys the unlock, then re-reads the entitlements. */
export async function buy(id: string): Promise<PurchaseResult> {
  const r = await purchase(id);
  if (r.status === 'purchased') await refreshAccess();
  return r;
}

/** Restore purchases: 'found' when the trial or the unlock came back, 'none', or 'failed' (App Store unreachable). */
export async function restorePurchases(): Promise<'found' | 'none' | 'failed'> {
  const r = await restore();
  if (!r) return 'failed';
  ent = r;
  loaded = true;
  await save(r);
  emit();
  return r.unlocked || r.trialStart != null ? 'found' : 'none';
}
