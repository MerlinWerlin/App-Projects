/**
 * Translated copy on module-level data (owner-1016 R3). Pure TS, no React Native, so src/core and
 * src/plus can use it too.
 *
 * Copy tables (settings rows, key labels, layout data) are module constants, but their text must
 * follow the active language. withCopy() turns the named string fields into enumerable getters that
 * call t() on every read, so a language switch applies on the next render. Spreading such an object
 * copies the text of the moment; spread at render time, not at module load.
 */
import { t, type MessageKey } from './core';

export function withCopy<T extends object>(target: T, copy: Partial<Record<keyof T & string, MessageKey>>): T {
  for (const prop of Object.keys(copy) as (keyof T & string)[]) {
    const key = copy[prop];
    if (key === undefined) continue;
    Object.defineProperty(target, prop, { get: () => t(key), enumerable: true, configurable: true });
  }
  return target;
}

/** A Record<K, string> whose every value is t(keys[k]) on read. */
export function copyTable<K extends string>(keys: Record<K, MessageKey>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(keys) as K[]) out[k] = '';
  return withCopy(out, keys as Partial<Record<K, MessageKey>>);
}
