import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type PcmNative = { decodeToWav(uri: string): Promise<string> };
let native: PcmNative | null = null;
if (Platform.OS === 'android') {
  try { native = requireOptionalNativeModule<PcmNative>('BackspinPcm'); } catch { /* Expo Go */ }
}

export const hasAndroidPcm = typeof native?.decodeToWav === 'function';

export async function recordingToWav(uri: string): Promise<string> {
  if (Platform.OS !== 'android') return uri;
  if (!native) throw new Error('This Android build does not include recording conversion.');
  return native.decodeToWav(uri);
}
