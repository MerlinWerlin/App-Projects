import { useApp } from '../state/AppState';
import { profileFor } from './countries';
import type { CountryProfile } from './types';

/** The person's country profile (generic until they choose). */
export function useCountry(): CountryProfile {
  const { prefs } = useApp();
  return profileFor(prefs.country);
}
