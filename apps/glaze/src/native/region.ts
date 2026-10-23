// The phone's region code (e.g. 'AU'), for seasonal collections (R5: hemisphere by region).
// expo-localization isn't a dependency yet, and a require() of a missing package fails at bundle
// time in Metro, so this reads the same native module through requireOptionalNativeModule (present
// in Expo Go and in builds that include expo-localization) and falls back to the JS Intl locale.
// Once expo-localization is installed this can become `getLocales()[0]?.regionCode ?? null`.
import { requireOptionalNativeModule } from 'expo';
import { regionFromLocaleTag } from '../core/seasons';

type LocalizationModule = { getLocales?: () => { regionCode?: string | null; languageTag?: string }[] };

let cached: string | null | undefined;

/** ISO region code of the phone's first preferred locale, or null when unknown (treated as north). */
export function deviceRegionCode(): string | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<LocalizationModule>('ExpoLocalization')
        : null;
    const first = mod?.getLocales?.()?.[0];
    const code = first?.regionCode ?? regionFromLocaleTag(first?.languageTag);
    if (typeof code === 'string' && /^[A-Za-z]{2}$/.test(code)) {
      cached = code.toUpperCase();
      return cached;
    }
  } catch {
    // fall through to Intl
  }
  try {
    cached = regionFromLocaleTag(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    cached = null;
  }
  return cached;
}
