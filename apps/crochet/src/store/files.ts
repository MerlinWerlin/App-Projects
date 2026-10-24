// Photos and pattern files are copied into the app's own documents folder so they survive cache clears.
// Plain-words errors for every failure (shown in toasts).
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { newId, type PatternFile } from '../core/model';
import { t } from '../i18n';

export type PickResult<T> = { ok: true; value: T } | { ok: false; reason: 'cancelled' | 'denied' | 'failed'; message: string };

function dir(name: string): Directory {
  const d = new Directory(Paths.document, name);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function extOf(name: string, fallback: string): string {
  const m = name.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : fallback;
}

/** Copy a picked file into our folder; returns the new uri. */
function keep(uri: string, folder: string, ext: string): string {
  const src = new File(uri);
  const dest = new File(dir(folder), `${newId('f')}.${ext}`);
  src.copy(dest);
  return dest.uri;
}

export async function pickPhoto(source: 'library' | 'camera'): Promise<PickResult<string>> {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied', message: t('files.cameraDenied') };
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return { ok: false, reason: 'cancelled', message: '' };
    const a = res.assets[0];
    return { ok: true, value: keep(a.uri, 'photos', extOf(a.fileName ?? a.uri, 'jpg')) };
  } catch (e) {
    return { ok: false, reason: 'failed', message: t('files.photoFailed', { error: errText(e) }) };
  }
}

/** Pick a PDF or image pattern from Files / Downloads / iCloud / Drive. */
export async function pickPatternFile(): Promise<PickResult<PatternFile>> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return { ok: false, reason: 'cancelled', message: '' };
    const a = res.assets[0];
    const isPdf = (a.mimeType ?? '').includes('pdf') || /\.pdf$/i.test(a.name);
    const uri = keep(a.uri, 'patterns', isPdf ? 'pdf' : extOf(a.name, 'jpg'));
    return { ok: true, value: { id: newId('pf'), uri, name: a.name.replace(/\.[a-z0-9]+$/i, ''), kind: isPdf ? 'pdf' : 'image', barY: 0.35, barH: 0.07 } };
  } catch (e) {
    return { ok: false, reason: 'failed', message: t('files.patternFailed', { error: errText(e) }) };
  }
}

/** Pattern from a photo/screenshot in the photo library (Etsy/Instagram screenshots). */
export async function pickPatternImage(): Promise<PickResult<PatternFile>> {
  const r = await pickPhoto('library');
  if (!r.ok) return r;
  return { ok: true, value: { id: newId('pf'), uri: r.value, name: t('files.screenshot'), kind: 'image', barY: 0.35, barH: 0.07 } };
}

export function removeFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}

/** Write text to a file and open the share sheet (backup export). */
export async function shareText(name: string, text: string, mime = 'application/json'): Promise<PickResult<true>> {
  try {
    const f = new File(dir('exports'), name);
    if (f.exists) f.delete();
    f.create();
    f.write(text);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'failed', message: t('files.shareUnavailable') };
    await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
    return { ok: true, value: true };
  } catch (e) {
    return { ok: false, reason: 'failed', message: t('files.shareFailed', { error: errText(e) }) };
  }
}

export async function shareFile(uri: string, mime?: string): Promise<PickResult<true>> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'failed', message: t('files.shareUnavailable') };
    await Sharing.shareAsync(uri, mime ? { mimeType: mime } : undefined);
    return { ok: true, value: true };
  } catch (e) {
    return { ok: false, reason: 'failed', message: t('files.shareFailed', { error: errText(e) }) };
  }
}

export async function pickBackupText(): Promise<PickResult<string>> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return { ok: false, reason: 'cancelled', message: '' };
    return { ok: true, value: await new File(res.assets[0].uri).text() };
  } catch (e) {
    return { ok: false, reason: 'failed', message: t('files.importFailed', { error: errText(e) }) };
  }
}

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 120 ? `${m.slice(0, 117)}…` : m;
}
