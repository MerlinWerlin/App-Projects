import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type { PlusStorage } from './entitlement';

const KEY = 'linework.playReview.v1';
// The reusable code is shared privately with Google Play reviewers.
const DIGEST = 'c06132e978d3b0bf38985b593a24e147b6189c0373cba17620000e22598f01a9';

export function createReviewAccess(storage: PlusStorage, expected = DIGEST) {
  return {
    async isActive(): Promise<boolean> {
      try { return await storage.get(KEY) === expected; }
      catch { return false; }
    },
    async activate(code: string): Promise<boolean> {
      const normalized = code.trim().toUpperCase();
      if (!/^[0-9A-F]{32}$/.test(normalized) || bytesToHex(sha256(normalized)) !== expected) return false;
      try {
        await storage.set(KEY, expected);
        return await storage.get(KEY) === expected;
      } catch { return false; }
    },
  };
}
