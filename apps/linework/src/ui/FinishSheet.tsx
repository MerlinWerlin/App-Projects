// T85 finish moment: a "Finished!" GlassSheet after the paper check, with original sparkle accents springing in,
// the before/after thumbnail (reference → your paper) and the actions from src/core/finish.ts. Reduce Motion: the
// sheet and the sparkles only fade. The success haptic is played by the caller (finishHaptic) through
// src/native/haptics, which respects the Haptics setting. Free, never gated by Plus.
// T94: on v2 glass throughout (GlassSheet material, PillButton actions, v2 type and radii, theme tokens only), so
// it reads the same from the Trace paper check and from My drawings.
import { useEffect, useRef } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassSheet, PillButton, Sparkle } from './v2';
import { TemplateSvg } from './TemplateSvg';
import { useThemeV2 } from '../theme/useTheme';
import { light } from '../theme/tokens';
import { maxFontScaleV2, radiusV2, spaceV2 } from '../theme/tokensV2';
import { duration, easeOut, springConfig, useReduceMotion } from '../theme/motion';
import { finishActions, sparkleDelays, type FinishActionId } from '../core/finish';
import type { Template } from '../core/templates';
import { forwardArrow } from '../i18n/direction';
import { useT } from '../i18n';
import { squircle } from './v2/shared';

const THUMB = 116;
/** The reference and the thumbnails are shown as on paper (always light, like the snapshot). */
const INK = light.graphite;

export type FinishSheetProps = {
  visible: boolean;
  /** This snapshot is already in My drawings. */
  saved: boolean;
  /** Save is in flight. */
  saving: boolean;
  /** Saving is possible here (the trace screen passes onSave). */
  canSave: boolean;
  showTimelapseNote: boolean;
  photoUri: string;
  template?: Template;
  overlayUri: string;
  mirror?: boolean;
  onAction: (id: FinishActionId) => void;
};

/** Sparkle positions around the title (start/end so they mirror with the layout; they are decorative). */
const SPARKLES = [
  { top: 0, start: 8, size: 26, variant: 'cluster' as const, tone: 'sunny' as const },
  { top: 6, end: 14, size: 20, variant: 'single' as const, tone: 'bubblegum' as const },
  { top: 44, start: 34, size: 14, variant: 'single' as const, tone: 'lilac' as const },
  { top: 40, end: 40, size: 18, variant: 'cluster' as const, tone: 'mint' as const },
];

function SparkleBurst({ visible }: { visible: boolean }) {
  const { c } = useThemeV2();
  const reduce = useReduceMotion();
  const values = useRef(SPARKLES.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!visible) {
      values.forEach((v) => v.setValue(0));
      return;
    }
    const delays = sparkleDelays(values.length, reduce);
    const anims = values.map((v, i) =>
      Animated.sequence([
        Animated.delay(delays[i] + (reduce ? 0 : 120)),
        reduce
          ? Animated.timing(v, { toValue: 1, duration: duration.fast, easing: easeOut, useNativeDriver: true })
          : Animated.spring(v, { toValue: 1, ...springConfig }),
      ]),
    );
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [visible, reduce, values]);

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
      {SPARKLES.map((s, i) => {
        const v = values[i];
        const transform = reduce
          ? []
          : [
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
            ];
        return (
          <Animated.View
            key={i}
            style={{ position: 'absolute', top: s.top, start: s.start, end: s.end, opacity: v, transform }}
          >
            <Sparkle size={s.size} variant={s.variant} color={c[s.tone]} />
          </Animated.View>
        );
      })}
    </View>
  );
}

export function FinishSheet({
  visible,
  saved,
  saving,
  canSave,
  showTimelapseNote,
  photoUri,
  template,
  overlayUri,
  mirror = false,
  onAction,
}: FinishSheetProps) {
  const { c, text } = useThemeV2();
  const { t } = useT();
  const actions = finishActions({ saved, canSave });
  const hasReference = !!template || overlayUri.length > 0;
  const thumbBox = {
    ...squircle,
    width: THUMB,
    height: THUMB,
    borderRadius: radiusV2.md,
    overflow: 'hidden' as const,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const caption = [text('caption'), { color: c.muted, textAlign: 'center' as const, marginTop: spaceV2.x1 }];

  const labelFor = (id: FinishActionId): { title: string; hint?: string } => {
    switch (id) {
      case 'save':
        return { title: t('drawings.save'), hint: t('drawings.saveHint') };
      case 'viewDrawings':
        return { title: t('drawings.finish.view'), hint: t('drawings.finish.viewHint') };
      case 'traceAgain':
        return { title: t('drawings.finish.traceAgain'), hint: t('drawings.finish.traceAgainHint') };
      default:
        return { title: t('common.close') };
    }
  };
  const iconFor = (id: FinishActionId) =>
    id === 'save' ? ('download' as const) : id === 'viewDrawings' ? ('grid' as const) : id === 'traceAgain' ? ('edit-3' as const) : undefined;

  return (
    <GlassSheet
      visible={visible}
      onClose={() => onAction('close')}
      closeLabel={t('common.close')}
      accessibilityLabel={t('drawings.finish.sheetLabel')}
    >
      <View style={{ alignItems: 'center', paddingTop: spaceV2.x2, paddingBottom: spaceV2.x4 }}>
        <SparkleBurst visible={visible} />
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('largeTitle'), { color: c.graphite, textAlign: 'center', marginTop: spaceV2.x4 }]}
        >
          {t('drawings.finish.title')}
        </Text>
        <Text
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('callout'), { color: c.muted, textAlign: 'center', marginTop: spaceV2.x2, paddingHorizontal: spaceV2.x6 }]}
        >
          {t(saved ? 'drawings.finish.bodySaved' : 'drawings.finish.body')}
        </Text>
      </View>

      {/* Before → after. The images keep their own orientation; only the reading order follows the language. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('drawings.finish.thumbsLabel')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.x3, marginBottom: spaceV2.x4 }}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={thumbBox}>
            {hasReference ? (
              <View style={{ width: THUMB - 12, height: THUMB - 12, transform: [{ scaleX: mirror ? -1 : 1 }] }}>
                {template ? (
                  <TemplateSvg template={template} size={THUMB - 12} color={INK} />
                ) : (
                  <Image source={{ uri: overlayUri }} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: '100%', height: '100%' }} />
                )}
              </View>
            ) : null}
          </View>
          <Text maxFontSizeMultiplier={maxFontScaleV2} style={caption}>
            {t('drawings.finish.before')}
          </Text>
        </View>
        <Feather name={forwardArrow()} size={22} color={c.muted} />
        <View style={{ alignItems: 'center' }}>
          <View style={thumbBox}>
            <Image source={{ uri: photoUri }} resizeMode="cover" accessibilityIgnoresInvertColors style={{ width: '100%', height: '100%' }} />
          </View>
          <Text maxFontSizeMultiplier={maxFontScaleV2} style={caption}>
            {t('drawings.finish.after')}
          </Text>
        </View>
      </View>

      <View style={{ gap: spaceV2.x2 }}>
        {actions.map((a) => {
          const l = labelFor(a.id);
          const busy = a.id === 'save' && saving;
          return (
            <PillButton
              key={a.id}
              title={l.title}
              accessibilityHint={l.hint}
              icon={iconFor(a.id)}
              variant={a.variant}
              block
              disabled={busy}
              onPress={() => onAction(a.id)}
            />
          );
        })}
      </View>

      {showTimelapseNote ? (
        <Text
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('footnote'), { color: c.muted, textAlign: 'center', marginTop: spaceV2.x3 }]}
        >
          {t('drawings.finish.timelapseLater')}
        </Text>
      ) : null}
    </GlassSheet>
  );
}
