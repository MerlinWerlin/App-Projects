// T101: the Medicine times entry row (Emergency tab and trip screen, same look as the I'm safe card) and the
// "next dose" line for Your day. Opens app/meds.tsx. Medicines come from this phone only (src/state/meds.ts).
// T104: on the Emergency tab the row also shows the next dose (the trip that is on, in the zone you're in, under its
// plan; otherwise at home on the phone's clock).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { dayBrief } from '../core/daybrief.ts';
import { deviceZone, formatDay, formatTime } from '../core/format.ts';
import { doseDayShift, nextDoseForTrip, nextDoseNow } from '../core/medtimes.ts';
import type { Trip } from '../core/model.ts';
import { useApp } from '../state/app.tsx';
import { useMeds } from '../state/meds.ts';
import { useTrips } from '../state/trips.tsx';
import { elevated, fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { useMinute } from './TripPass.tsx';

export function MedTimesCard({ tripId }: { tripId?: string }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const [store] = useMeds();
  const { trips } = useTrips();
  const now = useMinute();
  const n = store.meds.length;
  const body = tripId ? t('meds.entryTripBody') : n === 0 ? t('meds.entryBody') : n === 1 ? t('meds.entryBodyOne') : t('meds.entryBodyCount', { n });
  let next = '';
  if (!tripId && n > 0) {
    const b = dayBrief(trips, now);
    const dose = nextDoseNow(store, b?.trip ?? null, deviceZone(), b?.zone ?? '', now);
    if (dose) {
      const shift = doseDayShift(dose, now);
      const time = formatTime(dose.local);
      next =
        shift <= 0
          ? t('f95.next.today', { name: dose.med.name, time })
          : shift === 1
            ? t('f95.next.tomorrow', { name: dose.med.name, time })
            : t('f95.next.later', { name: dose.med.name, time, date: formatDay(dose.local.slice(0, 10), lang) });
    }
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('meds.entry')}
      accessibilityHint={[next, body, t('meds.entryHint')].filter(Boolean).join(' ')}
      onPress={() => router.push(tripId ? { pathname: '/meds', params: { tripId } } : '/meds')}
      style={{
        minHeight: TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderRadius: radius.l,
        ...elevated(theme, 'low'),
      }}
    >
      <IconBadge name="medkit-outline" tone="teal" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('meds.entry')}</Text>
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {body}
        </Text>
        {next ? (
          <Text numberOfLines={2} style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.teal }}>
            {next}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </PressableScale>
  );
}

/** Your day: "Next medicine (your plan): <name> at 14:00", or '' with no medicines saved. */
export function useNextDoseLine(trip: Trip | null, zone: string, now: number): string {
  const { t } = useApp();
  const [store] = useMeds();
  const next = trip && zone ? nextDoseForTrip(store, trip, deviceZone(), zone, now) : null;
  if (!next) return '';
  return t('meds.brief.next', { name: next.med.name, time: formatTime(next.local) });
}
