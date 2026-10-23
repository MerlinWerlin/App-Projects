// Typed wrapper for the GlazeAndroid native module (Android development builds only).
// App code must NOT import this file: go through src/native/android.ts, which falls back
// cleanly in Expo Go, on iOS and in builds without the module.
import { requireNativeModule } from 'expo';

/** "requested" | "unsupported" | "error:<reason>" */
export type GlazeAndroidResult = string;

export type GlazeAndroidNative = {
  /** JSON from wallpaperJson() in src/core/androidPayload.ts. */
  setVideoWallpaper(json: string): Promise<GlazeAndroidResult>;
  isPinShortcutSupported(): Promise<boolean>;
  /** JSON from pinShortcutJson() in src/core/androidPayload.ts. */
  pinShortcut(json: string): Promise<GlazeAndroidResult>;
};

export default requireNativeModule<GlazeAndroidNative>('GlazeAndroid');
