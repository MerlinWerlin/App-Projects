// Touch lock UI for the trace screen: the one-time explanation sheet, and the transparent catcher that swallows
// touches while the camera and overlay stay fully visible. A persistent banner says how to exit; pressing and
// holding anywhere shows a filling ring around the finger and exits after TOUCH_LOCK_HOLD_MS. Screen readers get
// a direct "Exit touch lock" action; Android Back also exits.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { TOUCH_LOCK_HOLD_MS } from '../core/traceState';
import { space } from '../theme/tokens';
import { radiusV2 } from '../theme/tokensV2';
import { useT } from '../i18n';
import { useTypography } from '../theme/typography';
import { CameraGlassSurface, cameraGlass } from './v2/CameraGlass';
import { CameraSheet, CameraSheetBody } from './v2/CameraSheet';

// T91: intro sheet and exit banner are on v2 camera glass; the catcher itself stays fully transparent.
const RING = 104;

/** Shown before the first touch lock: what it does and how to leave it. */
export function TouchLockIntroSheet({
  onStart,
  onCancel,
  start,
  end,
  bottom,
}: {
  onStart: () => void;
  onCancel: () => void;
  /** Inset from the leading edge (left in left-to-right languages). */
  start: number;
  end: number;
  bottom: number;
}) {
  const { t } = useT();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [onCancel]);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {/* Light scrim only: the camera stays visible behind the sheet. Tap outside = Cancel. */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: cameraGlass.scrim }]}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', start, end, bottom, alignItems: 'center' }}>
        <CameraSheet
          icon="smartphone"
          title={t('trace.touchLock.title')}
          actions={[
            { label: t('trace.touchLock.start'), primary: true, onPress: onStart },
            { label: t('common.cancel'), primary: false, onPress: onCancel },
          ]}
        >
          <CameraSheetBody gap={space.sm}>{t('trace.touchLock.intro')}</CameraSheetBody>
        </CameraSheet>
      </View>
    </View>
  );
}

/**
 * Full-screen, fully transparent touch catcher. It never paints over the camera: only the banner and, while a
 * finger is down, the progress ring are drawn.
 */
export function TouchLockCatcher({ onUnlock, top, start, end }: { onUnlock: () => void; top: number; start: number; end: number }) {
  const ty = useTypography();
  const { t } = useT();
  const exitLabel = t('trace.touchLock.exit');
  const progress = useRef(new Animated.Value(0)).current;
  const [holdAt, setHoldAt] = useState<{ x: number; y: number } | null>(null);
  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;

  // Android Back leaves touch lock instead of leaving the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onUnlockRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.LongPress()
        .runOnJS(true)
        .minDuration(TOUCH_LOCK_HOLD_MS)
        // A resting hand drifts a little; allow some movement before the hold is abandoned.
        .maxDistance(40)
        .onBegin((e) => {
          setHoldAt({ x: e.x, y: e.y });
          progress.stopAnimation();
          progress.setValue(0);
          Animated.timing(progress, {
            toValue: 1,
            duration: TOUCH_LOCK_HOLD_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start();
        })
        .onStart(() => {
          onUnlockRef.current();
        })
        .onFinalize(() => {
          progress.stopAnimation();
          progress.setValue(0);
          setHoldAt(null);
        }),
    [progress],
  );

  const holding = holdAt !== null;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
        collapsable={false}
        onStartShouldSetResponder={() => true}
        accessible
        accessibilityViewIsModal
        accessibilityRole="button"
        accessibilityLabel={t('trace.touchLock.banner')}
        accessibilityHint={t('trace.touchLock.exitHint')}
        accessibilityActions={[
          { name: 'activate', label: exitLabel },
          { name: 'longpress', label: exitLabel },
          { name: 'escape', label: exitLabel },
          { name: 'magicTap', label: exitLabel },
        ]}
        onAccessibilityAction={(e) => {
          const n = e.nativeEvent.actionName;
          if (n === 'activate' || n === 'longpress' || n === 'escape' || n === 'magicTap') onUnlockRef.current();
        }}
      >
        {/* Banner: always readable, says exactly how to leave. */}
        <View pointerEvents="none" style={{ position: 'absolute', top, start, end, alignItems: 'center' }}>
          <CameraGlassSurface kind="banner" style={styles.banner}>
            <Feather name="smartphone" size={18} color={cameraGlass.icon} />
            <Text style={[styles.bannerText, ty.face('bodyMedium'), { lineHeight: ty.lhOf(21) }]} maxFontSizeMultiplier={1.4}>
              {t(holding ? 'trace.touchLock.holding' : 'trace.touchLock.banner')}
            </Text>
          </CameraGlassSurface>
        </View>

        {/* Hold progress: a ring around the finger that fills over one second. The finger position is physical,
            so the ring is placed in a left-to-right layer (never mirrored in right-to-left languages). */}
        {holdAt ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
            <View
              pointerEvents="none"
              style={[styles.ring, { left: holdAt.x - RING / 2, top: holdAt.y - RING / 2 }]} /* rtl-physical-ok */
            >
              <Animated.View
                style={[
                  styles.ringFill,
                  { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }), transform: [{ scale: progress }] },
                ]}
              />
            </View>
          </View>
        ) : null}

      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 440,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radiusV2.md,
  },
  bannerText: {
    flexShrink: 1,
    fontSize: 15,
    color: cameraGlass.icon,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 3,
    borderColor: cameraGlass.ringBorder,
    backgroundColor: cameraGlass.ringWash,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringFill: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: cameraGlass.fillActive,
  },
});
