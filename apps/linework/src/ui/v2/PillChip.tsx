// v2 pill chip (docs/DESIGN_V2.md §6, MARKET "Design reference 18 Oct" §2 "pill chips"): card fill + hairline,
// solid ink when active, springy press (pressScaleV2) and a selection pop when it becomes active. ≥ 48 pt tall;
// long translations wrap (never truncate). Exclusive choices use role 'tab' inside a tablist (Prepare's outline
// style and photo kind). Haptics default to none so screens that already tick on change don't tick twice.
import { useEffect, useRef } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PressableScale, type PressHaptic } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { popTo, pressScaleV2, useReduceMotion } from '../../theme/motion';
import { squircle, type FeatherName } from './shared';

export type PillChipProps = {
  label: string;
  onPress: () => void;
  active?: boolean;
  role?: 'tab' | 'button' | 'radio';
  icon?: FeatherName;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Default 'none': the screen's handler plays the selection tick. */
  haptic?: PressHaptic;
  style?: StyleProp<ViewStyle>;
};

/** Chip height: the camera touch size (48), a little bigger than the 44 pt minimum. */
const CHIP_H = sizeV2.cameraTouch;

export function PillChip({
  label,
  onPress,
  active = false,
  role = 'button',
  icon,
  accessibilityLabel,
  accessibilityHint,
  haptic = 'none',
  style,
}: PillChipProps) {
  const { c, text } = useThemeV2();
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;
    const a = popTo(pop, reduce);
    a.start();
    return () => a.stop();
  }, [active, reduce, pop]);
  const fg = active ? c.onInk : c.graphite;
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      scaleTo={pressScaleV2}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={role === 'radio' ? { selected: active, checked: active } : { selected: active }}
      style={style}
    >
      <Animated.View
        style={[
          squircle,
          {
            minHeight: CHIP_H,
            paddingHorizontal: spaceV2.x5,
            paddingVertical: spaceV2.x1,
            borderRadius: radiusV2.pill,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spaceV2.x2,
            backgroundColor: active ? c.ink : c.card,
            borderWidth: 1,
            borderColor: active ? c.ink : c.line,
            transform: [{ scale: pop }],
          },
        ]}
      >
        {icon ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Feather name={icon} size={16} color={active ? c.onInk : c.ink} />
          </View>
        ) : null}
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: fg, fontWeight: '600', textAlign: 'center', flexShrink: 1 }]}>
          {label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}
