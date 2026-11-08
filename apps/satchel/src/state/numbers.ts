// T148 numbers quiz scores, on this phone only under NUMBERS_KEY (src/core/numbers.ts). Never on the Trip, so a
// .satchel trip file carries none of it. The stored value is cleaned on every read.
import { useMemo } from 'react';
import { cleanNumbers, NUMBERS_KEY, type NumbersState } from '../core/numbers.ts';
import { setPersisted, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [state (cleaned), loaded]. */
export function useNumbersScores(): [NumbersState, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(NUMBERS_KEY, EMPTY);
  const state = useMemo(() => cleanNumbers(raw), [raw]);
  return [state, loaded];
}

/** Applies a change to the cleaned state and saves it (a failed write stays in memory for this session). */
export function saveNumbersScores(change: (old: NumbersState) => NumbersState): void {
  setPersisted<unknown>(NUMBERS_KEY, (old: unknown) => change(cleanNumbers(old)), EMPTY);
}
