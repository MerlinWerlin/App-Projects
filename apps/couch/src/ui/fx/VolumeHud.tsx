import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../Text';
import { RemoteIcon } from '../icons/RemoteIcon';
import { duration, spring } from '../../theme/motion';
import { elevation, fonts, tabular } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { onFx } from './bus';
import { HIDDEN, HudController, type HudView } from './hud';

/**
 * Floating volume HUD (premium polish P2, T39). Listens to 'volume' fx events (src/ui/fx/bus.ts),
 * springs in (scale 0.9 -> 1 + fade), shows a speaker icon, the level (tabular figures) or the
 * step direction / "Muted", and a bar; fades out ~1.1 s after the last event (src/ui/fx/hud.ts).
 * Absolutely positioned at the top centre of its parent, below the status bar / Dynamic Island
 * (safe-area top inset + 8 pt, fb-1022d), never takes touches.
 * Reduce Motion: fade only. Mounted once by the remote screen.
 */
export function VolumeHud() {
  const t = useRemoteTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [view, setView] = useState<HudView>(HIDDEN);
  const [mounted, setMounted] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const c = new HudController(setView);
    const off = onFx((e) => {
      if (e.type === 'volume') c.push({ step: e.step, level: e.level });
    });
    return () => {
      off();
      c.dispose();
    };
  }, []);

  useEffect(() => {
    if (view.visible) {
      setMounted(true);
      Animated.timing(opacity, { toValue: 1, duration: duration.fast, useNativeDriver: true }).start();
      if (reduce) scale.setValue(1);
      else Animated.spring(scale, { toValue: 1, ...spring, useNativeDriver: true }).start();
      return;
    }
    if (view.seq === 0) return;
    let alive = true;
    Animated.timing(opacity, { toValue: 0, duration: duration.slow, useNativeDriver: true }).start(({ finished }) => {
      if (!finished || !alive) return;
      scale.setValue(reduce ? 1 : 0.9);
      setMounted(false);
    });
    return () => {
      alive = false;
    };
  }, [view.visible, view.seq, reduce, opacity, scale]);

  if (!mounted && !view.visible) return null;

  const pct = Math.round(Math.max(0, Math.min(1, view.fraction)) * 100);
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={view.label}
        style={[
          styles.hud,
          { backgroundColor: t.body, shadowColor: t.keyEdge, borderColor: t.keyEdge },
          { opacity, transform: [{ scale }] },
        ]}
      >
        <RemoteIcon name={view.icon} size={20} color={t.ink} />
        <View style={[styles.track, { backgroundColor: t.accentSoft }]}>
          <View
            style={[
              styles.fill,
              { width: `${pct}%` as const, backgroundColor: view.known ? t.accent : t.muted },
            ]}
          />
        </View>
        {view.valueIcon ? (
          <View style={styles.valueIcon}>
            <RemoteIcon name={view.valueIcon} size={18} color={t.ink} />
          </View>
        ) : (
          <Text style={[styles.value, tabular, { color: t.ink }]} allowFontScaling={false} numberOfLines={1}>
            {view.value}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 12, start: 0, end: 0, alignItems: 'center', zIndex: 20 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.hud,
  },
  valueIcon: { minWidth: 44, alignItems: 'flex-end' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', minWidth: 90 },
  fill: { height: 6, borderRadius: 3 },
  value: { fontFamily: fonts.textBold, fontSize: 15, minWidth: 44, textAlign: 'right' },
});
