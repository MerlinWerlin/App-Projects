// T91: shared frame for the empty-state spot illustrations. Original geometric travel art, drawn only from theme
// tokens so it follows light and dark mode. Always decorative: hidden from VoiceOver / TalkBack (the empty state's
// title and body say what matters).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';

/** viewBox is 120 x 96; `size` is the drawn width in points. */
export function SpotFrame({ size = 120, children }: { size?: number; children: ReactNode }) {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={size} height={(size * 96) / 120} viewBox="0 0 120 96">
        {children}
      </Svg>
    </View>
  );
}
