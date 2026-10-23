// YourLookPanel (T26): compact "Your look" block on the Themes tab for the applied theme (or the
// first theme when none is applied yet): a mini Home Screen combining the theme's background
// (the user's own photo if they picked one, T25), icons in the chosen shape and the user's
// overrides, and shortcuts to the background editor, icon shape + overrides (theme detail) and the
// missing-app flow. fb-1022 G2: the shape picker is no longer here; it sits behind the "Shape" row
// in theme detail, after a theme is chosen.
// Design v2 (T83): surface cardLarge squircle with the `card` shadow, small tinted pills.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { defaultBackground, usesPhoto, type ThemeBackground } from '../core/background';
import type { IconShape } from '../core/iconspec';
import { DEFAULT_TRANSFORM } from '../core/photoCrop';
import { getAnyTheme } from '../core/plusThemes';
import { customisedAppIds, specsForTheme, themeShapeFor, themeStyleWithShape } from '../core/studio';
import { previewSpecs, THEMES } from '../core/themes';
import { averageColour } from '../core/wallpaper';
import { useT } from '../i18n';
import { PhotoWallpaperView, type PhotoWallpaperData } from '../render/PhotoWallpaperView';
import { WallpaperView } from '../render/WallpaperView';
import { loadBackground } from '../store/background';
import { useStudio } from '../store/studio';
import { continuous, radiusV2, shadowV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { haptic } from './haptics';
import { HOME_ASPECT, HomeMock } from './HomeMock';
import { noMirror, textStyleFor } from './i18nLayout';

const MOCK_W = 128;
const MOCK_H = Math.round(MOCK_W * HOME_ASPECT);

export function YourLookPanel() {
  const { c, scheme } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const heading = [textV2.title3, textStyleFor(script, textV2.title3)];
  const small = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const { state } = useStudio();
  const theme = getAnyTheme(state?.themeId ?? undefined) ?? THEMES[0];
  const applied = !!state && state.themeId !== null && getAnyTheme(state.themeId)?.id === theme.id;
  // Studio data (shape choice, overrides) is keyed by the stored theme id, which may be a legacy id.
  const key = applied && state?.themeId ? state.themeId : theme.id;

  const [bg, setBg] = useState<ThemeBackground>(() => defaultBackground());
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadBackground(theme.id)
        .then((b) => {
          if (alive) setBg(b);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [theme.id]),
  );

  const shape: IconShape = state ? themeShapeFor(state, key, theme.iconStyle.shape) : theme.iconStyle.shape;
  const specs = useMemo(() => {
    // The user's own apps (with their overrides for this theme) when they have picked some.
    if (state && state.selected.length > 0) {
      return specsForTheme(state, key, themeStyleWithShape(state, key, theme.iconStyle)).slice(0, 16);
    }
    return previewSpecs(theme, 12, shape);
  }, [state, theme, shape, key]);
  const customised = useMemo(() => (state ? customisedAppIds(state, key) : undefined), [state, key]);
  const backdrop = (applied ? state?.wallpaperColour : null) ?? averageColour(theme.wallpaper);

  const photo: PhotoWallpaperData | null = usesPhoto(bg)
    ? {
        uri: bg.photoUri,
        imageW: bg.imageW,
        imageH: bg.imageH,
        transform: bg.transform ?? DEFAULT_TRANSFORM,
        overlay: bg.overlay,
        palette: theme.palette,
      }
    : null;
  const background = photo ? (
    <PhotoWallpaperView photo={photo} width={MOCK_W} height={MOCK_H} maxGrain={150} />
  ) : (
    <WallpaperView params={theme.wallpaper} width={MOCK_W} height={MOCK_H} maxGrain={150} />
  );

  const shapeName = t(`themeUi.shape.names.${shape}`);
  const modeLabel = t('themeUi.shape.glazePreview');
  const lookParams = { mode: modeLabel, name: theme.name, shape: shapeName };

  const go = (path: string) => {
    haptic('select');
    router.push(path);
  };

  return (
    <View
      style={[
        styles.card,
        continuous,
        shadowV2('card', scheme),
        { backgroundColor: c.surface },
        scheme === 'dark' ? { borderColor: c.separator, borderWidth: StyleSheet.hairlineWidth } : null,
      ]}
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[...heading, { color: c.ink }]}>
          {t('themeUi.look.title')}
        </Text>
        <Text style={[...small, { color: c.inkSecondary }]}>
          {applied
            ? t('themeUi.look.applied', { name: theme.name })
            : t('themeUi.look.notApplied', { name: theme.name })}
        </Text>
      </View>

      <View style={styles.previewRow}>
        <View
          style={[styles.phone, continuous, noMirror, { borderColor: c.separator }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            photo ? t('themeUi.look.a11yPhoto', lookParams) : t('themeUi.look.a11yWallpaper', lookParams)
          }
        >
          <HomeMock
            specs={specs}
            width={MOCK_W}
            dockCount={4}
            backgroundColour={theme.palette.bg}
            background={background}
            customisedIds={customised}
            iconBackdrop={backdrop}
          />
        </View>
        <View style={styles.side}>
          <Text style={[...small, { color: c.ink }]}>
            {photo
              ? t('themeUi.look.onPhoto', { shape: shapeName })
              : t('themeUi.look.onWallpaper', { shape: shapeName })}
          </Text>
          {applied ? null : <Text style={[...small, { color: c.inkSecondary }]}>{t('themeUi.look.keptNote')}</Text>}
        </View>
      </View>

      <View style={styles.actions}>
        <PillButton
          label={t('themeUi.look.background')}
          icon="image"
          variant="tinted"
          size="small"
          haptic={false}
          onPress={() => go(`/wallpaper?theme=${encodeURIComponent(theme.id)}`)}
          accessibilityHint={t('themeUi.look.backgroundHint', { name: theme.name })}
          style={styles.action}
        />
        <PillButton
          label={t('themeUi.override.title')}
          icon="edit-2"
          variant="tinted"
          size="small"
          haptic={false}
          onPress={() => go(`/theme/${encodeURIComponent(theme.id)}`)}
          accessibilityHint={t('themeUi.look.overrideHint', { name: theme.name })}
          style={styles.action}
        />
        <PillButton
          label={t('themeUi.look.missing')}
          icon="plus-circle"
          variant="tinted"
          size="small"
          haptic={false}
          onPress={() => go('/add-app')}
          accessibilityHint={t('themeUi.look.missingHint')}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.cardLarge, padding: spaceV2.lg, gap: spaceV2.md },
  head: { gap: spaceV2.xxs },
  previewRow: { flexDirection: 'row', gap: spaceV2.md, alignItems: 'flex-start' },
  phone: { width: MOCK_W, borderRadius: radiusV2.control, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  side: { flex: 1, gap: spaceV2.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  action: { flexGrow: 1 },
});
