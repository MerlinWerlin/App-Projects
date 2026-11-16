// Destination themes: when the trip in focus is on now (or starts soon) in one of the themed countries, everything
// below CountryThemeProvider sees the country's accent family and Trips / Map / Wallet hero gradients through the
// usual useApp().theme, and the hero banners draw the country's motif and ambient particles (useCountryPick).
// Off with Settings > Destination themes. The pick only changes when the country, the particle or the base theme
// does, so editing a trip or the clock ticking doesn't re-render the app.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { themePick, tripPick, type CountryPick } from '../core/countrytheme.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { countryTheme } from '../theme/countryTheme.ts';
import type { Theme } from '../theme/tokens.ts';
import { ThemeOverride, useApp } from './app.tsx';
import { useTrips } from './trips.tsx';

const PickCtx = createContext<CountryPick | null>(null);
/** The theme before any country, so a nested scope repaints from the base rather than over another country. */
const BaseCtx = createContext<Theme | null>(null);

/** Today's date on this phone, refreshed when the app comes back to the front and once an hour. */
function useToday(): string {
  const [today, setToday] = useState(() => todayIn(deviceZone()));
  useEffect(() => {
    const refresh = () => setToday(todayIn(deviceZone()));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const id = setInterval(refresh, 60 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);
  return today;
}

/** Keep the same pick object while the country and particle stay the same. */
function useStablePick(pick: CountryPick | null): CountryPick | null {
  const key = pick ? `${pick.spec.iso2}:${pick.particle}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => pick, [key]);
}

function Themed({ base, pick, children }: { base: Theme; pick: CountryPick | null; children: ReactNode }) {
  const themed = countryTheme(base, pick?.spec ?? null);
  return (
    <BaseCtx.Provider value={base}>
      <PickCtx.Provider value={pick}>
        <ThemeOverride theme={themed}>{children}</ThemeOverride>
      </PickCtx.Provider>
    </BaseCtx.Provider>
  );
}

/** Goes inside TripsProvider, around the app's screens: today's destination theme. */
export function CountryThemeProvider({ children }: { children: ReactNode }) {
  const { theme, prefs } = useApp();
  const { trips } = useTrips();
  const today = useToday();
  const on = prefs.countryThemes !== false;
  const pick = useStablePick(useMemo(() => (on ? themePick(trips, today) : null), [on, trips, today]));
  return (
    <Themed base={theme} pick={pick}>
      {children}
    </Themed>
  );
}

/**
 * One trip's own screen (trip detail): re-themes what's inside for that trip's country, whatever its dates, or the
 * default look when the trip isn't in a themed country (so a Paris trip never shows the Tokyo theme).
 */
export function TripCountryScope({ trip, children }: { trip: Trip | null | undefined; children: ReactNode }) {
  const { theme, prefs } = useApp();
  const base = useContext(BaseCtx) ?? theme;
  const on = prefs.countryThemes !== false;
  const pick = useStablePick(useMemo(() => (on && trip ? tripPick(trip) : null), [on, trip]));
  return (
    <Themed base={base} pick={pick}>
      {children}
    </Themed>
  );
}

/** The country theme in effect here (its spec and particle), or null for the default look. */
export function useCountryPick(): CountryPick | null {
  return useContext(PickCtx);
}
