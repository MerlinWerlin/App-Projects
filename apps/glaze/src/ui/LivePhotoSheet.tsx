// "Save as Live Photo" for the Live editor (T11): the button, the save flow and a sheet that
// explains the result (how to set it as a wallpaper, permission denied, needs the full build).
// T127: this is THE Live Lock Screen action now (primary pill). The "saved" sheet shows the same
// three illustrated steps as the editor's guide; Expo Go / builds without the module explain
// that Live Photo saving needs the TestFlight app and point to Save to Photos.
import { useState } from 'react';
import { Dimensions, Linking, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { deviceForScreen, type LoopProject } from '../core/loop';
import { livephoto, livePhotoProblem, type LivePhotoReason } from '../native/livephoto';
import { GUIDE_STEPS } from '../core/liveSteps';
import { LivePhotoGuideSteps } from './LivePhotoGuide';
import { localizedStep } from './liveContext';
import { useT, type TFunction } from '../i18n';
import { continuous, radiusV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { Sheet } from './Sheet';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';

export type LivePhotoSheetState =
  | { kind: 'saved' }
  | { kind: 'denied' }
  | { kind: 'unavailable'; reason: LivePhotoReason }
  | { kind: 'gif' }
  | { kind: 'too-short' }
  | { kind: 'failed' };

function why(t: TFunction, reason: Exclude<LivePhotoReason, null>): string {
  if (reason === 'expo-go') return t('liveUi.guide.needsFull');
  if (reason === 'android') return t('liveUi.livePhoto.whyAndroid');
  return t('liveUi.guide.needsBuild');
}

function cameraSteps(t: TFunction): string[] {
  return [
    t('liveUi.livePhoto.cameraTake'),
    t('liveUi.openAndPick', { path: t('liveUi.wallpaperPath') }),
    t('liveUi.tapLivePhoto'),
  ];
}

/** The guide's three steps in the app language (same keys as liveContext.localizedGuide). */
function guideSteps(t: TFunction) {
  return GUIDE_STEPS.map((s) => localizedStep(t, s.id));
}

/** Self-contained button + sheet. `getProject` returns the latest edits at tap time. */
type SaveAsLivePhotoButtonProps = {
  /** Latest edits at tap time. */
  getProject: () => LoopProject;
  /** Called on tap before anything else (the editor flushes its pending edits here). */
  onBeforeSave?: () => void;
};

export function SaveAsLivePhotoButton({ getProject, onBeforeSave }: SaveAsLivePhotoButtonProps) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<LivePhotoSheetState | null>(null);

  const onPress = async () => {
    if (busy) return;
    haptic('select');
    try {
      onBeforeSave?.();
    } catch {
      // Saving edits is best effort; the Live Photo uses the in-memory project anyway.
    }
    const project = getProject();
    const s = Dimensions.get('screen');
    const device = deviceForScreen(s.width, s.height);
    const status = await livephoto.isAvailable();
    if (!status.available) {
      haptic('warning');
      setState({ kind: 'unavailable', reason: status.reason });
      return;
    }
    const problem = livePhotoProblem(project, device);
    if (problem === 'gif' || problem === 'too-short') {
      haptic('warning');
      setState({ kind: problem });
      return;
    }
    setBusy(true);
    const outcome = await livephoto.save(project, device);
    setBusy(false);
    haptic(outcome === 'saved' ? 'success' : 'warning');
    if (outcome === 'saved') setState({ kind: 'saved' });
    else if (outcome === 'denied') setState({ kind: 'denied' });
    else if (outcome === 'unavailable') setState({ kind: 'unavailable', reason: 'not-built' });
    else setState({ kind: 'failed' });
  };

  return (
    <>
      <PillButton
        label={busy ? t('liveUi.livePhoto.saving') : t('liveUi.livePhoto.button')}
        icon="aperture"
        busy={busy}
        block
        accessibilityHint={t('liveUi.livePhoto.hint')}
        onPress={() => void onPress()}
      />
      <LivePhotoSheet state={state} onClose={() => setState(null)} />
    </>
  );
}

type LivePhotoSheetProps = {
  state: LivePhotoSheetState | null;
  onClose: () => void;
};

/** Design v2 (T56): system type, tint-soft result card, tint step numbers, pill actions. */
export function LivePhotoSheet({ state, onClose }: LivePhotoSheetProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const type = { body: ts('body'), heading: ts('headline'), label: ts('headline') };
  const s = state ?? { kind: 'saved' as const };
  const title = s.kind === 'saved' ? t('liveUi.savedToPhotos') : t('liveUi.livePhoto.title');

  let message: string;
  let steps: string[] = [];
  let stepsTitle = '';
  switch (s.kind) {
    case 'saved':
      message = t('liveUi.livePhoto.msgSaved');
      stepsTitle = t('liveUi.livePhoto.setTitle');
      break;
    case 'denied':
      message = t('liveUi.livePhoto.msgDenied');
      break;
    case 'unavailable':
      message = why(t, s.reason ?? 'not-built');
      steps = cameraSteps(t);
      stepsTitle = t('liveUi.livePhoto.cameraTitle');
      break;
    case 'gif':
      message = t('liveUi.livePhoto.msgGif');
      break;
    case 'too-short':
      message = t('liveUi.livePhoto.msgTooShort');
      break;
    default:
      message = t('liveUi.livePhoto.msgFailed');
  }

  return (
    <Sheet visible={state !== null} onClose={onClose} title={title}>
      <View style={[styles.note, continuous, { backgroundColor: c.tintSoft }]}>
        <Text style={[...type.label, { color: c.onTintSoft }]}>{message}</Text>
      </View>
      {stepsTitle ? (
        <Text accessibilityRole="header" style={[...type.heading, { color: c.ink }]}>
          {stepsTitle}
        </Text>
      ) : null}
      {steps.map((step, i) => (
        <View key={step} style={styles.step}>
          <View style={[styles.num, { backgroundColor: c.tint }]}>
            <Text style={[...type.label, { color: c.onTint }]}>{i + 1}</Text>
          </View>
          <Text style={[...type.body, styles.stepText, { color: c.ink }]}>{step}</Text>
        </View>
      ))}
      {s.kind === 'saved' ? (
        <>
          <LivePhotoGuideSteps steps={guideSteps(t)} />
          <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('liveUi.guide.moves')}</Text>
        </>
      ) : null}
      {s.kind === 'denied' ? (
        <PillButton
          label={t('liveUi.openSettings')}
          variant="tinted"
          icon="settings"
          block
          onPress={() => {
            Linking.openSettings().catch(() => {});
          }}
        />
      ) : null}
      <PillButton label={t('liveUi.gotIt')} onPress={onClose} block />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radiusV2.card, padding: spaceV2.lg },
  step: { flexDirection: 'row', gap: spaceV2.md, alignItems: 'flex-start' },
  num: { minWidth: 28, minHeight: 28, borderRadius: 14, paddingHorizontal: spaceV2.xs, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1 },
});
