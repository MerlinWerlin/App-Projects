// Concentric tap ripple (T84, docs/MARKET.md "Design reference 18 Oct" §3): two rings grow from the touch point
// and fade, clipped to the control's rounded shape. RN Animated with the native driver (scale + opacity only).
// Decorative: hidden from screen readers and never takes touches. Reduce Motion → no ripple at all.
// Used through PressableScale's `ripple` prop (PillButton primary, BubbleCard with onPress). Maths: src/core/ripple.ts.
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ringDelays, ringOpacityKeys, ringScaleKeys, ripple, rippleOrigin, rippleRadius } from '../../core/ripple';
import { easeOut } from '../../theme/motion';

export type RippleHandle = {
  /** Start a ripple at a touch given in page coordinates (pageX / pageY); falls back to the centre. */
  startAtPage: (pageX?: number, pageY?: number) => void;
};

export type RippleProps = {
  color: string;
  borderRadius?: number;
};

type Origin = { x: number; y: number; r: number; id: number };

export const Ripple = forwardRef<RippleHandle, RippleProps>(function Ripple({ color, borderRadius = 0 }, ref) {
  const layer = useRef<View>(null);
  const rings = useRef(ringDelays().map(() => new Animated.Value(0))).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      startAtPage(pageX?: number, pageY?: number) {
        const node = layer.current;
        if (!node) return;
        node.measure((_x, _y, w, h, px, py) => {
          if (!(w > 0 && h > 0)) return;
          const local = rippleOrigin(
            w,
            h,
            pageX !== undefined && Number.isFinite(px) ? pageX - px : undefined,
            pageY !== undefined && Number.isFinite(py) ? pageY - py : undefined,
          );
          running.current?.stop();
          rings.forEach((v) => v.setValue(0));
          setOrigin((o) => ({ x: local.x, y: local.y, r: rippleRadius(w, h, local.x, local.y), id: (o?.id ?? 0) + 1 }));
          const a = Animated.stagger(
            ripple.stagger,
            rings.map((v) => Animated.timing(v, { toValue: 1, duration: ripple.duration, easing: easeOut, useNativeDriver: true })),
          );
          running.current = a;
          a.start(({ finished }) => {
            if (finished && running.current === a) running.current = null;
          });
        });
      },
    }),
    [rings],
  );

  const scaleKeys = ringScaleKeys();
  return (
    <View
      ref={layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      // Touch coordinates are physical, so this layer keeps a left-to-right layout (never mirrored).
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden', direction: 'ltr' }]}
    >
      {origin
        ? rings.map((v, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: origin.x - origin.r, // rtl-physical-ok (LTR layer, touch coordinates)
                top: origin.y - origin.r,
                width: origin.r * 2,
                height: origin.r * 2,
                borderRadius: origin.r,
                borderWidth: ripple.stroke,
                borderColor: color,
                opacity: v.interpolate({ ...ringOpacityKeys(i), extrapolate: 'clamp' }),
                transform: [{ scale: v.interpolate({ ...scaleKeys, extrapolate: 'clamp' }) }],
              }}
            />
          ))
        : null}
    </View>
  );
});
