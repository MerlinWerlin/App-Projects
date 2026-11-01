// T152 trip cover photos on this phone only, one map under COVER_PHOTO_KEY (declared once in src/core/covers2.ts):
// tripId -> covers/<tripId>-<stamp>.jpg. Never on the Trip, so a .satchel file and "Plan this trip again" (new trip
// id) never carry it. The stored value is cleaned on every read. A replaced or removed photo's file goes once the
// new map is stored; deleting a trip drops its entry and file (src/state/trips.tsx cleanUpTrip -> forgetCoverPhoto).
import { useMemo } from 'react';
import { cleanCoverPhotos, COVER_PHOTO_KEY, coverPhotosValue, withCoverPhoto, withoutCoverPhoto } from '../core/covers2.ts';
import { coverPhotoPath, removeCoverPhotos } from '../native/coverPhoto.ts';
import { readPersisted, setPersistedChecked, usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** This trip's cover photo path on this install, or null (none, or not loaded yet). */
export function useCoverPhoto(tripId: string | undefined): string | null {
  const [raw] = usePersisted<unknown>(COVER_PHOTO_KEY, EMPTY);
  return useMemo(() => {
    const uri = tripId ? cleanCoverPhotos(raw)[tripId] : undefined;
    return uri ? coverPhotoPath(uri) : null;
  }, [raw, tripId]);
}

/** Stores a new photo for the trip; the previous photo's file goes once stored. False (photo file deleted) if it can't be stored. */
export async function setCoverPhoto(tripId: string, uri: string): Promise<boolean> {
  const old = cleanCoverPhotos(await readPersisted<unknown>(COVER_PHOTO_KEY, EMPTY))[tripId];
  const ok = await setPersistedChecked<unknown>(COVER_PHOTO_KEY, (prev: unknown) => coverPhotosValue(withCoverPhoto(cleanCoverPhotos(prev), tripId, uri)), EMPTY);
  if (!ok) {
    await removeCoverPhotos([uri]);
    return false;
  }
  if (old && old !== uri) await removeCoverPhotos([old]);
  return true;
}

/** Removes the trip's photo (back to the illustrated cover) and its file. False if the change can't be stored. */
export async function clearCoverPhoto(tripId: string): Promise<boolean> {
  const old = cleanCoverPhotos(await readPersisted<unknown>(COVER_PHOTO_KEY, EMPTY))[tripId];
  if (!old) return true;
  const ok = await setPersistedChecked<unknown>(COVER_PHOTO_KEY, (prev: unknown) => coverPhotosValue(withoutCoverPhoto(cleanCoverPhotos(prev), tripId)), EMPTY);
  if (ok) await removeCoverPhotos([old]);
  return ok;
}

/** A deleted trip's photo record and file go with it. Best effort, never throws. */
export function forgetCoverPhoto(tripId: string): void {
  if (!tripId) return;
  clearCoverPhoto(tripId).catch(() => {});
}
