// "Override an icon" on a theme's page: a compact row that opens a picker of the user's
// selected apps (drawn in this theme's style, customised ones marked), then the override sheet
// for that app IN THIS THEME. Free feature: nothing here reads Plus.
// Design v2 (T83): a surface inset-group card with a lilac icon tile row and a tinted pill.

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { customisedAppIds, findApp, specsForTheme, themeStyleWithShape } from '../core/studio';
import { getAnyTheme } from '../core/plusThemes';
import type { Theme } from '../core/themes';
import { averageColour } from '../core/wallpaper';
import { useT } from '../i18n';
import { IconCanvas } from '../render/IconCanvas';
import { iconAccessibilityLabel } from '../render/a11y';
import { useStudio } from '../store/studio';
import { continuous, fontScaleCap, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { CustomisedBadge, customisedLabel } from './CustomisedBadge';
import { IconOverrideSheet } from './IconOverrideSheet';
import { haptic } from './haptics';
import { noMirror, textStyleFor } from './i18nLayout';

export function ThemeOverrideRow({ theme }: { theme: Theme }) {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const headline = [textV2.body, textStyleFor(script, textV2.body)];
  const small = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const { state, update } = useStudio();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Same key as the theme page and Your look: a legacy stored theme id keeps its overrides.
  const key = state?.themeId && getAnyTheme(state.themeId)?.id === theme.id ? state.themeId : theme.id;
  const specs = useMemo(
    () => (state ? specsForTheme(state, key, themeStyleWithShape(state, key, theme.iconStyle)) : []),
    [state, theme, key],
  );
  const wallpaperColour = useMemo(() => averageColour(theme.wallpaper), [theme]);

  if (!state) return null;
  const customised = customisedAppIds(state, key);
  const nCustom = specs.filter((s) => customised.has(s.appId)).length;
  const editApp = editId ? findApp(state, editId) : null;
  const editSpec = editId ? specs.find((s) => s.appId === editId) ?? null : null;

  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('themeUi.override.a11y', { name: theme.name })}
        accessibilityHint={t('themeUi.override.hint')}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic('select');
          setOpen((v) => !v);
        }}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={[styles.tile, continuous, { backgroundColor: c.pastels.lilac.fill }]}>
          <Feather name="edit-3" size={17} color={c.pastels.lilac.ink} />
        </View>
        <View style={styles.flex}>
          <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...headline, { color: c.ink }]}>{t('themeUi.override.title')}</Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...small, { color: c.inkSecondary }]}>
            {nCustom > 0
              ? t('themeUi.override.count', { count: nCustom, name: theme.name })
              : t('themeUi.override.empty')}
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.inkTertiary} />
      </Pressable>

      {open ? (
        specs.length === 0 ? (
          <View style={styles.gap}>
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...small, { color: c.inkSecondary }]}>{t('themeUi.override.pickFirst')}</Text>
            <PillButton
              label={t('themeUi.override.chooseApps')}
              icon="grid"
              variant="tinted"
              haptic={false}
              onPress={() => router.navigate('/icons')}
            />
          </View>
        ) : (
          <View style={styles.grid} accessibilityLabel={t('themeUi.override.gridA11y', { name: theme.name })}>
            {specs.map((s) => (
              <Pressable
                key={s.appId}
                accessibilityRole="button"
                accessibilityLabel={t('themeUi.override.cellA11y', {
                  label: customisedLabel(iconAccessibilityLabel(s), customised.has(s.appId)),
                })}
                onPress={() => {
                  haptic('select');
                  setEditId(s.appId);
                }}
                style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={noMirror}>
                  <IconCanvas spec={s} size={40} backdrop={wallpaperColour} />
                  {customised.has(s.appId) ? <CustomisedBadge /> : null}
                </View>
                <Text maxFontSizeMultiplier={fontScaleCap('caption1')} style={[textV2.caption1, textStyleFor(script, textV2.caption1), { color: c.ink }]} numberOfLines={2}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      <IconOverrideSheet
        visible={editId !== null && editApp !== null}
        onClose={() => setEditId(null)}
        app={editApp}
        spec={editSpec}
        state={state}
        update={update}
        themeKey={key}
        themeName={theme.name}
        wallpaperColour={wallpaperColour}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.group, paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.sm, gap: spaceV2.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.rowMin },
  tile: { width: sizeV2.rowIcon, height: sizeV2.rowIcon, borderRadius: iconTileRadius(sizeV2.rowIcon), alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  gap: { gap: spaceV2.sm, paddingBottom: spaceV2.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm, paddingBottom: spaceV2.sm },
  cell: { width: 64, minHeight: sizeV2.touch, alignItems: 'center', gap: spaceV2.xxs, paddingVertical: spaceV2.xs },
});
