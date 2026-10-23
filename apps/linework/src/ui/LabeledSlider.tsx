import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../theme/useTheme';
import { tabular, touch } from '../theme/tokens';
import { select } from '../native/haptics';
import { useTypography } from '../theme/typography';
import { duration, easeOut, fadeTo, springConfig, useReduceMotion } from '../theme/motion';
import { bubbleLayout, bubblePopKeys, sliderBubble } from '../core/sliderBubble';

export type LabeledSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Snap step; omit for continuous. Screen readers then move by a tenth of the range. */
  step?: number;
  /** Called while dragging. */
  onChange: (v: number) => void;
  /** Called on release (and after each screen-reader increment/decrement). */
  onComplete?: (v: number) => void;
  /** Shown at the trailing end of the label row and read by screen readers. */
  formatValue?: (v: number) => string;
  accessibilityHint?: string;
  disabled?: boolean;
};

const THUMB = 28;
const TRACK = 6;
/** T84 value pop-up: tail size (a rotated square under the bubble, pointing at the thumb). */
const TAIL = 10;

function snap(v: number, min: number, max: number, step?: number): number {
  let x = Math.min(max, Math.max(min, v));
  if (step && step > 0) {
    x = min + Math.round((x - min) / step) * step;
    x = Math.min(max, Math.max(min, x));
    // Trim float noise from the step multiplication.
    x = Number(x.toFixed(6));
  }
  return x;
}

// Horizontal slider: React Native views + a gesture-handler Pan on the JS thread (no reanimated).
export function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onComplete,
  formatValue,
  accessibilityHint,
  disabled = false,
}: LabeledSliderProps) {
  const ty = useTypography();
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const reduce = useReduceMotion();
  // T84: magnified value bubble above the thumb while the finger holds it (springs in on grab, out on release).
  const [grabbed, setGrabbed] = useState(false);
  const [bubbleW, setBubbleW] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = grabbed
      ? reduce
        ? fadeTo(pop, 1, true)
        : Animated.spring(pop, { toValue: 1, ...springConfig })
      : Animated.timing(pop, { toValue: 0, duration: reduce ? duration.fast : duration.base, easing: easeOut, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [grabbed, reduce, pop]);

  // Refs keep the gesture object stable while props change.
  const latest = useRef({ value, min, max, step, onChange, onComplete, width, disabled });
  latest.current = { value, min, max, step, onChange, onComplete, width, disabled };
  const dragValue = useRef(value);

  const fromX = useCallback((x: number) => {
    const s = latest.current;
    const usable = Math.max(1, s.width - THUMB);
    const t = (x - THUMB / 2) / usable;
    return snap(s.min + t * (s.max - s.min), s.min, s.max, s.step);
  }, []);

  const move = useCallback(
    (x: number) => {
      const s = latest.current;
      if (s.disabled || s.width <= 0) return;
      const v = fromX(x);
      if (v !== dragValue.current) {
        if (s.step) select();
        dragValue.current = v;
        s.onChange(v);
      }
    },
    [fromX],
  );

  const complete = useCallback(() => {
    const s = latest.current;
    if (!s.disabled) s.onComplete?.(dragValue.current);
  }, []);

  // Pan activates only on horizontal movement so a vertical scroll never nudges the value;
  // a tap jumps to the touched spot.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onStart((e) => {
        dragValue.current = latest.current.value;
        if (!latest.current.disabled) setGrabbed(true);
        move(e.x);
      })
      .onUpdate((e) => move(e.x))
      .onEnd(() => complete())
      .onFinalize(() => setGrabbed(false));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return;
        dragValue.current = latest.current.value;
        move(e.x);
        complete();
      });
    return Gesture.Race(pan, tap);
  }, [move, complete]);

  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const a11yStep = step && step > 0 ? step : (max - min) / 10;
  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const s = latest.current;
      if (s.disabled) return;
      const dir = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
      if (!dir) return;
      const v = snap(s.value + dir * a11yStep, s.min, s.max, s.step);
      if (v === s.value) return;
      s.onChange(v);
      s.onComplete?.(v);
    },
    [a11yStep],
  );

  const shown = formatValue ? formatValue(value) : String(value);
  const t = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const thumbLeft = Math.max(0, width - THUMB) * t;
  const bubble = bubbleLayout(thumbLeft + THUMB / 2, bubbleW, width);
  const keys = bubblePopKeys(reduce);

  return (
    <View style={{ opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 8 }}>
        <Text style={{ flexShrink: 1, ...ty.face('bodyMedium'), fontSize: 16, color: c.graphite }}>{label}</Text>
        <Text style={[{ ...ty.face('body'), fontSize: 15, color: c.muted }, tabular]}>{shown}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityValue={{ min, max, now: value, text: shown }}
          accessibilityState={{ disabled }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
          // The track keeps a left-to-right layout so the fill, the thumb and the finger position (physical x) agree.
          style={{ height: touch, justifyContent: 'center', direction: 'ltr' }}
        >

          <View
            style={{
              marginHorizontal: THUMB / 2,
              height: TRACK,
              borderRadius: TRACK / 2,
              backgroundColor: c.line,
              overflow: 'hidden',
            }}
          >
            <View style={{ width: `${t * 100}%`, height: '100%', backgroundColor: c.ink }} />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: thumbLeft, // rtl-physical-ok (inside a never-mirrored LTR layer)
              top: (touch - THUMB) / 2,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: c.card,
              borderWidth: 2,
              borderColor: c.ink,
            }}
          />
          {width > 0 ? (
            // T84: decorative magnified value (the slider itself reports the value to screen readers).
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onLayout={(e) => setBubbleW(e.nativeEvent.layout.width)}
              style={{
                position: 'absolute',
                left: bubble.start, // rtl-physical-ok (inside a never-mirrored LTR layer)
                bottom: (touch + THUMB) / 2 + sliderBubble.gap,
                minWidth: 64,
                minHeight: 36,
                paddingHorizontal: 14,
                paddingVertical: 2,
                borderRadius: 18,
                backgroundColor: c.ink,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                opacity: pop.interpolate({ ...keys.opacity, extrapolate: 'clamp' }),
                transform: [
                  { translateY: pop.interpolate({ ...keys.rise, extrapolate: 'clamp' }) },
                  { scale: pop.interpolate(keys.scale) },
                ],
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  bottom: -TAIL / 2 + 1,
                  left: bubble.tail - TAIL / 2, // rtl-physical-ok (LTR layer)
                  width: TAIL,
                  height: TAIL,
                  borderRadius: 2,
                  backgroundColor: c.ink,
                  transform: [{ rotate: '45deg' }],
                }}
              />
              <Text
                maxFontSizeMultiplier={1.3}
                style={[{ ...ty.face('bodyBold'), fontSize: sliderBubble.fontSize, lineHeight: ty.lh(sliderBubble.fontSize), color: c.onInk }, tabular]}
              >
                {shown}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}
