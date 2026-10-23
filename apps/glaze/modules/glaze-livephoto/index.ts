// Typed wrapper for the GlazeLivePhoto native module (iOS dev builds only).
// App code must NOT import this file: go through src/native/livephoto.ts, which falls back
// cleanly in Expo Go, on Android and in builds without the module.
import { requireOptionalNativeModule } from 'expo';

export type GlazeLivePhotoResult = 'saved' | 'denied';

export type GlazeLivePhotoNative = {
  /** JSON of LivePhotoPayload (src/core/livephoto.ts). Rejects on failure. */
  save(json: string): Promise<GlazeLivePhotoResult>;
};

/** The native module, or null where it isn't built in. */
export default requireOptionalNativeModule<GlazeLivePhotoNative>('GlazeLivePhoto');
