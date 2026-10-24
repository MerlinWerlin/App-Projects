// Live Lock Screen card (T135): the continuous loop on iOS 26+ full builds.
// "Start on Lock Screen" exports the loop at 3:4 and starts a silent Now Playing item whose
// animated artwork is the loop; the iOS 26 Lock Screen shows it full screen behind the clock.
// While it runs: three numbered steps, honest notes and a Stop button.
//
// Everywhere else (iOS < 26, Expo Go, Android, a build without the module) this card shows at most
// a one-line notice, and the Live Photo guide (src/ui/LivePhotoGuide.tsx) stays the flow.
// Decisions and English copy: src/core/liveLockView.ts (tested). Native calls go only through the
// adapter src/native/livelock.ts (requireOptionalNativeModule, never throws when unavailable).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { LoopProject } from '../core/loop';
import { liveLockView, type LoopNotice, type LoopNoteId, type LoopStepId, type LoopStatus } from '../core/liveLockView';
import { IDLE_STATE, livelock, type LivelockAvailability, type LivelockState } from '../native/livelock';
import { useT, type TFunction } from '../i18n';
import { continuous, radiusV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';

/** The adapter's availability (null while checking). Never throws. */
export function useLoopAvailability(): LivelockAvailability | null {
  const [a, setA] = useState<LivelockAvailability | null>(null);
  useEffect(() => {
    let alive = true;
    livelock
      .isAvailable()
      .then((v) => {
        if (alive) setA(v);
      })
      .catch(() => {
        if (alive) setA({ available: false, reason: 'not-built' });
      });
    return () => {
      alive = false;
    };
  }, []);
  return a;
}

/** Live state of the native session: initial getState() plus onState events. */
function useLoopState(enabled: boolean): [LivelockState, () => void] {
  const [s, setS] = useState<LivelockState>(IDLE_STATE);
  const refresh = useCallback(() => {
    livelock
      .getState()
      .then(setS)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const off = livelock.addStateListener(setS);
    return off;
  }, [enabled, refresh]);
  return [s, refresh];
}

function stepText(t: TFunction, id: LoopStepId): string {
  if (id === 'lock') return t('liveUi.loop.stepLock');
  if (id === 'wake') return t('liveUi.loop.stepWake');
  return t('liveUi.loop.stepTap');
}

function noteText(t: TFunction, id: LoopNoteId): string {
  if (id === 'ios') return t('liveUi.loop.noteIos');
  if (id === 'controls') return t('liveUi.loop.noteControls');
  if (id === 'stops') return t('liveUi.loop.noteStops');
  if (id === 'still') return t('liveUi.loop.noteStill');
  return t('liveUi.loop.noteBattery');
}

function noticeText(t: TFunction, n: LoopNotice): string {
  switch (n) {
    case 'static-artwork':
      return t('liveUi.loop.staticArtwork');
    case 'interrupted':
      return t('liveUi.loop.interrupted');
    case 'paused':
      return t('liveUi.loop.pausedNote');
    case 'low-power':
      return t('liveUi.loop.lowPower');
    case 'stopped':
      return t('liveUi.loop.stopped');
    case 'failed':
      return t('liveUi.loop.failed');
    default:
      return '';
  }
}

type Props = {
  /** The loop this card starts (null: no loop yet). */
  project: Pick<LoopProject, 'id' | 'name'> | null;
  /** The full project at tap time (the editor passes its latest in-memory edits). */
  getProject: () => LoopProject | null;
  /** Called on tap before anything else (the editor flushes pending edits here). */
  onBeforeStart?: () => void;
  /** Name of a loop by id, to label the running loop when it isn't `project`. */
  nameOf?: (id: string) => string | undefined;
};

export function LiveLockCard({ project, getProject, onBeforeStart, nameOf }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const availability = useLoopAvailability();
  const enabled = availability?.available === true;
  const [native, refresh] = useLoopState(enabled);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const status: LoopStatus = startFailed && native.state !== 'error' && native.state !== 'playing' && native.state !== 'paused'
    ? { state: 'error', prepared: 0, total: 0, reason: 'failed' }
    : native;
  const view = liveLockView({ availability, status, projectId: project?.id ?? null, starting });

  const onStart = async () => {
    if (starting) return;
    try {
      onBeforeStart?.();
    } catch {
      // Saving edits is best effort; the loop uses the in-memory project anyway.
    }
    const p = getProject();
    if (!p) return;
    setStarting(true);
    setStartFailed(false);
    try {
      const ok = await livelock.start([p]);
      haptic(ok ? 'success' : 'warning');
      if (!ok) setStartFailed(true);
    } catch {
      haptic('warning');
      setStartFailed(true);
    } finally {
      setStarting(false);
      refresh();
    }
  };

  const onStop = async () => {
    setStartFailed(false);
    await livelock.stop();
    refresh();
  };

  if (view.mode === 'checking') return null;

  if (view.mode === 'live-photo') {
    if (!view.fallback) return null;
    return (
      <View style={[styles.notice, continuous, { backgroundColor: c.tintSoft }]}>
        <Text style={[...ts('subhead'), { color: c.onTintSoft }]}>
          {view.fallback === 'needs-ios26' ? t('liveUi.loop.needsIos26') : t('liveUi.loop.notBuilt')}
        </Text>
      </View>
    );
  }

  const runningName = native.projectId ? nameOf?.(native.projectId) : undefined;
  const shownName = view.runningOther ? runningName : project?.name ?? runningName;
  const running = view.phase === 'playing' || view.phase === 'paused';
  const notice = noticeText(t, view.notice);

  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
      <Text accessibilityRole="header" style={[...ts('headline'), { color: c.ink }]}>
        {t('liveUi.loop.title')}
      </Text>
      {shownName ? (
        <Text style={[...ts('subhead'), { color: c.inkSecondary }]} numberOfLines={2}>
          {t('liveUi.loop.forLoop', { name: shownName })}
        </Text>
      ) : null}
      <Text style={[...ts('body'), { color: c.inkSecondary }]}>{t('liveUi.loop.intro')}</Text>

      {notice ? (
        <View style={[styles.notice, continuous, { backgroundColor: c.tintSoft }]} accessibilityLiveRegion="polite">
          <Text style={[...ts('subhead'), { color: c.onTintSoft }]}>{notice}</Text>
        </View>
      ) : null}

      {view.phase === 'preparing' ? (
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.tint} />
          <Text style={[...ts('subhead'), styles.flex1, { color: c.ink }]}>
            {view.progress && view.progress.total > 1
              ? t('liveUi.lock.preparingMany', { current: String(view.progress.done + 1), total: String(view.progress.total) })
              : t('liveUi.loop.preparing')}
          </Text>
        </View>
      ) : null}

      {running ? (
        <>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <View style={[styles.dot, { backgroundColor: view.phase === 'playing' ? c.ok : c.warn }]} />
            <Text style={[...ts('headline'), styles.flex1, { color: c.ink }]}>
              {view.phase === 'playing' ? t('liveUi.loop.running') : t('liveUi.loop.paused')}
            </Text>
          </View>
          <View style={styles.steps}>
            {view.steps.map((id, i) => {
              const text = stepText(t, id);
              return (
                <View
                  key={id}
                  style={styles.step}
                  accessible
                  accessibilityLabel={t('liveUi.loop.stepA11y', { n: String(i + 1), text })}
                >
                  <View style={[styles.num, { backgroundColor: c.tint }]}>
                    <Text style={[...ts('footnote'), styles.numText, { color: c.onTint }]}>{i + 1}</Text>
                  </View>
                  <Text style={[...ts('body'), styles.flex1, { color: c.ink }]}>{text}</Text>
                </View>
              );
            })}
          </View>
          {view.runningOther ? (
            <Text style={[...ts('subhead'), { color: c.inkSecondary }]}>{t('liveUi.loop.runningOther')}</Text>
          ) : null}
        </>
      ) : null}

      {view.canStart && !running ? (
        <PillButton
          label={t('liveUi.loop.start')}
          icon="lock"
          block
          busy={starting}
          disabled={starting}
          accessibilityHint={t('liveUi.loop.startHint')}
          onPress={() => void onStart()}
        />
      ) : null}
      {view.canStart && running && view.runningOther ? (
        <PillButton
          label={t('liveUi.loop.startOther')}
          icon="repeat"
          variant="tinted"
          block
          disabled={starting}
          accessibilityHint={t('liveUi.loop.startHint')}
          onPress={() => void onStart()}
        />
      ) : null}
      {!project && !running && view.phase !== 'preparing' ? (
        <Text style={[...ts('subhead'), { color: c.inkSecondary }]}>{t('liveUi.loop.needsLoop')}</Text>
      ) : null}
      {view.showStop ? (
        <PillButton
          label={t('liveUi.loop.stop')}
          icon="square"
          variant={running ? 'filled' : 'tinted'}
          block
          accessibilityLabel={t('liveUi.lock.stop')}
          accessibilityHint={t('liveUi.loop.stopHint')}
          onPress={() => void onStop()}
        />
      ) : null}

      <View style={[styles.notes, { borderColor: c.separator }]}>
        {view.notes.map((id) => (
          <Text key={id} style={[...ts('footnote'), { color: c.inkSecondary }]}>
            {`• ${noteText(t, id)}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.group, padding: spaceV2.lg, gap: spaceV2.sm },
  notice: { borderRadius: radiusV2.card, padding: spaceV2.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, minHeight: 32 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  steps: { gap: spaceV2.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.sm },
  num: { minWidth: 24, minHeight: 24, borderRadius: 12, paddingHorizontal: spaceV2.xs, alignItems: 'center', justifyContent: 'center' },
  numText: { fontWeight: '600' },
  notes: { gap: spaceV2.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spaceV2.sm, marginTop: spaceV2.xs },
  flex1: { flex: 1 },
});
