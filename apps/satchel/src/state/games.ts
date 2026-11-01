// T125 travel games state, on this phone only under GAMES_KEY (src/core/games.ts). Never on the Trip, so a .satchel
// trip file carries none of it. The stored value is cleaned on every read.
import { useMemo } from 'react';
import { cleanGames, GAMES_KEY, type GamesState } from '../core/games.ts';
import { setPersisted, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [state (cleaned), loaded]. */
export function useGames(): [GamesState, boolean] {
  const [raw, , loaded] = usePersisted<unknown>(GAMES_KEY, EMPTY);
  const state = useMemo(() => cleanGames(raw), [raw]);
  return [state, loaded];
}

/** Applies a change to the cleaned state and saves it (a failed write stays in memory for this session). */
export function saveGames(change: (old: GamesState) => GamesState): void {
  setPersisted<unknown>(GAMES_KEY, (old: unknown) => change(cleanGames(old)), EMPTY);
}
