// Small "Customised" dot drawn on the corner of an icon that has its own override in the
// current theme. Decorative: the icon's own accessibility label says "customised" (see
// customisedLabel), so the dot is hidden from screen readers.

import { StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { useColorsV2 } from '../theme/useTokens';

type Props = {
  /** Diameter in points (default 10). */
  size?: number;
  /** Offset from the top-right corner of the positioned parent (default -2). */
  inset?: number;
};

export function CustomisedBadge({ size = 10, inset = -2 }: Props) {
  const { c } = useColorsV2();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top: inset,
          right: inset,
          // Design v2 (T56): berry tint dot with a surface-coloured rim so it reads on any icon.
          backgroundColor: c.tint,
          borderColor: c.surface,
        },
      ]}
    />
  );
}

/** Accessibility label suffix for a customised icon. */
export function customisedLabel(label: string, customised: boolean): string {
  return customised ? t('themeUi.customised', { label }) : label;
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', borderWidth: 1.5 },
});
