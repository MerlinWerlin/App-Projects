// T121 help cards, on this phone only under HELPCARDS_KEY (declared once in src/core/helpcards.ts). Never on the
// Trip, so a .satchel trip file cannot carry a card or its photo. The stored value is cleaned on every read.
import { useMemo } from 'react';
import { cleanPeople, HELPCARDS_KEY, type HelpPerson } from '../core/helpcards.ts';
import { setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [people (cleaned, stored order), loaded]. */
export function useHelpPeople(): [HelpPerson[], boolean] {
  const [raw, , loaded] = usePersisted<unknown>(HELPCARDS_KEY, EMPTY);
  const list = useMemo(() => cleanPeople(raw), [raw]);
  return [list, loaded];
}

/** Applies a change and waits for the write; false (and nothing changed) if it can't be stored. */
export function saveHelpPeople(change: (old: HelpPerson[]) => HelpPerson[]): Promise<boolean> {
  return setPersistedChecked<unknown>(HELPCARDS_KEY, (old: unknown) => ({ people: change(cleanPeople(old)) }), EMPTY);
}
