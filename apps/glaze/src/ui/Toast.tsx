// Small confirmation toasts: <ToastProvider> once at the root, then useToast().show('Saved').
// Built on react-native Animated: fades and slides up from below on a timed ease-out (no spring)
// (POLISH rule 5); reduced motion keeps the fade only. Announced to screen readers.
// Design v2 (T83): floating pill on surfaceRaised with the `floating` layered shadow.
import { Feather } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shouldReduceMotion } from '../core/settings';
import { getSettings } from '../store/settings';
import { durations } from '../core/motion';
import { continuous, radiusV2, shadowV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';
import type { FeatherName } from './featherName';
import { textStyleFor } from './i18nLayout';

export type ToastKind = 'info' | 'success' | 'warning';

type ToastApi = { show: (text: string, kind?: ToastKind) => void; hide: () => void };

const noop: ToastApi = { show: () => {}, hide: () => {} };
const ToastContext = createContext<ToastApi>(noop);

/** Show a short toast. Outside a ToastProvider it silently does nothing. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export const TOAST_DURATION_MS = 2400;
const FADE_MS = durations.base;
/** Lift toasts above a bottom tab bar (~49–64 pt) so they never cover it. */
const BOTTOM_OFFSET = 72;

const ICONS: Record<ToastKind, FeatherName> = { info: 'info', success: 'check-circle', warning: 'alert-triangle' };

type Current = { id: number; text: string; kind: ToastKind };

export function ToastProvider({ children }: { children?: ReactNode }) {
  const { c, scheme } = useColorsV2();
  const insets = useSafeAreaInsets();
  const { script } = useT();
  const [current, setCurrent] = useState(null as Current | null);
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const systemReduce = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) systemReduce.current = v;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      systemReduce.current = v;
    });
    return () => {
      alive = false;
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const id = seq.current;
    const reduce = shouldReduceMotion(getSettings(), systemReduce.current);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: durations.fast, useNativeDriver: true }),
      Animated.timing(lift, { toValue: reduce ? 0 : 16, duration: durations.fast, useNativeDriver: true }),
    ]).start(({ finished }) => {
      // Only clear if no newer toast replaced this one mid-fade.
      if (finished && seq.current === id) setCurrent(null);
    });
  }, [lift, opacity]);

  const show = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (timer.current) clearTimeout(timer.current);
      const id = ++seq.current;
      setCurrent({ id, text: trimmed, kind });
      const reduce = shouldReduceMotion(getSettings(), systemReduce.current);
      opacity.stopAnimation();
      lift.stopAnimation();
      lift.setValue(reduce ? 0 : 24);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        reduce
          ? Animated.timing(lift, { toValue: 0, duration: 0, useNativeDriver: true })
          : Animated.timing(lift, {
              toValue: 0,
              duration: durations.base,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
      ]).start();
      // The live region covers Android; iOS needs an explicit announcement.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(trimmed);
      timer.current = setTimeout(hide, TOAST_DURATION_MS);
    },
    [hide, lift, opacity],
  );

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);
  const tone = current?.kind === 'success' ? c.ok : current?.kind === 'warning' ? c.warn : c.tint;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + BOTTOM_OFFSET }]}>
          <Animated.View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={current.text}
            pointerEvents="none"
            style={[
              styles.toast,
              continuous,
              shadowV2('floating', scheme),
              {
                backgroundColor: c.surfaceRaised,
                borderColor: scheme === 'dark' ? c.separator : 'transparent',
                opacity,
                transform: [{ translateY: lift }],
              },
            ]}
          >
            <Feather name={ICONS[current.kind]} size={18} color={tone} />
            <Text style={[textV2.subhead, textStyleFor(script, textV2.subhead), styles.text, { color: c.ink }]} numberOfLines={3}>
              {current.text}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', start: spaceV2.lg, end: spaceV2.lg, alignItems: 'center' },
  toast: {
    maxWidth: 480,
    minHeight: sizeV2.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.md,
    borderRadius: radiusV2.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flexShrink: 1, fontWeight: '600' },
});
