// File-system adapter (oversight D5-1). The ONLY file allowed to import expo-file-system.
// Everything else imports this module, so if an Expo SDK bump drops 'expo-file-system/legacy'
// the fix is confined here (e.g. re-implement these calls on the new File/Directory API).
// A guard test (src/core/guard.test.ts) enforces that no other file imports expo-file-system.
// Surface kept to what the app uses; no behaviour change versus the direct legacy calls.
import * as Legacy from 'expo-file-system/legacy';

/** Writable cache directory URI with trailing slash, or null if unavailable. */
export const cacheDirectory: string | null = Legacy.cacheDirectory;

/** Persistent documents directory URI with trailing slash, or null if unavailable. */
export const documentDirectory: string | null = Legacy.documentDirectory;

/** String encodings accepted by writeAsStringAsync. */
export const EncodingType = {
  UTF8: Legacy.EncodingType.UTF8,
  Base64: Legacy.EncodingType.Base64,
} as const;

export type FileEncoding = (typeof EncodingType)[keyof typeof EncodingType];

export type FileInfo = { exists: boolean; size?: number };

export function makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void> {
  return Legacy.makeDirectoryAsync(uri, options);
}

export function writeAsStringAsync(uri: string, contents: string, options?: { encoding?: FileEncoding }): Promise<void> {
  return Legacy.writeAsStringAsync(uri, contents, options);
}

export function copyAsync(options: { from: string; to: string }): Promise<void> {
  return Legacy.copyAsync(options);
}

/** Move / rename a file (T108: a downloaded photo moves from its temp name once verified). */
export function moveAsync(options: { from: string; to: string }): Promise<void> {
  return Legacy.moveAsync(options);
}

/** Download a URL to a local file (T133: a dev-server asset becomes a file the widget bridge can read). */
export async function downloadAsync(uri: string, fileUri: string): Promise<{ uri: string; status: number }> {
  const res = await Legacy.downloadAsync(uri, fileUri);
  return { uri: res.uri, status: res.status };
}

export function deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void> {
  return Legacy.deleteAsync(uri, options);
}

export async function getInfoAsync(uri: string): Promise<FileInfo> {
  const info = await Legacy.getInfoAsync(uri);
  return info.exists ? { exists: true, size: info.size } : { exists: false };
}

/** Read a file as text (UTF-8) or base64 (T46 theme packs read binary assets as base64). */
export function readAsStringAsync(uri: string, options?: { encoding?: FileEncoding }): Promise<string> {
  return Legacy.readAsStringAsync(uri, options);
}

/** File names (not URIs) in a directory (T97 collage copy cleanup). */
export function readDirectoryAsync(uri: string): Promise<string[]> {
  return Legacy.readDirectoryAsync(uri);
}
