// T132 Getting around entry points (src/core/getaround.ts, src/content/getaround.json):
// - GETAROUND_TABLE: the bundled guide (works offline).
// - useSummaryText: a row's summary lines in words ("Cards: Suica, PASMO · Tap your bank card: yes").
// - GetaroundTripCard: trip screen card, one row per covered trip country (at most GETAROUND_TRIP_MAX, trip order).
// - GetaroundMapButton: Map tab button for the first covered country of the trip on now (else the next one).
// The arrival card adds its own HeroButton (src/ui/ArrivalCard.tsx).
// Tokens only, 48 pt targets, every control labelled, timed motion only.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import table from '../content/getaround.json';
import { homeCountryFor } from '../core/arrival.ts';
import { summaryLines, tripGetaroundCountries, type Contactless, type GetaroundRow, type GetaroundTable } from '../core/getaround.ts';
import type { Trip } from '../core/model.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { space, TOUCH, typeScale } from '../theme/tokens.ts';
import { IconBadge, SectionCard } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { Button, PressableScale } from './kit.tsx';

export const GETAROUND_TABLE = table as unknown as GetaroundTable;
export const GETAROUND_TRIP_MAX = 3;

const SUMMARY_CONTACTLESS: Record<Contactless, Key> = {
  yes: 'getaround.summary.contactless.yes',
  some: 'getaround.summary.contactless.some',
  no: 'getaround.summary.contactless.no',
};

/** The row's summary lines as words, joined with a middle dot; '' when the row has none. */
export function summaryText(t: T, row: GetaroundRow, max = 2): string {
  return summaryLines(row, max)
    .map((l) => (l.id === 'tickets' ? t('getaround.summary.tickets', { names: l.names.join(', ') }) : l.id === 'contactless' ? t(SUMMARY_CONTACTLESS[l.answer]) : t('getaround.summary.rides')))
    .join(' · ');
}

/** The trip's covered countries, home left out, in trip order. */
export function useTripGetaround(trip: Pick<Trip, 'items' | 'homeTz'> | null): GetaroundRow[] {
  const { homeIso } = useHomeCountry();
  return useMemo(() => (trip ? tripGetaroundCountries(trip, homeCountryFor(trip, homeIso), GETAROUND_TABLE) : []), [trip, homeIso]);
}

/** Trip screen: "Getting around Japan" rows with a one-line summary. Nothing when no trip country is covered. */
export function GetaroundTripCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const rows = useTripGetaround(trip).slice(0, GETAROUND_TRIP_MAX);
  if (!rows.length) return null;
  return (
    <SectionCard icon="train-outline" tone="sea" title={t('getaround.tripTitle')} subtitle={t('getaround.tripSubtitle')}>
      <View>
        {rows.map((r, i) => {
          const label = t('getaround.rowFor', { country: r.country });
          const summary = summaryText(t, r);
          return (
            <View key={r.iso2} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={summary ? `${label}. ${summary}` : label}
                accessibilityHint={t('getaround.rowHint', { country: r.country })}
                onPress={() => router.push({ pathname: '/getaround/[country]', params: { country: r.iso2, tripId: trip.id } })}
                style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}
              >
                <IconBadge name="train-outline" tone="sea" size="s" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typeScale.bodyStrong, { color: theme.accentInk }]}>{label}</Text>
                  {summary ? (
                    <Text numberOfLines={2} style={[typeScale.small, { color: theme.muted }]}>
                      {summary}
                    </Text>
                  ) : null}
                </View>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </View>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

/** Map tab: one button for the first covered country of the given trip. Nothing when none is covered. */
export function GetaroundMapButton({ trip }: { trip: Trip | null }) {
  const { t } = useApp();
  const router = useRouter();
  const row = useTripGetaround(trip)[0];
  if (!trip || !row) return null;
  return (
    <Button
      kind="secondary"
      icon="train-outline"
      label={t('getaround.mapButton', { country: row.country })}
      hint={t('getaround.mapButtonHint', { country: row.country })}
      onPress={() => router.push({ pathname: '/getaround/[country]', params: { country: row.iso2, tripId: trip.id } })}
    />
  );
}
