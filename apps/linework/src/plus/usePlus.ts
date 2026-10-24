// React hook over the Plus store and the free trial (RN side; not run by node tests). Store builds buy through
// expo-iap (src/plus/iapStore.ts); Expo Go falls back to the AsyncStorage mock store. Only src/plus reads the
// entitlement; screens get `access` (loading / none / trial / owned / expired) from here.
// The trial starts only when the person taps "Start free trial" (guideline 3.1.1, docs/OWNER_1024.md). Every
// mounted usePlus re-reads storage when any of them changes something, so Home, Templates and Prepare unlock as soon
// as the trial starts on the Plus screen.
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
import { LOADING_ACCESS, TRIAL_KEY, TRIAL_OFFER_SEEN_KEY, accessFor, parseTrialStart, type Access } from './access';
import { createIapStore, type TrialResult } from './iapStore';

const asyncStorage: PlusStorage = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
};

// Shared across every mounted usePlus: a change made on one screen reloads the others.
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
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
  /** Loading / none (trial not started) / trial / owned / expired, recomputed on every load. */
  access: Access;
  /** Real store purchase available (TestFlight / App Store build). */
  canBuy: boolean;
  /** Localised store price when the store has answered. */
  price: string | null;
  /** Starts the free 14-day trial through the store (free "14-day Trial" item). `unavailable` without a store. */
  startTrial: () => Promise<TrialResult>;
  /** The first-run trial offer card on Home was dismissed or acted on. Null while loading. */
  offerSeen: boolean | null;
  dismissOffer: () => Promise<void>;
  /** Test builds only: 'start' now, 'end' (moved back 15 days), or 'clear' (not started, offer shown again). */
  devTrial: (op: 'start' | 'end' | 'clear') => Promise<void>;
};

const DAY = 24 * 60 * 60 * 1000;

export function usePlus(): UsePlus {
  const iap = useMemo(() => createIapStore(asyncStorage), []);
  const store = useMemo(() => iap ?? createMockStore(asyncStorage), [iap]);
  const [state, setState] = useState<PlusState>(NOT_OWNED);
  // undefined: not read yet; null: the trial has not started.
  const [trialStart, setTrialStart] = useState<number | null | undefined>(undefined);
  const [offerSeen, setOfferSeen] = useState<boolean | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const l = () => setRev((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    AsyncStorage.getItem(TRIAL_KEY)
      .catch(() => null)
      .then((raw) => {
        const { start, fixed } = parseTrialStart(raw, now);
        if (fixed && start !== null) AsyncStorage.setItem(TRIAL_KEY, String(start)).catch(() => {});
        if (alive) setTrialStart(start);
      });
    AsyncStorage.getItem(TRIAL_OFFER_SEEN_KEY)
      .catch(() => null)
      .then((raw) => {
        if (alive) setOfferSeen(raw === '1');
      });
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
  }, [store, rev]);

  useEffect(() => {
    let alive = true;
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
      notify();
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

  const markOfferSeen = useCallback(async () => {
    setOfferSeen(true);
    await AsyncStorage.setItem(TRIAL_OFFER_SEEN_KEY, '1').catch(() => {});
  }, []);

  const startTrial = useCallback(async (): Promise<TrialResult> => {
    if (!iap) return { status: 'unavailable', start: null };
    setBusy(true);
    try {
      const r = await iap.startTrial();
      if (r.start !== null) {
        setTrialStart(r.start);
        await markOfferSeen();
      }
      return r;
    } catch {
      return { status: 'failed', start: null };
    } finally {
      setBusy(false);
      notify();
    }
  }, [iap, markOfferSeen]);

  const dismissOffer = useCallback(async () => {
    await markOfferSeen();
    notify();
  }, [markOfferSeen]);

  const devTrial = useCallback(async (op: 'start' | 'end' | 'clear') => {
    if (op === 'clear') {
      await AsyncStorage.removeItem(TRIAL_KEY).catch(() => {});
      await AsyncStorage.removeItem(TRIAL_OFFER_SEEN_KEY).catch(() => {});
      setTrialStart(null);
      setOfferSeen(false);
    } else {
      const start = op === 'end' ? Date.now() - 15 * DAY : Date.now();
      await AsyncStorage.setItem(TRIAL_KEY, String(start)).catch(() => {});
      setTrialStart(start);
    }
    notify();
  }, []);

  const access: Access = state.owned
    ? accessFor(true, null, 0)
    : loading || trialStart === undefined
      ? LOADING_ACCESS
      : accessFor(false, trialStart, Date.now());

  return {
    state,
    loading,
    busy,
    purchase,
    restore,
    tip,
    resetMock,
    access,
    canBuy: iap !== null,
    price,
    startTrial,
    offerSeen,
    dismissOffer,
    devTrial,
  };
}
