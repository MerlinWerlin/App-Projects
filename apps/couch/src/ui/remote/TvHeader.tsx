import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../Text';
import { RemoteIcon } from '../icons/RemoteIcon';
import type { ConnectionState, Tv } from '../../core/types';
import { duration, easeOut } from '../../theme/motion';
import { fonts, radius, tabular } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { pillVisual } from '../fx/connection';
import { StatusPill, useConnectionStatus } from '../fx/StatusPill';
import { useT } from '../../i18n/react';
import { useSession } from '../../state/session';
import { formatLatency } from './controls';
import { maxLines, roleCap } from '../../core/textScale';

/**
 * The active TV's name; when the TV changes the old name fades out while the new one fades in
 * (duration.base, native driver). Keyed on the TV id, so a rename just updates the text.
 */
function CrossFadeName({ id, name, color }: { id: string | null; name: string; color: string }) {
  const [prev, setPrev] = useState<{ id: string | null; name: string } | null>(null);
  const last = useRef<{ id: string | null; name: string }>({ id, name });
  const fade = useRef(new Animated.Value(1)).current;

  useLayoutEffect(() => {
    const before = last.current;
    if (before.id === id) return;
    setPrev(before);
    fade.setValue(0);
    const anim = Animated.timing(fade, { toValue: 1, duration: duration.base, easing: Easing.bezier(...easeOut), useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) setPrev(null);
    });
    return () => anim.stop();
    // Only a TV change cross-fades; a rename just updates the text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // After the effect above, so it still sees the previous TV.
  useLayoutEffect(() => {
    last.current = { id, name };
  });

  const outOpacity = fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  // Larger Text (T74): one line at default sizes, wrapping to more lines as the text grows.
  const lines = maxLines(useWindowDimensions().fontScale);
  return (
    <View>
      {prev ? (
        <Animated.Text
          key={`out-${prev.id ?? 'none'}`}
          style={[styles.nm, styles.out, { color, opacity: outOpacity }]}
          numberOfLines={lines}
          maxFontSizeMultiplier={roleCap('title')}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {prev.name}
        </Animated.Text>
      ) : null}
      <Animated.Text key={`in-${id ?? 'none'}`} style={[styles.nm, { color, opacity: fade }]}
        numberOfLines={lines}
        maxFontSizeMultiplier={roleCap('title')}
      >
        {name}
      </Animated.Text>
    </View>
  );
}

/** Active TV bar (prototype .tvbar): LED (animated status dot), name, model + status, latency in mono, switcher chevron. */
export function TvHeader({
  tv,
  state,
  lastMs,
  onPress,
}: {
  tv: Tv | null;
  state: ConnectionState | null;
  lastMs: number | null;
  onPress: () => void;
}) {
  const t = useRemoteTheme();
  const tr = useT();
  // T70: while a reconnect run is in progress the pill pulses amber and says "Reconnecting…",
  // whatever the driver reports between attempts (no error flashes, no toast per attempt).
  const reconnecting = useSession().snap.reconnecting && tv !== null;
  // Demo (mock) drivers connect before the session loads and never report it.
  const { status, pops } = useConnectionStatus(tv?.id ?? null, reconnecting ? 'connecting' : state, tv?.platform === 'mock');
  const v = pillVisual(status);
  const statusLabel = reconnecting ? tr('ui.remote.reconnecting') : v.label;
  const name = tv?.name ?? tr('ui.remote.noTv');
  const subLines = maxLines(useWindowDimensions().fontScale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tv ? tr('ui.remote.switchTv', { name: tv.name }) : tr('ui.remote.addTv')}
      onPress={onPress}
      style={({ pressed }) => [styles.bar, { backgroundColor: pressed ? t.accentSoft : t.body }]}
    >
      <StatusPill status={status} pops={pops} />
      <View style={styles.text}>
        <CrossFadeName id={tv?.id ?? null} name={name} color={t.ink} />
        <Text
          scaleRole="caption"
          style={[styles.sub, { color: t.muted }]}
          numberOfLines={subLines}
          accessibilityLiveRegion="polite"
        >
          {tv ? tr('ui.remote.modelStatus', { model: tv.model, status: statusLabel }) : tr('ui.remote.pickTv')}
        </Text>
      </View>
      <Text scaleRole="meta" style={[styles.ms, { color: t.muted }]} accessibilityLabel={lastMs === null ? tr('ui.remote.noLatency') : tr('ui.remote.latencyLabel', { ms: String(Math.round(lastMs)) })}
      >
        {tv && v.live ? formatLatency(lastMs) : '—'}
      </Text>
      {/* Switcher affordance: the bar opens the TV list (or Add TV). Decorative; the bar is labelled. */}
      <RemoteIcon name={tv ? 'down' : 'plus'} size={16} color={t.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.panel, padding: 12, minHeight: 56 },
  text: { flex: 1, minWidth: 0 },
  nm: { fontFamily: fonts.display, fontSize: 16 },
  out: { position: 'absolute', start: 0, end: 0, top: 0 },
  sub: { fontFamily: fonts.text, fontSize: 12.5 },
  ms: { fontFamily: fonts.mono, fontSize: 12, ...tabular },
});
