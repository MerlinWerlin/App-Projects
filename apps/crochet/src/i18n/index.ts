// Translation-ready strings from day one. Every user-facing string goes through t(key, params).
// English is the source catalogue (en.ts); other languages are added as files with the same keys
// (OpenAI lane: ops/OPENAI_LANES.md) and registered in CATALOGUES.
import * as Localization from 'expo-localization';
import { de } from './de';
import { en, type MessageKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';

export type { MessageKey };
type Catalogue = Partial<Record<MessageKey, string>>;

const CATALOGUES: Record<string, Catalogue> = { en, es, fr, de, pt, it, nl };

function pickLocale(): string {
  try {
    for (const l of Localization.getLocales()) {
      const code = l.languageCode ?? '';
      if (CATALOGUES[code]) return code;
    }
  } catch {
    // fall through
  }
  return 'en';
}

let locale = pickLocale();

export function getLocale(): string {
  return locale;
}

export type Params = Record<string, string | number>;

/** Look up a string and fill {name} params. `{count}` also picks "one|other" plural forms written as "a|b". */
export function t(key: MessageKey, params?: Params): string {
  const raw = CATALOGUES[locale]?.[key] ?? en[key] ?? key;
  let s = raw;
  if (s.includes('|') && params && typeof params.count === 'number') {
    const [one, other] = s.split('|');
    s = params.count === 1 ? one : other ?? one;
  }
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] != null ? String(params[k]) : m));
  }
  return s;
}

export function formatNumber(n: number, digits = 0): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  } catch {
    return n.toFixed(digits);
  }
}

export function formatDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}
