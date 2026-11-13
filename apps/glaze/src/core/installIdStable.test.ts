// Owner 2026-11-13: a theme change after deleting and reinstalling Glaze ADDED a second set of icons
// (the install id lived only in AsyncStorage, wiped on delete, so the profile identifier changed).
// The id now also lives in the Keychain (kept across a reinstall); updating never changes an id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadInstallId, type InstallIdStores } from './installIdLoad.ts';
import { FIXED_INSTALL_ID, resolveInstallId, stableProfileIdentifier, stableWebClipIds } from './mobileconfig.ts';

function stores(keychain: string | null, storage: string | null) {
  const s = { keychain, storage };
  const api: InstallIdStores = {
    keychainGet: async () => s.keychain,
    keychainSet: async (v) => { s.keychain = v; return true; },
    storageGet: async () => s.storage,
    storageSet: async (v) => { s.storage = v; },
  };
  return { s, api };
}

test('a reinstall (empty AsyncStorage) gives the same identifier when the Keychain has the id', async () => {
  const before = stores('a1b2c3d4e5f60708', 'a1b2c3d4e5f60708');
  const id1 = await loadInstallId(before.api);
  const reinstall = stores(before.s.keychain, null);
  const id2 = await loadInstallId(reinstall.api);
  assert.equal(id2, id1);
  assert.equal(stableProfileIdentifier(id2), stableProfileIdentifier(id1));
  assert.equal(reinstall.s.storage, id1, 'AsyncStorage refilled');
});

test('updating Glaze keeps an existing install id (seeded into the Keychain), never a new one', async () => {
  const update = stores(null, 'feedc0ffee123456');
  assert.equal(await loadInstallId(update.api), 'feedc0ffee123456');
  assert.equal(update.s.keychain, 'feedc0ffee123456');
  // ...and a reinstall after that update keeps it.
  assert.equal(await loadInstallId(stores(update.s.keychain, null).api), 'feedc0ffee123456');
});

test('no saved id anywhere: a FIXED id, never random, so it cannot drift again', async () => {
  const a = stores(null, null);
  const b = stores(null, null);
  assert.equal(await loadInstallId(a.api), FIXED_INSTALL_ID);
  assert.equal(await loadInstallId(b.api), FIXED_INSTALL_ID);
  assert.deepEqual(a.s, { keychain: FIXED_INSTALL_ID, storage: FIXED_INSTALL_ID });
  assert.deepEqual(resolveInstallId('bad id!', 'x'), { id: FIXED_INSTALL_ID, save: ['keychain', 'storage'] });
});

test('a Keychain that cannot be read or written still gives a stable id', async () => {
  const broken: InstallIdStores = {
    keychainGet: async () => { throw new Error('no'); },
    keychainSet: async () => { throw new Error('no'); },
    storageGet: async () => 'abcdef123456',
    storageSet: async () => undefined,
  };
  assert.equal(await loadInstallId(broken), 'abcdef123456');
});

test('identifiers depend only on the install id and the app key: never the theme or the build', () => {
  const id = 'a1b2c3d4e5f60708';
  assert.equal(stableProfileIdentifier(id), 'com.jared797.glaze.icons.a1b2c3d4e5f60708');
  assert.deepEqual(stableWebClipIds(id, 'instagram'), stableWebClipIds(id, 'instagram'));
});

test('wiring: the device id uses the Keychain bridge, seeded at launch; the bridge stores it per device', () => {
  const r = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
  assert.match(r('src', 'store', 'installId.ts'), /keychainGet: \(\) => stableValueGet\(INSTALL_ID_KEYCHAIN_KEY\)/);
  assert.match(r('src', 'store', 'launchWork.ts'), /void getInstallId\(\)\.catch\(\(\) => undefined\);/);
  const swift = r('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  assert.match(swift, /AsyncFunction\("stableValueGet"\)/);
  assert.match(swift, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(r('app', 'install.tsx'), /t\('install\.method\.duplicateNote'\)/);
});
