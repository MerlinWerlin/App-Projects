// T124 home Wi-Fi and alarm codes for the house-sitter note, on this phone only (one set for your home, under
// src/core/leavehome.ts LEAVEHOME_CODES_KEY). Never on a Trip and never in a .satchel trip file (guard test in
// src/core/leavehome.test.ts). The stored value is cleaned on every read, so a damaged entry can't crash the screen.
import { useMemo } from 'react';
import { cleanCodes, LEAVEHOME_CODES_KEY, type HomeCodes } from '../core/leavehome.ts';
import { setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [codes (cleaned), loaded]. */
export function useHomeCodes(): [HomeCodes, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(LEAVEHOME_CODES_KEY, EMPTY);
  const codes = useMemo(() => cleanCodes(raw), [raw]);
  return [codes, loaded];
}

/** Saves the codes and waits for the write; false (nothing changed) if they can't be stored. */
export function saveHomeCodes(next: HomeCodes): Promise<boolean> {
  return setPersistedChecked<unknown>(LEAVEHOME_CODES_KEY, cleanCodes(next), EMPTY);
}
