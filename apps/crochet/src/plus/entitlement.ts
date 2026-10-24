// Rowlight Plus: one-time purchase. ONLY src/plus reads the entitlement; the free core never asks.
// Until the store build adds StoreKit / Play Billing (needs a dev build), this is an on-device mock:
// in development (Expo Go) "Unlock" turns Plus on so locked screens can be tested; in a store build it
// says purchases arrive with the release. No network, no tracking.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSyncExternalStore } from 'react';

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable';

/** What Plus adds. The free core (counters, patterns, PDF + highlighter, tools, backup) is never here. */
export const PLUS_FEATURES = ['stash', 'sellerCalc'] as const;
export type PlusFeature = (typeof PLUS_FEATURES)[number];

/** Display only; the real price comes from the store at release (owner decides). */
export const PLUS_PRICE = 'A$9.99 one-time'; // i18n-ignore

const KEY = 'crochet.plus.mock.v1';
let plus = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export async function loadPlus(): Promise<void> {
  try {
    plus = (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    plus = false;
  }
  emit();
}

// Dev server or Expo Go (EAS preview updates run a production bundle inside Expo Go, so __DEV__ alone isn't enough).
const dev =
  (typeof __DEV__ !== 'undefined' && __DEV__) || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function purchasePlus(): Promise<PurchaseResult> {
  if (!dev) return 'unavailable';
  plus = true;
  emit();
  await AsyncStorage.setItem(KEY, '1').catch(() => {});
  return 'purchased';
}

export async function restorePlus(): Promise<boolean> {
  await loadPlus();
  return plus;
}

/** Dev-only: turn the mock off again. */
export async function resetPlus(): Promise<void> {
  plus = false;
  emit();
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const get = () => plus;

export function usePlus(): boolean {
  return useSyncExternalStore(subscribe, get, get);
}

export function hasPlus(): boolean {
  return plus;
}

export const isDevBuild = dev;
