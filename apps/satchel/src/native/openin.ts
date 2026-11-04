// T14 Open in / Copy to Satchel: the file side. An incoming file:// (iOS) or content:// (Android) URL is copied into
// <documents>/incoming/ first, so the rest of the flow never depends on the system's temporary copy (iOS puts it in
// Documents/Inbox and may clear it; Android's content:// grant ends with the activity). Its first bytes are read to
// tell what it is when the name doesn't say (src/core/openin.ts decideKind). Nothing here throws to the UI.
// On builds without the document types (Expo Go, older TestFlight builds) no file URL ever arrives, so none of
// this runs; when one does, every step falls back to an honest result instead of an error.
import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '../core/model.ts';
import {
  base64ToBytes,
  classifyFile,
  decideKind,
  decodeBytes,
  fileNameFromUrl,
  INCOMING_FOLDER,
  incomingName,
  isIncomingFileUrl,
  maxIncomingBytes,
  SNIFF_BYTES,
  type OpenInKind,
} from '../core/openin.ts';
import { documentDir } from './files.ts';

export type Received =
  | { ok: true; uri: string; name: string; kind: OpenInKind; size?: number }
  | { ok: false; reason: 'not-file' | 'too-large' | 'copy-failed'; name?: string };

/** Incoming copies older than this are removed the next time a file arrives (a flow left half way). */
const KEEP_MS = 24 * 60 * 60 * 1000;

const incomingDir = (): string | null => {
  const root = documentDir();
  return root ? `${root}${INCOMING_FOLDER}/` : null;
};

/** True when `uri` is one of our incoming copies (the only files discardIncoming will delete). */
export function isIncomingCopy(uri: string): boolean {
  const dir = incomingDir();
  return !!dir && uri.startsWith(dir) && !uri.slice(dir.length).includes('/') && !uri.includes('..');
}

async function pruneOld(dir: string): Promise<void> {
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    const now = Date.now();
    for (const n of names) {
      const info = await FileSystem.getInfoAsync(`${dir}${n}`);
      // modificationTime is in seconds.
      if (info.exists && !info.isDirectory && now - info.modificationTime * 1000 > KEEP_MS) await FileSystem.deleteAsync(`${dir}${n}`, { idempotent: true });
    }
  } catch {
    // best effort
  }
}

async function readHead(uri: string): Promise<Uint8Array | null> {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: SNIFF_BYTES });
    return base64ToBytes(b64);
  } catch {
    return null;
  }
}

/** Copies the incoming file into Satchel's incoming folder and says what kind of file it is. */
export async function receiveIncoming(url: string): Promise<Received> {
  if (!isIncomingFileUrl(url)) return { ok: false, reason: 'not-file' };
  const source = url.trim();
  const name = fileNameFromUrl(source);
  const dir = incomingDir();
  if (!dir) return { ok: false, reason: 'copy-failed', name };
  let size: number | undefined;
  try {
    const info = await FileSystem.getInfoAsync(source);
    if (info.exists && !info.isDirectory) size = info.size;
  } catch {
    // content:// sources may not report a size; the copy still works
  }
  // A .satchelbackup may be far larger than a booking file (T154); everything else keeps the 40 MB limit.
  if (size != null && size > maxIncomingBytes(classifyFile({ name }))) return { ok: false, reason: 'too-large', name };
  const to = `${dir}${incomingName(newId('in'), name)}`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    await pruneOld(dir);
    await FileSystem.copyAsync({ from: source, to });
  } catch {
    return { ok: false, reason: 'copy-failed', name };
  }
  // iOS's own Documents/Inbox copy is no longer needed (ours is in incoming/).
  const root = documentDir();
  if (root && source.startsWith(`${root}Inbox/`)) FileSystem.deleteAsync(source, { idempotent: true }).catch(() => {});
  const kind = decideKind({ name }, await readHead(to));
  return { ok: true, uri: to, name, kind, size };
}

/** The incoming file as text: UTF-8, else read byte for byte as Latin-1. Null when it can't be read at all. */
export async function readIncomingText(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return decodeBytes(base64ToBytes(b64), 'iso-8859-1');
    } catch {
      return null;
    }
  }
}

export async function incomingExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/** Deletes an incoming copy once it has been used or left (anything outside incoming/ is never touched). */
export async function discardIncoming(uri: string | undefined): Promise<void> {
  if (!uri || !isIncomingCopy(uri)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // a leftover copy is pruned next time
  }
}
