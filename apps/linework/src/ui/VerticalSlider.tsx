import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { crossedDetent } from '../core/motion';
import { useT } from '../i18n';
import { select } from '../native/haptics';
import { duration, fadeTo, springConfig, useReduceMotion } from '../theme/motion';
import { bubbleLayout, bubblePopKeys, sliderBubble } from '../core/sliderBubble';
import { radius, space, tabular, touch } from '../theme/tokens';
import { useTypography } from '../theme/typography';
import { cameraGlass, useCameraGlass } from './v2/CameraGlass';

export type VerticalSliderProps = {
  value: number;
  onChange: (value: number) => void;
  /** Called once when a drag starts (e.g. for a haptic tick). */
  onSlideStart?: () => void;
  /** Called once when the drag ends (finger lifted or gesture cancelled). Pairs with onSlideStart. */
  onSlideEnd?: () => void;
  /** Show a floating percent bubble next to the thumb while dragging. */
  showBubble?: boolean;
  /** Percent values that give a selection haptic when the drag crosses them (e.g. 25/50/75/100). */
  detents?: readonly number[];
  min?: number;
  max?: number;
  /** Step for screen-reader increment/decrement. */
  step?: number;
  /** Track length in points. */
  length?: number;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const THUMB = 26;
// T84: the percent bubble is magnified (taller, bigger digits) and springs in with a tail pointing at the thumb.
const BUBBLE_H = 44;
const BUBBLE_MIN_W = 76;
const TAIL = 12;
const BUBBLE_FILL = cameraGlass.bubble;

// Vertical slider for the camera screen (top = max), track on v2 camera glass (T91; T94 everywhere).
// Pure RN + gesture-handler; runs on the JS thread
// (no reanimated), so the value is plain React state owned by the parent.
export function VerticalSlider({
  value,
  onChange,
  onSlideStart,
  onSlideEnd,
  showBubble = false,
  detents,
  min = 0.05,
  max = 1,
  step = 0.05,
  length = 220,
  accessibilityLabel,
  accessibilityHint,
  style,
}: VerticalSliderProps) {
  const ty = useTypography();
  const cam = useCameraGlass('pill');
  const { percent } = useT();
  // Latest props for the memoised gesture callbacks.
  const live = useRef({ onChange, onSlideStart, onSlideEnd, min, max, length, value, detents });
  live.current = { onChange, onSlideStart, onSlideEnd, min, max, length, value, detents };
  // Last percent seen during the drag, for detent ticks.
  const lastPct = useRef(Math.round(value * 100));
  const [dragging, setDragging] = useState(false);
  const reduce = useReduceMotion();
  // Percent bubble: 0 hidden → 1 shown (opacity, plus a small scale-up unless Reduce Motion is on).
  const bubble = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!showBubble) return;
    const a = dragging
      ? reduce
        ? fadeTo(bubble, 1, true)
        : Animated.spring(bubble, { toValue: 1, ...springConfig })
      : fadeTo(bubble, 0, reduce, duration.base);
    a.start();
    return () => a.stop();
  }, [dragging, showBubble, reduce, bubble]);

  const travel = Math.max(1, length - THUMB);
  const span = max - min || 1;
  const frac = Math.min(1, Math.max(0, (value - min) / span));
  const thumbTop = (1 - frac) * travel;

  const gesture = useMemo(() => {
    const fromY = (y: number) => {
      const p = live.current;
      const tr = Math.max(1, p.length - THUMB);
      const f = 1 - Math.min(1, Math.max(0, (y - THUMB / 2) / tr));
      return p.min + f * (p.max - p.min);
    };
    const emit = (v: number) => {
      const p = live.current;
      const next = Math.round(v * 100);
      if (p.detents && p.detents.length > 0 && crossedDetent(lastPct.current, next, p.detents) !== null) select();
      lastPct.current = next;
      p.onChange(v);
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        lastPct.current = Math.round(live.current.value * 100);
        setDragging(true);
        live.current.onSlideStart?.();
        emit(fromY(e.y));
      })
      .onUpdate((e) => {
        emit(fromY(e.y));
      })
      .onFinalize(() => {
        setDragging(false);
        live.current.onSlideEnd?.();
      });
  }, []);

  const pct = Math.round(value * 100);
  // Locale-aware percent, isolated left-to-right (e.g. "50 %" in French).
  const pctText = percent(Math.min(1, Math.max(0, value)));

  const onAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName;
    if (name === 'increment') onChange(Math.min(max, value + step));
    else if (name === 'decrement') onChange(Math.max(min, value - step));
  };

  // Bubble centred on the thumb, clamped inside the slider's height; the tail keeps pointing at the thumb.
  const place = bubbleLayout(thumbTop + THUMB / 2, BUBBLE_H, length);
  const keys = bubblePopKeys(reduce);
  const bubbleStyle = {
    opacity: bubble.interpolate({ ...keys.opacity, extrapolate: 'clamp' as const }),
    transform: [{ scale: bubble.interpolate(keys.scale) }],
  };

  return (
    <View style={[{ width: touch, height: length }, style]}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityValue={{ min: Math.round(min * 100), max: Math.round(max * 100), now: pct, text: pctText }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          hitSlop={{ left: 12, right: 12, top: 8, bottom: 8 }}
          style={{
            width: touch,
            height: length,
            borderRadius: touch / 2,
            backgroundColor: cam.backgroundColor,
            borderWidth: 1,
            borderColor: cameraGlass.border,
            alignItems: 'center',
            overflow: cam.layer ? 'hidden' : 'visible',
          }}
        >
          {cam.layer}
          {/* Track and fill (fill grows from the bottom up to the thumb). */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: THUMB / 2,
              bottom: THUMB / 2,
              width: 4,
              borderRadius: 2,
              backgroundColor: cameraGlass.track,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: thumbTop + THUMB / 2,
              bottom: THUMB / 2,
              width: 4,
              borderRadius: 2,
              backgroundColor: cameraGlass.icon,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: thumbTop,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: cameraGlass.icon,
              borderWidth: 2,
              borderColor: cameraGlass.fillActive,
            }}
          />
        </View>
      </GestureDetector>
      {showBubble ? (
        // Floating percent beside the thumb (towards the screen centre) while dragging. Decorative: the slider
        // itself reports the value.
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              position: 'absolute',
              end: touch + space.sm,
              top: place.start,
              minHeight: BUBBLE_H,
              minWidth: BUBBLE_MIN_W,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              backgroundColor: BUBBLE_FILL,
              borderWidth: 1,
              borderColor: cameraGlass.border,
              alignItems: 'center',
              justifyContent: 'center',
            },
            bubbleStyle,
          ]}
        >
          {/* Tail: a small triangle on the end side (towards the slider), drawn with borders so the translucent
              fill does not overlap the bubble. */}
          <View
            style={{
              position: 'absolute',
              end: -TAIL * 0.75,
              top: place.tail - TAIL / 2,
              width: 0,
              height: 0,
              borderTopWidth: TAIL / 2,
              borderBottomWidth: TAIL / 2,
              borderStartWidth: TAIL * 0.75,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderStartColor: BUBBLE_FILL,
            }}
          />
          <Text
            maxFontSizeMultiplier={1.3}
            style={[{ ...ty.face('bodyBold'), fontSize: sliderBubble.fontSize, lineHeight: ty.lh(sliderBubble.fontSize), color: cameraGlass.icon }, tabular]}
          >
            {pctText}

          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
