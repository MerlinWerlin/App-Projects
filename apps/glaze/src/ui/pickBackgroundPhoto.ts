// Pick a photo for a theme background (T25) with the system photo picker and keep a
// private copy in the documents folder. No editing UI: Glaze's own crop editor frames it
// to the device. Picking needs no Photos permission on iOS 14+ (the system picker runs
// out of process); a denied/restricted library still surfaces as 'denied'.
import * as ImagePicker from 'expo-image-picker';
import { isUsableSize } from '../core/photoCrop';
import { keepPhotoCopy } from '../store/background';

export type PickPhotoResult =
  | { kind: 'picked'; uri: string; imageW: number; imageH: number }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'unreadable' }
  | { kind: 'copyFailed' }
  | { kind: 'error' };

/** Failure kinds the caller turns into a message (app/wallpaper.tsx maps them to `wallpaper.pick.*`). */
export type PickPhotoFailure = Exclude<PickPhotoResult['kind'], 'picked' | 'cancelled'>;

async function permissionDenied(): Promise<boolean> {
  try {
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    return p.status === 'denied' && !p.canAskAgain;
  } catch {
    return false;
  }
}

export async function pickBackgroundPhoto(themeId: string): Promise<PickPhotoResult> {
  let res: ImagePicker.ImagePickerResult;
  try {
    res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
    });
  } catch {
    return (await permissionDenied()) ? { kind: 'denied' } : { kind: 'error' };
  }
  if (res.canceled || !res.assets || res.assets.length === 0) return { kind: 'cancelled' };
  const a = res.assets[0];
  if (!a.uri || a.type === 'video' || !isUsableSize({ width: a.width, height: a.height })) return { kind: 'unreadable' };
  const kept = await keepPhotoCopy(a.uri, themeId);
  if (!kept) return { kind: 'copyFailed' };
  return { kind: 'picked', uri: kept, imageW: Math.round(a.width), imageH: Math.round(a.height) };
}
