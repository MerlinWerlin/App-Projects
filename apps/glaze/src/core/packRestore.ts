// Cold-start restore of downloaded theme packs (T50). The pack-motif registry
// (src/core/packMotifs.ts) lives in memory only, so after a restart a saved style that uses a
// pack-only motif would lose it the moment the studio state is parsed. The app calls this once at
// start-up, before the studio state loads: it reads every downloaded pack in the cache index and
// registers its motifs. A missing or tampered pack is skipped; this never throws.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import { isMotifId } from './artwork.ts';
import { loadPackContent, type Transport } from './packDownloader.ts';
import { registerPackMotifs } from './packMotifs.ts';
import type { PackCacheIndex, PackContent } from './themePack.ts';

export type RestoreResult = {
  /** Packs whose themes were read back from the device. */
  packs: string[];
  /** Pack-only motif ids now registered. */
  motifs: string[];
  /** Packs listed in the index but missing or unreadable on the device. */
  missing: string[];
};

export async function restorePackMotifs(
  transport: Transport,
  index: PackCacheIndex,
  load: (t: Transport, packId: string) => Promise<PackContent> = loadPackContent,
): Promise<RestoreResult> {
  const out: RestoreResult = { packs: [], motifs: [], missing: [] };
  for (const entry of index.packs) {
    try {
      const c = await load(transport, entry.id);
      if (c.themes.length === 0) {
        out.missing.push(entry.id);
        continue;
      }
      out.packs.push(entry.id);
      out.motifs.push(...registerPackMotifs(entry.id, c.motifs, isMotifId));
    } catch {
      out.missing.push(entry.id);
    }
  }
  return out;
}
