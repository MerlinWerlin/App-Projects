import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Text } from './Text';
import { RemoteIcon } from './icons/RemoteIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { easeOut, spring } from '../theme/motion';
import { backdropOpacity, elevation, fonts, radius, type Palette } from '../theme/tokens';
import { useReducedMotion } from '../theme/useReducedMotion';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './motion/PressableScale';
import {
  SHEET_FALLBACK_OFFSET,
  initialSheetPhase,
  nextSheetPhase,
  sheetModalVisible,
  sheetMotion,
  sheetOffset,
  type SheetPhase,
} from './sheetPhase';
import { useT } from '../i18n/react';

export interface SheetProps {
  visible: boolean;
  /** Called by the backdrop, the close (x) button and Android back. The parent then sets visible=false. */
  onClose: () => void;
  /** Header text; when given the sheet draws the header with a close icon (accessibilityLabel "Close"). */
  title?: string;
  children: ReactNode;
  /** Label for the sheet panel (screen readers). */
  accessibilityLabel?: string;
  /** Label for the full-screen backdrop button (default "Close"). */
  closeLabel?: string;
  /** Lift the panel above the iOS keyboard (keyboard sheet). */
  avoidKeyboard?: boolean;
  /** Colours for the panel; sheets opened from the remote pass useRemoteTheme() (owner-1017). Default: app theme. */
  palette?: Palette;
  /**
   * Larger Text (T74): the content scrolls when it is taller than the screen (default true). Pass
   * false when the children bring their own ScrollView.
   */
  scroll?: boolean;
}

const exitEasing = Easing.bezier(easeOut[0], easeOut[1], easeOut[2], easeOut[3]);

/**
 * Shared bottom sheet (docs/POLISH.md): a black backdrop that fades to tokens.backdropOpacity and
 * a panel that springs up from below. Closing slides the panel down and fades the backdrop before
 * the Modal is hidden (lifecycle in sheetPhase.ts). Reduce Motion: fades only, no sliding.
 * Visibility is driven by `visible`: the backdrop / close / back call onClose, the parent flips visible.
 * Native driver only; transform and opacity only.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  accessibilityLabel,
  closeLabel,
  avoidKeyboard = false,
  palette,
  scroll = true,
}: SheetProps) {
  const app = useTheme();
  const t = palette ?? app;
  const tr = useT();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<SheetPhase>(() => initialSheetPhase(visible));
  const [layoutH, setLayoutH] = useState<number | null>(null);
  const backdrop = useRef(new Animated.Value(0)).current;
  const panelY = useRef(new Animated.Value(SHEET_FALLBACK_OFFSET)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  // True while the panel sits at its closed resting values (so entering starts from off-screen).
  const atRest = useRef(true);

  useEffect(() => {
    setPhase((p) => nextSheetPhase(p, visible ? 'show' : 'hide'));
  }, [visible]);

  useEffect(() => {
    const m = sheetMotion(reduce);
    let anim: Animated.CompositeAnimation | null = null;

    if (phase === 'closed') {
      backdrop.setValue(0);
      panelOpacity.setValue(0);
      panelY.setValue(sheetOffset(layoutH));
      atRest.current = true;
      return;
    }

    if (phase === 'entering') {
      const backdropIn = Animated.timing(backdrop, {
        toValue: backdropOpacity,
        duration: m.backdropMs,
        easing: exitEasing,
        useNativeDriver: true,
      });
      if (m.slide) {
        // Wait for the first layout so the panel starts exactly below the screen edge.
        if (layoutH == null) return;
        if (atRest.current) panelY.setValue(sheetOffset(layoutH));
        panelOpacity.setValue(1);
        anim = Animated.parallel([
          backdropIn,
          Animated.spring(panelY, { toValue: 0, ...spring, useNativeDriver: true }),
        ]);
      } else {
        panelY.setValue(0);
        anim = Animated.parallel([
          backdropIn,
          Animated.timing(panelOpacity, { toValue: 1, duration: m.panelFadeMs, useNativeDriver: true }),
        ]);
      }
      atRest.current = false;
    } else if (phase === 'exiting') {
      const backdropOut = Animated.timing(backdrop, {
        toValue: 0,
        duration: m.backdropMs,
        easing: exitEasing,
        useNativeDriver: true,
      });
      anim = Animated.parallel([
        backdropOut,
        m.slide
          ? Animated.timing(panelY, {
              toValue: sheetOffset(layoutH),
              duration: m.exitMs,
              easing: exitEasing,
              useNativeDriver: true,
            })
          : Animated.timing(panelOpacity, { toValue: 0, duration: m.exitMs, useNativeDriver: true }),
      ]);
    } else {
      return;
    }

    anim.start(({ finished }) => {
      if (finished) setPhase((p) => nextSheetPhase(p, 'done'));
    });
    return () => anim?.stop();
  }, [phase, reduce, layoutH, backdrop, panelY, panelOpacity]);

  const onLayout = (e: LayoutChangeEvent): void => {
    const h = e.nativeEvent.layout.height;
    setLayoutH((prev) => (prev != null && Math.abs(prev - h) < 1 ? prev : h));
  };

  const panel = (
    <Animated.View
      onLayout={onLayout}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.panel,
        elevation.sheet,
        {
          backgroundColor: t.body,
          shadowColor: '#000000',
          paddingBottom: Math.max(insets.bottom + 12, 28),
          opacity: panelOpacity,
          transform: [{ translateY: panelY }],
        },
      ]}
    >
      <View
        style={[styles.grabber, { backgroundColor: t.muted }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      {title != null ? (
        <View style={styles.hd}>
          <Text scaleRole="title" style={[styles.h2, { color: t.ink }]} accessibilityRole="header">
            {title}
          </Text>
          <PressableScale
            onPress={onClose}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={tr('ui.common.close')}
            hitSlop={6}
            style={[styles.x, { backgroundColor: t.key }]}
          >
            <RemoteIcon name="close" size={16} color={t.ink} />
          </PressableScale>
        </View>
      ) : null}
      {scroll ? (
        // Larger Text (T74): the panel never grows past the screen (dock padding + flexShrink);
        // when its content is taller it scrolls instead of being clipped.
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </Animated.View>
  );

  return (
    <Modal
      visible={sheetModalVisible(phase)}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Backdrop is a sibling behind the panel so taps on the panel never close the sheet. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel ?? tr('ui.common.close')}
          />
        </Animated.View>
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            style={[styles.dock, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {panel}
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.dock, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            {panel}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  panel: {
    width: '100%',
    maxWidth: 440,
    borderTopStartRadius: radius.remote,
    borderTopEndRadius: radius.remote,
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 14,
    // Larger Text (T74): shrink to the dock (screen minus the status bar) and let the body scroll.
    flexShrink: 1,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: 14 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, opacity: 0.35, marginBottom: -4 },
  hd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  h2: { fontFamily: fonts.display, fontSize: 17, flexShrink: 1 },
  x: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
