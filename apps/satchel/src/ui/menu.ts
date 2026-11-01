// T110 shared wiring for the menu-word screens: the bundled table, the language to open (route param, else trip
// country, else last used here, else phone zone, else Japanese; see src/core/menu.ts) and the diet kept on this phone.
import { useCallback, useMemo, useState } from 'react';
import data from '../content/menu.json';
import { countryForZone } from '../core/emergency.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import { MENU_DIET_KEY, MENU_LANG_KEY, normaliseDiets, pickMenuLang, type DietId, type MenuLang, type MenuTable } from '../core/menu.ts';
import { tripCountry } from '../core/phrases.ts';
import { usePersisted } from '../state/persisted.ts';
import { useTrips } from '../state/trips.tsx';
import { PHRASE_TABLE } from './phrases.ts';

export const MENU_TABLE = data as MenuTable;

const NONE: string | null = null;
const NO_DIET: string[] = [];

/** The menu language to show, where it came from, and a setter that also remembers the choice. */
export function useMenuLang(param: MenuLang | null): { lang: MenuLang; from: 'trip' | 'last' | 'phone' | 'default' | 'param' | 'picked'; setLang: (l: MenuLang) => void } {
  const { trips } = useTrips();
  const [last, setLast] = usePersisted<string | null>(MENU_LANG_KEY, NONE);
  const [picked, setPicked] = useState<MenuLang | null>(null);
  const auto = useMemo(() => {
    const zone = deviceZone();
    const now = Date.now();
    return pickMenuLang(PHRASE_TABLE, { tripCountry: tripCountry(trips, now, todayIn(zone, now)), lastUsed: last, phoneCountry: countryForZone(zone) });
  }, [trips, last]);
  const setLang = useCallback(
    (l: MenuLang) => {
      setPicked(l);
      setLast(l);
    },
    [setLast],
  );
  if (picked) return { lang: picked, from: 'picked', setLang };
  if (param) return { lang: param, from: 'param', setLang };
  return { lang: auto.lang, from: auto.from, setLang };
}

/** The diet picked on the menu screen (kept on this phone only) and its setter. */
export function useMenuDiet(): [DietId[], (next: (old: string[]) => string[]) => void] {
  const [stored, setStored] = usePersisted<string[]>(MENU_DIET_KEY, NO_DIET);
  const diets = useMemo(() => normaliseDiets(stored), [stored]);
  return [diets, setStored];
}
