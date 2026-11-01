// T14 Save to Satchel (Open in / Copy to Satchel, folds in T46). app/+native-intent.tsx sends every incoming file URL
// here as ?uri=. The file is copied into Satchel's incoming folder first (src/native/openin.ts), then routed by
// src/core/openin.ts: an email or text file opens Paste a booking filled in, a PDF or image opens Add to a trip, a
// .satchel file is imported as a new trip (the T15 flow), a .satchelbackup opens Settings > Backup's restore preview
// (T154: Merge or Replace there, never imported as a trip), and anything else gets an honest "can't read this kind of
// file" with a way back. Never an unmatched-route screen; nothing is saved without the traveller's say-so except a
// trip file they chose to open in Satchel.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { classifyFile, maxIncomingBytes, pasteTextFor, routeFor } from '../../src/core/openin.ts';
import { haptic } from '../../src/native/device.ts';
import { discardIncoming, readIncomingText, receiveIncoming } from '../../src/native/openin.ts';
import { useApp } from '../../src/state/app.tsx';
import { stashIncomingText } from '../../src/state/openinStash.ts';
import { importTripText, type ImportFailure } from '../../src/state/tripTransfer.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { space } from '../../src/theme/tokens.ts';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { FadeInView } from '../../src/ui/hero.tsx';
import { Body, Button, Card, EmptyState, Label, Screen } from '../../src/ui/kit.tsx';

type State =
  | { k: 'working' }
  | { k: 'unsupported'; name?: string }
  | { k: 'tooLarge'; max: number }
  | { k: 'failed' }
  | { k: 'empty' }
  | { k: 'trip'; reason: ImportFailure };

export default function OpenInScreen() {
  const params = useLocalSearchParams<{ uri?: string }>();
  const { t } = useApp();
  const { trips, saveTrip, deleteTrip } = useTrips();
  const router = useRouter();
  const [state, setState] = useState<State>({ k: 'working' });
  const started = useRef(false);
  // Read once at the start: the trips list changing during an import must not start a second one.
  const names = useRef(trips.map((x) => x.name));

  const show = (s: State) => {
    setState(s);
    if (s.k !== 'working') AccessibilityInfo.announceForAccessibility(titleFor(s));
  };
  const titleFor = (s: State): string =>
    s.k === 'tooLarge'
      ? t('openin.tooLarge.title')
      : s.k === 'failed'
        ? t('openin.failed.title')
        : s.k === 'empty'
          ? t('openin.empty.title')
          : s.k === 'trip'
            ? t(s.reason === 'version' ? 'error.import.version.title' : s.reason === 'save' ? 'error.import.save.title' : 'error.import.file.title')
            : t('openin.unsupported.title');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const run = async () => {
      const uri = typeof params.uri === 'string' ? params.uri : '';
      const got = await receiveIncoming(uri);
      if (!got.ok) {
        if (got.reason === 'too-large') return show({ k: 'tooLarge', max: maxIncomingBytes(classifyFile({ name: got.name })) });
        if (got.reason === 'copy-failed') return show({ k: 'failed' });
        return show({ k: 'unsupported' });
      }
      const route = routeFor(got.kind);
      if (route === 'restore') {
        // The backup screen reads the copy, shows the preview and deletes the copy (app/backup.tsx).
        router.replace({ pathname: '/backup', params: { incoming: got.uri } });
        return;
      }
      if (route === 'addToTrip') {
        router.replace({ pathname: '/openin/add', params: { file: got.uri, name: got.name, kind: got.kind } });
        return;
      }
      if (route === 'unsupported') {
        await discardIncoming(got.uri);
        return show({ k: 'unsupported', name: got.name || undefined });
      }
      const raw = await readIncomingText(got.uri);
      await discardIncoming(got.uri);
      if (raw == null) return show({ k: 'failed' });
      if (route === 'paste' && (got.kind === 'text' || got.kind === 'eml')) {
        const text = pasteTextFor(got.kind, raw);
        if (!text.trim()) return show({ k: 'empty' });
        router.replace({ pathname: '/paste-booking', params: { incoming: stashIncomingText(text) } });
        return;
      }
      // route === 'import': a .satchel trip file, all-or-nothing like the picker path.
      AccessibilityInfo.announceForAccessibility(t('openin.trip.importing'));
      const copyName = (name: string, n: number) => (n === 1 ? t('tripfile.copyName', { name }) : t('tripfile.copyNameN', { name, n }));
      const r = await importTripText({ saveTrip, deleteTrip, existingNames: names.current, copyName }, raw);
      if (r.ok) {
        haptic.success();
        AccessibilityInfo.announceForAccessibility(t('tripfile.imported'));
        router.replace(r.photosLeftOut ? { pathname: '/trip/[id]', params: { id: r.tripId, photosLeftOut: String(r.photosLeftOut) } } : `/trip/${r.tripId}`);
        return;
      }
      show({ k: 'trip', reason: r.reason === 'cancelled' ? 'file' : r.reason });
    };
    run().catch(() => show({ k: 'failed' }));
    // Runs once for the URL this screen was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const backButton = <Button label={t('openin.back')} hint={t('openin.backHint')} kind="secondary" icon="arrow-back" onPress={back} />;

  if (state.k === 'working') {
    return (
      <Screen>
        <Card style={{ gap: space.xs }}>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={t('openin.working.title')}>
            <Label>{t('openin.working.title')}</Label>
          </View>
          <Body muted>{t('openin.working.body')}</Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <FadeInView style={{ gap: space.l }}>
        {state.k === 'trip' ? (
          <ErrorNotice
            title={titleFor(state)}
            body={t(state.reason === 'version' ? 'error.import.version.body' : state.reason === 'save' ? 'error.import.save.body' : 'error.import.file.body')}
          />
        ) : state.k === 'tooLarge' ? (
          <EmptyState art="suitcase" title={t('openin.tooLarge.title')} body={t('openin.tooLarge.body', { mb: Math.round(state.max / (1024 * 1024)) })} />
        ) : state.k === 'failed' ? (
          <EmptyState art="lifebuoy" title={t('openin.failed.title')} body={t('openin.failed.body')} />
        ) : state.k === 'empty' ? (
          <EmptyState art="notebook" title={t('openin.empty.title')} body={t('openin.empty.body')} />
        ) : (
          <EmptyState
            art="magnifier"
            title={t('openin.unsupported.title')}
            body={state.name ? `${t('openin.unsupported.body')} ${t('openin.unsupported.named', { name: state.name })}` : t('openin.unsupported.body')}
          />
        )}
        {backButton}
      </FadeInView>
    </Screen>
  );
}
