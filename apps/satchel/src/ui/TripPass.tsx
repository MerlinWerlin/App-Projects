// T50 Trips home pieces: the trip as a boarding pass (colour stripe, route codes, perforation with notches, stub with
// dates / days / bookings, status pill and a progress bar while the trip is on), the destination-vs-home clock and
// today's mini timeline. Each card is memoised; the two live cards keep their own one-minute ticker so the list
// itself never re-renders on the clock.
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatRange, formatTime, zoneCity } from '../core/format.ts';
import { agendaBesideBrief } from '../core/daybrief.ts';
import { clockPair, countdown, formatOffset, tripDays, tripRoute, type Countdown } from '../core/glance.ts';
import type { CoverId } from '../core/covers.ts';
import type { DrivingBanner } from '../core/driving.ts';
import type { Trip } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { elevated, radius, space, typeScale } from '../theme/tokens.ts';
import { IconBadge, ProgressBar, SectionCard, toneColours, type Tone } from './hero.tsx';
import { KIND_ICON, KIND_TONE, kindKey } from './kinds.tsx';
import { TripCover } from './TripCover.tsx';
import { DriveSidePill } from './driving.tsx';

/** Short status for a trip: "In 12 days", "Tomorrow", "Starts today", "Day 3 of 9", "Finished". */
export function countdownShort(t: T, c: Countdown): string {
  switch (c.kind) {
    case 'upcoming':
      return c.days === 1 ? t('design.pass.tomorrow') : t('design.pass.startsIn', { n: c.days });
    case 'today':
      return t('design.pass.today');
    case 'active':
      return t('design.pass.progress', { day: c.day, total: c.total });
    default:
      return t('design.pass.past');
  }
}

/** Headline for the hero: "Tokyo in 12 days", "Tokyo tomorrow", "Today: Tokyo", "Day 3 of 9 in Tokyo". */
export function countdownHeadline(t: T, c: Countdown, place: string): string {
  switch (c.kind) {
    case 'upcoming':
      return c.days === 1 ? t('design.trips.countdownTomorrow', { place }) : t('design.trips.countdown', { place, n: c.days });
    case 'today':
      return t('design.trips.countdownToday', { place });
    case 'active':
      return t('design.trips.countdownActive', { day: c.day, total: c.total, place });
    default:
      return place;
  }
}

/** One-minute ticker for live cards (clock, agenda). */
export function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const PHASE_TONE: Record<Countdown['kind'], Tone> = { upcoming: 'sea', today: 'accent', active: 'ok', past: 'ink' };

/**
 * The boarding-pass body of a trip row (the caller wraps it in its pressable and gives the spoken label).
 * T83: `cover` adds the trip's illustrated cover as a strip across the top.
 * T122: `driving` adds a "Drive on the LEFT / RIGHT" pill for trips with a car booking abroad.
 */
export const TripPass = memo(function TripPass({ trip, today, cover, driving }: { trip: Trip; today: string; cover?: CoverId; driving?: readonly DrivingBanner[] }) {
  const { theme, t, lang } = useApp();
  const c = countdown(trip, today);
  const route = tripRoute(trip);
  const tone = PHASE_TONE[c.kind];
  const { fg, bg } = toneColours(theme, tone);
  const stripe = c.kind === 'past' ? theme.muted : fg;
  const bookings = trip.items.filter((i) => i.kind !== 'note').length;
  const notch = { position: 'absolute' as const, top: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: theme.paper };
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        elevated(theme, 'low'),
        { borderRadius: radius.l, opacity: c.kind === 'past' ? 0.78 : 1 },
      ]}
    >
      {cover ? (
        <View style={{ borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, overflow: 'hidden' }}>
          <TripCover scene={cover} aspectRatio={3.4} rounded={0} label={null} />
        </View>
      ) : null}
      <View style={{ height: 6, backgroundColor: stripe, borderTopLeftRadius: cover ? 0 : radius.l, borderTopRightRadius: cover ? 0 : radius.l }} />
      <View style={{ padding: space.l, gap: space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Text numberOfLines={1} style={[typeScale.title, { color: theme.ink, flex: 1 }]}>
            {trip.name}
          </Text>
          {trip.demo ? (
            <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, paddingHorizontal: space.s, paddingVertical: 2 }}>
              <Text style={[typeScale.caption, { color: theme.muted }]}>{t('trips.demoBadge')}</Text>
            </View>
          ) : null}
          <View style={{ borderRadius: radius.pill, backgroundColor: bg, paddingHorizontal: space.m, paddingVertical: space.xs }}>
            <Text style={[typeScale.caption, { color: fg, fontVariant: ['tabular-nums'] }]}>{countdownShort(t, c)}</Text>
          </View>
        </View>
        {route ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <View style={{ minWidth: 72 }}>
              <Text style={[typeScale.caption, { color: theme.muted }]}>{t('design.pass.from')}</Text>
              <Text style={[typeScale.displayL, { color: theme.ink }]}>{route.fromCode}</Text>
              <Text numberOfLines={1} style={[typeScale.small, { color: theme.muted }]}>
                {route.fromCity}
              </Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <View style={{ flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.line }} />
              <Ionicons name="airplane" size={20} color={c.kind === 'past' ? theme.muted : theme.accent} />
              <View style={{ flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.line }} />
            </View>
            <View style={{ minWidth: 72, alignItems: 'flex-end' }}>
              <Text style={[typeScale.caption, { color: theme.muted }]}>{t('design.pass.to')}</Text>
              <Text style={[typeScale.displayL, { color: theme.ink }]}>{route.toCode}</Text>
              <Text numberOfLines={1} style={[typeScale.small, { color: theme.muted }]}>
                {route.toCity}
              </Text>
            </View>
          </View>
        ) : null}
        {driving?.length && c.kind !== 'past' ? <DriveSidePill banners={driving} /> : null}
        {c.kind === 'active' ? <ProgressBar progress={c.progress} tone="ok" label={t('design.pass.progressA11y', { day: c.day, total: c.total })} /> : null}
      </View>
      {/* Perforation with a notch cut out of each edge, like a torn-off stub. */}
      <View style={{ height: 0, marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.line }}>
        <View style={[notch, { left: -space.l - 11 }]} />
        <View style={[notch, { right: -space.l - 11 }]} />
      </View>
      <View style={{ flexDirection: 'row', padding: space.l, paddingTop: space.m, gap: space.m }}>
        <Stub label={t('design.pass.dates')} value={formatRange(trip.startDate, trip.endDate, lang)} grow />
        <Stub label={t('design.pass.days')} value={String(tripDays(trip))} />
        <Stub label={t('design.pass.bookings')} value={String(bookings)} />
      </View>
    </View>
  );
});

function Stub({ label, value, grow }: { label: string; value: string; grow?: boolean }) {
  const { theme } = useApp();
  return (
    <View style={{ flex: grow ? 1 : undefined, gap: 2 }}>
      <Text style={[typeScale.caption, { color: theme.muted }]}>{label}</Text>
      <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
    </View>
  );
}

/** Destination clock vs home, updated every minute. Renders nothing when the zones can't be read. */
export const ClockCard = memo(function ClockCard({ destTz, homeTz }: { destTz: string; homeTz: string }) {
  const { theme, t } = useApp();
  const now = useMinute();
  const c = clockPair(destTz, homeTz, now);
  if (!c) return null;
  const off = formatOffset(c.diffMinutes);
  const diff = off ? t('design.clock.ahead', { d: off }) : t('design.clock.same');
  return (
    <View accessible accessibilityLabel={t('design.clock.a11y', { dest: c.destCity, destTime: c.destTime, home: c.homeCity, homeTime: c.homeTime, diff })}>
      <SectionCard title={t('design.clock.title')} icon="time-outline" tone="teal">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.l }}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.displayXL, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{c.destTime}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.teal }]}>{c.destCity}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{t('design.clock.home')}</Text>
            <Text style={[typeScale.displayM, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{c.homeTime}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{c.homeCity}</Text>
          </View>
        </View>
        <Text style={[typeScale.small, { color: theme.muted }]}>{diff}</Text>
      </SectionCard>
    </View>
  );
});

/**
 * Today's bookings across trips on now, as a small vertical timeline (done / now / later). Nothing when empty.
 * T72: while "Your day" shows, that trip's bookings are left to it (src/core/daybrief.ts agendaBesideBrief).
 */
export const TodayCard = memo(function TodayCard({ trips, max = 4 }: { trips: Trip[]; max?: number }) {
  const { theme, t } = useApp();
  const now = useMinute();
  const rows = agendaBesideBrief(trips, now).slice(0, max);
  if (!rows.length) return null;
  return (
    <SectionCard title={t('design.today.title')} icon="today-outline" tone="accent">
      <View style={{ gap: 0 }}>
        {rows.map((r, i) => {
          const tone = KIND_TONE[r.item.kind];
          const dot = r.state === 'now' ? theme.accent : r.state === 'done' ? theme.line : toneColours(theme, tone).fg;
          const stateText = t(`design.today.${r.state}`);
          const time = formatTime(r.item.start.local);
          return (
            <View
              key={r.item.id}
              accessible
              accessibilityLabel={t('design.today.rowA11y', { state: stateText, kind: t(kindKey(r.item.kind)), title: r.item.title, time, city: zoneCity(r.item.start.tz) })}
              style={{ flexDirection: 'row', gap: space.m, opacity: r.state === 'done' ? 0.6 : 1 }}
            >
              <View style={{ alignItems: 'center', width: 14 }}>
                <View style={{ width: 2, flex: 1, backgroundColor: i === 0 ? 'transparent' : theme.line }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot, borderWidth: r.state === 'now' ? 3 : 0, borderColor: theme.accentSoft }} />
                <View style={{ width: 2, flex: 1, backgroundColor: i === rows.length - 1 ? 'transparent' : theme.line }} />
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}>
                <Text style={[typeScale.bodyStrong, { color: theme.ink, width: 52, fontVariant: ['tabular-nums'] }]}>{time}</Text>
                <IconBadge name={KIND_ICON[r.item.kind]} tone={tone} size="s" />
                <Text numberOfLines={1} style={[typeScale.body, { color: theme.ink, flex: 1 }]}>
                  {r.item.title}
                </Text>
                {r.state === 'now' ? <Text style={[typeScale.caption, { color: theme.accentInk }]}>{stateText}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
});
