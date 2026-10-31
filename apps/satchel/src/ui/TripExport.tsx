// "Export trip" on the trip screen (T15): makes <trip name>.satchel and opens the share sheet (AirDrop, Messages,
// Files). Shows STATES_COPY loading and error blocks in place; a phone without a share sheet gets a plain notice.
// T68: "Include journal photos" (off each time, shown only when the journal has photos) with a size note.
import { useMemo, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { formatSize } from '../core/citymaps.ts';
import { journalPhotoSize } from '../core/journal.ts';
import type { Trip } from '../core/model.ts';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { exportTrip, shareAgain } from '../state/tripTransfer.ts';
import { space } from '../theme/tokens.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { Body, Button, Card, Label, ToggleRow } from './kit.tsx';

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; skipped: number; photosSkipped: number } | { kind: 'write' } | { kind: 'share'; uri: string } | { kind: 'unavailable' };

export function TripExport({ trip }: { trip: Trip }) {
  const { t } = useApp();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const title = t('tripfile.shareTitle', { name: trip.name });
  const [withPhotos, setWithPhotos] = useState(false);
  const photoSize = useMemo(() => journalPhotoSize(trip), [trip]);
  // base64 makes the file about a third bigger than the photos themselves
  const size = formatSize(Math.round((photoSize.bytes * 4) / 3));
  const sizeNote =
    photoSize.bytes === 0
      ? t('tripfile.photos.sizeUnknown', { n: photoSize.count })
      : photoSize.unknown
        ? t('tripfile.photos.sizeAtLeast', { n: photoSize.count, size })
        : photoSize.count === 1
          ? t('tripfile.photos.sizeOne', { size })
          : t('tripfile.photos.size', { n: photoSize.count, size });

  const finish = (r: Awaited<ReturnType<typeof exportTrip>>) => {
    if (r.ok) {
      haptic.success();
      setState({ kind: 'done', skipped: r.skipped, photosSkipped: r.photosSkipped });
      if (r.skipped) AccessibilityInfo.announceForAccessibility(t('tripfile.skipped', { n: r.skipped }));
      if (r.photosSkipped) AccessibilityInfo.announceForAccessibility(t('tripfile.photos.skipped', { n: r.photosSkipped }));
    } else if (r.reason === 'write') setState({ kind: 'write' });
    else if (r.reason === 'unavailable') setState({ kind: 'unavailable' });
    else setState({ kind: 'share', uri: r.uri ?? '' });
  };
  const run = async () => {
    if (state.kind === 'busy') return;
    setState({ kind: 'busy' });
    AccessibilityInfo.announceForAccessibility(t('loading.export.title'));
    finish(await exportTrip(trip, title, { includePhotos: withPhotos && photoSize.count > 0 }));
  };
  const retryShare = async (uri: string) => {
    setState({ kind: 'busy' });
    finish(await shareAgain(uri, title));
  };

  return (
    <View style={{ gap: space.s }}>
      {photoSize.count > 0 && state.kind !== 'busy' ? (
        <Card style={{ gap: space.xs }}>
          <ToggleRow label={t('tripfile.photos.toggle')} hint={t('tripfile.photos.hint')} value={withPhotos} onChange={setWithPhotos} />
          <View accessibilityLiveRegion="polite">
            <Body muted>{withPhotos ? sizeNote : t('tripfile.photos.off')}</Body>
          </View>
        </Card>
      ) : null}
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
      {state.kind === 'done' && state.photosSkipped ? <Body muted>{t('tripfile.photos.skipped', { n: state.photosSkipped })}</Body> : null}
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
