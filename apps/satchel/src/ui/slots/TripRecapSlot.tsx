// T86: the trip screen's Trip recap card, shown once the trip has started (in the zone the traveller is in). A
// gradient card with the headline numbers (days, cities, km travelled) that opens app/recap/[tripId].tsx; while
// the trip is on it says "so far". Hidden for trips that haven't started.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { journalToday } from '../../core/journal.ts';
import type { Trip } from '../../core/model.ts';
import { tripRecap } from '../../core/recap.ts';
import { useApp } from '../../state/app.tsx';
import { radius, shadowOf, space, typeScale } from '../../theme/tokens.ts';
import { FadeInView, GradientFill } from '../hero.tsx';
import { PressableScale } from '../kit.tsx';
import { countryName, formatInt } from '../useTravelStats.ts';

export function TripRecapSlot({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const today = journalToday(trip);
  const r = useMemo(() => tripRecap(trip, today, { countryName }), [trip, today]);
  if (!r.available) return null;
  const cities = r.cities.length === 1 ? t('recap.slot.citiesOne') : t('recap.slot.cities', { n: r.cities.length });
  const body = r.phase === 'active' ? t('recap.slot.bodySoFar') : t('recap.slot.body', { days: r.days, cities, km: formatInt(r.distance.km, lang) });
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('recap.slot.a11y', { summary: body })}
        accessibilityHint={t('recap.slot.hint')}
        onPress={() => router.push(`/recap/${trip.id}`)}
        style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.map[0] }, shadowOf(theme, 'low')]}
      >
        <GradientFill tone="map" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, minHeight: 48 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={22} color={theme.heroAccent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('recap.slot.title')}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{body}</Text>
          </View>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Ionicons name="chevron-forward" size={18} color={theme.heroMuted} />
          </View>
        </View>
      </PressableScale>
    </FadeInView>
  );
}
