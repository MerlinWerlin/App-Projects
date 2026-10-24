// One provider for everything the screens share: settings, play stats and streak, saved takes, Plus, language
// and theme. Loads once at startup; the splash stays up until it has (no "index" flash, App Factory lesson).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { freeGoesLeft, hasAccess, NO_STREAK, playDaily, type Streak } from '../core/game.ts';
import { makeT, matchLang, type Catalog, type Lang } from '../i18n/core.ts';
import { CATALOGS } from '../i18n/catalogs.ts';
import { deleteTakeFiles } from '../native/files.ts';
import { loadJson, loadList, phoneLanguages, saveJson, setHapticsEnabled, storage } from '../native/device.ts';
import { createStore, type BuyResult, type PlusStore } from '../plus/store.ts';
import { makeTheme, type Theme } from '../ui/theme.ts';

export type Prefs = {
  haptics: boolean;
  countdown: boolean;
  holdToRecord: boolean;
  autoplay: boolean;
  calm: boolean;
  theme: 'system' | 'light' | 'dark';
  lang: Lang | 'system';
  introSeen: boolean;
  skin: string;
};
const DEFAULT_PREFS: Prefs = {
  haptics: true, countdown: true, holdToRecord: true, autoplay: true, calm: false, theme: 'system', lang: 'system', introSeen: false, skin: 'booth',
};

export type Stats = { rounds: number; best: number; streak: Streak; daily: Record<string, number> };
const DEFAULT_STATS: Stats = { rounds: 0, best: 0, streak: NO_STREAK, daily: {} };

export type Take = {
  id: string;
  at: number;
  line: string;
  pack: string | null;
  score: number;
  original: string;
  copy: string;
  player?: string;
};

type Ctx = {
  ready: boolean;
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  stats: Stats;
  recordRound: (score: number, dailyDay?: string) => { newBest: boolean };
  takes: Take[];
  addTake: (t: Take) => void;
  removeTake: (id: string) => void;
  /** Full access (bought, or still inside the 10 free goes). Gates every feature. */
  plus: boolean;
  /** Bought the lifetime unlock. */
  owned: boolean;
  /** Free goes left, or null once bought. */
  freeLeft: number | null;
  plusKind: 'store' | 'test';
  plusPrice: string | null;
  buyPlus: () => Promise<BuyResult>;
  restorePlus: () => Promise<boolean>;
  t: ReturnType<typeof makeT>;
  lang: Lang;
  theme: Theme;
  calm: boolean;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [takes, setTakes] = useState<Take[]>([]);
  const [plus, setPlus] = useState(false);
  const [plusPrice, setPlusPrice] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const store = useRef<PlusStore>(createStore(storage)).current;
  const scheme = useColorScheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, s, tk, owned] = await Promise.all([
        loadJson('backspin.prefs.v1', DEFAULT_PREFS),
        loadJson('backspin.stats.v1', DEFAULT_STATS),
        loadList<Take>('backspin.takes.v1'),
        store.owned().catch(() => false),
      ]);
      if (!alive) return;
      setPrefs(p);
      setHapticsEnabled(p.haptics);
      setStats(s);
      setTakes(tk);
      setPlus(owned);
      setReady(true);
      store.price().then((x) => alive && setPlusPrice(x)).catch(() => {});
    })();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [store]);

  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((old) => {
      const next = { ...old, [k]: v };
      saveJson('backspin.prefs.v1', next);
      if (k === 'haptics') setHapticsEnabled(v as boolean);
      return next;
    });
  }, []);

  const recordRound = useCallback((score: number, dailyDay?: string) => {
    let newBest = false;
    setStats((old) => {
      newBest = score > old.best && old.rounds > 0;
      const next: Stats = {
        rounds: old.rounds + 1,
        best: Math.max(old.best, score),
        streak: dailyDay ? playDaily(old.streak, dailyDay) : old.streak,
        daily: dailyDay ? { ...old.daily, [dailyDay]: Math.max(old.daily[dailyDay] ?? 0, score) } : old.daily,
      };
      // Keep the daily history small (last ~60 days).
      const keys = Object.keys(next.daily).sort();
      if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete next.daily[k];
      saveJson('backspin.stats.v1', next);
      return next;
    });
    return { newBest };
  }, []);

  const addTake = useCallback((tk: Take) => {
    setTakes((old) => {
      const next = [tk, ...old];
      saveJson('backspin.takes.v1', next);
      return next;
    });
  }, []);

  const removeTake = useCallback((id: string) => {
    deleteTakeFiles(id);
    setTakes((old) => {
      const next = old.filter((x) => x.id !== id);
      saveJson('backspin.takes.v1', next);
      return next;
    });
  }, []);

  const buyPlus = useCallback(async () => {
    const r = await store.buy();
    if (r.status === 'owned') setPlus(true);
    return r;
  }, [store]);
  const restorePlus = useCallback(async () => {
    const ok = await store.restore();
    if (ok) setPlus(true);
    return ok;
  }, [store]);

  const lang: Lang = prefs.lang === 'system' ? matchLang(phoneLanguages()) : prefs.lang;
  const t = useMemo(() => makeT((CATALOGS[lang] as Catalog | undefined) ?? null), [lang]);
  const dark = prefs.theme === 'system' ? scheme !== 'light' : prefs.theme === 'dark';
  const theme = useMemo(() => makeTheme(prefs.skin ?? 'booth', dark), [prefs.skin, dark]);

  const value: Ctx = {
    ready, prefs, setPref, stats, recordRound, takes, addTake, removeTake,
    plus: hasAccess(plus, stats.rounds), owned: plus, freeLeft: freeGoesLeft(plus, stats.rounds), plusKind: store.kind, plusPrice, buyPlus, restorePlus,
    t, lang, theme, calm: prefs.calm || reduceMotion,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
