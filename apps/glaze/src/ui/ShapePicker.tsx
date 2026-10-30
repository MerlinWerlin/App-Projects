// ShapePicker (T26): a vertical list of icon-shape rows (fb-1017), each drawing a sample app icon in that shape with
// the theme's own artwork, plus the "How it looks on iPhone" switch. iOS draws its own
// rounded-square mask over every added icon, so with the switch on each tile (and the parent's
// previews) shows the icon inside that mask on the backdrop colour; the shape logic and copy
// live in src/core/shapes.ts.
// T35 (polish G2): the selected-shape ring (with its fill and check badge) is one indicator that
// slides between tiles with the motion spring; Reduce Motion places it without sliding. The
// previews' outline morph lives in IconCanvas (`morph`, on by default in IconTile).
// Design v2 (T83): surface rows with squircle corners, tint ring on tintSoft, system type.

import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { IconShape } from '../core/iconspec';
import { SHAPES } from '../core/shapes';
import { previewSpecs, type Theme } from '../core/themes';
import { useT } from '../i18n';
import { IconCanvas } from '../render/IconCanvas';
import { timing, useMotionReduced } from '../theme/motion';
import { circleRadius, continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { SwitchRow } from './Switch';

const TILE_ICON = 52;

type TileBox = { x: number; y: number; width: number; height: number };

export type ShapePickerProps = {
  theme: Theme;
  value: IconShape;
  onChange: (shape: IconShape) => void;
  /** "How it looks on iPhone": draw tiles (and, in the parent, previews) inside the iOS mask. */
  iosMask: boolean;
  onIosMaskChange: (on: boolean) => void;
  /** Colour behind each icon's shape (the wallpaper colour exported icons are drawn on). */
  backdrop: string;
};

export function ShapePicker({ theme, value, onChange, iosMask, onIosMaskChange, backdrop }: ShapePickerProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = [textV2.headline, textStyleFor(script, textV2.headline)];
  const note = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const samples = useMemo(
    () => SHAPES.map((shape) => ({ shape, spec: previewSpecs(theme, 1, shape)[0] })).filter((x) => x.spec !== undefined),
    [theme],
  );

  // Sliding selection indicator: positioned from each tile's measured layout.
  const reduced = useMotionReduced();
  const boxes = useRef<Partial<Record<IconShape, TileBox>>>({});
  const placed = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const ix = useSharedValue(0);
  const iy = useSharedValue(0);
  const iw = useSharedValue(0);
  const ih = useSharedValue(0);
  const shown = useSharedValue(0);

  const place = useCallback(
    (animate: boolean) => {
      const b = boxes.current[valueRef.current];
      if (!b) return;
      if (animate && placed.current && !reduced) {
        ix.value = withTiming(b.x, timing.base);
        iw.value = withTiming(b.width, timing.base);
        iy.value = withTiming(b.y, timing.base);
        ih.value = withTiming(b.height, timing.base);
      } else {
        ix.value = b.x;
        iw.value = b.width;
        iy.value = b.y;
        ih.value = b.height;
      }
      shown.value = 1;
      placed.current = true;
    },
    [reduced, ix, iy, iw, ih, shown],
  );

  useEffect(() => {
    place(true);
  }, [value, place]);

  const onTileLayout = (shape: IconShape) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    boxes.current[shape] = { x, y, width, height };
    if (shape === valueRef.current) place(false);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: iw.value,
    height: ih.value,
    transform: [{ translateX: ix.value }, { translateY: iy.value }],
  }));

  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...label, { color: c.ink }]}>
        {t('themeUi.shape.title')}
      </Text>
      {/* fb-1017 (owner, 17 Oct): a vertical full-width list so shape names never truncate or wrap
          mid-word; the sliding indicator now moves vertically between rows from measured x/y. */}
      <View
        style={styles.list}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('themeUi.shape.groupA11y', { name: theme.name })}
      >
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.indicator, continuous, { borderColor: c.tint, backgroundColor: c.tintSoft }, indicatorStyle]}
        >
          <View style={[styles.check, { backgroundColor: c.tint }]}>
            <Feather name="check" size={12} color={c.onTint} />
          </View>
        </Animated.View>
        {samples.map(({ shape, spec }) => {
          const selected = shape === value;
          return (
            <Pressable
              key={shape}
              onPress={() => {
                if (selected) return;
                haptic('select');
                onChange(shape);
              }}
              accessibilityRole="radio"
              accessibilityLabel={t('themeUi.shape.tileA11y', { shape: t(`themeUi.shape.names.${shape}`) })}
              accessibilityHint={t(`themeUi.shape.notes.${shape}`)}
              accessibilityState={{ selected, checked: selected }}
              onLayout={onTileLayout(shape)}
              style={({ pressed }) => [
                styles.tile,
                continuous,
                {
                  // The selected look (tint ring, soft fill, check) is the sliding indicator.
                  borderColor: selected ? 'transparent' : c.separator,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <IconCanvas spec={spec} size={TILE_ICON} backdrop={iosMask ? backdrop : undefined} iosMask={iosMask} />
              </View>
              <View style={styles.tileTextCol}>
                <Text
                  maxFontSizeMultiplier={fontScaleCap('headline')}
                  style={[
                    ...label,
                    { color: selected ? c.onTintSoft : c.ink, fontWeight: selected ? '700' : '600' },
                  ]}
                >
                  {t(`themeUi.shape.names.${shape}`)}
                </Text>
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...note, { color: selected ? c.onTintSoft : c.inkSecondary }]}>{t(`themeUi.shape.notes.${shape}`)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <SwitchRow
        label={t('themeUi.shape.iosMask')}
        value={iosMask}
        onChange={(on) => {
          haptic('select');
          onIosMaskChange(on);
        }}
        description={iosMask ? t('themeUi.shape.iosExplainer') : t('themeUi.shape.offDescription')}
        accessibilityLabel={t('themeUi.shape.iosMaskA11y')}
      />
    </View>
  );
}

/** Small caption for a preview: "How it looks on iPhone" or "Glaze preview". */
export function PreviewModeLabel({ iosMask }: { iosMask: boolean }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <View style={styles.modeRow}>
      <Feather name={iosMask ? 'smartphone' : 'eye'} size={14} color={c.inkSecondary} />
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.flexShrink, { color: c.inkSecondary }]}>
        {iosMask ? t('themeUi.shape.iosMask') : t('themeUi.shape.glazePreview')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.sm },
  list: { gap: spaceV2.sm, paddingVertical: spaceV2.xs },
  tileTextCol: { flex: 1, minWidth: 0, gap: spaceV2.xxs, paddingEnd: spaceV2.lg },
  flexShrink: { flexShrink: 1 },
  tile: {
    flexDirection: 'row',
    minHeight: sizeV2.rowMin,
    alignItems: 'center',
    gap: spaceV2.md,
    paddingVertical: spaceV2.sm,
    paddingHorizontal: spaceV2.md,
    borderRadius: radiusV2.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radiusV2.control,
    borderWidth: 2,
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: circleRadius(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.xs },
});
