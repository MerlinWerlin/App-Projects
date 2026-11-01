// T122 rental car pick-up photos, device side. One photo with the camera (or, where there is no camera, one from
// Photos) through the journal's photo helpers (src/native/journal.ts: same permission handling, copied into
// Satchel's documents folder, attachments/). Nothing is uploaded and the photos never go into a trip file: the map
// lives in the booking's phone-only checklist (src/state/rental.ts). Never throws to the UI.
import type { PermissionState } from '../core/permissions.ts';
import { pickJournalPhotos, removeJournalPhotos, takeJournalPhoto, type PhotoFailure } from './journal.ts';

export type RentalPhotoPick = { ok: true; uri: string; mime: string } | { ok: false; reason: PhotoFailure; permission?: PermissionState };

export async function takeRentalPhoto(source: 'camera' | 'photos'): Promise<RentalPhotoPick> {
  const r = source === 'camera' ? await takeJournalPhoto() : await pickJournalPhotos(1);
  if (!r.ok) return r;
  const [p, ...extra] = r.photos;
  if (extra.length) await removeJournalPhotos(extra.map((x) => x.uri));
  if (!p) return { ok: false, reason: 'canceled' };
  return { ok: true, uri: p.uri, mime: p.mime };
}

/** Best-effort delete of rental photo copies (Satchel's own files only). */
export const removeRentalPhotos = (uris: readonly string[]): Promise<void> => removeJournalPhotos(uris.filter(Boolean));
