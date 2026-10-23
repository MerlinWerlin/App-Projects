// React hook over the Plus store and the free trial (RN side; not run by node tests). Store builds buy through
// expo-iap (src/plus/iapStore.ts); Expo Go falls back to the AsyncStorage mock store. Only src/plus reads the
// entitlement; screens get `access` (trial / owned / expired) from here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NOT_OWNED,
  createMockStore,
  resetMockPurchase,
  type PlusState,
  type PlusStorage,
  type TipAmountId,
} from './entitlement';
import { LOADING_ACCESS, TRIAL_KEY, accessFor, parseTrialStart, type Access } from './access';
import { createIapStore } from './iapStore';

const asyncStorage: PlusStorage = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
};

export type UsePlus = {
  state: PlusState;
  loading: boolean;
  busy: boolean;
  purchase: () => Promise<PlusState>;
  restore: () => Promise<PlusState>;
  tip: (amountId: TipAmountId) => Promise<{ ok: boolean }>;
  /** Test builds only: clears the mock purchase. */
  resetMock: () => Promise<PlusState>;
  /** Trial / owned / expired, recomputed on every load. */
  access: Access;
  /** Real store purchase available (TestFlight / App Store build). */
  canBuy: boolean;
  /** Localised store price when the store has answered. */
  price: string | null;
  /** Test builds only: move the trial start back so it has ended (or reset it). */
  setTrialEnded: (ended: boolean) => Promise<void>;
};

const DAY = 24 * 60 * 60 * 1000;

export function usePlus(): UsePlus {
  const iap = useMemo(() => createIapStore(asyncStorage), []);
  const store = useMemo(() => iap ?? createMockStore(asyncStorage), [iap]);
  const [state, setState] = useState<PlusState>(NOT_OWNED);
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    AsyncStorage.getItem(TRIAL_KEY)
      .catch(() => null)
      .then((raw) => {
        const { start, fresh } = parseTrialStart(raw, now);
        if (fresh) AsyncStorage.setItem(TRIAL_KEY, String(start)).catch(() => {});
        if (alive) setTrialStart(start);
      });
    iap
      ?.price()
      .then((p) => {
        if (alive && p) setPrice(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [iap]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    store
      .getState()
      .then((s) => {
        if (alive) setState(s);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [store]);

  const run = useCallback(async (op: () => Promise<PlusState>): Promise<PlusState> => {
    setBusy(true);
    try {
      const next = await op();
      setState(next);
      return next;
    } catch {
      return NOT_OWNED;
    } finally {
      setBusy(false);
    }
  }, []);

  const purchase = useCallback(() => run(() => store.purchase()), [run, store]);
  const restore = useCallback(() => run(() => store.restore()), [run, store]);
  const resetMock = useCallback(() => run(() => resetMockPurchase(asyncStorage)), [run]);
  const tip = useCallback(
    async (amountId: TipAmountId) => {
      try {
        return await store.tip(amountId);
      } catch {
        return { ok: false };
      }
    },
    [store],
  );

  const setTrialEnded = useCallback(async (ended: boolean) => {
    const start = ended ? Date.now() - 15 * DAY : Date.now();
    await AsyncStorage.setItem(TRIAL_KEY, String(start)).catch(() => {});
    setTrialStart(start);
  }, []);

  const access = loading || trialStart === null ? (state.owned ? accessFor(true, 0, 0) : LOADING_ACCESS) : accessFor(state.owned, trialStart, Date.now());

  return { state, loading, busy, purchase, restore, tip, resetMock, access, canBuy: iap !== null, price, setTrialEnded };
}
