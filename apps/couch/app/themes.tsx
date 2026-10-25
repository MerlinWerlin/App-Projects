import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { dpadGeometry } from '../src/core/dpadGeometry';
import { useT } from '../src/i18n/react';
import { plusForSale } from '../src/core/forSale';
import { usePrefs } from '../src/state/prefs';
import { continuous, list, radii, space, textStyle } from '../src/theme/design';
import { duration } from '../src/theme/motion';
import { REMOTE_THEME_IDS, REMOTE_THEMES, type RemoteTheme, type RemoteThemeId } from '../src/theme/remoteThemes';
import { useRemoteThemeAccess } from '../src/theme/RemoteThemeContext';
import { pickTheme, previewThemeId, themeBadge } from '../src/theme/themePicker';
// The mini remote is drawn with the remote's own tokens, like the real remote card.
import { elevation, fonts, radius } from '../src/theme/tokens';
import { useReducedMotion } from '../src/theme/useReducedMotion';
import { NeverMirror } from '../src/ui/NeverMirror';
import { FreePromise } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';
import type { Key } from '../src/core/keys';
import { RemoteIcon } from '../src/ui/icons/RemoteIcon';
import type { IconName } from '../src/ui/icons/names';
import { NAV_ROW, TOP_ROW_KEYS } from '../src/ui/remote/controls';
import { OkBevel } from '../src/ui/remote/DPad';
import { RemoteTexture } from '../src/ui/remote/RemoteTexture';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

/** Mini remote d-pad: sizes from the one d-pad geometry (fb-1017-ok, fb-1017b H1), just smaller. */
const MINI = dpadGeometry(132, 1);
/** Icon box of the mini preview's keys and arrows (pt). */
const MINI_ICON = 20;
const MINI_ARROW = Math.max(16, MINI.arrowIcon.size);

/** Key → Couch icon id for the preview (fb-1017b H2 icon set; controls.ts gains the same table). */
const KEY_ICON: Partial<Record<Key, IconName>> = {
  POWER: 'power', SOURCE: 'source', SETTINGS: 'settings', HOME: 'home', BACK: 'back', MENU: 'menu',
  MUTE: 'mute', VOL_UP: 'volUp', VOL_DOWN: 'volDown', CH_UP: 'chUp', CH_DOWN: 'chDown',
  PLAY_PAUSE: 'playPause', REW: 'rewind', FF: 'fastForward', VOICE: 'mic',
  UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right',
};

/**
 * Remote theme picker (owner-1017 T56/T57), from Settings → Remote theme; design v2 (market-1018 M3,
 * docs/DESIGN_V2.md). Large title, then a live, non-interactive preview of the remote in the selected
 * (or tried) theme in a mid-elevation Card, then every theme as an inset-grouped row with its swatch
 * tile, a Free / Plus subtitle and a check on the shown one. Free themes apply at once (cross-fade;
 * instant under Reduce Motion). A Plus theme without Plus starts "Try it": the real remote shows it
 * this session, with "Get Couch Plus to keep it" (one-time purchase, filled pill) and "Stop trying"
 * (tinted pill). Themes never change what a button does and never hide a control. The entitlement is
 * read only in src/plus (PlusThemeProvider).
 */
export default function ThemesScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { prefs, set } = usePrefs();
  const { plus, trying, tryTheme } = useRemoteThemeAccess();
  const shownId = previewThemeId(prefs.remoteTheme, { plus, trying });
  const shown = REMOTE_THEMES[shownId];

  // Cross-fade the preview whenever the shown theme changes (instant under Reduce Motion).
  const fade = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0.25);
    Animated.timing(fade, { toValue: 1, duration: duration.slow, useNativeDriver: true }).start();
  }, [shownId, reduce, fade]);

  // The row plays the selection haptic (check rows), so this only applies or tries.
  const onPick = (id: RemoteThemeId) => {
    const pick = pickTheme(id, { plus });
    if (pick.kind === 'apply') {
      tryTheme(null);
      set({ remoteTheme: pick.id });
    } else {
      tryTheme(pick.id);
    }
  };

  const shownName = t(shown.nameKey);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTitleHeader
        title={t('app.themes.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <Text style={[textStyle('subheadline'), styles.intro, { color: p.secondaryLabel }]}>{t('app.themes.intro')}</Text>

        <Card elevation="mid" padded={false} style={[styles.previewCard, { backgroundColor: shown.stage }]}>
          <Animated.View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('app.themes.preview', { name: shownName })}
            style={[styles.stage, { opacity: fade }]}
          >
            <MiniRemote theme={shown} />
          </Animated.View>
        </Card>

        {trying ? (
          <Card style={styles.card}>
            <View accessibilityLiveRegion="polite" style={styles.banner}>
              <Text style={[textStyle('headline'), { color: p.label }]}>{t('app.themes.trying', { name: t(REMOTE_THEMES[trying].nameKey) })}</Text>
              <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{t(plusForSale() ? 'app.themes.keepHint' : 'app.themes.tryingSession')}</Text>
            </View>
            {/* Release standard 2: nothing is for sale in this version, so no "Get Couch Plus" button. */}
            {plusForSale() ? (
              <PillButton
                stretch
                label={t('app.themes.keep')}
                accessibilityLabel={t('app.themes.keep')}
                accessibilityHint={t('app.themes.keepHint')}
                onPress={() => router.navigate('/plus')}
              />
            ) : null}
            <PillButton
              stretch
              variant="tinted"
              label={t('app.themes.stopTrying')}
              accessibilityLabel={t('app.themes.stopTrying')}
              onPress={() => tryTheme(null)}
            />
          </Card>
        ) : null}

        <InsetGroupedList header={t('app.themes.all')} footer={t(plusForSale() ? 'app.themes.plusNote' : 'app.themes.plusNoteLater')}>
          {REMOTE_THEME_IDS.map((id) => {
            const th = REMOTE_THEMES[id];
            const on = id === shownId;
            const badge = themeBadge(id);
            const locked = badge === 'plus' && !plus;
            const name = t(th.nameKey);
            const tier = badge === 'free' ? t('app.themes.free') : t('app.themes.plus');
            return (
              <Row
                key={id}
                title={name}
                subtitle={tier}
                icon={<Swatch theme={th} />}
                accessory={{ type: 'check', checked: on }}
                accessibilityLabel={t('app.themes.tileLabel', { name, tier })}
                accessibilityHint={locked ? t('app.themes.tryHint') : undefined}
                onPress={() => onPick(id)}
              />
            );
          })}
        </InsetGroupedList>

        <View style={styles.bottom}>
          <FreePromise color={p.secondaryLabel} />
        </View>
      </LargeTitleHeader>
    </>
  );
}

/** Swatch tile: the theme's body with three dots for key, ring and accent (decoration). */
function Swatch({ theme }: { theme: RemoteTheme }) {
  return (
    <View style={[styles.swatch, continuous, { backgroundColor: theme.body, borderColor: theme.keyEdge }]}>
      <View style={[styles.dot, { backgroundColor: theme.key }]} />
      <View style={[styles.dot, { backgroundColor: theme.ring, borderColor: theme.ringLit, borderWidth: 1.5 }]} />
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
    </View>
  );
}

/** A preview key's icon (decoration: the preview is hidden from accessibility). */
function MiniIcon({ k, color }: { k: Key; color: string }) {
  const name = KEY_ICON[k];
  return name ? <RemoteIcon name={name} size={MINI_ICON} color={color} /> : null;
}

/** A compact, non-interactive remote drawn with the theme's tokens (decoration for the preview). */
function MiniRemote({ theme }: { theme: RemoteTheme }) {
  const t = useT();
  const k = MINI.key;
  const keyStyle = [styles.miniKey, { backgroundColor: theme.key, shadowColor: theme.keyEdge, borderRadius: theme.radius }];
  return (
    <View
      style={[styles.mini, { backgroundColor: theme.body }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <RemoteTexture texture={theme.texture} radius={radius.panel + 8} />
      <View style={styles.miniRow}>
        {TOP_ROW_KEYS.slice(0, 3).map((c) => (
          <View key={c.key} style={keyStyle}>
            <MiniIcon k={c.key} color={c.variant === 'power' ? theme.power : theme.ink} />
          </View>
        ))}
      </View>
      {/* Arrows keep their physical sides, as on the real d-pad. */}
      <NeverMirror style={styles.center}>
        <View
          style={[
            styles.miniPad,
            { width: MINI.diameter, height: MINI.diameter, borderRadius: MINI.diameter / 2, backgroundColor: theme.ring, shadowColor: theme.keyEdge, borderTopColor: theme.ringLit, borderTopWidth: MINI.ringStroke },
          ]}
        >
          <RemoteIcon name="up" size={MINI_ARROW} color={theme.muted} />
          <View style={styles.miniMid}>
            <RemoteIcon name="left" size={MINI_ARROW} color={theme.muted} />
            <View style={[styles.miniOk, { width: k.size, height: k.size, borderRadius: k.radius, borderWidth: k.border, backgroundColor: theme.accent, borderColor: theme.accentSoft, shadowColor: theme.keyEdge }]}>
              <OkBevel g={MINI} theme={theme} />
              <Text tight style={[styles.miniOkText, { color: theme.accentInk, fontSize: MINI.label.fontSize }]} allowFontScaling={false}>
                {t('ui.common.ok')}
              </Text>
            </View>
            <RemoteIcon name="right" size={MINI_ARROW} color={theme.muted} />
          </View>
          <RemoteIcon name="down" size={MINI_ARROW} color={theme.muted} />
        </View>
      </NeverMirror>
      <View style={styles.miniRow}>
        {NAV_ROW.slice(0, 3).map((c) => (
          <View key={c.key} style={keyStyle}>
            <MiniIcon k={c.key} color={theme.ink} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginHorizontal: list.inset, paddingHorizontal: list.rowPadding, marginTop: space.sm, marginBottom: space.lg },
  previewCard: { marginHorizontal: list.inset, marginBottom: list.groupGap, overflow: 'hidden' },
  stage: { paddingVertical: space.xl, alignItems: 'center' },
  card: { marginHorizontal: list.inset, marginTop: -space.sm, marginBottom: list.groupGap },
  banner: { gap: space.xs, marginBottom: space.xs },
  bottom: { marginHorizontal: list.inset, gap: space.md },
  swatch: { width: list.icon, height: list.icon, borderRadius: radii.sm - 3, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  mini: { width: 220, borderRadius: radius.panel + 8, padding: 16, gap: 14 },
  miniRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniKey: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center', ...elevation.key },
  center: { alignItems: 'center' },
  miniPad: { alignItems: 'center', justifyContent: 'space-evenly', ...elevation.key },
  miniMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', alignSelf: 'stretch' },
  miniOk: { alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.45, shadowRadius: 4, elevation: 4 },
  miniOkText: { fontFamily: fonts.displayBold },
});
