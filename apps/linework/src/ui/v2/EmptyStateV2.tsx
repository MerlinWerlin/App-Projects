// Designed "nothing here yet" state (T86, docs/MARKET.md "Design reference 18 Oct" §2, DESIGN_V2 §1.3): an
// original line-art doodle on a soft pastel card with static Sparkle accents, a title, an optional body line and
// exactly ONE clear action (a primary PillButton). Art variants: drawings, favourites, search, recents (pastel and
// accent per variant in src/core/emptyState.ts). The doodle is decorative and hidden from screen readers.
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, pastelAt, spaceV2 } from '../../theme/tokensV2';
import { emptyArtStyle, type EmptyArt } from '../../core/emptyState';
import { BubbleCard } from './BubbleCard';
import { PillButton } from './PillButton';
import { Sparkle } from './Sparkle';
import type { FeatherName } from './shared';
import type { PressHaptic } from '../PressableScale';

export type { EmptyArt };

export type EmptyStateV2Props = {
  art: EmptyArt;
  title: string;
  body?: string;
  /** The one clear action. */
  action: {
    title: string;
    onPress: () => void;
    accessibilityHint?: string;
    icon?: FeatherName;
    /** Default the primary pill's tap; 'none' when onPress fires its own haptic. */
    haptic?: PressHaptic;
  };
  style?: StyleProp<ViewStyle>;
};

const ART_W = 160;
const ART_H = 120;

/** Original doodles in a 160 × 120 box: graphite outlines with one accent fill. */
export function EmptyArtSvg({ art, width = ART_W }: { art: EmptyArt; width?: number }) {
  const { c } = useThemeV2();
  const accent = c[emptyArtStyle(art).accent];
  const ink = c.graphite;
  const s = { stroke: ink, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const height = (width * ART_H) / ART_W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${ART_W} ${ART_H}`}>
      {art === 'drawings' ? (
        <G>
          {/* open sketchbook with a little flower doodle and a pencil */}
          <Path d="M24 34 Q52 26 80 36 Q108 26 136 34 V98 Q108 90 80 100 Q52 90 24 98 Z" fill={c.card} {...s} />
          <Path d="M80 36 V100" fill="none" {...s} />
          <Path d="M36 50 H66 M36 62 H60 M36 74 H64" fill="none" stroke={c.line} strokeWidth={2.5} strokeLinecap="round" />
          <Circle cx={108} cy={58} r={7} fill={accent} {...s} />
          <Path d="M108 51 Q104 42 108 38 Q112 42 108 51 M115 58 Q124 54 128 58 Q124 62 115 58 M108 65 Q112 74 108 78 Q104 74 108 65 M101 58 Q92 62 88 58 Q92 54 101 58" fill="none" {...s} />
          <Path d="M108 78 Q106 86 110 92" fill="none" {...s} />
          <G transform="rotate(38 128 88)">
            <Rect x={122} y={56} width={11} height={40} rx={2} fill={c.card} {...s} />
            <Path d="M122 64 H133 M122 96 L127.5 108 L133 96" fill={c.card} {...s} />
          </G>
        </G>
      ) : art === 'favourites' ? (
        <G>
          {/* a hand-drawn heart with a second sketchy outline and motion ticks */}
          <Path d="M80 100 C44 78 34 50 52 38 C64 30 76 36 80 48 C84 36 96 30 108 38 C126 50 116 78 80 100 Z" fill={accent} opacity={0.35} />
          <Path d="M80 100 C44 78 34 50 52 38 C64 30 76 36 80 48 C84 36 96 30 108 38 C126 50 116 78 80 100 Z" fill="none" {...s} />
          <Path d="M58 46 Q54 52 56 58" fill="none" {...s} />
          <Path d="M30 40 L22 36 M32 28 L26 20 M130 40 L138 36 M128 28 L134 20" fill="none" {...s} />
        </G>
      ) : art === 'search' ? (
        <G>
          {/* magnifying glass over an empty dotted path */}
          <Path d="M20 96 H40 M50 96 H62 M72 96 H80" fill="none" stroke={c.line} strokeWidth={2.5} strokeLinecap="round" />
          <Circle cx={74} cy={52} r={28} fill={c.card} {...s} />
          <Circle cx={74} cy={52} r={20} fill={accent} opacity={0.25} />
          <Path d="M62 44 Q66 38 74 38" fill="none" {...s} />
          <Path d="M94 72 L118 96" fill="none" stroke={ink} strokeWidth={9} strokeLinecap="round" />
        </G>
      ) : (
        <G>
          {/* clock with a looping arrow: nothing traced lately */}
          <Circle cx={80} cy={60} r={34} fill={c.card} {...s} />
          <Circle cx={80} cy={60} r={26} fill={accent} opacity={0.25} />
          <Path d="M80 40 V60 L94 68" fill="none" {...s} />
          <Path d="M80 30 V33 M80 87 V90 M50 60 H53 M107 60 H110" fill="none" {...s} />
          <Path d="M30 44 Q38 20 64 16" fill="none" {...s} />
          <Path d="M28 34 L30 45 L40 40" fill="none" {...s} />
        </G>
      )}
    </Svg>
  );
}

export function EmptyStateV2({ art, title, body, action, style }: EmptyStateV2Props) {
  const { c, text } = useThemeV2();
  const look = emptyArtStyle(art);
  return (
    <BubbleCard fill={pastelAt(c, look.pastel)} elevation="none" radius="xl" padding={spaceV2.x6} style={style}>
      <View style={{ alignItems: 'center' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingVertical: spaceV2.x2 }}>
          <EmptyArtSvg art={art} />
          <Sparkle variant="cluster" size={26} color={c[look.accent]} style={{ position: 'absolute', top: 0, end: -spaceV2.x4 }} />
          <Sparkle size={14} color={c.sunny} style={{ position: 'absolute', bottom: spaceV2.x3, start: -spaceV2.x3 }} />
        </View>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('title2'), { color: c.graphite, textAlign: 'center', marginTop: spaceV2.x4 }]}
        >
          {title}
        </Text>
        {body ? (
          <Text
            maxFontSizeMultiplier={maxFontScaleV2}
            style={[text('callout'), { color: c.muted, textAlign: 'center', marginTop: spaceV2.x2 }]}
          >
            {body}
          </Text>
        ) : null}
        <PillButton
          title={action.title}
          accessibilityHint={action.accessibilityHint}
          icon={action.icon}
          onPress={action.onPress}
          haptic={action.haptic}
          block={false}
          style={{ alignSelf: 'center', marginTop: spaceV2.x5 }}
        />
      </View>
    </BubbleCard>
  );
}
