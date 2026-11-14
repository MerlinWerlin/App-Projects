// Owner 2026-11-15 "Your artwork": pick one picture for a Custom slot with the same system photo
// picker as the theme backgrounds (pickBackgroundPhoto.ts) and its built-in square crop, where the
// person moves and zooms the picture into the square. No new permission: on iOS the system picker
// runs out of process; a denied / restricted library still surfaces as 'denied'.
import * as ImagePicker from 'expo-image-picker';

export type PickCustomArtResult =
  | { kind: 'picked'; uri: string }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'error' };

async function permissionDenied(): Promise<boolean> {
  try {
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    return p.status === 'denied' && !p.canAskAgain;
  } catch {
    return false;
  }
}

export async function pickCustomArtPhoto(): Promise<PickCustomArtResult> {
  let res: ImagePicker.ImagePickerResult;
  try {
    res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // The square crop / position step before the picture is saved.
      allowsEditing: true,
      aspect: [1, 1],
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
    });
  } catch {
    return (await permissionDenied()) ? { kind: 'denied' } : { kind: 'error' };
  }
  if (res.canceled || !res.assets || res.assets.length === 0) return { kind: 'cancelled' };
  const a = res.assets[0];
  if (!a.uri || a.type === 'video') return { kind: 'error' };
  return { kind: 'picked', uri: a.uri };
}
