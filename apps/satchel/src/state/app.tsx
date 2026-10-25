// App-wide state: theme (the Appearance setting: follows the phone on System, or Light / Dark), language, prefs
// (haptics, appearance), Reduce Motion, and the ready flag that holds the splash until prefs have loaded (no blank
// first frame, and no flash of the wrong theme).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { CATALOGS } from '../i18n/catalogs.ts';
import { makeT, type Lang, type T } from '../i18n/core.ts';
import { languageHintVisible, resolveLang, shippedLangs } from '../core/languageHint.ts';
import { applySystemAppearance } from '../native/appearance.ts';
import { loadJson, phoneLanguages, saveJson, setHapticsEnabled } from '../native/device.ts';
import { DEFAULT_APP_PREFS, normaliseAppPrefs, resolveScheme, type AppPrefs } from '../core/settings.ts';
import { dark, light, type Theme } from '../theme/tokens.ts';

export type Prefs = AppPrefs;
const DEFAULT_PREFS: Prefs = DEFAULT_APP_PREFS;
const PREFS_KEY = 'satchel.prefs.v1';

type AppState = {
  ready: boolean;
  theme: Theme;
  lang: Lang;
  t: T;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  reduceMotion: boolean;
  /** Languages the picker offers (English + bundled catalogues). */
  shipped: Lang[];
  /** T35: the one-session first-launch language line, and hiding it once tapped. */
  languageHint: boolean;
  dismissLanguageHint: () => void;
};

const SHIPPED = shippedLangs(CATALOGS);

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [reduceMotion, setReduceMotion] = useState(false);
  const phoneTags = useMemo(() => phoneLanguages(), []);
  const lang = useMemo(() => resolveLang(prefs.language, phoneTags, SHIPPED), [prefs.language, phoneTags]);
  // seenBefore is what storage said at launch, so the line stays for this whole first session (until tapped).
  const [seenBefore, setSeenBefore] = useState(true);
  const [hintTapped, setHintTapped] = useState(false);
  const t = useMemo(() => makeT(CATALOGS[lang] ?? null), [lang]);

  useEffect(() => {
    let alive = true;
    loadJson<Record<string, unknown>>(PREFS_KEY, DEFAULT_PREFS).then((raw) => {
      if (!alive) return;
      const loaded = normaliseAppPrefs(raw);
      setSeenBefore(loaded.languageHintSeen);
      // Record the line as shown now, so the next launch starts without it.
      const p = loaded.languageHintSeen ? loaded : { ...loaded, languageHintSeen: true };
      if (p !== loaded) saveJson(PREFS_KEY, p);
      setPrefsState(p);
      setHapticsEnabled(p.haptics);
      setReady(true);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // System alerts and the keyboard follow the Appearance setting too (System = the phone's own setting).
  useEffect(() => {
    if (ready) applySystemAppearance(prefs.appearance);
  }, [ready, prefs.appearance]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      theme: resolveScheme(prefs.appearance, scheme) === 'dark' ? dark : light,
      lang,
      t,
      prefs,
      reduceMotion,
      shipped: SHIPPED,
      languageHint: languageHintVisible({ loaded: ready, seenBefore, tappedThisSession: hintTapped }),
      dismissLanguageHint: () => setHintTapped(true),
      setPrefs: (p) => {
        setPrefsState((old) => {
          const next = { ...old, ...p };
          setHapticsEnabled(next.haptics);
          saveJson(PREFS_KEY, next);
          return next;
        });
      },
    }),
    [ready, scheme, lang, t, prefs, reduceMotion, seenBefore, hintTapped],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
