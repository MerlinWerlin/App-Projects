// SheenButton: the primary "Install icons" call to action on a theme page. It used to play a
// one-off gradient "glaze drip" sheen (docs/POLISH.md G3); White Cube (DESIGN.md §8) bans gradient
// sheens, so it is now a plain filled PillButton that fills its wrapper. `sheenKey` is kept so
// callers do not change; a new key does nothing visible (the light haptic on use is the feedback).
import type { ComponentProps } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { PillButton } from './PillButton';

export type SheenButtonProps = Omit<ComponentProps<typeof PillButton>, 'style' | 'block'> & {
  /** Kept for callers; no longer plays anything. */
  sheenKey?: string | number;
  /** Applied to the outer wrapper (layout: flex, margins). */
  style?: StyleProp<ViewStyle>;
};

export function SheenButton({ sheenKey: _sheenKey, style, ...rest }: SheenButtonProps) {
  return (
    <View style={style}>
      <PillButton {...rest} block />
    </View>
  );
}
