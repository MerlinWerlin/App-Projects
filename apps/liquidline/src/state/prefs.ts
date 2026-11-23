import { profileFor } from '../core/countries.ts';
import type { Prefs } from '../core/charge.ts';
import { atmKpa } from '../core/settings.ts';
import { useSettings } from './store.ts';

/** The units and atmosphere every calculator needs, from Settings. */
export function usePrefs(): Prefs & { length: 'm' | 'ft'; mass: 'g' | 'oz' } {
  const s = useSettings();
  return { pressure: s.units.pressure, temp: s.units.temp, gauge: s.gauge, atmKpa: atmKpa(s), length: s.units.length, mass: s.units.mass };
}

export function useCountry() {
  return profileFor(useSettings().country);
}
