// T130: a theme's wallpaper as a view: the bundled image for an art-pack theme (themes/<id>/
// wallpaper.png, cover-cropped), otherwise the drawn WallpaperView. Used by ThemeCard and wherever a
// theme preview should show the real art. Expo Go safe: a require()'d PNG.
// T162 (owner 30 Oct C): drawn with expo-image, which decodes the 1290 x 2796 PNG down to the
// card's size (allowDownscaling) and keeps it in the memory-disk cache, instead of a full-size
// bitmap per gallery card; no fade, recycled per theme in list rows.
import { Image as ExpoImage } from 'expo-image';
import { memo, useMemo } from 'react';
import { isArtPackTheme } from '../core/artPack';
import type { Theme } from '../core/themes';
import { WallpaperView } from '../render/WallpaperView';
import { artPackWallpaper } from './artPackSources';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import { RemoteArtImage } from './RemoteArtImage';

type Props = {
  theme: Theme;
  width: number;
  height: number;
  /** Passed to WallpaperView for drawn wallpapers. */
  maxGrain?: number;
};

/** The bundled wallpaper image of an art-pack theme, or null. */
export function themeWallpaperImage(theme: Theme | null | undefined): number | null {
  return theme && isArtPackTheme(theme) ? artPackWallpaper(theme.artPack.id) : null;
}

export const ThemeWallpaper = memo(function ThemeWallpaper({ theme, width, height, maxGrain }: Props) {
  // Hooks first: list rows recycle this view across themes, so no hook may sit after an early return.
  const bg = theme.palette.bg;
  const style = useMemo(() => ({ width, height, backgroundColor: bg }), [width, height, bg]);
  // T160: a remote art pack (catalogue on R2) shows its cached thumbnail with a ThumbHash placeholder.
  if (isRemoteArtTheme(theme)) return <RemoteArtImage theme={theme} width={width} height={height} />;
  const image = themeWallpaperImage(theme);
  if (image != null) {
    return (
      <ExpoImage
        source={image}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
        recyclingKey={theme.id}
        style={style}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <WallpaperView params={theme.wallpaper} width={width} height={height} maxGrain={maxGrain} />;
});
