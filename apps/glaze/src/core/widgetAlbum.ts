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
