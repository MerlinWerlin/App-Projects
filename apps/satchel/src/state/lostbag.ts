// T127 lost-bag kit on this phone only, one key per trip + bag (src/core/lostbag.ts lostBagKey,
// 'satchel.lostbag.v1.<tripId>.<bagId>'): description, photos, contents with values, file reference and follow-up
// log. Never on the Trip or the packing list and never in a .satchel trip file (guard test in lostbag.test.ts). The
// stored value is cleaned on every read, so a damaged entry can't crash a screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { cleanLostBag, isLostBagKeyOf, lostBagKey, photoUris, type LostBag } from '../core/lostbag.ts';
import { removeBagPhotos } from '../native/lostbagPhotos.ts';
import { readPersisted, removePersisted, setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [record (cleaned), loaded] for one bag of one trip. Empty ids read an unused key. */
export function useLostBag(tripId: string, bagId: string): [LostBag, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(lostBagKey(tripId || '-', bagId || '-'), EMPTY);
  const bag = useMemo(() => cleanLostBag(raw), [raw]);
  return [bag, loaded];
}

/** Saves one bag's record and waits for the write; false (nothing changed) if it can't be stored. */
export function saveLostBag(tripId: string, bagId: string, next: LostBag): Promise<boolean> {
  return setPersistedChecked<unknown>(lostBagKey(tripId, bagId), cleanLostBag(next), EMPTY);
}

/** Deletes these lost-bag keys and their photo files. Best effort, never throws. */
export function forgetLostBags(keys: readonly string[]): void {
  if (!keys.length) return;
  (async () => {
    const uris: string[] = [];
    for (const k of keys) uris.push(...photoUris(cleanLostBag(await readPersisted<unknown>(k, EMPTY))));
    await removePersisted(keys);
    await removeBagPhotos(uris);
  })().catch(() => {});
}

/** Deletes every lost-bag record (and photo) of a deleted trip. Best effort, never throws. */
export function forgetTripLostBags(tripId: string): void {
  AsyncStorage.getAllKeys()
    .then((keys) => forgetLostBags(keys.filter((k) => isLostBagKeyOf(k, tripId))))
    .catch(() => {});
}
