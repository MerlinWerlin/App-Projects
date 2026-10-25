// Files adapter: copies picked files into Satchel's own documents folder so they work offline and survive the
// picker's temporary cache being cleared. Never throws to the UI; returns a reason instead.
// iOS moves the app's container on update or restore, so every path is rebased onto this install's documents
// folder before use (src/core/tickets.ts rebaseUri); stored data is rebased on load in src/state.
import * as FileSystem from 'expo-file-system/legacy';
import { isAppFile, rebaseUri } from '../core/tickets.ts';

export type Saved = { ok: true; uri: string } | { ok: false; reason: 'no-storage' | 'copy-failed'; detail?: string };

const safe = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';

/** This install's documents folder (ends with '/'), or null where there is none. */
export function documentDir(): string | null {
  try {
    return FileSystem.documentDirectory ?? null;
  } catch {
    return null;
  }
}

/** A saved file's URI on this install (a stale container path or a stored relative path becomes current). */
export function appPath(uri: string): string {
  try {
    return rebaseUri(uri, documentDir());
  } catch {
    return uri;
  }
}

/** Copies `uri` into <documents>/<folder>/<id>-<name>. */
export async function copyIntoApp(uri: string, folder: 'attachments' | 'vault', id: string, name: string): Promise<Saved> {
  const root = documentDir();
  if (!root) return { ok: false, reason: 'no-storage' };
  const dir = `${root}${folder}/`;
  const to = `${dir}${id}-${safe(name)}`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    await FileSystem.copyAsync({ from: uri, to });
    return { ok: true, uri: to };
  } catch (e) {
    return { ok: false, reason: 'copy-failed', detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Writes base64 bytes to <documents>/<folder>/<name> (replacing it), e.g. the demo trip's sample images. */
export async function writeAppFile(folder: 'attachments' | 'vault', name: string, base64: string): Promise<Saved> {
  const root = documentDir();
  if (!root) return { ok: false, reason: 'no-storage' };
  const dir = `${root}${folder}/`;
  const to = `${dir}${safe(name)}`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(to, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { ok: true, uri: to };
  } catch (e) {
    return { ok: false, reason: 'copy-failed', detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function removeFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(appPath(uri), { idempotent: true });
  } catch {
    // already gone
  }
}

/** Best-effort delete of Satchel's own copies only (anything outside attachments/ and vault/ is left alone). */
export async function removeAppFiles(uris: readonly string[]): Promise<void> {
  try {
    const dir = documentDir();
    await Promise.all(uris.filter((u) => isAppFile(u, dir)).map((u) => removeFile(u)));
  } catch {
    // best effort: a leftover file is harmless
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(appPath(uri))).exists;
  } catch {
    return false;
  }
}
