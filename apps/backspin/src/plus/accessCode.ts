import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type { Storage } from './store.ts';

const ACCESS_KEY = 'backspin.android.complimentary.v1';
// The reusable code is kept outside Git and supplied privately to Google Play review.
const ACCESS_DIGEST = '85cd1ac1bd6d829ca8d610933e76d379b1eb1a9bbd7df5b1c7398330ad31ddf8';

export const accessCodeDigest = (code: string) => bytesToHex(sha256(code.trim().toUpperCase()));

export function createCodeAccess(storage: Storage, digest = ACCESS_DIGEST) {
  return {
    async read(): Promise<boolean> {
      try { return await storage.get(ACCESS_KEY) === digest; }
      catch { return false; }
    },
    async activate(code: string): Promise<boolean> {
      if (!code.trim() || code.length > 128 || accessCodeDigest(code) !== digest) return false;
      try {
        await storage.set(ACCESS_KEY, digest);
        return await storage.get(ACCESS_KEY) === digest;
      } catch { return false; }
    },
    async remove(): Promise<boolean> {
      try {
        await storage.set(ACCESS_KEY, '');
        const remaining = await storage.get(ACCESS_KEY);
        return remaining === '' || remaining === null;
      } catch { return false; }
    },
  };
}
