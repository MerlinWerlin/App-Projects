// Save-to-Photos adapter for timelapse clips (T09). Asks for write-only ("add photos") access, never read access.
// Never throws: every outcome comes back as a SaveResult so the UI can explain it (in the user's language;
// `detail` is the system's technical error text, if any).
import * as MediaLibrary from 'expo-media-library';
import { Linking } from 'react-native';
import { permissionStep } from '../core/timelapse';

export type SaveResult =
  | { kind: 'saved' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'error'; detail?: string };

const WRITE_ONLY = true;

export async function saveVideoToPhotos(uri: string): Promise<SaveResult> {
  try {
    let perm = await MediaLibrary.getPermissionsAsync(WRITE_ONLY);
    let step = permissionStep(perm);
    if (step === 'ask') {
      perm = await MediaLibrary.requestPermissionsAsync(WRITE_ONLY);
      step = permissionStep(perm);
    }
    if (step !== 'save') {
      return { kind: 'denied', canAskAgain: perm.canAskAgain };
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return { kind: 'saved' };
  } catch (e) {
    return { kind: 'error', detail: e instanceof Error && e.message ? e.message : undefined };

  }
}

/** Opens Linework's page in the system Settings so the user can allow Photos access. */
export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}
