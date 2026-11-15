// Glaze 1.0.38: the device side of the bundled starter packs (src/core/starterPacks.ts explains the
// design). Reads a bundled file's bytes: in a store build the asset is a file:// inside the app; in a
// development build Metro serves it over http, so it is copied to the cache folder first (the same
// approach as src/ui/seamlessSetup.ts localAssetUri). Every byte is still SHA-256-checked by the
// downloader against the bundled manifest before the pack counts as installed.
import { Image } from 'react-native';
import { base64Decode } from '../core/bytes';
import type { StarterPackData } from '../core/starterPacks';
import { STARTER_PACKS } from '../generated/starterPacks';
import * as fs from './fs';

export const STARTERS: readonly StarterPackData[] = STARTER_PACKS as unknown as readonly StarterPackData[];

async function fileUriOf(module: number): Promise<string> {
  const uri = Image.resolveAssetSource(module)?.uri ?? '';
  if (uri.startsWith('file://') || uri.startsWith('/')) return uri;
  if (!/^https?:\/\//i.test(uri)) throw new Error('bundled starter file not found');
  const dir = fs.cacheDirectory;
  if (!dir) throw new Error('no cache folder');
  await fs.makeDirectoryAsync(`${dir}starter-packs/`, { intermediates: true }).catch(() => undefined);
  const res = await fs.downloadAsync(uri, `${dir}starter-packs/${module}.bin`);
  if (res.status < 200 || res.status >= 300) throw new Error(`bundled starter file: HTTP ${res.status}`);
  return res.uri;
}

/** The bytes of a bundled starter file. */
export async function readStarterModule(module: number): Promise<Uint8Array> {
  const uri = await fileUriOf(module);
  return base64Decode(await fs.readAsStringAsync(uri, { encoding: fs.EncodingType.Base64 }));
}
