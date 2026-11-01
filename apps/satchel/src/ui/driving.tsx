// T122 Driving abroad entry points (src/core/driving.ts, src/content/driving.json):
// - DriveSideBanner: "Drive on the LEFT / RIGHT" on the trip screen, one per country with a car booking.
// - DriveSidePill + driveSideA11y: the same on the trip card (TripPass) and in the trip row's spoken label.
// - DrivingLink: "Driving in <country>" card row for the customs guide country screen.
// - ItemRentalSlot: the "Rental car checklist" card on a car booking's detail screen.
// Tokens only, 48 pt targets, every control labelled, timed motion only.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import table from '../content/driving.json';
import { homeCountryFor } from '../core/arrival.ts';
import { cardSide, checklistProgress, findDriving, isCarBooking, isEmptyRental, tripDrivingBanners, type DrivingBanner, type DrivingTable, type Side } from '../core/driving.ts';
import type { Item, Trip } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useRental } from '../state/rental.ts';
import { radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, IconBadge, SectionCard } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { PressableScale } from './kit.tsx';

export const DRIVING_TABLE = table as unknown as DrivingTable;

export const sideKey = (side: Side) => (side === 'left' ? 'driving.side.left' : 'driving.side.right') as 'driving.side.left' | 'driving.side.right';
export const sideIcon = (side: Side) => (side === 'left' ? 'arrow-back' : 'arrow-forward') as 'arrow-back' | 'arrow-forward';

/** The trip's car-country banners, home country left out. */
export function useDrivingBanners(trip: Pick<Trip, 'items' | 'homeTz'>): DrivingBanner[] {
  const { homeIso } = useHomeCountry();
  return useMemo(() => tripDrivingBanners(trip, DRIVING_TABLE, homeCountryFor(trip, homeIso)), [trip, homeIso]);
}

/** What the trip row says aloud ("Drive on the LEFT in Japan"), or '' when the trip has no covered car booking. */
export function driveSideA11y(t: T, banners: readonly DrivingBanner[]): string {
  const side = cardSide(banners);
  if (!side) return '';
  if (side === 'mixed') return t('driving.card.mixed');
  return t('driving.card.a11y', { side: t(sideKey(side)), countries: banners.map((b) => b.country).join(', ') });
}

/** A small pill on the trip card. Decorative: the row's spoken label carries driveSideA11y. */
export const DriveSidePill = memo(function DriveSidePill({ banners }: { banners: readonly DrivingBanner[] }) {
  const { t, theme } = useApp();
  const side = cardSide(banners);
  if (!side) return null;
  const label = side === 'mixed' ? t('driving.card.mixed') : t(sideKey(side));
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, backgroundColor: theme.warnSoft, paddingHorizontal: space.m, paddingVertical: space.xs }}>
        <Ionicons name={side === 'mixed' ? 'swap-horizontal-outline' : sideIcon(side)} size={14} color={theme.warn} />
        <Ionicons name="car-outline" size={14} color={theme.warn} />
        <Text style={[typeScale.caption, { color: theme.ink }]}>{label}</Text>
      </View>
    </View>
  );
});

/** Trip screen: one banner per country the trip has a car booking in. Each opens the driving guide there. */
export function DriveSideBanner({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const banners = useDrivingBanners(trip);
  if (!banners.length) return null;
  return (
    <View style={{ gap: space.s }}>
      {banners.map((b, i) => {
        const title = t(sideKey(b.side));
        const body = t('driving.banner.body', { country: b.country, unit: t(b.speed === 'mph' ? 'driving.unit.mph' : 'driving.unit.kmh') });
        return (
          <FadeInView key={b.iso2} delay={i * 40}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${body}`}
              accessibilityHint={t('driving.banner.hint', { country: b.country })}
              onPress={() => router.push({ pathname: '/driving/[iso2]', params: { iso2: b.iso2, tripId: trip.id } })}
              style={{
                minHeight: TOUCH,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.m,
                paddingHorizontal: space.l,
                paddingVertical: space.m,
                borderRadius: radius.l,
                backgroundColor: theme.warnSoft,
                borderLeftWidth: 4,
                borderLeftColor: theme.warn,
              }}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 2 }}>
                <Ionicons name={sideIcon(b.side)} size={22} color={theme.warn} />
                <Ionicons name="car-outline" size={22} color={theme.warn} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typeScale.bodyStrong, { color: theme.ink, letterSpacing: 0.4 }]}>{title}</Text>
                <Text style={[typeScale.small, { color: theme.ink }]}>{body}</Text>
              </View>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name="chevron-forward" size={20} color={theme.muted} />
              </View>
            </PressableScale>
          </FadeInView>
        );
      })}
    </View>
  );
}

/** "Driving in <country>" row (customs guide country screen). Nothing for a country the guide doesn't cover. */
export function DrivingLink({ iso2, tripId }: { iso2: string; tripId?: string }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const row = findDriving(DRIVING_TABLE, iso2);
  if (!row) return null;
  const title = t('driving.linkTitle', { country: row.country });
  const body = `${t(sideKey(row.side))} · ${t('driving.linkBody')}`;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityHint={t('driving.linkHint', { country: row.country })}
      onPress={() => router.push({ pathname: '/driving/[iso2]', params: { iso2: row.iso2, ...(tripId ? { tripId } : {}) } })}
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
      <IconBadge name="car-outline" tone="warn" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
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

/** Booking detail: the rental car checklist card on every car booking. */
export function ItemRentalSlot({ item }: { item: Item }) {
  const { t } = useApp();
  const router = useRouter();
  const [checklist] = useRental(item.id);
  if (!isCarBooking(item)) return null;
  const empty = isEmptyRental(checklist);
  const p = checklistProgress(checklist);
  return (
    <SectionCard
      title={t('driving.slot.title')}
      subtitle={empty ? t('driving.slot.empty') : t('driving.rental.progress', { done: p.done, total: p.total })}
      icon="car-outline"
      tone="warn"
      action={{
        label: empty ? t('driving.slot.start') : t('driving.slot.open'),
        hint: t('driving.slot.openHint'),
        onPress: () => router.push({ pathname: '/rental/[itemId]', params: { itemId: item.id } }),
      }}
    />
  );
}
