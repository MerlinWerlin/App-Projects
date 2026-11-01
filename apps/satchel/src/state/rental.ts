// T122 rental car checklist on this phone only, one key per car booking (src/core/driving.ts rentalKey,
// 'satchel.rental.v1.<itemId>'). Never part of a .satchel trip file. The stored value is cleaned on every read, so a
// damaged entry can't crash a screen. Pick-up photos are Satchel's own copies (attachments/); they go when the
// booking or its trip is deleted, or when a side's photo is replaced or removed.
import { useMemo } from 'react';
import { cleanRental, photoUris, rentalKey, type RentalChecklist } from '../core/driving.ts';
import { removeRentalPhotos } from '../native/rentalPhotos.ts';
import { readPersisted, removePersisted, setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [checklist (cleaned), loaded] for one car booking. An empty id reads an unused key. */
export function useRental(itemId: string): [RentalChecklist, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(rentalKey(itemId || '-'), EMPTY);
  const checklist = useMemo(() => cleanRental(raw), [raw]);
  return [checklist, loaded];
}

/** Saves one booking's checklist and waits for the write; false (nothing changed) if it can't be stored. */
export function saveRental(itemId: string, next: RentalChecklist): Promise<boolean> {
  return setPersistedChecked<unknown>(rentalKey(itemId), cleanRental(next), EMPTY);
}

/** Deletes these rental keys (src/core/driving.ts rentalKeysToDrop) and their photo files. Best effort, never throws. */
export function forgetRentals(keys: readonly string[]): void {
  if (!keys.length) return;
  (async () => {
    const uris: string[] = [];
    for (const k of keys) uris.push(...photoUris(cleanRental(await readPersisted<unknown>(k, EMPTY))));
    await removePersisted(keys);
    await removeRentalPhotos(uris);
  })().catch(() => {});
}
