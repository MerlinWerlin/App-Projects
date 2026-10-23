// Template-name packs (fb-1022b, 22 Oct 2026). Each template batch keeps its 10 non-English name translations in
// its own file here, so parallel batches never edit the big locale files. English names come from the template's
// `name` (generated into src/i18n/en/templates.ts by scripts/i18n-template-names.mjs). catalogs.ts merges these
// over each locale catalogue. Keys are 'templates.name.<id>'. Machine translation awaiting native review (T46).
import type { LocaleCode } from '../core.ts';
import { kawaiiFoodNames } from './kawaiiFood.ts';
import { kawaiiFriendsNames } from './kawaiiFriends.ts';
import { sealifeNames } from './sealife.ts';
import { moviesMoreNames } from './moviesMore.ts';
import { fairytalesMoreNames } from './fairytalesMore.ts';
import { animals2Names } from './animals2.ts';
import { figuresNames } from './figures.ts';
import { places2Names } from './places2.ts';
import { shapes2Names } from './shapes2.ts';
import { game2Names } from './game2.ts';
import { tradeNames } from './trade.ts';

export type PackLocale = Exclude<LocaleCode, 'en'>;
export type PackNames = Readonly<Record<PackLocale, Readonly<Record<string, string>>>>;

export const PACKS: readonly PackNames[] = [kawaiiFoodNames, kawaiiFriendsNames, sealifeNames, moviesMoreNames, fairytalesMoreNames, animals2Names, figuresNames, places2Names, shapes2Names, game2Names, tradeNames];

/** All pack names for one locale, merged. */
export function packNames(locale: PackLocale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PACKS) Object.assign(out, p[locale]);
  return out;
}
