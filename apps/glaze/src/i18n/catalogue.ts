// Catalogue types (docs/I18N.md). Pure TS, no React Native imports.
//
// - `Messages`        the English catalogue's shape, widened to plain strings / PluralMessage.
// - `LocaleMessages`  what every non-English locale file exports: a deep-partial of Messages
//                     (anything missing falls back to English at runtime).
// - `MessageKey`      the union of valid dotted keys, e.g. 'settings.language.title'.
// - `TArgs<K>`        the params tuple for key K: required `{ name: … }` when the English string has
//                     `{name}` placeholders (plus `count` for plural messages), optional otherwise.
import type { Params, PluralCategory, PluralMessage } from '../core/i18n.ts';
import { en } from './locales/en.ts';

export type EnglishCatalogue = typeof en;

/** Object types whose keys are all plural categories and that include `other`. */
type IsPlural<T> = T extends object ? ([keyof T] extends [PluralCategory] ? ('other' extends keyof T ? true : false) : false) : false;

/** Widen the `as const` English literals to string / PluralMessage and drop readonly. */
type Widen<T> = T extends string
  ? string
  : IsPlural<T> extends true
    ? PluralMessage
    : { -readonly [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<EnglishCatalogue>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string | PluralMessage ? T[K] : DeepPartial<T[K]>;
};

/** Type for src/i18n/locales/<locale>.ts. Missing keys fall back to English. */
export type LocaleMessages = DeepPartial<Messages>;

/** Namespace names (`common`, `tabs`, `settings`, …). */
export type Namespace = keyof Messages;

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : IsPlural<T[K]> extends true ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every valid dotted key. `t('settings.language.title')` type-checks; typos don't. */
export type MessageKey = Paths<EnglishCatalogue>;

type At<T, K extends string> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? At<T[H], R>
    : never
  : K extends keyof T
    ? T[K]
    : never;

type PlaceholderNames<S> = S extends `${string}{${infer N}}${infer R}` ? N | PlaceholderNames<R> : never;

type TextsOf<M> = M extends string ? M : M extends object ? M[keyof M] : never;

type NamesFor<K extends MessageKey> =
  | PlaceholderNames<TextsOf<At<EnglishCatalogue, K>>>
  | (IsPlural<At<EnglishCatalogue, K>> extends true ? 'count' : never);

/** Params object for key K (placeholder names from the English string). */
export type ParamsFor<K extends MessageKey> = { [N in NamesFor<K>]: N extends 'count' ? number : string | number };

/** Rest-args tuple for `t(key, ...args)`: params required only when the message has placeholders. */
export type TArgs<K extends MessageKey> = [NamesFor<K>] extends [never] ? [params?: Params] : [params: ParamsFor<K> & Params];

/** The `t()` signature shared by the hook and the singleton. */
export type TFunction = <K extends MessageKey>(key: K, ...args: TArgs<K>) => string;

export { en };
