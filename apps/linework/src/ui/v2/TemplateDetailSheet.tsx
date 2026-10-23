// Template detail sheet (T82, docs/MARKET.md "Design reference 18 Oct" §2, DESIGN_V2 §6): tapping a Templates grid
// card opens this GlassSheet with a large preview, the name, the level badge, a favourite heart, the line thickness
// choice (thick / medium / thin, the same remembered F4 setting Trace and Lightbox use) and ONE big primary
// PillButton "Start tracing". The preview redraws at the chosen thickness. Long press on a card still starts
// tracing straight away (src/ui/TemplateCard.tsx). Every option here is free.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeV2 } from '../../theme/useTheme';
import { elevationV2, maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { duration, easeOut, springTo, useReduceMotion } from '../../theme/motion';
import { templateLevel, type Template } from '../../core/templates';
import { DEFAULT_LINE_WEIGHT, LINE_WEIGHTS, templateStroke, type LineWeight } from '../../core/lineWeight';
import { loadLineWeight, saveLineWeight } from '../../native/lineWeight';
import { useT } from '../../i18n';
import { TemplateSvg } from '../TemplateSvg';
import { LevelBadge } from '../TemplateCard';
import { GlassSheet } from './Glass';
import { PillButton } from './PillButton';
import { PillSegmented, type PillSegment } from './PillSegmented';
import { Sparkle } from './Sparkle';
import { squircle } from './shared';

export type TemplateDetailSheetProps = {
  /** The template to show; null closes the sheet. */
  template: Template | null;
  favorite: boolean;
  onToggleFavorite: (t: Template) => void;
  /** Starts tracing (the screen's usual card-tap navigation). Called after the thickness is saved. */
  onStart: (t: Template) => void;
  onClose: () => void;
};

/** The preview is smaller than the camera view, so lines are drawn a little heavier to read the same. */
const PREVIEW_STROKE_SCALE = 1.2;
const PREVIEW_MAX = 340;
const HEART_POP = 1.3;

export function TemplateDetailSheet({ template, favorite, onToggleFavorite, onStart, onClose }: TemplateDetailSheetProps) {
  const { c, text, isDark } = useThemeV2();
  const { t, tDynamic, locale, setting } = useT();
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  // Keep the last template while the sheet closes, so its content never blanks mid-dismiss.
  const last = useRef<Template | null>(template);
  if (template) last.current = template;
  const tpl = template ?? last.current;
  const visible = template !== null;

  const [weight, setWeight] = useState<LineWeight>(DEFAULT_LINE_WEIGHT);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const starting = useRef(false);
  useEffect(() => {
    if (!visible) return;
    starting.current = false;
    let alive = true;
    loadLineWeight().then((w) => {
      if (alive) setWeight(w);
    });
    return () => {
      alive = false;
    };
  }, [visible, template?.id]);

  const langKey = `${setting}|${locale}`;
  const weightOptions = useMemo<readonly PillSegment<LineWeight>[]>(
    () => LINE_WEIGHTS.map((w) => ({ value: w, label: t(`trace.lines.${w}`) })),
    [langKey, t],
  );

  const pop = useRef(new Animated.Value(1)).current;
  const popHeart = () => {
    if (reduce) return;
    pop.stopAnimation();
    pop.setValue(1);
    Animated.sequence([
      Animated.timing(pop, { toValue: HEART_POP, duration: duration.fast, easing: easeOut, useNativeDriver: true }),
      springTo(pop, 1, false),
    ]).start();
  };

  if (!tpl) return null;
  const name = tDynamic(`templates.name.${tpl.id}`, tpl.name);
  // Sheet padding is spaceV2.x4 on each side, the preview tile pads the art by spaceV2.x4 too.
  const tile = Math.min(width - spaceV2.x4 * 2, PREVIEW_MAX, Math.round(height * 0.42));
  const art = tile - spaceV2.x4 * 2;

  const changeWeight = (w: LineWeight) => {
    setWeight(w);
    // Remembered right away (Trace and Lightbox read the same setting); Start waits for the write.
    saving.current = saveLineWeight(w);
  };

  const start = () => {
    if (starting.current) return;
    starting.current = true;
    const chosen = tpl;
    saving.current.then(() => onStart(chosen));
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} closeLabel={t('common.close')} accessibilityLabel={name}>
      <ScrollView style={{ flexShrink: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Large preview on a soft tile */}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('templates.detail.previewLabel', { name })}
          style={[
            squircle,
            {
              alignSelf: 'center',
              width: tile,
              height: tile,
              borderRadius: radiusV2.lg,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.line,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <TemplateSvg
            template={tpl}
            size={art}
            color={c.graphite}
            strokeWidth={templateStroke(tpl, weight) * PREVIEW_STROKE_SCALE}
          />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: spaceV2.x3, start: spaceV2.x3 }}>
            <Sparkle variant="cluster" size={22} color={c.bubblegum} />
          </View>
        </View>

        {/* Name, level and favourite */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.x3, marginTop: spaceV2.x4 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[text('title2'), { color: c.graphite }]}>
              {name}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: spaceV2.x2 }}>
              <LevelBadge level={templateLevel(tpl)} />
            </View>
          </View>
          <Pressable
            onPress={() => {
              popHeart();
              onToggleFavorite(tpl);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? t('templates.card.removeFavourite', { name }) : t('templates.card.addFavourite', { name })
            }
            accessibilityState={{ selected: favorite }}
            style={({ pressed }) => ({
              width: sizeV2.touch + 4,
              height: sizeV2.touch + 4,
              borderRadius: (sizeV2.touch + 4) / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? c.inkSoft : 'transparent',
            })}
          >
            <Animated.View
              style={[
                elevationV2('e1', isDark),
                {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: favorite ? c.inkSoft : c.card,
                  transform: [{ scale: pop }],
                },
              ]}
            >
              <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={24} color={favorite ? c.ink : c.muted} />
            </Animated.View>
          </Pressable>
        </View>

        {/* Line thickness (F4 setting, shared with Trace) */}
        <Text
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('footnote'), { color: c.muted, fontWeight: '600', marginTop: spaceV2.x5, marginBottom: spaceV2.x2 }]}
        >
          {t('templates.detail.lines')}
        </Text>
        <PillSegmented
          options={weightOptions}
          value={weight}
          onChange={changeWeight}
          accessibilityLabel={t('templates.detail.lines')}
        />
      </ScrollView>

      {/* The one primary action, always visible under the scrolling content */}
      <PillButton
        title={t('templates.detail.start')}
        accessibilityHint={t('templates.detail.startHint')}
        icon="edit-3"
        onPress={start}
        style={{ marginTop: spaceV2.x5 }}
      />
    </GlassSheet>
  );
}
