// T115: entry points into the local customs guide (app/customs/[iso2].tsx).
// - CustomsLink: a card row for the Emergency tab, right after the country essentials card (same look as the
//   Trouble / hotel shortcut rows). Renders nothing for a country the guide does not cover.
// - CustomsReadRows: "Read the customs for Japan" rows for the trip readiness card, one per covered trip country
//   (at most CUSTOMS_READ_MAX), in trip order.
// Tokens only, 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import table from '../content/customs.json';
import { homeCountryFor } from '../core/arrival.ts';
import { findCustoms, tripCustomsCountries, type CustomsTable } from '../core/customs.ts';
import type { Trip } from '../core/model.ts';
import { useApp } from '../state/app.tsx';
import { radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { PressableScale } from './kit.tsx';

export const CUSTOMS_TABLE = table as unknown as CustomsTable;
export const CUSTOMS_READ_MAX = 3;

export function CustomsLink({ iso2, tripId }: { iso2: string; tripId?: string }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const row = findCustoms(CUSTOMS_TABLE, iso2);
  if (!row) return null;
  const body = t('customs.linkBody', { country: row.country });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('customs.linkTitle')}. ${body}`}
      accessibilityHint={t('customs.linkHint', { country: row.country })}
      onPress={() => router.push({ pathname: '/customs/[iso2]', params: { iso2: row.iso2, ...(tripId ? { tripId } : {}) } })}
      style={{
        minHeight: TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderRadius: radius.l,
        borderWidth: theme.dark ? 1 : 0,
        borderColor: theme.line,
        backgroundColor: theme.cardRaised,
        ...shadowOf(theme, 'low'),
      }}
    >
      <IconBadge name="people-outline" tone="teal" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('customs.linkTitle')}</Text>
        <Text numberOfLines={3} style={[typeScale.small, { color: theme.muted }]}>
          {body}
        </Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="chevron-forward" size={20} color={theme.muted} />
      </View>
    </PressableScale>
  );
}

/** "Read the customs for <country>" rows for the readiness card. Nothing when no trip country is covered. */
export function CustomsReadRows({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const { homeIso } = useHomeCountry();
  const rows = useMemo(() => tripCustomsCountries(trip, homeCountryFor(trip, homeIso), CUSTOMS_TABLE).slice(0, CUSTOMS_READ_MAX), [trip, homeIso]);
  if (!rows.length) return null;
  return (
    <View>
      {rows.map((r) => (
        <View key={r.iso2} style={{ borderTopWidth: 1, borderTopColor: theme.line }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('customs.readFor', { country: r.country })}
            accessibilityHint={t('customs.readForHint', { country: r.country })}
            onPress={() => router.push({ pathname: '/customs/[iso2]', params: { iso2: r.iso2, tripId: trip.id } })}
            style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}
          >
            <IconBadge name="people-outline" tone="teal" size="s" />
            <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.accentInk }]}>{t('customs.readFor', { country: r.country })}</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </View>
          </PressableScale>
        </View>
      ))}
    </View>
  );
}
