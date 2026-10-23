// Image that reveals a new source instead of popping (docs/POLISH.md L4, T32).
// 'wipe': the new image is uncovered left to right like a pencil sketch (duration.reveal, ease-out) over
// whatever was there before (the previous image, or a skeleton the parent draws underneath).
// 'fade': the new image cross-fades in over the previous one (duration.base).
// Reduce Motion turns both into a short fade (duration.fast). Native driver only (transform/opacity).
// The wipe is a clipping window that slides in from the left (overflow hidden + translateX) while the image
// inside it is counter-translated so it stays put; a thin graphite edge marks the "pencil" line.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
  type ImageResizeMode,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { duration, easeOut, fadeTo, useReduceMotion } from '../theme/motion';

export type RevealMode = 'wipe' | 'fade';

type Layer = { uri: string; key: number; p: Animated.Value; kind: RevealMode };

/** Start the reveal anyway if the image never reports onLoad within this long. */
const LOAD_WAIT_MS = 600;

export type RevealImageProps = {
  /** Image to show; a change reveals the new one over the old. Undefined clears the frame. */
  uri?: string;
  /** How the next new uri appears. Read when `uri` changes. */
  reveal: RevealMode;
  accessibilityLabel: string;
  resizeMode?: ImageResizeMode;
  /** Colour of the leading pencil edge during a wipe. */
  edgeColor?: string;
  /** Called once a reveal has finished (not when it is interrupted by a newer uri). */
  onRevealEnd?: () => void;
};

export function RevealImage({ uri, reveal, accessibilityLabel, resizeMode = 'contain', edgeColor = '#22201C', onRevealEnd }: RevealImageProps) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const keyRef = useRef(1);
  // The first uri on mount appears as is (no animation).
  const [top, setTop] = useState<Layer | null>(() => (uri ? { uri, key: 0, p: new Animated.Value(1), kind: 'fade' } : null));
  const [under, setUnder] = useState<Layer | null>(null);
  const topRef = useRef<Layer | null>(top);
  const started = useRef<number | null>(0);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const endCb = useRef(onRevealEnd);
  endCb.current = onRevealEnd;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  const start = (key: number) => {
    const layer = topRef.current;
    if (!layer || layer.key !== key || started.current === key) return;
    started.current = key;
    const ms = layer.kind === 'wipe' ? duration.reveal : duration.base;
    const a = layer.kind === 'wipe' && !reduceRef.current
      ? Animated.timing(layer.p, { toValue: 1, duration: ms, easing: easeOut, useNativeDriver: true })
      : fadeTo(layer.p, 1, reduceRef.current, ms);
    anim.current = a;
    a.start(({ finished }) => {
      if (!finished || topRef.current?.key !== key) return;
      anim.current = null;
      setUnder(null);
      endCb.current?.();
    });
  };

  useEffect(() => {
    if (uri === topRef.current?.uri) return;
    anim.current?.stop();
    anim.current = null;
    if (!uri) {
      topRef.current = null;
      setTop(null);
      setUnder(null);
      return;
    }
    const prev = topRef.current;
    const kind: RevealMode = reduceRef.current || wRef.current === 0 ? 'fade' : reveal;
    const next: Layer = { uri, key: keyRef.current++, p: new Animated.Value(0), kind };
    topRef.current = next;
    started.current = null;
    // The old image (even half revealed) stays fully drawn underneath until the new one is in. It keeps its
    // element (same key and structure) so it does not reload.
    if (prev) {
      prev.p.stopAnimation();
      prev.p.setValue(1);
    }
    setUnder(prev);
    setTop(next);
    const t = setTimeout(() => start(next.key), LOAD_WAIT_MS);
    return () => clearTimeout(t);
    // Only a new uri starts a reveal; `reveal` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  useEffect(
    () => () => {
      anim.current?.stop();
    },
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const lw = e.nativeEvent.layout.width;
    wRef.current = lw;
    setW(lw);
  };

  const image = (layer: Layer, isTop: boolean) => (
    <Image
      source={{ uri: layer.uri }}
      resizeMode={resizeMode}
      accessible={isTop}
      accessibilityRole={isTop ? 'image' : undefined}
      accessibilityLabel={isTop ? accessibilityLabel : undefined}
      onLoad={isTop ? () => start(layer.key) : undefined}
      style={{ width: '100%', height: '100%' }}
    />
  );

  // Both layers render through here with a stable key per layer, so the image demoted to "under" keeps its
  // native view (no reload, no blank frame) while the new one reveals above it.
  const renderLayer = (layer: Layer, isTop: boolean): ReactNode => {
    const hidden = isTop ? {} : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
    if (layer.kind === 'wipe' && w > 0) {
      const window = layer.p.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] });
      const counter = layer.p.interpolate({ inputRange: [0, 1], outputRange: [w, 0] });
      const edge = layer.p.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.45, 0.45, 0] });
      return (
        <Animated.View key={`L${layer.key}`} {...hidden} style={[StyleSheet.absoluteFill, { overflow: 'hidden', transform: [{ translateX: window }] }]}>
          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w, transform: [{ translateX: counter }] }} /* rtl-physical-ok */>
            {image(layer, isTop)}
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2, backgroundColor: edgeColor, opacity: edge }} /* rtl-physical-ok */
          />
        </Animated.View>
      );
    }
    return (
      <Animated.View key={`L${layer.key}`} {...hidden} style={[StyleSheet.absoluteFill, { opacity: layer.p }]}>
        {image(layer, isTop)}
      </Animated.View>
    );
  };

  return (
    // Left-to-right in every language: the image and its left-to-right wipe are never mirrored.
    <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]} onLayout={onLayout}>
      {under ? renderLayer(under, false) : null}
      {top ? renderLayer(top, true) : null}
    </View>
  );
}

/** Fades its children in once on mount (duration.base; Reduce Motion: duration.fast). */
export function FadeIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = fadeTo(v, 1, reduce);
    a.start();
    return () => a.stop();
    // first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}
