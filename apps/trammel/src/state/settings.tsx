// Settings kept on the phone: units, imperial fraction size, default saw kerf, haptics.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { COUNTRIES, parseCountry, type CountryCode, type CountryProfile } from '../core/country.ts';
import { makeFmt, type Fmt, type FractionDenom, type UnitSystem } from '../core/units.ts';

export const SETTINGS_KEY = 'trammel.settings.v1';

/** country null = not chosen yet: the first-launch question (app/welcome.tsx) shows. */
export type Settings = { units: UnitSystem; denom: FractionDenom; kerf: number; haptics: boolean; country: CountryCode | null };
// Simulator capture builds only (see .github/workflows/trammel-store-capture.yml) start as Australia so every screen can
// be opened by link; store builds always ask on first launch.
const CAPTURE_COUNTRY: CountryCode | null = process.env.EXPO_PUBLIC_TRAMMEL_CAPTURE === '1' ? 'AU' : null;
export const DEFAULT_SETTINGS: Settings = { units: 'metric', denom: 16, kerf: 3, haptics: true, country: CAPTURE_COUNTRY };

export function parseSettings(raw: string | null): Settings {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return DEFAULT_SETTINGS;
    return {
      units: v.units === 'imperial' ? 'imperial' : 'metric',
      denom: v.denom === 8 || v.denom === 32 ? v.denom : 16,
      kerf: typeof v.kerf === 'number' && v.kerf >= 0 && v.kerf <= 20 ? v.kerf : 3,
      haptics: v.haptics !== false,
      country: parseCountry(v.country) ?? CAPTURE_COUNTRY,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type Ctx = { settings: Settings; ready: boolean; fmt: Fmt; country: CountryProfile; update: (p: Partial<Settings>) => void; chooseCountry: (c: CountryCode) => void };
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
      country: COUNTRIES[settings.country ?? 'OTHER'],
      update: (p) =>
        setSettings((s) => {
          const next = { ...s, ...p };
          AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        }),
      // Choosing a country also sets its usual units (imperial for the US); units stay changeable afterwards.
      chooseCountry: (c) =>
        setSettings((s) => {
          const next = { ...s, country: c, units: COUNTRIES[c].units };
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
