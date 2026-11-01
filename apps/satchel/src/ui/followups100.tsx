// T123 run-100 follow-ups (offline parts), UI side. Logic in src/core/followups100.ts.
// - EssentialsDriving: on the Low-battery essentials screen (pure black, white text, no animation), one compact
//   "Drive on the LEFT / RIGHT" line per country the trip on now (else next) has a car booking in, with the speed
//   unit; each opens the driving guide.
// - RentalBriefRow: under "Your day" on the day a rental car goes back, the rental checklist's "Leave by {time} to
//   return by {back}" (or "due back by" until a travel time is set); opens the rental checklist.
// Tokens only, 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { homeCountryFor } from '../core/arrival.ts';
import { returnPlan, type Moment } from '../core/driving.ts';
import { deviceZone, formatTime, todayIn, zoneCity } from '../core/format.ts';
import { essentialsDriving } from '../core/followups100.ts';
import type { Item } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useRental } from '../state/rental.ts';
import { useTrips } from '../state/trips.tsx';
import { essentials, fonts, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { DRIVING_TABLE, sideKey } from './driving.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { PressableScale } from './kit.tsx';

/** Low-battery essentials: driving lines for the trip on now (else next). Nothing when it has no car abroad. */
export function EssentialsDriving() {
  const { t } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const { homeIso } = useHomeCountry();
  const today = todayIn(deviceZone());
  const pick = useMemo(() => essentialsDriving(trips, today, DRIVING_TABLE, (trip) => homeCountryFor(trip, homeIso)), [trips, today, homeIso]);
  if (!pick) return null;
  return (
    <View style={{ gap: space.m, borderTopWidth: 1, borderTopColor: essentials.line, paddingTop: space.l }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, color: essentials.ink }}>
        {t('f100.ess.heading')}
      </Text>
      {pick.banners.map((b) => {
        const side = t(sideKey(b.side));
        const body = t('driving.banner.body', { country: b.country, unit: t(b.speed === 'mph' ? 'driving.unit.mph' : 'driving.unit.kmh') });
        return (
          <Pressable
            key={b.iso2}
            accessibilityRole="button"
            accessibilityLabel={`${side}. ${body}`}
            accessibilityHint={t('driving.banner.hint', { country: b.country })}
            onPress={() => router.push({ pathname: '/driving/[iso2]', params: { iso2: b.iso2, tripId: pick.tripId } })}
            style={{ minHeight: TOUCH, borderWidth: 1, borderColor: essentials.ink, borderRadius: radius.m, padding: space.l, gap: space.xs }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: essentials.ink }}>{side}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24, color: essentials.ink }}>{body}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: essentials.ink, textDecorationLine: 'underline' }}>{t('f100.ess.open')}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A time on the drop-off's clock, with its city when that isn't the zone you're in. */
const at = (t: T, m: Moment, zone: string) => (m.tz === zone ? formatTime(m.local) : t('brief.timeZone', { time: formatTime(m.local), city: zoneCity(m.tz) }));

/** Your day: the leave-by line for the car going back today (the caller picks it with core carDueBack). */
export function RentalBriefRow({ item, zone }: { item: Item; zone: string }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [checklist] = useRental(item.id);
  const plan = returnPlan(item, checklist.travelMin);
  if (!plan) return null;
  const back = at(t, plan.returnAt, zone);
  const line = plan.leaveAt ? t('driving.return.leaveBy', { time: at(t, plan.leaveAt, zone), back }) : t('f100.brief.carBack', { back });
  const sub = plan.leaveAt ? t('driving.return.leaveByFoot', { n: plan.bufferMin }) : t('f100.brief.carBackSet');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${line}. ${sub}`}
      accessibilityHint={t('f100.brief.rentalHint')}
      onPress={() => router.push({ pathname: '/rental/[itemId]', params: { itemId: item.id } })}
      style={{ minHeight: TOUCH, paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="car-outline" size={18} color={theme.heroAccent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{line}</Text>
        <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{sub}</Text>
      </View>
    </PressableScale>
  );
}
