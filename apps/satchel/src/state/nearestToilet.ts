// T80: "Nearest toilet" from the Map tab, handed to the Toilets tab in memory. A route param alone is not enough when
// the Toilets tab is already open (mounted): navigating to it again may keep the old params. Each request gets a new
// nonce; the Toilets tab runs each nonce once (src/core/followups89.ts nextFindNonce) and clears it.
import { useSyncExternalStore } from 'react';

let pending: string | null = null;
let seq = 0;
const listeners = new Set<() => void>();

/** Starts one "near me" search on the Toilets tab; returns the nonce (also passed as the `find` route param). */
export function requestNearestToilet(): string {
  seq += 1;
  pending = `${Date.now().toString(36)}-${seq}`;
  listeners.forEach((l) => l());
  return pending;
}

/** Called once the Toilets tab has started the search for this nonce. */
export function clearNearestToilet(nonce: string): void {
  if (pending !== nonce) return;
  pending = null;
  listeners.forEach((l) => l());
}

/** The request waiting to run, or null. */
export function useNearestToiletRequest(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
  );
}
