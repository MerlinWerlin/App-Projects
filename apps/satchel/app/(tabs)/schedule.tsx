// T171 Itinerary tab (owner, 14 Nov: "it should be its own tab down in the middle"). Always works, trip on now or
// not: no trips or no plans -> "Add your itinerary" with every way in (calendar file, paste, your own AI, by hand);
// otherwise the trip's timetable (Today / Tomorrow, the day strip, swipe between days; src/ui/TripDays.tsx). With
// more than one trip a switcher sits at the top, opening on the trip on now, else the next, else the last
// (src/core/dayview.ts scheduleTrip). The choice lasts while the app is open. Offline.
// 1.0 feedback: the whole tab scrolls as one page (header included), so the last day's last plan is reachable.
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleTrip } from '../../src/core/dayview.ts';
import { formatRange } from '../../src/core/format.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { FitWordsText } from '../../src/ui/hero.tsx';
import { TITLE_MAX_FONT_MULTIPLIER } from '../../src/core/titlefit.ts';
import { usePersisted } from '../../src/state/persisted.ts';
import { chosenTrip, FOCUS_TRIP_KEY, NO_FOCUS } from '../../src/core/tripfocus.ts';
import { space, typeScale } from '../../src/theme/tokens.ts';
import { Chip } from '../../src/ui/kit.tsx';
import { ItineraryStart, TripDays } from '../../src/ui/TripDays.tsx';
import { RemindersOffer } from '../../src/ui/RemindersOffer.tsx';
import { Mascot } from '../../src/ui/Mascot.tsx';
import { ShareItinerary } from '../../src/ui/ShareItinerary.tsx';
import { useMinute } from '../../src/ui/TripPass.tsx';

export default function ScheduleTab() {
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const insets = useSafeAreaInsets();
  const now = useMinute();
  // 1.0 feedback (multiple trips): the same pick as Home's Your trips row, kept on the phone.
  const [picked, setPicked] = usePersisted<string | null>(FOCUS_TRIP_KEY, NO_FOCUS);
  const sorted = useMemo(() => [...trips].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)), [trips]);
  const fallback = useMemo(() => scheduleTrip(trips, now), [trips, now]);
  const trip = chosenTrip(sorted, picked, fallback);

  // 1.0 feedback (scroll): the title, the trip switcher and the reminders offer scroll with the day, as one page.
  const head = (
    <View style={{ gap: space.s }}>
      <View style={{ paddingHorizontal: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ flex: 1, gap: 2 }} accessible accessibilityRole="header">
          {/* 1.0 feedback: never "Itine / rary" at the largest text size. */}
          <FitWordsText text={t('tab.itinerary')} maxFontSizeMultiplier={TITLE_MAX_FONT_MULTIPLIER} style={{ ...typeScale.displayL, color: theme.ink }} />
          {trip ? <Text style={[typeScale.small, { color: theme.muted }]}>{`${trip.name} · ${formatRange(trip.startDate, trip.endDate, lang)}`}</Text> : null}
        </View>
        <Mascot pose="itinerary" size={88} />
        {/* T174: share the itinerary to another phone (calendar file, Satchel file or text). */}
        {trip && trip.items.length ? <ShareItinerary trip={trip} compact /> : null}
      </View>
      {sorted.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: space.s, paddingHorizontal: space.l }}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('schedule.switcher')}
        >
          {sorted.map((x) => (
            <Chip key={x.id} label={x.name} selected={trip?.id === x.id} hint={t('schedule.switchHint', { range: formatRange(x.startDate, x.endDate, lang) })} onPress={() => setPicked(x.id)} />
          ))}
        </ScrollView>
      ) : null}
      {/* Trip reminders: a quiet one-time offer while they're off and a real trip has plans coming up. */}
      {trip && trip.items.length ? <RemindersOffer now={now} style={{ marginHorizontal: space.l }} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + space.m }}>
      {trip && trip.items.length ? (
        <TripDays key={trip.id} trip={trip} inTab header={head} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
          {head}
          <View style={{ padding: space.l }}>
            <ItineraryStart trip={trip ?? undefined} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
