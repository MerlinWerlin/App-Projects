// T124 leaving home: the due line, the "Lock up today / tomorrow" pill on the trip card, the trip screen card, the
// Your day row and the Trips tab card for the day before. Logic in src/core/leavehome.ts. Motion is the timed
// FadeInView only (Reduce Motion respected there); colours from theme tokens.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { dayBrief } from '../core/daybrief.ts';
import { formatDay, zoneCity } from '../core/format.ts';
import { leaveDue, leaveNudge, nextLeaveNudge, type LeaveDue } from '../core/leavehome.ts';
import type { Trip } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { elevated, radius, shadowOf, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, GradientFill, IconBadge, ProgressBar } from './hero.tsx';
import { PressableScale } from './kit.tsx';

/** "Today, before your 07:00 departure", "Leaving Thu 1 Apr at 07:00 (Sydney time)", "You've left." */
export function dueLine(t: T, d: LeaveDue, lang: string): string {
  const time = d.time;
  switch (d.when) {
    case 'today':
      return time ? t('leavehome.due.today', { time }) : t('leavehome.due.todayNoTime');
    case 'tomorrow':
      return time ? t('leavehome.due.tomorrow', { time }) : t('leavehome.due.tomorrowNoTime');
    case 'later': {
      const date = formatDay(d.dep.stamp.local.slice(0, 10), lang);
      return time ? t('leavehome.due.later', { date, time, city: zoneCity(d.dep.stamp.tz) }) : t('leavehome.due.laterNoTime', { date });
    }
    default:
      return t('leavehome.due.gone');
  }
}

/** "3 of 12 left", "All done" or "Checklist not started". */
export function leftLine(t: T, d: LeaveDue): string {
  if (!d.started) return t('leavehome.notStarted');
  return d.progress.open === 0 ? t('leavehome.leftNone') : t('leavehome.left', { open: d.progress.open, total: d.progress.total });
}

/** A fresh `now` each time the screen gains focus (no ticking timer needed for a day-level nudge). */
function useFocusNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  return now;
}

/** Trip card pill: "Lock up tomorrow" / "Lock up today" (nothing otherwise). */
export const LeaveHomePill = memo(function LeaveHomePill({ due }: { due: LeaveDue | null }) {
  const { t, theme } = useApp();
  if (!due || (due.when !== 'today' && due.when !== 'tomorrow')) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, backgroundColor: theme.accentSoft, paddingHorizontal: space.m, paddingVertical: space.xs }}>
        <Ionicons name="key-outline" size={14} color={theme.accentInk} />
        <Text style={[typeScale.caption, { color: theme.ink }]}>{t(due.when === 'today' ? 'leavehome.pill.today' : 'leavehome.pill.tomorrow')}</Text>
      </View>
    </View>
  );
});

/** The spoken part the trip row adds when the pill shows. */
export function leavePillA11y(t: T, due: LeaveDue | null): string {
  if (!due || (due.when !== 'today' && due.when !== 'tomorrow')) return '';
  return t('leavehome.pill.a11y', { when: t(due.when === 'today' ? 'leavehome.brief.today' : 'leavehome.brief.tomorrow'), left: leftLine(t, due) });
}

/** Trip screen: the leaving-home card (progress and due line); hidden once you've left. */
export function LeaveHomeTripCard({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const now = useFocusNow();
  const due = useMemo(() => leaveDue(trip, now), [trip, now]);
  if (!due || due.when === 'gone') return null;
  const soon = due.when === 'today' || due.when === 'tomorrow';
  const line = dueLine(t, due, lang);
  const progress = due.started ? t('leavehome.card.progress', { done: due.progress.done, total: due.progress.total }) : t('leavehome.notStarted');
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[t('leavehome.card.title'), line, progress].join('. ')}
        accessibilityHint={t('leavehome.card.hint')}
        onPress={() => router.push({ pathname: '/leavehome/[tripId]', params: { tripId: trip.id } })}
        style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, gap: space.s }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <IconBadge name="key-outline" tone={soon ? 'accent' : 'sea'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.title, { color: theme.ink }]}>{t('leavehome.card.title')}</Text>
            <Text style={[typeScale.small, { color: soon ? theme.accentInk : theme.muted }]}>{line}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </View>
        </View>
        {due.started && due.progress.total ? (
          <ProgressBar progress={due.progress.done / due.progress.total} tone="ok" label={progress} />
        ) : (
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('leavehome.card.sub')}</Text>
        )}
      </PressableScale>
    </FadeInView>
  );
}

/** Your day: "Before you lock the door: today · 3 of 12 left" for the brief's trip (nothing otherwise). */
export function LeaveHomeBriefRow({ trip, now }: { trip: Trip; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const due = leaveNudge(trip, now);
  if (!due) return null;
  const line = t('leavehome.brief.line', { when: t(due.when === 'today' ? 'leavehome.brief.today' : 'leavehome.brief.tomorrow'), left: leftLine(t, due) });
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={line}
        accessibilityHint={t('leavehome.brief.hint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/leavehome/[tripId]', params: { tripId: trip.id } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="key-outline" size={18} color={theme.heroAccent} />
        </View>
        <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
          {line}
        </Text>
      </PressableScale>
    </>
  );
}

/**
 * Trips tab: a Your day card for leaving home when the departure is today or tomorrow and no Your day brief already
 * shows it (the day before a trip, there is no brief yet).
 */
export const LeaveHomeHomeCard = memo(function LeaveHomeHomeCard({ trips }: { trips: Trip[] }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const now = useFocusNow();
  const next = useMemo(() => nextLeaveNudge(trips, now), [trips, now]);
  const briefTrip = useMemo(() => dayBrief(trips, now)?.trip.id ?? null, [trips, now]);
  if (!next || briefTrip === next.trip.id) return null;
  const { trip, due } = next;
  const head = t(due.when === 'today' ? 'leavehome.brief.headToday' : 'leavehome.brief.headTomorrow');
  const line = dueLine(t, due, lang);
  const left = leftLine(t, due);
  const eyebrow = t('leavehome.brief.eyebrow');
  return (
    <FadeInView>
      <View style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.map[0] }, shadowOf(theme, 'mid')]}>
        <GradientFill tone="map" />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={[eyebrow, head, trip.name, line, left].join('. ')}
          accessibilityHint={t('leavehome.brief.hint', { trip: trip.name })}
          onPress={() => router.push({ pathname: '/leavehome/[tripId]', params: { tripId: trip.id } })}
          style={{ padding: space.l, gap: space.s }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="key-outline" size={18} color={theme.heroAccent} />
            </View>
            <Text style={[typeScale.caption, { color: theme.heroMuted, flex: 1 }]}>{eyebrow}</Text>
          </View>
          <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{head}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{trip.name}</Text>
          <Text style={[typeScale.body, { color: theme.heroMuted }]}>{line}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{t('leavehome.brief.line', { when: t(due.when === 'today' ? 'leavehome.brief.today' : 'leavehome.brief.tomorrow'), left })}</Text>
        </PressableScale>
      </View>
    </FadeInView>
  );
});
