// Trip export and import (T15), joining the pure .satchel format (src/core/tripfile.ts) to the file adapter
// (src/native/tripFile.ts) and the stores. Screens call these and show STATES_COPY errors from the result.
// Import is all-or-nothing: the file is checked in full, every attachment written, then the trip saved; if any
// step fails the files already written are removed and nothing else changes (EDGE_CASES "Trip export and import").
import type { Trip } from '../core/model.ts';
import { newId } from '../core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, putList, type PackStore } from '../core/packing.ts';
import { buildTripFile, importTripFile, parseTripFileText, tripFileName, withFiles, type Payloads, type TripFileError } from '../core/tripfile.ts';
import { removeAppFiles } from '../native/files.ts';
import { pickTripFile, readBase64, saveImportedFile, shareTripFile, writeTripFile } from '../native/tripFile.ts';
import { readPersisted, setPersisted } from './persisted.ts';

/** 'write': the file couldn't be prepared; 'share' / 'unavailable': ready but the share sheet failed / isn't there. */
export type ExportResult = { ok: true; skipped: number } | { ok: false; reason: 'write' | 'share' | 'unavailable'; uri?: string };

export async function exportTrip(trip: Trip, dialogTitle: string): Promise<ExportResult> {
  let uri: string;
  let skipped = 0;
  try {
    const payloads: Payloads = {};
    for (const item of trip.items) {
      for (const a of item.attachments) {
        const data = await readBase64(a.uri);
        if (data == null) continue;
        const crop = a.qrCropUri && a.qrCropUri !== a.uri ? await readBase64(a.qrCropUri) : null;
        payloads[a.id] = { data, ...(crop ? { crop } : {}) };
      }
    }
    const packing = listFor(await readPersisted<PackStore>(PACKING_KEY, EMPTY_STORE), trip.id);
    const built = buildTripFile(trip, payloads, { packing });
    skipped = built.skipped;
    const written = await writeTripFile(tripFileName(trip.name), JSON.stringify(built.file));
    if (!written.ok) return { ok: false, reason: 'write' };
    uri = written.uri;
  } catch {
    return { ok: false, reason: 'write' };
  }
  return shareAgain(uri, dialogTitle, skipped);
}

/** Opens the share sheet for an already prepared file (the "Try again" on error.export.share). */
export async function shareAgain(uri: string, dialogTitle: string, skipped = 0): Promise<ExportResult> {
  const shared = await shareTripFile(uri, dialogTitle);
  if (shared === 'shared') return { ok: true, skipped };
  return { ok: false, reason: shared === 'unavailable' ? 'unavailable' : 'share', uri };
}

/** 'file': not a readable trip file; 'version': from a newer Satchel; 'save': couldn't be stored on this phone. */
export type ImportFailure = 'file' | 'version' | 'save' | 'unavailable';
export type ImportResult = { ok: true; tripId: string } | { ok: false; reason: ImportFailure } | { ok: false; reason: 'cancelled' };

const failureFor = (e: TripFileError): ImportFailure => (e === 'version' ? 'version' : 'file');

/** Picks a .satchel file and adds it as a new trip. `saveTrip` is the trips store's (true once stored). */
export async function importTrip(saveTrip: (t: Trip) => Promise<boolean>, onReading?: () => void): Promise<ImportResult> {
  const picked = await pickTripFile();
  if (!picked.ok) {
    if (picked.reason === 'cancelled') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: picked.reason === 'unavailable' ? 'unavailable' : 'file' };
  }
  onReading?.();
  const parsed = parseTripFileText(picked.text);
  if (!parsed.ok) return { ok: false, reason: failureFor(parsed.error) };
  const imp = importTripFile(parsed.file, newId);
  const written: Record<string, { uri: string; cropUri?: string }> = {};
  const all: string[] = [];
  try {
    for (const f of imp.files) {
      const uri = await saveImportedFile(f.attachmentId, f.name, f.data_base64);
      if (!uri) throw new Error('write');
      all.push(uri);
      let cropUri: string | undefined;
      if (f.crop_base64) {
        const c = await saveImportedFile(`${f.attachmentId}-crop`, f.name, f.crop_base64);
        if (!c) throw new Error('write');
        all.push(c);
        cropUri = c;
      }
      written[f.attachmentId] = { uri, cropUri };
    }
    const trip = withFiles(imp.trip, written);
    if (!(await saveTrip(trip))) throw new Error('save');
    if (imp.packing) {
      const list = imp.packing;
      await readPersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
      setPersisted<PackStore>(PACKING_KEY, (s) => putList(s && typeof s === 'object' && !Array.isArray(s) ? s : {}, list), EMPTY_STORE);
    }
    return { ok: true, tripId: trip.id };
  } catch {
    await removeAppFiles(all);
    return { ok: false, reason: 'save' };
  }
}
