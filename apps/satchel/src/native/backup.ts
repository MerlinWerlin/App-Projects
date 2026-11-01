// Backup and restore, device side (T17). Reads every satchel.* AsyncStorage key and Satchel's own files
// (<documents>/attachments/ and, with "Include documents", <documents>/vault/), writes the .satchelbackup file to the
// cache folder one file's base64 at a time (append), and hands it to the share sheet (Save to Files, iCloud Drive,
// AirDrop). Restore picks a file with the document picker, and a checked plan (src/core/backup.ts) is written back:
// files first, then the keys; if a key write fails the keys it changed are put back. Nothing here throws to the UI.
// Offline city map packs (<documents>/maps/) are never read: they download again.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';
import {
  BACKUP_MIME,
  backupFileName,
  backupParts,
  countBackup,
  FILE_FOLDERS,
  fileEntry,
  KEY_PREFIX,
  pickKeys,
  shouldBackUpFile,
  type BackupCounts,
  type BackupFile,
  type RestorePlan,
} from '../core/backup.ts';
import { documentDir } from './files.ts';

const B64 = FileSystem.EncodingType.Base64;
const UTF8 = FileSystem.EncodingType.UTF8;
/** Never read a picked file above this into memory. */
export const MAX_RESTORE_BYTES = 400 * 1024 * 1024;

/** Every satchel.* key on this phone with its stored text. */
export async function readStoredKeys(): Promise<[string, string | null][]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX));
  const out: [string, string | null][] = [];
  // In slices, so one huge multiGet never has to cross the bridge at once.
  for (let i = 0; i < keys.length; i += 50) out.push(...(await AsyncStorage.multiGet(keys.slice(i, i + 50))).map(([k, v]) => [k, v] as [string, string | null]));
  return out;
}

export type AppFile = { path: string; size: number };

async function walk(root: string, rel: string, out: AppFile[]): Promise<void> {
  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(`${root}${rel}`);
  } catch {
    return; // folder not there yet
  }
  for (const name of names) {
    const path = `${rel}${name}`;
    try {
      const info = await FileSystem.getInfoAsync(`${root}${path}`, { size: true });
      if (!info.exists) continue;
      if (info.isDirectory) await walk(root, `${path}/`, out);
      else out.push({ path, size: info.size });
    } catch {
      // unreadable entry: left out
    }
  }
}

/** Satchel's own files that a backup with this setting carries (relative paths and sizes). */
export async function listBackupFiles(includeDocuments: boolean): Promise<AppFile[]> {
  const root = documentDir();
  if (!root) return [];
  const out: AppFile[] = [];
  for (const folder of FILE_FOLDERS) await walk(root, `${folder}/`, out);
  return out.filter((f) => shouldBackUpFile(f.path, includeDocuments));
}

export type BackupEstimate = { files: number; bytes: number };
export async function estimateBackup(includeDocuments: boolean): Promise<BackupEstimate> {
  try {
    const files = await listBackupFiles(includeDocuments);
    return { files: files.length, bytes: files.reduce((n, f) => n + f.size, 0) };
  } catch {
    return { files: 0, bytes: 0 };
  }
}

export type MadeBackup = { ok: true; uri: string; name: string; counts: BackupCounts; skipped: number } | { ok: false; reason: 'no-storage' | 'read' | 'write' };

/** Writes the backup into <cache>/backups/ and returns its uri. `skipped`: files that couldn't be read (left out). */
export async function makeBackup(opts: { includeDocuments: boolean; app: string; now: Date }): Promise<MadeBackup> {
  const cache = (() => {
    try {
      return FileSystem.cacheDirectory;
    } catch {
      return null;
    }
  })();
  const docDir = documentDir();
  if (!cache) return { ok: false, reason: 'no-storage' };
  let keys: Record<string, string>;
  let files: AppFile[];
  try {
    keys = pickKeys(await readStoredKeys(), opts.includeDocuments);
    files = await listBackupFiles(opts.includeDocuments);
  } catch {
    return { ok: false, reason: 'read' };
  }
  const created = opts.now.toISOString();
  const meta = { app: opts.app, created, docDir, includeDocuments: opts.includeDocuments };
  const name = backupFileName(created);
  const folder = `${cache}backups/`;
  const uri = `${folder}${name}`;
  const written: { size: number }[] = [];
  let skipped = 0;
  try {
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(uri, backupParts.head(meta, keys), { encoding: UTF8 });
    for (const f of files) {
      let entry: BackupFile | null = null;
      try {
        // One file in memory at a time.
        entry = fileEntry(f.path, await FileSystem.readAsStringAsync(`${docDir}${f.path}`, { encoding: B64 }));
      } catch {
        entry = null;
      }
      if (!entry) {
        skipped++;
        continue;
      }
      await FileSystem.writeAsStringAsync(uri, backupParts.file(entry, written.length), { encoding: UTF8, append: true });
      written.push(entry);
    }
    await FileSystem.writeAsStringAsync(uri, backupParts.tail(keys, written), { encoding: UTF8, append: true });
  } catch {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    return { ok: false, reason: 'write' };
  }
  return { ok: true, uri, name, counts: countBackup(keys, written), skipped };
}

export type ShareResult = 'shared' | 'unavailable' | 'failed';

/** The share sheet (Save to Files, iCloud Drive, AirDrop, Mail). */
export async function shareBackup(uri: string, dialogTitle: string): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: BACKUP_MIME, UTI: 'public.json', dialogTitle });
    return 'shared';
  } catch {
    return 'failed';
  }
}

export type PickedBackup = { ok: true; uri: string; size: number | null } | { ok: false; reason: 'cancelled' | 'unavailable' };

/** Lets the user choose a backup file (any type is offered: .satchelbackup isn't a registered type yet). */
export async function pickBackup(): Promise<PickedBackup> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    return { ok: true, uri: a.uri, size: a.size ?? null };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export type ReadBackup = { ok: true; text: string } | { ok: false; reason: 'too-large' | 'unreadable' };
export async function readBackupText(uri: string, size: number | null): Promise<ReadBackup> {
  if (size != null && size > MAX_RESTORE_BYTES) return { ok: false, reason: 'too-large' };
  try {
    return { ok: true, text: await FileSystem.readAsStringAsync(uri, { encoding: UTF8 }) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/** This phone's satchel.* keys now (for the plan). */
export async function currentStore(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of await readStoredKeys()) if (v != null) out[k] = v;
  return out;
}

/**
 * Writes a restore plan: files, then keys (multiSet), then removals. On a failed key write the keys already
 * changed are put back, so trips are never left half-restored (files written are harmless extras).
 */
export async function applyRestore(plan: RestorePlan, before: Record<string, string>): Promise<{ ok: true } | { ok: false; reason: 'no-storage' | 'files' | 'save' }> {
  const root = documentDir();
  if (!root) return { ok: false, reason: 'no-storage' };
  try {
    for (const f of plan.files) {
      const dir = f.path.slice(0, f.path.lastIndexOf('/') + 1);
      await FileSystem.makeDirectoryAsync(`${root}${dir}`, { intermediates: true }).catch(() => {});
      await FileSystem.writeAsStringAsync(`${root}${f.path}`, f.data, { encoding: B64 });
    }
  } catch {
    return { ok: false, reason: 'files' };
  }
  const pairs = Object.entries(plan.set);
  try {
    for (let i = 0; i < pairs.length; i += 50) await AsyncStorage.multiSet(pairs.slice(i, i + 50));
    if (plan.remove.length) await AsyncStorage.multiRemove(plan.remove);
    return { ok: true };
  } catch {
    // Put back what was there (and drop keys that weren't).
    const back = pairs.filter(([k]) => k in before).map(([k]) => [k, before[k]] as [string, string]);
    const added = pairs.filter(([k]) => !(k in before)).map(([k]) => k);
    await AsyncStorage.multiSet(back).catch(() => {});
    if (added.length) await AsyncStorage.multiRemove(added).catch(() => {});
    return { ok: false, reason: 'save' };
  }
}

/** Starts the app again so every screen reads the restored data. False when this build can't (ask to reopen). */
export async function restartApp(): Promise<boolean> {
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    // Expo Go / development: the dev reload
  }
  try {
    DevSettings.reload();
    return true;
  } catch {
    return false;
  }
}
