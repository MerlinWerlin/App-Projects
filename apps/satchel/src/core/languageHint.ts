// T35 (release standard): the app language choice and the one-time first-launch language line. Pure TS.
// The choice is 'system' (follow the phone) or one of the languages we actually ship; a shipped language is
// English plus every language with a bundled catalogue. The line names the language in use with a Change link
// to Settings > Language; it shows in the first session only, never blocks, and hides at once when tapped.
import { LANG_NAMES, SUPPORTED, type Lang } from '../i18n/core.ts';

export type LanguagePref = 'system' | Lang;

export const isLanguagePref = (v: unknown): v is LanguagePref =>
  v === 'system' || (typeof v === 'string' && (SUPPORTED as readonly string[]).includes(v));

/** Languages the app can show: English first, then each language that has a non-empty catalogue, in SUPPORTED order. */
export function shippedLangs(catalogs: Partial<Record<Lang, object | undefined>>): Lang[] {
  return SUPPORTED.filter((l) => l === 'en' || Object.keys(catalogs[l] ?? {}).length > 0);
}

/** The picker rows: phone default first, then each shipped language. */
export function languageOptions(shipped: readonly Lang[]): LanguagePref[] {
  return ['system', ...shipped];
}

/**
 * The language to draw: the saved choice when we ship it, otherwise the first of the phone's languages that we
 * ship, otherwise English. A saved language that no longer ships falls back to the phone, never to a blank UI.
 */
export function resolveLang(pref: unknown, phoneTags: readonly string[], shipped: readonly Lang[]): Lang {
  if (isLanguagePref(pref) && pref !== 'system' && shipped.includes(pref)) return pref;
  for (const tag of phoneTags) {
    const base = String(tag).toLowerCase().split(/[-_]/)[0] as Lang;
    if (shipped.includes(base)) return base;
  }
  return 'en';
}

/** A language's own name ("English", "日本語"); used on the line and in the picker. */
export const languageName = (lang: Lang): string => LANG_NAMES[lang];

/**
 * Whether the line shows now. `seenBefore` is what storage said at launch (a previous session already showed it);
 * `tappedThisSession` hides it as soon as the traveller taps Change.
 */
export function languageHintVisible(state: { loaded: boolean; seenBefore: boolean; tappedThisSession: boolean }): boolean {
  return state.loaded && !state.seenBefore && !state.tappedThisSession;
}
