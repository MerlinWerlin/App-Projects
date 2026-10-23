// Glaze Plus entitlement. ONLY src/plus may read this (ops/CONVENTIONS.md); free features
// never ask. Until the store release this is a mock persisted on-device; in development
// builds "purchase" toggles Plus on so locked states can be tested.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable';

export interface PlusStore {
  isPlus(): Promise<boolean>;
  purchase(): Promise<PurchaseResult>;
  restore(): Promise<boolean>;
}

export const PLUS_MOCK_KEY = 'glaze.plus.mock.v1';
/** English source of plus.lock.unavailable (UI shows the catalogue string). */
export const PLUS_UNAVAILABLE_MESSAGE = 'Glaze Plus arrives with the store release';
/** Shown in copy only (plus.lock.price); the real price comes from the store at release. */
export const PLUS_PRICE = 'A$7.99 / US$4.99'; // i18n-ignore
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

export const plusStore: PlusStore = createMockPlusStore(typeof __DEV__ !== 'undefined' && __DEV__);

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
