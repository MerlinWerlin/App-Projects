// Run-93 follow-ups (T96), pure TypeScript.
//   - The Map tab's search result pin: one id, shared by the pin the map draws and the tap handler that opens the
//     result card for it (app/(tabs)/map.tsx, src/ui/MapSearch.tsx).
//   - What the Map does when a pin is tapped while a search result is shown: the search pin opens the result card
//     (and closes any other selected-place card so only one card is open); every other pin keeps its own handling.

/** Id of the pin Map search drops on the picked result. */
export const SEARCH_PIN_ID = 'q';

export const isSearchPin = (id: string): boolean => id === SEARCH_PIN_ID;

export type SearchPinTap = { open: 'result'; nonce: number } | { open: 'other' };

/**
 * Tapping a pin: the search pin (only while a result is picked) asks the search card to open, with a nonce one
 * above the last so every tap counts as a new request (the card fades in again and the list scrolls to it).
 */
export function searchPinTap(id: string, hasResult: boolean, lastNonce: number): SearchPinTap {
  if (isSearchPin(id) && hasResult) return { open: 'result', nonce: (Number.isSafeInteger(lastNonce) && lastNonce >= 0 ? lastNonce : 0) + 1 };
  return { open: 'other' };
}
