// T86: "Trip recaps" on Your travels: one row per trip that has started (newest first), each opening its recap.
// Demo trips follow the screen's "Include demo trips" switch. Each row shows the trip's cover as a small tile.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { tripCover } from '../core/covers.ts';
import { deviceZone, formatRange, todayIn } from '../core/format.ts';
import { recapTrips } from '../core/recap.ts';
import { tripSpan } from '../core/travelstats.ts';
import { useApp } from '../state/app.tsx';
import { useTrips } from '../state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { SectionCard } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { TripCover } from './TripCover.tsx';

export function RecapList({ includeDemo }: { includeDemo: boolean }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const today = todayIn(deviceZone());
  const list = useMemo(() => recapTrips(trips, today, includeDemo), [trips, today, includeDemo]);
  if (!list.length) return null;
  return (
    <SectionCard icon="sparkles-outline" tone="accent" title={t('recap.list.title')} subtitle={t('recap.list.subtitle')}>
      {list.map((trip, i) => {
        const span = tripSpan(trip);
        const dates = formatRange(span.start, span.end, lang);
        return (
          <PressableScale
            key={trip.id}
            accessibilityRole="button"
            accessibilityLabel={t('recap.list.row', { trip: trip.name, dates })}
            accessibilityHint={t('recap.list.hint')}
            onPress={() => router.push(`/recap/${trip.id}`)}
            style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}
          >
            <TripCover scene={tripCover(trip)} aspectRatio={1.4} rounded={radius.s} label={null} style={{ width: 56 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.ink }]}>
                {trip.name}
              </Text>
              <Text style={[typeScale.small, { color: theme.muted }]}>{dates}</Text>
            </View>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </View>
          </PressableScale>
        );
      })}
    </SectionCard>
  );
}
