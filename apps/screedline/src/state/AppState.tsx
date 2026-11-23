import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState, useColorScheme } from 'react-native';
import { addItem, type Job, type JobItem, JOBS_KEY, makeJob, newId, parseJobs, removeItem, updateJob } from '../core/jobs';
import type { UnitSystem } from '../core/units';
import { type Access, FREE_JOB_LIMIT, parseAccess, parseStamp, trialState, type TrialState, unlocked } from '../plus/entitlement';
import { createPurchaseProvider, type PurchaseResult } from '../plus/purchases';
import { haptic, loadKv, loadSecureStore } from '../native/store';
import { CAPTURE, demoJobs } from './capture';
import { type Appearance, resolveTheme, type Theme } from '../theme/theme';
import { toolById, type Values } from '../tools/registry';

export interface Prefs { units: UnitSystem; appearance: Appearance; haptics: boolean; waste: number; welcomeDone: boolean }
const DEFAULT_PREFS: Prefs = { units: 'metric', appearance: 'system', haptics: true, waste: 5, welcomeDone: false };
const PREFS_KEY = 'screedline.prefs.v1';
const ACCESS_KEY = 'screedline.access.v1';
const TRIAL_KEY = 'screedline.trialStart.v1';
const DRAFTS_KEY = 'screedline.drafts.v1';

interface Ctx {
  loaded: boolean;
  theme: Theme;
  prefs: Prefs;
  setPrefs(p: Partial<Prefs>): void;
  access: Access;
  trial: TrialState;
  isUnlocked: boolean;
  canUse(toolId: string): boolean;
  price: string | null;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
  jobs: Job[];
  canAddJob: boolean;
  createJob(name: string): Job | null;
  saveToJob(jobId: string, item: Omit<JobItem, 'id' | 'savedAt'>): void;
  patchJob(jobId: string, patch: Partial<Pick<Job, 'name' | 'notes' | 'checks'>>): void;
  deleteJob(jobId: string): void;
  deleteItem(jobId: string, itemId: string): void;
  drafts: Record<string, Values>;
  setDraft(toolId: string, v: Values): void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const kv = useMemo(loadKv, []);
  const secure = useMemo(loadSecureStore, []);
  const store = useMemo(() => createPurchaseProvider(), []);
  const scheme = useColorScheme();
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [access, setAccess] = useState<Access>({ full: false, trialStart: null });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Values>>({});
  const [price, setPrice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistAccess = useCallback((a: Access) => {
    setAccess(a);
    kv.setItem(ACCESS_KEY, JSON.stringify(a)).catch(() => undefined);
    if (a.trialStart) secure?.setItem(TRIAL_KEY, String(a.trialStart)).catch(() => undefined);
  }, [kv, secure]);

  // Load everything once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, a, j, d, t] = await Promise.all([
        kv.getItem(PREFS_KEY).catch(() => null), kv.getItem(ACCESS_KEY).catch(() => null), kv.getItem(JOBS_KEY).catch(() => null),
        kv.getItem(DRAFTS_KEY).catch(() => null), secure?.getItem(TRIAL_KEY).catch(() => null) ?? Promise.resolve(null),
      ]);
      if (!alive) return;
      try { setPrefsState({ ...DEFAULT_PREFS, ...(p ? JSON.parse(p) : {}) }); } catch { /* defaults */ }
      const stored = parseAccess(a);
      const kept = parseStamp(t);
      const trialStart = [stored.trialStart, kept].filter((x): x is number => x !== null).sort((x, y) => x - y)[0] ?? null;
      setAccess({ full: stored.full, trialStart });
      const savedJobs = parseJobs(j);
      setJobs(CAPTURE && !savedJobs.length ? demoJobs(Date.now()) : savedJobs);
      try { setDrafts(d ? JSON.parse(d) : {}); } catch { /* none */ }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [kv, secure]);

  // After loading, check the store (never blocks the UI) and fetch the price.
  const refresh = useCallback(async () => {
    const live = await store.refresh();
    if (live) {
      setAccess(prev => {
        const dates = [prev.trialStart, live.trialStart].filter((x): x is number => x !== null);
        const next = { full: live.full, trialStart: dates.length ? Math.min(...dates) : null };
        kv.setItem(ACCESS_KEY, JSON.stringify(next)).catch(() => undefined);
        if (next.trialStart) secure?.setItem(TRIAL_KEY, String(next.trialStart)).catch(() => undefined);
        return next;
      });
    }
    const p = await store.price();
    if (p) setPrice(p);
  }, [store, kv, secure]);
  useEffect(() => { if (loaded) void refresh(); }, [loaded, refresh]);
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', s => { if (s === 'active') setNow(Date.now()); });
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => { sub.remove(); clearInterval(id); };
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...patch };
      kv.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [kv]);

  const writeJobs = useCallback((fn: (j: Job[]) => Job[]) => {
    setJobs(prev => {
      const next = fn(prev);
      kv.setItem(JOBS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [kv]);

  const isUnlocked = CAPTURE || unlocked(access, now);
  const canAddJob = isUnlocked || jobs.length < FREE_JOB_LIMIT;

  const handle = useCallback(async (p: Promise<PurchaseResult>) => {
    const r = await p;
    if (r.ok) { persistAccess(r.access); haptic.success(prefs.haptics); setNow(Date.now()); }
    return r;
  }, [persistAccess, prefs.haptics]);

  const value: Ctx = {
    loaded,
    theme: resolveTheme(prefs.appearance, scheme),
    prefs, setPrefs,
    access, trial: trialState(access.trialStart, now), isUnlocked,
    canUse: id => isUnlocked || !!toolById(id)?.free,
    price,
    buy: () => handle(store.buy()),
    startTrial: () => handle(store.startTrial()),
    restore: () => handle(store.restore()),
    jobs, canAddJob,
    createJob(name) {
      if (!canAddJob) return null;
      const job = makeJob(name, Date.now());
      writeJobs(j => [job, ...j]);
      return job;
    },
    saveToJob(jobId, item) {
      const t = Date.now();
      writeJobs(j => addItem(j, jobId, { ...item, id: newId(t), savedAt: t }, t));
      haptic.success(prefs.haptics);
    },
    patchJob: (jobId, patch) => writeJobs(j => updateJob(j, jobId, patch, Date.now())),
    deleteJob: jobId => writeJobs(j => j.filter(x => x.id !== jobId)),
    deleteItem: (jobId, itemId) => writeJobs(j => removeItem(j, jobId, itemId, Date.now())),
    drafts,
    setDraft(toolId, v) {
      setDrafts(prev => {
        const next = { ...prev, [toolId]: v };
        if (draftTimer.current) clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => kv.setItem(DRAFTS_KEY, JSON.stringify(next)).catch(() => undefined), 400);
        return next;
      });
    },
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
