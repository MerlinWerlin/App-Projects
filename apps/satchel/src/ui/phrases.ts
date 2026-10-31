// T56 shared wiring for the phrase screens: the bundled table, the language's UI-name key, and the language to
// open (route param, else trip country, else last used, else phone zone, else Japanese; see src/core/phrases.ts).
import { useCallback, useMemo, useState } from 'react';
import data from '../content/phrases.json';
import { countryForZone } from '../core/emergency.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import { PHRASE_LANG_KEY, pickPhraseLang, tripCountry, type LangSource, type PhraseLang, type PhraseTable } from '../core/phrases.ts';
import type { Key } from '../i18n/en.ts';
import { usePersisted } from '../state/persisted.ts';
import { useTrips } from '../state/trips.tsx';

export const PHRASE_TABLE = data as PhraseTable;

/** UI name of each phrase language ("Japanese"), from the catalogue so the app language can translate it. */
export const LANG_KEY: Record<PhraseLang, Key> = {
  ja: 'phrases.lang.ja',
  'zh-Hans': 'phrases.lang.zh-Hans',
  ko: 'phrases.lang.ko',
  th: 'phrases.lang.th',
  vi: 'phrases.lang.vi',
  es: 'phrases.lang.es',
  fr: 'phrases.lang.fr',
  de: 'phrases.lang.de',
  it: 'phrases.lang.it',
  pt: 'phrases.lang.pt',
  id: 'phrases.lang.id',
};

const NONE: string | null = null;

/** The phrase language to show, where it came from, and a setter that also remembers the choice. */
export function usePhraseLang(param: PhraseLang | null): { lang: PhraseLang; from: LangSource | 'param' | 'picked'; setLang: (l: PhraseLang) => void } {
  const { trips } = useTrips();
  const [last, setLast] = usePersisted<string | null>(PHRASE_LANG_KEY, NONE);
  const [picked, setPicked] = useState<PhraseLang | null>(null);
  const auto = useMemo(() => {
    const zone = deviceZone();
    const now = Date.now();
    return pickPhraseLang(PHRASE_TABLE, { tripCountry: tripCountry(trips, now, todayIn(zone, now)), lastUsed: last, phoneCountry: countryForZone(zone) });
  }, [trips, last]);
  const setLang = useCallback(
    (l: PhraseLang) => {
      setPicked(l);
      setLast(l);
    },
    [setLast],
  );
  if (picked) return { lang: picked, from: 'picked', setLang };
  if (param) return { lang: param, from: 'param', setLang };
  return { lang: auto.lang, from: auto.from, setLang };
}
