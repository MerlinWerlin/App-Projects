// T120: a saved toilet's pin on the Map tab opens the Toilets tab at that toilet. Like src/state/nearestToilet.ts, the
// request is also kept in memory, because a route param alone may not reach a Toilets tab that is already open. Each
// request is a one-time token (src/core/followups99.ts); the Toilets tab runs it once and clears it.
import { useSyncExternalStore } from 'react';
import { encodeToiletFocus } from '../core/followups99.ts';

let pending: string | null = null;
let seq = 0;
const listeners = new Set<() => void>();

/** Asks the Toilets tab to show this saved toilet; returns the token (also passed as the `focus` route param). */
export function requestToiletFocus(toiletId: string): string {
  seq += 1;
  pending = encodeToiletFocus({ nonce: `${Date.now().toString(36)}-${seq}`, toiletId });
  listeners.forEach((l) => l());
  return pending;
}

/** Called once the Toilets tab has handled this token. */
export function clearToiletFocus(token: string): void {
  if (pending !== token) return;
  pending = null;
  listeners.forEach((l) => l());
}

/** The token waiting to run, or null. */
export function useToiletFocusRequest(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
  );
}
