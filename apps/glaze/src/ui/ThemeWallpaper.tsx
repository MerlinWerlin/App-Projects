// T130: a theme's wallpaper as a view: the bundled image for an art-pack theme (themes/<id>/
// wallpaper.png, cover-cropped), otherwise the drawn WallpaperView. Used by ThemeCard and wherever a
// theme preview should show the real art. Expo Go safe: a require()'d PNG through React Native Image.
import { memo } from 'react';
import { Image } from 'react-native';
import { isArtPackTheme } from '../core/artPack';
import type { Theme } from '../core/themes';
import { WallpaperView } from '../render/WallpaperView';
import { artPackWallpaper } from './artPackSources';

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
  const image = themeWallpaperImage(theme);
  if (image != null) {
    return (
      <Image
        source={image}
        resizeMode="cover"
        style={{ width, height, backgroundColor: theme.palette.bg }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <WallpaperView params={theme.wallpaper} width={width} height={height} maxGrain={maxGrain} />;
});
