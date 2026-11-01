// T127 lost-bag kit photos (outside and contents), device side. One photo with the camera (or one from Photos)
// through the journal's photo helpers (src/native/journal.ts: same permission handling, copied into Satchel's
// documents folder, attachments/). Nothing is uploaded and the photos never go into a trip file: the uris live in
// the bag's phone-only record (src/state/lostbag.ts). Never throws to the UI.
import type { PermissionState } from '../core/permissions.ts';
import { pickJournalPhotos, removeJournalPhotos, takeJournalPhoto, type PhotoFailure } from './journal.ts';

export type BagPhotoPick = { ok: true; uri: string; mime: string } | { ok: false; reason: PhotoFailure; permission?: PermissionState };

export async function takeBagPhoto(source: 'camera' | 'photos'): Promise<BagPhotoPick> {
  const r = source === 'camera' ? await takeJournalPhoto() : await pickJournalPhotos(1);
  if (!r.ok) return r;
  const [p, ...extra] = r.photos;
  if (extra.length) await removeJournalPhotos(extra.map((x) => x.uri));
  if (!p) return { ok: false, reason: 'canceled' };
  return { ok: true, uri: p.uri, mime: p.mime };
}

/** Best-effort delete of bag photo copies (Satchel's own files only). */
export const removeBagPhotos = (uris: readonly string[]): Promise<void> => removeJournalPhotos(uris.filter(Boolean));
