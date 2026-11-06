import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ART_WALLPAPER_SIZE, HERO_REFERENCE_SIZES, HERO_SIZES, isArtPackTheme } from '../core/artPack';
import { withLiveArt } from '../core/liveArt';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import { normaliseSlot, seamlessCrop } from '../core/seamlessWidget';
import type { Theme } from '../core/themes';
import { shelfOptions, widgetOptionsFromV1, type HomeOptionSize } from '../core/widgetOptions';
import { useT } from '../i18n';
import { remoteWidgetArtOnDevice, type RemoteWidgetArtLocal } from '../native/packs';
import { useRemoteArtTheme } from '../native/useRemoteCatalog';
import { countdownArtTargetsNow, loadCountdownArtTargets, subscribeCountdownArtTargets } from '../store/countdownArtTargets';
import { fontScaleCap, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { artPackHero, artPackWallpaper } from './artPackSources';
import { DesignedThemeWidgets } from './DesignedThemeWidgets';
import { SectionHeader } from './SectionHeader';
import { SeamlessWidgetPreview } from './SeamlessWidgetPreview';
import { seamlessDeviceHere } from './seamlessSetup';
import { WidgetArtMenu, type MenuOption, type MenuWallpaper } from './WidgetArtMenu';

type Props = { theme: Theme; size: HomeOptionSize; width: number; style?: StyleProp<ViewStyle> };

/** The previews share the art sources and default Seamless crop used by theme setup. */
export function ThemeWidgetArt({ theme, size, width, style }: Props) {
  const { t } = useT();
  const { c } = useColorsV2();
  const targets = useSyncExternalStore(subscribeCountdownArtTargets, countdownArtTargetsNow, countdownArtTargetsNow);
  useEffect(() => { void loadCountdownArtTargets(); }, []);
  const remoteTheme = isRemoteArtTheme(theme);
  const remote = useRemoteArtTheme(remoteTheme ? theme.id : null);
  const [loaded, setLoaded] = useState<{ id: string; art: RemoteWidgetArtLocal | null } | null>(null);
  const latest = remote.theme ?? theme;
  useFocusEffect(useCallback(() => {
    if (!remoteTheme) return;
    const controller = new AbortController();
    remoteWidgetArtOnDevice(latest, controller.signal).then(
      art => { if (!controller.signal.aborted) setLoaded({ id: theme.id, art }); },
      () => { if (!controller.signal.aborted) setLoaded({ id: theme.id, art: null }); },
    );
    return () => controller.abort();
  }, [latest, remoteTheme, theme.id]));
  const verified = loaded?.id === theme.id ? loaded.art : null;
  const artId = isArtPackTheme(theme) ? theme.artPack.id : null;
  const options = useMemo<readonly MenuOption[]>(() => {
    if (remoteTheme) {
      const options = verified?.options ?? remote.widgetOptions;
      const live = withLiveArt(theme.id, options.map(item => item.option), { targets });
      return options.map((item, i) => ({ option: live[i], source: { uri: item.uri } }));
    }
    if (!artId) return [];
    const sources = new Map<string, number>();
    const assets = HERO_SIZES.flatMap(size => {
      const source = artPackHero(artId, size);
      if (source === null) return [];
      const path = 'bundled-' + size;
      sources.set(path, source);
      return [{ path, role: 'widget-' + size, width: HERO_REFERENCE_SIZES[size].width, height: HERO_REFERENCE_SIZES[size].height }];
    });
    return widgetOptionsFromV1(assets).flatMap(option => {
      const source = sources.get(option.image);
      return source === undefined ? [] : [{ option, source }];
    });
  }, [remoteTheme, remote.widgetOptions, verified, artId, theme.id, targets]);

  const wallpaper = remote.wallpaperUri ? { uri: remote.wallpaperUri } : artId ? artPackWallpaper(artId) : null;
  const wallpaperPx = remote.wallpaperPx ?? { w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height };
  const slot = normaliseSlot(size, null);
  const device = seamlessDeviceHere();
  const crop = seamlessCrop({ device, wallpaper: wallpaperPx, size, slot, nudge: { dx: 0, dy: 0 } }).cropPx;
  const menuWallpaper: MenuWallpaper | null = wallpaper ? { source: wallpaper, px: wallpaperPx, crop } : null;
  const hero = options.find(item => item.option.id === 'hero-' + size);
  const firstArt = shelfOptions(options.map(item => item.option), size)[0];
  const seamless = hero ?? options.find(item => item.option.id === firstArt?.id);
  return (
    <View style={[styles.stack, style]}>
      <DesignedThemeWidgets theme={theme} size={size} width={width} />
      <WidgetArtMenu options={options} size={size} width={width} themeColour={theme.palette.bg}
        wallpaper={menuWallpaper} themeId={theme.id} artTransparent={!remoteTheme} />
      {seamless ? (
        <View style={styles.stack}>
          <SectionHeader title={t('ui.seamless.title')} flushTop />
          <SeamlessWidgetPreview wallpaper={wallpaper} wallpaperPx={wallpaperPx}
            fallbackWallpaper={(width, height) => <View style={{ width, height, backgroundColor: theme.palette.bg }} />}
            hero={seamless.source} heroPx={{ w: seamless.option.width, h: seamless.option.height }}
            size={size} slot={slot} nudge={{ dx: 0, dy: 0 }} device={device} width={Math.min(width, 220)}
            style={styles.seamless} accessibilityLabel={t('ui.seamless.title')} />
        </View>
      ) : null}
      {remoteTheme && (loaded?.id !== theme.id || !verified || verified.missing > 0) ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[textV2.footnote, { color: c.inkSecondary }]}>
          {loaded?.id !== theme.id ? t('common.loading') : t('theme.remote.offline')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spaceV2.md },
  seamless: { alignSelf: 'center' },
});
