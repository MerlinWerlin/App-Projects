// T120 run-99 follow-ups (pure, no React Native imports).
//
// Saved-toilet pin -> Toilets tab: a tap on a saved toilet's pin on the Map tab opens the Toilets tab focused on that
// toilet in "My toilets". The request travels as a one-time token (a nonce plus the toilet id) both as the `focus`
// route param and in memory (src/state/focusToilet.ts), because navigating to a tab that is already open may keep its
// old params; the Toilets tab runs each token once.

/** The toilet id of a saved-toilet pin on the Map tab (`t:<id>`, src/core/maplayers.ts), else null. */
export function toiletIdOfPin(pinId: string): string | null {
  if (typeof pinId !== 'string' || !pinId.startsWith('t:')) return null;
  const id = pinId.slice(2);
  return id ? id : null;
}

export type ToiletFocus = { nonce: string; toiletId: string };

/** `<nonce>|<toilet id>` (the nonce never holds a bar; the id may). */
export const encodeToiletFocus = (f: ToiletFocus): string => `${f.nonce}|${f.toiletId}`;

export function parseToiletFocus(raw: unknown): ToiletFocus | null {
  if (typeof raw !== 'string' || raw.length > 400) return null;
  const at = raw.indexOf('|');
  if (at <= 0 || at === raw.length - 1) return null;
  return { nonce: raw.slice(0, at), toiletId: raw.slice(at + 1) };
}

/** The first token not run yet (in memory first, then the route param), or null. */
export function nextToiletFocus(candidates: readonly unknown[], handled: ReadonlySet<string>): ToiletFocus | null {
  for (const c of candidates) {
    const f = parseToiletFocus(c);
    if (f && !handled.has(f.nonce)) return f;
  }
  return null;
}
