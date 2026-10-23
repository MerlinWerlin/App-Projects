// Catalogue registry (pure TS). Maps every shipped locale to its messages; English is the fallback.
import { pseudoCatalog, type Catalog, type LocaleCode } from './core.ts';
import { en } from './en/index.ts';
import { es } from './locales/es.ts';
import { fr } from './locales/fr.ts';
import { de } from './locales/de.ts';
import { it } from './locales/it.ts';
import { ptBR } from './locales/pt-BR.ts';
import { ja } from './locales/ja.ts';
import { ko } from './locales/ko.ts';
import { zhHans } from './locales/zh-Hans.ts';
import { hi } from './locales/hi.ts';
import { ar } from './locales/ar.ts';
import { packNames } from './packs/index.ts';

export const EN: Catalog = en;

export const CATALOGS: Readonly<Record<LocaleCode, Catalog>> = {
  en,
  es: { ...es, ...packNames('es') } as Catalog,
  fr: { ...fr, ...packNames('fr') } as Catalog,
  de: { ...de, ...packNames('de') } as Catalog,
  it: { ...it, ...packNames('it') } as Catalog,
  'pt-BR': { ...ptBR, ...packNames('pt-BR') } as Catalog,
  ja: { ...ja, ...packNames('ja') } as Catalog,
  ko: { ...ko, ...packNames('ko') } as Catalog,
  'zh-Hans': { ...zhHans, ...packNames('zh-Hans') } as Catalog,
  hi: { ...hi, ...packNames('hi') } as Catalog,
  ar: { ...ar, ...packNames('ar') } as Catalog,
};

let pseudo: Catalog | null = null;
/** Accented, ~40% longer English used by layout tests and the hidden developer option. */
export function pseudoLocaleCatalog(): Catalog {
  if (!pseudo) pseudo = pseudoCatalog(en);
  return pseudo;
}
