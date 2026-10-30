// T168: where the Seamless widget card gets its pictures. A bundled art pack has require()'d
// images (Metro module numbers); a remote art pack downloaded from the pack host (T160/T169) has
// local file:// files. Either may be missing or fail to load (a pack deleted from storage, a
// half-cleared cache), so every image falls back: the wallpaper to the theme's drawn gradient and
// the hero to "no hero" (the wallpaper crop alone still makes a seamless widget).
// Pure: no React Native or Expo imports, so Node runs it (src/core/seamlessSource.test.ts).

/** One picture for the card: a bundled module, a local file, or the fallback. */
export type SeamlessArtSource = { kind: 'bundled'; module: number } | { kind: 'file'; uri: string } | { kind: 'fallback' };

/** The fallback source (shared, frozen). */
export const SEAMLESS_FALLBACK: SeamlessArtSource = Object.freeze({ kind: 'fallback' }) as SeamlessArtSource;

/** A Metro asset module id (require() of an image returns a non-negative whole number). */
export function isBundledModule(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * True for a local file the widget bridge and expo-image can open: a `file://` URI or an absolute
 * path. Remote (http, https), data:, content:, asset-library and protocol-relative (`//`) URIs are
 * not local; neither is a path that climbs with `..`.
 */
export function isLocalFileUri(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s !== v || s.length === 0) return false;
  let path: string;
  if (s.startsWith('file://')) path = s.slice('file://'.length);
  else if (s.startsWith('/') && !s.startsWith('//')) path = s;
  else return false;
  if (!path.startsWith('/') || path.length < 2 || path.endsWith('/')) return false;
  return !path.split('/').some((part) => part === '..');
}

/** Stable key of a source, for remembering which ones failed to load. */
export function seamlessSourceKey(src: SeamlessArtSource): string {
  return src.kind === 'bundled' ? `bundled:${src.module}` : src.kind === 'file' ? `file:${src.uri}` : 'fallback';
}

export type SeamlessArtInput = {
  /** The bundled image (require() number), if the app ships this pack. */
  bundled?: number | null;
  /** The downloaded file (file:// URI), if the pack is on the phone. */
  fileUri?: string | null;
  /** Keys (seamlessSourceKey) of sources that already failed to load or were not found. */
  failed?: Iterable<string> | null;
};

/** The picture to use: bundled first, then a valid local file, then the fallback (skipping failed ones). */
export function resolveSeamlessArt(input: SeamlessArtInput | null | undefined): SeamlessArtSource {
  if (!input) return SEAMLESS_FALLBACK;
  const failed = new Set(input.failed ?? []);
  if (isBundledModule(input.bundled)) {
    const src: SeamlessArtSource = { kind: 'bundled', module: input.bundled };
    if (!failed.has(seamlessSourceKey(src))) return src;
  }
  if (isLocalFileUri(input.fileUri)) {
    const src: SeamlessArtSource = { kind: 'file', uri: input.fileUri };
    if (!failed.has(seamlessSourceKey(src))) return src;
  }
  return SEAMLESS_FALLBACK;
}

export type SeamlessCardInput = {
  bundledWallpaper?: number | null;
  wallpaperUri?: string | null;
  bundledHero?: number | null;
  heroUri?: string | null;
  failed?: Iterable<string> | null;
};

export type SeamlessCardSources = {
  /** fallback = draw the theme's gradient wallpaper instead. */
  wallpaper: SeamlessArtSource;
  /** fallback = no hero art (wallpaper crop only). */
  hero: SeamlessArtSource;
  /** Show the card: the pack is bundled or downloaded (even when a file then turns out missing). */
  show: boolean;
  /** "Use for my Glaze widget" can write: the wallpaper is a real image (the bridge needs one). */
  canWrite: boolean;
};

/** Both pictures of the Seamless card plus whether to show it and whether it can write. */
export function seamlessCardSources(input: SeamlessCardInput | null | undefined): SeamlessCardSources {
  const i = input ?? {};
  const failed = i.failed ? [...i.failed] : [];
  const wallpaper = resolveSeamlessArt({ bundled: i.bundledWallpaper, fileUri: i.wallpaperUri, failed });
  const hero = resolveSeamlessArt({ bundled: i.bundledHero, fileUri: i.heroUri, failed });
  const show = isBundledModule(i.bundledWallpaper) || isLocalFileUri(i.wallpaperUri);
  return { wallpaper, hero, show, canWrite: show && wallpaper.kind !== 'fallback' };
}

/** expo-image / RN Image source for a picture, or null for the fallback. */
export function seamlessImageSource(src: SeamlessArtSource): number | { uri: string } | null {
  return src.kind === 'bundled' ? src.module : src.kind === 'file' ? { uri: src.uri } : null;
}
