// T130: image sources for art-pack themes (themes/<id>/*.png, bundled through the generated static
// require() map in src/ui/artPackAssets.ts, so Metro and Expo Go can load them). Everything here
// returns null for a theme that is not an art pack or a missing file; callers fall back to the drawn
// wallpaper. Never throws.
import { Image } from 'react-native';
import { artPackWidgetOptions, HERO_FILES, type HeroSize } from '../core/artPack';
import { ART_PACK_LIBRARY } from '../core/artPackLibrary';
import type { WidgetOption } from '../core/widgetOptions';
import { ART_PACK_ASSETS } from './artPackAssets';

/** A bundled image module (the number Metro's require() returns). */
export type ArtImageSource = number;

function assetsOf(id: string | null | undefined) {
  if (typeof id !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(ART_PACK_ASSETS, id) ? ART_PACK_ASSETS[id] : null;
}

/** The pack's full-size wallpaper image (1290 x 2796), for <Image source={...} />. */
export function artPackWallpaper(id: string | null | undefined): ArtImageSource | null {
  return assetsOf(id)?.wallpaper ?? null;
}

/**
 * The pack's transparent hero art for a widget size ('small' 510 x 510, 'medium' 1092 x 510,
 * 'large' 1092 x 1146 at 3x), for the seamless widgets: draw it over the matching crop of the
 * wallpaper so the art floats in the scene.
 */
export function artPackHero(id: string | null | undefined, size: HeroSize): ArtImageSource | null {
  const a = assetsOf(id);
  if (!a) return null;
  return a[size] ?? null;
}

/** The same complete bundled option list for previews and automatic widget composition. */
export function artPackArtwork(id: string | null | undefined): { option: WidgetOption; source: number }[] {
  const assets = assetsOf(id), pack = ART_PACK_LIBRARY.find((p) => p.id === id);
  if (!assets || !pack) return [];
  return artPackWidgetOptions(pack).flatMap((option) => {
    const hero = (Object.entries(HERO_FILES) as [HeroSize, string][]).find(([, file]) => file === option.image);
    const source = hero ? assets[hero[0]] : assets.artworks?.[option.image];
    return typeof source === 'number' ? [{ option, source }] : [];
  });
}

/** A URI for the wallpaper image (Save to Photos reads it like a downloaded photo). */
export function artPackWallpaperUri(id: string | null | undefined): string | null {
  return bundledArtUri(artPackWallpaper(id));
}

/** Resolve a bundled image for a consumer that needs a URI instead of a Metro source number. */
export function bundledArtUri(src: ArtImageSource | null): string | null {
  if (src == null) return null;
  try {
    return Image.resolveAssetSource(src)?.uri ?? null;
  } catch {
    return null;
  }
}
