// T87 loyalty cards on this phone only, under LOYALTY_KEY ('satchel.loyalty.v1'). Never part of a .satchel trip file.
// The stored value is cleaned on every read (src/core/loyalty.ts cleanCards), so a bad or old entry can't crash a screen.
import { useMemo } from 'react';
import { cleanCards, LOYALTY_KEY, type LoyaltyCard } from '../core/loyalty.ts';
import { setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = [];

/** [cards (cleaned, stored order), loaded]. */
export function useLoyaltyCards(): [LoyaltyCard[], boolean] {
  const [raw, , loaded] = usePersisted<unknown>(LOYALTY_KEY, EMPTY);
  const cards = useMemo(() => cleanCards(raw), [raw]);
  return [cards, loaded];
}

/** Applies a change to the saved cards and waits for the write; false (and nothing changed) if it can't be stored. */
export function saveCards(change: (old: LoyaltyCard[]) => LoyaltyCard[]): Promise<boolean> {
  return setPersistedChecked<unknown>(LOYALTY_KEY, (old: unknown) => change(cleanCards(old)), EMPTY);
}
