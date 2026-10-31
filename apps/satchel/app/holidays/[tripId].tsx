// T106 Holidays on this trip: for each country on the trip (from the bookings, each in its own zone), the public
// holidays on the days you're there, what that country's list leaves out (regional days, lunar-calendar days…),
// countries Satchel has no list for, and the "general guidance, verify locally" line. Logic in src/core/holidays.ts.
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { formatDay } from '../../src/core/format.ts';
import { HOLIDAY_YEARS, HOLIDAYS_CHECKED, notesFor } from '../../src/core/holidays.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { space, typeScale } from '../../src/theme/tokens.ts';
import { holidayCountryName, HolidayRow, useTripHolidays } from '../../src/ui/HolidaysCard.tsx';
import { FadeInView, SectionCard } from '../../src/ui/hero.tsx';
import { Body, EmptyState, Label, Screen } from '../../src/ui/kit.tsx';

export default function HolidaysScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  const view = useTripHolidays(trip);

  if (!trip || !view) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('holidays.title')} body={t('holidays.notFound')} />
      </Screen>
    );
  }

  const covered = view.stops.filter((s) => s.covered);
  // One section per country, in the order the trip reaches them (a country visited twice shows once).
  const countries = [...new Map(covered.map((s) => [s.iso2, s])).values()];
  return (
    <Screen>
      <Stack.Screen options={{ title: t('holidays.route') }} />
      <FadeInView style={{ gap: space.m }}>
        <Body>{t('holidays.intro')}</Body>
        {!view.stops.length ? <Body muted>{t('holidays.noStops')}</Body> : null}
        {view.stops.length && !view.list.length ? <Body muted>{t('holidays.empty')}</Body> : null}
        {countries.map((s) => {
          const rows = view.list.filter((h) => h.iso2 === s.iso2);
          return (
            <SectionCard key={s.iso2} title={holidayCountryName(s.iso2)} subtitle={t('holidays.countryDates', { from: formatDay(s.from, lang), to: formatDay(s.to, lang) })} icon="flag-outline" tone="teal">
              {rows.length ? (
                <View>
                  {rows.map((h, i) => (
                    <HolidayRow key={`${h.date}-${h.name}-${i}`} h={h} showCountry={false} first={i === 0} />
                  ))}
                </View>
              ) : (
                <Text style={[typeScale.body, { color: theme.muted }]}>{t('holidays.card.none')}</Text>
              )}
              <View accessible style={{ gap: 2 }}>
                <Label>{t('holidays.notShown')}</Label>
                {notesFor(s.iso2).map((n) => (
                  <Text key={n} style={[typeScale.small, { color: theme.muted }]}>
                    {t(`holidays.note.${n}` as Key)}
                  </Text>
                ))}
              </View>
            </SectionCard>
          );
        })}
        {view.uncovered.length ? <Body muted>{t('holidays.uncovered', { countries: view.uncovered.map(holidayCountryName).join(', ') })}</Body> : null}
        {view.outside ? <Body muted>{t('holidays.outsideYears', { from: String(HOLIDAY_YEARS.from), to: String(HOLIDAY_YEARS.to) })}</Body> : null}
        {view.list.length ? <Body>{t('holidays.closures')}</Body> : null}
        <Body muted>{t('holidays.guidance')}</Body>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('holidays.checked', { date: formatDay(HOLIDAYS_CHECKED, lang) })}</Text>
      </FadeInView>
    </Screen>
  );
}
