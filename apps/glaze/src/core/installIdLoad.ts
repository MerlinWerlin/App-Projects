// Owner 2026-11-13: reading and saving the icon profile's install id from its two copies (Keychain,
// kept across a delete and reinstall; AsyncStorage, lost on delete). Pure: the stores are passed in
// (src/store/installId.ts gives the device ones), so tests can simulate a reinstall.
import { resolveInstallId } from './mobileconfig.ts';

/** The two copies of the id; injectable for tests. */
export type InstallIdStores = {
  keychainGet(): Promise<string | null>;
  keychainSet(value: string): Promise<boolean>;
  storageGet(): Promise<string | null>;
  storageSet(value: string): Promise<void>;
};

/** Reads both copies, picks the id (resolveInstallId) and saves it where it is missing. Never throws. */
export async function loadInstallId(stores: InstallIdStores): Promise<string> {
  const keychain = await stores.keychainGet().catch(() => null);
  const stored = await stores.storageGet().catch(() => null);
  const { id, save } = resolveInstallId(keychain, stored);
  if (save.includes('keychain')) await stores.keychainSet(id).catch(() => false);
  if (save.includes('storage')) await stores.storageSet(id).catch(() => undefined);
  return id;
}

