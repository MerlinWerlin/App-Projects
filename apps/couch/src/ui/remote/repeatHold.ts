import { useEffect, useRef } from 'react';
import type { Key } from '../../core/keys';
import { haptic, type HapticKind } from './haptics';
import { HoldPress } from './repeat';

export interface HoldPressProps {
  onPressIn: () => void;
  onPressOut: () => void;
  onPress: () => void;
}

/**
 * React glue for HoldPress (T72): spread the result onto a Pressable / PressableScale (with its own
 * haptic set to 'none'). Repeating keys (repeatsOnHold) send on hold with a selection tick per step;
 * every other key sends once on release with `tapHaptic`.
 */
export function useHoldPress(key: Key, label: string, onKey: (key: Key, label: string) => void, tapHaptic: HapticKind): HoldPressProps {
  const latest = useRef({ key, label, onKey, tapHaptic });
  latest.current = { key, label, onKey, tapHaptic };
  const ref = useRef<{ key: Key; press: HoldPress } | null>(null);
  if (!ref.current || ref.current.key !== key) {
    ref.current?.press.dispose();
    ref.current = {
      key,
      press: new HoldPress(key, {
        send: () => latest.current.onKey(latest.current.key, latest.current.label),
        tapFeedback: () => haptic(latest.current.tapHaptic),
        repeatFeedback: () => haptic('selection'),
      }),
    };
  }
  useEffect(() => () => ref.current?.press.dispose(), []);
  const p = ref.current.press;
  return {
    onPressIn: () => p.pressIn(),
    onPressOut: () => p.pressOut(),
    onPress: () => p.press(),
  };
}
