// Jared's 1.0 feedback (multiple trips): every trip in one row under the Home head, each by its own title, with
// "New trip" at the end. Picking one makes it the trip Home and the Itinerary tab show (src/core/tripfocus.ts, kept
// on the phone); its pass below still opens the trip itself. Shown once there is a trip; the New trip chip goes
// through the usual form (which asks for the trial or unlock exactly as Add trip always has).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { formatRange } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { useApp } from '../state/app.tsx';
import { space } from '../theme/tokens.ts';
import { Chip, Label } from './kit.tsx';
import { destinationUnderTitle, useTripPlace } from './tripPlace.ts';

function TripChip({ trip, selected, onPick }: { trip: Trip; selected: boolean; onPick: () => void }) {
  const { t, lang } = useApp();
  const where = destinationUnderTitle(t, trip.name, useTripPlace(trip));
  const range = formatRange(trip.startDate, trip.endDate, lang);
  return (
    <Chip
      label={trip.name}
      selected={selected}
      a11yLabel={[trip.name, where, range].filter(Boolean).join(', ')}
      hint={t('tripSwitch.hint')}
      onPress={onPick}
    />
  );
}

export function TripSwitcher({ trips, currentId, onPick }: { trips: readonly Trip[]; currentId: string | null; onPick: (id: string) => void }) {
  const { t, theme } = useApp();
  const router = useRouter();
  if (!trips.length) return null;
  return (
    <View style={{ gap: space.xs }}>
      <Label>{t('tripSwitch.title')}</Label>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.s }}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('tripSwitch.title')}
      >
        {trips.map((x) => (
          <TripChip key={x.id} trip={x} selected={x.id === currentId} onPick={() => onPick(x.id)} />
        ))}
        <Chip
          label={t('tripSwitch.new')}
          selected={false}
          icon={<Ionicons name="add" size={16} color={theme.ink} />}
          hint={t('spec41.trips.addHint')}
          onPress={() => router.push('/trip-edit')}
        />
      </ScrollView>
    </View>
  );
}
