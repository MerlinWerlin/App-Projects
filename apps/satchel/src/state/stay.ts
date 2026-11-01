// T109 stay details on this phone only, one key per booking (src/core/staydetails.ts stayKey, 'satchel.stay.v1.<itemId>').
// Never part of a .satchel trip file. The stored value is cleaned on every read, so a damaged entry can't crash a screen.
import { useMemo } from 'react';
import { withPastedWifi, type PastedWifi } from '../core/pastewifi.ts';
import { cleanStay, stayKey, type StayDetails } from '../core/staydetails.ts';
import { readPersisted, removePersisted, setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [details (cleaned), loaded] for one booking. An empty id reads an unused key and gives the empty details. */
export function useStayDetails(itemId: string): [StayDetails, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(stayKey(itemId || '-'), EMPTY);
  const details = useMemo(() => cleanStay(raw), [raw]);
  return [details, loaded];
}

/** Saves one booking's stay details and waits for the write; false (and nothing changed) if it can't be stored. */
export function saveStay(itemId: string, details: StayDetails): Promise<boolean> {
  return setPersistedChecked<unknown>(stayKey(itemId), cleanStay(details), EMPTY);
}

/** T112: deletes these stay keys (src/core/followups97.ts stayKeysToDrop) when their bookings are deleted. Best effort. */
export function forgetStays(keys: readonly string[]): void {
  removePersisted(keys).catch(() => {});
}

/**
 * T112 Paste a booking: fills the Wi-Fi found in the pasted confirmation into this booking's stay details where they
 * are still empty (nothing saved is overwritten). True when something was saved.
 */
export async function fillStayWifi(itemId: string, wifi: PastedWifi): Promise<boolean> {
  const now = cleanStay(await readPersisted<unknown>(stayKey(itemId), EMPTY));
  const next = withPastedWifi(now, wifi);
  return next ? saveStay(itemId, next) : false;
}
