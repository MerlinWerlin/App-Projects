// T121 help card photo, device side: one photo from the camera or Photos through the journal's photo helpers (same
// permission handling, copied into Satchel's documents folder, attachments/). The photo stays on this phone: its path
// lives only in the phone-only help card store (src/state/helpcards.ts), never on a trip. Never throws to the UI.
import type { PermissionState } from '../core/permissions.ts';
import { appPath } from './files.ts';
import { pickJournalPhotos, removeJournalPhotos, takeJournalPhoto, type PhotoFailure } from './journal.ts';

export type HelpPhotoPick = { ok: true; uri: string } | { ok: false; reason: PhotoFailure; permission?: PermissionState };

export async function pickHelpPhoto(source: 'camera' | 'photos'): Promise<HelpPhotoPick> {
  const r = source === 'camera' ? await takeJournalPhoto() : await pickJournalPhotos(1);
  if (!r.ok) return r;
  const [p, ...extra] = r.photos;
  if (extra.length) await removeJournalPhotos(extra.map((x) => x.uri));
  if (!p) return { ok: false, reason: 'canceled' };
  return { ok: true, uri: p.uri };
}

/** Best-effort delete of a help card photo (Satchel's own files only). */
export const removeHelpPhoto = (uri: string | null | undefined): Promise<void> => (uri ? removeJournalPhotos([uri]) : Promise.resolve());

/** The photo's path on this install (iOS moves the app container on update). */
export const helpPhotoPath = (uri: string): string => appPath(uri);
