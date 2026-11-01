// T187 (owner-1101 #5): the theme's widget art on the Widgets tab. Resolves every widget option of
// the picked theme (a downloaded remote pack: its v2 `widgets` list or the options derived from v1;
// a bundled art pack: its three hero pieces), shows them in WidgetArtMenu for the chosen size and
// puts the chosen one on the Glaze "Seamless" widget:
//   background "wallpaper" → widgets.setSeamless (the wallpaper crop under the widget + the art fitted);
//   background "theme" / "blur" → widgets.setWidgetArt (art fitted on the colour / blurred art), and
//   on a build whose bridge predates T187, the setSeamless path instead.
// T206: a picture with numbers painted in (fixedValues) says so under the menu, and its button reads
// "Live widget instead" (the live one is a separate catalogue widget, not this picture).
// Live kinds (clock, date, countdown, photo, habits) also offer "Make it live" (Widget Studio with
// that catalogue widget in this theme). Expo Go: the button explains that the TestFlight app is
// needed; nothing throws. No motion.
// T201: shown on the Widgets tab AND the theme page's Widgets step, practical pieces first, then art
// (widgetShelf), with the standard widget set after it on both screens. "Use on my widget" writes the
// App Group file and the bridge reloads every widget timeline (reloadAllTimelines).
// T208: the menu gets the wallpaper WITH the seamless crop this phone's bridge would cut for the size
// (default slot, no nudge, the same call as onUse), so wallpaper previews show only that crop.
// T221 (owner-1101e): a saved piece is also ADDED to "My widget art" (widgets.addToArtLibrary, a
// copy of the seamless-<size>.png just written), so each Glaze art widget can show a different
// piece (long-press > Edit Widget). The library list with Remove buttons is WidgetArtLibraryList.
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ART_WALLPAPER_SIZE, HERO_REFERENCE_SIZES, HERO_SIZES, isArtPackTheme } from '../core/artPack';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import { normaliseSlot, seamlessCrop, seamlessFileName, widgetSizePx } from '../core/seamlessWidget';
import { themePieceId } from '../core/widgetArtLibrary';
import type { WidgetTabSize } from '../core/tabNav';
import type { Theme } from '../core/themes';
import { fixedValues, liveStudioHref, optionName, placeArt, selectedOption, widgetOptionsFromV1, type HomeOptionSize } from '../core/widgetOptions';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { useRemoteArtTheme } from '../native/useRemoteCatalog';
import { fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { artPackHero, artPackWallpaper } from './artPackSources';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';
import { existingLocalFile, localAssetUri, seamlessDeviceHere } from './seamlessSetup';
import { WidgetArtMenu, type ArtSource, type MenuOption, type MenuWallpaper } from './WidgetArtMenu';

type Status = 'idle' | 'busy' | 'saved' | 'savedLibrary' | 'unavailable' | 'failed';

type Props = {
  theme: Theme;
  size: WidgetTabSize;
  /** Width inside the side gutters. */
  width: number;
  style?: StyleProp<ViewStyle>;
  /** T221: called after a piece was added to "My widget art" (the list refreshes). */
  onLibraryChange?: () => void;
};

const NONE: readonly MenuOption[] = Object.freeze([]) as readonly MenuOption[];

export function ThemeWidgetArt({ theme, size, width, style, onLibraryChange }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const router = useRouter();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const remoteTheme = isRemoteArtTheme(theme);
  const remote = useRemoteArtTheme(remoteTheme ? theme.id : null);
  const artId = isArtPackTheme(theme) ? theme.artPack.id : null;

  const options: readonly MenuOption[] = useMemo(() => {
    if (remoteTheme) return remote.widgetOptions.length ? remote.widgetOptions.map((o) => ({ option: o.option, source: { uri: o.uri } })) : NONE;
    if (!artId) return NONE;
    // A bundled art pack: its hero pieces, as a v1 pack would list them.
    const sources = new Map<string, number>();
    const assets = HERO_SIZES.flatMap((s) => {
      const mod = artPackHero(artId, s);
      if (mod === null) return [];
      const path = `bundled-${s}`;
      sources.set(path, mod);
      return [{ path, role: `widget-${s}`, width: HERO_REFERENCE_SIZES[s].width, height: HERO_REFERENCE_SIZES[s].height }];
    });
    return widgetOptionsFromV1(assets).flatMap((option) => {
      const mod = sources.get(option.image);
      return mod === undefined ? [] : [{ option, source: mod }];
    });
  }, [remoteTheme, remote.widgetOptions, artId]);

  const wallpaper: ArtSource | null = remote.wallpaperUri ? { uri: remote.wallpaperUri } : artId ? artPackWallpaper(artId) : null;
  const wallpaperPx = remote.wallpaperPx ?? { w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height };
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const home: HomeOptionSize | null = size === 'lock' ? null : size;
  const key = `${theme.id}:${size}`;
  const picked = home ? selectedOption(options.map((o) => o.option), home, chosen[key]) : null;
  const pickedItem = picked ? options.find((o) => o.option.id === picked.id) ?? null : null;

  const onSelect = useCallback(
    (id: string) => {
      haptic('select');
      setStatus('idle');
      setChosen((m) => (m[key] === id ? m : { ...m, [key]: id }));
    },
    [key],
  );

  if (!home) return null;
  if (remoteTheme && options.length === 0) {
    // Not downloaded yet: the art arrives with the theme's download (theme page).
    return (
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), styles.note, { color: c.inkSecondary }, style]}>
        {t('tabs.widgetsTab.art.download')}
      </Text>
    );
  }
  if (options.length === 0 || !pickedItem) return null;

  /** The wallpaper + crop under this widget, for the seamless path. */
  const seamless = async (artUri: string): Promise<boolean | null> => {
    const wallpaperUri = remote.wallpaperUri
      ? await existingLocalFile(remote.wallpaperUri)
      : artId
        ? await localAssetUri(artPackWallpaper(artId), `${artId}-wallpaper.png`)
        : null;
    if (!wallpaperUri) return false;
    const crop = seamlessCrop({ device: seamlessDeviceHere(), wallpaper: wallpaperPx, size: home, slot: normaliseSlot(home, null), nudge: { dx: 0, dy: 0 } });
    const res = await widgets.setSeamless({ wallpaperUri, cropPx: crop.cropPx, heroUri: artUri, size: home });
    return res.available ? res.ok : null;
  };

  const onUse = async () => {
    if (status === 'busy') return;
    setStatus('busy');
    haptic('select');
    let next: Status = 'failed';
    try {
      const avail = await widgets.isAvailable();
      if (!avail.available) {
        next = 'unavailable';
      } else {
        const { option, source } = pickedItem;
        const artUri =
          typeof source === 'number' ? await localAssetUri(source, `${theme.id}-${option.id}.png`) : await existingLocalFile(source.uri);
        if (artUri) {
          let ok: boolean | null;
          if (option.background === 'wallpaper') {
            ok = await seamless(artUri);
          } else {
            const px = widgetSizePx(seamlessDeviceHere(), home);
            const res = await widgets.setWidgetArt({
              artUri,
              widthPx: px.w,
              heightPx: px.h,
              background: option.background,
              colour: theme.palette.bg,
              fit: placeArt({ w: option.width, h: option.height }, px, option.fit).mode,
              size: home,
            });
            // A bridge from before T187: the seamless path still shows the art whole.
            ok = res.available ? res.ok : res.reason === 'not-built' ? await seamless(artUri) : null;
          }
          next = ok === null ? 'unavailable' : ok ? 'saved' : 'failed';
          if (ok) {
            // T221: keep this piece in "My widget art" too (a failure here never undoes the save).
            const px = widgetSizePx(seamlessDeviceHere(), home);
            const lib = await widgets.addToArtLibrary(
              {
                id: themePieceId(theme.id, option.id, home),
                name: `${pickedName} · ${home === 'small' ? t('ui.seamless.sizes.small') : home === 'medium' ? t('ui.seamless.sizes.medium') : t('ui.seamless.sizes.large')}`,
                themeName: theme.name,
                themeId: theme.id,
                source: 'theme',
                created: Date.now(),
                aspect: px.h > 0 ? px.w / px.h : 0,
                size: home,
              },
              seamlessFileName(home),
            );
            if (lib.ok) {
              next = 'savedLibrary';
              onLibraryChange?.();
            }
          }
        }
      }
    } catch {
      next = 'failed';
    }
    setStatus(next);
    haptic(next === 'saved' || next === 'savedLibrary' ? 'success' : 'warning');
    const line = next === 'savedLibrary' ? t('ui.seamless.library.added') : next === 'saved' ? t('ui.seamless.saved') : next === 'unavailable' ? t('ui.seamless.notAvailable') : t('ui.seamless.failed');
    AccessibilityInfo.announceForAccessibility(line);
  };

  const menuWallpaper: MenuWallpaper | null = wallpaper
    ? {
        source: wallpaper,
        px: wallpaperPx,
        crop: seamlessCrop({ device: seamlessDeviceHere(), wallpaper: wallpaperPx, size: home, slot: normaliseSlot(home, null), nudge: { dx: 0, dy: 0 } }).cropPx,
      }
    : null;
  const pickedNm = optionName(pickedItem.option, options.map((o) => o.option));
  const pickedName = 'text' in pickedNm ? pickedNm.text : (t as unknown as (k: string, p?: Record<string, unknown>) => string)(pickedNm.key, pickedNm.params);
  const liveHref = liveStudioHref(theme.id, pickedItem.option.kind, home);
  // T206: the picture's numbers never change, so the live widget is offered as a separate one.
  const fixed = fixedValues(pickedItem.option);
  const statusLine =
    status === 'savedLibrary' ? t('ui.seamless.library.added') : status === 'saved' ? t('ui.seamless.saved') : status === 'unavailable' ? t('ui.seamless.notAvailable') : status === 'failed' ? t('ui.seamless.failed') : null;

  const footer = (
    <View style={styles.actions}>
      <PillButton
        label={t('tabs.widgetsTab.art.use')}
        icon="check-circle"
        variant="filled"
        block
        busy={status === 'busy'}
        haptic={false}
        onPress={() => void onUse()}
        accessibilityLabel={t('tabs.widgetsTab.art.useA11y', { name: pickedName })}
      />
      {liveHref ? (
        <PillButton
          label={fixed ? t('tabs.widgetsTab.art.liveInstead') : t('tabs.widgetsTab.art.makeLive')}
          icon="activity"
          variant="tinted"
          block
          haptic="light"
          onPress={() => router.push(liveHref)}
          accessibilityHint={fixed ? t('tabs.widgetsTab.art.liveInsteadHint') : t('tabs.widgetsTab.art.liveHint')}
        />
      ) : null}
      {fixed ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
          {t('tabs.widgetsTab.art.fixedNote')}
        </Text>
      ) : null}
      {statusLine ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} accessibilityLiveRegion="polite" style={[...label('footnote'), { color: c.inkSecondary }]}>
          {statusLine}
        </Text>
      ) : null}
    </View>); // i18n-ignore (code after a JSX element)

  return (
    <WidgetArtMenu
      options={options}
      size={home}
      width={width}
      themeColour={theme.palette.bg}
      wallpaper={menuWallpaper}
      selectedId={pickedItem.option.id}
      onSelect={onSelect}
      footer={footer}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  actions: { gap: spaceV2.sm, marginTop: spaceV2.xs },
  note: { marginTop: spaceV2.md },
});
