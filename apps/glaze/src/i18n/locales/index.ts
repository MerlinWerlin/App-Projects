// Every catalogue by locale. `en-XA` (pseudo) has no catalogue: it renders English through
// pseudoLocalize(). Adding a locale: add it to SUPPORTED_LOCALES in src/core/i18n.ts, create
// <locale>.ts typed as LocaleMessages, and register it here (docs/I18N.md).
import type { CatalogueSet } from '../../core/i18n.ts';
import type { LocaleMessages } from '../catalogue.ts';
import { ar } from './ar.ts';
import { de } from './de.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { hi } from './hi.ts';
import { it } from './it.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import { ptBR } from './pt-BR.ts';
import { zhHans } from './zh-Hans.ts';

/** Non-English catalogues, each a deep-partial of Messages. */
export const TRANSLATIONS: Readonly<Record<'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-Hans' | 'hi' | 'ar', LocaleMessages>> = {
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

/** All catalogues in the shape translate() expects. */
export const CATALOGUES: CatalogueSet = { en, ...TRANSLATIONS } as CatalogueSet;
