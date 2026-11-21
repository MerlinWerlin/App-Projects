// "Next up": the booking happening now or next, across all trips. Big, plain, one tap to open.
// Design pass 3: a ticket stub printed on its kind's stock. The time stands in big ticket numerals on the left, a
// punched tear line divides it from the plan, and "Now" is the one carbon-red overprint. Same props, same spoken label
// and the same tap target as before.
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDay, formatDuration, formatTime, zoneCity } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { nextUp } from '../core/timeline.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { KIND_STOCK, KindIcon, kindKey } from './kinds.tsx';
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
  const live = n.state === 'now';
  const when = live ? t('next.now', { d: formatDuration(n.minutes) }) : t('next.in', { d: formatDuration(n.minutes) });
  const time = formatTime(n.item.start.local);
  const at = t('item.zone', { time, city: zoneCity(n.item.start.tz) });
  const facts = [n.item.seat ? `${t('item.seat')} ${n.item.seat}` : '', n.item.ref ?? ''].filter(Boolean).join(' · ');
  const stock = theme.stock[KIND_STOCK[n.item.kind]];
  const hole = { position: 'absolute' as const, left: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: theme.paper };
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('next.title')}: ${t(kindKey(n.item.kind))}, ${n.item.title}, ${formatDay(n.item.start.local.slice(0, 10), lang)} ${at}, ${when}`}
      accessibilityHint={t('next.open', { title: n.item.title })}
      onPress={() => router.push(`/item/${n.item.id}`)}
      style={{ borderRadius: radius.l, backgroundColor: stock, flexDirection: 'row', alignItems: 'stretch' }}
    >
      {/* The stub: the time in ticket numerals, the day under it. */}
      <View style={{ width: 112, paddingVertical: space.l, paddingLeft: space.l, paddingRight: space.m, justifyContent: 'center' }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[typeScale.displayXL, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
          {time}
        </Text>
        <Text numberOfLines={2} style={[typeScale.caption, { color: theme.muted }]}>
          {formatDay(n.item.start.local.slice(0, 10), lang)}
        </Text>
      </View>
      {/* The tear line, punched top and bottom. */}
      <View style={{ width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: theme.muted, opacity: 0.5, marginVertical: space.m }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 112, top: 0, bottom: 0 }}>
        <View style={[hole, { top: -9 }]} />
        <View style={[hole, { bottom: -9 }]} />
      </View>
      <View style={{ flex: 1, padding: space.l, paddingLeft: space.m, gap: space.xs, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <KindIcon kind={n.item.kind} color={theme.ink} size={16} />
          <Text style={[typeScale.caption, { color: live ? theme.accentInk : theme.muted, flex: 1, fontVariant: ['tabular-nums'] }]}>
            {live ? when : `${t('next.title')} · ${when}`}
          </Text>
        </View>
        <Text numberOfLines={3} style={[typeScale.title, { color: theme.ink }]}>
          {n.item.title}
        </Text>
        <Text numberOfLines={2} style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>
          {facts ? `${zoneCity(n.item.start.tz)} · ${facts}` : zoneCity(n.item.start.tz)}
        </Text>
      </View>
    </PressableScale>
  );
});
