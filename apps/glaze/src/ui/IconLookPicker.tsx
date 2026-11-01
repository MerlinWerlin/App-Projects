// IconLookPicker (T240, owner-1101g #5): the theme's icon look as one always-visible segmented
// selector on the Icons step (never behind a menu or a collapsed row): Themed (texture, the
// default, T241) / Tinted / Glass / Dark. Each segment draws one of the person's own apps in that
// look, and the row under it shows several of their apps in the selected look, live. Looks and
// colours come from src/core/iconLook.ts; this file only lays them out (tokens from tokensV2).

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ICON_LOOKS, iconStyleForLook, type IconLook } from '../core/iconLook';
import { resolveSpecs, type IconApp, type IconShape } from '../core/iconspec';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { IconCanvas } from '../render/IconCanvas';
import { continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';

const SEGMENT_ICON = 34;
const ROW_ICON = 48;
const ROW_COUNT = 4;

export type IconLookPickerProps = {
  theme: Theme;
  value: IconLook;
  onChange: (look: IconLook) => void;
  /** The person's own apps (Icon Studio selection); the preview apps when they have none yet. */
  apps: IconApp[];
  /** Their chosen shape for this theme. */
  shape: IconShape;
  /** Wallpaper colour behind each icon (glass sits on it). */
  backdrop: string;
};

export function IconLookPicker({ theme, value, onChange, apps, shape, backdrop }: IconLookPickerProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const headline = [textV2.headline, textStyleFor(script, textV2.headline)];
  const caption = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const looks = useMemo(
    () =>
      ICON_LOOKS.map((look) => {
        const style = { ...iconStyleForLook(theme, look), shape };
        return { look, specs: resolveSpecs(apps.slice(0, ROW_COUNT), style) };
      }),
    [theme, apps, shape],
  );
  const selected = looks.find((l) => l.look === value) ?? looks[0];

  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...headline, { color: c.ink }]}>
        {t('theme.iconLook.title')}
      </Text>
      <View
        style={[styles.segments, continuous, { backgroundColor: c.fill }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('theme.iconLook.groupA11y', { name: theme.name })}
      >
        {looks.map(({ look, specs }) => {
          const on = look === value;
          const name = t(`theme.iconLook.names.${look}`);
          return (
            <Pressable
              key={look}
              onPress={() => {
                if (on) return;
                haptic('select');
                onChange(look);
              }}
              accessibilityRole="radio"
              accessibilityLabel={t('theme.iconLook.optionA11y', { look: name })}
              accessibilityHint={t(`theme.iconLook.notes.${look}`)}
              accessibilityState={{ selected: on, checked: on }}
              style={({ pressed }) => [
                styles.segment,
                continuous,
                {
                  backgroundColor: on ? c.surface : 'transparent',
                  borderColor: on ? c.tint : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {specs[0] ? <IconCanvas spec={specs[0]} size={SEGMENT_ICON} backdrop={backdrop} /> : null}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={fontScaleCap('footnote')}
                style={[...caption, { color: on ? c.ink : c.inkSecondary, fontWeight: on ? '700' : '500' }]}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View
        style={[styles.previewRow, continuous, { backgroundColor: backdrop }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('theme.iconLook.previewA11y', { look: t(`theme.iconLook.names.${selected.look}`) })}
      >
        {selected.specs.map((spec) => (
          <IconCanvas key={spec.appId} spec={spec} size={ROW_ICON} backdrop={backdrop} />
        ))}
      </View>
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...caption, { color: c.inkSecondary }]}>
        {t(`theme.iconLook.notes.${selected.look}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.sm },
  segments: {
    flexDirection: 'row',
    padding: spaceV2.xxs,
    gap: spaceV2.xxs,
    borderRadius: radiusV2.control,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: sizeV2.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spaceV2.xxs,
    paddingVertical: spaceV2.xs,
    paddingHorizontal: spaceV2.xxs,
    borderRadius: radiusV2.control,
    borderWidth: 2,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spaceV2.md,
    paddingHorizontal: spaceV2.sm,
    borderRadius: radiusV2.control,
  },
});
