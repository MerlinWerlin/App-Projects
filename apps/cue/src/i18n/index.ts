/**
 * Minimal typed i18n: t('library.meta', { words: 120, time: '0:51' }). Missing translations fall back to English.
 * Add a language = add a catalogue with the same keys to CATALOGUES.
 */
import { en, type MessageKey } from './en';

export type { MessageKey };
type Catalogue = Partial<Record<MessageKey, string>>;

const CATALOGUES: Record<string, Catalogue> = { en };
let current = 'en';

export function setLocale(tag: string): void {
  const base = tag.split('-')[0] ?? 'en';
  current = CATALOGUES[tag] ? tag : CATALOGUES[base] ? base : 'en';
}

export function getLocale(): string {
  return current;
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const msg = CATALOGUES[current]?.[key] ?? en[key];
  if (!params) return msg;
  return msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
