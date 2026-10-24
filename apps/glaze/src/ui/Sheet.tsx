// Bottom sheet, design v2 (docs/DESIGN_V2.md §8–9, T56): `thick` glass material, 32 pt continuous
// top corners, a grabber, a `title2` header and the `overlay` shadow. Built on RN Modal (Expo Go
// safe). The backdrop fades in and the sheet springs up (POLISH rule 2); with reduced motion it
// only fades. Tap the backdrop or the close button to close; the system back gesture closes too.
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../i18n';
import { durations, springConfig, useMotionReduced } from '../theme/motion';
import { continuous, radiusV2, scrimColour, shadowV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { GlassBar } from './GlassBar';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';
import { PressableScale } from './PressableScale';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /**
   * When set, the header shows a large labelled close button (≥ 48 pt, icon + word) instead of the
   * small ✕. Used by the Plus sheet so dismissing a paywall is always obvious (T63).
   */
  closeLabel?: string;
};

export function Sheet({ visible, onClose, title, children, closeLabel }: Props) {
  const { c, scheme } = useColorsV2();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const { t, script } = useT();
  const entering = reduced
    ? FadeIn.duration(durations.fast)
    : SlideInDown.springify().damping(springConfig.damping).stiffness(springConfig.stiffness);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: scrimColour(scheme) }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <Animated.View entering={entering} accessibilityViewIsModal style={[styles.shell, continuous, shadowV2('overlay', scheme)]}>
          <GlassBar
            material="thick"
            style={[
              styles.card,
              continuous,
              scheme === 'dark' ? { borderColor: c.separator, borderWidth: StyleSheet.hairlineWidth } : null,
              { paddingBottom: Math.max(insets.bottom, spaceV2.lg) },
            ]}
          >
            {/* Decorative grabber: the backdrop and close button are the accessible ways out. */}
            <View
              style={[styles.grabber, { backgroundColor: c.inkTertiary }]}
              importantForAccessibility="no"
              accessibilityElementsHidden
            />
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[textV2.title2, textStyleFor(script, textV2.title2), styles.title, { color: c.ink }]}>
                {title}
              </Text>
              {closeLabel ? (
                <PillButton label={closeLabel} icon="x" variant="tinted" size="small" onPress={onClose} haptic="select" />
              ) : (
                <PressableScale
                  onPress={onClose}
                  haptic="select"
                  pressedScale={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  style={styles.closeHit}
                >
                  <View style={[styles.closeDot, { backgroundColor: c.fill }]}>
                    <Feather name="x" size={18} color={c.inkSecondary} />
                  </View>
                </PressableScale>
              )}
            </View>
            <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
          </GlassBar>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  shell: {
    maxHeight: '88%',
    borderTopStartRadius: radiusV2.sheet,
    borderTopEndRadius: radiusV2.sheet,
  },
  card: {
    flexShrink: 1,
    borderTopStartRadius: radiusV2.sheet,
    borderTopEndRadius: radiusV2.sheet,
    overflow: 'hidden',
    paddingTop: spaceV2.sm,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, opacity: 0.5, marginBottom: spaceV2.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.touch,
    paddingStart: spaceV2.inset,
    paddingEnd: spaceV2.sm,
  },
  title: { flex: 1 },
  closeHit: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  closeDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spaceV2.inset, paddingTop: spaceV2.sm, paddingBottom: spaceV2.lg, gap: spaceV2.md },
});
