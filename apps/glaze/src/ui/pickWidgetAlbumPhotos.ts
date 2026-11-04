import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as FS from '../native/fs';
import { ALBUM_LIMIT, isAlbumLocalName } from '../core/widgetAlbum';

export function albumPhotoUri(name: string): string | null {
  return FS.documentDirectory && isAlbumLocalName(name) ? `${FS.documentDirectory}widget-album/${name}` : null;
}

/** System picker grants access only to selected images; no broad Photos permission request. */
export async function pickWidgetAlbumPhotos(): Promise<{ kind: 'picked'; names: string[] } | { kind: 'cancelled' | 'denied' | 'error' }> {
  const copied: string[] = [];
  try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false,
      allowsMultipleSelection: true, selectionLimit: ALBUM_LIMIT, orderedSelection: true, quality: 0.9, exif: false });
    if (result.canceled || !result.assets?.length) return { kind: 'cancelled' };
    if (!FS.documentDirectory || result.assets.length > ALBUM_LIMIT) return { kind: 'error' };
    await FS.makeDirectoryAsync(`${FS.documentDirectory}widget-album`, { intermediates: true });
    for (const asset of result.assets) {
      if (!asset.uri || asset.type === 'video' || asset.width < 1 || asset.height < 1) throw new Error('Unreadable image');
      // The native importer detects the content, regardless of the picker's original format.
      const name = `pick-${Crypto.randomUUID().toLowerCase()}.jpg`;
      const to = albumPhotoUri(name)!;
      await FS.copyAsync({ from: asset.uri, to });
      copied.push(name);
    }
    return { kind: 'picked', names: copied };
  } catch {
    await Promise.all(copied.map((name) => FS.deleteAsync(albumPhotoUri(name)!, { idempotent: true }).catch(() => undefined)));
    try {
      const p = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (p.status === 'denied' && !p.canAskAgain) return { kind: 'denied' };
    } catch { /* Keep a useful failure even when the permission query is unavailable. */ }
    return { kind: 'error' };
  }
}
