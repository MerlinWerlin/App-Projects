import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { ago, formatLogEntry, type Diagnostics } from '../src/core/diagnostics';
import type { ReconnectStatus } from '../src/core/reconnect';
import { PLATFORM_LABEL, type Tv } from '../src/core/types';
import { useT } from '../src/i18n/react';
import { APP_VERSION, OS_LABEL, useDiagnostics } from '../src/state/lifecycle';
import { useSession } from '../src/state/session';
import { list, space, textStyle } from '../src/theme/design';
import { DemoNote, FreePromise } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

/** Log lines shown per TV; older ones are counted in the group footer. */
const LOG_SHOWN = 12;

/**
 * Diagnostics (PLAN positioning #2), design v2 (market-1018 M3, docs/DESIGN_V2.md): large title, then
 * each TV as inset-grouped rows (platform line, latency strip in tabular numbers, last error) with its
 * connection log as a second group. The active TV gets its reconnect line and a tinted "Reconnect" pill.
 * Share report is the primary pill at the bottom. All free.
 */
export default function DiagnosticsScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { snap } = useSession();
  const { diagnostics, reconnector, status } = useDiagnostics();
  const [shareNote, setShareNote] = useState<string | null>(null);
  const now = Date.now();
  const active = snap.tvs.find((tv) => tv.id === snap.activeId) ?? null;
  const others = snap.tvs.filter((tv) => tv.id !== snap.activeId);

  const share = useCallback(() => {
    const message = diagnostics.formatReport(Date.now(), { appVersion: APP_VERSION, os: OS_LABEL });
    Share.share({ message, title: t('app.diagnostics.shareTitle') })
      .then(() => setShareNote(null))
      .catch(() => setShareNote(t('app.diagnostics.shareFailed')));
  }, [diagnostics, t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTitleHeader
        title={t('app.diagnostics.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        {active ? (
          <TvSection tv={active} diagnostics={diagnostics} now={now} active status={status} onReconnect={() => reconnector.reconnectNow()} />
        ) : (
          <Card style={styles.card}>
            <Text style={[textStyle('headline'), { color: p.label }]} accessibilityRole="header">
              {t('app.diagnostics.noTv')}
            </Text>
            <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{t('app.diagnostics.noTvBody')}</Text>
          </Card>
        )}
        {others.map((tv) => (
          <TvSection key={tv.id} tv={tv} diagnostics={diagnostics} now={now} active={false} />
        ))}
        <View style={styles.bottom}>
          <PillButton
            stretch
            label={t('app.diagnostics.shareReport')}
            accessibilityHint={t('app.diagnostics.shareHint')}
            onPress={share}
          />
          {shareNote ? <Text style={[textStyle('footnote'), { color: p.warning }]}>{shareNote}</Text> : null}
          <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>{t('app.diagnostics.privacy')}</Text>
          <FreePromise color={p.secondaryLabel} />
          {snap.demo ? <DemoNote color={p.secondaryLabel} /> : null}
        </View>
      </LargeTitleHeader>
    </>
  );
}

function TvSection({
  tv,
  diagnostics,
  now,
  active,
  status,
  onReconnect,
}: {
  tv: Tv;
  diagnostics: Diagnostics;
  now: number;
  active: boolean;
  status?: ReconnectStatus;
  onReconnect?: () => void;
}) {
  const p = useDesign();
  const t = useT();
  const d = diagnostics.get(tv.id);
  const s = diagnostics.stats(tv.id);
  const log = d ? [...d.log].reverse() : [];
  const connecting = status?.phase === 'connecting';
  return (
    <>
      <InsetGroupedList header={active ? t('app.diagnostics.activeName', { name: tv.name }) : tv.name}>
        <Row
          title={t('app.diagnostics.tvLine', {
            platform: PLATFORM_LABEL[tv.platform],
            model: tv.model,
            state: d?.state ?? t('app.diagnostics.notChecked'),
          })}
        />
        {!d ? <Row title={t('app.diagnostics.selectToMeasure')} /> : null}
        {d && s ? (
          <View
            accessible
            accessibilityLabel={t('app.diagnostics.latencyLabel', { last: s.last, median: Math.round(s.median), p90: s.p90 })}
            style={styles.statsCell}
          >
            <View style={styles.stats}>
              <Stat label={t('app.diagnostics.statLast')} value={s.last} />
              <Stat label={t('app.diagnostics.statMedian')} value={Math.round(s.median)} />
              <Stat label={t('app.diagnostics.statP90')} value={s.p90} />
              <Stat label={t('app.diagnostics.statMin')} value={s.min} />
              <Stat label={t('app.diagnostics.statMax')} value={s.max} />
            </View>
            <Text style={[textStyle('caption1'), { color: p.secondaryLabel }]}>{t('app.diagnostics.lastPresses', { count: s.count })}</Text>
            <View style={[styles.separator, { backgroundColor: p.separator }]} />
          </View>
        ) : null}
        {d && !s ? <Row title={t('app.diagnostics.noPresses')} /> : null}
        {d ? (
          <Row
            title={t('app.diagnostics.lastError')}
            subtitle={
              d.lastError
                ? t('app.diagnostics.errorWithAge', { message: d.lastError.message, ago: ago(now, d.lastError.at) })
                : t('app.diagnostics.none')
            }
          />
        ) : null}
      </InsetGroupedList>

      {active && status ? (
        <View style={styles.reconnect}>
          <ReconnectLine status={status} now={now} />
          <PillButton
            variant="tinted"
            label={connecting ? t('app.diagnostics.reconnecting') : t('app.diagnostics.reconnect')}
            accessibilityLabel={t('app.diagnostics.reconnect')}
            disabled={connecting}
            onPress={() => onReconnect?.()}
          />
        </View>
      ) : null}

      {d ? (
        <InsetGroupedList
          header={t('app.diagnostics.connectionLog')}
          footer={log.length > LOG_SHOWN ? t('app.diagnostics.olderEntries', { count: log.length - LOG_SHOWN }) : undefined}
        >
          {log.length === 0 ? <Row title={t('app.diagnostics.empty')} /> : null}
          {log.slice(0, LOG_SHOWN).map((l, i) => (
            <Row key={`${l.at}-${i}`} title={formatLogEntry(l)} />
          ))}
        </InsetGroupedList>
      ) : null}
    </>
  );
}

function ReconnectLine({ status, now }: { status: ReconnectStatus; now: number }) {
  const p = useDesign();
  const t = useT();
  let text: string | null = null;
  if (status.phase === 'connecting')
    text = status.attempt > 0 ? t('app.diagnostics.reconnectingAttempt', { attempt: status.attempt }) : t('app.diagnostics.reconnecting');
  else if (status.phase === 'waiting') {
    if (status.nextAt) {
      const seconds = Math.max(1, Math.ceil((status.nextAt - now) / 1000));
      text =
        status.attempt > 0
          ? t('app.diagnostics.retryInTries', { seconds, count: status.attempt })
          : t('app.diagnostics.retryIn', { seconds });
    } else text = t('app.diagnostics.retrySoon');
  } else if (status.phase === 'gave_up') text = status.message;
  else if (status.phase === 'off') text = t('app.diagnostics.tvOff');
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[textStyle('footnote'), { color: status.phase === 'gave_up' ? p.warning : p.secondaryLabel }]}>
      {text}
    </Text>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const p = useDesign();
  return (
    <View style={styles.stat}>
      <Text style={[textStyle('numeric'), { color: p.label }]}>{String(value)}</Text>
      <Text style={[textStyle('caption1'), { color: p.secondaryLabel }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: list.inset, marginBottom: list.groupGap },
  statsCell: { paddingStart: list.rowPadding, paddingTop: list.rowPaddingV, gap: space.xs },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingEnd: list.rowPadding },
  stat: { alignItems: 'center', minWidth: 48 },
  separator: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginTop: list.rowPaddingV - space.xs },
  reconnect: { marginHorizontal: list.inset, marginTop: -space.lg, marginBottom: list.groupGap, paddingHorizontal: list.rowPadding, gap: space.sm },
  bottom: { marginHorizontal: list.inset, gap: space.md },
});
