// Category bubble (docs/DESIGN_V2.md §6): a 76 pt round pastel bubble with an original line-art glyph and the label
// under it. Selected = ink ring + a selection pop (motion tokens; none under Reduce Motion) + selection haptic
// (through src/native/haptics via PressableScale, so the Haptics setting is respected).
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, pastelAt, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { popTo, pressScaleV2, useReduceMotion } from '../../theme/motion';

export type CategoryBubbleProps = {
  label: string;
  /** The glyph drawn inside the bubble (an SVG sized ~40 pt). Decorative. */
  glyph: ReactNode;
  selected?: boolean;
  onPress: () => void;
  /** Picks the pastel fill (wraps around the six pastels). */
  index?: number;
  /** Explicit fill instead of the indexed pastel. */
  fill?: string;
  size?: number;
  /** Spoken name; default the label (pass a count-inclusive label from the catalogue if needed). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** 'tab' inside a tablist scroller, 'button' (default) otherwise. */
  accessibilityRole?: 'button' | 'tab' | 'radio';
  style?: StyleProp<ViewStyle>;
};

const RING = 3;

export function CategoryBubble({
  label,
  glyph,
  selected = false,
  onPress,
  index = 0,
  fill,
  size = sizeV2.categoryBubble,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  style,
}: CategoryBubbleProps) {
  const { c, text } = useThemeV2();
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!selected) return;
    const a = popTo(pop, reduce);
    a.start();
    return () => a.stop();
  }, [selected, reduce, pop]);

  const outer = size + RING * 4;
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={pressScaleV2}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={[{ alignItems: 'center', minWidth: outer, maxWidth: outer + spaceV2.x6, gap: spaceV2.x1 }, style]}
    >
      <Animated.View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: RING,
          borderColor: selected ? c.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop }],
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: fill ?? pastelAt(c, index),
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {glyph}
        </View>
      </Animated.View>
      <Text
        maxFontSizeMultiplier={maxFontScaleV2}
        style={[text('caption'), { color: selected ? c.ink : c.graphite, textAlign: 'center', fontWeight: selected ? '700' : '500' }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
