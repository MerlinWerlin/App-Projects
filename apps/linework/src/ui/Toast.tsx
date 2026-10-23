import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, space } from '../theme/tokens';
import { radiusV2 } from '../theme/tokensV2';
import { cameraGlass, useCameraGlass } from './v2/CameraGlass';
import { duration as motionMs, easeOut, springConfig, useReduceMotion } from '../theme/motion';
import { useT } from '../i18n';
import { useTypography } from '../theme/typography';

export type ToastProps = {
  /** Text to show; null hides it. */
  message: string | null;
  /** Bump to re-show the same message (restarts the timer). */
  showId?: number;
  /** Auto-hide delay in ms. */
  duration?: number;
  /** Called after the toast hides (timer or tap). */
  onHide?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Re-exported for existing imports; the hook now lives in src/theme/motion.ts.
export { useReduceMotion };

// Small hint pill on v2 camera glass (dark ultra-thin blur on iOS, the v1 dark fill elsewhere; T91, T94 everywhere)
// that fades in, auto-hides, and can be tapped away. Announced to screen readers.
// With Reduce Motion on it appears and disappears without the fade.
export function Toast({ message, showId = 0, duration = 3500, onHide, style }: ToastProps) {
  const ty = useTypography();
  const cam = useCameraGlass('pill');
  const { t } = useT();
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;
  const [shown, setShown] = useState<string | null>(null);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const active = useRef(false);
  const reduceMotion = useReduceMotion();
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;

  const dismiss = () => {
    if (!active.current) return;
    active.current = false;
    setShown(null);
    onHideRef.current?.();
  };

  useEffect(() => {
    if (!message) {
      active.current = false;
      setShown(null);
      return;
    }
    active.current = true;
    setShown(message);
    AccessibilityInfo.announceForAccessibility(message);
    if (reduceRef.current) {
      lift.setValue(0);
      opacity.setValue(1);
    } else {
      // Springs in: fade + a short rise from 12 pt below (premium polish rule 5).
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: motionMs.base, easing: easeOut, useNativeDriver: true }),
        Animated.spring(lift, { toValue: 0, ...springConfig }),
      ]).start();
    }
    const timer = setTimeout(() => {
      if (reduceRef.current) {
        opacity.setValue(0);
        dismiss();
      } else {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: motionMs.base, easing: easeOut, useNativeDriver: true }),
          Animated.timing(lift, { toValue: 8, duration: motionMs.base, easing: easeOut, useNativeDriver: true }),
        ]).start(({ finished }) => {
          // Interrupted (a new message arrived mid fade-out and reset the values): leave the new toast alone.
          if (!finished) return;
          lift.setValue(12);
          dismiss();
        });
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [message, showId, duration, opacity, lift]);

  if (!shown) return null;

  const text = (
    <Text
      maxFontSizeMultiplier={1.4}
      style={{ ...ty.face('bodyMedium'), fontSize: 15, lineHeight: ty.lhOf(21), color: cameraGlass.icon, textAlign: 'center' }}
    >
      {shown}
    </Text>
  );

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: lift }], alignSelf: 'center', maxWidth: 360 }, style]}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="text"
        accessibilityLabel={shown}
        accessibilityHint={t('common.toast.dismissHint')}
        // The shadow sits on the pressable; the inner view clips the blur to the v2 radius.
        style={{ borderRadius: radiusV2.md, ...elevation.raised }}
      >
        <View
          style={{
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            borderRadius: radiusV2.md,
            borderCurve: 'continuous',
            backgroundColor: cam.backgroundColor,
            borderWidth: 1,
            borderColor: cameraGlass.border,
            overflow: cam.layer ? 'hidden' : 'visible',
          }}
        >
          {cam.layer}
          {text}
        </View>
      </Pressable>
    </Animated.View>
  );
}
