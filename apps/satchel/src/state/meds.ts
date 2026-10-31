// T101 medicines for Medicine times: on this phone only under MEDS_KEY ('satchel.meds.v1', exported once from
// src/core/medtimes.ts). Never part of a .satchel trip file. The stored value is cleaned on every read (cleanStore).
import { useMemo } from 'react';
import { cleanStore, MEDS_KEY, type MedStore } from '../core/medtimes.ts';
import { setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [store (cleaned), loaded]. */
export function useMeds(): [MedStore, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(MEDS_KEY, EMPTY);
  const store = useMemo(() => cleanStore(raw), [raw]);
  return [store, loaded];
}

/** Applies a change and waits for the write; false (and nothing changed) if it can't be stored. */
export function saveMeds(change: (old: MedStore) => MedStore): Promise<boolean> {
  return setPersistedChecked<unknown>(MEDS_KEY, (old: unknown) => change(cleanStore(old)), EMPTY);
}
