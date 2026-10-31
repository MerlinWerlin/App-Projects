// "Next up": the booking happening now or next, across all trips. Big, warm, one tap to open.
// T50: a dusk-gradient boarding pass (kind badge, countdown pill, title in display type, time / seat / ref row under
// a perforation). Same props, same spoken label and the same tap target as before.
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDay, formatDuration, formatTime, zoneCity } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { nextUp } from '../core/timeline.ts';
import { useApp } from '../state/app.tsx';
import { radius, shadowOf, space, typeScale } from '../theme/tokens.ts';
import { GradientFill } from './hero.tsx';
import { KindIcon, kindKey } from './kinds.tsx';
import { Body, Card, Label, PressableScale } from './kit.tsx';

export const NextUpCard = memo(function NextUpCard({ trips }: { trips: Trip[] }) {
  const { theme, t, lang } = useApp();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const n = nextUp(
    trips.flatMap((x) => x.items),
    now,
  );
  if (!n) {
    return (
      <Card>
        <Label>{t('next.title')}</Label>
        <Body muted>{t('next.none')}</Body>
      </Card>
    );
  }
  const when = n.state === 'now' ? t('next.now', { d: formatDuration(n.minutes) }) : t('next.in', { d: formatDuration(n.minutes) });
  const at = t('item.zone', { time: formatTime(n.item.start.local), city: zoneCity(n.item.start.tz) });
  const facts = [n.item.seat ? `${t('item.seat')} ${n.item.seat}` : '', n.item.ref ?? ''].filter(Boolean).join(' · ');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('next.title')}: ${t(kindKey(n.item.kind))}, ${n.item.title}, ${formatDay(n.item.start.local.slice(0, 10), lang)} ${at}, ${when}`}
      accessibilityHint={t('next.open', { title: n.item.title })}
      onPress={() => router.push(`/item/${n.item.id}`)}
      style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.trips[0] }, shadowOf(theme, 'mid')]}
    >
      <GradientFill tone="trips" />
      <View style={{ padding: space.l, gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
            <KindIcon kind={n.item.kind} color={theme.heroAccent} size={18} />
          </View>
          <Text style={[typeScale.caption, { color: theme.heroMuted, flex: 1 }]}>{t('next.title')}</Text>
          <View style={{ backgroundColor: theme.heroChip, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
            <Text style={[typeScale.caption, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{when}</Text>
          </View>
        </View>
        <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{n.item.title}</Text>
      </View>
      {/* Perforation between the main part and the stub. */}
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <View style={{ padding: space.l, paddingTop: space.m, flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s, alignItems: 'baseline' }}>
        <Text style={[typeScale.bodyStrong, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>
          {formatDay(n.item.start.local.slice(0, 10), lang)} · {at}
        </Text>
        {facts ? <Text style={[typeScale.body, { color: theme.heroMuted, fontVariant: ['tabular-nums'] }]}>{facts}</Text> : null}
      </View>
    </PressableScale>
  );
});
