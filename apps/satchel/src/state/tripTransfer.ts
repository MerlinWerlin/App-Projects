// Trip export and import (T15), joining the pure .satchel format (src/core/tripfile.ts) to the file adapter
// (src/native/tripFile.ts) and the stores. Screens call these and show STATES_COPY errors from the result.
// Import is all-or-nothing: the file is checked in full, every attachment written, then the trip saved; if any
// step fails the files already written are removed and nothing else changes (EDGE_CASES "Trip export and import").
import type { Trip } from '../core/model.ts';
import { newId } from '../core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, putList, type PackStore } from '../core/packing.ts';
import { journalPhotos, withJournalFiles } from '../core/journal.ts';
import { buildTripFile, importTripFile, parseTripFileText, tripFileName, uniqueTripName, withFiles, type Payloads, type TripFileError } from '../core/tripfile.ts';
import { removeAppFiles } from '../native/files.ts';
import { pickTripFile, readBase64, saveImportedFile, shareTripFile, writeTripFile } from '../native/tripFile.ts';
import { kidsForFile } from '../core/kids.ts';
import { readKids, saveKids } from './kids.ts';
import { readPersisted, setPersistedChecked } from './persisted.ts';

/** 'write': the file couldn't be prepared; 'share' / 'unavailable': ready but the share sheet failed / isn't there. */
/** `skipped`: attachments that couldn't be read; `photosSkipped` (T68): journal photos asked for but left out. */
export type ExportResult = { ok: true; skipped: number; photosSkipped: number } | { ok: false; reason: 'write' | 'share' | 'unavailable'; uri?: string };

/** `includePhotos` (T68, off by default): put the journal photos' bytes in the file too. */
export async function exportTrip(trip: Trip, dialogTitle: string, opts: { includePhotos?: boolean } = {}): Promise<ExportResult> {
  let uri: string;
  let skipped = 0;
  let photosSkipped = 0;
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
    let photos: Record<string, string | undefined> | undefined;
    if (opts.includePhotos) {
      photos = {};
      for (const p of journalPhotos(trip)) {
        const data = await readBase64(p.uri);
        if (data != null) photos[p.id] = data;
      }
    }
    // T149: children's names go in only when the traveller turned that on for this trip (default off).
    const kids = kidsForFile(await readKids(trip.id));
    const built = buildTripFile(trip, payloads, { packing, journalPhotos: photos, kids });
    skipped = built.skipped;
    photosSkipped = built.photosSkipped;
    const written = await writeTripFile(tripFileName(trip.name), JSON.stringify(built.file));
    if (!written.ok) return { ok: false, reason: 'write' };
    uri = written.uri;
  } catch {
    return { ok: false, reason: 'write' };
  }
  return shareAgain(uri, dialogTitle, skipped, photosSkipped);
}

/** Opens the share sheet for an already prepared file (the "Try again" on error.export.share). */
export async function shareAgain(uri: string, dialogTitle: string, skipped = 0, photosSkipped = 0): Promise<ExportResult> {
  const shared = await shareTripFile(uri, dialogTitle);
  if (shared === 'shared') return { ok: true, skipped, photosSkipped };
  return { ok: false, reason: shared === 'unavailable' ? 'unavailable' : 'share', uri };
}

/** 'file': not a readable trip file; 'version': from a newer Satchel; 'save': couldn't be stored on this phone. */
export type ImportFailure = 'file' | 'version' | 'save' | 'unavailable';
/** `photosLeftOut` (T68): journal photos the file didn't carry (they stayed on the sender's phone). */
export type ImportResult = { ok: true; tripId: string; photosLeftOut: number } | { ok: false; reason: ImportFailure } | { ok: false; reason: 'cancelled' };

const failureFor = (e: TripFileError): ImportFailure => (e === 'version' ? 'version' : 'file');

/** What import needs from the trips store and the catalogue. */
export type ImportDeps = {
  /** The trips store's save (true once stored). */
  saveTrip: (t: Trip) => Promise<boolean>;
  /** The trips store's delete, used to undo the trip when its packing list can't be saved. */
  deleteTrip: (id: string) => Promise<boolean>;
  /** Names of the trips already on the phone; a matching imported name gets a '(copy)' suffix. */
  existingNames: readonly string[];
  /** Catalogue name for copy number n (1 = '<name> (copy)'). */
  copyName: (name: string, n: number) => string;
};

/** Picks a .satchel file and adds it as a new trip (all-or-nothing, packing list included). */
export async function importTrip(deps: ImportDeps, onReading?: () => void): Promise<ImportResult> {
  const picked = await pickTripFile();
  if (!picked.ok) {
    if (picked.reason === 'cancelled') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: picked.reason === 'unavailable' ? 'unavailable' : 'file' };
  }
  onReading?.();
  return importTripText(deps, picked.text);
}

/**
 * Adds the trip in a .satchel file's text as a new trip (all-or-nothing). Used by the picker path above and by T14
 * Open in (a .satchel file shared to Satchel from Files, Mail or Messages).
 */
export async function importTripText(deps: ImportDeps, text: string): Promise<ImportResult> {
  const { saveTrip, deleteTrip, existingNames, copyName } = deps;
  const parsed = parseTripFileText(text);
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
    // T68: journal photos the file carries go into attachments/ like booking files (same rebase and clean-up rules).
    const photoUris: Record<string, string> = {};
    for (const f of imp.journalFiles) {
      const uri = await saveImportedFile(f.photoId, f.name, f.data_base64);
      if (!uri) throw new Error('write');
      all.push(uri);
      photoUris[f.photoId] = uri;
    }
    const named = { ...imp.trip, name: uniqueTripName(imp.trip.name, existingNames, copyName) };
    const trip = withJournalFiles(withFiles(named, written), photoUris);
    if (!(await saveTrip(trip))) throw new Error('save');
    if (imp.packing) {
      const list = imp.packing;
      const stored = await setPersistedChecked<PackStore>(PACKING_KEY, (s) => putList(s && typeof s === 'object' && !Array.isArray(s) ? s : {}, list), EMPTY_STORE);
      if (!stored) {
        // Undo the trip too, so a failed import leaves the phone as it was (deleteTrip also removes its files).
        await deleteTrip(trip.id).catch(() => false);
        throw new Error('save');
      }
    }
    // T149: children the sender included go into this phone's kids store (best effort; the trip is already saved).
    if (imp.kids) await saveKids(trip.id, imp.kids).catch(() => false);
    return { ok: true, tripId: trip.id, photosLeftOut: imp.journalPhotosLeftOut };
  } catch {
    await removeAppFiles(all);
    return { ok: false, reason: 'save' };
  }
}
