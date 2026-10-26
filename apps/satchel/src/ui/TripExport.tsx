// "Export trip" on the trip screen (T15): makes <trip name>.satchel and opens the share sheet (AirDrop, Messages,
// Files). Shows STATES_COPY loading and error blocks in place; a phone without a share sheet gets a plain notice.
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import type { Trip } from '../core/model.ts';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { exportTrip, shareAgain } from '../state/tripTransfer.ts';
import { space } from '../theme/tokens.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { Body, Button, Card, Label } from './kit.tsx';

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; skipped: number } | { kind: 'write' } | { kind: 'share'; uri: string } | { kind: 'unavailable' };

export function TripExport({ trip }: { trip: Trip }) {
  const { t } = useApp();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const title = t('tripfile.shareTitle', { name: trip.name });

  const finish = (r: Awaited<ReturnType<typeof exportTrip>>) => {
    if (r.ok) {
      haptic.success();
      setState({ kind: 'done', skipped: r.skipped });
      if (r.skipped) AccessibilityInfo.announceForAccessibility(t('tripfile.skipped', { n: r.skipped }));
    } else if (r.reason === 'write') setState({ kind: 'write' });
    else if (r.reason === 'unavailable') setState({ kind: 'unavailable' });
    else setState({ kind: 'share', uri: r.uri ?? '' });
  };
  const run = async () => {
    if (state.kind === 'busy') return;
    setState({ kind: 'busy' });
    AccessibilityInfo.announceForAccessibility(t('loading.export.title'));
    finish(await exportTrip(trip, title));
  };
  const retryShare = async (uri: string) => {
    setState({ kind: 'busy' });
    finish(await shareAgain(uri, title));
  };

  return (
    <View style={{ gap: space.s }}>
      {state.kind === 'busy' ? (
        <Card style={{ gap: space.xs }}>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={t('loading.export.title')}>
            <Label>{t('loading.export.title')}</Label>
          </View>
          <Body muted>{t('loading.export.body')}</Body>
        </Card>
      ) : (
        <Button label={t('tripfile.export')} hint={t('tripfile.exportHint')} kind="quiet" onPress={run} />
      )}
      {state.kind === 'idle' || state.kind === 'busy' ? <Body muted>{t('tripfile.exportNote')}</Body> : null}
      {state.kind === 'done' && state.skipped ? <Body muted>{t('tripfile.skipped', { n: state.skipped })}</Body> : null}
      {state.kind === 'write' ? (
        <ErrorNotice title={t('error.export.title')} body={t('error.export.body')} action={t('common.tryAgain')} actionHint={t('tripfile.exportHint')} onAction={run} />
      ) : null}
      {state.kind === 'share' ? (
        <ErrorNotice
          title={t('error.export.share.title')}
          body={t('error.export.share.body')}
          action={t('common.tryAgain')}
          actionHint={t('tripfile.exportHint')}
          onAction={() => retryShare(state.uri)}
        />
      ) : null}
      {state.kind === 'unavailable' ? <ErrorNotice title={t('tripfile.unavailable.title')} body={t('tripfile.unavailable.body')} /> : null}
    </View>
  );
}
