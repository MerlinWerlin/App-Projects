// T149 travelling with kids, on this phone only: one key per trip (src/core/kids.ts kidsKey). Never on the Trip, and
// never in a .satchel file unless the traveller turns "Include children's names in trip files" on (kidsForFile). The
// stored value is cleaned on every read, so a damaged entry can't crash a screen.
import { useMemo } from 'react';
import { cleanKids, kidsKey, type KidsData } from '../core/kids.ts';
import { readPersisted, removePersisted, setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [kids data (cleaned), loaded] for one trip. An empty id reads an unused key. */
export function useKids(tripId: string): [KidsData, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(kidsKey(tripId || '-'), EMPTY);
  const data = useMemo(() => cleanKids(raw), [raw]);
  return [data, loaded];
}

/** Saves one trip's kids data and waits for the write; false (nothing changed) if it can't be stored. */
export function saveKids(tripId: string, next: KidsData): Promise<boolean> {
  return setPersistedChecked<unknown>(kidsKey(tripId), cleanKids(next), EMPTY);
}

/** Reads one trip's kids data outside React (export). */
export async function readKids(tripId: string): Promise<KidsData> {
  return cleanKids(await readPersisted<unknown>(kidsKey(tripId), EMPTY));
}

/** Deletes a deleted trip's kids data. Best effort, never throws. */
export function forgetTripKids(tripId: string): void {
  if (!tripId) return;
  removePersisted([kidsKey(tripId)]).catch(() => {});
}
