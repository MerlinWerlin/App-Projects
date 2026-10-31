// T97 trusted contacts for "I'm safe": up to 5, on this phone only under SAFE_CONTACTS_KEY ('satchel.safeContacts.v1').
// Never part of a .satchel trip file. The stored value is cleaned on every read (src/core/safecheck.ts cleanContacts).
import { useMemo } from 'react';
import { cleanContacts, SAFE_CONTACTS_KEY, type SafeContact } from '../core/safecheck.ts';
import { setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = [];

/** [contacts (cleaned, stored order), loaded]. */
export function useSafeContacts(): [SafeContact[], boolean] {
  const [raw, , loaded] = usePersisted<unknown>(SAFE_CONTACTS_KEY, EMPTY);
  const list = useMemo(() => cleanContacts(raw), [raw]);
  return [list, loaded];
}

/** Applies a change and waits for the write; false (and nothing changed) if it can't be stored. */
export function saveSafeContacts(change: (old: SafeContact[]) => SafeContact[]): Promise<boolean> {
  return setPersistedChecked<unknown>(SAFE_CONTACTS_KEY, (old: unknown) => change(cleanContacts(old)), EMPTY);
}
