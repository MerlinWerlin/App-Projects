/**
 * Photo / video picker for casting (cast-1024, T91) over expo-image-picker. Loaded lazily by a
 * guarded require inside a function (like ./udp.ts and ./mediaServer.ts; Metro treats a require in
 * try/catch as optional), so a missing module returns null instead of crashing (web, tests).
 *
 * iOS is asked for the "compatible" representation of each asset, so it hands over JPEG instead of
 * HEIC and H.264 instead of HEVC, which TVs usually accept. Couch itself never transcodes.
 * JPEG, PNG and MP4 are the formats most TVs play; anything else is still queued but flagged
 * (isWidelySupported) so the screen can say it may not play. Not tested on a device.
 */
import type { CastKind } from '../core/cast/didl';
import type { QueueItem } from '../core/cast/queueTypes';

/** Minimal slice of expo-image-picker's ImagePickerAsset. */
export interface PickerAsset {
  uri: string;
  assetId?: string | null;
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo';
  mimeType?: string;
  fileName?: string | null;
  fileSize?: number;
  /** Milliseconds (videos). */
  duration?: number | null;
}

/** Minimal slice of the expo-image-picker module that we use (kept local so a missing module cannot break types). */
export interface ImagePickerModule {
  requestMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<{ granted: boolean; status?: string; canAskAgain?: boolean }>;
  launchImageLibraryAsync(options: Record<string, unknown>): Promise<{ canceled: boolean; assets: PickerAsset[] | null }>;
  UIImagePickerPreferredAssetRepresentationMode?: { Compatible?: string };
  VideoExportPreset?: { H264_1920x1080?: number };
}

declare const require: (id: string) => unknown;

function defaultLoadModule(): ImagePickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-image-picker') as (Partial<ImagePickerModule> & { default?: Partial<ImagePickerModule> }) | null;
    const m = (mod && typeof mod.launchImageLibraryAsync === 'function' ? mod : mod?.default) ?? null;
    if (!m || typeof m.launchImageLibraryAsync !== 'function' || typeof m.requestMediaLibraryPermissionsAsync !== 'function') {
      return null;
    }
    return m as ImagePickerModule;
  } catch {
    return null;
  }
}

let loadModule: () => ImagePickerModule | null = defaultLoadModule;

/** Test hook: replace the module loader; call with no argument to restore the default. */
export function _setImagePickerLoader(loader?: () => ImagePickerModule | null): void {
  loadModule = loader ?? defaultLoadModule;
}

export function hasMediaPicker(): boolean {
  try {
    return loadModule() !== null;
  } catch {
    return false;
  }
}

/** Most picks per round (the queue can grow over several picks). */
export const PICK_LIMIT = 50;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
};

/** Formats most TVs play from a phone. Others are queued but flagged. */
const WIDELY_SUPPORTED = new Set(['image/jpeg', 'image/png', 'video/mp4']);

export function isWidelySupported(mime: string): boolean {
  return WIDELY_SUPPORTED.has(mime.toLowerCase());
}

function extensionOf(name: string): string | null {
  const clean = name.split(/[?#]/)[0] ?? '';
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(clean);
  return m ? m[1]!.toLowerCase() : null;
}

function lastSegment(uri: string): string {
  const clean = uri.split(/[?#]/)[0] ?? uri;
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? clean;
}

/** Mime type of an asset: the picker's own, else from the file name or URI extension. */
export function mimeFor(asset: PickerAsset): string | null {
  const own = asset.mimeType?.trim().toLowerCase();
  if (own && /^(image|video)\/[a-z0-9][a-z0-9.+-]*$/.test(own)) return own;
  const ext = extensionOf(asset.fileName ?? '') ?? extensionOf(asset.uri);
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext]!;
  if (asset.type === 'video' || asset.type === 'pairedVideo') return 'video/mp4';
  if (asset.type === 'image' || asset.type === 'livePhoto') return 'image/jpeg';
  return null;
}

function kindFor(asset: PickerAsset, mime: string): CastKind {
  if (asset.type === 'video' || asset.type === 'pairedVideo') return 'video';
  if (asset.type === 'image' || asset.type === 'livePhoto') return 'photo';
  return mime.startsWith('video/') ? 'video' : 'photo';
}

let seq = 0;

/** Picked assets as queue items. Assets with no usable type are skipped. Ids are unique even for repeat picks. */
export function assetsToQueueItems(assets: readonly PickerAsset[]): QueueItem[] {
  const out: QueueItem[] = [];
  for (const a of assets) {
    if (!a || typeof a.uri !== 'string' || a.uri.length === 0) continue;
    const mime = mimeFor(a);
    if (!mime) continue;
    const kind = kindFor(a, mime);
    seq += 1;
    const item: QueueItem = {
      id: `${a.assetId ?? 'pick'}#${seq}`,
      uri: a.uri,
      mime,
      kind,
      title: (a.fileName && a.fileName.trim()) || lastSegment(a.uri),
    };
    if (kind === 'video' && typeof a.duration === 'number' && a.duration > 0) item.durationSec = Math.round(a.duration / 1000);
    if (typeof a.fileSize === 'number' && a.fileSize >= 0) item.sizeBytes = a.fileSize;
    out.push(item);
  }
  return out;
}

export type PickResult =
  | { kind: 'picked'; items: QueueItem[] }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

/** Picker options: multi-select photos and videos, compatible (JPEG / H.264) representations. */
export function pickerOptions(mod: ImagePickerModule): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: PICK_LIMIT,
    orderedSelection: true,
    quality: 0.9,
    exif: false,
    base64: false,
    preferredAssetRepresentationMode: mod.UIImagePickerPreferredAssetRepresentationMode?.Compatible ?? 'compatible',
  };
  // iOS: export videos as H.264 (1080p) where the module offers it; TVs rarely play HEVC.
  const h264 = mod.VideoExportPreset?.H264_1920x1080;
  if (typeof h264 === 'number') opts['videoExportPreset'] = h264;
  return opts;
}

/** Asks for photo access, then opens the picker. Never throws. */
export async function pickMediaDetailed(): Promise<PickResult> {
  let mod: ImagePickerModule | null;
  try {
    mod = loadModule();
  } catch {
    mod = null;
  }
  if (!mod) return { kind: 'unavailable' };
  try {
    const perm = await mod.requestMediaLibraryPermissionsAsync();
    if (!perm || !perm.granted) return { kind: 'denied' };
    const res = await mod.launchImageLibraryAsync(pickerOptions(mod));
    if (!res || res.canceled || !res.assets || res.assets.length === 0) return { kind: 'cancelled' };
    const items = assetsToQueueItems(res.assets);
    return items.length > 0 ? { kind: 'picked', items } : { kind: 'cancelled' };
  } catch {
    return { kind: 'failed' };
  }
}

/** The picked items, or null when cancelled, denied or the picker is unavailable. */
export async function pickMedia(): Promise<QueueItem[] | null> {
  const r = await pickMediaDetailed();
  return r.kind === 'picked' ? r.items : null;
}
