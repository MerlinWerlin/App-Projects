/**
 * Phone language tags via expo-localization (bundled in Expo Go). Guarded require inside a function
 * (D4-1): where the module is missing this returns [] and the app runs in English. Never throws.
 */
declare const require: (id: string) => unknown;

interface LocalizationLike {
  getLocales?: () => Array<{ languageTag?: string | null; languageCode?: string | null }>;
}

export function deviceLanguageTags(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-localization') as LocalizationLike | null;
    const list = mod?.getLocales?.() ?? [];
    return list.map((l) => l.languageTag ?? l.languageCode ?? '').filter((s) => s.length > 0);
  } catch {
    return [];
  }
}
