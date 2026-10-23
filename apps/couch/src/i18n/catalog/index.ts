/**
 * All catalogues. Non-English catalogues are machine translations awaiting native review (docs/I18N.md).
 * They are Partial so a missing key falls back to English instead of crashing; tests/i18n-catalogues
 * reports any gaps and placeholder mismatches.
 */
import type { LocaleCode } from '../locales';
import type { Msg } from './types';
import { en, type MessageKey } from './en';
import { ar } from './ar';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { it } from './it';
import { ja } from './ja';
import { ko } from './ko';
import { ptBR } from './pt-BR';
import { zhHans } from './zh-Hans';

export type { MessageKey };
export type Catalogue = Partial<Record<MessageKey, Msg>>;

export const CATALOGUES: Record<LocaleCode, Catalogue> = {
  en,
  es,
  fr,
  de,
  it,
  'pt-BR': ptBR,
  ja,
  ko,
  'zh-Hans': zhHans,
  hi,
  ar,
};
export { en };
