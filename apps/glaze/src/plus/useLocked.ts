// The one way screens outside src/plus learn whether Plus content is locked, so the
// entitlement itself is only ever read inside src/plus.
import { usePlus } from './entitlement';

/** True when `plusOnly` content should show its locked state (also while loading). */
export function useLocked(plusOnly: boolean): boolean {
  const { plus } = usePlus();
  return plusOnly && plus !== true;
}
