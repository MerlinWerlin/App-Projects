// Typed wrapper for the GlazeHomeScan native module (iOS native builds only, T171).
// App code must NOT import this file: go through src/native/homeScan.ts, which falls back
// cleanly in Expo Go, on Android, on web and in builds without the module.
import { requireOptionalNativeModule } from 'expo';

/** One recognised line. Box is normalised 0..1 with a TOP-LEFT origin (flipped from Vision). */
export type GlazeTextObservation = { text: string; confidence: number; x: number; y: number; w: number; h: number };

export type GlazeHomeScanNative = {
  /** Reads the text in a local image file (file:// URI or path). Rejects when the file can't be read. */
  recognizeText(fileUri: string): Promise<GlazeTextObservation[]>;
};

/** The native module, or null where it isn't built in. */
export default requireOptionalNativeModule<GlazeHomeScanNative>('GlazeHomeScan');
