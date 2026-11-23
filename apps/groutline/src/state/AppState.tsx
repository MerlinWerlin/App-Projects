/**
 * App state: country and unit preferences, saved jobs, and Full Unlock / trial access. Everything is stored on the
 * phone only (AsyncStorage, plus the trial date in the Keychain so a reinstall can't restart it). Nothing is sent
 * anywhere: Apple handles purchases.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { countryForRegion, getCountry, systemFor, type Country, type CountryCode } from '../countries/index.ts';
import type { KvStore } from '../core/kv.ts';
import type { UnitSystem } from '../core/units.ts';
import { isFree, type ToolId } from '../plus/entitlement.ts';
import { createPurchaseProvider, type PurchaseProvider, type PurchaseResult, type StoreAccess } from '../plus/purchases.ts';
import { readStoredTrial, saveStoredTrial, trialState, type TrialState } from '../plus/trial.ts';
import { parseJobs, type Job } from './jobs.ts';

const PREFS_KEY = 'groutline.prefs.v1';
const JOBS_KEY = 'groutline.jobs.v1';
const ACCESS_KEY = 'groutline.access.v1';

export interface Prefs { country: CountryCode | null; units: UnitSystem | null; haptics: boolean }
const DEFAULT_PREFS: Prefs = { country: null, units: null, haptics: true };

const kv: KvStore = {
  getItem: k => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};
const secure: KvStore = {
  getItem: k => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
};

export interface AppValue {
  ready: boolean;
  prefs: Prefs;
  country: Country;
  system: UnitSystem;
  /** The country the phone's region points at, for pre-selecting the picker. */
  suggestedCountry: Country;
  setPrefs(p: Partial<Prefs>): void;
  jobs: Job[];
  saveJob(job: Job): void;
  deleteJob(id: string): void;
  unlocked: boolean;
  /** Full Unlock bought (not just the trial). */
  owned: boolean;
  trial: TrialState;
  canUse(tool: ToolId): boolean;
  purchases: PurchaseProvider;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [access, setAccess] = useState<StoreAccess>({ plus: false, trialStart: null });
  const [now, setNow] = useState(Date.now());
  const purchases = useMemo(() => createPurchaseProvider(), []);
  const accessRef = useRef(access);
  accessRef.current = access;

  const suggestedCountry = useMemo(() => {
    try { return countryForRegion(Localization.getLocales()[0]?.regionCode); } catch { return countryForRegion(null); }
  }, []);

  const applyAccess = useCallback(async (next: StoreAccess) => {
    // Keep the earliest trial date ever seen, so Restore or a reinstall never restarts it.
    const stored = await readStoredTrial(kv, secure).catch(() => null);
    const dates = [next.trialStart, stored, accessRef.current.trialStart].filter((d): d is number => d !== null);
    const merged: StoreAccess = { plus: next.plus, trialStart: dates.length ? Math.min(...dates) : null };
    setAccess(merged);
    await AsyncStorage.setItem(ACCESS_KEY, JSON.stringify(merged)).catch(() => undefined);
    if (merged.trialStart !== null) await saveStoredTrial(kv, secure, merged.trialStart);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [p, j, a] = await Promise.all([AsyncStorage.getItem(PREFS_KEY), AsyncStorage.getItem(JOBS_KEY), AsyncStorage.getItem(ACCESS_KEY)]);
        if (p) setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(p) });
        setJobs(parseJobs(j));
        if (a) {
          const parsed = JSON.parse(a) as StoreAccess;
          setAccess({ plus: parsed.plus === true, trialStart: typeof parsed.trialStart === 'number' ? parsed.trialStart : null });
        }
        const storedTrial = await readStoredTrial(kv, secure).catch(() => null);
        if (storedTrial !== null) setAccess(x => ({ ...x, trialStart: x.trialStart === null ? storedTrial : Math.min(x.trialStart, storedTrial) }));
      } catch { /* corrupt storage: start fresh rather than crash */ }
      setReady(true);
    })();
  }, []);

  // Check the store quietly after launch and whenever the app comes back to the front. A failed read keeps the last
  // verified access, so a tiler with no signal on site is never locked out of what they bought.
  useEffect(() => {
    if (!ready) return;
    const check = () => { setNow(Date.now()); void purchases.refresh().then(r => { if (r) void applyAccess(r); }); };
    check();
    const sub = RNAppState.addEventListener('change', s => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [ready, purchases, applyAccess]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...p };
      void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const persistJobs = (list: Job[]) => { void AsyncStorage.setItem(JOBS_KEY, JSON.stringify(list)).catch(() => undefined); };
  const saveJob = useCallback((job: Job) => {
    setJobs(prev => {
      const next = [job, ...prev.filter(j => j.id !== job.id)].sort((a, b) => b.updatedAt - a.updatedAt);
      persistJobs(next);
      return next;
    });
  }, []);
  const deleteJob = useCallback((id: string) => {
    setJobs(prev => { const next = prev.filter(j => j.id !== id); persistJobs(next); return next; });
  }, []);

  const trial = trialState(access.trialStart, now);
  const unlocked = access.plus || trial.active;
  const country = getCountry(prefs.country ?? suggestedCountry.code);
  const system = systemFor(country, prefs.units);

  const wrap = (fn: () => Promise<PurchaseResult>) => async () => {
    const r = await fn();
    if (r.ok) { await applyAccess(r.access); setNow(Date.now()); }
    return r;
  };

  const value: AppValue = {
    ready, prefs, country, system, suggestedCountry, setPrefs, jobs, saveJob, deleteJob,
    unlocked, owned: access.plus, trial, canUse: tool => unlocked || isFree(tool), purchases,
    buy: wrap(() => purchases.buy()), startTrial: wrap(() => purchases.startTrial()), restore: wrap(() => purchases.restore()),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
