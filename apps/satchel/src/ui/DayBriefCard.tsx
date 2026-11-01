// T71 "Your day": the morning brief at the top of the Trips tab while a trip is on. Today in the zone you're in:
// what's next with its countdown ("Train in 2h 10m"), the first booking, how many stops, tonight's hotel (one tap to
// its address card when an address is saved) and a heads-up for an early start tomorrow. Tapping the card opens the
// trip at today's section. Logic in src/core/daybrief.ts; renders nothing when no trip is on today.
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { dayBrief } from '../core/daybrief.ts';
import { formatDuration, formatTime, zoneCity } from '../core/format.ts';
import type { Item, Trip } from '../core/model.ts';
import { useApp } from '../state/app.tsx';
import { radius, shadowOf, space, typeScale } from '../theme/tokens.ts';
import { GradientFill } from './hero.tsx';
import { KindIcon, kindKey } from './kinds.tsx';
import { PressableScale } from './kit.tsx';
import { useAirportPrefs } from './AirportFields.tsx';
import { briefAirportLine } from './AirportPanel.tsx';
import { useMinute } from './TripPass.tsx';
import { briefTodos } from '../core/todos.ts';
import { useMapsOnPhone } from './ReadinessCard.tsx';
import { briefLine } from './todos.tsx';
import { useNextDoseLine } from './MedTimesCard.tsx';
import { holidayTodayIn } from '../core/holidays.ts';
import { holidayTodayLine } from './HolidaysCard.tsx';
import { currentStay } from '../core/staydetails.ts';
import { StayBriefRow } from './stay.tsx';
import { CallHomeBriefRow } from './callhome.tsx';

export const DayBriefCard = memo(function DayBriefCard({ trips }: { trips: Trip[] }) {
  const { theme, t } = useApp();
  const router = useRouter();
  const now = useMinute();
  const [airportPrefs] = useAirportPrefs();
  const maps = useMapsOnPhone();
  const b = dayBrief(trips, now);
  // T101: next medicine dose under the trip's saved plan (empty with no medicines saved). Hook before the early return.
  const dose = useNextDoseLine(b?.trip ?? null, b?.zone ?? '', now);
  if (!b) return null;
  // T109: stay details for the stay you're in right now on this trip (by real instants, across zones).
  const stay = currentStay([b.trip], now);

  const at = (i: Item) => {
    const time = formatTime(i.start.local);
    return i.start.tz === b.zone ? time : t('brief.timeZone', { time, city: zoneCity(i.start.tz) });
  };
  const city = zoneCity(b.zone);
  const eyebrow = b.lastDay ? t('brief.eyebrowLast', { city }) : t('brief.eyebrow', { day: b.day, total: b.total, city });
  const n = b.next;
  const headline = n
    ? t(n.state === 'now' ? 'brief.nowLeft' : 'brief.nextIn', { kind: t(kindKey(n.item.kind)), d: formatDuration(n.minutes) })
    : t(b.items.length ? 'brief.allDone' : 'brief.nothing');
  const lines = [
    n ? t('brief.next', { time: at(n.item), title: n.item.title }) : '',
    b.first && b.first.id !== n?.item.id ? t('brief.first', { time: at(b.first), title: b.first.title }) : '',
    b.stops === 0 ? t('brief.stopsNone') : b.stops === 1 ? t('brief.stopsOne') : t('brief.stopsMany', { n: b.stops }),
  ].filter(Boolean);
  // T74: on the day of a flight, when to leave for it (always labelled as general guidance).
  const flight = briefAirportLine(b.trip, b.zone, b.today, now, airportPrefs, t);
  const early = b.early ? t('brief.early', { kind: t(kindKey(b.early.kind)), time: at(b.early) }) : '';
  const hotelName = b.tonight ? b.tonight.item.place?.name?.trim() || b.tonight.item.title : '';
  const tonight = b.tonight ? t('brief.tonight', { name: hotelName }) : '';
  // T93: overdue / due-soon to-dos for this trip ("Due soon: Check in online for DA 6").
  const due = briefLine(t, briefTodos(b.trip, now, { catalog: maps.catalog, installed: maps.installed }));
  // T106: today is a public holiday where you are (the brief's zone, its own calendar).
  const holiday = holidayTodayLine(t, holidayTodayIn(b.zone, now));
  const spoken = [eyebrow, headline, holiday ?? '', ...lines, flight?.line ?? '', flight?.guidance ?? '', b.tonight && !b.tonight.hasAddress ? tonight : '', early, due, dose].filter(Boolean).join('. ');
  const muted = [typeScale.body, { color: theme.heroMuted }];

  return (
    <View style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.map[0] }, shadowOf(theme, 'mid')]}>
      <GradientFill tone="map" />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint={t('brief.openHint', { trip: b.trip.name })}
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: b.trip.id, day: b.today } })}
        style={{ padding: space.l, gap: space.s }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
            <KindIcon kind={n?.item.kind ?? b.first?.kind ?? 'activity'} color={theme.heroAccent} size={18} />
          </View>
          <Text style={[typeScale.caption, { color: theme.heroMuted, flex: 1 }]}>{eyebrow}</Text>
        </View>
        <Text style={[typeScale.displayM, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{headline}</Text>
        {holiday ? <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{holiday}</Text> : null}
        {lines.map((l) => (
          <Text key={l} style={muted}>
            {l}
          </Text>
        ))}
        {flight ? (
          <View style={{ gap: 2 }}>
            <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{flight.line}</Text>
            <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{flight.guidance}</Text>
          </View>
        ) : null}
        {b.tonight && !b.tonight.hasAddress ? <Text style={muted}>{tonight}</Text> : null}
        {early ? <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{early}</Text> : null}
        {due ? <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{due}</Text> : null}
        {dose ? <Text style={muted}>{dose}</Text> : null}
      </PressableScale>
      {b.tonight && b.tonight.hasAddress ? (
        <>
          <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('brief.tonightOpen', { name: hotelName })}
            accessibilityHint={t('brief.tonightHint')}
            onPress={() => b.tonight && router.push({ pathname: '/address/[id]', params: { id: b.tonight.item.id } })}
            style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
          >
            <KindIcon kind="hotel" color={theme.heroAccent} size={18} />
            <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
              {tonight}
            </Text>
          </PressableScale>
        </>
      ) : null}
      {stay ? (
        <>
          <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
          <StayBriefRow item={stay.item} />
        </>
      ) : null}
      {/* T114: "Good time to call Mum until 21:00" (nothing with nobody saved). */}
      <CallHomeBriefRow trip={b.trip} />
    </View>
  );
});
