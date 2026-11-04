/** Private album filenames survive app-container relocation; native refs name resized shared JPEGs. */
export const ALBUM_LIMIT = 12;
export const isAlbumLocalName = (v: unknown): v is string => typeof v === 'string' && /^pick-[a-f0-9-]{36}\.jpg$/.test(v);
export const isAlbumSharedRef = (v: unknown): v is string => typeof v === 'string' && /^album-[a-f0-9]{40}\.jpg$/.test(v);
export function albumNames(raw: unknown, shared = false): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(shared ? isAlbumSharedRef : isAlbumLocalName))].slice(0, ALBUM_LIMIT);
}
export function albumIndex(date: Date, minutes: number, count: number): number {
  if (count < 1 || !Number.isFinite(date.getTime())) return 0;
  const interval = [15, 30, 60, 180, 360, 720, 1440].includes(minutes) ? minutes : 60;
  return ((Math.floor(date.getTime() / (interval * 60000)) % count) + count) % count;
}

/** Only copies removed from a successfully persisted draft may be deleted, across all themes. */
export function orphanedAlbumPhotos(previous: Record<string, unknown>, next: Record<string, unknown>): string[] {
  function names(store: Record<string, unknown>): Set<string> {
    const out = new Set<string>();
    for (const raw of Object.values(store)) {
      let state = raw;
      if (typeof state === 'string') { try { state = JSON.parse(state); } catch { continue; } }
      if (!state || typeof state !== 'object' || Array.isArray(state)) continue;
      const drafts = (state as {catalogueDrafts?: unknown}).catalogueDrafts;
      if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) continue;
      for (const draft of Object.values(drafts)) {
        if (draft && typeof draft === 'object') for (const name of albumNames((draft as {albumPhotos?: unknown}).albumPhotos)) out.add(name);
      }
    }
    return out;
  }
  const keep = names(next);
  return [...names(previous)].filter((name) => !keep.has(name));
}
