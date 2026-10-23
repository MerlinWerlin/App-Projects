// Timelapse UI for the trace screen (T09): record button, elapsed-time pill, and the post-recording sheet with
// clip length, speed-up note and Save to Photos (with the denied-permission path). Free for everyone.
// T91: record button, REC pill and sheet are on v2 camera glass.
import { View } from 'react-native';
import { MAX_RECORD_S, showsSheet, spedUpSeconds, suggestedSpeed } from '../core/timelapse';
import { space, touch } from '../theme/tokens';
import { useT, type I18n } from '../i18n';
import { CameraButton } from './v2/CameraButton';
import { CameraPill, CameraPillText } from './v2/CameraPill';
import { CameraSheet, CameraSheetBody } from './v2/CameraSheet';
import type { TimelapseControls } from './useTimelapse';

function split(totalS: number): { m: number; s: number } {
  const v = Math.max(0, Math.round(Number.isFinite(totalS) ? totalS : 0));
  return { m: Math.floor(v / 60), s: v % 60 };
}

/** Short visible length, e.g. "45 s", "2 min 5 s", "10 min" (numbers isolated left-to-right). */
export function shortDuration(t: I18n['t'], totalS: number): string {
  const { m, s } = split(totalS);
  const text =
    m === 0
      ? t('trace.time.shortSeconds', { count: s })
      : s === 0
        ? t('trace.time.shortMinutes', { count: m })
        : t('trace.time.shortMinutesSeconds', { minutes: m, seconds: s });
  return text;
}

/** Spoken length for screen readers, e.g. "2 minutes 5 seconds". */
export function spokenDuration(t: I18n['t'], totalS: number): string {
  const { m, s } = split(totalS);
  const mins = t('trace.time.minutes', { count: m });
  const secs = t('trace.time.seconds', { count: s });
  if (m === 0) return secs;
  return s === 0 ? mins : t('trace.time.minutesSeconds', { minutes: mins, seconds: secs });
}

/** The speed-up tip shown after recording. */
function speedUpNote(t: I18n['t'], durationS: number): string {
  const f = suggestedSpeed(durationS);
  if (f === 1) return t('trace.timelapse.noteShort');
  return t('trace.timelapse.noteSpeedUp', {
    factor: f,
    length: shortDuration(t, durationS),
    spedUp: shortDuration(t, spedUpSeconds(durationS, f)),
  });
}

const REC_RED = '#E5484D';

export function RecordButton({ rec, size = touch }: { rec: TimelapseControls; size?: number }) {
  const { t } = useT();
  const phase = rec.state.phase;
  const busy = phase !== 'idle' && phase !== 'recording';
  return (
    <CameraButton
      icon={rec.recording ? 'square' : 'video'}
      label={t(rec.recording ? 'trace.timelapse.stop' : 'trace.timelapse.record')}
      accessibilityHint={
        rec.recording
          ? t('trace.timelapse.stopHint')
          : t('trace.timelapse.recordHint', { limit: spokenDuration(t, MAX_RECORD_S) })
      }
      active={rec.recording}
      disabled={busy}
      size={size}
      onPress={rec.toggle}
    />
  );
}

/** Red "REC 1:23 / 10:00" pill shown while recording. */
export function RecordingPill({ rec, top }: { rec: TimelapseControls; top: number }) {
  const { t, duration } = useT();
  if (!rec.recording) return null;
  const stopping = rec.state.phase === 'stopping';
  // Timer digits go through duration(): locale digits, isolated left-to-right.
  const text = stopping
    ? t('trace.timelapse.finishing')
    : t('trace.timelapse.rec', { elapsed: duration(rec.elapsed), limit: duration(MAX_RECORD_S) });
  const label = stopping
    ? t('trace.timelapse.finishingLabel')
    : t('trace.timelapse.recLabel', { elapsed: spokenDuration(t, rec.elapsed), limit: spokenDuration(t, MAX_RECORD_S) });
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top, start: 0, end: 0, alignItems: 'center' }}>
      <CameraPill
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        style={{ gap: space.sm }}
        leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: REC_RED }} />}
      >
        <CameraPillText style={{ flexShrink: 0, fontVariant: ['tabular-nums'] }}>{text}</CameraPillText>
      </CameraPill>
    </View>
  );
}

type SheetAction = { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; hint?: string };

/** Bottom sheet after a recording: length, speed-up note, Save to Photos, and the permission/error states. */
export function TimelapseSheet({
  rec,
  start,
  end,
  bottom,
}: {
  rec: TimelapseControls;
  /** Inset from the leading edge (left in left-to-right languages). */
  start: number;
  end: number;
  bottom: number;
}) {
  const { t } = useT();
  const s = rec.state;
  if (!showsSheet(s.phase)) return null;

  const length = s.hitLimit
    ? t('trace.timelapse.lengthLimit', { length: shortDuration(t, s.durationS), limit: shortDuration(t, MAX_RECORD_S) })
    : t('trace.timelapse.length', { length: shortDuration(t, s.durationS) });
  const lengthLabel = s.hitLimit
    ? t('trace.timelapse.lengthLimitLabel', { length: spokenDuration(t, s.durationS), limit: spokenDuration(t, MAX_RECORD_S) })
    : t('trace.timelapse.length', { length: spokenDuration(t, s.durationS) });
  const discard: SheetAction = { label: t('trace.timelapse.discard'), onPress: rec.discard };
  let title = t('trace.timelapse.ready');
  let body: string | null = speedUpNote(t, s.durationS);
  let actions: SheetAction[] = [
    { label: t('trace.timelapse.save'), primary: true, onPress: rec.save, hint: t('trace.timelapse.saveHint') },
    discard,
  ];

  if (s.phase === 'saving') {
    actions = [{ label: t('trace.timelapse.saving'), primary: true, disabled: true, onPress: () => {} }];
  } else if (s.phase === 'saved') {
    title = t('trace.timelapse.saved');
    actions = [{ label: t('common.done'), primary: true, onPress: rec.discard }];
  } else if (s.phase === 'denied') {
    title = t('trace.timelapse.deniedTitle');
    body = t(s.canAskAgain ? 'trace.timelapse.deniedAsk' : 'trace.timelapse.deniedSettings');
    actions = s.canAskAgain
      ? [{ label: t('common.tryAgain'), primary: true, onPress: rec.save }, discard]
      : [
          { label: t('common.openSettings'), primary: true, onPress: rec.openSettings },
          { label: t('common.tryAgain'), onPress: rec.save },
          discard,
        ];
  } else if (s.phase === 'error') {
    title = t('trace.timelapse.errorTitle');
    body = s.error ?? t('trace.timelapse.errorFallback');
    actions = [{ label: t('common.tryAgain'), primary: true, onPress: rec.save }, discard];
  }

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        start,
        end,
        bottom,
        alignItems: 'center',
      }}
    >
      <CameraSheet
        icon={s.phase === 'saved' ? 'check-circle' : s.phase === 'denied' || s.phase === 'error' ? 'alert-circle' : 'film'}
        title={title}
        actions={actions.map((a) => ({ ...a, busy: !!a.disabled }))}
      >
        <CameraSheetBody strong label={lengthLabel} gap={space.sm}>
          {length}
        </CameraSheetBody>
        {body ? <CameraSheetBody>{body}</CameraSheetBody> : null}
      </CameraSheet>
    </View>
  );
}
