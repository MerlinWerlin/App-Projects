// Journal photos, device side (T64). Picks photos from the library (several at once, up to the room left on the
// page) or takes one with the camera, and copies each into Satchel's own documents folder (attachments/, the same
// place booking files live, so the container rebase and clean-up rules apply). Nothing is ever uploaded. Never
// throws to the UI: every failure is a reason the editor can explain.
import * as ImagePicker from 'expo-image-picker';
import type { JournalPhoto } from '../core/journal.ts';
import { newId } from '../core/model.ts';
import { permissionState, type PermissionState } from '../core/permissions.ts';
import { mimeFor } from '../core/tickets.ts';
import { copyIntoApp, removeAppFiles } from './files.ts';

/** 'canceled' is silent; 'denied' offers Settings ('blocked') or Try again ('ask'); 'unavailable' no camera. */
export type PhotoFailure = 'canceled' | 'denied' | 'unavailable' | 'unreadable' | 'storage';
export type PhotoPick = { ok: true; photos: JournalPhoto[] } | { ok: false; reason: PhotoFailure; permission?: PermissionState };

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 0.8, exif: false };

async function copyAll(assets: readonly ImagePicker.ImagePickerAsset[]): Promise<PhotoPick> {
  const photos: JournalPhoto[] = [];
  for (const a of assets) {
    const id = newId('jph');
    const mime = mimeFor(a.fileName || a.uri, a.mimeType ?? 'image/jpeg');
    const name = a.fileName || `${id}.${mime === 'image/png' ? 'png' : 'jpg'}`;
    const saved = await copyIntoApp(a.uri, 'attachments', id, name);
    if (!saved.ok) {
      // all or nothing: copies already made for this pick go again
      await removeAppFiles(photos.map((p) => p.uri));
      return { ok: false, reason: 'storage' };
    }
    photos.push({ id, uri: saved.uri, name, mime, ...(a.fileSize ? { size: a.fileSize } : {}) });
  }
  return { ok: true, photos };
}

/** Picks up to `max` photos from the library. The system picker needs no permission; we only ask if it refuses. */
export async function pickJournalPhotos(max: number): Promise<PhotoPick> {
  if (max <= 0) return { ok: false, reason: 'canceled' };
  const launch = async (): Promise<PhotoPick> => {
    const r = await ImagePicker.launchImageLibraryAsync({ ...OPTIONS, allowsMultipleSelection: max > 1, selectionLimit: max, orderedSelection: true });
    if (r.canceled || !r.assets?.length) return { ok: false, reason: 'canceled' };
    return copyAll(r.assets.slice(0, max));
  };
  try {
    return await launch();
  } catch {
    try {
      const current = permissionState(await ImagePicker.getMediaLibraryPermissionsAsync());
      if (current === 'granted' || current === 'limited') return { ok: false, reason: 'unreadable' };
      if (current !== 'ask') return { ok: false, reason: 'denied', permission: current === 'unavailable' ? 'unavailable' : 'blocked' };
      const asked = permissionState(await ImagePicker.requestMediaLibraryPermissionsAsync());
      if (asked !== 'granted' && asked !== 'limited') return { ok: false, reason: 'denied', permission: asked === 'ask' ? 'ask' : 'blocked' };
      return await launch();
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }
}

/** Takes one photo with the camera (asks for camera access first if it hasn't been decided). */
export async function takeJournalPhoto(): Promise<PhotoPick> {
  try {
    let state = permissionState(await ImagePicker.getCameraPermissionsAsync());
    if (state === 'ask') state = permissionState(await ImagePicker.requestCameraPermissionsAsync());
    if (state === 'unavailable') return { ok: false, reason: 'unavailable' };
    if (state !== 'granted' && state !== 'limited') return { ok: false, reason: 'denied', permission: state };
    const r = await ImagePicker.launchCameraAsync(OPTIONS);
    if (r.canceled || !r.assets?.length) return { ok: false, reason: 'canceled' };
    return copyAll(r.assets.slice(0, 1));
  } catch {
    // simulators and some phones have no camera: the picker throws
    return { ok: false, reason: 'unavailable' };
  }
}

/** Best-effort delete of journal photo copies (Satchel's own files only). */
export const removeJournalPhotos = (uris: readonly string[]): Promise<void> => removeAppFiles(uris);
