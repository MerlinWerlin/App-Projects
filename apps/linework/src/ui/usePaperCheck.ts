// Photo-to-paper check: snapshot the camera view so the compare view can ghost the overlay on it.
// The snapshot stays in the app's cache folder and is deleted when the compare view closes.
// It is never saved to the photo library or uploaded.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { CameraView } from 'expo-camera';
import * as FileSystem from '../native/fs';
import { isSnapshot } from '../core/compare';
import { tap } from '../native/haptics';
import { t } from '../i18n';

export type Snapshot = { uri: string; width?: number; height?: number };

function discard(uri: string | undefined) {
  if (!uri) return;
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export function usePaperCheck(cameraRef: RefObject<CameraView | null>, onError?: (message: string) => void) {
  const [photo, setPhoto] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const photoRef = useRef<Snapshot | null>(null);
  photoRef.current = photo;

  // Leaving the trace screen with the compare view open still cleans up.
  useEffect(() => () => discard(photoRef.current?.uri), []);

  const take = useCallback(async () => {
    const cam = cameraRef.current;
    if (busyRef.current) return;
    if (!cam) {
      onError?.(t('trace.check.notReady'));
      return;
    }
    tap();
    busyRef.current = true;
    setBusy(true);
    try {
      // skipProcessing is left off: unprocessed captures can come back sideways on some devices.
      const pic: unknown = await cam.takePictureAsync({ quality: 0.5 });
      if (!isSnapshot(pic)) throw new Error('no picture');
      setPhoto({ uri: pic.uri, width: pic.width, height: pic.height });
      AccessibilityInfo.announceForAccessibility(t('trace.check.taken'));
    } catch {
      onError?.(t('trace.check.failed'));

    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [cameraRef, onError]);

  const close = useCallback(() => {
    tap();
    discard(photoRef.current?.uri);
    setPhoto(null);
  }, []);

  return { photo, busy, take, close };
}
