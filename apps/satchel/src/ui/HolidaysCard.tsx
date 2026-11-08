// T106 Public holidays on your trip: the "Holidays on this trip" card on the trip screen, the small "Holiday" badge
// on timeline day headers, and the one-line "Today is <holiday>" used by the arrival card and Your day. Logic in
// src/core/holidays.ts (stops and their zones from the bookings, as the arrival card reads them); always labelled
// general guidance, verify locally. Opens app/holidays/[tripId].tsx.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import emergencyTable from '../content/emergency_numbers.json';
import essentialsTable from '../content/country_essentials.json';
import { countryNameFrom, homeCountryFor } from '../core/arrival.ts';
import type { EmergencyTable } from '../core/emergency.ts';
import type { EssentialsTable } from '../core/essentials.ts';
import { formatDay } from '../core/format.ts';
import { holidayStops, holidaysByDate, outsideYears, tripHolidays, uncoveredStops, type HolidayToday, type TripHoliday } from '../core/holidays.ts';
import type { Trip } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { SectionCard } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';

const TABLES = { essentials: essentialsTable as EssentialsTable, emergency: emergencyTable as unknown as EmergencyTable };
/** Rows on the trip-screen card before "+n more". */
const CARD_ROWS = 3;

export const holidayCountryName = (iso2: string): string => countryNameFrom(TABLES, iso2);

/** Everything the card, badge and screen need for one trip. */
export function useTripHolidays(trip: Trip | undefined) {
  const { homeIso } = useHomeCountry();
  return useMemo(() => {
    if (!trip) return null;
    const home = homeCountryFor(trip, homeIso);
    const list = tripHolidays(trip, home);
    return {
      list,
      byDate: holidaysByDate(list),
      stops: holidayStops(trip, home),
      uncovered: uncoveredStops(trip, home),
      outside: outsideYears(trip),
    };
  }, [trip, homeIso]);
}

/** "Today is Greenery Day, a public holiday here." (null when today isn't one). */
export function holidayTodayLine(t: T, today: HolidayToday | null): string | null {
  if (!today || !today.holidays.length) return null;
  const names = [...new Set(today.holidays.map((h) => h.name))];
  return names.length === 1 ? t('holidays.today', { name: names[0] }) : t('holidays.todayMany', { names: names.join(', ') });
}

/** One holiday row: date and name, then a "day off in place of…" or "not everywhere" line when it applies. */
export function HolidayRow({ h, showCountry, first }: { h: TripHoliday; showCountry: boolean; first?: boolean }) {
  const { t, theme, lang } = useApp();
  const day = formatDay(h.date, lang);
  const country = holidayCountryName(h.iso2);
  const extra = [h.substitute ? t('holidays.substitute') : null, h.partial ? t('holidays.partial') : null, showCountry ? country : null].filter(Boolean).join(' · ');
  return (
    <View
      accessible
      accessibilityLabel={[t('holidays.rowA11y', { day, name: h.name, country }), h.substitute ? t('holidays.substitute') : null, h.partial ? t('holidays.partial') : null].filter(Boolean).join('. ')}
      style={{ paddingVertical: space.xs, borderTopWidth: first ? 0 : 1, borderTopColor: theme.line, gap: 2 }}
    >
      <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('holidays.row', { day, name: h.name })}</Text>
      {extra ? <Text style={[typeScale.small, { color: theme.muted }]}>{extra}</Text> : null}
    </View>
  );
}

/** Trip screen: "Holidays on this trip" with the first few, the closures line, and "See all". Nothing without stops. */
export function HolidaysCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const view = useTripHolidays(trip);
  if (!view || !view.stops.length) return null;
  const { list } = view;
  const many = new Set(list.map((h) => h.iso2)).size > 1;
  const subtitle = list.length === 0 ? undefined : list.length === 1 ? t('holidays.card.countOne') : t('holidays.card.count', { n: list.length });
  return (
    <SectionCard
      title={t('holidays.card.title')}
      subtitle={subtitle}
      icon="flag-outline"
      tone="teal"
      action={{ label: t('holidays.card.open'), hint: t('holidays.card.openHint'), onPress: () => router.push(`/holidays/${trip.id}`) }}
    >
      {list.length === 0 ? <Text style={[typeScale.body, { color: theme.muted }]}>{t('holidays.card.none')}</Text> : null}
      {list.length ? (
        <View>
          {list.slice(0, CARD_ROWS).map((h, i) => (
            <HolidayRow key={`${h.iso2}-${h.date}-${h.name}-${i}`} h={h} showCountry={many} first={i === 0} />
          ))}
          {list.length > CARD_ROWS ? <Text style={[typeScale.small, { color: theme.muted, paddingTop: space.xs }]}>{t('holidays.card.more', { n: list.length - CARD_ROWS })}</Text> : null}
        </View>
      ) : null}
      {list.length ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('holidays.closures')}</Text> : null}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('holidays.guidance')}</Text>
    </SectionCard>
  );
}

/** Timeline day header: a small "Holiday" pill, labelled with the holiday names. */
export function HolidayBadge({ holidays }: { holidays: readonly TripHoliday[] | undefined }) {
  const { t, theme } = useApp();
  if (!holidays || !holidays.length) return null;
  const names = [...new Set(holidays.map((h) => h.name))].join(', ');
  return (
    <View
      accessible
      accessibilityLabel={t('holidays.badgeA11y', { names })}
      style={{ alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: theme.tealSoft }}
    >
      <Text numberOfLines={2} style={[typeScale.caption, { color: theme.teal }]}>
        {t('holidays.badge')} · {names}
      </Text>
    </View>
  );
}
