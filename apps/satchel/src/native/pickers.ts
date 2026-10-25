// Pickers adapter: Files (PDF or image) and Photos (optionally cropped to the QR code), copied into Satchel's own
// documents folder, plus opening a saved file through the system share sheet. Never throws to the UI: every
// function resolves to a result with a reason the screen can explain.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import type { Attachment, ItemKind } from '../core/model.ts';
import { permissionState, type PermissionState } from '../core/permissions.ts';
import { newId } from '../core/model.ts';
import { isSupportedFile, makeAttachment, mimeFor } from '../core/tickets.ts';
import { appPath, copyIntoApp } from './files.ts';

/**
 * Why nothing was added. 'canceled' is silent (the user backed out); 'denied' means Photos access is off and the
 * screen offers Open Settings; 'unsupported' is not a PDF or image; 'unreadable' the picker failed;
 * 'storage' the copy into the app failed (most often a full phone).
 */
export type PickFailure = 'canceled' | 'denied' | 'unsupported' | 'unreadable' | 'storage';
export type Picked = { uri: string; name: string; mime: string; size?: number };
/** `permission` is set with 'denied': the Photos state ('blocked' = only Settings can change it), for PermissionNotice. */
type Failure = { ok: false; reason: PickFailure; permission?: PermissionState };
type PickResult = { ok: true; file: Picked } | Failure;
export type ImportResult = { ok: true; attachment: Attachment } | Failure;
export type CropResult = { ok: true; uri: string } | Failure;

async function pickFile(): Promise<PickResult> {
  try {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.length) return { ok: false, reason: 'canceled' };
    const a = r.assets[0];
    const mime = mimeFor(a.name, a.mimeType);
    if (!isSupportedFile(mime, a.name)) return { ok: false, reason: 'unsupported' };
    return { ok: true, file: { uri: a.uri, name: a.name, mime, size: a.size } };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/**
 * The system photo picker needs no Photos permission for a single pick, so we only ask when the picker refuses
 * (spec: "Request Photos access only if needed"). `crop` opens the square editor so the user frames the QR code.
 */
async function pickPhoto(crop: boolean): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = crop
    ? { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false }
    : { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false };
  const launch = async (): Promise<PickResult> => {
    const r = await ImagePicker.launchImageLibraryAsync(options);
    if (r.canceled || !r.assets?.length) return { ok: false, reason: 'canceled' };
    const a = r.assets[0];
    const name = a.fileName ?? '';
    const mime = mimeFor(name || a.uri, a.mimeType ?? 'image/jpeg');
    if (!isSupportedFile(mime, name)) return { ok: false, reason: 'unsupported' };
    return { ok: true, file: { uri: a.uri, name, mime, size: a.fileSize } };
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

/** True when the phone clearly has no room for `size` bytes. Unknown sizes or free space never block. */
async function noRoomFor(size?: number): Promise<boolean> {
  if (!size) return false;
  try {
    return (await FileSystem.getFreeDiskStorageAsync()) < size;
  } catch {
    return false;
  }
}

async function saveCopy(file: Picked, id: string): Promise<{ ok: true; uri: string } | Failure> {
  if (await noRoomFor(file.size)) return { ok: false, reason: 'storage' };
  const saved = await copyIntoApp(file.uri, 'attachments', id, file.name || `${id}.${file.mime === 'application/pdf' ? 'pdf' : 'jpg'}`);
  return saved.ok ? { ok: true, uri: saved.uri } : { ok: false, reason: 'storage' };
}

/** Picks a PDF or image from Files or Photos and saves a local copy, ready to add to a booking of `kind`. */
export async function importAttachment(source: 'files' | 'photos', kind: ItemKind): Promise<ImportResult> {
  const picked = source === 'files' ? await pickFile() : await pickPhoto(false);
  if (!picked.ok) return picked;
  const id = newId('att');
  const saved = await saveCopy(picked.file, id);
  if (!saved.ok) return saved;
  return { ok: true, attachment: makeAttachment({ id, uri: saved.uri, name: picked.file.name, mime: picked.file.mime, kind }) };
}

/** Picks the ticket image from Photos with the square crop editor and saves the crop locally. */
export async function importQrCrop(forId: string): Promise<CropResult> {
  const picked = await pickPhoto(true);
  if (!picked.ok) return picked;
  // A fresh name per crop so a replaced crop never shows a cached old image.
  const saved = await saveCopy({ ...picked.file, name: `qr.${picked.file.mime === 'image/png' ? 'png' : 'jpg'}` }, `${forId}-qr${Date.now().toString(36)}`);
  return saved;
}

/** Opens a saved file (a PDF ticket) in the system share sheet, which can preview it. False if it could not. */
export async function openInSystem(uri: string, mime: string, title: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(appPath(uri), { mimeType: mime, UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}
