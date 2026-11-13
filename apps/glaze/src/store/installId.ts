// T194: one id per Glaze install. The icon profile's PayloadIdentifier is built from it
// (src/core/mobileconfig.ts), so a new theme's profile replaces the previous Glaze profile instead of
// adding a second one. It never leaves the device except inside the profile file the person installs.
//
// Owner 2026-11-13 ("it ADDED a second set of icons instead of replacing the old ones ... we fixed
// this ages ago"): the id lived only in AsyncStorage, which deleting Glaze wipes, so a reinstall made
// a new id, a new identifier, and iOS put the new profile next to the old one. The id is now kept in
// the iOS Keychain too (src/native/widgets.ts stableValueGet / Set), which iOS keeps across a delete
// and reinstall. resolveInstallId picks Keychain, then the AsyncStorage id (every install made before
// this keeps its own id, so updating Glaze never adds a duplicate), then a FIXED id (never random), and
// writes the chosen id to both.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadInstallId, type InstallIdStores } from '../core/installIdLoad';
import { stableValueGet, stableValueSet } from '../native/widgets';

const KEY = 'glaze.installId.v1';
/** Keychain account for the same id. */
export const INSTALL_ID_KEYCHAIN_KEY = 'glaze.installid.v1';

const deviceStores: InstallIdStores = {
  keychainGet: () => stableValueGet(INSTALL_ID_KEYCHAIN_KEY),
  keychainSet: (v) => stableValueSet(INSTALL_ID_KEYCHAIN_KEY, v),
  storageGet: () => AsyncStorage.getItem(KEY),
  storageSet: (v) => AsyncStorage.setItem(KEY, v),
};

let cached: Promise<string> | null = null;

/** The install id; the same after a delete and reinstall. */
export function getInstallId(): Promise<string> {
  if (!cached) cached = loadInstallId(deviceStores);
  return cached;
}
