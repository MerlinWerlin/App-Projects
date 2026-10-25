// Pickers for vault copies (Photos, Files) and opening a saved PDF in the system viewer. Guarded: nothing here
// throws; the UI gets a reason instead ('denied' means show Open Settings). Files never leave the device here:
// picked files are copied into the app by src/native/files.ts, and openFile only hands the local file to the
// system share / preview sheet when the user asks for it.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { permissionState, type PermissionState } from '../core/permissions.ts';
import { mimeFor } from '../core/vault.ts';

export type PickedFile = { uri: string; name: string; mime: string };
export type PickFailure = 'cancelled' | 'denied' | 'unavailable' | 'error';
/** `permission` says why a 'denied' pick failed ('blocked' = only Settings can change it), for PermissionNotice. */
export type PickResult = { ok: true; file: PickedFile } | { ok: false; reason: PickFailure; permission?: PermissionState };

/** The Photos permission state after the picker refused, or null when access is not the problem. */
async function photosRefusal(): Promise<PermissionState | null> {
  try {
    const s = permissionState(await ImagePicker.getMediaLibraryPermissionsAsync());
    return s === 'blocked' || s === 'ask' ? s : null;
  } catch {
    return null;
  }
}

/** A photo from the library (the system picker needs no library permission on current iOS). */
export async function pickPhoto(): Promise<PickResult> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
    if (res.canceled || !res.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    const name = a.fileName || `photo-${Date.now()}.jpg`;
    return { ok: true, file: { uri: a.uri, name, mime: mimeFor(name, a.mimeType ?? 'image/jpeg') } };
  } catch {
    const refusal = await photosRefusal();
    return refusal ? { ok: false, reason: 'denied', permission: refusal } : { ok: false, reason: 'unavailable', permission: 'unavailable' };
  }
}

/** A PDF or image from Files. */
export async function pickFile(): Promise<PickResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    const name = a.name || `file-${Date.now()}`;
    return { ok: true, file: { uri: a.uri, name, mime: mimeFor(name, a.mimeType) } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

const UTI: Record<string, string> = { 'application/pdf': 'com.adobe.pdf', 'image/jpeg': 'public.jpeg', 'image/png': 'public.png' };

/** Opens a saved file in the system sheet (preview, print, Files). false when it could not be shown. */
export async function openFile(uri: string, mime: string, dialogTitle: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: mime, UTI: UTI[mime], dialogTitle });
    return true;
  } catch {
    return false;
  }
}
