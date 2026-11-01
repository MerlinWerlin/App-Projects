// T128 coming home: the due line, the "Heading home today / tomorrow" pill on the trip card, the trip screen card
// and the Your day row. T130: the Trips tab hero card while the before-you-head-home list is due today / tomorrow. Logic in src/core/comehome.ts. Motion is the timed FadeInView only (Reduce Motion respected
// there); colours from theme tokens.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { comeDue, comeNudge, homeAgainNudge, lastCheckout, nextComeNudge, readComingHome, type ComeDue } from '../core/comehome.ts';
import { formatDay, zoneCity } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { elevated, radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, GradientFill, IconBadge, ProgressBar } from './hero.tsx';
import { PressableScale } from './kit.tsx';

/** "Today, before your 22:00 departure", "Heading home Wed 7 Apr at 22:00 (Tokyo time)", "Welcome home". */
export function comeDueLine(t: T, d: ComeDue, lang: string): string {
  const time = d.time;
  switch (d.when) {
    case 'today':
      return time ? t('comehome.due.today', { time }) : t('comehome.due.todayNoTime');
    case 'tomorrow':
      return time ? t('comehome.due.tomorrow', { time }) : t('comehome.due.tomorrowNoTime');
    case 'later': {
      const date = formatDay(d.dep.stamp.local.slice(0, 10), lang);
      return time ? t('comehome.due.later', { date, time, city: zoneCity(d.dep.stamp.tz) }) : t('comehome.due.laterNoTime', { date });
    }
    case 'travelling':
      return t('comehome.due.travelling');
    case 'home':
      return t('comehome.due.home');
    default:
      return t('comehome.due.done');
  }
}

/** "3 of 6 left", "All done" or "Lists not started" for one list. */
export function comeLeftLine(t: T, d: ComeDue, list: 'before' | 'after'): string {
  const p = d[list];
  if (!d.started) return t('comehome.notStarted');
  return p.open === 0 ? t('comehome.leftNone') : t('comehome.left', { open: p.open, total: p.total });
}

function useFocusNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  return now;
}

const whenWord = (t: T, d: ComeDue) => t(d.when === 'today' ? 'comehome.brief.today' : 'comehome.brief.tomorrow');

/** Trip card pill: "Heading home tomorrow" / "Heading home today" (nothing otherwise). */
export const ComeHomePill = memo(function ComeHomePill({ due }: { due: ComeDue | null }) {
  const { t, theme } = useApp();
  if (!due || (due.when !== 'today' && due.when !== 'tomorrow')) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, backgroundColor: theme.seaSoft, paddingHorizontal: space.m, paddingVertical: space.xs }}>
        <Ionicons name="home-outline" size={14} color={theme.sea} />
        <Text style={[typeScale.caption, { color: theme.ink }]}>{t(due.when === 'today' ? 'comehome.pill.today' : 'comehome.pill.tomorrow')}</Text>
      </View>
    </View>
  );
});

/** The spoken part the trip row adds when the pill shows. */
export function comePillA11y(t: T, due: ComeDue | null): string {
  if (!due || (due.when !== 'today' && due.when !== 'tomorrow')) return '';
  return t('comehome.pill.a11y', { when: whenWord(t, due), left: comeLeftLine(t, due, 'before') });
}

/**
 * Trip screen: the coming-home card (due line and the list that matters now). Shows from three days before the final
 * departure until the Home again day is over; hidden otherwise.
 */
export function ComeHomeTripCard({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const now = useFocusNow();
  const due = useMemo(() => comeDue(trip, now), [trip, now]);
  if (!due || due.when === 'done' || (due.when === 'later' && due.days > 3)) return null;
  const soon = due.when !== 'later';
  const list = due.when === 'travelling' || due.when === 'home' ? 'after' : 'before';
  const p = due[list];
  const line = comeDueLine(t, due, lang);
  const progress = due.started ? t('comehome.card.progress', { done: p.done, total: p.total }) : t('comehome.notStarted');
  const head = t(list === 'after' ? 'comehome.after.title' : 'comehome.before.title');
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[t('comehome.card.title'), line, head, progress].join('. ')}
        accessibilityHint={t('comehome.card.hint')}
        onPress={() => router.push({ pathname: '/comehome/[tripId]', params: { tripId: trip.id } })}
        style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, gap: space.s }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <IconBadge name="home-outline" tone={soon ? 'accent' : 'sea'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.title, { color: theme.ink }]}>{t('comehome.card.title')}</Text>
            <Text style={[typeScale.small, { color: soon ? theme.accentInk : theme.muted }]}>{line}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </View>
        </View>
        {due.started && p.total ? (
          <>
            <Text style={[typeScale.small, { color: theme.ink }]}>{head}</Text>
            <ProgressBar progress={p.done / p.total} tone="ok" label={progress} />
          </>
        ) : (
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('comehome.card.sub')}</Text>
        )}
      </PressableScale>
    </FadeInView>
  );
}

/** Your day: "Before you head home: today · 3 of 6 left", or "Home again · 2 of 6 left" (nothing otherwise). */
export function ComeHomeBriefRow({ trip, now }: { trip: Trip; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const heading = comeNudge(trip, now);
  const back = heading ? null : homeAgainNudge(trip, now);
  const due = heading ?? back;
  if (!due) return null;
  const line = heading ? t('comehome.brief.line', { when: whenWord(t, heading), left: comeLeftLine(t, heading, 'before') }) : t('comehome.brief.homeLine', { left: comeLeftLine(t, due, 'after') });
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={line}
        accessibilityHint={t('comehome.brief.hint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/comehome/[tripId]', params: { tripId: trip.id } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="home-outline" size={18} color={theme.heroAccent} />
        </View>
        <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
          {line}
        </Text>
      </PressableScale>
    </>
  );
}

/**
 * T130 Trips tab: a hero card like the leaving-home one ("Heading home tomorrow") while a trip's before-you-head-home
 * list is due today or tomorrow and not finished (or not started); the soonest departure wins. Opens that trip's
 * coming-home lists. Shown alongside Your day (which keeps its one-line row) because the last days of a trip always
 * have a brief, so hiding behind it would hide the card every time.
 */
export const ComeHomeHomeCard = memo(function ComeHomeHomeCard({ trips }: { trips: Trip[] }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const now = useFocusNow();
  const next = useMemo(() => nextComeNudge(trips, now), [trips, now]);
  if (!next) return null;
  const { trip, due } = next;
  const eyebrow = t('f102.home.eyebrow');
  const head = t(due.when === 'today' ? 'f102.home.headToday' : 'f102.home.headTomorrow');
  const line = comeDueLine(t, due, lang);
  const left = t('comehome.brief.line', { when: whenWord(t, due), left: comeLeftLine(t, due, 'before') });
  // The check-out time, while the checkout row is still open (or the lists aren't started).
  const checkoutRow = readComingHome(trip)?.rows.find((r) => r.tpl === 'checkout');
  const checkout = !due.started || (checkoutRow && !checkoutRow.done) ? lastCheckout(trip, due.dep) : null;
  const checkoutLine = checkout
    ? checkout.date === due.dep.stamp.local.slice(0, 10)
      ? t('comehome.checkout.by', { name: checkout.name, time: checkout.time })
      : t('comehome.checkout.byDate', { name: checkout.name, time: checkout.time, date: formatDay(checkout.date, lang) })
    : '';
  const p = due.before;
  return (
    <FadeInView>
      <View style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.map[0] }, shadowOf(theme, 'mid')]}>
        <GradientFill tone="map" />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={[eyebrow, head, trip.name, line, checkoutLine, left].filter(Boolean).join('. ')}
          accessibilityHint={t('comehome.brief.hint', { trip: trip.name })}
          onPress={() => router.push({ pathname: '/comehome/[tripId]', params: { tripId: trip.id } })}
          style={{ padding: space.l, gap: space.s, minHeight: TOUCH }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="home-outline" size={18} color={theme.heroAccent} />
            </View>
            <Text style={[typeScale.caption, { color: theme.heroMuted, flex: 1 }]}>{eyebrow}</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="chevron-forward" size={18} color={theme.heroMuted} />
            </View>
          </View>
          <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{head}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{trip.name}</Text>
          <Text style={[typeScale.body, { color: theme.heroMuted }]}>{line}</Text>
          {checkoutLine ? <Text style={[typeScale.body, { color: theme.heroMuted }]}>{checkoutLine}</Text> : null}
          <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{left}</Text>
          {due.started && p.total ? (
            <ProgressBar progress={p.done / p.total} tone="ok" track={theme.heroWash} label={t('comehome.card.progress', { done: p.done, total: p.total })} />
          ) : null}
        </PressableScale>
      </View>
    </FadeInView>
  );
});
