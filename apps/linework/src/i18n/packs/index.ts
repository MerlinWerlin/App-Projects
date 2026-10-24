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
import { stilllife3Names } from './stilllife3.ts';
import { wildlife3Names } from './wildlife3.ts';
import { kidsfantasyNames } from './kidsfantasy.ts';
import { mandalas2Names } from './mandalas2.ts';
import { flowers2Names } from './flowers2.ts';
import { patterns2Names } from './patterns2.ts';
import { trade2Names } from './trade2.ts';
import { wild2Names } from './wild2.ts';
import { flowers3Names } from './flowers3.ts';
import { lettering2Names } from './lettering2.ts';
import { mandalas3Names } from './mandalas3.ts';
import { kids2Names } from './kids2.ts';
import { shapes3Names } from './shapes3.ts';
import { patterns3Names } from './patterns3.ts';
import { stilllife4Names } from './stilllife4.ts';
import { animals3Names } from './animals3.ts';
import { figures2Names } from './figures2.ts';
import { places3Names } from './places3.ts';
import { fantasy3Names } from './fantasy3.ts';

export type PackLocale = Exclude<LocaleCode, 'en'>;
export type PackNames = Readonly<Record<PackLocale, Readonly<Record<string, string>>>>;

export const PACKS: readonly PackNames[] = [kawaiiFoodNames, kawaiiFriendsNames, sealifeNames, moviesMoreNames, fairytalesMoreNames, animals2Names, figuresNames, places2Names, shapes2Names, game2Names, tradeNames, stilllife3Names, wildlife3Names, kidsfantasyNames, mandalas2Names, flowers2Names, patterns2Names, trade2Names, wild2Names, flowers3Names, lettering2Names, mandalas3Names, kids2Names, shapes3Names, patterns3Names, stilllife4Names, animals3Names, figures2Names, places3Names, fantasy3Names];

/** All pack names for one locale, merged. */
export function packNames(locale: PackLocale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PACKS) Object.assign(out, p[locale]);
  return out;
}
