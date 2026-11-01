// T14 Open in / Copy to Satchel: hands what came in through the share sheet to the screen that uses it, in memory, by
// a short key in the route params (like src/state/pasteDraft.ts): the text read from a shared email or text file
// for Paste a booking, and the attachment made from a shared PDF or image for the booking form. Nothing is stored;
// if the app restarts, the screen simply opens empty. Kept to the last few.
import type { Attachment } from '../core/model.ts';

const KEEP = 6;
const texts = new Map<string, string>();
const files = new Map<string, Attachment>();
let seq = 0;

function put<T>(map: Map<string, T>, prefix: string, v: T): string {
  seq += 1;
  const key = `${prefix}${Date.now().toString(36)}${seq}`;
  map.set(key, v);
  while (map.size > KEEP) map.delete(map.keys().next().value as string);
  return key;
}

/** Keeps shared text for Paste a booking; pass the key as its `incoming` param. */
export const stashIncomingText = (text: string): string => put(texts, 't', text);
/** The text kept under `key`, or undefined. */
export const incomingText = (key: string | undefined): string | undefined => (key ? texts.get(key) : undefined);

/** Keeps a ready attachment (already copied into attachments/) for the booking form; pass the key as `openin`. */
export const stashIncomingFile = (a: Attachment): string => put(files, 'f', a);
/** The attachment kept under `key`, or undefined (unknown key, or the app restarted). */
export const incomingFile = (key: string | undefined): Attachment | undefined => (key ? files.get(key) : undefined);
