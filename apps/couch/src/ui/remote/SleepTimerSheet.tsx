import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Key } from '../../core/keys';
import { SLEEP_PRESETS, sleepRemainingParts, SleepTimer, type SleepPreset, type SleepSnapshot } from '../../core/sleepTimer';
import { MemoryKv } from '../../core/store';
import { t as translate } from '../../i18n/core';
import { useT } from '../../i18n/react';
import { loadPersistentKv } from '../../native/kv';
import { useSession } from '../../state/session';
import { fonts, minTarget, radius, tabular } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { RemoteIcon } from '../icons/RemoteIcon';
import { PressableScale } from '../motion/PressableScale';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { gridCellWidth, gridColumns, sheetContentWidth } from '../../core/textScale';

/**
 * Sleep timer (T72): a pill under the remote opens this sheet; pick 15 / 30 / 45 / 60 / 90 minutes
 * or Off. Logic lives in src/core/sleepTimer.ts; this file only binds it to the app (one shared
 * timer, AsyncStorage, AppState, the session's sendKey). Free like every TV control: no Plus check.
 */

/** The key sender of the latest mounted remote (the session can be replaced by demo mode). */
let sendKey: ((key: Key) => unknown) | null = null;
let shared: SleepTimer | null = null;

/** The app's one sleep timer: created on first use, persisted, follows foreground / background. */
function sleepTimer(): SleepTimer {
  if (shared) return shared;
  const timer = new SleepTimer({
    kv: loadPersistentKv() ?? new MemoryKv(),
    send: (key) => sendKey?.(key),
    active: AppState.currentState !== 'background',
  });
  // 'inactive' (iOS app switcher, notification shade) still runs JS, so only 'background' pauses.
  AppState.addEventListener('change', (s) => timer.setActive(s !== 'background'));
  void timer.load();
  shared = timer;
  return timer;
}

/** The shared sleep timer, its snapshot and the remaining time (re-rendered every second while it runs). */
export function useSleepTimer(): { timer: SleepTimer; snap: SleepSnapshot; remainingMs: number | null } {
  const { session } = useSession();
  const timer = sleepTimer();
  useEffect(() => {
    sendKey = (key) => session.sendKey(key);
  }, [session]);
  const subscribe = useCallback((cb: () => void) => timer.subscribe(cb), [timer]);
  const getSnapshot = useCallback(() => timer.getSnapshot(), [timer]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (snap.endsAt === null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [snap.endsAt]);
  return { timer, snap, remainingMs: timer.remainingMs() };
}

/** "TV off in 42 minutes" / "TV off in 30 seconds", numbers formatted for the language (Intl). */
export function sleepRemainingText(ms: number): string {
  const p = sleepRemainingParts(ms);
  return translate(p.unit === 'minutes' ? 'ui.sleep.remainingMinutes' : 'ui.sleep.remainingSeconds', { count: p.count });
}

/**
 * The pill under the remote: timer icon + "Sleep timer" (or the time left), and a one-off notice
 * after the timer fired or was dropped. `ink` is the stage text colour (AA over the stage).
 */
export function SleepTimerChip({ onOpen, ink }: { onOpen: () => void; ink: string }) {
  const th = useRemoteTheme();
  const tr = useT();
  const { timer, snap, remainingMs } = useSleepTimer();
  const label = remainingMs === null ? tr('ui.sleep.title') : sleepRemainingText(remainingMs);
  const notice = snap.notice ? tr(snap.notice.kind === 'fired' ? 'ui.sleep.fired' : 'ui.sleep.missed') : null;
  return (
    <View style={styles.chipWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={tr('ui.sleep.openHint')}
        haptic="light"
        hitSlop={4}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: pressed ? th.accentSoft : th.key, shadowColor: th.keyEdge },
        ]}
      >
        <RemoteIcon name="timer" size={18} color={remainingMs === null ? th.ink : th.accent} />
        <Text scaleRole="label" style={[styles.chipText, tabular, { color: th.ink }]}>
          {label}
        </Text>
      </PressableScale>
      {notice ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={notice}
          accessibilityHint={tr('ui.sleep.dismiss')}
          accessibilityLiveRegion="polite"
          haptic="none"
          onPress={() => timer.dismissNotice()}
          style={styles.notice}
        >
          <Text scaleRole="body" style={[styles.noticeText, { color: ink }]}>
            {notice}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export interface SleepTimerSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Bottom sheet with the presets (and Off), showing the time left. Opened like NumpadSheet. */
export function SleepTimerSheet({ visible, onClose }: SleepTimerSheetProps) {
  const t = useRemoteTheme();
  const tr = useT();
  const { timer, snap, remainingMs } = useSleepTimer();
  const choose = (m: SleepPreset | null) => {
    if (m === null) void timer.cancel();
    else void timer.start(m);
    onClose();
  };
  const options: Array<{ value: SleepPreset | null; label: string }> = [
    { value: null, label: tr('ui.sleep.off') },
    ...SLEEP_PRESETS.map((m) => ({ value: m, label: tr('ui.sleep.preset', { count: m }) })),
  ];
  // Larger Text (T74): 3 columns, then 2, then 1 as the scaled labels stop fitting (words never break).
  const win = useWindowDimensions();
  const columns = gridColumns(
    sheetContentWidth(win.width),
    3,
    options.map((o) => o.label),
    { fontSize: 15, fontScale: win.fontScale, role: 'label', padH: 6, gap: 10, wrap: true },
  );
  const cellStyle = { width: gridCellWidth(columns) };
  return (
    <Sheet
      palette={t}
      visible={visible}
      onClose={onClose}
      title={tr('ui.sleep.title')}
      accessibilityLabel={tr('ui.sleep.title')}
      closeLabel={tr('ui.common.close')}
    >
      <Text scaleRole="title" style={[styles.remaining, tabular, { color: t.ink }]} accessibilityLiveRegion="polite">
        {remainingMs === null ? tr('ui.sleep.off') : sleepRemainingText(remainingMs)}
      </Text>
      <View style={styles.grid}>
        {options.map((o) => {
          const on = o.value === snap.minutes;
          return (
            <View key={o.value ?? 'off'} style={cellStyle}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: on }}
                haptic="selection"
                onPress={() => choose(o.value)}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: on ? t.accent : pressed ? t.accentSoft : t.key, shadowColor: t.keyEdge },
                ]}
              >
                <Text scaleRole="label" style={[styles.optionText, tabular, { color: on ? t.accentInk : t.ink }]}>
                  {o.label}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </View>
      <Text scaleRole="body" style={[styles.note, { color: t.muted }]}>
        {tr('ui.sleep.intro')}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chipWrap: { alignItems: 'center', gap: 6, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: minTarget,
    paddingHorizontal: 16,
    paddingVertical: 6,
    maxWidth: '100%',
    borderRadius: 99,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 2,
  },
  chipText: { fontFamily: fonts.textSemi, fontSize: 14, flexShrink: 1 },
  notice: { minHeight: minTarget, justifyContent: 'center', paddingHorizontal: 8 },
  noticeText: { fontFamily: fonts.text, fontSize: 13, textAlign: 'center' },
  remaining: { fontFamily: fonts.display, fontSize: 20, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  option: {
    minHeight: 52,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 2,
  },
  optionText: { fontFamily: fonts.textSemi, fontSize: 15, textAlign: 'center' },
  note: { fontFamily: fonts.text, fontSize: 13 },
});
