// Receipt photos (T111), device side. Takes one photo with the camera or picks one from Photos through the journal's
// photo helpers (src/native/journal.ts: same permission handling, copied into Satchel's documents folder,
// attachments/), and writes the spending CSV for the share sheet (same pattern as the .ics calendar file).
// Receipts stay on this phone: the map lives in AsyncStorage (src/core/insights.ts RECEIPTS_KEY), never on the trip.
// Never throws to the UI.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CSV_MIME, CSV_UTI } from '../core/insights.ts';
import { pickJournalPhotos, removeJournalPhotos, takeJournalPhoto, type PhotoFailure } from './journal.ts';
import type { PermissionState } from '../core/permissions.ts';

export type ReceiptPick = { ok: true; uri: string; mime: string } | { ok: false; reason: PhotoFailure; permission?: PermissionState };

/** One receipt photo from the camera or Photos, already copied into the app. */
export async function pickReceipt(source: 'camera' | 'photos'): Promise<ReceiptPick> {
  const r = source === 'camera' ? await takeJournalPhoto() : await pickJournalPhotos(1);
  if (!r.ok) return r;
  const [p, ...extra] = r.photos;
  if (extra.length) await removeJournalPhotos(extra.map((x) => x.uri));
  if (!p) return { ok: false, reason: 'canceled' };
  return { ok: true, uri: p.uri, mime: p.mime };
}

/** Best-effort delete of receipt copies (Satchel's own files only). */
export const removeReceiptFiles = (uris: readonly string[]): Promise<void> => removeJournalPhotos(uris.filter(Boolean));

/** 'write': the file couldn't be written; 'unavailable': no share sheet; 'failed': it didn't open. */
export type CsvShareResult = 'shared' | 'write' | 'unavailable' | 'failed';

export async function shareCsvFile(fileName: string, text: string, dialogTitle: string): Promise<CsvShareResult> {
  let uri: string;
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return 'write';
    const folder = `${dir}spending/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
    uri = `${folder}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    return 'write';
  }
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: CSV_MIME, UTI: CSV_UTI, dialogTitle });
    return 'shared';
  } catch {
    return 'failed';
  }
}
