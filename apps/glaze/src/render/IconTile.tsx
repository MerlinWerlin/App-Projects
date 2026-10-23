// IconTile: an icon with its label underneath, as on the Home Screen. For previews only;
// captured PNGs never include the label (iOS draws it).
// Design v2 (T84): the label is the system caption1 face, as iOS draws Home Screen labels.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { iconAccessibilityLabel } from './a11y';
import { IconCanvas, type IconDrawSpec } from './IconCanvas';

export type IconTileProps = {
  spec: IconDrawSpec & { label?: string; showLabel?: boolean };
  /** Icon edge length in points (Home Screen icons are about 60). */
  size?: number;
  /** Overrides spec.label. */
  label?: string;
  /** Overrides spec.showLabel (default true). */
  showLabel?: boolean;
  /** Cap Dynamic Type growth for tiny labels (e.g. inside HomeMock). Default: no cap. */
  maxFontSizeMultiplier?: number;
  /** Label colour; defaults to the theme ink colour (use white over a wallpaper). */
  labelColour?: string;
  backdrop?: string;
  /** Preview the icon inside iOS's rounded-square mask (see IconCanvas). */
  iosMask?: boolean;
  /** Morph the icon outline when the shape changes (default true: IconTile is preview-only). */
  morph?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconTile({
  spec,
  size = 60,
  label,
  showLabel,
  labelColour,
  backdrop,
  iosMask,
  morph = true,
  style,
  maxFontSizeMultiplier,
}: IconTileProps) {
  const { c } = useColorsV2();
  const text = label ?? spec.label ?? '';
  const show = (showLabel ?? spec.showLabel ?? true) && text.length > 0;
  return (
    <View
      style={[styles.tile, { width: size + 16 }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={iconAccessibilityLabel({ ...spec, label: text })}
    >
      <IconCanvas spec={spec} size={size} backdrop={backdrop} iosMask={iosMask} morph={morph} />
      {show ? (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={[textV2.caption1, styles.label, { color: labelColour ?? c.ink, maxWidth: size + 16 }]}
        >
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center' },
  label: { marginTop: spaceV2.xs, textAlign: 'center' },
});
