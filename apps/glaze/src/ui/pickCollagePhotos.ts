// Pick 2..6 photos for a collage (T76) with the system photo picker (multiple selection, images
// only, in the order tapped). The picker's files sit in a temporary cache, so the collage screen
// copies them into app storage right after (src/store/collage.ts, T97); nothing is uploaded. Picking needs no Photos permission on iOS 14+ (the
// system picker runs out of process); a denied/restricted library still surfaces as 'denied'.
import * as ImagePicker from 'expo-image-picker';
import { MAX_PHOTOS, MIN_PHOTOS } from '../core/collage';
import { isUsableSize } from '../core/photoCrop';
import type { CollagePhoto } from '../render/CollageView';

export type PickCollageResult =
  | { kind: 'picked'; photos: CollagePhoto[]; trimmed: boolean }
  | { kind: 'cancelled' }
  | { kind: 'tooFew' }
  | { kind: 'denied' }
  | { kind: 'unreadable' }
  | { kind: 'error' };

async function permissionDenied(): Promise<boolean> {
  try {
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    return p.status === 'denied' && !p.canAskAgain;
  } catch {
    return false;
  }
}

export async function pickCollagePhotos(): Promise<PickCollageResult> {
  let res: ImagePicker.ImagePickerResult;
  try {
    res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
  } catch {
    return (await permissionDenied()) ? { kind: 'denied' } : { kind: 'error' };
  }
  if (res.canceled || !res.assets || res.assets.length === 0) return { kind: 'cancelled' };
  const usable: CollagePhoto[] = [];
  for (const a of res.assets) {
    if (!a.uri || a.type === 'video' || !isUsableSize({ width: a.width, height: a.height })) continue;
    usable.push({ uri: a.uri, width: Math.round(a.width), height: Math.round(a.height) });
  }
  if (usable.length === 0) return { kind: 'unreadable' };
  if (usable.length < MIN_PHOTOS) return { kind: 'tooFew' };
  return { kind: 'picked', photos: usable.slice(0, MAX_PHOTOS), trimmed: usable.length > MAX_PHOTOS };
}
