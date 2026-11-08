// T152 own photo as a trip cover, device side. One photo from the library through the system picker with its crop
// editor set to the cover's 16:9 (src/core/covers2.ts COVER_PHOTO_ASPECT), copied into Satchel's documents folder as
// covers/<tripId>-<stamp>.jpg. Nothing is uploaded; the path lives only in the phone-only cover store
// (src/state/coverPhotos.ts). Permission handling follows the journal's (src/native/journal.ts): the system picker
// needs no permission, so we only ask when it refuses, and report 'denied' with the state so the screen can offer
// Try again or Open Settings. Never throws to the UI.
import * as ImagePicker from 'expo-image-picker';
import { COVER_PHOTO_ASPECT, COVER_PHOTO_FOLDER, COVER_PHOTO_QUALITY, coverPhotoName, isCoverPhotoPath } from '../core/covers2.ts';
import { permissionState, type PermissionState } from '../core/permissions.ts';
import { appPath, copyIntoApp, removeAppFiles } from './files.ts';

export type CoverPhotoFailure = 'canceled' | 'denied' | 'unreadable' | 'storage';
export type CoverPhotoPick = { ok: true; uri: string } | { ok: false; reason: CoverPhotoFailure; permission?: PermissionState };

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: COVER_PHOTO_ASPECT,
  quality: COVER_PHOTO_QUALITY,
  exif: false,
};

async function launch(tripId: string): Promise<CoverPhotoPick> {
  const r = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (r.canceled || !r.assets?.length) return { ok: false, reason: 'canceled' };
  const name = coverPhotoName(tripId, Date.now());
  const dash = name.lastIndexOf('-');
  const saved = await copyIntoApp(r.assets[0].uri, COVER_PHOTO_FOLDER, name.slice(0, dash), name.slice(dash + 1));
  return saved.ok ? { ok: true, uri: saved.uri } : { ok: false, reason: 'storage' };
}

/** Lets the traveller pick and crop one photo for this trip's cover. */
export async function pickCoverPhoto(tripId: string): Promise<CoverPhotoPick> {
  try {
    return await launch(tripId);
  } catch {
    try {
      const current = permissionState(await ImagePicker.getMediaLibraryPermissionsAsync());
      if (current === 'granted' || current === 'limited') return { ok: false, reason: 'unreadable' };
      if (current !== 'ask') return { ok: false, reason: 'denied', permission: current === 'unavailable' ? 'unavailable' : 'blocked' };
      const asked = permissionState(await ImagePicker.requestMediaLibraryPermissionsAsync());
      if (asked !== 'granted' && asked !== 'limited') return { ok: false, reason: 'denied', permission: asked === 'ask' ? 'ask' : 'blocked' };
      return await launch(tripId);
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }
}

/** Best-effort delete of cover photo copies (only files inside covers/ are ever touched). */
export const removeCoverPhotos = (uris: readonly (string | null | undefined)[]): Promise<void> =>
  removeAppFiles(uris.filter((u): u is string => isCoverPhotoPath(u)));

/** The photo's path on this install (iOS moves the app container on update). */
export const coverPhotoPath = (uri: string): string => appPath(uri);
