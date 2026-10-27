/**
 * One provider for scripts, prefs and the Plus entitlement. Loads once at startup (the splash stays up
 * until `loaded`, so there is no empty-list or "index" flash), then writes through to storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState as RNAppState, useColorScheme } from 'react-native';
import { LIBRARY_KEY, WELCOME_BODY, makeScript, parseLibrary, serializeLibrary, sortScripts, upsert, type Script } from '../core/library';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, type Prefs } from '../core/prefs';
import { ENTITLEMENT_KEY, canUse, parseEntitlement, type PlusFeature, type Tier } from '../plus/entitlement';
import { createPurchaseProvider, type PurchaseProvider, type PurchaseResult, type StoreAccess } from '../plus/purchases';
import { t } from '../i18n';
import { readStoredTrial, saveStoredTrial, trialState, type TrialState } from '../plus/trial';
import { loadKv } from '../native/kv';
import { loadSecureStore } from '../native/secureStore';
import { DARK, LIGHT, type Theme } from '../theme/theme';

interface AppState {
  loaded: boolean;
  scripts: Script[];
  prefs: Prefs;
  tier: Tier;
  /** Seven days from the user-started free App Store trial transaction. */
  trial: TrialState;
  theme: Theme;
  reduceMotion: boolean;
  purchases: PurchaseProvider;
  getScript(id: string): Script | undefined;
  saveScript(s: Script): void;
  createScript(body?: string, title?: string): Script;
  deleteScript(id: string): void;
  setPrefs(patch: Partial<Prefs>): void;
  can(f: PlusFeature): boolean;
  buyPlus(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restorePlus(): Promise<PurchaseResult>;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [kv] = useState(() => loadKv());
  const [purchases] = useState<PurchaseProvider>(() => createPurchaseProvider());
  const [secure] = useState(() => loadSecureStore());
  const accessRevision = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [tier, setTier] = useState<Tier>('free');
  const [trialStart, setTrialStart] = useState<number | null>(null);
  // Bumped when the app comes back to the foreground so the trial's days-left stays current.
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [sysReduce, setSysReduce] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [lib, p, ent, first] = await Promise.all([
        kv.getItem(LIBRARY_KEY).catch(() => null),
        kv.getItem(PREFS_KEY).catch(() => null),
        kv.getItem(ENTITLEMENT_KEY).catch(() => null),
        readStoredTrial(kv, secure),
      ]);
      if (!alive) return;
      let list = parseLibrary(lib);
      const pr = parsePrefs(p);
      if (!pr.seenWelcome && list.length === 0) {
        list = [makeScript(WELCOME_BODY, '')];
        pr.seenWelcome = true;
        void kv.setItem(LIBRARY_KEY, serializeLibrary(list)).catch(() => undefined);
        void kv.setItem(PREFS_KEY, JSON.stringify(pr)).catch(() => undefined);
      }
      setScripts(sortScripts(list));
      setPrefsState(pr);
      setTier(parseEntitlement(ent).tier);
      setTrialStart(first);
      setLoaded(true);
    })();
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setSysReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSysReduce);
    const appSub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') setClockTick(Date.now());
    });
    return () => {
      alive = false;
      sub.remove();
      appSub.remove();
    };
  }, [kv, secure]);

  const persistScripts = useCallback(
    (next: Script[]) => {
      void kv.setItem(LIBRARY_KEY, serializeLibrary(next)).catch(() => undefined);
      return next;
    },
    [kv],
  );

  const saveScript = useCallback(
    (s: Script) => setScripts((cur) => persistScripts(sortScripts(upsert(cur, { ...s, updatedAt: Date.now() })))),
    [persistScripts],
  );

  const createScript = useCallback(
    (body = '', title = '') => {
      const s = makeScript(body, title);
      setScripts((cur) => persistScripts(sortScripts(upsert(cur, s))));
      return s;
    },
    [persistScripts],
  );

  const deleteScript = useCallback(
    (id: string) => setScripts((cur) => persistScripts(cur.filter((s) => s.id !== id))),
    [persistScripts],
  );

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) =>
      setPrefsState((cur) => {
        const next = { ...cur, ...patch };
        void kv.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
        return next;
      }),
    [kv],
  );

  const applyAccess = useCallback(async (access: StoreAccess, source: 'purchase' | 'restore') => {
    setTier(access.plus ? 'plus' : 'free');
    setTrialStart(access.trialStart);
    await Promise.all([
      kv.setItem(ENTITLEMENT_KEY, JSON.stringify({ version: 1, tier: access.plus ? 'plus' : 'free', source: access.plus ? source : 'none', updatedAt: Date.now() })).catch(() => undefined),
      saveStoredTrial(kv, secure, access.trialStart),
    ]);
  }, [kv, secure]);

  const transact = useCallback(async (action: 'buy' | 'startTrial' | 'restore'): Promise<PurchaseResult> => {
    ++accessRevision.current;
    const result = await purchases[action]().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: t('plus.failed', { code: 'E_STORE' }) }));
    ++accessRevision.current;
    if (result.ok) await applyAccess(result.access, action === 'restore' ? 'restore' : 'purchase');
    return result;
  }, [purchases, applyAccess]);

  useEffect(() => {
    if (!loaded) return;
    const revision = ++accessRevision.current;
    let alive = true;
    void purchases.refresh().then(access => {
      if (alive && access && revision === accessRevision.current) void applyAccess(access, 'restore');
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [loaded, clockTick, purchases, applyAccess]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const value = useMemo<AppState>(() => {
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && scheme === 'dark');
    const reduceMotion = prefs.reduceMotion === 'on' || (prefs.reduceMotion === 'system' && sysReduce);
    const trial = trialState(trialStart, clockTick);
    const unlocked = tier === 'plus' || trial.active;
    return {
      loaded,
      scripts,
      prefs,
      tier,
      trial,
      theme: dark ? DARK : LIGHT,
      reduceMotion,
      purchases,
      getScript: (id) => scripts.find((s) => s.id === id),
      saveScript,
      createScript,
      deleteScript,
      setPrefs,
      can: (f) => unlocked || canUse(tier, f),
      buyPlus: () => transact('buy'),
      startTrial: () => transact('startTrial'),
      restorePlus: () => transact('restore'),
    };
  }, [loaded, scripts, prefs, tier, trialStart, clockTick, scheme, sysReduce, purchases, saveScript, createScript, deleteScript, setPrefs, transact]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}
