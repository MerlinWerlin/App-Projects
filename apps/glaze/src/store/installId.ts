// T194: one random id per Glaze install, created once and kept in AsyncStorage. The icon
// profile's PayloadIdentifier is built from it (src/core/mobileconfig.ts), so a new theme's
// profile replaces the previous Glaze profile instead of adding a second one. It never leaves the
// device except inside the profile file the person installs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidInstallId, makeInstallId } from '../core/mobileconfig';

const KEY = 'glaze.installId.v1';

let cached: Promise<string> | null = null;

/** The install id; created and saved on first use. Storage failing gives a per-session id. */
export function getInstallId(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      try {
        const stored = await AsyncStorage.getItem(KEY);
        if (isValidInstallId(stored)) return stored;
      } catch {
        // Fall through to a new id.
      }
      const id = makeInstallId();
      try {
        await AsyncStorage.setItem(KEY, id);
      } catch {
        // Storage unavailable: this session still uses one id.
      }
      return id;
    })();
  }
  return cached;
}
