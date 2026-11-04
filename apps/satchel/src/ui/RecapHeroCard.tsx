// T88: the Trips tab's Trip recap card. A small hero-style card for the latest finished trip (or the sample trip
// when no real trip has finished: src/core/followups91.ts latestRecapTrip) with the trip's cover, its headline
// numbers and the best day, opening the existing recap route (app/recap/[tripId].tsx). Timed fade only.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { tripCover } from '../core/covers.ts';
import { deviceZone, formatDay, todayIn } from '../core/format.ts';
import { latestRecapTrip, recapToday } from '../core/followups91.ts';
import { journalToday } from '../core/journal.ts';
import type { Trip } from '../core/model.ts';
import { tripRecap } from '../core/recap.ts';
import { useApp } from '../state/app.tsx';
import { radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, GradientFill } from './hero.tsx';
import { moodKey } from './journal.tsx';
import { PressableScale } from './kit.tsx';
import { TripCover } from './TripCover.tsx';
import { countryName, formatInt } from './useTravelStats.ts';

export function RecapHeroCard({ trips }: { trips: Trip[] }) {
  const today = todayIn(deviceZone());
  const trip = useMemo(() => latestRecapTrip(trips, today), [trips, today]);
  if (!trip) return null;
  return <RecapHeroInner trip={trip} />;
}

function RecapHeroInner({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const day = recapToday(trip, journalToday(trip));
  const r = useMemo(() => tripRecap(trip, day, { countryName }), [trip, day]);
  if (!r.available) return null;
  const cities = r.cities.length === 1 ? t('recap.slot.citiesOne') : t('recap.slot.cities', { n: r.cities.length });
  const body = t('f91.home.body', { days: r.days, cities, km: formatInt(r.distance.km, lang) });
  const b = r.bestDay;
  const best = b ? t('f91.home.best', { day: b.dayNumber != null ? t('f91.home.dayLabel', { n: b.dayNumber }) : formatDay(b.day, lang), mood: t(moodKey(b.mood)) }) : null;
  const summary = [body, best].filter(Boolean).join('. ');
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('f91.home.a11y', { trip: trip.name, summary })}
        accessibilityHint={t('f91.home.hint')}
        onPress={() => router.push(`/recap/${trip.id}`)}
        style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.trips[0] }, shadowOf(theme, 'low')]}
      >
        <GradientFill tone="trips" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, minHeight: TOUCH }}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <TripCover scene={tripCover(trip)} aspectRatio={1} rounded={radius.m} label={null} style={{ width: 64 }} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Ionicons name="sparkles" size={14} color={theme.heroAccent} />
              <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{r.demo ? t('f91.home.eyebrowSample') : t('f91.home.eyebrow')}</Text>
            </View>
            <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk }]}>
              {trip.name}
            </Text>
            <Text style={[typeScale.small, { color: theme.heroInk }]}>{body}</Text>
            {best ? <Text style={[typeScale.small, { color: theme.heroMuted }]}>{best}</Text> : null}
          </View>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Ionicons name="chevron-forward" size={18} color={theme.heroMuted} />
          </View>
        </View>
      </PressableScale>
    </FadeInView>
  );
}
