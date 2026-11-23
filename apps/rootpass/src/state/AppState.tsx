import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { COUNTRIES, type CountryInfo } from '../core/country.ts';
import { spell } from '../core/spell.ts';
import { DEFAULT_PREFS, JOBS_KEY, PREFS_KEY, parseJobs, parsePrefs, upsertJob, type Job, type Prefs } from '../core/jobs.ts';
import type { KvStore } from '../core/kv.ts';
import { loadSecureStore } from '../native/secureStore.ts';
import { canUse, ENTITLEMENT_KEY, parseEntitlement, type Feature } from '../plus/entitlement.ts';
import { createPurchaseProvider, type PurchaseProvider, type PurchaseResult, type StoreAccess } from '../plus/purchases.ts';
import { readStoredTrial, saveStoredTrial, trialState, type TrialState } from '../plus/trial.ts';

/**
 * Simulator store captures only (.github/workflows/rootpass-capture.yml): set at bundle time, shows the app as it
 * is during the trial. Never set for TestFlight or App Store builds (eas.json has no such env; see release.test.ts).
 */
const CAPTURE = process.env.EXPO_PUBLIC_ROOTPASS_CAPTURE === '1';

const kv: KvStore = {
  getItem: k => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};

interface App {
  loaded: boolean;
  prefs: Prefs;
  /** The chosen country's guidance (OTHER until chosen). */
  country: CountryInfo;
  /** Simulator capture build only (EXPO_PUBLIC_ROOTPASS_CAPTURE); always false in store builds. */
  capture: boolean;
  /** Copy in the country's spelling (US: meter, miter, aluminum...). */
  sp(s: string): string;
  setPrefs(p: Partial<Prefs>): void;
  jobs: Job[];
  saveJob(job: Job): Promise<void>;
  deleteJob(id: string): Promise<void>;
  owned: boolean;
  trial: TrialState;
  unlocked: boolean;
  can(f: Feature): boolean;
  purchases: PurchaseProvider;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const Ctx = createContext<App | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [owned, setOwned] = useState(false);
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [purchases] = useState(() => createPurchaseProvider());
  const [secure] = useState(() => loadSecureStore());
  const jobsRef = useRef<Job[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [p, j, e, t] = await Promise.all([
        kv.getItem(PREFS_KEY).catch(() => null),
        kv.getItem(JOBS_KEY).catch(() => null),
        kv.getItem(ENTITLEMENT_KEY).catch(() => null),
        readStoredTrial(kv, secure).catch(() => null),
      ]);
      if (!alive) return;
      setPrefsState(parsePrefs(p));
      const list = parseJobs(j);
      jobsRef.current = list;
      setJobs(list);
      setOwned(parseEntitlement(e).unlocked);
      setTrialStart(t);
      setLoaded(true);
    })();
    const sub = RNAppState.addEventListener('change', s => { if (s === 'active') setTick(Date.now()); });
    return () => { alive = false; sub.remove(); };
  }, [secure]);

  const applyAccess = useCallback(async (a: StoreAccess) => {
    setOwned(a.plus);
    setTrialStart(a.trialStart);
    await Promise.all([
      kv.setItem(ENTITLEMENT_KEY, JSON.stringify({ version: 1, unlocked: a.plus, updatedAt: Date.now() })).catch(() => undefined),
      a.trialStart !== null ? saveStoredTrial(kv, secure, a.trialStart) : Promise.resolve(),
    ]);
  }, [secure]);

  // Quietly re-check the store on launch and when the app comes back; an unreadable store keeps the last access.
  useEffect(() => {
    if (!loaded || CAPTURE) return;
    let alive = true;
    void purchases.refresh().then(a => { if (alive && a && !busy.current) void applyAccess(a); });
    return () => { alive = false; };
  }, [loaded, tick, purchases, applyAccess]);

  const transact = useCallback(async (kind: 'buy' | 'startTrial' | 'restore') => {
    busy.current = true;
    const r = await purchases[kind]().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: 'The purchase could not be confirmed. Nothing extra was charged. [E_STORE]' }));
    if (r.ok) await applyAccess(r.access);
    busy.current = false;
    setTick(Date.now());
    return r;
  }, [purchases, applyAccess]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...p };
      void kv.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const persistJobs = useCallback(async (list: Job[]) => {
    jobsRef.current = list;
    setJobs(list);
    await kv.setItem(JOBS_KEY, JSON.stringify(list));
  }, []);

  const value = useMemo<App>(() => {
    const trial = trialState(trialStart, tick);
    const unlocked = owned || trial.active || CAPTURE;
    const country = COUNTRIES[prefs.country ?? 'OTHER'];
    return {
      loaded, prefs, setPrefs, jobs, country, capture: CAPTURE,
      sp: (str: string) => spell(str, country.spelling),
      saveJob: job => persistJobs(upsertJob(jobsRef.current, job)),
      deleteJob: id => persistJobs(jobsRef.current.filter(j => j.id !== id)),
      owned, trial, unlocked,
      can: f => canUse(f, unlocked),
      purchases,
      buy: () => transact('buy'),
      startTrial: () => transact('startTrial'),
      restore: () => transact('restore'),
    };
  }, [loaded, prefs, setPrefs, jobs, persistJobs, owned, trialStart, tick, purchases, transact]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): App {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}
