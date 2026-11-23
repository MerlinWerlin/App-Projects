/**
 * App state: preferences, jobs, calculations and custom fittings (AsyncStorage, on the phone only), plus the
 * store entitlement (Full Unlock or the user-started 7-day Trial, verified with the App Store).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import {
  DEFAULT_PREFS, KEYS, addRecent, deleteJob as removeJob, newId, parseFittings, parseJobs, parsePrefs, parseRecords,
  type CalcRecord, type CustomFitting, type Job, type KvStore, type Prefs, type ToolId, MemoryKv,
} from './data';
import { createPurchaseProvider, type PurchaseProvider, type PurchaseResult, type StoreAccess } from '../plus/purchases';
import { readStoredTrial, saveStoredTrial, trialState, type TrialState } from '../plus/trial';
import { loadSecureStore } from '../native/secureStore';
import { t } from '../plus/messages';
import { PLUS_AUSTRALIA_PRICE } from '../plus/entitlement';

declare const require: (id: string) => unknown;

function loadKv(): KvStore {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as { default?: KvStore } & Partial<KvStore>;
    const m = mod?.default ?? (mod as KvStore);
    if (m && typeof m.getItem === 'function' && typeof m.setItem === 'function') return m;
  } catch { /* memory fallback */ }
  return new MemoryKv();
}

const UNLOCK_KEY = 'spigot.unlock.v1';
/** EXPO_PUBLIC_SPIGOT_CAPTURE=1 at bundle time (simulator screenshot builds only) shows the unlocked app. */
export const CAPTURE = process.env.EXPO_PUBLIC_SPIGOT_CAPTURE === '1';

export interface AppCtx {
  loaded: boolean;
  prefs: Prefs;
  setPrefs(p: Partial<Prefs>): void;
  jobs: Job[];
  records: CalcRecord[];
  fittings: CustomFitting[];
  createJob(name: string): Job;
  renameJob(id: string, name: string, notes?: string): void;
  deleteJob(id: string): void;
  /** Records the latest result of a tool as a recent calculation. */
  recordRecent(tool: ToolId, inputs: Record<string, unknown>, summary: string): void;
  /** Saves a result to a job; returns the saved record. */
  saveToJob(jobId: string, tool: ToolId, inputs: Record<string, unknown>, summary: string, note?: string): CalcRecord;
  deleteRecord(id: string): void;
  clearRecents(): void;
  saveFitting(f: Omit<CustomFitting, 'id'> & { id?: string }): CustomFitting;
  deleteFitting(id: string): void;
  /** Full Unlock bought, or the free trial running. */
  unlocked: boolean;
  owned: boolean;
  trial: TrialState;
  purchases: PurchaseProvider;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [kv] = useState(loadKv);
  const [secure] = useState(() => loadSecureStore());
  // Capture builds (simulator screenshots only) have no App Store: show the Australian list price on the paywall.
  const [purchases] = useState<PurchaseProvider>(() => {
    const p = createPurchaseProvider();
    return CAPTURE ? { ...p, price: async () => PLUS_AUSTRALIA_PRICE } : p;
  });
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [records, setRecords] = useState<CalcRecord[]>([]);
  const [fittings, setFittings] = useState<CustomFitting[]>([]);
  const [owned, setOwned] = useState(false);
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const revision = useRef(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [p, j, r, f, u, ts] = await Promise.all([
        kv.getItem(KEYS.prefs).catch(() => null),
        kv.getItem(KEYS.jobs).catch(() => null),
        kv.getItem(KEYS.records).catch(() => null),
        kv.getItem(KEYS.fittings).catch(() => null),
        kv.getItem(UNLOCK_KEY).catch(() => null),
        readStoredTrial(kv, secure).catch(() => null),
      ]);
      if (!alive) return;
      setPrefsState(parsePrefs(p));
      setJobs(parseJobs(j));
      setRecords(parseRecords(r));
      setFittings(parseFittings(f));
      setOwned(u === 'owned');
      setTrialStart(ts);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [kv, secure]);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', s => { if (s === 'active') setClock(Date.now()); });
    return () => sub.remove();
  }, []);

  const persist = useCallback((key: string, value: unknown) => { void kv.setItem(key, JSON.stringify(value)).catch(() => undefined); }, [kv]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState(prev => { const next = { ...prev, ...p }; persist(KEYS.prefs, next); return next; });
  }, [persist]);

  const updateJobs = useCallback((fn: (j: Job[]) => Job[]) => setJobs(prev => { const n = fn(prev); persist(KEYS.jobs, n); return n; }), [persist]);
  const updateRecords = useCallback((fn: (r: CalcRecord[]) => CalcRecord[]) => setRecords(prev => { const n = fn(prev); persist(KEYS.records, n); return n; }), [persist]);
  const updateFittings = useCallback((fn: (r: CustomFitting[]) => CustomFitting[]) => setFittings(prev => { const n = fn(prev); persist(KEYS.fittings, n); return n; }), [persist]);

  const touchJob = useCallback((id: string) => updateJobs(js => js.map(j => (j.id === id ? { ...j, updatedAt: Date.now() } : j))), [updateJobs]);

  const applyAccess = useCallback(async (access: StoreAccess) => {
    revision.current += 1;
    setOwned(access.plus);
    setTrialStart(access.trialStart);
    await Promise.all([
      kv.setItem(UNLOCK_KEY, access.plus ? 'owned' : '').catch(() => undefined),
      saveStoredTrial(kv, secure, access.trialStart),
    ]);
  }, [kv, secure]);

  const transact = useCallback(async (action: 'buy' | 'startTrial' | 'restore') => {
    const result = await purchases[action]().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: t('plus.failed', { code: 'E_STORE' }) }));
    if (result.ok) await applyAccess(result.access);
    return result;
  }, [purchases, applyAccess]);

  // Re-check ownership with the App Store when the app opens or comes back (refunds, family sharing, restore).
  useEffect(() => {
    if (!loaded || CAPTURE) return;
    let alive = true;
    const rev = revision.current;
    void purchases.refresh().then(access => { if (alive && access && rev === revision.current) void applyAccess(access); });
    return () => { alive = false; };
  }, [loaded, clock, purchases, applyAccess]);

  const value = useMemo<AppCtx>(() => {
    const trial = trialState(trialStart, clock);
    return {
      loaded, prefs, setPrefs, jobs, records, fittings,
      createJob(name) {
        const now = Date.now();
        const job: Job = { id: newId(now), name: name.trim().slice(0, 80) || 'Untitled job', notes: '', createdAt: now, updatedAt: now };
        updateJobs(js => [job, ...js]);
        return job;
      },
      renameJob(id, name, notes) {
        updateJobs(js => js.map(j => (j.id === id ? { ...j, name: name.trim().slice(0, 80) || j.name, notes: notes !== undefined ? notes.slice(0, 4000) : j.notes, updatedAt: Date.now() } : j)));
      },
      deleteJob(id) {
        const next = removeJob(jobs, records, id);
        updateJobs(() => next.jobs);
        updateRecords(() => next.records);
      },
      recordRecent(tool, inputs, summary) {
        const now = Date.now();
        updateRecords(rs => addRecent(rs, { id: newId(now), tool, inputs, summary, createdAt: now, jobId: null }));
      },
      saveToJob(jobId, tool, inputs, summary, note) {
        const now = Date.now();
        const rec: CalcRecord = { id: newId(now), tool, inputs, summary, createdAt: now, jobId, ...(note ? { note: note.slice(0, 500) } : {}) };
        updateRecords(rs => [rec, ...rs]);
        touchJob(jobId);
        return rec;
      },
      deleteRecord(id) { updateRecords(rs => rs.filter(r => r.id !== id)); },
      clearRecents() { updateRecords(rs => rs.filter(r => r.jobId !== null)); },
      saveFitting(f) {
        const fit: CustomFitting = { id: f.id ?? newId(Date.now()), name: f.name.trim().slice(0, 60) || 'Custom fitting', centreToEnd: f.centreToEnd, engagement: f.engagement };
        updateFittings(fs => (fs.some(x => x.id === fit.id) ? fs.map(x => (x.id === fit.id ? fit : x)) : [...fs, fit]));
        return fit;
      },
      deleteFitting(id) { updateFittings(fs => fs.filter(f => f.id !== id)); },
      unlocked: CAPTURE || owned || trial.active,
      owned,
      trial,
      purchases,
      buy: () => transact('buy'),
      startTrial: () => transact('startTrial'),
      restore: () => transact('restore'),
    };
  }, [loaded, prefs, setPrefs, jobs, records, fittings, owned, trialStart, clock, purchases, transact, updateJobs, updateRecords, updateFittings, touchJob]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
