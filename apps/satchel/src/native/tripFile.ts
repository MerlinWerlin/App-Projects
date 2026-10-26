// Trip file adapter (T15): reads attachment bytes, writes the .satchel file to the cache folder and hands it to the
// share sheet (AirDrop, Messages, Files), and picks a .satchel file to import. Built on the same Expo Go modules
// as the rest of src/native (expo-file-system/legacy, expo-sharing, expo-document-picker). Nothing here throws to
// the UI; every function returns a result with a reason instead.
// "Open in Satchel" from Files or Messages needs the .satchel document type registered in a dev build; until then
// importing goes through the picker (see docs/TRIPFILE.md).
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { MAX_TRIP_FILE_CHARS, TRIP_FILE_MIME } from '../core/tripfile.ts';
import { appPath, writeAppFile } from './files.ts';

/** The file's bytes as base64, or null when it can't be read (moved, deleted, no access). */
export async function readBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(appPath(uri), { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return null;
  }
}

export type WriteResult = { ok: true; uri: string } | { ok: false };

/** Writes the trip file's JSON text into the cache folder (replacing an older export of the same name). */
export async function writeTripFile(fileName: string, text: string): Promise<WriteResult> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return { ok: false };
    const folder = `${dir}trips/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
    const uri = `${folder}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
    return { ok: true, uri };
  } catch {
    return { ok: false };
  }
}

/** 'unavailable': this phone or build has no share sheet; 'failed': it couldn't be opened. */
export type ShareResult = 'shared' | 'unavailable' | 'failed';

export async function shareTripFile(uri: string, dialogTitle: string): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: TRIP_FILE_MIME, UTI: 'public.json', dialogTitle });
    return 'shared';
  } catch {
    return 'failed';
  }
}

export type PickedTrip = { ok: true; text: string } | { ok: false; reason: 'cancelled' | 'too-large' | 'unreadable' | 'unavailable' };

/** Lets the user choose a .satchel file and reads its text. Any file type is offered (.satchel isn't registered yet). */
export async function pickTripFile(): Promise<PickedTrip> {
  let uri: string;
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    if (a.size != null && a.size > MAX_TRIP_FILE_CHARS * 2) return { ok: false, reason: 'too-large' };
    uri = a.uri;
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/** Saves one imported attachment's bytes into Satchel's attachments folder. */
export async function saveImportedFile(attachmentId: string, name: string, base64: string): Promise<string | null> {
  const r = await writeAppFile('attachments', `${attachmentId}-${name.slice(-40)}`, base64);
  return r.ok ? r.uri : null;
}
