// T152 trip covers, second pass. Pure TypeScript (Node runs it directly).
//
// What a trip's cover shows, in this order (resolveCover):
//   1. the user's own photo (phone-only store COVER_PHOTO_KEY), unless its file is known to be missing;
//   2. bundled illustrated art for the scene (src/content/coverArt.ts manifest: <scene>-<day|night>.webp under
//      assets/covers/), the theme's variant first, then the other one;
//   3. the SVG scene (src/core/coverArt.ts, drawn by src/ui/TripCover.tsx) as the fallback.
// The scene itself still comes from src/core/covers.ts (tripCover); nothing here changes the auto-pick rules.
//
// The photo store is phone-only: never on the Trip, so a .satchel file and "Plan this trip again" never carry it.
// Photo files are Satchel's own copies under <documents>/covers/; replacing or removing a cover, or deleting the trip,
// deletes the old copy (only files inside covers/ are ever deleted).
import { COVER_SCENES, type CoverId } from './covers.ts';

/** AsyncStorage key of the phone-only cover photo map (declared once, here). */
export const COVER_PHOTO_KEY = 'satchel.coverphoto.v1';
/** Folder under the documents folder that holds cover photo copies. */
export const COVER_PHOTO_FOLDER = 'covers';
/** Crop the system editor asks for: the trip hero's 16:9 (the Trips list strip crops the middle of it). */
export const COVER_PHOTO_ASPECT: [number, number] = [16, 9];
/** JPEG quality for the picked photo (small files, still sharp on a phone). */
export const COVER_PHOTO_QUALITY = 0.8;

/** tripId -> photo path (absolute on this install, or 'covers/...' relative). */
export type CoverPhotos = Record<string, string>;

const TRIP_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** True for a path inside Satchel's covers/ folder (absolute or relative), with no '..' segment. */
export function isCoverPhotoPath(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 1024 || !uri) return false;
  if (uri.split('/').includes('..')) return false;
  return uri.startsWith(`${COVER_PHOTO_FOLDER}/`) || uri.includes(`/${COVER_PHOTO_FOLDER}/`);
}

/** The stored value cleaned: only trip ids with a covers/ path survive (junk and other files are dropped). */
export function cleanCoverPhotos(raw: unknown): CoverPhotos {
  const out: CoverPhotos = {};
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { photos?: unknown }).photos : undefined;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const [id, uri] of Object.entries(src as Record<string, unknown>)) if (TRIP_ID.test(id) && isCoverPhotoPath(uri)) out[id] = uri;
  return out;
}

/** The stored shape (versioned wrapper, so a later change can migrate). */
export const coverPhotosValue = (photos: CoverPhotos): { v: 1; photos: CoverPhotos } => ({ v: 1, photos });

/** The map with this trip's photo set (a bad id or path changes nothing). */
export function withCoverPhoto(photos: CoverPhotos, tripId: string, uri: string): CoverPhotos {
  if (!TRIP_ID.test(tripId) || !isCoverPhotoPath(uri)) return photos;
  return { ...photos, [tripId]: uri };
}

/** The map without this trip's photo. */
export function withoutCoverPhoto(photos: CoverPhotos, tripId: string): CoverPhotos {
  if (!(tripId in photos)) return photos;
  const { [tripId]: _gone, ...rest } = photos;
  return rest;
}

/** File name of a new cover copy: <tripId>-<stamp>.jpg (a new name each time, so a replaced photo never shows stale). */
export function coverPhotoName(tripId: string, stamp: number): string {
  const id = tripId.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 64) || 'trip';
  return `${id}-${Math.max(0, Math.floor(stamp)).toString(36)}.jpg`;
}

// ---- raster cover art (bundled images, when they exist) ----

export type CoverVariant = 'day' | 'night';
export const COVER_VARIANTS: readonly CoverVariant[] = ['day', 'night'];
export type CoverArtKey = `${CoverId}-${CoverVariant}`;

/** Every slot the manifest can fill, in a stable order (8 scenes x day / night). */
export const COVER_ART_KEYS: readonly CoverArtKey[] = COVER_SCENES.flatMap((s) => COVER_VARIANTS.map((v) => `${s}-${v}` as CoverArtKey));

/** The bundled file name for a slot (assets/covers/<scene>-<variant>.webp). docs/research/COVER_ART_REQUEST.md uses these. */
export const coverArtFile = (key: CoverArtKey): string => `${key}.webp`;

/** Budget for all bundled cover art together (bytes). */
export const COVER_ART_BUDGET = 1_500_000;

/** A manifest: slot -> whatever the platform loads (a require() number on the phone, a string in tests). */
export type CoverArtManifest<T> = Partial<Record<CoverArtKey, T>>;

/** The theme's variant first, then the other one; null when the scene has no bundled image at all. */
export function pickCoverArt<T>(manifest: CoverArtManifest<T>, scene: CoverId, dark: boolean): { key: CoverArtKey; source: T } | null {
  const order: CoverVariant[] = dark ? ['night', 'day'] : ['day', 'night'];
  for (const v of order) {
    const key = `${scene}-${v}` as CoverArtKey;
    const source = manifest[key];
    if (source !== undefined && source !== null) return { key, source };
  }
  return null;
}

// ---- the decision ----

export type ResolvedCover<T> =
  | { kind: 'photo'; uri: string }
  | { kind: 'art'; key: CoverArtKey; source: T }
  | { kind: 'svg'; scene: CoverId; variant: CoverVariant };

/**
 * What a cover draws: the own photo (unless its file failed to load), else bundled art for the scene, else the SVG
 * scene. `photoMissing` is set once the photo's file turns out to be gone (deleted, restored phone): the cover then
 * falls back silently.
 */
export function resolveCover<T>(input: {
  scene: CoverId;
  dark: boolean;
  photo?: string | null;
  photoMissing?: boolean;
  manifest: CoverArtManifest<T>;
}): ResolvedCover<T> {
  if (input.photo && isCoverPhotoPath(input.photo) && !input.photoMissing) return { kind: 'photo', uri: input.photo };
  const art = pickCoverArt(input.manifest, input.scene, input.dark);
  if (art) return { kind: 'art', key: art.key, source: art.source };
  return { kind: 'svg', scene: input.scene, variant: input.dark ? 'night' : 'day' };
}
