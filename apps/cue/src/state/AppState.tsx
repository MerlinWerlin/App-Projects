/**
 * One provider for scripts, prefs and the Plus entitlement. Loads once at startup (the splash stays up
 * until `loaded`, so there is no empty-list or "index" flash), then writes through to storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { LIBRARY_KEY, WELCOME_BODY, makeScript, parseLibrary, serializeLibrary, sortScripts, upsert, type Script } from '../core/library';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, type Prefs } from '../core/prefs';
import { ENTITLEMENT_KEY, VOICE_FREE_READS, canUse, parseEntitlement, type PlusFeature, type Tier } from '../plus/entitlement';
import { StubPurchaseProvider, type PurchaseProvider, type PurchaseResult } from '../plus/purchases';
import { t } from '../i18n';
import { loadKv } from '../native/kv';
import { DARK, LIGHT, type Theme } from '../theme/theme';

const VOICE_USED_KEY = 'cue.voiceReads.v1';

interface AppState {
  loaded: boolean;
  scripts: Script[];
  prefs: Prefs;
  tier: Tier;
  voiceReadsLeft: number;
  theme: Theme;
  reduceMotion: boolean;
  purchases: PurchaseProvider;
  getScript(id: string): Script | undefined;
  saveScript(s: Script): void;
  createScript(body?: string, title?: string): Script;
  deleteScript(id: string): void;
  setPrefs(patch: Partial<Prefs>): void;
  can(f: PlusFeature): boolean;
  /** Counts one Voice Pace read against the free allowance; false when none are left. */
  consumeVoiceRead(): boolean;
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
  const [voiceUsed, setVoiceUsed] = useState(0);
  const [sysReduce, setSysReduce] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [lib, p, ent, used] = await Promise.all([
        kv.getItem(LIBRARY_KEY).catch(() => null),
        kv.getItem(PREFS_KEY).catch(() => null),
        kv.getItem(ENTITLEMENT_KEY).catch(() => null),
        kv.getItem(VOICE_USED_KEY).catch(() => null),
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
      setVoiceUsed(Math.max(0, Number(used) || 0));
      setLoaded(true);
    })();
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setSysReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSysReduce);
    return () => {
      alive = false;
      sub.remove();
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
    // Until real purchases are switched on (stub provider), test builds get every Plus feature:
    // there is no way to buy Plus yet, so nothing should be locked behind it.
    const unlocked = tier === 'plus' || !purchases.available;
    return {
      loaded,
      scripts,
      prefs,
      tier,
      voiceReadsLeft: unlocked ? Infinity : Math.max(0, VOICE_FREE_READS - voiceUsed),
      theme: dark ? DARK : LIGHT,
      reduceMotion,
      purchases,
      getScript: (id) => scripts.find((s) => s.id === id),
      saveScript,
      createScript,
      deleteScript,
      setPrefs,
      can: (f) => unlocked || canUse(tier, f),
      consumeVoiceRead: () => {
        if (unlocked) return true;
        if (voiceUsed >= VOICE_FREE_READS) return false;
        const n = voiceUsed + 1;
        setVoiceUsed(n);
        void kv.setItem(VOICE_USED_KEY, String(n)).catch(() => undefined);
        return true;
      },
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
  }, [loaded, scripts, prefs, tier, voiceUsed, scheme, sysReduce, purchases, saveScript, createScript, deleteScript, setPrefs, grant, kv]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}
