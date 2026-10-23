// Guided first trace (T66): a short, skippable 4-step setup guide with original illustrations. Shown once on first
// run from Home (replaces the old 3 tip cards, same "seen" flag) and replayable from Settings.
// Motion: each step fades in and springs in from the reading end (motion tokens); Reduce Motion = fade only.
// Finishing fires a success haptic (follows the Haptics setting via src/native/haptics).
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { elevation, radius, space, tabular, touch } from '../theme/tokens';
import { fadeTo, springTo, useReduceMotion } from '../theme/motion';
import { SETUP_GUIDE_STEPS, clampStep, isLastStep, slideFrom, startGuide, stepGuide, type GuideAction, type GuideNav } from '../core/setupGuide';
import { backChevron, forwardChevron, isRTL } from '../i18n/direction';
import { success } from '../native/haptics';
import { useT } from '../i18n';
import { useTypography } from '../theme/typography';
import { PressableScale } from './PressableScale';
import { SetupGuideArt } from './SetupGuideArt';

const SLIDE = 28;

export type SetupGuideProps = {
  visible: boolean;
  /** Called when the guide closes: finished = true after the last step, false on Skip or Android back. */
  onDone: (finished: boolean) => void;
};

export function SetupGuide({ visible, onDone }: SetupGuideProps) {
  const ty = useTypography();
  const { c } = useTheme();
  const { t, tDynamic } = useT();
  const reduce = useReduceMotion();
  const [nav, setNav] = useState<GuideNav>(startGuide);
  const fade = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const total = SETUP_GUIDE_STEPS.length;

  useEffect(() => {
    if (visible) setNav(startGuide());
  }, [visible]);

  const animateIn = (forward: boolean) => {
    fade.setValue(0);
    shift.setValue(slideFrom(forward, isRTL(), SLIDE, reduce));
    Animated.parallel([fadeTo(fade, 1, reduce), springTo(shift, 0, reduce)]).start();
  };

  const act = (action: GuideAction) => {
    const next = stepGuide(nav, action, total);
    setNav(next);
    if (next.closed) {
      if (next.finished) success();
      onDone(next.finished);
      return;
    }
    if (next.index !== nav.index) animateIn(next.index > nav.index);
  };

  if (total === 0) return null;
  const i = clampStep(nav.index, total);
  const step = SETUP_GUIDE_STEPS[i];
  const last = isLastStep(i, total);
  const counter = t('home.guide.counter', { index: i + 1, total });

  return (
    <Modal visible={visible} transparent animationType={reduce ? 'none' : 'fade'} onRequestClose={() => act('skip')}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,19,15,0.55)', justifyContent: 'center', padding: space.lg }}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.card,
            borderRadius: radius.lg,
            padding: space.xl,
            borderWidth: 1,
            borderColor: c.line,
            overflow: 'hidden',
            ...elevation.overlay,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              maxFontSizeMultiplier={1.4}
              accessibilityLiveRegion="polite"
              style={[{ ...ty.face('bodyMedium'), fontSize: 14, color: c.muted, flexShrink: 1 }, tabular]}
            >
              {counter}
            </Text>
            {!last ? (
              <Pressable
                onPress={() => act('skip')}
                accessibilityRole="button"
                accessibilityLabel={t('home.guide.skipLabel')}
                hitSlop={8}
                style={{ minHeight: touch, minWidth: touch, alignItems: 'flex-end', justifyContent: 'center', paddingStart: space.sm }}
              >
                <Text maxFontSizeMultiplier={1.4} style={{ ...ty.face('bodyMedium'), fontSize: 16, color: c.ink }}>
                  {t('home.guide.skip')}
                </Text>
              </Pressable>
            ) : (
              <View style={{ minHeight: touch }} />
            )}
          </View>

          <Animated.View style={{ opacity: fade, transform: [{ translateX: shift }] }}>
            <View
              style={{
                backgroundColor: c.inkSoft,
                borderRadius: radius.md,
                paddingVertical: space.sm,
                marginTop: space.sm,
                marginBottom: space.lg,
              }}
            >
              <SetupGuideArt id={step.id} />
            </View>
            <Text accessibilityRole="header" style={{ ...ty.face('display'), fontSize: 26, color: c.graphite }}>
              {tDynamic(`home.guide.step.${step.id}.title`, step.title)}
            </Text>
            <Text style={{ ...ty.face('body'), fontSize: 17, lineHeight: ty.lhOf(25), color: c.muted, marginTop: space.sm }}>
              {tDynamic(`home.guide.step.${step.id}.body`, step.body)}
            </Text>
          </Animated.View>

          {/* Page indicator (the counter above says the same for screen readers). */}
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.xl, marginBottom: space.lg }}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            {SETUP_GUIDE_STEPS.map((s, n) => (
              <View
                key={s.id}
                style={{
                  width: n === i ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  marginHorizontal: 3,
                  backgroundColor: n === i ? c.ink : c.line,
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: space.sm }}>
            {i > 0 ? (
              <PressableScale
                onPress={() => act('back')}
                haptic="select"
                accessibilityRole="button"
                accessibilityLabel={t('home.guide.backLabel')}
                style={{
                  minHeight: touch + 8,
                  minWidth: touch + 8,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.card,
                  paddingHorizontal: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name={backChevron()} size={20} color={c.graphite} />
                <Text maxFontSizeMultiplier={1.4} style={{ ...ty.face('bodyBold'), fontSize: 16, color: c.graphite, marginStart: space.xs, flexShrink: 1 }}>
                  {t('common.back')}
                </Text>
              </PressableScale>
            ) : null}
            <PressableScale
              onPress={() => act('next')}
              haptic={last ? 'none' : 'tap'}
              accessibilityRole="button"
              accessibilityLabel={last ? t('home.guide.doneLabel') : t('home.guide.nextLabel')}
              style={{
                flex: 1,
                minHeight: touch + 8,
                borderRadius: radius.md,
                backgroundColor: c.ink,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                ...elevation.card,
              }}
            >
              <Text style={{ ...ty.face('bodyBold'), fontSize: 18, color: c.onInk, flexShrink: 1, textAlign: 'center' }}>
                {last ? t('home.guide.done') : t('common.next')}
              </Text>
              <Feather name={last ? 'check' : forwardChevron()} size={20} color={c.onInk} style={{ marginStart: space.sm }} />
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}
