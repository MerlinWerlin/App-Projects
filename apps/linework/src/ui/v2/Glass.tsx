// GlassBar / GlassSheet (docs/DESIGN_V2.md §4 "Materials", §6).
//
// Material: an expo-blur BlurView behind the children on iOS (oversight D72-2), reached only through the guarded
// adapter src/native/blur.ts. When the module is missing, on Android, or under Reduce Transparency the spec's solid
// 92% fallback colour (c.glassFallback, AA-checked) is drawn instead, exactly as before.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeV2 } from '../../theme/useTheme';
import { radiusV2, shadowV2, spaceV2 } from '../../theme/tokensV2';
import { duration, easeOut, springConfig, useReduceMotion } from '../../theme/motion';
import { squircle } from './shared';
import { getBlurView, useReduceTransparency } from '../../native/blur';
import { blurMaterial, glassBackground, shouldBlur } from '../../core/materials';

/** Blur layer + background colour for a glass surface. */
function useGlassMaterial(isDark: boolean, fallback: string) {
  const reduceTransparency = useReduceTransparency();
  const Blur = getBlurView();
  const blur = shouldBlur({ os: Platform.OS, hasModule: !!Blur, reduceTransparency });
  const layer =
    blur && Blur ? <Blur {...blurMaterial(isDark)} pointerEvents="none" style={StyleSheet.absoluteFill} /> : null;
  return { layer, backgroundColor: glassBackground(blur, isDark, fallback) };
}

export type GlassBarProps = {
  children?: ReactNode;
  /** Which edge gets the hairline: 'bottom' for a top bar (default), 'top' for a bottom bar, 'none'. */
  edge?: 'top' | 'bottom' | 'none';
  style?: StyleProp<ViewStyle>;
};

/** Translucent material bar for nav- and tab-like bars. */
export function GlassBar({ children, edge = 'bottom', style }: GlassBarProps) {
  const { c, isDark } = useThemeV2();
  const glass = useGlassMaterial(isDark, c.glassFallback);
  const hairline: ViewStyle =
    edge === 'bottom'
      ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }
      : edge === 'top'
        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }
        : {};
  return (
    <View style={[{ backgroundColor: glass.backgroundColor, overflow: 'hidden' }, hairline, style]}>
      {glass.layer}
      {children}
    </View>
  );
}

export type GlassSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Spoken name of the dimmed backdrop that closes the sheet (e.g. t('common.close')). */
  closeLabel: string;
  /** Spoken name of the sheet itself (its title). */
  accessibilityLabel?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Bottom sheet with a grabber that springs up over a 30% dim (§5). Reduce Motion: the sheet fades in place.
 * The backdrop is a button that closes the sheet; Android back / iOS escape gesture call onClose too.
 */
export function GlassSheet({ visible, onClose, closeLabel, accessibilityLabel, children, style }: GlassSheetProps) {
  const { c, isDark } = useThemeV2();
  const glass = useGlassMaterial(isDark, c.glassFallback);
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      v.setValue(0);
      return;
    }
    const a = reduce
      ? Animated.timing(v, { toValue: 1, duration: duration.fast, easing: easeOut, useNativeDriver: true })
      : Animated.spring(v, { toValue: 1, ...springConfig });
    a.start();
    return () => a.stop();
  }, [visible, reduce, v]);

  const translateY = reduce ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [Math.round(height * 0.5), 0] });
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            squircle,
            isDark ? { borderTopWidth: 1, borderTopColor: c.highlight } : shadowV2.e3,
            {
              backgroundColor: glass.backgroundColor,
              // Clip only when a blur layer is drawn, so the solid fallback keeps its e3 shadow.
              overflow: glass.layer ? 'hidden' : 'visible',
              borderTopStartRadius: radiusV2.xl,
              borderTopEndRadius: radiusV2.xl,
              paddingTop: spaceV2.x2,
              paddingHorizontal: spaceV2.x4,
              paddingBottom: Math.max(insets.bottom, spaceV2.x4),
              maxHeight: height * 0.9,
              opacity: reduce ? v : 1,
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          {glass.layer}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: spaceV2.x3 }}
          />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
