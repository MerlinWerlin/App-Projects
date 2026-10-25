// "Next up": the booking happening now or next, across all trips. Big, warm, one tap to open.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDay, formatDuration, formatTime, zoneCity } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { nextUp } from '../core/timeline.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { KindIcon, kindKey } from './kinds.tsx';
import { Body, Card, Label, PressableScale } from './kit.tsx';

export function NextUpCard({ trips }: { trips: Trip[] }) {
  const { theme, t, lang } = useApp();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const n = nextUp(trips.flatMap((x) => x.items), now);
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
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('next.title')}: ${t(kindKey(n.item.kind))}, ${n.item.title}, ${formatDay(n.item.start.local.slice(0, 10), lang)} ${at}, ${when}`}
      accessibilityHint={t('next.open', { title: n.item.title })}
      onPress={() => router.push(`/item/${n.item.id}`)}
      style={{ backgroundColor: theme.ink, borderRadius: radius.l, padding: space.l, gap: space.s }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <KindIcon kind={n.item.kind} color={theme.accent} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.accent }}>
          {t('next.title')} · {when}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: theme.paper }}>{n.item.title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 16, color: theme.paper, fontVariant: ['tabular-nums'] }}>
        {formatDay(n.item.start.local.slice(0, 10), lang)} · {at}
        {n.item.seat ? ` · ${t('item.seat')} ${n.item.seat}` : ''}
        {n.item.ref ? ` · ${n.item.ref}` : ''}
      </Text>
    </PressableScale>
  );
}
