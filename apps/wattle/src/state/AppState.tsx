/**
 * App-wide state: preferences, saved jobs and the Full Unlock / trial entitlement. Everything is stored on the
 * device (AsyncStorage; the trial date also in the Keychain so it survives a reinstall). Nothing is uploaded.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState, useColorScheme } from 'react-native';
import { JOBS_KEY, parseJobs, type JobsDoc, type KvStore, MemoryKv } from '../core/jobs.ts';
import { ENTITLEMENT_KEY, canUse, parseEntitlement, type Feature, type Tier } from '../plus/entitlement.ts';
import { createPurchaseProvider, type PurchaseProvider, type PurchaseResult, type StoreAccess } from '../plus/purchases.ts';
import { readStoredTrial, saveStoredTrial, trialState, type TrialState } from '../plus/trial.ts';
import { THEMES, type Theme } from '../theme/theme.ts';
import { CAPTURE } from '../capture.ts';

declare const require: (id: string) => unknown;

export type Units = 'metric' | 'imperial';
export type ThemePref = 'system' | 'dark' | 'light' | 'sunlight';

export interface Prefs {
  version: 1;
  units: Units;
  theme: ThemePref;
  haptics: boolean;
  /** Voltage-drop budget for the circuit, %. */
  vdLimit: number;
  /** The first-launch safety notice was acknowledged. */
  noticeSeen: boolean;
}

const PREFS_KEY = 'wattle.prefs.v1';
export const DEFAULT_PREFS: Prefs = { version: 1, units: 'metric', theme: 'system', haptics: true, vdLimit: 5, noticeSeen: false };

export function parsePrefs(raw: string | null): Prefs {
  try {
    const p = raw ? (JSON.parse(raw) as Partial<Prefs>) : null;
    if (!p || p.version !== 1) return DEFAULT_PREFS;
    return {
      version: 1,
      units: p.units === 'imperial' ? 'imperial' : 'metric',
      theme: p.theme === 'dark' || p.theme === 'light' || p.theme === 'sunlight' ? p.theme : 'system',
      haptics: p.haptics !== false,
      vdLimit: typeof p.vdLimit === 'number' && p.vdLimit > 0 && p.vdLimit < 100 ? p.vdLimit : 5,
      noticeSeen: p.noticeSeen === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function loadKv(): KvStore {
  try {
    const mod = require('@react-native-async-storage/async-storage') as { default?: KvStore } & Partial<KvStore>;
    const m = mod?.default ?? (mod as KvStore);
    if (m && typeof m.getItem === 'function' && typeof m.setItem === 'function') return m;
  } catch { /* fall through */ }
  return new MemoryKv();
}

function loadSecure(): KvStore | null {
  try {
    const m = require('expo-secure-store') as { getItemAsync?: (k: string, o?: object) => Promise<string | null>; setItemAsync?: (k: string, v: string, o?: object) => Promise<void>; AFTER_FIRST_UNLOCK?: unknown };
    if (typeof m?.getItemAsync !== 'function' || typeof m.setItemAsync !== 'function') return null;
    const o = m.AFTER_FIRST_UNLOCK !== undefined ? { keychainAccessible: m.AFTER_FIRST_UNLOCK } : undefined;
    const get = m.getItemAsync.bind(m);
    const set = m.setItemAsync.bind(m);
    return { getItem: k => get(k, o), setItem: (k, v) => set(k, v, o) };
  } catch {
    return null;
  }
}

interface Ctx {
  loaded: boolean;
  prefs: Prefs;
  setPrefs(patch: Partial<Prefs>): void;
  theme: Theme;
  jobs: JobsDoc;
  updateJobs(fn: (d: JobsDoc) => JobsDoc): void;
  tier: Tier;
  trial: TrialState;
  unlocked: boolean;
  can(f: Feature): boolean;
  purchases: PurchaseProvider;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [kv] = useState(loadKv);
  const [secure] = useState(loadSecure);
  const [purchases] = useState<PurchaseProvider>(() => createPurchaseProvider());
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [jobs, setJobs] = useState<JobsDoc>({ version: 1, jobs: [] });
  const [tier, setTier] = useState<Tier>('free');
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const scheme = useColorScheme();
  const jobsRef = useRef(jobs);

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
      setPrefsState(CAPTURE ? { ...parsePrefs(p), noticeSeen: true } : parsePrefs(p));
      const doc = parseJobs(j);
      jobsRef.current = doc;
      setJobs(doc);
      setTier(parseEntitlement(e).tier);
      setTrialStart(t);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [kv, secure]);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', s => { if (s === 'active') setClock(Date.now()); });
    return () => sub.remove();
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...patch };
      kv.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [kv]);

  const updateJobs = useCallback((fn: (d: JobsDoc) => JobsDoc) => {
    const next = fn(jobsRef.current);
    jobsRef.current = next;
    setJobs(next);
    kv.setItem(JOBS_KEY, JSON.stringify(next)).catch(() => undefined);
  }, [kv]);

  const applyAccess = useCallback((access: StoreAccess, source: 'purchase' | 'restore') => {
    setTier(access.plus ? 'full' : 'free');
    setTrialStart(prev => access.trialStart ?? prev);
    kv.setItem(ENTITLEMENT_KEY, JSON.stringify({ version: 1, tier: access.plus ? 'full' : 'free', source: access.plus ? source : 'none', updatedAt: Date.now() })).catch(() => undefined);
    if (access.trialStart !== null) void saveStoredTrial(kv, secure, access.trialStart);
    setClock(Date.now());
  }, [kv, secure]);

  const transact = useCallback(async (kind: 'buy' | 'startTrial' | 'restore') => {
    const r = await purchases[kind]().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: "The purchase didn't go through and nothing was charged. [E_STORE]" }));
    if (r.ok) applyAccess(r.access, kind === 'restore' ? 'restore' : 'purchase');
    return r;
  }, [purchases, applyAccess]);

  // Quiet store check on launch and on return to the app: keeps a refund or a restore on another device in step.
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    void purchases.refresh().then(access => {
      if (!alive || !access) return;
      if (access.plus || access.trialStart !== null) applyAccess(access, 'restore');
      else setTier('free');
    });
    return () => { alive = false; };
  }, [loaded, clock, purchases, applyAccess]);

  const value = useMemo<Ctx>(() => {
    const name = prefs.theme === 'system' ? (scheme === 'light' ? 'light' : 'dark') : prefs.theme;
    const trial = trialState(trialStart, clock);
    const unlocked = CAPTURE || tier === 'full' || trial.active;
    return {
      loaded, prefs, setPrefs, theme: THEMES[name], jobs, updateJobs, tier, trial, unlocked,
      can: f => canUse(unlocked, f), purchases,
      buy: () => transact('buy'), startTrial: () => transact('startTrial'), restore: () => transact('restore'),
    };
  }, [loaded, prefs, setPrefs, scheme, jobs, updateJobs, tier, trialStart, clock, purchases, transact]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppStateProvider');
  return c;
}
