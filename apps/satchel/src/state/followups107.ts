// T151 Plan this trip again: the children list (phone-only, src/state/kids.ts) onto the new trip's own phone-only
// store, by src/core/followups107.ts copyKids (new ids; kid-friendly marks never). Nothing goes on the Trip.
import { copyKids } from '../core/followups107.ts';
import { readKids, saveKids } from './kids.ts';

/** Best effort; false if it couldn't be stored. Nothing to copy counts as done. */
export async function copyKidsList(fromTripId: string, toTripId: string, newId: (prefix: string) => string): Promise<boolean> {
  try {
    const from = await readKids(fromTripId);
    if (!from.children.length) return true;
    return await saveKids(toTripId, copyKids(from, newId));
  } catch {
    return false;
  }
}
