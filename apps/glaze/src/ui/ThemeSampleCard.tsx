// A square sample of a theme (its wallpaper art behind four of its icons) for the
// "Missing an app?" flow: the user saves it to Photos and attaches it to their image-tool
// prompt so the new icon matches the theme. Drawn locally; nothing leaves the phone.

import { forwardRef, useMemo } from 'react';
import { View } from 'react-native';
import type { Theme } from '../core/themes';
import { previewSpecs } from '../core/themes';
import { IconCanvas } from '../render/IconCanvas';
import { WallpaperView } from '../render/WallpaperView';

type Props = {
  theme: Theme;
  /** Edge length in points. */
  size: number;
  accessibilityLabel?: string;
};

export const ThemeSampleCard = forwardRef<View, Props>(function ThemeSampleCard({ theme, size, accessibilityLabel }, ref) {
  const specs = useMemo(() => previewSpecs(theme, 4), [theme]);
  const icon = Math.round(size * 0.27);
  const gap = Math.round(size * 0.07);
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, overflow: 'hidden', direction: 'ltr' }}
    >
      <WallpaperView params={theme.wallpaper} width={size} height={size} maxGrain={size > 400 ? undefined : 400} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: icon * 2 + gap, flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {specs.map((s) => (
            <IconCanvas key={s.appId} spec={s} size={icon} />
          ))}
        </View>
      </View>
    </View>
  );
});
