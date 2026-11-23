/** App-wide state: prefs, the current roof, saved jobs and the trial/unlock. Everything stays on the device. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState, useColorScheme } from 'react-native';
import { makeCtx, type Ctx } from '../core/context';
import type { RoofInput } from '../core/geometry';
import { countryFor, type Country } from '../data';
import { loadKv } from '../native/kv';
import { createPurchaseProvider, type PurchaseProvider, type PurchaseResult, type StoreAccess } from '../plus/purchases';
import { t as storeText } from '../plus/messages';
import { readStoredTrial, saveStoredTrial, trialState, type TrialState } from '../plus/trial';
import { DARK, LIGHT, SUN, type Theme } from '../theme/theme';
import {
  addEntry, createJob, DEFAULT_PREFS, DEFAULT_ROOF, isFreeTool, parseJobs, parsePrefs, parseRoof, removeEntry, removeJob, updateJob,
  type Job, type JobEntry, type Prefs, type ToolId,
} from './model';

const PREFS_KEY = 'eaveline.prefs.v1';
const ROOF_KEY = 'eaveline.roof.v1';
const JOBS_KEY = 'eaveline.jobs.v1';
const ACTIVE_JOB_KEY = 'eaveline.activeJob.v1';
const UNLOCK_KEY = 'eaveline.unlock.v1';

/** Store screenshots build only (EXPO_PUBLIC_EAVELINE_CAPTURE=1): everything open, with a sample job. Never set for TestFlight/App Store. */
export const CAPTURE = process.env.EXPO_PUBLIC_EAVELINE_CAPTURE === '1';

export interface AppState {
  loaded: boolean;
  prefs: Prefs;
  setPrefs(patch: Partial<Prefs>): void;
  country: Country;
  ctx: Ctx;
  theme: Theme;
  roof: RoofInput;
  setRoof(r: RoofInput): void;
  jobs: Job[];
  activeJobId: string | null;
  setActiveJob(id: string | null): void;
  newJob(name: string): Job;
  saveToJob(entry: Omit<JobEntry, 'id' | 'at'>, jobId?: string | null): Job;
  editJob(id: string, patch: Partial<Pick<Job, 'name' | 'notes' | 'roof'>>): void;
  deleteEntry(jobId: string, entryId: string): void;
  deleteJob(id: string): void;
  unlocked: boolean;
  owned: boolean;
  trial: TrialState;
  can(tool: ToolId): boolean;
  purchases: PurchaseProvider;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const Ctx_ = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [kv] = useState(loadKv);
  const [purchases] = useState<PurchaseProvider>(() => createPurchaseProvider());
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [roof, setRoofState] = useState<RoofInput>(DEFAULT_ROOF);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const revision = useRef(0);
  const scheme = useColorScheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, r, j, a, u, tr] = await Promise.all([
        kv.getItem(PREFS_KEY).catch(() => null), kv.getItem(ROOF_KEY).catch(() => null), kv.getItem(JOBS_KEY).catch(() => null),
        kv.getItem(ACTIVE_JOB_KEY).catch(() => null), kv.getItem(UNLOCK_KEY).catch(() => null), readStoredTrial(kv, null),
      ]);
      if (!alive) return;
      const pr = parsePrefs(p);
      let list = parseJobs(j);
      let rf = parseRoof(r);
      let active = list.some(x => x.id === a) ? a : null;
      if (CAPTURE && !list.length) {
        rf = { type: 'hip', lengthMm: 14200, widthMm: 9600, pitchDeg: 22.5 };
        const made = createJob([], '14 Harbour View Rd', pr.country ?? 'AU', rf, Date.now());
        list = addEntry(made.jobs, made.job.id, { tool: 'sheets', title: 'Sheets · Corrugated', lines: ['46 sheets', '24 × 5 340 mm, 22 cut to the hips'] }, Date.now());
        active = made.job.id;
      }
      setPrefsState(pr);
      setRoofState(rf);
      setJobs(list);
      setActiveJobId(active);
      setOwned(u === '1');
      setTrialStart(tr);
      setLoaded(true);
    })();
    const sub = RNAppState.addEventListener('change', s => { if (s === 'active') setClock(Date.now()); });
    const tick = setInterval(() => setClock(Date.now()), 60_000);
    return () => { alive = false; sub.remove(); clearInterval(tick); };
  }, [kv]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState(cur => {
    const next = { ...cur, ...patch };
    void kv.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
    return next;
  }), [kv]);

  const setRoof = useCallback((r: RoofInput) => {
    setRoofState(r);
    void kv.setItem(ROOF_KEY, JSON.stringify(r)).catch(() => undefined);
  }, [kv]);

  const persistJobs = useCallback((next: Job[]) => {
    void kv.setItem(JOBS_KEY, JSON.stringify(next)).catch(() => undefined);
    return next;
  }, [kv]);

  const setActiveJob = useCallback((id: string | null) => {
    setActiveJobId(id);
    void kv.setItem(ACTIVE_JOB_KEY, id ?? '').catch(() => undefined);
  }, [kv]);

  // Job mutations read the latest list through a ref so a save right after "new job" lands on the new job.
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const commit = useCallback((next: Job[]) => { jobsRef.current = next; setJobs(persistJobs(next)); }, [persistJobs]);

  const newJob = useCallback((name: string) => {
    const made = createJob(jobsRef.current, name, prefs.country ?? 'XX', roof, Date.now());
    commit(made.jobs);
    setActiveJob(made.job.id);
    return made.job;
  }, [commit, prefs.country, roof, setActiveJob]);

  const saveToJob = useCallback((entry: Omit<JobEntry, 'id' | 'at'>, jobId?: string | null) => {
    let id = jobId ?? activeJobId;
    let list = jobsRef.current;
    if (!id || !list.some(j => j.id === id)) {
      const made = createJob(list, '', prefs.country ?? 'XX', roof, Date.now());
      list = made.jobs;
      id = made.job.id;
      setActiveJob(id);
    }
    const next = addEntry(list, id, entry, Date.now());
    commit(next);
    return next.find(j => j.id === id)!;
  }, [activeJobId, commit, prefs.country, roof, setActiveJob]);

  const editJob = useCallback((id: string, patch: Partial<Pick<Job, 'name' | 'notes' | 'roof'>>) => commit(updateJob(jobsRef.current, id, patch, Date.now())), [commit]);
  const deleteEntry = useCallback((jobId: string, entryId: string) => commit(removeEntry(jobsRef.current, jobId, entryId, Date.now())), [commit]);
  const deleteJob = useCallback((id: string) => {
    commit(removeJob(jobsRef.current, id));
    if (activeJobId === id) setActiveJob(null);
  }, [activeJobId, commit, setActiveJob]);

  const applyAccess = useCallback(async (access: StoreAccess) => {
    setOwned(access.plus);
    setTrialStart(access.trialStart);
    await Promise.all([
      kv.setItem(UNLOCK_KEY, access.plus ? '1' : '').catch(() => undefined),
      saveStoredTrial(kv, null, access.trialStart),
    ]);
  }, [kv]);

  const transact = useCallback(async (action: 'buy' | 'startTrial' | 'restore'): Promise<PurchaseResult> => {
    ++revision.current;
    const result = await purchases[action]().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: storeText('plus.failed', { code: 'E_STORE' }) }));
    ++revision.current;
    if (result.ok) await applyAccess(result.access);
    return result;
  }, [purchases, applyAccess]);

  // Re-read ownership from the App Store on launch and whenever the app comes back.
  useEffect(() => {
    if (!loaded) return;
    const rev = ++revision.current;
    let alive = true;
    void purchases.refresh().then(access => {
      if (alive && access && rev === revision.current) void applyAccess(access);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [loaded, clock, purchases, applyAccess]);

  const value = useMemo<AppState>(() => {
    const country = countryFor(prefs.country);
    const ctx = makeCtx(prefs.sys, prefs.pitchStyle, country.terms);
    const theme = prefs.theme === 'sun' ? SUN : prefs.theme === 'dark' ? DARK : prefs.theme === 'light' ? LIGHT : scheme === 'dark' ? DARK : LIGHT;
    const trial = trialState(trialStart, clock);
    const unlocked = CAPTURE || owned || trial.active;
    return {
      loaded, prefs, setPrefs, country, ctx, theme, roof, setRoof, jobs, activeJobId, setActiveJob, newJob, saveToJob, editJob, deleteEntry, deleteJob,
      unlocked, owned, trial, can: tool => unlocked || isFreeTool(tool), purchases,
      buy: () => transact('buy'), startTrial: () => transact('startTrial'), restore: () => transact('restore'),
    };
  }, [loaded, prefs, setPrefs, roof, setRoof, jobs, activeJobId, setActiveJob, newJob, saveToJob, editJob, deleteEntry, deleteJob, owned, trialStart, clock, scheme, purchases, transact]);

  return <Ctx_.Provider value={value}>{children}</Ctx_.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx_);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}
