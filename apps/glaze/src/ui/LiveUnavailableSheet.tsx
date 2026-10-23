import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { LoopProject } from '../core/loop';
import {
  IDLE_STATE,
  isLivelockRunning,
  livelock,
  type LivelockReason,
  type LivelockState,
} from '../native/livelock';
import { t, useT, type TFunction } from '../i18n';
import type { Script } from '../core/i18n';
import { continuous, radiusV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { Sheet } from './Sheet';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';

/** v2 system type for the roles these sheets use, with the script's line-height fixes. */
function typeFor(script: Script): { body: TextStyle[]; heading: TextStyle[]; label: TextStyle[]; small: TextStyle[] } {
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  return { body: ts('body'), heading: ts('headline'), label: ts('headline'), small: ts('footnote') };
}

function why(tf: TFunction, reason: Exclude<LivelockReason, null>): string {
  if (reason === 'expo-go') return tf('liveUi.lock.whyExpoGo');
  if (reason === 'ios-version') return tf('liveUi.lock.whyIos');
  if (reason === 'android') return tf('liveUi.lock.whyAndroid');
  return tf('liveUi.lock.whyNotBuilt');
}

function stopgapSteps(tf: TFunction): string[] {
  return [
    tf('liveUi.lock.stepSave'),
    tf('liveUi.openAndPick', { path: tf('liveUi.wallpaperPath') }),
    tf('liveUi.tapLivePhoto'),
  ];
}

/**
 * Set loops on the Lock Screen, or explain why it can't happen here.
 * Resolves true once Live Lock Screen is running.
 */
export async function setOnLockScreen(
  projects: LoopProject[],
  showUnavailable: (reason: LivelockReason) => void,
): Promise<boolean> {
  const status = await livelock.isAvailable();
  if (!status.available) {
    haptic('warning');
    showUnavailable(status.reason);
    return false;
  }
  try {
    const started = await livelock.start(projects);
    if (!started) return false;
    haptic('success');
    Alert.alert(t('liveUi.lock.startedTitle'), t('liveUi.lock.startedBody'));
    return true;
  } catch {
    Alert.alert(t('liveUi.lock.failedTitle'), t('liveUi.lock.failedBody'));
    return false;
  }
}

/** Switch Live Lock Screen off (never throws). */
export async function stopLockScreen(): Promise<void> {
  haptic('select');
  await livelock.stop();
}

/** Live Lock Screen state, kept up to date from the native module (always idle in Expo Go). */
export function useLivelockState(): LivelockState {
  const [state, setState] = useState<LivelockState>(IDLE_STATE);
  useEffect(() => {
    let alive = true;
    livelock.getState().then((s) => {
      if (alive) setState(s);
    });
    const off = livelock.addStateListener((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

function runningText(tf: TFunction, s: LivelockState): string {
  if (s.state === 'preparing') {
    return s.total > 1
      ? tf('liveUi.lock.preparingMany', { current: String(Math.min(s.prepared + 1, s.total)), total: String(s.total) })
      : tf('liveUi.lock.preparingOne');
  }
  const many = s.count > 1;
  if (s.state === 'paused') {
    return many ? tf('liveUi.lock.pausedMany', { index: String(s.index + 1), total: String(s.count) }) : tf('liveUi.lock.paused');
  }
  return many ? tf('liveUi.lock.onNowMany', { index: String(s.index + 1), total: String(s.count) }) : tf('liveUi.lock.onNow');
}

/** Running state with a Stop button; renders nothing unless Live Lock Screen is running. */
type LivelockRunningCardProps = {
  state: LivelockState;
};

export function LivelockRunningCard({ state }: LivelockRunningCardProps) {
  const { c } = useColorsV2();
  const { t: tf, script } = useT();
  const type = typeFor(script);
  if (!isLivelockRunning(state)) return null;
  return (
    <View
      style={[styles.note, styles.running, continuous, { backgroundColor: c.surface }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.runningRow}>
        {state.state === 'preparing' ? <ActivityIndicator color={c.tint} /> : null}
        <Text style={[...type.label, styles.stepText, { color: c.ink }]}>{runningText(tf, state)}</Text>
      </View>
      {state.count > 1 && state.state !== 'preparing' ? ( // i18n-ignore (generic/comparison, not text)
        <PillButton
          label={tf('liveUi.lock.nextLoop')}
          variant="tinted"
          icon="skip-forward"
          block
          onPress={() => {
            haptic('select');
            livelock.next();
          }}
        />
      ) : null}
      <PillButton
        label={tf('liveUi.lock.stop')}
        variant="tinted"
        icon="square"
        block
        accessibilityHint={tf('liveUi.lock.stopHint')}
        onPress={() => {
          void stopLockScreen();
        }}
      />
    </View>
  );
}

/** Explains Live Lock Screen and the Live Photo stopgap when the native module is missing. */
type LiveUnavailableSheetProps = {
  visible: boolean;
  reason: LivelockReason;
  onClose: () => void;
};

/** Design v2 (T56): system type, tint-soft reason card, tint step numbers, filled Got it pill. */
export function LiveUnavailableSheet({ visible, reason, onClose }: LiveUnavailableSheetProps) {
  const { c } = useColorsV2();
  const { t: tf, script } = useT();
  const type = typeFor(script);
  return (
    <Sheet visible={visible} onClose={onClose} title={tf('liveUi.lock.title')}>
      <Text style={[...type.body, { color: c.ink }]}>{tf('liveUi.lock.intro')}</Text>
      <View style={[styles.note, continuous, { backgroundColor: c.tintSoft }]}>
        <Text style={[...type.label, { color: c.onTintSoft }]}>{why(tf, reason ?? 'not-built')}</Text>
      </View>
      <Text accessibilityRole="header" style={[...type.heading, { color: c.ink }]}>
        {tf('liveUi.lock.meanwhile')}
      </Text>
      {stopgapSteps(tf).map((s, i) => (
        <View key={s} style={styles.step}>
          <View style={[styles.num, { backgroundColor: c.tint }]}>
            <Text style={[...type.label, { color: c.onTint }]}>{i + 1}</Text>
          </View>
          <Text style={[...type.body, styles.stepText, { color: c.ink }]}>{s}</Text>
        </View>
      ))}
      <Text style={[...type.small, { color: c.inkSecondary }]}>
        {tf('liveUi.lock.footer')}
      </Text>
      <PillButton label={tf('liveUi.gotIt')} onPress={onClose} block />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radiusV2.card, padding: spaceV2.lg },
  running: { gap: spaceV2.sm },
  runningRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  step: { flexDirection: 'row', gap: spaceV2.md, alignItems: 'flex-start' },
  num: { minWidth: 28, minHeight: 28, borderRadius: 14, paddingHorizontal: spaceV2.xs, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1 },
});
