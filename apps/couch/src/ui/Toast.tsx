import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, easeOut, spring } from '../theme/motion';
import { elevation, fonts } from '../theme/tokens';
import { useReducedMotion } from '../theme/useReducedMotion';
import { useTheme } from '../theme/useTheme';
import { haptic } from './remote/haptics';
import { TOAST_MS, toastHaptic, toastStore, type ToastKind } from './toastQueue';

export type { ToastKind } from './toastQueue';

/** Show a short message (prototype toast(): one at a time, 2.2 s). Safe to call from anywhere; never throws. */
export function showToast(message: string, kind: ToastKind = 'info'): void {
  try {
    toastStore.show(message, kind);
  } catch {
    // Never break the caller over a toast.
  }
}

/** Distance the toast rises from (px). */
const RISE = 24;
/** Clearance above the tab bar. */
const ABOVE_TABS = 72;

/**
 * Renders the visible toast: springs up from the bottom (translateY + opacity, native driver),
 * plays the kind's haptic, holds TOAST_MS, fades out, then shows the next one.
 * Reduce Motion: fade only. Mount once near the root, inside SafeAreaProvider (app/_layout.tsx).
 * Touches pass through (pointerEvents box-none); announced politely to screen readers.
 */
export function ToastHost() {
  const t = useTheme();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const subscribe = useCallback((cb: () => void) => toastStore.subscribe(cb), []);
  const get = useCallback(() => toastStore.get(), []);
  const { visible } = useSyncExternalStore(subscribe, get, get);
  const progress = useRef(new Animated.Value(0)).current;
  const id = visible?.id ?? null;
  const kind = visible?.kind ?? 'info';

  useEffect(() => {
    if (id === null) return;
    haptic(toastHaptic(kind));
    // Android announces via accessibilityLiveRegion; iOS has no live regions, so announce once.
    if (Platform.OS === 'ios' && visible) {
      try {
        AccessibilityInfo.announceForAccessibility(visible.message);
      } catch {
        // Screen reader API unavailable: the toast still shows.
      }
    }
    progress.setValue(0);
    const enter = reduce
      ? Animated.timing(progress, { toValue: 1, duration: duration.fast, useNativeDriver: true })
      : Animated.spring(progress, { toValue: 1, ...spring, useNativeDriver: true });
    let exit: Animated.CompositeAnimation | null = null;
    enter.start();
    const timer = setTimeout(() => {
      exit = Animated.timing(progress, {
        toValue: 0,
        duration: duration.base,
        easing: Easing.bezier(...easeOut),
        useNativeDriver: true,
      });
      exit.start(({ finished }) => {
        if (finished) toastStore.done(id);
      });
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
      enter.stop();
      exit?.stop();
    };
    // Re-run per toast only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!visible) return null;
  const translateY = reduce ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] });
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer, { paddingBottom: insets.bottom + ABOVE_TABS }]}>
      <Animated.View
        key={visible.id}
        accessibilityLiveRegion="polite"
        pointerEvents="none"
        style={[
          styles.toast,
          elevation.hud,
          { backgroundColor: t.ink, shadowColor: '#000', opacity: progress, transform: [{ translateY }] },
        ]}
      >
        <Text style={[styles.text, { color: t.bg }]}>{visible.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16 },
  toast: { maxWidth: '100%', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  text: { fontFamily: fonts.textSemi, fontSize: 14 },
});
