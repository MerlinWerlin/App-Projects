import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { continuous, radiusV2, shadowV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Optional small preview drawn above the label. */
  preview?: ReactNode;
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  /** Read by screen readers as the group name, e.g. "Icon shape". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  /** Stack the options as full-width rows (owner fb-1017: long shape names never truncate or wrap mid-word). */
  vertical?: boolean;
  /** fb-1023: lay four options out as a 2×2 block of equal pills (two on top, two below). */
  grid?: boolean;
};

/**
 * Segmented control, design v2 (docs/DESIGN_V2.md §8, T56): a pill track on `fill` with the
 * chosen option as a raised thumb. One choice from a few options, ≥ 48 pt segments, haptic on change.
 */
export function Segmented<T extends string>({ label, options, value, onChange, style, vertical = false, grid = false }: Props<T>) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const raised = shadowV2('card', scheme);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.row, continuous, vertical && styles.column, grid && styles.grid, { backgroundColor: c.fill }, style]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? t('ui.segmentedOptionA11y', { group: label, option: o.label })}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => {
              if (selected) return;
              haptic('select');
              onChange(o.value);
            }}
            style={({ pressed }) => [
              styles.seg,
              continuous,
              vertical && styles.segVertical,
              grid && styles.segGrid,
              selected && [{ backgroundColor: c.surfaceRaised }, raised],
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {o.preview ? <View style={styles.preview}>{o.preview}</View> : null}
            {/* Wraps instead of truncating (long German/French labels); the segment grows from minHeight. */}
            <Text
              style={[
                textV2.subhead,
                styles.text,
                vertical && styles.textVertical,
                { color: selected ? c.tint : c.ink },
                selected && styles.bold,
                textStyleFor(script, textV2.subhead),
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radiusV2.pill,
    padding: spaceV2.xs,
    gap: spaceV2.xs,
  },
  seg: {
    flex: 1,
    minHeight: sizeV2.touch,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spaceV2.xs,
    paddingHorizontal: spaceV2.sm,
    gap: spaceV2.xxs,
  },
  // Stacked rows sit in a rounded track (a capsule would pinch tall content); the thumb stays a pill.
  column: { flexDirection: 'column', borderRadius: radiusV2.group },
  segVertical: {
    flex: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: spaceV2.lg,
    gap: spaceV2.sm,
  },
  // fb-1023: 2×2 block; each pill takes half the track minus the gap, labels stay on one line.
  grid: { flexWrap: 'wrap', borderRadius: radiusV2.group },
  segGrid: { flexGrow: 1, flexShrink: 0, flexBasis: '45%' },
  preview: { alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center', flexShrink: 1 },
  textVertical: { textAlign: 'auto', flex: 1 },
  bold: { fontWeight: '600' },
});
