/**
 * One provider for scripts, prefs and the Plus entitlement. Loads once at startup (the splash stays up
 * until `loaded`, so there is no empty-list or "index" flash), then writes through to storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState as RNAppState, useColorScheme } from 'react-native';
import { LIBRARY_KEY, WELCOME_BODY, makeScript, parseLibrary, serializeLibrary, sortScripts, upsert, type Script } from '../core/library';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, type Prefs } from '../core/prefs';
import { ENTITLEMENT_KEY, canUse, parseEntitlement, type PlusFeature, type Tier } from '../plus/entitlement';
import { StubPurchaseProvider, type PurchaseProvider, type PurchaseResult } from '../plus/purchases';
import { t } from '../i18n';
import { resolveFirstLaunch, trialState, type TrialState } from '../plus/trial';
import { loadKv } from '../native/kv';
import { loadSecureStore } from '../native/secureStore';
import { DARK, LIGHT, type Theme } from '../theme/theme';

interface AppState {
  loaded: boolean;
  scripts: Script[];
  prefs: Prefs;
  tier: Tier;
  /** 7-day Plus trial from the first launch (survives reinstall via the Keychain). */
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
  restorePlus(): Promise<PurchaseResult>;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const kv = useRef(loadKv()).current;
  const purchases = useRef<PurchaseProvider>(new StubPurchaseProvider(() => t('plus.unavailable'))).current;
  const [loaded, setLoaded] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [tier, setTier] = useState<Tier>('free');
  const [firstLaunch, setFirstLaunch] = useState(() => Date.now());
  // Bumped when the app comes back to the foreground so the trial's days-left stays current.
  const [clockTick, setClockTick] = useState(0);
  const [sysReduce, setSysReduce] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [lib, p, ent, first] = await Promise.all([
        kv.getItem(LIBRARY_KEY).catch(() => null),
        kv.getItem(PREFS_KEY).catch(() => null),
        kv.getItem(ENTITLEMENT_KEY).catch(() => null),
        resolveFirstLaunch(kv, loadSecureStore(), Date.now()).catch(() => Date.now()),
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
      setFirstLaunch(first);
      setLoaded(true);
    })();
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setSysReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSysReduce);
    const appSub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') setClockTick((n) => n + 1);
    });
    return () => {
      alive = false;
      sub.remove();
      appSub.remove();
    };
  }, [kv]);

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

  const grant = useCallback(
    async (source: 'purchase' | 'restore') => {
      setTier('plus');
      await kv.setItem(ENTITLEMENT_KEY, JSON.stringify({ version: 1, tier: 'plus', source, updatedAt: Date.now() }));
    },
    [kv],
  );

  const value = useMemo<AppState>(() => {
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && scheme === 'dark');
    const reduceMotion = prefs.reduceMotion === 'on' || (prefs.reduceMotion === 'system' && sysReduce);
    const trial = trialState(firstLaunch, Date.now());
    // Plus features are open while the 7-day trial runs. Until real purchases are switched on (stub
    // provider), test builds also get every Plus feature: there is no way to buy Plus yet.
    const unlocked = tier === 'plus' || trial.active || !purchases.available;
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
      buyPlus: async () => {
        const r = await purchases.buy().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: t('error.unknown') }));
        if (r.ok) await grant('purchase');
        return r;
      },
      restorePlus: async () => {
        const r = await purchases.restore().catch((): PurchaseResult => ({ ok: false, reason: 'failed', message: t('error.unknown') }));
        if (r.ok) await grant('restore');
        return r;
      },
    };
    // clockTick only forces a re-read of Date.now() for the trial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scripts, prefs, tier, firstLaunch, clockTick, scheme, sysReduce, purchases, saveScript, createScript, deleteScript, setPrefs, grant]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}
