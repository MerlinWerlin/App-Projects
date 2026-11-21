// T71 "Your day": the morning brief at the top of the Trips tab while a trip is on. Today in the zone you're in:
// what's next with its countdown ("Train in 2h 10m"), the first booking, how many stops, tonight's hotel (one tap to
// its address card when an address is saved) and a heads-up for an early start tomorrow. Tapping the card opens the
// trip at today's section. Logic in src/core/daybrief.ts; renders nothing when no trip is on today.
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { dayBrief } from '../core/daybrief.ts';
import { formatDuration, formatTime, zoneCity } from '../core/format.ts';
import type { Item, Trip } from '../core/model.ts';
import { ThemeOverride, useApp } from '../state/app.tsx';
import { radius, space, typeScale } from '../theme/tokens.ts';
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
import { carDueBack } from '../core/followups100.ts';
import { RentalBriefRow } from './followups100.tsx';
import { LeaveHomeBriefRow } from './leavehome.tsx';
import { ComeHomeBriefRow } from './comehome.tsx';
import { LayoverBriefRow } from './layovers.tsx';
import { GapsBriefRow } from './gaps.tsx';
import { OutfitBriefRow } from './outfits.tsx';
import { PhotoLightBriefRow } from './photolight.tsx';
import { RainBriefRow } from './rainplan.tsx';
import { CheckinBriefRow, CheckoutBriefRow } from './checkin.tsx';
import { KidsBriefRow } from './kids.tsx';
import { PostcardsBriefRow } from './followups107.tsx';

export const DayBriefCard = memo(function DayBriefCard({ trips }: { trips: Trip[] }) {
  const { theme, t } = useApp();
  const router = useRouter();
  const now = useMinute();
  const [airportPrefs] = useAirportPrefs();
  const maps = useMapsOnPhone();
  const b = dayBrief(trips, now);
  // T101: next medicine dose under the trip's saved plan (empty with no medicines saved). Hook before the early return.
  const dose = useNextDoseLine(b?.trip ?? null, b?.zone ?? '', now);
  // The card is printed on buff ticket stock, so the brief rows (stay, golden hour, check-in, call home...) that were
  // drawn for a dark banner get ink-on-paper colours here: their hero text tokens map to ink and muted.
  const paperTheme = useMemo(
    () => ({ ...theme, heroInk: theme.ink, heroMuted: theme.muted, heroAccent: theme.ink, heroWash: theme.line, heroChip: theme.line }),
    [theme],
  );
  if (!b) return null;
  // T109: stay details for the stay you're in right now on this trip (by real instants, across zones).
  const stay = currentStay([b.trip], now);
  // T123: the rental car due back today (drop-off today where you are, not yet passed): its leave-by line.
  const car = carDueBack(b.trip, b.zone, b.today, now);

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
  const muted = [typeScale.body, { color: theme.muted }];

  return (
    <ThemeOverride theme={paperTheme}>
    <View style={{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.stock.buff }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint={t('brief.openHint', { trip: b.trip.name })}
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: b.trip.id, day: b.today } })}
        style={{ padding: space.l, gap: space.s }}
      >
        {/* Design pass 3: printed on buff ticket stock; the headline leads, the "Your day" line follows it. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <KindIcon kind={n?.item.kind ?? b.first?.kind ?? 'activity'} color={theme.ink} size={22} />
          <Text style={[typeScale.displayM, { color: theme.ink, flex: 1, fontVariant: ['tabular-nums'] }]}>{headline}</Text>
        </View>
        <Text style={[typeScale.caption, { color: theme.muted }]}>{eyebrow}</Text>
        {holiday ? <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{holiday}</Text> : null}
        {lines.map((l) => (
          <Text key={l} style={muted}>
            {l}
          </Text>
        ))}
        {flight ? (
          <View style={{ gap: 2 }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{flight.line}</Text>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{flight.guidance}</Text>
          </View>
        ) : null}
        {b.tonight && !b.tonight.hasAddress ? <Text style={muted}>{tonight}</Text> : null}
        {early ? <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{early}</Text> : null}
        {due ? <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{due}</Text> : null}
        {dose ? <Text style={muted}>{dose}</Text> : null}
      </PressableScale>
      {b.tonight && b.tonight.hasAddress ? (
        <>
          <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.muted, opacity: 0.6 }} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('brief.tonightOpen', { name: hotelName })}
            accessibilityHint={t('brief.tonightHint')}
            onPress={() => b.tonight && router.push({ pathname: '/address/[id]', params: { id: b.tonight.item.id } })}
            style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
          >
            <KindIcon kind="hotel" color={theme.ink} size={18} />
            <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.ink, flex: 1 }]}>
              {tonight}
            </Text>
          </PressableScale>
        </>
      ) : null}
      {/* T135: "No stay booked for tonight" (a night gap today, not dismissed); a tap adds a stay from tonight. */}
      {b.tonight ? null : <GapsBriefRow trip={b.trip} today={b.today} />}
      {stay ? (
        <>
          <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.muted, opacity: 0.6 }} />
          <StayBriefRow item={stay.item} />
        </>
      ) : null}
      {car ? (
        <>
          <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.muted, opacity: 0.6 }} />
          <RentalBriefRow item={car} zone={b.zone} />
        </>
      ) : null}
      {/* T136: "Today's outfit: Linen shirt, Shorts, Sandals" when one is planned for today. */}
      <OutfitBriefRow trip={b.trip} today={b.today} />
      {/* T139: "Golden hour 17:42–18:21" at today's place, until it is over for the day. */}
      <PhotoLightBriefRow trip={b.trip} today={b.today} now={now} />
      {/* T140: "Rain from 14:00: plan B for Park picnic" (cached forecast; nothing without one). */}
      <RainBriefRow trip={b.trip} today={b.today} now={now} />
      {/* T143: "Online check-in for EA 25 opens 09:15 today" (open now / closed and not ticked). */}
      <CheckinBriefRow trip={b.trip} now={now} />
      {/* T146: "Check out of Hotel Gracery by 11:00 today" on a stay's last morning, until ticked. */}
      <CheckoutBriefRow trip={b.trip} now={now} />
      {/* T149: "Kids: Train to Kyoto at 11:00, 2h 15m" with snacks / sleep (nothing without children on the trip). */}
      <KidsBriefRow trip={b.trip} now={now} />
      {/* T151: "A free afternoon: 2 postcards to write" (no timed booking 12:00-18:00 here, someone not yet sent). */}
      <PostcardsBriefRow trip={b.trip} today={b.today} zone={b.zone} now={now} />
      {/* T131: "Change at Singapore: 1 h 25 min, terminal 1 to 3" on the day of a change. */}
      <LayoverBriefRow trip={b.trip} zone={b.zone} today={b.today} now={now} />
      {/* T114: "Good time to call Mum until 21:00" (nothing with nobody saved). */}
      <CallHomeBriefRow trip={b.trip} />
      {/* T124: "Before you lock the door: today · 3 of 12 left" on the day you leave. */}
      <LeaveHomeBriefRow trip={b.trip} now={now} />
      {/* T128: "Before you head home: today · 3 of 6 left" on the last days, "Home again" the day after. T134: not
          while the Trips tab's Heading home card shows this trip (same `trips`). */}
      <ComeHomeBriefRow trip={b.trip} trips={trips} now={now} />
    </View>
    </ThemeOverride>
  );
});
