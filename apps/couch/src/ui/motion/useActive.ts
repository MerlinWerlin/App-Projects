import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isForeground } from './idle';

/**
 * True while the screen is focused and the app is in the foreground (docs/POLISH.md rule 7):
 * idle animations (glow breathing, shimmer) run only while this is true.
 * Must be used inside a screen (expo-router navigator).
 */
export function useActive(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [fg, setFg] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setFg(isForeground(s)));
    return () => sub.remove();
  }, []);
  return focused && fg;
}
