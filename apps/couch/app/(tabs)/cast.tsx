import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { castUnconfirmed, isCastActive, playAction } from '../../src/core/cast/castController';
import { useT } from '../../src/i18n/react';
import { pickMediaDetailed } from '../../src/native/mediaPicker';
import { useCast } from '../../src/state/cast';
import { list, space, textStyle } from '../../src/theme/design';
import AirPlayButton from '../../src/ui/cast/AirPlayButton';
import { castDeliveryText, castNoticeText } from '../../src/ui/cast/castNotice';
import { QueueList } from '../../src/ui/cast/QueueList';
import { SlideshowControls } from '../../src/ui/cast/SlideshowControls';
import { TargetPicker, useTargetName } from '../../src/ui/cast/TargetPicker';
import { TransportBar } from '../../src/ui/cast/TransportBar';
import { EmptyState } from '../../src/ui/EmptyState';
import { haptic } from '../../src/ui/remote/haptics';
import { DemoNote } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { useAnnounce } from '../../src/ui/useAnnounce';
import { Card, LargeTitleHeader, PillButton, useDesign } from '../../src/ui/v2';

/**
 * Cast tab (cast-1024, T91): pick photos and videos on the phone and show them on the TV. Target
 * chips, the picker, the queue, transport (previous / play-pause / next, -10 s / +10 s for videos,
 * stop), slideshow + loop, and the AirPlay / Screen Mirroring shortcut (T92). Every part is free.
 * In Expo Go there is no file server, so the tab runs in demo mode with the demo TV and says so. With a
 * real TV connected it always says why nothing reaches the TV (D145-2: no receiver found, or no file server).
 * After a send to a real TV it says "sent, waiting for the TV" until the TV confirms it is showing the
 * item, with what to check and where the request went (owner brief 25 Oct 2026, TestFlight 1.0.1).
 * Not tested on a real TV.
 */
export default function CastScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { cast, snap } = useCast();
  const nameOf = useTargetName();
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const { queue } = snap;
  const target = snap.targets.find((x) => x.id === snap.targetId) ?? null;
  const targetName = nameOf(target);
  const active = isCastActive(queue, snap.cast);
  const action = playAction(queue, snap.cast);
  const current = queue.index >= 0 ? (queue.items[queue.index] ?? null) : null;
  const last = queue.items.length - 1;

  const error = snap.error ?? (snap.cast.state === 'error' ? snap.cast.error : null);
  const unconfirmed = !error && castUnconfirmed(snap);
  // Owner 1 Nov 2026 (TCL showed black while Couch said casting): keep the delivery line, with the
  // TV's reported state, visible on real TVs until the cause is found.
  const delivery = snap.delivery
    ? `${castDeliveryText(snap.delivery, t)} [TV: ${snap.cast.state}${snap.cast.confirmed ? ', confirmed' : ''}]`
    : null;
  useAnnounce(error);
  useAnnounce(notice);

  const onPick = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    setNotice(null);
    try {
      const r = await pickMediaDetailed();
      if (r.kind === 'picked') {
        haptic('success');
        setNotice(t('app.cast.added', { count: r.items.length }));
        await cast.addItems(r.items);
      } else if (r.kind === 'denied') {
        haptic('warning');
        setNotice(t('app.cast.denied'));
      } else if (r.kind === 'unavailable') {
        setNotice(t('app.cast.pickerUnavailable'));
      } else if (r.kind === 'failed') {
        haptic('warning');
        setNotice(t('app.cast.pickFailed'));
      }
    } finally {
      setPicking(false);
    }
  }, [cast, picking, t]);

  let status: string | null = null;
  if (error) status = error;
  else if (unconfirmed && current) status = t('ui.cast.sent', { name: targetName ?? '', title: current.title });
  else if (snap.cast.state === 'loading') status = t('app.cast.status.loading');
  else if (active && snap.cast.state === 'playing') status = t('app.cast.status.playing', { title: current?.title ?? '', name: targetName ?? '' });
  else if (active && snap.cast.state === 'paused') status = t('app.cast.status.paused', { title: current?.title ?? '' });
  else if (snap.cast.state === 'stopped') status = t('app.cast.status.stopped');
  else if (queue.items.length > 0) status = t('app.cast.status.ready');

  const subtitle = targetName ? t('app.cast.subtitle', { name: targetName }) : t('app.cast.subtitleNone');

  return (
    <LargeTitleHeader title={t('app.cast.title')} subtitle={subtitle}>
      <View style={styles.content}>
        <TargetPicker
          targets={snap.targets}
          selectedId={snap.targetId}
          searching={snap.searching}
          demo={snap.demo}
          onSelect={(id) => cast.selectTarget(id)}
          onSearch={() => void cast.refresh()}
        />

        {/* D145-2: say why casting is not reaching a real TV; never fall back to the demo TV silently. */}
        {snap.notice?.kind === 'demo' ? (
          <View style={styles.note}>
            <DemoNote color={p.secondaryLabel} />
          </View>
        ) : snap.notice?.kind === 'expoGo' || (!snap.serverAvailable && !snap.notice) ? (
          <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]}>{t('app.cast.expoGoNote')}</Text>
        ) : snap.notice ? (
          <Text style={[textStyle('footnote'), styles.note, { color: p.label }]} accessibilityLiveRegion="polite">
            {castNoticeText(snap.notice, t)}
          </Text>
        ) : null}

        <PillButton
          size="large"
          stretch
          label={t('app.cast.pick')}
          accessibilityHint={t('app.cast.pickHint')}
          disabled={picking}
          onPress={() => void onPick()}
        />

        {notice ? (
          <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}

        {queue.items.length === 0 ? (
          <Card>
            <EmptyState title={t('app.cast.emptyTitle')} body={t('app.cast.emptyBody')} />
          </Card>
        ) : (
          <>
            {status ? (
              <Text
                style={[textStyle('subheadline'), styles.note, { color: error ? p.warning : p.label }]}
                accessibilityLiveRegion="polite"
              >
                {status}
              </Text>
            ) : null}
            {unconfirmed ? (
              <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]}>{t('ui.cast.unconfirmedHelp')}</Text>
            ) : null}
            {delivery ? (
              <Text style={[textStyle('caption1'), styles.note, { color: p.secondaryLabel }]} selectable>
                {delivery}
              </Text>
            ) : null}
            {snap.delivery?.via === 'googlecast' ? (
              <PillButton variant="plain" label="Send test picture" onPress={() => void cast.sendTestPicture()} />
            ) : null}
            <Card>
              <TransportBar
                cast={snap.cast}
                action={action}
                active={active}
                canPrev={active && (queue.index > 0 || queue.loop)}
                canNext={active && (queue.index < last || queue.loop)}
                onPrev={() => void cast.prev()}
                onNext={() => void cast.next()}
                onToggle={() => void cast.togglePlay()}
                onSeekBy={(d) => void cast.seekBy(d)}
                onStop={() => void cast.stop()}
              />
            </Card>
            <View style={styles.section}>
              <View style={styles.sectionHd}>
                <Text accessibilityRole="header" style={[textStyle('title3'), styles.grow, { color: p.label }]}>
                  {t('app.cast.queueTitle')}
                </Text>
                <PillButton
                  variant="plain"
                  tone="destructive"
                  haptic="warning"
                  label={t('app.cast.clear')}
                  accessibilityHint={t('app.cast.clearHint')}
                  onPress={() => void cast.clear()}
                />
              </View>
              <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]}>
                {t('app.cast.queueCount', { count: queue.items.length })}
              </Text>
              <QueueList
                items={queue.items}
                index={queue.index}
                onShow={(i) => void cast.start(i)}
                onMove={(from, to) => cast.move(from, to)}
                onRemove={(id) => cast.remove(id)}
                confirmed={!unconfirmed}
                failed={!!error}
              />
            </View>
            <SlideshowControls
              slideshow={queue.slideshow}
              intervalSec={queue.intervalSec}
              loop={queue.loop}
              onSlideshow={(on) => cast.setSlideshow(on)}
              onInterval={(sec) => cast.setIntervalSec(sec)}
              onLoop={(on) => cast.setLoop(on)}
            />
          </>
        )}

        <AirPlayButton onShowGuide={() => router.push('/airplay')} />

        <Text style={[textStyle('caption2'), styles.note, { color: p.secondaryLabel }]}>{t('app.cast.localOnly')}</Text>
      </View>
    </LargeTitleHeader>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: list.inset, gap: space.lg, paddingBottom: space.xxxl },
  note: { paddingHorizontal: space.xs },
  section: { gap: space.sm },
  sectionHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  grow: { flexShrink: 1 },
});
