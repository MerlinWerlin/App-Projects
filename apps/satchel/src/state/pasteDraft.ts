// T77 Paste a booking: hands a pasted draft from app/paste-booking.tsx to the booking form (app/item-edit.tsx) in
// memory, by a short key in the route params (a whole draft would not fit nicely in a URL). Nothing is stored: if
// the app restarts, the form simply opens empty. Kept to the last few drafts.
import type { AirportInfo } from '../core/leaveby.ts';
import type { ItemDraft } from '../core/trips.ts';

export type PastedDraft = { draft: ItemDraft; airport?: AirportInfo };

const KEEP = 8;
const drafts = new Map<string, PastedDraft>();
let seq = 0;

/** Keeps a draft for the booking form and returns the key to pass as the `paste` param. */
export function stashPastedDraft(d: PastedDraft): string {
  seq += 1;
  const key = `p${Date.now().toString(36)}${seq}`;
  drafts.set(key, d);
  while (drafts.size > KEEP) drafts.delete(drafts.keys().next().value as string);
  return key;
}

/** The draft kept under `key`, or undefined (unknown key, or the app restarted). */
export function pastedDraft(key: string | undefined): PastedDraft | undefined {
  return key ? drafts.get(key) : undefined;
}
