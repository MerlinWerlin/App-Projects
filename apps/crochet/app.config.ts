// Base settings live in app.json. EXPO_GO_PREVIEW=1 (the GitHub preview workflow) publishes updates with the
// Expo SDK as the runtime version, which is what Expo Go needs to open them; store builds keep appVersion.
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.PLAY_VARIANT) return require('./ops/play-variant.cjs')(base);
  if (process.env.EXPO_GO_PREVIEW === '1') {
    return { ...base, runtimeVersion: { policy: 'sdkVersion' } };
  }
  return base;
};
