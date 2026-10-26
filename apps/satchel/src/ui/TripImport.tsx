// "Import a trip" on the Trips list (T15): picks a .satchel file, adds it as a new trip and opens it. Wrong,
// newer or damaged files get STATES_COPY error blocks in place; nothing already on the phone changes.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { importTrip, type ImportFailure } from '../state/tripTransfer.ts';
import { useTrips } from '../state/trips.tsx';
import { space } from '../theme/tokens.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { Body, Button, Card, Label } from './kit.tsx';

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; reason: ImportFailure };

export function TripImport() {
  const { t } = useApp();
  const { saveTrip } = useTrips();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = async () => {
    if (state.kind === 'busy') return;
    setState({ kind: 'idle' });
    const r = await importTrip(saveTrip, () => {
      setState({ kind: 'busy' });
      AccessibilityInfo.announceForAccessibility(t('loading.import.title'));
    });
    if (r.ok) {
      haptic.success();
      setState({ kind: 'idle' });
      AccessibilityInfo.announceForAccessibility(t('tripfile.imported'));
      router.push(`/trip/${r.tripId}`);
      return;
    }
    if (r.reason === 'cancelled') setState({ kind: 'idle' });
    else setState({ kind: 'error', reason: r.reason });
  };

  const error = state.kind === 'error' ? state.reason : null;
  return (
    <View style={{ gap: space.s }}>
      {state.kind === 'busy' ? (
        <Card style={{ gap: space.xs }}>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={t('loading.import.title')}>
            <Label>{t('loading.import.title')}</Label>
          </View>
          <Body muted>{t('loading.import.body')}</Body>
        </Card>
      ) : error === 'file' ? (
        <ErrorNotice title={t('error.import.file.title')} body={t('error.import.file.body')} action={t('error.import.file.action')} actionHint={t('tripfile.importHint')} onAction={run} />
      ) : (
        <Button label={t('tripfile.import')} hint={t('tripfile.importHint')} kind="quiet" onPress={run} />
      )}
      {error === 'version' ? <ErrorNotice title={t('error.import.version.title')} body={t('error.import.version.body')} /> : null}
      {error === 'save' ? (
        <ErrorNotice title={t('error.import.save.title')} body={t('error.import.save.body')} action={t('common.tryAgain')} actionHint={t('tripfile.importHint')} onAction={run} />
      ) : null}
      {error === 'unavailable' ? <ErrorNotice title={t('error.import.file.title')} body={t('tripfile.pickerUnavailable.body')} /> : null}
    </View>
  );
}
