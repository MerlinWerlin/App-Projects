// The party in progress, shared between the Party tab (setup) and the party-play screen. In memory only.
import type { Party } from '../core/game.ts';

let current: Party | null = null;
let names: string[] = ['', ''];

export const partyStore = {
  get: () => current,
  set: (p: Party | null) => {
    current = p;
  },
  names: () => names,
  setNames: (n: string[]) => {
    names = n;
  },
};
