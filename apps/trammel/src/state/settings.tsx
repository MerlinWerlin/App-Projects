// Settings kept on the phone: units, imperial fraction size, default saw kerf, haptics.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { makeFmt, type Fmt, type FractionDenom, type UnitSystem } from '../core/units.ts';

export const SETTINGS_KEY = 'trammel.settings.v1';

export type Settings = { units: UnitSystem; denom: FractionDenom; kerf: number; haptics: boolean };
export const DEFAULT_SETTINGS: Settings = { units: 'metric', denom: 16, kerf: 3, haptics: true };

export function parseSettings(raw: string | null): Settings {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return DEFAULT_SETTINGS;
    return {
      units: v.units === 'imperial' ? 'imperial' : 'metric',
      denom: v.denom === 8 || v.denom === 32 ? v.denom : 16,
      kerf: typeof v.kerf === 'number' && v.kerf >= 0 && v.kerf <= 20 ? v.kerf : 3,
      haptics: v.haptics !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type Ctx = { settings: Settings; ready: boolean; fmt: Fmt; update: (p: Partial<Settings>) => void };
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => setSettings(parseSettings(raw)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      settings,
      ready,
      fmt: makeFmt(settings.units, settings.denom),
      update: (p) =>
        setSettings((s) => {
          const next = { ...s, ...p };
          AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        }),
    }),
    [settings, ready],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const c = useContext(SettingsContext);
  if (!c) throw new Error('useSettings outside SettingsProvider');
  return c;
}
