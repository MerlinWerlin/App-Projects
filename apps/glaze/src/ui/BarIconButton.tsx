// Round 48 pt icon button for the v2 large-title bar (docs/DESIGN_V2.md §8), in the berry tint.
// Shared by every screen built on LargeTitleScrollView (T56: was duplicated in Settings and Themes).
import { Feather } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { sizeV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from './featherName';
import { PressableScale } from './PressableScale';

export type BarIconButtonProps = {
  icon: FeatherName;
  onPress: () => void;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  accessibilityHint?: string;
};

export function BarIconButton({ icon, onPress, accessibilityLabel, accessibilityHint }: BarIconButtonProps) {
  const { c } = useColorsV2();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      pressedScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={styles.barIcon}
    >
      <Feather name={icon} size={22} color={c.tint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  barIcon: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
});
