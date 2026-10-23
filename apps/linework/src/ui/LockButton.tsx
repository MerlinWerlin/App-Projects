// Trace Lock button (docs/POLISH.md L3): a captioned glass button whose padlock morphs between open and closed.
// The 'unlock' and 'lock' Feather icons cross-fade, the ink "active" fill fades in underneath, and the icon pops
// with the shared spring. Reduce Motion: cross-fade only (duration.fast), no pop. Haptics are fired by the caller.
// T91: the circle is v2 camera glass (dark ultra-thin blur on iOS, the v1 fill elsewhere); the morph is unchanged.
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { duration, fadeTo, springTo, useReduceMotion } from '../theme/motion';
import { touch } from '../theme/tokens';
import { CAPTION_WIDTH, CaptionText } from './v2/CameraCaption';
import { PressableScale } from './PressableScale';
import { CameraGlassSurface, cameraGlass } from './v2/CameraGlass';
import { useT } from '../i18n';

export type LockButtonProps = {
  locked: boolean;
  onPress: () => void;
  /** Diameter in points; never below the 48 pt touch target. */
  size?: number;
};

export function LockButton({ locked, onPress, size = touch }: LockButtonProps) {
  const d = Math.max(touch, size);
  const { t } = useT();
  const reduce = useReduceMotion();
  // 0 = open padlock, 1 = closed.
  const morph = useRef(new Animated.Value(locked ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const fade = fadeTo(morph, locked ? 1 : 0, reduce, duration.base);
    fade.start();
    if (!reduce) {
      // Closing pops in from slightly small; opening settles back from slightly large.
      pop.setValue(locked ? 0.78 : 1.12);
      springTo(pop, 1, false).start();
    }
    return () => fade.stop();
  }, [locked, reduce, morph, pop]);

  const iconSize = Math.round(d * 0.42);
  const layer = { position: 'absolute' as const, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={t(locked ? 'trace.lock.unlock' : 'trace.lock.lock')}
      accessibilityHint={t(locked ? 'trace.lock.unlockHint' : 'trace.lock.lockHint')}
      accessibilityState={{ selected: locked }}
      hitSlop={4}
      style={{ width: Math.max(d, CAPTION_WIDTH), alignItems: 'center' }}
    >
      {({ pressed }) => (
        <>
          <CameraGlassSurface
            style={{
              width: d,
              height: d,
              borderRadius: d / 2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            }}
          >
            {/* Ink "on" fill fades in under the icon as the lock closes. */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                start: 0,
                end: 0,
                bottom: 0,
                borderRadius: d / 2,
                backgroundColor: cameraGlass.fillActive,
                opacity: morph,
              }}
            />
            <Animated.View style={{ width: iconSize, height: iconSize, transform: [{ scale: pop }] }}>
              <Animated.View style={[layer, { width: iconSize, height: iconSize, opacity: morph.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
                <Feather name="unlock" size={iconSize} color={cameraGlass.icon} />
              </Animated.View>
              <Animated.View style={[layer, { width: iconSize, height: iconSize, opacity: morph }]}>
                <Feather name="lock" size={iconSize} color={cameraGlass.icon} />
              </Animated.View>
            </Animated.View>
          </CameraGlassSurface>
          <CaptionText>{t(locked ? 'trace.lock.captionLocked' : 'trace.lock.caption')}</CaptionText>

        </>
      )}
    </PressableScale>
  );
}
