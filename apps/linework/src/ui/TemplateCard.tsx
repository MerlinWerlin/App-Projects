// Template cards. TemplateCard is the Templates grid card on design v2 (T75, DESIGN_V2 §7): a tall squircle
// BubbleCard (radius lg, soft e2 shadow) with the art on a soft tile, the name, a level badge and a "New" badge for
// the newest set, plus a separate heart button that pops. T82: with onQuickTrace, a tap opens the detail sheet
// (onOpen) and a long press (or the screen-reader action) starts tracing right away. TemplateThumb is the small v1
// square thumbnail.
import { memo, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemeV2 } from '../theme/useTheme';
import { tap } from '../native/haptics';
import { radius, space } from '../theme/tokens';
import { elevationV2, maxFontScaleV2, radiusV2, sizeV2, spaceV2, type PaletteV2 } from '../theme/tokensV2';
import { duration, easeOut, entranceStyle, springTo, useEntrance, useReduceMotion } from '../theme/motion';
import { DEFAULT_STROKE_WIDTH, templateLevel, type Template, type TemplateLevel } from '../core/templates';
import { levelLabel } from '../core/templateSearch';
import { TemplateSvg } from './TemplateSvg';
import { BubbleCard } from './v2/BubbleCard';
import { squircle } from './v2/shared';
import { useT } from '../i18n';

/** Display name in the app's language (English catalogue name as fallback). */
function useTemplateName(template: Template): string {
  const { tDynamic } = useT();
  return tDynamic(`templates.name.${template.id}`, template.name);
}

function useLevelName(level: TemplateLevel): string {
  const { tDynamic } = useT();
  return tDynamic(`templates.level.${level}`, levelLabel(level));
}

// Thumbnails are small, so draw lines a bit heavier than the full-size art.
export const THUMB_STROKE_SCALE = 1.5;

function levelColor(level: TemplateLevel, c: PaletteV2): string {
  return level === 'beginner' ? c.ok : level === 'intermediate' ? c.ink : c.warn;
}

/** Small pill showing a template's level, with 1–3 dots so it reads without colour too. */
export function LevelBadge({ level }: { level: TemplateLevel }) {
  const { c, text } = useThemeV2();
  const dots = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 3;
  const tint = levelColor(level, c);
  const label = useLevelName(level);
  return (
    <View
      style={[
        squircle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          flexShrink: 1,
          paddingHorizontal: spaceV2.x2,
          paddingVertical: 2,
          borderRadius: radiusV2.pill,
          backgroundColor: c.card2,
          borderWidth: 1,
          borderColor: c.line,
        },
      ]}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ width: 5, height: 5, borderRadius: 3, marginEnd: 2, backgroundColor: i < dots ? tint : c.line }}
        />
      ))}
      <Text maxFontSizeMultiplier={1.3} style={[text('caption'), { color: c.muted, marginStart: 3, flexShrink: 1 }]}>
        {label}
      </Text>
    </View>
  );
}

/** "New" pill for templates in the newest set. Decorative: the card's spoken label says "new". */
function NewBadge() {
  const { c, text } = useThemeV2();
  const { t } = useT();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        squircle,
        {
          alignSelf: 'flex-start',
          paddingHorizontal: spaceV2.x2,
          paddingVertical: 2,
          borderRadius: radiusV2.pill,
          backgroundColor: c.pastels[1],
        },
      ]}
    >
      <Text maxFontSizeMultiplier={1.3} style={[text('caption'), { color: c.graphite, fontWeight: '700' }]}>
        {t('templates.card.new')}
      </Text>
    </View>
  );
}

function PlusBadge() {
  const { c, text } = useThemeV2();
  const { t } = useT();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        squircle,
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: spaceV2.x2,
          paddingVertical: 2,
          borderRadius: radiusV2.pill,
          backgroundColor: c.inkSoft,
        },
      ]}
    >
      <Ionicons name="lock-closed" size={11} color={c.ink} />
      <Text maxFontSizeMultiplier={1.3} style={[text('caption'), { color: c.ink, fontWeight: '700' }]}>
        {t('templates.locked')}
      </Text>
    </View>
  );
}

export type TemplateCardProps = {
  template: Template;
  width: number;
  favorite: boolean;
  onOpen: (t: Template) => void;
  onToggleFavorite: (t: Template) => void;
  /** T82: long press / accessibility action starts tracing straight away (tap then opens a preview via onOpen). */
  onQuickTrace?: (t: Template) => void;
  marginBottom?: number;
  /** Position in the grid, for the first-mount stagger (only the first 8 animate). */
  index?: number;
  /** Fade + rise in on mount. The screen turns this off after its first render. */
  entrance?: boolean;
  /** In the newest set: shows the New badge. */
  isNew?: boolean;
  /** Needs Linework Plus (trial over): shows the Plus badge. */
  locked?: boolean;
};

const PAD = spaceV2.x2;
const HEART_POP = 1.3;
/** Art tile height relative to its width: tall (portrait) preview cards. */
const TALL = 1.2;

// Grid card: art + name + level badge; a separate heart button (44 pt) toggles the favourite.
// Press scales the card to 0.96 with the spring and fires one light tap (BubbleCard → PressableScale; the screen's
// open handler fires no haptic of its own). The heart pops 1 → 1.3 → 1 on toggle; the screen fires its select().
function TemplateCardBase({
  template,
  width,
  favorite,
  onOpen,
  onToggleFavorite,
  onQuickTrace,
  marginBottom = spaceV2.x3,
  index = 0,
  entrance = false,
  isNew = false,
  locked = false,
}: TemplateCardProps) {
  const { c, text, isDark } = useThemeV2();
  const reduce = useReduceMotion();
  const enter = useEntrance(index, entrance);
  const pop = useRef(new Animated.Value(1)).current;
  const tileWidth = width - PAD * 2;
  const artSize = tileWidth - spaceV2.x3 * 2;
  const level = templateLevel(template);
  const { t } = useT();
  const name = useTemplateName(template);
  const levelName = useLevelName(level);

  const popHeart = () => {
    if (reduce) return;
    pop.stopAnimation();
    pop.setValue(1);
    Animated.sequence([
      Animated.timing(pop, { toValue: HEART_POP, duration: duration.fast, easing: easeOut, useNativeDriver: true }),
      springTo(pop, 1, false),
    ]).start();
  };

  return (
    <Animated.View style={[{ width, marginBottom }, entranceStyle(enter, reduce)]}>
      <BubbleCard
        onPress={() => onOpen(template)}
        onLongPress={
          onQuickTrace
            ? () => {
                tap();
                onQuickTrace(template);
              }
            : undefined
        }
        accessibilityActions={onQuickTrace ? [{ name: 'longpress', label: t('templates.card.quickTrace') }] : undefined}
        onAccessibilityAction={
          onQuickTrace
            ? (e) => {
                if (e.nativeEvent.actionName === 'longpress') onQuickTrace(template);
              }
            : undefined
        }
        haptic="tap"
        radius="lg"
        elevation="e2"
        padding={PAD}
        // T92: with onQuickTrace the tap opens the detail sheet (T82), so the spoken name says so.
        accessibilityLabel={
          onQuickTrace
            ? isNew
              ? t('templates.card.previewLabelNew', { name, level: levelName })
              : t('templates.card.previewLabel', { name, level: levelName })
            : isNew
              ? t('templates.card.labelNew', { name, level: levelName })
              : t('templates.card.label', { name, level: levelName })
        }
        accessibilityHint={locked ? t('templates.lockedLabel', { name }) : onQuickTrace ? t('templates.card.previewHint') : t('templates.card.hint')}
        style={{ width, minHeight: sizeV2.touch }}
      >
        <View
          style={[
            squircle,
            {
              height: Math.round(tileWidth * TALL),
              borderRadius: radiusV2.md,
              backgroundColor: c.card2,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <TemplateSvg
            template={template}
            size={artSize}
            color={c.graphite}
            strokeWidth={(template.strokeWidth ?? DEFAULT_STROKE_WIDTH) * THUMB_STROKE_SCALE}
          />
        </View>
        <View style={{ paddingHorizontal: spaceV2.x1, paddingTop: spaceV2.x2, paddingBottom: spaceV2.x1 }}>
          <Text numberOfLines={2} maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), { color: c.graphite }]}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.x1, marginTop: spaceV2.x1 }}>
            <LevelBadge level={level} />
            {isNew ? <NewBadge /> : null}
            {locked ? <PlusBadge /> : null}
          </View>
        </View>
      </BubbleCard>
      <Pressable
        onPress={() => {
          popHeart();
          onToggleFavorite(template);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          favorite ? t('templates.card.removeFavourite', { name }) : t('templates.card.addFavourite', { name })
        }
        accessibilityState={{ selected: favorite }}
        hitSlop={4}
        style={({ pressed }) => ({
          position: 'absolute',
          top: spaceV2.x2,
          end: spaceV2.x2,
          width: sizeV2.touch,
          height: sizeV2.touch,
          borderRadius: sizeV2.touch / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? c.inkSoft : 'transparent',
        })}
      >
        <Animated.View
          style={[
            elevationV2('e1', isDark),
            {
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: favorite ? c.inkSoft : c.card,
              transform: [{ scale: pop }],
            },
          ]}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? c.ink : c.muted} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const TemplateCard = memo(TemplateCardBase);


export type TemplateThumbProps = {
  template: Template;
  size: number;
  onOpen: (t: Template) => void;
  /** Prefix for the screen-reader label, e.g. "Recently traced". */
  context: string;
};

// Small square thumbnail for Home's mini-rows; opens the template straight in trace.
function TemplateThumbBase({ template, size, onOpen, context }: TemplateThumbProps) {
  const { c } = useTheme();
  const { t } = useT();
  const name = useTemplateName(template);
  const pad = space.sm;
  return (
    <Pressable
      onPress={() => onOpen(template)}
      accessibilityRole="button"
      accessibilityLabel={t('templates.thumb.label', { context, name })}
      accessibilityHint={t('templates.card.hint')}
      style={({ pressed }) => ({
        width: size,
        height: size,
        padding: pad,
        marginEnd: space.sm,
        borderRadius: radius.sm,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: pressed ? c.ink : c.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <TemplateSvg
        template={template}
        size={size - pad * 2 - 2}
        color={c.graphite}
        strokeWidth={(template.strokeWidth ?? DEFAULT_STROKE_WIDTH) * 2}
      />
    </Pressable>
  );
}

export const TemplateThumb = memo(TemplateThumbBase);
