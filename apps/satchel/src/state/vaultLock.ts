// Document vault state shared by /vault, /doc/[id], /doc-edit and the Wallet card, without a Provider:
//  - the lock (module-level, so every vault screen sees the same unlocked session; starts locked each launch),
//    driven by the pure policy in src/core/vault.ts and a single AppState listener;
//  - the documents themselves, persisted on this device only under 'satchel.vault.v1'. File paths are rebased onto
//    this install's documents folder (iOS moves the app's container on update), and saved rebased on the next edit.
import { useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { TravelDoc } from '../core/model.ts';
import { cleanDocs, LOCKED, lockReducer, rebaseDocs, type LockEvent, type LockState } from '../core/vault.ts';
import { documentDir } from '../native/files.ts';
import { usePersisted } from './persisted.ts';

let lock: LockState = LOCKED;
const listeners = new Set<() => void>();
let watching = false;

export function dispatchLock(e: LockEvent): void {
  const next = lockReducer(lock, e);
  if (next === lock) return;
  lock = next;
  listeners.forEach((l) => l());
}

export const getLock = () => lock;

function watchAppState(): void {
  if (watching) return;
  watching = true;
  try {
    AppState.addEventListener('change', (s) => {
      // Only a real trip to the background counts; 'inactive' is also what the Face ID sheet causes.
      if (s === 'background') dispatchLock({ type: 'background', at: Date.now() });
      else if (s === 'active') dispatchLock({ type: 'active', at: Date.now() });
    });
  } catch {
    // no AppState (tests / unusual hosts): the vault still locks on leave and on Lock
  }
}

/** The shared lock state; starts the background watcher on first use. */
export function useVaultLock(): LockState {
  watchAppState();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lock,
  );
}

export const VAULT_KEY = 'satchel.vault.v1';
const NO_DOCS: TravelDoc[] = [];

/** [docs, setDocs, loaded]. Stored data is cleaned before use, so a damaged entry never crashes a screen. */
export function useVaultDocs(): [TravelDoc[], (next: TravelDoc[] | ((old: TravelDoc[]) => TravelDoc[])) => void, boolean] {
  const [raw, setRaw, loaded] = usePersisted<TravelDoc[]>(VAULT_KEY, NO_DOCS);
  const docs = useMemo(() => rebaseDocs(cleanDocs(raw), documentDir()), [raw]);
  const set = (next: TravelDoc[] | ((old: TravelDoc[]) => TravelDoc[])) =>
    setRaw((old) => (typeof next === 'function' ? next(rebaseDocs(cleanDocs(old), documentDir())) : next));
  return [docs, set, loaded];
}
