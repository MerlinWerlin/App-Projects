// List entrance wrapper (docs/POLISH.md rule 4): fades + rises its child once, on first mount, delayed by its
// stagger slot (30 ms steps, first 8 items). Items past the cap and Reduce Motion get no movement.
import type { ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { entranceStyle, useEntrance, useReduceMotion } from '../theme/motion';

export function StaggerIn({ index, style, children }: { index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion();
  const v = useEntrance(index);
  return <Animated.View style={[style, entranceStyle(v, reduce)]}>{children}</Animated.View>;
}
