// T147 postcards on this phone only, one key per trip (src/core/postcards.ts postcardsKey,
// 'satchel.postcards.v1.<tripId>'): the people to write to with their postal addresses and the sent ticks. Never on
// the Trip and never in a .satchel trip file (guard test in postcards.test.ts). The stored value is cleaned on every
// read, so a damaged entry can't crash a screen.
import { useMemo } from 'react';
import { cleanBook, copyPeople, postcardsKey, type PostcardBook } from '../core/postcards.ts';
import { readPersisted, removePersisted, setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [book (cleaned), loaded] for one trip. An empty id reads an unused key. */
export function usePostcards(tripId: string): [PostcardBook, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(postcardsKey(tripId || '-'), EMPTY);
  const book = useMemo(() => cleanBook(raw), [raw]);
  return [book, loaded];
}

/** Saves one trip's list and waits for the write; false (nothing changed) if it can't be stored. */
export function savePostcards(tripId: string, next: PostcardBook): Promise<boolean> {
  return setPersistedChecked<unknown>(postcardsKey(tripId), cleanBook(next), EMPTY);
}

/** How many people a trip's list holds (for the Plan this trip again toggle). */
export async function postcardPeopleCount(tripId: string): Promise<number> {
  return cleanBook(await readPersisted<unknown>(postcardsKey(tripId), EMPTY)).people.length;
}

/** Plan this trip again: the old trip's people (no ticks) onto the new trip. Best effort; false if not stored. */
export async function copyPostcardPeople(fromTripId: string, toTripId: string, newId: (prefix: string) => string): Promise<boolean> {
  try {
    const from = cleanBook(await readPersisted<unknown>(postcardsKey(fromTripId), EMPTY));
    if (!from.people.length) return true;
    return await savePostcards(toTripId, copyPeople(from, newId));
  } catch {
    return false;
  }
}

/** Deletes a deleted trip's postcard list. Best effort, never throws. */
export function forgetTripPostcards(tripId: string): void {
  if (!tripId) return;
  removePersisted([postcardsKey(tripId)]).catch(() => {});
}
