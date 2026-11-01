// T114 call home planner on this phone only, under CALLHOME_KEY (src/core/callhome.ts). Never part of a .satchel trip
// file. The stored value is cleaned on every read, so a damaged entry can't crash a screen.
import { useMemo } from 'react';
import { CALLHOME_KEY, cleanCallHome, type CallHomeStore } from '../core/callhome.ts';
import { setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [store (cleaned), loaded]. */
export function useCallHome(): [CallHomeStore, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(CALLHOME_KEY, EMPTY);
  const store = useMemo(() => cleanCallHome(raw), [raw]);
  return [store, loaded];
}

/** Applies a change and waits for the write; false (and nothing changed) if it can't be stored. */
export function saveCallHome(change: (old: CallHomeStore) => CallHomeStore): Promise<boolean> {
  return setPersistedChecked<unknown>(CALLHOME_KEY, (old: unknown) => change(cleanCallHome(old)), EMPTY);
}
