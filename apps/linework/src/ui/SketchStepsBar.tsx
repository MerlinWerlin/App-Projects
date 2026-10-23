// Glass bar shown on the trace screen while sketch steps are on: previous, "Step k of n — name"
// (with progress while a step's outline is made), next, and close. T91: on v2 camera glass.
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { space, touch } from '../theme/tokens';
import { cameraGlass } from './v2/CameraGlass';
import { useT } from '../i18n';
import { backChevron, forwardChevron } from '../i18n/direction';
import { CameraButton } from './v2/CameraButton';
import { CameraPill, CameraPillText } from './v2/CameraPill';
import type { SketchSteps } from './useSketchSteps';

export function SketchStepsBar({ steps }: { steps: SketchSteps }) {
  const { t, percent } = useT();
  const first = steps.step === 0;
  const last = steps.step === steps.count - 1;
  const pct = steps.progress === null ? null : percent(steps.progress);
  return (
    <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel={t('trace.steps.label')}>
      <CameraButton
        icon={backChevron()}
        label={t('trace.steps.prev')}
        accessibilityHint={t('trace.steps.prevHint')}
        disabled={first}
        onPress={steps.prev}
      />
      {steps.error ? (
        <Pressable
          onPress={steps.retry}
          accessibilityRole="button"
          accessibilityLabel={t('trace.steps.retryLabel', { error: steps.error })}
          style={({ pressed }) => [styles.press, { opacity: pressed ? 0.8 : 1 }]}
        >
          <CameraPill style={styles.pill}>
            <CameraPillText>{t('trace.steps.retry', { error: steps.error })}</CameraPillText>
          </CameraPill>
        </Pressable>
      ) : (
        <CameraPill
          style={[styles.press, styles.pill]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={pct === null ? steps.label : t('trace.steps.progressLabel', { label: steps.label, percent: pct })}
          accessibilityLiveRegion="polite"
          leading={pct !== null ? <ActivityIndicator size="small" color={cameraGlass.icon} /> : null}
        >
          <CameraPillText>
            {pct === null ? steps.label : t('trace.steps.progress', { label: steps.label, percent: pct })}
          </CameraPillText>
        </CameraPill>
      )}
      <CameraButton
        icon={forwardChevron()}
        label={t('trace.steps.next')}
        accessibilityHint={t('trace.steps.nextHint')}
        disabled={last}
        onPress={steps.next}
      />
      <CameraButton icon="x" label={t('trace.steps.turnOff')} accessibilityHint={t('trace.steps.offHint')} onPress={steps.stop} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  press: {
    flexShrink: 1,
  },
  pill: {
    minHeight: touch,
  },
});
