/**
 * Shipped locales (owner-1016 R3). Pure TS (no React Native imports) so it is tested in Node.
 * `script` drives typography (line height, font fallback); `dir` drives RTL mirroring.
 */
export type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-Hans' | 'hi' | 'ar';
/** 'pseudo' is a developer/test locale: accented English, about 40% longer. Never offered in Settings. */
export type AnyLocale = LocaleCode | 'pseudo';
export type Script = 'latin' | 'cjk' | 'deva' | 'arab';
export type Dir = 'ltr' | 'rtl';

export interface LocaleInfo {
  code: LocaleCode;
  /** Name in its own language, shown in the language picker. */
  nativeName: string;
  /** English name, for docs and screen-reader hints. */
  englishName: string;
  dir: Dir;
  script: Script;
  /** BCP-47 tag handed to Intl and to speech recognition. */
  bcp47: string;
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', script: 'latin', bcp47: 'en-US' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', script: 'latin', bcp47: 'es-ES' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr', script: 'latin', bcp47: 'fr-FR' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr', script: 'latin', bcp47: 'de-DE' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr', script: 'latin', bcp47: 'it-IT' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr', script: 'latin', bcp47: 'pt-BR' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr', script: 'cjk', bcp47: 'ja-JP' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', dir: 'ltr', script: 'cjk', bcp47: 'ko-KR' },
  { code: 'zh-Hans', nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr', script: 'cjk', bcp47: 'zh-CN' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', script: 'deva', bcp47: 'hi-IN' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', script: 'arab', bcp47: 'ar' },
];

export const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code);

export function localeInfo(code: AnyLocale): LocaleInfo {
  if (code === 'pseudo') return { ...LOCALES[0]!, bcp47: 'en-XA' };
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]!;
}

export function isRtl(code: AnyLocale): boolean {
  return localeInfo(code).dir === 'rtl';
}

/**
 * Pick the best shipped locale for the phone's preferred language tags (most preferred first),
 * e.g. ["pt-PT", "en-AU"] -> "pt-BR" (only Brazilian Portuguese ships), ["zh-Hant-TW"] -> "zh-Hans"
 * (closest shipped Chinese), ["sr"] -> next tag, else "en".
 */
export function resolveLocale(tags: readonly (string | null | undefined)[]): LocaleCode {
  for (const raw of tags) {
    if (!raw) continue;
    const tag = raw.replace(/_/g, '-');
    const lower = tag.toLowerCase();
    const lang = lower.split('-')[0] ?? '';
    if (lang === 'pt') return 'pt-BR';
    if (lang === 'zh') return 'zh-Hans';
    const hit = LOCALE_CODES.find((c) => c.toLowerCase() === lang);
    if (hit) return hit;
  }
  return 'en';
}
