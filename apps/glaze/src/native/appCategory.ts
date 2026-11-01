// T231 b: the device side of the App Store genre lookup (pure logic in src/core/appCategoryOnline.ts).
// Uses the global fetch with a timeout and an AsyncStorage cache (CATEGORY_CACHE_KEY). Everything is
// caught: offline, slow, blocked or odd responses leave the on-device keyword family in place.
// Only an unknown app's name and the store country are sent to Apple's public search; no account.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppFamily } from '../core/appCategory';
import {
  CATEGORY_CACHE_KEY,
  keywordFamilies,
  parseCategoryCache,
  refineFamilies,
  serializeCategoryCache,
  type FetchJson,
} from '../core/appCategoryOnline';
import { deviceRegionCode } from './region';

const fetchJson: FetchJson = async (url, timeoutMs) => {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        ctrl?.abort();
      } catch {
        // ignore
      }
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([fetch(url, { signal: ctrl?.signal, headers: { Accept: 'application/json' } }), timeout]);
    if (!res.ok) throw new Error(`http ${res.status}`);
    return (await Promise.race([res.json(), timeout])) as unknown;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Families for scanned names that matched nothing in the catalogue: keyword rules at once, refined
 * by App Store genres when reachable. Never throws or rejects.
 */
export async function refineAppFamilies(names: readonly string[]): Promise<Record<string, AppFamily>> {
  try {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(CATEGORY_CACHE_KEY);
    } catch {
      raw = null;
    }
    const r = await refineFamilies(names, { fetchJson, country: deviceRegionCode(), cache: parseCategoryCache(raw) });
    if (r.changed) {
      try {
        await AsyncStorage.setItem(CATEGORY_CACHE_KEY, serializeCategoryCache(r.cache));
      } catch {
        // cache is best effort
      }
    }
    return r.families;
  } catch {
    return keywordFamilies(names);
  }
}
