// T171 Itinerary tab (owner, 14 Nov: "it should be its own tab down in the middle"). Always works, trip on now or
// not: no trips or no plans -> "Add your itinerary" with every way in (calendar file, paste, your own AI, by hand);
// otherwise the trip's timetable (Today / Tomorrow, the day strip, swipe between days; src/ui/TripDays.tsx). With
// more than one trip a switcher sits at the top, opening on the trip on now, else the next, else the last
// (src/core/dayview.ts scheduleTrip). The choice lasts while the app is open. Offline.
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleTrip } from '../../src/core/dayview.ts';
import { formatRange } from '../../src/core/format.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { space, typeScale } from '../../src/theme/tokens.ts';
import { Chip } from '../../src/ui/kit.tsx';
import { ItineraryStart, TripDays } from '../../src/ui/TripDays.tsx';
import { useMinute } from '../../src/ui/TripPass.tsx';

export default function ScheduleTab() {
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const insets = useSafeAreaInsets();
  const now = useMinute();
  const [picked, setPicked] = useState<string | null>(null);
  const sorted = useMemo(() => [...trips].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)), [trips]);
  const fallback = useMemo(() => scheduleTrip(trips, now), [trips, now]);
  const trip = sorted.find((x) => x.id === picked) ?? fallback;

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + space.m }}>
      <View style={{ paddingHorizontal: space.l, gap: 2 }} accessible accessibilityRole="header">
        <Text style={[typeScale.displayM, { color: theme.ink }]}>{t('tab.itinerary')}</Text>
        {trip ? <Text style={[typeScale.small, { color: theme.muted }]}>{`${trip.name} · ${formatRange(trip.startDate, trip.endDate, lang)}`}</Text> : null}
      </View>
      {sorted.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginTop: space.s }}
          contentContainerStyle={{ gap: space.s, paddingHorizontal: space.l }}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('schedule.switcher')}
        >
          {sorted.map((x) => (
            <Chip key={x.id} label={x.name} selected={trip?.id === x.id} hint={t('schedule.switchHint', { range: formatRange(x.startDate, x.endDate, lang) })} onPress={() => setPicked(x.id)} />
          ))}
        </ScrollView>
      ) : null}
      {trip && trip.items.length ? (
        <TripDays key={trip.id} trip={trip} inTab />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: space.xxl }}>
          <ItineraryStart trip={trip ?? undefined} />
        </ScrollView>
      )}
    </View>
  );
}
