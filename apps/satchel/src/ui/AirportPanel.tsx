// T74 airport day, the showing side: the ticket / boarding-pass block for a flight (terminal, gate and boarding big,
// bag drop, the countdown to the next step, "Leave by" always labelled as general guidance, and any warnings) and the
// Your day card's leave-by line. Times are on the departure airport's clock. Logic in src/core/leaveby.ts.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { formatDuration, zoneCity } from '../core/format.ts';
import { airportCountdown, airportPlan, flightToday, readAirport, type AirportStep } from '../core/leaveby.ts';
import type { Item, LocalDate, Trip } from '../core/model.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { leaveText, useAirportPrefs, warningTexts } from './AirportFields.tsx';
import { Body, Button, Card, Label, Warning } from './kit.tsx';
import { useMinute } from './TripPass.tsx';

const COUNT_KEY: Record<AirportStep, Key> = {
  leave: 'airport.count.leave',
  bagDrop: 'airport.count.bagDrop',
  boarding: 'airport.count.boarding',
  departure: 'airport.count.departure',
};

/** The airport block on the ticket view. Renders nothing for other kinds or a flight whose departure can't be placed. */
/** `framed` wraps it in a card (the booking detail screen); the ticket view puts it inside its own card. */
export function AirportPanel({ item, framed }: { item: Item; framed?: boolean }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [prefs] = useAirportPrefs();
  const now = useMinute();
  const plan = airportPlan(item, prefs);
  if (!plan) return null;
  const a = readAirport(item.airport) ?? {};
  const city = zoneCity(plan.tz);
  const count = airportCountdown(plan, now);
  const facts: Array<[string, string]> = [];
  if (a.terminal) facts.push([t('airport.terminal'), a.terminal]);
  if (a.gate) facts.push([t('airport.gate'), a.gate]);
  if (plan.boarding && !plan.warnings.includes('boardingAfterDeparture')) facts.push([t('airport.boarding'), plan.boarding.local.slice(11, 16)]);
  const countText = count ? t(COUNT_KEY[count.step], { d: formatDuration(count.minutes) }) : '';
  const leave = count ? leaveText(plan, t) : '';

  const body = (
    <View style={{ gap: space.s }}>
      {facts.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.l }}>
          {facts.map(([label, value]) => (
            <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2, minWidth: 80 }}>
              <Label>{label}</Label>
              <Text selectable style={{ fontFamily: fonts.display, fontSize: 30, color: theme.ink, fontVariant: ['tabular-nums'], letterSpacing: 0.5 }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {plan.boarding && !plan.warnings.includes('boardingAfterDeparture') ? <Body muted>{t('item.zone', { time: plan.boarding.local.slice(11, 16), city })}</Body> : null}
      {plan.bagDrop && !plan.warnings.includes('bagDropAfterDeparture') ? (
        <Body>{`${t('airport.bagDrop')}: ${t('item.zone', { time: plan.bagDrop.local.slice(11, 16), city })}`}</Body>
      ) : null}
      {count ? (
        <View
          accessible
          accessibilityLabel={t('airport.ticket.a11y', { count: countText, leave, guidance: t('airport.guidance') })}
          style={{ gap: space.xs, backgroundColor: theme.accentSoft, borderRadius: radius.m, padding: space.m }}
        >
          <Text style={[typeScale.title, { color: theme.accentInk, fontVariant: ['tabular-nums'] }]}>{countText}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{leave}</Text>
          {count.leavePassed && count.step !== 'leave' ? <Body>{t('airport.count.leavePassed')}</Body> : null}
          {!plan.leaveBy ? <Body muted>{t('airport.noTravel')}</Body> : null}
          <Body muted>{t('airport.guidance')}</Body>
        </View>
      ) : null}
      {warningTexts(plan, t).map((w) => (
        <Warning key={w} text={w} />
      ))}
      {/* T127: straight to the lost-bag report for this trip's bags. */}
      <Button
        kind="quiet"
        icon="briefcase-outline"
        label={t('lostbag.entry.airport')}
        hint={t('lostbag.entry.airportHint')}
        onPress={() => router.push({ pathname: '/lostbag', params: { tripId: item.tripId, mode: 'report' } })}
      />
    </View>
  );
  return framed ? <Card>{body}</Card> : body;
}

/**
 * The Your day line for a flight today ("Leave by 17:00 for the 21:00 flight") and its guidance label, or null.
 * Times carry the airport's city when it isn't the zone the traveller is in.
 */
export function briefAirportLine(trip: Trip, zone: string, today: LocalDate, now: number, prefs: Parameters<typeof flightToday>[4], t: T): { line: string; guidance: string } | null {
  const f = flightToday(trip.items, zone, today, now, prefs);
  if (!f) return null;
  const { plan } = f;
  const at = (local: string) => {
    const time = local.slice(11, 16);
    return plan.tz === zone ? time : t('brief.timeZone', { time, city: zoneCity(plan.tz) });
  };
  const dep = at(plan.departure.local);
  const line = plan.leaveBy ? t('airport.brief.leave', { leave: at(plan.leaveBy.local), dep }) : t('airport.brief.arrive', { arrive: at(plan.arriveBy.local), dep });
  return { line, guidance: t('airport.brief.guidance') };
}
