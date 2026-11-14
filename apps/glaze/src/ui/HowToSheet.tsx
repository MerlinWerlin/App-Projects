// Owner 2026-11-15 ("the vids are so small in the app and i was confused where to see them, the
// first time a widget is select a vid should come up and watching the vid should be an easy access
// button"). Design passes (design-critique, ux-copy, accessibility-review):
// - One sheet per task, the recording as the hero at the largest size that fits; a short title and
//   one caption that spells the steps out in words (the video has no audio, so the same steps are
//   its VoiceOver label); one primary button ("Got it") and a quiet "Watch again" below it.
// - Tap the video to pause / play (a looping video needs a pause control). Reduce Motion: poster +
//   play button, nothing moves until tapped. Swipe down or "Got it" closes it.
// - useHowTo(category, { auto }) opens it on its own ONCE per category (remembered, src/store/howTo.ts)
//   and gives the always-visible "Watch how" button (play icon + label, 48 pt tall at least).
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shouldAutoOpenHowTo, type HowToCategory } from '../core/howTo';
import { useT } from '../i18n';
import { howToSeen, markHowToSeen } from '../store/howTo';
import { fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { HowToClip } from './HowToClip';
import { HOW_TO_CLIPS } from './howToClips';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';
import { useReduceMotion } from './useReduceMotion';

const ASPECT = 590 / 1278;

export function HowToSheet({ category, visible, onClose }: { category: HowToCategory; visible: boolean; onClose: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [replay, setReplay] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  // The largest phone-shaped frame that fits the space between the caption and the buttons.
  const h = Math.max(0, Math.min(box.h, box.w / ASPECT));
  const caption = t(`theme.howTo.captions.${category}`);

  return (
    <Modal visible={visible} animationType={reduce ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + spaceV2.md }]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('title1')} style={[...label('title1'), { color: c.ink }]}>
          {t(`theme.howTo.titles.${category}`)}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), { color: c.inkSecondary }]}>
          {caption}
        </Text>
        <View style={styles.stage} onLayout={onLayout}>
          {visible && h > 0 ? (
            <HowToClip clip={HOW_TO_CLIPS[category]} label={t('theme.howTo.videoLabel', { steps: caption })} replay={replay} style={{ height: h }} />
          ) : null}
        </View>
        <View style={styles.actions}>
          <PillButton label={t('theme.howTo.gotIt')} block onPress={onClose} />
          <PillButton label={t('theme.howTo.again')} icon="rotate-ccw" variant="plain" block onPress={() => setReplay((n) => n + 1)} />
        </View>
      </View>
    </Modal>
  );
}

/** The always-visible way in: a play icon and "Watch how". */
export function WatchHowButton({ onPress, style, compact }: { onPress: () => void; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const { t } = useT();
  // `compact`: the small header version (still a 48 pt touch target); otherwise a full-width pill.
  // 1.0.34 (owner 2026-11-14: "watch now in the corner... change its colours it looks whack in dark mode", then on
  // TestFlight: "the vid in the corner maybe highlighted and glowing"): the corner (header) button is the filled tint pill
  // (onTint on tint, in the contrast audit), so it stands out instead of reading as disabled on the bar's glass; the
  // full-width one is the quiet `soft` pill (fill + tint text, designV2 tint/fill).
  return (
    <View style={style}>
      <PillButton
        label={t('theme.howTo.watch')}
        icon="play-circle"
        variant={compact ? 'filled' : 'soft'}
        size={compact ? 'small' : 'regular'}
        block={!compact}
        onPress={onPress}
        accessibilityHint={t('theme.howTo.watchHint')}
      />
    </View>
  );
}

/**
 * A how-to video for one task: `open()`, the `button` ("Watch how") and the `sheet` to render. With
 * `auto`, it opens on its own the first time this category is reached on this phone (remembered).
 */
export function useHowTo(category: HowToCategory, opts: { auto?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const auto = opts.auto === true;
  useEffect(() => {
    if (!auto) return;
    let live = true;
    howToSeen(category)
      .then((seen) => {
        if (!live || !shouldAutoOpenHowTo(seen)) return;
        setOpen(true);
        void markHowToSeen(category);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [auto, category]);
  const show = () => {
    setOpen(true);
    void markHowToSeen(category);
  };
  const button = (style?: StyleProp<ViewStyle>) => <WatchHowButton onPress={show} style={style} />; // i18n-ignore (JSX, no copy)
  const sheet = <HowToSheet category={category} visible={open} onClose={() => setOpen(false)} />;
  return { open: show, button, sheet };
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: spaceV2.xl, paddingTop: spaceV2.xl, gap: spaceV2.md },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spaceV2.sm },
});
