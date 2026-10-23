import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { MemoryKV, PrefsStore, type KeyValueStore, type Prefs, type ThemePref } from '../core/prefs';
import { setLocale } from '../i18n/core';
import { resolveLocale } from '../i18n/locales';
import { loadPersistentKv } from '../native/kv';
import { deviceLanguageTags } from '../native/localization';
import { syncDirectionOnStart } from '../native/rtl';
import { DEFAULT_REMOTE_THEME, type RemoteThemeId } from '../theme/remoteThemes';
import { setHapticsEnabled } from '../ui/remote/haptics';

/**
 * React binding for the pure-TS PrefsStore. Persisted with AsyncStorage (src/native/kv.ts, guarded);
 * in-memory when that is unavailable. Pass `kv` to override.
 */
const Ctx = createContext<PrefsStore | null>(null);

/** Theme pref only, read by useTheme. Defaults to 'system' outside a provider. */
export const ThemePrefContext = createContext<ThemePref>('system');

/** Chosen remote theme only, read by useRemoteTheme (owner-1017). Midnight outside a provider. */
export const RemoteThemePrefContext = createContext<RemoteThemeId>(DEFAULT_REMOTE_THEME);

export function PrefsProvider({ children, kv }: { children: ReactNode; kv?: KeyValueStore }) {
  const [store] = useState(() => new PrefsStore(kv ?? loadPersistentKv() ?? new MemoryKV()));
  useEffect(() => {
    void store.load();
  }, [store]);
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { haptics, theme, language, remoteTheme } = snap.prefs;
  useEffect(() => {
    setHapticsEnabled(haptics);
  }, [haptics]);
  // owner-1016 R3: follow the phone's language unless Settings overrides it.
  useEffect(() => {
    const locale = language === 'system' ? resolveLocale(deviceLanguageTags()) : language;
    setLocale(locale);
    // Layout direction applies at launch; the picker asks before restarting mid-session.
    if (snap.loaded) syncDirectionOnStart(locale);
  }, [language, snap.loaded]);
  return (
    <Ctx.Provider value={store}>
      <ThemePrefContext.Provider value={theme}>
        <RemoteThemePrefContext.Provider value={remoteTheme}>{children}</RemoteThemePrefContext.Provider>
      </ThemePrefContext.Provider>
    </Ctx.Provider>
  );
}

export function usePrefs(): { prefs: Prefs; loaded: boolean; set: (patch: Partial<Prefs>) => void } {
  const store = useContext(Ctx);
  if (!store) throw new Error('usePrefs must be used inside <PrefsProvider>');
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const set = useCallback(
    (patch: Partial<Prefs>) => {
      void store.set(patch);
    },
    [store],
  );
  return useMemo(() => ({ prefs: snap.prefs, loaded: snap.loaded, set }), [snap, set]);
}
