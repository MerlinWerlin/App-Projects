// One selection haptic per committed choice (a chip, a segment, a stepper step), never per frame, and only when
// the Haptics setting is on. The visual change always carries the meaning on its own.
import * as Haptics from 'expo-haptics';
import { useSettings } from '../state/settings.tsx';

export function useTick() {
  const { settings } = useSettings();
  return () => {
    if (settings.haptics) Haptics.selectionAsync().catch(() => {});
  };
}
