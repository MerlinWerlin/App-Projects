import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { statusBarStyle } from '../core/prefs';
import { useScheme } from '../theme/useTheme';

/**
 * Card modals on iOS (Add a TV, AirPlay guide, infrared add) leave a black strip at the top behind the
 * status bar, whatever the phone's appearance. Light status-bar text while the modal is focused, then
 * back to the app's style, so the time and battery never go dark on black.
 */
export function useModalStatusBar(): void {
  const scheme = useScheme();
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'ios') return undefined;
      setStatusBarStyle('light');
      return () => setStatusBarStyle(statusBarStyle(scheme));
    }, [scheme]),
  );
}
