// Category tile (DESIGN.md §5): a 76 pt square paper tile (hairline border, radius md) with an original line-art
// glyph and the label under it. Selected = 2 pt red-pencil border + bold ink label + a selection pop (motion tokens; none under Reduce Motion) + selection haptic
// (through src/native/haptics via PressableScale, so the Haptics setting is respected).
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { popTo, pressScaleV2, useReduceMotion } from '../../theme/motion';

export type CategoryBubbleProps = {
  label: string;
  /** The glyph drawn inside the bubble (an SVG sized ~40 pt). Decorative. */
  glyph: ReactNode;
  selected?: boolean;
  onPress: () => void;
  /** Kept for compatibility (pastel fills are retired). */
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

const RING = 2;

export function CategoryBubble({
  label,
  glyph,
  selected = false,
  onPress,
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

  const outer = size;
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
          borderRadius: radiusV2.md,
          borderCurve: 'continuous',
          borderWidth: selected ? RING : 1,
          borderColor: selected ? c.ink : c.line,
          backgroundColor: fill ?? c.card,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transform: [{ scale: pop }],
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: size - RING * 2,
            height: size - RING * 2,
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
