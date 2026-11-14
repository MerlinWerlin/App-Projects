// T170 Today timetable for one trip (owner, 14 Nov: "a today like schedule sorta like a school day but pretty with a
// tomorrow as well but like an option to check each day"), opened from a trip or the Trips tab card. The timetable
// itself is src/ui/TripDays.tsx, shared with the Itinerary tab; a trip with nothing on it shows "Add your itinerary".
import { Stack, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { EmptyState, Screen } from '../../src/ui/kit.tsx';
import { ItineraryStart, TripDays } from '../../src/ui/TripDays.tsx';
import { ShareItinerary } from '../../src/ui/ShareItinerary.tsx';

export default function TodayScreen() {
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);

  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('today.route')} body={t('today.notFound')} />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: trip.name, headerRight: trip.items.length ? () => <ShareItinerary trip={trip} compact /> : undefined }} />
      {trip.items.length ? (
        <TripDays trip={trip} initialDay={typeof day === 'string' ? day : undefined} />
      ) : (
        <Screen>
          <ItineraryStart trip={trip} />
        </Screen>
      )}
    </>
  );
}
