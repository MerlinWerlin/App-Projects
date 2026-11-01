import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buddy, FOCUS_MINUTES } from '../src/core/game';
import { t } from '../src/i18n';
import { actions, useGame } from '../src/store/game';
import { space, type as ty, useColors } from '../src/theme/tokens';
import { useHaptics } from '../src/ui/haptics';
import { Button, Meter, formatDuration } from '../src/ui/kit';
import { PetView } from '../src/ui/PetView';

const LENGTH_MS = FOCUS_MINUTES * 60_000;

/** A 25-minute focus session. Time only counts while the app is open (honest, simple). */
export default function Focus() {
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const h = useHaptics();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    last.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      // Only count time in the foreground; a long gap means the app was away.
      const step = last.current === null ? 0 : Math.min(now - last.current, 2000);
      last.current = now;
      setElapsed((e) => e + step);
    }, 1000);
    const sub = AppState.addEventListener('change', (s) => {
      last.current = s === 'active' ? Date.now() : null;
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running]);

  useEffect(() => {
    if (running && elapsed >= LENGTH_MS) {
      setRunning(false);
      setDone(true);
      actions.focus(FOCUS_MINUTES);
      h.success();
    }
  }, [running, elapsed, h]);

  const pet = buddy(g);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: space.xl, paddingTop: space.xxl, paddingBottom: insets.bottom + space.xl, gap: space.lg, alignItems: 'center' }}>
      <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">{t('focus.title')}</Text>
      <Text style={[ty.body, { color: c.ink2, textAlign: 'center' }]}>{done ? t('focus.done') : t('focus.body')}</Text>
      {pet ? <PetView pet={pet} size={200} mood={running ? 'sleepy' : done ? 'joyful' : 'happy'} animate /> : <View style={{ height: 200 }} />}
      <Text style={[ty.title, { color: c.ink, fontVariant: ['tabular-nums'] }]} accessibilityLiveRegion="polite">
        {t('focus.left', { time: formatDuration(LENGTH_MS - elapsed) })}
      </Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Meter value={elapsed / LENGTH_MS} color={c.accent} track={c.meterTrack} />
      </View>
      <Text style={[ty.small, { color: c.ink3 }]}>{t('focus.leaveWarning')}</Text>
      <View style={{ flex: 1 }} />
      <View style={{ alignSelf: 'stretch', gap: space.sm }}>
        {done ? (
          <Button label={t('focus.close')} onPress={() => router.back()} />
        ) : running ? (
          <Button kind="soft" label={t('focus.stop')} onPress={() => { setRunning(false); setElapsed(0); }} />
        ) : (
          <Button label={t('focus.start')} onPress={() => { setElapsed(0); setRunning(true); }} />
        )}
      </View>
    </View>
  );
}
