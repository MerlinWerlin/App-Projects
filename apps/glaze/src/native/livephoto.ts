// Live Photo export adapter (docs/PLAN.md §3, docs/LIVEPHOTO.md). The native module
// `GlazeLivePhoto` (modules/glaze-livephoto, T11) only exists in an iOS development build.
// Everywhere else, including Expo Go, this adapter reports "unavailable" and never throws.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { buildLivePhotoPayload, validateLivePhotoPayload, type LivePhotoBuildError } from '../core/livephoto';
import type { Device, LoopProject } from '../core/loop';

export type LivePhotoReason = 'expo-go' | 'android' | 'not-built' | null;
export type LivePhotoAvailability = { available: boolean; reason: LivePhotoReason };

/**
 * - saved: in Photos as a Live Photo
 * - denied: the user refused photo library access
 * - unavailable: no native module here (Expo Go, Android, build without it)
 * - unsupported: this loop can't become a Live Photo (GIF, too short)
 * - failed: the export or save went wrong
 */
export type LivePhotoOutcome = 'saved' | 'denied' | 'unavailable' | 'unsupported' | 'failed';

export interface LivePhotoAdapter {
  isAvailable(): Promise<LivePhotoAvailability>;
  save(project: LoopProject, device: Device): Promise<LivePhotoOutcome>;
}

/** Shape the T11 Swift module exposes (modules/glaze-livephoto/index.ts). */
type NativeLivePhoto = { save(json: string): Promise<string> };

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeLivePhoto | null | undefined;

function loadNative(): NativeLivePhoto | null {
  if (cached !== undefined) return cached;
  let found: NativeLivePhoto | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeLivePhoto>('GlazeLivePhoto')
        : null;
    found = mod && typeof mod.save === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

async function isAvailable(): Promise<LivePhotoAvailability> {
  try {
    if (Platform.OS !== 'ios') return { available: false, reason: 'android' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (!loadNative()) return { available: false, reason: 'not-built' };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

/** Why a loop can't be turned into a Live Photo, or null when it can. */
export function livePhotoProblem(project: LoopProject, device: Device): LivePhotoBuildError | null {
  try {
    const r = buildLivePhotoPayload(project, device);
    return r.ok ? null : r.error;
  } catch {
    return 'no-source';
  }
}

export const livephoto: LivePhotoAdapter = {
  isAvailable,
  async save(project, device) {
    try {
      const status = await isAvailable();
      const mod = status.available ? loadNative() : null;
      if (!mod) return 'unavailable';
      const built = buildLivePhotoPayload(project, device);
      if (!built.ok) return 'unsupported';
      if (validateLivePhotoPayload(built.payload).length > 0) return 'failed';
      const result = await mod.save(JSON.stringify(built.payload));
      if (result === 'saved') return 'saved';
      if (result === 'denied') return 'denied';
      return 'failed';
    } catch {
      return 'failed';
    }
  },
};
