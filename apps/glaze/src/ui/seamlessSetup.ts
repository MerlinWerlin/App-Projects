// T133: helpers for "Use for my Glaze widget" on an art-pack theme (app/theme/[id].tsx). The widget
// bridge opens images with UIImage(contentsOfFile:), so bundled images must be local files. Never
// throws; Expo Go callers check widgets.isAvailable() first so nothing is downloaded there.
import { Dimensions, Image, PixelRatio } from 'react-native';
import { lookupDevice, type SeamlessDevice } from '../core/seamlessWidget';
import { isLocalFileUri } from '../core/seamlessSource';
import * as fs from '../native/fs';

/**
 * A local file URI (or plain path) for a bundled image (require() number). Release builds give a
 * file:// URI inside the app bundle; a dev build serves assets over http, so those are downloaded
 * to the cache as `name` first. null when it can't be made local.
 */
export async function localAssetUri(source: number | null, name: string): Promise<string | null> {
  if (source == null) return null;
  let uri: string | null = null;
  try {
    uri = Image.resolveAssetSource(source)?.uri ?? null;
  } catch {
    uri = null;
  }
  if (!uri) return null;
  if (uri.startsWith('file://') || uri.startsWith('/')) return uri;
  if (!/^https?:\/\//i.test(uri)) return null;
  try {
    const dir = fs.cacheDirectory;
    if (!dir) return null;
    await fs.makeDirectoryAsync(`${dir}seamless/`, { intermediates: true }).catch(() => undefined);
    const res = await fs.downloadAsync(uri, `${dir}seamless/${name}`);
    return res.status >= 200 && res.status < 300 ? res.uri : null;
  } catch {
    return null;
  }
}

/**
 * T168: a downloaded pack file (file:// URI) for the widget bridge, or null when it is not a local
 * file or is no longer on the phone. Never throws.
 */
export async function existingLocalFile(uri: string | null | undefined): Promise<string | null> {
  if (!isLocalFileUri(uri)) return null;
  try {
    const info = await fs.getInfoAsync(uri);
    return info.exists ? uri : null;
  } catch {
    return null;
  }
}

/** The device row for this phone (the same lookup SeamlessWidgetPreview uses). */
export function seamlessDeviceHere(): SeamlessDevice {
  try {
    const w = Dimensions.get('window');
    return lookupDevice({ width: w.width, height: w.height, scale: PixelRatio.get() }).device;
  } catch {
    return lookupDevice(null).device;
  }
}
