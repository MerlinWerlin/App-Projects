import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { elevation, fonts, minTarget, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { FadeIn } from './motion/FadeIn';
import { PressableScale } from './motion/PressableScale';

export interface EmptyStateProps {
  title: string;
  body: string;
  /** Optional button under the copy (e.g. "Try again"). */
  action?: { label: string; onPress: () => void };
  /** Announce the copy when it appears (use for errors). */
  announce?: boolean;
}

/**
 * Designed empty state (premium polish rule 6): a calm generic TV glyph (rectangle on a stand,
 * plain Views, no brand art), a title in ink, a body in muted (both AA on the panel colour in light
 * and dark) and an optional button. Fades in on mount.
 */
export function EmptyState({ title, body, action, announce = false }: EmptyStateProps) {
  const t = useTheme();
  return (
    <FadeIn style={styles.wrap}>
      <View style={styles.glyph} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.screen, { borderColor: t.muted, backgroundColor: t.key }]}>
          <View style={[styles.glint, { backgroundColor: t.accentSoft }]} />
        </View>
        <View style={[styles.neck, { backgroundColor: t.muted }]} />
        <View style={[styles.base, { backgroundColor: t.muted }]} />
      </View>
      <View style={styles.copy} accessible accessibilityLiveRegion={announce ? 'polite' : 'none'}>
        <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.body, { color: t.muted }]}>{body}</Text>
      </View>
      {action ? (
        <PressableScale
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[styles.btn, elevation.key, { backgroundColor: t.key, shadowColor: t.keyEdge }]}
        >
          <Text style={[styles.btnTxt, { color: t.ink }]}>{action.label}</Text>
        </PressableScale>
      ) : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8, gap: 12 },
  glyph: { alignItems: 'center', opacity: 0.85 },
  screen: { width: 64, height: 42, borderRadius: 9, borderWidth: 2.5, overflow: 'hidden' },
  glint: { position: 'absolute', top: 5, start: 6, width: 18, height: 5, borderRadius: 3, opacity: 0.9 },
  neck: { width: 4, height: 7 },
  base: { width: 28, height: 3.5, borderRadius: 2 },
  copy: { alignItems: 'center', gap: 4, maxWidth: 300 },
  title: { fontFamily: fonts.display, fontSize: 16, textAlign: 'center' },
  body: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  btn: {
    minHeight: minTarget,
    minWidth: 140,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnTxt: { fontFamily: fonts.textBold, fontSize: 15 },
});
