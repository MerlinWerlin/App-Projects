import { useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Animated,
  I18nManager,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { list, navBar, space, textStyle, typeScale, type Material } from '../../theme/design';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { Text } from '../Text';
import { BlurMaterial } from './BlurMaterial';
import { collapseRanges, startOrigin } from './headerCollapse';
import { useDesign } from './useDesign';

/**
 * Screen scaffold with an iOS large title (market-1018 M3, docs/DESIGN_V2.md).
 *
 * The large title scrolls with the content; as it slides under the bar, the bar's translucent
 * material + hairline and a centred inline title fade in (maths in headerCollapse.ts, driven on the
 * UI thread by a native-driver Animated.event scroll handler). Pull down and the large title grows a
 * little from its start edge. Reduce Motion: the swap is a step and nothing grows.
 *
 * leading / trailing hold bar buttons (e.g. a plain PillButton); they sit at the start/end edges and
 * swap sides in right-to-left languages. The title is a prop (catalogue string), wraps at large
 * Dynamic Type sizes, and the bar grows with it rather than truncating. VoiceOver reads the large
 * title (role header) only; the inline copy is hidden from it.
 */
export function LargeTitleHeader({
  title,
  subtitle,
  leading,
  trailing,
  children,
  background,
  material = 'chrome',
  contentContainerStyle,
  refreshControl,
  scrollEnabled = true,
  onScrollY,
}: {
  title: string;
  /** Optional line under the large title (e.g. the connected TV's name). */
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  /** Screen background (default: grouped background of the palette). */
  background?: string;
  material?: Material;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
  /** JS-side scroll listener (the animation itself never waits for JS). */
  onScrollY?: (y: number) => void;
}) {
  const p = useDesign();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const y = useRef(new Animated.Value(0)).current;
  const [titleHeight, setTitleHeight] = useState(typeScale.largeTitle.line + navBar.largeTitleTop + navBar.largeTitleBottom);
  const [barHeight, setBarHeight] = useState<number>(navBar.height);

  const ranges = useMemo(() => collapseRanges(titleHeight, reduce), [titleHeight, reduce]);
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
        useNativeDriver: true,
        listener: onScrollY ? (e: NativeSyntheticEvent<NativeScrollEvent>) => onScrollY(e.nativeEvent.contentOffset.y) : undefined,
      }),
    [y, onScrollY],
  );
  const inlineOpacity = y.interpolate({ ...ranges.inlineOpacity, extrapolate: 'clamp' });
  const barOpacity = y.interpolate({ ...ranges.barOpacity, extrapolate: 'clamp' });
  const largeScale = y.interpolate({ ...ranges.largeScale, extrapolate: 'clamp' });
  const top = insets.top + barHeight;

  return (
    <View style={[styles.fill, { backgroundColor: background ?? p.background }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={{ top: barHeight }}
        contentContainerStyle={[{ paddingTop: top, paddingBottom: insets.bottom + space.xxxl }, contentContainerStyle]}
      >
        <Animated.View
          onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}
          style={[styles.large, { transformOrigin: startOrigin(I18nManager.isRTL), transform: [{ scale: largeScale }] }]}
        >
          <Text accessibilityRole="header" style={[textStyle('largeTitle'), { color: p.label }]} maxFontSizeMultiplier={typeScale.largeTitle.maxScale}>
            {title}
          </Text>
          {subtitle ? <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{subtitle}</Text> : null}
        </Animated.View>
        {children}
      </Animated.ScrollView>

      <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: barOpacity }]}>
          <BlurMaterial material={material} style={StyleSheet.absoluteFill} />
          <View style={[styles.hairline, { backgroundColor: p.separator }]} />
        </Animated.View>
        <View style={styles.barRow} onLayout={(e) => setBarHeight(Math.max(navBar.height, e.nativeEvent.layout.height))}>
          <View style={styles.side}>{leading}</View>
          <Animated.View
            style={[styles.inline, { opacity: inlineOpacity }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={[textStyle('navTitle'), styles.inlineText, { color: p.label }]} maxFontSizeMultiplier={typeScale.navTitle.maxScale}>
              {title}
            </Text>
          </Animated.View>
          <View style={[styles.side, styles.sideEnd]}>{trailing}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  large: {
    paddingHorizontal: list.inset + space.xs,
    paddingTop: navBar.largeTitleTop,
    paddingBottom: navBar.largeTitleBottom,
    gap: space.xxs,
  },
  bar: { position: 'absolute', top: 0, width: '100%' },
  hairline: { position: 'absolute', bottom: 0, width: '100%', height: StyleSheet.hairlineWidth },
  barRow: {
    minHeight: navBar.height,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    gap: space.sm,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideEnd: { justifyContent: 'flex-end' },
  inline: { flexShrink: 1, maxWidth: '60%', paddingVertical: space.xs },
  inlineText: { textAlign: 'center' },
});
