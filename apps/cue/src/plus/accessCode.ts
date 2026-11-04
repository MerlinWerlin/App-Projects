/** Reusable complimentary Android Plus access, independent of store ownership/trials. */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type { KvStore } from '../core/library';

export const ACCESS_CODE_KEY = 'cue.android.complimentary.v1';
// Only a digest ships in the public source. The reusable code is held outside Git
// and supplied in Play Console's reviewer instructions. No remote identity check.
export const ACCESS_CODE_DIGEST = 'dfd8ce20c978850e9c3e604b35169b37219fa326c757c65bc1b19c0995a62040';
export const accessCodeDigest = (code: string) => bytesToHex(sha256(code.trim().toUpperCase()));

export function createCodeAccess(kv: KvStore, digest = ACCESS_CODE_DIGEST) {
  return {
    async read(): Promise<boolean> {
      try { return await kv.getItem(ACCESS_CODE_KEY) === digest; }
      catch { return false; }
    },
    async activate(code: string): Promise<boolean> {
      if (!code.trim() || code.length > 128 || accessCodeDigest(code) !== digest) return false;
      try {
        await kv.setItem(ACCESS_CODE_KEY, digest);
        return await kv.getItem(ACCESS_CODE_KEY) === digest;
      } catch { return false; }
    },
    async remove(): Promise<boolean> {
      try {
        await kv.setItem(ACCESS_CODE_KEY, '');
        return await kv.getItem(ACCESS_CODE_KEY) === '';
      } catch { return false; }
    },
  };
}
