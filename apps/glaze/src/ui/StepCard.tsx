// StepCard: one numbered install step with a simple drawn phone illustration and an
// optional "done" tick. Illustrations are schematic (bars and shapes, no screenshots).
// Design v2 (T83): surface squircle card, v2 palette in the drawings, tintSoft number badge.

import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import type { Illustration } from '../core/install';
import { useT } from '../i18n';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type PaletteV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { noMirror, textStyleFor } from './i18nLayout';

type Props = {
  index: number;
  title: string;
  body: string;
  illustration: Illustration;
  done?: boolean;
  onToggleDone?: () => void;
  children?: ReactNode;
};

const W = 84;
const H = 150;

/** Phone frame with screen content drawn inside (coordinates in an 84×150 box). */
function Phone({ c, children }: { c: PaletteV2; children: ReactNode }) {
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={2} y={2} width={W - 4} height={H - 4} rx={14} fill={c.bg} stroke={c.inkTertiary} strokeWidth={2} />
      <Rect x={W / 2 - 14} y={8} width={28} height={6} rx={3} fill={c.inkTertiary} />
      <G>{children}</G>
    </Svg>
  );
}

/** A list row: icon dot + text bar, optionally highlighted. */
function Row({ c, y, highlight, tone }: { c: PaletteV2; y: number; highlight?: boolean; tone?: 'warn' }) {
  const ink = tone === 'warn' ? c.warn : highlight ? c.tint : c.separator;
  return (
    <G>
      {highlight ? <Rect x={8} y={y - 3} width={W - 16} height={16} rx={5} fill={c.tintSoft} stroke={c.tint} strokeWidth={1.5} /> : null}
      <Circle cx={16} cy={y + 5} r={4} fill={ink} />
      <Rect x={24} y={y + 2} width={highlight ? 44 : 38} height={6} rx={3} fill={ink} />
    </G>
  );
}

function Art({ kind, c }: { kind: Illustration; c: PaletteV2 }) {
  switch (kind) {
    case 'share-files': {
      return (
        <Phone c={c}>
          <Rect x={6} y={70} width={W - 12} height={72} rx={10} fill={c.surface} stroke={c.separator} />
          {[0, 1, 2, 3].map((i) => (
            <Circle key={i} cx={18 + i * 16} cy={84} r={5} fill={c.separator} />
          ))}
          <Row c={c} y={98} />
          <Row c={c} y={114} highlight />
          <Row c={c} y={130} />
        </Phone>
      );
    }
    case 'files-tap': {
      return (
        <Phone c={c}>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((k) => {
              const hit = r === 1 && k === 1;
              return (
                <Rect
                  key={`${r}-${k}`}
                  x={12 + k * 22}
                  y={28 + r * 30}
                  width={16}
                  height={20}
                  rx={3}
                  fill={hit ? c.tint : c.separator}
                />
              );
            }),
          )}
          <Circle cx={42} cy={68} r={11} fill="none" stroke={c.tint} strokeWidth={2} />
          <Rect x={10} y={112} width={W - 20} height={24} rx={8} fill={c.surface} stroke={c.tint} strokeWidth={1.5} />
          <Rect x={18} y={121} width={44} height={6} rx={3} fill={c.tint} />
        </Phone>
      );
    }
    case 'settings-row':
    case 'install-button': {
      return (
        <Phone c={c}>
          {kind === 'install-button' ? (
            <G>
              <Rect x={50} y={22} width={26} height={12} rx={6} fill={c.tint} />
              <Rect x={12} y={44} width={W - 24} height={30} rx={8} fill={c.surface} stroke={c.separator} />
              <Circle cx={22} cy={59} r={6} fill={c.glaze[1]} />
              <Rect x={32} y={55} width={36} height={6} rx={3} fill={c.ink} />
            </G>
          ) : (
            <Row c={c} y={30} highlight />
          )}
          <Row c={c} y={kind === 'install-button' ? 86 : 52} />
          <Row c={c} y={kind === 'install-button' ? 102 : 68} />
          <Row c={c} y={kind === 'install-button' ? 118 : 84} />
        </Phone>
      );
    }
    case 'not-verified': {
      return (
        <Phone c={c}>
          <Rect x={12} y={30} width={W - 24} height={40} rx={8} fill={c.surface} stroke={c.separator} />
          <Circle cx={24} cy={50} r={7} fill={c.glaze[1]} />
          <Rect x={36} y={42} width={32} height={6} rx={3} fill={c.ink} />
          <Rect x={36} y={54} width={26} height={6} rx={3} fill={c.warn} />
          <Rect x={18} y={84} width={W - 36} height={50} rx={10} fill={c.tintSoft} />
          <Rect x={30} y={96} width={24} height={26} rx={6} fill="none" stroke={c.ok} strokeWidth={2.5} />
          <Rect x={36} y={104} width={12} height={4} rx={2} fill={c.ok} />
          <Rect x={36} y={111} width={12} height={4} rx={2} fill={c.ok} />
        </Phone>
      );
    }
    case 'home-remove': {
      return (
        <Phone c={c}>
          {[0, 1, 2].map((k) => (
            <Rect key={k} x={12 + k * 22} y={26} width={16} height={16} rx={4} fill={k === 0 ? c.tint : c.separator} />
          ))}
          <Rect x={8} y={50} width={W - 16} height={56} rx={8} fill={c.surface} stroke={c.separator} />
          <Row c={c} y={58} />
          <Row c={c} y={74} />
          <Rect x={12} y={88} width={W - 24} height={14} rx={5} fill="none" stroke={c.warn} strokeWidth={1.5} />
          <Rect x={18} y={92} width={40} height={6} rx={3} fill={c.warn} />
          <Rect x={18} y={118} width={W - 36} height={20} rx={6} fill={c.tintSoft} />
        </Phone>
      );
    }
    case 'safari-page': {
      // T126: Safari address bar over a page with one big Install button.
      return (
        <Phone c={c}>
          <Rect x={8} y={22} width={W - 16} height={14} rx={7} fill={c.surface} stroke={c.separator} />
          <Rect x={18} y={27} width={36} height={4} rx={2} fill={c.separator} />
          <Rect x={16} y={56} width={W - 32} height={8} rx={4} fill={c.ink} />
          <Rect x={22} y={70} width={W - 44} height={6} rx={3} fill={c.separator} />
          <Rect x={14} y={96} width={W - 28} height={22} rx={11} fill={c.tint} />
          <Circle cx={W / 2} cy={107} r={13} fill="none" stroke={c.tint} strokeWidth={2} />
        </Phone>
      );
    }
    case 'allow-dialog': {
      // T126: the "allow download" alert with Allow highlighted.
      return (
        <Phone c={c}>
          <Rect x={10} y={46} width={W - 20} height={62} rx={10} fill={c.surface} stroke={c.separator} />
          <Rect x={18} y={56} width={W - 36} height={6} rx={3} fill={c.ink} />
          <Rect x={18} y={68} width={W - 48} height={5} rx={2.5} fill={c.separator} />
          <Rect x={16} y={86} width={(W - 40) / 2} height={14} rx={6} fill={c.separator} />
          <Rect x={24 + (W - 40) / 2} y={86} width={(W - 40) / 2} height={14} rx={6} fill={c.tint} />
        </Phone>
      );
    }
    case 'home-icons': {
      // T126: a Home Screen grid with the new icons in the theme tint.
      return (
        <Phone c={c}>
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((k) => (
              <Rect
                key={`${r}-${k}`}
                x={12 + k * 22}
                y={26 + r * 26}
                width={16}
                height={16}
                rx={4}
                fill={r < 2 ? c.tint : c.separator}
              />
            )),
          )}
        </Phone>
      );
    }
    case 'remove-profile': {
      return (
        <Phone c={c}>
          <Row c={c} y={28} />
          <Row c={c} y={44} highlight />
          <Row c={c} y={60} />
          <Rect x={10} y={112} width={W - 20} height={20} rx={6} fill={c.surface} stroke={c.warn} strokeWidth={1.5} />
          <Rect x={20} y={119} width={44} height={6} rx={3} fill={c.warn} />
        </Phone>
      );
    }
  }
}

/** Illustration only (also used outside the card). */
export function StepIllustration({ kind }: { kind: Illustration }) {
  const { c } = useColorsV2();
  return (
    <View style={noMirror} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Art kind={kind} c={c} />
    </View>
  );
}

export function StepCard({ index, title, body, illustration, done, onToggleDone, children }: Props) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface, borderColor: done ? c.ok : c.separator }]}>
      <View style={styles.top}>
        <StepIllustration kind={illustration} />
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <View style={[styles.badge, { backgroundColor: done ? c.ok : c.tintSoft }]}>
              {done ? (
                <Feather name="check" size={14} color={c.onTint} />
              ) : (
                <Text style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.badgeText, { color: c.onTintSoft }]}>{formatNumber(index)}</Text>
              )}
            </View>
            <Text accessibilityRole="header" style={[textV2.headline, textStyleFor(script, textV2.headline), styles.flex, { color: c.ink }]}>
              {title}
            </Text>
          </View>
          <Text style={[textV2.subhead, textStyleFor(script, textV2.subhead), { color: c.inkSecondary }]}>{body}</Text>
        </View>
      </View>
      {children}
      {onToggleDone ? (
        <Pressable
          onPress={onToggleDone}
          accessibilityRole="checkbox"
          accessibilityLabel={t('install.stepCard.a11yDone', { index, title })}
          accessibilityState={{ checked: !!done }}
          style={({ pressed }) => [styles.doneRow, { borderTopColor: c.separator, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name={done ? 'check-square' : 'square'} size={20} color={done ? c.ok : c.inkSecondary} />
          <Text style={[textV2.body, textStyleFor(script, textV2.body), styles.flex, { color: done ? c.ok : c.ink }]}>
            {done ? t('install.stepCard.done') : t('install.stepCard.markDone')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  top: { flexDirection: 'row', gap: spaceV2.md, padding: spaceV2.md },
  text: { flex: 1, gap: spaceV2.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  badge: { minWidth: 24, minHeight: 24, borderRadius: 12, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '700' },
  flex: { flex: 1 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
